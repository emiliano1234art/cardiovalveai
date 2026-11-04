import { lazy, Suspense, useState } from 'react';
import type { LiveSnapshot } from '../LiveEngine';
import { ValveTopView } from './ValveTopView';

// la vista 3D se descarga solo cuando se abre (pesa más)
const HeartView = lazy(() => import('./HeartView'));

interface Props {
  snap: LiveSnapshot;
  getAngle: () => number;
}

/** Tarjeta principal: la válvula trifoliada en dos vistas (desde arriba · dentro del corazón en 3D). */
export function ValveView({ snap, getAngle }: Props) {
  const [tab, setTab] = useState<'top' | 'mech'>('top');
  const incomplete = snap.mode === 'INCOMPLETA';

  return (
    <section className="lv-card lv-valve">
      <div className="lv-card-head">
        <div>
          <h2 className="lv-card-title">Tu válvula, en vivo</h2>
          <p className="lv-card-sub">
            {tab === 'top'
              ? 'Así se ve la válvula desde arriba: tiene 3 valvas que se abren y se cierran como la de tu prototipo.'
              : 'Así se abriría la válvula dentro del corazón, con la sangre pasando y los sensores detectando los imanes.'}
          </p>
        </div>
        <span className={`lv-chip ${incomplete ? 'crit' : 'ok'}`}>{incomplete ? 'Se abre incompleta' : 'Se abre normal'}</span>
      </div>

      <div className="lv-seg lv-view-tabs" role="tablist" aria-label="Vista de la válvula">
        <button role="tab" aria-selected={tab === 'top'} className={tab === 'top' ? 'active' : ''} onClick={() => setTab('top')}>
          Vista desde arriba
        </button>
        <button role="tab" aria-selected={tab === 'mech'} className={tab === 'mech' ? 'active' : ''} onClick={() => setTab('mech')}>
          Dentro del corazón (3D)
        </button>
      </div>

      {tab === 'top' ? (
        <ValveTopView snap={snap} getAngle={getAngle} />
      ) : (
        <Suspense fallback={<p className="lv-note">Cargando la vista 3D…</p>}>
          <HeartView snap={snap} getAngle={getAngle} />
        </Suspense>
      )}
    </section>
  );
}
