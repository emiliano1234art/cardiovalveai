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
  normal: { id: 'normal', label: 'Normal', short: 'NORMAL', sub: 'Tres valvas · ciclo completo', description: 'Las tres valvas abren hasta el ángulo programado y cierran en el centro.' },
  restricted: { id: 'restricted', label: 'Apertura restringida', short: 'RESTRINGIDA', sub: 'Una valva llega a 40°', description: 'Un tope limita la apertura de una valva a 40°.' },
  incomplete: { id: 'incomplete', label: 'Cierre incompleto', short: 'CIERRE INCOMPLETO', sub: 'Una valva no cierra', description: 'Una valva no llega al centro: queda una separación residual de 12°.' },
  irregular: { id: 'irregular', label: 'Movimiento irregular', short: 'IRREGULAR', sub: 'Una valva varía', description: 'Una valva varía su apertura y su retardo ciclo a ciclo.' },
  asymmetric: { id: 'asymmetric', label: 'Apertura asimétrica', short: 'ASIMÉTRICA', sub: 'Valvas desparejas', description: 'Las tres valvas abren distinto y con un pequeño desfase.' },
};

export const MODE_ORDER: ExperimentalMode[] = ['normal', 'restricted', 'incomplete', 'irregular', 'asymmetric'];

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
