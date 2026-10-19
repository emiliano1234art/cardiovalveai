import { useEffect, useRef } from 'react';
import { CONDITIONS, LEAFLETS, leafletProfiles, leafletState, period, phaseName, type PhaseName } from '../sim/model';
import { sim, useSim } from '../sim/store';

export function ConditionChips({ compact = false }: { compact?: boolean }) {
  const { params } = useSim();
  return (
    <div className="v-row" style={{ gap: 8 }} role="radiogroup" aria-label="Condición experimental">
      {CONDITIONS.map((c, i) => (
        <button
          key={c.id}
          role="radio"
          aria-checked={params.condition === c.id}
          className={`v-chip${params.condition === c.id ? ' active' : ''}${c.id !== 'normal' ? ' alt' : ''}`}
          onClick={() => sim.setParams({ condition: c.id })}
          title={c.detail}
          style={compact ? { height: 40, fontSize: 15, padding: '0 12px' } : undefined}
        >
          {i + 1}. {c.short}
        </button>
      ))}
    </div>
  );
}

export function PlaybackButtons() {
  const s = useSim();
  return (
    <div className="v-row" style={{ gap: 8 }}>
      <button className="v-btn sm" onClick={() => sim.toggle()} aria-label={s.playing ? 'Pausar' : 'Reproducir'}>
        {s.playing ? '❚❚ Pausar' : '▶ Reproducir'}
      </button>
      <button className="v-btn sm" onClick={() => sim.reset()} aria-label="Reiniciar">
        ↺ Reiniciar
      </button>
      <button className="v-btn sm" aria-pressed={s.speed < 1} onClick={() => sim.setSpeed(s.speed < 1 ? 1 : 0.25)}>
        🐢 Cámara lenta ×¼
      </button>
    </div>
  );
}

export function ParamSliders() {
  const { params } = useSim();
  const T = period(params);
  return (
    <div className="v-col" style={{ gap: 6 }}>
      <label className="v-slider">
        Frecuencia
        <input type="range" min={30} max={120} step={2} value={params.cpm} onChange={(e) => sim.setParams({ cpm: Number(e.target.value) })} />
        <output>{params.cpm} cpm</output>
      </label>
      <label className="v-slider">
        Apertura máx.
        <input type="range" min={20} max={85} step={1} value={params.thetaMax} onChange={(e) => sim.setParams({ thetaMax: Number(e.target.value) })} />
        <output>{params.thetaMax}°</output>
      </label>
      <div className="v-tiny">
        T = 60 / {params.cpm} = {T.toFixed(3).replace('.', ',')} s · f = {(1 / T).toFixed(2).replace('.', ',')} Hz · 80° es la apertura normal inicial (editable)
      </div>
    </div>
  );
}

const PHASE_ORDER: PhaseName[] = ['apertura', 'abierta', 'cierre', 'cerrada'];

/** Indicador de fase + ángulos de las tres valvas, sincronizado por cuadro. */
export function PhaseReadout({ showAngles = true }: { showAngles?: boolean }) {
  const spans = useRef<(HTMLSpanElement | null)[]>([]);
  const angles = useRef<(HTMLElement | null)[]>([]);
  useEffect(
    () =>
      sim.onFrame((t) => {
        const p = sim.state.params;
        const ph = phaseName(t, p);
        PHASE_ORDER.forEach((n, i) => spans.current[i]?.classList.toggle('on', n === ph));
        leafletProfiles(p).forEach((lp, i) => {
          const el = angles.current[i];
          if (el) el.textContent = `${leafletState(t, p, lp).theta.toFixed(0)}°`;
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
            θ servo: requiere calibración
          </span>
        </div>
      )}
    </div>
  );
}
