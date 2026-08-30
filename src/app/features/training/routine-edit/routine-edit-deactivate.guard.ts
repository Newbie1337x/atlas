import { CanDeactivateFn } from '@angular/router';
import { RoutineEditPage } from '../routine-edit.page';

/**
 * Prompts "descartar cambios?" before leaving /routines/:id/edit when
 * the draft is dirty. Wired on the route so it catches EVERY exit
 * path — toolbar back button, Android system back gesture, browser
 * back, in-app router.navigate — through one code path.
 *
 * Delegates to the page's own `confirmDiscardIfDirty()` since the
 * RoutineEditFormService is scoped to the component (providers: []
 * on the page) — reading it via `inject()` in the guard's own
 * injection context would resolve a different instance.
 */
export const routineEditDeactivateGuard: CanDeactivateFn<RoutineEditPage> =
  (component) => component.confirmDiscardIfDirty();
