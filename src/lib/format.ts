export const fmt = (v: number | null | undefined, d = 0) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  // evita «−0,00» cuando el valor redondea a cero
  const x = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  return x.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
};

export const pctDelta = (v: number, base: number) => (base === 0 ? 0 : ((v - base) / Math.abs(base)) * 100);

export const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v), d)}`;

export const mmss = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
