import { KEY_IDEA, META } from '../content';
import { Field, SimTag } from '../components/deck';
import { Visual3D } from '../components/Visual3D';

export function Cover() {
  return (
    <div className="v-slide" style={{ padding: '60px 76px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 720px', gap: 36, height: '100%', alignItems: 'center' }}>
        <div className="v-col" style={{ gap: 22 }}>
          <div className="v-kicker">{META.course} · Presentación de avance</div>
          <h1 style={{ fontSize: 128, lineHeight: 0.95, margin: 0, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text)' }}>
            Valve<span style={{ color: 'var(--cyan)' }}>Sense</span>
          </h1>
          <p style={{ fontSize: 27, lineHeight: 1.3, margin: 0, color: 'var(--text-2)', maxWidth: 760 }}>{META.subtitle}</p>
          <div className="v-key" style={{ fontSize: 18.5, maxWidth: 780, padding: '14px 20px' }}>
            {KEY_IDEA}
          </div>
          <div className="v-row" style={{ gap: 10 }}>
            <span className="v-tag now" style={{ height: 34, fontSize: 15 }}>
              Equipo {META.team}
            </span>
            {META.careers.map((c) => (
              <span key={c} className="v-tag off" style={{ height: 34, fontSize: 14.5, textTransform: 'none', letterSpacing: 0 }}>
                {c}
              </span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 28px', fontSize: 18, maxWidth: 780 }}>
            {META.members.map((m, i) => (
              <div key={i} style={{ lineHeight: 1.2 }}>
                <Field value={m.name} />
                <div className="v-tiny">{m.career}</div>
              </div>
            ))}
          </div>
          <div className="v-small">
            {META.institution} · {META.date}
          </div>
        </div>
        <div className="v-viewer" style={{ height: 760, borderRadius: 32 }}>
          <Visual3D kind="university" render="university-hero" alt="Modelo universitario ValveSense con sensores integrados" camera="hero" autoRotate showLabels={false} xray={false} />
          <div className="v-viewer-foot">
            <span className="v-hint">Modelo universitario bileaflet · piezo y MEMS integrados</span>
            <SimTag label="Simulación" />
          </div>
        </div>
      </div>
    </div>
  );
}
