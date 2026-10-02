import { useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { deviationLevel } from '../../analysis/ValveAnalysisPipeline';
import { THRESHOLDS } from '../../config/modes';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import { fmt, signed } from '../../lib/format';
import type { DeviationLevel, FeatureDeviation } from '../../types/valvesense';
import { axis, COLORS, grid, margin } from '../charts/chartTheme';
import { ChartTooltip } from '../charts/ChartTooltip';
import { Section } from '../ui/Section';
import { LEVEL_COLOR, StatusBadge } from '../ui/StatusBadge';

function SimilarityGauge({ value }: { value: number }) {
  const r = 62;
  const c = Math.PI * r; // semicircunferencia
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg viewBox="0 0 160 112" width="100%" style={{ maxWidth: 230 }} role="img" aria-label={`Similitud con la línea basal ${v.toFixed(0)} %`}>
      <defs>
        <linearGradient id="gsim" x1="0" x2="1">
          <stop offset="0" stopColor="#0a6f95" />
          <stop offset="1" stopColor="#10a2a0" />
        </linearGradient>
      </defs>
      <path d={`M ${80 - r} 84 A ${r} ${r} 0 0 1 ${80 + r} 84`} fill="none" stroke="#eef2f6" strokeWidth="12" strokeLinecap="round" />
      <path
        d={`M ${80 - r} 84 A ${r} ${r} 0 0 1 ${80 + r} 84`}
        fill="none"
        stroke="url(#gsim)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        style={{ transition: 'stroke-dasharray .6s ease' }}
      />
      <text x="80" y="70" textAnchor="middle" fontSize="30" fontWeight="650" fill="#0b1f33" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {fmt(v, 1)}
        <tspan fontSize="14" fill="#7d8da0" fontWeight="500">
          {' '}
          %
        </tspan>
      </text>
      <text x="80" y="106" textAnchor="middle" fontSize="9.5" fill="#7d8da0" letterSpacing=".06em">
        SIMILITUD CON BASAL
      </text>
    </svg>
  );
}

function AnomalyScale({ value }: { value: number }) {
  const zones: [number, number, string][] = [
    [0, THRESHOLDS.mild, 'var(--ok-soft)'],
    [THRESHOLDS.mild, THRESHOLDS.major, 'var(--warn-soft)'],
    [THRESHOLDS.major, 1, 'var(--crit-soft)'],
  ];
  const v = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="kicker">Anomaly score</span>
        <span className="num" style={{ fontSize: 22, fontWeight: 650 }}>
          {fmt(v, 2)}
        </span>
      </div>
      <div style={{ position: 'relative', height: 10, marginTop: 8, display: 'flex', gap: 2 }}>
        {zones.map(([a, b, c]) => (
          <div key={a} style={{ flex: b - a, background: c, borderRadius: 3 }} />
        ))}
        <div
          style={{
            position: 'absolute',
            left: `calc(${v * 100}% - 7px)`,
            top: -5,
            width: 14,
            height: 20,
            borderRadius: 5,
            background: '#fff',
            border: `2px solid ${LEVEL_COLOR[deviationLevel(v)]}`,
            boxShadow: '0 1px 4px rgba(11,31,51,.2)',
            transition: 'left .6s ease, border-color .4s',
          }}
        />
      </div>
      <div className="num" style={{ position: 'relative', height: 16, fontSize: 10.5, color: 'var(--muted)', marginTop: 6 }}>
        {[0, THRESHOLDS.mild, THRESHOLDS.major, 1].map((t) => (
          <span key={t} style={{ position: 'absolute', left: `${t * 100}%`, transform: t === 0 ? 'none' : t === 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
            {fmt(t, 1)}
          </span>
        ))}
      </div>
    </div>
  );
}

function DeviationBars({ deviations }: { deviations: FeatureDeviation[] }) {
  const sorted = [...deviations].sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const max = 8;
  return (
    <div>
      {sorted.map((d) => {
        const az = Math.min(Math.abs(d.z), max);
        const lvl: DeviationLevel = Math.abs(d.z) >= 4 ? 'major' : Math.abs(d.z) >= 2.5 ? 'mild' : 'normal';
        return (
          <div className="zbar-row" key={d.key} title={`Actual ${fmt(d.value, 2)} ${d.unit} · basal ${fmt(d.baseline, 2)} ${d.unit}`}>
            <span style={{ color: 'var(--text-2)' }}>{d.label}</span>
            <div className="zbar-track">
              <div className="zbar-fill" style={{ width: `${(az / max) * 100}%`, background: lvl === 'normal' ? '#9cc3e8' : LEVEL_COLOR[lvl] }} />
              {[2.5, 4].map((t) => (
                <span key={t} className="zbar-tick" style={{ left: `${(t / max) * 100}%` }} />
              ))}
            </div>
            <span className="num" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>
              {signed(d.z, 1)}σ
            </span>
          </div>
        );
      })}
      <div className="note" style={{ marginTop: 6, fontSize: 11 }}>
        Desviación en unidades de dispersión de la línea basal (z). Marcas en 2,5σ y 4σ.
      </div>
    </div>
  );
}

function interpretation(level: DeviationLevel, deviations: FeatureDeviation[]): string {
  const top = [...deviations]
    .filter((d) => Math.abs(d.z) >= 2.5)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, 3)
    .map((d) => `${/^[A-Z]{2}/.test(d.label) ? d.label : d.label.toLowerCase()} (${signed(d.z, 1)}σ)`);
  if (level === 'normal' && top.length === 0)
    return 'El patrón mecánico y acústico actual es consistente con la línea basal registrada. No se observan desviaciones relevantes en los descriptores.';
  const base = level === 'normal' ? 'Patrón globalmente consistente con la basal; ' : level === 'mild' ? 'Desviación leve respecto de la basal; ' : 'Desviación importante respecto de la basal; ';
  return top.length
    ? `${base}los descriptores que más se apartan son ${top.join(', ')}.`
    : `${base}la variabilidad entre ciclos es la principal fuente de diferencia.`;
}

export function AiSection({ snap }: { snap: EngineSnapshot }) {
  const [tab, setTab] = useState<'piezo' | 'audio'>('piezo');
  const L = snap.latest;
  const sim = L?.assessment.similarity ?? 100;
  const anom = L?.assessment.anomaly ?? 0;
  const level = deviationLevel(anom);
  const color = tab === 'piezo' ? COLORS.piezo : COLORS.audio;
  const baseKey = tab === 'piezo' ? 'basePiezo' : 'baseAudio';
  const curKey = tab === 'piezo' ? 'curPiezo' : 'curAudio';

  return (
    <Section
      index="04"
      title="Inteligencia artificial · Línea basal ValveSense"
      subtitle="Detección de desviaciones respecto del comportamiento de referencia del propio prototipo"
      aside="Modelo estadístico multivariante + correlación de forma de onda"
    >
      <div className="grid g-ai">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <span className="kicker">Estado</span>
            <StatusBadge level={level} large />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <SimilarityGauge value={sim} />
          </div>
          <AnomalyScale value={anom} />
          <div className="divider" style={{ margin: 0 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div className="kicker">Regularidad</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 650 }}>
                {fmt(L?.record.regularity, 1)} <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>%</span>
              </div>
            </div>
            <div>
              <div className="kicker">Correlación de forma</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 650 }}>
                {fmt(L?.assessment.shapeCorrelation, 2)}
              </div>
            </div>
          </div>
          <p className="note" style={{ margin: 0, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            {interpretation(level, L?.assessment.deviations ?? [])}
            <br />
            <span style={{ color: 'var(--muted)' }}>Indicador técnico del prototipo. No constituye un diagnóstico.</span>
          </p>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h3 className="card-title">Patrón basal vs patrón actual</h3>
                <p className="card-sub">Envolvente por fase del ciclo · promedio de los últimos 4 ciclos</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div className="legend">
                  <span>
                    <i className="dash" />
                    Patrón basal
                  </span>
                  <span>
                    <i style={{ background: color }} />
                    Patrón actual
                  </span>
                </div>
                <div className="tabs">
                  <button className={tab === 'piezo' ? 'active' : ''} onClick={() => setTab('piezo')}>
                    Vibración
                  </button>
                  <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}>
                    Audio
                  </button>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={snap.envelopes} margin={margin}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="phase" type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(v: number) => `${v} %`} {...axis} />
                <YAxis width={52} tickFormatter={(v: number) => fmt(v, tab === 'piezo' ? 2 : 3)} {...axis} />
                <Tooltip
                  isAnimationActive={false}
                  cursor={{ stroke: '#9fb0c0', strokeDasharray: '3 3' }}
                  content={(p) => <ChartTooltip {...p} decimals={4} labelFormatter={(l) => `Fase ${fmt(Number(l), 0)} % del ciclo`} />}
                />
                <Area dataKey={baseKey} name="Patrón basal" type="monotone" stroke={COLORS.baseline} strokeDasharray="5 4" strokeWidth={1.6} fill={COLORS.baseline} fillOpacity={0.1} isAnimationActive={false} />
                <Line dataKey={curKey} name="Patrón actual" type="monotone" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-head">
              <div>
                <h3 className="card-title">Contribución por descriptor</h3>
                <p className="card-sub">Qué variables explican la diferencia con la línea basal (último ciclo)</p>
              </div>
            </div>
            <DeviationBars deviations={L?.assessment.deviations ?? []} />
          </div>
        </div>
      </div>
    </Section>
  );
}
