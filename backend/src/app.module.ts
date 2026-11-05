import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthGuard, AuthModule as AuthModuleBetterAuth } from '@thallesp/nestjs-better-auth';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { auth } from './lib/auth';
import { RbacGuard } from './lib/auth/rbac.guard';
import { S3Module } from './s3/s3.module';
import { AssetModule } from './asset/asset.module';
import { SystemModule } from './system/system.module';
import { OfficeModule } from './office/office.module';
import { HealthModule } from './health/health.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { RequiresCompanyGuard } from './common/guards/requires-company.guard';
import { DEFAULT_RATE_LIMIT } from './common/constants/rate-limit';
import { SseTokenMiddleware } from './office/realtime/sse-token.middleware';

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([DEFAULT_RATE_LIMIT]),
    DatabaseModule,
    AuthModule,
    AuthModuleBetterAuth.forRoot({ auth, disableGlobalAuthGuard: true }),
    S3Module,
    AssetModule,
    SystemModule,
    OfficeModule,
    HealthModule,
  ],
  providers: [
    // Urutan guard mengikuti Musyan: Auth → Throttle → RBAC (+ wajib office aktif bila diminta)
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_GUARD, useClass: RequiresCompanyGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SseTokenMiddleware).forRoutes({ path: 'office/stream', method: RequestMethod.GET });
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
