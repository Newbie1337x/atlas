import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { DEFAULT_TENANT_ID } from './auth.tokens';

/**
 * Adds Authorization + X-Tenant-ID headers to every `/api/*` request, and
 * attempts a refresh + retry once on 401. Skips /auth/login and /auth/refresh
 * so the token flow doesn't loop.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth        = inject(AuthService);
  const router      = inject(Router);
  const defaultTid  = inject(DEFAULT_TENANT_ID);

  const isApi        = req.url.includes('/api/');
  const isAuthEndpoint = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/refresh');

  if (!isApi) return next(req);

  const token       = auth.token();
  const tenantId    = auth.currentUser()?.organizationId?.toString() ?? defaultTid;
  const authed = req.clone({
    setHeaders: {
      ...(token && !isAuthEndpoint ? { Authorization: `Bearer ${token}` } : {}),
      'X-Tenant-ID': tenantId,
    },
  });

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      // Only try refresh once, and never on the refresh endpoint itself
      if (err.status !== 401 || isAuthEndpoint) return throwError(() => err);
      return auth.refresh().pipe(
        switchMap((user) => {
          if (!user) {
            router.navigate(['/auth/login']);
            return throwError(() => err);
          }
          const newToken = auth.token();
          const retried = req.clone({
            setHeaders: {
              ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
              'X-Tenant-ID': user.organizationId.toString(),
            },
          });
          return next(retried);
        }),
      );
    }),
  );
};
