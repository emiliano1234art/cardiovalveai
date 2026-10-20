import type { ReactNode, SVGProps } from 'react';

/** Iconografía única del dashboard: trazo 1,7 px, esquinas redondeadas, 24 × 24. */
function I({ children, size = 18, ...rest }: SVGProps<SVGSVGElement> & { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement> & { size?: number };

export const IconHeart = (p: P) => (
  <I {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </I>
);
export const IconPulse = (p: P) => (
  <I {...p}>
    <path d="M3 12h4l2-5 4 10 2-5h6" />
  </I>
);
export const IconValve = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M5 10.5l6 1.5M19 10.5l-6 1.5" />
  </I>
);
export const IconVibration = (p: P) => (
  <I {...p}>
    <path d="M2 12h3l2-6 3 12 3-9 2 5 2-2h5" />
  </I>
);
export const IconSound = (p: P) => (
  <I {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </I>
);
export const IconSpectrum = (p: P) => (
  <I {...p}>
    <path d="M4 20V10M8 20V4M12 20v-7M16 20V7M20 20v-4" />
  </I>
);
export const IconBrain = (p: P) => (
  <I {...p}>
    <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1z" />
    <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1" />
  </I>
);
export const IconPerson = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="7" r="3.5" />
    <path d="M5 20c1-4 3.8-6 7-6s6 2 7 6" />
  </I>
);
export const IconHistory = (p: P) => (
  <I {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </I>
);
export const IconInfo = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.5" />
  </I>
);
export const IconPlay = (p: P) => (
  <I {...p}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
  </I>
);
export const IconPause = (p: P) => (
  <I {...p}>
    <path d="M8 5v14M16 5v14" strokeWidth={3} />
  </I>
);
export const IconSpark = (p: P) => (
  <I {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />
  </I>
);
export const IconCpu = (p: P) => (
  <I {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
  </I>
);
export const IconClose = (p: P) => (
  <I {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </I>
);
export const IconGear = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
  </I>
);
export const IconTarget = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3" />
  </I>
);
export const IconRotate = (p: P) => (
  <I {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5" />
    <path d="M20 3.5v5h-5" />
  </I>
);
export const IconLayers = (p: P) => (
  <I {...p}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </I>
);
