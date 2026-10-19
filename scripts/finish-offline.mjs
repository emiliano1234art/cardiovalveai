// Mueve el HTML autocontenido a entrega/ y limpia la carpeta temporal.
import { renameSync, rmSync, statSync } from 'node:fs';
renameSync('entrega/.build/index.html', 'entrega/ValveSense_presentacion.html');
rmSync('entrega/.build', { recursive: true, force: true });
const mb = (statSync('entrega/ValveSense_presentacion.html').size / 1e6).toFixed(1);
console.log(`OK · entrega/ValveSense_presentacion.html (${mb} MB) — abrir con doble clic, funciona sin internet.`);
