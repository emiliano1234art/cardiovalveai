import { ACQ } from '../config/modes';
import type { CycleFeatures, SignalChunk } from '../types/valvesense';
import { energy, peakAbs, phaseEnvelope, rms, spectralFeatures, welch } from './dsp';

/**
 * Segmenta el flujo continuo de muestras en ciclos valvulares usando el ángulo
 * del servo (cruce ascendente de umbral) y extrae descriptores de cada ciclo.
 */
export class CycleAnalyzer {
  private piezo: number[] = [];
  private servo: number[] = [];
  private audio: number[] = [];
  private inCycle = false;
  private armed = true;
  private cycleStartMs = 0;
  private cycleCount = 0;
  /** Valor crudo del piezo en el pico del último ciclo. */
  lastPiezoRaw = 0;

  reset() {
    this.piezo = [];
    this.servo = [];
    this.audio = [];
    this.inCycle = false;
    this.armed = true;
    this.cycleCount = 0;
  }

  push(chunk: SignalChunk): CycleFeatures[] {
    const out: CycleFeatures[] = [];
    const ratio = Math.round(chunk.fs_audio / chunk.fs_piezo);
    const thr = ACQ.CYCLE_THRESHOLD_DEG;

    for (let i = 0; i < chunk.piezo.length; i++) {
      const a = chunk.servo[i];
      if (this.armed && a >= thr) {
        // inicio de un nuevo ciclo
        this.armed = false;
        const tMs = chunk.t0_ms + (i / chunk.fs_piezo) * 1000;
        if (this.inCycle && this.piezo.length > chunk.fs_piezo * 0.2) {
          out.push(this.finalize(chunk.fs_piezo, chunk.fs_audio, tMs));
        }
        this.inCycle = true;
        this.cycleStartMs = tMs;
        this.piezo = [];
        this.servo = [];
        this.audio = [];
      } else if (!this.armed && a < thr * 0.5) {
        this.armed = true;
      }
      if (this.inCycle) {
        this.piezo.push(chunk.piezo[i]);
        this.servo.push(a);
        for (let k = 0; k < ratio; k++) this.audio.push(chunk.audio[i * ratio + k]);
      }
    }
    return out;
  }

  private finalize(fsP: number, fsA: number, endMs: number): CycleFeatures {
    const servo = this.servo;
    const durationMs = (servo.length / fsP) * 1000;

    let maxA = 0;
    let maxIdx = 0;
    for (let i = 0; i < servo.length; i++) {
      if (servo[i] > maxA) {
        maxA = servo[i];
        maxIdx = i;
      }
    }
    // tiempos de subida / bajada 10–90 %
    const lo = 0.1 * maxA;
    const hi = 0.9 * maxA;
    let iLoUp = 0;
    while (iLoUp < maxIdx && servo[iLoUp] < lo) iLoUp++;
    let iHiUp = iLoUp;
    while (iHiUp < servo.length && servo[iHiUp] < hi) iHiUp++;
    let iHiDown = servo.length - 1;
    while (iHiDown > iHiUp && servo[iHiDown] < hi) iHiDown--;
    let iLoDown = iHiDown;
    while (iLoDown < servo.length - 1 && servo[iLoDown] > lo) iLoDown++;

    const pk = peakAbs(this.piezo);
    this.lastPiezoRaw = this.piezo[pk.index] ?? 0;
    const spec = spectralFeatures(welch(this.audio, 512), fsA, 150);
    this.cycleCount++;

    return {
      timestamp: Math.round(endMs),
      cycle_number: this.cycleCount,
      bpm: 60000 / durationMs,
      servo_angle: maxA,
      piezo_rms: rms(this.piezo),
      piezo_peak: pk.value,
      piezo_energy: energy(this.piezo, fsP),
      audio_rms: rms(this.audio),
      dominant_frequency: spec.dominant,
      spectral_centroid: spec.centroid,
      cycle_duration_ms: durationMs,
      opening_duration_ms: ((iHiUp - iLoUp) / fsP) * 1000,
      closing_duration_ms: ((iLoDown - iHiDown) / fsP) * 1000,
      piezo_envelope: phaseEnvelope(this.piezo, ACQ.ENVELOPE_POINTS),
      audio_envelope: phaseEnvelope(this.audio, ACQ.ENVELOPE_POINTS),
    };
  }

  /** Tiempo (ms) desde el inicio del ciclo en curso. */
  sinceCycleStart(nowMs: number) {
    return nowMs - this.cycleStartMs;
  }
}
