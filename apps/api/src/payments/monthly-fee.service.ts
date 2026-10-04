import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonthlyFeeService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(doctorId: string, periodStart: Date, periodEnd: Date, currency: string) {
    if (!(periodStart < periodEnd)) throw new BadRequestException('Invalid fee period');
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { userId: doctorId } });
    if (!doctor) throw new BadRequestException('Doctor not found');
    const fee = await this.prisma.platformFeeConfig.findFirst({ where: { active: true, effectiveFrom: { lte: periodEnd } }, orderBy: { effectiveFrom: 'desc' } });
    if (!fee) throw new BadRequestException('No active platform fee configuration');
    const transactions = await this.prisma.transaction.findMany({
      where: { status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] }, currency: currency.toLowerCase(), createdAt: { gte: periodStart, lt: periodEnd }, appointment: { doctorId } },
      select: { doctorNet: true, refundAmount: true, consultationAmount: true },
    });
    const gross = transactions.reduce((sum, t) => {
      const consultation = Number(t.consultationAmount);
      const refund = Number(t.refundAmount);
      return sum + Math.max(0, consultation - refund);
    }, 0);
    const percent = Number(fee.monthlyDoctorPercent);
    const amount = Number((gross * percent / 100).toFixed(2));
    const normalizedCurrency = currency.toLowerCase();
    const existing = await this.prisma.doctorMonthlyFee.findUnique({
      where: { doctorId_periodStart_periodEnd_currency: { doctorId, periodStart, periodEnd, currency: normalizedCurrency } },
    });
    if (existing && existing.status !== 'OPEN') {
      throw new ConflictException('Monthly fee is already finalized');
    }
    return this.prisma.doctorMonthlyFee.upsert({
      where: { doctorId_periodStart_periodEnd_currency: { doctorId, periodStart, periodEnd, currency: normalizedCurrency } },
      create: { doctorId, periodStart, periodEnd, currency: normalizedCurrency, grossEarnings: gross, feePercent: percent, feeAmount: amount },
      update: { grossEarnings: gross, feePercent: percent, feeAmount: amount },
    });
  }
}
