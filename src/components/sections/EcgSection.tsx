import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { WINDOW_S, type EngineSnapshot } from '../../engine/ValveSenseEngine';
import { fmt } from '../../lib/format';
import { effectiveOpen, RAMP_CLOSE, RAMP_OPEN, rrOf, type PhaseName } from '../../presentation/sim/model';
import { axis, COLORS, grid, margin } from '../charts/chartTheme';
import { DataBadge } from '../layout/ControlBar';
import { MetricCard } from '../ui/MetricCard';
import { Section } from '../ui/Section';

const ECG_COLOR = '#d0473e';

const PHASE: Record<PhaseName, { label: string; sub: string; color: string; open: boolean }> = {
  cerrada: { label: 'CERRADA', sub: 'Esperando el próximo pico R', color: 'var(--text-2)', open: false },
  apertura: { label: 'ABRIENDO', sub: 'Rampa de apertura del actuador', color: 'var(--brand-2)', open: true },
  abierta: { label: 'ABIERTA', sub: 'Duración de apertura D', color: 'var(--brand-2)', open: true },
  cierre: { label: 'CERRANDO', sub: 'Rampa de cierre · contacto con el asiento', color: 'var(--brand)', open: true },
};

/** Línea de tiempo de un latido: R → τ → apertura → D → cierre → siguiente R. */
function BeatTimeline({ snap }: { snap: EngineSnapshot }) {
  const p = snap.params;
  const RR = rrOf(p) * 1000;
  const tau = p.delayMs;
  const { dOpen, truncated } = effectiveOpen(p);
  const D = dOpen * 1000;
  const ro = RAMP_OPEN * 1000;
  const rc = RAMP_CLOSE * 1000;
  const W = 1000;
  const x = (ms: number) => 40 + (ms / RR) * (W - 80);
  const cur = snap.msSinceR;
  const y = 52;
  const seg = (a: number, b: number, fill: string, label: string, sub?: string) => (
    <g>
      <rect x={x(a)} y={y - 14} width={Math.max(1, x(b) - x(a))} height={28} rx={5} fill={fill} />
      {x(b) - x(a) > 54 && (
        <text x={(x(a) + x(b)) / 2} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0b1f33">
          {label}
        </text>
      )}
      {sub && (
        <text x={(x(a) + x(b)) / 2} y={y + 32} textAnchor="middle" fontSize={11} fill="#7d8da0">
          {sub}
        </text>
      )}
    </g>
  );
  return (
    <div className="timeline">
      <svg viewBox={`0 0 ${W} 100`} role="img" aria-label="Temporización del ciclo respecto del pico R">
        <line x1={x(0)} x2={x(RR)} y1={y} y2={y} stroke="#cfd8e2" strokeWidth={2} />
        {seg(0, tau, '#f6e3e1', 'τ', `${tau} ms`)}
        {seg(tau, tau + ro, '#cdeeed', 'apertura', `${ro} ms`)}
        {seg(tau + ro, tau + D, '#e2f5f4', 'abierta', `D = ${fmt(D, 0)} ms`)}
        {seg(tau + D, tau + D + rc, '#d3e6f0', 'cierre', `${rc} ms`)}
        {seg(tau + D + rc, RR, '#f1f4f7', 'cerrada')}
        {[0, RR].map((v, i) => (
          <g key={i}>
            <line x1={x(v)} x2={x(v)} y1={y - 26} y2={y + 16} stroke={ECG_COLOR} strokeWidth={2} />
            <text x={x(v)} y={y - 30} textAnchor="middle" fontSize={12} fontWeight={700} fill={ECG_COLOR}>
              {i ? 'R siguiente' : 'R'}
            </text>
          </g>
        ))}
        <text x={x(RR)} y={y + 32} textAnchor="middle" fontSize={11} fill="#7d8da0">
          RR = {fmt(RR, 0)} ms
        </text>
        {cur !== null && cur <= RR && (
          <g transform={`translate(${x(cur)} 0)`}>
            <line x1={0} x2={0} y1={y - 20} y2={y + 18} stroke="#0b1f33" strokeWidth={2} />
            <path d={`M-6 ${y - 24} L6 ${y - 24} L0 ${y - 16}Z`} fill="#0b1f33" />
          </g>
        )}
      </svg>
      {truncated && (
        <p className="note" style={{ margin: '2px 0 0', color: 'var(--warn)' }}>
          D se acotó a {fmt(D, 0)} ms para que el ciclo termine antes del próximo latido (FC {p.bpm} lpm).
        </p>
      )}
    </div>
  );
}

export function EcgSection({ snap }: { snap: EngineSnapshot }) {
  const isSim = snap.sourceKind === 'simulation';
  const r = snap.latest?.record;
  const ph = snap.valvePhase ? PHASE[snap.valvePhase] : null;
  const beatOn = snap.sinceBeat !== null && snap.sinceBeat < 0.15;

  return (
    <Section
      index="01"
      title="ECG y sincronización valvular"
      subtitle="ECG → detección del complejo QRS / pico R → ESP32 → retardo τ → actuador → apertura y cierre"
      kinds={isSim ? ['synthetic'] : ['experimental']}
      aside={isSim ? 'ECG simulado de una derivación · 1 kHz' : 'Canal ECG del ESP32 (si se envía)'}
    >
      <div className="grid g-ecg">
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">ECG con picos R detectados y válvula abierta</h3>
              <p className="card-sub">Ventana deslizante de {WINDOW_S} s · detector inspirado en Pan–Tompkins (derivada → cuadrado → integración → umbral)</p>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: ECG_COLOR }} />
                ECG
              </span>
              <span>
                <i style={{ background: ECG_COLOR, width: 2 }} />
                Pico R
              </span>
              <span>
                <i className="box" style={{ background: 'rgba(16,162,160,.16)' }} />
                Válvula abierta
              </span>
            </div>
          </div>
          {snap.hasEcg ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={snap.ecg} margin={margin}>
                <CartesianGrid {...grid} />
                {snap.open.map(([a, b], i) => (
                  <ReferenceArea key={i} x1={a} x2={b} y1={-0.6} y2={1.5} fill={COLORS.openFill} strokeOpacity={0} ifOverflow="hidden" />
                ))}
                {snap.rPeaks.map((t, i) => (
                  <ReferenceLine key={i} x={t} stroke={ECG_COLOR} strokeDasharray="3 3" strokeOpacity={0.7} label={{ value: 'R', position: 'top', fontSize: 10, fill: ECG_COLOR }} />
                ))}
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={[-WINDOW_S, 0]}
                  ticks={Array.from({ length: WINDOW_S * 2 + 1 }, (_, i) => -WINDOW_S + i * 0.5)}
                  tickFormatter={(v: number) => (v === 0 ? 'ahora' : `${fmt(v, 1)} s`)}
                  {...axis}
                />
                <YAxis domain={[-0.6, 1.5]} ticks={[-0.5, 0, 0.5, 1, 1.5]} width={52} tickFormatter={(v: number) => `${fmt(v, 1)}`} {...axis} />
                <Line dataKey="v" name="ECG" stroke={ECG_COLOR} strokeWidth={1.4} dot={false} isAnimationActive={false} type="linear" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="note" style={{ height: 210, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              La fuente actual no envía canal ECG.
              <br />
              La válvula se analiza sin referencia de ritmo.
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <div className="card-sub" style={{ marginBottom: 2 }}>
              Temporización del ciclo (latido actual · el cursor marca el instante presente)
            </div>
            <BeatTimeline snap={snap} />
          </div>
        </div>

        <div className="stack">
          <MetricCard
            compact
            label="FC detectada (ECG)"
            icon={<span className={`beat-dot${beatOn ? ' on' : ''}`} aria-hidden />}
            value={snap.ecgBpm}
            unit="lpm"
            decimals={0}
            foot={<span>Desde los intervalos RR · programada {snap.bpmProgrammed} lpm</span>}
            accent={ECG_COLOR}
          />
          <div className="card metric compact">
            <span className="metric-accent" style={{ background: ph?.color ?? 'var(--border)' }} />
            <div className="metric-label">Estado de la válvula</div>
            <div className="valve-state" style={{ color: ph?.color ?? 'var(--muted)' }}>
              <span className="lamp" style={{ background: ph?.open ? 'var(--brand-2)' : '#cfd8e2', boxShadow: ph?.open ? '0 0 0 4px rgba(16,162,160,.15)' : 'none' }} />
              {ph?.label ?? '—'}
            </div>
            <div className="metric-foot">{ph?.sub ?? 'Sin datos de ángulo'}</div>
          </div>
          <MetricCard
            compact
            label="Ciclo valvular vs RR"
            value={r?.sync_error_ms}
            unit="ms"
            decimals={0}
            foot={<span>{r?.rr_ms ? `|ciclo ${fmt(r.cycle_duration_ms, 0)} − RR ${fmt(r.rr_ms, 0)}| · tolerancia 60 ms` : 'Requiere ECG'}</span>}
            z={r?.sync_error_ms != null && r.sync_error_ms > 60 ? 3 : undefined}
            accent="var(--brand)"
          />
        </div>
      </div>

      <div className="card" style={{ padding: '14px 20px' }}>
        <div className="grid g-2" style={{ alignItems: 'center' }}>
          <div>
            <div className="card-sub" style={{ marginBottom: 6 }}>
              Cadena de control demostrativa <DataBadge kind={isSim ? 'synthetic' : 'experimental'} />
            </div>
            <div className="chain">
              <span className={`node${beatOn ? ' hot' : ''}`}>ECG {isSim ? 'simulado' : ''}</span>
              <span className="arr">→</span>
              <span className={`node${beatOn ? ' hot' : ''}`}>QRS / pico R</span>
              <span className="arr">→</span>
              <span className={`node${snap.valvePhase === 'cerrada' && !beatOn ? '' : ' hot'}`}>ESP32 · espera τ</span>
              <span className="arr">→</span>
              <span className={`node${ph?.open ? ' hot' : ''}`}>Actuador (servo)</span>
              <span className="arr">→</span>
              <span className={`node${ph?.open ? ' hot' : ''}`}>Apertura / cierre</span>
            </div>
          </div>
          <div className="note" style={{ margin: 0, fontSize: 12 }}>
            <DataBadge kind="future" /> <b>ECG real:</b> sólo mediante un módulo de adquisición aislado, alimentado a batería, o con transmisión
            inalámbrica. No se conectan electrodos corporales a circuitos alimentados por USB sin aislamiento. τ y D son parámetros
            configurables del prototipo, no valores fisiológicos medidos.
          </div>
        </div>
      </div>
    </Section>
  );
}
