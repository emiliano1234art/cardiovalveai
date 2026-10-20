import { useMemo } from 'react';
import { rPeak, sampleEcg, sampleSignals, type SimParams } from '../sim/model';
import { Plot, pathFrom } from './Plot';

type Lane = 'ecg' | 'vib' | 'snd';

/** Un latido (desde el pico R) de ECG, vibración y sonido en SVG (impresión/comparación). */
export function StaticSignals({
  params,
  width,
  height,
  lanes = ['vib', 'snd'],
  beat = 3,
  compareTo,
}: {
  params: SimParams;
  width: number;
  height: number;
  lanes?: Lane[];
  beat?: number;
  compareTo?: SimParams;
}) {
  const r0 = rPeak(beat, params);
  const r1 = rPeak(beat + 1, params);
  const T = r1 - r0;
  const s = useMemo(() => sampleSignals(r0, r1, params, 6000), [params, r0, r1]);
  const e = useMemo(() => sampleEcg(r0 - 0.1, r1, params, 500), [params, r0, r1]);
  const c = useMemo(() => (compareTo ? sampleSignals(rPeak(beat, compareTo), rPeak(beat, compareTo) + T, compareTo, 6000) : null), [compareTo, beat, T]);
  const rel = Array.from(s.t, (t) => t - r0);
  const h = height / lanes.length;
  const ticks = [0, 0.25, 0.5, 0.75].map((k) => k * T);
  const fmt = (v: number) => `${(v * 1000).toFixed(0)} ms`;
  return (
    <div>
      {lanes.map((ln, i) => {
        const last = i === lanes.length - 1;
        if (ln === 'ecg')
          return (
            <Plot key={ln} width={width} height={h} x={[0, T]} y={[-0.5, 1.3]} yTicks={[0, 1]} xTicks={last ? ticks : []} xFmt={fmt} yLabel="ECG [mV]">
              {(sc) => (
                <path
                  d={pathFrom(
                    Array.from(e.t, (t) => t - r0),
                    e.v,
                    sc.sx,
                    sc.sy,
                  )}
                  fill="none"
                  stroke="var(--sig-ecg)"
                  strokeWidth={1.6}
                />
              )}
            </Plot>
          );
        const data = ln === 'vib' ? s.vib : s.snd;
        const color = ln === 'vib' ? 'var(--sig-vib)' : 'var(--sig-snd)';
        const clip = (v: number) => Math.max(-1.8, Math.min(1.8, v));
        return (
          <Plot
            key={ln}
            width={width}
            height={h}
            x={[0, T]}
            y={[-1.8, 1.8]}
            yTicks={[-1.5, 0, 1.5]}
            xTicks={last ? ticks : []}
            xFmt={fmt}
            yLabel={ln === 'vib' ? 'piezo [V]' : 'MEMS [u.a.]'}
            yFmt={(v) => String(v).replace('.', ',')}
          >
            {(sc) => (
              <>
                {s.events.map((ev, j) => (
                  <line
                    key={j}
                    x1={sc.sx(ev.t - r0)}
                    x2={sc.sx(ev.t - r0)}
                    y1={sc.y0}
                    y2={sc.y0 + sc.h}
                    stroke={ev.kind === 'close' ? 'var(--amber)' : 'var(--muted)'}
                    strokeDasharray="3 4"
                  />
                ))}
                {c && (
                  <path
                    d={pathFrom(
                      Array.from(c.t, (t) => t - c.t[0]),
                      ln === 'vib' ? c.vib : c.snd,
                      sc.sx,
                      (v) => sc.sy(clip(v)),
                    )}
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth={1}
                    opacity={0.45}
                  />
                )}
                <path d={pathFrom(rel, data, sc.sx, (v) => sc.sy(clip(v)))} fill="none" stroke={color} strokeWidth={1.2} />
              </>
            )}
          </Plot>
        );
      })}
    </div>
  );
}
