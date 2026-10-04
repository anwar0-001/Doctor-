import { Body, Controller, Get, Headers, Query, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, RefundPaymentDto, CreatePlatformFeeConfigDto, ListTransactionsDto, DoctorEarningsQueryDto, DoctorPayoutsQueryDto, AdminPayoutsQueryDto } from './dto/payment.dto';
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
 constructor(private readonly payments:PaymentsService){}
 @Post('connect/onboarding') @ApiBearerAuth() @UseGuards(JwtAuthGuard) onboarding(@Req() req:Request&{user:{id:string}},@Body() body:{returnUrl:string;refreshUrl:string}){return this.payments.createConnectOnboarding(req.user.id,body.returnUrl,body.refreshUrl);}
 @Post('intent') @ApiBearerAuth() @UseGuards(JwtAuthGuard) intent(@Req() req:Request&{user:{id:string}},@Body() dto:CreatePaymentDto){return this.payments.createPaymentIntent(req.user.id,dto.appointmentId);}
 @Post('webhook') webhook(@Req() req:Request&{rawBody?:Buffer},@Headers('stripe-signature') signature:string){if(!req.rawBody) throw new Error('Raw request body unavailable');return this.payments.webhook(req.rawBody,signature);}
 @Get('doctor/earnings')
 @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.DOCTOR)
 doctorEarnings(@Req() req:Request&{user:{id:string}},@Query() query:DoctorEarningsQueryDto){return this.payments.doctorEarnings(req.user.id,query);}

 @Get('doctor/payouts')
 @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.DOCTOR)
 doctorPayouts(@Req() req:Request&{user:{id:string}},@Query() query:DoctorPayoutsQueryDto){return this.payments.doctorPayouts(req.user.id,query);}

 @Get('admin/payouts')
 @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.FINANCE)
 adminPayouts(@Query() query:AdminPayoutsQueryDto){return this.payments.adminPayouts(query);}

 @Post('admin/reconcile-payout/:transactionId')
 @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.FINANCE)
 reconcilePayout(@Req() req:Request&{user:{id:string}},@Param('transactionId') id:string){return this.payments.reconcilePayout(req.user.id,id);}

 @Get('admin/transactions')
 @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.FINANCE)
 listTransactions(@Query() query:ListTransactionsDto){return this.payments.listTransactions(query);}

 @Get('admin/fees')
 @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.FINANCE)
 listFees(){return this.payments.listFeeConfigs();}
 @Post('admin/fees')
 @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.FINANCE)
 createFee(@Req() req:Request&{user:{id:string}},@Body() dto:CreatePlatformFeeConfigDto){return this.payments.createFeeConfig(req.user.id,dto);}

 @Post('admin/reconcile-refund/:transactionId')
 @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.FINANCE)
 reconcileRefund(@Req() req:Request&{user:{id:string}},@Param('transactionId') id:string){return this.payments.reconcileRefund(req.user.id,id);}

 @Post('admin/reconcile/:transactionId')
 @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.FINANCE)
 reconcile(@Req() req:Request&{user:{id:string}},@Param('transactionId') id:string){return this.payments.reconcileTransaction(req.user.id,id);}

 @Post(':appointmentId/refund') @ApiBearerAuth() @UseGuards(JwtAuthGuard) refund(@Req() req:Request&{user:{id:string}},@Param('appointmentId') id:string,@Body() dto:RefundPaymentDto){return this.payments.refund(req.user.id,id,dto.reason);}
}