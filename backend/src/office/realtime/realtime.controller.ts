import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_OFFICE_READ } from 'src/common/constants/permissions';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { OfficeEventsService } from './office-events.service';

@ApiTags('Office - Realtime')
@ApiBearerAuth()
@Controller('office')
export class RealtimeController {
  constructor(private readonly events: OfficeEventsService) {}

  @Sse('stream')
  @RequiresCompany()
  @Permission(P_OFFICE_READ)
  @ApiOperation({ summary: 'SSE: update employee, aktivitas, task, dan diskusi office aktif (?token=<bearer>)' })
  stream(@ActiveCompany() companyId: string): Observable<MessageEvent> {
    return this.events.stream(companyId);
  }
}
