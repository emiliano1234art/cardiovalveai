import { useCallback } from 'react';
import { BrandMark } from '../../components/shared/Brand';
import { META } from '../content';
import { useDeck } from '../components/deck';
import { Visual3D } from '../components/Visual3D';
import { sim } from '../sim/store';

export function Cover() {
  const { goTo } = useDeck();
  // ciclo lento (≈ 1/3 de la velocidad real) para la portada
  const slow = useCallback(() => sim.t * 0.33, []);
  return (
    <div className="v-slide v-cover">
      <div className="v-cover-text">
        <div className="v-row" style={{ gap: 14 }}>
          <BrandMark size={52} />
          <div className="v-kicker" style={{ margin: 0 }}>
            {META.institution} · {META.date}
          </div>
        </div>
        <h1 className="v-cover-title">
          CARDIOVAL <span>AI</span>
        </h1>
        <p className="v-cover-sub">{META.subtitle}</p>
        <div className="v-cover-careers">
          <span>{META.careers[0]}</span>
          <i>×</i>
          <span>{META.careers[1]}</span>
        </div>
        <button className="v-btn primary v-btn-lg" style={{ marginTop: 30, alignSelf: 'flex-start' }} onClick={() => goTo('que-es')}>
          Comenzar presentación →
        </button>
        <div className="v-cover-meta">
          <div className="v-cover-members">
            {META.members.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            Profesor asesor: <b>{META.advisor}</b> · {META.faculties}
          </div>
        </div>
      </div>
      <div className="v-cover-visual">
        <div className="v-viewer v-viewer-hero" style={{ height: '100%' }}>
          <Visual3D kind="aortic" render="aortic-iso" alt="Válvula aórtica trivalva" camera="iso" showLabels={false} autoRotate clock={slow} />
          <div className="v-viewer-foot">
            <span className="v-hint">Válvula aórtica · tres valvas · modelo 3D interactivo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
