import { IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateAppointmentDto {
 @IsString() doctorId!: string;
 @IsString() serviceId!: string;
 @IsString() startsAtLocal!: string;
 @IsOptional() @IsString() timezone?: string;
 @IsString() @MaxLength(128) idempotencyKey!: string;
}
export class CancelAppointmentDto { @IsString() @MaxLength(500) reason!: string; }
export class RescheduleAppointmentDto { @IsString() startsAtLocal!: string; @IsOptional() @IsString() timezone?: string; }
export class WaitlistDto {
 @IsString() doctorId!: string; @IsString() serviceId!: string;
 @IsOptional() @IsString() preferredStartsAt?: string;
 @IsOptional() @IsString() preferredEndsAt?: string;
 @IsOptional() @IsString() timezone?: string;
}