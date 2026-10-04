import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, DoctorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto, CancelAppointmentDto, RescheduleAppointmentDto, WaitlistDto } from './dto/booking.dto';
function offsetMinutes(date: Date, timeZone: string): number {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const v:Record<string,string>={}; for(const p of parts)v[p.type]=p.value;
 return Math.round((Date.UTC(+v.year,+v.month-1,+v.day,+v.hour,+v.minute,+v.second)-date.getTime())/60000);
}
export function zonedToUtc(local:string,timeZone:string):Date {
 const m=local.match(/^(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2})(?::(\\d{2}))?$/);
 if(!m) throw new BadRequestException('Use local datetime YYYY-MM-DDTHH:mm[:ss]');
 const naive=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]??0)); let result=new Date(naive);
 for(let i=0;i<3;i++) result=new Date(naive-offsetMinutes(result,timeZone)*60000);
 return result;
}
function localParts(date:Date,timeZone:string){const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);const v:Record<string,string>={};for(const p of parts)v[p.type]=p.value;const map:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};return {date:v.year+'-'+v.month+'-'+v.day,time:v.hour+':'+v.minute,dayOfWeek:map[v.weekday]};}

@Injectable()
export class BookingService {
 constructor(private readonly prisma:PrismaService){}
 async create(patientId:string,dto:CreateAppointmentDto){
  const doctor=await this.prisma.doctorProfile.findUnique({where:{userId:dto.doctorId}});
  if(!doctor) throw new NotFoundException('Doctor not found');
  if(doctor.status!==DoctorStatus.VERIFIED) throw new ConflictException('Doctor is not accepting bookings');
  if(patientId===dto.doctorId) throw new BadRequestException('A doctor cannot book their own service');
  const service=await this.prisma.doctorService.findFirst({where:{id:dto.serviceId,doctorId:dto.doctorId,active:true}});
  if(!service) throw new NotFoundException('Service not found');
  const patient=await this.prisma.patientProfile.findUnique({where:{userId:patientId}});
  if(!patient) throw new ForbiddenException('Patient profile required');
  const zone=dto.timezone??patient.timezone??'UTC',startsAt=zonedToUtc(dto.startsAtLocal,zone),endsAt=new Date(startsAt.getTime()+service.durationMinutes*60000);
  if(startsAt.getTime()<Date.now()+service.minimumNoticeMinutes*60000) throw new BadRequestException('This appointment does not satisfy minimum notice');
  const result=await this.prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.doctorId}))`;
   const existing=await tx.appointment.findFirst({where:{patientId,idempotencyKey:dto.idempotencyKey}});
   if(existing) return existing;
   const ok=await this.withinAvailability(tx,dto.doctorId,startsAt,endsAt,service.bufferBeforeMinutes,service.bufferAfterMinutes);
   if(!ok) throw new ConflictException('Selected time is outside doctor availability');
   const conflict=await tx.appointment.findFirst({where:{doctorId:dto.doctorId,status:{in:[AppointmentStatus.PENDING,AppointmentStatus.CONFIRMED,AppointmentStatus.IN_PROGRESS]},startsAt:{lt:new Date(endsAt.getTime()+service.bufferAfterMinutes*60000)},endsAt:{gt:new Date(startsAt.getTime()-service.bufferBeforeMinutes*60000)}}});
   if(conflict) throw new ConflictException('Selected time is no longer available');
   return tx.appointment.create({data:{patientId,doctorId:dto.doctorId,serviceId:service.id,startsAt,endsAt,patientTimezone:zone,status:AppointmentStatus.PENDING,idempotencyKey:dto.idempotencyKey},include:{service:true}});
  },{isolationLevel:'Serializable'});
  await this.prisma.auditLog.create({data:{actorUserId:patientId,action:'APPOINTMENT_CREATED',resourceType:'Appointment',resourceId:result.id,metadata:{doctorId:dto.doctorId,serviceId:dto.serviceId}}});
  return result;
 }
 private async withinAvailability(tx:any,doctorId:string,startsAt:Date,endsAt:Date,before:number,after:number){
  const doctor=await tx.doctorProfile.findUnique({where:{userId:doctorId},select:{timezone:true}});
  const lp=localParts(startsAt,doctor.timezone),ep=localParts(endsAt,doctor.timezone),m=(s:string)=>{const [h,x]=s.split(':').map(Number);return h*60+x};
  const windows=await tx.availability.findMany({where:{doctorId,dayOfWeek:lp.dayOfWeek,active:true}});
  const valid=windows.some((w:any)=>{const z=w.timezone??doctor.timezone;return z===doctor.timezone&&m(lp.time)-before>=m(w.startLocal)&&m(ep.time)+after<=m(w.endLocal)});
  if(!valid) return false;
  const exceptions=await tx.availabilityException.findMany({where:{doctorId,startsAt:{lt:new Date(endsAt.getTime()+after*60000)},endsAt:{gt:new Date(startsAt.getTime()-before*60000)}}});
  return exceptions.length===0;
 }
 async cancel(userId:string,id:string,dto:CancelAppointmentDto){
  const a=await this.prisma.appointment.findUnique({where:{id},include:{service:true}});
  if(!a) throw new NotFoundException('Appointment not found');
  if(a.patientId!==userId&&a.doctorId!==userId) throw new ForbiddenException();
  if(([AppointmentStatus.CANCELLED,AppointmentStatus.COMPLETED,AppointmentStatus.REFUNDED] as AppointmentStatus[]).includes(a.status)) throw new ConflictException('Appointment cannot be cancelled');
  const minutes=(a.startsAt.getTime()-Date.now())/60000;
  if(a.patientId===userId&&minutes<a.service.cancellationWindowMinutes) throw new ConflictException('Cancellation window has passed');
  const updated=await this.prisma.appointment.update({where:{id},data:{status:AppointmentStatus.CANCELLED,cancellationReason:dto.reason,cancelledAt:new Date()}});
  await this.prisma.auditLog.create({data:{actorUserId:userId,action:'APPOINTMENT_CANCELLED',resourceType:'Appointment',resourceId:id,metadata:{reason:dto.reason}}});
  return updated;
 }
 async reschedule(userId:string,id:string,dto:RescheduleAppointmentDto){
  const a=await this.prisma.appointment.findUnique({where:{id},include:{service:true}});
  if(!a) throw new NotFoundException('Appointment not found');
  if(a.patientId!==userId&&a.doctorId!==userId) throw new ForbiddenException();
  if(!([AppointmentStatus.PENDING,AppointmentStatus.CONFIRMED] as AppointmentStatus[]).includes(a.status)) throw new ConflictException('Appointment cannot be rescheduled');
  const startsAt=zonedToUtc(dto.startsAtLocal,dto.timezone??a.patientTimezone),endsAt=new Date(startsAt.getTime()+a.service.durationMinutes*60000);
  if(startsAt.getTime()<Date.now()+a.service.minimumNoticeMinutes*60000) throw new BadRequestException('New time does not satisfy minimum notice');
  const updated=await this.prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.doctorId}))`;
   const ok=await this.withinAvailability(tx,a.doctorId,startsAt,endsAt,a.service.bufferBeforeMinutes,a.service.bufferAfterMinutes);
   if(!ok) throw new ConflictException('New time is outside doctor availability');
   const conflict=await tx.appointment.findFirst({where:{doctorId:a.doctorId,id:{not:a.id},status:{in:[AppointmentStatus.PENDING,AppointmentStatus.CONFIRMED,AppointmentStatus.IN_PROGRESS]},startsAt:{lt:new Date(endsAt.getTime()+a.service.bufferAfterMinutes*60000)},endsAt:{gt:new Date(startsAt.getTime()-a.service.bufferBeforeMinutes*60000)}}});
   if(conflict) throw new ConflictException('New time is no longer available');
   return tx.appointment.update({where:{id:a.id},data:{startsAt,endsAt,patientTimezone:dto.timezone??a.patientTimezone}});
  },{isolationLevel:'Serializable'});
  await this.prisma.auditLog.create({data:{actorUserId:userId,action:'APPOINTMENT_RESCHEDULED',resourceType:'Appointment',resourceId:id,metadata:{startsAt:updated.startsAt.toISOString()}}});
  return updated;
 }
 async addWaitlist(patientId:string,dto:WaitlistDto){
  const service=await this.prisma.doctorService.findFirst({where:{id:dto.serviceId,doctorId:dto.doctorId,active:true},include:{doctor:true}});
  if(!service||service.doctor.status!==DoctorStatus.VERIFIED) throw new ConflictException('Service is not available for waitlist');
  return this.prisma.waitlist.create({data:{patientId,doctorId:dto.doctorId,serviceId:dto.serviceId,preferredStartsAt:dto.preferredStartsAt?new Date(dto.preferredStartsAt):undefined,preferredEndsAt:dto.preferredEndsAt?new Date(dto.preferredEndsAt):undefined,timezone:dto.timezone??'UTC'}});
 }
 async listMine(userId:string){return this.prisma.appointment.findMany({where:{OR:[{patientId:userId},{doctorId:userId}]},include:{service:true},orderBy:{startsAt:'asc'},take:100});}
}