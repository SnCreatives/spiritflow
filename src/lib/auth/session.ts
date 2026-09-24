import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'liquorflow_session';
export const SESSION_TTL_DAYS = 7;

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function calculateSessionExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_TTL_DAYS);
  return expiry;
}

export function isSecureRequest(req: { secure?: boolean; protocol?: string; headers: Record<string, any> }): boolean {
  if (req.secure || req.protocol === 'https') return true;
  const protoHeader = req.headers['x-forwarded-proto'];
  if (typeof protoHeader === 'string' && protoHeader.toLowerCase().includes('https')) return true;
  if (Array.isArray(protoHeader) && protoHeader.some((p: string) => p.toLowerCase().includes('https'))) return true;
  return false;
}

export function createSessionCookie(token: string, isSecure = false): string {
  const maxAgeSeconds = SESSION_TTL_DAYS * 24 * 60 * 60;
  const encodedToken = encodeURIComponent(token);
  if (isSecure) {
    // In HTTPS/iframe proxy contexts, SameSite=None; Secure guarantees cookie persistence across cross-origin subrequests
    return `${SESSION_COOKIE_NAME}=${encodedToken}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=None; Secure`;
  }
  return `${SESSION_COOKIE_NAME}=${encodedToken}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookie(isSecure = false): string {
  if (isSecure) {
    return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`;
  }
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`;
}

export function extractSessionTokenFromCookie(cookieHeader?: string): string | null {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      const val = valueParts.join('=').trim();
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}
