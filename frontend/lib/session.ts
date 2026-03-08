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
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser) {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  writeAuthCookie(token);
}

export function clearSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  writeAuthCookie(null);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
