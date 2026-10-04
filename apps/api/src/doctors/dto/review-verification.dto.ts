import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
export class ReviewVerificationDto {
 @IsIn(['VERIFY','REJECT','SUSPEND']) decision!: 'VERIFY'|'REJECT'|'SUSPEND';
 @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}