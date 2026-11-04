import type { Sample } from './types';

/** Mismo cálculo que el firmware: promedio ponderado de la posición de cada sensor. */
export const HALL_POS_DEG: [number, number, number] = [20, 50, 80];

function smooth01(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function hallToDegrees(w: Sample['hallW']): number {
  const total = w[0] + w[1] + w[2];
  if (total < 0.05) return 0;
  const centroid = (w[0] * HALL_POS_DEG[0] + w[1] * HALL_POS_DEG[1] + w[2] * HALL_POS_DEG[2]) / total;
  return centroid * smooth01(0.05, 0.4, total);
}
