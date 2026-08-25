import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

type Tone = 'success' | 'error' | 'warning' | 'info';

const IONIC_COLOR: Record<Tone, string> = {
  success: 'success',
  error:   'danger',
  warning: 'warning',
  info:    'medium',
};

const DEFAULT_DURATION: Record<Tone, number> = {
  success: 2500,
  error:   4000,
  warning: 3500,
  info:    2500,
};

/**
 * Toast surface for the app. Features call this instead of instantiating
 * IonToastController directly — keeps look/duration/position consistent and
 * gives us ONE place to plug in analytics or grouping later.
 *
 *   notify.success('Rutina guardada');
 *   notify.error(err.userMessage);
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly toasts = inject(ToastController);

  success(message: string, duration?: number) { return this.show('success', message, duration); }
  error  (message: string, duration?: number) { return this.show('error',   message, duration); }
  warning(message: string, duration?: number) { return this.show('warning', message, duration); }
  info   (message: string, duration?: number) { return this.show('info',    message, duration); }

  private async show(tone: Tone, message: string, duration?: number): Promise<void> {
    const toast = await this.toasts.create({
      message,
      duration: duration ?? DEFAULT_DURATION[tone],
      color: IONIC_COLOR[tone],
      position: 'bottom',
      swipeGesture: 'vertical',
    });
    await toast.present();
  }
}
