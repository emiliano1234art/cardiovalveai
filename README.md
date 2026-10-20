# ValveSense · CardioValveAI

**Del movimiento valvular al seguimiento funcional: una base para la rehabilitación cardiorrespiratoria personalizada.**

Proyecto Interdisciplinario (Ingeniería Civil en Biomedicina + Kinesiología). Este repositorio contiene:

1. **Presentación interactiva de avance** (por defecto): portada + 10 diapositivas de contenido + bibliografía, con un modelo trivalvo animado y manipulable.
2. **Dashboard v1** (conservado) en `#/dashboard`: análisis de señales sintéticas y conexión al ESP32.

> ⚠️ Prototipo académico. No es un dispositivo médico ni entrega diagnósticos. Todo dato generado se marca como **SIMULACIÓN**; el panel funcional usa **datos sintéticos, no clínicos**.

---

## Presentación interactiva (entrega 20–21 de octubre)

**Idea principal:** ValveSense busca transformar las señales mecánicas y acústicas de una prótesis valvular en información útil para explorar nuevas formas de monitoreo cardiovascular y apoyar, en el futuro, una rehabilitación más personalizada.

Portada + 10 diapositivas de contenido + bibliografía, con la narrativa:
problema clínico → válvula real → solución ValveSense → prototipo con sensores integrados → sincronización ECG → vibración, sonido e IA → matemática → dashboard → integración clínica e impacto → plan y cierre.

| # | Diapositiva | Cubre de la pauta |
|---|---|---|
| — | Portada | nombre, equipo, carreras |
| 1 | Problema clínico (mapa interactivo) | nombre + wicked problem |
| 2 | Cómo funciona una válvula real (natural vs. bileaflet vs. modelo) | fundamentación |
| 3 | Solución ValveSense · Biomedicina + Kinesiología | integración interdisciplinaria |
| 4 | Prototipo con sensores integrados (3D, despiece, vista interna, antes/después, accionamiento A/B) | materiales + prototipo |
| 5 | Sincronización con ECG (simulado; arquitectura segura propuesta para ECG real) | prototipo: cómo funciona y qué mide |
| 6 | Vibración, sonido e IA: ¿falla mecánica o cambio de FC? | resultados esperados |
| 7 | Matemática aplicada (LaTeX + límites, derivadas, integrales) | modelo matemático |
| 8 | Dashboard actualizado (sintético / experimental / clínico futuro) | registro de variables |
| 9 | Integración clínica, resultados esperados e impacto futuro | resultados y conclusiones |
| 10 | Carta Gantt, entrevista docente, souvenir y cierre | línea de tiempo, entrevista, souvenir |
| — | Bibliografía | |

### Abrir

| Opción | Cómo |
|---|---|
| **Sin internet** | `entrega/ValveSense_presentacion.html` (doble clic; autocontenido). |
| **Presentación en formato dashboard** | `#/panel` o `entrega/ValveSense_panel.html`: menú de temas a la izquierda, cada diapositiva en vivo (con sus animaciones y modelos 3D) al centro y, siempre visible a la derecha, la simulación: válvula animada, ECG/vibración/sonido, veredicto de la IA y controles. Teclas ← → y botón *Panel* en la barra de la presentación. |
| **Dashboard sin internet** | `entrega/ValveSense_dashboard.html` (abre directo en `#/dashboard`). |
| **PDF para Canvas** | `entrega/ValveSense_presentacion.pdf` (12 páginas). Regenerar tras completar los campos pendientes (botón *Imprimir / PDF*). |
| **Imágenes** | `entrega/imagenes/*.jpg`: renders 3D (modelo universitario, despiece, prótesis bileaflet, concepto futuro) y vistas de ECG, comparación normal vs. restringida, válvula real y dashboard. |
| **En línea** | https://emiliano1234art.github.io/cardiovalveai/ (se actualiza al hacer merge en `main`). |
| **Desarrollo** | `npm install && npm run dev` → http://localhost:5173/cardiovalveai/ |

`npm run build:offline` regenera el HTML autocontenido. Con el servidor de desarrollo activo, `node scripts/make-renders.cjs` regenera los renders 3D (requiere Playwright con Chromium).

### Controles

← → / PageUp / PageDown / deslizar · **I** índice · **E** modo Presentación/Exploración · **N** notas del expositor (no se imprimen) · **A** animación completa → reducida → pausa · **F** pantalla completa · botón *Imprimir / PDF* · enlaces directos `#/s5`, `#/biblio`…

### Dónde editar el contenido

Todo el contenido editable está en **`src/presentation/content.ts`** (integrantes, entrevista, dibujo inicial, hallazgos del Toolkit, Carta Gantt, URL del QR, referencias, notas). Un texto entre `[corchetes]` es un **campo pendiente** y se resalta en rosa. Pendientes: integrantes, entrevista (aún no realizada), dibujo inicial, hallazgos del Toolkit, fechas/responsables del Encargo 2, y referencias marcadas *pendiente de verificación*.

### Modelo de simulación (fuente única de verdad)

`src/presentation/sim/model.ts` (ECG, latidos, válvula bileaflet y señales), `sim/analysis.ts` (IA experimental) y `sim/physiology.ts` (presiones ilustrativas). Un solo reloj (`sim/store.ts`) mueve el 3D, las señales y los gráficos: pausar detiene todo.

- **ECG → R → τ → actuador:** la apertura comienza τ (configurable) después del pico R; dura D (configurable) y se acota al intervalo RR. El ECG mide actividad eléctrica: es una **representación educativa sincronizada**, no fisiología exacta.
- **Detección de R** sobre la señal (derivada → cuadrado → integración 150 ms → umbral adaptativo, inspirado en Pan–Tompkins). La FC mostrada se calcula de los RR detectados.
- **Rampas del servo fijas** (120 ms apertura, 100 ms cierre) ⇒ la firma de cada evento no depende de la FC.
- **IA experimental:** descriptores sincronizados con cada evento (energía, RMS, frecuencia dominante, apertura, desfase, variabilidad) + comparación del ciclo valvular con el RR del ECG. Un aumento de FC no se clasifica como falla. Umbrales = heurística demostrativa.
- **Condiciones:** normal · apertura restringida (45°) · cierre incompleto (12° residuales) · movimiento irregular (valva 2 variable ciclo a ciclo) · variación de FC.
- **ECG real:** no implementado. Solo con un módulo de adquisición aislado, a batería y preferentemente inalámbrico; nunca electrodos conectados a circuitos alimentados por USB/red sin aislamiento.

El prototipo de referencia es **bileaflet (2 valvas)**, inspirado en una prótesis aórtica mecánica; la válvula aórtica natural (3 valvas) se usa solo como explicación fisiológica.

---

# Dashboard v1 (`#/dashboard`)

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

Barra de control (simulación): condición mecánica (Normal · Apertura restringida · Cierre incompleto · Movimiento irregular), ritmo del corazón (Reposo · 72, Ejercicio · 110 o control deslizante) y **Ajustes avanzados** (τ, D, θ y registro del patrón de referencia). Al cambiar τ, D o θ la referencia se recalibra con esa temporización; la FC simulada cambia gradualmente (≤ 12 lpm/s).

Secciones: portada 3D · 01 Latidos del corazón (ECG, picos R, qué pasa en cada latido) · 02 La válvula en movimiento · 03 Vibración · 04 Sonido y mapa de sonidos · 05 Análisis inteligente (normal / cambio de ritmo / diferencia leve / importante; normal vs. ahora; ¿qué cambió?) · 06 Paciente simulado y ejercicio (visión futura con Kinesiología) · 07 Historial y exportación.

---

## 3. Arquitectura

```
          ┌────────────────────────── Fuente de datos (ValveDataSource) ──────────────────────────┐
          │  SyncedSimSource ──► SyncedSynth (modelo de presentation/sim: ECG + bileaflet)       │
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

Resultados del modelo sintético (no son mediciones): Normal 72 lpm ≈ 100 % / 0,00 → basal · Normal 60–110 lpm ≈ 94–100 % / ≤ 0,1 → cambio de FC · Apertura restringida ≈ 56 % / 0,63 → importante · Cierre incompleto ≈ 49 % / 0,69 → importante · Movimiento irregular ≈ 67 % / 0,54 → leve.

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
