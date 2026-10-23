# CardioValveAI — banco experimental (revisión v3)

Prototipo universitario de válvula aórtica trivalva movida por un servo, **sin circulación de líquido**. Objetivo: comparar el movimiento REAL de las 3 valvas, con un
par sensor Hall–imán por valva, y detectar apertura o cierre incompletos, asimetrías, retrasos o variaciones y atascos. El micrófono INMP441 es una señal complementaria.
El ángulo ordenado al servo no es la posición de las valvas, y la animación no es una prueba. Prototipo académico: no es un dispositivo médico ni implantable, y no diagnostica.

- **v3 (actual):** `entrega/CardioValveAI_v3_Modelo_y_Adquisicion.zip`. Tres sensores Hall (uno por valva) en portasensores extraíbles, galgas de calibración angular,
  firmware con calibración guardada en el ESP32, herramientas para Mac, esquemas y documentación. Sin piezoeléctricos, sin Hall del plato y sin INA219.
- **Entregas anteriores (se conservan sin cambios):** `entrega/CardioValAI_Modelo_Final_STL.zip` (v1) y `entrega/CardioValAI_v2_Modelo_y_Adquisicion.zip` (v2).
  Sus fuentes se archivaron en [`legado/`](legado/LEEME.md); ya no se ejecutan con la configuración actual.

| Carpeta / archivo | Qué contiene |
|---|---|
| `cad/config.py` | Todos los parámetros: medidas, holguras, imanes, posición del Hall y datos a verificar. `PROJECT`, `REVISION`, `PREFIX` y `OUT_DIR` identifican la versión |
| `cad/kinematics.py` | Cinemática servo → plato → bielas → valvas |
| `cad/sensing.py` | Modelo de dipolos imán–Hall: comparación de sensores candidatos, tolerancia de montaje, diafonía entre valvas y campo del servo |
| `cad/parts.py`, `registry.py`, `assembly.py` | Geometría, catálogo y ensamblaje (incluye portasensores, galgas y recorridos de cables) |
| `cad/build_all.py` | Genera los STL orientados, los STEP y el ensamblaje en `out_v3/` |
| `cad/verify.py` | Mallas, interferencias (125 poses), holguras, accesos, galgas, carga y velocidad del servo, punto muerto y efecto cajón |
| `cad/make_docs_v3.py` | Documentación: auditoría, datos bloqueantes, Hall–imán, calibración, mecanismo, electrónica, firmware, ensayos, guías, materiales e informe |
| `cad/blender_anim.py`, `cad/blender_views.py` | `.blend` animado (ejecutar con Blender/bpy **4.5 LTS**) y vistas ampliadas de sensores, portasensor, galga y cables |
| `cad/package_v3.py` | ZIP v3 con el manifiesto `REVISION.json` (commit y SHA-256 de cada archivo) |
| `electronica/esquema.py` | Esquemas eléctricos (schemdraw) |
| `firmware/CardioValveAI_v3_Adquisicion/` | Firmware ESP-IDF v5.4: ADC continuo (3 Hall), I2S (INMP441), servo no bloqueante, calibración en NVS, protocolo binario. **Compila; no se probó en hardware** |
| `host/` | Registro y vista en vivo, análisis por ciclo, calibración con galgas, emulador de datos **sintéticos** y prueba de extremo a extremo |

```bash
pip install build123d trimesh manifold3d shapely rtree networkx scipy schemdraw pillow   # + bpy 4.5 para Blender
cd hardware/cad
python build_all.py && python verify.py && python make_docs_v3.py
python ../electronica/esquema.py
python blender_anim.py --render && python blender_views.py      # con bpy 4.5
python package_v3.py --video
cd ../host && python -m pytest tests                           # software, con el emulador
```
