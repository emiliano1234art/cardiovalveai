/*
 * CardioVal AI v2 — asignación de pines para ESP32 DevKit V1 (ESP32-WROOM-32, 30 pines).
 * VERIFICAR contra la serigrafía de la placa comprada (hay clones con otro orden de pines).
 *
 * Reglas aplicadas (hoja de datos ESP32 / guía de hardware ESP32-WROOM-32):
 *  - GPIO 6–11: flash SPI interna → no usar.
 *  - GPIO 0, 2, 5, 12, 15: pines de arranque (strapping) → evitar en entradas con nivel fijo al arrancar.
 *    GPIO 12 en alto al arrancar cambia la tensión de la flash → no usar.
 *  - GPIO 1/3: UART0 (puente USB) → reservado para el protocolo binario.
 *  - ADC2 no funciona en modo continuo (DMA) en el ESP32 → todas las entradas analógicas en ADC1 (GPIO 32–39).
 *  - GPIO 34–39: solo entrada, sin resistencias internas.
 */
#pragma once
#include "hal/adc_types.h"

/* Entradas analógicas (ADC1, atenuación 12 dB, rango lineal ≈ 0,15–2,45 V) */
#define PIN_H1      36   /* VP  → ADC1_CH0  Hall valva 1 (DRV5055A1) */
#define PIN_H2      39   /* VN  → ADC1_CH3  Hall valva 2 */
#define PIN_P1      34   /*       ADC1_CH6  piezo P1 (anillo), tras el acondicionamiento */
#define PIN_P2      35   /*       ADC1_CH7  piezo P2 (soporte del servo) */
#define PIN_H3      32   /*       ADC1_CH4  Hall valva 3 */
#define PIN_H0      33   /*       ADC1_CH5  Hall del plato (DRV5055A2) */
#define CH_H1       ADC_CHANNEL_0
#define CH_H2       ADC_CHANNEL_3
#define CH_P1       ADC_CHANNEL_6
#define CH_P2       ADC_CHANNEL_7
#define CH_H3       ADC_CHANNEL_4
#define CH_H0       ADC_CHANNEL_5

/* Micrófono INMP441 (I2S1; el I2S0 lo ocupa el ADC continuo en el ESP32 clásico) */
#define PIN_I2S_SCK 26
#define PIN_I2S_WS  25
#define PIN_I2S_SD  27   /* L/R del INMP441 a GND → canal izquierdo */

/* Servo MG90S: PWM LEDC 50 Hz */
#define PIN_SERVO   18

/* Interfaz de usuario y seguridad */
#define PIN_SYNC_LED 19  /* LED visible en el video: marca de sincronización (pulso al inicio de cada ciclo) */
#define PIN_ESTOP    23  /* pulsador NA a GND (pull-up interno): parada → PWM desactivado. No reemplaza al corte físico de 5 V */
#define PIN_STATUS   2   /* LED azul de la placa (strapping: solo salida, sin carga externa) */

/* INA219 (corriente del servo, opcional) — I2C0 */
#define PIN_SDA      21
#define PIN_SCL      22
#define INA219_ADDR  0x40
