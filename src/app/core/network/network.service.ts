import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge } from 'rxjs';

/**
 * Online/offline signal wrapping the browser's navigator.onLine + the
 * 'online'/'offline' window events. Read via `isOnline()` from any consumer.
 *
 * Not opinionated about how the app reacts — services that mutate on write
 * should queue when offline (offline-first), the shell's banner uses this
 * only to inform the user their pending writes are local until reconnect.
 *
 * On native (Capacitor iOS/Android) this ALSO catches network changes
 * because Capacitor patches navigator.onLine to match the OS. If we ever
 * need cellular-vs-wifi distinction, swap this for @capacitor/network.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly _isOnline  = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);

  readonly isOnline = this._isOnline.asReadonly();

  constructor() {
    merge(
      fromEvent(window, 'online'),
      fromEvent(window, 'offline'),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this._isOnline.set(navigator.onLine));
  }
}
