import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageType, ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessageCryptoService } from './crypto.service';
import { DocumentStorageService } from './storage.service';
import { CreateConversationDto, InitDocumentDto, ReportDto, SendMessageDto } from './dto/messaging.dto';
@Injectable()
export class MessagingService {
 constructor(private readonly prisma:PrismaService,private readonly crypto:MessageCryptoService,private readonly storage:DocumentStorageService){}
 private async conversationForUser(id:string,userId:string){const c=await this.prisma.conversation.findUnique({where:{id},include:{patient:true,doctor:true}});if(!c)throw new NotFoundException('Conversation not found');if(c.patientId!==userId&&c.doctorId!==userId)throw new ForbiddenException('Conversation access denied');return c;}
 async createConversation(userId:string,dto:CreateConversationDto){
  const doctor=await this.prisma.doctorProfile.findUnique({where:{userId:dto.doctorId}});if(!doctor||doctor.status!=='VERIFIED')throw new BadRequestException('Doctor is not available');
  if(userId===dto.doctorId)throw new BadRequestException('Invalid participants');
  if(dto.appointmentId){const a=await this.prisma.appointment.findUnique({where:{id:dto.appointmentId}});if(!a||a.patientId!==userId||a.doctorId!==dto.doctorId)throw new ForbiddenException('Appointment does not belong to both participants');}
  return this.prisma.conversation.upsert({where:{patientId_doctorId:{patientId:userId,doctorId:dto.doctorId}},create:{patientId:userId,doctorId:dto.doctorId,appointmentId:dto.appointmentId},update:{appointmentId:dto.appointmentId??undefined,status:ConversationStatus.ACTIVE}});
 }
 async listConversations(userId:string){return this.prisma.conversation.findMany({where:{OR:[{patientId:userId},{doctorId:userId}]},include:{patient:{select:{id:true,email:true}},doctor:{select:{id:true,email:true,doctor:{select:{displayName:true}}}},_count:{select:{messages:true}}},orderBy:{lastMessageAt:'desc'}});}
 async messages(userId:string,id:string,cursor?:string){
  await this.conversationForUser(id,userId); const rows=await this.prisma.message.findMany({where:{conversationId:id,...(cursor?{createdAt:{lt:new Date(cursor)}}:{})},include:{sender:{select:{id:true}},attachments:{include:{document:true}},reads:true},orderBy:{createdAt:'desc'},take:50});
  return rows.map(m=>({...m,text:m.encryptedContent&&m.nonce&&m.authTag?this.crypto.decrypt(m.encryptedContent,m.nonce,m.authTag):null,encryptedContent:undefined,nonce:undefined,authTag:undefined,attachments:m.attachments.map(a=>({...a,document:{...a.document,sizeBytes:a.document.sizeBytes.toString()}}))}));
 }
 async send(userId:string,id:string,dto:SendMessageDto){
  const c=await this.conversationForUser(id,userId);if(c.status===ConversationStatus.BLOCKED)throw new ForbiddenException('Conversation is blocked');
  const enc=this.crypto.encrypt(dto.text);
  const m=await this.prisma.$transaction(async tx=>{const msg=await tx.message.create({data:{conversationId:id,senderId:userId,type:(dto.type??'TEXT') as MessageType,appointmentId:dto.appointmentId,replyToId:dto.replyToId,...enc}});await tx.messageRead.create({data:{messageId:msg.id,userId}});await tx.conversation.update({where:{id},data:{lastMessageAt:msg.createdAt}});await tx.auditLog.create({data:{actorUserId:userId,action:'MESSAGE_SENT',resourceType:'Conversation',resourceId:id,metadata:{messageId:msg.id,type:msg.type}}});return msg;});return {id:m.id,conversationId:m.conversationId,type:m.type,createdAt:m.createdAt,text:dto.text};}
 async markRead(userId:string,messageId:string){const m=await this.prisma.message.findUnique({where:{id:messageId},include:{conversation:true}});if(!m)throw new NotFoundException('Message not found');if(m.conversation.patientId!==userId&&m.conversation.doctorId!==userId)throw new ForbiddenException();await this.prisma.messageRead.upsert({where:{messageId_userId:{messageId,userId}},create:{messageId,userId},update:{readAt:new Date()}});return {success:true};}
 async initDocument(userId:string,dto:InitDocumentDto){
  const allowed=['application/pdf','image/jpeg','image/png','image/webp'];if(!allowed.includes(dto.mimeType))throw new BadRequestException('Unsupported document type');if(!Number.isInteger(dto.sizeBytes)||dto.sizeBytes<1||dto.sizeBytes>25*1024*1024)throw new BadRequestException('Document size must be 1 byte to 25 MB');
  if(dto.doctorId){const doctor=await this.prisma.doctorProfile.findUnique({where:{userId:dto.doctorId}});if(!doctor||doctor.status!=='VERIFIED')throw new BadRequestException('Invalid doctor');}
  const key=this.storage.key(userId,dto.originalName);const doc=await this.prisma.medicalDocument.create({data:{ownerId:userId,uploaderId:userId,doctorId:dto.doctorId,objectKey:key,originalName:dto.originalName.replace(/[\\/]/g,'_'),mimeType:dto.mimeType,sizeBytes:BigInt(dto.sizeBytes)}});const uploadUrl=await this.storage.createUpload(key,dto.mimeType);return {documentId:doc.id,objectKey:key,uploadUrl,expiresIn:300};
 }
 async document(userId:string,id:string){const d=await this.prisma.medicalDocument.findUnique({where:{id}});if(!d||d.deletedAt)throw new NotFoundException('Document not found');if(d.ownerId!==userId&&d.uploaderId!==userId&&d.doctorId!==userId)throw new ForbiddenException('Document access denied');const url=await this.storage.createDownload(d.objectKey);await this.prisma.auditLog.create({data:{actorUserId:userId,action:'MEDICAL_DOCUMENT_ACCESSED',resourceType:'MedicalDocument',resourceId:id}});return {...d,sizeBytes:d.sizeBytes.toString(),downloadUrl:url,expiresIn:300};}
 async report(userId:string,conversationId:string,dto:ReportDto){const c=await this.conversationForUser(conversationId,userId);if(dto.messageId){const m=await this.prisma.message.findUnique({where:{id:dto.messageId}});if(!m||m.conversationId!==conversationId)throw new BadRequestException('Invalid message');}return this.prisma.report.create({data:{reporterId:userId,targetUserId:c.patientId===userId?c.doctorId:c.patientId,conversationId,messageId:dto.messageId,reason:dto.reason,details:dto.details,status:ReportStatus.OPEN}});}
 async block(userId:string,id:string){await this.conversationForUser(id,userId);return this.prisma.conversation.update({where:{id},data:{status:ConversationStatus.BLOCKED}});}
}