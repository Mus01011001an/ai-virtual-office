import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    console.error('[AllExceptionsFilter catch]:', exception);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    // Jika error berasal dari HttpException (400, 404, dsb)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      return response.status(status).json({
        success: false,
        message: (res as any).message || exception.message,
        // Kode mesin opsional (mis. CONVERSATION_NOT_FOUND) agar klien bisa membedakan kasus tanpa parsing teks
        ...(typeof (res as any)?.code === 'string' ? { code: (res as any).code } : {}),
        // error: res,
        data: null,
      });
    }

    // Jika error berasal dari runtime error (500)
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    // Ambil error asli (yang biasanya tampil di console)
    const message = exception.message || 'Internal Server Error';

    // Mengembalikan message asli error ke client
    return response.status(status).json({
      success: false,
      message,
      //   error: exception?.stack || exception, // kalau mau stack trace
      data: null,
    });
  }
}
