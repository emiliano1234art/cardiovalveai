import { MAX_STORED_CYCLES, STORAGE } from './config';
import type { CycleRecord } from './types';

export function loadCycles(): CycleRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE.cycles);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as CycleRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveCycles(c: CycleRecord[]): void {
  try {
    localStorage.setItem(STORAGE.cycles, JSON.stringify(c.slice(-MAX_STORED_CYCLES)));
  } catch {
    /* almacenamiento lleno o bloqueado: se sigue en memoria */
  }
}

export function loadPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function savePref(key: string, v: string): void {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignorar */
  }
}

export function cyclesToCsv(c: CycleRecord[]): string {
  const head = 'id,sesion,fecha_iso,n,modo,apertura_max_deg,hall_max_deg,servo_max_deg,duracion_ms,apertura_ms,cierre_ms,ciclos_por_min';
  const rows = c.map((r) =>
    [r.id, r.session, new Date(r.ts).toISOString(), r.n, r.mode, r.peak.toFixed(1), r.hallPeak.toFixed(1), r.servoPeak.toFixed(1), Math.round(r.durMs), Math.round(r.openMs), Math.round(r.closeMs), r.bpm.toFixed(1)].join(','),
  );
  return [head, ...rows].join('\n');
}

export function downloadText(name: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
