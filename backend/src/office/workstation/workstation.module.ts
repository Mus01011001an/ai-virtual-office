import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { S3Module } from 'src/s3/s3.module';
import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { WorkstationController } from './workstation.controller';
import { WorkstationService } from './workstation.service';

@Module({
  imports: [DatabaseModule, S3Module, AiEngineModule],
  controllers: [WorkstationController],
  providers: [WorkstationService],
  exports: [WorkstationService],
})
export class WorkstationModule {}
