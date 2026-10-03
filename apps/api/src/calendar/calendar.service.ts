import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, AvailabilityExceptionType, DoctorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SetAvailabilityDto, SetExceptionDto } from './dto/availability.dto';
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

function mins(s:string){const [h,m]=s.split(':').map(Number);return h*60+m;}
@Injectable()
export class CalendarService {
 constructor(private readonly prisma:PrismaService){}
 async setAvailability(userId:string,dto:SetAvailabilityDto){
  const doctor=await this.prisma.doctorProfile.findUnique({where:{userId}});
  if(!doctor) throw new NotFoundException('Doctor profile not found');
  if(doctor.status!==DoctorStatus.VERIFIED) throw new ConflictException('Only verified doctors can publish availability');
  if(mins(dto.endLocal)<=mins(dto.startLocal)) throw new BadRequestException('Availability must end after it starts');
  const existing=await this.prisma.availability.findFirst({where:{doctorId:userId,dayOfWeek:dto.dayOfWeek,startLocal:dto.startLocal}});
  return existing
   ? this.prisma.availability.update({where:{id:existing.id},data:{endLocal:dto.endLocal,timezone:dto.timezone??doctor.timezone,active:dto.active??true}})
   : this.prisma.availability.create({data:{doctorId:userId,dayOfWeek:dto.dayOfWeek,startLocal:dto.startLocal,endLocal:dto.endLocal,timezone:dto.timezone??doctor.timezone,active:dto.active??true}});
 }
 async listAvailability(doctorId:string){return this.prisma.availability.findMany({where:{doctorId,active:true},orderBy:[{dayOfWeek:'asc'},{startLocal:'asc'}]});}
 async setException(userId:string,dto:SetExceptionDto){
  const doctor=await this.prisma.doctorProfile.findUnique({where:{userId}});
  if(!doctor) throw new NotFoundException('Doctor profile not found');
  const startsAt=zonedToUtc(dto.startsAt,doctor.timezone),endsAt=zonedToUtc(dto.endsAt,doctor.timezone);
  if(endsAt<=startsAt) throw new BadRequestException('Exception end must be after start');
  return this.prisma.availabilityException.create({data:{doctorId:userId,type:dto.type as AvailabilityExceptionType,startsAt,endsAt,allDay:dto.allDay??true,reason:dto.reason}});
 }
 async listExceptions(userId:string,from:string,to:string){
  const doctor=await this.prisma.doctorProfile.findUnique({where:{userId}});
  if(!doctor) throw new NotFoundException('Doctor profile not found');
  const starts=zonedToUtc(from,doctor.timezone),ends=zonedToUtc(to,doctor.timezone);
  return this.prisma.availabilityException.findMany({where:{doctorId:userId,startsAt:{lt:ends},endsAt:{gt:starts}},orderBy:{startsAt:'asc'}});
 }
 async slots(doctorId:string,from:string,to:string,timezone?:string){
  const doctor=await this.prisma.doctorProfile.findUnique({where:{userId:doctorId},include:{availabilities:{where:{active:true}},availabilityExceptions:true,services:{where:{active:true}}}});
  if(!doctor) throw new NotFoundException('Doctor not found');
  if(doctor.status!==DoctorStatus.VERIFIED) return {doctorId,timezone:timezone??doctor.timezone,slots:[]};
  const zone=timezone??doctor.timezone,fromUtc=zonedToUtc(from,zone),toUtc=zonedToUtc(to,zone);
  if(toUtc<=fromUtc||toUtc.getTime()-fromUtc.getTime()>31*86400000) throw new BadRequestException('Calendar window must be 0-31 days');
  const appointments=await this.prisma.appointment.findMany({where:{doctorId,startsAt:{lt:toUtc},endsAt:{gt:fromUtc},status:{in:[AppointmentStatus.PENDING,AppointmentStatus.CONFIRMED,AppointmentStatus.IN_PROGRESS]}},select:{startsAt:true,endsAt:true}});
  const out:{startsAt:string;endsAt:string;serviceId:string}[]=[];
  for(let d=new Date(fromUtc);d<toUtc;d=new Date(d.getTime()+86400000)){
   const lp=localParts(d,doctor.timezone);
   for(const w of doctor.availabilities.filter(a=>a.dayOfWeek===lp.dayOfWeek)){
    const z=w.timezone??doctor.timezone,start=zonedToUtc(lp.date+'T'+w.startLocal,z),end=zonedToUtc(lp.date+'T'+w.endLocal,z);
    for(const service of doctor.services){
     const step=(service.durationMinutes+service.bufferAfterMinutes)*60000;
     for(let cursor=start.getTime()+service.bufferBeforeMinutes*60000;cursor+service.durationMinutes*60000+service.bufferAfterMinutes*60000<=end.getTime();cursor+=step){
      const s=new Date(cursor),e=new Date(cursor+service.durationMinutes*60000),blocked=doctor.availabilityExceptions.some(x=>x.startsAt<new Date(e.getTime()+service.bufferAfterMinutes*60000)&&x.endsAt>new Date(s.getTime()-service.bufferBeforeMinutes*60000)),conflict=appointments.some(a=>a.startsAt<new Date(e.getTime()+service.bufferAfterMinutes*60000)&&a.endsAt>new Date(s.getTime()-service.bufferBeforeMinutes*60000));
      if(s>=fromUtc&&e<=toUtc&&s.getTime()>=Date.now()+service.minimumNoticeMinutes*60000&&!blocked&&!conflict) out.push({startsAt:s.toISOString(),endsAt:e.toISOString(),serviceId:service.id});
     }
    }
   }
  }
  return {doctorId,timezone:zone,slots:out.sort((a,b)=>a.startsAt.localeCompare(b.startsAt))};
 }
}