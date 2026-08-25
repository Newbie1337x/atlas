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

/**
 * Roles Proteus emits. Typed as string to survive backend additions gracefully —
 * check the concrete constants below for compile-time completion, but any
 * string value the backend sends still round-trips through the type.
 */
export type UserRole = string;
export const USER_ROLES = {
  CUSTOMER:    'CUSTOMER',
  COACH:       'COACH',
  OWNER:       'OWNER',
  MANAGER:     'MANAGER',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

/** In-app view of the authenticated user — derived from the JWT payload. */
export interface CurrentUser {
  email:          string;
  userId:         number;
  organizationId: number;
  role:           UserRole;
  /** Modules Proteus told us this tenant has active. Empty when the backend doesn't emit them. */
  modules:        string[];
}
