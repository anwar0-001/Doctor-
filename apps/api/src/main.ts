import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
async function bootstrap(){const app=await NestFactory.create(AppModule,{rawBody:true});const config=app.get(ConfigService);app.use(helmet());app.setGlobalPrefix('v1');app.enableCors({origin:config.get<string>('CORS_ORIGINS','').split(',').map(v=>v.trim()).filter(Boolean),credentials:true});app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));const swagger=new DocumentBuilder().setTitle('DOCTOR API').setDescription('Production API foundation for the DOCTOR global health platform.').setVersion('0.1.0').addBearerAuth().build();SwaggerModule.setup('v1/docs',app,SwaggerModule.createDocument(app,swagger));await app.listen(config.get<number>('PORT',4000));}bootstrap();