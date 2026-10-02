import { DEFAULT_BPM } from '../config/modes';
import { ValveSignalSynth } from '../simulation/ValveSignalSynth';
import type { CycleFeatures } from '../types/valvesense';
import { BaselineModel } from './BaselineModel';
import { CycleAnalyzer } from './CycleAnalyzer';

/**
 * Calibración de la línea basal en simulación: corre el sintetizador en modo
 * NORMAL, descarta los primeros ciclos (transitorio) y promedia N ciclos.
 */
export function calibrateSimulatedBaseline(cycles = 40, bpm = DEFAULT_BPM, seed = 1234): BaselineModel {
  const synth = new ValveSignalSynth(seed);
  synth.setMode('normal');
  synth.setBpm(bpm);
  const analyzer = new CycleAnalyzer();
  const feats: CycleFeatures[] = [];
  while (feats.length < cycles + 2) feats.push(...analyzer.push(synth.generate(250)));
  return BaselineModel.fromCycles(feats.slice(2), 'simulated');
}
