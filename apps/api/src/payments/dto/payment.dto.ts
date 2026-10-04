import { IsISO8601, IsOptional, IsString, Max, Min, IsNumber } from 'class-validator';
export class CreatePaymentDto { @IsString() appointmentId!: string; @IsOptional() @IsString() returnUrl?: string; }
export class RefundPaymentDto { @IsString() reason!: string; }
export class CreatePlatformFeeConfigDto {
  @IsString() name!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) patientPercent!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) doctorPercent!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) monthlyDoctorPercent!: number;
  @IsISO8601() effectiveFrom!: string;
  @IsOptional() @IsString() note?: string;
}
