/*
 * Micrófono INMP441 por I2S1 (maestro, Philips, 32 bits por ranura, 16 kHz → BCLK = 1,024 MHz = 64·fs).
 * El INMP441 entrega 24 bits en complemento a 2 justificados a la izquierda de la ranura de 32 bits.
 * L/R a GND → ranura izquierda; por robustez se leen ambas ranuras y se elige la que tiene señal al inicio.
 * Diezmado opcional a 8 kHz con FIR (47 coef., −3 dB ≈ 3,2 kHz, −33 dB a 4 kHz).
 */
#include <string.h>
#include <stdlib.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "driver/i2s_std.h"
#include "esp_timer.h"
#include "acq.h"
#include "proto.h"
#include "board_pins.h"

#define DMA_FRAMES   256                 /* tramas estéreo por búfer DMA (16 ms a 16 kHz) */
#define AUDIO_BLOCK  256                 /* muestras por trama AUDIO */
#define SAT_24       0x7FFF00

/* scipy.signal.firwin(47, 3400, fs=16000, window=('kaiser', 8)) en Q15 */
static const int16_t k_fir_a[47] = { -1, -3, 2, 13, 5, -32, -36, 48, 107, -25, -218, -90, 326, 351, -334, -778, 82, 1326, 668, -1882,
                                     -2480, 2301, 10071, 13926, 10071, 2301, -2480, -1882, 668, 1326, 82, -778, -334, 351, 326, -90,
                                     -218, -25, 107, 48, -36, -32, 5, 13, 2, -3, -1 };
#define FIR_A_DELAY_US ((23 * 1000000) / AUDIO_IN_RATE)

static i2s_chan_handle_t s_rx;
static QueueHandle_t s_tq;

static bool IRAM_ATTR on_recv(i2s_chan_handle_t h, i2s_event_data_t *e, void *u)
{
    BaseType_t woke = pdFALSE;
    int64_t t = esp_timer_get_time();
    xQueueSendFromISR(s_tq, &t, &woke);
    return woke == pdTRUE;
}

static bool IRAM_ATTR on_recv_ovf(i2s_chan_handle_t h, i2s_event_data_t *e, void *u)
{
    g_acq.i2s_ovf++;
    return false;
}

static void i2s_task(void *arg)
{
    static int32_t buf[DMA_FRAMES * 2];
    static int32_t hist[64];
    static int16_t outs[AUDIO_BLOCK];
    struct __attribute__((packed)) hdr { int64_t t_last; uint32_t idx0; uint16_t n; uint8_t fmt; uint8_t flags; };
    static uint8_t out[sizeof(struct hdr) + sizeof outs];
    uint8_t hp = 0, phase = 0, flags = 0;
    int nout = 0;
    uint32_t idx = 0, last_ovf = 0;
    int64_t sumL = 0, sumR = 0;
    int warm = 0;

    for (;;) {
        int64_t t_end;
        if (xQueueReceive(s_tq, &t_end, pdMS_TO_TICKS(200)) != pdTRUE) {
            proto_event(EV_STOP_ACQ_FAULT, 2);
            continue;
        }
        size_t n = 0;
        if (i2s_channel_read(s_rx, buf, sizeof buf, &n, pdMS_TO_TICKS(50)) != ESP_OK || n == 0) {
            continue;
        }
        if (g_acq.i2s_ovf != last_ovf) {
            last_ovf = g_acq.i2s_ovf;
            xQueueReset(s_tq);
            flags |= 0x80;
            proto_event(EV_I2S_OVF, (int32_t)last_ovf);
        }
        g_acq.i2s_frames++;
        const int nf = n / 8;
        if (warm < 16) {                        /* primeros ~250 ms: elegir la ranura con señal */
            for (int i = 0; i < nf; i++) {
                sumL += llabs((long long)(buf[2 * i] >> 8));
                sumR += llabs((long long)(buf[2 * i + 1] >> 8));
            }
            if (++warm == 16) {
                g_acq.audio_slot = sumR > sumL ? 1 : 0;
                proto_text("INMP441: ranura %s (|L|=%lld |R|=%lld)", g_acq.audio_slot ? "derecha" : "izquierda", sumL, sumR);
            }
            continue;
        }
        const int sl = g_acq.audio_slot;
        const bool full = g_acq.audio_full;
        const int sh = g_acq.audio_shift;
        for (int i = 0; i < nf; i++) {
            int32_t s24 = buf[2 * i + sl] >> 8;
            if (s24 >= SAT_24 || s24 <= -SAT_24) { g_acq.audio_sat++; flags |= 1; }
            int32_t y;
            const int64_t t_s = t_end - (int64_t)(nf - 1 - i) * 1000000 / AUDIO_IN_RATE;
            if (full) {
                y = s24 >> sh;
            } else {
                hp = (hp + 1) & 63;
                hist[hp] = s24;
                if (++phase < 2) { continue; }
                phase = 0;
                int64_t acc = 0;
                for (int k = 0; k < 47; k++) { acc += (int64_t)k_fir_a[k] * hist[(uint8_t)(hp - k) & 63]; }
                y = (int32_t)(acc >> 15) >> sh;
            }
            if (y > 32767) { y = 32767; flags |= 2; } else if (y < -32768) { y = -32768; flags |= 2; }
            outs[nout++] = (int16_t)y;
            if (nout == AUDIO_BLOCK) {
                struct hdr hd = { full ? t_s : t_s - FIR_A_DELAY_US, idx, AUDIO_BLOCK, full ? 0 : 1, flags };
                memcpy(out, &hd, sizeof hd);
                memcpy(out + sizeof hd, outs, sizeof outs);
                if (g_acq.streaming) { proto_send(FR_AUDIO, out, sizeof out); }
                idx += AUDIO_BLOCK; nout = 0; flags = 0;
            }
        }
    }
}

void acq_i2s_start(void)
{
    s_tq = xQueueCreate(32, sizeof(int64_t));
    i2s_chan_config_t cc = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_1, I2S_ROLE_MASTER);
    cc.dma_desc_num = 8;
    cc.dma_frame_num = DMA_FRAMES;
    ESP_ERROR_CHECK(i2s_new_channel(&cc, NULL, &s_rx));
    i2s_std_config_t sc = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(AUDIO_IN_RATE),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO),
        .gpio_cfg = { .mclk = I2S_GPIO_UNUSED, .bclk = PIN_I2S_SCK, .ws = PIN_I2S_WS, .dout = I2S_GPIO_UNUSED, .din = PIN_I2S_SD,
                      .invert_flags = { .mclk_inv = false, .bclk_inv = false, .ws_inv = false } },
    };
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(s_rx, &sc));
    i2s_event_callbacks_t cbs = { .on_recv = on_recv, .on_recv_q_ovf = on_recv_ovf };
    ESP_ERROR_CHECK(i2s_channel_register_event_callback(s_rx, &cbs, NULL));
    ESP_ERROR_CHECK(i2s_channel_enable(s_rx));
    xTaskCreatePinnedToCore(i2s_task, "i2s", 4096, NULL, 9, NULL, 1);
}
