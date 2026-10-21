# CardioVal AI — diseño mecánico para impresión 3D (v1)

Código CAD **paramétrico** (Python + build123d/OpenCascade) del prototipo de válvula aórtica trivalva accionada por **un solo servo MG90S**.
El paquete listo para imprimir (STL, STEP, ensamblaje, Blender, animación, guías e informe de validación) está en
[`entrega/CardioValAI_Modelo_Final_STL.zip`](../entrega/CardioValAI_Modelo_Final_STL.zip).

| Archivo | Qué hace |
|---|---|
| `cad/config.py` | **Todos** los parámetros (medidas, holguras, componentes comerciales a verificar) |
| `cad/kinematics.py` | Cinemática servo → plato → bielas → valvas y módulos (normal, restringida 60/45, cierre incompleto, asimétrico) |
| `cad/parts.py` | Geometría de cada pieza |
| `cad/registry.py` | Cantidades, orientación de impresión y notas |
| `cad/assembly.py` | Posición de cada pieza para un ángulo del servo |
| `cad/build_all.py` | Exporta STL (orientados), STEP y ensamblaje |
| `cad/verify.py` | Mallas, interferencias (125 poses), holguras, montaje y carga del servo |
| `cad/make_docs.py` | Guías, lista de materiales, tabla cinemática e informe |
| `cad/blender_anim.py` | Escena `.blend` y animación (misma cinemática) |
| `cad/package.py` | Video con rótulos y ZIP de entrega |
| `firmware/CardioValAI_ServoTest` | Firmware de prueba del servo (ESP32, sin probar en hardware) |

```bash
pip install build123d trimesh manifold3d shapely rtree networkx bpy
cd hardware/cad
python build_all.py && python verify.py && python make_docs.py
python blender_anim.py --render --aa 5 && python package.py
```
Prototipo académico experimental: no es un dispositivo médico ni implantable.
