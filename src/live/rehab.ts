import type { Analysis } from './analysis';

export interface PlanBlock {
  title: string;
  items: string[];
}
export interface PlanPhase {
  name: string;
  weeks: string;
  goal: string;
  blocks: PlanBlock[];
}
export interface RehabPlan {
  title: string;
  severityLabel: string;
  tone: 'ok' | 'warn' | 'crit';
  summary: string;
  basedOn: string[];
  frequency: string;
  phases: PlanPhase[];
  dailyLife: PlanBlock;
  monitoring: PlanBlock;
  progression: string[];
  stopSigns: string[];
  disclaimer: string;
}

const DISCLAIMER =
  'Plan sugerido por un prototipo académico a partir de datos de un modelo a escala. No es un diagnóstico ni una prescripción: debe ser revisado, ' +
  'ajustado y aprobado por un/a kinesiólogo/a y por el médico tratante antes de aplicarse a una persona real.';

const STOP_SIGNS = [
  'Dolor o presión en el pecho',
  'Falta de aire desproporcionada o que no cede al reposo en 5 minutos',
  'Mareo, visión borrosa, sensación de desmayo o desmayo',
  'Palpitaciones intensas o ritmo irregular nuevo',
  'Hinchazón nueva de tobillos/piernas o aumento rápido de peso',
  'Si ocurre cualquiera: detener el ejercicio, sentarse y avisar al equipo de salud. Si es intenso o no cede, solicitar atención urgente.',
];

const DAILY_COMMON = [
  'Planificar el día: concentrar las tareas pesadas en las horas de mejor energía y alternarlas con tareas livianas.',
  'Hacer pausas programadas (5 min cada 25–30 min de actividad) antes de sentir cansancio, no después.',
  'Sentarse para tareas que se pueden hacer sentado (cocinar, vestirse, ducharse con silla antideslizante).',
  'Escaleras o pendientes: subir a ritmo propio, con pausa cada pocos escalones, usando la prueba del habla (poder conversar).',
  'Cargar poco peso y repartirlo; usar carro o mochila en lugar de bolsas colgando de una mano.',
  'Dormir con el torso levemente elevado si se agita al acostarse (consultar con el equipo de salud).',
  'Evitar actividad intensa en ayunas, tras comidas copiosas o con calor extremo.',
];

export function buildPlan(a: Analysis): RehabPlan {
  const basedOn = [
    `${a.n} ciclos analizados`,
    `Apertura media ${a.openPct.toFixed(0)} % de la esperada (${a.meanPeak.toFixed(0)}° de ${a.refDeg.toFixed(0)}°)`,
    `Variabilidad de apertura ${a.peakCv.toFixed(0)} % · variabilidad de ritmo ${a.rhythmCv.toFixed(0)} %`,
    `Tendencia ${a.trendPctPerCycle >= 0 ? '+' : ''}${a.trendPctPerCycle.toFixed(1)} pp/ciclo`,
  ];

  const irregular = a.rhythmCv > 15 || a.peakCv > 25;
  const declining = a.trendPctPerCycle < -0.6;

  const monitoring: PlanBlock = {
    title: 'Monitoreo en cada sesión',
    items: [
      'Medir en reposo y al terminar: frecuencia cardíaca, presión arterial y saturación si hay oxímetro.',
      'Registrar el esfuerzo percibido (escala de Borg 0–10) y los síntomas durante la sesión.',
      'Usar la prueba del habla: debe poder conversar con frases cortas mientras se ejercita.',
      ...(irregular ? ['Palpar o controlar el pulso: si el ritmo se siente irregular, anotar y comunicar al equipo de salud.'] : []),
      'Revisar este dashboard: comparar la apertura de la válvula entre semanas para ajustar la carga.',
    ],
  };

  const progressionBase = [
    'Progresar solo si en las últimas 2 semanas no hubo síntomas, el esfuerzo percibido fue ≤ objetivo y la apertura medida se mantuvo estable o mejoró.',
    'Aumentar una sola variable por vez (primero duración, luego frecuencia, al final intensidad), en incrementos de ~10 %.',
    'Si hay síntomas o la apertura medida baja, volver a la fase anterior y avisar al equipo de salud.',
  ];

  // ───────────── sin datos ─────────────
  if (a.level === 'none') {
    return {
      title: 'Plan de rehabilitación kinésica',
      severityLabel: 'Sin datos',
      tone: 'ok',
      summary: 'Todavía no hay ciclos registrados. Conecta el ESP32 o usa el modo demo para que la válvula complete ciclos y se pueda generar un plan.',
      basedOn: [],
      frequency: '—',
      phases: [],
      dailyLife: { title: 'Vida diaria', items: [] },
      monitoring: { title: 'Monitoreo', items: [] },
      progression: [],
      stopSigns: [],
      disclaimer: DISCLAIMER,
    };
  }

  // ───────────── apertura normal ─────────────
  if (a.level === 'normal') {
    return {
      title: 'Plan de rehabilitación kinésica · Mantención',
      severityLabel: 'Apertura normal',
      tone: 'ok',
      summary:
        'La válvula abre dentro del rango esperado. El objetivo es mantener la capacidad funcional, prevenir el desacondicionamiento y reconocer a tiempo cualquier cambio.',
      basedOn,
      frequency: '3–5 sesiones por semana · 30–45 min',
      phases: [
        {
          name: 'Mantención',
          weeks: 'Continuo',
          goal: 'Conservar la resistencia y la fuerza con esfuerzo moderado.',
          blocks: [
            { title: 'Entrada en calor (5–8 min)', items: ['Marcha suave y movilidad de hombros, columna y cadera.', 'Respiración diafragmática: 5 respiraciones lentas.'] },
            {
              title: 'Trabajo aeróbico (20–30 min)',
              items: ['Caminata rápida, bicicleta o natación a esfuerzo moderado (Borg 4–5/10, puede conversar).', 'Intervalos opcionales: 3 min más rápido / 2 min suave, ×4–5.'],
            },
            { title: 'Fuerza (2 días/semana)', items: ['6–8 ejercicios globales, 2 series de 10–12 repeticiones con carga liviana-moderada.', 'Exhalar al hacer el esfuerzo; no contener la respiración (evitar Valsalva).'] },
            { title: 'Vuelta a la calma (5 min)', items: ['Caminar suave y estiramientos de pantorrillas, muslos, pecho y espalda.'] },
          ],
        },
      ],
      dailyLife: { title: 'Recomendaciones para el día a día', items: DAILY_COMMON.slice(0, 3) },
      monitoring,
      progression: progressionBase,
      stopSigns: STOP_SIGNS,
      disclaimer: DISCLAIMER,
    };
  }

  // ───────────── apertura limitada ─────────────
  if (a.level === 'limited') {
    return {
      title: 'Plan de rehabilitación kinésica · Progresivo',
      severityLabel: 'Apertura limitada',
      tone: 'warn',
      summary:
        'La válvula abre menos de lo esperado, por lo que el corazón puede trabajar con más esfuerzo. El plan busca aumentar la tolerancia al esfuerzo de forma gradual, ' +
        'reducir la fatiga diaria y enseñar a dosificar la energía.',
      basedOn,
      frequency: '3–4 sesiones por semana · 15–30 min + pausas activas diarias',
      phases: [
        {
          name: 'Fase 1 · Adaptación',
          weeks: 'Semanas 1–2',
          goal: 'Aprender a respirar y a dosificar el esfuerzo con cargas bajas.',
          blocks: [
            { title: 'Respiración (2 veces al día, 5–10 min)', items: ['Respiración diafragmática sentado o semisentado, 6–8 respiraciones por minuto.', 'Respiración con labios fruncidos al esfuerzo.'] },
            { title: 'Aeróbico suave (3 veces/semana)', items: ['Caminata 10–15 min en total, en tramos de 3–5 min con 1–2 min de pausa.', 'Intensidad: Borg 3–4/10, puede conversar con frases completas.'] },
            { title: 'Movilidad y fuerza liviana (2 veces/semana)', items: ['Movilidad torácica y de hombros; sentarse y pararse de una silla ×8–10; elevaciones de talones ×10–12; bandas elásticas livianas.', '1–2 series, sin contener la respiración.'] },
          ],
        },
        {
          name: 'Fase 2 · Progresión',
          weeks: 'Semanas 3–6',
          goal: 'Aumentar la duración del trabajo continuo y la fuerza funcional.',
          blocks: [
            { title: 'Aeróbico (3–4 veces/semana)', items: ['Caminata 20–30 min, pausas cada 8–10 min; opcional bicicleta estática sin resistencia alta.', 'Intensidad: Borg 4–5/10.'] },
            { title: 'Fuerza (2 veces/semana)', items: ['6 ejercicios globales, 2 series de 10–12 repeticiones, carga liviana-moderada.', 'Control de la respiración y descanso de 60–90 s entre series.'] },
          ],
        },
        {
          name: 'Fase 3 · Consolidación',
          weeks: 'Semanas 7–12',
          goal: 'Consolidar la autonomía y la actividad en la vida diaria.',
          blocks: [
            { title: 'Mantención y transferencia', items: ['30 min de caminata continua o intervalos suaves; fuerza 2 veces/semana.', 'Practicar tareas reales: escaleras, compras, tareas del hogar con pausas planificadas.'] },
          ],
        },
      ],
      dailyLife: { title: 'Conservación de energía y vida diaria', items: DAILY_COMMON },
      monitoring,
      progression: progressionBase,
      stopSigns: STOP_SIGNS,
      disclaimer: DISCLAIMER,
    };
  }

  // ───────────── apertura incompleta ─────────────
  return {
    title: 'Plan de rehabilitación kinésica · Cautelosa',
    severityLabel: 'Apertura incompleta',
    tone: 'crit',
    summary:
      'La válvula abre bastante menos de lo esperado: el flujo es limitado y lo esperable es cansarse con poco esfuerzo. Antes de comenzar se requiere autorización médica. ' +
      'El plan prioriza la respiración, la conservación de energía y un trabajo muy gradual y de baja intensidad para que la persona se canse menos y tenga menos dificultades en el día a día.',
    basedOn,
    frequency: 'Sesiones cortas de 5–10 min, 1–2 veces al día, 5–6 días/semana (con supervisión)',
    phases: [
      {
        name: 'Fase 1 · Base segura',
        weeks: declining ? 'Semanas 1–4 (mantener hasta estabilizar)' : 'Semanas 1–3',
        goal: 'Reducir la sensación de falta de aire, aprender a dosificar el esfuerzo y mantener la movilidad.',
        blocks: [
          {
            title: 'Respiración y relajación (2–3 veces al día, 5–10 min)',
            items: ['Respiración diafragmática en semisentado, 6 respiraciones por minuto.', 'Respiración con labios fruncidos (inspirar 2 s por la nariz, exhalar 4 s).', 'Posiciones de alivio: sentado inclinado hacia delante con antebrazos apoyados.'],
          },
          {
            title: 'Movilidad y activación (diario)',
            items: ['Movilidad suave de cuello, hombros, columna y tobillos, sentado.', 'Bombeo de tobillos y marcha en el lugar sentado, 1–2 min, para favorecer el retorno venoso.'],
          },
          {
            title: 'Caminata muy suave (1–2 veces/día)',
            items: ['3–5 min en superficie plana, con pausa a demanda; objetivo de esfuerzo Borg 2–3/10 (muy suave).', 'Detenerse si no puede conversar con frases completas.'],
          },
        ],
      },
      {
        name: 'Fase 2 · Acondicionamiento gradual',
        weeks: 'Semanas 4–8, solo si la Fase 1 fue bien tolerada',
        goal: 'Aumentar la tolerancia al esfuerzo sin provocar síntomas.',
        blocks: [
          { title: 'Aeróbico por tramos', items: ['Caminata 2–3 minutos + 1–2 minutos de pausa, repetir 3–4 veces (total 10–15 min).', 'Intensidad: Borg 3–4/10.'] },
          { title: 'Fuerza funcional liviana (2 veces/semana)', items: ['Sentarse y pararse de una silla ×5–8; elevaciones de talones apoyado ×8–10; bandas muy livianas.', '1 serie de 8–10 repeticiones, ritmo lento, exhalando al esfuerzo; evitar ejercicios isométricos y cargas pesadas.'] },
        ],
      },
      {
        name: 'Fase 3 · Autonomía',
        weeks: 'Semanas 9–12 en adelante',
        goal: 'Trasladar lo aprendido a las actividades cotidianas.',
        blocks: [
          { title: 'Actividad diaria dosificada', items: ['Caminata de 15–20 minutos por tramos, según tolerancia.', 'Entrenar tareas cotidianas (escaleras, compras, vestirse) con pausas y respiración controlada.'] },
        ],
      },
    ],
    dailyLife: { title: 'Conservación de energía y vida diaria', items: DAILY_COMMON },
    monitoring: {
      title: monitoring.title,
      items: [
        'Ejercitarse en un entorno acompañado o supervisado, al menos durante las primeras semanas.',
        ...monitoring.items,
        ...(declining ? ['La apertura medida está disminuyendo: pedir reevaluación médica antes de aumentar la actividad.'] : []),
      ],
    },
    progression: [
      'No comenzar sin autorización médica; confirmar tipo y límites de esfuerzo permitidos.',
      ...progressionBase,
      'Evitar ejercicios de alta intensidad, esfuerzos de fuerza máxima, contener la respiración y ambientes de mucho calor.',
    ],
    stopSigns: STOP_SIGNS,
    disclaimer: DISCLAIMER,
  };
}

/** Convierte el plan en Markdown para descargarlo o imprimirlo. */
export function planToMarkdown(p: RehabPlan, generatedAt = new Date()): string {
  const L: string[] = [];
  L.push(`# ${p.title}`);
  L.push(`_${generatedAt.toLocaleString('es-CL')} · ${p.severityLabel}_`, '');
  L.push(p.summary, '');
  if (p.basedOn.length) {
    L.push('## Datos en que se basa', ...p.basedOn.map((x) => `- ${x}`), '');
  }
  L.push(`**Frecuencia sugerida:** ${p.frequency}`, '');
  for (const ph of p.phases) {
    L.push(`## ${ph.name} (${ph.weeks})`, `Objetivo: ${ph.goal}`, '');
    for (const b of ph.blocks) L.push(`### ${b.title}`, ...b.items.map((x) => `- ${x}`), '');
  }
  for (const b of [p.dailyLife, p.monitoring]) if (b.items.length) L.push(`## ${b.title}`, ...b.items.map((x) => `- ${x}`), '');
  if (p.progression.length) L.push('## Criterios de progresión', ...p.progression.map((x) => `- ${x}`), '');
  if (p.stopSigns.length) L.push('## Señales de alerta (detener y consultar)', ...p.stopSigns.map((x) => `- ${x}`), '');
  L.push('---', p.disclaimer);
  return L.join('\n');
}
