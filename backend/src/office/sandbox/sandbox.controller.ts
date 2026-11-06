import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { RequiresCompanyGuard } from 'src/common/guards/requires-company.guard';
import { SecureRunnerService } from './secure-runner.service';

export class ExecuteCodeDto {
  language: 'javascript' | 'typescript' | 'python';
  code: string;
  timeoutMs?: number;
  inputPayload?: Record<string, unknown>;
}

@ApiTags('office-sandbox')
@ApiBearerAuth()
@UseGuards(RequiresCompanyGuard)
@RequiresCompany()
@Controller('office/sandbox')
export class SandboxController {
  constructor(private readonly secureRunner: SecureRunnerService) {}

  @Post('execute')
  @ApiOperation({ summary: 'Mengeksekusi kode JavaScript/Python dalam lingkungan terisolasi' })
  async executeCode(
    @ActiveCompany() _companyId: string,
    @Body() dto: ExecuteCodeDto,
  ) {
    return this.secureRunner.execute({
      language: dto.language,
      code: dto.code,
      timeoutMs: Math.min(dto.timeoutMs || 5000, 10000), // Max 10 detik
      inputPayload: dto.inputPayload,
    });
  }
}
