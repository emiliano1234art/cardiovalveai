import { ValveSignalSynth } from '../simulation/ValveSignalSynth';
import type { ConnectionStatus, ExperimentalMode, SignalChunk } from '../types/valvesense';
import type { ValveDataSource } from './DataSource';

/** Fuente simulada: genera señales sintéticas en tiempo real (bloques de 50 ms). */
export class SimulatedValveSource implements ValveDataSource {
  readonly kind = 'simulation' as const;
  readonly synth: ValveSignalSynth;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private chunkCb: ((c: SignalChunk) => void) | null = null;
  private statusCb: ((s: ConnectionStatus) => void) | null = null;

  constructor(seed = 42, private intervalMs = 50) {
    this.synth = new ValveSignalSynth(seed);
  }

  setMode(mode: ExperimentalMode) {
    this.synth.setMode(mode);
  }

  setBpm(bpm: number) {
    this.synth.setBpm(bpm);
  }

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
      // si la pestaña estuvo oculta no intentamos "ponernos al día"
      const dt = Math.min(250, now - this.last);
      this.last = now;
      this.chunkCb?.(this.synth.generate(dt));
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
