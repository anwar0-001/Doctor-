import { Body,Controller,Get,Param,Post,Query,Req,UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiTags } from '@nestjs/swagger';
import { DoctorStatus,UserRole } from '@prisma/client';
import { Request } from 'express';
import { DoctorsService } from './doctors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DoctorApplicationDto } from './dto/doctor-application.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
@ApiTags('doctors') @Controller('doctors')
export class DoctorsController {
 constructor(private readonly doctors:DoctorsService){}
 @Get('search') search(@Query('specialtyId') specialtyId?:string,@Query('countryId') countryId?:string,@Query('cityId') cityId?:string,@Query('languageId') languageId?:string,@Query('gender') gender?:string,@Query('minRating') minRating?:string,@Query('page') page?:string,@Query('pageSize') pageSize?:string){return this.doctors.search({specialtyId,countryId,cityId,languageId,gender,minRating:minRating?Number(minRating):undefined,page:page?Number(page):undefined,pageSize:pageSize?Number(pageSize):undefined});}
 @Post('apply') @ApiBearerAuth() @UseGuards(JwtAuthGuard) apply(@Req() req:Request&{user:{id:string}},@Body() dto:DoctorApplicationDto){return this.doctors.apply(req.user.id,dto);}
 @Get('me') @ApiBearerAuth() @UseGuards(JwtAuthGuard) me(@Req() req:Request&{user:{id:string}}){return this.doctors.me(req.user.id);}
 @Get('verification/queue') @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.MODERATOR) queue(@Query('status') status?:DoctorStatus){return this.doctors.queue(status);}
 @Post('verification/:id/review') @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.MODERATOR) review(@Param('id') id:string,@Req() req:Request&{user:{id:string}},@Body() dto:ReviewVerificationDto){return this.doctors.review(id,req.user.id,dto);}
}