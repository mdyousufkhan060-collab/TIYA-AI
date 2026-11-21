import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCleanUrlAfterAuthCallback,
  extractOAuthCallbackError,
  hasAuthCallbackParams,
  PRODUCTION_SITE_URL,
  resolveAuthRedirectUrl,
} from './authRedirect';

test('resolveAuthRedirectUrl returns production Vercel URL in production builds', () => {
  assert.equal(
    resolveAuthRedirectUrl({ origin: 'https://tiya-ai.vercel.app', isProd: true }),
    'https://tiya-ai.vercel.app',
  );
});

test('resolveAuthRedirectUrl NEVER returns localhost:3000 in production builds', () => {
  assert.equal(
    resolveAuthRedirectUrl({ origin: 'http://localhost:3000', isProd: true }),
    PRODUCTION_SITE_URL,
  );
  assert.equal(
    resolveAuthRedirectUrl({ origin: 'http://127.0.0.1:3000', isProd: true }),
    PRODUCTION_SITE_URL,
  );
  assert.equal(
    resolveAuthRedirectUrl({
      origin: 'https://tiya-ai.vercel.app',
      envSiteUrl: 'http://localhost:3000',
      isProd: true,
    }),
    PRODUCTION_SITE_URL,
  );
  assert.equal(
    resolveAuthRedirectUrl({ origin: 'capacitor://localhost', isProd: true }),
    PRODUCTION_SITE_URL,
  );
  assert.equal(
    resolveAuthRedirectUrl({ origin: 'file://', isProd: true }),
    PRODUCTION_SITE_URL,
  );
  assert.equal(
    resolveAuthRedirectUrl({ origin: null, isProd: true }),
    PRODUCTION_SITE_URL,
  );
});

test('resolveAuthRedirectUrl supports local development on http://localhost:3000', () => {
  assert.equal(
    resolveAuthRedirectUrl({ origin: 'http://localhost:3000', isProd: false }),
    'http://localhost:3000',
  );
  assert.equal(
    resolveAuthRedirectUrl({ origin: 'https://ais-dev-example.run.app', isProd: false }),
    'https://ais-dev-example.run.app',
  );
});

test('resolveAuthRedirectUrl honors valid HTTPS VITE_SITE_URL in production', () => {
  assert.equal(
    resolveAuthRedirectUrl({
      origin: 'https://tiya-ai-preview.vercel.app',
      envSiteUrl: 'https://tiya-ai.vercel.app/',
      isProd: true,
    }),
    'https://tiya-ai.vercel.app',
  );
});

test('hasAuthCallbackParams and buildCleanUrlAfterAuthCallback clean #access_token and ?code safely', () => {
  const hashHref =
    'https://tiya-ai.vercel.app/#access_token=tok123&expires_in=3600&refresh_token=ref456&token_type=bearer';
  assert.equal(hasAuthCallbackParams('', '#access_token=tok123&token_type=bearer'), true);
  assert.equal(buildCleanUrlAfterAuthCallback(hashHref), '/');

  const pkceHref = 'https://tiya-ai.vercel.app/?code=abc123&tab=home';
  assert.equal(hasAuthCallbackParams('?code=abc123', ''), true);
  assert.equal(buildCleanUrlAfterAuthCallback(pkceHref), '/?tab=home');

  assert.equal(buildCleanUrlAfterAuthCallback('https://tiya-ai.vercel.app/'), null);
});

test('extractOAuthCallbackError extracts safe errors and never leaks tokens', () => {
  assert.equal(
    extractOAuthCallbackError('', '#error=access_denied&error_description=User+cancelled+login'),
    'User cancelled login',
  );
  assert.equal(
    extractOAuthCallbackError('?error=server_error', ''),
    'server_error',
  );
  assert.equal(
    extractOAuthCallbackError('', '#access_token=eyJhbGciOiJIUzI1NiJ9.abc.def'),
    null,
  );
  assert.equal(
    extractOAuthCallbackError('', '#error_description=eyJhbGciOiJIUzI1NiJ9.abc.def'),
    'Google sign-in failed. Please try again.',
  );
});
