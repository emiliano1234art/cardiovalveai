import type { ValveMode } from './types';

/** Valores por defecto; el ESP32 los reemplaza en su mensaje "hello". */
export const DEFAULT_ANGLES: Record<ValveMode, number> = {
  SANO: 90,
  INCOMPLETA: 55,
};

/** Ángulo de apertura de referencia de una válvula normal (°). */
export const REFERENCE_DEG = DEFAULT_ANGLES.SANO;

/** Suma de intensidades Hall para considerar que "hay imán" (con histéresis). */
export const HALL_PRESENT_ON = 0.12;
export const HALL_PRESENT_OFF = 0.04;

/** Velocidad máxima con que se mueve la válvula mostrada (°/s). */
export const DISPLAY_SLEW_DEG_S = 70;

/** Ciclo: se inicia al superar OPEN_ON y termina al bajar de OPEN_OFF. */
export const CYCLE_OPEN_ON = 8;
export const CYCLE_OPEN_OFF = 4;
export const CYCLE_MIN_PEAK = 10;

/** Clasificación según % de la apertura esperada. */
export const OPEN_PCT_NORMAL = 85;
export const OPEN_PCT_LIMITED = 70;

export const MODE_LABEL: Record<ValveMode, string> = {
  SANO: 'Válvula normal',
  INCOMPLETA: 'Válvula incompleta',
};

/**
 * Modo demostración del panel «Sensores Hall»: en vez de la lectura del sensor se muestra un valor
 * dentro de este rango (°) según el modo elegido. Se identifica como demostración en pantalla.
 */
export const DEMO_HALL_RANGE: Record<ValveMode, [number, number]> = {
  SANO: [80, 90],
  INCOMPLETA: [50, 60],
};

export const STORAGE = {
  cycles: 'valvesense.live.cycles.v1',
  mode: 'valvesense.live.mode.v1',
  source: 'valvesense.live.source.v1',
  demoHall: 'valvesense.live.demohall.v1',
};
export const MAX_STORED_CYCLES = 3000;
