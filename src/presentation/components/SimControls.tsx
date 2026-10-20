import { useEffect, useRef } from 'react';
import { CONDITIONS, effectiveOpen, LEAFLETS, leafletState, LIMITS, phaseName, rrOf, type Condition, type PhaseName } from '../sim/model';
import { sim, useSim } from '../sim/store';

export function ConditionChips({ compact = false, only }: { compact?: boolean; only?: Condition[] }) {
  const { params } = useSim();
  return (
    <div className="v-row" style={{ gap: 8 }} role="radiogroup" aria-label="Condición mecánica">
      {CONDITIONS.filter((c) => !only || only.includes(c.id)).map((c) => (
        <button
          key={c.id}
          role="radio"
          aria-checked={params.condition === c.id}
          className={`v-chip${params.condition === c.id ? ' active' : ''}${c.id !== 'normal' ? ' alt' : ''}`}
          onClick={() => sim.setParams({ condition: c.id })}
          title={c.detail}
          style={compact ? { height: 40, fontSize: 15, padding: '0 12px' } : undefined}
        >
          {c.short}
        </button>
      ))}
    </div>
  );
}

export function PlaybackButtons({ small = false }: { small?: boolean }) {
  const s = useSim();
  return (
    <div className="v-row" style={{ gap: 8 }}>
      <button className="v-btn sm" onClick={() => sim.toggle()} aria-label={s.playing ? 'Pausar' : 'Reproducir'}>
        {s.playing ? '❚❚ Pausar' : '▶ Reproducir'}
      </button>
      <button className="v-btn sm" onClick={() => sim.reset()} aria-label="Reiniciar">
        ↺{small ? '' : ' Reiniciar'}
      </button>
      <button className="v-btn sm" aria-pressed={s.speed < 1} onClick={() => sim.setSpeed(s.speed < 1 ? 1 : 0.25)} title="Cámara lenta ×¼">
        🐢{small ? '' : ' Lenta ×¼'}
      </button>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  unit,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="v-slider">
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>
        {value} {unit}
      </output>
    </label>
  );
}

export function ParamSliders({ timing = true, angle = true }: { timing?: boolean; angle?: boolean }) {
  const { params } = useSim();
  const RR = rrOf(params);
  const eff = effectiveOpen(params);
  return (
    <div className="v-col" style={{ gap: 4 }}>
      <Slider label="FC (ECG)" min={LIMITS.bpm[0]} max={LIMITS.bpm[1]} step={1} value={params.bpm} unit="lpm" onChange={(bpm) => sim.setParams({ bpm })} />
      {timing && (
        <>
          <Slider
            label="Retardo τ"
            min={LIMITS.delayMs[0]}
            max={LIMITS.delayMs[1]}
            step={5}
            value={params.delayMs}
            unit="ms"
            onChange={(delayMs) => sim.setParams({ delayMs })}
          />
          <Slider
            label="Apertura D"
            min={LIMITS.openMs[0]}
            max={LIMITS.openMs[1]}
            step={10}
            value={params.openMs}
            unit="ms"
            onChange={(openMs) => sim.setParams({ openMs })}
          />
        </>
      )}
      {angle && (
        <Slider
          label="Ángulo máx."
          min={LIMITS.thetaMax[0]}
          max={LIMITS.thetaMax[1]}
          step={1}
          value={params.thetaMax}
          unit="°"
          onChange={(thetaMax) => sim.setParams({ thetaMax })}
        />
      )}
      <div className="v-tiny">
        RR = 60/FC = {RR.toFixed(3).replace('.', ',')} s
        {eff.truncated && (
          <span className="v-coral"> · apertura acortada a {(eff.dOpen * 1000).toFixed(0)} ms para completar el ciclo antes del siguiente latido</span>
        )}
      </div>
    </div>
  );
}

const PHASE_ORDER: PhaseName[] = ['apertura', 'abierta', 'cierre', 'cerrada'];

/** Indicador de fase + ángulos de las dos valvas, sincronizado por cuadro. */
export function PhaseReadout({ showAngles = true }: { showAngles?: boolean }) {
  const spans = useRef<(HTMLSpanElement | null)[]>([]);
  const angles = useRef<(HTMLElement | null)[]>([]);
  useEffect(
    () =>
      sim.onFrame((t) => {
        const p = sim.state.params;
        const ph = phaseName(t, p);
        PHASE_ORDER.forEach((n, i) => spans.current[i]?.classList.toggle('on', n === ph));
        [0, 1].forEach((i) => {
          const el = angles.current[i];
          if (el) el.textContent = `${leafletState(t, p, i).theta.toFixed(0)}°`;
        });
      }),
    [],
  );
  return (
    <div className="v-col v-readout" style={{ gap: 8 }}>
      <div className="v-phase" aria-label="Fase del ciclo">
        {PHASE_ORDER.map((n, i) => (
          <span
            key={n}
            ref={(el) => {
              spans.current[i] = el;
            }}
          >
            {n[0].toUpperCase() + n.slice(1)}
          </span>
        ))}
      </div>
      {showAngles && (
        <div className="v-row" style={{ gap: 16, fontSize: 16 }}>
          {LEAFLETS.map((l, i) => (
            <span key={l} className="v-num">
              <span className="v-tiny">θ {l.toLowerCase()} </span>
              <b
                ref={(el) => {
                  angles.current[i] = el;
                }}
                style={{ fontSize: 20 }}
              >
                0°
              </b>
            </span>
          ))}
          <span className="v-tiny" title="La relación entre el ángulo del servo y el de las valvas depende de la transmisión">
            θ servo ≠ θ valva (requiere calibración)
          </span>
        </div>
      )}
    </div>
  );
}
