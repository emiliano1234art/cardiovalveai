import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { ExperimentalMode } from '../../types/valvesense';
import { IconClose, IconSpark } from '../ui/icons';

interface Step {
  title: string;
  text: string;
  /** elemento a destacar (el primero que exista) */
  targets: string[];
  art: ReactNode;
  action?: { label: string; mode: ExperimentalMode };
}

/* ── ilustraciones animadas (SVG + CSS, sin texto) ── */
const ArtValve = (
  <svg viewBox="0 0 160 100" className="art art-valve" aria-hidden>
    <circle cx="80" cy="50" r="38" fill="#eef7fa" stroke="#0a6f95" strokeWidth="5" />
    <g className="leaf l1">
      <rect x="44" y="45" width="35" height="10" rx="5" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.5" />
    </g>
    <g className="leaf l2">
      <rect x="81" y="45" width="35" height="10" rx="5" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.5" />
    </g>
    <path className="beat" d="M6 88h20l5-10 6 18 5-8h12" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArtVibration = (
  <svg viewBox="0 0 160 100" className="art art-vib" aria-hidden>
    <circle cx="44" cy="46" r="26" fill="none" stroke="#0a6f95" strokeWidth="5" />
    <circle className="ripple r1" cx="44" cy="46" r="30" fill="none" stroke="#2a78d6" strokeWidth="2" />
    <circle className="ripple r2" cx="44" cy="46" r="30" fill="none" stroke="#2a78d6" strokeWidth="2" />
    <rect x="38" y="70" width="12" height="6" rx="2" fill="#e7c27a" />
    <path className="trace" d="M84 50h14l4-26 5 46 5-32 4 18 4-6h28" fill="none" stroke="#2a78d6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArtSound = (
  <svg viewBox="0 0 160 100" className="art art-snd" aria-hidden>
    <rect x="30" y="28" width="22" height="40" rx="11" fill="#e6f6f5" stroke="#0f9895" strokeWidth="3" />
    <path d="M24 56a17 17 0 0 0 34 0M41 73v10" fill="none" stroke="#0f9895" strokeWidth="3" strokeLinecap="round" />
    {[0, 1, 2].map((i) => (
      <path key={i} className={`wave w${i}`} d={`M${74 + i * 18} 30q10 18 0 36`} fill="none" stroke="#0f9895" strokeWidth="3" strokeLinecap="round" />
    ))}
  </svg>
);
const ArtAnalyze = (
  <svg viewBox="0 0 160 100" className="art art-analyze" aria-hidden>
    <path d="M8 50h10l4-22 5 40 5-28 4 14 4-4h10" fill="none" stroke="#2a78d6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M66 50h14" stroke="#7d8da0" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#arr)" />
    <defs>
      <marker id="arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
        <path d="M0 0L10 5L0 10z" fill="#7d8da0" />
      </marker>
    </defs>
    {[22, 40, 30, 52, 18].map((h, i) => (
      <rect key={i} className={`bar b${i}`} x={96 + i * 12} y={80 - h} width="8" height={h} rx="2" fill={i === 3 ? '#0a6f95' : '#78cacd'} />
    ))}
  </svg>
);
const ArtCompare = (
  <svg viewBox="0 0 160 100" className="art art-cmp" aria-hidden>
    <path d="M10 70C40 70 45 25 70 25S110 70 150 70" fill="none" stroke="#8b98a9" strokeWidth="2.5" strokeDasharray="6 5" />
    <path className="cur" d="M10 70C40 70 45 25 70 25S110 70 150 70" fill="none" stroke="#2a78d6" strokeWidth="3" />
    <circle className="flag" cx="128" cy="30" r="11" fill="#fdf3e0" stroke="#b77700" strokeWidth="2" />
    <path className="flag" d="M128 24v7M128 35v.5" stroke="#b77700" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const STEPS: Step[] = [
  {
    title: 'Así funciona nuestra válvula',
    text: 'Una válvula cardíaca es una puerta que deja pasar la sangre en una sola dirección. La nuestra tiene dos hojas (valvas) que un pequeño motor abre y cierra justo después de cada latido.',
    targets: ['learn-valve'],
    art: ArtValve,
  },
  {
    title: 'Así captamos sus vibraciones',
    text: 'Cuando las valvas llegan a su tope y cuando se cierran, el anillo vibra. Un sensor piezoeléctrico convierte esa vibración en electricidad: cada pico del gráfico es uno de esos golpes.',
    targets: ['learn-vibration'],
    art: ArtVibration,
  },
  {
    title: 'Así escuchamos sus sonidos',
    text: 'Un micrófono diminuto (MEMS) escucha los clics de apertura y cierre. En el gráfico, cada clic es una onda corta.',
    targets: ['learn-sound'],
    art: ArtSound,
  },
  {
    title: 'Así analizamos las señales',
    text: 'En cada ciclo medimos la fuerza de la vibración, su energía y el tono del sonido. El mapa de sonidos muestra qué tonos aparecen en cada momento, y los latidos del ECG nos sirven de reloj.',
    targets: ['learn-spectro'],
    art: ArtAnalyze,
  },
  {
    title: 'Así detectamos diferencias experimentales',
    text: 'La IA compara cada ciclo con el patrón de la válvula funcionando normalmente. Si solo cambia el ritmo, lo informa como «cambio de ritmo». Si cambia la vibración, señala una diferencia para investigarla. No diagnostica.',
    targets: ['learn-ai', 'sec-05'],
    art: ArtCompare,
    action: { label: 'Pruébalo: simular apertura restringida', mode: 'restricted' },
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** permite probar una condición desde el recorrido (solo en simulación) */
  onTry?: (m: ExperimentalMode) => void;
}

/** Recorrido guiado de 5 pasos (~1–2 min). Se puede omitir en cualquier momento. */
export function LearnMode({ open, onClose, onTry }: Props) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const close = useCallback(() => {
    setI(0);
    onClose();
  }, [onClose]);

  // destaca y centra la sección del paso actual
  useEffect(() => {
    if (!open) return;
    const el = step.targets.map((id) => document.getElementById(id)).find(Boolean);
    if (!el) return;
    el.classList.add('learn-focus');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return () => el.classList.remove('learn-focus');
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') setI((v) => Math.min(STEPS.length - 1, v + 1));
      else if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="learn" role="dialog" aria-modal="false" aria-label="Aprender cómo funciona">
      <div className="learn-progress" aria-hidden>
        <i style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div className="learn-head">
        <span className="learn-kicker">
          <IconSpark size={14} /> Paso {i + 1} de {STEPS.length}
        </span>
        <button type="button" className="icon-btn" onClick={close} aria-label="Cerrar recorrido">
          <IconClose size={16} />
        </button>
      </div>
      <div className="learn-art" key={i}>
        {step.art}
      </div>
      <h3>{step.title}</h3>
      <p>{step.text}</p>
      {step.action && onTry && (
        <button type="button" className="chip on learn-try" onClick={() => onTry(step.action!.mode)}>
          ▶ {step.action.label}
        </button>
      )}
      <div className="learn-foot">
        <button type="button" className="link-btn" onClick={close}>
          Omitir
        </button>
        <div className="learn-dots" aria-hidden>
          {STEPS.map((_, k) => (
            <i key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {i > 0 && (
            <button type="button" className="btn" onClick={() => setI(i - 1)}>
              Anterior
            </button>
          )}
          <button type="button" className="btn primary" onClick={() => (last ? close() : setI(i + 1))} autoFocus>
            {last ? 'Terminar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
