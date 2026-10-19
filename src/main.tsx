import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Presentation } from './presentation/Presentation';
import { RenderView } from './presentation/RenderView';

/** Dashboard v1 (conservado) disponible en #/dashboard. */
const DashboardApp = lazy(() => import('./App'));

function Root() {
  const [dash, setDash] = useState(() => location.hash === '#/dashboard');
  useEffect(() => {
    const on = () => setDash(location.hash === '#/dashboard');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  if (location.hash.startsWith('#/render/')) return <RenderView />;
  return dash ? (
    <Suspense fallback={null}>
      <DashboardApp />
    </Suspense>
  ) : (
    <Presentation />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
