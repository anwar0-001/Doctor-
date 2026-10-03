import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
export class CreatePlanDto { @IsString() code!:string; @IsString() name!:string; @IsIn(['FREE','PREMIUM','PRO']) tier!: 'FREE'|'PREMIUM'|'PRO'; @Min(0) price!:number; @IsString() currency!:string; @IsString() interval!:string; features?:Record<string,unknown>; }
export class SubscribeDto { @IsUUID() planId!:string; @IsOptional() @IsString() providerSubscriptionId?:string; @IsOptional() @IsString() provider?:string; }
export class ReviewDto { @IsUUID() appointmentId!:string; @IsInt() @Min(1) @Max(5) rating!:number; @IsOptional() @IsString() @MinLength(2) comment?:string; }
export class DisputeDto { @IsUUID() transactionId!:string; @IsString() @MinLength(3) reason!:string; @IsOptional() @IsString() details?:string; }
export class NotificationDto { @IsString() title!:string; @IsString() body!:string; @IsOptional() data?:Record<string,unknown>; }
export class VideoDto { @IsUUID() appointmentId!:string; }