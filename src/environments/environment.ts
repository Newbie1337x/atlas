/**
 * Development environment. Points to a local Proteus running on 8080.
 * Override the values here for your local dev setup. Do NOT commit real
 * secrets — this file is public.
 */
export const environment = {
  production: false,

  /** Proteus API base URL. */
  apiUrl: 'http://localhost:8080',

  /**
   * Tenant slug used in the `X-Tenant-Slug` header on every /api/* request.
   * TODO: replace `'default'` with your actual gym slug from Proteus. Find it via:
   *   - Proteus admin panel → Organizations
   *   - or: `SELECT slug FROM organizations WHERE id = <your_org_id>;`
   */
  tenantSlug: 'default',

  appName: 'Gym (dev)',
  logLevel: 'debug' as 'debug' | 'info' | 'warn' | 'error',
};
