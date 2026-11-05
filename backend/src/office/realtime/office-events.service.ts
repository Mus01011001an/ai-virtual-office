import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval, map, merge, filter, finalize } from 'rxjs';

export type OfficeEventType =
  | 'employee.created' | 'employee.updated' | 'employee.deleted'
  | 'activity.created' | 'task.event'
  | 'discussion.message' | 'office.updated';

interface OfficeEvent { companyId: string; type: OfficeEventType; data: unknown }

/**
 * Bus realtime per office (pola SSE Musyan: RxJS Subject → @Sse).
 * Satu Subject global, difilter per companyId saat stream dibuka → tidak ada kebocoran antar office.
 */
@Injectable()
export class OfficeEventsService {
  private readonly bus = new Subject<OfficeEvent>();
  private listeners = 0;

  emit(companyId: string, type: OfficeEventType, data: unknown) {
    this.bus.next({ companyId, type, data });
  }

  stream(companyId: string): Observable<MessageEvent> {
    this.listeners++;
    const events = this.bus.pipe(
      filter((e) => e.companyId === companyId),
      map((e): MessageEvent => ({ type: e.type, data: e.data as object })),
    );
    // heartbeat supaya proxy (Traefik/Cloudflare) tidak memutus koneksi idle
    const heartbeat = interval(25_000).pipe(map((): MessageEvent => ({ type: 'ping', data: { t: Date.now() } })));
    return merge(events, heartbeat).pipe(finalize(() => { this.listeners-- }));
  }

  get connectionCount() {
    return this.listeners;
  }
}
