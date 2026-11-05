import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

/** Pola main.ts Musyan (tanpa Chatwoot/extra-hosts). */
function resolveTrustProxy(raw?: string): boolean | number | string {
  const value = (raw || '').trim();
  if (!value) return 'loopback, linklocal, uniquelocal';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.set('trust proxy', resolveTrustProxy(process.env.TRUST_PROXY));
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaClientExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }));
  app.setGlobalPrefix('/api/v1');

  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || requestOrigin === 'null') return callback(null, true);
      return callback(null, origins.includes('*') || origins.includes(requestOrigin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection', 'X-Accel-Buffering'],
  });

  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ limit: '2mb', extended: true }));

  const config = new DocumentBuilder()
    .setTitle('Virtual AI Office API')
    .setDescription('Backend Virtual AI Office (boilerplate NestJS Musyan)')
    .setVersion('0.1')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .addTag('Core - Auth').addTag('Core - Health').addTag('Core - S3').addTag('Core - Assets')
    .addTag('System - Offices').addTag('System - Membership').addTag('System - Roles').addTag('System - Role Permissions').addTag('System - Activity Logs')
    .addTag('Office - AI Providers').addTag('Office - Employees').addTag('Office - Tasks').addTag('Office - Discussions').addTag('Office - Realtime')
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config), { swaggerOptions: { persistAuthorization: true } });

  const port = process.env.PORT ?? 8010;
  await app.listen(port);
  console.log(`🚀 Virtual AI Office API (${process.env.NODE_ENV ?? 'development'})`);
  console.log(`📡 http://localhost:${port}/api/v1 · docs http://localhost:${port}/api/docs`);
}
bootstrap();
