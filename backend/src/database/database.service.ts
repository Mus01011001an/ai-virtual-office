import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const PEAK_WINDOW_SEC = 60;

@Injectable()
export class DatabaseService extends PrismaClient {
  readonly pool: Pool;
  // Antrean sesaat sering 0 saat snapshot; simpan puncak per detik selama 1 menit
  private waitingPeaks = new Array<number>(PEAK_WINDOW_SEC).fill(0);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX) || 30, // pg default 10 terlalu kecil untuk ribuan SSE
      connectionTimeoutMillis: 10000, // wait up to 10s for a connection
      idleTimeoutMillis: 30000, // release idle connections after 30s
      keepAlive: true, // prevent socket from being silently dropped
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
    setInterval(() => {
      const sec = Math.floor(Date.now() / 1000) % PEAK_WINDOW_SEC;
      this.waitingPeaks[sec] = pool.waitingCount;
    }, 1000).unref();
  }

  poolStats() {
    return {
      max: this.pool.options.max ?? 10,
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      peakWaiting1m: Math.max(this.pool.waitingCount, ...this.waitingPeaks),
    };
  }
}
