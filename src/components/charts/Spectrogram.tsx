import { useEffect, useRef, useState } from 'react';
import { usePlayback } from '../explain/playback';
import { IconClose, IconPlay, IconTarget } from '../ui/icons';
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

interface Sel {
  x: number;
  y: number;
  t: number;
  f: number;
  level: number;
  wide: number;
}

const LEVEL_TEXT = (l: number, wide: number) =>
  l > 0.62 && wide > 0.45
    ? { title: 'Un clic de la válvula', text: 'Sonido breve y fuerte que reparte energía en muchos tonos a la vez: aparece como una franja vertical oscura.' }
    : l > 0.62
      ? { title: 'Tono intenso', text: 'En este momento hay mucha energía en este tono en particular.' }
      : l > 0.3
        ? { title: 'Sonido moderado', text: 'Energía media: puede ser el final de un clic que se apaga o ruido del entorno.' }
        : { title: 'Casi silencio', text: 'En este momento casi no hay sonido en este tono.' };

export function Spectrogram({ spectro, version, marker, height = 200, fmax = 4000 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { paused, setPaused } = usePlayback();
  const [sel, setSel] = useState<Sel | null>(null);

  useEffect(() => {
    if (!paused) setSel(null);
  }, [paused]);

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

  const onPick = (ev: React.PointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
    const W = spectro.maxColumns;
    const cols = spectro.columns;
    const c = Math.floor(x * W) - (W - cols.length);
    const nyq = spectro.fs / 2;
    const H = Math.round((spectro.bins * Math.min(fmax, nyq)) / nyq);
    const k = Math.max(0, Math.min(H - 1, Math.floor((1 - y) * H)));
    const norm = (db: number) => Math.max(0, Math.min(1, (db - (spectro.refDb - DYN_RANGE_DB)) / DYN_RANGE_DB));
    let level = 0;
    let wide = 0;
    if (c >= 0 && c < cols.length) {
      // energía en la celda (promedio 3 × 3) y fracción de tonos «encendidos» en esa columna
      let s = 0;
      let n = 0;
      for (let dc = -1; dc <= 1; dc++)
        for (let dk = -1; dk <= 1; dk++) {
          const col = cols[c + dc];
          if (col && col[k + dk] !== undefined) {
            s += norm(col[k + dk]);
            n++;
          }
        }
      level = n ? s / n : 0;
      const col = cols[c];
      let on = 0;
      for (let q = 0; q < H; q++) if (norm(col[q]) > 0.55) on++;
      wide = on / H;
    }
    setSel({ x, y, t: -seconds * (1 - x), f: (1 - y) * fmax, level, wide });
    if (!paused) setPaused(true);
  };

  const info = sel ? LEVEL_TEXT(sel.level, sel.wide) : null;

  return (
    <div>
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
        <div className="spectro-area" onPointerDown={onPick} role="button" tabIndex={0} aria-label="Mapa de sonidos: toca una zona para saber qué representa">
          <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden />
          {markerPct !== null && markerPct < 100 && (
            <div className="spectro-marker" style={{ bottom: `${markerPct}%` }} title={`Tono principal ${fmt(marker, 0)} Hz`}>
              <span>tono principal · {fmt(marker, 0)} Hz</span>
            </div>
          )}
          {sel && (
            <>
              <div className="spectro-cross v" style={{ left: `${sel.x * 100}%` }} />
              <div className="spectro-cross h" style={{ top: `${sel.y * 100}%` }} />
              <div className="spectro-dot" style={{ left: `${sel.x * 100}%`, top: `${sel.y * 100}%` }} />
            </>
          )}
        </div>
        <div />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#7d8da0', paddingTop: 4 }} className="num">
          {Array.from({ length: 7 }, (_, i) => -seconds + (i * seconds) / 6).map((t, i) => (
            <span key={i}>{i === 6 ? 'ahora' : `${fmt(t, 1)} s`}</span>
          ))}
        </div>
      </div>
      {sel && info && (
        <div className="pick-card" role="status">
          <span className="pick-icon">
            <IconTarget size={16} />
          </span>
          <div>
            <b>{info.title}</b>
            <p>{info.text}</p>
            <span className="pick-meta num">
              t ≈ {fmt(sel.t, 2)} s · tono ≈ {fmt(sel.f / 1000, 1)} kHz · energía {sel.level > 0.62 ? 'alta' : sel.level > 0.3 ? 'media' : 'baja'}
            </span>
          </div>
          <div className="pick-actions">
            {paused && (
              <button type="button" className="btn sm" onClick={() => setPaused(false)}>
                <IconPlay size={12} /> Reanudar
              </button>
            )}
            <button type="button" className="icon-btn" onClick={() => setSel(null)} aria-label="Cerrar">
              <IconClose size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Leyenda de colores del mapa de sonidos. */
export function SpectroLegend() {
  return (
    <div className="spectro-legend">
      <span>Poca energía</span>
      <i style={{ background: SPECTRO_GRADIENT }} />
      <span>Mucha energía</span>
    </div>
  );
}
