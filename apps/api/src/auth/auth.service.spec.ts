import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService security', () => {
  it('locks an account after repeated invalid passwords', async()=>{
    const prisma:any={user:{findUnique:jest.fn().mockResolvedValue({id:'u',status:'ACTIVE',passwordHash:'hash',failedLoginCount:4,lockedUntil:null,roles:[]}),update:jest.fn()},refreshSession:{}};
    const service=new AuthService(prisma,{} as any,{} as any);
    jest.spyOn(argon2,'verify').mockResolvedValue(false as never);
    await expect(service.login({email:'a@b.com',password:'bad'} as any)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({lockedUntil:expect.any(Date)})}));
  });

  it('rejects login while the account is locked', async()=>{
    const prisma:any={user:{findUnique:jest.fn().mockResolvedValue({id:'u',status:'ACTIVE',passwordHash:'hash',failedLoginCount:0,lockedUntil:new Date(Date.now()+60000),roles:[]})}};
    const service=new AuthService(prisma,{} as any,{} as any);
    await expect(service.login({email:'a@b.com',password:'bad'} as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

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
