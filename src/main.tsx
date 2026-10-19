import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Panel } from './presentation/Panel';
import { Presentation } from './presentation/Presentation';
import { RenderView } from './presentation/RenderView';

/** Dashboard de señales en #/dashboard; presentación en formato dashboard en #/panel. */
const DashboardApp = lazy(() => import('./App'));

function Root() {
  const view = () => (location.hash === '#/dashboard' ? 'dash' : location.hash.startsWith('#/panel') ? 'panel' : 'slides');
  const [mode, setMode] = useState(view);
  useEffect(() => {
    const on = () => setMode(view());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  if (location.hash.startsWith('#/render/')) return <RenderView />;
  if (mode === 'panel') return <Panel />;
  return mode === 'dash' ? (
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
