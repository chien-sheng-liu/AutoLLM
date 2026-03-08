export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: 'user' | 'admin'; // legacy
  auth?: 'admin' | 'administrator' | 'manager' | 'user';
  created_at: string;
};

const TOKEN_KEY = 'autollm_token';
const USER_KEY = 'autollm_user';

function isBrowser() {
  return typeof window !== 'undefined';
}

function writeAuthCookie(token: string | null) {
  if (typeof document === 'undefined') return;
  if (!token) {
    document.cookie = 'auth_token=; Max-Age=0; path=/; SameSite=Lax';
    return;
  }
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  let cookie = `auth_token=${token}; Max-Age=${maxAge}; path=/; SameSite=Lax`;
  if (window.location.protocol === 'https:') cookie += '; Secure';
  document.cookie = cookie;
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  try { return window.sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) return null;
  let raw: string | null = null;
  try { raw = window.sessionStorage.getItem(USER_KEY); } catch {}
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

export function saveSession(token: string, user: AuthUser) {
  if (!isBrowser()) return;
  try { window.sessionStorage.setItem(TOKEN_KEY, token); } catch {}
  try { window.sessionStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
  writeAuthCookie(token);
}

export function clearSession() {
  if (!isBrowser()) return;
  try { window.sessionStorage.removeItem(TOKEN_KEY); } catch {}
  try { window.sessionStorage.removeItem(USER_KEY); } catch {}
  writeAuthCookie(null);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
