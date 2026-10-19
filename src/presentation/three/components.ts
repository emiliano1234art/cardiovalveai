/**
 * Componentes del prototipo (diapositiva 4 y modelo 3D).
 * `status` distingue lo definido de lo propuesto o pendiente de confirmar.
 */
export type ComponentId =
  | 'esp32'
  | 'servo'
  | 'mic'
  | 'piezo'
  | 'valve'
  | 'transmission'
  | 'hardware'
  | 'power'
  | 'conditioning'
  | 'base';

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
  /** punto de la etiqueta en coordenadas del modelo (mm) */
  anchor: [number, number, number];
  /** desplazamiento en la vista de despiece (mm) */
  explode: [number, number, number];
}

export const COMPONENTS: ProtoComponent[] = [
  {
    id: 'esp32',
    num: 1,
    name: 'ESP32',
    short: 'ESP32',
    role: 'Controla el servo (PWM), muestrea el piezo (ADC) y el micrófono (I²S), registra marcas de tiempo y exporta datos por ciclo.',
    location: 'Sobre la base, alejado del servo.',
    spec: 'Microcontrolador con ADC, interfaz I²S y Wi-Fi.',
    status: 'definido',
    refId: 'esp32',
    anchor: [-38, -84, 34],
    explode: [-10, -8, 28],
  },
  {
    id: 'servo',
    num: 2,
    name: 'Servomotor MG90S',
    short: 'Servo MG90S',
    role: 'Impone el movimiento cíclico; la transmisión convierte su giro en apertura de las valvas.',
    location: 'Bajo la válvula, en el eje central.',
    spec: 'Torque informado por distribuidores ≈1,8 kg·cm a 4,8 V (sin hoja oficial verificada). Sujeto a evaluación del torque necesario.',
    status: 'propuesta',
    refId: 'mg90s',
    anchor: [0, -76, -8],
    explode: [0, -14, 0],
  },
  {
    id: 'mic',
    num: 3,
    name: 'Micrófono MEMS INMP441',
    short: 'MEMS INMP441',
    role: 'Registra el sonido de los eventos de apertura y cierre.',
    location: 'En un soporte fijo, a corta distancia de la válvula (distancia por definir).',
    spec: 'Salida digital I²S de 24 bits; respuesta 60 Hz – 15 kHz; SNR 61 dBA (fabricante).',
    status: 'definido',
    refId: 'inmp441',
    anchor: [-62, 10, 26],
    explode: [-28, 18, 0],
  },
  {
    id: 'piezo',
    num: 4,
    name: 'Sensor piezoeléctrico',
    short: 'Piezo',
    role: 'Registra la vibración que los impactos de las valvas transmiten a la carcasa.',
    location: 'Adherido a la pared externa del anillo (propuesta).',
    spec: 'Disco piezoeléctrico de salida analógica; requiere acondicionamiento antes del ADC.',
    status: 'definido',
    anchor: [39, 9, 0],
    explode: [30, 40, 0],
  },
  {
    id: 'valve',
    num: 5,
    name: 'Anillo y tres valvas (impresión 3D)',
    short: 'Anillo + 3 valvas',
    role: 'Reproduce a escala la geometría trivalva: cada valva gira alrededor de su eje de articulación.',
    location: 'Parte superior del montaje, sobre soportes.',
    spec: 'Ø 60–80 mm (este modelo: 72 mm, propuesta). Valvas triangulares articuladas en la cuerda de cada sector de 120°.',
    status: 'propuesta',
    anchor: [0, 10, -38],
    explode: [0, 40, 0],
  },
  {
    id: 'transmission',
    num: 6,
    name: 'Mecanismo de transmisión',
    short: 'Transmisión',
    role: 'Convierte la rotación del servo en apertura de las valvas mediante leva, corredera o bielas.',
    location: 'Entre el servo y la válvula.',
    spec: 'Alternativa a evaluar. El modelo muestra una corredera central con tres bielas (representación conceptual).',
    status: 'por definir',
    anchor: [6, -28, 10],
    explode: [0, 0, 0],
  },
  {
    id: 'hardware',
    num: 7,
    name: 'Ejes, tornillos y soportes',
    short: 'Ejes y soportes',
    role: 'Ejes de articulación de cada valva y soportes que fijan el anillo a la base.',
    location: 'En la cuerda de cada valva y en tres columnas perimetrales.',
    spec: 'Dimensiones por confirmar según impresión 3D.',
    status: 'propuesta',
    anchor: [39, -40, -22],
    explode: [0, 20, 0],
  },
  {
    id: 'power',
    num: 8,
    name: 'Fuente de alimentación',
    short: 'Alimentación',
    role: 'Alimenta el servo y el ESP32. Separar la alimentación del servo puede reducir el ruido en las señales.',
    location: 'Sobre la base, lejos de los sensores.',
    spec: 'Tensión y corriente por confirmar según el torque y el servo definitivo.',
    status: 'por definir',
    anchor: [55, -70, -38],
    explode: [12, -8, -28],
  },
  {
    id: 'conditioning',
    num: 9,
    name: 'Acondicionamiento y protección del piezo',
    short: 'Acondicionamiento',
    role: 'Adapta la señal del piezo al rango del ADC y lo protege de sobretensiones.',
    location: 'Entre el piezo y el ESP32.',
    spec: 'Propuesta: resistencia de carga, nivel de referencia (offset) y diodos de protección. Diseño por confirmar.',
    status: 'propuesta',
    anchor: [55, -84, 30],
    explode: [12, -8, 28],
  },
  {
    id: 'base',
    num: 10,
    name: 'Base y apoyos antivibración',
    short: 'Base y apoyos',
    role: 'Reduce la vibración del servo que llega a los sensores y mantiene fija su posición entre condiciones.',
    location: 'Bajo todo el montaje.',
    spec: 'Material de los apoyos por definir (p. ej. elastómero).',
    status: 'propuesta',
    anchor: [70, -92, 58],
    explode: [0, -26, 0],
  },
];
