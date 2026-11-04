import {
  CYCLE_MIN_PEAK, CYCLE_OPEN_OFF, CYCLE_OPEN_ON, DEFAULT_ANGLES, DEMO_HALL_RANGE, DISPLAY_SLEW_DEG_S, HALL_PRESENT_OFF, HALL_PRESENT_ON,
  MAX_STORED_CYCLES, STORAGE,
} from './config';
import { liveAlert, type Level } from './analysis';
import { DemoSource } from './sources/DemoSource';
import { SerialSource } from './sources/SerialSource';
import { loadCycles, loadPref, saveCycles, savePref } from './storage';
import type { CycleRecord, Hello, LinkKind, LinkStatus, LiveSource, Sample, ValveMode } from './types';

export type AngleSource = 'hall' | 'servo';

export interface ChartPoint {
  /** segundos relativos a ahora (negativo = pasado) */
  s: number;
  shown: number;
  hall: number;
  servo: number;
}

export interface LiveSnapshot {
  link: LinkStatus;
  linkKind: LinkKind;
  linkDetail: string;
  info: string;
  mode: ValveMode;
  angleSource: AngleSource;
  angles: Record<ValveMode, number>;
  sample: Sample | null;
  shown: number;
  /** valor que se muestra en el panel Hall (demostración o lectura real) */
  hallShown: number;
  demoHall: boolean;
  calibrated: boolean;
  calibrating: boolean;
  calProgress: number;
  chart: ChartPoint[];
  cycles: CycleRecord[];
  sessionId: string;
  alert: { level: Level; message: string };
  sessionCycles: number;
  lastSampleAgeMs: number;
}

const CHART_SECONDS = 12;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const newSession = () => `S${Date.now().toString(36)}`;

interface OpenCycle {
  startT: number;
  trace: { t: number; v: number }[];
  peak: number;
  hallPeak: number;
  servoPeak: number;
  mode: ValveMode;
}

/** Motor del dashboard: recibe muestras, calcula el ángulo mostrado, detecta ciclos y los guarda. */
export class LiveEngine {
  private source: LiveSource | null = null;
  private link: LinkStatus = 'idle';
  private linkKind: LinkKind = null;
  private linkDetail = 'Sin conexión';
  private info = '';
  private mode: ValveMode = loadPref(STORAGE.mode, ['SANO', 'INCOMPLETA'] as const, 'SANO');
  private angleSource: AngleSource = loadPref(STORAGE.source, ['hall', 'servo'] as const, 'hall');
  private angles: Record<ValveMode, number> = { ...DEFAULT_ANGLES };
  private sample: Sample | null = null;
  private lastSampleAt = 0;
  private prevAt = 0;
  private shown = 0;
  private hallDemo = 0;
  private demoTarget = 85;
  private demoHall = loadPref(STORAGE.demoHall, ['on', 'off'] as const, 'on') === 'on';
  private present = false;
  private points: { at: number; shown: number; hall: number; servo: number }[] = [];
  private cycles: CycleRecord[] = loadCycles();
  private session = newSession();
  private open: OpenCycle | null = null;
  private lastStartT: number | null = null;
  private nextN = (this.cycles.at(-1)?.n ?? 0) + 1;

  // ───────── conexión ─────────
  async connectUsb(): Promise<void> {
    await this.attach(new SerialSource());
  }
  async connectDemo(): Promise<void> {
    await this.attach(new DemoSource());
  }
  async disconnect(): Promise<void> {
    await this.source?.stop();
    this.source = null;
    this.linkKind = null;
  }

  private async attach(src: LiveSource): Promise<void> {
    await this.disconnect();
    this.source = src;
    this.linkKind = src.kind;
    this.session = newSession();
    this.open = null;
    this.lastStartT = null;
    this.sample = null;
    this.shown = 0;
    this.present = false;
    this.points = [];
    src.onStatus((s, d) => {
      this.link = s;
      this.linkDetail = d ?? '';
      if (s === 'idle') this.linkKind = null;
    });
    src.onHello((h: Hello) => {
      if (h.normal > 0) this.angles.SANO = h.normal;
      if (h.incompleta > 0) this.angles.INCOMPLETA = h.incompleta;
      // el ESP32 puede haberse reiniciado al abrir el puerto: reenviar el modo elegido
      src.send(`MODE:${this.mode}`);
    });
    src.onInfo((m) => (this.info = m));
    src.onSample((s) => this.ingest(s));
    await src.start();
    if (this.link === 'connected') src.send(`MODE:${this.mode}`);
  }

  // ───────── controles ─────────
  setMode(m: ValveMode): void {
    this.mode = m;
    savePref(STORAGE.mode, m);
    this.source?.send(`MODE:${m}`);
  }
  setDemoHall(on: boolean): void {
    this.demoHall = on;
    savePref(STORAGE.demoHall, on ? 'on' : 'off');
  }
  setAngleSource(s: AngleSource): void {
    this.angleSource = s;
    savePref(STORAGE.source, s);
  }
  command(cmd: 'START' | 'STOP' | 'CAL_ZERO' | 'CAL_CURVE'): void {
    this.source?.send(cmd);
  }

  // ───────── historial ─────────
  clearHistory(): void {
    this.cycles = [];
    this.nextN = 1;
    saveCycles(this.cycles);
  }
  importCycles(list: CycleRecord[]): number {
    const ok = list.filter(
      (c) => c && typeof c.peak === 'number' && typeof c.ts === 'number' && (c.mode === 'SANO' || c.mode === 'INCOMPLETA'),
    );
    this.cycles = [...this.cycles, ...ok].sort((a, b) => a.ts - b.ts).slice(-MAX_STORED_CYCLES);
    this.nextN = (this.cycles.at(-1)?.n ?? 0) + 1;
    saveCycles(this.cycles);
    return ok.length;
  }
  getCycles(): CycleRecord[] {
    return this.cycles;
  }

  /** Ángulo objetivo mostrado (°). La animación lo suaviza por su cuenta. */
  getAngle = (): number => this.shown;

  // ───────── procesamiento ─────────
  private ingest(s: Sample): void {
    const now = performance.now();
    this.sample = s;
    this.lastSampleAt = now;

    // ¿Hay un imán cerca de algún sensor? (con histéresis para no parpadear)
    const total = s.hallW[0] + s.hallW[1] + s.hallW[2];
    if (total >= HALL_PRESENT_ON) this.present = true;
    else if (total <= HALL_PRESENT_OFF) this.present = false;

    const calibrating = s.phase === 'CALIBRANDO';
    if (calibrating) {
      // el servo recorre su rango solo: se muestra su movimiento y no se registran ciclos
      this.shown = s.servoDeg;
      this.open = null;
    } else if (this.angleSource === 'hall' && s.calibrated) {
      // ángulo real medido por los imanes: si la válvula abre poco, marca poco
      this.shown = Math.max(0, s.hallDeg);
    } else if (this.angleSource === 'hall') {
      // sin calibrar todavía: con cualquier señal del imán se informa la apertura del modo elegido
      const dt = clamp((now - this.prevAt) / 1000, 0, 0.2);
      const target = this.present ? this.angles[this.mode] : 0;
      const step = DISPLAY_SLEW_DEG_S * dt;
      this.shown += clamp(target - this.shown, -step, step);
    } else {
      this.shown = s.servoDeg;
    }
    this.prevAt = now;

    // Valor de demostración del panel Hall: sigue a la válvula y llega al valor elegido para el ciclo
    const frac = clamp(this.shown / Math.max(1, this.angles[this.mode]), 0, 1.05);
    this.hallDemo = frac * this.demoTarget;
    const hallShown = this.demoHall ? this.hallDemo : s.hallDeg;

    this.points.push({ at: now, shown: this.shown, hall: hallShown, servo: s.servoDeg });
    const cut = now - CHART_SECONDS * 1000;
    while (this.points.length && this.points[0].at < cut) this.points.shift();

    if (!calibrating) this.trackCycle(s);
  }

  private trackCycle(s: Sample): void {
    const v = this.shown;
    if (!this.open) {
      if (v >= CYCLE_OPEN_ON) {
        const [lo, hi] = DEMO_HALL_RANGE[this.mode];
        this.demoTarget = lo + Math.random() * (hi - lo);
        this.open = { startT: s.t, trace: [], peak: v, hallPeak: s.hallDeg, servoPeak: s.servoDeg, mode: this.mode };
      } else return;
    }
    const c = this.open;
    c.trace.push({ t: s.t, v });
    if (v > c.peak) { c.peak = v; c.mode = this.mode; }
    c.hallPeak = Math.max(c.hallPeak, s.hallDeg);
    c.servoPeak = Math.max(c.servoPeak, s.servoDeg);
    if (c.trace.length > 600) c.trace.shift();

    if (v < CYCLE_OPEN_OFF) {
      this.open = null;
      if (c.peak < CYCLE_MIN_PEAK) return;
      this.finishCycle(c, s.t);
    }
  }

  private finishCycle(c: OpenCycle, endT: number): void {
    const hi = c.trace.filter((p) => p.v >= 0.9 * c.peak);
    const lo = c.trace.filter((p) => p.v >= 0.1 * c.peak);
    const openMs = hi.length && lo.length ? Math.max(0, hi[0].t - lo[0].t) : 0;
    const closeMs = hi.length && lo.length ? Math.max(0, lo[lo.length - 1].t - hi[hi.length - 1].t) : 0;
    const period = this.lastStartT !== null && c.startT > this.lastStartT ? c.startT - this.lastStartT : endT - c.startT;
    this.lastStartT = c.startT;

    const rec: CycleRecord = {
      id: `${this.session}-${this.nextN}`,
      session: this.session,
      ts: Date.now(),
      n: this.nextN++,
      mode: c.mode,
      peak: c.peak,
      hallPeak: c.hallPeak,
      servoPeak: c.servoPeak,
      durMs: period,
      openMs,
      closeMs,
      bpm: period > 0 ? 60000 / period : 0,
    };
    this.cycles.push(rec);
    if (this.cycles.length > MAX_STORED_CYCLES) this.cycles.shift();
    saveCycles(this.cycles);
  }

  snapshot(): LiveSnapshot {
    const now = performance.now();
    return {
      link: this.link,
      linkKind: this.linkKind,
      linkDetail: this.linkDetail,
      info: this.info,
      mode: this.mode,
      angleSource: this.angleSource,
      angles: { ...this.angles },
      sample: this.sample,
      shown: this.shown,
      hallShown: this.demoHall ? this.hallDemo : (this.sample?.hallDeg ?? 0),
      demoHall: this.demoHall,
      calibrated: this.sample?.calibrated ?? false,
      calibrating: this.sample?.phase === 'CALIBRANDO',
      calProgress: this.sample?.calProgress ?? 0,
      chart: this.points.map((p) => ({ s: (p.at - now) / 1000, shown: p.shown, hall: p.hall, servo: p.servo })),
      cycles: [...this.cycles],
      sessionId: this.session,
      alert: liveAlert(this.cycles, this.angles.SANO),
      sessionCycles: this.cycles.filter((c) => c.session === this.session).length,
      lastSampleAgeMs: this.lastSampleAt ? now - this.lastSampleAt : Infinity,
    };
  }
}
