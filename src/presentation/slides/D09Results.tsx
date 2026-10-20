import { DataBadge } from '../../components/layout/ControlBar';
import { EXPECTED, WICKED_QUESTION } from '../content';
import { PX } from '../explain';
import { useDeck } from '../components/deck';
import { Explain, Screen } from '../components/screen';
import { StaticSignals } from '../components/StaticSignals';
import { ValveSVG } from '../components/ValveSVG';
import { DEFAULT_PARAMS } from '../sim/model';

const RESTRICTED = { ...DEFAULT_PARAMS, condition: 'restricted' as const };

function Visual({ id }: { id: string }) {
  if (id === 'proto') return <ValveSVG view="top" size={210} />;
  if (id === 'signals') return <StaticSignals params={DEFAULT_PARAMS} width={320} height={230} />;
  if (id === 'compare') return <StaticSignals params={RESTRICTED} compareTo={DEFAULT_PARAMS} width={320} height={230} lanes={['vib']} />;
  return (
    <svg viewBox="0 0 300 170" width={330} height={187} aria-hidden>
      <rect x="6" y="6" width="288" height="158" rx="14" fill="#f8fafc" stroke="#d3dfeb" />
      <rect x="18" y="18" width="120" height="14" rx="5" fill="#bae6fd" />
      <circle cx="62" cy="96" r="34" fill="none" stroke="#0891b2" strokeWidth="5" />
      <path d="M62 96V62M62 96l29 17M62 96l-29 17" stroke="#0369a1" strokeWidth="3" />
      <path d="M118 74h18l6-16 8 30 6-14h14" fill="none" stroke="#e11d48" strokeWidth="2.4" className="v-anim-dash" />
      <path d="M118 112q8-14 16 0t16 0 16 0 16 0 16 0 16 0" fill="none" stroke="#0891b2" strokeWidth="2.4" className="v-anim-dash" />
      <rect x="206" y="44" width="76" height="30" rx="8" fill="#dcfce7" />
      <text x="244" y="64" textAnchor="middle" fontSize="13" fontWeight="700" fill="#15803d">
        Sin cambios
      </text>
      <rect x="206" y="84" width="76" height="30" rx="8" fill="#ffedd5" />
      <text x="244" y="104" textAnchor="middle" fontSize="13" fontWeight="700" fill="#c2410c">
        Cambio
      </text>
    </svg>
  );
}

export function D09Results() {
  const { openDashboard } = useDeck();
  return (
    <Screen
      num={9}
      kicker="Resultados esperados"
      title="Lo que esperamos lograr"
      lead="Metas para la Feria: todavía no son resultados obtenidos."
      states={['proposed']}
      actions={<Explain label="¿Qué significa?" content={PX.results} />}
    >
      <div className="v-col" style={{ gap: 18, height: '100%' }}>
        <div className="v-results">
          {EXPECTED.map((e, i) => (
            <div key={e.id} className="v-panel v-result" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="v-row" style={{ justifyContent: 'space-between' }}>
                <span className="v-result-n">{i + 1}</span>
                <DataBadge kind="proposed" />
              </div>
              <div className="v-result-visual">
                <Visual id={e.id} />
              </div>
              <b>{e.t}</b>
              <span>{e.d}</span>
              {e.id === 'dash' && (
                <button className="v-link" onClick={openDashboard}>
                  Ver dashboard experimental →
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="v-projection">
          <div>
            <b>Proyección interdisciplinaria</b>
            <span>
              Biomedicina valida el registro de señales; Kinesiología define cómo relacionarlas, en investigación futura, con indicadores funcionales de la
              rehabilitación.
            </span>
          </div>
          <div className="v-projection-q">
            <b>Volviendo a la pregunta</b>
            <span>{WICKED_QUESTION}</span>
            <em>
              Estos resultados serían un primer paso: información mecánica y acústica comparable, lista para integrarse con la mirada clínica y funcional.
            </em>
          </div>
        </div>
      </div>
    </Screen>
  );
}
