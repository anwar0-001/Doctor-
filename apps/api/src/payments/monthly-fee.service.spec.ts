import { MonthlyFeeService } from './monthly-fee.service';

describe('MonthlyFeeService', () => {
  it('calculates an immutable-period fee from settled consultation earnings', async () => {
    const prisma:any = {
      doctorProfile:{findUnique:jest.fn().mockResolvedValue({userId:'doctor'})},
      platformFeeConfig:{findFirst:jest.fn().mockResolvedValue({monthlyDoctorPercent:15})},
      transaction:{findMany:jest.fn().mockResolvedValue([
        {consultationAmount:100,refundAmount:0,doctorNet:80},
        {consultationAmount:200,refundAmount:50,doctorNet:160},
      ])},
      doctorMonthlyFee:{upsert:jest.fn().mockResolvedValue({feeAmount:37.5})},
    };
    const service=new MonthlyFeeService(prisma);
    const result=await service.calculate('doctor',new Date('2026-09-01'),new Date('2026-10-01'),'USD');
    expect(prisma.doctorMonthlyFee.upsert).toHaveBeenCalled();
    expect(result.feeAmount).toBe(37.5);
  });
});
