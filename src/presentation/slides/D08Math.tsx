import { useEffect, useMemo, useState } from 'react';
import { PX } from '../explain';
import { useDeck } from '../components/deck';
import { PhaseCursor, Plot, pathFrom } from '../components/Plot';
import { Explain, Screen } from '../components/screen';
import { Tex } from '../components/Tex';
import {
  DEFAULT_PARAMS,
  integralSquare,
  LIMITS,
  leafletBeat,
  leafletState,
  RAMP_CLOSE,
  RAMP_OPEN,
  rPeak,
  rrOf,
  sampleEcg,
  sampleSignals,
  type SimParams,
} from '../sim/model';
import { sim, useSim } from '../sim/store';

type Tab = 'mov' | 'vib' | 'lat';
const TABS: { id: Tab; t: string }[] = [
  { id: 'mov', t: 'Movimiento' },
  { id: 'vib', t: 'Vibración' },
  { id: 'lat', t: 'Latido' },
];
const BEAT = 3;
const GW = 900;
const ms = (v: number) => `${Math.round(v * 1000)} ms`;
const dec = (v: number, n = 2) => v.toFixed(n).replace('.', ',');

/** θ(t) y ω(t) de la valva 1 durante un latido (desde el pico R). */
function useBeatMotion(p: SimParams) {
  return useMemo(() => {
    const r0 = rPeak(BEAT, p);
    const T = rPeak(BEAT + 1, p) - r0;
    const n = 400;
    const t = new Float64Array(n);
    const th = new Float64Array(n);
    const om = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      t[i] = (i / (n - 1)) * T;
      const s = leafletState(r0 + t[i], p, 0);
      th[i] = s.theta;
      om[i] = s.omega;
    }
    const lb = leafletBeat(p, 0, BEAT);
    return { T, t, th, om, ta: lb.start, tc: lb.start + lb.dOpen + RAMP_CLOSE, lb };
  }, [p]);
}

function Movement({ p, live }: { p: SimParams; live: boolean }) {
  const m = useBeatMotion(p);
  const wMax = (((m.lb.max - m.lb.min) * Math.PI) / (2 * RAMP_OPEN)) * 1.1;
  const marks = [
    { t: m.ta, l: 't_a' },
    { t: m.ta + RAMP_OPEN, l: '' },
    { t: m.tc, l: 't_c' },
  ];
  return (
    <div className="v-col" style={{ gap: 4 }}>
      <Plot width={GW} height={250} x={[0, m.T]} y={[0, 90]} yTicks={[0, 40, 80]} yLabel="θ [°]" yFmt={(v) => `${v}°`}>
        {(s) => (
          <>
            <rect x={s.sx(m.ta)} y={s.y0} width={s.sx(m.tc) - s.sx(m.ta)} height={s.h} fill="var(--cyan-soft)" />
            {marks
              .filter((k) => k.l)
              .map((k) => (
                <g key={k.l}>
                  <line x1={s.sx(k.t)} x2={s.sx(k.t)} y1={s.y0} y2={s.y0 + s.h} stroke="var(--amber)" strokeDasharray="4 4" strokeWidth={1.5} />
                  <circle cx={s.sx(k.t)} cy={s.sy(m.lb.min)} r={6} fill="#fff" stroke="var(--amber)" strokeWidth={2.5} />
                  <text x={s.sx(k.t) + 8} y={s.y0 + 18} style={{ fill: 'var(--amber)', fontWeight: 700, fontStyle: 'italic' }}>
                    {k.l}
                  </text>
                </g>
              ))}
            <path d={pathFrom(m.t, m.th, s.sx, s.sy)} fill="none" stroke="var(--cyan)" strokeWidth={3} />
            <PhaseCursor s={s} T={rrOf(p)} show={live} />
          </>
        )}
      </Plot>
      <Plot
        width={GW}
        height={200}
        x={[0, m.T]}
        y={[-wMax * 1.25, wMax]}
        yTicks={[0]}
        yLabel="ω = dθ/dt"
        xTicks={[0, 0.2, 0.4, 0.6, 0.8].filter((v) => v < m.T)}
        xFmt={ms}
        xLabel="tiempo desde el pico R"
      >
        {(s) => (
          <>
            <path d={pathFrom(m.t, m.om, s.sx, s.sy)} fill="none" stroke="var(--teal)" strokeWidth={2.5} />
            <PhaseCursor s={s} T={rrOf(p)} show={live} />
          </>
        )}
      </Plot>
    </div>
  );
}

function Vibration({ p, cmp, setCmp }: { p: SimParams; cmp: boolean; setCmp: (v: boolean) => void }) {
  const q: SimParams = cmp ? { ...p, condition: 'restricted', target: 0 } : { ...p, condition: 'normal' };
  const d = useMemo(() => {
    const r0 = rPeak(BEAT, q);
    const T = rPeak(BEAT + 1, q) - r0;
    const fs = 4000;
    const s = sampleSignals(r0, r0 + T, q, fs);
    const t = Array.from(s.t, (v) => v - r0);
    const x2 = Array.from(s.vib, (v) => v * v);
    const cum = new Float64Array(x2.length);
    for (let i = 1; i < x2.length; i++) cum[i] = cum[i - 1] + (x2[i] + x2[i - 1]) / 2 / fs;
    return { T, t, x: s.vib, x2, cum, E: integralSquare(s.vib, fs) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.condition, q.bpm, q.delayMs, q.openMs, q.thetaMax]);
  const peak = Math.max(...d.x2) * 1.1;
  return (
    <div className="v-col" style={{ gap: 4 }}>
      <Plot width={GW} height={220} x={[0, d.T]} y={[-1, 1]} yTicks={[-0.8, 0, 0.8]} yFmt={(v) => dec(v, 1)} yLabel="x(t) [V]">
        {(s) => <path d={pathFrom(d.t, d.x, s.sx, s.sy)} fill="none" stroke="var(--sig-vib)" strokeWidth={1.4} />}
      </Plot>
      <Plot
        width={GW}
        height={230}
        x={[0, d.T]}
        y={[0, peak]}
        yTicks={[0]}
        yLabel="x²(t)"
        xTicks={[0, 0.2, 0.4, 0.6, 0.8].filter((v) => v < d.T)}
        xFmt={ms}
        xLabel="tiempo desde el pico R"
      >
        {(s) => (
          <>
            <path
              d={`${pathFrom(d.t, d.x2, s.sx, s.sy)}L${s.sx(d.T)} ${s.sy(0)}L${s.sx(0)} ${s.sy(0)}Z`}
              fill="rgba(8,145,178,.25)"
              stroke="var(--sig-vib)"
              strokeWidth={1.2}
            />
            <path
              d={pathFrom(
                d.t,
                Array.from(d.cum, (v) => (v / d.E) * peak * 0.92),
                s.sx,
                s.sy,
              )}
              fill="none"
              stroke="var(--amber)"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            <text x={s.sx(d.T) - 8} y={s.sy(peak * 0.92) + 22} textAnchor="end" style={{ fill: 'var(--amber)', fontWeight: 700 }}>
              E acumulada
            </text>
          </>
        )}
      </Plot>
      <div className="v-row" style={{ gap: 12, marginLeft: 70 }}>
        <div className="v-seg" role="radiogroup" aria-label="Condición">
          <button className={!cmp ? 'active' : ''} onClick={() => setCmp(false)} role="radio" aria-checked={!cmp}>
            Normal
          </button>
          <button className={cmp ? 'active' : ''} onClick={() => setCmp(true)} role="radio" aria-checked={cmp}>
            Apertura restringida
          </button>
        </div>
        <span className="v-math-value">
          E = <b>{dec(d.E * 1000, 2)}</b> × 10⁻³ V²·s
        </span>
      </div>
    </div>
  );
}

function Beat({ p, live }: { p: SimParams; live: boolean }) {
  const d = useMemo(() => {
    const r0 = rPeak(BEAT, p);
    const r1 = rPeak(BEAT + 1, p);
    const r2 = rPeak(BEAT + 2, p);
    const t0 = r0 - 0.2;
    const t1 = r2 + 0.15;
    const e = sampleEcg(t0, t1, p, 500);
    const n = 500;
    const tt = new Float64Array(n);
    const th = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      tt[i] = t0 + ((t1 - t0) * i) / (n - 1);
      th[i] = leafletState(tt[i], p, 0).theta;
    }
    return { r0, r1, r2, t0, t1, e, tt, th, RR: r1 - r0 };
  }, [p]);
  const tau = p.delayMs / 1000;
  const xt = (k: number) => d.t0 + k;
  return (
    <div className="v-col" style={{ gap: 4 }}>
      <Plot width={GW} height={250} x={[d.t0, d.t1]} y={[-0.5, 1.75]} yTicks={[0, 1]} yLabel="ECG [mV]">
        {(s) => (
          <>
            <path d={pathFrom(d.e.t, d.e.v, s.sx, s.sy)} fill="none" stroke="var(--sig-ecg)" strokeWidth={2} />
            {[d.r0, d.r1, d.r2].map((r) => (
              <text key={r} x={s.sx(r)} y={s.sy(1.25)} textAnchor="middle" style={{ fill: 'var(--sig-ecg)', fontWeight: 800 }}>
                R
              </text>
            ))}
            <line
              x1={s.sx(d.r0)}
              x2={s.sx(d.r1)}
              y1={s.sy(1.5)}
              y2={s.sy(1.5)}
              stroke="var(--text)"
              strokeWidth={1.5}
              markerStart="url(#arr)"
              markerEnd="url(#arr)"
            />
            <text x={(s.sx(d.r0) + s.sx(d.r1)) / 2} y={s.sy(1.5) - 8} textAnchor="middle" style={{ fontWeight: 700 }}>
              RR = {dec(d.RR, 3)} s
            </text>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="var(--text)" />
              </marker>
            </defs>
          </>
        )}
      </Plot>
      <Plot
        width={GW}
        height={200}
        x={[d.t0, d.t1]}
        y={[0, 90]}
        yTicks={[0, 80]}
        yFmt={(v) => `${v}°`}
        yLabel="θ [°]"
        xTicks={[0.2, 0.6, 1, 1.4, 1.8, 2.2, 2.6].map(xt).filter((v) => v < d.t1)}
        xFmt={(v) => `${dec(v - d.t0, 1)} s`}
      >
        {(s) => (
          <>
            {[d.r0, d.r1].map((r) => (
              <g key={r}>
                <line x1={s.sx(r)} x2={s.sx(r)} y1={s.y0} y2={s.y0 + s.h} stroke="var(--sig-ecg)" strokeDasharray="3 4" />
                <rect x={s.sx(r)} y={s.y0 + 4} width={s.sx(r + tau) - s.sx(r)} height={20} rx={4} fill="var(--amber-soft)" stroke="var(--amber)" />
                <text x={(s.sx(r) + s.sx(r + tau)) / 2} y={s.y0 + 19} textAnchor="middle" style={{ fill: 'var(--amber)', fontWeight: 800, fontSize: 14 }}>
                  τ
                </text>
              </g>
            ))}
            <path d={pathFrom(d.tt, d.th, s.sx, s.sy)} fill="none" stroke="var(--cyan)" strokeWidth={2.5} />
            <PhaseCursor s={s} T={rrOf(p)} offset={BEAT * rrOf(p)} show={live} />
          </>
        )}
      </Plot>
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

const TEXT: Record<Tab, { eq: string[]; s: string[] }> = {
  mov: {
    eq: [
      '\\theta(t)=\\theta_{\\min}+\\Delta\\theta\\,\\dfrac{1-\\cos(\\pi u)}{2},\\quad u=\\dfrac{t-t_a}{T_{ap}}',
      '\\omega(t)=\\dfrac{d\\theta}{dt}=\\dfrac{\\pi\\,\\Delta\\theta}{2\\,T_{ap}}\\sin(\\pi u)',
      '\\lim_{t\\to t_a^-}\\theta(t)=\\lim_{t\\to t_a^+}\\theta(t)=\\theta_{\\min}',
    ],
    s: [
      'La derivada de θ(t) es la velocidad angular de la valva: es máxima a mitad de la apertura y nula cuando está quieta.',
      'Los límites laterales coinciden en la apertura (tₐ) y en el cierre (t_c): el movimiento es continuo, sin saltos.',
    ],
  },
  vib: {
    eq: ['E=\\int_{t_0}^{t_1} x^2(t)\\,dt', 'E\\approx\\sum_{n} x[n]^2\\,\\Delta t'],
    s: [
      'La integral de x²(t) mide la energía de la señal de vibración en un latido (V²·s): no son joules.',
      'Si una valva se mueve distinto, la energía cambia; por eso sirve para comparar ciclos.',
    ],
  },
  lat: {
    eq: ['\\mathrm{FC}=\\dfrac{60}{RR}\\quad(RR\\ \\text{en segundos})', 't_{ap}=t_R+\\tau'],
    s: [
      'FC = 60/RR convierte el intervalo entre picos R en latidos por minuto.',
      'El ECG mide actividad eléctrica, no la apertura: en la simulación la válvula abre un retraso τ configurable después del pico R.',
    ],
  },
};

export function D08Math() {
  const { print } = useDeck();
  const { params } = useSim();
  const [tab, setTab] = useState<Tab>('mov');
  const [cmp, setCmp] = useState(false);
  const p = { ...params, condition: 'normal' as const };
  const live = !print;
  useEffect(() => () => sim.setParams({ bpm: DEFAULT_PARAMS.bpm, delayMs: DEFAULT_PARAMS.delayMs }), []);
  const fc = 60 / rrOf(params);
  return (
    <Screen
      num={8}
      kicker="Modelos matemáticos"
      title="Límites, derivadas e integrales"
      states={['synthetic']}
      actions={<Explain label="¿Qué significa?" content={PX.math} />}
    >
      <div className="v-grid" style={{ gridTemplateColumns: `${GW}px 1fr`, gap: 26, height: '100%' }}>
        <div className="v-col" style={{ gap: 10 }}>
          <div className="v-seg v-math-tabs" role="tablist" aria-label="Modelo">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                {t.t}
              </button>
            ))}
          </div>
          <div className="v-panel" style={{ padding: '8px 0 4px' }} key={tab}>
            {tab === 'mov' && <Movement p={p} live={live} />}
            {tab === 'vib' && <Vibration p={p} cmp={cmp} setCmp={setCmp} />}
            {tab === 'lat' && <Beat p={p} live={live} />}
          </div>
        </div>
        <div className="v-col v-math-side" key={tab}>
          {TEXT[tab].eq.map((e) => (
            <div key={e} className="v-math-eq">
              <Tex display>{e}</Tex>
            </div>
          ))}
          {TEXT[tab].s.map((s) => (
            <p key={s} className="v-math-text">
              {s}
            </p>
          ))}
          {tab === 'lat' && (
            <div className="v-panel" style={{ padding: '12px 16px' }}>
              <Slider label="FC" min={LIMITS.bpm[0]} max={LIMITS.bpm[1]} step={1} value={params.bpm} unit="lpm" onChange={(bpm) => sim.setParams({ bpm })} />
              <Slider
                label="Retardo τ"
                min={LIMITS.delayMs[0]}
                max={LIMITS.delayMs[1]}
                step={5}
                value={params.delayMs}
                unit="ms"
                onChange={(delayMs) => sim.setParams({ delayMs })}
              />
              <div className="v-math-value" style={{ marginTop: 6 }}>
                RR = {dec(rrOf(params), 3)} s → FC = 60 / {dec(rrOf(params), 3)} = <b>{Math.round(fc)}</b> lpm
              </div>
            </div>
          )}
          {tab === 'mov' && (
            <div className="v-math-value">
              Apertura en T<sub>ap</sub> = {ms(RAMP_OPEN)} · cierre en {ms(RAMP_CLOSE)} · θ<sub>máx</sub> = {params.thetaMax}°
            </div>
          )}
          <span className="v-tag sim" style={{ alignSelf: 'flex-start' }}>
            Curvas simuladas con el modelo del prototipo
          </span>
        </div>
      </div>
    </Screen>
  );
}
