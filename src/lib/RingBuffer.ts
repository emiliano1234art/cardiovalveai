/** Buffer circular de tamaño fijo para ventanas de visualización. */
export class RingBuffer {
  private buf: Float32Array;
  private idx = 0;
  /** Número total de muestras escritas desde el inicio. */
  written = 0;

  constructor(readonly size: number) {
    this.buf = new Float32Array(size);
  }

  push(data: ArrayLike<number>) {
    for (let i = 0; i < data.length; i++) {
      this.buf[this.idx] = data[i];
      this.idx = (this.idx + 1) % this.size;
    }
    this.written += data.length;
  }

  /** Muestra con índice absoluto `abs` (o NaN si ya no está en el buffer). */
  at(abs: number): number {
    if (abs < this.written - this.size || abs >= this.written || abs < 0) return NaN;
    return this.buf[abs % this.size];
  }

  /** Copia ordenada (más antigua → más reciente). */
  toArray(): Float32Array {
    const out = new Float32Array(this.size);
    out.set(this.buf.subarray(this.idx));
    out.set(this.buf.subarray(0, this.idx), this.size - this.idx);
    return out;
  }

  clear() {
    this.buf.fill(0);
    this.idx = 0;
    this.written = 0;
  }
}

export interface XY {
  t: number;
  v: number;
}

/**
 * Diezmado min/máx: conserva picos (clics valvulares) al reducir puntos.
 * Devuelve tiempos relativos al instante actual (segundos, ≤ 0).
 */
export function decimateMinMax(x: Float32Array, fs: number, buckets: number): XY[] {
  const out: XY[] = [];
  const per = x.length / buckets;
  const dur = x.length / fs;
  for (let b = 0; b < buckets; b++) {
    const a = Math.floor(b * per);
    const e = Math.floor((b + 1) * per);
    let mn = Infinity;
    let mx = -Infinity;
    let imn = a;
    let imx = a;
    for (let i = a; i < e; i++) {
      if (x[i] < mn) {
        mn = x[i];
        imn = i;
      }
      if (x[i] > mx) {
        mx = x[i];
        imx = i;
      }
    }
    const first = imn < imx ? [imn, mn] : [imx, mx];
    const second = imn < imx ? [imx, mx] : [imn, mn];
    out.push({ t: first[0] / fs - dur, v: first[1] }, { t: second[0] / fs - dur, v: second[1] });
  }
  return out;
}

/** Intervalos (s relativos) en que la válvula está abierta, a partir del ángulo. */
export function openIntervals(servo: Float32Array, fs: number, thresholdDeg: number): [number, number][] {
  const dur = servo.length / fs;
  const out: [number, number][] = [];
  let start: number | null = null;
  for (let i = 0; i < servo.length; i += 5) {
    const open = servo[i] > thresholdDeg;
    if (open && start === null) start = i;
    if (!open && start !== null) {
      out.push([start / fs - dur, i / fs - dur]);
      start = null;
    }
  }
  if (start !== null) out.push([start / fs - dur, 0]);
  return out;
}
