/**
 * Minimal JWT payload decoder — copied from Gaia (libs/shared/auth/jwt.util.ts)
 * to avoid a package publish for 30 LOC. Contract MUST stay in sync with Gaia:
 * both sides read `sub`, `userId`, `organizationId`, `role`, `exp` from Proteus.
 *
 * Does NOT verify signature — that's the backend's job. Client-side we only
 * read claims for routing/UI decisions.
 */

export interface JwtPayload {
  sub: string;           // email
  userId: number;
  organizationId: number;
  role: string;          // 'CUSTOMER' | 'COACH' | 'OWNER' | 'MANAGER' | 'SUPER_ADMIN' — string to survive Proteus additions
  exp: number;           // unix seconds
  iat?: number;
  /** Optional module list — Proteus emits this when capabilities are baked into the token. */
  modules?: string[];
}

export interface LoginResponse {
  token: string;
  email: string;
  role: string;
  /** Refresh token — MAY be absent while backend refresh flow is not yet built. */
  refreshToken?: string;
}

export function decodeJwt<T = JwtPayload>(token: string): T | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    // base64url → base64 → utf8
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** True when the token's `exp` is in the past (or unparseable — treated as expired). */
export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp - skewSeconds <= nowSec;
}
