import { Routes } from '@angular/router';
import { publicOnlyGuard } from '@core/auth/auth.guard';

/**
 * Note the guard placement: publicOnlyGuard sits on the LOGIN route only,
 * NOT the /auth parent. The OAuth callback deliberately runs guardless —
 * a logged-in user completing an account-switch OAuth still needs to reach
 * the callback so the new tokens can overwrite the old session. publicOnlyGuard
 * would bounce them to '/' and drop the incoming tokens on the floor.
 */
export const authRoutes: Routes = [
  {
    path: 'login',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./login.page').then((m) => m.LoginPage),
  },
  {
    path: 'oauth-callback',
    loadComponent: () => import('./oauth-callback.page').then((m) => m.OAuthCallbackPage),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
