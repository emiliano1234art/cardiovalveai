import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { analyze, levelFromPct, type Level } from '../analysis';
import { OPEN_PCT_LIMITED } from '../config';
import type { LiveSnapshot } from '../LiveEngine';

type Win = '10' | 'session' | 'all';

export const LEVEL_TEXT: Record<Level, string> = {
  none: 'Sin datos',
  normal: 'Normal',
  limited: 'Limitada',
  incomplete: 'Incompleta',
};
const LEVEL_COLOR: Record<Level, string> = {
  none: '#6b8394', normal: '#2ee59d', limited: '#ffb547', incomplete: '#ff5d6c',
};

export function windowCycles(snap: LiveSnapshot, win: Win) {
  if (win === '10') return snap.cycles.slice(-10);
  if (win === 'session') return snap.cycles.filter((c) => c.session === snap.sessionId);
  return snap.cycles;
}

export function AiPanel({ snap, win, onWin }: { snap: LiveSnapshot; win: Win; onWin: (w: Win) => void }) {
  const ref = snap.angles.SANO;
  const cycles = windowCycles(snap, win);
  const a = useMemo(() => analyze(cycles, ref), [cycles, ref]);
  const [showAll, setShowAll] = useState(false);
  const data = cycles.slice(-40).map((c, i) => ({ i: i + 1, n: c.n, peak: c.peak, pct: (c.peak / ref) * 100 }));
  const findings = showAll ? a.findings : a.findings.slice(0, 3);

  return (
    <section className="lv-card">
      <div className="lv-card-head">
        <div>
          <h2 className="lv-card-title">Análisis de patrones <span className="lv-tag">IA local</span></h2>
          <p className="lv-card-sub">Revisa los ángulos de apertura guardados y detecta si la válvula abre mal</p>
        </div>
        <div className="lv-seg" role="radiogroup" aria-label="Ventana de análisis">
          {(['10', 'session', 'all'] as const).map((w) => (
            <button key={w} role="radio" aria-checked={win === w} className={win === w ? 'active' : ''} onClick={() => onWin(w)}>
              {w === '10' ? 'Últimos 10' : w === 'session' ? 'Sesión' : 'Todo'}
            </button>
          ))}
        </div>
      </div>

      <div className={`lv-verdict ${a.level}`}>
        <span className="lv-verdict-dot" />
        <div>
          <div className="lv-verdict-title">{a.headline}</div>
          <div className="lv-verdict-sub">
            {a.n} ciclos · apertura {a.n ? `${a.openPct.toFixed(0)} %` : '—'} · estado <b>{LEVEL_TEXT[a.level]}</b>
          </div>
        </div>
      </div>

      <div className="lv-ai-grid">
        <div>
          <div className="lv-kicker">Hallazgos</div>
          {findings.length === 0 && <p className="lv-note">Aún no hay datos suficientes.</p>}
          <ul className="lv-findings">
            {findings.map((f, i) => (
              <li key={i} className={f.severity}>
                <b>{f.title}</b>
                <span>{f.detail}</span>
              </li>
            ))}
          </ul>
          {a.findings.length > 3 && (
            <button className="lv-link" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Ver menos' : `Ver ${a.findings.length - 3} más`}
            </button>
          )}
        </div>
        <div>
          <div className="lv-kicker">Apertura por ciclo (% de lo esperado)</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#16232e" vertical={false} />
              <XAxis dataKey="i" hide />
              <YAxis domain={[0, 110]} ticks={[0, 50, 100]} width={36} tickFormatter={(v: number) => `${v}%`} stroke="#6b8394" fontSize={11} tickLine={false} axisLine={false} />
              <ReferenceLine y={OPEN_PCT_LIMITED} stroke="#ffb547" strokeOpacity={0.55} strokeDasharray="4 4" />
              <ReferenceLine y={100} stroke="#2ee59d" strokeOpacity={0.4} strokeDasharray="4 4" />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,.04)' }}
                contentStyle={{ background: '#0e1720', border: '1px solid #1c2b38', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(_, p) => `Ciclo ${p?.[0]?.payload?.n ?? ''}`}
                formatter={(v) => [`${Number(v).toFixed(0)} %`, 'Apertura']}
              />
              <Bar dataKey="pct" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.i} fill={LEVEL_COLOR[levelFromPct(d.pct)]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
