import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActiveCompany, ActiveUser } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { RequiresCompanyGuard } from 'src/common/guards/requires-company.guard';
import { ApprovalService } from './approval.service';
import { ApprovalStatus } from '@prisma/client';

export class ReviewDecisionDto {
  note?: string;
}

@ApiTags('office-approvals')
@ApiBearerAuth()
@UseGuards(RequiresCompanyGuard)
@RequiresCompany()
@Controller('office/approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  @ApiOperation({ summary: 'Mendapatkan daftar permintaan otorisasi tindakan agent (Human-in-the-loop)' })
  @ApiQuery({ name: 'status', enum: ApprovalStatus, required: false })
  async getApprovals(
    @ActiveCompany() companyId: string,
    @Query('status') status?: ApprovalStatus,
  ) {
    return this.approvalService.getApprovals(companyId, status);
  }

  @Get('count')
  @ApiOperation({ summary: 'Mendapatkan jumlah permohonan yang masih berstatus PENDING' })
  async getPendingCount(@ActiveCompany() companyId: string) {
    const count = await this.approvalService.countPending(companyId);
    return { count };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Menyetujui eksekusi tool berisiko tinggi dan melanjutkan task' })
  async approveRequest(
    @ActiveCompany() companyId: string,
    @ActiveUser() user: any,
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.approvalService.approve(companyId, id, user?.id || 'admin', dto.note);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Menolak eksekusi tool berisiko tinggi dan membatalkan task' })
  async rejectRequest(
    @ActiveCompany() companyId: string,
    @ActiveUser() user: any,
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.approvalService.reject(companyId, id, user?.id || 'admin', dto.note);
  }
}
