import Anthropic from '@anthropic-ai/sdk';
import type { Analysis } from './analysis';
import type { RehabPlan } from './rehab';
import type { CycleRecord } from './types';

export interface ClaudeModel {
  id: string;
  label: string;
  hint: string;
  /** reintento automático en otro modelo si el primero rechaza la solicitud */
  fallback: boolean;
}

/** Opus 5.5 es el modelo por defecto; los otros dos son opciones más económicas. */
export const CLAUDE_MODELS: ClaudeModel[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Más preciso (recomendado)', fallback: true },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Más económico', fallback: true },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Más rápido y barato', fallback: false },
];

export const SYSTEM_PROMPT = `Eres un asistente de apoyo para un proyecto académico de Ingeniería Biomédica y Kinesiología.
El proyecto es un modelo a escala de una válvula aórtica: un servo abre y cierra las valvas y 3 sensores Hall miden el ángulo de apertura. Los datos pueden ser de demostración o simulados.

Tu tarea: leer los registros de apertura que te entrega el sistema y redactar, en español de Chile, (1) un análisis de patrones y (2) un plan de rehabilitación kinésica coherente con ese análisis.

Reglas:
- Basa todo en los datos recibidos. No inventes mediciones. Si hay pocos ciclos, dilo y baja la certeza.
- Es un prototipo: no entregues diagnóstico ni prescripción. Indica que el plan debe ser revisado y aprobado por un/a kinesiólogo/a y por el médico tratante.
- El plan debe ayudar a que la persona se canse menos y tenga menos dificultades en el día a día: respiración, ejercicio gradual con intensidad (escala de Borg 0–10 y prueba del habla), conservación de energía, tareas cotidianas, progresión y monitoreo.
- Si la apertura es incompleta o va disminuyendo, el plan es más cauteloso (autorización médica previa, baja intensidad, sesiones cortas). Si hay ritmo irregular o variabilidad alta, agrega monitoreo del pulso.
- Incluye siempre señales de alerta para detener el ejercicio y consultar.
- Usa Markdown con estas secciones, en este orden: "## Análisis de patrones", "## Qué significa en palabras simples", "## Plan de rehabilitación kinésica" (con fases, frecuencia, intensidad y ejercicios concretos), "## Conservación de energía y vida diaria", "## Monitoreo y progresión", "## Señales de alerta", "## Limitaciones de este análisis".
- Escribe claro y directo, sin repetir lo mismo. Máximo unas 900 palabras.`;

export function buildUserContent(opts: {
  windowLabel: string;
  analysis: Analysis;
  cycles: CycleRecord[];
  plan: RehabPlan;
  source: string;
}): string {
  const { analysis: a, cycles, plan } = opts;
  const data = {
    origen_de_los_datos: opts.source,
    ventana_analizada: opts.windowLabel,
    angulo_de_apertura_normal_de_referencia_deg: a.refDeg,
    indicadores: {
      ciclos: a.n,
      nivel: a.level,
      apertura_media_pct_de_lo_esperado: Math.round(a.openPct),
      apertura_media_deg: Number(a.meanPeak.toFixed(1)),
      variabilidad_de_apertura_pct: Number(a.peakCv.toFixed(1)),
      ritmo_ciclos_por_min: Number(a.bpm.toFixed(1)),
      variabilidad_de_ritmo_pct: Number(a.rhythmCv.toFixed(1)),
      tendencia_puntos_porcentuales_por_ciclo: Number(a.trendPctPerCycle.toFixed(2)),
      ciclos_incompletos_pct: Math.round(a.incompleteShare),
      tiempo_medio_de_apertura_ms: Math.round(a.meanOpenMs),
    },
    hallazgos_del_analisis_local: a.findings.map((f) => `${f.title}: ${f.detail}`),
    ultimos_ciclos: cycles.slice(-30).map((c) => ({
      n: c.n,
      modo: c.mode === 'SANO' ? 'normal' : 'incompleta',
      apertura_deg: Number(c.peak.toFixed(1)),
      medido_hall_deg: Number(c.hallPeak.toFixed(1)),
      servo_deg: Number(c.servoPeak.toFixed(1)),
      apertura_ms: Math.round(c.openMs),
      ciclos_por_min: Number(c.bpm.toFixed(1)),
    })),
    borrador_de_plan_del_sistema: {
      titulo: plan.title,
      resumen: plan.summary,
      frecuencia: plan.frequency,
      fases: plan.phases.map((p) => ({ nombre: p.name, semanas: p.weeks, objetivo: p.goal })),
    },
  };
  return `Datos del sistema (JSON):\n\n${JSON.stringify(data, null, 1)}\n\nRedacta el análisis y el plan según las reglas.`;
}

/** Mensaje en español para cada tipo de error de la API. */
export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'La API key no es válida. Revísala en console.anthropic.com.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'Tu API key no tiene permiso para usar este modelo.';
  if (e instanceof Anthropic.RateLimitError) return 'Demasiadas solicitudes seguidas. Espera un momento y vuelve a intentar.';
  if (e instanceof Anthropic.BadRequestError) return `La API rechazó la solicitud: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return 'No hay conexión con la API. Revisa tu internet.';
  if (e instanceof Anthropic.APIError) return `Error de la API (${e.status ?? '?'}): ${e.message}`;
  if (e instanceof Error && e.name === 'AbortError') return 'Cancelado.';
  return e instanceof Error ? e.message : String(e);
}

/** Pide a Claude el análisis y el plan, y entrega el texto a medida que llega. */
export async function generateReport(opts: {
  apiKey: string;
  model: ClaudeModel;
  content: string;
  onText: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<{ truncated: boolean }> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  const stream = client.beta.messages.stream(
    {
      model: opts.model.id,
      max_tokens: 16000,
      // Si el modelo rechaza la solicitud, la API reintenta sola en el modelo de respaldo.
      ...(opts.model.fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: opts.content }],
    },
    { signal: opts.signal },
  );
  stream.on('text', (t) => opts.onText(t));
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') {
    throw new Error('Claude no pudo responder a esta solicitud. Intenta con otro modelo o revisa los datos.');
  }
  return { truncated: final.stop_reason === 'max_tokens' };
}
