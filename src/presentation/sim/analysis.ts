import { powerSpectrum } from '../../analysis/dsp';
import { DEFAULT_PARAMS, eventsBetween, integralSquare, leafletBeat, rPeak, sampleSignals, type SimParams } from './model';

/**
 * DETECCIÓN EXPERIMENTAL DE DESVIACIONES (no es diagnóstico)
 * ─────────────────────────────────────────────────────────
 * 1. Descriptores sincronizados con cada evento (no con el tiempo absoluto):
 *    así un cambio de FC no altera la "firma" mecánica de cada cierre.
 * 2. El ECG sirve de referencia temporal: se compara la duración del ciclo
 *    valvular con el intervalo RR medido. Si coinciden, la válvula sigue al ritmo.
 * 3. Línea basal experimental = condición normal a 72 lpm (en el prototipo real se
 *    registrará con el montaje fijo). Desviación = distancia normalizada a esa basal.
 * Los umbrales y tolerancias son una HEURÍSTICA DEMOSTRATIVA a calibrar con datos reales.
 */

const FS = 8000;
const WIN = 0.15;

export interface BeatFeatures {
  eClose: number;
  eOpen: number;
  rmsClose: number;
  fDom: number;
  centroid: number;
  angle: number;
  spreadMs: number;
  cycleMs: number;
  rrMs: number;
}

function spectrumOf(x: Float64Array, i0: number, i1: number, n = 2048) {
  const seg = Array.from(x.subarray(Math.max(0, i0), Math.min(x.length, i1)));
  return powerSpectrum(seg, n);
}

function dominant(psd: Float64Array, fs: number, fmin = 200) {
  const df = fs / (psd.length * 2);
  let best = Math.ceil(fmin / df);
  let num = 0;
  let den = 0;
  for (let k = best; k < psd.length; k++) {
    if (psd[k] > psd[best]) best = k;
    num += k * df * psd[k];
    den += psd[k];
  }
  return { fDom: best * df, centroid: den ? num / den : 0 };
}

export function beatFeatures(p: SimParams, b: number): BeatFeatures {
  const r0 = rPeak(b, p);
  const r1 = rPeak(b + 1, p);
  const s = sampleSignals(r0, r1 + 0.05, p, FS);
  const ev = eventsBetween(r0, r1, p).filter((e) => e.beat === b);
  const closes = ev.filter((e) => e.kind === 'close').map((e) => e.t);
  const opens = ev.filter((e) => e.kind === 'open').map((e) => e.t);
  const idx = (t: number) => Math.round((t - r0) * FS);
  const c0 = Math.min(...closes) - 0.005;
  const c1 = Math.max(...closes) + WIN;
  const o0 = Math.min(...opens) - 0.005;
  const o1 = Math.max(...opens) + WIN;
  const eClose = integralSquare(s.vib, FS, idx(c0), idx(c1));
  const eOpen = integralSquare(s.vib, FS, idx(o0), idx(o1));
  const { fDom, centroid } = dominant(spectrumOf(s.snd, idx(c0), idx(c0) + 1024), FS);
  const lb0 = leafletBeat(p, 0, b);
  const lb0n = leafletBeat(p, 0, b + 1);
  return {
    eClose,
    eOpen,
    rmsClose: Math.sqrt(eClose / (c1 - c0)),
    fDom,
    centroid,
    angle: (leafletBeat(p, 0, b).max + leafletBeat(p, 1, b).max) / 2,
    spreadMs: (Math.max(...closes) - Math.min(...closes)) * 1000,
    cycleMs: (r1 + lb0n.start - (r0 + lb0.start)) * 1000,
    rrMs: (r1 - r0) * 1000,
  };
}

const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
const cv = (x: number[]) => {
  const m = mean(x);
  return m ? Math.sqrt(mean(x.map((v) => (v - m) ** 2))) / m : 0;
};

export interface Summary {
  bpm: number;
  eClose: number;
  eOpen: number;
  rmsClose: number;
  fDom: number;
  centroid: number;
  angle: number;
  spreadMs: number;
  cycleMs: number;
  rrMs: number;
  syncErrMs: number;
  cvClose: number;
  cvAngle: number;
}

const cache = new Map<string, Summary>();

/** Promedio de 8 latidos (determinista). */
export function summarize(p: SimParams): Summary {
  const key = JSON.stringify(p);
  const hit = cache.get(key);
  if (hit) return hit;
  const beats = Array.from({ length: 8 }, (_, i) => beatFeatures(p, i + 3));
  const pick = (k: keyof BeatFeatures) => beats.map((f) => f[k]);
  const out: Summary = {
    bpm: p.bpm,
    eClose: mean(pick('eClose')),
    eOpen: mean(pick('eOpen')),
    rmsClose: mean(pick('rmsClose')),
    fDom: mean(pick('fDom')),
    centroid: mean(pick('centroid')),
    angle: mean(pick('angle')),
    spreadMs: mean(pick('spreadMs')),
    cycleMs: mean(pick('cycleMs')),
    rrMs: mean(pick('rrMs')),
    syncErrMs: mean(beats.map((f) => Math.abs(f.cycleMs - f.rrMs))),
    cvClose: cv(pick('eClose')),
    cvAngle: cv(pick('angle')),
  };
  if (cache.size > 200) cache.clear();
  cache.set(key, out);
  return out;
}

export const BASELINE_PARAMS: SimParams = { ...DEFAULT_PARAMS };

export interface FeatureDev {
  key: string;
  label: string;
  value: string;
  base: string;
  z: number;
}

export type Verdict = 'basal' | 'fc' | 'leve' | 'importante';

export interface Assessment {
  similarity: number;
  score: number;
  verdict: Verdict;
  hrChange: boolean;
  devs: FeatureDev[];
  cur: Summary;
  base: Summary;
}

const f1 = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

/** Compara la condición actual con la línea basal experimental. */
export function assess(p: SimParams): Assessment {
  const base = summarize({ ...BASELINE_PARAMS, thetaMax: p.thetaMax, delayMs: p.delayMs, openMs: p.openMs });
  const cur = summarize(p);
  const rel = (a: number, b: number, tol: number) => Math.abs(a - b) / (Math.abs(b) * tol);
  const devs: FeatureDev[] = [
    { key: 'eClose', label: 'Energía del cierre (piezo)', value: `${f1(cur.eClose * 1000, 2)}`, base: `${f1(base.eClose * 1000, 2)}`, z: rel(cur.eClose, base.eClose, 0.15) },
    { key: 'eOpen', label: 'Energía de la apertura (piezo)', value: `${f1(cur.eOpen * 1000, 2)}`, base: `${f1(base.eOpen * 1000, 2)}`, z: rel(cur.eOpen, base.eOpen, 0.15) },
    { key: 'rms', label: 'RMS del cierre', value: f1(cur.rmsClose, 3), base: f1(base.rmsClose, 3), z: rel(cur.rmsClose, base.rmsClose, 0.1) },
    { key: 'fdom', label: 'Frecuencia dominante (MEMS)', value: `${f1(cur.fDom, 0)} Hz`, base: `${f1(base.fDom, 0)} Hz`, z: rel(cur.fDom, base.fDom, 0.05) },
    { key: 'angle', label: 'Apertura media', value: `${f1(cur.angle, 0)}°`, base: `${f1(base.angle, 0)}°`, z: Math.abs(cur.angle - base.angle) / 5 },
    { key: 'spread', label: 'Desfase entre valvas', value: `${f1(cur.spreadMs, 0)} ms`, base: `${f1(base.spreadMs, 0)} ms`, z: Math.abs(cur.spreadMs - base.spreadMs) / 12 },
    { key: 'var', label: 'Variabilidad ciclo a ciclo', value: `${f1(cur.cvClose * 100, 0)} %`, base: `${f1(base.cvClose * 100, 0)} %`, z: Math.abs(cur.cvClose - base.cvClose) / 0.06 },
    { key: 'sync', label: 'Ciclo valvular vs RR del ECG', value: `${f1(cur.syncErrMs, 0)} ms`, base: `${f1(base.syncErrMs, 0)} ms`, z: Math.abs(cur.syncErrMs - base.syncErrMs) / 30 },
  ];
  const D = Math.sqrt(mean(devs.map((d) => Math.min(d.z, 5) ** 2)));
  const hrChange = Math.abs(p.bpm - BASELINE_PARAMS.bpm) >= 10;
  const verdict: Verdict = D >= 2.2 ? 'importante' : D >= 1 ? 'leve' : hrChange ? 'fc' : 'basal';
  return { similarity: 100 * Math.exp(-(D * D) / 8), score: 1 - Math.exp(-(D * D) / 6), verdict, hrChange, devs, cur, base };
}

/** Espectro (dB) del sonido alrededor de un evento del latido 3, 0–3 kHz. */
export function eventSpectrum(p: SimParams, kind: 'open' | 'close') {
  const b = 3;
  const r0 = rPeak(b, p);
  const ev = eventsBetween(r0, rPeak(b + 1, p), p).filter((e) => e.beat === b && e.kind === kind);
  const tc = Math.min(...ev.map((e) => e.t));
  // ventana corta centrada en el clic + suavizado espectral (promedio de 7 bins)
  const s = sampleSignals(tc - 0.003, tc + 0.04, p, FS);
  const psd = powerSpectrum(Array.from(s.snd), 1024);
  const df = FS / 1024;
  const out: { f: number; db: number }[] = [];
  for (let k = 4; k * df <= 3000; k++) {
    let m = 0;
    for (let j = -3; j <= 3; j++) m += psd[k + j] / 7;
    out.push({ f: k * df, db: 10 * Math.log10(m + 1e-12) });
  }
  return out;
}
