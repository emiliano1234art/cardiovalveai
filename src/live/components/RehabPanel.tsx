import { useMemo, useState } from 'react';
import { analyze } from '../analysis';
import { buildPlan, planToMarkdown } from '../rehab';
import type { LiveSnapshot } from '../LiveEngine';
import { downloadText } from '../storage';
import { windowCycles } from './AiPanel';

export function RehabPanel({ snap, win }: { snap: LiveSnapshot; win: '10' | 'session' | 'all' }) {
  const cycles = windowCycles(snap, win);
  const ref = snap.angles.SANO;
  const plan = useMemo(() => buildPlan(analyze(cycles, ref)), [cycles, ref]);
  const [open, setOpen] = useState(0);

  return (
    <section className="lv-card" id="plan">
      <div className="lv-card-head">
        <div>
          <h2 className="lv-card-title">
            Plan de rehabilitación kinésica <span className="lv-tag">generado desde los registros</span>
          </h2>
          <p className="lv-card-sub">Se ajusta al ángulo de apertura medido para que la persona se canse menos en su día a día</p>
        </div>
        <div className="lv-actions">
          <button className="lv-btn" disabled={!plan.phases.length} onClick={() => downloadText('plan-rehabilitacion.md', planToMarkdown(plan), 'text/markdown')}>
            Descargar (.md)
          </button>
          <button className="lv-btn" disabled={!plan.phases.length} onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </div>

      <div className={`lv-verdict ${plan.tone === 'ok' ? 'normal' : plan.tone === 'warn' ? 'limited' : 'incomplete'}`}>
        <span className="lv-verdict-dot" />
        <div>
          <div className="lv-verdict-title">{plan.title}</div>
          <div className="lv-verdict-sub">{plan.summary}</div>
        </div>
      </div>

      {plan.phases.length > 0 && (
        <>
          <div className="lv-plan-meta">
            <div>
              <div className="lv-kicker">Frecuencia sugerida</div>
              <div>{plan.frequency}</div>
            </div>
            <div>
              <div className="lv-kicker">Se basa en</div>
              <ul className="lv-inline">
                {plan.basedOn.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lv-tabs" role="tablist">
            {plan.phases.map((p, i) => (
              <button key={p.name} role="tab" aria-selected={open === i} className={open === i ? 'active' : ''} onClick={() => setOpen(i)}>
                {p.name}
              </button>
            ))}
          </div>
          {plan.phases[open] && (
            <div className="lv-phase">
              <p className="lv-note">
                <b>{plan.phases[open].weeks}</b> · {plan.phases[open].goal}
              </p>
              <div className="lv-blocks">
                {plan.phases[open].blocks.map((b) => (
                  <div className="lv-block" key={b.title}>
                    <h4>{b.title}</h4>
                    <ul>
                      {b.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="lv-blocks lv-blocks-3">
            {[plan.dailyLife, plan.monitoring, { title: 'Criterios de progresión', items: plan.progression }].map((b) => (
              <div className="lv-block" key={b.title}>
                <h4>{b.title}</h4>
                <ul>
                  {b.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="lv-block lv-stop">
            <h4>Señales de alerta: detener y consultar</h4>
            <ul>
              {plan.stopSigns.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        </>
      )}
      <p className="lv-disclaimer">{plan.disclaimer}</p>
    </section>
  );
}
