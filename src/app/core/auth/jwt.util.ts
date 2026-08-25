import { jwtDecode } from 'jwt-decode';

/** JWT claims Proteus emits. `modules` is optional until backend bakes it in. */
export interface JwtPayload {
  sub: string;
  userId: number;
  organizationId: number;
  role: string;
  exp: number;
  iat?: number;
  modules?: string[];
}

export interface LoginResponse {
  token: string;
  email: string;
  role: string;
  refreshToken?: string;
}

/** Never throws — returns null on malformed tokens. */
export function decodeJwt<T = JwtPayload>(token: string): T | null {
  try {
    return jwtDecode<T>(token);
  } catch {
    return null;
  }
}

/** True when `exp` is in the past (or unparseable — treated as expired). */
export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const p = decodeJwt<JwtPayload>(token);
  if (!p?.exp) return true;
  return p.exp - skewSeconds <= Math.floor(Date.now() / 1000);
}
