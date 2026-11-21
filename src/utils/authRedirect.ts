export const PRODUCTION_SITE_URL = 'https://tiya-ai.vercel.app';

const AUTH_QUERY_KEYS = ['code', 'error', 'error_code', 'error_description', 'state'];
const AUTH_HASH_KEYS = [
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_type',
  'provider_token',
  'provider_refresh_token',
  'error',
  'error_code',
  'error_description',
  'type',
  'sb',
];

export function isLocalHostname(hostname: string): boolean {
  const h = (hostname || '').trim().toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '[::1]'
  );
}

function parseHttpOrigin(raw?: string | null): URL | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null') return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface ResolveAuthRedirectOptions {
  origin?: string | null;
  envSiteUrl?: string | null;
  isProd?: boolean;
}

/**
 * Environment-aware OAuth redirect destination for Supabase Auth.
 * - Production builds never fall back to localhost:3000; they return the
 *   hosted HTTPS origin (e.g. https://tiya-ai.vercel.app) or PRODUCTION_SITE_URL.
 * - Local development returns http://localhost:3000 (or the active dev origin).
 */
export function resolveAuthRedirectUrl(options?: ResolveAuthRedirectOptions): string {
  const isProd =
    typeof options?.isProd === 'boolean'
      ? options.isProd
      : Boolean(
          typeof import.meta !== 'undefined' &&
            (import.meta as { env?: { PROD?: boolean } }).env?.PROD,
        );

  const envUrlRaw =
    options && 'envSiteUrl' in options
      ? options.envSiteUrl
      : typeof import.meta !== 'undefined'
        ? (import.meta as { env?: { VITE_SITE_URL?: string } }).env?.VITE_SITE_URL
        : undefined;

  const envParsed = parseHttpOrigin(envUrlRaw);
  if (envParsed) {
    if (!isProd || (envParsed.protocol === 'https:' && !isLocalHostname(envParsed.hostname))) {
      return envParsed.origin;
    }
  }

  const originRaw =
    options && 'origin' in options
      ? options.origin
      : typeof window !== 'undefined'
        ? window.location.origin
        : null;

  const originParsed = parseHttpOrigin(originRaw);
  if (originParsed) {
    if (isProd) {
      if (originParsed.protocol === 'https:' && !isLocalHostname(originParsed.hostname)) {
        return originParsed.origin;
      }
      return PRODUCTION_SITE_URL;
    }
    return originParsed.origin;
  }

  return PRODUCTION_SITE_URL;
}

/**
 * Extracts a safe, non-sensitive OAuth callback error message from URL query/hash
 * parameters without ever reading or returning access/refresh tokens.
 */
export function extractOAuthCallbackError(search: string, hash: string): string | null {
  const cleanHash = (hash || '').replace(/^#/, '');
  const hashParams = new URLSearchParams(cleanHash);
  const queryParams = new URLSearchParams((search || '').replace(/^\?/, ''));

  const rawDesc =
    hashParams.get('error_description') ||
    queryParams.get('error_description') ||
    hashParams.get('error') ||
    queryParams.get('error');

  if (!rawDesc) return null;
  const normalized = rawDesc.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  // Never surface anything resembling a JWT or token string
  if (/access_token|refresh_token|eyJ[A-Za-z0-9_-]{10,}/i.test(normalized)) {
    return 'Google sign-in failed. Please try again.';
  }
  return normalized.slice(0, 200);
}

/**
 * Checks whether the current URL carries Supabase OAuth callback parameters
 * (hash tokens, PKCE code, or OAuth error parameters).
 */
export function hasAuthCallbackParams(search: string, hash: string): boolean {
  const queryParams = new URLSearchParams((search || '').replace(/^\?/, ''));
  for (const key of AUTH_QUERY_KEYS) {
    if (queryParams.has(key)) return true;
  }

  const cleanHash = (hash || '').replace(/^#/, '');
  if (!cleanHash) return false;
  const hashParams = new URLSearchParams(cleanHash);
  for (const key of AUTH_HASH_KEYS) {
    if (hashParams.has(key)) return true;
  }
  return false;
}

/**
 * Returns a clean URL with OAuth callback fragments/query params removed AFTER
 * the Supabase SDK has finished processing the session. Returns null if no
 * auth callback parameters were present.
 */
export function buildCleanUrlAfterAuthCallback(currentHref: string): string | null {
  let url: URL;
  try {
    url = new URL(currentHref);
  } catch {
    return null;
  }

  if (!hasAuthCallbackParams(url.search, url.hash)) {
    return null;
  }

  for (const key of AUTH_QUERY_KEYS) {
    url.searchParams.delete(key);
  }

  const cleanHash = url.hash.replace(/^#/, '');
  if (cleanHash) {
    const hashParams = new URLSearchParams(cleanHash);
    let hasAuthHashKey = false;
    for (const key of AUTH_HASH_KEYS) {
      if (hashParams.has(key)) {
        hasAuthHashKey = true;
        hashParams.delete(key);
      }
    }
    if (hasAuthHashKey) {
      const remaining = hashParams.toString();
      url.hash = remaining ? `#${remaining}` : '';
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
