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
  // Prefer per-tab sessionStorage to allow multiple accounts in different tabs
  const st = window.sessionStorage.getItem(TOKEN_KEY);
  if (st) return st;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) return null;
  const rawSession = window.sessionStorage.getItem(USER_KEY);
  const rawLocal = rawSession || window.localStorage.getItem(USER_KEY);
  if (!rawLocal) return null;
  try { return JSON.parse(rawLocal) as AuthUser; } catch { return null; }
}

export function saveSession(token: string, user: AuthUser) {
  if (!isBrowser()) return;
  // Store per-tab to allow parallel logins in different tabs
  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  // Also mirror user (not token) to localStorage for minor UX (optional)
  try { window.localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
  writeAuthCookie(token);
}

export function clearSession() {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(USER_KEY);
  // Do not remove other tabs' sessions in localStorage; remove only our mirror user
  try { window.localStorage.removeItem(USER_KEY); } catch {}
  writeAuthCookie(null);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
