import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import App from './App.tsx';
import { installClientApi } from './lib/clientApi';
import './index.css';

// AI calls run on the device (works on Vercel and in the Android app)
installClientApi();

const Landing = lazy(() => import('./components/site/Landing'));

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

createRoot(document.getElementById('root')!).render(
  shouldOpenApp() ? (
    <App />
  ) : (
    <Suspense fallback={<div style={{ background: '#000', height: '100dvh' }} />}>
      <Landing />
    </Suspense>
  ),
);
