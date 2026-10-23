/*
 * CardioValveAI v3 — asignación de pines para ESP32 DevKit V1 (ESP32-WROOM-32).
 * VERIFICAR contra la serigrafía de SU placa: hay versiones de 30 y 38 pines con distinto orden.
 *
 *  - GPIO 6–11: flash interna → no usar. GPIO 0, 2, 5, 12, 15: pines de arranque → sin cargas que fuercen nivel al arrancar.
 *  - GPIO 1/3: UART0 (puente USB) → protocolo binario.
 *  - ADC2 no admite modo continuo (DMA) → los Hall van en ADC1 (GPIO 32–39). GPIO 34–39: solo entrada.
 *  - Ninguna entrada del ESP32 admite 5 V: los Hall se alimentan con 3,3 V (3V3_A) o, si su modelo exige 5 V,
 *    su salida pasa por un divisor antes del ADC (ver esquema).
 */
#pragma once
#include "hal/adc_types.h"

#define PIN_H1      36   /* VP  → ADC1_CH0  Hall valva 1 */
#define PIN_H2      39   /* VN  → ADC1_CH3  Hall valva 2 */
#define PIN_H3      32   /*       ADC1_CH4  Hall valva 3 */
#define CH_H1       ADC_CHANNEL_0
#define CH_H2       ADC_CHANNEL_3
#define CH_H3       ADC_CHANNEL_4

/* Micrófono INMP441 (I2S1; el I2S0 lo usa el ADC continuo en el ESP32 clásico) */
#define PIN_I2S_SCK 26
#define PIN_I2S_WS  25
#define PIN_I2S_SD  27   /* L/R del INMP441 a GND → canal izquierdo */

#define PIN_SERVO    18  /* PWM LEDC 50 Hz */
#define PIN_SYNC_LED 19  /* LED de sincronización con el video */
#define PIN_ESTOP    23  /* contacto NA a GND (pull-up interno). No reemplaza al corte físico de 5 V del servo */
#define PIN_STATUS   2   /* LED de la placa */
