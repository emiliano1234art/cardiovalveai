/*
 * Protocolo binario CardioValveAI v3 (ESP32 → computadora, por la UART0 del puente USB).
 *
 * Trama:  A5 5A | tipo u8 | largo u16 | secuencia u16 | carga (largo bytes) | CRC16 u16
 *   - enteros en little-endian; CRC16-CCITT (polinomio 0x1021, inicial 0xFFFF) sobre tipo..carga.
 *   - la secuencia es POR TIPO: un salto indica tramas perdidas de ese flujo.
 * Comandos (computadora → ESP32): líneas de texto terminadas en '\n' (ver cmd.c).
 * La especificación completa de cada carga está en docs/Protocolo_Serie.md del paquete.
 */
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#define PROTO_VERSION 3

enum {
    FR_INFO   = 0x01,  /* JSON: versión, configuración, calibración del ADC y estado de calibración de cada Hall */
    FR_HALL   = 0x03,  /* H1..H3 (1 kS/s, suma de 8 muestras de 12 bits) */
    FR_AUDIO  = 0x04,  /* INMP441, int16 (8 kHz diezmado o 16 kHz completo) */
    FR_CMD    = 0x05,  /* ángulo comandado al servo (200 Hz) */
    FR_EVENT  = 0x06,  /* eventos con marca de tiempo */
    FR_STATUS = 0x07,  /* contadores de salud (2 Hz) */
    FR_TEXT   = 0x08,  /* mensajes de texto */
    FR_NTYPES = 0x09
};

enum {
    EV_CYCLE_START = 1, EV_OPEN_CMD_START = 2, EV_OPEN_CMD_END = 3, EV_CLOSE_CMD_START = 4, EV_CLOSE_CMD_END = 5,
    EV_SYNC_LED_ON = 6, EV_SYNC_LED_OFF = 7, EV_RUN_START = 8, EV_RUN_END = 9,
    EV_STOP_USER = 10, EV_STOP_ESTOP = 11, EV_STOP_HEARTBEAT = 12, EV_STOP_STALL = 13, EV_STOP_ACQ_FAULT = 14,
    EV_SERVO_DETACHED = 15, EV_SERVO_ATTACHED = 16, EV_STOP_LIMIT = 17, EV_ESTOP_RELEASED = 18,
    EV_ADC_POOL_OVF = 20, EV_I2S_OVF = 21, EV_ADC_PATTERN_ERR = 22, EV_TX_DROP = 23,
};

void proto_init(int baud);
/* Encola una trama (no bloquea). Devuelve false si el búfer de transmisión está lleno (trama descartada y contada). */
bool proto_send(uint8_t type, const void *payload, uint16_t len);
void proto_event(uint8_t code, int32_t arg);
void proto_text(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
uint32_t proto_dropped(void);
uint32_t proto_bytes_sent(void);
uint16_t proto_crc16(const uint8_t *d, size_t n, uint16_t crc);
