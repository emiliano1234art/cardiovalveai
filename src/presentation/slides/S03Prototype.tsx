import { useState } from 'react';
import { EXPLAIN } from '../../content/explanations';
import { Cite } from '../components/deck';
import { Explain, Screen } from '../components/screen';
import { Visual3D } from '../components/Visual3D';
import { COMPONENTS, type ComponentId } from '../three/components';
import type { CameraPreset } from '../three/scenes';

const STATUS: Record<string, { cls: string; label: string }> = {
  definido: { cls: 'now', label: 'Componente elegido · montaje propuesto' },
  propuesta: { cls: 'future', label: 'Propuesto' },
  'por definir': { cls: 'pending', label: 'Por definir' },
};

const VIEWS: { id: string; label: string; cam: CameraPreset; exploded?: boolean; mech?: boolean; xray?: boolean }[] = [
  { id: 'full', label: 'Vista completa', cam: 'iso' },
  { id: 'exploded', label: 'Vista explotada', cam: 'iso', exploded: true },
  { id: 'mech', label: 'Sistema de movimiento', cam: 'iso', mech: true },
  { id: 'inside', label: 'Ver por dentro', cam: 'iso', xray: true },
  { id: 'valve', label: 'Solo la válvula', cam: 'hero' },
];

/** Componentes que se muestran como accesos rápidos. */
const QUICK: ComponentId[] = ['valve', 'piezo', 'mic', 'actuator', 'esp32'];

export function S03Prototype() {
  const [view, setView] = useState(VIEWS[0]);
  const [nonce, setNonce] = useState(0);
  const [sel, setSel] = useState<ComponentId | null>('piezo');
  const [tech, setTech] = useState(false);
  const c = COMPONENTS.find((x) => x.id === sel);

  return (
    <Screen
      num={3}
      kicker="Nuestro prototipo"
      title="Nuestro prototipo ValveSense"
      lead="Una válvula de tres valvas a escala, con sensores para escuchar su funcionamiento."
      states={['proposed']}
      actions={<Explain label="¿Cómo se mueve?" content={EXPLAIN.p_proto_how} />}
    >
      <div className="v-grid" style={{ gridTemplateColumns: '1fr 430px', gap: 22, height: '100%' }}>
        <div className="v-col" style={{ gap: 12, minHeight: 0 }}>
          <div className="v-viewer" style={{ flex: 1, minHeight: 0 }}>
            <Visual3D
              kind="university"
              render={view.exploded ? 'university-exploded' : 'university-iso'}
              alt="Prototipo ValveSense: válvula trivalva con piezo, MEMS, servo y ESP32"
              camera={view.cam}
              cameraNonce={nonce}
              exploded={!!view.exploded}
              xray={!!view.xray}
              showMech={!!view.mech}
              selected={sel}
              onSelect={(id) => {
                setSel(id as ComponentId | null);
                setTech(false);
              }}
              showLabels
            />
            <div className="v-viewer-foot">
              <span className="v-hint">Toca una pieza · arrastra para girar</span>
              <span className="v-hint">Anillo Ø ≈ 70 mm · diseño propuesto, aún no construido</span>
            </div>
          </div>
          <div className="v-thumbs" role="group" aria-label="Vistas del prototipo">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                className={view.id === v.id ? 'active' : ''}
                onClick={() => {
                  setView(v);
                  setNonce((n) => n + 1);
                  if (v.mech) setSel('actuator');
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="v-col" style={{ gap: 14, minHeight: 0 }}>
          <div className="v-row" style={{ gap: 8 }}>
            {QUICK.map((id) => {
              const x = COMPONENTS.find((q) => q.id === id)!;
              return (
                <button key={id} className={`v-chip${sel === id ? ' active' : ''}`} style={{ height: 40, fontSize: 15.5 }} onClick={() => setSel(id)}>
                  {x.short}
                </button>
              );
            })}
          </div>
          {c ? (
            <div className="v-panel v-comp-card" key={c.id}>
              <div className="v-row" style={{ justifyContent: 'space-between' }}>
                <span className="v-comp-num">{c.num}</span>
                <span className={`v-tag ${STATUS[c.status].cls}`} style={{ height: 26, fontSize: 12 }}>
                  {STATUS[c.status].label}
                </span>
              </div>
              <h3>{c.name}</h3>
              <p className="v-comp-simple">{c.simple}</p>
              <button className="v-link" onClick={() => setTech((v) => !v)} aria-expanded={tech}>
                {tech ? 'Ocultar ficha técnica ▴' : 'Ver ficha técnica ▾'}
              </button>
              {tech && (
                <div className="v-comp-tech">
                  <p>{c.role}</p>
                  <p>
                    <b>Ubicación:</b> {c.location}
                  </p>
                  <p>
                    {c.spec}
                    {c.refId && <Cite ids={[c.refId]} />}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="v-panel v-comp-card">
              <p className="v-comp-simple">Selecciona una pieza en el modelo para ver qué hace.</p>
            </div>
          )}
          <div className="v-mini-chain">
            <span>Servo</span>→<span>Leva</span>→<span>Anillo actuador</span>→<span>3 bielas</span>→<span>3 valvas</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}
