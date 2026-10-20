import { useEffect, useRef } from 'react';
import { detectR, isOpen, sampleEcg, sampleSignals } from '../sim/model';
import { sim } from '../sim/store';
import type { RealBuffers } from './useEsp32';

export type Lane = 'ecg' | 'vib' | 'snd';

interface Props {
  width: number;
  height: number;
  windowS?: number;
  lanes?: Lane[];
  real?: RealBuffers | null;
}

const FS = 6000;
const LIM = 1.8;

function cssVar(el: Element, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * ECG, vibración y sonido en ventana deslizante, calculados a partir del MISMO
 * estado de simulación que mueve la válvula (o de datos reales del ESP32).
 * Los picos R se marcan con el detector, no con el modelo.
 */
export function LiveSignals({ width, height, windowS = 2.5, lanes = ['vib', 'snd'], real = null }: Props) {
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
      ecg: cssVar(cv, '--sig-ecg', '#e11d48'),
      vib: cssVar(cv, '--sig-vib', '#0891b2'),
      snd: cssVar(cv, '--sig-snd', '#7c3aed'),
      grid: cssVar(cv, '--grid', 'rgba(51,72,95,.1)'),
      muted: cssVar(cv, '--muted', '#6b8199'),
      text: cssVar(cv, '--text', '#0b1f33'),
      open: 'rgba(8, 145, 178, 0.08)',
      amber: cssVar(cv, '--amber', '#b45309'),
      font: cssVar(cv, '--font', 'sans-serif'),
    };
    const L = 96;
    const plotW = width - L - 8;
    const laneH = (height - 26) / lanes.length;

    const lane = (y0: number, data: ArrayLike<number>, color: string, label: string, unit: string, lim: number, center = 0.5) => {
      const mid = y0 + laneH * center;
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, mid);
      ctx.lineTo(L + plotW, mid);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `650 15px ${C.font}`;
      ctx.fillText(label, 0, y0 + laneH / 2 - 4);
      ctx.fillStyle = C.muted;
      ctx.font = `13px ${C.font}`;
      ctx.fillText(unit, 0, y0 + laneH / 2 + 14);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const n = data.length;
      const per = n / plotW;
      const yv = (v: number) => mid - (Math.max(-lim, Math.min(lim, v)) / lim) * (laneH / 2 - 4);
      for (let px = 0; px < plotW; px++) {
        const a = Math.floor(px * per);
        const b = Math.max(a + 1, Math.floor((px + 1) * per));
        let mn = Infinity;
        let mx = -Infinity;
        for (let i = a; i < b && i < n; i++) {
          if (data[i] < mn) mn = data[i];
          if (data[i] > mx) mx = data[i];
        }
        if (per <= 1) {
          if (px === 0) ctx.moveTo(L, yv(mx));
          else ctx.lineTo(L + px + 0.5, yv(mx));
        } else {
          ctx.moveTo(L + px + 0.5, yv(mx));
          ctx.lineTo(L + px + 0.5, yv(mn) + 0.5);
        }
      }
      ctx.stroke();
    };

    let frame = 0;
    const draw = (t: number) => {
      if (++frame % 2 && sim.running) return; // ~30 fps
      ctx.clearRect(0, 0, width, height);
      const W = windowS;
      const t0 = t - W;
      const realActive = real && real.count() > 0;
      const p = sim.state.params;
      if (!realActive) {
        // franjas de válvula abierta
        ctx.fillStyle = C.open;
        let start: number | null = null;
        for (let px = 0; px <= plotW; px += 2) {
          const open = isOpen(t0 + (px / plotW) * W, p);
          if (open && start === null) start = px;
          if ((!open || px >= plotW) && start !== null) {
            ctx.fillRect(L + start, 0, px - start, height - 22);
            start = null;
          }
        }
      }
      let y = 0;
      const s = realActive ? null : sampleSignals(t0, t, p, FS);
      for (const ln of lanes) {
        if (ln === 'ecg') {
          const e = sampleEcg(t0 - 0.4, t, p, 250);
          const off = Math.round(0.4 * 250);
          const v = e.v.subarray(off);
          lane(y, v, C.ecg, 'ECG', 'mV', 1.25, 0.6);
          // picos R detectados (detector sobre la señal, con 0,4 s de contexto previo)
          ctx.fillStyle = C.ecg;
          ctx.font = `700 12px ${C.font}`;
          for (const k of detectR(e.v, e.fs)) {
            if (k < off) continue;
            const x = L + ((k - off) / v.length) * plotW;
            ctx.beginPath();
            ctx.moveTo(x, y + 4);
            ctx.lineTo(x - 5, y - 4 + 4);
            ctx.lineTo(x + 5, y - 4 + 4);
            ctx.closePath();
            ctx.fill();
            ctx.fillText('R', x + 6, y + 12);
          }
        } else if (realActive) {
          const snap = real!.snapshot(W);
          const x = ln === 'vib' ? snap.piezo : snap.audio;
          let m = 1e-3;
          for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
          lane(y, x, ln === 'vib' ? C.vib : C.snd, ln === 'vib' ? 'Piezo' : 'MEMS', 'datos reales', m * 1.1);
        } else {
          lane(
            y,
            ln === 'vib' ? s!.vib : s!.snd,
            ln === 'vib' ? C.vib : C.snd,
            ln === 'vib' ? 'Piezo' : 'MEMS',
            ln === 'vib' ? 'x(t) [V]' : 's(t) [u.a.]',
            LIM,
          );
        }
        y += laneH;
      }
      if (s) {
        for (const e of s.events) {
          const x = L + ((e.t - t0) / W) * plotW;
          ctx.strokeStyle = e.kind === 'close' ? C.amber : C.muted;
          ctx.globalAlpha = 0.5;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(x, lanes[0] === 'ecg' ? laneH : 0);
          ctx.lineTo(x, height - 22);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }
      ctx.fillStyle = C.muted;
      ctx.font = `13px ${C.font}`;
      for (let k = 0; k <= 5; k++) {
        const x = L + (k / 5) * plotW;
        ctx.textAlign = k === 0 ? 'left' : k === 5 ? 'right' : 'center';
        ctx.fillText(k === 5 ? 'ahora' : `${(-W + (k / 5) * W).toFixed(1).replace('.', ',')} s`, x, height - 5);
      }
      ctx.textAlign = 'left';
    };
    return sim.onFrame(draw);
  }, [width, height, windowS, real, lanes]);

  return <canvas ref={canvas} style={{ width, height, display: 'block' }} aria-label="ECG, vibración y sonido" />;
}
