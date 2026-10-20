import { useState } from 'react';
import { HOTSPOT_STATUS, type HotspotInfo } from '../../content/hotspots';
import { COMPONENTS } from '../../presentation/three/components';
import { IconClose } from '../ui/icons';

/** Tarjeta breve del componente seleccionado en el modelo 3D. */
export function SensorHotspot({ h, onClose, onNext }: { h: HotspotInfo; onClose: () => void; onNext?: () => void }) {
  const [tech, setTech] = useState(false);
  const c = COMPONENTS.find((x) => x.id === h.group);
  const st = HOTSPOT_STATUS[h.status];
  return (
    <div className="hotspot-card" role="dialog" aria-label={h.name} key={h.id}>
      <div className="hotspot-head">
        <span className="hotspot-num">{h.num}</span>
        <h4>{h.name}</h4>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
          <IconClose size={15} />
        </button>
      </div>
      <p>{h.text}</p>
      <span className={`hotspot-status ${st.cls}`}>{st.label}</span>
      {c && (
        <>
          <button type="button" className="explain-tech-btn" onClick={() => setTech((v) => !v)} aria-expanded={tech}>
            {tech ? 'Ocultar ficha técnica ▴' : 'Ver ficha técnica ▾'}
          </button>
          {tech && (
            <div className="explain-tech">
              <p>
                <b>{c.name}.</b> {c.role}
              </p>
              <p>Ubicación: {c.location}</p>
              <p>{c.spec}</p>
            </div>
          )}
        </>
      )}
      {onNext && (
        <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={onNext}>
          Siguiente pieza →
        </button>
      )}
    </div>
  );
}
