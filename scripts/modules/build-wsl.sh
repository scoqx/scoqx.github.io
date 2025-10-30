#!/bin/bash
#
# Компиляция Q3VM в WebAssembly через WSL
# Использует Emscripten из WSL окружения
#

set -e  # Останавливаться при ошибках

echo "🚀 Q3VM → WebAssembly компиляция (WSL)"
echo "========================================"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Проверка Emscripten
echo -e "${BLUE}[1/5]${NC} Проверка Emscripten..."
if ! command -v emcc &> /dev/null; then
    echo -e "${RED}❌ Emscripten не найден в WSL!${NC}"
    echo ""
    echo "Установка Emscripten в WSL:"
    echo "  cd ~"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    echo ""
    echo "Добавьте в ~/.bashrc:"
    echo "  source ~/emsdk/emsdk_env.sh"
    exit 1
fi

EMCC_VERSION=$(emcc --version | head -n1)
echo -e "${GREEN}✓${NC} Emscripten найден: ${EMCC_VERSION}"
echo ""

# Пути (WSL)
# Конвертируем Windows путь в WSL путь
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
Q3VM_SRC_WIN="/mnt/c/git/q3vm/src"
OUTPUT_DIR="$SCRIPT_DIR"
OUTPUT_NAME="q3vm-wasm"

echo -e "${BLUE}[2/5]${NC} Проверка исходников Q3VM..."
if [ ! -f "$Q3VM_SRC_WIN/vm/vm.c" ]; then
    echo -e "${RED}❌ vm.c не найден: $Q3VM_SRC_WIN/vm/vm.c${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Исходники найдены: $Q3VM_SRC_WIN"
echo ""

# Создаем временную директорию для сборки
BUILD_DIR="/tmp/q3vm-build-$$"
mkdir -p "$BUILD_DIR"

echo -e "${BLUE}[3/5]${NC} Копирование исходников..."
cp "$Q3VM_SRC_WIN/vm/vm.c" "$BUILD_DIR/"
cp "$Q3VM_SRC_WIN/vm/vm.h" "$BUILD_DIR/"
cp "$Q3VM_SRC_WIN/vm/vm_stubs.c" "$BUILD_DIR/"
echo -e "${GREEN}✓${NC} Исходники скопированы в $BUILD_DIR"
echo ""

# Флаги компиляции (совместимость с Emscripten 3.x)
CFLAGS="-O3 \
-s WASM=1 \
-s MODULARIZE=1 \
-s EXPORT_NAME=Q3VM_WASM \
-s EXPORTED_FUNCTIONS=[_VM_Create,_VM_Free,_VM_Call,_VM_VmProfile_f,_malloc,_free] \
-s EXPORTED_RUNTIME_METHODS=[ccall,cwrap,getValue,setValue,UTF8ToString,stringToUTF8,lengthBytesUTF8,addFunction,removeFunction] \
-s ALLOW_MEMORY_GROWTH=1 \
-s ALLOW_TABLE_GROWTH=1 \
-s INITIAL_MEMORY=67108864 \
-s ENVIRONMENT=web \
-s NO_EXIT_RUNTIME=1 \
-s ASSERTIONS=1 \
--no-entry \
-DCom_Printf=printf \
-DCom_Memset=memset \
-DCom_Memcpy=memcpy \
-DDEBUG_VM=0 \
-Wall"

echo -e "${BLUE}[4/5]${NC} Компиляция C → WASM..."
echo "Команда: emcc vm.c $CFLAGS -o $OUTPUT_NAME.js"
echo ""

cd "$BUILD_DIR"
if emcc vm.c vm_stubs.c $CFLAGS -o "$OUTPUT_NAME.js"; then
    echo ""
    echo -e "${GREEN}✓${NC} Компиляция успешна!"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Ошибка компиляции!${NC}"
    rm -rf "$BUILD_DIR"
    exit 1
fi

echo -e "${BLUE}[5/5]${NC} Копирование результатов..."

# Копируем обратно в Windows директорию
cp "$BUILD_DIR/$OUTPUT_NAME.js" "$OUTPUT_DIR/"
cp "$BUILD_DIR/$OUTPUT_NAME.wasm" "$OUTPUT_DIR/"

# Получаем размеры файлов
JS_SIZE=$(du -h "$OUTPUT_DIR/$OUTPUT_NAME.js" | cut -f1)
WASM_SIZE=$(du -h "$OUTPUT_DIR/$OUTPUT_NAME.wasm" | cut -f1)

echo -e "${GREEN}✓${NC} Файлы скопированы:"
echo "  📄 $OUTPUT_NAME.js   → $JS_SIZE"
echo "  📦 $OUTPUT_NAME.wasm → $WASM_SIZE"
echo ""

# Очистка
rm -rf "$BUILD_DIR"

echo "========================================"
echo -e "${GREEN}🎉 Сборка завершена успешно!${NC}"
echo ""
echo "Файлы созданы в:"
echo "  $(realpath "$OUTPUT_DIR/$OUTPUT_NAME.js")"
echo "  $(realpath "$OUTPUT_DIR/$OUTPUT_NAME.wasm")"
echo ""
echo "Теперь можно использовать в superhud-tools.html:"
echo "  <script src=\"modules/q3vm-wasm.js\"></script>"
echo ""

