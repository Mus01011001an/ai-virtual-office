import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'node:vm';
import { spawn } from 'node:child_process';

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  exitCode: number;
  timedOut: boolean;
}

export interface ExecutionOptions {
  language: 'javascript' | 'typescript' | 'python';
  code: string;
  timeoutMs?: number;
  inputPayload?: Record<string, unknown>;
}

@Injectable()
export class SecureRunnerService {
  private readonly logger = new Logger(SecureRunnerService.name);
  private readonly DEFAULT_TIMEOUT_MS = 5000;
  private readonly MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB

  /**
   * Mengeksekusi kode pada sandbox terisolasi.
   */
  async execute(options: ExecutionOptions): Promise<ExecutionResult> {
    const { language, code, timeoutMs = this.DEFAULT_TIMEOUT_MS, inputPayload } = options;
    const start = Date.now();

    if (!code || !code.trim()) {
      return {
        success: false,
        stdout: '',
        stderr: 'Error: Kode sumber tidak boleh kosong.',
        executionTimeMs: 0,
        exitCode: 1,
        timedOut: false,
      };
    }

    try {
      if (language === 'javascript' || language === 'typescript') {
        return await this.runJavaScript(code, timeoutMs, inputPayload, start);
      } else if (language === 'python') {
        return await this.runPython(code, timeoutMs, inputPayload, start);
      } else {
        return {
          success: false,
          stdout: '',
          stderr: `Bahasa "${language}" belum didukung sandbox.`,
          executionTimeMs: Date.now() - start,
          exitCode: 1,
          timedOut: false,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        stdout: '',
        stderr: `Sandbox Execution Exception: ${err.message}`,
        executionTimeMs: Date.now() - start,
        exitCode: 1,
        timedOut: false,
      };
    }
  }

  /**
   * Eksekusi JavaScript dalam node:vm terisolasi tanpa akses require, process, atau file system.
   */
  private async runJavaScript(
    code: string,
    timeoutMs: number,
    inputPayload?: Record<string, unknown>,
    startTime: number = Date.now(),
  ): Promise<ExecutionResult> {
    const logs: string[] = [];
    const errors: string[] = [];

    const appendLog = (...args: any[]) => {
      const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (Buffer.byteLength(logs.join('\n') + line) < this.MAX_OUTPUT_BYTES) {
        logs.push(line);
      }
    };

    const appendErr = (...args: any[]) => {
      const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (Buffer.byteLength(errors.join('\n') + line) < this.MAX_OUTPUT_BYTES) {
        errors.push(line);
      }
    };

    const sandbox = {
      console: {
        log: appendLog,
        info: appendLog,
        warn: appendErr,
        error: appendErr,
      },
      input: inputPayload || {},
      JSON,
      Math,
      Date,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURI,
      decodeURI,
      encodeURIComponent,
      decodeURIComponent,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      Promise,
    };

    const context = vm.createContext(sandbox, {
      codeGeneration: {
        strings: false, // cegah eval() & new Function()
        wasm: false,
      },
    });

    try {
      // Wrapper async IIFE agar user bisa menggunakan await
      const wrappedCode = `(async () => {\n${code}\n})()`;
      const script = new vm.Script(wrappedCode);

      const promise = script.runInContext(context, {
        timeout: timeoutMs,
        displayErrors: true,
      });

      // Menunggu hasil async jika kode mengembalikan Promise
      await Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);

      return {
        success: errors.length === 0,
        stdout: logs.join('\n'),
        stderr: errors.join('\n'),
        executionTimeMs: Date.now() - startTime,
        exitCode: errors.length > 0 ? 1 : 0,
        timedOut: false,
      };
    } catch (err: any) {
      const isTimeout = err.message?.includes('timed out');
      return {
        success: false,
        stdout: logs.join('\n'),
        stderr: errors.length > 0 ? `${errors.join('\n')}\n${err.message}` : err.message,
        executionTimeMs: Date.now() - startTime,
        exitCode: isTimeout ? 124 : 1,
        timedOut: isTimeout,
      };
    }
  }

  /**
   * Eksekusi Python 3 subproses dengan environment variables stripped (tidak ada DATABASE_URL / S3 secret).
   */
  private async runPython(
    code: string,
    timeoutMs: number,
    inputPayload?: Record<string, unknown>,
    startTime: number = Date.now(),
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Injeksi payload input sebagai variabel JSON jika tersedia
      let script = code;
      if (inputPayload) {
        const jsonStr = JSON.stringify(inputPayload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        script = `import json\ninput_data = json.loads('${jsonStr}')\n` + code;
      }

      // Stripped environment: HANYA path umum dan encoding, NOL kredensial host
      const safeEnv: NodeJS.ProcessEnv = {
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        PYTHONUNBUFFERED: '1',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
      };

      const proc = spawn('python3', ['-c', script], {
        env: safeEnv,
        timeout: timeoutMs,
        shell: false,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill('SIGKILL');
        } catch {}
      }, timeoutMs);

      proc.stdout.on('data', (chunk) => {
        if (Buffer.byteLength(stdout) < this.MAX_OUTPUT_BYTES) {
          stdout += chunk.toString('utf-8');
        }
      });

      proc.stderr.on('data', (chunk) => {
        if (Buffer.byteLength(stderr) < this.MAX_OUTPUT_BYTES) {
          stderr += chunk.toString('utf-8');
        }
      });

      proc.on('close', (exitCode) => {
        clearTimeout(timer);
        resolve({
          success: exitCode === 0 && !timedOut,
          stdout: stdout.trim(),
          stderr: timedOut ? `Execution timed out after ${timeoutMs}ms` : stderr.trim(),
          executionTimeMs: Date.now() - startTime,
          exitCode: exitCode ?? (timedOut ? 124 : 1),
          timedOut,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          stdout: stdout.trim(),
          stderr: `Failed to spawn python3: ${err.message}`,
          executionTimeMs: Date.now() - startTime,
          exitCode: 1,
          timedOut: false,
        });
      });
    });
  }
}
