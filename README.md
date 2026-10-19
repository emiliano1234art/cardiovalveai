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

En la barra superior puedes:

- Cambiar el **estado experimental**: Normal · Apertura limitada · Cierre alterado · Ritmo irregular.
- Ajustar la **frecuencia programada** (lpm) con `−` / `+`.
- Alternar **SIMULACIÓN / DATOS REALES** (ESP32 por WebSocket).
- **Recapturar la línea basal** con los próximos 30 ciclos de la fuente activa.

---

## 3. Arquitectura

```
          ┌────────────────────────── Fuente de datos (ValveDataSource) ──────────────────────────┐
          │  SimulatedValveSource  ──►  ValveSignalSynth (señales físicas sintéticas)            │
          │  Esp32WebSocketSource  ──►  ESP32 real (JSON por WebSocket)                          │
          └──────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │ SignalChunk { piezo, servo, audio, fs, t0 }
                                         ▼
                              ┌────────────────────┐
                              │ ValveSenseEngine   │  buffers circulares (3 s), espectrograma STFT
                              └─────────┬──────────┘
                                        ▼
       ┌───────────────────── ValveAnalysisPipeline ──────────────────────┐
       │ CycleAnalyzer  → segmenta ciclos (cruce de umbral del servo)      │
       │                → descriptores: RMS, pico, energía, f. dominante, │
       │                  centroide, tiempos 10–90 %, envolventes de fase  │
       │ BaselineModel  → z-scores vs basal + correlación de forma         │
       │                → similitud %, anomaly score (0–1), regularidad    │
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
│   ├── ValveSignalSynth.ts      Sintetizador: servo + resonadores amortiguados (clics) + ruido de flujo
│   ├── PatientSimulator.ts      Paciente SINTÉTICO + historial ficticio de sesiones
│   └── rng.ts                   PRNG determinista
├── sources/
│   ├── DataSource.ts            Interfaz común de fuentes
│   ├── SimulatedValveSource.ts  Fuente simulada (bloques de 50 ms)
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
│   ├── layout/                  Header, barra de control
│   ├── sections/                Las 6 secciones del dashboard
│   ├── charts/                  Gráfico de señal, espectrograma, tooltip, tema
│   └── ui/                      Section, MetricCard, StatusBadge
└── lib/                         RingBuffer, formato, exportación CSV/JSON
scripts/generate-dataset.ts      Generador del dataset de ejemplo
public/data/                     valvesense_sample_dataset.{csv,json}
```

### Cómo se calculan los indicadores

| Indicador | Cálculo |
|---|---|
| Segmentación de ciclo | Cruce ascendente del ángulo del servo por 8° (con histéresis) |
| Tiempo de apertura / cierre | Transición 10 %→90 % (y 90 %→10 %) del ángulo máximo del ciclo |
| RMS / pico / energía | Sobre la señal piezo del ciclo completo; energía = ∑x²·Δt |
| Frecuencia dominante / centroide | PSD de Welch (Hann 512, 50 %) del audio del ciclo, > 150 Hz |
| Regularidad | `100·exp(−(CV/0,12)^1,5)` con CV = coef. de variación del período (12 ciclos) |
| Similitud con basal | Combina la distancia multivariante de z-scores (9 descriptores) y la correlación de las envolventes de fase |
| Anomaly score (0–1) | Distancia multivariante + error de forma + penalización por irregularidad. Suavizado EMA (α = 0,4) |
| Estado | `< 0,3` NORMAL · `0,3–0,6` DESVIACIÓN LEVE · `≥ 0,6` DESVIACIÓN IMPORTANTE |

Valores típicos de la simulación: Normal ≈ 98 % / 0,01 · Ritmo irregular ≈ 55 % / 0,45–0,7 · Apertura limitada ≈ 32 % / 0,89 · Cierre alterado ≈ 25 % / 0,85.

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
  "audio": [0.001, -0.002, ...]
}
```

- `piezo` y `servo` tienen la **misma longitud** (muestreo `fs_piezo`); `servo` es el ángulo en grados (comandado o medido).
- `audio` tiene longitud `len(piezo) × fs_audio / fs_piezo`, normalizado a [−1, 1] (p. ej. muestra I²S de 16 bits / 32768).
- `piezo` centrado en 0 (resta el offset del ADC), en unidades arbitrarias o V.

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
