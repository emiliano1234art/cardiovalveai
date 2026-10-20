export interface LegendItem {
  key: string;
  label: string;
  color: string;
  /** forma de la muestra */
  type?: 'line' | 'dash' | 'band' | 'dot' | 'tick';
  /** si se puede ocultar con un clic (por defecto sí) */
  toggle?: boolean;
}

interface Props {
  items: LegendItem[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
}

/** Leyenda sencilla: cada elemento muestra u oculta su capa del gráfico. */
export function InteractiveChartLegend({ items, hidden, onToggle }: Props) {
  return (
    <div className="ilegend" role="group" aria-label="Leyenda: toca para mostrar u ocultar">
      {items.map((it) => {
        const off = hidden.has(it.key);
        const sw = (
          <i
            className={`ilegend-sw ${it.type ?? 'line'}`}
            style={{ ['--c' as string]: it.color }}
            aria-hidden
          />
        );
        if (it.toggle === false)
          return (
            <span key={it.key} className="ilegend-item static">
              {sw}
              {it.label}
            </span>
          );
        return (
          <button key={it.key} type="button" className={`ilegend-item${off ? ' off' : ''}`} aria-pressed={!off} onClick={() => onToggle(it.key)} title={off ? 'Mostrar' : 'Ocultar'}>
            {sw}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** Estado de capas ocultas para una leyenda interactiva. */
export function toggleIn(set: Set<string>, key: string) {
  const n = new Set(set);
  if (n.has(key)) n.delete(key);
  else n.add(key);
  return n;
}
