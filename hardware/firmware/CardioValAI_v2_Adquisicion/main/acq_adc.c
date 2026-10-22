/*
 * Adquisición ADC1 continua (DMA). En el ESP32 clásico el modo continuo usa el periférico I2S0.
 * Patrón de 8 conversiones a 64 kS/s:  P1 H1 P2 H2 P1 H3 P2 H0
 *   - P1, P2: 16 kS/s → FIR pasa-bajos (Kaiser, 31 coeficientes, −3 dB ≈ 2,7 kHz, −38 dB a 4 kHz) → 8 kS/s.
 *     Antes del ADC hay un filtro analógico Butterworth de 2.º orden a 1,5 kHz (antialias, ver esquema).
 *   - H0..H3: 8 kS/s → suma de 8 → 1 kS/s (el movimiento mecánico es < 20 Hz).
 * Marca de tiempo: esp_timer (µs) capturado en la interrupción de fin de trama DMA; cada muestra se
 * reconstruye con la frecuencia nominal. La computadora estima la frecuencia real (deriva del reloj del ADC).
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

#define CONV_SETS        32                                   /* juegos por trama DMA (4 ms) */
#define CONV_FRAME_BYTES (CONV_SETS * ADC_PATTERN_LEN * SOC_ADC_DIGI_RESULT_BYTES)
#define FAST_BLOCK       128                                  /* muestras por trama FAST (16 ms) */
#define HALL_BLOCK       32                                   /* muestras por trama HALL (32 ms) */
#define SAT_LO           8
#define SAT_HI           4087

/* posición en el patrón → flujo: 0 = P1, 1 = P2, 2..5 = H1, H2, H3, H0 */
static const adc_channel_t k_pat_ch[ADC_PATTERN_LEN] = { CH_P1, CH_H1, CH_P2, CH_H2, CH_P1, CH_H3, CH_P2, CH_H0 };
static const int8_t k_pat_stream[ADC_PATTERN_LEN]    = { 0, 3, 1, 4, 0, 5, 1, 2 };   /* 2=H0 3=H1 4=H2 5=H3 */

/* FIR de diezmado de P1/P2 (Q15, suma 32765), generado con scipy.signal.firwin(31, 3000, fs=16000, window=('kaiser', 8)) */
static const int16_t k_fir_p[31] = { -2, -5, 8, 46, 34, -112, -243, 0, 582, 659, -521, -1989, -1144, 3449, 9477, 12287,
                                     9477, 3449, -1144, -1989, -521, 659, 582, 0, -243, -112, 34, 46, 8, -5, -2 };
#define FIR_P_DELAY_US  ((15 * 1000000) / FAST_IN_RATE)       /* retardo de grupo (937 µs): se descuenta del sello */

static adc_continuous_handle_t s_adc;
static QueueHandle_t s_tq;           /* marcas de tiempo por trama (ISR → tarea) */
static TaskHandle_t s_task;
static adc_cali_handle_t s_cali;
static const char *s_cali_scheme = "none";

typedef struct { int64_t t; } frame_t;

static bool IRAM_ATTR on_conv_done(adc_continuous_handle_t h, const adc_continuous_evt_data_t *e, void *u)
{
    BaseType_t woke = pdFALSE;
    frame_t f = { esp_timer_get_time() };
    xQueueSendFromISR(s_tq, &f, &woke);
    return woke == pdTRUE;
}

static bool IRAM_ATTR on_pool_ovf(adc_continuous_handle_t h, const adc_continuous_evt_data_t *e, void *u)
{
    g_acq.adc_pool_ovf++;
    return false;
}

typedef struct {
    int16_t hist[2][32];   /* historia del FIR por canal (búfer circular) */
    uint8_t pos;           /* posición de escritura (común a ambos canales: llegan en pares P1,P2) */
    uint8_t phase;         /* diezmado ×2 */
} fir_state_t;

static int16_t fir_out(const int16_t *h, uint8_t pos)
{
    int32_t acc = 0;
    for (int k = 0; k < 31; k++) {
        acc += (int32_t)k_fir_p[k] * h[(uint8_t)(pos - k) & 31];
    }
    return (int16_t)((acc + 16384) >> 15);
}

static void adc_task(void *arg)
{
    static uint8_t raw[CONV_FRAME_BYTES];
    static int16_t fast[FAST_BLOCK * 2];
    static uint16_t hall[HALL_BLOCK * 4];
    struct __attribute__((packed)) fast_hdr { int64_t t_last; uint32_t idx0; uint16_t n; uint8_t nch; uint8_t flags; };
    struct __attribute__((packed)) hall_hdr { int64_t t_last; uint32_t idx0; uint16_t n; uint8_t nch; uint8_t flags; };
    static uint8_t out[sizeof(struct fast_hdr) + sizeof fast];

    fir_state_t fir = { 0 };
    int pat = 0;
    uint32_t hsum[4] = { 0 }, hcnt = 0;
    int nfast = 0, nhall = 0;
    uint32_t fast_idx = 0, hall_idx = 0;
    uint8_t fast_flags = 0, hall_flags = 0;
    int16_t pending[2] = { 0 };       /* P1 recibido, a la espera de su P2 */
    bool havep1 = false;
    uint32_t last_ovf = 0;

    for (;;) {
        frame_t fr;
        if (xQueueReceive(s_tq, &fr, pdMS_TO_TICKS(200)) != pdTRUE) {
            g_acq.adc_gaps++;                          /* 200 ms sin tramas: falla de adquisición → parada controlada */
            if (servo_phase() != SV_DETACHED && servo_phase() != SV_IDLE) { servo_stop(EV_STOP_ACQ_FAULT); }
            proto_event(EV_STOP_ACQ_FAULT, 1);
            continue;
        }
        uint32_t n = 0;
        if (adc_continuous_read(s_adc, raw, CONV_FRAME_BYTES, &n, 0) != ESP_OK || n == 0) {
            continue;
        }
        if (g_acq.adc_pool_ovf != last_ovf) {          /* desborde: se perdieron tramas → marcar discontinuidad */
            last_ovf = g_acq.adc_pool_ovf;
            xQueueReset(s_tq);
            fast_flags |= 0x80; hall_flags |= 0x80;
            proto_event(EV_ADC_POOL_OVF, (int32_t)last_ovf);
        }
        g_acq.adc_frames++;
        const int nsamp = n / SOC_ADC_DIGI_RESULT_BYTES;
        const int64_t t_end = fr.t;
        for (int i = 0; i < nsamp; i++) {
            const adc_digi_output_data_t *p = (const adc_digi_output_data_t *)&raw[i * SOC_ADC_DIGI_RESULT_BYTES];
            const int ch = p->type1.channel;
            const int v = p->type1.data;
            if (ch != k_pat_ch[pat]) {                  /* resincronizar con un canal Hall (únicos en el patrón) */
                g_acq.adc_pattern_err++;
                int found = -1;
                for (int k = 0; k < ADC_PATTERN_LEN; k++) {
                    if (k_pat_ch[k] == ch && k_pat_stream[k] >= 2) { found = k; break; }
                }
                if (found < 0) { continue; }
                pat = found;
                havep1 = false;
            }
            const int s = k_pat_stream[pat];
            /* tiempo de esta muestra: el final de la trama corresponde a la última muestra */
            const int64_t t_s = t_end - (int64_t)(nsamp - 1 - i) * 1000000 / ADC_TOTAL_RATE;
            if (s <= 1) {
                if (v <= SAT_LO || v >= SAT_HI) { g_acq.sat[s]++; fast_flags |= (uint8_t)(1u << s); }
                if (s == 0) { pending[0] = (int16_t)v; havep1 = true; }
                else if (havep1) {
                    fir.pos = (fir.pos + 1) & 31;
                    fir.hist[0][fir.pos] = pending[0];
                    fir.hist[1][fir.pos] = (int16_t)v;
                    havep1 = false;
                    if (++fir.phase == 2) {
                        fir.phase = 0;
                        fast[nfast * 2 + 0] = fir_out(fir.hist[0], fir.pos);
                        fast[nfast * 2 + 1] = fir_out(fir.hist[1], fir.pos);
                        if (++nfast == FAST_BLOCK) {
                            struct fast_hdr hd = { t_s - FIR_P_DELAY_US, fast_idx, FAST_BLOCK, 2, fast_flags };
                            memcpy(out, &hd, sizeof hd);
                            memcpy(out + sizeof hd, fast, sizeof fast);
                            if (g_acq.streaming) { proto_send(FR_FAST, out, sizeof hd + sizeof fast); }
                            fast_idx += FAST_BLOCK; nfast = 0; fast_flags = 0;
                        }
                    }
                }
            } else {
                const int h = s - 2;                    /* 0 = H0, 1 = H1, 2 = H2, 3 = H3 */
                if (v <= SAT_LO || v >= SAT_HI) { g_acq.sat[2 + h]++; hall_flags |= (uint8_t)(1u << h); }
                hsum[h] += (uint32_t)v;
                if (h == 0 && ++hcnt == HALL_DECIM) {   /* H0 cierra el juego de 8 (último del patrón) */
                    for (int k = 0; k < 4; k++) {
                        hall[nhall * 4 + k] = (uint16_t)hsum[k];
                        g_acq.hall_last[k] = (uint16_t)hsum[k];
                        hsum[k] = 0;
                    }
                    g_acq.hall_last_t = t_s;
                    hcnt = 0;
                    if (++nhall == HALL_BLOCK) {
                        struct hall_hdr hd = { t_s, hall_idx, HALL_BLOCK, 4, hall_flags };
                        memcpy(out, &hd, sizeof hd);
                        memcpy(out + sizeof hd, hall, sizeof hall);
                        if (g_acq.streaming) { proto_send(FR_HALL, out, sizeof hd + sizeof hall); }
                        hall_idx += HALL_BLOCK; nhall = 0; hall_flags = 0;
                    }
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
    s_tq = xQueueCreate(64, sizeof(frame_t));
    adc_continuous_handle_cfg_t hc = { .max_store_buf_size = CONV_FRAME_BYTES * 32, .conv_frame_size = CONV_FRAME_BYTES };
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
    xTaskCreatePinnedToCore(adc_task, "adc", 4096, NULL, 10, &s_task, 1);
    ESP_ERROR_CHECK(adc_continuous_start(s_adc));
}
