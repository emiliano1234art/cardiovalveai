import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LiveSnapshot } from '../LiveEngine';

const AXIS = { stroke: '#5d8790', fontSize: 11, tickLine: false, axisLine: { stroke: '#cfe6e8' } } as const;

export function LiveChart({ snap }: { snap: LiveSnapshot }) {
  return (
    <section className="lv-card">
      <div className="lv-card-head">
        <div>
          <h2 className="lv-card-title">Ángulo en el tiempo</h2>
          <p className="lv-card-sub">Últimos 12 segundos</p>
        </div>
        <div className="lv-legend">
          <span><i style={{ background: 'var(--brand)' }} />Mostrado</span>
          <span><i style={{ background: 'var(--sky)' }} />Medido (Hall)</span>
          <span><i className="dash" />Servo</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={snap.chart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e3f1f2" vertical={false} />
          <XAxis dataKey="s" type="number" domain={[-12, 0]} ticks={[-12, -9, -6, -3, 0]} tickFormatter={(v: number) => `${v} s`} {...AXIS} />
          <YAxis domain={[0, 90]} ticks={[0, 30, 60, 90]} width={40} tickFormatter={(v: number) => `${v}°`} {...AXIS} />
          <ReferenceLine y={snap.angles.SANO} stroke="#17b57a" strokeOpacity={0.55} strokeDasharray="4 4" />
          <Tooltip
            isAnimationActive={false}
            contentStyle={{ background: '#ffffff', border: '1px solid #cfe6e8', borderRadius: 8, fontSize: 12, color: '#0d3b44' }}
            labelFormatter={(l) => `${Number(l).toFixed(1)} s`}
            formatter={(v, name) => [`${Number(v).toFixed(1)}°`, String(name)]}
          />
          <Line dataKey="servo" name="Servo" stroke="#7ba3ab" strokeDasharray="4 4" strokeWidth={1.4} dot={false} isAnimationActive={false} />
          <Line dataKey="hall" name="Medido (Hall)" stroke="#38b6f2" strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Line dataKey="shown" name="Mostrado" stroke="#10b3a5" strokeWidth={2.6} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
