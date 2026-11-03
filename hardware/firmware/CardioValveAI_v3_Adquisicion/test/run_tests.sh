#!/bin/sh
# Prueba de la lógica del modo dashboard en el computador (gcc o clang). Con detectores de errores de memoria.
cd "$(dirname "$0")" || exit 1
CC="${CC:-gcc}"
$CC -std=c11 -Wall -Wextra -Werror -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=undefined \
    -I../main test_dash_logic.c ../main/dash_logic.c -lm -o /tmp/test_dash_logic && /tmp/test_dash_logic
