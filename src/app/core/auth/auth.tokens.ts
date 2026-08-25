import { InjectionToken } from '@angular/core';

/** Storage keys — centralized so nothing ever hardcodes the literal string. */
export const AUTH_STORAGE_KEYS = {
  accessToken:  'gym_access_token',
  refreshToken: 'gym_refresh_token',
} as const;

/** Base URL of Proteus API. Provided from environment so tests can override. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

/**
 * Tenant slug used in the `X-Tenant-Slug` header on every /api/* request.
 * Proteus resolves the tenant by SLUG (string), NOT by numeric id — the
 * TenantFilter explicitly ignores `X-Tenant-ID`.
 * Provided from environment so tests can override.
 */
export const DEFAULT_TENANT_SLUG = new InjectionToken<string>('DEFAULT_TENANT_SLUG');

/**
 * Roles Proteus emits. Typed as string to survive backend additions gracefully —
 * check the concrete constants below for compile-time completion, but any
 * string value the backend sends still round-trips through the type.
 *
 * NOTE: `COACH` is a planned addition to the Proteus enum (backend today only has
 * SUPER_ADMIN / OWNER / MANAGER / STAFF / CUSTOMER). Backend needs to add COACH
 * + change `User.role: UserRole` → `User.roles: Set<UserRole>` for dual-role
 * toggling. See PLAYBOOK.md → "Backend changes required".
 */
export type UserRole = string;
export const USER_ROLES = {
  CUSTOMER:    'CUSTOMER',
  STAFF:       'STAFF',
  COACH:       'COACH',        // planned backend addition
  OWNER:       'OWNER',
  MANAGER:     'MANAGER',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

/**
 * In-app view of the authenticated user — derived from the JWT payload.
 *
 * `roles` is always a Set-shaped array to support dual-role users (COACH+CUSTOMER).
 * Backend TODAY only sends single `role` in JWT; frontend normalizes to array so
 * consumers never care. When backend adds `roles: string[]` to JWT payload, no
 * consumer code changes.
 */
export interface CurrentUser {
  email:          string;
  userId:         number;
  organizationId: number;
  roles:          UserRole[];
  /** Currently active role in the UI (dual-role users toggle between them). */
  activeRole:     UserRole;
  /** Modules Proteus told us this tenant has active. Empty when the backend doesn't emit them. */
  modules:        string[];
}
