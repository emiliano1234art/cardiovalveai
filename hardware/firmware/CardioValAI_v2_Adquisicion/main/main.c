/*
 * CardioVal AI v2 — firmware de adquisición y control (prototipo académico, banco SIN fluido).
 * No es un dispositivo médico ni de diagnóstico. No conectar electrodos corporales a este circuito.
 *
 * Tareas (FreeRTOS):
 *   núcleo 1: adc (prio 10), i2s (prio 9)
 *   núcleo 0: servo (prio 8, 5 ms), ina (prio 6, 2 ms), tx (prio 5), cmd (prio 4), principal (estado, 2 Hz)
 */
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"
#include "esp_system.h"
#include "esp_heap_caps.h"
#include "driver/gpio.h"
#include "proto.h"
#include "acq.h"
#include "servo.h"
#include "cmd.h"
#include "ina219.h"
#include "board_pins.h"

#ifndef CVAI_BAUD
#define CVAI_BAUD 921600     /* CP2102: 921600 confiable. CH340/CP2102N admiten más (≥ 1,5 M para audio de 16 kHz) */
#endif
int g_baud = CVAI_BAUD;

void app_main(void)
{
    proto_init(g_baud);
    servo_init();                   /* PWM apagado al arrancar */
    acq_adc_start();
    acq_i2s_start();
    ina219_start(0.1f);             /* módulo típico con R = 0,1 Ω: VERIFICAR */
    cmd_start();
    vTaskDelay(pdMS_TO_TICKS(400)); /* deja pasar la detección de la ranura del micrófono */
    send_info();
    proto_text("CardioVal AI v2 listo. Enviar 'STREAM ON' y latidos 'HB'. Servo sin pulsos hasta START/MOVE.");

    struct __attribute__((packed)) status {
        int64_t t; uint32_t adc_frames, adc_ovf, adc_pat_err, adc_gaps, i2s_frames, i2s_ovf, tx_dropped, tx_bytes;
        uint32_t sat[6]; uint32_t audio_sat; uint32_t free_heap; uint16_t hall_last[4];
        int16_t cmd_x100; uint8_t phase; uint8_t estop; uint32_t cycle; int16_t servo_ma;
    } st;
    TickType_t wake = xTaskGetTickCount();
    bool led = false;
    for (;;) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(500));
        memset(&st, 0, sizeof st);
        st.t = esp_timer_get_time();
        st.adc_frames = g_acq.adc_frames; st.adc_ovf = g_acq.adc_pool_ovf; st.adc_pat_err = g_acq.adc_pattern_err; st.adc_gaps = g_acq.adc_gaps;
        st.i2s_frames = g_acq.i2s_frames; st.i2s_ovf = g_acq.i2s_ovf; st.tx_dropped = proto_dropped(); st.tx_bytes = proto_bytes_sent();
        for (int k = 0; k < 6; k++) st.sat[k] = g_acq.sat[k];
        st.audio_sat = g_acq.audio_sat;
        st.free_heap = heap_caps_get_free_size(MALLOC_CAP_8BIT);
        for (int k = 0; k < 4; k++) st.hall_last[k] = g_acq.hall_last[k];
        st.cmd_x100 = (int16_t)(servo_cmd_now() * 100);
        st.phase = (uint8_t)servo_phase();
        st.estop = servo_estop_active();
        st.cycle = servo_cycle();
        int ma = ina219_last_ma();
        st.servo_ma = ma == INA219_ABSENT ? INT16_MIN : (int16_t)ma;
        proto_send(FR_STATUS, &st, sizeof st);
        led = !led;
        gpio_set_level(PIN_STATUS, led);
    }
}
