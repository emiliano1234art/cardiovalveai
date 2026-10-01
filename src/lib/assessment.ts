import type { PipelineResult } from '../analysis/ValveAnalysisPipeline';
import type { CycleFeatures } from '../types/valvesense';

/** Devuelve {z, baseline} de un descriptor en la última evaluación. */
export function dev(latest: PipelineResult | null, key: keyof CycleFeatures) {
  const d = latest?.assessment.deviations.find((x) => x.key === key);
  return d ? { z: d.z, baseline: d.baseline } : { z: undefined, baseline: undefined };
}
