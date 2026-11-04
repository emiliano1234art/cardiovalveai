/*
  CardioValve AI — firmware ESP32
  ---------------------------------------------------------------
  Servo MG90S  -> GPIO 18   (rojo = +5V externo, café = GND común)
  Hall 1       -> GPIO 34   (VCC = 3V3)
  Hall 2       -> GPIO 35   (VCC = 3V3)
  Hall 3       -> GPIO 32   (VCC = 3V3)

  La comunicación con el dashboard es SOLO por el cable USB (Web Serial).
  No usa WiFi ni Bluetooth.

  Librería necesaria: ESP32Servo  (Administrar bibliotecas -> "ESP32Servo")
  Velocidad del Monitor Serie / dashboard: 115200 baudios.

  Comandos que entiende (una línea de texto cada uno):
    MODE:SANO          válvula normal      (servo abre ANGULO_NORMAL)
    MODE:INCOMPLETA    válvula incompleta  (servo abre ANGULO_INCOMPLETA)
    STOP / START       pausa o reanuda el movimiento
    HB                 latido del dashboard (si deja de llegar, el servo se detiene)
    CAL_ZERO           re-mide el valor neutro de los Hall (imanes lejos)
    CAL_SPAN           durante 8 s mide la señal máxima de cada Hall
                       (acerca los imanes a cada sensor mientras dura)
*/

#include <ESP32Servo.h>
#include <math.h>

// ───────────────────────── Pines ─────────────────────────
const int PIN_SERVO = 18;
const int PIN_HALL[3] = {34, 35, 32};

// ───────── Servo: calibración que ya comprobaste ─────────
// 500 µs  = 0°   (posición vertical de partida)
// 2500 µs = 180° (media vuelta completa)
const int US_0   = 500;
const int US_180 = 2500;

// ───────── Ángulos de apertura de cada modo (en grados del servo) ─────────
// Si quieres que la válvula "normal" use la media vuelta completa, pon 180.
const float ANGULO_NORMAL     = 80.0;
const float ANGULO_INCOMPLETA = 35.0;

// ───────── Tiempos de cada fase del ciclo (ms) ─────────
// Lentos a propósito: el MG90S se mueve fluido y sin perder fuerza.
// Para acelerar, baja los valores.
struct Perfil {
  float angulo;
  unsigned long tSubida, tMeseta, tBajada, tDiastole;
};
Perfil PERFIL_NORMAL     = {ANGULO_NORMAL,     1800, 400, 1500, 1200};
Perfil PERFIL_INCOMPLETA = {ANGULO_INCOMPLETA, 1300, 300, 1200, 1200};

// ───────── Sensores Hall ─────────
// Posición angular aproximada (°) de cada sensor respecto de la válvula cerrada.
// Ajústalo a donde estén físicamente tus sensores.
float HALL_POS_DEG[3] = {20.0, 50.0, 80.0};
const int   HALL_ZONA_MUERTA = 40;    // cuentas ADC que se ignoran (ruido)
float       hallEscala[3]    = {600, 600, 600}; // cuentas con el imán pegado (CAL_SPAN las ajusta)

// ───────── Estado ─────────
enum Fase { APERTURA, MESETA, CIERRE, DIASTOLE };
Fase fase = DIASTOLE;
bool modoNormal = true;
bool sistemaActivo = true;
unsigned long tInicioFase = 0;
unsigned long ciclo = 0;
float anguloServo = 0.0;

Servo servo;

float hallNeutro[3] = {2048, 2048, 2048};
float hallFiltrado[3] = {2048, 2048, 2048};
float hallW[3] = {0, 0, 0};
float hallGrados = 0.0;

bool calSpan = false;
unsigned long tFinSpan = 0;
float spanMax[3] = {0, 0, 0};

unsigned long tUltimoEnvio = 0;
const unsigned long INTERVALO_TELEMETRIA = 40;   // 25 Hz
unsigned long tUltimoLatido = 0;
const unsigned long TIMEOUT_LATIDO = 5000;

// ───────── Utilidades ─────────
int anguloAMicros(float angulo) {
  return US_0 + (int)((US_180 - US_0) * (angulo / 180.0) + 0.5);
}

void moverServo(float angulo) {
  if (angulo < 0) angulo = 0;
  if (angulo > 180) angulo = 180;
  anguloServo = angulo;
  servo.writeMicroseconds(anguloAMicros(angulo));
}

// Curva suave de 5º orden: arranca y frena sin tirones
float suavizar(float t) {
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return t * t * t * (t * (t * 6 - 15) + 10);
}

float interpolar(float desde, float hasta, unsigned long t, unsigned long dur) {
  if (dur == 0) return hasta;
  return desde + (hasta - desde) * suavizar((float)t / (float)dur);
}

const char* nombreFase() {
  if (!sistemaActivo) return "PAUSA";
  switch (fase) {
    case APERTURA: return "APERTURA";
    case MESETA:   return "MESETA";
    case CIERRE:   return "CIERRE";
    default:       return "DIASTOLE";
  }
}

// ───────── Hall ─────────
int leerAdc(int pin) {
  long s = 0;
  for (int i = 0; i < 4; i++) s += analogRead(pin);
  return (int)(s / 4);
}

void calibrarNeutro() {
  // Mantén los imanes LEJOS de los sensores mientras se mide
  double acc[3] = {0, 0, 0};
  const int N = 64;
  for (int i = 0; i < N; i++) {
    for (int k = 0; k < 3; k++) acc[k] += leerAdc(PIN_HALL[k]);
    delay(5);
  }
  for (int k = 0; k < 3; k++) {
    hallNeutro[k] = acc[k] / N;
    hallFiltrado[k] = hallNeutro[k];
  }
}

float suavizado01(float a, float b, float x) {
  float t = (x - a) / (b - a);
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}

// Convierte la intensidad de cada Hall en un ángulo: promedio ponderado de las
// posiciones de los sensores, con peso = cuánto detecta cada uno.
void actualizarHall() {
  float totalW = 0, sumaPos = 0;
  for (int k = 0; k < 3; k++) {
    hallFiltrado[k] += 0.35f * (leerAdc(PIN_HALL[k]) - hallFiltrado[k]);
    float dev = fabsf(hallFiltrado[k] - hallNeutro[k]);

    if (calSpan && dev > spanMax[k]) spanMax[k] = dev;

    float w = (dev - HALL_ZONA_MUERTA) / (hallEscala[k] - HALL_ZONA_MUERTA);
    if (w < 0) w = 0;
    if (w > 1) w = 1;
    hallW[k] = w;
    totalW += w;
    sumaPos += w * HALL_POS_DEG[k];
  }
  if (totalW < 0.05f) {
    hallGrados = 0.0;
  } else {
    hallGrados = (sumaPos / totalW) * suavizado01(0.05f, 0.4f, totalW);
  }

  if (calSpan && millis() > tFinSpan) {
    calSpan = false;
    for (int k = 0; k < 3; k++)
      if (spanMax[k] > 150) hallEscala[k] = spanMax[k] * 0.9f;
    Serial.println("{\"info\":\"CAL_SPAN listo\"}");
  }
}

// ───────── Servo: máquina de fases ─────────
void actualizarServo() {
  if (tUltimoLatido != 0 && millis() - tUltimoLatido > TIMEOUT_LATIDO) sistemaActivo = false;

  if (!sistemaActivo) {
    // Vuelve despacio a 0° (vertical) y se queda ahí
    if (anguloServo > 0.2f) moverServo(anguloServo - 0.6f);
    else moverServo(0);
    return;
  }

  const Perfil &p = modoNormal ? PERFIL_NORMAL : PERFIL_INCOMPLETA;
  unsigned long t = millis() - tInicioFase;

  switch (fase) {
    case APERTURA:
      if (t < p.tSubida) moverServo(interpolar(0, p.angulo, t, p.tSubida));
      else { moverServo(p.angulo); fase = MESETA; tInicioFase = millis(); }
      break;
    case MESETA:
      if (t >= p.tMeseta) { fase = CIERRE; tInicioFase = millis(); }
      break;
    case CIERRE:
      if (t < p.tBajada) moverServo(interpolar(p.angulo, 0, t, p.tBajada));
      else { moverServo(0); fase = DIASTOLE; tInicioFase = millis(); }
      break;
    case DIASTOLE:
      if (t >= p.tDiastole) { fase = APERTURA; tInicioFase = millis(); ciclo++; }
      break;
  }
}

// ───────── Comandos ─────────
void enviarHello();

void procesarComando(String s) {
  s.trim();
  s.toUpperCase();
  if (s.length() == 0) return;

  if (s == "HB") { tUltimoLatido = millis(); return; }

  if (s == "MODE:SANO" || s == "SANO") {
    modoNormal = true;
  } else if (s == "MODE:INCOMPLETA" || s == "INCOMPLETA" || s == "ESTENOSIS" || s == "MODE:ESTENOSIS") {
    modoNormal = false;
  } else if (s == "STOP") {
    sistemaActivo = false;
  } else if (s == "START") {
    sistemaActivo = true;
    tUltimoLatido = millis();
    fase = DIASTOLE;
    tInicioFase = millis();
  } else if (s == "CAL_ZERO") {
    calibrarNeutro();
    Serial.println("{\"info\":\"CAL_ZERO listo\"}");
  } else if (s == "CAL_SPAN") {
    calSpan = true;
    tFinSpan = millis() + 8000;
    for (int k = 0; k < 3; k++) spanMax[k] = 0;
    Serial.println("{\"info\":\"CAL_SPAN 8 s: acerca los imanes a cada sensor\"}");
  } else if (s == "HELLO") {
    enviarHello();
  }
}

void leerSerial() {
  static String buf;
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (buf.length() > 0) procesarComando(buf);
      buf = "";
    } else if (buf.length() < 64) {
      buf += c;
    }
  }
}

// ───────── Telemetría ─────────
void enviarHello() {
  Serial.print("{\"hello\":1,\"fw\":\"1.0\",\"normal\":");
  Serial.print(ANGULO_NORMAL, 1);
  Serial.print(",\"incompleta\":");
  Serial.print(ANGULO_INCOMPLETA, 1);
  Serial.println("}");
}

void enviarTelemetria() {
  unsigned long ahora = millis();
  if (ahora - tUltimoEnvio < INTERVALO_TELEMETRIA) return;
  tUltimoEnvio = ahora;

  Serial.print("{\"t\":");   Serial.print(ahora);
  Serial.print(",\"sv\":");  Serial.print(anguloServo, 1);
  Serial.print(",\"h\":[");
  for (int k = 0; k < 3; k++) { Serial.print((int)hallFiltrado[k]); if (k < 2) Serial.print(","); }
  Serial.print("],\"w\":[");
  for (int k = 0; k < 3; k++) { Serial.print(hallW[k], 2); if (k < 2) Serial.print(","); }
  Serial.print("],\"hd\":"); Serial.print(hallGrados, 1);
  Serial.print(",\"m\":\""); Serial.print(modoNormal ? "SANO" : "INCOMPLETA");
  Serial.print("\",\"f\":\""); Serial.print(nombreFase());
  Serial.print("\",\"c\":"); Serial.print(ciclo);
  Serial.print(",\"on\":"); Serial.print(sistemaActivo ? 1 : 0);
  Serial.println("}");
}

// ───────── Arduino ─────────
void setup() {
  Serial.begin(115200);

  analogReadResolution(12);          // 0..4095
  analogSetAttenuation(ADC_11db);    // rango ~0..3,3 V
  for (int k = 0; k < 3; k++) pinMode(PIN_HALL[k], INPUT);

  servo.setPeriodHertz(50);
  servo.attach(PIN_SERVO, US_0, US_180);
  moverServo(0);                     // parte en 0° (vertical), sin dar un salto
  delay(1500);

  calibrarNeutro();                  // imanes lejos al encender
  tInicioFase = millis();
  enviarHello();
}

void loop() {
  leerSerial();
  actualizarHall();
  actualizarServo();
  enviarTelemetria();
  delay(10);                         // ~100 Hz de lazo; el servo se actualiza cada ~10 ms
}
