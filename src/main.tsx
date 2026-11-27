import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import App from './App.tsx';
import { installClientApi } from './lib/clientApi';
import './index.css';

// AI calls run on the device (works on Vercel and in the Android app)
installClientApi();

const Landing = lazy(() => import('./components/site/Landing'));
const DevelopersPage = lazy(() => import('./components/site/DevelopersPage'));
const StartStorePage = lazy(() => import('./components/site/StartStorePage'));
const DemoAdminPage = lazy(() => import('./components/site/DemoAdminPage'));

/**
 * myrosebd.com shows the public website; the app lives at /app.
 * Go straight to the app when: path is /app, a Google login is returning,
 * it runs as an installed app, or inside the Android app. Signed-in visitors of / see the
 * website with an OPEN ROSE button.
 */
function shouldOpenApp(): boolean {
  try {
    const { pathname, hash, search } = window.location;
    if (pathname.startsWith('/app')) return true;
    if (/access_token|refresh_token|error_description|error=/.test(hash) || /[?&](code|error)=/.test(search)) return true;
    if ((window as any).TiyaNative) return true;
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch {
    return true;
  }
  return false;
}

const isDevelopersPage = window.location.pathname.startsWith('/developers');
/** The demo shops' admin: the same WEBSITE ADMIN as real shops, on sample data */
const isDemoAdmin = window.location.pathname.startsWith('/demo-admin');
/** Store sign-up from a demo: /start, or a Google login coming back while a store sign-up is open. */
const isStartPage = (() => {
  try {
    const { pathname, hash, search } = window.location;
    if (pathname.startsWith('/start')) return true;
    // the app (/app, e.g. Store admin from a shop) is never the store sign-up page
    if (pathname.startsWith('/app')) return false;
    return Boolean(localStorage.getItem('rose_start_store')) && (/access_token/.test(hash) || /[?&]code=/.test(search)) && !(window as any).TiyaNative;
  } catch {
    return false;
  }
})();

createRoot(document.getElementById('root')!).render(
  isDemoAdmin ? (
    <Suspense fallback={<div style={{ background: '#05070B', height: '100dvh' }} />}>
      <DemoAdminPage />
    </Suspense>
  ) : isStartPage ? (
    <Suspense fallback={<div style={{ background: '#07090D', height: '100dvh' }} />}>
      <StartStorePage />
    </Suspense>
  ) : isDevelopersPage ? (
    <Suspense fallback={<div style={{ background: '#000', height: '100dvh' }} />}>
      <DevelopersPage />
    </Suspense>
  ) : shouldOpenApp() ? (
    <App />
  ) : (
    <Suspense fallback={<div style={{ background: '#000', height: '100dvh' }} />}>
      <Landing />
    </Suspense>
  ),
);

// Installable app on Android, iPhone and PC browsers (no offline cache).
try {
  if ('serviceWorker' in navigator && !(window as any).TiyaNative && location.protocol === 'https:') {
    window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
} catch {
  /* ignore */
}
