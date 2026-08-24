/**
 * Development environment. Points to a local Proteus running on 8080.
 * Override the values here for your local dev setup. Do NOT commit real
 * secrets — this file is public.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  /** Hardcoded single-tenant id. Read from JWT once you log in; this is only
   *  used to allow anonymous requests (e.g. login itself) to identify the tenant. */
  tenantId: '1',
  appName: 'Gym (dev)',
  logLevel: 'debug' as 'debug' | 'info' | 'warn' | 'error',
};
