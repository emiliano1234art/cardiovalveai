/**
 * MODELO CINEMÁTICO Y DE SEÑALES — ValveSense (trivalva, accionada por servo)
 * ──────────────────────────────────────────────────────────────────────────
 * Fuente única de verdad: la animación 3D, el indicador de fase, las ondas de
 * vibración y sonido y los gráficos matemáticos se calculan con estas funciones.
 * Todo es DETERMINISTA y reproducible (sin aleatoriedad libre).
 *
 * SUPUESTOS DOCUMENTADOS
 *  1. El ciclo se divide en fracciones fijas del período T:
 *       apertura [0, 0.15T) · abierta [0.15T, 0.40T) · cierre [0.40T, 0.52T) · cerrada [0.52T, T)
 *  2. Cada tramo de movimiento sigue un perfil suave de coseno elevado:
 *       θ(τ) = θmin + (θmax − θmin) · (1 − cos(π·u)) / 2 ,  u = τ / D ∈ [0, 1]
 *     ⇒ ω(τ) = dθ/dt = (θmax − θmin) · π / (2D) · sin(π·u)
 *  3. Al final de cada tramo la valva toca su tope (apertura) o su asiento
 *     (cierre) y se genera un evento mecánico. Su amplitud se supone
 *     proporcional a la velocidad angular máxima del tramo (supuesto a
 *     validar experimentalmente).
 *  4. Cada evento excita una oscilación amortiguada:
 *       x(t) = A · e^{−(t−tₑ)/τ} · sin(2π f (t − tₑ)),  t ≥ tₑ
 *  5. El servo agrega una vibración proporcional a |ω| mientras se mueve y
 *     existe un ruido de fondo pseudoaleatorio con semilla fija (reproducible).
 *  6. No hay circuito de presión ni flujo: el movimiento lo impone el servo.
 */

export type Condition = 'normal' | 'limit60' | 'limit45' | 'incomplete' | 'asymmetric';

export const CONDITIONS: { id: Condition; label: string; short: string; detail: string }[] = [
  { id: 'normal', label: 'Normal', short: 'Normal', detail: 'Las tres valvas abren hasta el ángulo programado y cierran completamente.' },
  { id: 'limit60', label: 'Apertura limitada a 60°', short: 'Límite 60°', detail: 'Un tope mecánico restringe la apertura de las tres valvas a 60°.' },
  { id: 'limit45', label: 'Apertura limitada a 45°', short: 'Límite 45°', detail: 'Un tope mecánico restringe la apertura de las tres valvas a 45°.' },
  { id: 'incomplete', label: 'Cierre incompleto', short: 'Cierre incompleto', detail: 'Las valvas no alcanzan el asiento: queda una separación residual de 12°.' },
  { id: 'asymmetric', label: 'Movimiento asimétrico', short: 'Asimétrico', detail: 'La valva 3 abre al 55 % del ángulo y con retardo de 0,05·T.' },
];

export const LEAFLETS = ['Valva 1', 'Valva 2', 'Valva 3'] as const;

export interface SimParams {
  /** ciclos por minuto */
  cpm: number;
  /** ángulo máximo de apertura programado de las valvas (°) */
  thetaMax: number;
  condition: Condition;
}

export const DEFAULT_PARAMS: SimParams = { cpm: 60, thetaMax: 80, condition: 'normal' };

/** Fracciones del ciclo (supuesto 1). */
export const PHASES = { openEnd: 0.15, holdEnd: 0.4, closeEnd: 0.52 } as const;
export const RESIDUAL_DEG = 12;
const ASYM = { leaflet: 2, scale: 0.55, delay: 0.05 };

export type PhaseName = 'apertura' | 'abierta' | 'cierre' | 'cerrada';

export interface LeafletProfile {
  max: number;
  min: number;
  /** retardo como fracción de T */
  delay: number;
}

export const period = (p: SimParams) => 60 / p.cpm;

export function leafletProfiles(p: SimParams): LeafletProfile[] {
  return [0, 1, 2].map((i) => {
    let max = p.thetaMax;
    let min = 0;
    let delay = 0;
    if (p.condition === 'limit60') max = Math.min(max, 60);
    if (p.condition === 'limit45') max = Math.min(max, 45);
    if (p.condition === 'incomplete') min = RESIDUAL_DEG;
    if (p.condition === 'asymmetric' && i === ASYM.leaflet) {
      max = p.thetaMax * ASYM.scale;
      delay = ASYM.delay;
    }
    return { max, min: Math.min(min, max), delay };
  });
}

const frac = (x: number) => x - Math.floor(x);

/** Fase normalizada del ciclo ∈ [0,1) para una valva. */
export function cyclePhase(t: number, T: number, delay = 0) {
  return frac(t / T - delay);
}

/** θ y ω (grados, grados/s) de una valva en el instante t. */
export function leafletState(t: number, p: SimParams, lp: LeafletProfile) {
  const T = period(p);
  const ph = cyclePhase(t, T, lp.delay);
  const span = lp.max - lp.min;
  const { openEnd, holdEnd, closeEnd } = PHASES;
  if (ph < openEnd) {
    const D = openEnd * T;
    const u = ph / openEnd;
    return { theta: lp.min + (span * (1 - Math.cos(Math.PI * u))) / 2, omega: ((span * Math.PI) / (2 * D)) * Math.sin(Math.PI * u) };
  }
  if (ph < holdEnd) return { theta: lp.max, omega: 0 };
  if (ph < closeEnd) {
    const D = (closeEnd - holdEnd) * T;
    const u = (ph - holdEnd) / (closeEnd - holdEnd);
    return { theta: lp.max - (span * (1 - Math.cos(Math.PI * u))) / 2, omega: -((span * Math.PI) / (2 * D)) * Math.sin(Math.PI * u) };
  }
  return { theta: lp.min, omega: 0 };
}

export function phaseName(t: number, p: SimParams): PhaseName {
  const ph = cyclePhase(t, period(p));
  if (ph < PHASES.openEnd) return 'apertura';
  if (ph < PHASES.holdEnd) return 'abierta';
  if (ph < PHASES.closeEnd) return 'cierre';
  return 'cerrada';
}

/** Velocidad angular máxima de un tramo (°/s). */
export const peakOmega = (span: number, fracDur: number, T: number) => (span * Math.PI) / (2 * fracDur * T);

// ───────────────────────────── eventos mecánicos ─────────────────────────────

export interface MechEvent {
  t: number;
  leaflet: number;
  kind: 'open' | 'close';
  /** amplitud relativa (1 = cierre normal de referencia de una valva) */
  amp: number;
}

/** Referencia: velocidad pico de cierre en condición normal a 80° y 60 cpm. */
const OMEGA_REF = peakOmega(80, PHASES.closeEnd - PHASES.holdEnd, 1);

/** Eventos en [t0, t1]. */
export function eventsBetween(t0: number, t1: number, p: SimParams): MechEvent[] {
  const T = period(p);
  const out: MechEvent[] = [];
  const profiles = leafletProfiles(p);
  const k0 = Math.floor(t0 / T) - 1;
  const k1 = Math.ceil(t1 / T) + 1;
  profiles.forEach((lp, i) => {
    const span = lp.max - lp.min;
    const wOpen = peakOmega(span, PHASES.openEnd, T) / OMEGA_REF;
    const wClose = peakOmega(span, PHASES.closeEnd - PHASES.holdEnd, T) / OMEGA_REF;
    // sin contacto con el asiento (cierre incompleto) el evento de cierre es débil
    const seat = lp.min > 0 ? 0.3 : 1;
    for (let k = k0; k <= k1; k++) {
      const base = (k + lp.delay) * T;
      const to = base + PHASES.openEnd * T;
      const tc = base + PHASES.closeEnd * T;
      if (to >= t0 && to <= t1) out.push({ t: to, leaflet: i, kind: 'open', amp: 0.45 * wOpen });
      if (tc >= t0 && tc <= t1) out.push({ t: tc, leaflet: i, kind: 'close', amp: seat * wClose });
    }
  });
  return out.sort((a, b) => a.t - b.t);
}

// ───────────────────────────── señales sintéticas ─────────────────────────────

export const SIGNAL = {
  vib: { f: 48, tau: 0.03, gain: 0.3 /* V por evento de referencia */, servoF: 150, servoGain: 0.03, noise: 0.006 },
  snd: { fClose: 1150, fOpen: 760, tau: 0.0045, gain: 0.45 /* u.a. */, servoF: 420, servoGain: 0.02, noise: 0.004 },
};

/** Ruido determinista: hash entero del índice de muestra → [-1, 1]. */
function hashNoise(n: number, seed: number) {
  let h = (Math.imul(n | 0, 0x27d4eb2d) ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h / 4294967295) * 2 - 1;
}

export interface SampledSignals {
  t: Float64Array;
  vib: Float64Array;
  snd: Float64Array;
  events: MechEvent[];
}

/**
 * Muestrea vibración (V, supuesto) y sonido (u.a.) en [t0, t1] a `fs` Hz.
 * Ambas señales dependen exclusivamente de los eventos y del movimiento.
 */
export function sampleSignals(t0: number, t1: number, p: SimParams, fs: number): SampledSignals {
  const n = Math.max(2, Math.round((t1 - t0) * fs));
  const t = new Float64Array(n);
  const vib = new Float64Array(n);
  const snd = new Float64Array(n);
  const events = eventsBetween(t0 - 0.2, t1, p);
  const profiles = leafletProfiles(p);
  const T = period(p);
  const omegaNorm = peakOmega(80, PHASES.openEnd, T) || 1;
  const V = SIGNAL.vib;
  const S = SIGNAL.snd;
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
        const f = (e.kind === 'close' ? S.fClose : S.fOpen) * (1 + 0.04 * e.leaflet);
        s += S.gain * e.amp * (e.kind === 'close' ? 1 : 0.6) * Math.exp(-dt / S.tau) * Math.sin(2 * Math.PI * f * dt);
      }
    }
    // vibración del servo mientras las valvas se mueven
    let w = 0;
    for (const lp of profiles) w += Math.abs(leafletState(ti, p, lp).omega);
    w /= 3 * omegaNorm;
    v += V.servoGain * w * Math.sin(2 * Math.PI * V.servoF * ti);
    s += S.servoGain * w * Math.sin(2 * Math.PI * S.servoF * ti);
    const idx = Math.round(ti * fs);
    v += V.noise * hashNoise(idx, 17);
    s += S.noise * hashNoise(idx, 91);
    vib[i] = v;
    snd[i] = s;
  }
  return { t, vib, snd, events: events.filter((e) => e.t >= t0) };
}

/** Eₓ = ∫ x² dt (regla del trapecio). */
export function integralSquare(x: ArrayLike<number>, fs: number, i0 = 0, i1 = x.length - 1) {
  let e = 0;
  for (let i = Math.max(0, i0); i < Math.min(x.length - 1, i1); i++) e += ((x[i] * x[i] + x[i + 1] * x[i + 1]) / 2) / fs;
  return e;
}

/** Descriptores de un ciclo completo (para comparar condiciones). */
export function cycleFeatures(p: SimParams) {
  const T = period(p);
  const fs = 4000;
  // ciclo de referencia: segundo ciclo (evita bordes)
  const sig = sampleSignals(T, 2 * T, p, fs);
  const closeWin = [PHASES.closeEnd * T - 0.01, Math.min(T, PHASES.closeEnd * T + 0.2)].map((x) => Math.round(x * fs));
  const openWin = [PHASES.openEnd * T - 0.01, PHASES.openEnd * T + 0.2].map((x) => Math.round(x * fs));
  const eClose = integralSquare(sig.vib, fs, closeWin[0], closeWin[1]);
  const eOpen = integralSquare(sig.vib, fs, openWin[0], openWin[1]);
  const eCycle = integralSquare(sig.vib, fs);
  const rms = Math.sqrt(eCycle / T);
  const profiles = leafletProfiles(p);
  const closeTimes = profiles.map((lp) => (lp.delay + PHASES.closeEnd) * T);
  const spread = (Math.max(...closeTimes) - Math.min(...closeTimes)) * 1000;
  const meanMax = profiles.reduce((s, lp) => s + lp.max, 0) / 3;
  const minGap = Math.max(...profiles.map((lp) => lp.min));
  return { eClose, eOpen, eCycle, rms, spreadMs: spread, meanMax, minGap };
}

/**
 * Índice de diferencia respecto de la condición normal (HEURÍSTICA DEMOSTRATIVA,
 * no es IA entrenada ni diagnóstico): promedio de las diferencias relativas de
 * cuatro descriptores, acotado a 100 %.
 */
export function differenceIndex(p: SimParams) {
  const ref = cycleFeatures({ ...p, condition: 'normal' });
  const cur = cycleFeatures(p);
  const rel = (a: number, b: number) => Math.min(1, Math.abs(a - b) / Math.max(Math.abs(b), 1e-9));
  const parts = {
    'Energía de cierre': rel(cur.eClose, ref.eClose),
    'Energía de apertura': rel(cur.eOpen, ref.eOpen),
    'Ángulo medio máximo': rel(cur.meanMax, ref.meanMax),
    'Dispersión de cierres': Math.min(1, cur.spreadMs / 50),
  };
  const values = Object.values(parts);
  return { index: (100 * values.reduce((s, v) => s + v, 0)) / values.length, parts, cur, ref };
}
