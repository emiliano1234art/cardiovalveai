import { calibrateSimulatedBaseline } from '../analysis/calibration';
import { ValveAnalysisPipeline, type PipelineResult } from '../analysis/ValveAnalysisPipeline';
import { ACQ, DEFAULT_BPM } from '../config/modes';
import { decimateMinMax, openIntervals, RingBuffer, type XY } from '../lib/RingBuffer';
import { PatientSimulator } from '../simulation/PatientSimulator';
import type { ValveDataSource } from '../sources/DataSource';
import { Esp32WebSocketSource } from '../sources/Esp32WebSocketSource';
import { SyncedSimSource } from '../sources/SyncedSimSource';
import { bpmFromPeaks, detectR, LIMITS, phaseName, rPeak, rrOf, type PhaseName, type SimParams } from '../presentation/sim/model';
import { sim as simState } from '../presentation/sim/store';
import type {
  ConnectionStatus,
  CycleRecord,
  DataSourceKind,
  ExperimentalMode,
  PatientSnapshot,
  SignalChunk,
} from '../types/valvesense';
import { SpectrogramBuffer } from './SpectrogramBuffer';

export const WINDOW_S = 3;
const clampBpm = (hr: number) => Math.round(Math.min(LIMITS.bpm[1], Math.max(LIMITS.bpm[0], hr)));
const MAX_RECORDS = 600;
const BASELINE_CYCLES = 30;

export interface EngineSnapshot {
  version: number;
  sourceKind: DataSourceKind;
  status: ConnectionStatus;
  statusDetail?: string;
  mode: ExperimentalMode;
  bpmProgrammed: number;
  piezo: XY[];
  audio: XY[];
  /** ECG en la ventana (mV), tiempos relativos (s) */
  ecg: XY[];
  /** picos R detectados en la ventana (s relativos) */
  rPeaks: number[];
  /** FC detectada desde los RR del ECG (lpm) */
  ecgBpm: number | null;
  /** segundos desde el último R detectado */
  sinceBeat: number | null;
  hasEcg: boolean;
  params: SimParams;
  /** fase de la válvula (en simulación, del modelo; con ESP32, por umbral de ángulo) */
  valvePhase: PhaseName | null;
  /** ms desde el último pico R (reloj del modelo en simulación) */
  msSinceR: number | null;
  open: [number, number][];
  records: CycleRecord[];
  latest: PipelineResult | null;
  patient: PatientSnapshot;
  hrTrend: { t: number; hr: number; spo2: number }[];
  baseline: { origin: 'simulated' | 'captured'; cycles: number; createdAt: number; bpm: number } | null;
  captureProgress: number | null;
  /** el ECG simulado sigue la FC del paciente simulado */
  followPatient: boolean;
  /** Envolventes por fase del ciclo: basal vs promedio de los últimos ciclos. */
  envelopes: { phase: number; basePiezo: number; curPiezo: number; baseAudio: number; curAudio: number }[];
}

/**
 * Motor de ValveSense: conecta una fuente de datos con el pipeline de análisis
 * y mantiene los buffers de visualización. No depende de React.
 */
export class ValveSenseEngine {
  readonly pipeline: ValveAnalysisPipeline;
  readonly spectro = new SpectrogramBuffer(ACQ.FS_AUDIO, 256, 128, Math.round((WINDOW_S * ACQ.FS_AUDIO) / 128));
  private piezo = new RingBuffer(ACQ.FS_PIEZO * WINDOW_S);
  private servo = new RingBuffer(ACQ.FS_PIEZO * WINDOW_S);
  private audio = new RingBuffer(ACQ.FS_AUDIO * WINDOW_S);
  /** 6 s de ECG: la ventana visible usa los últimos 3 s; el resto da contexto al detector */
  private ecgBuf = new RingBuffer(ACQ.FS_PIEZO * 6);
  private ecgCount = 0;
  private source: ValveDataSource | null = null;
  private simSource: SyncedSimSource | null = null;
  private records: CycleRecord[] = [];
  private latest: PipelineResult | null = null;
  private recent: PipelineResult[] = [];
  private patientSim = new PatientSimulator();
  private patient: PatientSnapshot;
  private hrTrend: { t: number; hr: number; spo2: number }[] = [];
  private lastChunkWall = 0;
  private lastChunkLen = 0;
  private version = 0;
  private status: ConnectionStatus = 'simulated';
  private statusDetail?: string;
  private sourceKind: DataSourceKind = 'simulation';
  private mode: ExperimentalMode = 'normal';
  private bpm = DEFAULT_BPM;
  private followPatient = false;

  constructor() {
    this.pipeline = new ValveAnalysisPipeline(calibrateSimulatedBaseline(40, DEFAULT_BPM));
    // pre-carga de 4 min de datos del paciente sintético para la tendencia
    this.patient = this.patientSim.step(0);
    for (let i = 0; i < 240; i++) this.stepPatient(1);
  }

  // ───────────────────────── fuentes ─────────────────────────

  connectSimulation() {
    this.swapSource(() => new SyncedSimSource(), 'simulation');
  }

  connectEsp32(url: string) {
    this.swapSource(() => new Esp32WebSocketSource(url), 'esp32');
  }

  private swapSource(make: () => ValveDataSource, kind: DataSourceKind) {
    this.source?.stop();
    this.sourceKind = kind;
    this.piezo.clear();
    this.servo.clear();
    this.audio.clear();
    this.spectro.clear();
    this.ecgBuf.clear();
    this.ecgCount = 0;
    this.pipeline.reset();
    this.latest = null;
    this.recent = [];
    const src = make();
    this.simSource = src instanceof SyncedSimSource ? src : null;
    src.onChunk((c) => this.ingest(c));
    src.onStatus((s, d) => {
      this.status = s;
      this.statusDetail = d;
    });
    src.onCycle?.((f) => this.pushResult(this.pipeline.ingestFeatures(f, kind, null)));
    src.onProgrammedBpm?.((b) => (this.bpm = b));
    this.source = src;
    src.start();
  }

  stop() {
    this.source?.stop();
  }

  setMode(mode: ExperimentalMode) {
    this.mode = mode;
    simState.setParams({ condition: mode });
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
    this.followPatient = false;
    simState.setParams({ bpm });
  }

  /** Retardo electromecánico τ y duración de apertura D (ms), ángulo máximo (°). */
  setTiming(patch: Partial<Pick<SimParams, 'delayMs' | 'openMs' | 'thetaMax'>>) {
    simState.setParams(patch);
    // la basal experimental se recalibra con la nueva temporización (condición normal, FC de reposo)
    if (this.recalTimer) clearTimeout(this.recalTimer);
    this.recalTimer = setTimeout(() => {
      const { delayMs, openMs, thetaMax } = simState.state.params;
      this.pipeline.setBaseline(calibrateSimulatedBaseline(24, DEFAULT_BPM, { delayMs, openMs, thetaMax }));
    }, 400);
  }
  private recalTimer: ReturnType<typeof setTimeout> | null = null;

  /** Recaptura la línea basal con los próximos ciclos de la fuente activa. */
  recaptureBaseline() {
    return this.pipeline.captureBaseline(BASELINE_CYCLES);
  }

  // ───────────────────────── datos ─────────────────────────

  private ingest(chunk: SignalChunk) {
    this.piezo.push(chunk.piezo);
    this.servo.push(chunk.servo);
    this.audio.push(chunk.audio);
    this.spectro.push(chunk.audio);
    if (chunk.ecg) {
      this.ecgBuf.push(chunk.ecg);
      this.ecgCount += chunk.ecg.length;
    }
    this.lastChunkWall = performance.now();
    this.lastChunkLen = chunk.piezo.length;
    const mode = this.sourceKind === 'simulation' ? simState.state.params.condition : null;
    for (const r of this.pipeline.process(chunk, this.sourceKind, mode)) this.pushResult(r);
  }

  private pushResult(r: PipelineResult) {
    this.latest = r;
    this.recent.push(r);
    if (this.recent.length > 4) this.recent.shift();
    this.records.push(r.record);
    if (this.records.length > MAX_RECORDS) this.records.shift();
  }

  private stepPatient(dt: number) {
    this.patient = this.patientSim.step(dt);
    this.hrTrend.push({ t: this.patient.t_s, hr: this.patient.heart_rate, spo2: this.patient.spo2 });
    if (this.hrTrend.length > 240) this.hrTrend.shift();
  }

  tickPatient(dt: number) {
    this.stepPatient(dt);
    if (this.followPatient && this.sourceKind === 'simulation') simState.setParams({ bpm: clampBpm(this.patient.heart_rate) });
  }

  /** Acopla la FC del ECG simulado a la del paciente simulado (demostración: ejercicio ≠ falla). */
  setFollowPatient(on: boolean) {
    this.followPatient = on;
    if (on) simState.setParams({ bpm: clampBpm(this.patient.heart_rate) });
    else simState.setParams({ bpm: DEFAULT_BPM });
  }

  /**
   * Ángulo suavizado para la animación: reproduce el buffer con un retardo de
   * un bloque, interpolando con el reloj de pared para 60 fps fluidos.
   */
  angleNow(): number {
    const elapsed = performance.now() - this.lastChunkWall;
    const back = Math.max(0, this.lastChunkLen - (elapsed / 1000) * ACQ.FS_PIEZO);
    const v = this.servo.at(Math.floor(this.servo.written - 1 - back));
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }

  exportRecords(): CycleRecord[] {
    return [...this.records];
  }

  snapshot(): EngineSnapshot {
    const b = this.pipeline.baseline;
    const params = simState.state.params;
    const fs = ACQ.FS_PIEZO;
    const hasEcg = this.ecgCount > 0;
    let ecg: XY[] = [];
    let rPeaks: number[] = [];
    let ecgBpm: number | null = null;
    let sinceBeat: number | null = null;
    if (hasEcg) {
      const arr = this.ecgBuf.toArray();
      const peaks = detectR(arr, fs);
      ecgBpm = bpmFromPeaks(peaks, fs);
      const off = arr.length - WINDOW_S * fs;
      ecg = decimateMinMax(arr.subarray(off), fs, 360);
      rPeaks = peaks.filter((k) => k >= off).map((k) => (k - arr.length) / fs);
      if (peaks.length) sinceBeat = (arr.length - peaks[peaks.length - 1]) / fs;
    }
    let valvePhase: PhaseName | null = null;
    let msSinceR: number | null = null;
    if (this.simSource) {
      // reloj del modelo retrasado un bloque (igual que la animación)
      const t = this.simSource.synth.t - this.lastChunkLen / fs + Math.min(this.lastChunkLen / fs, (performance.now() - this.lastChunkWall) / 1000);
      valvePhase = phaseName(t, params);
      let k = Math.floor(t / rrOf(params)) + 1;
      while (rPeak(k, params) > t) k--;
      msSinceR = (t - rPeak(k, params)) * 1000;
    } else if (this.servo.written > 0) {
      valvePhase = this.angleNow() > ACQ.CYCLE_THRESHOLD_DEG ? 'abierta' : 'cerrada';
    }
    return {
      valvePhase,
      msSinceR,
      ecg,
      rPeaks,
      ecgBpm,
      sinceBeat,
      hasEcg,
      params,
      version: ++this.version,
      sourceKind: this.sourceKind,
      status: this.status,
      statusDetail: this.statusDetail,
      mode: this.sourceKind === 'simulation' ? params.condition : this.mode,
      bpmProgrammed: this.sourceKind === 'simulation' ? params.bpm : this.bpm,
      piezo: decimateMinMax(this.piezo.toArray(), ACQ.FS_PIEZO, 360),
      audio: decimateMinMax(this.audio.toArray(), ACQ.FS_AUDIO, 360),
      open: openIntervals(this.servo.toArray(), ACQ.FS_PIEZO, ACQ.CYCLE_THRESHOLD_DEG),
      records: [...this.records],
      latest: this.latest,
      patient: this.patient,
      hrTrend: [...this.hrTrend],
      baseline: b ? { origin: b.origin, cycles: b.cycles, createdAt: b.createdAt, bpm: b.bpm } : null,
      captureProgress: this.pipeline.captureProgress(),
      followPatient: this.followPatient,
      envelopes: this.envelopes(),
    };
  }

  private envelopes(): EngineSnapshot['envelopes'] {
    const b = this.pipeline.baseline;
    if (!b) return [];
    const avg = (pick: (r: PipelineResult) => number[], i: number) =>
      this.recent.length ? this.recent.reduce((s, r) => s + (pick(r)[i] ?? 0), 0) / this.recent.length : NaN;
    return b.piezoEnvelope.map((bp, i) => ({
      phase: (i / b.piezoEnvelope.length) * ACQ.ENVELOPE_WINDOW_S * 1000,
      basePiezo: bp,
      curPiezo: avg((r) => r.features.piezo_envelope, i),
      baseAudio: b.audioEnvelope[i],
      curAudio: avg((r) => r.features.audio_envelope, i),
    }));
  }
}
