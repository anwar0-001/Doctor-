import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
export class SetAvailabilityDto {
 @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
 @Matches(/^([01]\\d|2[0-3]):[0-5]\\d$/) startLocal!: string;
 @Matches(/^([01]\\d|2[0-3]):[0-5]\\d$/) endLocal!: string;
 @IsOptional() @IsString() timezone?: string;
 @IsOptional() @IsBoolean() active?: boolean;
}
export class SetExceptionDto {
 @IsString() type!: 'HOLIDAY'|'LEAVE'|'BLOCKED';
 @IsString() startsAt!: string;
 @IsString() endsAt!: string;
 @IsOptional() @IsBoolean() allDay?: boolean;
 @IsOptional() @IsString() reason?: string;
}
export class AvailabilityQueryDto {
 @IsString() from!: string;
 @IsString() to!: string;
 @IsOptional() @IsString() timezone?: string;
}