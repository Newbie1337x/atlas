import { Routes } from '@angular/router';
import { authGuard, publicOnlyGuard } from '@core/auth/auth.guard';

/**
 * Root routing skeleton — feature routes are lazy-loaded via `loadChildren`
 * so each feature ships as its own chunk. Adding a new feature = one entry
 * here + the feature's own `<name>.routes.ts` file.
 */
export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [publicOnlyGuard],
    loadChildren: () => import('@features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('@features/shell/shell.routes').then((m) => m.shellRoutes),
  },
  { path: '**', redirectTo: '' },
];
