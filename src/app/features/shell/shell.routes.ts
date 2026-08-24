import { Routes } from '@angular/router';

/**
 * Authenticated shell routes. All routes here run behind `authGuard`
 * (registered at the parent route in app.routes.ts). Add feature lazy loads
 * as they're built — every feature ships as its own chunk.
 *
 * Wire an entry per feature:
 *   { path: 'bookings',
 *     canActivate: [moduleGuard('SCHEDULING')],
 *     loadChildren: () => import('@features/bookings/bookings.routes').then(m => m.bookingsRoutes) }
 */
export const shellRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell.page').then((m) => m.ShellPage),
  },
];
