import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CalendarService } from './calendar.service';
import { AvailabilityQueryDto, SetAvailabilityDto, SetExceptionDto } from './dto/availability.dto';
@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
 constructor(private readonly calendar:CalendarService){}
 @Get('doctors/:doctorId/availability') availability(@Param('doctorId') doctorId:string){return this.calendar.listAvailability(doctorId);}
 @Get('doctors/:doctorId/slots') slots(@Param('doctorId') doctorId:string,@Query() q:AvailabilityQueryDto){return this.calendar.slots(doctorId,q.from,q.to,q.timezone);}
 @Post('me/availability') @ApiBearerAuth() @UseGuards(JwtAuthGuard) setAvailability(@Req() req:Request&{user:{id:string}},@Body() dto:SetAvailabilityDto){return this.calendar.setAvailability(req.user.id,dto);}
 @Get('me/exceptions') @ApiBearerAuth() @UseGuards(JwtAuthGuard) exceptions(@Req() req:Request&{user:{id:string}},@Query('from') from:string,@Query('to') to:string){return this.calendar.listExceptions(req.user.id,from,to);}
 @Post('me/exceptions') @ApiBearerAuth() @UseGuards(JwtAuthGuard) setException(@Req() req:Request&{user:{id:string}},@Body() dto:SetExceptionDto){return this.calendar.setException(req.user.id,dto);}
}