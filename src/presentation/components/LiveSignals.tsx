import { useEffect, useRef } from 'react';
import { leafletProfiles, leafletState, sampleSignals } from '../sim/model';
import { sim } from '../sim/store';
import type { RealBuffers } from './useEsp32';

interface Props {
  width: number;
  height: number;
  windowS?: number;
  real?: RealBuffers | null;
}

const FS = 6000;
const LIM = 1.6;

function cssVar(el: Element, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * Ondas de vibración y sonido en ventana deslizante, calculadas a partir del
 * MISMO estado de simulación que mueve el modelo (o de datos reales del ESP32).
 */
export function LiveSignals({ width, height, windowS = 2.5, real = null }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = Math.min(2.5, (window.devicePixelRatio || 1) * 1.5);
    cv.width = width * dpr;
    cv.height = height * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const C = {
      vib: cssVar(cv, '--sig-vib', '#22d3ee'),
      snd: cssVar(cv, '--sig-snd', '#a78bfa'),
      grid: cssVar(cv, '--grid', 'rgba(138,160,187,.16)'),
      muted: cssVar(cv, '--muted', '#8aa0bb'),
      open: 'rgba(34, 211, 238, 0.08)',
      amber: cssVar(cv, '--amber', '#fbbf24'),
      coral: cssVar(cv, '--coral', '#ff7a59'),
      font: cssVar(cv, '--font', 'sans-serif'),
    };
    const L = 92; // margen izquierdo para etiquetas
    const plotW = width - L - 8;
    const laneH = (height - 34) / 2;

    const lane = (y0: number, data: ArrayLike<number>, color: string, label: string, unit: string, lim: number) => {
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, y0 + laneH / 2);
      ctx.lineTo(L + plotW, y0 + laneH / 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `600 15px ${C.font}`;
      ctx.fillText(label, 0, y0 + laneH / 2 - 4);
      ctx.fillStyle = C.muted;
      ctx.font = `13px ${C.font}`;
      ctx.fillText(unit, 0, y0 + laneH / 2 + 14);
      // min/máx por columna de píxel (conserva los clics)
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      const n = data.length;
      const per = n / plotW;
      for (let px = 0; px < plotW; px++) {
        const a = Math.floor(px * per);
        const b = Math.max(a + 1, Math.floor((px + 1) * per));
        let mn = Infinity;
        let mx = -Infinity;
        for (let i = a; i < b && i < n; i++) {
          if (data[i] < mn) mn = data[i];
          if (data[i] > mx) mx = data[i];
        }
        const yv = (v: number) => y0 + laneH / 2 - (Math.max(-lim, Math.min(lim, v)) / lim) * (laneH / 2 - 4);
        ctx.moveTo(L + px + 0.5, yv(mx));
        ctx.lineTo(L + px + 0.5, yv(mn) + 0.5);
      }
      ctx.stroke();
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      const W = windowS;
      const realActive = real && real.count() > 0;

      if (realActive) {
        const { piezo, audio } = real!.snapshot(W);
        const lim = (x: Float32Array) => Math.max(1e-3, ...Array.from(x, Math.abs)) * 1.1;
        lane(0, piezo, C.vib, 'Vibración', 'piezo (u.a.)', lim(piezo));
        lane(laneH + 6, audio, C.snd, 'Sonido', 'MEMS (u.a.)', lim(audio));
      } else {
        const p = sim.state.params;
        const t0 = t - W;
        const s = sampleSignals(t0, t, p, FS);
        // franjas de valva abierta (valva 1 como referencia)
        const lp = leafletProfiles(p)[0];
        ctx.fillStyle = C.open;
        let start: number | null = null;
        for (let px = 0; px <= plotW; px += 2) {
          const tt = t0 + (px / plotW) * W;
          const open = leafletState(tt, p, lp).theta > lp.min + 1;
          if (open && start === null) start = px;
          if ((!open || px >= plotW) && start !== null) {
            ctx.fillRect(L + start, 0, px - start, laneH * 2 + 6);
            start = null;
          }
        }
        lane(0, s.vib, C.vib, 'Vibración', 'x(t) [V]', LIM);
        lane(laneH + 6, s.snd, C.snd, 'Sonido', 's(t) [u.a.]', LIM);
        // marcas de eventos (apertura / cierre)
        ctx.font = `700 12px ${C.font}`;
        for (const e of s.events) {
          const x = L + ((e.t - t0) / W) * plotW;
          ctx.strokeStyle = e.kind === 'close' ? C.amber : C.muted;
          ctx.globalAlpha = 0.55;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, laneH * 2 + 6);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }
      // eje temporal
      ctx.fillStyle = C.muted;
      ctx.font = `13px ${C.font}`;
      for (let k = 0; k <= 5; k++) {
        const x = L + (k / 5) * plotW;
        const v = -W + (k / 5) * W;
        ctx.textAlign = k === 0 ? 'left' : k === 5 ? 'right' : 'center';
        ctx.fillText(k === 5 ? 'ahora' : `${v.toFixed(1).replace('.', ',')} s`, x, height - 6);
      }
      ctx.textAlign = 'left';
    };

    return sim.onFrame(draw);
  }, [width, height, windowS, real]);

  return <canvas ref={canvas} style={{ width, height, display: 'block' }} aria-label="Señales de vibración y sonido" />;
}
