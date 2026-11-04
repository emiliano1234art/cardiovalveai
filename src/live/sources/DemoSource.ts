import { DEFAULT_ANGLES } from '../config';
import { hallToDegrees, HALL_POS_DEG } from '../hallMath';
import type { Hello, LinkStatus, LiveSource, Sample, ValveMode } from '../types';

const PROFILE = {
  SANO: { tSubida: 1800, tMeseta: 400, tBajada: 1500, tDiastole: 1200 },
  INCOMPLETA: { tSubida: 1300, tMeseta: 300, tBajada: 1200, tDiastole: 1200 },
} as const;

const smoother = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/**
 * Simulador del ESP32: reproduce el mismo protocolo (servo + 3 Hall) para probar
 * el dashboard sin hardware. No es un dato real.
 */
export class DemoSource implements LiveSource {
  readonly kind = 'demo' as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cbSample: (s: Sample) => void = () => {};
  private cbStatus: (s: LinkStatus, d?: string) => void = () => {};
  private cbHello: (h: Hello) => void = () => {};
  private mode: ValveMode = 'SANO';
  private active = true;
  private phase = 3; // 0 apertura · 1 meseta · 2 cierre · 3 diástole
  private phaseStart = 0;
  private cycle = 0;
  private angle = 0;
  private t0 = 0;

  onSample(cb: (s: Sample) => void) { this.cbSample = cb; }
  onStatus(cb: (s: LinkStatus, d?: string) => void) { this.cbStatus = cb; }
  onHello(cb: (h: Hello) => void) { this.cbHello = cb; }
  onInfo() {}

  async start(): Promise<void> {
    this.t0 = performance.now();
    this.phaseStart = 0;
    this.cbStatus('connected', 'Modo demostración (datos simulados)');
    this.cbHello({ normal: DEFAULT_ANGLES.SANO, incompleta: DEFAULT_ANGLES.INCOMPLETA, fw: 'demo' });
    this.timer = setInterval(() => this.tick(), 40);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.cbStatus('idle', 'Desconectado');
  }

  send(cmd: string): void {
    const c = cmd.toUpperCase();
    if (c === 'MODE:SANO') this.mode = 'SANO';
    else if (c === 'MODE:INCOMPLETA') this.mode = 'INCOMPLETA';
    else if (c === 'STOP') this.active = false;
    else if (c === 'START') {
      this.active = true;
      this.phase = 3;
      this.phaseStart = performance.now() - this.t0;
    }
  }

  private tick() {
    const now = performance.now() - this.t0;
    const p = PROFILE[this.mode];
    const peak = DEFAULT_ANGLES[this.mode];
    const t = now - this.phaseStart;

    if (!this.active) {
      this.angle = Math.max(0, this.angle - 1);
    } else if (this.phase === 0) {
      if (t < p.tSubida) this.angle = peak * smoother(t / p.tSubida);
      else { this.angle = peak; this.phase = 1; this.phaseStart = now; }
    } else if (this.phase === 1) {
      if (t >= p.tMeseta) { this.phase = 2; this.phaseStart = now; }
    } else if (this.phase === 2) {
      if (t < p.tBajada) this.angle = peak * (1 - smoother(t / p.tBajada));
      else { this.angle = 0; this.phase = 3; this.phaseStart = now; }
    } else if (t >= p.tDiastole) {
      this.phase = 0;
      this.phaseStart = now;
      this.cycle++;
    }

    // El imán sigue a la valva: cada Hall responde según la cercanía a su posición.
    // las posiciones de los sensores se escalan con el ángulo de apertura normal (80°, 180°…)
    const k = DEFAULT_ANGLES.SANO / 80;
    const w = HALL_POS_DEG.map((pos) => {
      const d = (this.angle - pos * k) / (14 * k);
      const g = Math.exp(-d * d) + (Math.random() - 0.5) * 0.02;
      return Math.min(1, Math.max(0, (g - 0.15) / 0.85)); // zona muerta
    }) as [number, number, number];
    const raw = w.map((x, i) => Math.round(2048 + x * 600 * (i % 2 ? -1 : 1) + (Math.random() - 0.5) * 8)) as [number, number, number];

    this.cbSample({
      t: Math.round(now),
      servoDeg: this.angle,
      hallRaw: raw,
      hallW: w,
      hallDeg: hallToDegrees(w) * k,
      mode: this.mode,
      phase: !this.active ? 'PAUSA' : ['APERTURA', 'MESETA', 'CIERRE', 'DIASTOLE'][this.phase],
      cycle: this.cycle,
      active: this.active,
    });
  }
}
