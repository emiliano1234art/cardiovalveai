import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { DASHBOARD_URL, META } from '../content';
import { SlideHead, useDeck } from '../components/deck';
import { TrivalveSVG } from '../components/TrivalveSVG';

function Keychain({ spin }: { spin: boolean }) {
  return (
    <div style={{ perspective: 900, display: 'grid', placeItems: 'center', height: 420 }}>
      <div className="v-anim-optional" style={{ transformStyle: 'preserve-3d', animation: spin ? 'v-spin-y 9s linear infinite' : undefined }}>
        <svg width={330} height={400} viewBox="-60 -110 120 190" aria-label="Mockup del llavero ValveSense">
          <defs>
            <linearGradient id="pla" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="1" stopColor="#0e7490" />
            </linearGradient>
          </defs>
          {/* argolla */}
          <circle cx={0} cy={-92} r={13} fill="none" stroke="#c7d2de" strokeWidth={3.5} />
          <rect x={-6} y={-80} width={12} height={12} rx={3} fill="url(#pla)" />
          <circle cx={0} cy={0} r={48} fill="url(#pla)" />
          <circle cx={0} cy={0} r={48} fill="none" stroke="#0b4f63" strokeWidth={1.5} />
          <g transform="scale(1.25)">
            <circle r={30} fill="#0b2e3d" />
            {[0, 1, 2].map((i) => {
              const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
              const pts = [
                [0, 0],
                [30 * Math.cos(a - Math.PI / 3), 30 * Math.sin(a - Math.PI / 3)],
                [30 * Math.cos(a + Math.PI / 3), 30 * Math.sin(a + Math.PI / 3)],
              ]
                .map(([x, y]) => `${(x * 0.92).toFixed(1)},${(y * 0.92).toFixed(1)}`)
                .join(' ');
              return <polygon key={i} points={pts} fill="#7dd3fc" stroke="#0b2e3d" strokeWidth={1.6} />;
            })}
          </g>
          <text x={0} y={68} textAnchor="middle" fontSize={15} fontWeight={800} fill="var(--text)" fontFamily="Inter Variable, Inter, sans-serif">
            ValveSense
          </text>
        </svg>
      </div>
    </div>
  );
}

export function S10Souvenir() {
  const { print } = useDeck();
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!DASHBOARD_URL) return;
    QRCode.toString(DASHBOARD_URL, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1f33', light: '#ffffff' } }).then(setQr);
  }, []);

  return (
    <div className="v-slide">
      <SlideHead num={10} kicker="Souvenir y cierre" title="Llavero ValveSense" />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '420px 1fr 380px', gap: 26, alignItems: 'start' }}>
        <div className="v-viewer" style={{ height: 470 }}>
          <Keychain spin={!print} />
          <div className="v-viewer-foot">
            <span className="v-hint">Mockup · impresión 3D</span>
          </div>
        </div>

        <div className="v-col" style={{ gap: 14 }}>
          {[
            ['Qué es', 'Llavero impreso en 3D con la silueta de la válvula trivalva y el nombre ValveSense.'],
            ['Relación con el proyecto', 'Reproduce la geometría del prototipo: tres valvas articuladas dentro de un anillo.'],
            ['Material propuesto', 'PLA (propuesta), el mismo proceso de impresión 3D del anillo y las valvas.'],
            ['Para recordar la iniciativa', 'Un objeto cotidiano que lleva la forma de la válvula y una tarjeta con QR al dashboard.'],
          ].map(([t, d]) => (
            <div key={t} className="v-panel flat" style={{ padding: '14px 20px' }}>
              <div className="v-cyan" style={{ fontSize: 17, fontWeight: 750, letterSpacing: '.04em' }}>
                {t}
              </div>
              <div style={{ fontSize: 20 }}>{d}</div>
            </div>
          ))}
        </div>

        <div className="v-panel" style={{ background: '#ffffff', color: '#0b1f33', borderColor: '#c9d5e3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ ['--valve-orifice' as string]: '#fff', ['--valve-ring' as string]: '#d5dee8', ['--valve-seat' as string]: '#b6c4d3', ['--valve-leaf' as string]: '#38bdf8', ['--valve-leaf-edge' as string]: '#0369a1' }}>
              <TrivalveSVG view="top" angles={[0, 0, 0]} size={44} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>
              Valve<span style={{ color: '#0a7ea4' }}>Sense</span>
            </div>
          </div>
          <div style={{ fontSize: 14, color: '#33485f', textAlign: 'center' }}>
            Equipo {META.team} · {META.careers.join(' + ')}
          </div>
          {qr ? (
            <div style={{ width: 230, height: 230 }} dangerouslySetInnerHTML={{ __html: qr }} aria-label="Código QR al dashboard" />
          ) : (
            <div style={{ width: 230, height: 230, border: '2px dashed #be185d', display: 'grid', placeItems: 'center', color: '#be185d', textAlign: 'center', padding: 16 }}>[URL del dashboard pendiente]</div>
          )}
          <div style={{ fontSize: 13.5, color: '#33485f', wordBreak: 'break-all', textAlign: 'center' }}>{DASHBOARD_URL || '[URL pendiente]'}</div>
          <div style={{ fontSize: 12.5, color: '#5f7590', textAlign: 'center' }}>Tarjeta adjunta al llavero · escanear para abrir la presentación interactiva</div>
        </div>
      </div>
      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <div style={{ fontSize: 33, fontWeight: 650, lineHeight: 1.3, maxWidth: 1300, margin: '0 auto' }}>
          “Comprender cómo funciona una válvula es un paso; <span className="v-cyan">comprender cómo se recupera una persona es nuestro propósito</span>”.
        </div>
      </div>
    </div>
  );
}
