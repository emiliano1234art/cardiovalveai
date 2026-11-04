import { useMemo, useRef, useState } from 'react';
import { analyze } from '../analysis';
import { buildUserContent, CLAUDE_MODELS, describeError, generateReport } from '../claude';
import type { LiveSnapshot } from '../LiveEngine';
import { buildPlan } from '../rehab';
import { downloadText } from '../storage';
import { windowCycles } from './AiPanel';
import { Markdown } from './Markdown';

const KEY_STORAGE = 'valvesense.live.apikey.v1';
const WIN_LABEL = { '10': 'últimos 10 ciclos', session: 'sesión actual', all: 'todo el historial guardado' } as const;

function loadKey(): string {
  try { return localStorage.getItem(KEY_STORAGE) ?? ''; } catch { return ''; }
}

export function ClaudePanel({ snap, win }: { snap: LiveSnapshot; win: '10' | 'session' | 'all' }) {
  const [apiKey, setApiKey] = useState(loadKey);
  const [remember, setRemember] = useState(() => loadKey() !== '');
  const [modelId, setModelId] = useState(CLAUDE_MODELS[0].id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const abort = useRef<AbortController | null>(null);

  const cycles = windowCycles(snap, win);
  const analysis = useMemo(() => analyze(cycles, snap.angles.SANO), [cycles, snap.angles.SANO]);
  const model = CLAUDE_MODELS.find((m) => m.id === modelId) ?? CLAUDE_MODELS[0];
  const canRun = !busy && apiKey.trim().length > 10 && analysis.n >= 3;

  const run = async () => {
    setBusy(true);
    setError('');
    setNote('');
    setText('');
    try {
      if (remember) localStorage.setItem(KEY_STORAGE, apiKey.trim());
      else localStorage.removeItem(KEY_STORAGE);
    } catch { /* almacenamiento bloqueado */ }
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const content = buildUserContent({
        windowLabel: WIN_LABEL[win],
        analysis,
        cycles,
        plan: buildPlan(analysis),
        source: snap.linkKind === 'demo' ? 'modo demostración (datos simulados)' : snap.linkKind === 'usb' ? 'ESP32 conectado por USB' : 'registros guardados en el navegador',
      });
      const r = await generateReport({ apiKey: apiKey.trim(), model, content, onText: (d) => setText((p) => p + d), signal: ctl.signal });
      if (r.truncated) setNote('La respuesta se cortó por largo. Vuelve a generarla.');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  return (
    <section className="lv-card" id="claude">
      <div className="lv-card-head">
        <div>
          <h2 className="lv-card-title">
            Informe redactado por Claude <span className="lv-tag">requiere internet</span>
          </h2>
          <p className="lv-card-sub">Claude lee los registros de apertura y escribe el análisis de patrones y el plan de rehabilitación kinésica</p>
        </div>
      </div>

      <div className="lv-claude-form">
        <label className="lv-field">
          <span className="lv-kicker">API key de Anthropic</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="lv-field">
          <span className="lv-kicker">Modelo</span>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {CLAUDE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.hint}
              </option>
            ))}
          </select>
        </label>
        <div className="lv-actions">
          {!busy ? (
            <button className="lv-btn primary" onClick={() => void run()} disabled={!canRun}>
              Generar análisis y plan
            </button>
          ) : (
            <button className="lv-btn" onClick={() => abort.current?.abort()}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <label className="lv-check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Recordar la API key en este navegador
      </label>
      <p className="lv-note">
        La key se usa solo desde este navegador para hablar con la API de Anthropic y no se sube al repositorio. Si la recuerdas, queda guardada en este computador: no lo uses en equipos
        compartidos y crea una key con límite de gasto en console.anthropic.com. Se analiza: {WIN_LABEL[win]} ({analysis.n} ciclos).
        {analysis.n < 3 && ' Necesitas al menos 3 ciclos registrados.'}
      </p>

      {error && <div className="lv-error" role="alert">{error}</div>}
      {note && <p className="lv-note">{note}</p>}

      {(text || busy) && (
        <div className="lv-report">
          {busy && !text && <p className="lv-note">Claude está leyendo los registros…</p>}
          <Markdown text={text} />
          {busy && text && <span className="lv-cursor" aria-hidden />}
          {!busy && text && (
            <div className="lv-actions" style={{ marginTop: 12 }}>
              <button className="lv-btn" onClick={() => downloadText('informe-claude.md', text, 'text/markdown')}>Descargar (.md)</button>
              <button className="lv-btn" onClick={() => window.print()}>Imprimir</button>
            </div>
          )}
        </div>
      )}
      <p className="lv-disclaimer">Texto generado por IA a partir de un modelo a escala. Debe ser revisado por un/a kinesiólogo/a y el médico tratante; no es un diagnóstico.</p>
    </section>
  );
}
