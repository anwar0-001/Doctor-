import { ConflictException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService refunds', () => {
  it('refunds only the remaining amount and uses a deterministic Stripe idempotency key', async () => {
    const prisma:any = {
      appointment: { findUnique: jest.fn().mockResolvedValue({
        id:'a', patientId:'patient', doctorId:'doctor',
        transactions:[{
          id:'tx', providerTransactionId:'pi_1', status:PaymentStatus.PARTIALLY_REFUNDED,
          consultationAmount:100, patientPlatformFee:20, refundAmount:30,
        }],
      })},
      transaction: { update: jest.fn().mockResolvedValue({}) },
    };
    const config:any = { get: jest.fn() };
    const service = new PaymentsService(prisma, config);
    const stripe=jest.spyOn(service as any,'stripe').mockResolvedValue({id:'re_1',amount:9000});

    const result=await service.refund('patient','a','customer requested');

    expect(stripe).toHaveBeenCalledWith(
      'refunds',
      'POST',
      expect.objectContaining({
        payment_intent:'pi_1',
        amount:9000,
        refund_application_fee:'true',
      }),
      {'Idempotency-Key':'refund:tx:9000'},
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where:{id:'tx'},
      data:{status:PaymentStatus.REFUNDED,refundAmount:120},
    });
    expect(result.remaining).toBe(0);
  });

  it('rejects a fully refunded transaction', async () => {
    const prisma:any = {
      appointment: { findUnique: jest.fn().mockResolvedValue({
        id:'a', patientId:'patient', doctorId:'doctor',
        transactions:[{
          id:'tx', providerTransactionId:'pi_1',
          consultationAmount:100, patientPlatformFee:20, refundAmount:120,
          status:PaymentStatus.REFUNDED,
        }],
      })},
    };
    const service = new PaymentsService(prisma, {} as any);
    await expect(service.refund('patient','a','again')).rejects.toBeInstanceOf(ConflictException);
  });
});
