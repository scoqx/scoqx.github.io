#!/bin/bash
# Скрипт для компиляции Q3VM в WebAssembly
# Требуется установленный Emscripten SDK

# Проверка Emscripten
if ! command -v emcc &> /dev/null; then
    echo "❌ Emscripten не найден!"
    echo "Установите: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

echo "🔨 Компиляция Q3VM в WebAssembly..."

# Пути
Q3VM_SRC="../../../q3vm/src"
OUTPUT_DIR="."
OUTPUT_NAME="q3vm-wasm"

# Флаги компиляции
CFLAGS="-O3 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='[\"_VM_Create\",\"_VM_Free\",\"_VM_Call\",\"_VM_VmProfile_f\",\"_malloc\",\"_free\"]' \
    -s EXPORTED_RUNTIME_METHODS='[\"ccall\",\"cwrap\",\"getValue\",\"setValue\",\"UTF8ToString\",\"stringToUTF8\",\"lengthBytesUTF8\",\"addFunction\",\"removeFunction\"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ALLOW_TABLE_GROWTH=1 \
    -s INITIAL_MEMORY=67108864 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='Q3VM_WASM' \
    -s ENVIRONMENT='web' \
    -s NO_EXIT_RUNTIME=1 \
    -s ASSERTIONS=1 \
    --no-entry"

# Компилируем
echo "📁 Исходники: $Q3VM_SRC"
echo "📦 Вывод: $OUTPUT_DIR/$OUTPUT_NAME.js"

emcc \
    "$Q3VM_SRC/vm/vm.c" \
    $CFLAGS \
    -o "$OUTPUT_DIR/$OUTPUT_NAME.js"

if [ $? -eq 0 ]; then
    echo "✅ Компиляция завершена успешно!"
    echo "📄 Созданы файлы:"
    echo "   - $OUTPUT_NAME.js"
    echo "   - $OUTPUT_NAME.wasm"
    ls -lh "$OUTPUT_DIR/$OUTPUT_NAME".*
else
    echo "❌ Ошибка компиляции!"
    exit 1
fi


