import { META } from '../content';
import { TrivalveSVG } from '../components/TrivalveSVG';
import { Field, SimTag, useDeck } from '../components/deck';
import { ValveScene } from '../three/ValveScene';

export function Cover() {
  const { print, active } = useDeck();
  return (
    <div className="v-slide" style={{ padding: '64px 80px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 700px', gap: 40, height: '100%', alignItems: 'center' }}>
        <div className="v-col" style={{ gap: 26 }}>
          <div className="v-kicker">{META.course} · Presentación de avance</div>
          <h1 style={{ fontSize: 132, lineHeight: 0.95, margin: 0, fontWeight: 800, letterSpacing: '-0.04em' }}>
            Valve<span style={{ color: 'var(--cyan)' }}>Sense</span>
          </h1>
          <p style={{ fontSize: 31, lineHeight: 1.3, margin: 0, color: 'var(--text-2)', maxWidth: 780 }}>{META.subtitle}</p>
          <div className="v-row" style={{ gap: 12, marginTop: 8 }}>
            <span className="v-tag now" style={{ height: 38, fontSize: 16 }}>
              Equipo {META.team}
            </span>
            {META.careers.map((c) => (
              <span key={c} className="v-tag off" style={{ height: 38, fontSize: 15, textTransform: 'none', letterSpacing: 0 }}>
                {c}
              </span>
            ))}
          </div>
          <div className="v-panel flat" style={{ padding: '18px 22px', maxWidth: 820 }}>
            <div className="v-panel-title" style={{ marginBottom: 8 }}>
              Integrantes
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 28px', fontSize: 20 }}>
              {META.members.map((m, i) => (
                <div key={i} style={{ lineHeight: 1.25 }}>
                  <Field value={m.name} />
                  <div className="v-tiny">{m.career}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="v-small">
            {META.institution} · {META.date}
          </div>
        </div>

        <div style={{ position: 'relative', height: 760 }}>
          <div className="v-viewer" style={{ position: 'absolute', inset: 0, borderRadius: 32 }}>
            {print || !active ? (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                <TrivalveSVG view="iso" angles={[62, 62, 62]} size={560} title="Válvula trivalva (estado representativo: abierta)" />
              </div>
            ) : (
              <ValveScene variant="hero" autoRotate />
            )}
            <div className="v-viewer-foot">
              <span className="v-hint">Modelo trivalvo animado · accionado por servo</span>
              <SimTag />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
