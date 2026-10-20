import type { CSSProperties, ReactNode } from 'react';
import { GraphExplanation } from '../../components/explain/GraphExplanation';
import { DataBadge, type DataKind } from '../../components/layout/ControlBar';
import type { Explanation, ExplainId } from '../../content/explanations';

interface ScreenProps {
  num?: number;
  kicker: string;
  title: ReactNode;
  /** una sola frase de apoyo (≤ 20 palabras) */
  lead?: ReactNode;
  /** estado de lo que se muestra: implementado, simulado, propuesto, visión futura */
  states?: DataKind[];
  /** botones «ⓘ» de la pantalla */
  actions?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}

/** Pantalla de la presentación: título corto, una frase, estado y un elemento protagonista. */
export function Screen({ num, kicker, title, lead, states, actions, children, style }: ScreenProps) {
  return (
    <div className="v-slide v-screen" style={style}>
      <header className="v-screen-head">
        <div className="v-head-left">
          {num !== undefined && <div className="v-badge">{String(num).padStart(2, '0')}</div>}
          <div>
            <div className="v-kicker">{kicker}</div>
            <h2 className="v-h2">{title}</h2>
            {lead && <p className="v-lead">{lead}</p>}
          </div>
        </div>
        <div className="v-screen-meta">
          {states && (
            <div className="v-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
              {states.map((k) => (
                <DataBadge key={k} kind={k} />
              ))}
            </div>
          )}
          {actions && <div className="v-row" style={{ gap: 8, justifyContent: 'flex-end' }}>{actions}</div>}
        </div>
      </header>
      <div className="v-body">{children}</div>
    </div>
  );
}

/** Botón «ⓘ» con explicación sencilla y técnica (mismo componente que el laboratorio). */
export function Explain({ label, id, content }: { label: string; id?: ExplainId; content?: Explanation }) {
  return <GraphExplanation id={id} content={content} label={label} />;
}
