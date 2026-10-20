import type { ReactNode } from 'react';
import type { ExplainId } from '../../content/explanations';
import { fmt, signed } from '../../lib/format';
import { InfoTooltip } from '../explain/GraphExplanation';

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
  /** ⓘ con explicación */
  info?: ExplainId;
}

export function MetricCard({ label, value, unit, decimals = 0, baseline, baselineDecimals, z, foot, accent, compact, icon, info }: Props) {
  const flag = z === undefined ? null : Math.abs(z) >= 4 ? 'crit' : Math.abs(z) >= 2.5 ? 'warn' : null;
  return (
    <div className={`card metric${compact ? ' compact' : ''}`}>
      {accent && <span className="metric-accent" style={{ background: accent }} />}
      <div className="metric-label">
        {icon}
        {label}
        {info && <InfoTooltip id={info} />}
      </div>
      <div className="metric-value num">
        {fmt(value, decimals)}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="metric-foot">
        {foot ??
          (baseline !== undefined && value !== null && value !== undefined ? (
            <>
              <span>ref. {fmt(baseline, baselineDecimals ?? decimals)}</span>
              <span className="delta">· {signed(value - baseline, decimals)}</span>
            </>
          ) : null)}
        {flag && (
          <span className={`flag ${flag}`} title={`Se aparta ${fmt(z, 1)}σ del patrón de referencia`}>
            ▲ {fmt(Math.abs(z!), 1)}σ
          </span>
        )}
      </div>
    </div>
  );
}
