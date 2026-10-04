import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { MonthlyFeeService } from './monthly-fee.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('payments')
@Controller('payments/admin/monthly-fees')
export class MonthlyFeeController {
  constructor(private readonly fees: MonthlyFeeService) {}

  @Post('calculate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  calculate(@Req() req: Request & { user: { id: string } }, @Body() body: { doctorId: string; periodStart: string; periodEnd: string; currency: string }) {
    return this.fees.calculate(body.doctorId, new Date(body.periodStart), new Date(body.periodEnd), body.currency, req.user.id);
  }
}
