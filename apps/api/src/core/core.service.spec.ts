import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CoreService } from './core.service';

describe('CoreService security invariants', () => {
  const prisma:any = {
    subscriptionPlan:{findUnique:jest.fn()},
    subscription:{updateMany:jest.fn(),create:jest.fn()},
    appointment:{findUnique:jest.fn()},
    review:{findUnique:jest.fn(),create:jest.fn()},
    doctorProfile:{update:jest.fn()},
    transaction:{findUnique:jest.fn(),update:jest.fn()},
    dispute:{findFirst:jest.fn(),create:jest.fn(),findUnique:jest.fn(),update:jest.fn()},
    notification:{create:jest.fn(),findMany:jest.fn(),findUnique:jest.fn(),update:jest.fn()},
    videoSession:{findUnique:jest.fn(),create:jest.fn()},
    $transaction:jest.fn(async (fn:any)=>fn(prisma)),
  };

  beforeEach(()=>jest.clearAllMocks());

  it('requires a provider reference for paid subscriptions', async()=>{
    prisma.subscriptionPlan.findUnique.mockResolvedValue({id:'p',active:true,tier:'PREMIUM'});
    await expect(new CoreService(prisma).subscribe('u',{planId:'p'} as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('allows internal free-plan activation without an external provider', async()=>{
    prisma.subscriptionPlan.findUnique.mockResolvedValue({id:'p',active:true,tier:'FREE'});
    prisma.subscription.updateMany.mockResolvedValue({count:1});
    prisma.subscription.create.mockResolvedValue({id:'s'});
    await expect(new CoreService(prisma).subscribe('u',{planId:'p'} as any)).resolves.toEqual({id:'s'});
    expect(prisma.subscription.create).toHaveBeenCalled();
  });

  it('blocks a second review for the same completed appointment', async()=>{
    prisma.appointment.findUnique.mockResolvedValue({id:'a',patientId:'u',doctorId:'d',status:'COMPLETED'});
    prisma.review.findUnique.mockResolvedValue({id:'existing'});
    await expect(new CoreService(prisma).review('u',{appointmentId:'a',rating:5} as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents disputing another users transaction', async()=>{
    prisma.transaction.findUnique.mockResolvedValue({id:'t',userId:'owner',status:'SUCCEEDED'});
    await expect(new CoreService(prisma).dispute('attacker',{transactionId:'t',reason:'x'} as any))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects disputes for unsettled transactions', async()=>{
    prisma.transaction.findUnique.mockResolvedValue({id:'t',userId:'u',status:'PENDING'});
    await expect(new CoreService(prisma).dispute('u',{transactionId:'t',reason:'x'} as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not mutate the transaction status when an admin closes a dispute', async()=>{
    prisma.dispute.findUnique.mockResolvedValue({id:'d',status:'OPEN'});
    prisma.dispute.update.mockResolvedValue({id:'d',status:'RESOLVED'});
    await expect(new CoreService(prisma).resolveDispute('d','resolved after review')).resolves.toEqual({id:'d',status:'RESOLVED'});
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });
});
