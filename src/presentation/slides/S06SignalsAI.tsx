import { useEffect, useMemo, useRef } from 'react';
import { powerSpectrum } from '../../analysis/dsp';
import { SimTag, SlideHead } from '../components/deck';
import { Plot, pathFrom } from '../components/Plot';
import { StaticSignals } from '../components/StaticSignals';
import { assess, BASELINE_PARAMS, eventSpectrum, type Verdict } from '../sim/analysis';
import { rPeak, sampleSignals, type Condition, type SimParams } from '../sim/model';
import { sim, useSim } from '../sim/store';

const SCENARIOS: { id: string; label: string; cond: Condition; bpm: number }[] = [
  { id: 'normal', label: 'Normal', cond: 'normal', bpm: 72 },
  { id: 'restricted', label: 'Apertura restringida', cond: 'restricted', bpm: 72 },
  { id: 'incomplete', label: 'Cierre incompleto', cond: 'incomplete', bpm: 72 },
  { id: 'irregular', label: 'Movimiento irregular', cond: 'irregular', bpm: 72 },
  { id: 'hr', label: 'Variación de FC (ejercicio · 110 lpm)', cond: 'normal', bpm: 110 },
];

export const VERDICT: Record<Verdict, { label: string; color: string; bg: string; icon: string }> = {
  basal: { label: 'Dentro de la línea basal', color: 'var(--green)', bg: '#f0fdf4', icon: '✓' },
  fc: { label: 'Cambio de FC · sin desviación mecánica', color: 'var(--cyan)', bg: '#ecfeff', icon: '♥' },
  leve: { label: 'Desviación mecánica leve', color: 'var(--amber)', bg: '#fffbeb', icon: '△' },
  importante: { label: 'Desviación mecánica importante', color: 'var(--coral)', bg: '#fff7ed', icon: '!' },
};

/** Espectrograma (STFT) del sonido MEMS en dos latidos. */
export function Spectrogram({ p, w, h }: { p: SimParams; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const fs = 8000;
    const r0 = rPeak(3, p);
    const s = sampleSignals(r0, rPeak(5, p), p, fs);
    const n = 256;
    const hop = 48;
    const fmax = 3000;
    const bins = Math.round((fmax / (fs / 2)) * (n / 2));
    const cols: Float64Array[] = [];
    for (let i = 0; i + n <= s.snd.length; i += hop) cols.push(powerSpectrum(Array.from(s.snd.subarray(i, i + n)), n));
    cv.width = cols.length;
    cv.height = bins;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(cols.length, bins);
    const ref0 = -18;
    cols.forEach((c, x) => {
      for (let k = 0; k < bins; k++) {
        const db = 10 * Math.log10(c[k] + 1e-12);
        const v = Math.max(0, Math.min(1, (db - (ref0 - 45)) / 45));
        const idx = ((bins - 1 - k) * cols.length + x) * 4;
        // escala blanco → turquesa → azul profundo
        img.data[idx] = 255 - v * (255 - 8);
        img.data[idx + 1] = 255 - v * (255 - 80);
        img.data[idx + 2] = 255 - v * (255 - 140);
        img.data[idx + 3] = 255;
      }
    });
    ctx.putImageData(img, 0, 0);
  }, [p]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 6 }}>
      <div className="v-tiny" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'right', fontSize: 12 }}>
        <span>3 kHz</span>
        <span>1,5</span>
        <span>0</span>
      </div>
      <canvas ref={ref} style={{ width: w - 50, height: h, borderRadius: 8, border: '1px solid var(--line)', imageRendering: 'auto' }} aria-label="Espectrograma del sonido" />
    </div>
  );
}

export function S06SignalsAI() {
  const { params } = useSim();
  const a = useMemo(() => assess(params), [params]);
  const base: SimParams = { ...BASELINE_PARAMS, thetaMax: params.thetaMax, delayMs: params.delayMs, openMs: params.openMs };
  const specKind = params.condition === 'restricted' ? 'open' : 'close';
  const spec = useMemo(() => ({ cur: eventSpectrum(params, specKind), base: eventSpectrum(base, specKind) }), [params, specKind]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = SCENARIOS.find((s) => s.cond === params.condition && s.bpm === params.bpm)?.id;
  const V = VERDICT[a.verdict];

  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead num={6} kicker="Análisis de vibración y sonido · IA experimental" title="¿Falla mecánica o cambio de ritmo?" right={<SimTag label="Señales sintéticas" />} />
      <div className="v-row" style={{ gap: 8, marginTop: -8, marginBottom: 12 }}>
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            className={`v-chip${active === s.id ? ' active' : ''}${s.id !== 'normal' ? ' alt' : ''}`}
            style={{ height: 40, fontSize: 15.5 }}
            onClick={() => sim.setParams({ condition: s.cond, bpm: s.bpm })}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: 20, minHeight: 0 }}>
        <div className="v-col" style={{ gap: 12, minHeight: 0 }}>
          <div className="v-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Línea basal · normal, 72 lpm', base],
              ['Actual', params],
            ].map(([t, p], i) => (
              <div key={i} className="v-panel" style={{ padding: '8px 12px 4px', borderTop: `4px solid ${i ? 'var(--coral)' : 'var(--muted)'}` }}>
                <div className="v-panel-title" style={{ margin: 0, fontSize: 13 }}>
                  {t as string}
                </div>
                <StaticSignals params={p as SimParams} width={440} height={250} lanes={['vib', 'snd']} />
              </div>
            ))}
          </div>
          <div className="v-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="v-panel" style={{ padding: '8px 12px 4px' }}>
              <div className="v-panel-title v-keep-case" style={{ margin: 0, fontSize: 14 }}>
                Espectro del {specKind === 'open' ? 'evento de apertura' : 'cierre'} (Fourier, MEMS)
              </div>
              <Plot width={440} height={205} x={[0, 3000]} y={[-90, -10]} yTicks={[-80, -50, -20]} xTicks={[0, 1000, 2000, 3000]} xFmt={(v) => `${v / 1000} kHz`} yLabel="dB">
                {(s) => (
                  <>
                    <path d={pathFrom(spec.base.map((q) => q.f), spec.base.map((q) => Math.max(-90, q.db)), s.sx, s.sy)} fill="none" stroke="var(--muted)" strokeWidth={1.6} strokeDasharray="5 4" />
                    <path d={pathFrom(spec.cur.map((q) => q.f), spec.cur.map((q) => Math.max(-90, q.db)), s.sx, s.sy)} fill="none" stroke="var(--sig-snd)" strokeWidth={2} />
                  </>
                )}
              </Plot>
              <div className="v-legend" style={{ fontSize: 13 }}>
                <span>
                  <i className="dash" />
                  basal
                </span>
                <span>
                  <i style={{ background: 'var(--sig-snd)' }} />
                  actual
                </span>
              </div>
            </div>
            <div className="v-panel" style={{ padding: '8px 12px 6px' }}>
              <div className="v-panel-title" style={{ margin: 0, fontSize: 13 }}>
                Espectrograma del sonido (actual · 2 latidos)
              </div>
              <div style={{ marginTop: 8 }}>
                <Spectrogram p={params} w={440} h={190} />
              </div>
              <div className="v-tiny" style={{ fontSize: 12.5, marginTop: 4 }}>
                Cada clic aparece como una franja vertical; su color indica la energía en cada frecuencia.
              </div>
            </div>
          </div>
        </div>

        <div className="v-col" style={{ gap: 12, minHeight: 0 }}>
          <div className="v-panel" style={{ padding: '14px 18px', background: V.bg, borderColor: V.color, borderWidth: 2 }}>
            <div className="v-row" style={{ justifyContent: 'space-between' }}>
              <span className="v-kicker" style={{ color: 'var(--muted)', fontSize: 12 }}>
                Resultado del detector
              </span>
              <span className="v-tag sim" style={{ height: 24, fontSize: 11 }}>
                Heurística experimental
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: V.color, margin: '6px 0 4px' }}>
              {V.icon} {V.label}
            </div>
            <div className="v-row v-num" style={{ gap: 26, fontSize: 16 }}>
              <span>
                Similitud con la basal <b style={{ fontSize: 22 }}>{a.similarity.toFixed(0)} %</b>
              </span>
              <span>
                Score <b style={{ fontSize: 22 }}>{a.score.toFixed(2).replace('.', ',')}</b>
              </span>
            </div>
          </div>
          <div className="v-panel" style={{ padding: '10px 14px' }}>
            {a.devs.map((d) => (
              <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '190px 1fr 96px', gap: 8, alignItems: 'center', fontSize: 13.5, padding: '3px 0' }}>
                <span style={{ color: 'var(--text-2)' }}>{d.label}</span>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (d.z / 5) * 100)}%`, height: '100%', background: d.z >= 2.2 ? 'var(--coral)' : d.z >= 1 ? '#f59e0b' : '#7dd3fc', transition: 'width .4s' }} />
                </div>
                <span className="v-num" style={{ textAlign: 'right', fontWeight: 650 }}>
                  {d.value}
                </span>
              </div>
            ))}
            <div className="v-tiny" style={{ fontSize: 12, marginTop: 4 }}>
              Energías en ×10⁻³ V²·s. Barras: distancia a la basal en tolerancias.
            </div>
          </div>
          <div className="v-key" style={{ fontSize: 15.5, padding: '12px 16px', fontWeight: 500 }}>
            <b>¿Falla o ejercicio?</b> La IA compara la <b>firma de cada evento</b> (energía, RMS, espectro, apertura) y verifica que el ciclo valvular coincida con el <b>RR del ECG</b>. Subir la FC acorta el ciclo, pero no cambia la firma: no se marca como falla.
          </div>
        </div>
      </div>
    </div>
  );
}
