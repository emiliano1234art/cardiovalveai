#pragma once
#include <stdint.h>
#include <stdbool.h>

/* ADC1 en modo continuo, patrón H1,H2,H3 a 24 kS/s en total (mínimo del ESP32: 20 kS/s).
 * Conversión SECUENCIAL: H2 se toma 41,7 µs después de H1 y H3 83,3 µs después (desfase fijo, informado en INFO).
 * Cada canal: 8 kS/s → suma de 8 → 1 kS/s (el movimiento de las valvas dura cientos de ms). */
#define ADC_TOTAL_RATE   24000
#define ADC_PATTERN_LEN  3
#define ADC_SET_RATE     (ADC_TOTAL_RATE / ADC_PATTERN_LEN)   /* 8000 juegos/s */
#define HALL_DECIM       8
#define HALL_OUT_RATE    (ADC_SET_RATE / HALL_DECIM)          /* 1 kS/s */
#define AUDIO_IN_RATE    16000
#define N_HALL           3

typedef struct {
    volatile uint32_t adc_frames, adc_pool_ovf, adc_pattern_err, adc_gaps;
    volatile uint32_t sat[N_HALL];        /* muestras crudas ≤ 8 o ≥ 4087 */
    volatile uint32_t i2s_frames, i2s_ovf, audio_sat;
    volatile uint16_t hall_last[N_HALL];  /* último valor (suma de 8) */
    volatile int64_t  hall_last_t;
    volatile uint8_t  audio_slot;
    volatile bool     audio_full;
    volatile uint8_t  audio_shift;
    volatile bool     streaming;
} acq_state_t;

extern acq_state_t g_acq;

void acq_adc_start(void);
void acq_i2s_start(void);
int  acq_adc_cali_table(int *mv17);
const char *acq_adc_cali_scheme(void);
