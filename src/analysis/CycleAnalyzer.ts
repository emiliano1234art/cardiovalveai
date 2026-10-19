import { ACQ } from '../config/modes';
import type { CycleFeatures, SignalChunk } from '../types/valvesense';
import { bpmFromPeaks, detectR } from '../presentation/sim/model';
import { energy, peakAbs, rms, spectralFeatures, timeEnvelope, welch } from './dsp';

/**
 * Segmenta el flujo continuo de muestras en ciclos valvulares usando el ángulo
 * del servo (cruce ascendente de umbral) y extrae descriptores de cada ciclo.
 */
export class CycleAnalyzer {
  private piezo: number[] = [];
  private servo: number[] = [];
  private audio: number[] = [];
  /** últimos 5 s de ECG (si la fuente lo entrega) */
  private ecg: number[] = [];
  private inCycle = false;
  private armed = true;
  private cycleStartMs = 0;
  private cycleCount = 0;
  /** piso adaptativo del ángulo: permite segmentar aunque la válvula no cierre del todo */
  private floor = 0;
  /** Valor crudo del piezo en el pico del último ciclo. */
  lastPiezoRaw = 0;

  reset() {
    this.piezo = [];
    this.servo = [];
    this.audio = [];
    this.ecg = [];
    this.inCycle = false;
    this.armed = true;
    this.cycleCount = 0;
    this.floor = 0;
  }

  push(chunk: SignalChunk): CycleFeatures[] {
    const out: CycleFeatures[] = [];
    const ratio = Math.round(chunk.fs_audio / chunk.fs_piezo);
    const leak = 5 / chunk.fs_piezo; // el piso sube 5°/s si no se vuelve a alcanzar

    for (let i = 0; i < chunk.piezo.length; i++) {
      if (chunk.ecg) {
        this.ecg.push(chunk.ecg[i]);
        if (this.ecg.length > chunk.fs_piezo * 5) this.ecg.shift();
      }
      const a = chunk.servo[i];
      this.floor = a < this.floor ? a : this.floor + leak;
      const thr = this.floor + ACQ.CYCLE_THRESHOLD_DEG;
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
      } else if (!this.armed && a < this.floor + ACQ.CYCLE_THRESHOLD_DEG * 0.5) {
        this.armed = true;
      }
      if (this.inCycle) {
        this.piezo.push(chunk.piezo[i]);
        this.servo.push(a);
        for (let k = 0; k < ratio; k++) this.audio.push(chunk.audio[i * ratio + k]);
        // sin movimiento durante 4 s: se descarta el ciclo en curso
        if (this.piezo.length > chunk.fs_piezo * 4) {
          this.inCycle = false;
          this.piezo = [];
          this.servo = [];
          this.audio = [];
        }
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
    let minA = maxA;
    for (const v of servo) minA = Math.min(minA, v);
    const lo = minA + 0.1 * (maxA - minA);
    const hi = minA + 0.9 * (maxA - minA);
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
    // ECG: último intervalo RR y FC detectada (detector tipo Pan–Tompkins)
    let rr: number | null = null;
    let ecgBpm: number | null = null;
    if (this.ecg.length > fsP * 2) {
      const pk = detectR(this.ecg, fsP);
      if (pk.length >= 2) rr = ((pk[pk.length - 1] - pk[pk.length - 2]) / fsP) * 1000;
      ecgBpm = bpmFromPeaks(pk, fsP);
    }

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
      piezo_envelope: timeEnvelope(this.piezo, fsP, ACQ.ENVELOPE_WINDOW_S, ACQ.ENVELOPE_POINTS),
      audio_envelope: timeEnvelope(this.audio, fsA, ACQ.ENVELOPE_WINDOW_S, ACQ.ENVELOPE_POINTS),
      rr_ms: rr,
      ecg_bpm: ecgBpm,
    };
  }

  /** Tiempo (ms) desde el inicio del ciclo en curso. */
  sinceCycleStart(nowMs: number) {
    return nowMs - this.cycleStartMs;
  }
}
