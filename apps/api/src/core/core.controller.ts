import { Body,Controller,Get,Param,Post,Query,Req,UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CoreService } from './core.service';
import { CreatePlanDto,DisputeDto,NotificationDto,ReviewDto,SubscribeDto,VideoDto } from './core.dto';
@ApiTags('core') @Controller('core') export class CoreController{
 constructor(private readonly s:CoreService){}
 @Get('plans') plans(){return this.s.plans();}
 @Get('reviews/:doctorId') reviews(@Param('doctorId') id:string){return this.s.reviews(id);}
 @Get('content') content(@Query('language') language?:string){return this.s.content(language??'en');}
 @UseGuards(JwtAuthGuard) @ApiBearerAuth()
 @Post('subscriptions') subscribe(@Req() r:any,@Body() d:SubscribeDto){return this.s.subscribe(r.user.id,d);}
 @Get('subscriptions/me') @UseGuards(JwtAuthGuard) @ApiBearerAuth() mySubs(@Req() r:any){return this.s.mySubscriptions(r.user.id);}
 @Post('reviews') @UseGuards(JwtAuthGuard) @ApiBearerAuth() review(@Req() r:any,@Body() d:ReviewDto){return this.s.review(r.user.id,d);}
 @Post('disputes') @UseGuards(JwtAuthGuard) @ApiBearerAuth() dispute(@Req() r:any,@Body() d:DisputeDto){return this.s.dispute(r.user.id,d);}
 @Get('notifications') @UseGuards(JwtAuthGuard) @ApiBearerAuth() notifications(@Req() r:any){return this.s.notifications(r.user.id);}
 @Post('notifications/:id/read') @UseGuards(JwtAuthGuard) @ApiBearerAuth() read(@Req() r:any,@Param('id') id:string){return this.s.markNotificationRead(r.user.id,id);}
 @Post('video/session') @UseGuards(JwtAuthGuard) @ApiBearerAuth() video(@Req() r:any,@Body() d:VideoDto){return this.s.video(r.user.id,d);}
 @Get('ads') ads(){return this.s.ads();}
 @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.FINANCE) @ApiBearerAuth() @Post('admin/plans') adminPlan(@Body() d:CreatePlanDto){return this.s.createPlan(d);}
 @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.MODERATOR,UserRole.SUPPORT,UserRole.FINANCE) @ApiBearerAuth() @Get('admin/disputes') adminDisputes(){return this.s.disputes();}
 @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.MODERATOR,UserRole.SUPPORT,UserRole.FINANCE) @ApiBearerAuth() @Post('admin/disputes/:id/resolve') resolve(@Param('id') id:string,@Body('resolution') resolution:string,@Req() r:any){return this.s.resolveDispute(r.user.id,id,resolution);}
 @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.SUPPORT) @ApiBearerAuth() @Post('admin/notify/:userId') notify(@Param('userId') id:string,@Body() d:NotificationDto){return this.s.notify(id,d);}
}