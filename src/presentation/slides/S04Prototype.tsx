import { useState } from 'react';
import { DRAWING_BEFORE } from '../content';
import { Cite, SimTag, SlideHead, useDeck } from '../components/deck';
import { PhaseReadout } from '../components/SimControls';
import { renderUrl, Visual3D } from '../components/Visual3D';
import type { ViewName } from '../geometry/bileaflet';
import { COMPONENTS } from '../three/components';

const STATUS_TAG = { definido: 'now', propuesta: 'future', 'por definir': 'pending' } as const;

function ActuatorA() {
  return (
    <svg viewBox="0 0 200 90" width="100%" height={90} aria-hidden>
      <rect x="8" y="50" width="34" height="30" rx="4" fill="#1d4ed8" />
      <text x="25" y="70" fontSize="10" fill="#fff" textAnchor="middle">
        servo
      </text>
      <circle cx="56" cy="58" r="8" fill="#e2e8f0" stroke="#64748b" />
      <line x1="62" y1="54" x2="112" y2="30" stroke="#475569" strokeWidth="3" />
      <rect x="110" y="18" width="80" height="10" rx="3" fill="#e2e8f0" stroke="#64748b" />
      <line x1="150" y1="28" x2="132" y2="52" stroke="#0891b2" strokeWidth="4" strokeLinecap="round" />
      <line x1="150" y1="28" x2="168" y2="52" stroke="#0891b2" strokeWidth="4" strokeLinecap="round" />
      <text x="150" y="70" fontSize="10" fill="#334155" textAnchor="middle">
        valvas movidas
      </text>
      <text x="150" y="82" fontSize="10" fill="#334155" textAnchor="middle">
        por bielas
      </text>
    </svg>
  );
}

function ActuatorB() {
  return (
    <svg viewBox="0 0 200 90" width="100%" height={90} aria-hidden>
      <rect x="6" y="34" width="54" height="22" rx="4" fill="#e2e8f0" stroke="#64748b" />
      <rect x="40" y="38" width="6" height="14" fill="#7c3aed" />
      <line x1="46" y1="45" x2="70" y2="45" stroke="#7c3aed" strokeWidth="3" />
      <text x="30" y="72" fontSize="10" fill="#334155" textAnchor="middle">
        jeringa / bomba
      </text>
      <rect x="70" y="20" width="120" height="52" rx="10" fill="rgba(124,58,237,.06)" stroke="#7c3aed" strokeDasharray="5 4" />
      <line x1="120" y1="46" x2="104" y2="30" stroke="#0891b2" strokeWidth="4" strokeLinecap="round" />
      <line x1="140" y1="46" x2="156" y2="30" stroke="#0891b2" strokeWidth="4" strokeLinecap="round" />
      <path d="M130 66 L130 24 m-6 9 l6 -9 l6 9" stroke="#0891b2" strokeWidth="2" fill="none" />
      <text x="130" y="86" fontSize="10" fill="#334155" textAnchor="middle">
        cámara sellada: valvas pasivas
      </text>
    </svg>
  );
}

function Actuation({ compact = false }: { compact?: boolean }) {
  const fs = compact ? 13.5 : 15.5;
  return (
    <div className="v-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div className="v-panel" style={{ padding: '12px 14px', border: '2px solid var(--cyan)' }}>
        <div className="v-row" style={{ justifyContent: 'space-between' }}>
          <b style={{ fontSize: compact ? 16 : 18 }}>A · Servomotor</b>
          <span className="v-tag now">Versión 1</span>
        </div>
        {!compact && <ActuatorA />}
        <ul className="v-list" style={{ fontSize: fs, gap: 3 }}>
          <li>MG90S + leva, corredera o bielas.</li>
          <li>Ciclos repetibles; apertura, cierre y ritmo programables.</li>
          <li>Se sincroniza directo con el pico R del ECG.</li>
          <li>Más fácil de fabricar, programar y controlar.</li>
          {!compact && <li className="v-tiny">Limitación: el movimiento es impuesto y el servo agrega vibración propia.</li>}
        </ul>
      </div>
      <div className="v-panel" style={{ padding: '12px 14px', border: '2px dashed var(--violet)' }}>
        <div className="v-row" style={{ justifyContent: 'space-between' }}>
          <b style={{ fontSize: compact ? 16 : 18 }}>B · Pasiva por presión</b>
          <span className="v-tag future">Evolución</span>
        </div>
        {!compact && <ActuatorB />}
        <ul className="v-list" style={{ fontSize: fs, gap: 3 }}>
          <li>Jeringa, pistón o bomba generan el gradiente; el actuador no toca las valvas.</li>
          <li>Más cercana al principio de funcionamiento real.</li>
          <li>Exige cámara sellada, control de presión y más pruebas.</li>
          <li className="v-tiny">Igual necesita un actuador externo (p. ej., bomba con motor).</li>
        </ul>
      </div>
    </div>
  );
}

function Drawing({ height }: { height: number }) {
  return DRAWING_BEFORE ? (
    <img src={DRAWING_BEFORE} alt="Dibujo inicial a mano del equipo" style={{ width: '100%', height, objectFit: 'contain', borderRadius: 16, background: '#fff' }} />
  ) : (
    <div style={{ height, borderRadius: 16, border: '2px dashed var(--pending)', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20, color: 'var(--pending)', background: 'var(--pending-soft)' }}>
      <div>
        <div style={{ fontSize: 21, fontWeight: 700 }}>[Dibujo inicial a mano — pendiente de incorporar]</div>
        <div className="v-tiny" style={{ marginTop: 8 }}>
          Agregar la imagen en <span className="v-mono">public/</span> y su ruta en <span className="v-mono">content.ts → DRAWING_BEFORE</span>.
        </div>
      </div>
    </div>
  );
}

export function S04Prototype() {
  const { print } = useDeck();
  const [tab, setTab] = useState<'comp' | 'before' | 'act'>('comp');
  const [sel, setSel] = useState<string | null>('piezo');
  const [view, setView] = useState<ViewName>('iso');
  const [nonce, setNonce] = useState(0);
  const [exploded, setExploded] = useState(false);
  const [xray, setXray] = useState(true);
  const c = COMPONENTS.find((x) => x.id === sel);

  if (print) {
    return (
      <div className="v-slide">
        <SlideHead num={4} kicker="Prototipo con sensores integrados · materiales" title="Modelo universitario (Ø 7–10 cm)" right={<span className="v-tag future">Representación 3D conceptual</span>} />
        <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '560px 1fr', gap: 18 }}>
          <div className="v-col" style={{ gap: 8 }}>
            <div className="v-viewer" style={{ height: 330 }}>
              <img src={renderUrl('university-xray')} alt="Modelo universitario con vista interna" style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="v-viewer" style={{ height: 170 }}>
                <img src={renderUrl('university-exploded')} alt="Vista explotada" style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative' }} />
              </div>
              <Drawing height={170} />
            </div>
          </div>
          <div className="v-col" style={{ gap: 10 }}>
            <table className="v-table" style={{ fontSize: 11.5, lineHeight: 1.2 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Componente</th>
                  <th>Función y ubicación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {COMPONENTS.map((x) => (
                  <tr key={x.id}>
                    <td>{x.num}</td>
                    <td style={{ fontWeight: 700 }}>{x.name}</td>
                    <td>
                      {x.role} <span className="v-tiny">{x.location}</span>
                    </td>
                    <td>{x.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Actuation compact />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead
        num={4}
        kicker="Prototipo con sensores integrados · materiales"
        title="Modelo universitario (Ø 7–10 cm)"
        right={
          <div className="v-seg">
            {(
              [
                ['comp', 'Componentes'],
                ['before', 'Antes: dibujo'],
                ['act', 'Accionamiento A / B'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
        }
      />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '840px 1fr', gap: 22, minHeight: 0 }}>
        <div className="v-viewer">
          <Visual3D kind="university" render="university-xray" alt="Modelo universitario" camera={view} cameraNonce={nonce} exploded={exploded} xray={xray} selected={sel} onSelect={setSel} />
          <div className="v-viewer-tools">
            <div className="v-seg">
              {(
                [
                  ['top', 'Superior'],
                  ['side', 'Frontal'],
                  ['iso', 'Isométrica'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  className={view === v ? 'active' : ''}
                  onClick={() => {
                    setView(v);
                    setNonce((n) => n + 1);
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="v-row" style={{ gap: 8 }}>
              <button className="v-btn sm" aria-pressed={xray} onClick={() => setXray((x) => !x)}>
                Vista interna
              </button>
              <button className="v-btn sm" aria-pressed={exploded} onClick={() => setExploded((e) => !e)}>
                {exploded ? 'Ensamblar' : 'Despiece'}
              </button>
            </div>
          </div>
          <div className="v-viewer-foot">
            <PhaseReadout showAngles={false} />
            <SimTag label="Representación conceptual" />
          </div>
        </div>

        <div className="v-col" style={{ gap: 12, minHeight: 0 }}>
          {tab === 'comp' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {COMPONENTS.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setSel(x.id)}
                    className={`v-chip${sel === x.id ? ' active' : ''}`}
                    style={{ height: 44, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, fontSize: 15.5, padding: '0 12px' }}
                  >
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', width: 22 }}>{x.num}</span>
                    {x.short}
                  </button>
                ))}
              </div>
              {c && (
                <div className="v-panel" style={{ flex: 1, padding: '16px 20px' }}>
                  <div className="v-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 23, fontWeight: 750, color: 'var(--cyan)', lineHeight: 1.15 }}>{c.name}</div>
                    <span className={`v-tag ${STATUS_TAG[c.status]}`}>{c.status}</span>
                  </div>
                  <div className="v-col" style={{ gap: 8, fontSize: 17 }}>
                    <div>
                      <span className="v-tiny">FUNCIÓN · </span>
                      {c.role}
                    </div>
                    <div>
                      <span className="v-tiny">UBICACIÓN · </span>
                      {c.location}
                    </div>
                    <div className="v-small" style={{ fontSize: 15.5 }}>
                      <span className="v-tiny">ESPECIFICACIÓN · </span>
                      {c.spec}
                      {c.refId && <Cite ids={[c.refId]} />}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {tab === 'before' && (
            <>
              <div className="v-panel-title" style={{ margin: 0 }}>
                Antes · dibujo inicial a mano
              </div>
              <Drawing height={420} />
              <div className="v-tiny">Después: el modelo 3D de la izquierda (representación conceptual generada desde la geometría del proyecto).</div>
            </>
          )}
          {tab === 'act' && (
            <>
              <Actuation />
              <div className="v-key" style={{ fontSize: 17, padding: '12px 16px' }}>
                Recomendación: <b>A (servomotor)</b> como primera versión experimental; <b>B (presión)</b> como evolución, cuando la versión A esté caracterizada.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
