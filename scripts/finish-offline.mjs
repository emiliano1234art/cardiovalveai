// Mueve el HTML autocontenido a entrega/ y limpia la carpeta temporal.
import { readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
renameSync('entrega/.build/index.html', 'entrega/ValveSense_presentacion.html');
rmSync('entrega/.build', { recursive: true, force: true });
// mismo archivo, pero abre directamente el dashboard (#/dashboard)
const html = readFileSync('entrega/ValveSense_presentacion.html', 'utf8');
writeFileSync(
  'entrega/ValveSense_dashboard.html',
  html.replace('<head>', `<head><script>if(!location.hash||location.hash==='#')location.hash='#/dashboard'</script>`),
);
const mb = (statSync('entrega/ValveSense_presentacion.html').size / 1e6).toFixed(1);
console.log(`OK · entrega/ValveSense_presentacion.html y entrega/ValveSense_dashboard.html (${mb} MB c/u) — abrir con doble clic, funciona sin internet.`);
