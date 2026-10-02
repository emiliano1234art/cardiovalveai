import { ACQ, DEFAULT_BPM, MODES, type ModeProfile } from '../config/modes';
import type { ExperimentalMode, SignalChunk } from '../types/valvesense';
import { Rng } from './rng';

/**
 * Sintetizador físico-simplificado de la válvula experimental.
 *
 * Genera las mismas tres señales crudas que entregará el ESP32:
 *  - ángulo del servo / valvas (°)
 *  - vibración piezoeléctrica (u.a.)
 *  - sonido del micrófono MEMS (normalizado)
 *
 * Cada evento mecánico (tope de apertura, impacto de cierre, rebote) se modela
 * como un resonador amortiguado. Los valores son SINTÉTICOS.
 */

interface Resonator {
  t0: number;
  amp: number;
  freq: number;
  decay: number;
}

interface CycleParams {
  start: number;
  period: number;
  maxAngle: number;
  openS: number;
  closeS: number;
  openEnd: number;
  profile: ModeProfile;
}

/** Filtro paso-banda biquad (RBJ) para colorear ruido de flujo. */
class Bandpass {
  private b0 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private f = -1;

  constructor(private fs: number, private q: number) {}

  set(freq: number) {
    if (freq === this.f) return;
    this.f = freq;
    const w = (2 * Math.PI * freq) / this.fs;
    const alpha = Math.sin(w) / (2 * this.q);
    const a0 = 1 + alpha;
    this.b0 = alpha / a0;
    this.b2 = -alpha / a0;
    this.a1 = (-2 * Math.cos(w)) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export class ValveSignalSynth {
  readonly fsPiezo = ACQ.FS_PIEZO;
  readonly fsAudio = ACQ.FS_AUDIO;

  private rng: Rng;
  private mode: ExperimentalMode = 'normal';
  private bpm = DEFAULT_BPM;
  /** Índice absoluto de muestra del piezo (reloj maestro). */
  private n = 0;
  private cycle: CycleParams;
  private piezoRes: Resonator[] = [];
  private audioRes: Resonator[] = [];
  private jet: Bandpass;
  private flow: Bandpass;
  private lastAngle = 0;

  constructor(seed = 7) {
    this.rng = new Rng(seed);
    this.jet = new Bandpass(this.fsAudio, 2.2);
    this.flow = new Bandpass(this.fsPiezo, 1.5);
    this.flow.set(28);
    this.cycle = this.newCycle(0.15);
  }

  setMode(mode: ExperimentalMode) {
    this.mode = mode;
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
  }

  getMode() {
    return this.mode;
  }

  getBpm() {
    return this.bpm;
  }

  /** Tiempo actual de la simulación en ms. */
  nowMs() {
    return (this.n / this.fsPiezo) * 1000;
  }

  currentAngle() {
    return this.lastAngle;
  }

  /** Planifica un nuevo ciclo; los cambios de modo se aplican en el límite de ciclo. */
  private newCycle(start: number): CycleParams {
    const p = MODES[this.mode];
    const r = this.rng;
    const nominal = 60 / this.bpm;
    let period = nominal * (1 + p.rrJitter * r.gauss());
    if (p.prematureProb > 0 && r.next() < p.prematureProb) period = nominal * r.range(0.55, 0.72);
    else if (p.prematureProb > 0 && r.next() < p.prematureProb * 0.6) period = nominal * r.range(1.25, 1.45);
    period = Math.max(nominal * 0.5, period);

    const maxAngle = Math.max(10, p.maxAngle + p.angleJitter * r.gauss());
    const openS = (p.openMs * (1 + 0.04 * r.gauss())) / 1000;
    const closeS = (p.closeMs * (1 + 0.05 * r.gauss())) / 1000;
    // El tiempo abierto escala con el período pero conserva un mínimo físico.
    const openEnd = Math.max(openS + 0.06, Math.min(period - closeS - 0.08, p.openFraction * period));

    const amp = Math.max(0.3, 1 + p.ampJitter * r.gauss());
    // Las amplitudes acompañan al ángulo realmente alcanzado.
    const angleFactor = Math.min(1.15, maxAngle / p.maxAngle);

    const tOpen = start + openS;
    const tClose = start + openEnd + closeS;
    const piezoDecay = 0.034 * Math.sqrt(p.closeDecayMs / 6);

    // Piezo: tope de apertura + impacto de cierre (fundamental + armónico)
    this.piezoRes.push(
      { t0: tOpen, amp: 0.9 * p.openClickAmp * amp * angleFactor, freq: 58, decay: 0.026 },
      { t0: tClose, amp: 1.0 * p.closeClickAmp * amp, freq: p.piezoCloseFreq, decay: piezoDecay },
      { t0: tClose, amp: 0.38 * p.closeClickAmp * amp, freq: p.piezoCloseFreq * 2.6, decay: piezoDecay * 0.35 },
    );
    // Audio: clic de apertura, clic de cierre con armónico y golpe grave
    const cd = p.closeDecayMs / 1000;
    this.audioRes.push(
      { t0: tOpen, amp: 0.5 * p.openClickAmp * amp * angleFactor, freq: p.openFreq, decay: 0.004 },
      { t0: tClose, amp: 0.62 * p.closeClickAmp * amp, freq: p.closeFreq, decay: cd },
      { t0: tClose, amp: 0.26 * p.closeClickAmp * amp, freq: p.closeFreq * 1.93, decay: cd * 0.5 },
      { t0: tClose, amp: 0.18 * p.closeClickAmp * amp, freq: 190, decay: 0.012 },
    );
    if (p.reboundAmp > 0) {
      const tr = tClose + 0.032 + 0.006 * r.gauss();
      this.piezoRes.push({ t0: tr, amp: p.reboundAmp * amp, freq: p.piezoCloseFreq * 1.2, decay: piezoDecay * 0.7 });
      this.audioRes.push({ t0: tr, amp: 0.55 * p.reboundAmp * amp, freq: p.closeFreq * 1.12, decay: cd * 0.8 });
    }

    return { start, period, maxAngle, openS, closeS, openEnd, profile: p };
  }

  private angleAt(t: number): number {
    const c = this.cycle;
    const tau = t - c.start;
    if (tau < 0) return 0;
    if (tau < c.openS) return c.maxAngle * smoothstep(tau / c.openS);
    if (tau < c.openEnd) {
      // pequeña oscilación de las valvas mientras están abiertas
      return c.maxAngle + 0.5 * Math.sin(2 * Math.PI * 9 * tau) * Math.exp(-(tau - c.openS) * 12);
    }
    if (tau < c.openEnd + c.closeS) return c.maxAngle * (1 - smoothstep((tau - c.openEnd) / c.closeS));
    return 0;
  }

  private static sumRes(list: Resonator[], t: number): number {
    let s = 0;
    for (const r of list) {
      const dt = t - r.t0;
      if (dt < 0 || dt > r.decay * 7) continue;
      s += r.amp * (1 - Math.exp(-dt / 0.0006)) * Math.exp(-dt / r.decay) * Math.sin(2 * Math.PI * r.freq * dt);
    }
    return s;
  }

  /** Genera `ms` milisegundos de señal. */
  generate(ms: number): SignalChunk {
    const nP = Math.max(1, Math.round((ms / 1000) * this.fsPiezo));
    const ratio = this.fsAudio / this.fsPiezo;
    const piezo = new Float32Array(nP);
    const servo = new Float32Array(nP);
    const audio = new Float32Array(nP * ratio);
    const t0_ms = this.nowMs();
    const r = this.rng;

    for (let i = 0; i < nP; i++) {
      const t = (this.n + i) / this.fsPiezo;
      if (t >= this.cycle.start + this.cycle.period) {
        this.cycle = this.newCycle(this.cycle.start + this.cycle.period);
        this.pruneResonators(t);
      }
      const p = this.cycle.profile;
      const angle = this.angleAt(t);
      const openness = angle / Math.max(1, p.maxAngle);
      servo[i] = angle + 0.25 * r.gauss();

      const flowVib = this.flow.process(r.gauss()) * (0.05 + 0.5 * p.jetNoise) * openness;
      piezo[i] = ValveSignalSynth.sumRes(this.piezoRes, t) + flowVib + 0.012 * r.gauss();

      this.jet.set(p.jetFreq);
      for (let k = 0; k < ratio; k++) {
        const ta = t + k / this.fsAudio;
        const jet = this.jet.process(r.gauss()) * p.jetNoise * 2.2 * openness;
        audio[i * ratio + k] = ValveSignalSynth.sumRes(this.audioRes, ta) + jet + 0.006 * r.gauss();
      }
      this.lastAngle = angle;
    }
    this.n += nP;
    return { t0_ms, fs_piezo: this.fsPiezo, fs_audio: this.fsAudio, piezo, servo, audio };
  }

  private pruneResonators(t: number) {
    const alive = (x: Resonator) => t - x.t0 < x.decay * 7;
    this.piezoRes = this.piezoRes.filter(alive);
    this.audioRes = this.audioRes.filter(alive);
  }
}
