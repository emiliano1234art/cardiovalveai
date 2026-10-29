"""
Documentación de CardioValveAI v3 / v3.1 (generada a partir de los resultados reales de verify.py y sensing.py).
Uso: python make_docs_v3.py   →   out_<REVISION>/Documentacion/*.md, *.csv
Clasificación usada en todos los documentos:
  [CÁLCULO] cálculo · [GEOM] inspección geométrica · [SIM] simulación (barrido cinemático / booleano) ·
  [COMPILACIÓN] compilación · [SW] prueba de software · [FÍSICO] pendiente de ensayo físico
"""
from __future__ import annotations
import csv
import json
import math
import os
import numpy as np

import config as C
import kinematics as K
import assembly as A
import parts as P
import registry as R
import sensing as S

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', C.OUT_DIR))
DOC = os.path.join(OUT, 'Documentacion')
CANON = os.path.join(OUT, '_canon')
FW = C.FIRMWARE
RV = C.REVISION
TAGS = ('**[CÁLCULO]** cálculo · **[GEOM]** inspección geométrica · **[SIM]** simulación · **[COMPILACIÓN]** compilación · '
        '**[SW]** prueba de software · **[FÍSICO]** pendiente de ensayo físico')
HEAD = (f'> {C.PROJECT} · revisión **{C.REVISION}** · prototipo académico de banco **sin fluido**. No es un dispositivo médico ni de diagnóstico; '
        f'los resultados del banco no equivalen a diagnosticar una válvula implantada.\n> {TAGS}\n')
A1 = 'DRV5055A1 @3,3 V'


def F(x, d=1):
    v = round(float(x), d)
    return f'{(0.0 if v == 0 else v):.{d}f}'.replace('.', ',')


def P3(p):
    return '(' + '; '.join(F(v, 1) for v in p) + ')'


def w(name, text):
    os.makedirs(DOC, exist_ok=True)
    with open(os.path.join(DOC, name), 'w', encoding='utf-8') as f:
        f.write(text)


def load():
    V = json.load(open(os.path.join(CANON, 'verify.json')))
    SD = S.final_design()
    with open(os.path.join(CANON, 'sensing_design.json'), 'w') as f:
        json.dump(SD, f, indent=1, ensure_ascii=False)
    return V, SD


# ───────────────────────────── coordenadas (origen común) ─────────────────────────────

def magnet_global(i, theta):
    yc = C.TAIL_Y[0] + C.MAG_LEAF[1] / 2
    c = S.tail_magnet_center(theta, C.MAG_LEAF_S, yc)
    return A.ring_local(i, *c)


def sensor_coords():
    hx, hy, hz = C.HALL_XYZ
    rows = []
    for i in range(3):
        h = np.array(A.ring_local(i, hx, hy, hz))
        m0 = np.array(magnet_global(i, 0.0)); m80 = np.array(magnet_global(i, 80.0))
        rows.append({'id': f'H{i+1}', 'que': f'elemento Hall, valva {i+1}', 'xyz': h, 'nota': 'eje sensible radial (hacia afuera)'})
        rows.append({'id': f'IMÁN{i+1} 0°', 'que': f'centro del imán, valva {i+1} cerrada', 'xyz': m0, 'nota': f'distancia al Hall {F(np.linalg.norm(m0 - h), 2)} mm'})
        rows.append({'id': f'IMÁN{i+1} 80°', 'que': f'centro del imán, valva {i+1} abierta', 'xyz': m80, 'nota': f'distancia al Hall {F(np.linalg.norm(m80 - h), 2)} mm'})
    tf = A.pose_transforms(K.SWEEP, 'NORMAL')
    rows.append({'id': 'M1', 'que': 'centro de la placa INMP441', 'xyz': np.array(tf['MEMS_Stand_Holder'][:3, 3]),
                 'nota': 'soporte independiente; radial ±8 mm y pivote'})
    return rows


# ───────────────────────────── 01 Auditoría ─────────────────────────────

def doc_auditoria(V, SD):
    nfail = [c for c in V['assembly'] if not c['ok']]
    g_ok = sum(g['ok'] for g in V['gauges'])
    V31 = ('''## 0. Revisión v3.1: fijaciones impresas
La v3.1 es la v3 sin tornillería metálica comprada: roscas M6 impresas, pasadores de latón Ø2 con cabeza y tuerca impresas, y pestillos giratorios en la
bandeja (doc 11). El mecanismo, los sensores, el firmware y la medición no cambian. La v3 se conserva en `entrega/CardioValveAI_v3_Modelo_y_Adquisicion.zip`.
''' if C.REVISION != 'v3' else '')
    t = f"""# 01 · Auditoría de la entrega v2 y cambios de la v3

{HEAD}
**Qué se auditó:** `entrega/CardioValAI_v2_Modelo_y_Adquisicion.zip` (v2, commit base 2b3999f): CAD paramétrico, STL, STEP, Blender, animación, firmware ESP-IDF,
herramientas para Mac, esquemas y documentación. **Las entregas v1 y v2 se conservan sin cambios** (`entrega/CardioValAI_Modelo_Final_STL.zip`,
`entrega/CardioValAI_v2_Modelo_y_Adquisicion.zip`); sus fuentes se archivaron en `hardware/legado/`. Todo lo nuevo se llama **{C.PROJECT}**, lleva el prefijo
`{C.PREFIX}` y sale en `hardware/{C.OUT_DIR}/`.

{V31}
## 1. Cambios de configuración pedidos (aplicados)

| Cambio | Qué se hizo | Comprobación |
|---|---|---|
| Nombre definitivo **{C.PROJECT}** | Títulos, prefijos de archivos, firmware (`{FW}`), herramientas, esquemas, Blender y documentación | Búsqueda de nombres anteriores en fuentes y salidas v3 [SW] |
| Quitar los 2 piezoeléctricos | Se eliminaron soportes, tapas, adaptadores, almohadillas del anillo y del soporte del servo, canales, adquisición, gráficos y referencias | Barrido sin esas piezas [SIM]; búsqueda de texto [SW] |
| Quitar MCP6004/MCP6022 y componentes solo del piezo | Se quitaron amplificador, BAT54S, red de polarización, filtros Sallen-Key; la hoja eléctrica del piezo ya no existe | Esquemas regenerados [SW] |
| Quitar el 4.º Hall (H0 del plato) | Se eliminaron soporte, imán del plato, arandelas y canal ADC. La detección de «falta de movimiento» usa ahora los 3 Hall de las valvas | Firmware compilado [COMPILACIÓN]; prueba con emulador [SW] |
| Quitar el INA219 | Fuera del esquema y del firmware; el servo se protege con fusible PTC, parada física y límites por software | [COMPILACIÓN] |
| Sin IMU ni sensores nuevos | No se agregó ninguno | — |
| ECG fuera de alcance | No hay electrodos ni ECG en esta revisión | — |

## 2. Problemas encontrados en la v2 y corrección en la v3

| # | Problema en v2 | Evidencia | Corrección v3 | Estado |
|---|---|---|---|---|
| 1 | **Ubicación Hall frágil:** con el sensor 1 mm más lejos del imán la curva dejaba de ser monótona y con +0,5 mm la incertidumbre llegaba a ≈ 2,7° (A1). | Modelo de dipolos `sensing.py`, posición v2 (26,8; −8; 13,5) en el marco de la valva | Nueva posición {P3(C.HALL_XYZ)} con ventana del bolsillo hacia la ranura; monótona con ±0,5 mm en x, y, z (tabla en doc 03). **Con +1 mm sigue dejando de ser monótona**: la posición la fija el lomo del portasensor apoyado en la pared del bolsillo, no el pegado | [CÁLCULO]; respuesta real [FÍSICO] |
| 2 | **Sensor Hall pegado en el anillo:** para cambiarlo había que desarmar la válvula. | Bolsillo cerrado en la pared | **Portasensor extraíble desde arriba** (`Hall_Carrier`), con pestaña y canal de cable; 3 variantes de separación (0 / 0,25 / 0,5 mm) solo por si satura | Extracción vertical sin choques [SIM]; ajuste real [FÍSICO] |
| 3 | **Equivalencia de sensores supuesta:** el texto usaba DRV5055 pero no se evaluaron 49E/SS49E. | — | Tabla de candidatos con la misma geometría: la familia 49E **no** cumple el objetivo de ≤ 1° (doc 03); A3144 no sirve (digital) | [CÁLCULO] con datos a VERIFICAR |
| 4 | **Calibración con el ángulo ORDENADO al servo** como referencia de posición y sin histéresis. | `cvai_calibrate.py guiado` v2 | Calibración con **galgas impresas** que tocan la valva a 0–80° (11 ángulos) + verificación con video; se registran apertura y cierre por separado; histéresis, repetibilidad y error de validación cruzada | Galgas: {g_ok}/{len(V['gauges'])} correctas [SIM]; ajuste con datos sintéticos [SW]; real [FÍSICO] |
| 5 | Calibración solo en la computadora: el firmware no sabía si había calibración ni podía limitar ángulos. | Firmware v2 | Calibración por sensor **guardada en NVS** con CRC, validada (≥ 5 puntos, monótona, sin lecturas repetidas, rango ≥ 30°); límites en ángulo calibrado y aviso si falta | [COMPILACIÓN]; [SW] con emulador; [FÍSICO] |
| 6 | Umbrales de anomalía fijos en el código. | `cvai_analyze.py` v2 | Umbrales calculados con `--crear-umbrales` a partir de sesiones **normales reales** repetidas (rechaza sintéticas y no calibradas) | [SW] |
| 7 | Detección de atasco con el Hall del plato (H0). | Firmware v2 | «Falta de movimiento»: ninguna valva cambia su lectura cruda ≥ `stall_min_delta` durante un movimiento ordenado → parada controlada | [COMPILACIÓN]; [SW] |
| 8 | Muestreo de 8 canales a 64 kS/s para piezo + Hall. | Firmware v2 | Patrón de 3 canales H1 H2 H3 a 24 kS/s → 1 kS/s por valva (suma de 8); desfase entre valvas 41,7 µs (informado en INFO) | [COMPILACIÓN] |
| 9 | Vistas sin ampliación del par Hall–imán ni coordenadas desde un origen común. | Carpeta `Vistas` v2 | Vistas ampliadas por valva (cerrada/abierta), portasensor retirado y galga; tabla de coordenadas (doc 03, `Coordenadas_Sensores_{RV}.csv`) | [GEOM] |
| 10 | El servo figuraba como MG90S confirmado. | BOM v2 | Modelo y medidas del servo **por confirmar** (doc 02); el MG90S queda como referencia dimensional | — |

## 3. Riesgos que quedan sin resolver sin ensayo físico
- Respuesta real de los Hall y de los imanes comprados (modelo de dipolos aproximado; datos de sensibilidad a 3,3 V supuestos ratiométricos). [FÍSICO]
- Efecto cajón del plato si una valva se traba: {V['plate_binding']['lectura']} [CÁLCULO]
- Par y velocidad reales del servo (dato de distribuidores no verificado). [FÍSICO]
- Holguras reales de impresión → probeta de tolerancias. [FÍSICO]

## 4. Resultado de las comprobaciones digitales v3 (ejecutadas sobre los archivos entregados)
- Barrido: **{V['sweep']['poses_checked']} poses** (25 posiciones del servo × 5 modos), intersección booleana: **{len(V['sweep']['interferences'])} interferencias**. [SIM]
- Contactos de diseño (< 0,05 mm³): {', '.join(sorted(V['sweep']['contacts'])) or 'ninguno'}.
- Montaje y acceso: {len(V['assembly']) - len(nfail)} de {len(V['assembly'])} correctas.{(' Fallan: ' + '; '.join(c['check'] for c in nfail)) if nfail else ''} [SIM]
- Galgas de calibración: {g_ok} de {len(V['gauges'])} detienen solo a la valva 1 en su ángulo (sin contacto 0,3° antes). [SIM]
- Mallas STL: cerradas, un cuerpo, apoyadas en z = 0, dentro de 220 × 220 mm. [SW]
- Firmware: compila con ESP-IDF v5.4.1 sin advertencias en el código propio. [COMPILACIÓN]
- Herramientas: prueba de extremo a extremo con datos **sintéticos** del emulador. [SW]

**Nada de esto demuestra que el prototipo físico funcione.** Ver `10_Pendientes_Fisicos.md`.
"""
    w('01_Auditoria_v2_y_Cambios_v3.md', t)


# ───────────────────────────── 02 Datos bloqueantes ─────────────────────────────

def doc_datos():
    t = f"""# 02 · Datos que bloquean decisiones (lista única)

{HEAD}
Mientras falten, las piezas afectadas quedan **paramétricas y NO definitivas** (marcadas en la guía de impresión y en la lista de materiales).

| # | Dato a enviar | Para qué se usa | Pieza / archivo afectado |
|---|---|---|---|
| 1 | **Sensores Hall:** modelo exacto impreso en el cuerpo y fabricante (foto nítida de la cara plana); si es **componente suelto (TO-92 de 3 patas) o módulo** (placa con LED, potenciómetro o comparador); en módulos, foto de ambas caras | Elegir alimentación (3,3 V directo o 5 V + divisor), sensibilidad, saturación y portasensor. Un módulo con comparador entrega salida digital | `Hall_Carrier_*`, `config.TO92_BODY`, Hoja 2 (opción A o B), `--sensor` al registrar |
| 2 | **Imanes:** diámetro, espesor, dirección de magnetización (axial o diametral) y grado si se conoce (N35/N42/N52) | Alojamiento en la cola, campo esperado, saturación, variante de portasensor | `config.MAG_LEAF`, `sensing.py`, `Leaflet_*` |
| 3 | **Servo:** marca y modelo; largo, ancho y alto del cuerpo; distancia entre agujeros de las orejas y altura de su cara inferior; posición del eje; **horn** que se usará y radio del agujero elegido (mm) | Soporte, altura del eje, barrido, par y velocidad | `config.SERVO`, `Servo_Mount`, `kinematics.py` |
| 4 | **ESP32 DevKit V1:** largo y ancho de la placa; cantidad de pines (30 o 38); separación entre hileras (centro a centro); posición del USB y de EN/BOOT; chip USB (CP2102 o CH340) | Zócalos, bandeja, acceso USB, velocidad del puerto | `Electronics_Tray`, `Turn_Button`, `config.ESP32_*`, firmware `CVAI_BAUD` |
| 5 | **INMP441:** forma y medidas de la placa; espesor; en qué cara está el **puerto acústico**; orden de los pines | Portaplaca con el puerto libre y orientación | `MEMS_Stand_Holder`, `config.MEMS_BOARD` |

### Sobre los sensores Hall (dato 1)
**«49E», AH49E, SS49E y DRV5055 no son equivalentes automáticos.** Hay que comprobar con la hoja de datos del modelo exacto: tensión de alimentación (49E/SS49E/AH49E:
típicamente 4,5–6 V o 3–6,5 V según fabricante; DRV5055: 3,3 V o 5 V), tipo de salida (lineal ratiométrica), sensibilidad (≈ 1,4–1,8 mV/G en la familia 49E a 5 V; DRV5055A1–A4:
100 / 50 / 25 / 12,5 mV/mT a 5 V), rango antes de saturar, encapsulado y **orden de las patas** (cambia entre fabricantes). Valores de distribuidores y de TI marcados VERIFICAR:
las hojas de datos de TI y Diodes no se pudieron descargar desde este entorno (bloqueo de red).

**Si son A3144 (u otro interruptor Hall digital):** su salida solo indica «campo por encima/debajo de un umbral» (encendido/apagado con histéresis). **No permiten seguir el
ángulo de forma continua**: a lo sumo marcan si la valva pasó por un punto. El cambio necesario es usar un **sensor lineal** (recomendado: DRV5055A1QLPG, TO-92, 3,3 V) en el
mismo portasensor.

### Partes que todavía NO conviene imprimir como definitivas
`Hall_Carrier_*` (encapsulado del sensor), `Servo_Mount` (servo), `Electronics_Tray`, `Turn_Button` y `Base` (ESP32 y servo), `MEMS_Stand_Holder` (INMP441). Se pueden imprimir
como prueba. La probeta, el anillo, las valvas, las bielas, los topes, las galgas y las columnas no dependen de estos datos (sí de la probeta: diámetros de agujeros e imanes).
"""
    w('02_Datos_Bloqueantes.md', t)


# ───────────────────────────── 03 Hall–imán ─────────────────────────────

def doc_hall(V, SD):
    co = sensor_coords()
    with open(os.path.join(DOC, f'Coordenadas_Sensores_{RV}.csv'), 'w', newline='', encoding='utf-8') as f:
        cw = csv.writer(f); cw.writerow(['id', 'descripcion', 'x_mm', 'y_mm', 'z_mm', 'nota'])
        for r in co:
            cw.writerow([r['id'], r['que'], *[f'{v:.2f}' for v in r['xyz']], r['nota']])
    crow = '\n'.join(f"| {r['id']} | {r['que']} | {P3(r['xyz'])} | {r['nota']} |" for r in co)
    var_rows = []
    for off, v in SD['variantes'].items():
        for s in v['sensores']:
            var_rows.append(f"| {off.replace('.', ',')} | {s['sensor']} | {F(s['v_cerrada_V'], 3)} | {F(s['v_80_V'], 3)} | {'sí' if s['satura'] else 'no'} | "
                            f"{'sí' if s['monotona'] else 'NO'} | {F(s['pendiente_min_mV_por_grado'], 2)} | {F(s['incertidumbre_max_deg'], 2)} | "
                            f"{'**sí**' if s['cumple_criterio'] else 'no'} | {s['nota']} |")
    tab = '\n'.join(f"| {F(r['theta_deg'], 0)} | {F(r['B_mT'], 2)} |" for r in SD['tabla_B'])
    tol = '\n'.join(f"| {k.replace('.', ',')} mm | {'sí' if v['monotonic'] else 'NO'} | {F(v['min_slope_mT_per_deg'], 4)} | {F(v['max_abs_mT'], 1)} |"
                    for k, v in SD['tolerancia_montaje'].items())
    ct = SD['diafonia_vecinas']; sv = SD['servo_campo_mT_a_57mm_momento_0.005_0.05']
    a1 = S.SENSORS[A1]['s']
    clr = {k: v for k, v in V['clearance'].items() if 'Hall' in k or 'Magnet' in k}
    clr_t = '\n'.join(f"| {k} | {F(v['min_mm'], 2)} | {v['mode']} |" for k, v in sorted(clr.items(), key=lambda kv: kv[1]['min_mm']))
    t = f"""# 03 · Par Hall–imán por valva: sensores, ubicación, montaje e interferencias

{HEAD}
## 1. Configuración
Un **imán** por valva, retenido en la cola cerca de la bisagra ({F(C.MAG_LEAF_S)} mm del eje, a lo largo de la cola), y un **sensor Hall lineal** fijo en el anillo, en un
**portasensor extraíble** que entra desde arriba. El sensor mide la componente radial del campo; al abrir, el imán se aleja y la lectura cambia de forma **no lineal** y monótona.
El ángulo ordenado al servo **no** es la posición: la posición sale de este par, una vez calibrado (doc 04).

## 2. Coordenadas desde un origen común [GEOM]
Origen: esquina inferior de la base (x a lo largo de 200 mm, y a lo largo de 180 mm, z hacia arriba). Centro de la válvula ({F(A.VX)}; {F(A.VY)}) mm; cara inferior del anillo
z = {F(A.Z_RING, 2)} mm; valvas hacia 90°, 210° y 330° (1, 2, 3). Archivo: `Coordenadas_Sensores_{RV}.csv`. Vistas ampliadas: `Vistas/Vista_Hall_Iman_Valva*_{{cerrada,abierta}}.png`.

| Punto | Descripción | (x; y; z) mm | Nota |
|---|---|---|---|
{crow}

En el marco de cada valva (x radial hacia afuera, y a lo largo del eje de bisagra, z hacia arriba desde la cara inferior del anillo): elemento Hall en {P3(C.HALL_XYZ)}.

## 3. Sensores candidatos con esta geometría [CÁLCULO]
Modelo de dipolos (imán Ø{F(C.MAG_LEAF[0], 0)}×{F(C.MAG_LEAF[1], 0)} N42 axial, Br 1,30 T supuesto). Criterio **propuesto**: incertidumbre angular 2σ/pendiente ≤ {F(S.RES_LIMIT_DEG, 0)}° en
0–80°, con ruido supuesto {F(S.NOISE_MV, 0)} mV tras promediar 8 muestras (se mide en el ensayo 3). Es un modelo aproximado: sirve para comparar sensores y comprobar monotonía,
no para predecir mV exactos.

| separación extra (mm) | sensor | V cerrada | V a 80° | satura | monótona | pendiente mín. (mV/°) | incertidumbre máx. (°) | cumple | nota |
|---|---|---|---|---|---|---|---|---|---|
{chr(10).join(var_rows)}

**Conclusión:** con esta geometría solo el **DRV5055A1** (≈ {F(a1, 0)} mV/mT a 3,3 V, supuesto ratiométrico) cumple el objetivo de ≤ 1°. La familia **49E/SS49E/AH49E** tiene
una sensibilidad ≈ 7 veces menor: la incertidumbre estimada es de ≈ 4–7° cerca de 80°. Se puede usar para ver **que** la valva se mueve, pero no para medir el ángulo con la
resolución pedida. Alternativas si ya se tienen 49E: alimentarlos a 5 V con divisor (Hoja 2, opción B; no mejora la resolución) o acercar/agrandar el imán (cambia la geometría y
el riesgo de saturación: requiere rehacer el cálculo y la probeta). **A3144:** no sirve (salida digital; ver doc 02).

Campo calculado en el sensor (variante 0):

| θ (°) | |B| (mT) |
|---|---|
{tab}

Tolerancia de posición del sensor (¿sigue siendo monótona?):

| desplazamiento | monótona | pendiente mín. (mT/°) | campo máx. (mT) |
|---|---|---|---|
{tol}

Con **+1 mm** en x (más lejos del imán) la curva deja de ser monótona: por eso el lomo del portasensor apoya contra la cara exterior del bolsillo (x = {F(C.HALL_POCKET_BACK)}) y
las variantes solo agregan 0,25 o 0,5 mm. **No se declara una distancia «óptima»**: la elegida es una posición que, según el modelo, da una curva monótona con margen ±0,5 mm.

## 4. Portasensor extraíble (`Hall_Carrier_000/025/050`) [GEOM/SIM]
- Entra desde arriba en el bolsillo del anillo; la pestaña ({F(C.CARRIER_FLANGE_T)} mm) apoya en la cara superior y fija la altura; el lomo apoya en la pared exterior y fija la distancia radial.
- Sensor TO-92 con la cara plana hacia el centro de la válvula, pegado al lomo con una gota de **silicona neutra** (removible). Patas hacia arriba, cable por el canal del portasensor y
  la bajada exterior del anillo (fijo, protegido, accesible).
- **Cambio de sensor:** tirar de la pestaña (agujero Ø1,2 para un gancho) sin desmontar valvas, bielas ni anillo. Comprobado: la extracción vertical no choca con otras piezas
  (comprobaciones de montaje en el informe). **Cambio de imán:** retirar el eje de la valva (doc de ensamblaje); el imán sale empujando desde el lado opuesto con un pasador fino.
- Variantes: `000` nominal (se monta en las 3 valvas); `025` y `050` alejan el sensor **solo si satura** con los imanes comprados. Número grabado en la pestaña.

## 5. Holguras con piezas vecinas en todo el recorrido [SIM]
| Par | mínimo (mm) | modo |
|---|---|---|
{clr_t}

Sin contacto entre imán, sensor, portasensor, valvas vecinas, bielas, pasadores, plato, columnas y topes en las {V['sweep']['poses_checked']} poses.

## 6. Imán: masa, retención y atracción [CÁLCULO]
- Masa del imán ≈ {F(SD['iman']['masa_g'], 3)} g (densidad 7,5 g/cm³). Momento extra sobre la bisagra ≈ {F(SD['iman']['masa_g'] * 9.81e-3 * C.MAG_LEAF_S, 4)} N·mm: despreciable frente al
  peso de la valva.
- **Retención:** alojamiento Ø{F(C.MAG_LEAF[0] + C.MAG_POCKET_CLR, 2)} × {F(C.MAG_LEAF[1] + 0.2)} mm a ras de la cara −y de la cola, una gota de cianoacrilato. El diámetro final se elige
  con la fila 5 de la probeta (Ø4,05–4,30). **Polaridad marcada** igual en las 3 valvas.
- **Atracción a piezas metálicas:** ejes y pasadores de **latón**, tornillos de los topes de latón (no magnéticos). Mantener herramientas de acero alejadas durante la calibración.
- **Imanes vecinos:** variación por el movimiento de las otras dos valvas ≈ {F(ct['variacion_por_vecinas_mT'] * 1000, 1)} µT → ≈ {F(ct['variacion_por_vecinas_mT'] * a1, 2)} mV
  con A1 (< 0,1°). Se verifica en el ensayo 4: cada Hall con su valva quieta mientras se mueven las otras.
- **Servo:** imán del motor a ≈ 57 mm; con momentos supuestos de 0,005–0,05 A·m² da {F(sv[0] * 1000, 0)}–{F(sv[1] * 1000, 0)} µT (orden de magnitud; constante con el servo quieto,
  variable si el rotor gira). Se mide en el ensayo 6 (servo moviéndose desacoplado).
- Campo terrestre (≈ 50 µT, constante) y temperatura (−0,12 %/°C del N42): los absorbe la calibración si se calibra a la temperatura de trabajo.
"""
    w('03_Hall_Iman_Sensores.md', t)


# ───────────────────────────── 04 Calibración ─────────────────────────────

def doc_calibracion(V):
    gl = '\n'.join(f"| {g['angulo']}° | {'✔' if g['ok'] else '✘'} | {', '.join(g['debajo']) or '—'} | {', '.join(g['encima']) or '—'} |" for g in V['gauges'])
    angs = ', '.join(f'{a}' for a in C.CALIB_ANGLES)
    t = f"""# 04 · Calibración angular verificable

{HEAD}
## 1. Referencias
- **Cero mecánico:** cara superior de la valva paralela a la cara inferior del anillo (galga de 0°).
- **Galgas impresas** `Calib_Gauge_XX` ({angs}°): se apoyan en la cara superior del anillo con una llave en la ranura de la valva 1; la cara de contacto toca la cara superior de
  la valva exactamente a ese ángulo (entre 7,5 y 13 mm del eje). Se usan en las 3 valvas (son iguales por simetría).
- **Verificación independiente:** video lateral frente al transportador `Angle_Scale` y video superior (hoyuelos de la línea central).

Comprobación digital de las galgas [SIM]: la valva 0,3° por debajo del ángulo no toca la galga; 0,7° por encima la penetra (la galga la detiene) y no toca ninguna otra pieza.

| galga | correcta | contacto 0,3° antes | contacto 0,7° después |
|---|---|---|---|
{gl}

## 2. Procedimiento (`cvai_calibrate.py`)
1. `galgas --valva N`: el plato se mueve a mano o con el servo **desacoplado de esa valva**; la valva se apoya suavemente en cada galga, **primero abriendo** (0 → 80°) y **luego
   cerrando** (80 → 0°), al menos 3 repeticiones. En cada punto se promedia la lectura cruda (suma de 8 = 1 kS/s).
2. `video`: alternativa o verificación con ángulos leídos del video.
3. `ajustar`: curva monótona (PCHIP) por sensor; informa monotonía, si los puntos se distinguen (separación > 4σ del ruido), ruido, **resolución**, **repetibilidad**, **histéresis**
   y error de validación cruzada (dejando un punto afuera).
4. `subir`: guarda la calibración en la memoria NVS del ESP32 (con CRC). El firmware la valida (≥ 5 puntos, monótona, sin lecturas repetidas, rango ≥ 30°) y la informa en INFO y en
   STATUS. Sin calibración válida **no se muestran grados**: solo la lectura cruda.
5. `comparar`: después de desmontar y volver a montar un portasensor o un imán, se repite la calibración y se comparan las dos curvas.

**No se usa una conversión lineal mín/máx:** la relación es no lineal (doc 03). Si dos posiciones dan lecturas indistinguibles, o el sensor satura, la herramienta lo marca; la
corrección es geométrica (variante de portasensor, imán) y se repite el cálculo de doc 03.

## 3. Definiciones
- **Resolución:** cambio de ángulo más pequeño que se distingue del ruido (2σ / pendiente local), en grados.
- **Repetibilidad:** dispersión del ángulo estimado al volver al mismo punto varias veces (sin desmontar), por sentido de movimiento.
- **Histéresis / juego:** diferencia entre la curva de apertura y la de cierre en un mismo ángulo de galga.
- **Exactitud:** diferencia entre el ángulo estimado y la referencia independiente (video o galga no usada en el ajuste).

Ninguno de estos valores se midió todavía. Con datos **sintéticos** del emulador la herramienta calcula resolución 0,3–0,4° y error de validación cruzada ≈ 0,8° (prueba de
software, no del prototipo). **Objetivos propuestos:** resolución ≤ 1°, repetibilidad ≤ 1°, histéresis ≤ 2°, exactitud frente al video ≤ 3° máx. / 1,5° RMS.
"""
    w('04_Calibracion_Angular.md', t)


# ───────────────────────────── 05 Mecanismo ─────────────────────────────

def _pl():
    return P.pin_lengths()


def fasteners_table():
    pl = _pl()
    return [
        ('Eje de bisagra (×3)', f'Varilla de LATÓN Ø2 × 56', 'Ajuste en el anillo (Ø2,1) + gota de cianoacrilato SOLO en los extremos; libre en la valva', 'No magnético'),
        ('Cola–biela (×3)', 'Pasador de LATÓN Ø2 × 9', 'A presión en la cola, libre en la biela', 'No magnético'),
        ('Biela–orejeta del plato (×3)', f'Pasador de latón Ø2 × {F(pl["biela_plato"])} + `Pin_Head` + `Push_Nut`', 'Cabeza impresa pegada; tuerca impresa a presión', 'Se saca con alicate para cambiar de módulo'),
        ('Horquilla–empujador', f'Pasador de latón Ø2 × {F(pl["horquilla"])} + `Pin_Head` + `Push_Nut`', 'Igual', ''),
        ('Empujador–horn', 'Tornillo chico que trae el servo', 'Rosca en el horn', 'Único tornillo metálico (viene con el servo)'),
        ('Topes (×3)', f'Pasador de latón Ø2 × {F(pl["tope"])} + `Pin_Head` + `Push_Nut`', 'Cabeza en el rebaje superior; tuerca a presión en la trampa de la brida', 'No magnético (junto a los Hall)'),
        ('Columnas → base (×3)', 'Espárrago M6 impreso en la columna', 'Rosca hembra M6 impresa en la base + asiento cónico 45°', 'Se enrosca a mano'),
        ('Anillo → columnas (×3)', 'Espárrago M6 de la columna + `Knurled_Nut_M6`', 'Tuerca moleteada sobre la comisura', 'Con los dedos'),
        ('Orejas del servo (×2)', 'Tornillos que trae el servo', 'Autorroscante en piloto Ø1,8', 'Vienen con el servo'),
        ('Soporte del servo → base (×4)', '`Bolt_M6x8` impreso', 'Rosca hembra M6 impresa en la base', 'Fuera de la huella del servo'),
        ('Bandeja → base (×2)', '`Bolt_M6x8` impreso', 'Rosca M6 en la base (2 en diagonal; hay 4 agujeros)', 'Antes de colocar la placa'),
        ('Placa perforada (×4)', '`Turn_Button` impreso', 'Espiga en el poste, gira con fricción sobre el borde de la placa', 'Sin tornillos'),
        ('Soporte M1 → base (×2)', '`Bolt_M6x8` impreso', 'Rosca M6 en la base, por las ranuras', 'Ajuste radial ±8 mm'),
        ('Pivote de M1', f'Pasador de latón Ø2 × {F(pl["pivote_M1"])} + `Pin_Head` + `Push_Nut`', 'La presión de la tuerca regula la fricción', ''),
        ('Portasensores Hall (×3)', '—', 'Encastre desde arriba + gota de silicona en la pestaña', 'Extraíble con gancho'),
    ]


def doc_mecanismo(V):
    kin = V['kinematics']
    modes = []
    for mode, rows in kin.items():
        th = np.array([r['theta'] for r in rows])
        modes.append(f"| {mode} | {', '.join(K.MODES[mode])} | " + ' · '.join(f'v{i+1}: {F(th[:, i].min(), 0)}→{F(th[:, i].max(), 0)}°' for i in range(3)) + ' |')
    horn = '\n'.join(f"| {F(h['horn_r_mm'], 0)} | " + (f"±{F(h['barrido_deg'])}° | {F(h['comando_deg'][0])}–{F(h['comando_deg'][1])}° | {F(h['columna_mm'], 2)} | {F(h['par_kgcm'], 3)} |"
                     if h['valido'] else f"— | — | — | {h['motivo']} |") for h in V['horn_table'])
    fast = '\n'.join(f'| {a} | {b} | {c} | {d} |' for a, b, c, d in fasteners_table())
    sv = V['servo']; dr = V['drive']
    vel = '\n'.join(f"| {r['t_apertura_ms']} | {F(r['vel_pico_deg_s'], 0)} | ×{F(r['margen_x'])} |" for r in dr['velocidades'])
    clr = sorted(V['clearance'].items(), key=lambda kv: kv[1]['min_mm'])
    clr_t = '\n'.join(f"| {k} | {F(v['min_mm'], 2)} | {v['mode']} | {F(v['beta'])}° |" for k, v in clr)
    t = f"""# 05 · Revisión del mecanismo

{HEAD}
## 1. Geometría [GEOM/SIM]
- Valvas de {F(C.LEAF_T)} mm sobre ejes de latón a {F(C.HINGE_D, 0)} mm del centro; holgura con la pared ≥ {F(C.WALL_CLEAR)} mm hasta {F(C.THETA_DESIGN, 0)}°; separación entre bordes
  al cerrar {F(2 * C.EDGE_GAP)} mm (sin contacto valva–valva).
- Carrera del plato {F(K.STROKE, 3)} mm; radio del horn {F(K.CRANK_R)} mm → barrido ±{F(K.SWEEP)}° (comando {F(90 - K.SWEEP)}° = abierta, {F(90 + K.SWEEP)}° = cerrada).
- Bujes del plato con {F(C.BUSH_CLEAR)} mm de holgura radial y {F(C.BUSH_H, 0)} mm de largo; holgura de piezas móviles {F(C.CLR_MOVE, 2)} mm.

## 2. Modos, piezas intercambiables y simultáneas [CÁLCULO]
| Modo | Módulos (valva 1, 2, 3) | Recorrido de cada valva |
|---|---|---|
{chr(10).join(modes)}

- **Siempre montadas:** anillo, 3 valvas con imán, 3 portasensores Hall, plato, empujador, columnas, servo, micrófono en su soporte.
- **Intercambiables por valva:** `Link_Normal` + tope 84° (normal) **o** `Link_LostMotion` + tope 60°/45° + elástico (restringida/asimétrica) **o** `Link_LostMotion_IC` + tope 84° +
  elástico (cierre incompleto). Asimétrico = valva 1 con 60° y valva 2 con 45°.
- **Nunca se fuerza el servo contra un tope:** en modo normal la valva llega a 80° y el tope está en 84°; en los modos alterados la ranura de la biela absorbe el resto de la
  carrera. Además, el firmware limita el ángulo calibrado (−8…86° por defecto) y **se detiene si ninguna valva se mueve** durante un movimiento ordenado.

## 3. Transmisión, punto muerto y velocidad [CÁLCULO]
- Ángulo mínimo entre palanca y empujador respecto de 0°/180° en todo el recorrido: **{F(dr['margen_punto_muerto_deg'])}°** (lejos del punto muerto).
- Par: fuerza en el empujador {F(sv['force_N'], 2)} N → {F(sv['torque_kgcm'], 3)} kg·cm frente a 1,8 kg·cm del MG90S (dato de distribuidores, **no verificado**; servo real por
  confirmar) → margen ×{F(sv['margin_x'])}.
- Velocidad pico pedida (perfil coseno) frente a 600 °/s sin carga (dato no verificado):

| t_apertura (ms) | velocidad pico (°/s) | margen |
|---|---|---|
{vel}

{dr['nota']}

## 4. Radio del horn [CÁLCULO]
Medir el agujero elegido, escribirlo en `config.SERVO.horn_r` y regenerar (`build_all.py`, `verify.py`, `make_docs_v3.py`).

| r horn (mm) | barrido | comando | columna (mm) | par (kg·cm) |
|---|---|---|---|---|
{horn}

## 5. Efecto cajón del plato [CÁLCULO]
{V['plate_binding']['lectura']}

## 6. Holguras mínimas en el barrido [SIM]
| Par | mínimo (mm) | modo | servo β |
|---|---|---|---|
{clr_t}

## 7. Uniones, rigidez, fricción y acceso
| Unión | Elemento | Retención | Nota |
|---|---|---|---|
{fast}

Acceso comprobado [SIM]: {sum(c['ok'] for c in V['assembly'])} de {len(V['assembly'])} comprobaciones (ejes, pasadores, acceso con los dedos a pernos y tuercas M6, pestillos, extracción de portasensores, USB).
Fricción: grasa PTFE en bujes y columnas. Rigidez de PETG y juego real de bisagras: se miden con la galga (histéresis) en el ensayo 3. [FÍSICO]

## 8. Cables
Hall: por el canal del portasensor y la bajada exterior del anillo; pinzas en las columnas bajo el recorrido del plato; señales por el sur de la base, servo y 5 V por el norte
(separación ≥ 20 mm). Recorridos modelados como haces y verificados en el barrido (sin interferencias). [SIM]

## 9. Animación
Se calcula cuadro a cuadro con la misma cinemática del CAD. **No es una prueba de funcionamiento ni una medición.**
"""
    w('05_Mecanismo_Revision.md', t)


# ───────────────────────────── 06 Electrónica ─────────────────────────────

PINS = [
    ('GPIO36 (VP)', 'H1 Hall valva 1', 'entrada analógica', 'ADC1_CH0', 'Solo entrada'),
    ('GPIO39 (VN)', 'H2 Hall valva 2', 'entrada analógica', 'ADC1_CH3', 'Solo entrada'),
    ('GPIO32', 'H3 Hall valva 3', 'entrada analógica', 'ADC1_CH4', ''),
    ('GPIO26', 'INMP441 SCK', 'salida', 'I2S1 BCLK', '33 Ω en serie'),
    ('GPIO25', 'INMP441 WS', 'salida', 'I2S1 WS', ''),
    ('GPIO27', 'INMP441 SD', 'entrada', 'I2S1 DIN', 'L/R del INMP441 a GND'),
    ('GPIO18', 'PWM servo', 'salida', 'LEDC 50 Hz, 16 bits', '220 Ω serie + 10 kΩ a GND'),
    ('GPIO19', 'LED de sincronización', 'salida', '', '330 Ω + LED a GND'),
    ('GPIO23', 'Parada por software', 'entrada', 'pull-up interno', 'contacto NA a GND'),
    ('GPIO2', 'LED de la placa', 'salida', '', 'pin de arranque: sin carga externa'),
    ('GPIO1 / GPIO3', 'UART0 (USB)', '—', 'protocolo binario', 'reservado'),
    ('3V3', 'INMP441', 'alimentación', '', 'regulador de la placa + 100 nF'),
    ('VIN / 5V (del USB)', 'MCP1700-3302 → 3V3_A (solo los 3 Hall)', 'alimentación', '', 'NUNCA conectar +5V_SERVO'),
    ('GND', 'masa', '—', '', 'unión a la estrella ★'),
    ('Libres', 'GPIO33, GPIO34, GPIO35 (ADC1, reserva)', '', '', 'quedan sin conectar'),
    ('No usar', 'GPIO6–11 (flash), GPIO0/5/12/15 (arranque), ADC2 (sin DMA)', '', '', ''),
]

KEEP = [
    ('MCP1700-3302 + 1 µF/1 µF', 'Alimentación limpia y propia de los Hall (salida ratiométrica: el ruido de la alimentación aparece en la lectura)'),
    ('100 nF junto a cada Hall', 'Desacoplo recomendado por los fabricantes de sensores Hall lineales'),
    ('RC 1 kΩ / 100 nF por canal Hall', 'Antialias (fc ≈ 1,6 kHz < 4 kHz, mitad de 8 kS/s por canal) y reserva de carga para el muestreo del ADC'),
    ('Divisor 20 kΩ/30 kΩ (solo opción B)', 'Reduce una salida de 5 V a ≤ 3 V: **no se conectan señales de 5 V directamente al ESP32**'),
    ('PTC 2,5 A, AO3401A, SMBJ5.0A', 'Protección de la fuente del servo: sobrecorriente, polaridad invertida, sobretensiones'),
    ('1000 µF bajo ESR + 100 nF', 'Picos de corriente del servo junto a su conector'),
    ('S1 (NC) + J1', 'Corte físico de la potencia del servo y desconexión para los ensayos sin servo'),
    ('220 Ω + 10 kΩ en PWM', 'Limita corriente y mantiene la señal en bajo mientras el ESP32 arranca'),
    ('33 Ω en SCK', 'Reduce flancos y reflexiones en el cable del micrófono'),
]


def link_budget():
    hdr = 9 + 16
    items = [('Hall H1–H3 (1 kS/s, 16 bits, bloques de 32)', 3 * 1000 * 2 + 1000 / 32 * hdr),
             ('Audio 8 kHz 16 bits (bloques de 256)', 8000 * 2 + 8000 / 256 * hdr),
             ('Comando del servo (200 Hz, solo en movimiento)', 200 * (17 + 9)),
             ('Estado (2 Hz) + eventos (≈ 20/s)', 2 * (75 + 9) + 20 * 22)]
    return items, sum(v for _, v in items)


def doc_electronica():
    pins = '\n'.join(f'| {a} | {b} | {c} | {d} | {e} |' for a, b, c, d, e in PINS)
    keep = '\n'.join(f'| {a} | {b} |' for a, b in KEEP)
    bw, tot = link_budget()
    bwt = '\n'.join(f'| {a} | {F(b / 1000, 2)} |' for a, b in bw)
    link = 921600 / 10
    t = f"""# 06 · Electrónica, esquema y tabla de pines

{HEAD}
Esquemas: `Electronica/Hoja1_Alimentacion_Servo` y `Electronica/Hoja2_Hall_MEMS` (SVG y PNG), generados con `hardware/electronica/esquema.py`.
Fuentes: Espressif (ESP32 Datasheet, Technical Reference Manual, ESP-IDF v5.4: ADC continuo, I2S, LEDC), TI DRV5055, TDK InvenSense INMP441, Microchip MCP1700.
**Las hojas de datos de TI y Diodes no se pudieron descargar desde este entorno** (bloqueo de red): los valores tomados de ellas están marcados VERIFICAR.
Ningún circuito fue armado ni medido todavía [FÍSICO].

## 1. Tabla de pines (ESP32 DevKit V1 — VERIFICAR con la serigrafía de su placa)
| Pin | Señal | Dirección | Periférico | Nota |
|---|---|---|---|---|
{pins}

## 2. Hall: dos opciones según el sensor real
- **Opción A (recomendada): DRV5055A1 a 3,3 V** desde 3V3_A. Salida 0,2–3,1 V aprox., centrada en VCC/2 sin campo; con el imán orientado para que la salida **baje** queda entre
  ≈ 0,5 y 1,65 V, dentro del rango lineal del ADC con 12 dB de atenuación. RC 1 kΩ/100 nF antes del ADC.
- **Opción B: sensor de 5 V (49E/SS49E/AH49E o DRV5055 a 5 V).** Salida de hasta ≈ 4–4,5 V → **divisor 20 kΩ/30 kΩ (×0,6)** antes del RC: máximo ≈ 2,7 V en el pin.
  Sensibilidad efectiva menor (doc 03). Alimentación de los sensores desde 5 V del USB, con 100 nF junto a cada uno.
- **Módulos con comparador o A3144:** salida digital, no sirve para medir el ángulo (doc 02).

## 3. Micrófono INMP441
3,3 V con 100 nF; L/R a GND (canal izquierdo); I2S1 maestro a 16 kHz, palabra de 32 bits (dato de 24 bits). Cable ≤ 20 cm con GND entre SCK y SD, lejos del servo y de los
cables de 5 V. Soporte independiente con el puerto acústico libre (doc 08).

## 4. Alimentación, masas y protección
- **Servo:** fuente externa de 5 V. Dimensionar con la corriente de bloqueo del **servo real** (dato por confirmar); para un micro servo, 5 V ≥ 2 A (3 A recomendado).
  PTC 2,5 A, P-MOS AO3401A contra polaridad invertida, TVS SMBJ5.0A, 1000 µF de bajo ESR + 100 nF en el conector J1 (con traba y polaridad marcada). S1 (NC) corta la potencia.
- **ESP32:** solo por USB. **+5V_SERVO nunca se une a VIN/5V**: así no hay realimentación entre la fuente externa y el USB; solo se comparten las masas en un punto ★.
- **Masa en estrella:** retorno del servo con su propio cable hasta ★; masas de los Hall y del micrófono juntas y unidas a ★ por un solo punto.
- **PWM a 3,3 V:** muchos micro servos lo aceptan (VERIFICAR con el servo real). Si no, 74AHCT125 alimentado a 5 V.
- **Ninguna señal de 5 V va directa a un pin del ESP32.**

## 5. Componentes que se mantienen y por qué
| Componente | Justificación |
|---|---|
{keep}

**Eliminados en v3:** MCP6004/MCP6022, BAT54S y la red del canal piezoeléctrico, INA219 y el canal del Hall del plato.

## 6. Recursos del ESP32 clásico [CÁLCULO + COMPILACIÓN]
- El **ADC continuo (DMA) usa I2S0** en el ESP32 clásico → el micrófono va en **I2S1**.
- **ADC2 no tiene DMA** y choca con Wi-Fi → los 3 Hall están en ADC1.
- Muestreo **secuencial**: patrón H1 H2 H3 a 24 kS/s (mínimo admitido por el driver: 20 kS/s) → 8 kS/s por canal → suma de 8 → **1 kS/s por valva**. Desfase fijo entre valvas:
  0 / 41,7 / 83,3 µs (informado en INFO).
- LEDC (PWM) y esp_timer (marcas en µs) son independientes del ADC y del I2S.

## 7. Capacidad del enlace USB-serie [CÁLCULO]
| Flujo | kB/s |
|---|---|
{bwt}
| **Total** | **{F(tot / 1000, 1)}** |

A 921 600 baudios (8N1) caben {F(link / 1000, 1)} kB/s → uso ≈ {F(100 * tot / link, 0)} %. Datos binarios con CRC.
"""
    w('06_Electronica_y_Pines.md', t)


# ───────────────────────────── 07 Firmware ─────────────────────────────

def doc_firmware():
    t = f"""# 07 · Firmware de adquisición y control (ESP-IDF)

{HEAD}
Carpeta `Firmware/{FW}/`. **Estado:** compila con **ESP-IDF v5.4.1** para `esp32` sin advertencias en el código propio [COMPILACIÓN]. **No se probó en hardware** (no hay
placa en este entorno). El archivo de restricciones de Python de Espressif (dl.espressif.com) estaba bloqueado por la red: se instalaron versiones compatibles desde PyPI con la
opción oficial `--no-constraints`.

## Compilar y grabar (Mac)
```
. $HOME/esp/esp-idf/export.sh          # ESP-IDF v5.4.x según la guía de Espressif
cd Firmware/{FW}
idf.py set-target esp32 && idf.py build
idf.py -p /dev/cu.usbserial-XXXX flash   # no usar 'monitor': el puerto lleva datos binarios
```

## Tareas (FreeRTOS)
| Núcleo | Tarea | Prio | Disparo | Función |
|---|---|---|---|---|
| 1 | adc | 10 | fin de búfer DMA (96 juegos = 12 ms) | demultiplexa H1–H3, suma de 8, saturación, huecos, marcas de tiempo |
| 1 | i2s | 9 | fin de búfer DMA (16 ms) | audio: FIR y diezmado a 8 kHz, saturación |
| 0 | servo | 8 | 5 ms | perfil coseno no bloqueante, límites, falta de movimiento, latido |
| 0 | tx | 5 | cola | tramas por UART0 (búfer 48 kB ≈ 0,5 s) |
| 0 | cmd | 4 | líneas de texto | comandos y calibración |
| 0 | main | 1 | 500 ms | trama de estado |

## Tasas, búferes y sincronización
- ADC1 a 24 kS/s, 12 bits, 12 dB; 3 canales → **1 kS/s por valva** (bloques de 32 muestras). Audio: I2S1 16 kHz → 8 kHz (FIR 47 coef.), bloques de 256.
- Un solo reloj (`esp_timer`, µs) para Hall, audio, comandos y eventos. Retardo del FIR de audio descontado. Desfase entre valvas informado.
- El comando PWM se aplica en el siguiente período de 20 ms: la posición REAL se toma de los Hall.
- Pérdidas: contadores de desborde del ADC/I2S, huecos de patrón y tramas descartadas en STATUS; secuencia por trama.

## Calibración en el ESP32
`CAL BEGIN n`, `CAL PT n lectura ángulo`, `CAL END n`, `CAL CLEAR n`: tabla por sensor (≤ 32 puntos) en NVS con CRC32. Validación: ≥ 5 puntos, estrictamente monótona, sin
lecturas repetidas, rango ≥ 30°. Sin calibración válida el firmware sigue enviando la lectura cruda, marca `cal_valid = 0` y **no aplica límites en grados**.

## Seguridad
- Arranca **sin pulsos** al servo. Límites de comando por software y límites de ángulo calibrado (`SET lim_min/lim_max`, −8…86° por defecto).
- **Falta de movimiento:** si durante un movimiento ordenado ninguna valva cambia su lectura ≥ `stall_min_delta` (200 cuentas de la suma de 8, ajustable con `SET stall`) → parada
  controlada y evento. Se desactiva con `SET stall 0` para el ensayo con el servo desacoplado.
- Parada de emergencia (GPIO23) y corte físico S1; latido `HB` de la computadora (2 s); falla de adquisición → parada.

## Protocolo
Trama `A5 5A | tipo | largo | secuencia | carga | CRC16`. Tipos: INFO=1 (JSON: versión, tasas, desfase, calibración), HALL=3, AUDIO=4, CMD=5, EVENT=6, STATUS=7 (75 bytes), TEXT=8.
Espejo en `Herramientas_Mac/cvai_proto.py`. Comandos: `PING, HB, INFO, STREAM ON|OFF, START n, STOP, DETACH, MOVE grados ms, SET clave valor, CAL …`.
"""
    w('07_Firmware.md', t)


# ───────────────────────────── 08 Herramientas y visualización ─────────────────────────────

def doc_herramientas():
    st_zpiv, st_tilt = P.stand_heights()
    t = f"""# 08 · Herramientas (Mac), visualización y micrófono

{HEAD}
Carpeta `Herramientas_Mac/`. Python ≥ 3.10: `python3 -m pip install -r requirements.txt`. Puerto en Mac: `ls /dev/cu.*`.

| Programa | Uso |
|---|---|
| `cvai_record.py` | Registra una sesión (`raw.bin` sin modificar, `session.json`, `session.npz`, `audio.wav`). `--live`: lectura **cruda** de cada Hall; ángulo **estimado** solo si hay calibración válida (si no, «SIN CALIBRACIÓN VÁLIDA»); comando del servo en un eje aparte; audio sincronizado; estado de calibración, saturación, pérdidas y paradas. `--sensor`, `--iman`, `--portasensor` quedan en `session.json`. |
| `cvai_calibrate.py` | `galgas`, `video`, `ajustar`, `subir`, `comparar` (doc 04). |
| `cvai_analyze.py` | Por ciclo: inicio y fin de apertura y cierre (criterios abajo), duración, amplitud, residual, retardos, diferencias entre valvas y entre ciclos, alertas. `--crear-umbrales` calcula umbrales con sesiones normales reales. |
| `cvai_emulator.py` | **Datos SINTÉTICOS** por un puerto virtual con el mismo protocolo, para probar el software. Todo lo que produce queda marcado «SINTÉTICO». |
| `tests/test_e2e.py` | Emulador → registro → calibración → análisis. **Aprobada** en este entorno [SW]. |

## Criterios de eventos (propuestos)
- Base = mediana 20–200 ms antes de la orden de apertura; meseta = mediana del 60 % final de la espera abierta; residual = mediana del 40 % final de la espera cerrada.
- Inicio de apertura = cruce de base + 10 % de la amplitud de referencia; fin = cruce de base + 90 % de la amplitud del ciclo; cierre simétrico. Sin calibración, sobre la lectura
  cruda y rotulado así.
- Apertura incompleta / cierre incompleto / asimetría / retraso / variación: comparación con umbrales de sesiones normales repetidas (mediana y MAD); sin ese archivo, solo
  comparación dentro de la sesión, rotulada «provisional». Atasco: amplitud < 60 % de la de referencia (propuesto); atasco del mecanismo si las 3 valvas quedan por debajo.

## Datos reales y de demostración
El campo `fuente` de `session.json` viene de la trama INFO del firmware; el emulador declara «EMULADOR — DATOS SINTÉTICOS». Nunca se mezclan para crear umbrales.
**Sin IA:** no hay datos suficientes. Si más adelante se entrena un clasificador, separar entrenamiento y evaluación por sesión.

## Micrófono M1 (señal complementaria)
- Soporte independiente `MEMS_Stand` a {F(C.MEMS_STAND_R, 0)} mm del eje (ranura ±8 mm), pivote de inclinación (nominal {F(st_tilt)}°), puerto acústico libre.
  No toca el anillo: reduce la transmisión estructural directa.
- Fuentes de ruido: ambiente, servo (motor y engranajes, durante todo el movimiento) y vibración a través de la base. **No se supone que haya «clics»** de apertura o cierre: en
  modo normal no hay contacto valva–valva ni valva–tope.
- Se evalúa con el contraste de audio en ventanas alrededor de los eventos medidos por los Hall frente a la mitad del recorrido y al reposo (`cvai_analyze.py`).
"""
    w('08_Herramientas_Visualizacion_Microfono.md', t)


# ───────────────────────────── 09 Ensayos · 10 Pendientes ─────────────────────────────

TESTS = [
    ('1. Probetas', 'Imprimir `Tolerance_Coupon`, `Thread_Coupon`, un `Bolt_M6x8`, una `Pin_Head` y una `Push_Nut`: latón libre y a presión, paso M6, espiga del pestillo, imanes Ø4, roscas M6.',
     'Eje libre gira sin juego visible; a presión no sale con la mano; perno M6 entra a mano en una de las 3 roscas sin juego visible; la tuerca a presión resiste un tirón firme con los dedos; imán entra con presión leve. Anotar diámetros y actualizar `config.py`.'),
    ('2. Una valva con Hall e imán, a mano', 'Anillo + valva 1 + portasensor; mover la valva a mano 0–80°; registrar con `--ciclos 0`.',
     'Lectura monótona sin saturar (cuentas lejos de 0 y 4095); variación cerrada→abierta ≥ 10 veces el ruido estático.'),
    ('3. Calibración y video', 'Galgas 0–80°, apertura y cierre, 3 repeticiones; video con `Angle_Scale`.',
     'Monótona; puntos distinguibles; resolución ≤ 1°, repetibilidad ≤ 1°, histéresis ≤ 2°; galga vs. video ≤ 1,5°.'),
    ('4. Repetir en las otras valvas', 'Ensayos 2–3 en las valvas 2 y 3; cada Hall con su valva quieta mientras se mueven las otras.',
     'Mismos criterios; variación por las valvas vecinas < resolución.'),
    ('5. Mecanismo completo a mano', 'Empujador desconectado; mover el plato a mano en cada modo.',
     'Sin trabas ni roces; recorridos según la tabla de modos ± 3°; fuerza para mover el plato anotada (objetivo < 1 N).'),
    ('6. Eléctrico con servo desacoplado', 'Servo sin horn conectado al empujador; `SET stall 0`; registrar Hall y audio.',
     'Sin pérdidas ni errores CRC en 10 min; variación de los Hall por el servo < resolución; ruido de audio del servo registrado.'),
    ('7. Normal a baja velocidad', 't_apertura ≥ 1500 ms, 30 ciclos, video sincronizado con el LED.',
     'Meseta 80 ± 3°, residual ≤ 2°, diferencia entre valvas ≤ 3°, CV de duraciones < 5 %; ninguna parada.'),
    ('8. Una alteración conocida', 'Ej.: tope de 60° en la valva 1; 30 ciclos, con 10 normales antes y después.',
     'Los ciclos alterados se marcan con el motivo correcto; los normales quedan dentro de los umbrales.'),
    ('9. Repetición', '≥ 3 sesiones en días distintos; desmontar y volver a montar portasensores entre sesiones.',
     'Mediana y MAD por métrica → umbrales (`--crear-umbrales`); calibración tras remontaje dentro de la repetibilidad.'),
]


def doc_ensayos():
    rows = '\n'.join(f'| {a} | {b} | {c} |' for a, b, c in TESTS)
    t = f"""# 09 · Plan de validación física progresiva

{HEAD}
Los criterios son **objetivos propuestos, no resultados.** Ningún ensayo físico se realizó todavía. Cada ensayo se registra con `cvai_record.py` (fuente = ESP32) y video.

| Ensayo | Procedimiento | Criterio de aceptación propuesto |
|---|---|---|
{rows}

**Video:** ≥ 60 cuadros/s; el LED de sincronización debe verse (eventos `SYNC_LED_ON`).
**No se avanza** al ensayo siguiente sin cumplir el anterior; si falla, se corrige la causa (geometría, montaje, cableado) y se repite.
"""
    w('09_Plan_de_Ensayos.md', t)


def doc_pendientes():
    t = f"""# 10 · Pendientes de medición o ensayo físico

{HEAD}
- Datos de la lista única (doc 02): Hall, imanes, servo, ESP32, INMP441 → regenerar piezas afectadas.
- Diámetros reales de agujeros, ajustes a presión e imanes (probeta); ajuste y resistencia de las roscas M6 impresas y retención de las tuercas a presión (probetas, ensayo 1).
- Respuesta real de cada par Hall–imán; saturación; monotonía; ruido real del ADC.
- Calibración real: resolución, repetibilidad, histéresis, exactitud frente al video; repetición tras remontaje.
- Influencia real de las valvas vecinas y del servo sobre cada Hall.
- Firmware en la placa (no probado en hardware): tasas reales, pérdidas, paradas, PWM aceptado por el servo a 3,3 V.
- Par, velocidad y corriente de bloqueo del servo real; fricción del plato; efecto cajón.
- Si el audio aporta información sobre los eventos.
- Umbrales de anomalía a partir de sesiones normales repetidas.
- Todos los criterios del doc 09.
"""
    w('10_Pendientes_Fisicos.md', t)


# ───────────────────────────── guías, BOM, informe, LEEME ─────────────────────────────

NOT_FINAL = {'Electronics_Tray', 'Turn_Button', 'Servo_Mount', 'MEMS_Stand_Holder', 'Base', 'Hall_Carrier_000', 'Hall_Carrier_025', 'Hall_Carrier_050'}
CRITICAL = {'Valve_Ring': 'paredes del bolsillo Hall y agujeros de bisagra', 'Leaflet_1': 'alojamiento del imán y barril', 'Leaflet_2': 'alojamiento del imán y barril',
            'Leaflet_3': 'alojamiento del imán y barril', 'Actuator_Plate': 'bujes', 'Column': 'superficie de deslizamiento',
            'Hall_Carrier_000': 'lomo y pestaña', 'Hall_Carrier_025': 'lomo y pestaña', 'Hall_Carrier_050': 'lomo y pestaña',
            'Base': 'roscas M6 (5 perímetros alrededor)', 'Bolt_M6x8': 'rosca', 'Knurled_Nut_M6': 'rosca', 'Thread_Coupon': 'roscas',
            'Pin_Head': 'agujero a presión', 'Push_Nut': 'agujero a presión', 'Turn_Button': 'espiga'}


def doc_impresion(V):
    pm = {r['part']: r for r in V['print_meshes']}
    rows = []
    for it in R.ITEMS:
        if not it.printable:
            continue
        r = pm[it.name]
        nf = ' **NO DEFINITIVA**' if it.name in NOT_FINAL else ''
        crit = CRITICAL.get(it.name, 'cara de contacto' if it.name.startswith('Calib_Gauge') else '')
        rows.append(f"| `{C.PREFIX}_{it.name}.stl`{nf} | {it.qty} | {' × '.join(F(v, 1) for v in r['size_mm'])} | {F(r['mass_g_petg'], 1)} | {it.layer} mm · {it.infill} · {it.walls} perím. | "
                    f"{'sí' if r['needs_support'] else 'no'} | {crit} | {it.notes} |")
    t = f"""# Guía de impresión {RV}

{HEAD}
**Supuestos sobre la impresora (VERIFICAR):** FDM con boquilla 0,4 mm, cama ≥ 220 × 220 mm, PETG a 230–245 °C, cama 70–80 °C, flujo calibrado. Unidades de los STL:
**milímetros**; ya están orientados para la cama. Las tolerancias del diseño suponen ±0,1–0,2 mm: **la probeta decide** los diámetros finales.

**Primero imprimir las probetas:**
- `{C.PREFIX}_Tolerance_Coupon.stl` (5 filas): 1 eje Ø2 libre · 2 eje Ø2 a presión (también decide `PIN_PRESS_HOLE` de cabezas y tuercas a presión) ·
  3 pilotos M2/M3 · 4 paso M6 (6,4 / 6,6 / 6,8) y espiga del pestillo (3,9 / 4,0 / 4,1) · 5 imanes Ø4 (4,05–4,30).
- `{C.PREFIX}_Thread_Coupon.stl` + un `{C.PREFIX}_Bolt_M6x8.stl`: elegir la rosca (1, 2 o 3 muescas = compensación 0,10 / 0,20 / 0,30 mm) en la que el perno entra **a mano**
  sin juego visible. `THREAD_COMP` = (0,15 del perno + la del agujero elegido) / 2 → 1 muesca: 0,125 · 2 muescas: 0,175 · 3 muescas: 0,225.
Actualizar `config.py` (`PIN_HOLE_LEAF`, `TAIL_PIN_HOLE`, `LINK_HOLE`, `PIN_PRESS_HOLE`, `M6_CLEAR`, `TURN_PEG_D`, `THREAD_COMP`, `MAG_POCKET_CLR`) y regenerar:
`python build_all.py && python verify.py && python make_docs_v3.py`.

Las piezas **NO DEFINITIVA** dependen de datos pendientes (doc 02). Ninguna pieza se imprimió ni se probó todavía: **no se declara «listo para imprimir»**; las mallas
pasaron las comprobaciones geométricas del informe de validación.

| Archivo | Cant. | Tamaño (mm) | Masa PETG (g) | Parámetros | Soporte | Superficie crítica | Nota |
|---|---|---|---|---|---|---|---|
{chr(10).join(rows)}

**Fijaciones impresas** (pernos, tuercas, cabezas, tuercas a presión, pestillos, columnas): 100 % de relleno, capa 0,12 mm, ≥ 4 perímetros, sin «ironing».
Pernos verticales con la cabeza en la cama; columnas verticales empezando por el espárrago inferior. La base lleva 5 perímetros para que las roscas queden en material macizo.
Ver `11_Fijaciones_Impresas.md`.
"""
    w(f'Guia_de_Impresion_{RV}.md', t)


def doc_ensamblaje():
    pl = P.pin_lengths()
    t = f"""# Guía de ensamblaje {RV}

{HEAD}
Herramientas: alicate de punta, calibre, gancho fino, sierra o alicate de corte para latón, lima, cianoacrilato, silicona neutra, grasa PTFE, bridas finas.
**No hace falta soldador de insertos ni llaves:** todas las uniones roscadas son M6 impresas y se aprietan **con los dedos** (una herramienta barre la rosca de plástico).

1. **Probetas:** `Tolerance_Coupon` (latón, imanes, paso M6, espiga del pestillo) y `Thread_Coupon` + un `Bolt_M6x8` (rosca). Ajustar `config.py` y regenerar si hace falta.
2. **Cortar la varilla de latón Ø2:** 3 × 56 mm (ejes), 3 × 9 mm (cola–biela), 3 × {F(pl['tope'])} mm (topes), 3 × {F(pl['biela_plato'])} mm (bielas),
   1 × {F(pl['horquilla'])} mm (horquilla), 1 × {F(pl['pivote_M1'])} mm (pivote del micrófono). Limar las puntas.
3. **Cabezas de pasador:** a presión una `Pin_Head` en un extremo de cada pasador de topes, bielas, horquilla y pivote, con una gota de cianoacrilato. Dejar secar.
4. **Imanes:** uno por valva en la cola, con cianoacrilato y **la misma cara hacia afuera en las tres**.
5. **Columnas → base:** enroscar cada columna a mano en su rosca de la base hasta que el cono asiente. Sin herramientas.
6. **Servo:** centrarlo (90°) antes de colocar el horn; al `Servo_Mount` con sus tornillos; soporte a la base con 4 `Bolt_M6x8` apretados con los dedos.
7. **Plato:** grasa PTFE en los bujes; deslizar sobre las columnas. Empujador a la horquilla: pasador con cabeza desde −y y `Push_Nut` empujada con alicate.
8. **Valvas + bielas:** pasador Ø2×9 a presión en la cola, biela en el pasador.
9. **Valvas en el anillo:** eje de latón Ø2×56 desde afuera; cianoacrilato solo en los extremos. Girar a mano 0–90° sin roce.
10. **Topes:** `Opening_Stop_84` desde abajo; pasador con cabeza desde arriba por el agujero del anillo; `Push_Nut` en la trampa hexagonal de la brida, empujada hasta que el tope quede firme.
11. **Hall:** sensor pegado al lomo del portasensor `000` con una gota de silicona; insertar desde arriba hasta que apoye la pestaña.
12. **Anillo sobre las columnas:** servo en posición abierta (plato abajo); unir cada biela a su orejeta (pasador con cabeza + `Push_Nut`); bajar el anillo por los
    espárragos y colocar las 3 `Knurled_Nut_M6`, apretadas con los dedos.
13. **Comprobar a mano** (ensayo 5) con el empujador desconectado y luego conectado.
14. **Micrófono:** placa en `MEMS_Stand_Holder`; pivote con pasador + `Push_Nut` (más presión = más fricción); soporte a la base con 2 `Bolt_M6x8` por las ranuras.
15. **Electrónica:** bandeja a la base con 2 `Bolt_M6x8` (en diagonal) ANTES de la placa; placa perforada sobre los rieles; los 4 `Turn_Button` en sus postes, girados hacia
    la placa. Comprobar 3V3_A y la salida de cada Hall con multímetro **antes** de conectar el ESP32.
16. **Cables:** pinzas en las columnas; señales por el sur, servo/5 V por el norte; mover el servo a mano y comprobar que nada roce.
17. **Desarme:** las `Push_Nut` se sacan haciendo palanca con el alicate (si quedan flojas, usar una nueva: hay 2 de repuesto). Revisar las roscas M6 después de 24 h
    (el PETG se asienta): volver a apretar con los dedos si hace falta.
"""
    w(f'Guia_de_Ensamblaje_{RV}.md', t)


def buy_list():
    pl = P.pin_lengths()
    brass = 3 * 56 + 3 * 9 + 3 * pl['tope'] + 3 * pl['biela_plato'] + pl['horquilla'] + pl['pivote_M1']
    return [
        ('ESP32 DevKit V1 (ESP32-WROOM-32)', 1, 'Medidas por confirmar (doc 02)'), ('Servo (modelo por confirmar) + horns + sus tornillos', 1, 'Los tornillos del servo son los únicos metálicos'),
        ('Fuente 5 V ≥ 2 A (3 A recom.)', 1, 'según el servo real'), ('Imán neodimio Ø4×2 mm axial (N42)', 3 + 2, '+2 de repuesto; medidas por confirmar'),
        ('Sensor Hall lineal TI DRV5055A1QLPG (TO-92)', 3 + 1, 'recomendado; verificar modelo (doc 02)'),
        ('INMP441 (placa de módulo)', 1, 'medidas por confirmar'), ('Microchip MCP1700-3302 (TO-92) + 2 × 1 µF', 1, '3V3_A de los Hall'),
        ('AO3401A + 10 kΩ', 1, 'polaridad invertida'), ('PTC 2,5 A', 1, ''), ('TVS SMBJ5.0A', 1, ''), ('Capacitor 1000 µF 10 V bajo ESR', 1, ''),
        ('Capacitores 100 nF cerámicos', 8, 'desacoplo y RC Hall'), ('Resistencias 1 kΩ (×3), 220 Ω, 10 kΩ (×2), 330 Ω, 33 Ω', 1, 'surtido'),
        ('Resistencias 20 kΩ y 30 kΩ (×3 c/u)', 1, 'solo opción B (sensor de 5 V)'),
        ('Placa perforada 7×9 cm', 1, ''), ('Tiras de zócalo hembra 2,54 mm', 2, 'según pines del ESP32'), ('Conector con traba 2 vías (J1) / bornera', 2, '5 V servo'),
        ('Parada de emergencia (NC + NA)', 1, ''), ('LED + 330 Ω', 1, 'sincronización'), ('Cable de 3 hilos fino', 3, 'Hall, ≈ 30 cm'), ('Cable plano 6 hilos', 1, 'micrófono ≤ 20 cm'),
        (f'Varilla de LATÓN Ø2 mm (≥ {int(math.ceil(brass / 50.0) * 50)} mm en total; p. ej. 2 × 300 mm)', 1, f'ejes, pasadores y fijaciones: {F(brass, 0)} mm + corte'),
        ('Filamento PETG 1,75 mm', 1, '1 kg: piezas + todas las fijaciones impresas'),
        ('Grasa PTFE, cianoacrilato, silicona neutra, bridas, patas de goma adhesivas', 1, ''),
    ]


def doc_bom(V):
    pm = {r['part']: r for r in V['print_meshes']}
    rows, csvrows = [], []
    for it in R.ITEMS:
        if it.printable:
            r = pm[it.name]
            nf = 'NO DEFINITIVA' if it.name in NOT_FINAL else ''
            rows.append(f"| {it.name} | {it.qty} | impresa (PETG) | {' × '.join(F(v, 1) for v in r['size_mm'])} mm · {F(r['mass_g_petg'], 1)} g | {it.role} {nf} |")
            csvrows.append([it.name, it.qty, 'impresa PETG', ' x '.join(f'{v:.1f}' for v in r['size_mm']), it.role + (' ' + nf if nf else '')])
    for a, q, n in buy_list():
        rows.append(f'| {a} | {q} | comprada | | {n} |'); csvrows.append([a, q, 'comprada', '', n])
    t = f"""# Lista de materiales {RV} (mínima)

{HEAD}
| Elemento | Cant. | Tipo | Medidas | Función / nota |
|---|---|---|---|---|
{chr(10).join(rows)}
"""
    w(f'Lista_de_Materiales_{RV}.md', t)
    with open(os.path.join(DOC, f'Lista_de_Materiales_{RV}.csv'), 'w', newline='', encoding='utf-8') as f:
        cw = csv.writer(f); cw.writerow(['elemento', 'cantidad', 'tipo', 'medidas_mm', 'nota']); cw.writerows(csvrows)


def doc_informe(V):
    pm = V['print_meshes']
    bad = [r['part'] for r in pm if not (r['watertight'] and r['winding'] and r['manifold_ok'] and r['bodies'] == 1 and r['fits_bed'])]
    clr = '\n'.join(f"| {k} | {F(v['min_mm'], 2)} | {v['mode']} |" for k, v in sorted(V['clearance'].items(), key=lambda kv: kv[1]['min_mm']))
    asm = '\n'.join(f"| {c['check']} | {'✔' if c['ok'] else '✘ ' + ', '.join(c['hits'])} |" for c in V['assembly'])
    gl = '\n'.join(f"| {g['angulo']}° | {'✔' if g['ok'] else '✘'} |" for g in V['gauges'])
    t = f"""# Informe de validación digital {RV}

{HEAD}
Generado: {V['generated']}. Todo lo de este informe se ejecutó sobre los archivos entregados ([SIM], [GEOM], [SW]). **No reemplaza ningún ensayo físico.**

## Mallas de impresión [SW]
{len(pm)} piezas imprimibles; con problemas: {', '.join(bad) or 'ninguna'} (cerradas, orientación coherente, un cuerpo, z mín. = 0, caben en 220 × 220).

## Interferencias [SIM]
{V['sweep']['poses_checked']} poses (25 posiciones × 5 modos) con todas las piezas, imanes, sensores, pasadores, tornillería y cables: **{len(V['sweep']['interferences'])} interferencias**.
Contactos de diseño: {', '.join(sorted(V['sweep']['contacts'])) or 'ninguno'}.

## Holguras mínimas [SIM]
| Par | mm | modo |
|---|---|---|
{clr}

## Montaje y acceso [SIM]
| Comprobación | Resultado |
|---|---|
{asm}

## Galgas de calibración [SIM]
| Galga | Correcta |
|---|---|
{gl}

## Piezas fijas y fijaciones impresas (choques estáticos) [SIM]
| Pieza | Resultado |
|---|---|
{chr(10).join(f"| {c['pieza']} | {'✔' if c['ok'] else '✘ ' + ', '.join(f'{k} ({v} mm³)' for k, v in c['choques'].items())} |" for c in V.get('static', []))}

## Cálculos [CÁLCULO]
Servo: {json.dumps(V['servo'], ensure_ascii=False)}. Accionamiento: {json.dumps(V['drive'], ensure_ascii=False)}. Efecto cajón: {V['plate_binding']['lectura']}
"""
    w(f'Informe_de_Validacion_{RV}.md', t)
    with open(os.path.join(DOC, f'Tabla_Cinematica_{RV}.csv'), 'w', newline='', encoding='utf-8') as f:
        cw = csv.writer(f)
        cw.writerow(['modo', 'comando_servo_deg', 'plato_mm', 'theta1', 'theta2', 'theta3', 'tope1', 'tope2', 'tope3'])
        for mode, rows in V['kinematics'].items():
            for r in rows:
                cw.writerow([mode, r['servo_cmd_deg'], r['plate_mm'], *r['theta'], *r['on_stop']])


def doc_fijaciones(V):
    pl = P.pin_lengths()
    hd, hh = C.BOLT_HEAD
    st = {c['pieza']: c for c in V.get('static', [])}
    bad = [c['pieza'] for c in V.get('static', []) if not c['ok']]
    # cálculos de orden de magnitud (PETG impreso, valores conservadores entre capas)
    tau, sig = 10.0, 10.0                                     # MPa: corte y tracción ENTRE CAPAS (supuestos conservadores, VERIFICAR)
    d1 = C.THREAD_D - 1.0825 * C.THREAD_P                     # diámetro menor ISO de la rosca hembra
    a_strip = 0.5 * math.pi * C.THREAD_D * 5.0                # área de barrido aprox. con 5 mm de rosca
    f_strip = a_strip * tau
    a_stud = math.pi * (C.THREAD_D - 1.2269 * C.THREAD_P) ** 2 / 4
    f_stud = a_stud * sig
    f_pin = math.pi * (C.BRASS_PIN_D / 2) ** 2 * 200.0       # corte del latón (≈ 200 MPa)
    servo_reac = 0.18 / 0.03                                 # N: par de bloqueo 0,18 N·m (no verificado) sobre ≈ 30 mm entre pernos
    rows = '\n'.join(f'| {a} | {b} | {c} | {d} |' for a, b, c, d in fasteners_table())
    t = f"""# 11 · Fijaciones impresas (v3.1): sin tornillería metálica comprada

{HEAD}
## 1. Por qué no se imprimen tornillos M2 ni M3
La rosca M2 avanza 0,4 mm por vuelta y la M3, 0,5 mm: lo mismo que el ancho de línea de una boquilla de 0,4 mm. Impresas salen deformes y se barren al apretar.
Por eso cada unión se resolvió con lo que **sí** funciona impreso, sin cambiar el mecanismo ni la medición:
- **Rosca M6 impresa** (paso {F(C.THREAD_P)} mm, perfil ISO) donde hay lugar: columnas, anillo, soporte del servo, bandeja y soporte del micrófono.
- **Pasador de latón Ø2** (la misma varilla de los ejes) con **cabeza impresa pegada** y **tuerca impresa a presión** donde no hay lugar para M6: topes, bielas, horquilla y
  pivote del micrófono. Funciona como un tornillo con tuerca: se arma, aprieta y desarma (la tuerca se saca con alicate).
- **Pestillos giratorios** en lugar de las barras y tornillos de la placa perforada.
Ventaja adicional: **no queda acero cerca de los sensores Hall** (todo es PETG o latón, no magnéticos).
Los **únicos tornillos metálicos** son los que vienen con el servo (orejas y horn).

## 2. Qué va en cada unión
| Unión | Elemento | Retención | Nota |
|---|---|---|---|
{rows}

## 3. Piezas a imprimir
| Archivo | Cant. (incluye repuestos) | Uso |
|---|---|---|
| `{C.PREFIX}_Bolt_M6x8.stl` | 9 | 4 servo, 2 bandeja, 2 soporte M1, 1 repuesto. Cabeza moleteada Ø{F(hd, 0)} × {F(hh, 0)} con ranura |
| `{C.PREFIX}_Knurled_Nut_M6.stl` | 4 | 3 comisuras + 1. Ø{F(C.KNURL_NUT[0], 0)} × {F(C.KNURL_NUT[1], 0)} (no sobresale de la comisura) |
| `{C.PREFIX}_Pin_Head.stl` | 10 | 8 pasadores + 2 |
| `{C.PREFIX}_Push_Nut.stl` | 10 | 8 pasadores + 2 (son de un solo uso si quedan flojas) |
| `{C.PREFIX}_Turn_Button.stl` | 5 | 4 pestillos + 1 |
| `{C.PREFIX}_Thread_Coupon.stl` | 1 | Probeta de roscas (imprimir primero) |
| `{C.PREFIX}_Column.stl` | 3 | Ahora con espárragos M6 en ambos extremos |

Pasadores de latón Ø2 a cortar: 3 × {F(pl['tope'])} (topes), 3 × {F(pl['biela_plato'])} (bielas), 1 × {F(pl['horquilla'])} (horquilla), 1 × {F(pl['pivote_M1'])} (pivote),
además de los 3 ejes de 56 mm y los 3 pasadores de 9 mm de siempre.

## 4. Resistencia: orden de magnitud [CÁLCULO, con supuestos]
Supuesto conservador para PETG impreso **entre capas**: corte ≈ {F(tau, 0)} MPa y tracción ≈ {F(sig, 0)} MPa (el material macizo resiste más; VERIFICAR con la probeta).
| Caso | Capacidad estimada | Carga del banco | Margen |
|---|---|---|---|
| Barrido de la rosca M6 en la base (5 mm de rosca) | ≈ {F(f_strip, 0)} N | ≈ {F(servo_reac, 0)} N por perno (reacción al par de bloqueo del servo, no verificado) | ≈ ×{F(f_strip / servo_reac, 0)} |
| Tracción del espárrago de la columna (Ø de fondo {F(C.THREAD_D - 1.2269 * C.THREAD_P, 2)} mm) | ≈ {F(f_stud, 0)} N | < 2 N (el plato empuja el anillo hacia arriba al cerrar) | > ×{F(f_stud / 2, 0)} |
| Corte del pasador de latón Ø2 | ≈ {F(f_pin, 0)} N | < 2 N | > ×{F(f_pin / 2, 0)} |

Las cargas del banco son muy chicas (fuerza en el empujador ≈ {F(V['servo']['force_N'], 1)} N). **El riesgo real no es la rotura en uso sino apretar de más:** una llave o
un destornillador pueden barrer la rosca de plástico. Por eso las cabezas son moleteadas y se aprietan **solo con los dedos**. El PETG se asienta con el tiempo: revisar el
apriete después de 24 h. La retención de las tuercas a presión depende del agujero real: se fija con la fila 2 de la probeta y se comprueba en el ensayo 1. [FÍSICO]

## 5. Comprobaciones digitales [SIM]
- Perno y tuerca M6 impresos: con la compensación de {F(C.THREAD_COMP, 2)} mm por lado, las roscas encajan sin interferencia, con un juego axial
  de ≈ 0,3 mm (normal en roscas impresas). Se comprobó intersecando el sólido del perno con el de una tuerca en distintos ángulos de giro.
- Piezas fijas modificadas y fijaciones contra todo el ensamblaje: {'sin choques' if not bad else 'con choques en ' + ', '.join(bad)} (informe de validación).
- Barrido de {V['sweep']['poses_checked']} poses con pasadores, cabezas y tuercas del plato: {len(V['sweep']['interferences'])} interferencias.
- Accesos: tuercas moleteadas y pernos con espacio para los dedos; pasadores biela–plato con acceso por ambos lados (informe de validación).
"""
    w('11_Fijaciones_Impresas.md', t)


def doc_leeme():
    t = f"""# {C.PROJECT} — paquete {C.REVISION}

{HEAD}
Banco universitario de válvula aórtica trivalva movida por un servo, **sin fluido**. Objetivo: comparar el movimiento REAL de las 3 valvas (un par Hall–imán por valva) y
detectar apertura o cierre incompletos, asimetrías, retrasos o variaciones y atascos. El micrófono INMP441 es una señal complementaria. El ángulo ordenado al servo no es la
posición de las valvas, y la animación no es una prueba.

Las entregas anteriores se conservan sin cambios: `entrega/CardioValAI_Modelo_Final_STL.zip` (v1), `entrega/CardioValAI_v2_Modelo_y_Adquisicion.zip` (v2) y
`entrega/CardioValveAI_v3_Modelo_y_Adquisicion.zip` (v3, con tornillería metálica). **v3.1 = v3 con todas las fijaciones impresas o de latón** (doc 11).
Todos los archivos de este paquete se generaron desde el mismo código (ver `REVISION.json`).

| Carpeta / archivo | Contenido |
|---|---|
| `Documentacion/01…11` | Auditoría, datos bloqueantes, Hall–imán, calibración, mecanismo, electrónica, firmware, herramientas, ensayos, pendientes, fijaciones impresas |
| `Documentacion/Guia_de_Impresion_{RV}.md`, `Guia_de_Ensamblaje_{RV}.md`, `Lista_de_Materiales_{RV}.*`, `Informe_de_Validacion_{RV}.md` | Fabricación y verificación |
| `{C.PREFIX}_STL/` | Piezas imprimibles individuales (mm, orientadas) |
| `{C.PREFIX}_STEP/`, `{C.PREFIX}_Assembly_Cerrada.step` | Sólidos editables y ensamblaje |
| `Referencia_NO_IMPRIMIR/` | Servo, ESP32 + placa, sensores, imanes, pasadores y fijaciones montadas, cables |
| `{C.PREFIX}_Final.blend` | Ensamblaje animado (Blender 4.5 LTS) |
| `{C.PREFIX}_Animacion.mp4` | Animación cinemática (no es prueba de funcionamiento) |
| `Vistas/` | Par Hall–imán ampliado por valva, portasensor, galga, cables, micrófono, electrónica, fijaciones impresas |
| `Electronica/` | Esquemas (SVG/PNG) |
| `CAD_parametrico/`, `Firmware/`, `Herramientas_Mac/`, `Electronica_fuente/` | Código fuente reproducible |
"""
    w('LEEME.md', t)


def main():
    V, SD = load()
    doc_auditoria(V, SD); doc_datos(); doc_hall(V, SD); doc_calibracion(V); doc_mecanismo(V); doc_electronica(); doc_firmware()
    doc_herramientas(); doc_ensayos(); doc_pendientes(); doc_impresion(V); doc_ensamblaje(); doc_bom(V); doc_informe(V); doc_fijaciones(V); doc_leeme()
    print('Documentos en', DOC, sorted(os.listdir(DOC)))


if __name__ == '__main__':
    main()
