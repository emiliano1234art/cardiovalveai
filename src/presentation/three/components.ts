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
  /** una frase sencilla para la presentación */
  simple: string;
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
    name: 'Anillo Ø70 mm y tres valvas (impresión 3D)',
    short: 'Anillo + 3 valvas',
    simple: 'Tres valvas que se abren hacia la pared y se cierran en el centro.',
    role: 'Reproduce a escala una válvula aórtica trivalva: tres valvas semilunares a 120° que se abren hacia la pared y se cierran en el centro.',
    location: 'Parte superior del montaje, sobre un soporte posterior.',
    spec: 'Ø ext. ≈ 70 mm (propuesta). Anillo de 14 mm de alto con tres postes de comisura y canal interno para cables.',
    status: 'propuesta',
    anchor: [30, 12, 14],
    explode: [0, 30, 0],
  },
  {
    id: 'piezo',
    num: 2,
    name: 'Sensor piezoeléctrico Ø 12–15 mm',
    short: 'Piezo Ø14 mm',
    simple: 'Detecta pequeñas vibraciones de la estructura valvular.',
    role: 'Registra la vibración que el movimiento y el contacto de las valvas transmiten al anillo rígido.',
    location: 'Integrado en un rebaje de la pared externa del anillo, en contacto directo con la estructura.',
    spec: 'Disco piezoeléctrico de 12–15 mm; salida analógica → acondicionamiento → ADC.',
    status: 'definido',
    anchor: [12, -9, 40],
    explode: [0, 30, 22],
  },
  {
    id: 'mic',
    num: 3,
    name: 'Micrófono MEMS INMP441 en alojamiento integrado',
    short: 'MEMS INMP441',
    simple: 'Registra los sonidos producidos durante el movimiento.',
    role: 'Registra el sonido de apertura y cierre.',
    location: 'Alojamiento impreso en el brazo del soporte, con el puerto acústico libre y orientado hacia la línea de cierre de las valvas.',
    spec: 'Salida digital I²S de 24 bits; respuesta 60 Hz – 15 kHz; SNR 61 dBA (fabricante).',
    status: 'definido',
    refId: 'inmp441',
    anchor: [-12, 44, -6],
    explode: [-8, 46, 0],
  },
  {
    id: 'wiring',
    num: 4,
    name: 'Cableado interno',
    short: 'Cableado interno',
    simple: 'Lleva las señales de los sensores hasta la base, por dentro del soporte.',
    role: 'Lleva las señales del piezo y del MEMS por un canal dentro del anillo y del soporte hasta la base.',
    location: 'Canal interno del anillo → brazo → columna del soporte → base.',
    spec: 'Cables delgados apantallados (propuesta). Visible con «Vista interna».',
    status: 'propuesta',
    anchor: [-36, -6, -8],
    explode: [0, 0, 0],
  },
  {
    id: 'actuator',
    num: 5,
    name: 'Accionamiento: 1 servo MG90S + leva + anillo actuador + 3 bielas',
    short: 'Servo + transmisión',
    simple: 'Mueve las valvas en nuestro prototipo experimental.',
    role: 'Un solo servo gira una leva; la leva sube y baja un anillo actuador que, con tres bielas, abre y cierra las tres valvas. Movimiento reproducible; es una simulación mecánica y no reproduce las fuerzas de la sangre.',
    location: 'Servo y leva en la base; anillo actuador bajo la válvula, sobre tres guías.',
    spec: 'MG90S: ≈1,8 kg·cm a 4,8 V según distribuidores (sin hoja oficial verificada). Torque necesario por evaluar.',
    status: 'propuesta',
    refId: 'mg90s',
    anchor: [59, -60, 0],
    explode: [16, -6, 0],
  },
  {
    id: 'esp32',
    num: 6,
    name: 'ESP32 (base externa)',
    short: 'ESP32',
    simple: 'Recibe los datos electrónicos y los envía al sistema de análisis.',
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
    name: 'Soporte, guías y fijaciones',
    short: 'Soporte y guías',
    simple: 'Sostiene la válvula y el micrófono, y guía el mecanismo.',
    role: 'Soporte posterior que sostiene el anillo y el alojamiento del MEMS; guías verticales para el anillo actuador.',
    location: 'Columna en la parte posterior; tres guías bajo la válvula.',
    spec: 'Ejes metálicos y piezas impresas; dimensiones por confirmar.',
    status: 'propuesta',
    anchor: [-20, -70, -48],
    explode: [0, 0, -14],
  },
  {
    id: 'conditioning',
    num: 8,
    name: 'Acondicionamiento del piezo',
    short: 'Acondicionamiento',
    simple: 'Adapta la señal del piezo para que el ESP32 pueda leerla.',
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
    simple: 'Da energía al servo y al ESP32.',
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
    simple: 'Mantiene todo fijo y amortigua la vibración del motor.',
    role: 'Mantiene fija la posición de los sensores entre condiciones y atenúa la vibración del servo.',
    location: 'Bajo todo el montaje.',
    spec: 'Material de los apoyos por definir (p. ej. elastómero).',
    status: 'propuesta',
    anchor: [70, -98, -52],
    explode: [0, -24, 0],
  },
];
