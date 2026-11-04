/** Modo de la válvula que se muestra y que se ordena al ESP32. */
export type ValveMode = 'SANO' | 'INCOMPLETA';

export type LinkStatus = 'idle' | 'connecting' | 'connected' | 'error';
export type LinkKind = 'usb' | 'demo' | null;

/** Una línea de telemetría del ESP32 (25 Hz). */
export interface Sample {
  /** ms desde que arrancó el ESP32 */
  t: number;
  /** ángulo comandado al servo (°) */
  servoDeg: number;
  /** lectura ADC filtrada de cada Hall (0–4095) */
  hallRaw: [number, number, number];
  /** intensidad normalizada 0–1 de cada Hall (ya sin neutro) */
  hallW: [number, number, number];
  /** ángulo estimado a partir de los Hall (°) */
  hallDeg: number;
  mode: ValveMode;
  phase: string;
  cycle: number;
  active: boolean;
}

export interface Hello {
  normal: number;
  incompleta: number;
  fw?: string;
}

export interface LiveSource {
  readonly kind: Exclude<LinkKind, null>;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(cmd: string): void;
  onSample(cb: (s: Sample) => void): void;
  onStatus(cb: (s: LinkStatus, detail?: string) => void): void;
  onHello(cb: (h: Hello) => void): void;
  onInfo(cb: (msg: string) => void): void;
}

/** Un ciclo de apertura/cierre completo, guardado en el historial. */
export interface CycleRecord {
  id: string;
  session: string;
  /** epoch ms al terminar el ciclo */
  ts: number;
  n: number;
  mode: ValveMode;
  /** ángulo máximo mostrado en el ciclo (°) */
  peak: number;
  /** ángulo máximo medido por los Hall (°) */
  hallPeak: number;
  /** ángulo máximo comandado al servo (°) */
  servoPeak: number;
  durMs: number;
  openMs: number;
  closeMs: number;
  /** ciclos por minuto (a partir del inicio del ciclo anterior) */
  bpm: number;
}
