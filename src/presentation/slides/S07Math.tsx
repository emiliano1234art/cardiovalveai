import { useEffect, useMemo, useRef, useState } from 'react';
import { SimTag, SlideHead, useDeck } from '../components/deck';
import { PhaseCursor, Plot, pathFrom } from '../components/Plot';
import { ParamSliders, PlaybackButtons } from '../components/SimControls';
import { Tex } from '../components/Tex';
import { assess, summarize } from '../sim/analysis';
import { CONDITIONS, effectiveOpen, integralSquare, leafletBeat, leafletState, RAMP_CLOSE, RAMP_OPEN, rPeak, rrOf, sampleSignals, type SimParams } from '../sim/model';
import { sim, useSim } from '../sim/store';

const n2 = (v: number, d = 2) => v.toFixed(d).replace('.', ',').replace('-', '−');

// ═════════════════════════════ ecuaciones del sistema ═════════════════════════════

function EqCard({ n, title, tex, defs, use, live, compact }: { n: number; title: string; tex: string[]; defs: string; use: string; live?: string; compact?: boolean }) {
  return (
    <div className="v-panel" style={{ padding: compact ? '8px 12px' : '12px 16px', display: 'flex', flexDirection: 'column', gap: compact ? 2 : 4 }}>
      <div className="v-row" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontSize: compact ? 14 : 16 }}>
          <span className="v-cyan v-mono">{n}</span> · {title}
        </b>
        {live && (
          <span className="v-tag exp v-num" style={{ height: 24, fontSize: 12, letterSpacing: 0, textTransform: 'none' }}>
            {live}
          </span>
        )}
      </div>
      <div style={{ fontSize: compact ? 15 : 19, overflowX: 'hidden' }}>
        {tex.map((t) => (
          <Tex key={t} display>
            {t}
          </Tex>
        ))}
      </div>
      <div className="v-tiny" style={{ fontSize: compact ? 11.5 : 13.5, lineHeight: 1.3 }}>
        {defs}
      </div>
      <div style={{ fontSize: compact ? 12 : 14, color: 'var(--teal)', fontWeight: 600, lineHeight: 1.3 }}>→ {use}</div>
    </div>
  );
}

function Equations({ p, compact = false }: { p: SimParams; compact?: boolean }) {
  const RR = rrOf(p);
  const { dOpen } = effectiveOpen(p);
  const s = useMemo(() => summarize(p), [p]);
  const a = useMemo(() => assess(p), [p]);
  const cards = [
    {
      title: 'Frecuencia cardíaca desde los intervalos RR',
      tex: [String.raw`RR_k = t_{R,k}-t_{R,k-1},\qquad \mathrm{FC}=\frac{60}{\overline{RR}},\quad \overline{RR}=\frac{1}{N}\sum_{k=1}^{N}RR_k`],
      defs: 't_R,k: instante del k-ésimo pico R (s) · N: latidos promediados (4) · FC en lpm.',
      use: 'FC mostrada en el dashboard y referencia temporal para la IA.',
      live: `RR = ${n2(RR, 3)} s → ${n2(60 / RR, 0)} lpm`,
    },
    {
      title: 'Temporización de la válvula tras el pico R',
      tex: [String.raw`t_{ap,k}=t_{R,k}+\tau,\qquad t_{c,k}=t_{ap,k}+D`, String.raw`\theta(t)=\theta_{\min}+\Delta\theta\,\frac{1-\cos\!\left(\pi\,\frac{t-t_{ap}}{D_r}\right)}{2}`],
      defs: 'τ: retardo electromecánico configurable · D: duración de apertura · D_r: rampa del servo (120 ms) · Δθ: ángulo recorrido.',
      use: 'El ESP32 programa el actuador a partir de cada R detectado.',
      live: `τ ${Math.round(p.delayMs)} ms · D ${Math.round(dOpen * 1000)} ms`,
    },
    {
      title: 'Energía y RMS de la vibración',
      tex: [String.raw`E_x=\int_{t_1}^{t_2}x^2(t)\,dt\;\approx\;\sum_{n} x[n]^2\,\Delta t,\qquad \mathrm{RMS}=\sqrt{\frac{E_x}{t_2-t_1}}`],
      defs: 'x(t): señal del piezo (V) · [t₁, t₂]: ventana de un evento · Eₓ en V²·s (no es energía mecánica en J).',
      use: 'Intensidad de cada apertura y cierre, comparable entre condiciones.',
      live: `E cierre ${n2(s.eClose * 1000, 2)}×10⁻³ V²·s`,
    },
    {
      title: 'Transformada de Fourier del sonido',
      tex: [String.raw`X[k]=\sum_{n=0}^{N-1}x[n]\,w[n]\,e^{-j2\pi kn/N},\qquad f_k=\frac{k\,f_s}{N}`, String.raw`f_{\mathrm{dom}}=\arg\max_{f_k}\,|X[k]|^2`],
      defs: 'x[n]: muestras del MEMS · w[n]: ventana de Hann · f_s: frecuencia de muestreo · N: puntos de la FFT.',
      use: 'Espectro, espectrograma (FFT por ventanas) y frecuencia dominante.',
      live: `f_dom ${n2(s.fDom, 0)} Hz`,
    },
    {
      title: 'Comparación con la línea basal',
      tex: [String.raw`z_i=\frac{f_i-\mu_i}{\sigma_i},\qquad D=\sqrt{\frac{1}{M}\sum_{i=1}^{M}\min(|z_i|,5)^2},\qquad S=100\,e^{-D^2/8}\ \%`],
      defs: 'f_i: descriptor actual · μ_i: valor basal · σ_i: tolerancia · M: descriptores · S: similitud.',
      use: 'Detección experimental de desviaciones (heurística, no diagnóstico).',
      live: `S = ${n2(a.similarity, 0)} %`,
    },
  ];
  return (
    <div className="v-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: compact ? 8 : 12 }}>
      {cards.map((c, i) => (
        <EqCard key={c.title} n={i + 1} {...c} compact={compact} />
      ))}
      <div className="v-panel flat" style={{ padding: compact ? '8px 12px' : '12px 16px', fontSize: compact ? 12.5 : 14.5, color: 'var(--text-2)' }}>
        <b>Por qué una FC alta no es una falla:</b> los descriptores 3–4 se calculan en ventanas sincronizadas con cada evento, y el ciclo valvular se compara con el RR de la ecuación 1. Un cambio de FC
        modifica RR, pero no la firma de cada evento.
      </div>
    </div>
  );
}

// ═════════════════════════ cálculo: límites, derivadas, integrales ═════════════════════════

function beatCurve(p: SimParams, i = 0, n = 400) {
  const RR = rrOf(p);
  const r0 = rPeak(3, p);
  const ts = Array.from({ length: n + 1 }, (_, k) => (k / n) * RR);
  return { ts, th: ts.map((t) => leafletState(r0 + t, p, i).theta), om: ts.map((t) => leafletState(r0 + t, p, i).omega), RR, r0 };
}

function LimitsPanel({ p, w, h, compact }: { p: SimParams; w: number; h: number; compact?: boolean }) {
  const { ts, th, RR, r0 } = useMemo(() => beatCurve(p), [p]);
  const tau = p.delayMs / 1000;
  const [t0f, setT0f] = useState(tau + RAMP_OPEN / 2);
  const [logDt, setLogDt] = useState(Math.log10(0.05));
  const t0 = Math.min(RR * 0.95, t0f);
  const dt = 10 ** logDt;
  const f = (t: number) => leafletState(r0 + t, p, 0).theta;
  const omega = leafletState(r0 + t0, p, 0).omega;
  const rows = [0.1, 0.05, 0.01, 0.001].map((d) => ({ d, q: (f(t0 + d) - f(t0)) / d }));
  const secant = (f(t0 + dt) - f(t0)) / dt;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 280px', gap: 16 }}>
      <div className="v-col" style={{ gap: 8 }}>
        <div className="v-math-box" style={{ padding: '8px 14px', fontSize: compact ? 16 : 22 }}>
          <Tex display>{String.raw`\omega(t)=\lim_{\Delta t\to 0}\frac{\theta(t+\Delta t)-\theta(t)}{\Delta t}`}</Tex>
        </div>
        <Plot width={w} height={h} x={[0, RR]} y={[0, 90]} xTicks={[0, RR / 4, RR / 2, (3 * RR) / 4]} yTicks={[0, 45, 90]} xFmt={(v) => `${n2(v)} s`} yFmt={(v) => `${v}°`} xLabel="t desde el pico R (s)" yLabel="θ(t)">
          {(s) => {
            const ext = 0.08;
            const y1 = f(t0);
            const clampY = (v: number) => s.sy(Math.max(-30, Math.min(120, v)));
            return (
              <>
                <path d={pathFrom(ts, th, s.sx, s.sy)} fill="none" stroke="var(--cyan)" strokeWidth={3} />
                <line x1={s.sx(t0 - ext)} y1={clampY(y1 - omega * ext)} x2={s.sx(t0 + ext)} y2={clampY(y1 + omega * ext)} stroke="var(--amber)" strokeWidth={2} strokeDasharray="6 5" />
                <line x1={s.sx(t0 - ext / 2)} y1={clampY(y1 - (secant * ext) / 2)} x2={s.sx(t0 + dt + ext / 2)} y2={clampY(y1 + secant * (dt + ext / 2))} stroke="var(--coral)" strokeWidth={2.5} />
                <circle cx={s.sx(t0)} cy={s.sy(y1)} r={6} fill="var(--amber)" />
                <circle cx={s.sx(Math.min(RR, t0 + dt))} cy={s.sy(f(t0 + dt))} r={5} fill="var(--coral)" />
              </>
            );
          }}
        </Plot>
        {!compact && (
          <div className="v-col" style={{ gap: 2 }}>
            <label className="v-slider">
              Instante t
              <input type="range" min={0} max={RR * 0.9} step={0.002} value={t0} onChange={(e) => setT0f(Number(e.target.value))} />
              <output>{n2(t0, 3)} s</output>
            </label>
            <label className="v-slider">
              Δt
              <input type="range" min={-3} max={Math.log10(0.2)} step={0.01} value={logDt} onChange={(e) => setLogDt(Number(e.target.value))} />
              <output>{dt < 0.01 ? n2(dt * 1000, 1) + ' ms' : n2(dt, 3) + ' s'}</output>
            </label>
          </div>
        )}
      </div>
      <div className="v-col" style={{ gap: 8 }}>
        <table className="v-table" style={{ fontSize: compact ? 13 : 16 }}>
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
                <td>{n2(r.q, 0)} °/s</td>
              </tr>
            ))}
            <tr className="hl">
              <td>Δt → 0</td>
              <td>{n2(omega, 0)} °/s</td>
            </tr>
          </tbody>
        </table>
        <div className="v-small" style={{ fontSize: compact ? 12.5 : 15 }}>
          La secante (coral) converge a la tangente (ámbar): la velocidad angular instantánea.
        </div>
      </div>
    </div>
  );
}

function LiveValue({ fn }: { fn: (t: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => sim.onFrame((t) => ref.current && (ref.current.textContent = fn(t))), [fn]);
  return <span ref={ref} className="v-num" />;
}

function DerivativePanel({ p, w, h, compact }: { p: SimParams; w: number; h: number; compact?: boolean }) {
  const irregular = p.condition === 'irregular';
  const curves = useMemo(() => [beatCurve(p, 0), ...(irregular ? [beatCurve(p, 1)] : [])], [p, irregular]);
  const RR = curves[0].RR;
  const lb = leafletBeat(p, 0, 3);
  const span = lb.max - lb.min;
  const wOpen = (span * Math.PI) / (2 * RAMP_OPEN);
  const wClose = (span * Math.PI) / (2 * RAMP_CLOSE);
  const lim = Math.ceil(Math.max(wOpen, wClose, 200) / 400) * 400;
  const colors = ['var(--cyan)', 'var(--coral)'];
  const omegaFn = useMemo(() => (t: number) => `${n2(leafletState(t, sim.state.params, 0).omega, 0)} °/s`, []);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 280px', gap: 16 }}>
      <div className="v-col" style={{ gap: 2 }}>
        <Plot width={w} height={h} x={[0, RR]} y={[0, 90]} yTicks={[0, 45, 90]} xTicks={[]} yFmt={(v) => `${v}°`} yLabel="θ(t)">
          {(s) => (
            <>
              {curves.map((c, i) => (
                <path key={i} d={pathFrom(c.ts, c.th, s.sx, s.sy)} fill="none" stroke={colors[i]} strokeWidth={3} />
              ))}
              <PhaseCursor s={s} T={RR} show={!compact} />
            </>
          )}
        </Plot>
        <Plot width={w} height={h} x={[0, RR]} y={[-lim, lim]} yTicks={[-lim, 0, lim]} xTicks={[0, RR / 4, RR / 2, (3 * RR) / 4]} xFmt={(v) => `${n2(v)} s`} yFmt={(v) => n2(v, 0)} xLabel="t desde el pico R (s)" yLabel="ω (°/s)">
          {(s) => (
            <>
              <text x={s.x0 + s.w - 8} y={s.y0 + 16} textAnchor="end" style={{ fill: 'var(--cyan)' }}>
                ω &gt; 0: abre
              </text>
              <text x={s.x0 + s.w - 8} y={s.y0 + s.h - 6} textAnchor="end" style={{ fill: 'var(--coral)' }}>
                ω &lt; 0: cierra
              </text>
              {curves.map((c, i) => (
                <path key={i} d={pathFrom(c.ts, c.om, s.sx, s.sy)} fill="none" stroke={colors[i]} strokeWidth={3} />
              ))}
              <PhaseCursor s={s} T={RR} show={!compact} />
            </>
          )}
        </Plot>
      </div>
      <div className="v-col" style={{ gap: 8 }}>
        <div className="v-math-box" style={{ padding: '8px 12px', fontSize: compact ? 15 : 20 }}>
          <Tex display>{String.raw`\omega(t)=\frac{d\theta}{dt}=\frac{\Delta\theta\,\pi}{2D_r}\sin\!\left(\pi\frac{t-t_{ap}}{D_r}\right)`}</Tex>
        </div>
        {!compact && (
          <div className="v-panel flat" style={{ padding: '8px 12px' }}>
            <span className="v-tiny">ω valva 1 ahora </span>
            <b style={{ fontSize: 22, color: 'var(--amber)' }}>
              <LiveValue fn={omegaFn} />
            </b>
          </div>
        )}
        <table className="v-table" style={{ fontSize: compact ? 13 : 15 }}>
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
        <div className="v-small" style={{ fontSize: compact ? 12.5 : 14.5 }}>
          D_r lo fija el servo: ω no cambia con la FC, por eso la firma de cada evento tampoco.
          {irregular && <span className="v-coral"> Valva 2 (coral): apertura y retardo variables.</span>}
        </div>
      </div>
    </div>
  );
}

type Win = 'open' | 'close' | 'beat';

function IntegralPanel({ p, w, h, compact }: { p: SimParams; w: number; h: number; compact?: boolean }) {
  const [win, setWin] = useState<Win>('close');
  const FS = 4000;
  const RR = rrOf(p);
  const r0 = rPeak(3, p);
  const sig = useMemo(() => sampleSignals(r0, r0 + RR, p, FS), [p, r0, RR]);
  const rel = useMemo(() => Array.from(sig.t, (t) => t - r0), [sig, r0]);
  const sq = useMemo(() => Array.from(sig.vib, (v) => v * v), [sig]);
  const lb = leafletBeat(p, 0, 3);
  const tOpen = lb.start + RAMP_OPEN;
  const tClose = lb.start + lb.dOpen + RAMP_CLOSE;
  const [t1, t2] = win === 'open' ? [tOpen - 0.01, tOpen + 0.15] : win === 'close' ? [tClose - 0.01, Math.min(RR, tClose + 0.15)] : [0, RR];
  const E = integralSquare(sig.vib, FS, Math.round(t1 * FS), Math.round(t2 * FS));
  const rms = Math.sqrt(E / (t2 - t1));
  const sqMax = Math.max(0.05, ...sq) * 1.1;
  const byCond = useMemo(() => CONDITIONS.map((c) => ({ c, e: summarize({ ...p, condition: c.id }).eClose })), [p]);
  const eMax = Math.max(...byCond.map((b) => b.e));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 300px', gap: 16 }}>
      <div className="v-col" style={{ gap: 4 }}>
        {!compact && (
          <div className="v-row" style={{ gap: 8 }}>
            {(
              [
                ['open', 'Evento de apertura'],
                ['close', 'Evento de cierre'],
                ['beat', 'Latido completo'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className={`v-chip${win === k ? ' active' : ''}`} style={{ height: 36, fontSize: 14.5 }} onClick={() => setWin(k)}>
                {l}
              </button>
            ))}
          </div>
        )}
        <Plot width={w} height={h} x={[0, RR]} y={[0, sqMax]} yTicks={[0, sqMax / 2, sqMax]} xTicks={[0, RR / 4, RR / 2, (3 * RR) / 4]} xFmt={(v) => `${n2(v)} s`} yFmt={(v) => n2(v, 2)} xLabel="t desde el pico R (s)" yLabel="x²(t) [V²]">
          {(s) => {
            const a = Math.max(0, Math.round(t1 * FS));
            const b = Math.min(sq.length - 1, Math.round(t2 * FS));
            let d = `M${s.sx(rel[a])} ${s.sy(0)}`;
            for (let i = a; i <= b; i += 2) d += `L${s.sx(rel[i]).toFixed(1)} ${s.sy(sq[i]).toFixed(1)}`;
            d += `L${s.sx(rel[b])} ${s.sy(0)}Z`;
            return (
              <>
                <path d={d} fill="rgba(217,119,6,.35)" />
                <path d={pathFrom(rel, sq, s.sx, s.sy)} fill="none" stroke="var(--amber)" strokeWidth={1.2} />
                {[t1, t2].map((x, i) => (
                  <g key={i}>
                    <line x1={s.sx(x)} x2={s.sx(x)} y1={s.y0} y2={s.y0 + s.h} stroke="var(--amber)" strokeDasharray="4 4" />
                    <text x={s.sx(x) + 4} y={s.y0 + 14} style={{ fill: 'var(--amber)' }}>
                      {i ? 't₂' : 't₁'}
                    </text>
                  </g>
                ))}
              </>
            );
          }}
        </Plot>
      </div>
      <div className="v-col" style={{ gap: 6 }}>
        <div className="v-math-box" style={{ padding: '8px 12px', fontSize: compact ? 15 : 19 }}>
          <Tex display>{String.raw`E_x=\int_{t_1}^{t_2}x^2(t)\,dt`}</Tex>
          <div className="v-num" style={{ fontSize: compact ? 15 : 20, fontWeight: 750, color: 'var(--amber)' }}>
            {n2(E * 1000, 2)}×10⁻³ V²·s
          </div>
          <div className="v-tiny v-num">RMS = {n2(rms, 3)} V</div>
        </div>
        <div className="v-panel-title v-keep-case" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
          Eₓ del cierre por condición
        </div>
        {byCond.map((b) => (
          <div key={b.c.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 44px', alignItems: 'center', gap: 6, fontSize: compact ? 12 : 13.5 }}>
            <span style={{ color: b.c.id === p.condition ? 'var(--text)' : 'var(--muted)', fontWeight: b.c.id === p.condition ? 700 : 500 }}>{b.c.short}</span>
            <div style={{ height: 10, background: 'var(--bg-2)', borderRadius: 4 }}>
              <div style={{ width: `${(b.e / eMax) * 100}%`, height: '100%', borderRadius: 4, background: b.c.id === p.condition ? 'var(--amber)' : 'var(--muted)', opacity: b.c.id === p.condition ? 1 : 0.45 }} />
            </div>
            <span className="v-num" style={{ textAlign: 'right' }}>
              {n2(b.e * 1000, 1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════ diapositiva ═════════════════════════════════

export function S07Math() {
  const { print } = useDeck();
  const { params } = useSim();
  const [tab, setTab] = useState<'eq' | 'lim' | 'der' | 'int'>('eq');

  if (print) {
    return (
      <div className="v-slide" style={{ paddingTop: 40 }}>
        <SlideHead num={7} kicker="Matemática aplicada" title="Del pico R al análisis de la señal" right={<SimTag label="Modelo · simulación" />} />
        <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 14 }}>
          <Equations p={params} compact />
          <div className="v-col" style={{ gap: 6 }}>
            <div className="v-panel-title v-keep-case" style={{ fontSize: 13, margin: 0 }}>
              Cálculo · límite → derivada (velocidad angular)
            </div>
            <DerivativePanel p={params} w={410} h={120} compact />
            <div className="v-panel-title v-keep-case" style={{ fontSize: 13, margin: 0 }}>
              Cálculo · integral (señal acumulada)
            </div>
            <IntegralPanel p={params} w={410} h={130} compact />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead
        num={7}
        kicker="Matemática aplicada"
        title="Del pico R al análisis de la señal"
        right={
          <div className="v-tabs" role="tablist">
            {(
              [
                ['eq', 'Ecuaciones del sistema'],
                ['lim', 'Límites'],
                ['der', 'Derivadas'],
                ['int', 'Integrales'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
        }
      />
      {tab === 'eq' ? (
        <div className="v-body">
          <Equations p={params} />
        </div>
      ) : (
        <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
          <div className="v-panel" style={{ padding: '12px 18px' }}>
            {tab === 'lim' && <LimitsPanel p={params} w={720} h={360} />}
            {tab === 'der' && <DerivativePanel p={params} w={720} h={250} />}
            {tab === 'int' && <IntegralPanel p={params} w={700} h={430} />}
          </div>
          <div className="v-panel" style={{ padding: '14px 18px' }}>
            <PlaybackButtons small />
            <div style={{ marginTop: 10 }}>
              <ParamSliders />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
