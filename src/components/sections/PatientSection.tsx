import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { deviationLevel } from '../../analysis/ValveAnalysisPipeline';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import { fmt, mmss } from '../../lib/format';
import { SYNTHETIC_PATIENT } from '../../simulation/PatientSimulator';
import type { PatientSnapshot } from '../../types/valvesense';
import { axis, COLORS, grid, margin } from '../charts/chartTheme';
import { ChartTooltip } from '../charts/ChartTooltip';
import { Section } from '../ui/Section';
import { LEVEL_LABEL } from '../ui/StatusBadge';

const STAGES: PatientSnapshot['session_stage'][] = ['reposo', 'calentamiento', 'ejercicio', 'enfriamiento', 'recuperación'];

function Tile({ label, value, unit, foot }: { label: string; value: string; unit?: string; foot?: string }) {
  return (
    <div className="card metric compact">
      <span className="metric-accent" style={{ background: COLORS.patient }} />
      <div className="metric-label">{label}</div>
      <div className="metric-value num" style={{ fontSize: value.length > 12 ? 15 : undefined, lineHeight: value.length > 12 ? 1.3 : undefined }}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="metric-foot">{foot}</div>
    </div>
  );
}

export function PatientSection({ snap }: { snap: EngineSnapshot }) {
  const p = snap.patient;
  const L = snap.latest;
  const level = deviationLevel(L?.assessment.anomaly ?? 0);
  const t0 = snap.hrTrend[0]?.t ?? 0;
  const trend = snap.hrTrend.map((d) => ({ ...d, x: d.t - t0 - (snap.hrTrend.at(-1)!.t - t0) }));

  return (
    <Section index="05" title="Respuesta funcional" subtitle="Integración conceptual de datos del dispositivo con la respuesta al ejercicio (Kinesiología)">
      <div className="synthetic">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <span className="synthetic-label">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
              <circle cx="8" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M2.5 14c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            PACIENTE SIMULADO — DATOS SINTÉTICOS, NO CLÍNICOS
          </span>
          <span className="note">
            <b className="mono">{SYNTHETIC_PATIENT.id}</b> · {SYNTHETIC_PATIENT.alias} · {SYNTHETIC_PATIENT.age} años (ficticio) · {SYNTHETIC_PATIENT.program}
          </span>
        </div>

        {/* concepto de integración */}
        <div className="flow" style={{ marginBottom: 14 }}>
          <div className="flow-node">
            <h4>Datos de válvula</h4>
            <div className="kv">
              Similitud basal <b>{fmt(L?.assessment.similarity, 1)} %</b>
            </div>
            <div className="kv">
              Anomaly score <b>{fmt(L?.assessment.anomaly, 2)}</b>
            </div>
            <div className="kv">
              Frecuencia <b>{fmt(L?.record.bpm, 0)} lpm</b>
            </div>
          </div>
          <div className="flow-op">+</div>
          <div className="flow-node">
            <h4>Respuesta funcional</h4>
            <div className="kv">
              FC <b>{p.heart_rate} lpm</b>
            </div>
            <div className="kv">
              Borg <b>{p.borg} / 20</b>
            </div>
            <div className="kv">
              Etapa <b style={{ textTransform: 'capitalize' }}>{p.session_stage}</b>
            </div>
          </div>
          <div className="flow-op">→</div>
          <div className="flow-node result">
            <h4>Seguimiento integrado</h4>
            <div className="kv">
              Estado del prototipo <b>{LEVEL_LABEL[level]}</b>
            </div>
            <div className="kv">
              Carga de la sesión <b>{p.activity}</b>
            </div>
            <div className="kv">
              Línea de tiempo común <b>{snap.records.length} ciclos · {mmss(p.t_s)}</b>
            </div>
          </div>
        </div>

        {/* etapas de la sesión */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {STAGES.map((s) => (
            <div key={s} style={{ flex: 1 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: s === p.session_stage ? COLORS.patient : '#e5e2f6',
                  transition: 'background .5s',
                }}
              />
              <div style={{ fontSize: 11, marginTop: 4, color: s === p.session_stage ? 'var(--text)' : 'var(--muted)', fontWeight: s === p.session_stage ? 600 : 400, textTransform: 'capitalize' }}>
                {s}
              </div>
            </div>
          ))}
        </div>

        <div className="grid g-4" style={{ marginBottom: 14 }}>
          <Tile label="Frecuencia cardíaca" value={String(p.heart_rate)} unit="lpm" foot="Sintética · modelo de 1.er orden" />
          <Tile label="SpO₂" value={fmt(p.spo2, 1)} unit="%" foot="Sintética" />
          <Tile label="Actividad" value={p.activity} foot={`Intensidad relativa ${Math.round(p.activity_level * 100)} %`} />
          <Tile label="Esfuerzo percibido (Borg)" value={String(p.borg)} unit="/ 20" foot="Escala 6–20" />
          <Tile label="Síntomas" value={p.symptoms} foot="Registro ficticio" />
          <Tile label="Duración del ejercicio" value={mmss(p.exercise_duration_s)} unit="min" foot="Sesión en curso" />
          <Tile
            label="Recuperación de FC (1 min)"
            value={p.hr_recovery_1min !== null ? String(p.hr_recovery_1min) : '—'}
            unit={p.hr_recovery_1min !== null ? 'lpm' : undefined}
            foot={p.hr_recovery_1min !== null ? 'Δ FC al minuto de finalizar' : 'Disponible tras la recuperación'}
          />
          <Tile label="Fase de rehabilitación" value={p.rehab_phase} foot="Escenario de ejemplo" />
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Frecuencia cardíaca simulada · últimos 4 min</h3>
              <p className="card-sub">Varía lentamente según la etapa de la sesión sintética</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={trend} margin={margin}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="x" type="number" domain={[-240, 0]} ticks={[-240, -180, -120, -60, 0]} tickFormatter={(v: number) => (v === 0 ? 'ahora' : `${v / 60} min`)} {...axis} />
              <YAxis domain={[50, 130]} ticks={[60, 80, 100, 120]} width={52} {...axis} />
              <Tooltip
                isAnimationActive={false}
                cursor={{ stroke: '#9fb0c0', strokeDasharray: '3 3' }}
                content={(pp) => <ChartTooltip {...pp} decimals={0} units={{ hr: 'lpm' }} labelFormatter={(l) => `${Math.round(Number(l))} s`} />}
              />
              <Line dataKey="hr" name="FC sintética" stroke={COLORS.patient} strokeWidth={2} dot={false} isAnimationActive={false} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}
