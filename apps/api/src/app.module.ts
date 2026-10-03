import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard,ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DoctorsModule } from './doctors/doctors.module';
import { CalendarModule } from './calendar/calendar.module';
import { PaymentsModule } from './payments/payments.module';
import { MessagingModule } from './messaging/messaging.module';
import { CoreModule } from './core/core.module';
import { PatientModule } from './patient/patient.module';
import { HealthController } from './health.controller';
@Module({imports:[ConfigModule.forRoot({isGlobal:true,cache:true}),ThrottlerModule.forRoot([{name:'default',ttl:60000,limit:60}]),PrismaModule,AuthModule,DoctorsModule,CalendarModule,PaymentsModule,MessagingModule,CoreModule,PatientModule],controllers:[HealthController],providers:[{provide:APP_GUARD,useClass:ThrottlerGuard}]})
export class AppModule {}