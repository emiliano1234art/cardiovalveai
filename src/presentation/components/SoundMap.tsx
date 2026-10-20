import { useEffect, useRef } from 'react';
import { powerSpectrum } from '../../analysis/dsp';
import { rPeak, sampleSignals, type SimParams } from '../sim/model';

/** Espectrograma (STFT) del sonido MEMS en dos latidos. */
export function Spectrogram({ p, w, h }: { p: SimParams; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const fs = 8000;
    const r0 = rPeak(3, p);
    const s = sampleSignals(r0, rPeak(5, p), p, fs);
    const n = 256;
    const hop = 48;
    const fmax = 3000;
    const bins = Math.round((fmax / (fs / 2)) * (n / 2));
    const cols: Float64Array[] = [];
    for (let i = 0; i + n <= s.snd.length; i += hop) cols.push(powerSpectrum(Array.from(s.snd.subarray(i, i + n)), n));
    cv.width = cols.length;
    cv.height = bins;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(cols.length, bins);
    const ref0 = -18;
    cols.forEach((c, x) => {
      for (let k = 0; k < bins; k++) {
        const db = 10 * Math.log10(c[k] + 1e-12);
        const v = Math.max(0, Math.min(1, (db - (ref0 - 45)) / 45));
        const idx = ((bins - 1 - k) * cols.length + x) * 4;
        // escala blanco → turquesa → azul profundo
        img.data[idx] = 255 - v * (255 - 8);
        img.data[idx + 1] = 255 - v * (255 - 80);
        img.data[idx + 2] = 255 - v * (255 - 140);
        img.data[idx + 3] = 255;
      }
    });
    ctx.putImageData(img, 0, 0);
  }, [p]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 6 }}>
      <div className="v-tiny" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'right', fontSize: 12 }}>
        <span>3 kHz</span>
        <span>1,5</span>
        <span>0</span>
      </div>
      <canvas ref={ref} style={{ width: w - 50, height: h, borderRadius: 8, border: '1px solid var(--line)', imageRendering: 'auto' }} aria-label="Espectrograma del sonido" />
    </div>
  );
}

