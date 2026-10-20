import { useState } from 'react';
import { MODES, MODE_ORDER } from '../../config/modes';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import { LIMITS, type SimParams } from '../../presentation/sim/model';
import type { ExperimentalMode } from '../../types/valvesense';
import { InfoTooltip } from '../explain/GraphExplanation';
import { IconGear, IconHeart, IconPulse } from '../ui/icons';

interface Props {
  snap: EngineSnapshot;
  onMode: (m: ExperimentalMode) => void;
  onBpm: (bpm: number) => void;
  onTiming: (patch: Partial<Pick<SimParams, 'delayMs' | 'openMs' | 'thetaMax'>>) => void;
  onRecalibrate: () => void;
}

/** Origen de los datos: siempre visible y fácil de distinguir. */
export type DataKind = 'synthetic' | 'experimental' | 'future';
export const DATA_KIND: Record<DataKind, { label: string; title: string }> = {
  synthetic: { label: 'SIMULACIÓN', title: 'Datos generados para mostrar cómo funcionaría el sistema' },
  experimental: { label: 'EXPERIMENTO', title: 'Datos obtenidos de los sensores conectados al prototipo' },
  future: { label: 'VISIÓN FUTURA', title: 'Posible aplicación clínica todavía no desarrollada ni validada' },
};

export function DataBadge({ kind, label, title }: { kind: DataKind; label?: string; title?: string }) {
  return (
    <span className={`data-badge ${kind}`} title={title ?? DATA_KIND[kind].title}>
      <i aria-hidden />
      {label ?? DATA_KIND[kind].label}
    </span>
  );
}

function Slider({ label, value, unit, min, max, step, onChange }: { label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="ctl-slider">
      <span className="ctl-slider-head">
        <span>{label}</span>
        <strong className="num">
          {value} {unit}
        </strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </label>
  );
}

const MODE_DOT: Record<ExperimentalMode, string> = { normal: 'var(--ok)', restricted: 'var(--warn)', incomplete: 'var(--crit)', irregular: '#7a4fc0' };

export function ControlBar({ snap, onMode, onBpm, onTiming, onRecalibrate }: Props) {
  const [adv, setAdv] = useState(false);
  const isSim = snap.sourceKind === 'simulation';
  const capturing = snap.captureProgress !== null;
  const p = snap.params;
  const baseline = capturing
    ? `registrando ${Math.round((snap.captureProgress ?? 0) * 100)} %`
    : snap.baseline
      ? `${snap.baseline.origin === 'simulated' ? 'simulado' : 'registrado'} · ${snap.baseline.cycles} ciclos`
      : 'sin registrar';

  return (
    <>
      <div className="controlbar">
        <div className="container controlbar-row">
          {isSim && (
            <>
              <div className="ctl-group">
                <span className="controlbar-label">Prueba una condición</span>
                <div className="modes" role="radiogroup" aria-label="Condición de la válvula">
                  {MODE_ORDER.map((m) => (
                    <button key={m} role="radio" aria-checked={snap.mode === m} className={`mode-btn${snap.mode === m ? ' active' : ''}`} onClick={() => onMode(m)} title={MODES[m].description}>
                      <span className="mode-name">
                        <i style={{ background: MODE_DOT[m] }} aria-hidden />
                        {MODES[m].label}
                      </span>
                      <span className="mode-sub">{MODES[m].sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="ctl-group">
                <span className="controlbar-label">Ritmo del corazón</span>
                <div className="ctl-rhythm">
                  <button type="button" className={`chip${p.bpm === 72 ? ' on' : ''}`} onClick={() => onBpm(72)} aria-pressed={p.bpm === 72}>
                    <IconHeart size={14} /> Reposo · 72
                  </button>
                  <button type="button" className={`chip${p.bpm === 110 ? ' on' : ''}`} onClick={() => onBpm(110)} aria-pressed={p.bpm === 110} title="La IA no debe marcarlo como falla">
                    <IconPulse size={14} /> Ejercicio · 110
                  </button>
                  <Slider label="Latidos por minuto" value={p.bpm} unit="lpm" min={LIMITS.bpm[0]} max={LIMITS.bpm[1]} step={1} onChange={onBpm} />
                </div>
              </div>
            </>
          )}
          <button type="button" className={`chip ctl-adv${adv ? ' on' : ''}`} onClick={() => setAdv((v) => !v)} aria-expanded={adv}>
            <IconGear size={14} /> Ajustes avanzados
          </button>
        </div>
        {adv && (
          <div className="container controlbar-row ctl-sync">
            {isSim && (
              <>
                <Slider label="Espera tras el latido (τ)" value={p.delayMs} unit="ms" min={LIMITS.delayMs[0]} max={LIMITS.delayMs[1]} step={5} onChange={(v) => onTiming({ delayMs: v })} />
                <Slider label="Tiempo abierta (D)" value={p.openMs} unit="ms" min={LIMITS.openMs[0]} max={LIMITS.openMs[1]} step={10} onChange={(v) => onTiming({ openMs: v })} />
                <Slider label="Apertura máxima (θ)" value={p.thetaMax} unit="°" min={LIMITS.thetaMax[0]} max={LIMITS.thetaMax[1]} step={1} onChange={(v) => onTiming({ thetaMax: v })} />
              </>
            )}
            <div className="ctl-baseline">
              <span>
                Patrón de referencia: <strong>{baseline}</strong>
              </span>
              <button className="btn sm" onClick={onRecalibrate} disabled={capturing || (!isSim && !snap.hasData)} title="Registrar un nuevo patrón con los próximos 30 ciclos">
                ↻ Registrar de nuevo
              </button>
            </div>
          </div>
        )}
      </div>
      <div className={`source-banner ${isSim ? 'sim' : 'exp'}`}>
        <DataBadge kind={isSim ? 'synthetic' : 'experimental'} />
        <span>
          {isSim
            ? 'Datos generados para mostrar cómo funcionaría el sistema · no es un dispositivo médico'
            : snap.hasData
              ? 'Datos de los sensores conectados al prototipo'
              : 'Esperando datos del ESP32 · no se muestran valores simulados'}
        </span>
        <InfoTooltip id="kinds" />
      </div>
    </>
  );
}
