/**
 * Componentes del prototipo universitario (diapositiva 4 y modelo 3D).
 * `status` distingue lo definido de lo propuesto o pendiente de confirmar.
 */
export type ComponentId = 'valve' | 'piezo' | 'mic' | 'wiring' | 'actuator' | 'esp32' | 'hardware' | 'conditioning' | 'power' | 'base';

export interface ProtoComponent {
  id: ComponentId;
  num: number;
  name: string;
  short: string;
  role: string;
  location: string;
  spec: string;
  status: 'definido' | 'propuesta' | 'por definir';
  refId?: string;
  /** punto de la etiqueta (mm, coordenadas del modelo) */
  anchor: [number, number, number];
  /** desplazamiento en la vista de despiece (mm) */
  explode: [number, number, number];
}

export const COMPONENTS: ProtoComponent[] = [
  {
    id: 'valve',
    num: 1,
    name: 'Anillo y dos valvas (impresión 3D)',
    short: 'Anillo + 2 valvas',
    role: 'Reproduce a escala una prótesis bileaflet: dos valvas en D que giran sobre ejes desplazados del centro.',
    location: 'Parte superior del montaje, sobre un soporte lateral.',
    spec: 'Ø 7–10 cm (este modelo: 84 mm, propuesta). Anillo de 16 mm de alto con canal interno para cables.',
    status: 'propuesta',
    anchor: [36, 12, 18],
    explode: [0, 34, 0],
  },
  {
    id: 'piezo',
    num: 2,
    name: 'Sensor piezoeléctrico Ø 12–15 mm',
    short: 'Piezo Ø14 mm',
    role: 'Registra la vibración que el movimiento y el contacto de las valvas transmiten al anillo rígido.',
    location: 'Fijado en un rebaje de la pared externa del anillo, en contacto directo con la carcasa.',
    spec: 'Disco piezoeléctrico de 12–15 mm; salida analógica → acondicionamiento → ADC.',
    status: 'definido',
    anchor: [0, -8, 44],
    explode: [0, 34, 26],
  },
  {
    id: 'mic',
    num: 3,
    name: 'Micrófono MEMS INMP441 en alojamiento integrado',
    short: 'MEMS INMP441',
    role: 'Registra el sonido de apertura y cierre.',
    location: 'Alojamiento impreso en el brazo del soporte, orientado hacia la línea de cierre, con el puerto acústico libre.',
    spec: 'Salida digital I²S de 24 bits; respuesta 60 Hz – 15 kHz; SNR 61 dBA (fabricante).',
    status: 'definido',
    refId: 'inmp441',
    anchor: [-14, 46, -8],
    explode: [-10, 52, 0],
  },
  {
    id: 'wiring',
    num: 4,
    name: 'Cableado interno',
    short: 'Cableado interno',
    role: 'Lleva las señales del piezo y del MEMS por un canal dentro del anillo y del soporte hasta la base.',
    location: 'Canal interno del anillo → brazo → columna del soporte → base.',
    spec: 'Cables delgados apantallados (propuesta). Visible con «Vista interna».',
    status: 'propuesta',
    anchor: [-38, -6, -8],
    explode: [0, 0, 0],
  },
  {
    id: 'actuator',
    num: 5,
    name: 'Actuador: servo MG90S + transmisión',
    short: 'Servo + transmisión',
    role: 'Genera el movimiento: el servo desplaza una corredera que, mediante bielas y palancas en los ejes, abre y cierra las valvas.',
    location: 'Bajo la válvula, en el costado de los ejes.',
    spec: 'MG90S: ≈1,8 kg·cm a 4,8 V según distribuidores (sin hoja oficial verificada). Torque necesario por evaluar.',
    status: 'propuesta',
    refId: 'mg90s',
    anchor: [50, -60, 0],
    explode: [16, -6, 0],
  },
  {
    id: 'esp32',
    num: 6,
    name: 'ESP32 (base externa)',
    short: 'ESP32',
    role: 'Lee el piezo (ADC) y el MEMS (I²S), controla el servo, recibe el ECG y envía los datos al dashboard.',
    location: 'En la base, fuera de la válvula.',
    spec: 'Microcontrolador con ADC, I²S y Wi-Fi/Bluetooth.',
    status: 'definido',
    refId: 'esp32',
    anchor: [-55, -84, 34],
    explode: [-14, -14, 24],
  },
  {
    id: 'hardware',
    num: 7,
    name: 'Ejes, soporte y fijaciones',
    short: 'Ejes y soporte',
    role: 'Ejes de pivote de cada valva y soporte lateral que sostiene el anillo y el alojamiento del MEMS.',
    location: 'Ejes a través del anillo; columna en la parte posterior.',
    spec: 'Ejes metálicos y piezas impresas; dimensiones por confirmar.',
    status: 'propuesta',
    anchor: [-22, -70, -52],
    explode: [0, 0, -14],
  },
  {
    id: 'conditioning',
    num: 8,
    name: 'Acondicionamiento del piezo',
    short: 'Acondicionamiento',
    role: 'Adapta la señal del piezo al rango del ADC y lo protege de sobretensiones.',
    location: 'En la base, junto al ESP32.',
    spec: 'Propuesta: resistencia de carga, nivel de referencia y diodos de protección.',
    status: 'propuesta',
    anchor: [-12, -86, 44],
    explode: [0, -14, 30],
  },
  {
    id: 'power',
    num: 9,
    name: 'Alimentación',
    short: 'Alimentación',
    role: 'Alimenta el servo y el ESP32; separar la alimentación del servo reduce ruido en las señales.',
    location: 'En la base.',
    spec: 'Tensión y corriente por confirmar.',
    status: 'por definir',
    anchor: [62, -80, 42],
    explode: [16, -14, 24],
  },
  {
    id: 'base',
    num: 10,
    name: 'Base compacta con apoyos antivibración',
    short: 'Base',
    role: 'Mantiene fija la posición de los sensores entre condiciones y atenúa la vibración del servo.',
    location: 'Bajo todo el montaje.',
    spec: 'Material de los apoyos por definir (p. ej. elastómero).',
    status: 'propuesta',
    anchor: [70, -98, -52],
    explode: [0, -24, 0],
  },
];
