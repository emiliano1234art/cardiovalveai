import { ACQ } from '../config/modes';
import { commandState, ecgAt, hash01, sampleSignals } from '../presentation/sim/model';
import { sim } from '../presentation/sim/store';
import type { ConnectionStatus, SignalChunk } from '../types/valvesense';
import type { ValveDataSource } from './DataSource';

/**
 * Sintetizador de bloques crudos a partir del modelo sincronizado con ECG
 * (válvula trivalva, misma física que la presentación):
 *   ECG → pico R → retardo τ → servo (ángulo comandado) → 3 valvas → piezo + MEMS.
 * Los parámetros (FC, τ, D, condición) se leen del estado compartido `sim`.
 */
/** Velocidad máxima de cambio de la FC simulada (lpm/s). */
const BPM_RATE = 12;

export class SyncedSynth {
  t = 0.05;
  /** FC efectiva: sigue a la programada de forma gradual (como una FC real) */
  private bpm = sim.state.params.bpm;

  generate(ms: number): SignalChunk {
    const target = sim.state.params.bpm;
    const maxStep = (BPM_RATE * ms) / 1000;
    const next = this.bpm + Math.max(-maxStep, Math.min(maxStep, target - this.bpm));
    // continuidad de fase al cambiar la FC (t/RR constante)
    if (next !== this.bpm) {
      this.t *= this.bpm / next;
      this.bpm = next;
    }
    const p = { ...sim.state.params, bpm: this.bpm };
    const fsP = ACQ.FS_PIEZO;
    const fsA = ACQ.FS_AUDIO;
    const n = Math.max(1, Math.round((ms / 1000) * fsP));
    const t0 = this.t;
    const s = sampleSignals(t0, t0 + n / fsP, p, fsA);
    const ratio = fsA / fsP;
    const piezo = new Float32Array(n);
    const servo = new Float32Array(n);
    const ecg = new Float32Array(n);
    const audio = new Float32Array(n * ratio);
    for (let i = 0; i < n; i++) {
      const ti = t0 + i / fsP;
      piezo[i] = s.vib[i * ratio] ?? 0;
      servo[i] = commandState(ti, p).theta + 0.25 * (hash01(Math.round(ti * fsP), 5) * 2 - 1);
      ecg[i] = ecgAt(ti, p);
    }
    audio.set(Float32Array.from(s.snd.subarray(0, n * ratio)));
    this.t += n / fsP;
    return { t0_ms: t0 * 1000, fs_piezo: fsP, fs_audio: fsA, piezo, servo, audio, ecg };
  }
}

/** Fuente simulada en tiempo real (bloques de 50 ms). */
export class SyncedSimSource implements ValveDataSource {
  readonly kind = 'simulation' as const;
  readonly synth = new SyncedSynth();
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private chunkCb: ((c: SignalChunk) => void) | null = null;
  private statusCb: ((s: ConnectionStatus) => void) | null = null;

  onChunk(cb: (chunk: SignalChunk) => void) {
    this.chunkCb = cb;
  }
  onStatus(cb: (s: ConnectionStatus) => void) {
    this.statusCb = cb;
  }
  start() {
    if (this.timer) return;
    this.statusCb?.('simulated');
    this.last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(250, now - this.last);
      this.last = now;
      if (!sim.state.playing || sim.state.motion === 'paused') return;
      this.chunkCb?.(this.synth.generate(dt * sim.state.speed));
    }, 50);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
