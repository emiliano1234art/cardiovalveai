import { MODES, MODE_ORDER } from '../../config/modes';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import { LIMITS, type SimParams } from '../../presentation/sim/model';
import type { ExperimentalMode } from '../../types/valvesense';

interface Props {
  snap: EngineSnapshot;
  onMode: (m: ExperimentalMode) => void;
  onBpm: (bpm: number) => void;
  onTiming: (patch: Partial<Pick<SimParams, 'delayMs' | 'openMs' | 'thetaMax'>>) => void;
  onRecalibrate: () => void;
}

/** Tipos de dato: cada panel declara de dónde vienen sus valores. */
export type DataKind = 'synthetic' | 'experimental' | 'future';
export const DATA_KIND: Record<DataKind, { label: string; title: string }> = {
  synthetic: { label: 'DATOS SINTÉTICOS', title: 'Generados en el navegador por el modelo de simulación' },
  experimental: { label: 'EXPERIMENTAL', title: 'Montaje de laboratorio a escala (ESP32 + sensores); aún sin datos registrados' },
  future: { label: 'CLÍNICO FUTURO', title: 'Uso clínico proyectado: requiere validación y aprobación regulatoria; no implementado' },
};

export function DataBadge({ kind }: { kind: DataKind }) {
  return (
    <span className={`data-badge ${kind}`} title={DATA_KIND[kind].title}>
      {DATA_KIND[kind].label}
    </span>
  );
}

function Slider({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="ctl-slider">
      <span className="ctl-slider-head">
        <span>{label}</span>
        <strong className="num">
          {value} {unit}
        </strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </label>
  );
}

export function ControlBar({ snap, onMode, onBpm, onTiming, onRecalibrate }: Props) {
  const isSim = snap.sourceKind === 'simulation';
  const capturing = snap.captureProgress !== null;
  const p = snap.params;
  return (
    <>
      <div className="controlbar">
        <div className="container controlbar-row">
          <span className="controlbar-label">Condición mecánica</span>
          <div className="modes" role="radiogroup" aria-label="Condición mecánica">
            {MODE_ORDER.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={snap.mode === m}
                className={`mode-btn${snap.mode === m && isSim ? ' active' : ''}`}
                onClick={() => onMode(m)}
                disabled={!isSim}
                title={MODES[m].description}
              >
                <span className="mode-name">{MODES[m].label}</span>
                <span className="mode-sub">{MODES[m].sub}</span>
              </button>
            ))}
          </div>
          <div className="controlbar-right">
            <span>
              Línea basal:{' '}
              <strong style={{ color: 'var(--text)' }}>
                {capturing
                  ? `capturando ${Math.round((snap.captureProgress ?? 0) * 100)} %`
                  : snap.baseline
                    ? `${snap.baseline.origin === 'simulated' ? 'calibrada' : 'capturada'} · ${snap.baseline.cycles} ciclos`
                    : '—'}
              </strong>
            </span>
            <button className="btn" onClick={onRecalibrate} disabled={capturing} title="Registrar una nueva línea basal con los próximos 30 ciclos">
              ↻ Recapturar basal
            </button>
          </div>
        </div>
        {isSim && (
          <div className="container controlbar-row ctl-sync">
            <span className="controlbar-label">Sincronización ECG</span>
            <Slider label="FC del ECG simulado" value={p.bpm} unit="lpm" min={LIMITS.bpm[0]} max={LIMITS.bpm[1]} step={1} onChange={onBpm} />
            <Slider label="Retardo τ (R → apertura)" value={p.delayMs} unit="ms" min={LIMITS.delayMs[0]} max={LIMITS.delayMs[1]} step={5} onChange={(v) => onTiming({ delayMs: v })} />
            <Slider label="Duración de apertura D" value={p.openMs} unit="ms" min={LIMITS.openMs[0]} max={LIMITS.openMs[1]} step={10} onChange={(v) => onTiming({ openMs: v })} />
            <Slider label="Ángulo máximo θ" value={p.thetaMax} unit="°" min={LIMITS.thetaMax[0]} max={LIMITS.thetaMax[1]} step={1} onChange={(v) => onTiming({ thetaMax: v })} />
            <div className="ctl-presets">
              <button className={`btn${p.bpm === 72 ? ' on' : ''}`} onClick={() => onBpm(72)} title="FC de reposo de la línea basal">
                Reposo · 72 lpm
              </button>
              <button className={`btn${p.bpm === 110 ? ' on' : ''}`} onClick={() => onBpm(110)} title="Variación de FC: la IA no debe marcarla como falla mecánica">
                ♥ Variación de FC · 110 lpm
              </button>
            </div>
          </div>
        )}
      </div>
      {isSim && (
        <div className="sim-banner">
          <b>SIMULACIÓN</b> ECG y señales sintéticas generadas en el navegador · Prototipo experimental a escala · No es un dispositivo médico ni
          entrega diagnósticos
        </div>
      )}
    </>
  );
}
