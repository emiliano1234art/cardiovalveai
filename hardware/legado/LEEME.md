# Archivo de revisiones anteriores (NO se usa en la v3)

Esta carpeta guarda, sin modificar, fuentes de las revisiones anteriores, que se publicaron con el nombre de entonces («CardioVal AI» / «CardioValAI»).
Se conservan solo como registro histórico. **No forman parte de la configuración actual:** incluyen piezoeléctricos, el cuarto sensor Hall
del plato y el INA219, que se eliminaron en la v3.

| Carpeta | Origen | Entrega original completa (sin cambios) |
|---|---|---|
| `cad/make_docs.py`, `cad/package.py` | v1 | `entrega/CardioValAI_Modelo_Final_STL.zip` |
| `cad/make_docs_v2.py`, `cad/package_v2.py` | v2 | `entrega/CardioValAI_v2_Modelo_y_Adquisicion.zip` |
| `firmware/CardioValAI_ServoTest/` | v1 (solo mueve el servo) | `entrega/CardioValAI_Modelo_Final_STL.zip` |
| `firmware/CardioValAI_v2_Adquisicion/` | v2 | `entrega/CardioValAI_v2_Modelo_y_Adquisicion.zip` |

Los scripts de esta carpeta ya **no se pueden ejecutar** con el `config.py` actual, porque usan parámetros eliminados en la v3. Para reproducir una
revisión anterior, use el código CAD incluido en su propio ZIP o el commit de git que figura en él.
