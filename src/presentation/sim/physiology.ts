import { effectiveOpen, RAMP_CLOSE, rPeak, rrOf, type SimParams } from './model';

/**
 * Presiones ILUSTRATIVAS (mmHg) para explicar la apertura pasiva de una válvula
 * aórtica real. No son mediciones ni un modelo hemodinámico validado.
 * Se construyen de modo que P_VI cruza P_Ao exactamente cuando la válvula abre
 * (τ después del pico R) y vuelve a caer bajo P_Ao cuando comienza el cierre.
 */
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function beatOf(t: number, p: SimParams) {
  const RR = rrOf(p);
  let b = Math.floor(t / RR) + 1;
  while (rPeak(b, p) > t) b--;
  return b;
}

function aorticDiastolic(t: number, tClosePrev: number) {
  const x = t - tClosePrev;
  const notch = -5 * Math.exp(-((x - 0.03) ** 2) / (2 * 0.012 ** 2));
  return 76 + 22 * Math.exp(-x / 0.45) + notch;
}

export function pressures(t: number, p: SimParams) {
  const b = beatOf(t, p);
  const r = rPeak(b, p);
  const tau = p.delayMs / 1000;
  const { dOpen } = effectiveOpen(p);
  const tOpen = r + tau;
  const tCloseStart = tOpen + dOpen;
  const prevClose = rPeak(b - 1, p) + tau + dOpen;
  const pOpen = aorticDiastolic(tOpen, prevClose);
  const tr = t - r;
  let lv: number;
  let ao: number;
  if (tr < 0.04) {
    lv = 8;
    ao = aorticDiastolic(t, prevClose);
  } else if (t < tOpen) {
    lv = 8 + (pOpen - 8) * smooth((t - r - 0.04) / (tau - 0.04));
    ao = aorticDiastolic(t, prevClose);
  } else if (t < tCloseStart) {
    const u = (t - tOpen) / dOpen;
    lv = pOpen + (120 - pOpen) * Math.sin(Math.PI * u * 0.85) / Math.sin(Math.PI * 0.5);
    ao = lv - 3 * Math.sin(Math.PI * u);
  } else {
    const pEnd = pOpen + (120 - pOpen) * Math.sin(Math.PI * 0.85);
    lv = 8 + (pEnd - 8) * (1 - smooth((t - tCloseStart) / (RAMP_CLOSE + 0.08)));
    ao = aorticDiastolic(t, tCloseStart) + (pEnd - 98) * Math.exp(-(t - tCloseStart) / 0.45);
  }
  return { lv, ao, open: t >= tOpen && t < tCloseStart, r, tOpen, tCloseStart };
}
