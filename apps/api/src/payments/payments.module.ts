import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MonthlyFeeService } from './monthly-fee.service';
@Module({controllers:[PaymentsController],providers:[PaymentsService,MonthlyFeeService],exports:[MonthlyFeeService]})
export class PaymentsModule {}