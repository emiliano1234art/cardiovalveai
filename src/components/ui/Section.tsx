import type { ReactNode } from 'react';
import type { ExplainId } from '../../content/explanations';
import { GraphExplanation } from '../explain/GraphExplanation';
import { DataBadge, type DataKind } from '../layout/ControlBar';

interface Props {
  index: string;
  title: string;
  /** una sola frase: qué hace esta sección */
  subtitle?: string;
  icon?: ReactNode;
  explain?: ExplainId;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
  /** tipo de dato que muestra la sección */
  kinds?: DataKind[];
}

export function Section({ index, title, subtitle, icon, explain, aside, children, id, kinds }: Props) {
  return (
    <section className="section" id={id ?? `sec-${index}`}>
      <div className="section-head">
        <div className="section-title-row">
          {icon && <span className="section-icon">{icon}</span>}
          <div>
            <div className="section-eyebrow">
              <span>{index}</span>
              {kinds?.map((k) => <DataBadge key={k} kind={k} />)}
            </div>
            <h2 className="section-title">{title}</h2>
            {subtitle && <p className="section-sub">{subtitle}</p>}
          </div>
        </div>
        {(aside || explain) && (
          <div className="section-aside">
            {aside}
            {explain && <GraphExplanation id={explain} />}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
