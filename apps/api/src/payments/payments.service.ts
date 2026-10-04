import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentStatus, DoctorStatus, PaymentStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type StripeResponse={id:string;client_secret?:string;status?:string;url?:string;account?:string;details_submitted?:boolean;charges?:{data?:Array<{id:string}>};amount?:number};
@Injectable()
export class PaymentsService {
 constructor(private readonly prisma:PrismaService,private readonly config:ConfigService){}
 private key(){const k=this.config.get<string>('STRIPE_SECRET_KEY');if(!k)throw new ConflictException('Stripe is not configured');return k;}
 private async stripe(path:string,method:'GET'|'POST',body?:Record<string,unknown>,headers:Record<string,string>={}){
  const params=new URLSearchParams(); if(body) for(const [k,v] of Object.entries(body)){if(Array.isArray(v)) for(const x of v) params.append(k+'[]',String(x)); else params.append(k,String(v));}
  const res=await fetch('https://api.stripe.com/v1/'+path,{method,headers:{Authorization:'Bearer '+this.key(),'Content-Type':'application/x-www-form-urlencoded',...headers},body:method==='POST'?params:undefined});
  const data=await res.json() as any;if(!res.ok) throw new ConflictException(data?.error?.message??'Stripe request failed');return data as StripeResponse;
 }
 async createConnectOnboarding(userId:string,returnUrl:string,refreshUrl:string){
  const doctor=await this.prisma.doctorProfile.findUnique({where:{userId},include:{country:true}});
  if(!doctor) throw new NotFoundException('Doctor profile not found'); if(doctor.status!==DoctorStatus.VERIFIED) throw new ConflictException('Doctor must be verified first');
  let accountId=doctor.stripeAccountId;
  if(!accountId){const a=await this.stripe('accounts','POST',{type:'express',country:(doctor.country?.code??this.config.get<string>('STRIPE_CONNECT_COUNTRY','US')).toUpperCase(),'capabilities[card_payments][requested]':'true','capabilities[transfers][requested]':'true'});accountId=a.id;await this.prisma.doctorProfile.update({where:{userId},data:{stripeAccountId:accountId}});}
  const link=await this.stripe('account_links','POST',{account:accountId,refresh_url:refreshUrl,return_url:returnUrl,type:'account_onboarding'});
  return {accountId,url:link.url};
 }
 async createPaymentIntent(userId:string,appointmentId:string){
  const a=await this.prisma.appointment.findUnique({where:{id:appointmentId},include:{service:true}});
  if(!a||a.patientId!==userId) throw new NotFoundException('Appointment not found');
  if(a.status!==AppointmentStatus.PENDING) throw new ConflictException('Appointment is not payable');
  const doctor=await this.prisma.doctorProfile.findUnique({where:{userId:a.doctorId}}); if(!doctor||doctor.status!==DoctorStatus.VERIFIED||!doctor.stripeAccountId||!doctor.stripeOnboardingComplete) throw new ConflictException('Doctor payout account is not ready');
  const existing=await this.prisma.transaction.findFirst({where:{appointmentId,status:PaymentStatus.PENDING},orderBy:{createdAt:'desc'}});
  if(existing?.providerClientSecret&&existing.providerTransactionId) return {transactionId:existing.id,paymentIntentId:existing.providerTransactionId,clientSecret:existing.providerClientSecret};
  const fee=await this.prisma.platformFeeConfig.findFirst({where:{active:true,effectiveFrom:{lte:new Date()}},orderBy:{effectiveFrom:'desc'}});
  if(!fee) throw new ConflictException('No active platform fee configuration');
  const amount=Number(a.service.price),patientFee=Number((amount*Number(fee.patientPercent)/100).toFixed(2)),doctorFee=Number((amount*Number(fee.doctorPercent)/100).toFixed(2)),total=amount+patientFee,platformRevenue=patientFee+doctorFee,doctorNet=amount-doctorFee;
  const minor=Math.round(total*100),applicationFee=Math.round(platformRevenue*100);
  if(!Number.isSafeInteger(minor)||!Number.isSafeInteger(applicationFee)||minor<=0) throw new BadRequestException('Invalid payment amount');
  const tx=await this.prisma.transaction.create({data:{appointmentId,userId,provider:'stripe',currency:a.service.currency.toLowerCase(),consultationAmount:amount,patientPlatformFee:patientFee,doctorPlatformFee:doctorFee,doctorNet,platformRevenue,feeSnapshot:{patientPercent:String(fee.patientPercent),doctorPercent:String(fee.doctorPercent),monthlyDoctorPercent:String(fee.monthlyDoctorPercent),feeConfigId:fee.id}}});
  try{
   const intent=await this.stripe('payment_intents','POST',{amount:minor,currency:a.service.currency.toLowerCase(),payment_method_types:['card'],application_fee_amount:applicationFee,'transfer_data[destination]':doctor.stripeAccountId,'metadata[transactionId]':tx.id,'metadata[appointmentId]':appointmentId});
   const expanded=await this.stripe('payment_intents/'+intent.id+'?expand[]=latest_charge','GET'); const feeId=typeof (expanded as any)?.latest_charge?.application_fee==='string' ? (expanded as any).latest_charge.application_fee : (expanded as any)?.latest_charge?.application_fee?.id; const updated=await this.prisma.transaction.update({where:{id:tx.id},data:{providerTransactionId:intent.id,providerClientSecret:intent.client_secret,providerFeeId:feeId}});
   return {transactionId:updated.id,paymentIntentId:intent.id,clientSecret:intent.client_secret};
  }catch(e){await this.prisma.transaction.update({where:{id:tx.id},data:{status:PaymentStatus.FAILED}});throw e;}
 }
 private verifySignature(payload:Buffer|string,signature:string){
  const secret=this.config.get<string>('STRIPE_WEBHOOK_SECRET');if(!secret)throw new ConflictException('Stripe webhook is not configured');
  const parts=signature.split(',');const t=parts.find(x=>x.startsWith('t='))?.slice(2);const v1=parts.filter(x=>x.startsWith('v1=')).map(x=>x.slice(3));if(!t||!v1.length)throw new UnauthorizedException('Invalid Stripe signature');
  const signed=t+'.'+(typeof payload==='string'?payload:payload.toString('utf8'));const expected=createHmac('sha256',secret).update(signed).digest('hex');
  if(!v1.some(v=>v.length===expected.length&&timingSafeEqual(Buffer.from(v),Buffer.from(expected))))throw new UnauthorizedException('Invalid Stripe signature');
  if(Math.abs(Date.now()/1000-Number(t))>300)throw new UnauthorizedException('Expired Stripe signature');
 }
 async webhook(payload:Buffer,signature:string){
  this.verifySignature(payload,signature);let event:any;try{event=JSON.parse(payload.toString('utf8'));}catch{throw new BadRequestException('Invalid webhook payload');}
  const provider='stripe',eventId=event.id;if(!eventId)throw new BadRequestException('Missing event id');
  const existing=await this.prisma.paymentWebhookEvent.findUnique({where:{provider_eventId:{provider,eventId}}});if(existing?.processedAt)return {received:true,duplicate:true};
  await this.prisma.paymentWebhookEvent.upsert({where:{provider_eventId:{provider,eventId}},create:{provider,eventId,payload:event},update:{payload:event}});
  const claimed=await this.prisma.paymentWebhookEvent.updateMany({where:{provider_eventId:{provider,eventId},processedAt:null,status:'RECEIVED'},data:{status:'PROCESSING'}});if(claimed.count!==1)return {received:true,duplicate:true};
  try{
   const obj=event.data?.object as any;const txId=obj?.metadata?.transactionId as string|undefined;
   if(event.type==='charge.refunded'){
    const paymentIntentId=obj?.payment_intent as string|undefined;
    if(paymentIntentId){const tx=await this.prisma.transaction.findFirst({where:{provider:'stripe',providerTransactionId:paymentIntentId}});if(tx){const charged=Number(tx.consultationAmount)+Number(tx.patientPlatformFee);const refunded=Math.min(charged,Number(obj?.amount_refunded??0)/100);const status=refunded>=charged?PaymentStatus.REFUNDED:refunded>0?PaymentStatus.PARTIALLY_REFUNDED:tx.status;await this.prisma.transaction.update({where:{id:tx.id},data:{refundAmount:refunded,status}});}}
   } else if(event.type==='refund.updated'){
    const paymentIntentId=obj?.payment_intent as string|undefined;
    if(paymentIntentId&&obj?.status==='succeeded'){const tx=await this.prisma.transaction.findFirst({where:{provider:'stripe',providerTransactionId:paymentIntentId}});if(tx){const charged=Number(tx.consultationAmount)+Number(tx.patientPlatformFee);const amount=Number(obj?.amount??0)/100;const total=Math.min(charged,Number(tx.refundAmount)+amount);const status=total>=charged?PaymentStatus.REFUNDED:PaymentStatus.PARTIALLY_REFUNDED;await this.prisma.transaction.update({where:{id:tx.id},data:{refundAmount:total,status}});}}
   } else if(event.type==='account.updated'){
    const accountId=obj?.id as string|undefined;
    if(accountId) await this.prisma.doctorProfile.updateMany({where:{stripeAccountId:accountId},data:{stripeOnboardingComplete:Boolean(obj?.details_submitted&&obj?.charges_enabled&&obj?.payouts_enabled)}});
   } else if(txId && event.type==='payment_intent.succeeded'){await this.prisma.$transaction([this.prisma.transaction.update({where:{id:txId},data:{status:PaymentStatus.SUCCEEDED}}),this.prisma.appointment.updateMany({where:{id:obj.metadata.appointmentId,status:AppointmentStatus.PENDING},data:{status:AppointmentStatus.CONFIRMED}})]);}
    else if(txId && event.type==='payment_intent.payment_failed'){await this.prisma.$transaction([this.prisma.transaction.update({where:{id:txId},data:{status:PaymentStatus.FAILED}}),this.prisma.appointment.updateMany({where:{id:obj.metadata.appointmentId,status:AppointmentStatus.PENDING},data:{status:AppointmentStatus.CANCELLED,cancellationReason:'Payment failed',cancelledAt:new Date()}})]);}
    else if(txId && event.type==='payment_intent.canceled') await this.prisma.transaction.update({where:{id:txId},data:{status:PaymentStatus.FAILED}});
   }
   await this.prisma.paymentWebhookEvent.update({where:{provider_eventId:{provider,eventId}},data:{processedAt:new Date(),status:'PROCESSED'}});
  }catch(e){await this.prisma.paymentWebhookEvent.update({where:{provider_eventId:{provider,eventId}},data:{status:'FAILED'}});throw e;}
  return {received:true};
 }
 async refund(userId:string,appointmentId:string,reason:string){
  const a=await this.prisma.appointment.findUnique({
    where:{id:appointmentId},
    include:{transactions:{where:{status:{in:[PaymentStatus.SUCCEEDED,PaymentStatus.PARTIALLY_REFUNDED]},orderBy:{createdAt:'desc'}}}},
  });
  if(!a)throw new NotFoundException('Appointment not found');
  if(a.patientId!==userId&&a.doctorId!==userId)throw new UnauthorizedException();
  const tx=a.transactions[0];
  if(!tx?.providerTransactionId)throw new ConflictException('No refundable payment found');
  const charged=Number(tx.consultationAmount)+Number(tx.patientPlatformFee);
  const alreadyRefunded=Number(tx.refundAmount);
  const remaining=Math.max(0,Number((charged-alreadyRefunded).toFixed(2)));
  if(remaining<=0)throw new ConflictException('Payment is already fully refunded');
  const amountMinor=Math.round(remaining*100);
  const idempotencyKey='refund:'+tx.id+':'+amountMinor;
  const refund=await this.stripe('refunds','POST',{
    payment_intent:tx.providerTransactionId,
    amount:amountMinor,
    refund_application_fee:'true',
    reason:'requested_by_customer',
    metadata:{transactionId:tx.id,reason:reason.slice(0,500)},
  },{'Idempotency-Key':idempotencyKey});
  const amount=Number(refund.amount??0)/100;
  const newRefundTotal=Number((alreadyRefunded+amount).toFixed(2));
  const status=newRefundTotal>=charged?PaymentStatus.REFUNDED:PaymentStatus.PARTIALLY_REFUNDED;
  await this.prisma.$transaction([
    this.prisma.transaction.update({where:{id:tx.id},data:{status,refundAmount:newRefundTotal}}),
    this.prisma.auditLog.create({data:{actorUserId:userId,action:'PAYMENT_REFUNDED',resourceType:'Transaction',resourceId:tx.id,metadata:{appointmentId,refundId:refund.id,amount,refundTotal:newRefundTotal,reason:reason.slice(0,500)}}}),
  ]);
  return {refundId:refund.id,amount,refundTotal:newRefundTotal,remaining:Number(Math.max(0,charged-newRefundTotal).toFixed(2))};
 }
 async refundTransaction(actorUserId:string,transactionId:string,amount?:number,reason='Dispute resolution'){
  const tx=await this.prisma.transaction.findUnique({where:{id:transactionId}});
  if(!tx?.providerTransactionId) throw new ConflictException('No refundable payment found');
  if(![PaymentStatus.SUCCEEDED,PaymentStatus.PARTIALLY_REFUNDED,PaymentStatus.DISPUTED].includes(tx.status)) throw new ConflictException('Transaction is not refundable');
  const charged=Number(tx.consultationAmount)+Number(tx.patientPlatformFee),already=Number(tx.refundAmount);
  const remaining=Math.max(0,Number((charged-already).toFixed(2)));
  const requested=amount==null?remaining:Number(amount);
  if(!Number.isFinite(requested)||requested<=0||requested>remaining) throw new BadRequestException('Invalid refund amount');
  const amountMinor=Math.round(requested*100),idempotencyKey='refund:'+tx.id+':'+amountMinor;
  const refund=await this.stripe('refunds','POST',{payment_intent:tx.providerTransactionId,amount:amountMinor,refund_application_fee:'true',reason:'requested_by_customer',metadata:{transactionId:tx.id,reason:reason.slice(0,500)}},{'Idempotency-Key':idempotencyKey});
  const refunded=Number(refund.amount??0)/100,newTotal=Number((already+refunded).toFixed(2));
  const status=newTotal>=charged?PaymentStatus.REFUNDED:PaymentStatus.PARTIALLY_REFUNDED;
  await this.prisma.$transaction([
   this.prisma.transaction.update({where:{id:tx.id},data:{status,refundAmount:newTotal}}),
   this.prisma.auditLog.create({data:{actorUserId,action:'PAYMENT_REFUNDED',resourceType:'Transaction',resourceId:tx.id,metadata:{refundId:refund.id,amount:refunded,refundTotal:newTotal,reason:reason.slice(0,500)}}}),
  ]);
  return {refundId:refund.id,amount:refunded,refundTotal:newTotal,remaining:Number(Math.max(0,charged-newTotal).toFixed(2))};
 }
 async listFeeConfigs(){
  return this.prisma.platformFeeConfig.findMany({orderBy:{effectiveFrom:'desc'}});
 }
 async createFeeConfig(actorUserId:string,dto:{name:string;patientPercent:number;doctorPercent:number;monthlyDoctorPercent:number;effectiveFrom:string;note?:string}){
  const effectiveFrom=new Date(dto.effectiveFrom);
  if(Number.isNaN(effectiveFrom.getTime())) throw new BadRequestException('Invalid effectiveFrom');
  const values=[dto.patientPercent,dto.doctorPercent,dto.monthlyDoctorPercent];
  if(values.some(v=>!Number.isFinite(v)||v<0||v>100)) throw new BadRequestException('Fee percentages must be between 0 and 100');
  if(dto.patientPercent+dto.doctorPercent>100) throw new BadRequestException('Combined patient and doctor fee cannot exceed 100%');
  if(!dto.name.trim()) throw new BadRequestException('Fee configuration name is required');
  const duplicate=await this.prisma.platformFeeConfig.findFirst({where:{effectiveFrom}});
  if(duplicate) throw new ConflictException('A fee configuration already exists at this effective time');
  const config=await this.prisma.platformFeeConfig.create({data:{name:dto.name.trim(),patientPercent:dto.patientPercent,doctorPercent:dto.doctorPercent,monthlyDoctorPercent:dto.monthlyDoctorPercent,effectiveFrom}});
  await this.prisma.auditLog.create({data:{actorUserId,action:'PLATFORM_FEE_CONFIG_CREATED',resourceType:'PlatformFeeConfig',resourceId:config.id,metadata:{name:config.name,patientPercent:String(config.patientPercent),doctorPercent:String(config.doctorPercent),monthlyDoctorPercent:String(config.monthlyDoctorPercent),effectiveFrom:effectiveFrom.toISOString(),note:dto.note?.slice(0,500)}}});
  return config;
 }

 async listTransactions(filters:{status?:PaymentStatus;provider?:string;currency?:string;from?:string;to?:string;page?:number;pageSize?:number}){
  const page=Math.max(1,filters.page??1), pageSize=Math.min(100,Math.max(1,filters.pageSize??25));
  const where:any={};
  if(filters.status) where.status=filters.status;
  if(filters.provider) where.provider=filters.provider;
  if(filters.currency) where.currency=filters.currency.toLowerCase();
  if(filters.from||filters.to) where.createdAt={...(filters.from?{gte:new Date(filters.from)}:{}),...(filters.to?{lt:new Date(filters.to)}:{})};
  const [items,total]=await this.prisma.$transaction([
   this.prisma.transaction.findMany({where,orderBy:{createdAt:'desc'},skip:(page-1)*pageSize,take:pageSize,select:{id:true,appointmentId:true,userId:true,provider:true,providerTransactionId:true,providerFeeId:true,status:true,currency:true,consultationAmount:true,patientPlatformFee:true,doctorPlatformFee:true,taxAmount:true,processingFee:true,refundAmount:true,doctorNet:true,platformRevenue:true,feeSnapshot:true,createdAt:true,updatedAt:true}}),
   this.prisma.transaction.count({where}),
  ]);
  return {items,total,page,pageSize,pageCount:Math.ceil(total/pageSize)};
 }
 async reconcileRefund(actorUserId:string,transactionId:string){
  const tx=await this.prisma.transaction.findUnique({where:{id:transactionId}}); if(!tx)throw new NotFoundException('Transaction not found');
  if(tx.provider!=='stripe'||!tx.providerTransactionId)throw new ConflictException('Transaction cannot be reconciled');
  const remote:any=await this.stripe('payment_intents/'+tx.providerTransactionId+'?expand[]=latest_charge','GET');
  const charge=remote?.latest_charge; const refunded=Number(charge?.amount_refunded??0)/100;
  const charged=Number(tx.consultationAmount)+Number(tx.patientPlatformFee); const capped=Math.min(charged,Math.max(0,refunded));
  const next=capped>=charged&&charged>0?PaymentStatus.REFUNDED:capped>0?PaymentStatus.PARTIALLY_REFUNDED:tx.status;
  const changed=Number(tx.refundAmount)!==capped||([PaymentStatus.REFUNDED,PaymentStatus.PARTIALLY_REFUNDED].includes(next)&&tx.status!==next);
  if(changed) await this.prisma.$transaction([this.prisma.transaction.update({where:{id:tx.id},data:{refundAmount:capped,status:next}}),this.prisma.auditLog.create({data:{actorUserId,action:'REFUND_RECONCILED',resourceType:'Transaction',resourceId:tx.id,metadata:{previousRefund:String(tx.refundAmount),remoteRefund:String(capped),remoteStatus:remote?.status??'unknown',newStatus:next}}})]);
  else await this.prisma.auditLog.create({data:{actorUserId,action:'REFUND_RECONCILIATION_CHECKED',resourceType:'Transaction',resourceId:tx.id,metadata:{refund:String(capped),status:tx.status}}});
  return {transactionId:tx.id,localRefund:Number(tx.refundAmount),remoteRefund:capped,localStatus:next,changed};
 }
 async reconcileTransaction(actorUserId:string,transactionId:string){
  const tx=await this.prisma.transaction.findUnique({where:{id:transactionId}});
  if(!tx) throw new NotFoundException('Transaction not found');
  if(tx.provider!=='stripe'||!tx.providerTransactionId) throw new ConflictException('Transaction cannot be reconciled');
  const remote=await this.stripe('payment_intents/'+tx.providerTransactionId,'GET');
  const remoteStatus=remote.status??'unknown';
  const next=remoteStatus==='succeeded'?PaymentStatus.SUCCEEDED:remoteStatus==='payment_failed'||remoteStatus==='canceled'?PaymentStatus.FAILED:tx.status;
  if(next!==tx.status){
   await this.prisma.$transaction([
    this.prisma.transaction.update({where:{id:tx.id},data:{status:next}}),
    ...(tx.appointmentId?[this.prisma.appointment.updateMany({where:{id:tx.appointmentId,status:AppointmentStatus.PENDING},data:next===PaymentStatus.SUCCEEDED?{status:AppointmentStatus.CONFIRMED}:{status:AppointmentStatus.CANCELLED,cancellationReason:'Payment reconciliation failed',cancelledAt:new Date()}})]:[]),
    this.prisma.auditLog.create({data:{actorUserId,action:'PAYMENT_RECONCILED',resourceType:'Transaction',resourceId:tx.id,metadata:{previousStatus:tx.status,newStatus:next,remoteStatus}}}),
   ]);
  } else await this.prisma.auditLog.create({data:{actorUserId,action:'PAYMENT_RECONCILIATION_CHECKED',resourceType:'Transaction',resourceId:tx.id,metadata:{status:tx.status,remoteStatus}}});
  return {transactionId:tx.id,localStatus:next,remoteStatus,changed:next!==tx.status};
 }

}