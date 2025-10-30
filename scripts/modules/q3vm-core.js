/**
 * Q3VM Core - Интерпретатор виртуальной машины Quake 3
 * 
 * Это полноценная реализация Q3VM (Quake 3 Virtual Machine) на JavaScript.
 * Q3VM - стековая RISC-подобная виртуальная машина с ~50 инструкциями.
 * 
 * Архитектура:
 * - Память VM (data + bss + lit + code)
 * - Стек вызовов
 * - Регистры (программный стек, указатель инструкций)
 * - Syscalls (trap_ функции)
 * 
 * Version: 1.0.0
 * Based on: Q3VM Specification (id Software)
 */

class Q3VM {
    constructor(syscallHandler) {
        // Обработчик системных вызовов (trap_ функции)
        this.syscallHandler = syscallHandler || this.defaultSyscallHandler.bind(this);
        
        // Память VM
        this.memory = null;          // ArrayBuffer для всей памяти
        this.memoryView = null;      // DataView для доступа
        this.memorySize = 0;         // Размер памяти
        
        // Сегменты памяти
        this.dataOffset = 0;         // Начало .data сегмента
        this.dataLength = 0;         // Размер .data
        this.litOffset = 0;          // Начало литералов (строк)
        this.litLength = 0;          // Размер литералов
        this.bssOffset = 0;          // Начало .bss (неинициализированные данные)
        this.bssLength = 0;          // Размер .bss
        
        // Код (инструкции)
        this.code = null;            // Uint32Array с инструкциями
        this.codeLength = 0;         // Количество инструкций
        
        // Регистры VM
        this.programStack = 0;       // Указатель стека программы
        this.instructionPointer = 0; // Указатель текущей инструкции
        this.opStack = 0;            // Указатель операндного стека
        this.opStackBase = 0;        // База операндного стека
        
        // Операндный стек (для вычислений)
        this.opStackValues = new Int32Array(256); // Стек для операндов
        
        // Стек вызовов функций
        this.callStack = [];         // История вызовов для отладки
        this.callStackDepth = 0;     // Глубина вызовов
        
        // Состояние выполнения
        this.isRunning = false;      // VM выполняется
        this.isPaused = false;       // VM на паузе
        this.cycleCount = 0;         // Счетчик циклов (для профилирования)
        this.maxCycles = 1000000;    // Максимум циклов перед остановкой
        
        // Точки останова (для отладки)
        this.breakpoints = new Set();
        this.debugMode = false;      // Режим отладки
        
        // Статистика
        this.stats = {
            instructions: 0,         // Всего выполнено инструкций
            syscalls: 0,             // Количество syscalls
            jumps: 0,                // Количество прыжков
            calls: 0,                // Количество вызовов функций
            memoryReads: 0,          // Чтения из памяти
            memoryWrites: 0          // Записи в память
        };
        
        console.log('[Q3VM] Виртуальная машина создана');
    }
    
    /**
     * Загрузка QVM модуля в память
     */
    loadModule(qvmData) {
        console.log('[Q3VM] Загрузка модуля...');
        
        // qvmData должен содержать:
        // - code: Uint32Array с инструкциями
        // - data: Uint8Array с данными
        // - dataLength, litLength, bssLength
        
        this.codeLength = qvmData.codeLength || qvmData.code.length;
        this.code = qvmData.code;
        
        this.dataLength = qvmData.dataLength || 0;
        this.litLength = qvmData.litLength || 0;
        this.bssLength = qvmData.bssLength || 0;
        
        // Вычисляем размер памяти
        // Структура: DATA | LIT | BSS | STACK
        const dataSize = this.dataLength;
        const litSize = this.litLength;
        const bssSize = this.bssLength;
        const stackSize = 256 * 1024; // 256KB для стека
        
        this.memorySize = dataSize + litSize + bssSize + stackSize;
        
        // Выравниваем до 4 байт
        this.memorySize = (this.memorySize + 3) & ~3;
        
        console.log('[Q3VM] Размеры:');
        console.log(`  - DATA: ${dataSize} байт`);
        console.log(`  - LIT: ${litSize} байт`);
        console.log(`  - BSS: ${bssSize} байт`);
        console.log(`  - STACK: ${stackSize} байт`);
        console.log(`  - Всего: ${this.memorySize} байт`);
        
        // Создаем память
        this.memory = new ArrayBuffer(this.memorySize);
        this.memoryView = new DataView(this.memory);
        
        // Расставляем смещения
        this.dataOffset = 0;
        this.litOffset = this.dataOffset + dataSize;
        this.bssOffset = this.litOffset + litSize;
        const stackStart = this.bssOffset + bssSize;
        
        // Копируем данные
        if (qvmData.data) {
            const dataArray = new Uint8Array(this.memory, this.dataOffset, dataSize);
            dataArray.set(qvmData.data.slice(0, dataSize));
            console.log(`[Q3VM] Скопировано ${dataSize} байт в .data`);
        }
        
        // Копируем литералы
        if (qvmData.lit) {
            const litArray = new Uint8Array(this.memory, this.litOffset, litSize);
            litArray.set(qvmData.lit.slice(0, litSize));
            console.log(`[Q3VM] Скопировано ${litSize} байт в .lit`);
        }
        
        // BSS инициализируется нулями (по умолчанию)
        
        // Инициализируем стек (растет вниз)
        this.programStack = this.memorySize - 4;
        this.opStack = 0;
        this.opStackBase = 0;
        this.instructionPointer = 0;
        
        console.log('[Q3VM] ✓ Модуль загружен успешно');
        console.log(`[Q3VM] Инструкций: ${this.codeLength}`);
        console.log(`[Q3VM] Стек начинается с: 0x${this.programStack.toString(16)}`);
    }
    
    /**
     * Сброс VM в начальное состояние
     */
    reset() {
        this.instructionPointer = 0;
        this.programStack = this.memorySize - 4;
        this.opStack = 0;
        this.opStackBase = 0;
        this.callStack = [];
        this.callStackDepth = 0;
        this.cycleCount = 0;
        this.isRunning = false;
        this.isPaused = false;
        
        // Очищаем операндный стек
        this.opStackValues.fill(0);
        
        console.log('[Q3VM] VM сброшена');
    }
    
    /**
     * Вызов функции VM (vmMain)
     */
    call(functionAddress, ...args) {
        console.log(`[Q3VM] Вызов функции по адресу ${functionAddress} с ${args.length} аргументами`);
        
        // Сбрасываем состояние перед новым вызовом
        this.opStack = 0;
        this.opStackBase = 0;
        this.instructionPointer = functionAddress;
        this.cycleCount = 0;
        
        // Помещаем аргументы на стек программы
        // В Q3VM аргументы передаются через стек
        for (let i = args.length - 1; i >= 0; i--) {
            this.programStack -= 4;
            this.memoryView.setInt32(this.programStack, args[i], true);
        }
        
        // Помещаем адрес возврата (0 = exit)
        this.programStack -= 4;
        this.memoryView.setInt32(this.programStack, 0, true);
        
        // Запускаем выполнение
        this.isRunning = true;
        const result = this.execute();
        
        return result;
    }
    
    /**
     * Основной цикл выполнения
     */
    execute() {
        console.log('[Q3VM] Начинаем выполнение...');
        
        this.isRunning = true;
        let returnValue = 0;
        
        try {
            while (this.isRunning && this.cycleCount < this.maxCycles) {
                // Проверка точки останова
                if (this.breakpoints.has(this.instructionPointer)) {
                    console.log(`[Q3VM] Breakpoint на инструкции ${this.instructionPointer}`);
                    this.isPaused = true;
                    break;
                }
                
                // Получаем текущую инструкцию
                if (this.instructionPointer >= this.codeLength) {
                    console.error('[Q3VM] Выход за границы кода!');
                    break;
                }
                
                const instruction = this.code[this.instructionPointer];
                
                // Выполняем инструкцию
                const shouldContinue = this.executeInstruction(instruction);
                
                if (!shouldContinue) {
                    // Возврат из функции или выход
                    if (this.opStack > 0) {
                        returnValue = this.opStackValues[this.opStack - 1];
                    }
                    break;
                }
                
                this.cycleCount++;
                this.stats.instructions++;
                
                // Переход к следующей инструкции (если не было прыжка)
                // executeInstruction сам изменит IP при необходимости
            }
            
            if (this.cycleCount >= this.maxCycles) {
                console.warn(`[Q3VM] Достигнут лимит циклов: ${this.maxCycles}`);
            }
            
        } catch (error) {
            console.error('[Q3VM] Ошибка выполнения:', error);
            console.error(`[Q3VM] IP: ${this.instructionPointer}, Цикл: ${this.cycleCount}`);
            throw error;
        } finally {
            this.isRunning = false;
        }
        
        console.log(`[Q3VM] Выполнение завершено. Циклов: ${this.cycleCount}`);
        console.log(`[Q3VM] Возвращаемое значение: ${returnValue}`);
        
        return returnValue;
    }
    
    /**
     * Выполнение одной инструкции
     */
    executeInstruction(instruction) {
        const opcode = instruction & 0xFF;
        const arg = (instruction >> 8) & 0xFFFFFF; // 24-битный аргумент
        const signed_arg = (arg & 0x800000) ? (arg | 0xFF000000) : arg; // Знаковое расширение
        
        // Загружаем r0 и r1 (как в оригинале Q3VM)
        // r0 = вершина стека, r1 = вершина-1
        let r0 = 0, r1 = 0;
        if (this.opStack > 0) {
            r0 = this.opStackValues[this.opStack - 1];
        }
        if (this.opStack > 1) {
            r1 = this.opStackValues[this.opStack - 2];
        }
        
        // Отладочный вывод
        if (this.debugMode && this.stats.instructions < 100) {
            console.log(`[Q3VM] ${this.instructionPointer}: OP=${opcode} ARG=${arg} STACK=${this.opStack} r0=${r0} r1=${r1}`);
        }
        
        // Декодируем и выполняем опкод
        switch (opcode) {
            // ========== КОНСТАНТЫ И ЗАГРУЗКА ==========
            case 0x00: // UNDEF
                console.warn('[Q3VM] UNDEF opcode');
                this.instructionPointer++;
                return true;
                
            case 0x01: // IGNORE
                this.instructionPointer++;
                return true;
                
            case 0x02: // BREAK
                console.log('[Q3VM] BREAK - остановка для отладчика');
                this.isPaused = true;
                return false;
                
            case 0x03: // ENTER
                // Вход в функцию - выделяем локальное пространство на стеке
                this.programStack -= signed_arg;
                this.instructionPointer++;
                return true;
                
            case 0x04: // LEAVE
                // Выход из функции - освобождаем локальное пространство
                this.programStack += signed_arg;
                this.instructionPointer++;
                return true;
                
            case 0x05: // CALL
                // Вызов функции
                this.stats.calls++;
                
                // Сохраняем текущий IP
                this.callStack.push({
                    returnAddress: this.instructionPointer + 1,
                    stackPointer: this.programStack,
                    opStack: this.opStack
                });
                this.callStackDepth++;
                
                // Прыгаем к функции
                // В Q3VM адрес функции в вершине операндного стека
                if (this.opStack < 1) {
                    throw new Error('CALL: пустой операндный стек');
                }
                
                const targetAddress = this.opStackValues[--this.opStack];
                
                if (targetAddress < 0 || targetAddress >= this.codeLength) {
                    throw new Error(`CALL: недопустимый адрес ${targetAddress}`);
                }
                
                this.instructionPointer = targetAddress;
                return true;
                
            case 0x06: // PUSH
                // Загружаем константу на операндный стек
                if (this.opStack >= this.opStackValues.length) {
                    throw new Error('PUSH: переполнение операндного стека');
                }
                this.opStackValues[this.opStack++] = signed_arg;
                this.instructionPointer++;
                return true;
                
            case 0x07: // POP
                // Удаляем значение с операндного стека
                if (this.opStack < 1) {
                    throw new Error('POP: операндный стек пуст');
                }
                this.opStack--;
                this.instructionPointer++;
                return true;
                
            case 0x08: // CONST
                // Загружаем константу (синоним PUSH)
                if (this.opStack >= this.opStackValues.length) {
                    throw new Error('CONST: переполнение стека');
                }
                this.opStackValues[this.opStack++] = signed_arg;
                this.instructionPointer++;
                return true;
                
            case 0x09: // LOCAL
                // Загружаем адрес локальной переменной
                // LOCAL addr = programStack + signed_arg
                const localAddr = this.programStack + signed_arg;
                if (this.opStack >= this.opStackValues.length) {
                    throw new Error('LOCAL: переполнение стека');
                }
                this.opStackValues[this.opStack++] = localAddr;
                this.instructionPointer++;
                return true;
                
            case 0x0A: // JUMP
                // Безусловный переход
                this.stats.jumps++;
                if (this.opStack < 1) {
                    throw new Error('JUMP: пустой стек');
                }
                const jumpTarget = this.opStackValues[--this.opStack];
                if (jumpTarget < 0 || jumpTarget >= this.codeLength) {
                    throw new Error(`JUMP: недопустимый адрес ${jumpTarget}`);
                }
                this.instructionPointer = jumpTarget;
                return true;
                
            // ========== ЗАГРУЗКА ИЗ ПАМЯТИ ==========
            case 0x0B: // EQ (==)
                if (this.opStack < 2) throw new Error('EQ: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = (a === b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x0C: // NE (!=)
                if (this.opStack < 2) throw new Error('NE: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = (a !== b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x0D: // LTI (<) - signed
                if (this.opStack < 2) throw new Error('LTI: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = (a < b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x0E: // LEI (<=) - signed
                if (this.opStack < 2) throw new Error('LEI: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = (a <= b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x0F: // GTI (>) - signed
                if (this.opStack < 2) throw new Error('GTI: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = (a > b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x10: // GEI (>=) - signed
                if (this.opStack < 2) throw new Error('GEI: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = (a >= b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x11: // LTU (<) - unsigned
                if (this.opStack < 2) throw new Error('LTU: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack] >>> 0;
                    const a = this.opStackValues[--this.opStack] >>> 0;
                    this.opStackValues[this.opStack++] = (a < b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x12: // LEU (<=) - unsigned
                if (this.opStack < 2) throw new Error('LEU: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack] >>> 0;
                    const a = this.opStackValues[--this.opStack] >>> 0;
                    this.opStackValues[this.opStack++] = (a <= b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x13: // GTU (>) - unsigned
                if (this.opStack < 2) throw new Error('GTU: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack] >>> 0;
                    const a = this.opStackValues[--this.opStack] >>> 0;
                    this.opStackValues[this.opStack++] = (a > b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x14: // GEU (>=) - unsigned
                if (this.opStack < 2) throw new Error('GEU: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack] >>> 0;
                    const a = this.opStackValues[--this.opStack] >>> 0;
                    this.opStackValues[this.opStack++] = (a >= b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x15: // EQF (==) - float
                if (this.opStack < 2) throw new Error('EQF: недостаточно операндов');
                {
                    const b = this.intToFloat(this.opStackValues[--this.opStack]);
                    const a = this.intToFloat(this.opStackValues[--this.opStack]);
                    this.opStackValues[this.opStack++] = (a === b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x16: // NEF (!=) - float
                if (this.opStack < 2) throw new Error('NEF: недостаточно операндов');
                {
                    const b = this.intToFloat(this.opStackValues[--this.opStack]);
                    const a = this.intToFloat(this.opStackValues[--this.opStack]);
                    this.opStackValues[this.opStack++] = (a !== b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x17: // LTF (<) - float
                if (this.opStack < 2) throw new Error('LTF: недостаточно операндов');
                {
                    const b = this.intToFloat(this.opStackValues[--this.opStack]);
                    const a = this.intToFloat(this.opStackValues[--this.opStack]);
                    this.opStackValues[this.opStack++] = (a < b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x18: // LEF (<=) - float
                if (this.opStack < 2) throw new Error('LEF: недостаточно операндов');
                {
                    const b = this.intToFloat(this.opStackValues[--this.opStack]);
                    const a = this.intToFloat(this.opStackValues[--this.opStack]);
                    this.opStackValues[this.opStack++] = (a <= b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x19: // GTF (>) - float
                if (this.opStack < 2) throw new Error('GTF: недостаточно операндов');
                {
                    const b = this.intToFloat(this.opStackValues[--this.opStack]);
                    const a = this.intToFloat(this.opStackValues[--this.opStack]);
                    this.opStackValues[this.opStack++] = (a > b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x1A: // GEF (>=) - float
                if (this.opStack < 2) throw new Error('GEF: недостаточно операндов');
                {
                    const b = this.intToFloat(this.opStackValues[--this.opStack]);
                    const a = this.intToFloat(this.opStackValues[--this.opStack]);
                    this.opStackValues[this.opStack++] = (a >= b) ? 1 : 0;
                }
                this.instructionPointer++;
                return true;
                
            // ========== ЗАГРУЗКА ИЗ ПАМЯТИ ==========
            case 0x1B: // LOAD1 - загрузить 1 байт
                if (this.opStack < 1) throw new Error('LOAD1: пустой стек');
                {
                    const addr = this.opStackValues[--this.opStack];
                    this.checkMemoryBounds(addr, 1);
                    const value = this.memoryView.getUint8(addr);
                    this.opStackValues[this.opStack++] = value;
                    this.stats.memoryReads++;
                }
                this.instructionPointer++;
                return true;
                
            case 0x1C: // LOAD2 - загрузить 2 байта
                if (this.opStack < 1) throw new Error('LOAD2: пустой стек');
                {
                    const addr = this.opStackValues[--this.opStack];
                    this.checkMemoryBounds(addr, 2);
                    const value = this.memoryView.getUint16(addr, true);
                    this.opStackValues[this.opStack++] = value;
                    this.stats.memoryReads++;
                }
                this.instructionPointer++;
                return true;
                
            case 0x1D: // LOAD4 - загрузить 4 байта
                if (this.opStack < 1) throw new Error('LOAD4: пустой стек');
                {
                    const addr = this.opStackValues[--this.opStack];
                    this.checkMemoryBounds(addr, 4);
                    const value = this.memoryView.getInt32(addr, true);
                    this.opStackValues[this.opStack++] = value;
                    this.stats.memoryReads++;
                }
                this.instructionPointer++;
                return true;
                
            // ========== СОХРАНЕНИЕ В ПАМЯТЬ ==========
            case 0x1E: // STORE1 - сохранить 1 байт
                if (this.opStack < 2) throw new Error('STORE1: недостаточно операндов');
                {
                    const value = this.opStackValues[--this.opStack];
                    const addr = this.opStackValues[--this.opStack];
                    this.checkMemoryBounds(addr, 1);
                    this.memoryView.setUint8(addr, value & 0xFF);
                    this.stats.memoryWrites++;
                }
                this.instructionPointer++;
                return true;
                
            case 0x1F: // STORE2 - сохранить 2 байта
                if (this.opStack < 2) throw new Error('STORE2: недостаточно операндов');
                {
                    const value = this.opStackValues[--this.opStack];
                    const addr = this.opStackValues[--this.opStack];
                    this.checkMemoryBounds(addr, 2);
                    this.memoryView.setUint16(addr, value & 0xFFFF, true);
                    this.stats.memoryWrites++;
                }
                this.instructionPointer++;
                return true;
                
            case 0x20: // STORE4 - сохранить 4 байта
                if (this.opStack < 2) throw new Error('STORE4: недостаточно операндов');
                {
                    const value = this.opStackValues[--this.opStack];
                    const addr = this.opStackValues[--this.opStack];
                    this.checkMemoryBounds(addr, 4);
                    this.memoryView.setInt32(addr, value, true);
                    this.stats.memoryWrites++;
                }
                this.instructionPointer++;
                return true;
                
            case 0x21: // ARG - копирует значение в стек аргументов
                if (this.opStack < 1) throw new Error('ARG: пустой стек');
                {
                    const value = this.opStackValues[--this.opStack];
                    // Аргумент передается через стек программы
                    const argOffset = this.programStack + signed_arg;
                    this.checkMemoryBounds(argOffset, 4);
                    this.memoryView.setInt32(argOffset, value, true);
                }
                this.instructionPointer++;
                return true;
                
            case 0x22: // BLOCK_COPY - копирование блока памяти
                if (this.opStack < 2) throw new Error('BLOCK_COPY: недостаточно операндов');
                {
                    const count = signed_arg; // Количество байт для копирования
                    const src = this.opStackValues[--this.opStack];
                    const dst = this.opStackValues[--this.opStack];
                    
                    this.checkMemoryBounds(src, count);
                    this.checkMemoryBounds(dst, count);
                    
                    // Копируем байты
                    const srcArray = new Uint8Array(this.memory, src, count);
                    const dstArray = new Uint8Array(this.memory, dst, count);
                    dstArray.set(srcArray);
                    
                    this.stats.memoryReads += count;
                    this.stats.memoryWrites += count;
                }
                this.instructionPointer++;
                return true;
                
            // ========== АРИФМЕТИКА ==========
            case 0x23: // SEX8 - знаковое расширение 8->32 бит
                if (this.opStack < 1) throw new Error('SEX8: пустой стек');
                {
                    let value = this.opStackValues[this.opStack - 1] & 0xFF;
                    // Знаковое расширение
                    if (value & 0x80) value |= 0xFFFFFF00;
                    this.opStackValues[this.opStack - 1] = value;
                }
                this.instructionPointer++;
                return true;
                
            case 0x24: // SEX16 - знаковое расширение 16->32 бит
                if (this.opStack < 1) throw new Error('SEX16: пустой стек');
                {
                    let value = this.opStackValues[this.opStack - 1] & 0xFFFF;
                    // Знаковое расширение
                    if (value & 0x8000) value |= 0xFFFF0000;
                    this.opStackValues[this.opStack - 1] = value;
                }
                this.instructionPointer++;
                return true;
                
            case 0x25: // NEGI - отрицание целого числа
                if (this.opStack < 1) throw new Error('NEGI: пустой стек');
                this.opStackValues[this.opStack - 1] = -this.opStackValues[this.opStack - 1];
                this.instructionPointer++;
                return true;
                
            case 0x26: // ADD - сложение целых
                if (this.opStack < 2) throw new Error('ADD: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = (a + b) | 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x27: // SUB - вычитание целых
                if (this.opStack < 2) throw new Error('SUB: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = (a - b) | 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x28: // DIVI - деление целых со знаком
                if (this.opStack < 2) throw new Error('DIVI: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    if (b === 0) throw new Error('DIVI: деление на ноль');
                    this.opStackValues[this.opStack++] = (a / b) | 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x29: // DIVU - деление целых без знака
                if (this.opStack < 2) throw new Error('DIVU: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack] >>> 0;
                    const a = this.opStackValues[--this.opStack] >>> 0;
                    if (b === 0) throw new Error('DIVU: деление на ноль');
                    this.opStackValues[this.opStack++] = (a / b) >>> 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x2A: // MODI - остаток от деления со знаком
                if (this.opStack < 2) throw new Error('MODI: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    if (b === 0) throw new Error('MODI: деление на ноль');
                    this.opStackValues[this.opStack++] = (a % b) | 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x2B: // MODU - остаток от деления без знака
                if (this.opStack < 2) throw new Error('MODU: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack] >>> 0;
                    const a = this.opStackValues[--this.opStack] >>> 0;
                    if (b === 0) throw new Error('MODU: деление на ноль');
                    this.opStackValues[this.opStack++] = (a % b) >>> 0;
                }
                this.instructionPointer++;
                return true;
                
            case 0x2C: // MULI - умножение целых со знаком
                if (this.opStack < 2) throw new Error('MULI: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = Math.imul(a, b);
                }
                this.instructionPointer++;
                return true;
                
            case 0x2D: // MULU - умножение целых без знака
                if (this.opStack < 2) throw new Error('MULU: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack] >>> 0;
                    const a = this.opStackValues[--this.opStack] >>> 0;
                    // Беззнаковое умножение
                    const result = (a * b) >>> 0;
                    this.opStackValues[this.opStack++] = result;
                }
                this.instructionPointer++;
                return true;
                
            case 0x2E: // BAND - побитовое И
                if (this.opStack < 2) throw new Error('BAND: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = a & b;
                }
                this.instructionPointer++;
                return true;
                
            case 0x2F: // BOR - побитовое ИЛИ
                if (this.opStack < 2) throw new Error('BOR: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = a | b;
                }
                this.instructionPointer++;
                return true;
                
            case 0x30: // BXOR - побитовое исключающее ИЛИ
                if (this.opStack < 2) throw new Error('BXOR: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = a ^ b;
                }
                this.instructionPointer++;
                return true;
                
            case 0x31: // BCOM - побитовое НЕ
                if (this.opStack < 1) throw new Error('BCOM: пустой стек');
                this.opStackValues[this.opStack - 1] = ~this.opStackValues[this.opStack - 1];
                this.instructionPointer++;
                return true;
                
            case 0x32: // LSH - логический сдвиг влево
                if (this.opStack < 2) throw new Error('LSH: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = a << b;
                }
                this.instructionPointer++;
                return true;
                
            case 0x33: // RSHI - арифметический сдвиг вправо
                if (this.opStack < 2) throw new Error('RSHI: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = a >> b;
                }
                this.instructionPointer++;
                return true;
                
            case 0x34: // RSHU - логический сдвиг вправо
                if (this.opStack < 2) throw new Error('RSHU: недостаточно операндов');
                {
                    const b = this.opStackValues[--this.opStack];
                    const a = this.opStackValues[--this.opStack];
                    this.opStackValues[this.opStack++] = a >>> b;
                }
                this.instructionPointer++;
                return true;
                
            // ========== АРИФМЕТИКА С ПЛАВАЮЩЕЙ ТОЧКОЙ ==========
            case 0x35: // NEGF - отрицание float
                if (this.opStack < 1) throw new Error('NEGF: пустой стек');
                {
                    const f = this.intToFloat(this.opStackValues[this.opStack - 1]);
                    this.opStackValues[this.opStack - 1] = this.floatToInt(-f);
                }
                this.instructionPointer++;
                return true;
                
            case 0x36: // ADDF - сложение float
                if (this.opStack < 2) throw new Error('ADDF: недостаточно операндов');
                {
                    const b = this.intToFloat(this.opStackValues[--this.opStack]);
                    const a = this.intToFloat(this.opStackValues[--this.opStack]);
                    this.opStackValues[this.opStack++] = this.floatToInt(a + b);
                }
                this.instructionPointer++;
                return true;
                
            case 0x37: // SUBF - вычитание float
                if (this.opStack < 2) throw new Error('SUBF: недостаточно операндов');
                {
                    const b = this.intToFloat(this.opStackValues[--this.opStack]);
                    const a = this.intToFloat(this.opStackValues[--this.opStack]);
                    this.opStackValues[this.opStack++] = this.floatToInt(a - b);
                }
                this.instructionPointer++;
                return true;
                
            case 0x38: // DIVF - деление float
                if (this.opStack < 2) throw new Error('DIVF: недостаточно операндов');
                {
                    const b = this.intToFloat(this.opStackValues[--this.opStack]);
                    const a = this.intToFloat(this.opStackValues[--this.opStack]);
                    if (b === 0.0) throw new Error('DIVF: деление на ноль');
                    this.opStackValues[this.opStack++] = this.floatToInt(a / b);
                }
                this.instructionPointer++;
                return true;
                
            case 0x39: // MULF - умножение float
                if (this.opStack < 2) throw new Error('MULF: недостаточно операндов');
                {
                    const b = this.intToFloat(this.opStackValues[--this.opStack]);
                    const a = this.intToFloat(this.opStackValues[--this.opStack]);
                    this.opStackValues[this.opStack++] = this.floatToInt(a * b);
                }
                this.instructionPointer++;
                return true;
                
            // ========== ПРЕОБРАЗОВАНИЯ ТИПОВ ==========
            case 0x3A: // CVIF - int -> float
                if (this.opStack < 1) throw new Error('CVIF: пустой стек');
                {
                    const intValue = this.opStackValues[this.opStack - 1];
                    this.opStackValues[this.opStack - 1] = this.floatToInt(intValue);
                }
                this.instructionPointer++;
                return true;
                
            case 0x3B: // CVFI - float -> int
                if (this.opStack < 1) throw new Error('CVFI: пустой стек');
                {
                    const floatValue = this.intToFloat(this.opStackValues[this.opStack - 1]);
                    this.opStackValues[this.opStack - 1] = floatValue | 0;
                }
                this.instructionPointer++;
                return true;
                
            default:
                // Проверяем, не является ли это системным вызовом
                if (opcode < 0) {
                    // Отрицательные опкоды = syscalls
                    return this.handleSyscall(-opcode);
                }
                
                console.error(`[Q3VM] Неизвестный опкод: 0x${opcode.toString(16)} на инструкции ${this.instructionPointer}`);
                throw new Error(`Неизвестный опкод: 0x${opcode.toString(16)}`);
        }
    }
    
    /**
     * Обработка системного вызова
     */
    handleSyscall(syscallNum) {
        this.stats.syscalls++;
        
        // Получаем аргументы из стека программы
        // В Q3VM аргументы syscall передаются через стек
        const args = [];
        let argOffset = this.programStack + 4; // Пропускаем адрес возврата
        
        // Читаем до 12 аргументов (максимум для Q3 syscalls)
        for (let i = 0; i < 12; i++) {
            if (argOffset >= this.memorySize) break;
            args.push(this.memoryView.getInt32(argOffset, true));
            argOffset += 4;
        }
        
        // Вызываем обработчик
        const result = this.syscallHandler(syscallNum, args);
        
        // Результат возвращается на операндный стек
        if (result !== undefined && result !== null) {
            if (this.opStack >= this.opStackValues.length) {
                throw new Error('Syscall: переполнение стека при возврате результата');
            }
            this.opStackValues[this.opStack++] = result;
        }
        
        this.instructionPointer++;
        return true;
    }
    
    /**
     * Обработчик syscalls по умолчанию
     */
    defaultSyscallHandler(syscallNum, args) {
        console.warn(`[Q3VM] Syscall ${syscallNum} не реализован. Аргументы:`, args);
        return 0;
    }
    
    /**
     * Проверка границ памяти
     */
    checkMemoryBounds(addr, size) {
        if (addr < 0 || addr + size > this.memorySize) {
            throw new Error(`Доступ к памяти за границами: 0x${addr.toString(16)} размер ${size}, макс 0x${this.memorySize.toString(16)}`);
        }
    }
    
    /**
     * Преобразование int32 <-> float32
     */
    floatToInt(f) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setFloat32(0, f, true);
        return view.getInt32(0, true);
    }
    
    intToFloat(i) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setInt32(0, i, true);
        return view.getFloat32(0, true);
    }
    
    /**
     * Получение строки из памяти (C-style, null-terminated)
     */
    readString(addr, maxLength = 1024) {
        const bytes = [];
        for (let i = 0; i < maxLength; i++) {
            if (addr + i >= this.memorySize) break;
            const byte = this.memoryView.getUint8(addr + i);
            if (byte === 0) break;
            bytes.push(byte);
        }
        return String.fromCharCode(...bytes);
    }
    
    /**
     * Запись строки в память
     */
    writeString(addr, str, maxLength = 1024) {
        const len = Math.min(str.length, maxLength - 1);
        for (let i = 0; i < len; i++) {
            this.memoryView.setUint8(addr + i, str.charCodeAt(i));
        }
        // Null terminator
        this.memoryView.setUint8(addr + len, 0);
    }
    
    /**
     * Получение статистики выполнения
     */
    getStats() {
        return {
            ...this.stats,
            memorySize: this.memorySize,
            codeLength: this.codeLength,
            stackDepth: this.callStackDepth,
            opStack: this.opStack
        };
    }
    
    /**
     * Дамп состояния для отладки
     */
    dumpState() {
        console.log('[Q3VM] ===== СОСТОЯНИЕ VM =====');
        console.log(`IP: ${this.instructionPointer}`);
        console.log(`Program Stack: 0x${this.programStack.toString(16)}`);
        console.log(`Op Stack: ${this.opStack}`);
        console.log(`Call Stack Depth: ${this.callStackDepth}`);
        console.log(`Cycles: ${this.cycleCount}`);
        
        if (this.opStack > 0) {
            console.log('Операндный стек (топ 5):');
            for (let i = Math.max(0, this.opStack - 5); i < this.opStack; i++) {
                console.log(`  [${i}] = ${this.opStackValues[i]} (0x${this.opStackValues[i].toString(16)})`);
            }
        }
        
        console.log('Статистика:', this.getStats());
        console.log('[Q3VM] ===========================');
    }
}

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.Q3VM = Q3VM;
}

console.log('[Q3VM] Модуль загружен ✓');

