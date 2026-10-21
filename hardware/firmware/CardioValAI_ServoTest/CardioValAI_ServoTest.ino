/*
  CardioVal AI — prueba del mecanismo (ESP32 + MG90S)
  ----------------------------------------------------
  NO PROBADO EN HARDWARE: es un punto de partida para las pruebas iniciales.
  Requiere la librería «ESP32Servo» (Kevin Harrington / John K. Bennett).

  Comandos por el monitor serie (115200 baudios), terminar con Enter:
    c        válvula cerrada (servo en ANG_CERRADA)
    a        válvula abierta (servo en ANG_ABIERTA)
    f72      ciclo continuo a 72 ciclos/min (cualquier valor 10–120)
    i        ritmo irregular (intervalo variable ±25 %)
    s        detener el ciclo
    k130     calibrar el ángulo de cierre (grados de comando)
    o50      calibrar el ángulo de apertura

  Prueba de control: retirar el tornillo del empujador y usar «f60» para registrar
  la vibración y el sonido del servo sin mover las valvas.

  Cableado propuesto: señal del servo → GPIO 18 · servo a fuente externa de 5 V ·
  GND de la fuente unida a la GND del ESP32. Nunca conectar electrodos corporales.
*/
#include <ESP32Servo.h>

const int PIN_SERVO = 18;
int ANG_CERRADA = 130;   // palanca +40° (plato arriba, valvas cerradas)
int ANG_ABIERTA = 50;    // palanca −40° (plato abajo, valvas a 80°)
const unsigned long T_APERTURA = 120;   // ms (rampa de apertura)
const unsigned long T_CIERRE = 100;     // ms (rampa de cierre)

Servo servo;
float cpm = 0;            // ciclos por minuto (0 = detenido)
bool irregular = false;
unsigned long tCiclo = 0, periodo = 1000;

void mover(int desde, int hasta, unsigned long ms) {
  const int pasos = 20;
  for (int k = 1; k <= pasos; k++) {
    float u = (float)k / pasos;
    float s = 0.5f - 0.5f * cosf(PI * u);          // perfil suave (igual que la simulación)
    servo.write(desde + (hasta - desde) * s);
    delay(ms / pasos);
  }
}

void ciclo() {
  mover(ANG_CERRADA, ANG_ABIERTA, T_APERTURA);
  delay(max(0L, (long)(periodo * 0.35) - (long)T_APERTURA));   // fase abierta ≈ 35 % del ciclo
  mover(ANG_ABIERTA, ANG_CERRADA, T_CIERRE);
}

void setup() {
  Serial.begin(115200);
  servo.setPeriodHertz(50);
  servo.attach(PIN_SERVO, 500, 2400);
  servo.write(ANG_CERRADA);
  Serial.println("CardioVal AI · prueba del mecanismo. Comandos: c a f72 i s k130 o50");
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n'); cmd.trim();
    char c = cmd.length() ? cmd.charAt(0) : ' ';
    int v = cmd.length() > 1 ? cmd.substring(1).toInt() : 0;
    if (c == 'c') { cpm = 0; servo.write(ANG_CERRADA); }
    else if (c == 'a') { cpm = 0; servo.write(ANG_ABIERTA); }
    else if (c == 'f' && v >= 10 && v <= 120) { cpm = v; irregular = false; }
    else if (c == 'i') { if (cpm == 0) cpm = 60; irregular = true; }
    else if (c == 's') { cpm = 0; }
    else if (c == 'k' && v > 0 && v <= 180) { ANG_CERRADA = v; servo.write(v); }
    else if (c == 'o' && v > 0 && v <= 180) { ANG_ABIERTA = v; servo.write(v); }
    Serial.printf("cpm=%.0f irregular=%d cerrada=%d abierta=%d\n", cpm, irregular, ANG_CERRADA, ANG_ABIERTA);
  }
  if (cpm > 0 && millis() - tCiclo >= periodo) {
    tCiclo = millis();
    periodo = (unsigned long)(60000.0f / cpm);
    if (irregular) periodo = periodo * (75 + random(51)) / 100;   // ±25 %
    ciclo();
  }
}
