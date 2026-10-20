import { useEffect, useState, type MouseEvent } from 'react';
import { GraphExplanation } from '../../components/explain/GraphExplanation';
import { useDeck } from '../components/deck';
import { LiveSignals } from '../components/LiveSignals';
import { Screen } from '../components/screen';
import { PhaseReadout } from '../components/SimControls';
import { Spectrogram } from '../components/SoundMap';
import { StaticSignals } from '../components/StaticSignals';
import { ValveSVG } from '../components/ValveSVG';
import { eventsBetween, type MechEvent } from '../sim/model';
import { sim, useSim } from '../sim/store';

const W = 700;
const H = 250;
const WIN = 2;
/** margen izquierdo y derecho del área de trazado en LiveSignals */
const PL = 96;
const PR = 8;

interface Pick {
  x: number;
  title: string;
  text: string;
}

const names = (es: MechEvent[]) => {
  const ids = [...new Set(es.map((e) => e.leaflet + 1))].sort();
  return ids.length === 3 ? 'las tres valvas' : ids.length === 1 ? `la valva ${ids[0]}` : `las valvas ${ids.join(' y ')}`;
};

/** Explicación del punto elegido: el modelo sabe qué evento produjo cada pico. */
function describe(tc: number, lane: 'vib' | 'snd'): Omit<Pick, 'x'> {
  const p = sim.state.params;
  const ev = eventsBetween(tc - 0.12, tc + 0.02, p).filter((e) => tc - e.t >= -0.01 && tc - e.t < 0.09);
  const what = lane === 'vib' ? 'vibración' : 'sonido';
  if (!ev.length) return { title: 'Sin evento', text: `Aquí casi no hay ${what}: las valvas no están golpeando nada.` };
  const near = ev.reduce((m, e) => (Math.abs(tc - e.t) < Math.abs(tc - m.t) ? e : m), ev[0]);
  const group = ev.filter((e) => e.kind === near.kind && Math.abs(e.t - near.t) < 0.008);
  if (near.limiter) return { title: 'Choque contra el tope', text: `La valva ${near.leaflet + 1} golpea el tope que limita su apertura: el ${what} cambia de tono.` };
  if (near.kind === 'close') return { title: `Cierre · ${what}`, text: `Este pico se produce cuando ${names(group)} se juntan en el centro al cerrarse.` };
  return { title: `Apertura · ${what}`, text: `Este pico aparece cuando ${names(group)} llegan a su tope de apertura.` };
}

function SignalPanel({ lane, title, sub, explain }: { lane: 'vib' | 'snd'; title: string; sub: string; explain: 'vibration' | 'sound' }) {
  const { print } = useDeck();
  const { params, playing } = useSim();
  const [pick, setPick] = useState<Pick | null>(null);
  useEffect(() => {
    if (playing) setPick(null);
  }, [playing]);
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    if (x < PL || x > W - PR) return;
    sim.setPlaying(false);
    const tc = sim.t - WIN + ((x - PL) / (W - PL - PR)) * WIN;
    setPick({ x, ...describe(tc, lane) });
  };
  return (
    <div className="v-panel v-sig-panel">
      <div className="v-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div>
          <div className="v-sig-title" style={{ color: lane === 'vib' ? 'var(--sig-vib)' : 'var(--sig-snd)' }}>
            {title}
          </div>
          <div className="v-tiny">{sub}</div>
        </div>
        <GraphExplanation id={explain} />
      </div>
      <div className="v-sig-canvas" onClick={onClick} role="button" tabIndex={0} aria-label={`${title}: toca un pico para saber qué representa`}>
        {print ? <StaticSignals params={params} width={W} height={H} lanes={[lane]} /> : <LiveSignals width={W} height={H} windowS={WIN} lanes={[lane]} />}
        {pick && <div className="v-sig-marker" style={{ left: pick.x }} />}
      </div>
      {pick ? (
        <div className="v-pick">
          <b>{pick.title}</b> — {pick.text}
          <button className="v-btn sm" onClick={() => sim.setPlaying(true)}>
            ▶ Continuar
          </button>
        </div>
      ) : (
        <div className="v-tiny v-pick-hint">Toca un pico para saber qué representa.</div>
      )}
    </div>
  );
}

export function S05Sensors() {
  const { print } = useDeck();
  const { params } = useSim();
  return (
    <Screen
      num={5}
      kicker="Señales"
      title="¿Qué escuchan nuestros sensores?"
      lead="El piezoeléctrico siente las vibraciones y el micrófono escucha los clics de cada apertura y cierre."
      states={['synthetic']}
    >
      <div className="v-col" style={{ gap: 16, height: '100%' }}>
        <div className="v-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <SignalPanel lane="vib" title="Vibraciones — Piezoeléctrico" sub="Sensor integrado en el anillo" explain="vibration" />
          <SignalPanel lane="snd" title="Sonidos — MEMS" sub="Micrófono INMP441 junto a la válvula" explain="sound" />
        </div>
        <div className="v-grid" style={{ gridTemplateColumns: '400px 1fr', gap: 18, flex: 1, minHeight: 0 }}>
          <div className="v-panel" style={{ padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <ValveSVG view="top" size={150} numbers angles={print ? [80, 80, 80] : undefined} />
            <PhaseReadout showAngles={false} />
          </div>
          <div className="v-panel" style={{ padding: '10px 16px' }}>
            <div className="v-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="v-sig-title">Mapa de sonidos</div>
                <div className="v-tiny">Cada clic es una franja vertical</div>
              </div>
              <GraphExplanation id="spectrogram" />
            </div>
            <div style={{ marginTop: 6 }}>
              <Spectrogram p={params} w={960} h={120} />
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
