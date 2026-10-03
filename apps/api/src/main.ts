import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const isProduction = config.get('NODE_ENV', 'development') === 'production';
  const origins = config.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',').map((v) => v.trim()).filter(Boolean);

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
  }));
  app.use((req: any, res: any, next: () => void) => {
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  if (!isProduction || config.get('ENABLE_SWAGGER', 'false') === 'true') {
    const swagger = new DocumentBuilder()
      .setTitle('DOCTOR API')
      .setDescription('Production API foundation for the DOCTOR global health platform.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('v1/docs', app, SwaggerModule.createDocument(app, swagger));
  }
  await app.listen(config.get<number>('PORT', 4000));
}
bootstrap();
