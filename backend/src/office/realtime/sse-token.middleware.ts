import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * EventSource di browser tidak bisa mengirim header Authorization.
 * Khusus rute SSE, token boleh dikirim lewat ?token= lalu disalin ke header Bearer
 * sebelum AuthGuard better-auth memvalidasinya. Office tetap diambil dari sesi (bukan dari query).
 */
@Injectable()
export class SseTokenMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const token = typeof req.query.token === 'string' ? req.query.token : null;
    if (token && !req.headers.authorization) req.headers.authorization = `Bearer ${token}`;
    next();
  }
}
