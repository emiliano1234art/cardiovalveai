/**
 * Geometría de la válvula AÓRTICA TRIVALVA (tres valvas semilunares a 120°).
 * Compartida por el modelo 3D, las vistas SVG y los renders. Unidades: mm.
 *
 * Prototipo universitario (PROPUESTA): anillo de Ø ext. ≈ 70 mm. Cada valva se
 * inserta en el anillo a lo largo de una línea semilunar (comisuras arriba,
 * nadir abajo). Cerrada, su borde libre llega al centro y las tres forman una
 * «Y» de coaptación; abierta, el borde libre se desplaza hacia la periferia.
 * No confundir con la válvula tricúspide (aurícula–ventrículo derechos).
 *
 * Coordenadas: x a la derecha, y hacia arriba (salida, aorta), z hacia el observador.
 */
export const R_OUT = 35;
export const R_IN = 30;
export const RING_H = 13;
export const N_LEAF = 3;
/** altura de las comisuras (parte alta del anillo) */
export const Y_COM = 6.5;
/** profundidad del nadir de la línea de inserción */
export const SINUS = 10;
/** ángulo del servo que corresponde a apertura completa */
export const OPEN_REF = 80;

type V3 = [number, number, number];

/** Ángulo central (rad) de la valva i: 0 al frente, luego cada 120°. */
export const leafletCenter = (i: number) => Math.PI / 2 + (i * 2 * Math.PI) / 3;

/** Grado de apertura geométrica (0 cerrada · 1 abierta) a partir del ángulo del modelo (°). */
export const openFrac = (thetaDeg: number) => Math.max(0, Math.min(1.06, thetaDeg / OPEN_REF));

/**
 * Punto de la superficie de la valva i para (u, v) ∈ [0,1]², con apertura s.
 * u recorre el borde de comisura a comisura; v va de la inserción (0) al borde libre (1).
 */
export function leafletPoint(i: number, s: number, u: number, v: number, R = R_IN - 0.5): V3 {
  const a = leafletCenter(i) - Math.PI / 3 + ((2 * Math.PI) / 3) * u;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const bell = Math.sin(Math.PI * u);
  // inserción semilunar (en la pared)
  const rim: V3 = [R * ca, Y_COM - SINUS * bell, R * sa];
  // borde libre cerrado: de la comisura al centro y de vuelta (rama de la «Y»)
  const a0 = leafletCenter(i) - Math.PI / 3;
  const a1 = leafletCenter(i) + Math.PI / 3;
  const k = Math.abs(1 - 2 * u);
  const ac = u < 0.5 ? a0 : a1;
  const closed: V3 = [R * k * Math.cos(ac), Y_COM - 1.6 * (1 - k), R * k * Math.sin(ac)];
  // borde libre abierto: cerca de la pared y por encima de las comisuras
  const ro = R * (1 - 0.2 * bell);
  const open: V3 = [ro * ca, Y_COM + 6 * bell, ro * sa];
  const free: V3 = [closed[0] + (open[0] - closed[0]) * s, closed[1] + (open[1] - closed[1]) * s, closed[2] + (open[2] - closed[2]) * s];
  // vientre de la valva: hacia el ventrículo cerrada, hacia la pared abierta
  const belly = Math.sin(Math.PI * v) * bell;
  const sc = Math.min(1, s);
  return [
    rim[0] + (free[0] - rim[0]) * v + belly * 2.2 * sc * ca,
    rim[1] + (free[1] - rim[1]) * v - belly * 3.2 * (1 - sc),
    rim[2] + (free[2] - rim[2]) * v + belly * 2.2 * sc * sa,
  ];
}

/** Contorno (inserción + borde libre) de la valva i, para dibujos 2D. */
export function leafletContour(i: number, s: number, n = 24): V3[] {
  const out: V3[] = [];
  for (let k = 0; k <= n; k++) out.push(leafletPoint(i, s, k / n, 0));
  for (let k = n; k >= 0; k--) out.push(leafletPoint(i, s, k / n, 1));
  return out;
}

export type ViewName = 'top' | 'side' | 'iso';

/** Proyección 2D simple para dibujos SVG (top: vista desde la aorta). */
export function project([x, y, z]: V3, view: ViewName): [number, number] {
  if (view === 'top') return [x, z];
  if (view === 'side') return [x, -y];
  const c = Math.cos(Math.PI / 6);
  return [(x - z) * c, (x + z) * 0.5 * 0.9 - y];
}
