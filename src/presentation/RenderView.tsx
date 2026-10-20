import { useEffect, useState } from 'react';
import { Scene3D } from './three/Scene3D';
import type { CameraPreset, SceneKind } from './three/scenes';
import { sim } from './sim/store';
import type { Condition } from './sim/model';
import './styles/presentation.css';

/**
 * Vista de render (#/render/<tipo>?camera=iso&xray=1&exploded=0&labels=1&t=0.35&cond=normal&mech=1&open=0.5):
 * dibuja una escena 3D a pantalla completa en un instante fijo. La usa
 * `npm run renders` para generar las imágenes de alta calidad.
 */
export function RenderView() {
  const [hash] = useState(location.hash);
  const [kind, query] = hash.replace('#/render/', '').split('?');
  const q = new URLSearchParams(query ?? '');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    sim.setPlaying(false);
    const cond = q.get('cond') as Condition | null;
    if (cond) sim.setParams({ condition: cond });
    sim.seek(Number(q.get('t') ?? '3.35'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="v-root" data-ready={ready ? '1' : '0'} style={{ background: '#ffffff' }}>
      <div className="v-viewer" style={{ position: 'absolute', inset: 0, borderRadius: 0, border: 0, boxShadow: 'none' }}>
        <Scene3D
          kind={kind as SceneKind}
          camera={(q.get('camera') ?? 'iso') as CameraPreset}
          xray={q.get('xray') === '1'}
          exploded={q.get('exploded') === '1'}
          showLabels={q.get('labels') !== '0'}
          showMech={q.get('mech') === '1'}
          manualOpen={q.get('open') !== null ? Number(q.get('open')) : null}
          interactive={false}
          onReady={() => setTimeout(() => setReady(true), 900)}
        />
      </div>
    </div>
  );
}
