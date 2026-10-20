/**
 * Genera las imágenes 3D de la presentación a partir del propio modelo (Three.js).
 * Requiere el servidor de desarrollo activo (npm run dev) y Playwright con Chromium.
 *   node scripts/make-renders.cjs [http://localhost:5173/cardiovalveai/]
 * Salida: src/presentation/renders/*.jpg y entrega/imagenes/*.jpg
 */
const path = require('path');
const fs = require('fs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'));
}
const BASE = process.argv[2] || 'http://localhost:5173/cardiovalveai/';
const OUT = path.join(__dirname, '..', 'src', 'presentation', 'renders');
const DELIV = path.join(__dirname, '..', 'entrega', 'imagenes');
const JOBS = [
  { name: 'aortic-hero', q: 'aortic?camera=hero&labels=1&open=0.65', w: 1300, h: 1000 },
  { name: 'aortic-iso', q: 'aortic?camera=iso&labels=0&open=0.5', w: 1100, h: 1150 },
  { name: 'aortic-top-closed', q: 'aortic?camera=top&labels=0&open=0', w: 1000, h: 1000 },
  { name: 'university-hero', q: 'university?camera=hero&labels=0&open=0.6', w: 1000, h: 1050 },
  { name: 'university-iso', q: 'university?camera=iso&labels=1&open=0.7', w: 1600, h: 1000 },
  { name: 'university-mech', q: 'university?camera=iso&labels=1&open=0.7&mech=1', w: 1600, h: 1000 },
  { name: 'university-xray', q: 'university?camera=iso&xray=1&labels=1&open=0.7', w: 1600, h: 1000 },
  { name: 'university-exploded', q: 'university?camera=iso&exploded=1&labels=1&open=0.7', w: 1600, h: 1000 },
  { name: 'future', q: 'future?camera=iso&labels=1&open=0.6', w: 1600, h: 1000 },
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(DELIV, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const j of JOBS) {
    const p = await b.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1.5 });
    await p.goto(`${BASE}#/render/${j.q}`);
    await p.reload();
    await p.waitForSelector('[data-ready="1"]', { timeout: 30000 });
    const file = path.join(OUT, `${j.name}.jpg`);
    await p.screenshot({ path: file, type: 'jpeg', quality: 86 });
    fs.copyFileSync(file, path.join(DELIV, `${j.name}.jpg`));
    console.log('OK', j.name);
    await p.close();
  }
  await b.close();
})();
