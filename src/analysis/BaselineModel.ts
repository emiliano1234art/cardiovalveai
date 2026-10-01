import type { BaselineAssessment, CycleFeatures, FeatureDeviation } from '../types/valvesense';
import { clamp, mean, pearson, std } from './dsp';

/** Descriptores usados para comparar con la línea basal. */
export const BASELINE_FEATURES: {
  key: keyof CycleFeatures;
  label: string;
  unit: string;
  /** piso de dispersión relativo a la media (evita z-scores infinitos) */
  relFloor: number;
  /** piso de dispersión absoluto */
  absFloor: number;
}[] = [
  { key: 'cycle_duration_ms', label: 'Duración de ciclo', unit: 'ms', relFloor: 0.02, absFloor: 5 },
  { key: 'servo_angle', label: 'Ángulo de apertura', unit: '°', relFloor: 0.03, absFloor: 1 },
  { key: 'opening_duration_ms', label: 'Tiempo de apertura', unit: 'ms', relFloor: 0.08, absFloor: 3 },
  { key: 'closing_duration_ms', label: 'Tiempo de cierre', unit: 'ms', relFloor: 0.08, absFloor: 3 },
  { key: 'piezo_rms', label: 'RMS vibración', unit: 'u.a.', relFloor: 0.08, absFloor: 0.002 },
  { key: 'piezo_peak', label: 'Pico vibración', unit: 'u.a.', relFloor: 0.08, absFloor: 0.01 },
  { key: 'audio_rms', label: 'RMS audio', unit: '', relFloor: 0.08, absFloor: 0.001 },
  { key: 'dominant_frequency', label: 'Frecuencia dominante', unit: 'Hz', relFloor: 0.05, absFloor: 20 },
  { key: 'spectral_centroid', label: 'Centroide espectral', unit: 'Hz', relFloor: 0.05, absFloor: 20 },
];

export interface BaselineStats {
  mean: number;
  std: number;
}

/**
 * Línea basal ValveSense: perfil estadístico de N ciclos de referencia.
 * Se calibra en simulación al iniciar y puede recapturarse con datos reales.
 */
export class BaselineModel {
  readonly stats: Record<string, BaselineStats>;
  readonly piezoEnvelope: number[];
  readonly audioEnvelope: number[];
  readonly cycles: number;
  readonly createdAt: number;
  readonly origin: 'simulated' | 'captured';

  private constructor(
    stats: Record<string, BaselineStats>,
    piezoEnv: number[],
    audioEnv: number[],
    cycles: number,
    origin: 'simulated' | 'captured',
  ) {
    this.stats = stats;
    this.piezoEnvelope = piezoEnv;
    this.audioEnvelope = audioEnv;
    this.cycles = cycles;
    this.createdAt = Date.now();
    this.origin = origin;
  }

  static fromCycles(cycles: CycleFeatures[], origin: 'simulated' | 'captured'): BaselineModel {
    const stats: Record<string, BaselineStats> = {};
    for (const f of BASELINE_FEATURES) {
      const v = cycles.map((c) => c[f.key] as number);
      stats[f.key] = { mean: mean(v), std: std(v) };
    }
    return new BaselineModel(
      stats,
      averageEnvelopes(cycles.map((c) => c.piezo_envelope)),
      averageEnvelopes(cycles.map((c) => c.audio_envelope)),
      cycles.length,
      origin,
    );
  }

  assess(f: CycleFeatures): BaselineAssessment {
    const deviations: FeatureDeviation[] = BASELINE_FEATURES.map((d) => {
      const s = this.stats[d.key];
      const value = f[d.key] as number;
      const sigma = Math.max(s.std, d.relFloor * Math.abs(s.mean), d.absFloor);
      return { key: d.key, label: d.label, unit: d.unit, value, baseline: s.mean, z: (value - s.mean) / sigma };
    });
    // distancia multivariante (z-scores acotados)
    const D = Math.sqrt(mean(deviations.map((d) => Math.min(Math.abs(d.z), 8) ** 2)));
    const r = 0.5 * pearson(f.piezo_envelope, this.piezoEnvelope) + 0.5 * pearson(f.audio_envelope, this.audioEnvelope);

    const featureScore = 1 - Math.exp(-Math.max(0, D - 1.2) / 2.2);
    const shapeScore = clamp((0.95 - r) / 0.55, 0, 1);
    const anomaly = clamp(0.72 * featureScore + 0.28 * shapeScore, 0, 1);
    const similarity = clamp(100 * (0.62 * Math.exp(-(D * D) / 24) + 0.38 * clamp(r, 0, 1)), 0, 100);
    return { similarity, anomaly, shapeCorrelation: r, deviations };
  }
}

function averageEnvelopes(list: number[][]): number[] {
  if (list.length === 0) return [];
  const n = list[0].length;
  const out = new Array<number>(n).fill(0);
  for (const e of list) for (let i = 0; i < n; i++) out[i] += e[i] / list.length;
  return out;
}
