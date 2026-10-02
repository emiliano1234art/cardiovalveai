/** Utilidades de procesamiento de señal (sin dependencias). */

export function rms(x: ArrayLike<number>): number {
  if (x.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
}

export function peakAbs(x: ArrayLike<number>): { value: number; index: number } {
  let m = 0;
  let idx = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > m) {
      m = a;
      idx = i;
    }
  }
  return { value: m, index: idx };
}

/** Energía ∑x²·Δt. */
export function energy(x: ArrayLike<number>, fs: number): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return s / fs;
}

const hannCache = new Map<number, Float32Array>();
export function hann(n: number): Float32Array {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    hannCache.set(n, w);
  }
  return w;
}

/** FFT radix-2 in-place (n potencia de 2). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Espectro de potencia de una trama (ventana Hann). Devuelve n/2 bins. */
export function powerSpectrum(frame: ArrayLike<number>, n: number): Float64Array {
  const w = hann(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const len = Math.min(n, frame.length);
  for (let i = 0; i < len; i++) re[i] = frame[i] * w[i];
  fft(re, im);
  const out = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) out[i] = (re[i] * re[i] + im[i] * im[i]) / n;
  return out;
}

/** Densidad espectral promediada (Welch, 50 % solapamiento). */
export function welch(x: ArrayLike<number>, n = 512): Float64Array {
  const acc = new Float64Array(n / 2);
  const hop = n / 2;
  let frames = 0;
  for (let start = 0; start + n <= x.length; start += hop) {
    const seg = Array.prototype.slice.call(x, start, start + n) as number[];
    const p = powerSpectrum(seg, n);
    for (let i = 0; i < acc.length; i++) acc[i] += p[i];
    frames++;
  }
  if (frames === 0) return powerSpectrum(x, n);
  for (let i = 0; i < acc.length; i++) acc[i] /= frames;
  return acc;
}

export interface SpectralFeatures {
  dominant: number;
  centroid: number;
}

/** Frecuencia dominante y centroide espectral, ignorando por debajo de `fmin`. */
export function spectralFeatures(psd: Float64Array, fs: number, fmin = 150): SpectralFeatures {
  const n = psd.length * 2;
  const df = fs / n;
  const k0 = Math.ceil(fmin / df);
  let best = k0;
  let num = 0;
  let den = 0;
  for (let k = k0; k < psd.length; k++) {
    if (psd[k] > psd[best]) best = k;
    num += k * df * psd[k];
    den += psd[k];
  }
  // interpolación parabólica del pico
  let dominant = best * df;
  if (best > k0 && best < psd.length - 1) {
    const a = psd[best - 1];
    const b = psd[best];
    const c = psd[best + 1];
    const d = a - 2 * b + c;
    if (d !== 0) dominant = (best + (0.5 * (a - c)) / d) * df;
  }
  return { dominant, centroid: den > 0 ? num / den : 0 };
}

/** Envolvente: media de |x| en `points` intervalos iguales (fase normalizada). */
export function phaseEnvelope(x: ArrayLike<number>, points: number): number[] {
  const out = new Array<number>(points).fill(0);
  if (x.length === 0) return out;
  for (let p = 0; p < points; p++) {
    const a = Math.floor((p * x.length) / points);
    const b = Math.max(a + 1, Math.floor(((p + 1) * x.length) / points));
    let s = 0;
    for (let i = a; i < b; i++) s += Math.abs(x[i]);
    out[p] = s / (b - a);
  }
  return out;
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0;
}

export function mean(x: number[]): number {
  return x.length ? x.reduce((s, v) => s + v, 0) / x.length : 0;
}

export function std(x: number[]): number {
  if (x.length < 2) return 0;
  const m = mean(x);
  return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1));
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
