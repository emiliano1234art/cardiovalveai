import { useMemo } from 'react';
import { period, sampleSignals, type SimParams } from '../sim/model';
import { Plot, pathFrom } from './Plot';

/** Un ciclo de vibración y sonido en SVG (impresión y comparación estática). */
export function StaticSignals({ params, width, height }: { params: SimParams; width: number; height: number }) {
  const T = period(params);
  const s = useMemo(() => sampleSignals(T, 2 * T, params, 6000), [params, T]);
  const rel = Array.from(s.t, (t) => t - T);
  const h = height / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * T);
  const fmt = (v: number) => `${v.toFixed(2).replace('.', ',')} s`;
  return (
    <div>
      {(
        [
          ['vib', 'x(t) [V]', 'var(--sig-vib)'],
          ['snd', 's(t) [u.a.]', 'var(--sig-snd)'],
        ] as const
      ).map(([k, label, color], i) => (
        <Plot key={k} width={width} height={h} x={[0, T]} y={[-1.6, 1.6]} yTicks={[-1.5, 0, 1.5]} xTicks={i === 1 ? ticks : []} xFmt={fmt} yLabel={label} yFmt={(v) => String(v).replace('.', ',')}>
          {(sc) => (
            <>
              {s.events.map((e, j) => (
                <line key={j} x1={sc.sx(e.t - T)} x2={sc.sx(e.t - T)} y1={sc.y0} y2={sc.y0 + sc.h} stroke={e.kind === 'close' ? 'var(--amber)' : 'var(--muted)'} strokeDasharray="3 4" />
              ))}
              <path d={pathFrom(rel, s[k], sc.sx, (v) => sc.sy(Math.max(-1.6, Math.min(1.6, v))))} fill="none" stroke={color} strokeWidth={1.2} />
            </>
          )}
        </Plot>
      ))}
    </div>
  );
}
