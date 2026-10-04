import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MonthlyFeeService } from './monthly-fee.service';
import { MonthlyFeeController } from './monthly-fee.controller';
@Module({controllers:[PaymentsController,MonthlyFeeController],providers:[PaymentsService,MonthlyFeeService],exports:[MonthlyFeeService,PaymentsService]})
export class PaymentsModule {}