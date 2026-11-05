import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error(`Prisma Error [${exception.code}]: ${exception.message}`);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';

    switch (exception.code) {
      case 'P2002': {
        // Unique constraint failed
        status = HttpStatus.CONFLICT;
        const rawTarget = exception.meta?.target;
        const target = Array.isArray(rawTarget)
          ? rawTarget.join(', ')
          : typeof rawTarget === 'string'
            ? rawTarget
            : 'field';
        message = `Data dengan informasi tersebut (${target}) sudah digunakan di sistem. Harap gunakan data yang berbeda.`;
        break;
      }
      case 'P2003': {
        // Foreign key constraint failed
        status = HttpStatus.CONFLICT;
        const driverCause = (exception.meta as any)?.driverAdapterError?.cause;
        const fieldName =
          (exception.meta?.field_name as string) ||
          (exception.meta?.constraint as string) ||
          (driverCause?.constraint?.index as string) ||
          (driverCause?.originalMessage as string) ||
          '';
        message = this.getForeignKeyMessage(fieldName);
        break;
      }
      case 'P2025': {
        // Record not found
        status = HttpStatus.NOT_FOUND;
        message =
          'Data yang Anda coba akses tidak ditemukan. Mungkin data tersebut sudah dihapus sebelumnya.';
        break;
      }
      case 'P2021': {
        // Table does not exist
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        const table = (exception.meta?.table as string) || 'tabel';
        message = `Tabel database (${table}) belum dibuat atau migrasi database belum dijalankan.`;
        break;
      }
      case 'P2022': {
        // Column does not exist
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        const driverCause = (exception.meta as any)?.driverAdapterError?.cause;
        const column =
          (exception.meta?.column as string) ||
          (driverCause?.column as string) ||
          (driverCause?.originalMessage as string) ||
          'kolom';
        message = `Kolom database (${column}) belum tersedia atau migrasi database belum dijalankan.`;
        break;
      }
      case 'P2023': {
        // Inconsistent column data
        status = HttpStatus.BAD_REQUEST;
        message = 'Format data identitas (ID/UUID) yang diberikan tidak valid.';
        break;
      }
      case 'P2000': {
        // Value too long
        status = HttpStatus.BAD_REQUEST;
        message = 'Nilai data yang dimasukkan melebihi panjang batas kolom database.';
        break;
      }
      default:
        // Default prisma error
        status = HttpStatus.BAD_REQUEST;
        message =
          'Gagal memproses data karena masalah integritas atau format yang tidak valid.';
        break;
    }

    return response.status(status).json({
      success: false,
      message,
      errorCode: exception.code,
      data: null,
    });
  }

  /**
   * Translates Prisma's P2003 field_name (foreign key error) into a professional message.
   * Format of field_name in Postgres is usually the constraint name, e.g., "user_roleId_fkey"
   */
  private getForeignKeyMessage(fieldName: string): string {
    const lowerField = fieldName.toLowerCase();

    // Map common constraints to user-friendly professional messages
    if (lowerField.includes('role')) {
      return 'Tidak dapat menghapus Role ini karena masih ada pengguna yang menggunakannya. Harap ubah role pengguna tersebut terlebih dahulu.';
    }
    if (lowerField.includes('company')) {
      return 'Tidak dapat menghapus Perusahaan ini karena masih ada data transaksi, pengguna, atau tiket yang terikat. Harap bersihkan data terkait terlebih dahulu.';
    }
    if (lowerField.includes('user')) {
      return 'Pengguna ini tidak dapat dihapus secara permanen karena masih menangani tiket atau transaksi CRM.';
    }
    if (lowerField.includes('ticket')) {
      return 'Tiket ini memiliki riwayat percakapan atau data lain yang harus diselesaikan/dihapus terlebih dahulu.';
    }
    if (
      lowerField.includes('contactcustom') ||
      lowerField.includes('contact')
    ) {
      return 'Kontak yang dipilih tidak valid atau masih memiliki transaksi/tiket terkait di sistem.';
    }
    if (lowerField.includes('pipelinestage') || lowerField.includes('stage')) {
      return 'Tahapan (Stage) ini tidak valid atau masih memiliki beberapa transaksi (Deals) terkait.';
    }
    if (lowerField.includes('pipeline')) {
      return 'Pipeline ini tidak valid atau masih memuat Deals/Stage aktif.';
    }
    if (lowerField.includes('category')) {
      return 'Kategori ini masih memiliki artikel yang terhubung. Pindahkan artikel ke kategori lain terlebih dahulu.';
    }
    if (lowerField.includes('tag')) {
      return 'Label (Tag) ini tidak bisa dihapus karena masih menempel pada beberapa artikel.';
    }
    if (lowerField.includes('inboxagent')) {
      return 'Agen ini masih menangani percakapan aktif di Inbox. Harap lepaskan agen dari percakapan terlebih dahulu.';
    }
    if (lowerField.includes('navmenu')) {
      return 'Menu ini masih didistribusikan ke beberapa perusahaan (Company).';
    }

    // Fallback professional message
    return 'Gagal memproses data karena referensi data terkait tidak valid atau masih digunakan oleh komponen lain di dalam sistem.';
  }
}
