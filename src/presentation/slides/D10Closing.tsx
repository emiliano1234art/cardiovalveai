import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { BrandMark } from '../../components/shared/Brand';
import { DASHBOARD_URL, META } from '../content';
import { PX } from '../explain';
import { useDeck } from '../components/deck';
import { Explain, Screen } from '../components/screen';
import { Visual3D } from '../components/Visual3D';
import { sim } from '../sim/store';

export function D10Closing() {
  const { openDashboard } = useDeck();
  const [qr, setQr] = useState<string | null>(null);
  const slow = useCallback(() => sim.t * 0.33, []);
  useEffect(() => {
    if (!DASHBOARD_URL) return;
    QRCode.toString(DASHBOARD_URL, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b2545', light: '#ffffff' } }).then(setQr);
  }, []);
  return (
    <Screen num={10} kicker="Souvenir y cierre" title="Una válvula para llevar" actions={<Explain label="¿Qué significa?" content={PX.souvenir} />}>
      <div className="v-grid" style={{ gridTemplateColumns: '620px 1fr', gap: 30, height: '100%' }}>
        <div className="v-viewer v-viewer-hero" style={{ height: '100%' }}>
          <Visual3D
            kind="souvenir"
            render="souvenir"
            alt="Llavero de la válvula trivalva CardioVal AI (propuesta)"
            camera="iso"
            showLabels
            autoRotate
            clock={slow}
          />
          <div className="v-viewer-top">
            <span className="v-tag pending">Propuesta de souvenir</span>
          </div>
          <div className="v-viewer-foot">
            <span className="v-hint">Llavero o modelo de escritorio · PETG impreso en 3D</span>
          </div>
        </div>
        <div className="v-col" style={{ gap: 24, justifyContent: 'center' }}>
          <div className="v-closing-card">
            <div className="v-row" style={{ gap: 14 }}>
              <BrandMark size={56} />
              <div className="v-closing-brand">
                CARDIOVALVE<span>AI</span>
              </div>
            </div>
            <p className="v-closing-text">{META.closing}</p>
            <p className="v-closing-tag">{META.tagline}</p>
          </div>
          <div className="v-row" style={{ gap: 24, alignItems: 'center' }}>
            <div className="v-qr">
              {qr ? (
                <div style={{ width: 170, height: 170 }} dangerouslySetInnerHTML={{ __html: qr }} aria-label="Código QR al dashboard" />
              ) : (
                <div className="v-pending-text">[URL pendiente]</div>
              )}
              <span>Escanea para abrir el dashboard</span>
            </div>
            <div className="v-col" style={{ gap: 12 }}>
              <button className="v-btn primary v-btn-lg" onClick={openDashboard}>
                Explorar el dashboard →
              </button>
              <a className="v-link" href={DASHBOARD_URL} target="_blank" rel="noreferrer">
                {DASHBOARD_URL.replace('https://', '')} ↗
              </a>
              <span className="v-tiny">
                {META.members.join(' · ')}
                <br />
                Profesor asesor: {META.advisor} · {META.institution}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
