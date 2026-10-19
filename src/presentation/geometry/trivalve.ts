/**
 * Geometría conceptual de la válvula trivalva (unidades: mm).
 *
 * - Orificio interno de radio R_IN; anillo de R_IN a R_OUT.
 * - Cada valva es un triángulo cuyo vértice está en el centro y cuya base es la
 *   cuerda de su sector de 120°. La base (cuerda a distancia P del centro) es
 *   el EJE DE ARTICULACIÓN: la valva gira alrededor de esa recta y su vértice
 *   sube hacia el lado de salida. Los segmentos circulares entre la cuerda y el
 *   anillo forman asientos fijos.
 * - Con este diseño ninguna valva atraviesa a otra: al abrir, cada una se
 *   mueve dentro de su propio sector.
 * Dimensiones = PROPUESTA (válvula de 60–80 mm), sujetas a confirmación.
 */

export const R_IN = 30;
export const R_OUT = 36;
export const RING_H = 8;
/** distancia del eje de articulación al centro (cuerda del sector de 120°) */
export const P = R_IN * 0.5;
/** semilongitud de la cuerda */
export const HALF_CHORD = Math.sqrt(R_IN * R_IN - P * P);
export const GAP = 0.7;
export const LEAF_T = 1.4;

/** Dirección (radianes) de la bisectriz de cada valva en el plano. */
export const leafletAngle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / 3;

type V3 = [number, number, number];

/**
 * Vértices 3D de una valva (x, y=altura, z) para un ángulo de apertura θ (°).
 * Rotación alrededor de la cuerda: el vértice interior sube.
 */
export function leafletVertices(i: number, thetaDeg: number): V3[] {
  const a = leafletAngle(i);
  const ux = Math.cos(a);
  const uz = Math.sin(a);
  const tx = -uz;
  const tz = ux;
  const th = (thetaDeg * Math.PI) / 180;
  const half = HALF_CHORD - GAP * 1.6;
  const base = P - GAP * 0.4;
  // coordenadas locales: s = posición sobre la cuerda, d = distancia desde la cuerda hacia el centro
  const local: [number, number][] = [
    [-half, 0],
    [half, 0],
    [0, base - GAP * 1.5],
  ];
  return local.map(([s, d]) => {
    const r = base - d * Math.cos(th); // distancia radial
    const y = d * Math.sin(th);
    return [r * ux + s * tx, y, r * uz + s * tz] as V3;
  });
}

export type ViewName = 'top' | 'side' | 'iso';

/** Proyección 2D simple para los dibujos SVG (impresión / vistas estáticas). */
export function project([x, y, z]: V3, view: ViewName): [number, number] {
  if (view === 'top') return [x, z];
  if (view === 'side') return [x, -y];
  const c = Math.cos(Math.PI / 6);
  return [(x - z) * c, (x + z) * 0.5 * 0.9 - y];
}
