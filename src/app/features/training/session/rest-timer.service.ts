import { Injectable, computed, signal } from '@angular/core';

/**
 * Rest timer service — one active countdown at a time. Started by the
 * session page when the user checks off a set; the SessionRestTimer
 * banner reads `remaining()` + `active()` and paints itself.
 *
 * Ticks via setInterval at 1s resolution; when the browser tab is
 * backgrounded on mobile, the interval may pause but wall-clock time
 * elapses regardless, so the reader computes remaining from a
 * captured `endsAt` timestamp on each tick — no drift on wake.
 *
 * Not providedIn:'root' — scoped to the session page providers so a
 * new session starts fresh with no stale state.
 */
@Injectable()
export class RestTimerService {
  /** Wall-clock epoch ms when the current countdown should end. */
  private readonly _endsAt = signal<number | null>(null);
  /** Whole seconds the timer was seeded with (for progress ring later). */
  private readonly _total = signal(0);

  readonly active = computed(() => this._endsAt() !== null);
  readonly total = this._total.asReadonly();
  readonly remaining = signal(0);

  private tickHandle: ReturnType<typeof setInterval> | null = null;

  /** Start / restart the countdown at `seconds`. Overrides any active. */
  start(seconds: number): void {
    if (seconds <= 0) { this.skip(); return; }
    this._total.set(seconds);
    this._endsAt.set(Date.now() + seconds * 1000);
    this.remaining.set(seconds);
    this.ensureTicking();
  }

  /** Cancel the countdown early (e.g. user tapped Saltar). */
  skip(): void {
    this._endsAt.set(null);
    this._total.set(0);
    this.remaining.set(0);
    this.stopTicking();
  }

  /** Add / subtract time to the current countdown. No-op if inactive. */
  bump(deltaSeconds: number): void {
    const ends = this._endsAt();
    if (ends === null) return;
    const next = ends + deltaSeconds * 1000;
    if (next <= Date.now()) { this.skip(); return; }
    this._endsAt.set(next);
    this._total.update(t => Math.max(t + deltaSeconds, 1));
    this.recomputeRemaining();
  }

  private ensureTicking(): void {
    if (this.tickHandle !== null) return;
    this.tickHandle = setInterval(() => this.recomputeRemaining(), 250);
  }

  private stopTicking(): void {
    if (this.tickHandle === null) return;
    clearInterval(this.tickHandle);
    this.tickHandle = null;
  }

  private recomputeRemaining(): void {
    const ends = this._endsAt();
    if (ends === null) return;
    const remaining = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
    this.remaining.set(remaining);
    if (remaining === 0) this.skip();
  }
}
