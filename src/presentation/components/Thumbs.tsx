import type { MaterialIcon } from '../content';

/** Miniaturas ilustradas de los materiales (SVG, sin imágenes externas). */
export function MaterialThumb({ id, size = 120 }: { id: MaterialIcon; size?: number }) {
  return (
    <svg viewBox="0 0 120 90" width={size} height={(size * 90) / 120} aria-hidden className="v-thumb-svg">
      {THUMBS[id]}
    </svg>
  );
}

const pins = (x: number, y: number, n: number, dx = 5) =>
  Array.from({ length: n }, (_, i) => <rect key={i} x={x + i * dx} y={y} width={2.4} height={5} rx={0.6} fill="#cbd5e1" />);

const THUMBS: Record<MaterialIcon, React.ReactNode> = {
  esp32: (
    <g>
      <rect x="14" y="20" width="92" height="46" rx="4" fill="#0f172a" />
      {pins(20, 15, 16)}
      {pins(20, 66, 16)}
      <rect x="22" y="28" width="34" height="28" rx="2" fill="#cbd5e1" />
      <rect x="26" y="32" width="26" height="20" rx="1.5" fill="#e2e8f0" stroke="#94a3b8" />
      <text x="39" y="45" fontSize="6.5" textAnchor="middle" fill="#334155" fontWeight="700">
        ESP32
      </text>
      <path d="M62 30h8v6h-4v6h8v-6h-2" fill="none" stroke="#e2b04a" strokeWidth="1.6" />
      <rect x="84" y="34" width="14" height="10" rx="1.5" fill="#94a3b8" />
      <circle cx="70" cy="56" r="2" fill="#38bdf8" />
      <circle cx="78" cy="56" r="2" fill="#f87171" />
    </g>
  ),
  mems: (
    <g>
      <circle cx="60" cy="45" r="30" fill="#6d28d9" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={40 + i * 6} cy={68} r={2.2} fill="#e2b04a" />
      ))}
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={68 + i * 6} cy={68} r={2.2} fill="#e2b04a" />
      ))}
      <rect x="49" y="30" width="22" height="18" rx="2" fill="#cbd5e1" />
      <circle cx="60" cy="39" r="3" fill="#0f172a" />
      <path d="M92 30q6 15 0 30M99 25q9 20 0 40" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    </g>
  ),
  piezo: (
    <g>
      <circle cx="56" cy="46" r="32" fill="#d6a756" />
      <circle cx="56" cy="46" r="20" fill="#f8fafc" stroke="#cbd5e1" />
      <path d="M86 40q10-6 18 2M86 52q10 6 18-2" fill="none" stroke="#dc2626" strokeWidth="2" />
      <path d="M8 46h6l3-7 4 14 3-7h5" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinejoin="round" />
    </g>
  ),
  servo: (
    <g>
      <rect x="28" y="26" width="64" height="40" rx="4" fill="#1d4ed8" />
      <rect x="18" y="38" width="84" height="8" rx="2" fill="#1e40af" />
      <circle cx="44" cy="22" r="10" fill="#e2e8f0" stroke="#94a3b8" />
      <rect x="41" y="8" width="6" height="26" rx="3" fill="#f8fafc" stroke="#94a3b8" />
      <text x="70" y="61" fontSize="8" fill="#bfdbfe" fontWeight="700" textAnchor="middle">
        MG90S
      </text>
      <path d="M92 58h8q6 0 6 6v12" fill="none" stroke="#f97316" strokeWidth="2" />
    </g>
  ),
  petg: (
    <g>
      <circle cx="56" cy="46" r="34" fill="#e2e8f0" stroke="#94a3b8" />
      <circle cx="56" cy="46" r="27" fill="#14b8c4" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx="56" cy="46" r={25 - i * 3.5} fill="none" stroke="#0e7490" strokeWidth=".8" opacity=".6" />
      ))}
      <circle cx="56" cy="46" r="9" fill="#f8fafc" stroke="#94a3b8" />
      <path d="M83 30q16 6 26 30" fill="none" stroke="#14b8c4" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  ),
  hardware: (
    <g>
      <rect x="14" y="30" width="34" height="30" rx="3" fill="#cbd5e1" stroke="#64748b" />
      <rect x="29" y="28" width="4" height="34" rx="2" fill="#64748b" />
      <circle cx="22" cy="38" r="2" fill="#475569" />
      <circle cx="22" cy="52" r="2" fill="#475569" />
      <circle cx="40" cy="38" r="2" fill="#475569" />
      <circle cx="40" cy="52" r="2" fill="#475569" />
      <path d="M62 24h12l-2 4H64z" fill="#94a3b8" />
      <rect x="66" y="28" width="4" height="40" fill="#94a3b8" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M66 ${32 + i * 6}l4 3`} stroke="#475569" strokeWidth="1" />
      ))}
      <rect x="84" y="40" width="26" height="5" rx="2.5" fill="#94a3b8" />
      <circle cx="97" cy="58" r="7" fill="none" stroke="#94a3b8" strokeWidth="3" />
    </g>
  ),
  breadboard: (
    <g>
      <rect x="10" y="22" width="100" height="50" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
      <rect x="10" y="45" width="100" height="4" fill="#e2e8f0" />
      {Array.from({ length: 14 }, (_, i) =>
        [28, 34, 38, 56, 60, 66].map((y) => <rect key={`${i}-${y}`} x={16 + i * 6.8} y={y} width={2} height={2} fill="#94a3b8" />),
      )}
      <path d="M30 34q10-26 30-2" fill="none" stroke="#ef4444" strokeWidth="2.4" />
      <path d="M50 60q18-30 40-24" fill="none" stroke="#2563eb" strokeWidth="2.4" />
      <path d="M70 66q10-20 26-6" fill="none" stroke="#f59e0b" strokeWidth="2.4" />
    </g>
  ),
  power: (
    <g>
      <rect x="20" y="22" width="44" height="50" rx="6" fill="#475569" />
      <rect x="30" y="12" width="6" height="12" rx="1" fill="#cbd5e1" />
      <rect x="48" y="12" width="6" height="12" rx="1" fill="#cbd5e1" />
      <text x="42" y="52" fontSize="12" fill="#e2e8f0" fontWeight="800" textAnchor="middle">
        5 V
      </text>
      <path d="M64 50q16 0 20 10t20 4" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
      <path d="M96 30l-6 10h6l-5 10" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinejoin="round" />
    </g>
  ),
  base: (
    <g>
      <path d="M10 64l20-12h80l-20 12z" fill="#e2e8f0" stroke="#94a3b8" />
      <path d="M10 64h80v8H10z" fill="#cbd5e1" />
      <path d="M90 64l20-12v8l-20 12z" fill="#94a3b8" />
      <rect x="40" y="14" width="8" height="44" rx="3" fill="#f1f5f9" stroke="#94a3b8" />
      <path d="M48 22h22" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="76" cy="36" rx="16" ry="6" fill="none" stroke="#38bdf8" strokeWidth="4" />
    </g>
  ),
  laptop: (
    <g>
      <rect x="22" y="14" width="76" height="50" rx="4" fill="#0f172a" />
      <rect x="26" y="18" width="68" height="42" rx="2" fill="#f8fafc" />
      <path d="M30 44h8l3-10 4 18 3-8h6" fill="none" stroke="#e11d48" strokeWidth="1.6" />
      <path d="M58 40q4-12 8 0t8 0 8 0" fill="none" stroke="#0891b2" strokeWidth="1.6" />
      <rect x="30" y="22" width="20" height="5" rx="1.5" fill="#bae6fd" />
      <path d="M10 64h100l-6 8H16z" fill="#cbd5e1" />
    </g>
  ),
};

/** Íconos de la pantalla del problema. */
export function ProblemIcon({ kind, size = 120 }: { kind: 'heart' | 'valve' | 'waves' | 'rehab'; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      {kind === 'heart' && (
        <g>
          <path
            d="M50 86C20 64 10 48 12 33c2-14 15-22 27-18 5 2 9 6 11 10 2-4 6-8 11-10 12-4 25 4 27 18 2 15-8 31-38 53z"
            fill="#fecdd3"
            stroke="#e11d48"
            strokeWidth="3"
          />
          <path
            d="M18 50h18l5-12 8 24 6-16 4 4h22"
            fill="none"
            stroke="#e11d48"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="v-anim-dash"
          />
        </g>
      )}
      {kind === 'valve' && (
        <g>
          <circle cx="50" cy="50" r="36" fill="#e0f2fe" stroke="#0891b2" strokeWidth="4" />
          <path d="M50 50V14M50 50l31 18M50 50L19 68" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="50" cy="50" r="4" fill="#0369a1" />
        </g>
      )}
      {kind === 'waves' && (
        <g fill="none" strokeLinecap="round" strokeWidth="3.5">
          <path d="M8 40q7-18 14 0t14 0 14 0 14 0 14 0 14 0" stroke="#0891b2" className="v-anim-dash" />
          <path d="M8 66q5-10 10 0t10 0 10 0 10 0 10 0 10 0 10 0 10 0" stroke="#7c3aed" className="v-anim-dash" />
        </g>
      )}
      {kind === 'rehab' && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 86h76" stroke="#94a3b8" strokeWidth="4" />
          <path d="M20 80l60-6" stroke="#cbd5e1" strokeWidth="8" />
          <circle cx="52" cy="18" r="8" fill="#0d9488" />
          <path d="M52 28l-4 22 10 12 2 14M48 50l-12 10-4 14M50 34l14 10 10-6M50 34l-14 8" fill="none" stroke="#0d9488" strokeWidth="6" />
          <path d="M78 24h12M84 18v12" stroke="#e11d48" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}
