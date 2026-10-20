import type { Explanation } from '../content/explanations';

/** Explicaciones a pedido de la presentación oficial (sencilla + científica). */
export const PX = {
  what: {
    title: '¿Cómo funciona CardioVal AI?',
    simple:
      'Una válvula experimental de tres valvas se abre y se cierra. Un sensor piezoeléctrico capta su vibración y un micrófono MEMS su sonido. El ESP32 envía los datos, el análisis los compara con una referencia y el dashboard muestra el resultado.',
    look: ['Piezo = vibración.', 'MEMS = sonido.', 'ESP32 = adquisición y envío.'],
    tech: [
      'Cadena de adquisición propuesta: piezoeléctrico (ADC del ESP32, tras acondicionamiento) y MEMS INMP441 (I²S) → ESP32 → transmisión al computador → extracción de descriptores por evento (energía, RMS, frecuencia dominante) → comparación con una línea basal del propio prototipo.',
      'Hoy funcionan la simulación, el dashboard y el análisis experimental; el prototipo físico y la medición real son el siguiente paso.',
    ],
  },
  wicked: {
    title: '¿Por qué es un «wicked problem»?',
    simple:
      'Es un problema complejo: cada disciplina lo define distinto, no tiene una única solución correcta y cada persona es un caso diferente. Por eso no buscamos «resolverlo», sino aportar una herramienta que ayude a integrar información.',
    tech: [
      'Rittel y Webber (1973) describen los «wicked problems» como problemas sin formulación definitiva, sin regla de término y cuyas soluciones son mejores o peores, no verdaderas o falsas.',
      'Las guías de enfermedad valvular recomiendan seguimiento clínico e imágenes de las prótesis, y la rehabilitación cardíaca basada en ejercicio se estudia tras la cirugía valvular. CardioVal AI explora una fuente de información complementaria, sin cuestionar esas evaluaciones.',
    ],
  },
  interdisc: {
    title: '¿Qué significa integrar disciplinas?',
    simple:
      'No es dividir el trabajo en dos listas. Cada decisión del proyecto necesita a ambas carreras: Kinesiología dice qué es relevante para la persona y Biomedicina cómo medirlo y analizarlo.',
    tech: [
      'Las decisiones conjuntas se documentan en el Toolkit (Encargo 1). Los hallazgos específicos del Toolkit se incorporarán cuando el documento esté disponible en el repositorio.',
    ],
  },
  materials: {
    title: '¿Cómo se conectan los materiales?',
    simple:
      'El servo mueve la válvula. El piezo y el micrófono la escuchan. El ESP32 lee los sensores y envía los datos al computador, que los muestra en el dashboard. La fuente alimenta todo y la base mantiene cada pieza en su lugar.',
    tech: [
      'Piezo → acondicionamiento (divisor/protección) → ADC del ESP32. INMP441 → I²S (SCK, WS, SD). Servo MG90S → PWM 50 Hz con alimentación externa de 5 V y tierra común.',
      'Lista sin costos ni proveedores: se completará con la planilla de compras del equipo.',
    ],
  },
  gantt: {
    title: '¿Qué muestra el cronograma?',
    simple: 'Las diez etapas del proyecto, desde la investigación hasta la Feria del 4 de noviembre. Algunas etapas avanzan en paralelo.',
    tech: ['Fechas PROPUESTAS: el Encargo 2 no estaba disponible al construir esta versión. Se editan en src/presentation/content.ts (GANTT).'],
  },
  interview: {
    title: '¿Cómo se relaciona con CardioVal AI?',
    simple:
      'El Diagrama de Wiggers muestra, en un mismo latido, la señal eléctrica del corazón (ECG), las presiones del ventrículo izquierdo y de la aorta, el volumen y los ruidos cardíacos. Nos ayuda a entender cuándo y por qué se abre y se cierra la válvula aórtica.',
    look: [
      'La válvula se abre cuando la presión del ventrículo supera a la de la aorta, y se cierra cuando vuelve a quedar por debajo.',
      'La apertura ocurre después del pico R del ECG: hay un retraso.',
    ],
    tech: [
      'Interpretación de nuestro equipo (no es una recomendación del profesor): usamos el diagrama como fundamento fisiológico para (1) sincronizar la válvula experimental con una señal de ECG considerando el retraso τ entre la activación eléctrica y la apertura; (2) relacionar la apertura y el cierre con la vibración del piezoeléctrico y el sonido del micrófono MEMS; y (3) interpretar el funcionamiento del prototipo dentro del ciclo cardíaco.',
      'Las curvas de esta pantalla son un diagrama simplificado e ilustrativo construido con nuestro modelo de simulación; no son mediciones. Nuestro prototipo se mueve con un actuador, no por presión.',
    ],
  },
  proto: {
    title: '¿Cómo funciona el prototipo?',
    simple:
      'Un solo servomotor gira una leva que sube y baja un anillo actuador. Tres bielas transmiten ese movimiento a las tres valvas. El piezo, en la estructura rígida, capta la vibración; el MEMS, cerca del anillo, capta el sonido; el ESP32 registra y envía.',
    look: ['Una válvula real NO tiene motor: la mueve la presión de la sangre.', 'Diseño conceptual: falta construirlo y validarlo.'],
    tech: [
      'Cadena: servo MG90S → leva → anillo actuador → 3 bielas → 3 valvas. La apertura restringida se simula con un tope en una valva, sin cambiar el comando del servo.',
      'El servo impone la trayectoria; no reproduce las fuerzas hemodinámicas ni la deformación del tejido. Torque y holguras: por evaluar en el prototipo.',
    ],
  },
  real: {
    title: '¿Válvula real o prototipo?',
    simple:
      'En el cuerpo, la válvula aórtica se abre cuando la presión del ventrículo supera a la de la aorta y se cierra cuando la sangre intenta volver. No usa motores ni sensores. Nuestro prototipo usa un actuador para repetir el movimiento y estudiar sus señales.',
    tech: [
      'Es la válvula AÓRTICA (tres valvas semilunares, lado izquierdo), no la tricúspide (lado derecho). El ECG mide actividad eléctrica; no mide la apertura valvular.',
    ],
  },
  math: {
    title: '¿Para qué sirven estos modelos?',
    simple:
      'Describen con precisión el movimiento de las valvas, la intensidad de las vibraciones y el ritmo del latido. Así podemos comparar ciclos con números y no solo a simple vista.',
    tech: [
      'Límites: continuidad de θ(t) en los instantes de apertura y cierre. Derivadas: velocidad angular. Integrales: energía de la señal. Todas las curvas son simuladas.',
    ],
  },
  results: {
    title: '¿Qué significan estos resultados?',
    simple:
      'Son lo que esperamos lograr para la Feria. Todavía no son resultados obtenidos: se confirmarán al construir el prototipo y registrar señales reales.',
    tech: [
      'Criterio mínimo propuesto: diferencias repetibles en descriptores de vibración y sonido entre funcionamiento normal y apertura restringida, sobre varios ciclos del mismo montaje.',
      'La IA reconoce cambios mecánicos respecto de una referencia; no diagnostica.',
    ],
  },
  souvenir: {
    title: '¿Cómo sería el souvenir?',
    simple: 'Un llavero o modelo de escritorio impreso en 3D con la válvula de tres valvas y un QR al dashboard. Es una propuesta para la Feria.',
    tech: ['Material propuesto: PETG. Tamaño y cantidad por definir según tiempo de impresión.'],
  },
  dashboard: {
    title: '¿Qué está implementado en el dashboard?',
    simple:
      'Hoy el dashboard funciona con datos simulados: válvula trivalva, ECG, vibración, sonido e IA experimental. La conexión con el ESP32 está programada y se probará con el prototipo.',
    tech: [
      'La versión publicada en GitHub Pages se actualiza cuando los cambios se integran a la rama principal; hasta entonces puede mostrar una versión anterior.',
      'El laboratorio incluido en este archivo (#/dashboard) siempre corresponde a esta versión y funciona sin conexión.',
    ],
  },
} satisfies Record<string, Explanation>;
