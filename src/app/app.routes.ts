import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';

/**
 * Root routing skeleton — feature routes are lazy-loaded via `loadChildren`
 * so each feature ships as its own chunk. Adding a new feature = one entry
 * here + the feature's own `<name>.routes.ts` file.
 */
export const routes: Routes = [
  {
    // No guard at this level — publicOnlyGuard sits on the individual login
    // route inside so OAuth callback stays reachable for logged-in users
    // (account switch flow). See auth.routes.ts for the reasoning.
    path: 'auth',
    loadChildren: () => import('@features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('@features/shell/shell.routes').then((m) => m.shellRoutes),
  },
  { path: '**', redirectTo: '' },
];
