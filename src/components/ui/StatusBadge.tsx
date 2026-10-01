import type { DeviationLevel } from '../../types/valvesense';

export const LEVEL_LABEL: Record<DeviationLevel, string> = {
  normal: 'NORMAL',
  mild: 'DESVIACIÓN LEVE',
  major: 'DESVIACIÓN IMPORTANTE',
};

export const LEVEL_COLOR: Record<DeviationLevel, string> = {
  normal: 'var(--ok)',
  mild: 'var(--warn)',
  major: 'var(--crit)',
};

/** Icono + texto: el estado nunca se comunica sólo con color. */
export function LevelIcon({ level, size = 14 }: { level: DeviationLevel; size?: number }) {
  if (level === 'normal')
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity=".15" />
        <path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (level === 'mild')
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <path d="M8 1.6l6.6 12H1.4z" fill="currentColor" opacity=".15" />
        <path d="M8 6v3.6M8 11.6v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="currentColor" opacity=".15" />
      <path d="M8 4.6v4.4M8 11.4v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function StatusBadge({ level, large }: { level: DeviationLevel; large?: boolean }) {
  return (
    <span className={`status ${level}${large ? ' lg' : ''}`} role="status">
      <LevelIcon level={level} size={large ? 16 : 14} />
      {LEVEL_LABEL[level]}
    </span>
  );
}
