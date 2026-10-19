/**
 * MODELO DE SIMULACIÓN — ValveSense (prótesis bileaflet, 2 valvas)
 * ──────────────────────────────────────────────────────────────────
 * Fuente única de verdad: ECG sintético, detección del pico R, movimiento de
 * las valvas, vibración (piezo), sonido (MEMS) y descriptores para la IA se
 * calculan con estas funciones. Todo es DETERMINISTA y reproducible.
 *
 * CADENA DEMOSTRATIVA:  ECG → pico R → retardo τ → actuador → apertura/cierre
 *
 * SUPUESTOS DOCUMENTADOS (representación educativa, no fisiología exacta)
 *  1. Latidos: R_k = k·RR + δ_k, con δ_k una pequeña variabilidad determinista (±1,5 % RR).
 *  2. La apertura comienza τ (retardo electromecánico configurable) después del pico R.
 *     El ECG mide actividad eléctrica: la apertura real ocurre después de iniciada
 *     la contracción ventricular, por eso existe τ.
 *  3. El servo impone rampas de duración fija (apertura 120 ms, cierre 100 ms):
 *       θ(τ) = θmín + Δθ·(1 − cos πu)/2 ,  u ∈ [0,1]  ⇒  ω = Δθ·π/(2D)·sin πu
 *  4. La válvula permanece abierta durante D_ap (duración de apertura configurable),
 *     acotada para que el ciclo termine antes del siguiente latido.
 *  5. Cada contacto (tope de apertura, asiento de cierre) excita una oscilación
 *     amortiguada con amplitud ∝ ω máx del tramo (supuesto a validar).
 *  6. Como las rampas no dependen de la FC, un cambio de FC no altera la firma
 *     mecánica de cada evento: solo cambia el intervalo entre ciclos.
 *  7. Prototipo actual: sin circuito de presión ni flujo; el movimiento lo impone el actuador.
 */

export type Condition = 'normal' | 'restricted' | 'incomplete' | 'irregular';

export const CONDITIONS: { id: Condition; label: string; short: string; detail: string }[] = [
  { id: 'normal', label: 'Funcionamiento normal', short: 'Normal', detail: 'Ambas valvas abren hasta el ángulo programado y cierran sobre su asiento.' },
  { id: 'restricted', label: 'Apertura restringida', short: 'Apertura restringida', detail: 'Un tope limita la apertura de ambas valvas a 45°.' },
  { id: 'incomplete', label: 'Cierre incompleto', short: 'Cierre incompleto', detail: 'Las valvas no alcanzan el asiento: queda una separación residual de 12°.' },
  { id: 'irregular', label: 'Movimiento irregular', short: 'Movimiento irregular', detail: 'La valva 2 varía su apertura y su retardo ciclo a ciclo.' },
];

export const LEAFLETS = ['Valva 1', 'Valva 2'] as const;

export interface SimParams {
  /** frecuencia cardíaca del ECG (lpm) */
  bpm: number;
  /** ángulo máximo de apertura programado (°) */
  thetaMax: number;
  condition: Condition;
  /** retardo electromecánico τ: pico R → inicio de apertura (ms) */
  delayMs: number;
  /** duración de apertura D_ap: inicio de apertura → inicio de cierre (ms) */
  openMs: number;
}

export const DEFAULT_PARAMS: SimParams = { bpm: 72, thetaMax: 80, condition: 'normal', delayMs: 100, openMs: 300 };
export const LIMITS = { bpm: [40, 125], delayMs: [40, 180], openMs: [150, 400], thetaMax: [20, 85] } as const;

export const RAMP_OPEN = 0.12;
export const RAMP_CLOSE = 0.1;
export const RESTRICT_DEG = 45;
export const RESIDUAL_DEG = 12;

export type PhaseName = 'apertura' | 'abierta' | 'cierre' | 'cerrada';

export const rrOf = (p: SimParams) => 60 / p.bpm;

/** Ruido/variación determinista: hash entero → [0, 1). */
export function hash01(n: number, seed: number) {
  let h = (Math.imul(n | 0, 0x27d4eb2d) ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const hashSigned = (n: number, seed: number) => hash01(n, seed) * 2 - 1;

/** Instante del pico R del latido k. */
export function rPeak(k: number, p: SimParams) {
  const RR = rrOf(p);
  return k * RR + 0.015 * RR * hashSigned(k, 7);
}

/** Duración de apertura efectiva (acotada por el intervalo RR). */
export function effectiveOpen(p: SimParams) {
  const RR = rrOf(p);
  const avail = 0.9 * RR - p.delayMs / 1000 - RAMP_CLOSE;
  const dOpen = Math.max(RAMP_OPEN + 0.02, Math.min(p.openMs / 1000, avail));
  return { dOpen, truncated: p.openMs / 1000 > avail + 1e-9 };
}

export interface LeafletBeat {
  max: number;
  min: number;
  /** retardo total desde el pico R (s) */
  start: number;
  /** duración de apertura (s) */
  dOpen: number;
}

/** Perfil de una valva para el latido b (depende de la condición). */
export function leafletBeat(p: SimParams, i: number, b: number): LeafletBeat {
  let max = p.thetaMax;
  let min = 0;
  let extra = 0;
  if (p.condition === 'restricted') max = Math.min(max, RESTRICT_DEG);
  if (p.condition === 'incomplete') min = RESIDUAL_DEG;
  if (p.condition === 'irregular' && i === 1) {
    max = p.thetaMax * (0.5 + 0.35 * hash01(b, 31));
    extra = 0.015 + 0.05 * hash01(b, 57);
  }
  const { dOpen } = effectiveOpen(p);
  return { max, min: Math.min(min, max), start: p.delayMs / 1000 + extra, dOpen };
}

/** Latido más reciente cuyo ciclo de la valva i ya comenzó en t. */
function activeBeat(t: number, p: SimParams, i: number) {
  const RR = rrOf(p);
  const k0 = Math.floor(t / RR) + 1;
  for (let b = k0; b >= k0 - 3; b--) {
    const lb = leafletBeat(p, i, b);
    if (rPeak(b, p) + lb.start <= t) return { b, lb, t0: rPeak(b, p) + lb.start };
  }
  const lb = leafletBeat(p, i, k0 - 3);
  return { b: k0 - 3, lb, t0: rPeak(k0 - 3, p) + lb.start };
}

/** θ (°) y ω (°/s) de la valva i en el instante t. */
export function leafletState(t: number, p: SimParams, i: number) {
  const { lb, t0 } = activeBeat(t, p, i);
  const tau = t - t0;
  const span = lb.max - lb.min;
  if (tau < RAMP_OPEN) {
    const u = tau / RAMP_OPEN;
    return { theta: lb.min + (span * (1 - Math.cos(Math.PI * u))) / 2, omega: ((span * Math.PI) / (2 * RAMP_OPEN)) * Math.sin(Math.PI * u) };
  }
  if (tau < lb.dOpen) return { theta: lb.max, omega: 0 };
  if (tau < lb.dOpen + RAMP_CLOSE) {
    const u = (tau - lb.dOpen) / RAMP_CLOSE;
    return { theta: lb.max - (span * (1 - Math.cos(Math.PI * u))) / 2, omega: -((span * Math.PI) / (2 * RAMP_CLOSE)) * Math.sin(Math.PI * u) };
  }
  return { theta: lb.min, omega: 0 };
}

export function phaseName(t: number, p: SimParams): PhaseName {
  const { lb, t0 } = activeBeat(t, p, 0);
  const tau = t - t0;
  if (tau < RAMP_OPEN) return 'apertura';
  if (tau < lb.dOpen) return 'abierta';
  if (tau < lb.dOpen + RAMP_CLOSE) return 'cierre';
  return 'cerrada';
}

/** ¿Está abierta la válvula (alguna valva por sobre su mínimo)? */
export const isOpen = (t: number, p: SimParams) => [0, 1].some((i) => leafletState(t, p, i).theta > leafletBeat(p, i, 0).min + 1);

// ═══════════════════════════════ ECG sintético ═══════════════════════════════

const g = (x: number, mu: number, s: number) => Math.exp(-((x - mu) ** 2) / (2 * s * s));

/** ECG sintético (mV): suma de ondas P, Q, R, S, T por latido + deriva y ruido deterministas. */
export function ecgAt(t: number, p: SimParams) {
  const RR = rrOf(p);
  const k0 = Math.round(t / RR);
  const qt = 0.26 * Math.sqrt(RR); // la onda T se acerca al QRS cuando sube la FC
  let v = 0;
  for (let b = k0 - 1; b <= k0 + 1; b++) {
    const x = t - rPeak(b, p);
    if (x < -0.3 || x > 0.6) continue;
    v += 0.12 * g(x, -0.16, 0.025) - 0.1 * g(x, -0.025, 0.008) + 1.1 * g(x, 0, 0.01) - 0.22 * g(x, 0.026, 0.01) + 0.3 * g(x, qt, 0.045);
  }
  const n = Math.round(t * 500);
  return v + 0.03 * Math.sin(2 * Math.PI * 0.25 * t) + 0.012 * hashSigned(n, 3);
}

export function sampleEcg(t0: number, t1: number, p: SimParams, fs = 250) {
  const n = Math.max(2, Math.round((t1 - t0) * fs));
  const t = new Float64Array(n);
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    t[i] = t0 + i / fs;
    v[i] = ecgAt(t[i], p);
  }
  return { t, v, fs };
}

/**
 * Detección de QRS simplificada inspirada en Pan–Tompkins:
 * derivada → cuadrado → integración en ventana móvil (150 ms) → umbral
 * adaptativo con período refractario (250 ms) → máximo local del ECG.
 * Devuelve los índices de los picos R detectados.
 */
export function detectR(v: ArrayLike<number>, fs: number): number[] {
  const n = v.length;
  const d = new Float64Array(n);
  for (let i = 2; i < n - 2; i++) d[i] = (2 * v[i + 2] + v[i + 1] - v[i - 1] - 2 * v[i - 2]) * (fs / 8);
  const w = Math.max(1, Math.round(0.15 * fs));
  const mwi = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += d[i] * d[i];
    if (i >= w) acc -= d[i - w] * d[i - w];
    mwi[i] = acc / w;
  }
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, mwi[i]);
  const thr = 0.35 * max;
  const refr = Math.round(0.25 * fs);
  const peaks: number[] = [];
  let i = 0;
  while (i < n) {
    if (mwi[i] > thr) {
      // buscar el máximo del ECG en la ventana que precede al pico integrado
      let j = i;
      while (j < n && mwi[j] > thr) j++;
      let best = Math.max(0, i - w);
      for (let k = best; k < Math.min(n, j); k++) if (v[k] > v[best]) best = k;
      if (!peaks.length || best - peaks[peaks.length - 1] > refr) peaks.push(best);
      i = j + 1;
    } else i++;
  }
  return peaks;
}

/** FC (lpm) a partir de los intervalos RR detectados: 60 / RR̄. */
export function bpmFromPeaks(peaks: number[], fs: number) {
  if (peaks.length < 2) return null;
  const rr = peaks.slice(1).map((x, i) => (x - peaks[i]) / fs);
  const last = rr.slice(-4);
  return 60 / (last.reduce((s, x) => s + x, 0) / last.length);
}

// ═══════════════════════════════ eventos y señales ═══════════════════════════════

export interface MechEvent {
  t: number;
  beat: number;
  leaflet: number;
  kind: 'open' | 'close';
  amp: number;
  /** contacto contra el tope de restricción (resonancia distinta, supuesto) */
  limiter?: boolean;
}

const OMEGA_REF = (80 * Math.PI) / (2 * RAMP_CLOSE);

export function eventsBetween(t0: number, t1: number, p: SimParams): MechEvent[] {
  const RR = rrOf(p);
  const out: MechEvent[] = [];
  for (let b = Math.floor(t0 / RR) - 2; b <= Math.ceil(t1 / RR) + 1; b++) {
    for (const i of [0, 1]) {
      const lb = leafletBeat(p, i, b);
      const span = lb.max - lb.min;
      const base = rPeak(b, p) + lb.start;
      const to = base + RAMP_OPEN;
      const tc = base + lb.dOpen + RAMP_CLOSE;
      const wOpen = ((span * Math.PI) / (2 * RAMP_OPEN)) / OMEGA_REF;
      const wClose = ((span * Math.PI) / (2 * RAMP_CLOSE)) / OMEGA_REF;
      const seat = lb.min > 0 ? 0.3 : 1;
      if (to >= t0 && to <= t1) out.push({ t: to, beat: b, leaflet: i, kind: 'open', amp: 0.45 * wOpen, limiter: p.condition === 'restricted' });
      if (tc >= t0 && tc <= t1) out.push({ t: tc, beat: b, leaflet: i, kind: 'close', amp: seat * wClose });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export const SIGNAL = {
  vib: { f: 48, tau: 0.03, gain: 0.45, servoF: 150, servoGain: 0.03, noise: 0.006 },
  snd: { fClose: 1150, fOpen: 760, fLimiter: 1650, tau: 0.0045, gain: 0.6, servoF: 420, servoGain: 0.02, noise: 0.004 },
};

export interface SampledSignals {
  t: Float64Array;
  vib: Float64Array;
  snd: Float64Array;
  events: MechEvent[];
}

/** Vibración x(t) [V, supuesto] y sonido s(t) [u.a.] en [t0, t1] a fs Hz. */
export function sampleSignals(t0: number, t1: number, p: SimParams, fs: number): SampledSignals {
  const n = Math.max(2, Math.round((t1 - t0) * fs));
  const t = new Float64Array(n);
  const vib = new Float64Array(n);
  const snd = new Float64Array(n);
  const events = eventsBetween(t0 - 0.2, t1, p);
  const V = SIGNAL.vib;
  const S = SIGNAL.snd;
  const wNorm = (80 * Math.PI) / (2 * RAMP_OPEN);
  for (let i = 0; i < n; i++) {
    const ti = t0 + i / fs;
    t[i] = ti;
    let v = 0;
    let s = 0;
    for (const e of events) {
      const dt = ti - e.t;
      if (dt < 0) break;
      if (dt < V.tau * 7) v += V.gain * e.amp * Math.exp(-dt / V.tau) * Math.sin(2 * Math.PI * V.f * dt);
      if (dt < S.tau * 8) {
        const f = e.limiter && e.kind === 'open' ? S.fLimiter : (e.kind === 'close' ? S.fClose : S.fOpen) * (1 + 0.04 * e.leaflet);
        s += S.gain * e.amp * (e.kind === 'close' ? 1 : 0.6) * Math.exp(-dt / S.tau) * Math.sin(2 * Math.PI * f * dt);
      }
    }
    const w = (Math.abs(leafletState(ti, p, 0).omega) + Math.abs(leafletState(ti, p, 1).omega)) / (2 * wNorm);
    v += V.servoGain * w * Math.sin(2 * Math.PI * V.servoF * ti);
    s += S.servoGain * w * Math.sin(2 * Math.PI * S.servoF * ti);
    const idx = Math.round(ti * fs);
    v += V.noise * hashSigned(idx, 17);
    s += S.noise * hashSigned(idx, 91);
    vib[i] = v;
    snd[i] = s;
  }
  return { t, vib, snd, events: events.filter((e) => e.t >= t0) };
}

/** Eₓ = ∫ x² dt (regla del trapecio). */
export function integralSquare(x: ArrayLike<number>, fs: number, i0 = 0, i1 = x.length - 1) {
  let e = 0;
  for (let i = Math.max(0, i0); i < Math.min(x.length - 1, i1); i++) e += (x[i] * x[i] + x[i + 1] * x[i + 1]) / 2 / fs;
  return e;
}
