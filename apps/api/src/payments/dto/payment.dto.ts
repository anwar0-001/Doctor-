import { IsISO8601, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
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
export class ListTransactionsDto {
  @IsOptional() @IsIn(['PENDING','SUCCEEDED','FAILED','REFUNDED','PARTIALLY_REFUNDED','DISPUTED']) status?: string;
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) pageSize?: number;
}
