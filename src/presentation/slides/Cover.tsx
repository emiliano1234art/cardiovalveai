import { useCallback } from 'react';
import { META } from '../content';
import { Field, useDeck } from '../components/deck';
import { Visual3D } from '../components/Visual3D';
import { sim } from '../sim/store';

export function Cover() {
  const { goTo } = useDeck();
  // ciclo lento (≈ 1/3 de la velocidad real) para la portada
  const slow = useCallback(() => sim.t * 0.35, []);
  return (
    <div className="v-slide v-cover">
      <div className="v-cover-text">
        <div className="v-kicker">{META.team} · Proyecto Interdisciplinario</div>
        <h1 className="v-cover-title">
          VALVE<span>SENSE</span>
        </h1>
        <p className="v-cover-sub">Escuchamos el funcionamiento de una válvula para comprender sus cambios.</p>
        <div className="v-row" style={{ gap: 12, marginTop: 30 }}>
          <button className="v-btn primary v-btn-lg" onClick={() => goTo('s1')}>
            Explorar proyecto →
          </button>
          <a className="v-btn v-btn-lg" href="#/dashboard" style={{ textDecoration: 'none' }}>
            Laboratorio interactivo
          </a>
        </div>
        <div className="v-cover-meta">
          <div>
            <b>{META.careers.join(' + ')}</b> · {META.institution} · {META.date}
          </div>
          <div className="v-row" style={{ gap: 18, marginTop: 8 }}>
            {META.members.map((m, i) => (
              <span key={i} style={{ fontSize: 17 }}>
                <Field value={m.name} />
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="v-cover-visual">
        <div className="v-viewer" style={{ height: '100%' }}>
          <Visual3D kind="aortic" render="aortic-iso" alt="Válvula aórtica trivalva" camera="iso" showLabels={false} autoRotate clock={slow} />
          <div className="v-viewer-foot">
            <span className="v-hint">Válvula aórtica · tres valvas · animación 3D</span>
          </div>
        </div>
      </div>
    </div>
  );
}
