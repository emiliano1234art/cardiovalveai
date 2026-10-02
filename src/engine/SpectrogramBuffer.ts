import { powerSpectrum } from '../analysis/dsp';

/** Espectrograma deslizante (STFT) del audio: columnas en dB. */
export class SpectrogramBuffer {
  readonly columns: Float32Array[] = [];
  private pending: number[] = [];
  /** máximo de referencia con decaimiento lento (escala estable) */
  refDb = -30;

  constructor(
    readonly fs: number,
    readonly n = 256,
    readonly hop = 128,
    readonly maxColumns = 240,
  ) {}

  get bins() {
    return this.n / 2;
  }

  /** Duración visible (s). */
  get seconds() {
    return (this.maxColumns * this.hop) / this.fs;
  }

  push(audio: ArrayLike<number>) {
    for (let i = 0; i < audio.length; i++) this.pending.push(audio[i]);
    while (this.pending.length >= this.n) {
      const p = powerSpectrum(this.pending, this.n);
      const col = new Float32Array(p.length);
      let mx = -200;
      for (let k = 0; k < p.length; k++) {
        col[k] = 10 * Math.log10(p[k] + 1e-12);
        if (col[k] > mx) mx = col[k];
      }
      this.refDb = Math.max(mx, this.refDb - 0.05);
      this.columns.push(col);
      if (this.columns.length > this.maxColumns) this.columns.shift();
      this.pending.splice(0, this.hop);
    }
  }

  clear() {
    this.columns.length = 0;
    this.pending = [];
  }
}
