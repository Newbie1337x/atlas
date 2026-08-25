import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { DEFAULT_TENANT_SLUG } from './auth.tokens';

/**
 * Adds Authorization + X-Tenant-Slug headers to every `/api/*` request, and
 * attempts a refresh + retry once on 401. Skips /auth/login and /auth/refresh
 * so the token flow doesn't loop.
 *
 * IMPORTANT: Proteus resolves the tenant by SLUG (string), NOT by numeric id.
 * The backend TenantFilter explicitly ignores `X-Tenant-ID` — we use
 * `X-Tenant-Slug` with the value from `DEFAULT_TENANT_SLUG` (single-tenant app,
 * one gym per install).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth        = inject(AuthService);
  const router      = inject(Router);
  const tenantSlug  = inject(DEFAULT_TENANT_SLUG);

  const isApi          = req.url.includes('/api/');
  const isAuthEndpoint = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/refresh');

  if (!isApi) return next(req);

  const token = auth.token();
  const authed = req.clone({
    setHeaders: {
      ...(token && !isAuthEndpoint ? { Authorization: `Bearer ${token}` } : {}),
      'X-Tenant-Slug': tenantSlug,
    },
  });

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      // Only try refresh once, and never on the refresh endpoint itself
      if (err.status !== 401 || isAuthEndpoint) return throwError(() => err);
      return auth.refresh().pipe(
        switchMap((user) => {
          if (!user) {
            void router.navigate(['/auth/login']);
            return throwError(() => err);
          }
          const newToken = auth.token();
          const retried = req.clone({
            setHeaders: {
              ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
              'X-Tenant-Slug': tenantSlug,
            },
          });
          return next(retried);
        }),
      );
    }),
  );
};
