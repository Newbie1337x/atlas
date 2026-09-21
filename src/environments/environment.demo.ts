/**
 * Public showcase build — no Proteus backend involved at all. `demoMode`
 * swaps TrainingApi/UsersApi for in-memory mocks (src/app/core/demo/) and
 * auto-hydrates a fake session on load, so the app is fully interactive
 * (real drag-and-drop, real live session tracker) against canned data.
 *
 * Built via `npm run build:demo` (angular.json "demo" configuration) and
 * deployed to GitHub Pages — see .github/workflows/deploy-demo.yml.
 */
export const environment = {
  production: true,
  demoMode: true,

  /** Unused in demo mode — nothing here ever calls HttpClient. */
  apiUrl: '',
  tenantSlug: 'demo',

  appName: 'Atlas (demo)',
  logLevel: 'warn' as 'debug' | 'info' | 'warn' | 'error',
};
