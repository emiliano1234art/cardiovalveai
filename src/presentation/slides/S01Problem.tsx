import { useEffect, useRef } from 'react';
import { EXPLAIN } from '../../content/explanations';
import { useDeck } from '../components/deck';
import { LiveSignals } from '../components/LiveSignals';
import { Explain, Screen } from '../components/screen';
import { StaticSignals } from '../components/StaticSignals';
import { ValveSVG } from '../components/ValveSVG';
import { rPeak, rrOf } from '../sim/model';
import { sim, useSim } from '../sim/store';

/** Corazón que late con el ECG simulado. */
function Heart() {
  const ref = useRef<SVGGElement>(null);
  useEffect(
    () =>
      sim.onFrame((t) => {
        const p = sim.state.params;
        let b = Math.floor(t / rrOf(p)) + 1;
        while (rPeak(b, p) > t) b--;
        const dt = t - rPeak(b, p);
        const k = 1 + 0.08 * Math.exp(-((dt - 0.05) ** 2) / 0.002);
        ref.current?.setAttribute('transform', `translate(110 105) scale(${k.toFixed(3)}) translate(-110 -105)`);
      }),
    [],
  );
  return (
    <svg width={220} height={210} viewBox="0 0 220 210" aria-label="Corazón">
      <g ref={ref}>
        <path d="M110 190 C40 140 12 100 22 62 C32 26 78 18 110 52 C142 18 188 26 198 62 C208 100 180 140 110 190Z" fill="#fde2e4" stroke="#e11d48" strokeWidth={4} />
        <path d="M70 108h22l8-22 12 40 9-26 6 8h24" fill="none" stroke="#e11d48" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

const Arrow = () => (
  <svg width={70} height={30} viewBox="0 0 70 30" aria-hidden>
    <path d="M4 15h56" stroke="var(--cyan)" strokeWidth={3} strokeDasharray="7 6" className="v-anim-optional" style={{ animation: 'v-flow 1s linear infinite' }} />
    <path d="M52 6l12 9-12 9" fill="none" stroke="var(--cyan)" strokeWidth={3} strokeLinecap="round" />
  </svg>
);

export function S01Problem() {
  const { print } = useDeck();
  const { params } = useSim();
  return (
    <Screen
      num={1}
      kicker="El problema"
      title="¿Cuál es el problema?"
      lead="Las prótesis valvulares necesitan seguimiento con varias evaluaciones. Exploramos señales complementarias de su funcionamiento."
      actions={<Explain label="¿Por qué importa?" content={EXPLAIN.p_problem} />}
    >
      <div className="v-col" style={{ gap: 34, height: '100%', justifyContent: 'center' }}>
        <div className="v-problem-row">
          <figure className="v-problem-item">
            <Heart />
            <figcaption>Corazón</figcaption>
          </figure>
          <Arrow />
          <figure className="v-problem-item">
            <div className="v-problem-valve">
              <ValveSVG view="top" size={200} tissue angles={print ? [80, 80, 80] : undefined} />
            </div>
            <figcaption>Válvula aórtica</figcaption>
          </figure>
          <Arrow />
          <figure className="v-problem-item">
            <div className="v-problem-signal">{print ? <StaticSignals params={params} width={360} height={190} lanes={['vib', 'snd']} /> : <LiveSignals width={360} height={190} windowS={2} lanes={['vib', 'snd']} />}</div>
            <figcaption>Vibración y sonido</figcaption>
          </figure>
        </div>
        <div className="v-question">
          <span className="v-question-mark">?</span>
          <p>
            ¿Y si pudiéramos analizar cómo funciona una válvula a partir de sus <b>sonidos</b> y <b>vibraciones</b>?
          </p>
        </div>
      </div>
    </Screen>
  );
}
