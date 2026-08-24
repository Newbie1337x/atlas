import {
  ApplicationConfig,
  APP_INITIALIZER,
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
import { AuthService } from '@core/auth/auth.service';

/**
 * Restores the session from persistent storage BEFORE the router boots so
 * route guards see the authenticated state on cold app start.
 */
function restoreAuthOnStartup() {
  const auth = inject(AuthService);
  return () => auth.restore();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor]), withFetch()),

    provideIonicAngular({
      mode: 'ios',
      innerHTMLTemplatesEnabled: false,
    }),

    provideTanStackQuery(new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    })),

    { provide: API_BASE_URL,      useValue: environment.apiUrl },
    { provide: DEFAULT_TENANT_ID, useValue: environment.tenantId },

    { provide: APP_INITIALIZER, useFactory: restoreAuthOnStartup, multi: true },
  ],
};
