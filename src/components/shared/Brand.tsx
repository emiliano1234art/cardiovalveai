import { useId } from 'react';

/** Isotipo CardioValveAI: anillo valvular con tres valvas (línea de cierre en «Y») y un pulso. */
export function BrandMark({ size = 34 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id={`cvg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b2545" />
          <stop offset=".55" stopColor="#0a6f95" />
          <stop offset="1" stopColor="#14b8c4" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#cvg${id})`} />
      <circle cx="20" cy="19" r="11" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M20 19V8.2M20 19l9.3 5.4M20 19l-9.3 5.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".9" />
      <path d="M5 34h8l2-3 3 5 2-4h15" fill="none" stroke="#7ee8f2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Nombre oficial con el acento de color en «AI». */
export function BrandName({ className }: { className?: string }) {
  return (
    <span className={className}>
      CardioValve<span className="brand-ai">AI</span>
    </span>
  );
}
