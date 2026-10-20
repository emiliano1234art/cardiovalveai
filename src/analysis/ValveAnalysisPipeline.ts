import { THRESHOLDS } from '../config/modes';
import type {
  BaselineAssessment,
  CycleFeatures,
  CycleRecord,
  DataSourceKind,
  DeviationLevel,
  ExperimentalMode,
  SignalChunk,
  Verdict,
} from '../types/valvesense';
import { BaselineModel } from './BaselineModel';
import { CycleAnalyzer } from './CycleAnalyzer';
import { clamp, mean, std } from './dsp';

/** Tolerancia de sincronía válvula–ECG (ms). */
const SYNC_TOL_MS = 60;

export const deviationLevel = (anomaly: number): DeviationLevel =>
  anomaly >= THRESHOLDS.major ? 'major' : anomaly >= THRESHOLDS.mild ? 'mild' : 'normal';

/** Regularidad (%) a partir del coeficiente de variación de la duración de ciclo. */
export function regularityFromDurations(durations: number[]): number {
  if (durations.length < 3) return 100;
  const cv = std(durations) / mean(durations);
  return 100 * Math.exp(-((cv / 0.12) ** 1.5));
}

export interface PipelineResult {
  record: CycleRecord;
  features: CycleFeatures;
  assessment: BaselineAssessment;
}

/**
 * Orquesta: segmentación → descriptores → comparación con basal → registro.
 * Es independiente del origen de los datos (simulación o ESP32).
 */
export class ValveAnalysisPipeline {
  private analyzer = new CycleAnalyzer();
  private durations: number[] = [];
  private residuals: number[] = [];
  private rrs: number[] = [];
  private emaSim: number | null = null;
  private emaAnom: number | null = null;
  private capture: { target: number; cycles: CycleFeatures[]; resolve: (b: BaselineModel) => void } | null = null;
  baseline: BaselineModel | null;

  constructor(baseline: BaselineModel | null = null) {
    this.baseline = baseline;
  }

  reset() {
    this.analyzer.reset();
    this.durations = [];
    this.emaSim = null;
    this.emaAnom = null;
    this.residuals = [];
    this.rrs = [];
  }

  /** Reemplaza la línea basal (p. ej. al cambiar la temporización programada). */
  setBaseline(b: BaselineModel | null) {
    this.baseline = b;
    this.emaSim = null;
    this.emaAnom = null;
  }

  /** Inicia la captura de una nueva línea basal con los próximos `n` ciclos. */
  captureBaseline(n: number): Promise<BaselineModel> {
    return new Promise((resolve) => {
      this.capture = { target: n, cycles: [], resolve };
    });
  }

  captureProgress(): number | null {
    return this.capture ? this.capture.cycles.length / this.capture.target : null;
  }

  process(chunk: SignalChunk, source: DataSourceKind, mode: ExperimentalMode | null): PipelineResult[] {
    const results: PipelineResult[] = [];
    for (const f of this.analyzer.push(chunk)) {
      if (this.capture) {
        this.capture.cycles.push(f);
        if (this.capture.cycles.length >= this.capture.target) {
          this.baseline = BaselineModel.fromCycles(this.capture.cycles, source === 'simulation' ? 'simulated' : 'captured');
          this.capture.resolve(this.baseline);
          this.capture = null;
          this.emaSim = null;
          this.emaAnom = null;
        }
      }
      results.push(this.ingestFeatures(f, source, mode, this.analyzer.lastPiezoRaw));
    }
    return results;
  }

  /** Permite ingresar descriptores ya calculados (p. ej. por el firmware). */
  ingestFeatures(f: CycleFeatures, source: DataSourceKind, mode: ExperimentalMode | null, piezoRaw = 0): PipelineResult {
    this.durations.push(f.cycle_duration_ms);
    if (this.durations.length > 12) this.durations.shift();
    // Con ECG, la regularidad se mide respecto del ritmo: la variación del RR es fisiológica,
    // lo que importa es que el ciclo valvular siga al RR.
    const syncErr = f.rr_ms ? Math.abs(f.cycle_duration_ms - f.rr_ms) : null;
    if (f.rr_ms) {
      this.residuals.push(f.cycle_duration_ms - f.rr_ms);
      this.rrs.push(f.rr_ms);
      if (this.residuals.length > 12) this.residuals.shift();
      if (this.rrs.length > 12) this.rrs.shift();
    }
    // dispersión robusta (MAD): un ciclo de transición aislado no la domina
    const regularity =
      f.rr_ms && this.residuals.length >= 3 ? 100 * Math.exp(-((mad(this.residuals) / mean(this.rrs) / 0.06) ** 1.5)) : regularityFromDurations(this.durations);

    const assessment: BaselineAssessment = this.baseline
      ? this.baseline.assess(f)
      : { similarity: 100, anomaly: 0, shapeCorrelation: 1, deviations: [] };

    // la irregularidad sostenida también es una desviación del patrón basal
    const irregularPenalty = clamp((90 - regularity) / 90, 0, 1) * 0.4;
    const syncPenalty = syncErr !== null ? clamp((syncErr - SYNC_TOL_MS) / 200, 0, 0.5) : 0;
    const anomalyRaw = clamp(Math.max(assessment.anomaly, irregularPenalty + syncPenalty + assessment.anomaly * 0.3), 0, 1);
    const simRaw = clamp(assessment.similarity * (1 - irregularPenalty * 0.5), 0, 100);

    const a = 0.4;
    this.emaSim = this.emaSim === null ? simRaw : this.emaSim + a * (simRaw - this.emaSim);
    this.emaAnom = this.emaAnom === null ? anomalyRaw : this.emaAnom + a * (anomalyRaw - this.emaAnom);

    const recentBpm = 60000 / mean(this.durations.slice(-5));
    const level = deviationLevel(this.emaAnom);
    const baseBpm = this.baseline?.bpm ?? null;
    const hrChange = baseBpm !== null && Math.abs((f.ecg_bpm ?? recentBpm) - baseBpm) >= 10;
    const verdict: Verdict = level === 'major' ? 'importante' : level === 'mild' ? 'leve' : hrChange ? 'fc' : 'basal';
    const record: CycleRecord = {
      timestamp: f.timestamp,
      cycle_number: f.cycle_number,
      bpm: round(recentBpm, 1),
      servo_angle: round(f.servo_angle, 1),
      valve_state: 'closed',
      piezo_raw: round(piezoRaw, 4),
      piezo_rms: round(f.piezo_rms, 4),
      piezo_peak: round(f.piezo_peak, 4),
      piezo_energy: round(f.piezo_energy, 5),
      audio_rms: round(f.audio_rms, 4),
      dominant_frequency: round(f.dominant_frequency, 1),
      spectral_centroid: round(f.spectral_centroid, 1),
      cycle_duration_ms: round(f.cycle_duration_ms, 1),
      opening_duration_ms: round(f.opening_duration_ms, 1),
      closing_duration_ms: round(f.closing_duration_ms, 1),
      // sin patrón de referencia no hay comparación: no se inventa un valor
      baseline_similarity: this.baseline ? round(this.emaSim, 1) : null,
      anomaly_score: this.baseline ? round(this.emaAnom, 3) : null,
      regularity: round(regularity, 1),
      ecg_bpm: f.ecg_bpm !== null ? round(f.ecg_bpm, 1) : null,
      rr_ms: f.rr_ms !== null ? round(f.rr_ms, 0) : null,
      sync_error_ms: syncErr !== null ? round(syncErr, 0) : null,
      verdict,
      mode,
      source,
    };
    return { record, features: f, assessment: { ...assessment, similarity: this.emaSim, anomaly: this.emaAnom } };
  }
}

const median = (x: number[]) => {
  const s = [...x].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Desvío absoluto mediano escalado (≈ σ para datos normales). */
const mad = (x: number[]) => {
  const m = median(x);
  return 1.4826 * median(x.map((v) => Math.abs(v - m)));
};

const round = (v: number, d: number) => {
  const k = 10 ** d;
  return Math.round(v * k) / k;
};
