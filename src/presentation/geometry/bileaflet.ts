/**
 * Geometría bileaflet compartida (modelo 3D, vistas SVG y renders). Unidades: mm.
 *
 * Modelo universitario (PROPUESTA): anillo impreso en 3D de Ø ext. 84 mm
 * (rango del proyecto: 7–10 cm). Dos valvas en forma de D separadas por una
 * línea central. Cada valva gira alrededor de un eje paralelo a esa línea,
 * desplazado H del centro (como en las prótesis bileaflet): la parte externa
 * (mayor) sube hacia el lado de salida y la franja interna baja. Las valvas
 * nunca se cruzan: cada una se mueve en su propia mitad.
 */
export const R_IN = 34;
export const R_OUT = 42;
export const RING_H = 16;
/** distancia del eje de pivote a la línea central */
export const H = R_IN * 0.28;
/** separación central entre valvas cerradas */
export const GAP = 0.9;
export const CLEAR = 0.8;
export const LEAF_T = 1.6;

type V3 = [number, number, number];

/** Contorno de la valva en coordenadas locales (x, d), con d medido desde el eje de pivote. */
export function leafletOutline(n = 28): [number, number][] {
  const R = R_IN - CLEAR;
  const zIn = GAP / 2;
  const x0 = Math.sqrt(R * R - zIn * zIn);
  const pts: [number, number][] = [[-x0, zIn - H]];
  pts.push([x0, zIn - H]);
  const a0 = Math.asin(zIn / R);
  for (let k = 1; k < n; k++) {
    const a = a0 + ((Math.PI - 2 * a0) * k) / n;
    pts.push([R * Math.cos(a), R * Math.sin(a) - H]);
  }
  return pts;
}

const OUTLINE = leafletOutline();

/** Vértices 3D (x, y=altura, z) de la valva i (0: z>0, 1: z<0) para un ángulo θ (°). */
export function leafletPoints(i: number, thetaDeg: number, outline = OUTLINE): V3[] {
  const th = (thetaDeg * Math.PI) / 180;
  const sgn = i === 0 ? 1 : -1;
  const c = Math.cos(th);
  const s = Math.sin(th);
  return outline.map(([x, d]) => [x, d * s, sgn * (H + d * c)] as V3);
}

export type ViewName = 'top' | 'side' | 'iso';

/** Proyección 2D simple para dibujos SVG. side = corte visto a lo largo del eje de pivote. */
export function project([x, y, z]: V3, view: ViewName): [number, number] {
  if (view === 'top') return [x, z];
  if (view === 'side') return [z, -y];
  const c = Math.cos(Math.PI / 6);
  return [(x - z) * c, (x + z) * 0.5 * 0.9 - y];
}
