import type { ReactNode } from 'react';

interface Props {
  index: string;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}

export function Section({ index, title, subtitle, aside, children, id }: Props) {
  return (
    <section className="section" id={id ?? `sec-${index}`}>
      <div className="section-head">
        <div>
          <div className="section-eyebrow">{index}</div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>
        {aside && <div className="section-aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
