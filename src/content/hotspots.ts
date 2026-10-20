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
  { id: 'leaflets', num: 1, group: 'valve', anchor: [6, 14, 6], name: 'Tres valvas', text: 'Tres hojas semilunares que se abren hacia la pared y se cierran juntándose en el centro, como la válvula aórtica.', status: 'propuesto' },
  { id: 'ring', num: 2, group: 'valve', anchor: [-27, 2, 22], name: 'Anillo Ø70 mm', text: 'El marco rígido que sostiene las tres valvas. Sus vibraciones llegan directo al sensor.', status: 'propuesto' },
  { id: 'piezo', num: 3, group: 'piezo', anchor: [12, -9, 40], name: 'Sensor piezoeléctrico', text: 'Detecta pequeñas vibraciones de la estructura valvular. Va integrado en la pared del anillo.', status: 'componente' },
  { id: 'mic', num: 4, group: 'mic', anchor: [-12, 44, -6], name: 'Micrófono MEMS', text: 'Registra los sonidos producidos durante el movimiento. Su puerto apunta hacia la línea de cierre.', status: 'componente' },
  { id: 'motion', num: 5, group: 'actuator', anchor: [59, -60, 0], name: 'Servomotor y mecanismo', text: 'Un solo servo mueve una leva, que sube un anillo actuador; tres bielas abren y cierran las tres valvas.', status: 'propuesto' },
  { id: 'esp32', num: 6, group: 'esp32', anchor: [-55, -84, 34], name: 'ESP32', text: 'Recibe los datos electrónicos de los sensores, mueve el servo y envía todo al sistema de análisis.', status: 'componente' },
];

export const HOTSPOT_STATUS = {
  componente: { label: 'Propuesto · componente elegido', cls: 'chosen' },
  propuesto: { label: 'Diseño propuesto', cls: 'proposed' },
} as const;
