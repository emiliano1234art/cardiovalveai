import { fmt } from '../../lib/format';

interface Item {
  name?: string | number;
  value?: unknown;
  color?: string;
  dataKey?: string | number | ((o: unknown) => unknown);
  payload?: Record<string, unknown>;
}

interface Props {
  active?: boolean;
  payload?: readonly Item[];
  label?: string | number;
  labelFormatter?: (l: number | string) => string;
  decimals?: number;
  units?: Record<string, string>;
}

/** Tooltip uniforme para todos los gráficos. */
export function ChartTooltip({ active, payload, label, labelFormatter, decimals = 2, units = {} }: Props) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="tooltip">
      <div className="tooltip-title">{labelFormatter ? labelFormatter(label ?? '') : label}</div>
      {payload.map((p, i) => (
        <div className="tooltip-row" key={i}>
          <span className="tooltip-key">
            <i style={{ background: p.color }} />
            {p.name}
          </span>
          <b>
            {typeof p.value === 'number' ? fmt(p.value, decimals) : String(p.value)}
            {units[String(p.dataKey)] ? ` ${units[String(p.dataKey)]}` : ''}
          </b>
        </div>
      ))}
    </div>
  );
}
