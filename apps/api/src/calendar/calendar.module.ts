import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { BookingController } from './booking.controller';
import { CalendarService } from './calendar.service';
import { BookingService } from './booking.service';
@Module({controllers:[CalendarController,BookingController],providers:[CalendarService,BookingService]})
export class CalendarModule {}