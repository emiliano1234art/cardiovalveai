import { analyze } from '../analysis';
import type { LiveSnapshot } from '../LiveEngine';

/** Los 3 pasos para usar el dashboard; marca en cuál vas. */
export function GuideSteps({ snap }: { snap: LiveSnapshot }) {
  const connected = snap.link === 'connected';
  const running = connected && snap.sample ? snap.sample.active : false;
  const steps = [
    { n: 1, title: 'Conecta', text: 'Arriba a la derecha: «Conectar ESP32 (USB)». Si solo quieres probar, usa «Modo demo».', done: connected },
    { n: 2, title: 'Elige cómo se abre', text: 'Válvula normal (se abre completa) o incompleta (se abre solo una parte).', done: connected && running },
    { n: 3, title: 'Pulsa «Iniciar»', text: 'La válvula empieza a abrirse y cerrarse, y abajo aparece el análisis.', done: running },
  ];
  const current = steps.find((s) => !s.done)?.n ?? 4;
  return (
    <ol className="lv-steps" aria-label="Pasos para usar el dashboard">
      {steps.map((s) => (
        <li key={s.n} className={s.done ? 'done' : s.n === current ? 'current' : ''}>
          <span className="lv-step-n">{s.done ? '✓' : s.n}</span>
          <div>
            <div className="lv-step-title">{s.title}</div>
            <div className="lv-step-text">{s.text}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Una frase en palabras simples sobre cómo está funcionando la válvula ahora. */
export function StatusSummary({ snap }: { snap: LiveSnapshot }) {
  const connected = snap.link === 'connected';
  const running = connected && snap.sample ? snap.sample.active : false;
  const ref = snap.angles.SANO;
  const recent = snap.cycles.filter((c) => c.session === snap.sessionId).slice(-4);
  const a = analyze(recent, ref);

  let tone: 'idle' | 'ok' | 'warn' | 'crit' = 'idle';
  let title = '';
  let text = '';
  if (!connected) {
    title = 'Esperando conexión';
    text = 'Conecta el ESP32 con el cable USB, o prueba el «Modo demo» para ver cómo funciona sin el prototipo.';
  } else if (!running) {
    title = 'La válvula está detenida';
    text = 'Pulsa «Iniciar movimiento» para que el servo la abra y la cierre.';
  } else if (a.n < 2) {
    title = 'Midiendo…';
    text = 'La válvula ya se está moviendo. En unos segundos te diré si se abre bien.';
  } else if (a.level === 'normal') {
    tone = 'ok';
    title = 'La válvula se abre bien';
    text = `Llega a unos ${a.meanPeak.toFixed(0)}° de ${ref.toFixed(0)}° (${a.openPct.toFixed(0)} %). Es lo que se espera de una válvula sana.`;
  } else if (a.level === 'limited') {
    tone = 'warn';
    title = 'La válvula se abre un poco menos de lo normal';
    text = `Llega a unos ${a.meanPeak.toFixed(0)}° de ${ref.toFixed(0)}° (${a.openPct.toFixed(0)} %). Conviene vigilarla.`;
  } else {
    tone = 'crit';
    title = 'La válvula se abre incompleta';
    text = `Solo llega a unos ${a.meanPeak.toFixed(0)}° de ${ref.toFixed(0)}° (${a.openPct.toFixed(0)} %). Pasa menos sangre de lo que debería, y por eso la persona se cansaría más.`;
  }

  return (
    <section className={`lv-summary ${tone}`} aria-live="polite">
      <span className="lv-summary-dot" />
      <div>
        <div className="lv-summary-title">{title}</div>
        <div className="lv-summary-text">{text}</div>
      </div>
    </section>
  );
}

/** Glosario con las palabras técnicas del dashboard explicadas simple. */
export function Glossary() {
  const items: [string, string][] = [
    ['Válvula trifoliada', 'Una válvula con 3 valvas (como las «puertitas» del corazón). La aórtica sana abre y cierra sus 3 valvas con cada latido.'],
    ['Ángulo de apertura', 'Cuánto se separan las valvas al abrirse. 0° es cerrada. En este prototipo, 90° es abrir completa, como una válvula sana.'],
    ['Válvula normal / incompleta', 'Normal: llega a unos 90°. Incompleta: solo llega a unos 55°, así que deja pasar menos sangre.'],
    ['Sensores Hall', 'Pequeños sensores que detectan los imanes pegados a las valvas. Así el sistema sabe cuánto se abrió la válvula.'],
    ['Ciclo', 'Una apertura y un cierre completos de la válvula, como un latido.'],
    ['% de apertura', 'Cuánto abrió comparado con una válvula normal. 100 % es completa; 61 % es incompleta.'],
    ['Servo', 'El motor que mueve las valvas del prototipo para simular los latidos.'],
    ['Calibrar', 'Enseñarle al sistema qué lectura de los sensores corresponde a cada ángulo. Se hace una sola vez.'],
  ];
  return (
    <details className="lv-card lv-glossary">
      <summary>¿Qué significa cada cosa? Glosario en palabras simples</summary>
      <dl>
        {items.map(([t, d]) => (
          <div key={t}>
            <dt>{t}</dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
