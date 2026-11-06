import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { ProviderAdapterRegistry } from './adapters/provider-adapter.registry';
import { ToolRegistryService } from './tools/tool-registry.service';
import { AiEngineService } from './ai-engine.service';
import { AgentRuntimeService } from './agent-runtime.service';
import { AiEngineController } from './ai-engine.controller';
import { McpModule } from '../mcp/mcp.module';
import { AgentBundleService } from './agent-bundle.service';
import { AgentMemoryService } from './agent-memory.service';

@Module({
  imports: [DatabaseModule, McpModule],
  controllers: [AiEngineController],
  providers: [
    OpenAIAdapter,
    AnthropicAdapter,
    GeminiAdapter,
    ProviderAdapterRegistry,
    ToolRegistryService,
    AiEngineService,
    AgentRuntimeService,
    AgentBundleService,
    AgentMemoryService,
  ],
  exports: [
    AiEngineService,
    AgentRuntimeService,
    ToolRegistryService,
    ProviderAdapterRegistry,
    AgentBundleService,
    AgentMemoryService,
  ],
})
export class AiEngineModule {}
