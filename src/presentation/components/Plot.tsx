import { useEffect, useRef, type ReactNode } from 'react';
import { sim } from '../sim/store';

export interface Scales {
  sx: (x: number) => number;
  sy: (y: number) => number;
  w: number;
  h: number;
  x0: number;
  y0: number;
}

interface Props {
  width: number;
  height: number;
  x: [number, number];
  y: [number, number];
  xTicks?: number[];
  yTicks?: number[];
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
  xLabel?: string;
  yLabel?: string;
  children: (s: Scales) => ReactNode;
  margin?: { l: number; r: number; t: number; b: number };
}

/** Gráfico SVG con ejes comunes (usado en pantalla e impresión). */
export function Plot({ width, height, x, y, xTicks = [], yTicks = [], xFmt = String, yFmt = String, xLabel, yLabel, children, margin }: Props) {
  const m = margin ?? { l: 70, r: 16, t: 14, b: xLabel ? 52 : 34 };
  const w = width - m.l - m.r;
  const h = height - m.t - m.b;
  const sx = (v: number) => m.l + ((v - x[0]) / (x[1] - x[0])) * w;
  const sy = (v: number) => m.t + (1 - (v - y[0]) / (y[1] - y[0])) * h;
  const clipId = `clip${Math.round(m.l + w * 7 + h * 13 + x[1] * 1000 + y[1])}`;
  return (
    <svg className="v-plot" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line className="gridline" x1={m.l} x2={m.l + w} y1={sy(t)} y2={sy(t)} />
          <text x={m.l - 10} y={sy(t)} textAnchor="end" dominantBaseline="middle">
            {yFmt(t)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x${t}`} x={sx(t)} y={m.t + h + 22} textAnchor="middle">
          {xFmt(t)}
        </text>
      ))}
      <line className="axis" x1={m.l} x2={m.l + w} y1={sy(Math.max(y[0], Math.min(y[1], 0)))} y2={sy(Math.max(y[0], Math.min(y[1], 0)))} />
      <line className="axis" x1={m.l} x2={m.l} y1={m.t} y2={m.t + h} />
      {xLabel && (
        <text x={m.l + w / 2} y={height - 6} textAnchor="middle" style={{ fontSize: 15 }}>
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={16} y={m.t + h / 2} textAnchor="middle" transform={`rotate(-90 16 ${m.t + h / 2})`} style={{ fontSize: 15 }}>
          {yLabel}
        </text>
      )}
      <clipPath id={clipId}>
        <rect x={m.l} y={m.t - 2} width={w} height={h + 4} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>{children({ sx, sy, w, h, x0: m.l, y0: m.t })}</g>
    </svg>
  );
}

export function pathFrom(xs: ArrayLike<number>, ys: ArrayLike<number>, sx: (v: number) => number, sy: (v: number) => number) {
  let d = '';
  for (let i = 0; i < xs.length; i++) d += `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)} ${sy(ys[i]).toFixed(1)}`;
  return d;
}

/** Cursor vertical sincronizado con el reloj de simulación (posición dentro del ciclo). */
export function PhaseCursor({ s, T, offset = 0, show = true }: { s: Scales; T: number; offset?: number; show?: boolean }) {
  const ref = useRef<SVGLineElement>(null);
  useEffect(() => {
    if (!show) return;
    return sim.onFrame((t) => {
      const ph = ((t % T) + T) % T;
      const x = s.sx(offset + ph);
      ref.current?.setAttribute('x1', String(x));
      ref.current?.setAttribute('x2', String(x));
    });
  }, [s, T, offset, show]);
  if (!show) return null;
  return <line ref={ref} className="cursor" y1={s.y0} y2={s.y0 + s.h} />;
}
