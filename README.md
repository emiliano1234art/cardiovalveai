# CardioValveAI

**Tecnología e inteligencia artificial para explorar el funcionamiento valvular y su relación con la rehabilitación cardiovascular.**

Universidad del Desarrollo · Facultad de Medicina y Facultad de Ingeniería · Ingeniería Civil en Biomedicina × Kinesiología.
Integrantes: Francisco Rojas, Johan Denis, Vicente Brito, Benjamín Saldívar y Emiliano Hernández. Profesor asesor: Gustavo Castro.

Una misma aplicación con **dos modos conectados** (menú superior **Presentación | Laboratorio interactivo**):

1. **Presentación interactiva oficial** (por defecto, `#/`): portada + 10 pantallas + bibliografía.
2. **Dashboard experimental / laboratorio interactivo** (`#/dashboard`): válvula 3D trivalva, ECG, vibración, sonido, IA, paciente simulado e historial; conexión opcional al ESP32.

> Nombre oficial visible: **CardioValveAI**. La dirección del repositorio (`cardiovalveai`), la URL de GitHub Pages y algunos nombres internos de archivos e identificadores (`ValveSense_*.html`, `useValveSense`, …) se mantienen a propósito para no romper enlaces ni configuraciones.

> ⚠️ Prototipo académico. No es un dispositivo médico, no es una prótesis implantable y no entrega diagnósticos. Cada elemento indica su estado: **IMPLEMENTADO**, **SIMULADO**, **EXPERIMENTO**, **PROPUESTO** o **VISIÓN FUTURA**.

---

## Diseño mecánico para impresión 3D (v1)

Modelo fabricable del prototipo (un solo servo MG90S → plato actuador → 3 bielas → 3 valvas, con piezo, MEMS y ESP32): STL listos para imprimir, STEP editables, ensamblaje, escena de Blender con animación, guías de ensamblaje e impresión, lista de materiales e informe de validación en **`entrega/CardioValAI_Modelo_Final_STL.zip`**. Código CAD paramétrico en [`hardware/`](hardware/README.md).

## La válvula: aórtica TRIVALVA

El modelo es una **válvula aórtica de tres valvas semilunares** (≈ 120° entre sí): cerradas forman una «Y» de coaptación en el centro y abiertas se desplazan hacia la pared. No es la válvula tricúspide (lado derecho del corazón). Geometría compartida en `src/presentation/geometry/trileaflet.ts`; se usa en el 3D (`three/scenes.ts`), en las vistas 2D (`components/ValveSVG.tsx`) y en los renders.

- **Prototipo propuesto (no construido):** anillo Ø ≈ 70 mm impreso en 3D, tres valvas, piezoeléctrico de 12–15 mm integrado en la pared del anillo, micrófono MEMS INMP441 con el puerto orientado a la línea de cierre, ESP32 y base.
- **Mecanismo:** **un solo servo MG90S → leva → anillo actuador → tres bielas → tres valvas** (visible con «Ver mecanismo»). Movimiento reproducible para comparar señales; es una simulación mecánica que no reproduce las fuerzas hemodinámicas. Alternativa futura (no reemplaza la actual): accionamiento pasivo por presión o flujo.
- **Condiciones** (sobre UNA valva elegible): normal · apertura restringida (tope a 40°) · cierre incompleto (12° residuales) · movimiento irregular · apertura asimétrica · variación de FC. El comando del servo no cambia; las alteraciones vienen de topes/holguras.

## Presentación (`#/`)

| # | Pantalla (ruta) | Elemento protagonista |
|---|---|---|
| — | Portada (`#/cover`) | válvula aórtica 3D abriéndose lentamente · CARDIOVALVEAI · integrantes, profesor asesor y UDD · «Comenzar presentación →» |
| 1 | ¿Qué es CardioValveAI? (`#/que-es`) | Válvula → Sensores → IA y flujo animado Válvula → Piezo/MEMS → ESP32 → Análisis → Dashboard |
| 2 | Wicked problem (`#/problema`) | pregunta del problema, corazón · prótesis · señales · rehabilitación, flujo Problema → Necesidad → Propuesta y «¿Por qué es un wicked problem?» (Rittel y Webber, 1973) |
| 3 | Integración interdisciplinaria (`#/interdisciplina`) | diagrama conectado Biomedicina ↔ aportes conjuntos ↔ Kinesiología (seleccionable) |
| 4 | Materiales (`#/materiales`) | 10 tarjetas ilustradas; al tocarlas: qué es, para qué sirve, dónde se ubica y cómo participa |
| 5 | Carta Gantt (`#/gantt`) | línea de tiempo animada de 10 etapas con hito Feria 4 nov · **cronograma propuesto** |
| 6 | Entrevista docente (`#/entrevista`) | Dr. Pablo Reyes (Fisiología UDD) · Diagrama de Wiggers simplificado y animado (ECG, presiones del VI y aórtica, apertura/cierre) sincronizado con la válvula 3D |
| 7 | Prototipo antes/después (`#/prototipo`) | dibujo inicial (pendiente) vs. 3D: Abrir/Cerrar, normal, apertura restringida, sensores, mecanismo, vista explotada y comparación con la válvula real |
| 8 | Modelos matemáticos (`#/modelos`) | pestañas Movimiento (θ, dθ/dt, límites) · Vibración (E = ∫x² dt) · Latido (FC = 60/RR, retardo τ) |
| 9 | Resultados esperados (`#/resultados`) | 4 metas (no logradas aún) + proyección interdisciplinaria y vuelta a la pregunta |
| 10 | Souvenir y cierre (`#/cierre`) | llavero 3D (propuesta), QR al dashboard y «Explorar el dashboard →» |
| — | Bibliografía (`#/biblio`) | referencias verificadas y pendientes de verificación marcadas |

**Dashboard:** el botón «Dashboard ↗» de la barra superior y los botones de las pantallas 1, 9 y 10 abren una vista previa del laboratorio (el de este mismo archivo, funciona sin conexión), con «Abrir en pestaña nueva», «Versión en línea» y «← Volver a la presentación». La versión en línea se actualiza al integrar los cambios a `main`.

### Abrir

| Opción | Cómo |
|---|---|
| **Presentación sin internet** | `entrega/index.html` (doble clic en Chrome; autocontenido, sin dependencias). Copia idéntica: `entrega/ValveSense_presentacion.html`. |
| **Laboratorio sin internet** | `entrega/ValveSense_dashboard.html` (abre directo en `#/dashboard`). |
| **Presentación con panel en vivo** | `#/panel` o `entrega/ValveSense_panel.html`. |
| **PDF** | `entrega/ValveSense_presentacion.pdf` (12 páginas). Regenerar tras completar campos pendientes (botón ⎙). |
| **En línea** | https://emiliano1234art.github.io/cardiovalveai/ |
| **Desarrollo** | `npm install && npm run dev` → http://localhost:5173/cardiovalveai/ |

`npm run build:offline` regenera los HTML autocontenidos. Con el servidor de desarrollo activo, `node scripts/make-renders.cjs` regenera los renders 3D (incluido `souvenir`). Dependencias (incluidas en el HTML): React, Three.js, KaTeX, Recharts, qrcode y fuentes Inter / JetBrains Mono.

### Controles

← → / PageUp / PageDown / deslizar · pestañas superiores · barra de progreso · **N** notas del expositor · **A** animación completa → reducida → pausa · **F** pantalla completa · ⎙ imprimir / PDF · Esc cierra la vista previa del dashboard.

### Dónde editar el contenido

- **`src/presentation/content.ts`**: portada, pregunta del problema, aportes conjuntos, materiales, Carta Gantt (`GANTT`, `GANTT_IS_PROPOSAL`), entrevista (`INTERVIEW`), dibujo inicial (`DRAWING_BEFORE`), resultados esperados, URL del dashboard, referencias y notas. Un texto entre `[corchetes]` es un **campo pendiente** y se resalta en rosa.
- **`src/presentation/explain.ts`**: explicaciones «ⓘ» de la presentación (sencilla + «Ver explicación científica»).
- **`src/content/explanations.ts`**: explicaciones del laboratorio.

### Información pendiente

- Fechas oficiales del Encargo 2 (la Carta Gantt es una propuesta).
- Hallazgos del Toolkit (Encargo 1).

### Modelo de simulación (fuente única de verdad)

`src/presentation/sim/model.ts` (ECG, latidos, tres valvas y señales), `sim/analysis.ts` (IA experimental) y `sim/physiology.ts` (presiones ilustrativas). El laboratorio usa el mismo modelo (`sources/SyncedSimSource.ts`).

- **ECG → R → τ → actuador:** la apertura comienza τ después del pico R (retardo electromecánico configurable); dura D y se acota al RR. El ECG mide actividad eléctrica: la apertura no es simultánea al pico R.
- **Detección de R** inspirada en Pan–Tompkins; la FC mostrada se calcula de los RR detectados.
- **IA experimental:** descriptores por evento + sincronía con el RR. Un aumento de FC no se clasifica como falla. Umbrales = heurística demostrativa.
- **ECG real:** no implementado. Solo con un módulo aislado, a batería y preferentemente inalámbrico; nunca electrodos conectados a circuitos alimentados por USB/red sin aislamiento.

---

# Laboratorio interactivo (`#/dashboard`)

## 1. Instalación

Requisitos: **Node.js ≥ 20** y npm.

```bash
git clone <repo> && cd cardiovalveai
npm install
```

## 2. Ejecución

```bash
npm run dev        # servidor de desarrollo → http://localhost:5173/cardiovalveai/#/dashboard
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve el build de producción
npm run dataset    # regenera el dataset sintético de ejemplo (public/data/)
```

### Pensado para cualquier visitante (feria científica)

- **Portada con el modelo 3D** de la válvula experimental: seis puntos interactivos (valvas, anillo, sensor piezoeléctrico, micrófono MEMS, mecanismo de movimiento, ESP32) abren una tarjeta breve con su función, su estado (componente elegido o diseño propuesto) y una ficha técnica opcional. Vistas, «ver por dentro» y «separar piezas».
- **4 indicadores clave**: latidos por minuto, válvula abierta/cerrada, análisis inteligente y parecido al patrón de referencia.
- **ⓘ ¿Qué significa?** en cada gráfico: explicación sencilla (30–60 palabras) y, a pedido, *Ver explicación técnica*. En teléfonos aparece como hoja inferior. Textos en `src/content/explanations.ts`.
- **Gráficos interactivos**: tooltip, zoom de tiempo (3 s · 1 s · 0,5 s), leyenda que muestra/oculta capas, marcas ▲ abre / ▼ cierra (a partir del ángulo del actuador), pausa/reanudación y **selección de un punto** con explicación breve. Un pico solo se describe como apertura o cierre cuando los datos sincronizados del actuador lo confirman.
- **Mapa de sonidos** (espectrograma) con leyenda de colores y selección de zonas.
- **Aprender cómo funciona**: recorrido guiado de 5 pasos (~1–2 min) con animaciones; se puede omitir en cualquier momento.
- **Origen de los datos** siempre visible: **SIMULACIÓN**, **EXPERIMENTO** o **VISIÓN FUTURA**. Con el ESP32 desconectado no se muestran valores simulados como si fueran del prototipo, y el patrón de referencia debe registrarse con los datos reales.

Barra de control (simulación): condición mecánica (Normal · Apertura restringida · Cierre incompleto · Movimiento irregular · Apertura asimétrica) y valva afectada (1, 2 o 3), ritmo del corazón (Reposo · 72, Ejercicio · 110 o control deslizante) y **Ajustes avanzados** (τ, D, θ y registro del patrón de referencia). Al cambiar τ, D o θ la referencia se recalibra con esa temporización; la FC simulada cambia gradualmente (≤ 12 lpm/s).

Secciones: portada 3D (abrir/cerrar a mano, ver mecanismo, ubicar sensores) · 01 Latidos del corazón (ECG, picos R, qué pasa en cada latido) · 02 Las tres valvas en movimiento (vista superior y lateral, valva afectada en naranja) · 03 Vibración · 04 Sonido y mapa de sonidos · 05 Análisis inteligente (patrón similar / cambio de ritmo / cambio detectado / desviación experimental; normal vs. ahora; ¿qué cambió?) · 06 Paciente simulado y ejercicio (visión futura con Kinesiología) · 07 Historial y exportación.

---

## 3. Arquitectura

```
          ┌────────────────────────── Fuente de datos (ValveDataSource) ──────────────────────────┐
          │  SyncedSimSource ──► SyncedSynth (modelo de presentation/sim: ECG + 3 valvas)        │
          │  Esp32WebSocketSource  ──►  ESP32 real (JSON por WebSocket)                          │
          └──────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │ SignalChunk { piezo, servo, audio, ecg?, fs, t0 }
                                         ▼
                              ┌────────────────────┐
                              │ ValveSenseEngine   │  buffers circulares (3 s), espectrograma STFT
                              └─────────┬──────────┘
                                        ▼
       ┌───────────────────── ValveAnalysisPipeline ──────────────────────┐
       │ CycleAnalyzer  → segmenta ciclos (umbral adaptativo del servo)    │
       │                → descriptores: RMS, pico, energía, f. dominante, │
       │                  centroide, tiempos 10–90 %, envolventes (ms)     │
       │                → ECG: picos R, RR y FC (tipo Pan–Tompkins)        │
       │ BaselineModel  → z-scores vs basal + correlación de forma         │
       │                → similitud %, anomaly score (0–1), regularidad    │
       │                → sincronía ciclo vs RR, veredicto (FC ≠ falla)    │
       └──────────────────────────────┬────────────────────────────────────┘
                                      ▼ CycleRecord (1 por ciclo)
                      useValveSense (React, refresco 10 Hz) → componentes
```

**Principio clave:** el simulador produce *señales crudas*, no métricas. Todas las métricas (incluido el anomaly score) se calculan con el **mismo pipeline** que procesará los datos del ESP32. Al cambiar el modo experimental, el score cambia porque la señal medida cambia, no porque el modo se lo indique.

### Estructura de carpetas

```
src/
├── types/valvesense.ts          Contratos de datos (SignalChunk, CycleRecord, …)
├── config/modes.ts              Perfiles físicos de cada estado + constantes de adquisición
├── simulation/
│   ├── PatientSimulator.ts      Paciente SINTÉTICO + historial ficticio de sesiones
│   └── rng.ts                   PRNG determinista
├── sources/
│   ├── DataSource.ts            Interfaz común de fuentes
│   ├── SyncedSimSource.ts       Fuente simulada sincronizada con ECG (bloques de 50 ms)
│   └── Esp32WebSocketSource.ts  ← punto de conexión del ESP32
├── analysis/
│   ├── dsp.ts                   FFT, Welch, RMS, centroide, envolventes, Pearson
│   ├── CycleAnalyzer.ts         Segmentación y descriptores por ciclo
│   ├── BaselineModel.ts         Línea basal y evaluación de desviaciones
│   ├── ValveAnalysisPipeline.ts Orquestación + regularidad + suavizado
│   └── calibration.ts           Calibración de la basal en simulación
├── engine/                      Motor (sin React): buffers, espectrograma, snapshots
├── hooks/useValveSense.ts       Puente React
├── components/
│   ├── layout/                  Header (navegación, pausa, «Aprender»), barra de control
│   ├── sections/                Portada 3D (HeroSection) y las 7 secciones del dashboard
│   ├── explain/                 GraphExplanation/InfoTooltip, InteractiveChartLegend, LearnMode, SensorHotspot
│   ├── charts/                  InteractiveSignalChart/SignalCard, espectrograma, tooltip, tema
│   └── ui/                      Section, MetricCard, StatusBadge, íconos
├── content/                     Explicaciones (2 niveles) y puntos del modelo 3D
└── lib/                         RingBuffer, formato, exportación CSV/JSON
scripts/generate-dataset.ts      Generador del dataset de ejemplo
public/data/                     valvesense_sample_dataset.{csv,json}
```

### Cómo se calculan los indicadores

| Indicador | Cálculo |
|---|---|
| Segmentación de ciclo | Cruce ascendente del ángulo por piso adaptativo + 8° (con histéresis; funciona con cierre incompleto) |
| FC (ECG) / RR | Detector tipo Pan–Tompkins (derivada → cuadrado → integración 150 ms → umbral, refractario 250 ms); FC = 60/RR medio |
| Ciclo valvular vs RR | \|duración del ciclo − RR\| (tolerancia 60 ms) |
| Tiempo de apertura / cierre | Transición 10 %→90 % (y 90 %→10 %) del ángulo máximo del ciclo |
| RMS / pico / energía | Sobre la señal piezo del ciclo completo; energía = ∑x²·Δt |
| Frecuencia dominante / centroide | PSD de Welch (Hann 512, 50 %) del audio del ciclo, > 150 Hz |
| Regularidad | Con ECG: `100·exp(−(MAD(ciclo−RR)/RR/0,06)^1,5)` (la variación del RR es fisiológica). Sin ECG: CV del período (12 ciclos) |
| Similitud con basal | Combina la distancia multivariante de z-scores (7 descriptores por evento) y la correlación de las envolventes (0–500 ms desde la apertura, tolerancia ±20 ms) |
| Anomaly score (0–1) | Distancia multivariante + error de forma + penalización por irregularidad. Suavizado EMA (α = 0,4) |
| Estado | `< 0,3` NORMAL · `0,3–0,6` DESVIACIÓN LEVE · `≥ 0,6` DESVIACIÓN IMPORTANTE |
| Veredicto | Desviación leve/importante según el estado; si no, «cambio de FC» cuando \|FC ECG − FC basal\| ≥ 10 lpm; si no, «dentro de la basal» |

Resultados del modelo sintético (no son mediciones; dataset de ejemplo): Normal 72 lpm → patrón similar · Normal 110 lpm → cambio de ritmo · una valva restringida → cambio detectado · cierre incompleto → cambio detectado · movimiento irregular y apertura asimétrica → desviación experimental. Además de la distancia multivariante, un único descriptor muy alejado (|z| > 2) también eleva el índice, para detectar cambios en una sola de las tres valvas.

---

## 4. Dónde conectar el ESP32

**Archivo:** `src/sources/Esp32WebSocketSource.ts` (ya implementado). En el dashboard: **DATOS REALES** → escribe la URL (`ws://<ip-del-esp32>:81`) → **Conectar**.

El ESP32 debe abrir un servidor WebSocket y enviar un mensaje JSON por bloque (recomendado: cada 50–100 ms):

```json
{
  "type": "chunk",
  "t0_ms": 123456,
  "fs_piezo": 1000,
  "fs_audio": 8000,
  "piezo": [0.012, -0.004, ...],
  "servo": [0.0, 0.1, ...],
  "audio": [0.001, -0.002, ...],
  "ecg": [0.01, 0.02, ...]
}
```

- `piezo` y `servo` tienen la **misma longitud** (muestreo `fs_piezo`); `servo` es el ángulo en grados (comandado o medido).
- `audio` tiene longitud `len(piezo) × fs_audio / fs_piezo`, normalizado a [−1, 1] (p. ej. muestra I²S de 16 bits / 32768).
- `piezo` centrado en 0 (resta el offset del ADC), en unidades arbitrarias o V.
- `ecg` es **opcional** (mV, misma longitud que `piezo`). Sólo desde un módulo de adquisición de ECG **aislado, a batería o inalámbrico**; no conectar electrodos corporales a circuitos alimentados por USB sin aislamiento. Sin `ecg`, el dashboard analiza la válvula sin referencia de ritmo.

Mensajes opcionales:

```json
{ "type": "status", "bpm_programmed": 72 }
{ "type": "cycle", "timestamp": 0, "cycle_number": 1, "...": "CycleFeatures calculados en el firmware" }
```

Al conectar datos reales, pulsa **Recapturar basal** con la válvula funcionando en condición normal: los próximos 30 ciclos definen la nueva línea basal del hardware.

Esqueleto de firmware (Arduino, librerías `WebSocketsServer` y `ArduinoJson`):

```cpp
// Pseudocódigo — adaptar a tu hardware
WebSocketsServer ws(81);
void loop() {
  ws.loop();
  // 1) muestrear piezo (ADC) y ángulo a 1 kHz, audio I2S a 8 kHz en buffers
  // 2) cada 50 ms serializar el bloque como {"type":"chunk", ...} y enviarlo:
  //    ws.broadcastTXT(json);
}
```

Para implementar otra vía (Web Serial, MQTT, archivo), crea una clase que implemente `ValveDataSource` (`src/sources/DataSource.ts`) y regístrala en `ValveSenseEngine`.

---

## 5. Estructura de datos esperada

### `CycleRecord` (un registro por ciclo; formato del CSV exportado)

| Campo | Tipo | Unidad | Descripción |
|---|---|---|---|
| `timestamp` | number | ms | Fin del ciclo (reloj de la fuente; en el dataset, epoch) |
| `cycle_number` | int | — | Número de ciclo desde el inicio |
| `bpm` | number | lpm | Frecuencia medida (media de los últimos 5 ciclos) |
| `servo_angle` | number | ° | Ángulo máximo de apertura del ciclo |
| `valve_state` | enum | — | `closed` · `opening` · `open` · `closing` (estado al cierre del registro) |
| `piezo_raw` | number | u.a. | Valor crudo del piezo en el pico del ciclo |
| `piezo_rms` | number | u.a. | RMS de vibración |
| `piezo_peak` | number | u.a. | Amplitud pico absoluta |
| `piezo_energy` | number | u.a.²·s | Energía de la señal |
| `audio_rms` | number | — | RMS acústico (normalizado) |
| `dominant_frequency` | number | Hz | Pico espectral del audio |
| `spectral_centroid` | number | Hz | Centroide espectral del audio |
| `cycle_duration_ms` | number | ms | Duración del ciclo |
| `opening_duration_ms` | number | ms | Tiempo de apertura (10–90 %) |
| `closing_duration_ms` | number | ms | Tiempo de cierre (90–10 %) |
| `baseline_similarity` | number | % | Similitud con la línea basal (EMA) |
| `anomaly_score` | number | 0–1 | Índice de desviación (EMA) |
| `regularity` | number | % | Regularidad del período |
| `mode` | enum \| null | — | Estado experimental (sólo simulación) |
| `source` | enum | — | `simulation` · `esp32` |

### Dataset sintético de ejemplo

`public/data/valvesense_sample_dataset.csv` y `.json` — 280 ciclos con la secuencia *normal → apertura limitada → normal → cierre alterado → normal → ritmo irregular → normal* (40 ciclos cada uno). El JSON incluye además las estadísticas de la línea basal. También descargable desde la sección **Historial**, junto con la exportación CSV/JSON de la sesión en curso.

---

## Aviso

Proyecto académico. Las señales, el paciente y las sesiones de rehabilitación son **sintéticos** y están marcados como tales en la interfaz. ValveSense no utiliza información médica real ni emite diagnósticos clínicos.
