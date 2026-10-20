/**
 * Modelo de datos de ValveSense.
 *
 * Todo lo que circula por la aplicación —venga del simulador o del ESP32—
 * respeta estos contratos. Ver README §5 «Estructura de datos esperada».
 */

/** Condición mecánica experimental (misma definición que la presentación). */
export type ExperimentalMode = 'normal' | 'restricted' | 'incomplete' | 'irregular' | 'asymmetric';

export type ValveState = 'closed' | 'opening' | 'open' | 'closing';

export type DataSourceKind = 'simulation' | 'esp32';

export type ConnectionStatus = 'simulated' | 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Bloque de muestras crudas. Es la unidad mínima que entrega una fuente de datos.
 * El ESP32 debe enviar exactamente esto (ver README §4).
 */
export interface SignalChunk {
  /** Tiempo (ms) de la primera muestra, reloj de la fuente. */
  t0_ms: number;
  /** Frecuencia de muestreo del piezo y del ángulo del servo (Hz). */
  fs_piezo: number;
  /** Frecuencia de muestreo del micrófono MEMS (Hz). */
  fs_audio: number;
  /** Señal piezoeléctrica, unidades arbitrarias centradas en 0. */
  piezo: Float32Array;
  /** Ángulo del servo / válvula en grados, mismo muestreo que `piezo`. */
  servo: Float32Array;
  /** Señal acústica normalizada [-1, 1]. */
  audio: Float32Array;
  /** ECG (mV) opcional, mismo muestreo que `piezo`. */
  ecg?: Float32Array;
}

/** Descriptores extraídos de un ciclo completo (sin comparación con basal). */
export interface CycleFeatures {
  timestamp: number;
  cycle_number: number;
  bpm: number;
  servo_angle: number;
  piezo_rms: number;
  piezo_peak: number;
  piezo_energy: number;
  audio_rms: number;
  dominant_frequency: number;
  spectral_centroid: number;
  cycle_duration_ms: number;
  opening_duration_ms: number;
  closing_duration_ms: number;
  /** Envolvente de vibración en los primeros 500 ms desde la apertura (N puntos). */
  piezo_envelope: number[];
  /** Envolvente acústica en los primeros 500 ms desde la apertura (N puntos). */
  audio_envelope: number[];
  /** Último intervalo RR del ECG al cerrar el ciclo (ms), si hay ECG. */
  rr_ms: number | null;
  /** FC detectada desde el ECG (lpm), si hay ECG. */
  ecg_bpm: number | null;
}

/** Registro por ciclo: el formato canónico que se guarda, exporta y grafica. */
export interface CycleRecord {
  timestamp: number;
  cycle_number: number;
  bpm: number;
  servo_angle: number;
  valve_state: ValveState;
  /** Valor crudo del piezo en el instante de cierre (muestra representativa). */
  piezo_raw: number;
  piezo_rms: number;
  piezo_peak: number;
  piezo_energy: number;
  audio_rms: number;
  dominant_frequency: number;
  spectral_centroid: number;
  cycle_duration_ms: number;
  opening_duration_ms: number;
  closing_duration_ms: number;
  baseline_similarity: number | null;
  anomaly_score: number | null;
  regularity: number;
  /** FC detectada desde el ECG (lpm) */
  ecg_bpm: number | null;
  /** Intervalo RR del ECG (ms) */
  rr_ms: number | null;
  /** |duración del ciclo valvular − RR| (ms): ¿la válvula sigue al ECG? */
  sync_error_ms: number | null;
  /** Clasificación experimental */
  verdict: Verdict;
  /** Etiqueta experimental (sólo conocida en simulación; `null` con datos reales). */
  mode: ExperimentalMode | null;
  source: DataSourceKind;
}

export type DeviationLevel = 'normal' | 'mild' | 'major';

/** basal · fc (cambio de FC sin desviación mecánica) · leve · importante */
export type Verdict = 'basal' | 'fc' | 'leve' | 'importante';

export interface FeatureDeviation {
  key: keyof CycleFeatures;
  label: string;
  unit: string;
  value: number;
  baseline: number;
  z: number;
}

export interface BaselineAssessment {
  similarity: number;
  anomaly: number;
  shapeCorrelation: number;
  deviations: FeatureDeviation[];
}

export interface PatientSnapshot {
  t_s: number;
  heart_rate: number;
  spo2: number;
  activity: string;
  activity_level: number;
  borg: number;
  symptoms: string;
  exercise_duration_s: number;
  hr_recovery_1min: number | null;
  rehab_phase: string;
  session_stage: 'reposo' | 'calentamiento' | 'ejercicio' | 'enfriamiento' | 'recuperación';
}

export interface RehabSession {
  session: number;
  date: string;
  duration_min: number;
  peak_hr: number;
  borg_peak: number;
  hr_recovery: number;
  mean_similarity: number;
}
