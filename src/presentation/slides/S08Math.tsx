import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SimTag, SlideHead, useDeck } from '../components/deck';
import { PhaseCursor, Plot, pathFrom } from '../components/Plot';
import { ParamSliders, PlaybackButtons } from '../components/SimControls';
import { TrivalveSVG } from '../components/TrivalveSVG';
import {
  CONDITIONS,
  cycleFeatures,
  DEFAULT_PARAMS,
  integralSquare,
  leafletProfiles,
  leafletState,
  period,
  PHASES,
  sampleSignals,
  type SimParams,
} from '../sim/model';
import { sim, useSim } from '../sim/store';

const n2 = (v: number, d = 2) => v.toFixed(d).replace('.', ',').replace('-', '−');

function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="v-frac">
      <span>{num}</span>
      <span>{den}</span>
    </span>
  );
}

/** Curva θ(t) de una valva en un período. */
function thetaCurve(p: SimParams, leaflet = 0, n = 400) {
  const T = period(p);
  const lp = leafletProfiles(p)[leaflet];
  const ts = Array.from({ length: n + 1 }, (_, i) => (i / n) * T);
  return { ts, th: ts.map((t) => leafletState(t, p, lp).theta), om: ts.map((t) => leafletState(t, p, lp).omega), lp, T };
}

// ═════════════════════════════════ LÍMITES ═════════════════════════════════
function LimitsPanel({ p, w, h, compact }: { p: SimParams; w: number; h: number; compact?: boolean }) {
  const T = period(p);
  const [t0f, setT0f] = useState(0.06);
  const [logDt, setLogDt] = useState(Math.log10(0.1));
  const t0 = t0f * T;
  const dt = 10 ** logDt;
  const { ts, th, lp } = useMemo(() => thetaCurve(p), [p]);
  const f = (t: number) => leafletState(t, p, lp).theta;
  const omega = leafletState(t0, p, lp).omega;
  const rows = [0.2, 0.1, 0.05, 0.01, 0.001].map((d) => ({ d, q: (f(t0 + d) - f(t0)) / d }));
  const yMax = Math.max(90, Math.ceil(Math.max(...th) / 10) * 10);
  const secant = (f(t0 + dt) - f(t0)) / dt;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 300px', gap: 18 }}>
      <div className="v-col" style={{ gap: 10 }}>
        <div className="v-math-box">
          <span className="v-math" style={{ fontSize: compact ? 22 : 30 }}>
            <i>ω</i>(<i>t</i>) =
            <span className="v-lim">
              lim<small>Δt→0</small>
            </span>
            <Frac
              num={
                <>
                  <i>θ</i>(<i>t</i> + Δ<i>t</i>) − <i>θ</i>(<i>t</i>)
                </>
              }
              den={
                <>
                  Δ<i>t</i>
                </>
              }
            />
          </span>
        </div>
        <Plot width={w} height={h} x={[0, T]} y={[0, yMax]} xTicks={[0, T / 4, T / 2, (3 * T) / 4, T]} yTicks={[0, 30, 60, 90].filter((v) => v <= yMax)} xFmt={(v) => `${n2(v)} s`} yFmt={(v) => `${v}°`} xLabel="t (s)" yLabel="θ(t)">
          {(s) => {
            const x1 = t0;
            const x2 = Math.min(T, t0 + dt);
            const y1 = f(x1);
            const y2 = f(t0 + dt);
            const ext = 0.12 * T;
            const tan = (t: number) => y1 + omega * (t - t0);
            const clampY = (v: number) => s.sy(Math.max(-20, Math.min(yMax + 20, v)));
            return (
              <>
                <path d={pathFrom(ts, th, s.sx, s.sy)} fill="none" stroke="var(--cyan)" strokeWidth={3} />
                <line x1={s.sx(x1 - ext)} y1={clampY(tan(x1 - ext))} x2={s.sx(x1 + ext)} y2={clampY(tan(x1 + ext))} stroke="var(--amber)" strokeWidth={2} strokeDasharray="6 5" />
                <line
                  x1={s.sx(x1 - ext * 0.5)}
                  y1={clampY(y1 - secant * ext * 0.5)}
                  x2={s.sx(Math.min(T, x2 + ext * 0.5))}
                  y2={clampY(y1 + secant * (Math.min(T, x2 + ext * 0.5) - x1))}
                  stroke="var(--coral)"
                  strokeWidth={2.5}
                />
                <circle cx={s.sx(x1)} cy={s.sy(y1)} r={7} fill="var(--amber)" />
                <circle cx={s.sx(x2)} cy={s.sy(y2)} r={6} fill="var(--coral)" />
              </>
            );
          }}
        </Plot>
        {!compact && (
          <div className="v-col" style={{ gap: 4 }}>
            <label className="v-slider">
              Instante t
              <input type="range" min={0.005} max={0.6} step={0.005} value={t0f} onChange={(e) => setT0f(Number(e.target.value))} />
              <output>{n2(t0, 3)} s</output>
            </label>
            <label className="v-slider">
              Δt
              <input type="range" min={-3} max={Math.log10(0.3 * T)} step={0.01} value={logDt} onChange={(e) => setLogDt(Number(e.target.value))} />
              <output>{dt < 0.01 ? n2(dt * 1000, 1) + ' ms' : n2(dt, 3) + ' s'}</output>
            </label>
          </div>
        )}
      </div>
      <div className="v-col" style={{ gap: 10 }}>
        <div className="v-legend" style={{ fontSize: 15 }}>
          <span>
            <i style={{ background: 'var(--coral)' }} />
            secante (Δt finito)
          </span>
          <span>
            <i className="dash" style={{ background: 'var(--amber)' }} />
            tangente: ω(t)
          </span>
        </div>
        <table className="v-table" style={{ fontSize: compact ? 14 : 17 }}>
          <thead>
            <tr>
              <th>Δt</th>
              <th>Δθ / Δt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.d}>
                <td>{r.d >= 0.01 ? `${n2(r.d, 3)} s` : `${n2(r.d * 1000, 0)} ms`}</td>
                <td>{n2(r.q, 1)} °/s</td>
              </tr>
            ))}
            <tr className="hl">
              <td>Δt → 0</td>
              <td>{n2(omega, 1)} °/s</td>
            </tr>
          </tbody>
        </table>
        <div className="v-small" style={{ fontSize: compact ? 14 : 16 }}>
          Al achicar Δt, la pendiente de la secante converge a la velocidad angular instantánea en t = {n2(t0, 3)} s.
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════ DERIVADAS ═════════════════════════════════
function LiveValue({ fn }: { fn: (t: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => sim.onFrame((t) => ref.current && (ref.current.textContent = fn(t))), [fn]);
  return <span ref={ref} className="v-num" />;
}

function DerivativePanel({ p, w, h, compact }: { p: SimParams; w: number; h: number; compact?: boolean }) {
  const T = period(p);
  const prof = leafletProfiles(p);
  const asym = p.condition === 'asymmetric';
  const curves = useMemo(() => [thetaCurve(p, 0), ...(asym ? [thetaCurve(p, 2)] : [])], [p, asym]);
  const omMax = Math.max(60, ...curves.flatMap((c) => c.om.map(Math.abs)));
  const omLim = Math.ceil(omMax / 200) * 200;
  const span = prof[0].max - prof[0].min;
  const wOpen = (span * Math.PI) / (2 * PHASES.openEnd * T);
  const wClose = (span * Math.PI) / (2 * (PHASES.closeEnd - PHASES.holdEnd) * T);
  const colors = ['var(--cyan)', 'var(--coral)'];
  const ticks = [0, T / 4, T / 2, (3 * T) / 4, T];
  const thetaFn = useMemo(() => (t: number) => `${n2(leafletState(t, sim.state.params, leafletProfiles(sim.state.params)[0]).theta, 1)}°`, []);
  const omegaFn = useMemo(() => (t: number) => `${n2(leafletState(t, sim.state.params, leafletProfiles(sim.state.params)[0]).omega, 0)} °/s`, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 300px', gap: 18 }}>
      <div className="v-col" style={{ gap: 4 }}>
        <Plot width={w} height={h} x={[0, T]} y={[0, 90]} yTicks={[0, 45, 90]} xTicks={[]} yFmt={(v) => `${v}°`} yLabel="θ(t)">
          {(s) => (
            <>
              {curves.map((c, i) => (
                <path key={i} d={pathFrom(c.ts, c.th, s.sx, s.sy)} fill="none" stroke={colors[i]} strokeWidth={3} />
              ))}
              <PhaseCursor s={s} T={T} show={!compact} />
            </>
          )}
        </Plot>
        <Plot width={w} height={h} x={[0, T]} y={[-omLim, omLim]} yTicks={[-omLim, 0, omLim]} xTicks={ticks} xFmt={(v) => `${n2(v)} s`} yFmt={(v) => n2(v, 0)} xLabel="t (s)" yLabel="ω = dθ/dt (°/s)">
          {(s) => (
            <>
              <rect x={s.x0} y={s.y0} width={s.w} height={s.h / 2} fill="rgba(34,211,238,.05)" />
              <rect x={s.x0} y={s.y0 + s.h / 2} width={s.w} height={s.h / 2} fill="rgba(255,122,89,.05)" />
              <text x={s.x0 + s.w - 8} y={s.y0 + 18} textAnchor="end" style={{ fill: 'var(--cyan)' }}>
                ω &gt; 0: abre
              </text>
              <text x={s.x0 + s.w - 8} y={s.y0 + s.h - 8} textAnchor="end" style={{ fill: 'var(--coral)' }}>
                ω &lt; 0: cierra
              </text>
              {curves.map((c, i) => (
                <path key={i} d={pathFrom(c.ts, c.om, s.sx, s.sy)} fill="none" stroke={colors[i]} strokeWidth={3} />
              ))}
              <PhaseCursor s={s} T={T} show={!compact} />
            </>
          )}
        </Plot>
      </div>
      <div className="v-col" style={{ gap: 12 }}>
        <div className="v-math-box">
          <span className="v-math" style={{ fontSize: compact ? 22 : 28 }}>
            <i>ω</i>(<i>t</i>) =
            <Frac num={<i>dθ</i>} den={<i>dt</i>} />
          </span>
          <div className="v-small" style={{ fontSize: compact ? 13.5 : 16, marginTop: 6 }}>
            Qué tan rápido abre o cierra la valva. ω = 0 cuando está abierta o cerrada.
          </div>
        </div>
        {!compact && (
          <div className="v-panel flat" style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
            <div>
              <div className="v-tiny">θ valva 1</div>
              <div style={{ fontSize: 26, fontWeight: 750 }}>
                <LiveValue fn={thetaFn} />
              </div>
              <div className="v-tiny" style={{ marginTop: 6 }}>
                ω valva 1
              </div>
              <div style={{ fontSize: 26, fontWeight: 750, color: 'var(--amber)' }}>
                <LiveValue fn={omegaFn} />
              </div>
            </div>
            <TrivalveSVG view="iso" size={130} highlight={asym ? 2 : null} />
          </div>
        )}
        <table className="v-table" style={{ fontSize: compact ? 14 : 16 }}>
          <tbody>
            <tr>
              <td>ω máx. apertura</td>
              <td>{n2(wOpen, 0)} °/s</td>
            </tr>
            <tr>
              <td>ω máx. cierre</td>
              <td>{n2(-wClose, 0)} °/s</td>
            </tr>
          </tbody>
        </table>
        <div className="v-small" style={{ fontSize: compact ? 13.5 : 15.5 }}>
          ω<sub>máx</sub> = Δθ·π / (2D). Al subir la frecuencia, D = fracción·T disminuye y ω aumenta.
          {asym && <span className="v-coral"> Valva 3 (coral): menor amplitud y retardo.</span>}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════ INTEGRALES ═════════════════════════════════
type Win = 'open' | 'close' | 'cycle';

function IntegralPanel({ p, w, h, compact }: { p: SimParams; w: number; h: number; compact?: boolean }) {
  const [win, setWin] = useState<Win>('close');
  const T = period(p);
  const FS = 4000;
  const sig = useMemo(() => sampleSignals(T, 2 * T, p, FS), [p, T]);
  const rel = useMemo(() => Array.from(sig.t, (t) => t - T), [sig, T]);
  const sq = useMemo(() => Array.from(sig.vib, (v) => v * v), [sig]);
  const [t1, t2] =
    win === 'open' ? [PHASES.openEnd * T - 0.01, PHASES.openEnd * T + 0.2] : win === 'close' ? [PHASES.closeEnd * T - 0.01, Math.min(T, PHASES.closeEnd * T + 0.2)] : [0, T];
  const i1 = Math.round(t1 * FS);
  const i2 = Math.round(t2 * FS);
  const E = integralSquare(sig.vib, FS, i1, i2);
  const rms = Math.sqrt(E / (t2 - t1));
  const sqMax = Math.max(0.05, ...sq) * 1.1;
  const byCond = useMemo(() => CONDITIONS.map((c) => ({ c, e: cycleFeatures({ ...p, condition: c.id }).eClose })), [p]);
  const eMax = Math.max(...byCond.map((b) => b.e));
  const fmtE = (e: number) => `${(e * 1000).toFixed(2).replace('.', ',')}×10⁻³`;
  const ticks = [0, T / 4, T / 2, (3 * T) / 4, T];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 320px', gap: 18 }}>
      <div className="v-col" style={{ gap: 6 }}>
        {!compact && (
          <div className="v-row" style={{ gap: 8 }}>
            {(
              [
                ['open', 'Evento de apertura'],
                ['close', 'Evento de cierre'],
                ['cycle', 'Ciclo completo'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className={`v-chip${win === k ? ' active' : ''}`} style={{ height: 38, fontSize: 15 }} onClick={() => setWin(k)}>
                {l}
              </button>
            ))}
          </div>
        )}
        <Plot width={w} height={h * 0.8} x={[0, T]} y={[-1.6, 1.6]} yTicks={[-1.5, 0, 1.5]} xTicks={[]} yLabel="x(t) [V]" yFmt={(v) => n2(v, 1)}>
          {(s) => (
            <>
              <rect x={s.sx(t1)} y={s.y0} width={s.sx(t2) - s.sx(t1)} height={s.h} fill="rgba(251,191,36,.08)" />
              <path d={pathFrom(rel, sig.vib, s.sx, (v) => s.sy(Math.max(-1.6, Math.min(1.6, v))))} fill="none" stroke="var(--sig-vib)" strokeWidth={1.1} />
            </>
          )}
        </Plot>
        <Plot width={w} height={h} x={[0, T]} y={[0, sqMax]} yTicks={[0, sqMax / 2, sqMax]} xTicks={ticks} xFmt={(v) => `${n2(v)} s`} yFmt={(v) => n2(v, 2)} xLabel="t (s) — un ciclo" yLabel="x²(t) [V²]">
          {(s) => {
            const a = Math.max(0, i1);
            const b = Math.min(sq.length - 1, i2);
            let d = `M${s.sx(rel[a])} ${s.sy(0)}`;
            for (let i = a; i <= b; i += 2) d += `L${s.sx(rel[i]).toFixed(1)} ${s.sy(sq[i]).toFixed(1)}`;
            d += `L${s.sx(rel[b])} ${s.sy(0)}Z`;
            return (
              <>
                <path d={d} fill="rgba(251,191,36,.45)" stroke="none" />
                <path d={pathFrom(rel, sq, s.sx, s.sy)} fill="none" stroke="var(--amber)" strokeWidth={1.2} />
                <line x1={s.sx(t1)} x2={s.sx(t1)} y1={s.y0} y2={s.y0 + s.h} stroke="var(--amber)" strokeDasharray="4 4" />
                <line x1={s.sx(t2)} x2={s.sx(t2)} y1={s.y0} y2={s.y0 + s.h} stroke="var(--amber)" strokeDasharray="4 4" />
                <text x={s.sx(t1) + 4} y={s.y0 + 14} style={{ fill: 'var(--amber)' }}>
                  t₁
                </text>
                <text x={s.sx(t2) + 4} y={s.y0 + 14} style={{ fill: 'var(--amber)' }}>
                  t₂
                </text>
              </>
            );
          }}
        </Plot>
      </div>
      <div className="v-col" style={{ gap: 10 }}>
        <div className="v-math-box">
          <span className="v-math" style={{ fontSize: compact ? 22 : 28 }}>
            <i>E</i>
            <sub style={{ fontSize: '.55em', alignSelf: 'flex-end', marginBottom: 4 }}>x</sub> =
            <span className="v-int">
              <span>∫</span>
              <span className="lims">
                <span>t₂</span>
                <span>t₁</span>
              </span>
            </span>
            <i>x</i>²(<i>t</i>) <i>dt</i>
          </span>
          <div style={{ fontSize: compact ? 18 : 24, fontWeight: 750, color: 'var(--amber)', marginTop: 6 }} className="v-num">
            {fmtE(E)} V²·s
          </div>
          <div className="v-small v-num" style={{ fontSize: compact ? 14 : 16 }}>
            RMS = √(Eₓ / (t₂ − t₁)) = {n2(rms, 3)} V · ventana {n2((t2 - t1) * 1000, 0)} ms
          </div>
        </div>
        <div className="v-tiny" style={{ fontSize: compact ? 12.5 : 14, lineHeight: 1.35 }}>
          Si x está en voltios, Eₓ tiene unidades V²·s: es una medida de señal acumulada, no energía mecánica en joules.
        </div>
        <div>
          <div className="v-panel-title v-keep-case" style={{ marginBottom: 6, fontSize: 14 }}>
            Eₓ del evento de cierre por condición
          </div>
          {byCond.map((b) => (
            <div key={b.c.id} style={{ display: 'grid', gridTemplateColumns: '128px 1fr 74px', alignItems: 'center', gap: 8, fontSize: compact ? 13 : 14.5, marginBottom: 4 }}>
              <span style={{ color: b.c.id === p.condition ? 'var(--text)' : 'var(--muted)', fontWeight: b.c.id === p.condition ? 700 : 500 }}>{b.c.short}</span>
              <div style={{ height: 12, background: 'var(--bg-2)', borderRadius: 4 }}>
                <div style={{ width: `${(b.e / eMax) * 100}%`, height: '100%', borderRadius: 4, background: b.c.id === p.condition ? 'var(--amber)' : 'var(--muted)', opacity: b.c.id === p.condition ? 1 : 0.55, transition: 'width .4s' }} />
              </div>
              <span className="v-num" style={{ textAlign: 'right' }}>
                {(b.e * 1000).toFixed(1).replace('.', ',')}
              </span>
            </div>
          ))}
          <div className="v-tiny" style={{ fontSize: 12.5 }}>
            ×10⁻³ V²·s · mismo modelo y misma ubicación de sensor
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════ DIAPOSITIVA ═════════════════════════════════
function Definitions({ p, compact }: { p: SimParams; compact?: boolean }) {
  const T = period(p);
  const rows: [ReactNode, string, string][] = [
    [<><i>θ</i>(<i>t</i>)</>, 'ángulo de apertura de una valva', '°'],
    [<i>T</i>, 'período del ciclo', `${n2(T, 3)} s`],
    [<><i>f</i> = 1/<i>T</i></>, 'frecuencia', `${n2(1 / T, 2)} Hz`],
    [<>60/<i>T</i></>, 'ciclos por minuto', `${p.cpm} cpm`],
    [<><i>x</i>(<i>t</i>)</>, 'señal de vibración o sonido', 'V (supuesto)'],
  ];
  return (
    <div className="v-panel" style={{ padding: compact ? '12px 16px' : '16px 20px' }}>
      <div className="v-panel-title">Variables</div>
      <table className="v-table" style={{ fontSize: compact ? 14 : 17 }}>
        <tbody>
          {rows.map(([s, d, v], i) => (
            <tr key={i}>
              <td style={{ fontFamily: 'Cambria Math, STIX Two Math, serif', fontSize: compact ? 17 : 21, whiteSpace: 'nowrap' }}>{s}</td>
              <td>{d}</td>
              <td style={{ textAlign: 'right', color: 'var(--cyan)', whiteSpace: 'nowrap' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="v-small" style={{ fontSize: compact ? 13 : 15, marginTop: 10, lineHeight: 1.4 }}>
        <b>Perfil suave supuesto:</b> θ = θ<sub>mín</sub> + Δθ·(1 − cos πu)/2, u = τ/D. Apertura en 0,15T, cierre en 0,12T. La amplitud de cada clic se supone ∝ ω<sub>máx</sub>.
      </div>
    </div>
  );
}

export function S08Math() {
  const { print } = useDeck();
  const { params } = useSim();
  const [tab, setTab] = useState<'lim' | 'der' | 'int'>('lim');

  if (print) {
    return (
      <div className="v-slide">
        <SlideHead num={8} kicker="Modelo matemático" title="Límites, derivadas e integrales del movimiento" right={<SimTag label="Modelo · simulación" />} />
        <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '330px 1fr 1fr 1fr', gap: 16 }}>
          <Definitions p={DEFAULT_PARAMS} compact />
          <div className="v-col" style={{ gap: 6 }}>
            <div className="v-panel-title v-keep-case" style={{ fontSize: 17, color: 'var(--text)' }}>1 · Límites → velocidad angular</div>
            <LimitsPanel p={DEFAULT_PARAMS} w={380} h={220} compact />
          </div>
          <div className="v-col" style={{ gap: 6 }}>
            <div className="v-panel-title v-keep-case" style={{ fontSize: 17, color: 'var(--text)' }}>2 · Derivadas: ω = dθ/dt</div>
            <DerivativePanel p={DEFAULT_PARAMS} w={380} h={170} compact />
          </div>
          <div className="v-col" style={{ gap: 6 }}>
            <div className="v-panel-title v-keep-case" style={{ fontSize: 17, color: 'var(--text)' }}>3 · Integrales: señal acumulada</div>
            <IntegralPanel p={DEFAULT_PARAMS} w={380} h={150} compact />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead
        num={8}
        kicker="Modelo matemático"
        title="Límites, derivadas e integrales del movimiento"
        right={<SimTag label="Modelo · simulación" />}
      />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: 22, minHeight: 0 }}>
        <div className="v-col" style={{ gap: 14 }}>
          <Definitions p={params} />
          <div className="v-panel" style={{ padding: '14px 18px' }}>
            <PlaybackButtons />
            <div className="v-explore-only" style={{ marginTop: 10 }}>
              <ParamSliders />
            </div>
          </div>
        </div>
        <div className="v-panel" style={{ padding: '10px 22px 16px', minHeight: 0 }}>
          <div className="v-tabs" role="tablist" style={{ marginBottom: 12 }}>
            {(
              [
                ['lim', '1 · Límites'],
                ['der', '2 · Derivadas'],
                ['int', '3 · Integrales'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
          {tab === 'lim' && <LimitsPanel p={params} w={660} h={360} />}
          {tab === 'der' && <DerivativePanel p={params} w={660} h={262} />}
          {tab === 'int' && <IntegralPanel p={params} w={640} h={262} />}
        </div>
      </div>
    </div>
  );
}
