import { useRef } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { XY } from '../../lib/RingBuffer';
import { axis, COLORS, grid, margin } from './chartTheme';
import { fmt } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';

interface Props {
  data: XY[];
  open: [number, number][];
  color: string;
  name: string;
  windowS: number;
  height?: number;
  decimals?: number;
}

const niceCeil = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};

/** Señal en tiempo real con bandas de válvula abierta. Eje temporal común (s). */
export function SignalChart({ data, open, color, name, windowS, height = 230, decimals = 3 }: Props) {
  // escala vertical estable: crece de inmediato, decrece lentamente
  const scale = useRef(0);
  let mx = 0;
  for (const p of data) mx = Math.max(mx, Math.abs(p.v));
  scale.current = mx > scale.current ? mx : scale.current * 0.985 + mx * 0.015;
  const lim = niceCeil(Math.max(scale.current * 1.1, 1e-3));
  const ticks = Array.from({ length: windowS * 2 + 1 }, (_, i) => -windowS + i * 0.5);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={margin}>
        <CartesianGrid {...grid} />
        {open.map(([a, b], i) => (
          <ReferenceArea key={i} x1={a} x2={b} y1={-lim} y2={lim} fill={COLORS.openFill} strokeOpacity={0} ifOverflow="hidden" />
        ))}
        <XAxis
          dataKey="t"
          type="number"
          domain={[-windowS, 0]}
          ticks={ticks}
          tickFormatter={(v: number) => (v === 0 ? 'ahora' : `${fmt(v, 1)} s`)}
          {...axis}
        />
        <YAxis domain={[-lim, lim]} ticks={[-lim, -lim / 2, 0, lim / 2, lim]} width={52} tickFormatter={(v: number) => fmt(v, lim < 0.1 ? 3 : 2)} {...axis} />
        <Tooltip
          isAnimationActive={false}
          cursor={{ stroke: '#9fb0c0', strokeDasharray: '3 3' }}
          content={(p) => <ChartTooltip {...p} decimals={decimals} labelFormatter={(l) => `t = ${fmt(Number(l), 3)} s`} />}
        />
        <Line dataKey="v" name={name} stroke={color} strokeWidth={1.4} dot={false} isAnimationActive={false} type="linear" />
      </LineChart>
    </ResponsiveContainer>
  );
}
