import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { Logger } from '@core/logger/logger.service';
import { NotificationService } from '@core/notify/notification.service';
import { HttpError } from './http-error';

/**
 * Last-resort catcher for uncaught exceptions in components, effects, RxJS
 * pipes without a `catchError`, async handlers, etc. Logs the error and
 * surfaces a friendly toast so the user is never stranded on a silent white
 * screen.
 *
 * Registered in app.config.ts:
 *   { provide: ErrorHandler, useClass: GlobalErrorHandler }
 *
 * Features should still catch expected errors locally — this is for the
 * unexpected ones. Adding Sentry / crashlytics later is: swap the .log()
 * call for the vendor SDK.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(Logger);
  private readonly notify = inject(NotificationService);
  private readonly zone   = inject(NgZone);

  handleError(err: unknown): void {
    this.logger.error('Uncaught error', err);

    const userMessage =
      err instanceof HttpError ? err.userMessage :
      err instanceof Error     ? 'Algo salió mal. Intentá de nuevo.' :
                                 'Ocurrió un error inesperado.';

    // Toast must run inside NgZone so Ionic Overlay Controller updates the view
    this.zone.run(() => void this.notify.error(userMessage));
  }
}
