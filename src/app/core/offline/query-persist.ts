import { QueryClient } from '@tanstack/angular-query-experimental';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const CACHE_KEY   = 'gym_query_cache_v1';
const MAX_AGE_MS  = 1000 * 60 * 60 * 24;   // 24h — evict older entries on hydrate

/**
 * Wires TanStack Query to `localStorage` so cached queries survive app
 * restarts (and offline app launches). Gym context: WiFi is chota, socios
 * abren la app en el subsuelo — sin persistencia ven pantalla blanca.
 *
 * Called ONCE from app.config.ts right after the QueryClient is created.
 *
 * NOTE: Capacitor on native ALSO exposes localStorage (proxied to native
 * storage under the hood), so this works cross-platform without a swap.
 * For encrypted per-user cache, promote to Capacitor Preferences + custom
 * persister (still using the same persistQueryClient contract).
 */
export function enableQueryPersistence(client: QueryClient): void {
  if (typeof localStorage === 'undefined') return;   // SSR-safe (skip)

  const persister = createSyncStoragePersister({
    storage: localStorage,
    key:     CACHE_KEY,
    throttleTime: 1000,
  });

  // persistQueryClient returns [unsubscribe, restorePromise] — we intentionally
  // fire-and-forget: hydration happens in the background, subsequent queries
  // hit the (soon-populated) cache OR trigger a network fetch as a fallback.
  void persistQueryClient({
    queryClient: client,
    persister,
    maxAge: MAX_AGE_MS,
    buster:  'v1',
  });
}
