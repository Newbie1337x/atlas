import { CanDeactivateFn } from '@angular/router';
import { SessionPage } from '../session.page';

/**
 * Prompts "descartar entrenamiento?" before leaving /training/session
 * when the workout draft has ANY completed set. Same pattern as
 * routineEditDeactivateGuard — delegates to the page so it can reach
 * the page-scoped SessionFormService without cross-injector issues.
 */
export const sessionDeactivateGuard: CanDeactivateFn<SessionPage> =
  (component) => component.confirmDiscardIfDirty();
