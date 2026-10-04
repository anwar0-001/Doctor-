import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DoctorStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DoctorApplicationDto } from './dto/doctor-application.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';

@Injectable()
export class DoctorsService {
 constructor(private readonly prisma: PrismaService) {}

 async apply(userId:string,dto:DoctorApplicationDto){
  const existing=await this.prisma.doctorProfile.findUnique({where:{userId}});
  if(existing && ([DoctorStatus.UNDER_REVIEW,DoctorStatus.VERIFIED] as DoctorStatus[]).includes(existing.status)) throw new ConflictException('A doctor application already exists');
  const [specialty,country,city,languages]=await Promise.all([
   this.prisma.specialty.findFirst({where:{id:dto.specialtyId,active:true}}),
   this.prisma.country.findFirst({where:{id:dto.countryId,active:true}}),
   this.prisma.city.findFirst({where:{id:dto.cityId,countryId:dto.countryId,active:true}}),
   this.prisma.language.findMany({where:{id:{in:dto.languageIds},active:true},select:{id:true}})
  ]);
  if(!specialty||!country||!city||languages.length!==new Set(dto.languageIds).size) throw new BadRequestException('Invalid specialty, country, city, or language selection');
  return this.prisma.$transaction(async tx=>{
   await tx.userRoleAssignment.upsert({where:{userId_role:{userId,role:UserRole.DOCTOR}},create:{userId,role:UserRole.DOCTOR},update:{}});
   const doctor=await tx.doctorProfile.upsert({where:{userId},create:{userId,legalName:dto.legalName,displayName:dto.legalName,specialtyId:dto.specialtyId,countryId:dto.countryId,cityId:dto.cityId,gender:dto.gender,bio:dto.bio,timezone:dto.timezone??'UTC',status:DoctorStatus.UNDER_REVIEW},update:{legalName:dto.legalName,displayName:dto.legalName,specialtyId:dto.specialtyId,countryId:dto.countryId,cityId:dto.cityId,gender:dto.gender,bio:dto.bio,timezone:dto.timezone??'UTC',status:DoctorStatus.UNDER_REVIEW}});
   await tx.doctorLanguage.deleteMany({where:{doctorId:userId}});
   await tx.doctorLanguage.createMany({data:dto.languageIds.map(languageId=>({doctorId:userId,languageId}))});
   await tx.medicalLicense.create({data:{doctorId:userId,licenseNumber:dto.licenseNumber,licensingAuthority:dto.licensingAuthority,countryId:dto.countryId}});
   const verification=await tx.doctorVerification.create({data:{doctorId:userId,status:DoctorStatus.UNDER_REVIEW,legalName:dto.legalName,licenseNumber:dto.licenseNumber,licensingAuthority:dto.licensingAuthority,graduationYear:dto.graduationYear,university:dto.university}});
   await tx.auditLog.create({data:{actorUserId:userId,action:'DOCTOR_APPLICATION_SUBMITTED',resourceType:'DoctorVerification',resourceId:verification.id}});
   return {verificationId:verification.id,status:verification.status,doctorId:doctor.userId};
  });
 }
 async me(userId:string){
  const doctor=await this.prisma.doctorProfile.findUnique({where:{userId},include:{specialty:true,country:true,city:true,languages:{include:{language:true}},licenses:true,verifications:{orderBy:{createdAt:'desc'},take:1}}});
  if(!doctor) throw new NotFoundException('Doctor profile not found'); return doctor;
 }
 async review(id:string,reviewerId:string,dto:ReviewVerificationDto){
  const verification=await this.prisma.doctorVerification.findUnique({where:{id},include:{doctor:true}});
  if(!verification) throw new NotFoundException('Verification not found');
  if(verification.status!==DoctorStatus.UNDER_REVIEW) throw new ConflictException('Verification is not reviewable');
  if(dto.decision==='REJECT'&&!dto.reason?.trim()) throw new BadRequestException('Rejection reason is required');
  const next=dto.decision==='VERIFY'?DoctorStatus.VERIFIED:dto.decision==='SUSPEND'?DoctorStatus.SUSPENDED:DoctorStatus.REJECTED;
  return this.prisma.$transaction(async tx=>{
   const v=await tx.doctorVerification.update({where:{id},data:{status:next,reviewedBy:reviewerId,reviewedAt:new Date(),rejectionReason:dto.reason}});
   await tx.doctorProfile.update({where:{userId:verification.doctorId},data:{status:next,verifiedAt:next===DoctorStatus.VERIFIED?new Date():null}});
   await tx.medicalLicense.updateMany({where:{doctorId:verification.doctorId,licenseNumber:verification.licenseNumber??undefined},data:{status:next===DoctorStatus.VERIFIED?'VERIFIED':next===DoctorStatus.SUSPENDED?'SUSPENDED':'REJECTED'}});
   await tx.auditLog.create({data:{actorUserId:reviewerId,action:'DOCTOR_VERIFICATION_REVIEWED',resourceType:'DoctorVerification',resourceId:id,metadata:{decision:dto.decision,reason:dto.reason??null}}});
   return v;
  });
 }
 async queue(status?:DoctorStatus){
  return this.prisma.doctorVerification.findMany({where:{status:status??DoctorStatus.UNDER_REVIEW},include:{doctor:{include:{user:{select:{id:true,email:true}},specialty:true,country:true,city:true,licenses:true}},documents:true},orderBy:{createdAt:'asc'},take:100});
 }
 async search(q:{specialtyId?:string;countryId?:string;cityId?:string;languageId?:string;gender?:string;minRating?:number;page?:number;pageSize?:number}){
  const page=Math.max(1,q.page??1), pageSize=Math.min(50,Math.max(1,q.pageSize??20));
  const where:any={status:DoctorStatus.VERIFIED};
  if(q.specialtyId) where.specialtyId=q.specialtyId;if(q.countryId) where.countryId=q.countryId;if(q.cityId) where.cityId=q.cityId;if(q.gender) where.gender=q.gender;if(q.minRating!==undefined) where.ratingAvg={gte:q.minRating};if(q.languageId) where.languages={some:{languageId:q.languageId}};
  const [items,total]=await this.prisma.$transaction([
   this.prisma.doctorProfile.findMany({where,select:{userId:true,displayName:true,bio:true,gender:true,timezone:true,ratingAvg:true,ratingCount:true,specialty:true,country:true,city:true,languages:{include:{language:true}},services:{where:{active:true},select:{id:true,name:true,consultationType:true,durationMinutes:true,price:true,currency:true}}},orderBy:[{ratingAvg:'desc'},{ratingCount:'desc'}],skip:(page-1)*pageSize,take:pageSize}),
   this.prisma.doctorProfile.count({where})
  ]);
  return {items,page,pageSize,total,pages:Math.ceil(total/pageSize)};
 }
}