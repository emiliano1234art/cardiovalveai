/** Estilo común para todos los gráficos (coherencia visual). */
export const axis = {
  stroke: '#cfd8e2',
  tick: { fill: '#7d8da0', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#e3e8ee' },
} as const;

export const grid = { stroke: '#eef2f6', vertical: false } as const;

export const COLORS = {
  piezo: '#2a78d6',
  audio: '#0f9895',
  baseline: '#8b98a9',
  patient: '#5b4bc4',
  spo2: '#2a78d6',
  openFill: 'rgba(16, 162, 160, 0.08)',
  ok: '#138a5a',
  warn: '#b77700',
  crit: '#c9372f',
};

export const margin = { top: 8, right: 12, bottom: 4, left: 0 };

/** Formato de ticks numéricos coherente con el resto de la interfaz (coma decimal). */
export const numTick = (v: number) =>
  v.toLocaleString('es-CL', { maximumFractionDigits: Math.abs(v) < 1 && v !== 0 ? 3 : 2 });
