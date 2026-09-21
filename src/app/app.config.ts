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
import { SessionStore } from '@core/auth/session.store';
import { enableQueryPersistence } from '@core/offline/query-persist';
import { UsersApi } from '@core/users/users.api';
import { TrainingApi } from '@core/training/training.api';
import { DemoUsersApi } from '@core/demo/demo-users.api';
import { DemoTrainingApi } from '@core/demo/demo-training.api';
import { hydrateDemoSession } from '@core/demo/demo-session';

/**
 * App bootstrap. Restores the persisted session BEFORE the router boots so
 * guards see the authenticated state on cold app start.
 *
 * In the public showcase build (environment.demoMode) there's no backend
 * to restore a session FROM — hydrateDemoSession seeds a fake-but-valid
 * session directly instead, so the app lands straight on Home.
 */
function restoreAuthOnStartup() {
  if (environment.demoMode) {
    const session = inject(SessionStore);
    return () => hydrateDemoSession(session);
  }
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

    // Public showcase build only — swaps the real HTTP-backed APIs for an
    // in-memory mock so the whole app runs standalone with no Proteus
    // instance at all. See src/app/core/demo/.
    ...(environment.demoMode
      ? [
          { provide: UsersApi, useClass: DemoUsersApi },
          { provide: TrainingApi, useClass: DemoTrainingApi },
        ]
      : []),
  ],
};
