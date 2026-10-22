import { useEffect, useRef, useState } from 'react';
import { DataBadge } from '../../components/layout/ControlBar';
import { DRAWING_BEFORE } from '../content';
import { PX } from '../explain';
import { useDeck } from '../components/deck';
import { LiveSignals } from '../components/LiveSignals';
import { PersonEcgLink } from '../components/PersonEcgLink';
import { Explain, Screen } from '../components/screen';
import { Visual3D } from '../components/Visual3D';
import { sim, useSim } from '../sim/store';

type Mode = 'normal' | 'restricted';
type View = 'full' | 'sensors' | 'mech' | 'exploded';

const SENSORS = [
  { id: 'piezo', t: 'Piezo', d: 'vibración', c: 'var(--sig-vib)' },
  { id: 'mic', t: 'MEMS', d: 'sonido', c: 'var(--sig-snd)' },
  { id: 'esp32', t: 'ESP32', d: 'adquisición y envío', c: 'var(--text)' },
];

/** Apertura manual animada (0 = cerrada, 1 = abierta). */
function useManual() {
  const [value, setValue] = useState<number | null>(null);
  const raf = useRef(0);
  const animate = (to: number) => {
    cancelAnimationFrame(raf.current);
    const from = value ?? (to ? 0 : 1);
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 650);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setValue(from + (to - from) * e);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const release = () => {
    cancelAnimationFrame(raf.current);
    setValue(null);
  };
  return { value, animate, release };
}

export function D07Prototype() {
  const { print } = useDeck();
  const { params } = useSim();
  const [view, setView] = useState<View>('full');
  const [real, setReal] = useState(false);
  const [person, setPerson] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [nonce, setNonce] = useState(0);
  const manual = useManual();
  const mode: Mode = params.condition === 'restricted' ? 'restricted' : 'normal';
  const isOpen = manual.value !== null && manual.value > 0.5;

  // al salir, la simulación vuelve al funcionamiento normal
  useEffect(() => () => sim.setParams({ condition: 'normal' }), []);

  const setMode = (m: Mode) => {
    manual.release();
    sim.setParams({ condition: m, target: 0 });
  };
  const pick = (v: View) => {
    setReal(false);
    setPerson(false);
    setView(view === v ? 'full' : v);
    setNonce((n) => n + 1);
  };
  const selected = view === 'sensors' ? 'piezo,mic,esp32' : view === 'mech' ? 'actuator' : null;
  const render = real
    ? 'aortic-iso'
    : view === 'exploded'
      ? 'university-exploded'
      : view === 'mech'
        ? 'university-mech'
        : view === 'sensors'
          ? 'university-xray'
          : 'university-iso';

  return (
    <Screen
      num={7}
      kicker="Prototipo"
      title="Del dibujo al modelo 3D"
      actions={
        <>
          <Explain label="¿Cómo funciona?" content={PX.proto} />
          <Explain label="¿Válvula real?" content={PX.real} />
        </>
      }
    >
      <div className="v-grid" style={{ gridTemplateColumns: '290px minmax(0, 1fr)', gap: 22, height: '100%' }}>
        <div className="v-panel v-before">
          <div className="v-row" style={{ justifyContent: 'space-between' }}>
            <b className="v-before-label">Antes</b>
            <span className={`v-tag ${DRAWING_BEFORE ? 'done' : 'pending'}`}>Dibujo inicial</span>
          </div>
          <div className="v-before-img">
            {DRAWING_BEFORE ? (
              <button className="v-before-zoom" onClick={() => setZoom(true)} aria-label="Ampliar el dibujo inicial">
                <img
                  src={DRAWING_BEFORE}
                  alt="Dibujo inicial del prototipo, hecho a mano por el equipo: anillo con tres valvas, piezoeléctrico, micrófono, servo y ESP32"
                />
                <span className="v-hint">Toca para ampliar</span>
              </button>
            ) : (
              <div className="v-before-empty">
                <svg viewBox="0 0 100 100" width="90" height="90" aria-hidden>
                  <rect x="14" y="14" width="72" height="72" rx="8" fill="none" stroke="#94a3b8" strokeWidth="3" strokeDasharray="7 6" />
                  <path d="M30 66l14-18 10 12 8-8 10 14" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinejoin="round" />
                  <circle cx="64" cy="36" r="6" fill="#cbd5e1" />
                </svg>
                <span className="v-pending-text">[DIBUJO INICIAL PENDIENTE]</span>
                <span className="v-tiny">Agregar la foto del dibujo a mano en content.ts (DRAWING_BEFORE).</span>
              </div>
            )}
          </div>
          <div className="v-before-arrow">Después →</div>
        </div>

        <div className="v-col" style={{ gap: 12, minHeight: 0 }}>
          {person ? (
            <div className="v-panel v-person-panel">
              <div className="v-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <b className="v-person-title">Simulación en tiempo real con una persona</b>
                <DataBadge kind="proposed" />
              </div>
              <PersonEcgLink width={1110} live={!print} />
            </div>
          ) : (
            <div className={`v-viewer${!real && (view === 'sensors' || view === 'mech') ? ' v-only-active' : ''}`} style={{ flex: 1, minHeight: 0 }}>
              <Visual3D
                kind={real ? 'aortic' : 'university'}
                render={render}
                alt={
                  real ? 'Válvula aórtica natural' : 'Prototipo CardioVal AI: anillo, tres valvas, servo, leva, anillo actuador, bielas, piezo, MEMS y ESP32'
                }
                camera="iso"
                cameraNonce={nonce}
                manualOpen={manual.value}
                exploded={!real && view === 'exploded'}
                xray={!real && view === 'sensors'}
                showMech={!real && (view === 'mech' || view === 'full')}
                selected={real ? null : selected}
                showLabels={!real ? view !== 'full' : true}
              />
              <div className="v-viewer-top">
                {real ? <span className="v-tag sim">Válvula real · se abre por presión, sin motor</span> : <DataBadge kind="proposed" />}
                {!real && <span className="v-hint">Diseño conceptual · por construir y validar</span>}
              </div>
              <div className="v-viewer-foot">
                <span className="v-hint">Arrastra para girar</span>
                <span className="v-hint">{mode === 'restricted' ? 'Valva 1 limitada por un tope (40°)' : 'Tres valvas · un servo MG90S'}</span>
              </div>
            </div>
          )}
          <div className="v-ctrl-row" role="toolbar" aria-label="Controles del prototipo">
            <button className="v-btn sm" onClick={() => manual.animate(isOpen ? 0 : 1)}>
              {isOpen ? 'Cerrar' : 'Abrir'}
            </button>
            <button className={`v-btn sm${mode === 'normal' && manual.value === null ? ' primary' : ''}`} onClick={() => setMode('normal')}>
              Funcionamiento normal
            </button>
            <button className={`v-btn sm${mode === 'restricted' && manual.value === null ? ' alt-on' : ''}`} onClick={() => setMode('restricted')}>
              Apertura restringida
            </button>
            <span className="v-ctrl-sep" />
            <button
              className={`v-btn sm${view === 'sensors' && !real ? ' primary' : ''}`}
              onClick={() => pick('sensors')}
              aria-pressed={view === 'sensors' && !real}
            >
              Ver sensores
            </button>
            <button className={`v-btn sm${view === 'mech' && !real ? ' primary' : ''}`} onClick={() => pick('mech')} aria-pressed={view === 'mech' && !real}>
              Ver mecanismo
            </button>
            <button
              className={`v-btn sm${view === 'exploded' && !real ? ' primary' : ''}`}
              onClick={() => pick('exploded')}
              aria-pressed={view === 'exploded' && !real}
            >
              Vista explotada
            </button>
            <button
              className={`v-btn sm${real ? ' primary' : ''}`}
              onClick={() => {
                setPerson(false);
                setReal((r) => !r);
              }}
              aria-pressed={real}
            >
              {real ? 'Ver prototipo' : 'Válvula real'}
            </button>
            <button
              className={`v-btn sm${person ? ' primary' : ''}`}
              onClick={() => {
                setReal(false);
                setView('full');
                setPerson((v) => !v);
              }}
              aria-pressed={person}
            >
              {person ? 'Ver prototipo 3D' : 'Persona + ECG'}
            </button>
          </div>
          {!person && (
            <div className="v-sensor-strip">
              <div className="v-sensor-chips">
                {SENSORS.map((s) => (
                  <div key={s.id} className="v-sensor-chip">
                    <i style={{ background: s.c }} />
                    <b>{s.t}</b> = {s.d}
                  </div>
                ))}
              </div>
              <div className="v-sensor-live">{!print && <LiveSignals width={770} height={108} windowS={2.2} />}</div>
            </div>
          )}
        </div>
      </div>
      {zoom && DRAWING_BEFORE && (
        <div className="v-overlay" role="dialog" aria-label="Dibujo inicial del prototipo" onClick={() => setZoom(false)}>
          <div className="v-before-big">
            <img src={DRAWING_BEFORE} alt="Dibujo inicial del prototipo, hecho a mano por el equipo" />
            <button className="v-btn sm" onClick={() => setZoom(false)}>
              ✕ Cerrar
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}
