/** Último tema visitado de la presentación (para volver al mismo lugar). */
const LAST_KEY = 'vs-last-slide';
export function rememberSlide(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* almacenamiento no disponible */
  }
}
function lastSlide() {
  try {
    return localStorage.getItem(LAST_KEY) ?? 'cover';
  } catch {
    return 'cover';
  }
}

/** Selector superior común: Presentación | Laboratorio interactivo. */
export function ModeSwitch({ active }: { active: 'presentation' | 'lab' }) {
  return (
    <nav className="mode-switch" aria-label="Modo">
      <a href={`#/${lastSlide()}`} className={active === 'presentation' ? 'active' : ''} aria-current={active === 'presentation' ? 'page' : undefined}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        Presentación
      </a>
      <a href="#/dashboard" className={active === 'lab' ? 'active' : ''} aria-current={active === 'lab' ? 'page' : undefined}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
          <path d="M7.5 15h9" />
        </svg>
        Laboratorio<span className="long"> interactivo</span>
      </a>
    </nav>
  );
}
