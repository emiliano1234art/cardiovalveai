# CardioVal AI — banco experimental (revisión v2)

Prototipo universitario de válvula aórtica trivalva accionada por un servo MG90S, **sin circulación de líquido**. Objetivo principal: medir de forma
repetible la apertura y el cierre y detectar inconsistencias entre ciclos. Vibración y sonido son señales complementarias.
Prototipo académico experimental: no es un dispositivo médico ni implantable, y no diagnostica.

- **v2 (actual):** `entrega/CardioValAI_v2_Modelo_y_Adquisicion.zip`. Incluye la medición de posición con sensores Hall, el CAD revisado, el firmware ESP-IDF de adquisición, las herramientas para Mac, los esquemas, la documentación y el plan de ensayos.
- **v1 (se conserva sin cambios):** `entrega/CardioValAI_Modelo_Final_STL.zip`.

| Carpeta / archivo | Qué contiene |
|---|---|
| `cad/config.py` | Todos los parámetros: medidas, holguras, imanes y sensores, y componentes a verificar. `REVISION`/`PREFIX` identifican la versión |
| `cad/kinematics.py` | Cinemática servo → plato → bielas → valvas. El barrido se calcula a partir del radio medido del horn |
| `cad/sensing.py` | Modelo de dipolos imán–Hall: búsqueda de la posición y respuesta esperada |
| `cad/parts.py`, `registry.py`, `assembly.py` | Geometría, catálogo y ensamblaje (incluye recorridos de cables) |
| `cad/build_all.py` | Genera los STL orientados, los STEP y el ensamblaje en `out_v2/` |
| `cad/verify.py` | Mallas, interferencias (125 poses, con tornillería, imanes y cables), holguras, accesos, carga del servo, radios del horn y efecto cajón |
| `cad/make_docs_v2.py` | Documentación v2: auditoría, sensores, mecanismo, electrónica, firmware, método, ensayos, guías, materiales e informe |
| `cad/blender_anim.py`, `cad/blender_views.py` | `.blend` animado (ejecutar con Blender/bpy **4.5 LTS**) y vistas de sensores y cables |
| `cad/package_v2.py` | ZIP v2 con el manifiesto `REVISION.json` (commit y SHA-256 de cada archivo) |
| `electronica/esquema.py` | Esquemas eléctricos (schemdraw) |
| `firmware/CardioValAI_v2_Adquisicion/` | Firmware ESP-IDF v5.4: ADC continuo, I2S, servo no bloqueante y protocolo binario. **Compila; no se probó en hardware** |
| `firmware/CardioValAI_ServoTest/` | Firmware v1 original (solo mueve el servo) |
| `host/` | Registro y vista en vivo, análisis por ciclo, calibración Hall, emulador de datos **sintéticos** y prueba de extremo a extremo |

```bash
pip install build123d trimesh manifold3d shapely rtree networkx scipy schemdraw pillow   # + bpy 4.5 para Blender
cd hardware/cad
python build_all.py && python verify.py && python make_docs_v2.py
python ../electronica/esquema.py
python blender_anim.py --render --aa 5 && python blender_views.py      # con bpy 4.5
python package_v2.py --video
cd ../host && python -m pytest tests                                  # software, con el emulador
```
