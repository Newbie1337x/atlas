import { InjectionToken } from '@angular/core';

/** Storage keys — centralized so nothing ever hardcodes the literal string. */
export const AUTH_STORAGE_KEYS = {
  accessToken:  'gym_access_token',
  refreshToken: 'gym_refresh_token',
} as const;

/** Base URL of Proteus API. Provided from environment so tests can override. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

/** Tenant id used before login when the token doesn't carry organizationId yet. */
export const DEFAULT_TENANT_ID = new InjectionToken<string>('DEFAULT_TENANT_ID');

/** Roles Proteus emits. Kept as string union to survive backend additions gracefully. */
export type UserRole =
  | 'CUSTOMER'
  | 'COACH'
  | 'OWNER'
  | 'MANAGER'
  | 'SUPER_ADMIN'
  | string;

/** In-app view of the authenticated user — derived from the JWT payload. */
export interface CurrentUser {
  email:          string;
  userId:         number;
  organizationId: number;
  role:           UserRole;
  /** Modules Proteus told us this tenant has active. Empty when the backend doesn't emit them. */
  modules:        string[];
}
