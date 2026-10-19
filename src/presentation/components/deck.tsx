import { createContext, useContext, type ReactNode } from 'react';
import { isPending, refIndex, REFERENCES } from '../content';

export type DeckMode = 'present' | 'explore';

export interface DeckCtx {
  mode: DeckMode;
  print: boolean;
  goTo: (id: string) => void;
  active: boolean;
}

export const Deck = createContext<DeckCtx>({ mode: 'explore', print: false, goTo: () => {}, active: true });
export const useDeck = () => useContext(Deck);

interface HeadProps {
  num?: number;
  kicker: string;
  title: ReactNode;
  lead?: ReactNode;
  right?: ReactNode;
}

/** Encabezado común: número (solo diapositivas de contenido), sección y título. */
export function SlideHead({ num, kicker, title, lead, right }: HeadProps) {
  return (
    <header className="v-head">
      <div className="v-head-left">
        {num !== undefined && <div className="v-badge">{String(num).padStart(2, '0')}</div>}
        <div>
          <div className="v-kicker">{kicker}</div>
          <h2 className="v-h2">{title}</h2>
          {lead && <p className="v-lead">{lead}</p>}
        </div>
      </div>
      {right && <div className="v-row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>{right}</div>}
    </header>
  );
}

/** Cita numerada que lleva a la bibliografía. */
export function Cite({ ids }: { ids: string[] }) {
  const { goTo, print } = useDeck();
  const nums = ids.map(refIndex).filter((n) => n > 0);
  if (!nums.length) return null;
  const label = `[${nums.join(', ')}]`;
  const titles = ids.map((id) => REFERENCES.find((r) => r.id === id)?.text).join('\n');
  if (print) return <span className="v-cite">{label}</span>;
  return (
    <button className="v-cite" title={titles} onClick={() => goTo('biblio')}>
      {label}
    </button>
  );
}

/** Texto que se resalta automáticamente si es un campo pendiente «[...]». */
export function Field({ value, className }: { value: string; className?: string }) {
  return isPending(value) ? <span className={`v-pending-text ${className ?? ''}`}>{value}</span> : <span className={className}>{value}</span>;
}

export function SimTag({ label = 'SIMULACIÓN' }: { label?: string }) {
  return (
    <span className="v-tag sim" title="Datos generados por el modelo; no son mediciones">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M1 6h2l1.5-4 3 8L9 6h2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}
