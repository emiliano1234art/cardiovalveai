idf_component_register(SRCS "main.c" "proto.c" "acq_adc.c" "acq_i2s.c" "servo.c" "cmd.c" "ina219.c"
                       INCLUDE_DIRS "."
                       REQUIRES esp_ringbuf esp_adc esp_driver_i2s esp_driver_ledc esp_driver_uart esp_driver_gpio esp_driver_i2c esp_timer)
