import type { ExperimentalMode } from '../types/valvesense';

/** Condiciones mecánicas (etiquetas). La física está en presentation/sim/model.ts. */
export interface ModeProfile {
  id: ExperimentalMode;
  label: string;
  short: string;
  sub: string;
  description: string;
}

export const MODES: Record<ExperimentalMode, ModeProfile> = {
  normal: { id: 'normal', label: 'Normal', short: 'NORMAL', sub: 'Apertura completa · cierre en asiento', description: 'Ambas valvas abren hasta el ángulo programado y cierran sobre su asiento.' },
  restricted: { id: 'restricted', label: 'Apertura restringida', short: 'RESTRINGIDA', sub: 'Tope a 45°', description: 'Un tope limita la apertura de ambas valvas a 45°.' },
  incomplete: { id: 'incomplete', label: 'Cierre incompleto', short: 'CIERRE INCOMPLETO', sub: '12° residuales', description: 'Las valvas no alcanzan el asiento: queda una separación residual de 12°.' },
  irregular: { id: 'irregular', label: 'Movimiento irregular', short: 'IRREGULAR', sub: 'Valva 2 variable', description: 'La valva 2 varía su apertura y su retardo ciclo a ciclo.' },
};

export const MODE_ORDER: ExperimentalMode[] = ['normal', 'restricted', 'incomplete', 'irregular'];

export const DEFAULT_BPM = 72;

/** Constantes de adquisición (deben coincidir con el firmware del ESP32). */
export const ACQ = {
  FS_PIEZO: 1000,
  FS_AUDIO: 8000,
  /** Puntos de la envolvente temporal por ciclo. */
  ENVELOPE_POINTS: 100,
  /** Ventana de la envolvente desde el inicio de la apertura (s). */
  ENVELOPE_WINDOW_S: 0.5,
  /** Umbral del ángulo (°) para detectar inicio de ciclo. */
  CYCLE_THRESHOLD_DEG: 8,
} as const;

/** Umbrales del índice de anomalía (0–1). */
export const THRESHOLDS = { mild: 0.3, major: 0.6 } as const;
