import { useEffect, useRef } from 'react';
import type { SpectrogramBuffer } from '../../engine/SpectrogramBuffer';
import { fmt } from '../../lib/format';

interface Props {
  spectro: SpectrogramBuffer;
  version: number;
  /** frecuencia dominante a marcar (Hz) */
  marker?: number;
  height?: number;
  fmax?: number;
}

const DYN_RANGE_DB = 50;

/** Escala secuencial de un solo tono: blanco → turquesa → azul profundo. */
const STOPS: [number, [number, number, number]][] = [
  [0, [255, 255, 255]],
  [0.25, [214, 240, 242]],
  [0.5, [120, 202, 205]],
  [0.72, [24, 150, 166]],
  [0.88, [10, 98, 140]],
  [1, [8, 38, 72]],
];

function colormap(x: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [x0, c0] = STOPS[i - 1];
      const [x1, c1] = STOPS[i];
      const f = (x - x0) / (x1 - x0);
      return [c0[0] + f * (c1[0] - c0[0]), c0[1] + f * (c1[1] - c0[1]), c0[2] + f * (c1[2] - c0[2])];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

const LUT = Array.from({ length: 256 }, (_, i) => colormap(i / 255));
export const SPECTRO_GRADIENT = `linear-gradient(90deg, ${STOPS.map(([x, c]) => `rgb(${c.join(',')}) ${x * 100}%`).join(', ')})`;

export function Spectrogram({ spectro, version, marker, height = 200, fmax = 4000 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const W = spectro.maxColumns;
    const nyq = spectro.fs / 2;
    const H = Math.round((spectro.bins * Math.min(fmax, nyq)) / nyq);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    img.data.fill(255);
    const cols = spectro.columns;
    const offset = W - cols.length;
    const top = spectro.refDb;
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      for (let k = 0; k < H; k++) {
        const v = Math.max(0, Math.min(1, (col[k] - (top - DYN_RANGE_DB)) / DYN_RANGE_DB));
        const [r, g, b] = LUT[Math.round(v * 255)];
        const idx = ((H - 1 - k) * W + (c + offset)) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [spectro, version, fmax]);

  const kHz = Array.from({ length: Math.floor(fmax / 1000) + 1 }, (_, i) => i);
  const seconds = spectro.seconds;
  const markerPct = marker ? (marker / fmax) * 100 : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gridTemplateRows: `${height}px 22px`, columnGap: 8 }}>
      <div style={{ position: 'relative' }}>
        {kHz.map((k) => (
          <span
            key={k}
            className="num"
            style={{ position: 'absolute', right: 0, bottom: `${(k / (fmax / 1000)) * 100}%`, transform: 'translateY(50%)', fontSize: 11, color: '#7d8da0' }}
          >
            {k} kHz
          </span>
        ))}
      </div>
      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} aria-label="Espectrograma frecuencia–tiempo del audio" />
        {markerPct !== null && markerPct < 100 && (
          <div
            title={`Frecuencia dominante ${fmt(marker, 0)} Hz`}
            style={{ position: 'absolute', left: 0, right: 0, bottom: `${markerPct}%`, borderTop: '1px dashed rgba(201,55,47,.75)', transition: 'bottom .5s' }}
          >
            <span style={{ position: 'absolute', right: 6, top: -18, fontSize: 10.5, color: '#0b1f33', background: 'rgba(255,255,255,.85)', padding: '1px 5px', borderRadius: 4 }}>
              f dom · {fmt(marker, 0)} Hz
            </span>
          </div>
        )}
      </div>
      <div />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#7d8da0', paddingTop: 4 }} className="num">
        {Array.from({ length: 7 }, (_, i) => -seconds + (i * seconds) / 6).map((t, i) => (
          <span key={i}>{i === 6 ? 'ahora' : `${fmt(t, 1)} s`}</span>
        ))}
      </div>
    </div>
  );
}
