/**
 * Explicaciones del dashboard en dos niveles.
 * Guía interna de cada texto sencillo (no se muestra): ¿qué vemos?, ¿de dónde
 * vienen los datos?, ¿qué significa que suba o baje?, ¿por qué importa?,
 * ¿cómo se relaciona con ValveSense?  Sencilla: 30–60 palabras.
 */
export interface Explanation {
  title: string;
  /** explicación sencilla (cualquier visitante) */
  simple: string;
  /** pistas breves: «fíjate en…» */
  look?: string[];
  /** explicación técnica (estudiantes, profesores, evaluadores) */
  tech: string[];
}

export const EXPLAIN = {
  valve3d: {
    title: 'Nuestra válvula experimental',
    simple:
      'Es un modelo a escala de una válvula cardíaca mecánica con dos hojas (valvas). Un pequeño motor las abre y las cierra al ritmo de los latidos, y dos sensores escuchan cómo se mueven. Toca los puntos para conocer cada pieza.',
    look: ['Gíralo con el dedo o el mouse.', 'Los puntos numerados explican cada componente.'],
    tech: [
      'Modelo 3D del prototipo universitario propuesto: anillo y dos valvas impresas en 3D (Ø 84 mm en este modelo, propuesta), ejes de pivote, servo MG90S con transmisión, piezoeléctrico de 12–15 mm en la pared del anillo, micrófono MEMS INMP441 en un alojamiento del soporte y ESP32 en la base.',
      'Es una representación del diseño, no una fotografía: la integración física de los componentes todavía no está construida. En simulación, el movimiento de las valvas usa el mismo reloj que las señales del dashboard.',
    ],
  },
  bpm: {
    title: 'Latidos por minuto',
    simple:
      'Este número indica cuántas veces late el corazón en un minuto. Nuestro prototipo puede utilizar ese ritmo para controlar la frecuencia de movimiento de la válvula.',
    look: ['En reposo suele estar entre 60 y 100 lpm.', 'Al hacer ejercicio, sube.'],
    tech: [
      'FC = 60 / RR medio, donde RR es el tiempo (s) entre picos R consecutivos detectados en el ECG.',
      'En simulación el ECG es sintético y la FC programada cambia de forma gradual (≤ 12 lpm/s), como lo haría una FC real.',
    ],
  },
  valveState: {
    title: 'Estado de la válvula',
    simple:
      'Indica si la válvula está abierta o cerrada en este momento. Después de cada latido espera un instante, se abre, permanece abierta y se cierra antes del siguiente latido.',
    tech: [
      'En simulación, la fase sale del modelo: apertura (rampa de 120 ms), abierta (hasta completar D), cierre (rampa de 100 ms) y cerrada.',
      'Con el prototipo real, se estima a partir del ángulo del actuador (abierta si supera el mínimo del ciclo en más de 8°).',
    ],
  },
  ecg: {
    title: 'Latidos del corazón',
    simple:
      'El electrocardiograma registra la actividad eléctrica del corazón. Podemos utilizar sus latidos como referencia para sincronizar el movimiento de nuestra válvula experimental.',
    look: ['Cada pico alto, marcado con «R», es un latido.', 'Las franjas turquesa muestran cuándo la válvula está abierta.', 'Toca el gráfico para explorar un punto.'],
    tech: [
      'El ECG no mide directamente la apertura de la válvula: registra la activación eléctrica. Entre el pico R y el movimiento mecánico existe un retraso electromecánico; en el prototipo es el parámetro τ (100 ms por defecto, configurable).',
      'Los picos R se detectan con un algoritmo inspirado en Pan–Tompkins: derivada → cuadrado → integración en 150 ms → umbral adaptativo con período refractario de 250 ms.',
      'Aquí el ECG es sintético. Un ECG real solo se conectaría mediante un módulo aislado, a batería o inalámbrico; nunca electrodos corporales a un circuito alimentado por USB sin aislamiento.',
    ],
  },
  timing: {
    title: 'Qué pasa en cada latido',
    simple:
      'Esta barra muestra el orden de los acontecimientos: llega el latido (R), la válvula espera un instante, se abre, se mantiene abierta y se cierra antes del próximo latido. El cursor oscuro marca el momento actual.',
    tech: [
      't_apertura = t_R + τ; la apertura dura D desde su inicio y se acota a 0,9·RR − τ − 100 ms para terminar antes del siguiente latido.',
      'Las rampas del servo tienen duración fija (120 ms al abrir, 100 ms al cerrar), por eso un cambio de FC no altera la «firma» mecánica de cada evento.',
    ],
  },
  sync: {
    title: '¿La válvula sigue al corazón?',
    simple:
      'Compara cuánto dura cada ciclo de la válvula con el tiempo entre dos latidos. Si casi no hay diferencia, la válvula se mueve sincronizada con el ritmo del corazón.',
    tech: ['Error de sincronía = |duración del ciclo valvular − RR|. Tolerancia demostrativa: 60 ms.'],
  },
  valveMotion: {
    title: 'La válvula en movimiento',
    simple:
      'Vista de frente de las dos valvas, sincronizada con el motor. Los números resumen cada ciclo: cuánto se abre la válvula, cuánto tarda en abrir y en cerrar, y qué tan regular es su ritmo.',
    tech: [
      'Tiempos de apertura y cierre: transición 10 %→90 % (y 90 %→10 %) entre el mínimo y el máximo del ángulo en cada ciclo.',
      'Regularidad con ECG: 100·exp(−(MAD(ciclo − RR)/RR/0,06)^1,5). La variación del RR es fisiológica; lo que importa es que el ciclo siga al RR.',
      'Los ciclos se segmentan con un umbral adaptativo sobre el ángulo (mínimo reciente + 8°), que funciona incluso si la válvula no cierra del todo.',
    ],
  },
  vibration: {
    title: 'Vibración de la válvula',
    simple:
      'Cada vez que la válvula se mueve y sus piezas hacen contacto, produce pequeñas vibraciones. Este sensor las transforma en señales eléctricas que podemos analizar.',
    look: [
      'Los picos muestran los momentos de mayor vibración.',
      'La altura de un pico indica la intensidad registrada.',
      'Una vibración diferente puede indicar que el movimiento mecánico cambió; no significa automáticamente que exista una enfermedad.',
    ],
    tech: [
      'Sensor piezoeléctrico de 12–15 mm fijado en la pared externa del anillo. En el dashboard se muestrea a 1 kHz; amplitud en unidades arbitrarias (depende del montaje y del acondicionamiento).',
      'Descriptores por ciclo: RMS, pico absoluto y energía E = Σ x²·Δt. Se comparan con la línea basal mediante puntajes z.',
    ],
  },
  sound: {
    title: 'Sonido de la válvula',
    simple:
      'Al abrirse y cerrarse, una válvula mecánica puede producir pequeños sonidos. Nuestro micrófono registra esos sonidos para estudiar cómo cambia su funcionamiento.',
    look: [
      'Cada onda corta es un «clic» de la válvula.',
      'Si la válvula golpea con más o menos fuerza, o en otro lugar, el clic cambia de volumen o de tono.',
    ],
    tech: [
      'Micrófono MEMS INMP441 (salida digital I²S), 8 kHz en el dashboard; amplitud normalizada a [−1, 1].',
      'Por ciclo: RMS, frecuencia dominante y centroide espectral (PSD de Welch, Hann 512, > 150 Hz). El ruido ambiente también aparece en el micrófono.',
    ],
  },
  spectrogram: {
    title: 'Mapa de sonidos',
    simple:
      'Este gráfico muestra cómo cambian los sonidos con el tiempo. Los colores ayudan a identificar qué frecuencias tienen más energía en cada momento.',
    look: [
      'Horizontal: tiempo. Vertical: tono (grave abajo, agudo arriba).',
      'Una franja vertical oscura es un clic: un sonido breve con muchos tonos a la vez.',
      'Toca una zona para saber qué representa.',
    ],
    tech: ['Espectrograma STFT: ventanas de 256 muestras (32 ms) con salto de 128 (16 ms) a 8 kHz. Color = potencia en dB relativa al máximo reciente (rango 50 dB).'],
  },
  ai: {
    title: 'Análisis inteligente',
    simple:
      'La inteligencia artificial compara las señales actuales con un patrón de referencia. Si encuentra diferencias importantes, las señala para que podamos investigarlas.',
    look: ['Si solo sube el ritmo y la vibración no cambia, lo informa como «cambio de ritmo», no como falla.', 'No diagnostica enfermedades.'],
    tech: [
      'Descriptores por evento (energía, pico, tiempos de apertura y cierre, ángulo, frecuencia dominante, centroide) → puntajes z respecto de la línea basal; correlación de las envolventes (0–500 ms desde la apertura, tolerancia ±20 ms); sincronía del ciclo con el RR del ECG.',
      'Índice de diferencia suavizado (EMA, α = 0,4). Umbrales demostrativos: 0,3 (leve) y 0,6 (importante). Si no hay desviación y |FC − FC basal| ≥ 10 lpm, se informa «cambio de FC».',
      'Es una heurística experimental a calibrar con datos reales del prototipo. No es un dispositivo médico ni entrega diagnósticos.',
    ],
  },
  similarity: {
    title: '¿Qué tan parecido es al patrón de referencia?',
    simple:
      'Comparamos el funcionamiento actual con un registro experimental obtenido cuando la válvula operaba normalmente. Cuanto más se parecen, mayor es la similitud. No es un indicador de riesgo clínico.',
    tech: ['Similitud = 100·(0,62·exp(−D²/24) + 0,38·r), con D la distancia multivariante de los puntajes z y r la correlación de forma de las envolventes.'],
  },
  anomaly: {
    title: 'Índice de diferencia',
    simple:
      'Resume en un número de 0 a 1 cuánto se aparta la señal del patrón de referencia. Cerca de 0: muy parecida. Cerca de 1: muy diferente. Es un indicador técnico del prototipo.',
    tech: ['Combina la distancia de los descriptores (72 %), el error de forma (28 %) y penalizaciones por irregularidad y por falta de sincronía con el ECG.'],
  },
  comparison: {
    title: 'Normal vs. ahora',
    simple:
      'La línea gris punteada es la vibración típica de la válvula funcionando normalmente. La línea de color es la actual. Si las dos se separan, algo cambió en el movimiento.',
    tech: ['Envolvente RMS de los primeros 500 ms desde el inicio de la apertura, en tiempo absoluto (no depende de la FC). Promedio de los últimos 4 ciclos frente al promedio de la línea basal.'],
  },
  descriptors: {
    title: '¿Qué cambió?',
    simple:
      'Cada barra muestra cuánto se aleja una característica de la señal respecto de lo normal. Las barras más largas señalan lo que más cambió.',
    tech: ['Puntaje z = (valor − media basal) / dispersión basal (con piso mínimo). Marcas en 2,5σ (leve) y 4σ (importante).'],
  },
  patient: {
    title: 'Paciente simulado',
    simple:
      'Un paciente ficticio que hace ejercicio. Sirve para imaginar cómo, en el futuro, los datos de la válvula podrían mirarse junto con la respuesta al ejercicio que estudia Kinesiología. No son datos de una persona real.',
    tech: [
      'FC con un modelo de primer orden que sigue la carga de cada etapa (reposo → calentamiento → ejercicio → enfriamiento → recuperación); SpO₂ y Borg sintéticos.',
      'La integración clínica es una visión futura: no está desarrollada ni validada.',
    ],
  },
  history: {
    title: 'Historial',
    simple:
      'Cada punto es un ciclo de la válvula. Estas líneas muestran cómo cambian las mediciones con el tiempo. También puedes descargar los datos para analizarlos.',
    tech: ['Exportación CSV/JSON con un registro por ciclo (descriptores, FC del ECG, RR, error de sincronía, similitud, índice de diferencia, veredicto, condición y origen). Zonas sombreadas: condición distinta de «Normal».'],
  },
  kinds: {
    title: '¿De dónde vienen los datos?',
    simple:
      'Simulación: datos generados para mostrar cómo funcionaría el sistema. Experimento: datos de los sensores conectados al prototipo. Visión futura: posibles aplicaciones clínicas que todavía no están desarrolladas ni validadas.',
    tech: ['Con el ESP32 desconectado no se muestran valores: el dashboard nunca presenta datos simulados como si vinieran de un sensor real.'],
  },
} satisfies Record<string, Explanation>;

export type ExplainId = keyof typeof EXPLAIN;
