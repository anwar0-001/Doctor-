import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
export class DoctorApplicationDto {
 @IsString() @MinLength(2) @MaxLength(160) legalName!: string;
 @IsUUID() specialtyId!: string; @IsUUID() countryId!: string; @IsUUID() cityId!: string;
 @IsOptional() @IsString() @MaxLength(120) gender?: string;
 @IsOptional() @IsString() @MaxLength(2000) bio?: string;
 @IsOptional() @IsString() @MaxLength(64) timezone?: string;
 @IsArray() @IsUUID('4',{each:true}) languageIds!: string[];
 @IsString() @MinLength(2) @MaxLength(120) licenseNumber!: string;
 @IsString() @MinLength(2) @MaxLength(200) licensingAuthority!: string;
 @IsOptional() @IsInt() @Min(1900) @Max(2100) graduationYear?: number;
 @IsOptional() @IsString() @MaxLength(200) university?: string;
}