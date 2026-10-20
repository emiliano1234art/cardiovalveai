import { useState } from 'react';
import { DataBadge, type DataKind } from '../../components/layout/ControlBar';
import { EXPLAIN } from '../../content/explanations';
import { useDeck } from '../components/deck';
import { PlanPanel } from '../components/PlanPanel';
import { Explain, Screen } from '../components/screen';
import { Visual3D } from '../components/Visual3D';

const TODAY: { t: string; k: DataKind }[] = [
  { t: 'Modelo trivalva, ECG simulado y señales', k: 'synthetic' },
  { t: 'Laboratorio interactivo e IA experimental', k: 'implemented' },
  { t: 'Prototipo Ø70 mm con piezo, MEMS, ESP32 y servo', k: 'proposed' },
  { t: 'Medición de señales reales y línea basal', k: 'proposed' },
];
const FUTURE: { t: string; k: DataKind }[] = [
  { t: 'Sensores miniaturizados para investigación', k: 'future' },
  { t: 'Seguimiento integrado con la rehabilitación', k: 'future' },
  { t: 'Versión pasiva accionada por presión o flujo', k: 'proposed' },
];

export function S09Future() {
  const { print } = useDeck();
  const [plan, setPlan] = useState(false);
  return (
    <Screen
      num={9}
      kicker="Impacto y futuro"
      title="Impacto y futuro del proyecto"
      lead="Hoy, un prototipo experimental. En el futuro, posibles sistemas de monitoreo para investigación."
      actions={
        <>
          <Explain label="¿Qué es real hoy?" content={EXPLAIN.p_future} />
          <button className="v-btn sm" onClick={() => setPlan(true)}>
            Plan y próximos pasos
          </button>
        </>
      }
    >
      <div className="v-col" style={{ gap: 16, height: '100%' }}>
        <div className="v-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 20, flex: 1, minHeight: 0 }}>
          {[
            { title: 'Hoy', sub: 'Prototipo experimental trivalva', kind: 'university' as const, render: 'university-iso', list: TODAY, cam: 'iso' as const },
            { title: 'Visión futura', sub: 'Concepto de investigación · no desarrollado ni validado', kind: 'future' as const, render: 'future', list: FUTURE, cam: 'iso' as const },
          ].map((c) => (
            <div key={c.title} className={`v-panel v-future-card${c.kind === 'future' ? ' dashed' : ''}`}>
              <div className="v-row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="v-future-title">{c.title}</div>
                  <div className="v-tiny">{c.sub}</div>
                </div>
                <DataBadge kind={c.kind === 'future' ? 'future' : 'proposed'} />
              </div>
              <div className="v-viewer" style={{ height: 300 }}>
                <Visual3D kind={c.kind} render={c.render} alt={c.sub} camera={c.cam} showLabels={c.kind === 'future'} autoRotate={!print && c.kind === 'future'} />
              </div>
              <ul className="v-state-list">
                {c.list.map((x) => (
                  <li key={x.t}>
                    <DataBadge kind={x.k} />
                    {x.t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="v-closing">
          <b>ValveSense:</b> de las señales mecánicas a nuevas posibilidades de monitoreo cardiovascular.
        </div>
      </div>
      {plan && (
        <div className="v-overlay" role="dialog" aria-label="Plan y próximos pasos">
          <div className="v-overlay-card">
            <div className="v-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 26 }}>Plan, entrevista y próximos pasos</h3>
              <button className="v-btn sm" onClick={() => setPlan(false)} aria-label="Cerrar">
                ✕ Cerrar
              </button>
            </div>
            <PlanPanel />
          </div>
        </div>
      )}
    </Screen>
  );
}
