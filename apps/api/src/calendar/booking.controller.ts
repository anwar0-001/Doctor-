import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingService } from './booking.service';
import { CancelAppointmentDto, CreateAppointmentDto, RescheduleAppointmentDto, WaitlistDto } from './dto/booking.dto';
@ApiTags('booking')
@Controller('appointments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingController {
 constructor(private readonly booking:BookingService){}
 @Post() create(@Req() req:Request&{user:{id:string}},@Body() dto:CreateAppointmentDto){return this.booking.create(req.user.id,dto);}
 @Get('mine') mine(@Req() req:Request&{user:{id:string}}){return this.booking.listMine(req.user.id);}
 @Post(':id/cancel') cancel(@Req() req:Request&{user:{id:string}},@Param('id') id:string,@Body() dto:CancelAppointmentDto){return this.booking.cancel(req.user.id,id,dto);}
 @Post(':id/reschedule') reschedule(@Req() req:Request&{user:{id:string}},@Param('id') id:string,@Body() dto:RescheduleAppointmentDto){return this.booking.reschedule(req.user.id,id,dto);}
 @Post('waitlist') waitlist(@Req() req:Request&{user:{id:string}},@Body() dto:WaitlistDto){return this.booking.addWaitlist(req.user.id,dto);}
}