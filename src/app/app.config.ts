import {
  ApplicationConfig,
  APP_INITIALIZER,
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';

import { routes } from './app.routes';
import { environment } from '@env';
import { API_BASE_URL, DEFAULT_TENANT_SLUG } from '@core/auth/auth.tokens';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { errorTransformInterceptor } from '@core/errors/error-transform.interceptor';
import { GlobalErrorHandler } from '@core/errors/global-error.handler';
import { AuthService } from '@core/auth/auth.service';
import { enableQueryPersistence } from '@core/offline/query-persist';

/**
 * App bootstrap. Restores the persisted session BEFORE the router boots so
 * guards see the authenticated state on cold app start.
 */
function restoreAuthOnStartup() {
  const auth = inject(AuthService);
  return () => auth.restore();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
enableQueryPersistence(queryClient);

/**
 * Runtime-resolved API base URL for dev.
 *
 * When you open the app from `localhost` it hits `localhost:8080`; when you
 * open it from a Tailscale/LAN IP (or a MagicDNS hostname) it hits that
 * same host on :8080. Lets a single dev build serve PC + phone at once
 * without hardcoding an IP.
 *
 * Prod uses `environment.apiUrl` verbatim (that env sets `production: true`
 * and a real API host).
 */
function resolveApiBaseUrl(): string {
  if (environment.production) return environment.apiUrl;
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return isLocal ? environment.apiUrl : `http://${host}:8080`;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideRouter(routes, withComponentInputBinding()),

    // Interceptor order matters — auth first (retries 401 with refresh),
    // then error-transform (turns any surviving HttpErrorResponse into HttpError).
    provideHttpClient(
      withInterceptors([authInterceptor, errorTransformInterceptor]),
      withFetch(),
    ),

    provideIonicAngular({
      mode: 'ios',
      innerHTMLTemplatesEnabled: false,
    }),

    provideTanStackQuery(queryClient),

    { provide: API_BASE_URL,      useFactory: resolveApiBaseUrl },
    { provide: DEFAULT_TENANT_SLUG, useValue: environment.tenantSlug },

    { provide: ErrorHandler,      useClass: GlobalErrorHandler },

    { provide: APP_INITIALIZER, useFactory: restoreAuthOnStartup, multi: true },
  ],
};
