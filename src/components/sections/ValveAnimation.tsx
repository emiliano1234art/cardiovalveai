import { useCallback, useEffect, useRef } from 'react';
import type { EngineSnapshot, ValveSenseEngine } from '../../engine/ValveSenseEngine';
import { openFrac } from '../../presentation/geometry/trileaflet';
import { openingsAt, ValveSVG } from '../../presentation/components/ValveSVG';

const STATE: Record<string, string> = { cerrada: 'Cerrada', apertura: 'Abriendo', abierta: 'Abierta', cierre: 'Cerrando' };

/**
 * Válvula trivalva en vivo: vista desde la aorta y vista lateral. En simulación
 * cada valva sigue al modelo (con su condición); con el ESP32, las tres siguen
 * el ángulo medido del actuador.
 */
export function ValveAnimation({ engine, snap }: { engine: ValveSenseEngine; snap: EngineSnapshot }) {
  const angleText = useRef<HTMLSpanElement>(null);
  const isSim = snap.sourceKind === 'simulation';
  const params = snap.params;
  const pRef = useRef(params);
  pRef.current = params;

  const getOpen = useCallback(() => {
    const t = engine.modelTime();
    if (t !== null) return openingsAt(t, pRef.current);
    const f = openFrac(engine.angleNow());
    return [f, f, f];
  }, [engine]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (angleText.current) angleText.current.textContent = `${engine.angleNow().toFixed(0)}°`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const hl = isSim && snap.mode !== 'normal' && snap.mode !== 'asymmetric' ? params.target : null;
  return (
    <div className="trivalve">
      <div className="trivalve-views">
        <figure>
          <ValveSVG view="top" size={250} getOpen={getOpen} numbers highlight={hl} title="Vista desde la aorta: tres valvas" />
          <figcaption>Vista desde arriba</figcaption>
        </figure>
        <figure>
          <ValveSVG view="side" size={230} getOpen={getOpen} highlight={hl} title="Vista lateral" />
          <figcaption>Vista lateral</figcaption>
        </figure>
      </div>
      <div className="trivalve-readout">
        <span className="pill">
          Ángulo del servo <strong className="num" ref={angleText}>0°</strong>
        </span>
        <span className="pill">
          <span className={`dot ${snap.valvePhase && snap.valvePhase !== 'cerrada' ? 'live' : ''}`} />
          {snap.hasData && snap.valvePhase ? STATE[snap.valvePhase] : '—'}
        </span>
        {hl !== null && <span className="pill warn-pill">Valva {hl + 1} afectada</span>}
      </div>
    </div>
  );
}
