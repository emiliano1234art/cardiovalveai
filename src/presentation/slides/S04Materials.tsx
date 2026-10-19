import { useState } from 'react';
import { Cite, SlideHead, useDeck } from '../components/deck';
import { TrivalveSVG } from '../components/TrivalveSVG';
import { COMPONENTS, type ComponentId } from '../three/components';
import { ValveScene } from '../three/ValveScene';

const STATUS_TAG = { definido: 'now', propuesta: 'future', 'por definir': 'pending' } as const;

export function S04Materials() {
  const { print, active } = useDeck();
  const [sel, setSel] = useState<ComponentId | null>('valve');
  const [exploded, setExploded] = useState(true);
  const c = COMPONENTS.find((x) => x.id === sel);

  if (print) {
    return (
      <div className="v-slide">
        <SlideHead num={4} kicker="Materiales e insumos" title="Componentes del prototipo" />
        <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
          <table className="v-table" style={{ fontSize: 13.5, lineHeight: 1.3 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Componente</th>
                <th>Función</th>
                <th>Ubicación</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {COMPONENTS.map((x) => (
                <tr key={x.id}>
                  <td>{x.num}</td>
                  <td style={{ fontWeight: 700 }}>{x.name}</td>
                  <td>
                    {x.role} <span className="v-tiny">{x.spec}</span>
                    {x.refId && <Cite ids={[x.refId]} />}
                  </td>
                  <td>{x.location}</td>
                  <td>{x.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="v-col" style={{ alignItems: 'center' }}>
            <TrivalveSVG view="iso" angles={[55, 55, 55]} size={280} />
            <div className="v-tiny" style={{ textAlign: 'center' }}>
              Anillo y tres valvas (modelo conceptual). Precios no incluidos.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v-slide">
      <SlideHead
        num={4}
        kicker="Materiales e insumos"
        title="Componentes del prototipo"
        right={
          <div className="v-row" style={{ gap: 10 }}>
            <span className="v-tag now">Definido</span>
            <span className="v-tag future">Propuesta</span>
            <span className="v-tag pending">Por definir</span>
          </div>
        }
      />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '860px 1fr', gap: 24 }}>
        <div className="v-viewer">
          {active && <ValveScene variant="full" view="iso" exploded={exploded} selected={sel} onSelect={setSel} />}
          <div className="v-viewer-tools">
            <div className="v-seg">
              <button className={!exploded ? 'active' : ''} onClick={() => setExploded(false)}>
                Ensamblado
              </button>
              <button className={exploded ? 'active' : ''} onClick={() => setExploded(true)}>
                Despiece
              </button>
            </div>
          </div>
          <div className="v-viewer-foot">
            <span className="v-hint">Arrastrar para rotar · clic para seleccionar</span>
            <span className="v-hint">Representación conceptual · no a escala de fabricación</span>
          </div>
        </div>

        <div className="v-col" style={{ gap: 14, minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {COMPONENTS.map((x) => (
              <button
                key={x.id}
                onClick={() => setSel(x.id)}
                className={`v-chip${sel === x.id ? ' active' : ''}`}
                style={{ height: 50, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, padding: '0 12px' }}
              >
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', width: 22 }}>{x.num}</span>
                {x.short}
              </button>
            ))}
          </div>
          {c && (
            <div className="v-panel" style={{ flex: 1 }}>
              <div className="v-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 27, fontWeight: 750, color: 'var(--cyan)', lineHeight: 1.15 }}>{c.name}</div>
                <span className={`v-tag ${STATUS_TAG[c.status]}`}>{c.status}</span>
              </div>
              <div className="v-col" style={{ gap: 10, fontSize: 19 }}>
                <div>
                  <span className="v-tiny">FUNCIÓN · </span>
                  {c.role}
                </div>
                <div>
                  <span className="v-tiny">UBICACIÓN · </span>
                  {c.location}
                </div>
                <div className="v-small" style={{ fontSize: 17 }}>
                  <span className="v-tiny">ESPECIFICACIÓN · </span>
                  {c.spec}
                  {c.refId && <Cite ids={[c.refId]} />}
                </div>
              </div>
            </div>
          )}
          <div className="v-tiny">Insumos adicionales: filamento para impresión 3D, cables, protoboard/PCB, adhesivo para el piezo. Precios no incluidos.</div>
        </div>
      </div>
    </div>
  );
}
