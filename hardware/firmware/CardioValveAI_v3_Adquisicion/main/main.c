/*
 * CardioValveAI v3 — firmware de adquisición y control (prototipo académico, banco SIN fluido).
 * No es un dispositivo médico ni de diagnóstico.
 * Sensores: 3 Hall lineales (uno por valva) + micrófono INMP441 (complementario).
 *
 * Tareas (FreeRTOS):
 *   núcleo 1: adc (prio 10), i2s (prio 9)
 *   núcleo 0: servo (prio 8, 5 ms), tx (prio 5), cmd (prio 4), principal (estado, 2 Hz)
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
#include "cal.h"
#include "board_pins.h"

#ifndef CVAI_BAUD
#define CVAI_BAUD 921600     /* uso estimado ≈ 31 % del enlace (ver documentación) */
#endif
int g_baud = CVAI_BAUD;

void app_main(void)
{
    proto_init(g_baud);
    cal_init();                     /* calibraciones guardadas en NVS (una por sensor) */
    servo_init();                   /* PWM apagado al arrancar */
    acq_adc_start();
    acq_i2s_start();
    cmd_start();
    vTaskDelay(pdMS_TO_TICKS(400));
    send_info();
    proto_text("CardioValveAI v3 listo. 'STREAM ON' y latidos 'HB'. Servo sin pulsos hasta START/MOVE. Calibración válida: H1=%d H2=%d H3=%d",
               (cal_valid_mask() >> 0) & 1, (cal_valid_mask() >> 1) & 1, (cal_valid_mask() >> 2) & 1);

    struct __attribute__((packed)) status {
        int64_t t; uint32_t adc_frames, adc_ovf, adc_pat_err, adc_gaps, i2s_frames, i2s_ovf, tx_dropped, tx_bytes;
        uint32_t sat[N_HALL]; uint32_t audio_sat; uint32_t free_heap; uint16_t hall_last[N_HALL];
        int16_t cmd_x100; uint8_t phase; uint8_t estop; uint32_t cycle; uint8_t cal_valid;
    } st;
    _Static_assert(sizeof st == 75, "STATUS: el host (cvai_proto.STATUS) espera 75 bytes");
    TickType_t wake = xTaskGetTickCount();
    bool led = false;
    for (;;) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(500));
        memset(&st, 0, sizeof st);
        st.t = esp_timer_get_time();
        st.adc_frames = g_acq.adc_frames; st.adc_ovf = g_acq.adc_pool_ovf; st.adc_pat_err = g_acq.adc_pattern_err; st.adc_gaps = g_acq.adc_gaps;
        st.i2s_frames = g_acq.i2s_frames; st.i2s_ovf = g_acq.i2s_ovf; st.tx_dropped = proto_dropped(); st.tx_bytes = proto_bytes_sent();
        for (int k = 0; k < N_HALL; k++) { st.sat[k] = g_acq.sat[k]; st.hall_last[k] = g_acq.hall_last[k]; }
        st.audio_sat = g_acq.audio_sat;
        st.free_heap = heap_caps_get_free_size(MALLOC_CAP_8BIT);
        st.cmd_x100 = (int16_t)(servo_cmd_now() * 100);
        st.phase = (uint8_t)servo_phase();
        st.estop = servo_estop_active();
        st.cycle = servo_cycle();
        st.cal_valid = cal_valid_mask();
        proto_send(FR_STATUS, &st, sizeof st);
        led = !led;
        gpio_set_level(PIN_STATUS, led);
    }
}
