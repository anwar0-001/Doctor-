import { IsString, Length, Matches } from 'class-validator';

export class VerifyMfaDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}

export class DisableMfaDto extends VerifyMfaDto {}