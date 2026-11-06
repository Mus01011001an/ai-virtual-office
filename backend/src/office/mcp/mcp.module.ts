import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { ExternalMcpServerController } from './external-mcp-server.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [McpController, ExternalMcpServerController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
