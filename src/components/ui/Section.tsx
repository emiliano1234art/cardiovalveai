import type { ReactNode } from 'react';
import { DataBadge, type DataKind } from '../layout/ControlBar';

interface Props {
  index: string;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
  /** tipo de dato que muestra la sección */
  kinds?: DataKind[];
}

export function Section({ index, title, subtitle, aside, children, id, kinds }: Props) {
  return (
    <section className="section" id={id ?? `sec-${index}`}>
      <div className="section-head">
        <div>
          <div className="section-eyebrow">
            {index}
            {kinds?.map((k) => <DataBadge key={k} kind={k} />)}
          </div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>
        {aside && <div className="section-aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
