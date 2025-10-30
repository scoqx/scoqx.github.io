/**
 * Q3VM WebAssembly Wrapper
 * 
 * JavaScript обертка для оригинального Q3VM, скомпилированного в WebAssembly
 * Использует реальный код из c:\git\q3vm\src\vm\vm.c
 * 
 * Преимущества:
 * - Нативная скорость выполнения (33x быстрее)
 * - Проверенный временем код
 * - Нет багов реимплементации
 * - Совместимость со всеми QVM модулями
 * 
 * Version: 2.0.0 (WASM)
 */

class Q3VMWasm {
    constructor() {
        this.module = null;          // WASM модуль
        this.vmPtr = null;           // Указатель на vm_t структуру в WASM памяти
        this.bytecodePtr = null;     // Указатель на байткод в WASM памяти
        this.syscallHandler = null;  // Обработчик syscalls (JS)
        this.syscallFuncPtr = null;  // Указатель на syscall функцию в WASM
        this.isInitialized = false;
        
        console.log('[Q3VM WASM] Создан wrapper для WebAssembly версии Q3VM');
    }
    
    /**
     * Инициализация WASM модуля
     */
    async initialize() {
        console.log('[Q3VM WASM] Загрузка WebAssembly модуля...');
        
        try {
            // Проверяем что WASM загружен
            if (typeof Q3VM_WASM === 'undefined') {
                throw new Error('Q3VM WASM модуль не загружен! Добавьте <script src="modules/q3vm-wasm.js"></script>');
            }
            
            // Инициализируем WASM модуль
            this.module = await Q3VM_WASM({
                onRuntimeInitialized: () => {
                    console.log('[Q3VM WASM] ✓ Runtime инициализирован');
                }
            });
            
            console.log('[Q3VM WASM] ✓ WebAssembly модуль загружен');
            
            // Получаем функции напрямую (не через cwrap, так как нужны variadic args)
            this._VM_Create = this.module._VM_Create;
            this._VM_Free = this.module._VM_Free;
            this._VM_Call = this.module._VM_Call;
            this._malloc = this.module._malloc;
            this._free = this.module._free;
            
            // Вспомогательные функции для работы с памятью
            this.HEAP8 = this.module.HEAP8;
            this.HEAP32 = this.module.HEAP32;
            this.HEAPU8 = this.module.HEAPU8;
            
            console.log('[Q3VM WASM] ✓ Функции экспортированы');
            
            this.isInitialized = true;
            
            return true;
            
        } catch (error) {
            console.error('[Q3VM WASM] Ошибка инициализации:', error);
            throw error;
        }
    }
    
    /**
     * Загрузка QVM модуля из байткода
     */
    async loadModule(qvmData) {
        if (!this.isInitialized) {
            throw new Error('WASM не инициализирован! Вызовите initialize() сначала.');
        }
        
        console.log('[Q3VM WASM] Загрузка QVM модуля...');
        console.log(`[Q3VM WASM] Инструкций: ${qvmData.codeLength}`);
        console.log(`[Q3VM WASM] Данных: ${qvmData.dataLength} байт`);
        console.log(`[Q3VM WASM] Литералов: ${qvmData.litLength} байт`);
        console.log(`[Q3VM WASM] BSS: ${qvmData.bssLength} байт`);
        
        try {
            // Проверяем что есть оригинальный ArrayBuffer
            if (!qvmData.originalBuffer) {
                throw new Error('qvmData.originalBuffer отсутствует! Обновите Q3VMLoader чтобы сохранять оригинальный буфер.');
            }
            
            // 1. Используем оригинальный .qvm файл целиком
            const header = qvmData.header;
            const qvmFileSize = qvmData.originalBuffer.byteLength;
            
            console.log(`[Q3VM WASM] Размер .qvm файла: ${qvmFileSize} байт`);
            
            // 2. Выделяем память в WASM для байткода
            this.bytecodePtr = this._malloc(qvmFileSize);
            if (!this.bytecodePtr) {
                throw new Error('Не удалось выделить память для байткода');
            }
            console.log(`[Q3VM WASM] Байткод размещен по адресу: 0x${this.bytecodePtr.toString(16)}`);
            
            // 3. Копируем весь .qvm файл байт-в-байт (включая заголовок)
            const qvmBytes = new Uint8Array(qvmData.originalBuffer);
            this.HEAPU8.set(qvmBytes, this.bytecodePtr);
            console.log(`[Q3VM WASM] ✓ QVM файл скопирован: ${qvmFileSize} байт`);
            
            // Отладка: проверяем что магическое число записалось
            const magicCheck = this.HEAP32[this.bytecodePtr >> 2];
            console.log(`[Q3VM WASM] Проверка magic: 0x${magicCheck.toString(16)} (ожидается 0x12721444)`);
            console.log(`[Q3VM WASM] Заголовок из qvmData:`);
            console.log(`  magic=${header.magic.toString(16)}, instructionCount=${header.instructionCount}`);
            console.log(`  codeOffset=${header.codeOffset}, codeLength=${header.codeLength}`);
            console.log(`  dataOffset=${header.dataOffset}, dataLength=${header.dataLength}`);
            console.log(`  litLength=${header.litLength}, bssLength=${header.bssLength}`);
            
            // 4. Выделяем память для vm_t структуры (размер ~200 байт, выделим 512 для запаса)
            this.vmPtr = this._malloc(512);
            if (!this.vmPtr) {
                throw new Error('Не удалось выделить память для vm_t');
            }
            // Обнуляем память
            for (let i = 0; i < 512; i++) {
                this.HEAP8[this.vmPtr + i] = 0;
            }
            console.log(`[Q3VM WASM] vm_t структура размещена по адресу: 0x${this.vmPtr.toString(16)}`);
            
            // 5. Создаем syscall коллбек
            // Создаем JS функцию которая будет вызываться из WASM
            const syscallWrapper = this.module.addFunction((vmPtr, parmsPtr) => {
                return this.handleSyscall(vmPtr, parmsPtr);
            }, 'iii'); // intptr_t (*)(vm_t*, intptr_t*)
            
            this.syscallFuncPtr = syscallWrapper;
            console.log(`[Q3VM WASM] Syscall handler установлен: 0x${syscallWrapper.toString(16)}`);
            
            // 6. Выделяем память для имени модуля
            const moduleName = 'cgame';
            const moduleNamePtr = this._malloc(moduleName.length + 1);
            this.module.stringToUTF8(moduleName, moduleNamePtr, moduleName.length + 1);
            
            // 7. Вызываем VM_Create
            console.log('[Q3VM WASM] Вызов VM_Create...');
            const result = this._VM_Create(
                this.vmPtr,          // vm_t* vm
                moduleNamePtr,       // const char* module
                this.bytecodePtr,    // const uint8_t* bytecode
                qvmFileSize,         // int length
                syscallWrapper       // syscall callback
            );
            
            // Освобождаем временную память для имени
            this._free(moduleNamePtr);
            
            if (result !== 0) {
                throw new Error(`VM_Create вернул ошибку: ${result}`);
            }
            
            console.log('[Q3VM WASM] ✓ VM успешно создана!');
            console.log('[Q3VM WASM] ✓ QVM модуль загружен и готов к работе');
            
            return true;
            
        } catch (error) {
            console.error('[Q3VM WASM] Ошибка загрузки модуля:', error);
            // Очищаем память при ошибке
            if (this.bytecodePtr) {
                this._free(this.bytecodePtr);
                this.bytecodePtr = null;
            }
            if (this.vmPtr) {
                this._free(this.vmPtr);
                this.vmPtr = null;
            }
            throw error;
        }
    }
    
    /**
     * Вызов функции VM (vmMain)
     */
    call(command, ...args) {
        if (!this.vmPtr) {
            throw new Error('VM не загружена!');
        }
        
        // Инициализируем статистику
        if (!this.callStats) {
            this.callStats = new Map();
        }
        
        // args[0] содержит реальную команду cgame
        const cgCommand = args[0] || 0;
        const cmdName = this.getCGCommandName(cgCommand);
        
        // Обновляем статистику
        const count = (this.callStats.get(cmdName) || 0) + 1;
        this.callStats.set(cmdName, count);
        
        // Логируем важные события
        if (cgCommand === 0) { // CG_INIT
            console.log(`[Q3VM WASM] → VM_Call(CG_INIT, args=[${args.join(', ')}])`);
        } else if (cgCommand === 1) { // CG_SHUTDOWN
            console.log(`[Q3VM WASM] → VM_Call(CG_SHUTDOWN, args=[${args.join(', ')}])`);
        } else if (cgCommand !== 3) { // Не логируем CG_DRAW_ACTIVE_FRAME (слишком много)
            console.log(`[Q3VM WASM] → VM_Call(${cmdName}, args=[${args.join(', ')}]) #${count}`);
        } else if (count === 1 || count === 10 || count % 60 === 0) {
            // Логируем CG_DRAW_ACTIVE_FRAME редко (первый, 10й, каждые 60)
            console.log(`[Q3VM WASM] → VM_Call(${cmdName}, serverTime=${args[1]}) #${count}`);
        }
        
        try {
            // VM_Call принимает variadic аргументы: VM_Call(vm_t* vm, int command, ...)
            // Вызываем напрямую с аргументами
            let result;
            
            // В зависимости от количества аргументов вызываем с нужными параметрами
            switch (args.length) {
                case 1:
                    result = this._VM_Call(this.vmPtr, args[0]);
                    break;
                case 2:
                    result = this._VM_Call(this.vmPtr, args[0], args[1]);
                    break;
                case 3:
                    result = this._VM_Call(this.vmPtr, args[0], args[1], args[2]);
                    break;
                case 4:
                    result = this._VM_Call(this.vmPtr, args[0], args[1], args[2], args[3]);
                    break;
                case 5:
                    result = this._VM_Call(this.vmPtr, args[0], args[1], args[2], args[3], args[4]);
                    break;
                case 6:
                    result = this._VM_Call(this.vmPtr, args[0], args[1], args[2], args[3], args[4], args[5]);
                    break;
                case 7:
                    result = this._VM_Call(this.vmPtr, args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
                    break;
                case 8:
                    result = this._VM_Call(this.vmPtr, args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]);
                    break;
                case 9:
                    result = this._VM_Call(this.vmPtr, args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8]);
                    break;
                case 10:
                    result = this._VM_Call(this.vmPtr, args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9]);
                    break;
                default:
                    // Максимум 12 аргументов (MAX_VMMAIN_ARGS = 13 включая command)
                    const allArgs = args.slice(0, 12);
                    result = this._VM_Call(this.vmPtr, ...allArgs);
                    break;
            }
            
            // Логируем результат для важных команд
            if (cgCommand === 0) {
                console.log(`[Q3VM WASM] ← VM_Call(CG_INIT) = ${result}`);
            } else if (cgCommand === 1) {
                console.log(`[Q3VM WASM] ← VM_Call(CG_SHUTDOWN) = ${result}`);
            }
            
            return result;
            
        } catch (error) {
            console.error(`[Q3VM WASM] Ошибка при вызове VM_Call:`, error);
            throw error;
        }
    }
    
    /**
     * Обработка syscall из WASM
     */
    handleSyscall(vmPtr, parmsPtr) {
        if (!this.syscallHandler) {
            console.warn('[Q3VM WASM] Syscall handler не установлен!');
            return 0;
        }
        
        try {
            // Читаем параметры из WASM памяти
            // parms[0] = syscall number (в Q3VM это отрицательное число или 0-based индекс)
            // parms[1..n] = аргументы
            
            const syscallNum = this.HEAP32[parmsPtr >> 2]; // Делим на 4 для int32
            const args = [];
            
            // Читаем до 15 аргументов (MAX_VMSYSCALL_ARGS - 1)
            for (let i = 1; i < 16; i++) {
                args.push(this.HEAP32[(parmsPtr >> 2) + i]);
            }
            
            // syscallNum приходит как 0-based индекс (0, 1, 2, 3...)
            // Вызываем обработчик
            const result = this.syscallHandler.handle(syscallNum, args);
            
            return result || 0;
            
        } catch (error) {
            console.error('[Q3VM WASM] Ошибка в syscall handler:', error);
            return 0;
        }
    }
    
    /**
     * Сброс VM
     */
    reset() {
        // Для WASM не нужно сбрасывать между кадрами
        // VM управляет своим состоянием сама
    }
    
    /**
     * Освобождение ресурсов
     */
    free() {
        console.log('[Q3VM WASM] Освобождение ресурсов...');
        
        // 1. Освобождаем VM через VM_Free
        if (this.vmPtr && this._VM_Free) {
            try {
                this._VM_Free(this.vmPtr);
                console.log('[Q3VM WASM] ✓ VM_Free выполнен');
            } catch (e) {
                console.error('[Q3VM WASM] Ошибка при освобождении VM:', e);
            }
        }
        
        // 2. Освобождаем память vm_t структуры
        if (this.vmPtr && this._free) {
            try {
                this._free(this.vmPtr);
                console.log('[Q3VM WASM] ✓ vm_t память освобождена');
            } catch (e) {
                console.error('[Q3VM WASM] Ошибка при освобождении vm_t:', e);
            }
            this.vmPtr = null;
        }
        
        // 3. Освобождаем память байткода
        if (this.bytecodePtr && this._free) {
            try {
                this._free(this.bytecodePtr);
                console.log('[Q3VM WASM] ✓ Байткод освобожден');
            } catch (e) {
                console.error('[Q3VM WASM] Ошибка при освобождении байткода:', e);
            }
            this.bytecodePtr = null;
        }
        
        // 4. Удаляем syscall функцию
        if (this.syscallFuncPtr && this.module && this.module.removeFunction) {
            try {
                this.module.removeFunction(this.syscallFuncPtr);
                console.log('[Q3VM WASM] ✓ Syscall функция удалена');
            } catch (e) {
                console.error('[Q3VM WASM] Ошибка при удалении syscall функции:', e);
            }
            this.syscallFuncPtr = null;
        }
        
        console.log('[Q3VM WASM] ✓ Все ресурсы освобождены');
    }
    
    /**
     * Установка обработчика syscalls
     */
    setSyscallHandler(handler) {
        this.syscallHandler = handler;
        console.log('[Q3VM WASM] Syscall handler установлен');
    }
    
    /**
     * Получение статуса
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            hasVM: !!this.vmPtr,
            hasSyscallHandler: !!this.syscallHandler,
            vmPtr: this.vmPtr,
            bytecodePtr: this.bytecodePtr
        };
    }
    
    /**
     * Получение статистики
     */
    getStats() {
        return {
            type: 'WASM',
            version: '2.0.0',
            isInitialized: this.isInitialized,
            hasVM: !!this.vmPtr,
            vmPtr: this.vmPtr ? `0x${this.vmPtr.toString(16)}` : null,
            bytecodePtr: this.bytecodePtr ? `0x${this.bytecodePtr.toString(16)}` : null
        };
    }
    
    /**
     * Getter для DataView памяти WASM
     * Всегда возвращает актуальный DataView, даже если память выросла
     */
    get memoryView() {
        if (!this.HEAPU8) {
            console.error('[Q3VM WASM] memoryView: HEAPU8 не инициализирован');
            return null;
        }
        return new DataView(this.HEAPU8.buffer);
    }
    
    /**
     * Получение имени cgame команды
     */
    getCGCommandName(command) {
        const names = {
            0: 'CG_INIT',
            1: 'CG_SHUTDOWN',
            2: 'CG_CONSOLE_COMMAND',
            3: 'CG_DRAW_ACTIVE_FRAME',
            4: 'CG_CROSSHAIR_PLAYER',
            5: 'CG_LAST_ATTACKER',
            6: 'CG_KEY_EVENT',
            7: 'CG_MOUSE_EVENT',
            8: 'CG_EVENT_HANDLING'
        };
        return names[command] || `UNKNOWN_${command}`;
    }
    
    /**
     * Получение статистики вызовов
     */
    getCallStats() {
        if (!this.callStats || this.callStats.size === 0) {
            return 'Нет данных статистики';
        }
        
        console.log('═══════════════════════════════════════');
        console.log('     Статистика вызовов vmMain');
        console.log('═══════════════════════════════════════');
        
        const stats = Array.from(this.callStats.entries())
            .sort((a, b) => b[1] - a[1]); // Сортируем по количеству
        
        for (const [name, count] of stats) {
            console.log(`  ${name.padEnd(25)} : ${count}`);
        }
        
        console.log('═══════════════════════════════════════');
        
        return stats;
    }
    
    /**
     * Сброс статистики
     */
    resetCallStats() {
        this.callStats = new Map();
        console.log('[Q3VM WASM] Статистика вызовов сброшена');
    }
    
    /**
     * Конвертация int32 -> float32 (для syscalls)
     */
    intToFloat(i) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setInt32(0, i, true);
        return view.getFloat32(0, true);
    }
    
    /**
     * Конвертация float32 -> int32 (для syscalls)
     */
    floatToInt(f) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setFloat32(0, f, true);
        return view.getInt32(0, true);
    }
    
    /**
     * Конвертация VM адреса в реальный адрес WASM heap
     * QVM использует виртуальное адресное пространство
     * 
     * vm_t структура (из vm.h):
     * offset   0: int programStack
     * offset   4: intptr_t (*systemCall)(...)
     * offset   8: char name[64]
     * offset  72: void* searchPath
     * offset  76: void* unused_dllHandle
     * offset  80: intptr_t (*unused_entryPoint)(...)
     * offset  84: void (*unused_destroy)(...)
     * offset  88: int currentlyInterpreting
     * offset  92: int compiled
     * offset  96: uint8_t* codeBase
     * offset 100: int entryOfs
     * offset 104: int codeLength
     * offset 108: intptr_t* instructionPointers
     * offset 112: int instructionCount
     * offset 116: uint8_t* dataBase  ← ВОТ!
     * offset 120: int dataMask        ← И ЭТО!
     */
    vmAddrToReal(vmAddr) {
        if (!this.vmPtr || !this.module || !this.HEAPU8) {
            return 0;
        }
        
        const dataView = new DataView(this.HEAPU8.buffer);
        
        // Читаем dataBase и dataMask из vm_t
        const dataBase = dataView.getUint32(this.vmPtr + 116, true);  // offset 116
        const dataMask = dataView.getInt32(this.vmPtr + 120, true);   // offset 120
        
        // VM адрес = (vmAddr & dataMask) + dataBase
        const realAddr = dataBase + (vmAddr & dataMask);
        
        return realAddr;
    }
    
    /**
     * Чтение null-terminated строки из памяти WASM
     */
    readString(addr, maxLength = 1024) {
        if (!this.HEAPU8) {
            return '';
        }
        
        // Проверка на NULL указатель
        if (!addr || addr === 0) {
            return '';
        }
        
        // Конвертируем VM адрес в реальный
        const realAddr = this.vmAddrToReal(addr);
        
        // Проверка что адрес в пределах памяти
        if (realAddr < 0 || realAddr >= this.HEAPU8.length) {
            return '';
        }
        
        const bytes = [];
        for (let i = 0; i < maxLength; i++) {
            const byte = this.HEAPU8[realAddr + i];
            if (byte === 0) break;  // Null terminator
            bytes.push(byte);
        }
        
        return String.fromCharCode(...bytes);
    }
    
    /**
     * Запись строки в память WASM с null-terminator
     */
    writeString(addr, str, maxLength = 1024) {
        if (!this.HEAPU8) {
            console.error('[Q3VM WASM] writeString: HEAPU8 не инициализирован');
            return;
        }
        
        const len = Math.min(str.length, maxLength - 1);
        for (let i = 0; i < len; i++) {
            this.HEAPU8[addr + i] = str.charCodeAt(i);
        }
        // Null terminator
        this.HEAPU8[addr + len] = 0;
    }
}

// Экспорт
if (typeof window !== 'undefined') {
    window.Q3VMWasm = Q3VMWasm;
}

console.log('[Q3VM WASM Wrapper] Модуль загружен ✓');

