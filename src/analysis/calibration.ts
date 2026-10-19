import { DEFAULT_BPM } from '../config/modes';
import { DEFAULT_PARAMS, type SimParams } from '../presentation/sim/model';
import { sim } from '../presentation/sim/store';
import { SyncedSynth } from '../sources/SyncedSimSource';
import type { CycleFeatures } from '../types/valvesense';
import { BaselineModel } from './BaselineModel';
import { CycleAnalyzer } from './CycleAnalyzer';

/**
 * Calibración de la línea basal en simulación: modelo sincronizado con ECG en
 * condición NORMAL, se descartan los primeros ciclos y se promedian N ciclos.
 * La basal usa la misma temporización (τ, D, θ) que la configuración activa.
 * Con el prototipo real, la basal se recaptura con el botón «Recapturar basal».
 */
export function calibrateSimulatedBaseline(
  cycles = 40,
  bpm = DEFAULT_BPM,
  timing: Partial<Pick<SimParams, 'delayMs' | 'openMs' | 'thetaMax'>> = {},
): BaselineModel {
  const saved = sim.state.params;
  sim.setParams({ ...DEFAULT_PARAMS, ...timing, bpm });
  const synth = new SyncedSynth();
  const analyzer = new CycleAnalyzer();
  const feats: CycleFeatures[] = [];
  while (feats.length < cycles + 4) feats.push(...analyzer.push(synth.generate(250)));
  sim.setParams(saved);
  return BaselineModel.fromCycles(feats.slice(4), 'simulated');
}
