import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Guard for routes that require an authenticated session.
 * Redirects to `/auth/login` with `returnUrl` on failure.
 */
export const authGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Inverse guard — redirects authenticated users away from public-only routes
 * (login/register) so they land on the shell instead.
 */
export const publicOnlyGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/']);
};

/**
 * Factory for role-based guards. Example:
 *   { path: 'coach', canActivate: [authGuard, roleGuard('COACH', 'OWNER')] }
 */
export const roleGuard =
  (...roles: string[]): CanActivateFn =>
  (): boolean | UrlTree => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    return auth.hasRole(...roles) ? true : router.createUrlTree(['/']);
  };

/**
 * Factory for module-based guards — routes that only exist when a backend
 * module is active for the tenant. Example:
 *   { path: 'bookings', canActivate: [authGuard, moduleGuard('SCHEDULING')] }
 */
export const moduleGuard =
  (module: string): CanActivateFn =>
  (): boolean | UrlTree => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    return auth.hasModule(module) ? true : router.createUrlTree(['/']);
  };
