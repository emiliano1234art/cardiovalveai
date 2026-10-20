import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EXPLAIN, type Explanation, type ExplainId } from '../../content/explanations';
import { Tex } from '../../presentation/components/Tex';
import { IconClose, IconInfo } from '../ui/icons';

interface Props {
  id?: ExplainId;
  /** contenido propio (en vez de un id del catálogo) */
  content?: Explanation;
  /** solo el ícono ⓘ (para indicadores pequeños) */
  compact?: boolean;
  label?: string;
  /** avisa al gráfico para que resalte lo que se explica */
  onOpenChange?: (open: boolean) => void;
}

const OPEN_EVENT = 'vs-explain-open';
const POP_W = 380;

/**
 * Botón «ⓘ ¿Qué significa?» con una tarjeta emergente de dos niveles:
 * explicación sencilla y, a pedido, explicación técnica.
 * En teléfonos la tarjeta aparece como hoja inferior.
 */
export function GraphExplanation({ id, content, compact = false, label = '¿Qué significa?', onOpenChange }: Props) {
  const e: Explanation = content ?? EXPLAIN[id ?? 'kinds'];
  const uid = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [tech, setTech] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; sheet: boolean } | null>(null);

  const set = useCallback(
    (v: boolean) => {
      setOpen(v);
      if (!v) setTech(false);
      onOpenChange?.(v);
      if (v) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: uid }));
    },
    [onOpenChange, uid],
  );

  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw < 640) return setPos({ left: 0, top: 0, sheet: true });
    const w = Math.min(POP_W, vw - 24);
    const h = pop.current?.offsetHeight ?? 260;
    const left = Math.max(12, Math.min(vw - w - 12, b.right - w));
    const below = b.bottom + 8;
    const top = below + h > vh - 12 && b.top - h - 8 > 12 ? b.top - h - 8 : Math.min(below, Math.max(12, vh - h - 12));
    setPos({ left, top, sheet: false });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, tech, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node;
      if (pop.current?.contains(t) || btn.current?.contains(t)) return;
      set(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        set(false);
        btn.current?.focus();
      }
    };
    const onOther = (ev: Event) => (ev as CustomEvent).detail !== uid && set(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener(OPEN_EVENT, onOther);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener(OPEN_EVENT, onOther);
    };
  }, [open, set, place, uid]);

  useEffect(() => {
    if (open) pop.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`explain-btn${compact ? ' compact' : ''}${open ? ' open' : ''}`}
        onClick={() => set(!open)}
        aria-expanded={open}
        aria-controls={open ? uid : undefined}
        aria-label={compact ? `¿Qué significa? ${e.title}` : undefined}
        title={compact ? '¿Qué significa?' : undefined}
      >
        <IconInfo size={compact ? 15 : 14} />
        {!compact && <span>{label}</span>}
      </button>
      {open &&
        createPortal(
          <>
            {pos?.sheet && <div className="explain-scrim" />}
            <div
              ref={pop}
              id={uid}
              role="dialog"
              aria-label={e.title}
              tabIndex={-1}
              className={`explain-pop${pos?.sheet ? ' sheet' : ''}`}
              style={pos && !pos.sheet ? { left: pos.left, top: pos.top, width: Math.min(POP_W, window.innerWidth - 24) } : pos ? undefined : { visibility: 'hidden' }}
            >
              <div className="explain-head">
                <span className="explain-icon">
                  <IconInfo size={16} />
                </span>
                <h4>{e.title}</h4>
                <button type="button" className="explain-x" onClick={() => set(false)} aria-label="Cerrar">
                  <IconClose size={16} />
                </button>
              </div>
              <p className="explain-simple">{e.simple}</p>
              {e.look && (
                <ul className="explain-look">
                  {e.look.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
              <button type="button" className="explain-tech-btn" onClick={() => setTech((v) => !v)} aria-expanded={tech}>
                {tech ? 'Ocultar explicación técnica ▴' : 'Ver explicación técnica ▾'}
              </button>
              {tech && (
                <div className="explain-tech">
                  {e.tech.map((t) => (
                    <p key={t}>{t}</p>
                  ))}
                  {e.math?.map((m) => (
                    <div key={m} className="explain-math">
                      <Tex display>{m}</Tex>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

/** Variante compacta (solo ⓘ) para indicadores y etiquetas. */
export function InfoTooltip(props: Omit<Props, 'compact'>) {
  return <GraphExplanation {...props} compact />;
}
