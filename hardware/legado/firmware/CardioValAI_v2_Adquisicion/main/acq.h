#pragma once
#include <stdint.h>
#include <stdbool.h>

/* Frecuencias (Hz). El ADC1 convierte en secuencia; NO es muestreo simultáneo:
 * orden del patrón P1,H1,P2,H2,P1,H3,P2,H0 a 64 kS/s en total → 15,625 µs entre conversiones consecutivas. */
#define ADC_TOTAL_RATE   64000
#define ADC_PATTERN_LEN  8
#define ADC_SET_RATE     (ADC_TOTAL_RATE / ADC_PATTERN_LEN)   /* 8000 juegos/s */
#define FAST_IN_RATE     (2 * ADC_SET_RATE)                   /* P1, P2: 16 kS/s cada uno antes del FIR */
#define FAST_OUT_RATE    8000                                 /* tras FIR + diezmado ×2 */
#define HALL_IN_RATE     ADC_SET_RATE                         /* H0..H3: 8 kS/s cada uno */
#define HALL_DECIM       8
#define HALL_OUT_RATE    (HALL_IN_RATE / HALL_DECIM)          /* 1 kS/s (suma de 8) */
#define AUDIO_IN_RATE    16000

typedef struct {
    volatile uint32_t adc_frames, adc_pool_ovf, adc_pattern_err, adc_gaps;
    volatile uint32_t sat[6];            /* P1, P2, H0, H1, H2, H3: muestras crudas ≤ 8 o ≥ 4087 */
    volatile uint32_t i2s_frames, i2s_ovf, audio_sat;
    volatile uint16_t hall_last[4];      /* H0..H3 último valor (suma de 8) */
    volatile int64_t  hall_last_t;
    volatile uint8_t  audio_slot;        /* 0 = izquierdo, 1 = derecho (detectado al inicio) */
    volatile bool     audio_full;        /* true: 16 kHz sin diezmar */
    volatile uint8_t  audio_shift;
    volatile bool     streaming;
} acq_state_t;

extern acq_state_t g_acq;

void acq_adc_start(void);
void acq_i2s_start(void);
/* Tabla raw → mV (17 puntos: 0, 256, …, 4095) de la calibración de fábrica (eFuse) del ADC1 a 12 dB */
int  acq_adc_cali_table(int *mv17);
const char *acq_adc_cali_scheme(void);
