import { ConflictException, Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { authenticator } from 'otplib';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AccessTokenPayload } from './auth.types';
import { ACCESS_TOKEN_TTL_SECONDS, MAX_ACTIVE_SESSIONS, REFRESH_TOKEN_TTL_DAYS } from './auth.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(userId: string, roles: UserRole[], userAgent?: string, ip?: string) {
    const accessPayload: AccessTokenPayload = { sub: userId, roles, type: 'access' };
    const accessToken = await this.jwt.signAsync(accessPayload, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86400000);

    const active = await this.prisma.refreshSession.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (active >= MAX_ACTIVE_SESSIONS) {
      const oldest = await this.prisma.refreshSession.findFirst({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'asc' },
      });
      if (oldest) await this.prisma.refreshSession.update({ where: { id: oldest.id }, data: { revokedAt: new Date(), revokeReason: 'session_limit' } });
    }

    await this.prisma.refreshSession.create({
      data: { userId, tokenHash: refreshHash, expiresAt, userAgent: userAgent?.slice(0, 512), ipAddress: ip?.slice(0, 64) },
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  async register(dto: RegisterDto, userAgent?: string, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Account already exists');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        phone: dto.phone,
        passwordHash,
        roles: { create: { role: UserRole.PATIENT } },
        patient: { create: {} },
      },
      include: { roles: true },
    });

    const verificationToken = randomBytes(32).toString('base64url');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(verificationToken),
        expiresAt: new Date(Date.now() + 24 * 3600000),
      },
    });

    // Delivery is intentionally delegated to the notification provider in the next phase.
    // Never log the raw token in production.
    const tokens = await this.issueTokens(user.id, user.roles.map((r) => r.role), userAgent, ip);
    return { userId: user.id, ...tokens, emailVerificationRequired: true };
  }

  async login(dto: LoginDto, userAgent?: string, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, include: { roles: true } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.mfaEnabled) {
      if (!dto.mfaCode || !user.mfaSecretEncrypted) throw new UnauthorizedException('MFA code required');
      const secret = this.config.getOrThrow<string>('MFA_ENCRYPTION_KEY');
      const decrypted = this.decryptSecret(user.mfaSecretEncrypted, secret);
      if (!authenticator.verify({ token: dto.mfaCode, secret: decrypted })) throw new UnauthorizedException('Invalid MFA code');
    }

    return { userId: user.id, ...(await this.issueTokens(user.id, user.roles.map((r) => r.role), userAgent, ip)) };
  }

  async refresh(refreshToken: string, userAgent?: string, ip?: string) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash }, include: { user: { include: { roles: true } } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const rotatedAt = new Date();
    const revoked = await this.prisma.refreshSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: rotatedAt, revokeReason: 'rotated' } });
    if (revoked.count !== 1) throw new UnauthorizedException('Refresh token already used');
    const replacement = await this.issueTokens(session.userId, session.user.roles.map((r) => r.role), userAgent, ip);
    const replacementSession = await this.prisma.refreshSession.findFirst({ where: { tokenHash: this.hashToken(replacement.refreshToken) }, select: { id: true } });
    if (replacementSession) await this.prisma.refreshSession.update({ where: { id: session.id }, data: { replacedBySessionId: replacementSession.id } });
    return replacement;
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'logout' } });
    return { success: true };
  }

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled');
    const secret = authenticator.generateSecret();
    const key = this.config.getOrThrow<string>('MFA_ENCRYPTION_KEY');
    const encrypted = this.encryptSecret(secret, key);
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecretEncrypted: encrypted } });
    return { secret, otpauthUrl: authenticator.keyuri(user.email, 'DOCTOR', secret) };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecretEncrypted) throw new BadRequestException('MFA setup not started');
    const key = this.config.getOrThrow<string>('MFA_ENCRYPTION_KEY');
    const secret = this.decryptSecret(user.mfaSecretEncrypted, key);
    if (!authenticator.verify({ token: code, secret })) throw new BadRequestException('Invalid MFA code');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { enabled: true };
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecretEncrypted) throw new BadRequestException('MFA is not enabled');
    const key = this.config.getOrThrow<string>('MFA_ENCRYPTION_KEY');
    const secret = this.decryptSecret(user.mfaSecretEncrypted, key);
    if (!authenticator.verify({ token: code, secret })) throw new UnauthorizedException('Invalid MFA code');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecretEncrypted: null } });
    await this.prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'mfa_disabled' } });
    return { enabled: false };
  }

  private encryptSecret(secret: string, key: string): string {
    const { createCipheriv, randomBytes } = require('node:crypto') as typeof import('node:crypto');
    const keyBytes = createHash('sha256').update(key).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', keyBytes, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
  }

  private decryptSecret(payload: string, key: string): string {
    const { createDecipheriv } = require('node:crypto') as typeof import('node:crypto');
    const raw = Buffer.from(payload, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(key).digest(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  }
}