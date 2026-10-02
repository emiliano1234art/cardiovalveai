import type { PatientSnapshot, RehabSession } from '../types/valvesense';
import { Rng } from './rng';

/**
 * PACIENTE SIMULADO — DATOS SINTÉTICOS, NO CLÍNICOS.
 *
 * Modelo de primer orden que recorre una sesión de ejercicio ficticia
 * (reposo → calentamiento → ejercicio → enfriamiento → recuperación) en bucle.
 * Ningún valor proviene ni representa a una persona real.
 */

export const SYNTHETIC_PATIENT = {
  id: 'PS-0001',
  alias: 'Sujeto sintético A',
  age: 58,
  context: 'Portador simulado de prótesis valvular mecánica (escenario de ejemplo)',
  program: 'Programa de rehabilitación — escenario ficticio',
};

type Stage = PatientSnapshot['session_stage'];

interface StageDef {
  stage: Stage;
  seconds: number;
  hr: number;
  borg: number;
  spo2: number;
  activity: string;
  level: number;
}

const PLAN: StageDef[] = [
  { stage: 'reposo', seconds: 30, hr: 68, borg: 6, spo2: 98, activity: 'Reposo sentado', level: 0 },
  { stage: 'calentamiento', seconds: 40, hr: 88, borg: 9, spo2: 97.6, activity: 'Cicloergómetro · 20 W', level: 0.35 },
  { stage: 'ejercicio', seconds: 100, hr: 112, borg: 13, spo2: 96.6, activity: 'Cicloergómetro · 50 W', level: 0.8 },
  { stage: 'enfriamiento', seconds: 30, hr: 94, borg: 10, spo2: 97.2, activity: 'Cicloergómetro · 15 W', level: 0.3 },
  { stage: 'recuperación', seconds: 60, hr: 74, borg: 7, spo2: 97.8, activity: 'Recuperación pasiva', level: 0 },
];
const TOTAL = PLAN.reduce((s, p) => s + p.seconds, 0);

export class PatientSimulator {
  private rng = new Rng(2024);
  private t = 0;
  private hr = 68;
  private spo2 = 98;
  private borg = 6;
  private exerciseS = 0;
  private hrAtExerciseEnd: number | null = null;
  private hrr: number | null = null;
  private lastStage: Stage = 'reposo';

  private stageAt(t: number): { def: StageDef; elapsed: number } {
    let x = t % TOTAL;
    for (const def of PLAN) {
      if (x < def.seconds) return { def, elapsed: x };
      x -= def.seconds;
    }
    return { def: PLAN[0], elapsed: 0 };
  }

  /** Avanza `dt` segundos. */
  step(dt: number): PatientSnapshot {
    this.t += dt;
    const { def, elapsed } = this.stageAt(this.t);
    const r = this.rng;

    // constantes de tiempo distintas para subir y bajar (cinética de FC)
    const tauHr = def.hr > this.hr ? 14 : 22;
    this.hr += ((def.hr - this.hr) * dt) / tauHr + 0.35 * r.gauss() * Math.sqrt(dt);
    this.spo2 += ((def.spo2 - this.spo2) * dt) / 20 + 0.05 * r.gauss() * Math.sqrt(dt);
    this.borg += ((def.borg - this.borg) * dt) / 18;

    if (def.stage === 'reposo' && this.lastStage !== 'reposo') {
      this.exerciseS = 0;
    }
    if (def.stage === 'calentamiento' || def.stage === 'ejercicio' || def.stage === 'enfriamiento') {
      this.exerciseS += dt;
    }
    if (def.stage === 'recuperación' && this.lastStage !== 'recuperación') {
      this.hrAtExerciseEnd = this.hr;
      this.hrr = null;
    }
    if (def.stage === 'recuperación' && elapsed >= 59 && this.hrAtExerciseEnd !== null && this.hrr === null) {
      this.hrr = this.hrAtExerciseEnd - this.hr;
    }
    this.lastStage = def.stage;

    const borg = Math.round(Math.min(20, Math.max(6, this.borg)));
    const symptoms =
      def.stage === 'ejercicio' && borg >= 13
        ? 'Fatiga muscular leve (sintético)'
        : def.stage === 'ejercicio'
          ? 'Sin síntomas reportados'
          : 'Sin síntomas reportados';

    return {
      t_s: this.t,
      heart_rate: Math.round(this.hr),
      spo2: Math.round(Math.min(100, this.spo2) * 10) / 10,
      activity: def.activity,
      activity_level: def.level,
      borg,
      symptoms,
      exercise_duration_s: this.exerciseS,
      hr_recovery_1min: this.hrr !== null ? Math.round(this.hrr) : null,
      rehab_phase: 'Fase II · ambulatoria supervisada (simulada)',
      session_stage: def.stage,
    };
  }
}

/** Historial ficticio de sesiones de rehabilitación (progresión sintética). */
export function syntheticRehabHistory(n = 12): RehabSession[] {
  const r = new Rng(77);
  const start = new Date('2026-07-06T10:00:00');
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start.getTime() + i * 3.5 * 86400000);
    const progress = i / (n - 1);
    return {
      session: i + 1,
      date: d.toISOString().slice(0, 10),
      duration_min: Math.round(18 + 14 * progress + 2 * r.gauss()),
      peak_hr: Math.round(104 + 10 * progress + 3 * r.gauss()),
      borg_peak: Math.round(14 - 2 * progress + 0.6 * r.gauss()),
      hr_recovery: Math.round(14 + 7 * progress + 1.5 * r.gauss()),
      mean_similarity: Math.round((95 + 2 * progress + 1.2 * r.gauss()) * 10) / 10,
    };
  });
}
