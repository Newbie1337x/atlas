import { SessionStore } from '@core/auth/session.store';
import { JwtPayload } from '@core/auth/jwt.util';
import { DEMO_USER } from './demo-data';

/**
 * Base64url-encode (no padding) — same alphabet a real JWT segment uses.
 * `jwt-decode` (what SessionStore.hydrate reads through) never verifies
 * the signature client-side, it only decodes the payload segment — so a
 * self-signed, unsigned-in-practice token is enough to hydrate a session
 * with zero backend involved. This never leaves the browser and is never
 * sent to any server; it exists purely to seed local UI state for the
 * public showcase build.
 */
function base64url(json: unknown): string {
  const str = JSON.stringify(json);
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildDemoToken(): string {
  const header = { alg: 'none', typ: 'JWT' };
  const payload: JwtPayload = {
    sub: DEMO_USER.email,
    userId: DEMO_USER.id,
    organizationId: DEMO_USER.organizationId,
    role: DEMO_USER.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365, // 1 year — showcase never needs a real refresh
    iat: Math.floor(Date.now() / 1000),
  };
  return `${base64url(header)}.${base64url(payload)}.demo`;
}

/** Seeds SessionStore with a fake-but-decodable session — see buildDemoToken(). */
export function hydrateDemoSession(session: SessionStore): void {
  session.hydrate(buildDemoToken());
}
