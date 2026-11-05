import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  status: boolean;
  success: boolean;
  message: string | null;
  data: T;
  meta?: any;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    // 🛡️ PERBAIKAN KRITIS: Lewati pembungkusan envelope jika rute adalah Server-Sent Events (SSE)
    const isSse = Reflect.getMetadata('__sse__', context.getHandler()) === true;
    if (isSse) {
      return next.handle();
    }

    return next.handle().pipe(
      map((result) => {
        // =====================
        // 1. Sudah dibungkus manual (this.ok / { status/success, data })
        // =====================
        if (
          result &&
          typeof result === 'object' &&
          ('status' in result || 'success' in result) &&
          'data' in result
        ) {
          const isSuccessful =
            'status' in result ? Boolean(result.status) : Boolean(result.success);

          const resObj = result as any;
          return {
            status: isSuccessful,
            success: isSuccessful,
            message: resObj.message || null,
            data: resObj.data,
            ...(resObj.meta ? { meta: resObj.meta } : {}),
          };
        }

        // =====================
        // 2. Pagination / meta response
        // =====================
        if (
          result &&
          typeof result === 'object' &&
          'data' in result &&
          'meta' in result
        ) {
          return {
            status: true,
            success: true,
            message: null,
            data: result.data,
            meta: result.meta,
          };
        }

        // =====================
        // 3. Default (object / array / primitive)
        // =====================
        return {
          status: true,
          success: true,
          message: null,
          data: result,
        };
      }),
    );
  }
}
