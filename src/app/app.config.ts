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
import { API_BASE_URL, DEFAULT_TENANT_ID } from '@core/auth/auth.tokens';
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

    { provide: API_BASE_URL,      useValue: environment.apiUrl },
    { provide: DEFAULT_TENANT_ID, useValue: environment.tenantId },

    { provide: ErrorHandler,      useClass: GlobalErrorHandler },

    { provide: APP_INITIALIZER, useFactory: restoreAuthOnStartup, multi: true },
  ],
};
