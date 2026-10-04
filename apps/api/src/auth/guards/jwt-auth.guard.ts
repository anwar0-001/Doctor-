import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express';
import { AccessTokenPayload, AuthenticatedUser } from '../auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Authentication required');

    const token = header.slice(7);
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (payload.type !== 'access' || !payload.sub) throw new Error('invalid token');

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { roles: true },
      });
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

      req.user = {
        id: user.id,
        email: user.email,
        status: user.status,
        roles: user.roles.map((r) => r.role),
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}