import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { AiEngineService } from './ai-engine.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

class DirectGenerateDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  temperature?: number;
}

@ApiTags('Office - AI Engine')
@Controller('office/ai-engine')
@RequiresCompany()
export class AiEngineController {
  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  @Get('tools')
  listTools() {
    return this.toolRegistry.getDefinitions();
  }

  @Post('generate')
  generate(@ActiveCompany() companyId: string, @Body() dto: DirectGenerateDto) {
    return this.aiEngine.generateForEmployee(companyId, dto.employeeId, dto.prompt, {
      temperature: dto.temperature,
    });
  }
}
