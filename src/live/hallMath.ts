/**
 * Posición aproximada (°) de cada sensor Hall respecto de la válvula.
 * Solo la usa el simulador; el ESP32 real aprende la curva con «Calibrar curva».
 */
export const HALL_POS_DEG: [number, number, number] = [20, 50, 80];
