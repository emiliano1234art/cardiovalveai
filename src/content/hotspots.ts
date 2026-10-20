import type { Hotspot } from '../presentation/three/Scene3D';
import type { ComponentId } from '../presentation/three/components';

export interface HotspotInfo extends Hotspot {
  group: ComponentId;
  name: string;
  /** una frase: para qué sirve */
  text: string;
  status: 'componente' | 'propuesto';
}

/**
 * Puntos interactivos del modelo 3D. Ningún componente está montado todavía:
 * «componente» = pieza elegida con montaje en diseño; «propuesto» = diseño propuesto.
 */
export const HOTSPOTS: HotspotInfo[] = [
  { id: 'leaflets', num: 1, group: 'valve', anchor: [8, 20, 4], name: 'Valvas', text: 'Las dos hojas que se abren y se cierran, como una puerta doble, para dejar pasar el flujo o detenerlo.', status: 'propuesto' },
  { id: 'ring', num: 2, group: 'valve', anchor: [-34, 2, 26], name: 'Anillo', text: 'El marco rígido que sostiene las valvas. Sus vibraciones llegan directo al sensor.', status: 'propuesto' },
  { id: 'piezo', num: 3, group: 'piezo', anchor: [0, -8, 44], name: 'Sensor piezoeléctrico', text: 'Detecta pequeñas vibraciones del anillo cuando la válvula funciona.', status: 'componente' },
  { id: 'mic', num: 4, group: 'mic', anchor: [-14, 46, -8], name: 'Micrófono MEMS', text: 'Registra el sonido de apertura y cierre para analizarlo.', status: 'componente' },
  { id: 'motion', num: 5, group: 'actuator', anchor: [50, -60, 0], name: 'Mecanismo de movimiento', text: 'Un pequeño motor (servo) y unas palancas abren y cierran las valvas al ritmo de los latidos.', status: 'propuesto' },
  { id: 'esp32', num: 6, group: 'esp32', anchor: [-55, -84, 34], name: 'ESP32', text: 'Una pequeña computadora que lee los sensores, mueve el motor y envía los datos a este dashboard.', status: 'componente' },
];

export const HOTSPOT_STATUS = {
  componente: { label: 'Componente elegido · montaje en diseño', cls: 'chosen' },
  propuesto: { label: 'Diseño propuesto', cls: 'proposed' },
} as const;
