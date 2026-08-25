import { Injectable } from '@angular/core';
import { environment } from '@env';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Single log authority. Features/services call this instead of console.*.
 * Log level is set per env in `environment.ts` — debug/info are no-ops in
 * prod so DevTools of end users stays clean.
 *
 * When Sentry / Datadog / whatever is added later, wrap the error() call to
 * also emit to the vendor SDK.
 */
@Injectable({ providedIn: 'root' })
export class Logger {
  private readonly threshold = ORDER[environment.logLevel];

  debug(...args: unknown[]): void { this.emit('debug', args); }
  info (...args: unknown[]): void { this.emit('info',  args); }
  warn (...args: unknown[]): void { this.emit('warn',  args); }
  error(...args: unknown[]): void { this.emit('error', args); }

  private emit(level: Level, args: unknown[]): void {
    if (ORDER[level] < this.threshold) return;
    console[level](`[gym-front:${level}]`, ...args);
  }
}
