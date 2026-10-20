/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CONTENIDO EDITABLE DE LA PRESENTACIÓN — CardioVal AI
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Todo lo que el equipo debe completar o actualizar está en este archivo:
 *  datos de portada, entrevista, dibujo inicial, cronograma, materiales,
 *  referencias, URL del dashboard y notas del expositor.
 *
 *  Regla: un texto entre [corchetes] es un CAMPO PENDIENTE y se muestra
 *  resaltado en la presentación. No reemplazar con información no verificada.
 */

export const PENDING = (label: string) => `[${label}]`;
export const isPending = (s: string | null | undefined) => !s || /^\[.*\]$/.test(s.trim());

// ─────────────────────────────── Portada ───────────────────────────────
export const META = {
  project: 'CardioVal AI',
  subtitle: 'Escuchamos el funcionamiento de una válvula para comprender sus cambios.',
  tagline: 'Tecnología e inteligencia artificial para explorar el funcionamiento valvular y su relación con la rehabilitación cardiovascular.',
  careers: ['Ingeniería Civil en Biomedicina', 'Kinesiología'],
  faculties: 'Facultad de Medicina · Facultad de Ingeniería',
  institution: 'Universidad del Desarrollo',
  date: '21 de octubre de 2026',
  /** Integrantes (orden de la portada). */
  members: ['Francisco Rojas', 'Johan Denis', 'Vicente Brito', 'Benjamín Saldívar', 'Emiliano Hernández'],
  advisor: 'Gustavo Castro',
  description:
    'Sistema experimental de seguimiento de una válvula aórtica trivalva mediante sensores acústicos y vibratorios, con análisis por inteligencia artificial y una futura integración con indicadores funcionales del paciente para investigación en rehabilitación cardiorrespiratoria.',
  closing: 'Tecnología, señales y rehabilitación: una nueva manera de explorar el funcionamiento valvular.',
};

// ──────────────────────── Dashboard experimental ────────────────────────
/**
 * URL pública (GitHub Pages). La versión publicada se actualiza cuando los
 * cambios se integran a la rama principal; hasta entonces puede mostrar una
 * versión anterior. El laboratorio de este mismo archivo (#/dashboard) está
 * siempre actualizado y funciona sin conexión.
 */
export const DASHBOARD_URL = 'https://emiliano1234art.github.io/cardiovalveai/';

// ─────────────────────── Pantalla 2 · Wicked problem ───────────────────────
export const WICKED_QUESTION =
  '¿Cómo contribuir a un seguimiento cardiovascular más integrado, relacionando el funcionamiento de prótesis valvulares con la recuperación funcional de las personas?';

export const WICKED_POINTS = [
  {
    t: 'Evaluaciones especializadas',
    d: 'El seguimiento de una prótesis valvular se apoya en controles clínicos e imágenes realizados por especialistas.',
    refs: ['otto2021', 'zoghbi2024'],
  },
  {
    t: 'Dos miradas complementarias',
    d: 'El funcionamiento de la válvula y la capacidad funcional de la persona se evalúan por separado y se complementan.',
    refs: ['abraham2021', 'ambrosetti2021'],
  },
  { t: 'Varias disciplinas', d: 'Cardiología, kinesiología, ingeniería y la propia persona participan en la recuperación.', refs: ['ambrosetti2021'] },
  {
    t: 'Una oportunidad futura',
    d: 'Las señales mecánicas y acústicas se investigan como fuente complementaria de información.',
    refs: ['taebi2019', 'fritzsche2007'],
  },
];

/** Rasgos de un «wicked problem» (Rittel y Webber, 1973) aplicados al proyecto. */
export const WICKED_TRAITS = [
  { t: 'No tiene una formulación única', d: 'Para cardiología es la prótesis; para kinesiología, la capacidad funcional; para la persona, su vida diaria.' },
  { t: 'No hay respuesta correcta o incorrecta', d: 'Las propuestas son mejores o peores según el contexto, no verdaderas o falsas.' },
  { t: 'Cada caso es único', d: 'Tipo de prótesis, condición física y metas de rehabilitación cambian de una persona a otra.' },
  { t: 'Sin punto final claro', d: 'El seguimiento continúa en el tiempo: siempre puede mejorarse cómo se integra la información.' },
];

// ─────────────────── Pantalla 3 · Integración interdisciplinaria ───────────────────
export const BIOMED = [
  { id: 'proto', t: 'Diseño del prototipo' },
  { id: 'elec', t: 'Electrónica y sensores' },
  { id: 'dsp', t: 'Procesamiento de señales' },
  { id: 'math', t: 'Modelos matemáticos' },
  { id: 'ai', t: 'Inteligencia artificial' },
];
export const KINE = [
  { id: 'phys', t: 'Fisiología cardiovascular' },
  { id: 'valve', t: 'Funcionamiento valvular' },
  { id: 'vars', t: 'Variables funcionales del paciente' },
  { id: 'rehab', t: 'Rehabilitación cardiorrespiratoria' },
  { id: 'need', t: 'Necesidades clínicas' },
];
/** Aportes conjuntos: cada uno conecta saberes de ambas carreras. */
export const JOINT = [
  {
    t: 'Qué movimiento debe imitar el prototipo',
    bio: ['proto', 'math'],
    kine: ['phys', 'valve'],
    d: 'Kinesiología explica el ciclo de la válvula aórtica; Biomedicina lo traduce a un mecanismo y a un modelo θ(t).',
  },
  {
    t: 'Qué señales registrar y cómo leerlas',
    bio: ['elec', 'dsp'],
    kine: ['valve', 'phys'],
    d: 'Vibración (piezo) y sonido (MEMS) se eligen porque acompañan la apertura y el cierre de las valvas.',
  },
  {
    t: 'Qué indicadores funcionales sumar en el futuro',
    bio: ['ai', 'dsp'],
    kine: ['vars', 'rehab'],
    d: 'FC, SpO₂, percepción de esfuerzo (Borg) y recuperación de la FC como variables a integrar en investigación.',
  },
  {
    t: 'Cómo comunicar resultados sin diagnosticar',
    bio: ['ai'],
    kine: ['need', 'rehab'],
    d: 'El dashboard muestra cambios respecto de una referencia; la interpretación clínica corresponde a profesionales.',
  },
];
/** Hallazgos del Toolkit (Encargo 1). Reemplazar los marcadores por los hallazgos reales. */
export const TOOLKIT_FINDINGS: string[] = [
  PENDING('Hallazgo 1 del Toolkit — copiar desde Encargo 1'),
  PENDING('Hallazgo 2 del Toolkit — copiar desde Encargo 1'),
];

// ─────────────────────────── Pantalla 4 · Materiales ───────────────────────────
export type MaterialIcon = 'esp32' | 'mems' | 'piezo' | 'servo' | 'petg' | 'hardware' | 'breadboard' | 'power' | 'base' | 'laptop';
export interface Material {
  id: MaterialIcon;
  name: string;
  /** ¿Qué es? */
  what: string;
  /** ¿Para qué sirve? */
  why: string;
  /** ¿Dónde se ubica? */
  where: string;
  /** ¿Cómo participa? */
  how: string;
  /** componente del modelo 3D que se resalta (opcional) */
  model?: string;
}
export const MATERIALS: Material[] = [
  {
    id: 'esp32',
    name: 'ESP32 DevKit',
    model: 'esp32',
    what: 'Microcontrolador con Wi-Fi y Bluetooth.',
    why: 'Lee los sensores, controla el servo y envía los datos.',
    where: 'Sobre la base, junto a la protoboard.',
    how: 'Muestrea el piezo (ADC) y el MEMS (I²S) y transmite al computador.',
  },
  {
    id: 'mems',
    name: 'Micrófono MEMS INMP441',
    model: 'mic',
    what: 'Micrófono digital miniatura.',
    why: 'Registra el sonido de apertura y cierre.',
    where: 'En un brazo, orientado hacia el anillo valvular.',
    how: 'Entrega audio digital al ESP32 por I²S.',
  },
  {
    id: 'piezo',
    name: 'Sensor piezoeléctrico 12–15 mm',
    model: 'piezo',
    what: 'Disco que genera voltaje al deformarse.',
    why: 'Capta la vibración de cada apertura y cierre.',
    where: 'Integrado en la estructura rígida del anillo.',
    how: 'Su voltaje se acondiciona y lo lee el ADC del ESP32.',
  },
  {
    id: 'servo',
    name: 'Servomotor MG90S',
    model: 'actuator',
    what: 'Motor pequeño con control de posición.',
    why: 'Mueve las tres valvas de forma repetible.',
    where: 'Bajo el anillo, en el soporte.',
    how: 'Gira una leva que desplaza el anillo actuador y las 3 bielas.',
  },
  {
    id: 'petg',
    name: 'Filamento PETG',
    model: 'valve',
    what: 'Plástico para impresión 3D.',
    why: 'Fabricar anillo, valvas y soportes.',
    where: 'En todas las piezas impresas.',
    how: 'Da rigidez al anillo y resistencia a las piezas móviles.',
  },
  {
    id: 'hardware',
    name: 'Bisagras, ejes, tornillos y montaje',
    model: 'hardware',
    what: 'Piezas mecánicas de unión y giro.',
    why: 'Permitir que cada valva gire y quede fija.',
    where: 'En las comisuras, bielas y soportes.',
    how: 'Definen el eje de giro y la holgura de cada valva.',
  },
  {
    id: 'breadboard',
    name: 'Protoboard y cables Dupont',
    model: 'wiring',
    what: 'Placa de conexiones sin soldadura.',
    why: 'Conectar sensores, servo y ESP32.',
    where: 'Sobre la base.',
    how: 'Permite probar y cambiar el circuito con rapidez.',
  },
  {
    id: 'power',
    name: 'Fuente de alimentación',
    model: 'power',
    what: 'Fuente externa de 5 V.',
    why: 'Alimentar el servo y la electrónica.',
    where: 'Sobre la base, separada de los sensores.',
    how: 'Evita que el consumo del servo afecte las mediciones.',
  },
  {
    id: 'base',
    name: 'Base y soportes',
    model: 'base',
    what: 'Plataforma con columna y brazos.',
    why: 'Mantener todo fijo y alineado.',
    where: 'Bajo el conjunto.',
    how: 'Reduce vibraciones externas y fija la posición de los sensores.',
  },
  {
    id: 'laptop',
    name: 'Computador con dashboard',
    what: 'Equipo que recibe y muestra los datos.',
    why: 'Visualizar, comparar y guardar señales.',
    where: 'Fuera del prototipo.',
    how: 'Ejecuta el dashboard y el análisis con IA.',
  },
];

// ─────────────────────────── Pantalla 5 · Carta Gantt ───────────────────────────
/**
 * IMPORTANTE: El Encargo 2 no estaba disponible al construir esta versión.
 * Las fechas son un CRONOGRAMA PROPUESTO editable.
 * Reemplazar `start` / `end` con las fechas oficiales y cambiar GANTT_IS_PROPOSAL a false.
 */
export const GANTT_IS_PROPOSAL = true;
export interface GanttTask {
  name: string;
  start: string; // ISO yyyy-mm-dd
  end: string;
  area: 'Ambas' | 'Biomedicina' | 'Kinesiología';
}
export const GANTT: GanttTask[] = [
  { name: 'Investigación', start: '2026-09-07', end: '2026-09-25', area: 'Ambas' },
  { name: 'Diseño 3D', start: '2026-09-21', end: '2026-10-09', area: 'Biomedicina' },
  { name: 'Selección y adquisición de materiales', start: '2026-09-28', end: '2026-10-14', area: 'Ambas' },
  { name: 'Impresión y ensamblaje', start: '2026-10-12', end: '2026-10-23', area: 'Biomedicina' },
  { name: 'Integración piezo + MEMS', start: '2026-10-19', end: '2026-10-27', area: 'Biomedicina' },
  { name: 'Programación ESP32', start: '2026-10-19', end: '2026-10-28', area: 'Biomedicina' },
  { name: 'Adquisición y análisis de señales', start: '2026-10-26', end: '2026-11-01', area: 'Ambas' },
  { name: 'Integración del dashboard', start: '2026-10-01', end: '2026-10-30', area: 'Ambas' },
  { name: 'Pruebas y validación', start: '2026-10-28', end: '2026-11-03', area: 'Ambas' },
  { name: 'Feria', start: '2026-11-04', end: '2026-11-04', area: 'Ambas' },
];
export const MILESTONES = [
  { date: '2026-10-21', label: 'Presentación de avance' },
  { date: '2026-11-04', label: 'Feria' },
];

// ─────────────────────── Pantalla 6 · Entrevista docente ───────────────────────
/**
 * Entrevista realizada. Solo se muestra información verificada: nombre, cargo y
 * el tema que el profesor presentó (Diagrama de Wiggers). La aplicación al
 * prototipo es una INTERPRETACIÓN DEL EQUIPO, no una cita ni una recomendación
 * del profesor. La foto está en src/presentation/assets/pablo-reyes.jpg.
 */
export const INTERVIEW = {
  name: 'Dr. Pablo Reyes',
  role: 'Profesor de Fisiología',
  institution: 'Universidad del Desarrollo',
  topic: 'Diagrama de Wiggers',
  context: 'Durante la conversación nos mostró el Diagrama de Wiggers.',
  phrase: 'El Diagrama de Wiggers conecta el latido cardíaco con el movimiento de nuestra válvula.',
};

// ─────────────────────────── Pantalla 7 · Dibujo inicial ───────────────────────────
/** Foto o escaneo del dibujo a mano (copiar a /public y escribir la ruta, p. ej. 'dibujo-inicial.jpg') o null. */
export const DRAWING_BEFORE: string | null = null;

// ─────────────────────────── Pantalla 9 · Resultados esperados ───────────────────────────
export const EXPECTED = [
  { id: 'proto', t: 'Prototipo trivalva funcional', d: 'Tres valvas que abren y cierran de forma repetible con un solo servo.' },
  { id: 'signals', t: 'Señales registradas', d: 'Vibración y sonido de cada apertura y cierre, guardados por ciclo.' },
  { id: 'compare', t: 'Comparación de patrones', d: 'Diferencias entre el funcionamiento normal y una apertura restringida.' },
  { id: 'dash', t: 'Dashboard interactivo', d: 'Señales, ciclo valvular y alertas de cambio en una sola vista.' },
];

// ─────────────────────────────── Bibliografía ───────────────────────────────
export interface Reference {
  id: string;
  text: string;
  url?: string;
  /** verificada = autores, título, revista y DOI comprobados; pendiente = falta verificar. */
  status: 'verificada' | 'pendiente de verificación';
  topic:
    | 'Problemas complejos e interdisciplina'
    | 'Prótesis valvulares'
    | 'Fisiología y ECG'
    | 'Rehabilitación y respuesta funcional'
    | 'Análisis acústico y vibracional'
    | 'Componentes electrónicos';
  note?: string;
}

export const REFERENCES: Reference[] = [
  {
    id: 'rittel1973',
    topic: 'Problemas complejos e interdisciplina',
    text: 'Rittel HWJ, Webber MM. Dilemmas in a general theory of planning. Policy Sciences. 1973;4(2):155–169.',
    url: 'https://doi.org/10.1007/BF01405730',
    status: 'verificada',
  },
  {
    id: 'otto2021',
    topic: 'Prótesis valvulares',
    text: 'Otto CM, Nishimura RA, Bonow RO, et al. 2020 ACC/AHA Guideline for the Management of Patients With Valvular Heart Disease. Circulation. 2021;143(5):e72–e227.',
    url: 'https://doi.org/10.1161/CIR.0000000000000923',
    status: 'verificada',
  },
  {
    id: 'vahanian2022',
    topic: 'Prótesis valvulares',
    text: 'Vahanian A, Beyersdorf F, et al. 2021 ESC/EACTS Guidelines for the management of valvular heart disease. Eur Heart J. 2022;43(7):561–632.',
    url: 'https://doi.org/10.1093/eurheartj/ehab395',
    status: 'verificada',
  },
  {
    id: 'zoghbi2024',
    topic: 'Prótesis valvulares',
    text: 'Zoghbi WA, et al. Guidelines for the Evaluation of Prosthetic Valve Function With Cardiovascular Imaging: A Report From the American Society of Echocardiography. J Am Soc Echocardiogr. 2024;37(1):2–63.',
    url: 'https://doi.org/10.1016/j.echo.2023.10.004',
    status: 'verificada',
  },
  {
    id: 'statpearls',
    topic: 'Fisiología y ECG',
    text: 'StatPearls. Physiology, Cardiac Cycle. Treasure Island (FL): StatPearls Publishing (NCBI Bookshelf NBK459327).',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK459327/',
    status: 'pendiente de verificación',
    note: 'Documento confirmado; autores y texto exacto por confirmar en la versión vigente.',
  },
  {
    id: 'pan1985',
    topic: 'Fisiología y ECG',
    text: 'Pan J, Tompkins WJ. A real-time QRS detection algorithm. IEEE Trans Biomed Eng. 1985;BME-32(3):230–236.',
    status: 'verificada',
  },
  {
    id: 'iec60601',
    topic: 'Fisiología y ECG',
    text: 'IEC 60601-1. Medical electrical equipment — Part 1: General requirements for basic safety and essential performance (edición vigente).',
    status: 'pendiente de verificación',
    note: 'Norma de referencia para aislamiento y corrientes de fuga; consultar la edición y enmiendas vigentes.',
  },
  {
    id: 'abraham2021',
    topic: 'Rehabilitación y respuesta funcional',
    text: 'Abraham LN, Sibilitz KL, Berg SK, et al. Exercise-based cardiac rehabilitation for adults after heart valve surgery. Cochrane Database Syst Rev. 2021;5:CD010876.',
    url: 'https://doi.org/10.1002/14651858.CD010876.pub3',
    status: 'verificada',
  },
  {
    id: 'ambrosetti2021',
    topic: 'Rehabilitación y respuesta funcional',
    text: 'Ambrosetti M, et al. Secondary prevention through comprehensive cardiovascular rehabilitation: From knowledge to implementation. 2020 update. A position paper from the EAPC. Eur J Prev Cardiol. 2021;28(5):460–495.',
    url: 'https://doi.org/10.1177/2047487320913379',
    status: 'verificada',
  },
  {
    id: 'mcdonagh2023',
    topic: 'Rehabilitación y respuesta funcional',
    text: 'McDonagh STJ, Dalal H, Moore S, et al. Home-based versus centre-based cardiac rehabilitation. Cochrane Database Syst Rev. 2023;10:CD007130.',
    url: 'https://doi.org/10.1002/14651858.CD007130.pub5',
    status: 'verificada',
  },
  {
    id: 'borg1982',
    topic: 'Rehabilitación y respuesta funcional',
    text: 'Borg GA. Psychophysical bases of perceived exertion. Med Sci Sports Exerc. 1982;14(5):377–381.',
    url: 'https://doi.org/10.1249/00005768-198205000-00012',
    status: 'verificada',
  },
  {
    id: 'cole1999',
    topic: 'Rehabilitación y respuesta funcional',
    text: 'Cole CR, Blackstone EH, Pashkow FJ, Snader CE, Lauer MS. Heart-rate recovery immediately after exercise as a predictor of mortality. N Engl J Med. 1999;341(18):1351–1357.',
    url: 'https://doi.org/10.1056/NEJM199910283411804',
    status: 'verificada',
  },
  {
    id: 'fritzsche2007',
    topic: 'Análisis acústico y vibracional',
    text: 'Fritzsche D, Eitz T, Laczkovics A, et al. Early detection of mechanical valve dysfunction using a new home monitoring device. Ann Thorac Surg. 2007;83(2):542–548.',
    status: 'pendiente de verificación',
    note: 'Autores, revista y volumen confirmados; falta confirmar DOI.',
  },
  {
    id: 'taebi2019',
    topic: 'Análisis acústico y vibracional',
    text: 'Taebi A, Solar BE, Bomar AJ, Sandler RH, Mansy HA. Recent Advances in Seismocardiography. Vibration. 2019;2(1):64–86.',
    url: 'https://doi.org/10.3390/vibration2010005',
    status: 'verificada',
  },
  {
    id: 'inmp441',
    topic: 'Componentes electrónicos',
    text: 'TDK InvenSense. INMP441 — Omnidirectional MEMS microphone with I²S digital output. Ficha de producto.',
    url: 'https://invensense.tdk.com/digital/inmp441',
    status: 'verificada',
    note: 'El fabricante lo marca como “Not Recommended for New Designs”: verificar disponibilidad.',
  },
  {
    id: 'esp32',
    topic: 'Componentes electrónicos',
    text: 'Espressif Systems. ESP32 Series Datasheet (versión vigente). Documentación técnica oficial.',
    url: 'https://www.espressif.com/en/support/download/documents',
    status: 'verificada',
    note: 'Enlace a la página oficial de documentos; descargar la versión vigente.',
  },
  {
    id: 'espidf',
    topic: 'Componentes electrónicos',
    text: 'Espressif Systems. ESP-IDF Programming Guide: I2S y ADC (ESP32).',
    url: 'https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/i2s.html',
    status: 'pendiente de verificación',
    note: 'Documentación oficial; enlace no comprobado desde el entorno de desarrollo.',
  },
  {
    id: 'mg90s',
    topic: 'Componentes electrónicos',
    text: 'Tower Pro. MG90S Metal Gear Micro Servo — especificaciones del fabricante.',
    status: 'pendiente de verificación',
    note: 'No se encontró hoja de datos oficial; los distribuidores reportan ≈1,8 kg·cm a 4,8 V.',
  },
];

export const refIndex = (id: string) => REFERENCES.findIndex((r) => r.id === id) + 1;

// ─────────────────────────── Notas del expositor ───────────────────────────
export const NOTES: Record<string, string> = {
  cover: 'Presentar CardioVal AI y al equipo de Biomedicina y Kinesiología. La válvula es aórtica, de tres valvas.',
  'que-es': 'Válvula → sensores → IA. Recorrer el flujo: piezo y MEMS registran, el ESP32 transmite, el análisis compara y el dashboard muestra.',
  problema:
    'Leer la pregunta. No decir que las evaluaciones actuales son insuficientes: son especializadas y complementarias. Abrir «¿Por qué es un wicked problem?».',
  interdisciplina: 'Tocar cada aporte conjunto para mostrar qué conocimiento aporta cada carrera.',
  materiales: 'Tocar 2–3 tarjetas (ESP32, piezo, MEMS). No hay costos ni proveedores en esta versión.',
  gantt: 'Cronograma propuesto (Encargo 2 por incorporar). Destacar la Feria el 4 de noviembre.',
  entrevista:
    'Entrevista al Dr. Pablo Reyes (Fisiología UDD): nos mostró el Diagrama de Wiggers. Señalar ECG → presión del VI supera a la aórtica → la válvula abre; la presión del VI cae bajo la aórtica → cierra. La aplicación al prototipo es interpretación del equipo.',
  prototipo:
    'Funcionamiento normal vs. apertura restringida; ver sensores y mecanismo. Diseño conceptual por validar. Una válvula real se mueve por presión, no por motor.',
  modelos: 'Movimiento: θ(t) y su derivada. Vibración: energía de la señal, no joules. Latido: FC = 60/RR y retardo τ configurable.',
  resultados: 'Son resultados esperados, no logrados. Conectar con la pregunta del wicked problem.',
  cierre: 'Mostrar el souvenir (propuesta) y el QR. Invitar a explorar el dashboard.',
  biblio: 'Referencias verificadas y pendientes de verificación marcadas explícitamente.',
};
