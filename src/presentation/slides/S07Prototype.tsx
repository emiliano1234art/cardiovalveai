import { useState } from 'react';
import { DRAWING_BEFORE } from '../content';
import { SimTag, SlideHead, useDeck } from '../components/deck';
import { LiveSignals } from '../components/LiveSignals';
import { ConditionChips, ParamSliders, PhaseReadout, PlaybackButtons } from '../components/SimControls';
import { StaticSignals } from '../components/StaticSignals';
import { TrivalveSVG } from '../components/TrivalveSVG';
import { useEsp32 } from '../components/useEsp32';
import type { ViewName } from '../geometry/trivalve';
import { CONDITIONS, DEFAULT_PARAMS } from '../sim/model';
import { useSim } from '../sim/store';
import { ValveScene } from '../three/ValveScene';

const MEASURES = [
  { t: 'Vibración', how: 'Piezoeléctrico → acondicionamiento → ADC del ESP32', color: 'var(--sig-vib)' },
  { t: 'Sonido', how: 'Micrófono MEMS INMP441 → interfaz digital I²S', color: 'var(--sig-snd)' },
  { t: 'Tiempos del ciclo', how: 'Marcas temporales del control: inicio de apertura y de cierre', color: 'var(--amber)' },
  { t: 'Registro', how: 'ESP32 → exportación de datos por ciclo (CSV/JSON)', color: 'var(--teal)' },
];

function DrawingBefore({ height }: { height: number }) {
  return DRAWING_BEFORE ? (
    <img src={DRAWING_BEFORE} alt="Dibujo inicial a mano del equipo" style={{ width: '100%', height, objectFit: 'contain', borderRadius: 18, background: '#fff' }} />
  ) : (
    <div style={{ height, borderRadius: 18, border: '2px dashed var(--pending)', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 30, color: 'var(--pending)' }}>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700 }}>[Dibujo inicial del equipo — pendiente de incorporar]</div>
        <div className="v-small" style={{ marginTop: 10 }}>
          Agregar la foto o escaneo del dibujo a mano en <span className="v-mono">public/</span> y su ruta en <span className="v-mono">content.ts → DRAWING_BEFORE</span>.
        </div>
      </div>
    </div>
  );
}

function MeasureStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {MEASURES.map((m) => (
        <div key={m.t} className="v-panel flat" style={{ padding: compact ? '10px 14px' : '12px 16px', borderTop: `3px solid ${m.color}` }}>
          <div style={{ fontSize: compact ? 17 : 19, fontWeight: 700 }}>{m.t}</div>
          <div className="v-tiny" style={{ fontSize: compact ? 13.5 : 15, lineHeight: 1.3 }}>
            {m.how}
          </div>
        </div>
      ))}
    </div>
  );
}

export function S07Prototype() {
  const { print, active } = useDeck();
  const { params } = useSim();
  const [stage, setStage] = useState<'before' | 'after'>('after');
  const [view, setView] = useState<ViewName>('iso');
  const [nonce, setNonce] = useState(0);
  const [exploded, setExploded] = useState(false);
  const [labels, setLabels] = useState(true);
  const [url, setUrl] = useState('ws://192.168.4.1:81');
  const esp = useEsp32();
  const cond = CONDITIONS.find((c) => c.id === params.condition)!;

  if (print) {
    return (
      <div className="v-slide">
        <SlideHead num={7} kicker="Prototipo · antes y después" title="Del dibujo al prototipo esperado" right={<SimTag />} />
        <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '360px 1fr 560px', gap: 18 }}>
          <div className="v-col" style={{ gap: 8 }}>
            <div className="v-panel-title">Antes · dibujo a mano</div>
            <DrawingBefore height={300} />
          </div>
          <div className="v-col" style={{ gap: 8 }}>
            <div className="v-panel-title">Después · prototipo esperado (representación conceptual)</div>
            <div className="v-row" style={{ gap: 8, justifyContent: 'center' }}>
              <TrivalveSVG view="iso" angles={[80, 80, 80]} size={230} title="Normal: abierta 80°" />
              <TrivalveSVG view="top" angles={[12, 12, 12]} size={200} title="Cierre incompleto" />
              <TrivalveSVG view="iso" angles={[80, 80, 44]} size={230} highlight={2} title="Asimétrico" />
            </div>
            <div className="v-tiny" style={{ textAlign: 'center' }}>
              Normal (abierta 80°) · cierre incompleto (12° residuales, vista superior) · asimétrico (valva 3 al 55 %)
            </div>
          </div>
          <div className="v-col" style={{ gap: 4 }}>
            <div className="v-panel-title">Señales simuladas · 1 ciclo · condición normal, 60 cpm</div>
            <StaticSignals params={DEFAULT_PARAMS} width={560} height={300} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <MeasureStrip compact />
        </div>
        <div className="v-tiny" style={{ marginTop: 10 }}>
          Condiciones: 1 normal · 2 apertura limitada a 60° · 3 limitada a 45° · 4 cierre incompleto · 5 movimiento asimétrico. Las líneas discontinuas marcan eventos de apertura
          (gris) y cierre (ámbar). Ángulo del servo ≠ ángulo de las valvas: su relación depende del mecanismo y requiere calibración.
        </div>
      </div>
    );
  }

  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead
        num={7}
        kicker="Prototipo · antes y después"
        title="Del dibujo al prototipo esperado"
        right={
          <>
            <div className="v-seg">
              <button className={stage === 'before' ? 'active' : ''} onClick={() => setStage('before')}>
                Antes · dibujo
              </button>
              <button className={stage === 'after' ? 'active' : ''} onClick={() => setStage('after')}>
                Después · prototipo
              </button>
            </div>
            <SimTag />
          </>
        }
      />

      {stage === 'before' ? (
        <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="v-col" style={{ gap: 10 }}>
            <div className="v-panel-title">Antes · dibujo inicial a mano</div>
            <DrawingBefore height={600} />
          </div>
          <div className="v-col" style={{ gap: 10 }}>
            <div className="v-panel-title">Después · prototipo esperado</div>
            <div className="v-viewer" style={{ height: 600, display: 'grid', placeItems: 'center' }}>
              <TrivalveSVG view="iso" size={520} title="Prototipo esperado (animado)" />
              <div className="v-viewer-foot">
                <span className="v-hint">Representación conceptual generada a partir del modelo cinemático</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '820px 1fr', gap: 22, minHeight: 0 }}>
          <div className="v-col" style={{ gap: 12, minHeight: 0 }}>
            <div className="v-viewer" style={{ flex: 1, minHeight: 0 }}>
              {active && <ValveScene variant="full" view={view} viewNonce={nonce} exploded={exploded} showLabels={labels} />}
              <div className="v-viewer-tools">
                <div className="v-seg">
                  {(
                    [
                      ['top', 'Superior'],
                      ['side', 'Lateral'],
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
                  <button className="v-btn sm" aria-pressed={exploded} onClick={() => setExploded((e) => !e)}>
                    {exploded ? 'Ensamblar' : 'Despiece'}
                  </button>
                  <button className="v-btn sm v-explore-only" aria-pressed={labels} onClick={() => setLabels((l) => !l)}>
                    Etiquetas
                  </button>
                </div>
              </div>
              <div className="v-viewer-foot">
                <PhaseReadout />
                <span className="v-hint">Arrastrar: rotar · rueda: zoom</span>
              </div>
            </div>
            <MeasureStrip />
          </div>

          <div className="v-col" style={{ gap: 14, minHeight: 0 }}>
            <div className="v-panel" style={{ padding: '14px 18px' }}>
              <div className="v-panel-title" style={{ marginBottom: 8 }}>
                Condición
              </div>
              <ConditionChips compact />
              <div className="v-small" style={{ marginTop: 8, fontSize: 16, minHeight: 44 }}>
                <span className={params.condition === 'normal' ? 'v-cyan' : 'v-coral'} style={{ fontWeight: 700 }}>
                  {cond.label}.
                </span>{' '}
                {cond.detail}
              </div>
            </div>
            <div className="v-panel" style={{ padding: '14px 18px' }}>
              <PlaybackButtons />
              <div className="v-explore-only" style={{ marginTop: 10 }}>
                <ParamSliders />
              </div>
            </div>
            <div className="v-panel" style={{ padding: '10px 14px 6px' }}>
              <div className="v-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <div className="v-panel-title" style={{ margin: 0 }}>
                  Vibración y sonido sincronizados
                </div>
                <div className="v-legend" style={{ fontSize: 13 }}>
                  <span>
                    <i style={{ background: 'var(--amber)' }} />
                    cierre
                  </span>
                  <span>
                    <i style={{ background: 'var(--muted)' }} />
                    apertura
                  </span>
                </div>
              </div>
              <LiveSignals width={582} height={196} real={esp.real} />
            </div>
            <div className="v-row" style={{ gap: 10 }}>
              {esp.status === 'connected' ? (
                <span className="v-tag done">Prototipo conectado · {esp.chunks} bloques</span>
              ) : esp.status === 'connecting' ? (
                <span className="v-tag sim">Conectando…</span>
              ) : (
                <span className="v-tag off">Sin conexión al prototipo</span>
              )}
              <span className="v-explore-only v-row" style={{ gap: 8 }}>
                <input className="v-input" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="URL WebSocket del ESP32" style={{ width: 210 }} />
                {esp.status === 'connected' || esp.status === 'connecting' ? (
                  <button className="v-btn sm" onClick={esp.disconnect}>
                    Desconectar
                  </button>
                ) : (
                  <button className="v-btn sm" onClick={() => esp.connect(url)}>
                    Conectar
                  </button>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
