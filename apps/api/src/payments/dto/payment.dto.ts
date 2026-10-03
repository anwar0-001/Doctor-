import { IsOptional, IsString } from 'class-validator';
export class CreatePaymentDto { @IsString() appointmentId!: string; @IsOptional() @IsString() returnUrl?: string; }
export class RefundPaymentDto { @IsString() reason!: string; }