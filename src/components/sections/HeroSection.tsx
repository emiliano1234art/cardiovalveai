import { useCallback, useState } from 'react';
import { HOTSPOTS } from '../../content/hotspots';
import type { EngineSnapshot, ValveSenseEngine } from '../../engine/ValveSenseEngine';
import { fmt } from '../../lib/format';
import { VERDICT } from '../../lib/verdict';
import { rrOf, type PhaseName } from '../../presentation/sim/model';
import type { CameraPreset } from '../../presentation/three/scenes';
import { Scene3D } from '../../presentation/three/Scene3D';
import { GraphExplanation, InfoTooltip } from '../explain/GraphExplanation';
import { SensorHotspot } from '../explain/SensorHotspot';
import { DataBadge } from '../layout/ControlBar';
import { IconBrain, IconGear, IconHeart, IconLayers, IconSpark, IconTarget, IconValve, IconVibration } from '../ui/icons';

const PHASE: Record<PhaseName, { label: string; open: boolean }> = {
  cerrada: { label: 'Cerrada', open: false },
  apertura: { label: 'Abriendo', open: true },
  abierta: { label: 'Abierta', open: true },
  cierre: { label: 'Cerrando', open: true },
};

const VIEWS: { id: CameraPreset; label: string }[] = [
  { id: 'iso', label: 'Completo' },
  { id: 'hero', label: 'Válvula' },
  { id: 'top', label: 'Arriba' },
  { id: 'side', label: 'Lado' },
];

/** etiquetas cortas sobre el modelo; la frase va en la tarjeta */
const SPOTS = HOTSPOTS.map((h) => ({ ...h, text: h.name }));

interface Props {
  snap: EngineSnapshot;
  engine: ValveSenseEngine;
  onLearn: () => void;
}

/** Portada del dashboard: modelo 3D protagonista + 4 indicadores clave. */
export function HeroSection({ snap, engine, onLearn }: Props) {
  const [hot, setHot] = useState<string | null>(null);
  const [view, setView] = useState<CameraPreset>('iso');
  const [nonce, setNonce] = useState(0);
  const [xray, setXray] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [mechOn, setMechOn] = useState(false);
  const [sensors, setSensors] = useState(false);
  /** null = ciclo automático (sincronizado con el ECG); 0–1 = control manual */
  const [manual, setManual] = useState<number | null>(null);
  const isSim = snap.sourceKind === 'simulation';
  const live = snap.hasData;
  const h = HOTSPOTS.find((x) => x.id === hot) ?? null;
  const L = snap.latest;
  const ph = snap.valvePhase ? PHASE[snap.valvePhase] : null;
  const beat = snap.sinceBeat !== null && snap.sinceBeat < 0.18;
  const hasBaseline = snap.baseline !== null;
  const sim = L && hasBaseline ? L.assessment.similarity : null;
  const V = L && hasBaseline ? VERDICT[L.record.verdict] : null;

  // en simulación, el modelo 3D se mueve con el mismo reloj que las señales;
  // con datos reales queda quieto (es una representación, no una medición)
  const clock = useCallback(() => engine.modelTime() ?? 0.95 * rrOf(snap.params), [engine, snap.params]);

  const select = (id: string | null) => {
    setHot(id);
    if (id && exploded) setExploded(false);
  };
  const next = () => {
    const i = HOTSPOTS.findIndex((x) => x.id === hot);
    setHot(HOTSPOTS[(i + 1) % HOTSPOTS.length].id);
  };

  return (
    <section className="hero" id="sec-hero" aria-label="Válvula y resumen">
      <div className="hero-intro">
        <div>
          <h1>
            Escuchamos cómo funciona una <span>válvula aórtica de tres valvas</span>
          </h1>
          <p>Vibración, sonido, ECG e inteligencia artificial para estudiar cambios en su movimiento.</p>
        </div>
        <button type="button" className="btn primary lg" onClick={onLearn}>
          <IconSpark size={16} /> Aprender cómo funciona <span className="btn-note">1–2 min</span>
        </button>
      </div>

      <div className="hero-grid">
        <div className="card hero-3d" id="learn-valve">
          <div className="sig-head">
            <span className="sig-icon">
              <IconValve />
            </span>
            <div className="sig-titles">
              <h3>Nuestra válvula experimental</h3>
              <p>Toca los puntos para conocer cada pieza · gira con el dedo o el mouse</p>
            </div>
            <GraphExplanation id="valve3d" />
          </div>
          <div className="hero-tools">
            <div className="zoom" role="group" aria-label="Vista">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={view === v.id ? 'active' : ''}
                  aria-pressed={view === v.id}
                  onClick={() => {
                    setView(v.id);
                    setNonce((n) => n + 1);
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button type="button" className={`chip${xray ? ' on' : ''}`} aria-pressed={xray} onClick={() => setXray((v) => !v)}>
              <IconTarget size={14} /> Ver por dentro
            </button>
            <button type="button" className={`chip${exploded ? ' on' : ''}`} aria-pressed={exploded} onClick={() => setExploded((v) => !v)}>
              <IconLayers size={14} /> Separar piezas
            </button>
            <button type="button" className={`chip${mechOn ? ' on' : ''}`} aria-pressed={mechOn} onClick={() => setMechOn((v) => !v)} title="Servo → leva → anillo actuador → 3 bielas → 3 valvas">
              <IconGear size={14} /> Ver mecanismo
            </button>
            <button
              type="button"
              className={`chip${sensors ? ' on' : ''}`}
              aria-pressed={sensors}
              onClick={() => {
                setSensors((v) => !v);
                setHot(sensors ? null : 'piezo');
              }}
            >
              <IconVibration size={14} /> Ubicar sensores
            </button>
            <span style={{ flex: 1 }} />
            <DataBadge kind="proposed" label="DISEÑO PROPUESTO" title="Modelo del diseño: la integración física todavía no está construida" />
          </div>
          <div className="manual-row">
            <div className="zoom" role="group" aria-label="Movimiento">
              <button type="button" className={manual === null ? 'active' : ''} aria-pressed={manual === null} onClick={() => setManual(null)}>
                Ciclo automático
              </button>
              <button type="button" className={manual !== null ? 'active' : ''} aria-pressed={manual !== null} onClick={() => setManual((m) => m ?? 0)}>
                Abrir / cerrar a mano
              </button>
            </div>
            {manual !== null && (
              <label className="manual-slider">
                <span>Cerrada</span>
                <input type="range" min={0} max={1} step={0.01} value={manual} onChange={(e) => setManual(Number(e.target.value))} aria-label="Apertura de la válvula" />
                <span>Abierta</span>
              </label>
            )}
          </div>
          <div className="hero-scene vs-scene">
            <Scene3D
              kind="university"
              camera={view}
              cameraNonce={nonce}
              xray={xray}
              exploded={exploded}
              hotspots={sensors ? SPOTS.filter((x) => x.id === 'piezo' || x.id === 'mic') : SPOTS}
              activeHotspot={hot}
              onHotspot={select}
              selected={h?.group ?? null}
              onSelect={(cid) => select(cid ? (HOTSPOTS.find((x) => x.group === cid)?.id ?? null) : null)}
              clock={clock}
              manualOpen={manual}
              showMech={mechOn}
            />
            {!isSim && <div className="scene-note">Modelo de referencia · sin movimiento simulado con datos reales</div>}
            {h && <SensorHotspot h={h} onClose={() => setHot(null)} onNext={next} />}
          </div>
        </div>

        <div className="hero-kpis">
          <div className="kpi" id="learn-bpm">
            <div className="kpi-top">
              <span className={`kpi-icon heart${beat ? ' beat' : ''}`}>
                <IconHeart size={20} />
              </span>
              <span className="kpi-label">Latidos por minuto</span>
              <InfoTooltip id="bpm" />
            </div>
            <div className="kpi-value num">
              {live && snap.ecgBpm !== null ? Math.round(snap.ecgBpm) : '—'}
              <small>lpm</small>
            </div>
            <div className="kpi-foot">{!live ? 'Sin datos del prototipo' : snap.hasEcg ? (isSim ? 'ECG simulado' : 'ECG del prototipo') : 'Sin canal ECG'}</div>
          </div>

          <div className="kpi">
            <div className="kpi-top">
              <span className={`kpi-icon${ph?.open ? ' open' : ''}`}>
                <IconValve size={20} />
              </span>
              <span className="kpi-label">La válvula está…</span>
              <InfoTooltip id="valveState" />
            </div>
            <div className="kpi-value state" style={{ color: ph?.open ? 'var(--brand-2)' : 'var(--text)' }}>
              <span className={`lamp${ph?.open ? ' on' : ''}`} />
              {live && ph ? ph.label : '—'}
            </div>
            <div className="kpi-foot">{live ? `Se abre ${snap.params.delayMs} ms después de cada latido` : 'Sin datos del prototipo'}</div>
          </div>

          <div className="kpi" style={V ? { borderColor: V.color, background: V.bg } : undefined}>
            <div className="kpi-top">
              <span className="kpi-icon ai">
                <IconBrain size={20} />
              </span>
              <span className="kpi-label">Análisis inteligente</span>
              <InfoTooltip id="ai" />
            </div>
            <div className="kpi-value small" style={{ color: V?.color }}>
              {V ? `${V.icon} ${V.short}` : '—'}
            </div>
            <div className="kpi-foot">{V ? V.text : hasBaseline ? 'Esperando el primer ciclo…' : 'Falta registrar el patrón de referencia'}</div>
          </div>

          <div className="kpi">
            <div className="kpi-top">
              <span className="kpi-icon">
                <IconTarget size={20} />
              </span>
              <span className="kpi-label">Similitud con el patrón de referencia</span>
              <InfoTooltip id="similarity" />
            </div>
            <div className="kpi-sim">
              <div className="kpi-value num">
                {fmt(sim, 0)}
                <small>%</small>
              </div>
              <div className="meter" aria-hidden>
                <i style={{ width: `${Math.max(0, Math.min(100, sim ?? 0))}%` }} />
              </div>
            </div>
            <div className="kpi-foot">No es un indicador de riesgo clínico</div>
          </div>
        </div>
      </div>
    </section>
  );
}
