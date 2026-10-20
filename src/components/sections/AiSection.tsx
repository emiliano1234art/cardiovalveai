import { useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { deviationLevel } from '../../analysis/ValveAnalysisPipeline';
import { THRESHOLDS } from '../../config/modes';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import { fmt, signed } from '../../lib/format';
import type { DeviationLevel, FeatureDeviation } from '../../types/valvesense';
import { axis, COLORS, grid, margin } from '../charts/chartTheme';
import { ChartTooltip } from '../charts/ChartTooltip';
import { GraphExplanation, InfoTooltip } from '../explain/GraphExplanation';
import { InteractiveChartLegend, toggleIn } from '../explain/InteractiveChartLegend';
import { VERDICT } from '../../lib/verdict';
import { IconBrain, IconSpectrum, IconTarget } from '../ui/icons';
import { Section } from '../ui/Section';
import { LEVEL_COLOR } from '../ui/StatusBadge';

function SimilarityGauge({ value }: { value: number }) {
  const r = 62;
  const c = Math.PI * r; // semicircunferencia
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg viewBox="0 0 160 112" width="100%" style={{ maxWidth: 230 }} role="img" aria-label={`Similitud con el patrón de referencia ${v.toFixed(0)} %`}>
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
        SIMILITUD CON LA REFERENCIA
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
        <span className="kicker">Cambios detectados</span>
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
          <div className="zbar-row" key={d.key} title={`Ahora ${fmt(d.value, 2)} ${d.unit} · referencia ${fmt(d.baseline, 2)} ${d.unit}`}>
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
        Marcas: cambio (2,5σ) y desviación (4σ).
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
    return 'Vibración y sonido similares al patrón de referencia.';
  const base = level === 'normal' ? 'Similar a la referencia; ' : level === 'mild' ? 'Cambio detectado; ' : 'Desviación experimental; ';
  return top.length ? `${base}lo que más cambió: ${top.join(', ')}.` : `${base}los ciclos varían entre sí.`;
}

export function AiSection({ snap, onRecalibrate }: { snap: EngineSnapshot; onRecalibrate: () => void }) {
  const [tab, setTab] = useState<'piezo' | 'audio'>('piezo');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const L = snap.latest;
  const ready = !!L && !!snap.baseline;
  const sim = L?.assessment.similarity ?? 0;
  const anom = L?.assessment.anomaly ?? 0;
  const level = deviationLevel(anom);
  const color = tab === 'piezo' ? COLORS.piezo : COLORS.audio;
  const baseKey = tab === 'piezo' ? 'basePiezo' : 'baseAudio';
  const curKey = tab === 'piezo' ? 'curPiezo' : 'curAudio';
  const V = ready ? VERDICT[L!.record.verdict] : null;
  const capturing = snap.captureProgress !== null;

  return (
    <Section
      index="05"
      icon={<IconBrain />}
      title="Análisis inteligente"
      subtitle="Compara la válvula con su propio patrón normal y señala las diferencias."
      kinds={snap.sourceKind === 'simulation' ? ['synthetic'] : ['experimental']}
      explain="ai"
    >
      {!snap.baseline ? (
        <div className="card empty-card">
          <IconBrain size={28} />
          <div>
            <b>{capturing ? `Registrando el patrón de referencia… ${Math.round((snap.captureProgress ?? 0) * 100)} %` : 'Falta el patrón de referencia'}</b>
            <p>Con el prototipo funcionando normalmente, registra 30 ciclos. Luego la IA comparará cada ciclo con ese patrón.</p>
          </div>
          <button className="btn primary" onClick={onRecalibrate} disabled={capturing || !snap.hasData}>
            ↻ Registrar patrón
          </button>
        </div>
      ) : (
        <div className="grid g-ai" id="learn-ai">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="verdict" style={V ? { borderColor: V.color, background: V.bg } : undefined}>
              <span className="kicker">¿Falla o cambio de ritmo?</span>
              <div className="verdict-label" style={{ color: V?.color }}>
                {V ? `${V.icon} ${V.label}` : 'Esperando el primer ciclo…'}
              </div>
              {V && <p>{V.text}</p>}
            </div>
            <div className="ai-gauge">
              <SimilarityGauge value={ready ? sim : 0} />
              <InfoTooltip id="similarity" />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <AnomalyScale value={ready ? anom : 0} />
              </div>
              <InfoTooltip id="anomaly" />
            </div>
            <div className="mini-stats">
              <div title="Qué tan estable es el ritmo de la válvula respecto de los latidos">
                <span className="kicker">Regularidad</span>
                <b className="num">{fmt(L?.record.regularity, 0)} %</b>
              </div>
              <div title="Parecido de la forma de la vibración y el sonido (1 = idéntica)">
                <span className="kicker">Forma de la señal</span>
                <b className="num">{fmt(L?.assessment.shapeCorrelation, 2)}</b>
              </div>
            </div>
            <p className="note ai-note">
              {ready ? interpretation(level, L!.assessment.deviations) : '—'}
              <br />
              <span style={{ color: 'var(--muted)' }}>Indicador experimental · no es un diagnóstico.</span>
            </p>
          </div>

          <div className="stack">
            <div className="card sig-card">
              <div className="sig-head">
                <span className="sig-icon">
                  <IconTarget />
                </span>
                <div className="sig-titles">
                  <h3>Normal vs. ahora</h3>
                  <p>Promedio de los últimos 4 ciclos, desde que la válvula empieza a abrir</p>
                </div>
                <GraphExplanation id="comparison" />
              </div>
              <div className="sig-tools">
                <InteractiveChartLegend
                  items={[
                    { key: 'base', label: 'Patrón normal', color: COLORS.baseline, type: 'dash' },
                    { key: 'cur', label: 'Ahora', color },
                  ]}
                  hidden={hidden}
                  onToggle={(k) => setHidden((h) => toggleIn(h, k))}
                />
                <div className="zoom" role="tablist" aria-label="Señal">
                  <button className={tab === 'piezo' ? 'active' : ''} onClick={() => setTab('piezo')} role="tab" aria-selected={tab === 'piezo'}>
                    Vibración
                  </button>
                  <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')} role="tab" aria-selected={tab === 'audio'}>
                    Sonido
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={snap.envelopes} margin={margin}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="phase" type="number" domain={[0, 500]} ticks={[0, 100, 200, 300, 400, 500]} tickFormatter={(v: number) => `${v} ms`} {...axis} />
                  <YAxis width={46} tickFormatter={(v: number) => fmt(v, tab === 'piezo' ? 2 : 3)} {...axis} />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ stroke: '#9fb0c0', strokeDasharray: '3 3' }}
                    content={(p) => <ChartTooltip {...p} decimals={4} labelFormatter={(l) => `${fmt(Number(l), 0)} ms desde que empieza a abrir`} />}
                  />
                  {!hidden.has('base') && (
                    <Area dataKey={baseKey} name="Patrón normal" type="monotone" stroke={COLORS.baseline} strokeDasharray="5 4" strokeWidth={1.6} fill={COLORS.baseline} fillOpacity={0.1} isAnimationActive={false} />
                  )}
                  {!hidden.has('cur') && <Line dataKey={curKey} name="Ahora" type="monotone" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="card sig-card">
              <div className="sig-head">
                <span className="sig-icon">
                  <IconSpectrum />
                </span>
                <div className="sig-titles">
                  <h3>¿Qué cambió?</h3>
                  <p>Barras largas = lo que más se aleja de lo normal (último ciclo)</p>
                </div>
                <GraphExplanation id="descriptors" />
              </div>
              <DeviationBars deviations={ready ? L!.assessment.deviations : []} />
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
