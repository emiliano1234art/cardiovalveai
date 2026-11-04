import { OPEN_PCT_LIMITED, OPEN_PCT_NORMAL, REFERENCE_DEG } from './config';
import type { CycleRecord } from './types';

export type Level = 'none' | 'normal' | 'limited' | 'incomplete';
export type Severity = 'info' | 'ok' | 'warn' | 'crit';

export interface Finding {
  severity: Severity;
  title: string;
  detail: string;
}

export interface Analysis {
  n: number;
  level: Level;
  /** apertura media como % de la esperada */
  openPct: number;
  meanPeak: number;
  refDeg: number;
  /** coeficiente de variación del ángulo máximo (%) */
  peakCv: number;
  bpm: number;
  /** coeficiente de variación de la duración de ciclo (%) */
  rhythmCv: number;
  meanOpenMs: number;
  /** pendiente de la apertura, en puntos de % por ciclo */
  trendPctPerCycle: number;
  /** % de ciclos con apertura bajo el umbral de "incompleta" */
  incompleteShare: number;
  findings: Finding[];
  headline: string;
}

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
function slope(y: number[]): number {
  const n = y.length;
  if (n < 3) return 0;
  const mx = (n - 1) / 2;
  const my = mean(y);
  let num = 0;
  let den = 0;
  y.forEach((v, i) => {
    num += (i - mx) * (v - my);
    den += (i - mx) ** 2;
  });
  return den ? num / den : 0;
}

export function levelFromPct(pct: number): Level {
  if (pct >= OPEN_PCT_NORMAL) return 'normal';
  if (pct >= OPEN_PCT_LIMITED) return 'limited';
  return 'incomplete';
}

/** Analiza una ventana de ciclos y devuelve indicadores y hallazgos. */
export function analyze(cycles: CycleRecord[], refDeg = REFERENCE_DEG): Analysis {
  const n = cycles.length;
  if (n === 0) {
    return {
      n: 0, level: 'none', openPct: 0, meanPeak: 0, refDeg, peakCv: 0, bpm: 0, rhythmCv: 0, meanOpenMs: 0,
      trendPctPerCycle: 0, incompleteShare: 0, findings: [],
      headline: 'Sin ciclos registrados todavía. Conecta el ESP32 (o usa el modo demo) y deja que la válvula complete algunos ciclos.',
    };
  }

  const peaks = cycles.map((c) => c.peak);
  const meanPeak = mean(peaks);
  const openPct = (meanPeak / refDeg) * 100;
  const peakCv = meanPeak > 0 ? (std(peaks) / meanPeak) * 100 : 0;
  const durs = cycles.map((c) => c.durMs);
  const rhythmCv = mean(durs) > 0 ? (std(durs) / mean(durs)) * 100 : 0;
  const bpm = mean(durs) > 0 ? 60000 / mean(durs) : 0;
  const pcts = peaks.map((p) => (p / refDeg) * 100);
  const trend = n >= 8 ? slope(pcts) : 0;
  const incompleteShare = (pcts.filter((p) => p < OPEN_PCT_LIMITED).length / n) * 100;
  const meanOpenMs = mean(cycles.map((c) => c.openMs));
  const level = levelFromPct(openPct);

  const f: Finding[] = [];
  const deg = `${meanPeak.toFixed(0)}° de ${refDeg.toFixed(0)}°`;

  if (level === 'incomplete') {
    f.push({
      severity: 'crit',
      title: 'La válvula se está abriendo incompletamente',
      detail: `Apertura media ${openPct.toFixed(0)} % de la esperada (${deg}). El orificio no alcanza el área normal de paso.`,
    });
  } else if (level === 'limited') {
    f.push({
      severity: 'warn',
      title: 'Apertura limitada',
      detail: `Apertura media ${openPct.toFixed(0)} % de la esperada (${deg}). Está bajo el rango normal (≥ ${OPEN_PCT_NORMAL} %).`,
    });
  } else {
    f.push({
      severity: 'ok',
      title: 'Apertura normal',
      detail: `Apertura media ${openPct.toFixed(0)} % de la esperada (${deg}).`,
    });
  }

  if (n >= 5 && incompleteShare > 0 && incompleteShare < 100) {
    f.push({
      severity: incompleteShare >= 30 ? 'warn' : 'info',
      title: 'Ciclos incompletos intermitentes',
      detail: `${incompleteShare.toFixed(0)} % de los ciclos de la ventana abrió menos de ${OPEN_PCT_LIMITED} % de lo esperado.`,
    });
  }

  if (n >= 5 && peakCv > 12) {
    f.push({
      severity: peakCv > 25 ? 'warn' : 'info',
      title: 'Apertura poco consistente',
      detail: `El ángulo máximo varía ${peakCv.toFixed(0)} % entre ciclos (lo normal es < 12 %).`,
    });
  }

  if (n >= 8 && trend < -0.6) {
    f.push({
      severity: 'warn',
      title: 'La apertura va disminuyendo',
      detail: `Tendencia de ${trend.toFixed(1)} puntos porcentuales por ciclo en esta ventana.`,
    });
  } else if (n >= 8 && trend > 0.6 && level !== 'normal') {
    f.push({
      severity: 'info',
      title: 'La apertura va mejorando',
      detail: `Tendencia de +${trend.toFixed(1)} puntos porcentuales por ciclo en esta ventana.`,
    });
  }

  if (n >= 5 && rhythmCv > 15) {
    f.push({
      severity: 'warn',
      title: 'Ritmo irregular',
      detail: `La duración de los ciclos varía ${rhythmCv.toFixed(0)} % (lo esperado es < 15 %).`,
    });
  }

  const headline =
    level === 'incomplete'
      ? '⚠ La válvula se está abriendo incompletamente y no está funcionando correctamente.'
      : level === 'limited'
        ? 'La válvula abre menos de lo esperado; conviene vigilarla.'
        : 'La válvula abre dentro del rango esperado.';

  return {
    n, level, openPct, meanPeak, refDeg, peakCv, bpm, rhythmCv, meanOpenMs,
    trendPctPerCycle: trend, incompleteShare, findings: f, headline,
  };
}

/** Evaluación rápida para la alerta en vivo (últimos ciclos). */
export function liveAlert(all: CycleRecord[], refDeg: number, windowSize = 4): { level: Level; message: string } {
  const recent = all.slice(-windowSize);
  if (recent.length < Math.min(3, windowSize)) return { level: 'none', message: 'Esperando ciclos…' };
  const a = analyze(recent, refDeg);
  return { level: a.level, message: a.headline };
}
