import type { Verdict } from '../types/valvesense';

/** Veredicto experimental en lenguaje sencillo (nunca un diagnóstico). */
export const VERDICT: Record<Verdict, { label: string; short: string; color: string; bg: string; icon: string; text: string }> = {
  basal: { label: 'Dentro del patrón de referencia', short: 'Normal', color: 'var(--ok)', bg: 'var(--ok-soft)', icon: '✓', text: 'Ritmo y vibración parecidos a la referencia.' },
  fc: {
    label: 'Cambio de ritmo · sin falla mecánica',
    short: 'Cambio de ritmo',
    color: 'var(--brand)',
    bg: 'var(--brand-softer)',
    icon: '♥',
    text: 'Cambió el ritmo del corazón, pero la válvula sigue moviéndose igual: no se marca como falla.',
  },
  leve: { label: 'Diferencia leve', short: 'Diferencia leve', color: 'var(--warn)', bg: 'var(--warn-soft)', icon: '△', text: 'La vibración se aparta un poco del patrón de referencia.' },
  importante: { label: 'Diferencia importante', short: 'Diferencia importante', color: 'var(--crit)', bg: 'var(--crit-soft)', icon: '!', text: 'La vibración se aparta claramente del patrón de referencia.' },
};
