import { BadRequestException,ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { Prisma,AdStatus,DisputeStatus,HealthArticleStatus,NotificationChannel,NotificationStatus,ReviewStatus,SubscriptionStatus,SubscriptionTier,VideoProvider,VideoSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto,DisputeDto,NotificationDto,ReviewDto,SubscribeDto,VideoDto } from './core.dto';
@Injectable()
export class CoreService {
 constructor(private readonly prisma:PrismaService){}
 async plans(){return this.prisma.subscriptionPlan.findMany({where:{active:true},orderBy:{price:'asc'}});}
 async createPlan(dto:CreatePlanDto){return this.prisma.subscriptionPlan.create({data:{...dto,price:dto.price,features:(dto.features??{}) as Prisma.InputJsonValue}});}
 async subscribe(userId:string,dto:SubscribeDto){
  const p=await this.prisma.subscriptionPlan.findUnique({where:{id:dto.planId}});
  if(!p||!p.active)throw new BadRequestException('Plan unavailable');
  if(p.tier===SubscriptionTier.FREE)return this.prisma.$transaction(async tx=>{
   await tx.subscription.updateMany({where:{userId,status:SubscriptionStatus.ACTIVE},data:{status:SubscriptionStatus.CANCELLED,endsAt:new Date()}});
   return tx.subscription.create({data:{userId,planId:p.id,provider:'INTERNAL',status:SubscriptionStatus.ACTIVE}});
  });
  if(!dto.provider||!dto.providerSubscriptionId)throw new BadRequestException('External subscription reference required');
  return this.prisma.$transaction(async tx=>{
   await tx.subscription.updateMany({where:{userId,status:SubscriptionStatus.ACTIVE},data:{status:SubscriptionStatus.CANCELLED,endsAt:new Date()}});
   return tx.subscription.create({data:{userId,planId:p.id,provider:dto.provider,providerSubscriptionId:dto.providerSubscriptionId,status:SubscriptionStatus.ACTIVE}});
  });
 }
 async mySubscriptions(userId:string){return this.prisma.subscription.findMany({where:{userId},include:{plan:true},orderBy:{createdAt:'desc'}});}
 async review(userId:string,dto:ReviewDto){
  const a=await this.prisma.appointment.findUnique({where:{id:dto.appointmentId}});
  if(!a||a.patientId!==userId||a.status!=='COMPLETED')throw new BadRequestException('Only completed own appointments can be reviewed');
  const existing=await this.prisma.review.findUnique({where:{appointmentId:a.id}});
  if(existing)throw new BadRequestException('Appointment already reviewed');
  return this.prisma.$transaction(async tx=>{
   const r=await tx.review.create({data:{appointmentId:a.id,doctorId:a.doctorId,patientId:userId,rating:dto.rating,comment:dto.comment}});
   const agg=await tx.review.aggregate({where:{doctorId:a.doctorId,status:ReviewStatus.PUBLISHED},_avg:{rating:true},_count:{rating:true}});
   await tx.doctorProfile.update({where:{userId:a.doctorId},data:{ratingAvg:agg._avg.rating??0,ratingCount:agg._count.rating}});
   return r;
  });
 }
 async reviews(doctorId:string){return this.prisma.review.findMany({where:{doctorId,status:ReviewStatus.PUBLISHED},orderBy:{createdAt:'desc'},take:100,select:{id:true,rating:true,comment:true,createdAt:true}});}
 async dispute(userId:string,dto:DisputeDto){
  const t=await this.prisma.transaction.findUnique({where:{id:dto.transactionId}});
  if(!t||t.userId!==userId)throw new ForbiddenException('Transaction access denied');
  if(!['SUCCEEDED','PARTIALLY_REFUNDED'].includes(t.status))throw new BadRequestException('Only settled transactions can be disputed');
  const existing=await this.prisma.dispute.findFirst({where:{transactionId:t.id,status:{in:[DisputeStatus.OPEN,DisputeStatus.UNDER_REVIEW]}}});
  if(existing)throw new BadRequestException('Transaction already has an active dispute');
  return this.prisma.$transaction(async tx=>{
   await tx.transaction.update({where:{id:t.id},data:{status:'DISPUTED'}});
   return tx.dispute.create({data:{transactionId:t.id,openedById:userId,reason:dto.reason,details:dto.details}});
  });
 }
 async disputes(){return this.prisma.dispute.findMany({include:{transaction:true,openedBy:{select:{id:true,email:true}}},orderBy:{createdAt:'desc'},take:200});}
 async resolveDispute(id:string,resolution:string){
  if(!resolution?.trim())throw new BadRequestException('Resolution is required');
  const d=await this.prisma.dispute.findUnique({where:{id}});
  if(!d)throw new NotFoundException('Dispute not found');
  if(d.status===DisputeStatus.RESOLVED||d.status===DisputeStatus.REJECTED)throw new BadRequestException('Dispute already closed');
  return this.prisma.dispute.update({where:{id},data:{status:DisputeStatus.RESOLVED,resolution:resolution.trim(),resolvedAt:new Date()}});
 }
 async notify(userId:string,dto:NotificationDto){return this.prisma.notification.create({data:{userId,channel:NotificationChannel.IN_APP,title:dto.title,body:dto.body,data:(dto.data??{}) as Prisma.InputJsonValue,status:NotificationStatus.SENT,sentAt:new Date()}});}
 async notifications(userId:string){return this.prisma.notification.findMany({where:{userId},orderBy:{createdAt:'desc'},take:100});}
 async markNotificationRead(userId:string,id:string){const n=await this.prisma.notification.findUnique({where:{id}});if(!n||n.userId!==userId)throw new ForbiddenException();return this.prisma.notification.update({where:{id},data:{status:NotificationStatus.READ,readAt:new Date()}});}
 async video(userId:string,dto:VideoDto){
  const a=await this.prisma.appointment.findUnique({where:{id:dto.appointmentId}});
  if(!a||![a.patientId,a.doctorId].includes(userId))throw new ForbiddenException();
  if(!['CONFIRMED','IN_PROGRESS'].includes(a.status))throw new BadRequestException('Appointment is not ready for video');
  const existing=await this.prisma.videoSession.findUnique({where:{appointmentId:a.id}});
  if(existing)return existing;
  const provider=(process.env.VIDEO_PROVIDER??'WEBRTC') as VideoProvider;
  return this.prisma.videoSession.create({data:{appointmentId:a.id,provider,roomName:'doctor-'+a.id,status:VideoSessionStatus.WAITING}});
 }
 async content(language='en'){return this.prisma.healthArticle.findMany({where:{language,status:HealthArticleStatus.PUBLISHED},orderBy:{publishedAt:'desc'},take:50});}
 async ads(){return this.prisma.ad.findMany({where:{status:AdStatus.ACTIVE,OR:[{startsAt:null},{startsAt:{lte:new Date()}}],AND:[{OR:[{endsAt:null},{endsAt:{gte:new Date()}}]}]},take:10});}
}