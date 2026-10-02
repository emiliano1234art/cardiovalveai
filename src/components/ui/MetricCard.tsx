import type { ReactNode } from 'react';
import { fmt, signed } from '../../lib/format';

interface Props {
  label: string;
  value: number | null | undefined;
  unit?: string;
  decimals?: number;
  /** valor de referencia (línea basal) para mostrar la desviación */
  baseline?: number;
  baselineDecimals?: number;
  /** z-score asociado (marca ⚠ si supera umbral) */
  z?: number;
  foot?: ReactNode;
  accent?: string;
  compact?: boolean;
  icon?: ReactNode;
}

export function MetricCard({ label, value, unit, decimals = 0, baseline, baselineDecimals, z, foot, accent, compact, icon }: Props) {
  const flag = z === undefined ? null : Math.abs(z) >= 4 ? 'crit' : Math.abs(z) >= 2.5 ? 'warn' : null;
  return (
    <div className={`card metric${compact ? ' compact' : ''}`}>
      {accent && <span className="metric-accent" style={{ background: accent }} />}
      <div className="metric-label">
        {icon}
        {label}
      </div>
      <div className="metric-value num">
        {fmt(value, decimals)}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="metric-foot">
        {foot ??
          (baseline !== undefined && value !== null && value !== undefined ? (
            <>
              <span>basal {fmt(baseline, baselineDecimals ?? decimals)}</span>
              <span className="delta">· {signed(value - baseline, decimals)}</span>
            </>
          ) : null)}
        {flag && (
          <span className={`flag ${flag}`} title={`Desviación ${fmt(z, 1)}σ respecto de la línea basal`}>
            ▲ {fmt(Math.abs(z!), 1)}σ
          </span>
        )}
      </div>
    </div>
  );
}
