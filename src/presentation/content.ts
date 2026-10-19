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
export const isPending = (s: string | null | undefined) => !s || /^\[.*\]$/.test(s.trim());

// ─────────────────────────────── Portada ───────────────────────────────
export const META = {
  project: 'ValveSense',
  subtitle: 'Del movimiento valvular al seguimiento funcional: una base para la rehabilitación cardiorrespiratoria personalizada',
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
  topic: 'Prótesis valvulares' | 'Rehabilitación y respuesta funcional' | 'Análisis acústico y vibracional' | 'Componentes electrónicos';
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
  cover: 'Presentar al equipo CardioValveAI y ambas carreras. Señalar la válvula trivalva animada: es el modelo que usaremos durante toda la presentación.',
  s1: 'Explicar el nombre y la propuesta en tres frases. Recorrer la secuencia: lo que existe hoy (contorno continuo) y lo que es proyección futura (contorno discontinuo).',
  s2: 'Seleccionar 2 o 3 nodos del mapa. Mensaje: la recuperación no depende solo de la prótesis; también de la respuesta funcional, los síntomas, la adherencia y el acceso.',
  s3: 'Mostrar el aporte de cada carrera y cómo convergen en una pregunta compartida. Completar con los hallazgos del Toolkit.',
  s4: 'Seleccionar componentes en el modelo. Aclarar qué está definido y qué es propuesta (dimensiones, torque del servo, mecanismo).',
  s5: 'Recorrer las fases y los hitos del 20 y 21 de octubre y del 4 de noviembre. Los estados solo se marcan con respaldo documental.',
  s6: 'Entrevista pendiente: explicar a quién se entrevistará y qué preguntas haremos. Actualizar esta diapositiva cuando se realice.',
  s7: 'Demostración en vivo: cambiar condiciones (60°, 45°, cierre incompleto, asimetría) y mostrar cómo cambian las señales simuladas sincronizadas.',
  s8: 'Límites → velocidad angular; derivadas → qué tan rápido abre/cierra; integrales → señal acumulada en una ventana. Cambiar la frecuencia y ver cómo se actualiza todo.',
  s9: 'Separar lo demostrado, lo pendiente de probar y la proyección. El panel funcional es sintético: ilustra la idea futura.',
  s10: 'Mostrar el llavero y el QR. Cerrar con la frase final.',
  biblio: 'Referencias verificadas y pendientes marcadas explícitamente.',
};
