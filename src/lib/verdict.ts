import type { Verdict } from '../types/valvesense';

/** Veredicto experimental en lenguaje sencillo (nunca un diagnóstico). */
export const VERDICT: Record<Verdict, { label: string; short: string; color: string; bg: string; icon: string; text: string }> = {
  basal: { label: 'Patrón similar', short: 'Patrón similar', color: 'var(--ok)', bg: 'var(--ok-soft)', icon: '✓', text: 'Ritmo y vibración parecidos a la referencia.' },
  fc: {
    label: 'Cambio de ritmo · patrón similar',
    short: 'Cambio de ritmo',
    color: 'var(--brand)',
    bg: 'var(--brand-softer)',
    icon: '♥',
    text: 'Cambió el ritmo del corazón, pero la válvula sigue moviéndose igual: no se marca como falla.',
  },
  leve: { label: 'Cambio detectado', short: 'Cambio detectado', color: 'var(--warn)', bg: 'var(--warn-soft)', icon: '△', text: 'La vibración se aparta un poco del patrón de referencia.' },
  importante: { label: 'Desviación experimental', short: 'Desviación experimental', color: 'var(--crit)', bg: 'var(--crit-soft)', icon: '!', text: 'La vibración se aparta claramente del patrón de referencia.' },
};
