import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService refresh rotation', () => {
  it('rejects when the refresh session was already consumed', async () => {
    const prisma:any = {
      refreshSession: {
        findUnique: jest.fn().mockResolvedValue({
          id:'s', userId:'u', tokenHash:'h', revokedAt:null, expiresAt:new Date(Date.now()+60000),
          user:{status:'ACTIVE',roles:[]},
        }),
        updateMany: jest.fn().mockResolvedValue({count:0}),
      },
    };
    const jwt:any = { signAsync: jest.fn() };
    const service = new AuthService(prisma,jwt,{ } as any);
    await expect(service.refresh('raw')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshSession.updateMany).toHaveBeenCalled();
  });
});
