import { Routes } from '@angular/router';
import { publicOnlyGuard } from '@core/auth/auth.guard';

/**
 * Guard-placement notes:
 *
 * publicOnlyGuard on: login, register, forgot-password
 *   — a logged-in user has no business on these; bounce to '/'.
 *
 * NO guard on: oauth-callback, reset-password, verify
 *   — all three land via URLs the user gets via external redirect (Google) or
 *     via email links. A logged-in user MUST still be able to complete these
 *     (account switch, resetting from a device already signed in on another
 *     account, verifying a different email). publicOnlyGuard would bounce
 *     them and silently drop whatever they came here to do.
 */
export const authRoutes: Routes = [
  {
    path: 'login',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'forgot-password',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./forgot-password.page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./reset-password.page').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'verify',
    loadComponent: () => import('./verify-email.page').then((m) => m.VerifyEmailPage),
  },
  {
    path: 'oauth-callback',
    loadComponent: () => import('./oauth-callback.page').then((m) => m.OAuthCallbackPage),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
