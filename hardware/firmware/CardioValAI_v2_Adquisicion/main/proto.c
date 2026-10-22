#include "proto.h"
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/ringbuf.h"
#include "driver/uart.h"
#include "esp_timer.h"

#define TX_RING_BYTES (48 * 1024)   /* ≈ 0,5 s de datos a 92 kB/s: absorbe pausas cortas de la computadora */
#define MAX_PAYLOAD   2048

static RingbufHandle_t s_ring;
static uint16_t s_seq[FR_NTYPES];
static portMUX_TYPE s_mux = portMUX_INITIALIZER_UNLOCKED;
static volatile uint32_t s_dropped, s_bytes;

uint16_t proto_crc16(const uint8_t *d, size_t n, uint16_t crc)
{
    for (size_t i = 0; i < n; i++) {
        crc ^= (uint16_t)d[i] << 8;
        for (int b = 0; b < 8; b++) {
            crc = (crc & 0x8000) ? (uint16_t)((crc << 1) ^ 0x1021) : (uint16_t)(crc << 1);
        }
    }
    return crc;
}

static void tx_task(void *arg)
{
    for (;;) {
        size_t n = 0;
        uint8_t *item = xRingbufferReceive(s_ring, &n, portMAX_DELAY);
        if (item) {
            uart_write_bytes(UART_NUM_0, item, n);   /* bloquea solo esta tarea mientras la UART transmite */
            s_bytes += n;
            vRingbufferReturnItem(s_ring, item);
        }
    }
}

void proto_init(int baud)
{
    uart_config_t cfg = {
        .baud_rate = baud, .data_bits = UART_DATA_8_BITS, .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1, .flow_ctrl = UART_HW_FLOWCTRL_DISABLE, .source_clk = UART_SCLK_DEFAULT,
    };
    ESP_ERROR_CHECK(uart_driver_install(UART_NUM_0, 1024, 8192, 0, NULL, 0));
    ESP_ERROR_CHECK(uart_param_config(UART_NUM_0, &cfg));
    s_ring = xRingbufferCreate(TX_RING_BYTES, RINGBUF_TYPE_NOSPLIT);
    configASSERT(s_ring);
    xTaskCreatePinnedToCore(tx_task, "tx", 3072, NULL, 5, NULL, 0);
}

bool proto_send(uint8_t type, const void *payload, uint16_t len)
{
    if (len > MAX_PAYLOAD || type >= FR_NTYPES) {
        return false;
    }
    uint8_t *f = NULL;
    /* reserva sin copia intermedia; segura entre tareas. Sin espera: si no hay lugar, se descarta y se cuenta */
    if (xRingbufferSendAcquire(s_ring, (void **)&f, len + 9u, 0) != pdTRUE || !f) {
        taskENTER_CRITICAL(&s_mux);
        s_dropped++;
        s_seq[type]++;            /* el salto de secuencia permite a la computadora ver la pérdida */
        taskEXIT_CRITICAL(&s_mux);
        return false;
    }
    taskENTER_CRITICAL(&s_mux);
    uint16_t seq = s_seq[type]++;
    taskEXIT_CRITICAL(&s_mux);
    f[0] = 0xA5; f[1] = 0x5A; f[2] = type;
    f[3] = len & 0xFF; f[4] = len >> 8; f[5] = seq & 0xFF; f[6] = seq >> 8;
    memcpy(f + 7, payload, len);
    uint16_t crc = proto_crc16(f + 2, 5u + len, 0xFFFF);
    f[7 + len] = crc & 0xFF; f[8 + len] = crc >> 8;
    xRingbufferSendComplete(s_ring, f);
    return true;
}

void proto_event(uint8_t code, int32_t arg)
{
    struct __attribute__((packed)) { int64_t t; uint8_t code; int32_t arg; } e = { esp_timer_get_time(), code, arg };
    proto_send(FR_EVENT, &e, sizeof e);
}

void proto_text(const char *fmt, ...)
{
    char s[200];
    va_list ap;
    va_start(ap, fmt);
    int n = vsnprintf(s, sizeof s, fmt, ap);
    va_end(ap);
    if (n > 0) {
        proto_send(FR_TEXT, s, (uint16_t)(n < (int)sizeof s ? n : (int)sizeof s - 1));
    }
}

uint32_t proto_dropped(void) { return s_dropped; }
uint32_t proto_bytes_sent(void) { return s_bytes; }
