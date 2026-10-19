/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CONTENIDO EDITABLE DE LA PRESENTACIÓN — ValveSense · CardioValveAI
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Todo lo que el equipo debe completar o actualizar está en este archivo:
 *  integrantes, entrevista, cronograma, hallazgos del Toolkit, referencias,
 *  URL del QR y notas del expositor.
 *
 *  Regla: un texto entre [corchetes] es un CAMPO PENDIENTE y se muestra
 *  resaltado en la presentación. No reemplazar con información no verificada.
 */

export const PENDING = (label: string) => `[${label}]`;

/** Idea principal que debe recordar el público. */
export const KEY_IDEA =
  'ValveSense busca transformar las señales mecánicas y acústicas de una prótesis valvular en información útil para explorar nuevas formas de monitoreo cardiovascular y apoyar, en el futuro, una rehabilitación más personalizada.';
export const isPending = (s: string | null | undefined) => !s || /^\[.*\]$/.test(s.trim());

// ─────────────────────────────── Portada ───────────────────────────────
export const META = {
  project: 'ValveSense',
  subtitle: 'Señales mecánicas y acústicas de una prótesis valvular, sincronizadas con el ECG, para explorar un monitoreo cardiovascular más personalizado',
  team: 'CardioValveAI',
  careers: ['Ingeniería Civil en Biomedicina', 'Kinesiología'],
  course: 'Proyecto Interdisciplinario (ID)',
  institution: 'Facultad de Ingeniería',
  date: '21 de octubre de 2026',
  /** Integrantes: reemplazar los marcadores por nombres reales. */
  members: [
    { name: PENDING('Integrante 1'), career: 'Ingeniería Civil en Biomedicina' },
    { name: PENDING('Integrante 2'), career: 'Ingeniería Civil en Biomedicina' },
    { name: PENDING('Integrante 3'), career: 'Kinesiología' },
    { name: PENDING('Integrante 4'), career: 'Kinesiología' },
  ],
  focus:
    'Sistema inteligente de seguimiento de pacientes con prótesis valvulares que busca relacionar el funcionamiento valvular con la respuesta funcional del paciente para apoyar una rehabilitación cardiorrespiratoria personalizada.',
};

// ──────────────────────── QR / enlace del dashboard ────────────────────────
/**
 * URL pública del despliegue (GitHub Pages, workflow `deploy.yml`, ejecución
 * exitosa del 2 oct 2026). Si cambia, actualizar aquí; si se deja vacío, el QR
 * no se genera y aparece un campo pendiente.
 */
export const DASHBOARD_URL = 'https://emiliano1234art.github.io/cardiovalveai/';

// ─────────────────── Toolkit (Encargo 1) — hallazgos reales ───────────────────
/** Reemplazar por los hallazgos documentados en el Toolkit. */
export const TOOLKIT_FINDINGS: string[] = [
  PENDING('Hallazgo 1 del Toolkit — copiar desde Encargo 1'),
  PENDING('Hallazgo 2 del Toolkit — copiar desde Encargo 1'),
  PENDING('Hallazgo 3 del Toolkit — copiar desde Encargo 1'),
];

/** Decisiones conjuntas ya definidas en el planteamiento del equipo. */
export const JOINT_DECISIONS: { decision: string; from: string }[] = [
  { decision: 'Enfocar el proyecto en seguimiento y rehabilitación, no en diagnóstico.', from: 'Biomedicina + Kinesiología' },
  { decision: 'Registrar vibración (piezoeléctrico) y sonido (MEMS) del movimiento valvular en un prototipo a escala.', from: 'Biomedicina' },
  { decision: 'Seleccionar como variables funcionales futuras: FC, SpO₂, percepción de esfuerzo (Borg) y recuperación de FC.', from: 'Kinesiología' },
  { decision: 'Construir una línea basal del prototipo y comparar condiciones mecánicas controladas.', from: 'Biomedicina + Kinesiología' },
  { decision: 'Sincronizar la válvula demostrativa con el ECG como representación educativa (no fisiológica).', from: 'Biomedicina + Kinesiología' },
];

// ─────────────────────── Entrevista al docente (pendiente) ───────────────────────
export const INTERVIEW = {
  status: 'pendiente' as 'pendiente' | 'realizada',
  name: PENDING('Nombre del profesor(a)'),
  role: PENDING('Especialidad o cargo'),
  date: PENDING('Fecha de la entrevista'),
  /** Ruta a la foto institucional (p. ej. '/interview.jpg' dentro de /public) o null. */
  photo: null as string | null,
  quote: PENDING('Extracto real pendiente'),
  observation: PENDING('Observación del académico'),
  implication: PENDING('Implicación para el proyecto'),
  adjustment: PENDING('Ajuste propuesto por el equipo'),
  verdict: null as null | 'valida' | 'complementa' | 'cuestiona',
  /** Preguntas preparadas para la entrevista (guion, NO respuestas). */
  questions: [
    '¿Qué variables funcionales considera más útiles para seguir a una persona con prótesis valvular durante la rehabilitación?',
    '¿Qué limitaciones ve en usar un prototipo accionado por servo, sin circuito de presión ni flujo?',
    '¿Cómo validaría que el registro de vibración y sonido es repetible entre sesiones?',
    '¿Qué riesgos éticos o de interpretación debemos evitar al mostrar indicadores de “anomalía”?',
    '¿Qué resultado mínimo esperaría ver en la Feria Científica?',
  ],
};

// ─────────────────────────── Dibujo inicial (antes) ───────────────────────────
/** Ruta a la foto/escaneo del dibujo a mano (p. ej. '/dibujo-inicial.jpg' en /public) o null. */
export const DRAWING_BEFORE: string | null = null;

// ─────────────────────────── Carta Gantt (Encargo 2) ───────────────────────────
export type TaskStatus = 'realizado' | 'en curso' | 'pendiente' | 'por confirmar';

export interface GanttTask {
  name: string;
  start: string; // ISO yyyy-mm-dd
  end: string;
  status: TaskStatus;
  owner?: string;
  /** Respaldo documental del estado (obligatorio para «realizado» / «en curso»). */
  evidence?: string;
}

/**
 * IMPORTANTE: El Encargo 2 no estaba disponible al construir esta versión.
 * Las fechas son una PROPUESTA editable; los estados quedan «por confirmar»
 * salvo los que tienen respaldo en el repositorio.
 */
export const GANTT_IS_PROPOSAL = true;
export const GANTT: GanttTask[] = [
  { name: 'Diseño de válvula y mecanismo', start: '2026-09-21', end: '2026-10-09', status: 'por confirmar' },
  { name: 'Impresión 3D (anillo y valvas)', start: '2026-10-05', end: '2026-10-16', status: 'por confirmar' },
  { name: 'Montaje mecánico', start: '2026-10-12', end: '2026-10-23', status: 'por confirmar' },
  { name: 'Integración de sensores', start: '2026-10-19', end: '2026-10-28', status: 'por confirmar' },
  { name: 'Adquisición de datos (ESP32)', start: '2026-10-22', end: '2026-10-31', status: 'por confirmar' },
  { name: 'Análisis de señales', start: '2026-10-26', end: '2026-11-02', status: 'por confirmar' },
  {
    name: 'Sincronización ECG (modo simulado)',
    start: '2026-10-15',
    end: '2026-10-28',
    status: 'en curso',
    evidence: 'Repositorio: ECG sintético, detección de R y sincronización en la presentación (oct.)',
  },
  { name: 'Adquisición ECG real segura (propuesta)', start: '2026-10-27', end: '2026-11-03', status: 'por confirmar' },
  {
    name: 'Dashboard y presentación interactiva',
    start: '2026-10-01',
    end: '2026-10-20',
    status: 'en curso',
    evidence: 'Repositorio: dashboard v1 (1 oct) y presentación interactiva (19 oct)',
  },
  { name: 'Pruebas por condición', start: '2026-10-28', end: '2026-11-03', status: 'por confirmar' },
  { name: 'Preparación Feria y souvenir', start: '2026-10-26', end: '2026-11-04', status: 'por confirmar' },
];

export const MILESTONES = [
  { date: '2026-10-20', label: 'Entrega Canvas · 19:00' },
  { date: '2026-10-21', label: 'Presentación de avance' },
  { date: '2026-11-04', label: 'Feria Científica' },
];

// ─────────────────────────────── Bibliografía ───────────────────────────────
export interface Reference {
  id: string;
  text: string;
  url?: string;
  /** verificada = autores, título, revista y DOI comprobados; pendiente = falta verificar. */
  status: 'verificada' | 'pendiente de verificación';
  topic: 'Prótesis valvulares' | 'Fisiología y ECG' | 'Rehabilitación y respuesta funcional' | 'Análisis acústico y vibracional' | 'Componentes electrónicos';
  note?: string;
}

export const REFERENCES: Reference[] = [
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
  cover: 'Presentar al equipo CardioValveAI y la idea principal. La válvula animada es nuestro modelo universitario bileaflet.',
  s1: 'Problema clínico: la recuperación depende de la prótesis y de la respuesta funcional. Seleccionar 2–3 factores del mapa.',
  s2: 'La válvula aórtica natural tiene 3 valvas; nos inspiramos en una prótesis mecánica bileaflet. Las válvulas reales son pasivas: se abren cuando la presión ventricular supera la aórtica. Nuestro modelo NO tiene presión: lo mueve un actuador.',
  s3: 'ValveSense como sistema: sensores en la válvula, ECG, IA y dashboard, conectados con la respuesta funcional que aporta Kinesiología. Distinguir actual / propuesto / futuro.',
  s4: 'Mostrar el modelo con vista interna: piezo en el anillo, MEMS en su alojamiento, cableado interno, actuador. Comparar Alternativa A (servo, versión 1) con B (presión).',
  s5: 'Demostración: ECG simulado → detección de R → retardo τ → apertura. Cambiar la FC y el retardo. Recalcar: el ECG es eléctrico; es una representación educativa sincronizada. ECG real solo con adquisición aislada.',
  s6: 'Comparar normal vs apertura restringida. Luego subir la FC: la IA no lo marca como falla porque la firma de cada evento no cambia y el ciclo coincide con el RR.',
  s7: 'Recorrer las ecuaciones: RR → FC, temporización desde el pico R, RMS/energía, Fourier y similitud con la basal. La pestaña de cálculo conserva límites, derivadas e integrales.',
  s8: 'Dashboard actualizado: cada panel indica si el dato es sintético, experimental (pendiente) o una aplicación clínica futura.',
  s9: 'Integración clínica futura y resultados esperados. Dejar claro lo que NO afirmamos.',
  s10: 'Cronograma, entrevista pendiente y souvenir. Cerrar con la idea principal.',
  biblio: 'Referencias verificadas y pendientes marcadas explícitamente.',
};
