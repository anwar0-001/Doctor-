import { Body, Controller, Headers, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyMfaDto, DisableMfaDto } from './dto/mfa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create a patient account' })
  register(@Body() dto: RegisterDto, @Headers('user-agent') ua: string | undefined, @Ip() ip: string) {
    return this.auth.register(dto, ua, ip);
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate with password and optional MFA' })
  login(@Body() dto: LoginDto, @Headers('user-agent') ua: string | undefined, @Ip() ip: string) {
    return this.auth.login(dto, ua, ip);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token' })
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') ua: string | undefined, @Ip() ip: string) {
    return this.auth.refresh(dto.refreshToken, ua, ip);
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('mfa/setup')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  setupMfa(@Req() req: Request & { user: { id: string } }) {
    return this.auth.setupMfa(req.user.id);
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  enableMfa(@Req() req: Request & { user: { id: string } }, @Body() dto: VerifyMfaDto) {
    return this.auth.enableMfa(req.user.id, dto.code);
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  disableMfa(@Req() req: Request & { user: { id: string } }, @Body() dto: DisableMfaDto) {
    return this.auth.disableMfa(req.user.id, dto.code);
  }
}