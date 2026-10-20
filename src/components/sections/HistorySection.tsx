import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MODES, THRESHOLDS } from '../../config/modes';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import { downloadCsv, downloadJson } from '../../lib/export';
import { syntheticRehabHistory } from '../../simulation/PatientSimulator';
import type { CycleRecord, ExperimentalMode, RehabSession } from '../../types/valvesense';
import { axis, COLORS, grid, margin, numTick } from '../charts/chartTheme';
import { fmt } from '../../lib/format';
import { ChartTooltip } from '../charts/ChartTooltip';
import { IconHistory } from '../ui/icons';
import { Section } from '../ui/Section';

const VISIBLE = 240;

interface Segment {
  from: number;
  to: number;
  mode: ExperimentalMode;
}

function segments(records: CycleRecord[]): Segment[] {
  const out: Segment[] = [];
  for (const r of records) {
    if (!r.mode) continue;
    const last = out.at(-1);
    if (last && last.mode === r.mode) last.to = r.cycle_number;
    else out.push({ from: r.cycle_number, to: r.cycle_number, mode: r.mode });
  }
  return out;
}

interface MiniProps {
  title: string;
  sub: string;
  data: CycleRecord[];
  dataKey: keyof CycleRecord;
  color: string;
  unit: string;
  domain: [number | 'auto', number | 'auto'];
  decimals: number;
  segs: Segment[];
  refs?: { y: number; label: string; color: string }[];
}

function MiniHistory({ title, sub, data, dataKey, color, unit, domain, decimals, segs, refs = [] }: MiniProps) {
  const xMin = data[0]?.cycle_number ?? 0;
  const xMax = data.at(-1)?.cycle_number ?? 1;
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">{title}</h3>
          <p className="card-sub">{sub}</p>
        </div>
        <span className="num" style={{ fontSize: 18, fontWeight: 650 }}>
          {data.length ? fmt(data.at(-1)![dataKey] as number, decimals) : '—'}
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginLeft: 3 }}>{unit}</span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={data} margin={margin}>
          <CartesianGrid {...grid} />
          {segs
            .filter((s) => s.mode !== 'normal' && s.to >= xMin)
            .map((s) => (
              <ReferenceArea
                key={s.from}
                x1={Math.max(s.from, xMin)}
                x2={s.to}
                fill="#0b1f33"
                fillOpacity={0.04}
                strokeOpacity={0}
                label={{ value: MODES[s.mode].short, position: 'insideTopLeft', fontSize: 9.5, fill: '#7d8da0' }}
              />
            ))}
          {refs.map((r) => (
            <ReferenceLine key={r.y} y={r.y} stroke={r.color} strokeDasharray="4 4" strokeOpacity={0.7} label={{ value: r.label, position: 'insideBottomRight', fontSize: 10, fill: r.color }} />
          ))}
          <XAxis dataKey="cycle_number" type="number" domain={[xMin, xMax]} allowDecimals={false} tickCount={6} {...axis} />
          <YAxis domain={domain} width={48} tickFormatter={numTick} {...axis} />
          <Tooltip
            isAnimationActive={false}
            cursor={{ stroke: '#9fb0c0', strokeDasharray: '3 3' }}
            content={(p) => (
              <ChartTooltip
                {...p}
                decimals={decimals}
                units={{ [dataKey]: unit }}
                labelFormatter={(l) => {
                  const rec = data.find((d) => d.cycle_number === Number(l));
                  return `Ciclo ${l}${rec?.mode ? ` · ${MODES[rec.mode].label}` : ''}`;
                }}
              />
            )}
          />
          <Line dataKey={dataKey} name={title} stroke={color} strokeWidth={1.8} dot={false} isAnimationActive={false} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const REHAB_METRICS: { key: keyof RehabSession; label: string; unit: string }[] = [
  { key: 'duration_min', label: 'Duración', unit: 'min' },
  { key: 'peak_hr', label: 'FC pico', unit: 'lpm' },
  { key: 'hr_recovery', label: 'Recuperación FC', unit: 'lpm' },
  { key: 'borg_peak', label: 'Borg pico', unit: '' },
];

export function HistorySection({ snap, onExport }: { snap: EngineSnapshot; onExport: () => CycleRecord[] }) {
  const data = snap.records.slice(-VISIBLE);
  const segs = useMemo(() => segments(data), [data]);
  const sessions = useMemo(() => syntheticRehabHistory(12), []);
  const [metric, setMetric] = useState(REHAB_METRICS[0]);

  return (
    <Section
      index="07"
      icon={<IconHistory />}
      kinds={snap.sourceKind === 'simulation' ? ['synthetic'] : ['experimental']}
      title="Historial"
      subtitle="Cómo cambian las mediciones ciclo a ciclo. Zonas grises: condición alterada."
      explain="history"
      aside={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => downloadCsv(onExport(), 'valvesense_sesion.csv')}>
            ⤓ Descargar CSV
          </button>
          <button className="btn" onClick={() => downloadJson(onExport(), 'valvesense_sesion.json')}>
            ⤓ JSON
          </button>
          <a className="btn" href={`${import.meta.env.BASE_URL}data/valvesense_sample_dataset.csv`} download>
            Dataset de ejemplo
          </a>
        </div>
      }
    >
      <div className="grid g-2">
        <MiniHistory title="Similitud con el patrón de referencia" sub="100 % = igual al patrón normal" data={data} dataKey="baseline_similarity" color={COLORS.piezo} unit="%" domain={[0, 100]} decimals={1} segs={segs} />
        <MiniHistory
          title="Cambios detectados"
          sub="Líneas: cambio / desviación"
          data={data}
          dataKey="anomaly_score"
          color={COLORS.piezo}
          unit=""
          domain={[0, 1]}
          decimals={2}
          segs={segs}
          refs={[
            { y: THRESHOLDS.mild, label: 'cambio', color: COLORS.warn },
            { y: THRESHOLDS.major, label: 'desviación', color: COLORS.crit },
          ]}
        />
        <MiniHistory title="Latidos por minuto (ECG)" sub="Un cambio de ritmo no es una falla" data={data} dataKey="ecg_bpm" color="#d0473e" unit="lpm" domain={[40, 130]} decimals={0} segs={segs} />
        <MiniHistory
          title="¿La válvula sigue al corazón?"
          sub="Diferencia entre ciclo y latido (ms)"
          data={data}
          dataKey="sync_error_ms"
          color={COLORS.piezo}
          unit="ms"
          domain={[0, 150]}
          decimals={0}
          segs={segs}
          refs={[{ y: 60, label: 'tolerancia', color: COLORS.warn }]}
        />
        <MiniHistory title="Regularidad" sub="Qué tan parejo es el ritmo de la válvula" data={data} dataKey="regularity" color={COLORS.piezo} unit="%" domain={[0, 100]} decimals={1} segs={segs} />
        <MiniHistory title="Tono principal del sonido" sub="Un valor por ciclo" data={data} dataKey="dominant_frequency" color={COLORS.audio} unit="Hz" domain={[0, 2500]} decimals={0} segs={segs} />
      </div>

      <div className="card" style={{ borderStyle: 'dashed' }}>
        <div className="card-head">
          <div>
            <h3 className="card-title">
              Sesiones de rehabilitación <span className="synthetic-label" style={{ padding: '2px 8px', fontSize: 10 }}>SINTÉTICO</span>
            </h3>
            <p className="card-sub">Paciente simulado {`PS-0001`} · 12 sesiones ficticias</p>
          </div>
          <div className="tabs">
            {REHAB_METRICS.map((m) => (
              <button key={m.key} className={metric.key === m.key ? 'active' : ''} onClick={() => setMetric(m)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sessions} margin={margin} barCategoryGap="28%">
            <CartesianGrid {...grid} />
            <XAxis dataKey="session" tickFormatter={(v: number) => `S${v}`} {...axis} />
            <YAxis width={48} {...axis} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ fill: 'rgba(91,75,196,.06)' }}
              content={(p) => (
                <ChartTooltip
                  {...p}
                  decimals={0}
                  units={{ [metric.key]: metric.unit }}
                  labelFormatter={(l) => {
                    const s = sessions.find((x) => x.session === Number(l));
                    return s ? `Sesión ${l} · ${s.date} · similitud media ${s.mean_similarity} %` : String(l);
                  }}
                />
              )}
            />
            <Bar dataKey={metric.key} name={metric.label} fill={COLORS.patient} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
