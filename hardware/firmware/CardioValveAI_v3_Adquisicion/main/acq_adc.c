/*
 * Adquisición ADC1 continua (DMA) de los 3 sensores Hall. En el ESP32 clásico el modo continuo usa el periférico I2S0.
 * Patrón H1 H2 H3 a 24 kS/s → 8 kS/s por canal → suma de 8 → 1 kS/s por canal (16 bits, máx. 8·4095 = 32760).
 * Antialias analógico: RC 1 kΩ / 100 nF por canal (fc ≈ 1,6 kHz) antes del ADC; la suma de 8 es un promedio móvil (primer cero a 1 kHz).
 * Marca de tiempo: esp_timer (µs) capturado en la interrupción de fin de trama DMA; cada muestra se reconstruye con la
 * frecuencia nominal. La computadora estima la frecuencia real (deriva del reloj del ADC respecto de esp_timer).
 */
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_adc/adc_continuous.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "esp_timer.h"
#include "acq.h"
#include "proto.h"
#include "board_pins.h"
#include "servo.h"

acq_state_t g_acq = { .audio_shift = 8 };

#define CONV_SETS        96                                   /* juegos por trama DMA (12 ms) */
#define CONV_FRAME_BYTES (CONV_SETS * ADC_PATTERN_LEN * SOC_ADC_DIGI_RESULT_BYTES)
#define HALL_BLOCK       32                                   /* muestras por trama HALL (32 ms) */
#define SAT_LO           8
#define SAT_HI           4087

static const adc_channel_t k_pat_ch[ADC_PATTERN_LEN] = { CH_H1, CH_H2, CH_H3 };

static adc_continuous_handle_t s_adc;
static QueueHandle_t s_tq;
static adc_cali_handle_t s_cali;
static const char *s_cali_scheme = "none";

static bool IRAM_ATTR on_conv_done(adc_continuous_handle_t h, const adc_continuous_evt_data_t *e, void *u)
{
    BaseType_t woke = pdFALSE;
    int64_t t = esp_timer_get_time();
    xQueueSendFromISR(s_tq, &t, &woke);
    return woke == pdTRUE;
}

static bool IRAM_ATTR on_pool_ovf(adc_continuous_handle_t h, const adc_continuous_evt_data_t *e, void *u)
{
    g_acq.adc_pool_ovf++;
    return false;
}

static void adc_task(void *arg)
{
    static uint8_t raw[CONV_FRAME_BYTES];
    static uint16_t hall[HALL_BLOCK * N_HALL];
    struct __attribute__((packed)) hdr { int64_t t_last; uint32_t idx0; uint16_t n; uint8_t nch; uint8_t flags; };
    _Static_assert(sizeof(struct hdr) == 16, "cabecera de bloque = 16 bytes (cvai_proto.BLOCK_HDR)");
    static uint8_t out[sizeof(struct hdr) + sizeof hall];
    int pat = 0, nhall = 0;
    uint32_t hsum[N_HALL] = { 0 }, hcnt = 0, hall_idx = 0, last_ovf = 0;
    uint8_t flags = 0;

    for (;;) {
        int64_t t_end;
        if (xQueueReceive(s_tq, &t_end, pdMS_TO_TICKS(200)) != pdTRUE) {
            g_acq.adc_gaps++;                          /* 200 ms sin tramas: falla de adquisición → parada controlada */
            if (servo_phase() != SV_DETACHED && servo_phase() != SV_IDLE) { servo_stop(EV_STOP_ACQ_FAULT); }
            proto_event(EV_STOP_ACQ_FAULT, 1);
            continue;
        }
        uint32_t n = 0;
        if (adc_continuous_read(s_adc, raw, CONV_FRAME_BYTES, &n, 0) != ESP_OK || n == 0) {
            continue;
        }
        if (g_acq.adc_pool_ovf != last_ovf) {          /* desborde: se perdieron tramas → discontinuidad marcada */
            last_ovf = g_acq.adc_pool_ovf;
            xQueueReset(s_tq);
            flags |= 0x80;
            proto_event(EV_ADC_POOL_OVF, (int32_t)last_ovf);
        }
        g_acq.adc_frames++;
        const int nsamp = n / SOC_ADC_DIGI_RESULT_BYTES;
        for (int i = 0; i < nsamp; i++) {
            const adc_digi_output_data_t *p = (const adc_digi_output_data_t *)&raw[i * SOC_ADC_DIGI_RESULT_BYTES];
            const int ch = p->type1.channel;
            const int v = p->type1.data;
            if (ch != k_pat_ch[pat]) {                  /* resincronizar con el canal recibido */
                g_acq.adc_pattern_err++;
                int found = -1;
                for (int k = 0; k < ADC_PATTERN_LEN; k++) { if (k_pat_ch[k] == ch) { found = k; break; } }
                if (found < 0) { continue; }
                pat = found;
            }
            if (v <= SAT_LO || v >= SAT_HI) { g_acq.sat[pat]++; flags |= (uint8_t)(1u << pat); }
            hsum[pat] += (uint32_t)v;
            if (pat == ADC_PATTERN_LEN - 1 && ++hcnt == HALL_DECIM) {
                const int64_t t_s = t_end - (int64_t)(nsamp - 1 - i) * 1000000 / ADC_TOTAL_RATE;
                for (int k = 0; k < N_HALL; k++) {
                    hall[nhall * N_HALL + k] = (uint16_t)hsum[k];
                    g_acq.hall_last[k] = (uint16_t)hsum[k];
                    hsum[k] = 0;
                }
                g_acq.hall_last_t = t_s;
                hcnt = 0;
                if (++nhall == HALL_BLOCK) {
                    struct hdr hd = { t_s, hall_idx, HALL_BLOCK, N_HALL, flags };
                    memcpy(out, &hd, sizeof hd);
                    memcpy(out + sizeof hd, hall, sizeof hall);
                    if (g_acq.streaming) { proto_send(FR_HALL, out, sizeof out); }
                    hall_idx += HALL_BLOCK; nhall = 0; flags = 0;
                }
            }
            pat = (pat + 1) % ADC_PATTERN_LEN;
        }
    }
}

static void cali_init(void)
{
#if ADC_CALI_SCHEME_LINE_FITTING_SUPPORTED
    adc_cali_line_fitting_config_t c = { .unit_id = ADC_UNIT_1, .atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_12 };
    if (adc_cali_create_scheme_line_fitting(&c, &s_cali) == ESP_OK) {
        adc_cali_line_fitting_efuse_val_t ev;
        s_cali_scheme = "line_fitting";
        if (adc_cali_scheme_line_fitting_check_efuse(&ev) == ESP_OK) {
            s_cali_scheme = ev == ADC_CALI_LINE_FITTING_EFUSE_VAL_EFUSE_TP ? "line_fitting_two_point"
                          : ev == ADC_CALI_LINE_FITTING_EFUSE_VAL_EFUSE_VREF ? "line_fitting_vref" : "line_fitting_default_vref";
        }
    }
#endif
}

int acq_adc_cali_table(int *mv17)
{
    if (!s_cali) { return 0; }
    for (int k = 0; k <= 16; k++) {
        int raw = k == 16 ? 4095 : k * 256;
        if (adc_cali_raw_to_voltage(s_cali, raw, &mv17[k]) != ESP_OK) { return 0; }
    }
    return 17;
}

const char *acq_adc_cali_scheme(void) { return s_cali_scheme; }

void acq_adc_start(void)
{
    cali_init();
    s_tq = xQueueCreate(64, sizeof(int64_t));
    adc_continuous_handle_cfg_t hc = { .max_store_buf_size = CONV_FRAME_BYTES * 16, .conv_frame_size = CONV_FRAME_BYTES };
    ESP_ERROR_CHECK(adc_continuous_new_handle(&hc, &s_adc));
    adc_digi_pattern_config_t pat[ADC_PATTERN_LEN];
    for (int i = 0; i < ADC_PATTERN_LEN; i++) {
        pat[i] = (adc_digi_pattern_config_t){ .atten = ADC_ATTEN_DB_12, .channel = k_pat_ch[i], .unit = ADC_UNIT_1, .bit_width = ADC_BITWIDTH_12 };
    }
    adc_continuous_config_t cc = {
        .pattern_num = ADC_PATTERN_LEN, .adc_pattern = pat, .sample_freq_hz = ADC_TOTAL_RATE,
        .conv_mode = ADC_CONV_SINGLE_UNIT_1, .format = ADC_DIGI_OUTPUT_FORMAT_TYPE1,
    };
    ESP_ERROR_CHECK(adc_continuous_config(s_adc, &cc));
    adc_continuous_evt_cbs_t cbs = { .on_conv_done = on_conv_done, .on_pool_ovf = on_pool_ovf };
    ESP_ERROR_CHECK(adc_continuous_register_event_callbacks(s_adc, &cbs, NULL));
    xTaskCreatePinnedToCore(adc_task, "adc", 4096, NULL, 10, NULL, 1);
    ESP_ERROR_CHECK(adc_continuous_start(s_adc));
}
