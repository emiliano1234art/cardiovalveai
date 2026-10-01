import type { ExperimentalMode } from '../types/valvesense';

/**
 * Perfil físico de cada estado experimental. Estos parámetros SÓLO alimentan al
 * simulador de señales; el análisis nunca los lee, sino que mide las señales.
 */
export interface ModeProfile {
  id: ExperimentalMode;
  label: string;
  short: string;
  description: string;
  /** Ángulo máximo de apertura (°). */
  maxAngle: number;
  /** Duración de la rampa de apertura (ms). */
  openMs: number;
  /** Duración de la rampa de cierre (ms). */
  closeMs: number;
  /** Fracción del ciclo en que la válvula permanece abierta. */
  openFraction: number;
  /** Variabilidad ciclo a ciclo del período (desv. relativa). */
  rrJitter: number;
  /** Probabilidad de un ciclo prematuro (sólo ritmo irregular). */
  prematureProb: number;
  /** Variabilidad relativa de amplitudes ciclo a ciclo. */
  ampJitter: number;
  /** Variabilidad del ángulo de apertura (°). */
  angleJitter: number;
  openClickAmp: number;
  closeClickAmp: number;
  /** Resonancia acústica principal del clic de cierre (Hz). */
  closeFreq: number;
  /** Constante de decaimiento del clic de cierre (ms). */
  closeDecayMs: number;
  openFreq: number;
  /** Amplitud de rebote tras el cierre (0 = sin rebote). */
  reboundAmp: number;
  /** Ruido de flujo / chorro mientras la válvula está abierta. */
  jetNoise: number;
  /** Frecuencia central del ruido de chorro (Hz). */
  jetFreq: number;
  /** Frecuencia mecánica principal registrada por el piezo en el cierre (Hz). */
  piezoCloseFreq: number;
}

export const MODES: Record<ExperimentalMode, ModeProfile> = {
  normal: {
    id: 'normal',
    label: 'Normal',
    short: 'NORMAL',
    description: 'Apertura completa, cierre regular, señales estables.',
    maxAngle: 85,
    openMs: 70,
    closeMs: 55,
    openFraction: 0.36,
    rrJitter: 0.008,
    prematureProb: 0,
    ampJitter: 0.04,
    angleJitter: 0.6,
    openClickAmp: 0.42,
    closeClickAmp: 1,
    closeFreq: 1050,
    closeDecayMs: 6,
    openFreq: 720,
    reboundAmp: 0,
    jetNoise: 0.018,
    jetFreq: 900,
    piezoCloseFreq: 72,
  },
  limited_opening: {
    id: 'limited_opening',
    label: 'Apertura limitada',
    short: 'APERTURA LIMITADA',
    description: 'Menor ángulo de apertura: vibración atenuada y ruido de chorro de alta frecuencia.',
    maxAngle: 46,
    openMs: 55,
    closeMs: 45,
    openFraction: 0.36,
    rrJitter: 0.01,
    prematureProb: 0,
    ampJitter: 0.05,
    angleJitter: 1.2,
    openClickAmp: 0.16,
    closeClickAmp: 0.68,
    closeFreq: 1320,
    closeDecayMs: 5,
    openFreq: 980,
    reboundAmp: 0,
    jetNoise: 0.11,
    jetFreq: 1850,
    piezoCloseFreq: 96,
  },
  altered_closing: {
    id: 'altered_closing',
    label: 'Cierre alterado',
    short: 'CIERRE ALTERADO',
    description: 'Cierre más lento y amortiguado, con rebote y desplazamiento acústico a graves.',
    maxAngle: 84,
    openMs: 70,
    closeMs: 165,
    openFraction: 0.36,
    rrJitter: 0.012,
    prematureProb: 0,
    ampJitter: 0.07,
    angleJitter: 0.8,
    openClickAmp: 0.4,
    closeClickAmp: 0.5,
    closeFreq: 610,
    closeDecayMs: 15,
    openFreq: 720,
    reboundAmp: 0.32,
    jetNoise: 0.022,
    jetFreq: 900,
    piezoCloseFreq: 48,
  },
  irregular_rhythm: {
    id: 'irregular_rhythm',
    label: 'Ritmo irregular',
    short: 'RITMO IRREGULAR',
    description: 'Alta variabilidad entre ciclos en período, amplitud y apertura.',
    maxAngle: 82,
    openMs: 70,
    closeMs: 55,
    openFraction: 0.36,
    rrJitter: 0.16,
    prematureProb: 0.14,
    ampJitter: 0.24,
    angleJitter: 7,
    openClickAmp: 0.42,
    closeClickAmp: 1,
    closeFreq: 1050,
    closeDecayMs: 6,
    openFreq: 720,
    reboundAmp: 0,
    jetNoise: 0.02,
    jetFreq: 900,
    piezoCloseFreq: 72,
  },
};

export const MODE_ORDER: ExperimentalMode[] = ['normal', 'limited_opening', 'altered_closing', 'irregular_rhythm'];

export const DEFAULT_BPM = 72;

/** Constantes de adquisición (deben coincidir con el firmware del ESP32). */
export const ACQ = {
  FS_PIEZO: 1000,
  FS_AUDIO: 8000,
  /** Puntos de la envolvente normalizada por fase del ciclo. */
  ENVELOPE_POINTS: 100,
  /** Umbral (fracción del ángulo máximo) para detectar inicio de ciclo. */
  CYCLE_THRESHOLD_DEG: 8,
} as const;

/** Umbrales del índice de anomalía (0–1). */
export const THRESHOLDS = { mild: 0.3, major: 0.6 } as const;
