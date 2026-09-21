/**
 * Development environment. Points to a local Proteus running on 8080.
 * Override the values here for your local dev setup. Do NOT commit real
 * secrets — this file is public.
 */
export const environment = {
  production: false,

  /** True only in environment.demo.ts — swaps in the in-memory mock API
   *  layer and an auto-hydrated session so the app runs standalone with
   *  no Proteus backend at all. See src/app/core/demo/. */
  demoMode: false,

  /** Proteus API base URL. */
  apiUrl: 'http://localhost:8080',

  /**
   * Tenant slug used in the `X-Tenant-Slug` header on every /api/* request.
   * Set 2026-08-25 to the dev tenant created via:
   *   POST /api/auth/signup { companyName: "Gym Dev Cabrera", ... }
   * Slug is auto-derived from `name` and stored in organizations.branding_config->>'slug'.
   *
   * Dev credentials for the OWNER admin:
   *   email: admin@gymdev.local
   *   password: GymDev2026!
   */
  tenantSlug: 'gym-dev-cabrera',

  appName: 'Gym (dev)',
  logLevel: 'debug' as 'debug' | 'info' | 'warn' | 'error',
};
