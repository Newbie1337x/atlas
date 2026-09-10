import { CanDeactivateFn } from '@angular/router';
import { SessionPage } from '../session.page';

/**
 * No-op deactivate guard. Kept as an explicit shim so the route
 * declaration reads intentionally: leaving /training/session while a
 * workout is active is FINE — the state lives on the root
 * ActiveWorkoutService and the mini-bar shows it from any tab. To
 * discard, the user taps the trash on the mini-bar or the Descartar
 * button in the "Guardar Entreno" save modal.
 */
export const sessionDeactivateGuard: CanDeactivateFn<SessionPage> =
  (component) => component.confirmDiscardIfDirty();
