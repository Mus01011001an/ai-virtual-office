import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({
  imports: [DatabaseModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
