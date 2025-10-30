/**
 * Q3VM Loader - Загрузчик .qvm байткода
 * 
 * Загружает и парсит файлы .qvm (Quake 3 Virtual Machine bytecode)
 * 
 * Формат QVM файла:
 * - Заголовок (56 байт)
 * - Код (инструкции)
 * - Данные (.data сегмент)
 * - Литералы (строки)
 * 
 * Version: 1.0.0
 */

class Q3VMLoader {
    constructor() {
        this.QVM_MAGIC = 0x12721444; // Магическое число QVM файла
        this.lastLoadedModule = null;
    }
    
    /**
     * Загрузка QVM из ArrayBuffer
     */
    async loadFromArrayBuffer(arrayBuffer) {
        console.log('[Q3VM Loader] Загрузка QVM файла...');
        console.log(`[Q3VM Loader] Размер файла: ${arrayBuffer.byteLength} байт`);
        
        const view = new DataView(arrayBuffer);
        let offset = 0;
        
        // ========== ЗАГОЛОВОК QVM ==========
        // Читаем заголовок (14 int32 = 56 байт)
        const header = {
            magic: view.getInt32(offset, true),             // 0: Магическое число
            instructionCount: view.getInt32(offset + 4, true),   // 4: Количество инструкций
            codeOffset: view.getInt32(offset + 8, true),    // 8: Смещение кода
            codeLength: view.getInt32(offset + 12, true),   // 12: Длина кода в байтах
            dataOffset: view.getInt32(offset + 16, true),   // 16: Смещение данных
            dataLength: view.getInt32(offset + 20, true),   // 20: Длина данных
            litLength: view.getInt32(offset + 24, true),    // 24: Длина литералов
            bssLength: view.getInt32(offset + 28, true),    // 28: Длина BSS
            vmMagic: view.getInt32(offset + 32, true),      // 32: VM Magic версия
            // Остальные поля зарезервированы
        };
        
        console.log('[Q3VM Loader] Заголовок:');
        console.log(`  Magic: 0x${header.magic.toString(16)}`);
        console.log(`  Инструкций: ${header.instructionCount}`);
        console.log(`  Код: смещение=${header.codeOffset}, длина=${header.codeLength}`);
        console.log(`  Данные: смещение=${header.dataOffset}, длина=${header.dataLength}`);
        console.log(`  Литералы: ${header.litLength}`);
        console.log(`  BSS: ${header.bssLength}`);
        console.log(`  VM Magic: 0x${header.vmMagic.toString(16)}`);
        console.log(`  Размер файла: ${arrayBuffer.byteLength} байт`);
        
        // Проверка границ (как в vm.c)
        const VM_MAX_BSS_LENGTH = 10485760;
        console.log('[Q3VM Loader] Проверка границ:');
        console.log(`  codeOffset + codeLength = ${header.codeOffset + header.codeLength} <= ${arrayBuffer.byteLength}? ${header.codeOffset + header.codeLength <= arrayBuffer.byteLength}`);
        console.log(`  dataOffset + dataLength + litLength = ${header.dataOffset + header.dataLength + header.litLength} <= ${arrayBuffer.byteLength}? ${header.dataOffset + header.dataLength + header.litLength <= arrayBuffer.byteLength}`);
        console.log(`  bssLength = ${header.bssLength} <= ${VM_MAX_BSS_LENGTH}? ${header.bssLength <= VM_MAX_BSS_LENGTH}`);
        
        // Проверяем магическое число
        if (header.magic !== this.QVM_MAGIC) {
            throw new Error(`Неверное магическое число QVM: 0x${header.magic.toString(16)}, ожидалось 0x${this.QVM_MAGIC.toString(16)}`);
        }
        
        // ========== КОД (ИНСТРУКЦИИ) ==========
        console.log('[Q3VM Loader] Загрузка инструкций...');
        
        const codeArray = new Uint32Array(header.instructionCount);
        let codeOffset = header.codeOffset;
        
        for (let i = 0; i < header.instructionCount; i++) {
            codeArray[i] = view.getInt32(codeOffset, true);
            codeOffset += 4;
        }
        
        console.log(`[Q3VM Loader] ✓ Загружено ${header.instructionCount} инструкций`);
        
        // Выводим первые 10 инструкций для отладки
        if (header.instructionCount > 0) {
            console.log('[Q3VM Loader] Первые инструкции:');
            for (let i = 0; i < Math.min(10, header.instructionCount); i++) {
                const instr = codeArray[i];
                const opcode = instr & 0xFF;
                const arg = (instr >> 8) & 0xFFFFFF;
                console.log(`  [${i}] 0x${instr.toString(16).padStart(8, '0')} -> OP=0x${opcode.toString(16).padStart(2, '0')} ARG=${arg}`);
            }
        }
        
        // ========== ДАННЫЕ ==========
        console.log('[Q3VM Loader] Загрузка данных...');
        
        let dataArray = null;
        if (header.dataLength > 0) {
            dataArray = new Uint8Array(arrayBuffer, header.dataOffset, header.dataLength);
            console.log(`[Q3VM Loader] ✓ Загружено ${header.dataLength} байт данных`);
        }
        
        // ========== ЛИТЕРАЛЫ ==========
        let litArray = null;
        if (header.litLength > 0) {
            const litOffset = header.dataOffset + header.dataLength;
            litArray = new Uint8Array(arrayBuffer, litOffset, header.litLength);
            console.log(`[Q3VM Loader] ✓ Загружено ${header.litLength} байт литералов`);
            
            // Выводим первые строки для отладки
            this.dumpStrings(litArray, 5);
        }
        
        // ========== ФОРМИРУЕМ МОДУЛЬ ==========
        const module = {
            header: header,
            code: codeArray,
            codeLength: header.instructionCount,
            data: dataArray,
            dataLength: header.dataLength,
            lit: litArray,
            litLength: header.litLength,
            bssLength: header.bssLength,
            originalBuffer: arrayBuffer  // Сохраняем оригинальный буфер для WASM
        };
        
        this.lastLoadedModule = module;
        
        console.log('[Q3VM Loader] ===========================');
        console.log('[Q3VM Loader] ✓ QVM модуль загружен успешно!');
        console.log('[Q3VM Loader] ===========================');
        
        return module;
    }
    
    /**
     * Загрузка QVM из URL
     */
    async loadFromURL(url) {
        console.log(`[Q3VM Loader] Загрузка из URL: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Не удалось загрузить QVM: HTTP ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        return await this.loadFromArrayBuffer(arrayBuffer);
    }
    
    /**
     * Загрузка QVM из PK3 архива (через JSZip)
     */
    async loadFromPK3(pk3Path, qvmPath) {
        console.log(`[Q3VM Loader] Загрузка из PK3: ${pk3Path} -> ${qvmPath}`);
        
        // Загружаем PK3 (это ZIP архив)
        const response = await fetch(pk3Path);
        if (!response.ok) {
            throw new Error(`Не удалось загрузить PK3: HTTP ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Распаковываем с помощью JSZip
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip не загружен! Убедитесь что jszip.min.js подключен.');
        }
        
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Ищем QVM файл в архиве
        const qvmFile = zip.file(qvmPath);
        if (!qvmFile) {
            // Пробуем найти с разными регистрами
            const files = Object.keys(zip.files);
            console.log('[Q3VM Loader] Файлы в PK3:', files);
            
            const foundFile = files.find(f => f.toLowerCase() === qvmPath.toLowerCase());
            if (!foundFile) {
                throw new Error(`QVM файл не найден в PK3: ${qvmPath}`);
            }
            
            console.log(`[Q3VM Loader] Найден файл: ${foundFile}`);
            const qvmArrayBuffer = await zip.file(foundFile).async('arraybuffer');
            return await this.loadFromArrayBuffer(qvmArrayBuffer);
        }
        
        const qvmArrayBuffer = await qvmFile.async('arraybuffer');
        return await this.loadFromArrayBuffer(qvmArrayBuffer);
    }
    
    /**
     * Автоматическая загрузка cgame.qvm из OSP2-BE
     */
    async loadCGameFromOSP2() {
        console.log('[Q3VM Loader] Загрузка cgame.qvm из OSP2-BE...');
        
        // Пробуем несколько путей
        const paths = [
            { pk3: '../assets/zz-osp-pak8be.pk3', qvm: 'vm/cgame.qvm' },
            { pk3: '../assets/zz-osp-pak8be.pk3', qvm: 'cgame.qvm' },
            { pk3: './assets/zz-osp-pak8be.pk3', qvm: 'vm/cgame.qvm' },
            { pk3: 'assets/zz-osp-pak8be.pk3', qvm: 'vm/cgame.qvm' }
        ];
        
        for (const path of paths) {
            try {
                console.log(`[Q3VM Loader] Пробуем: ${path.pk3} -> ${path.qvm}`);
                const module = await this.loadFromPK3(path.pk3, path.qvm);
                
                // Сохраняем информацию о загруженном PK3 для последующей регистрации в VFS
                module.pk3Path = path.pk3;
                module.pk3Name = path.pk3.split('/').pop();
                
                return module;
            } catch (error) {
                console.log(`[Q3VM Loader] Не удалось: ${error.message}`);
            }
        }
        
        throw new Error('Не удалось загрузить cgame.qvm ни из одного пути');
    }
    
    /**
     * Регистрация PK3 архива в файловой системе
     * Должна быть вызвана после loadCGameFromOSP2()
     */
    async registerPK3InVFS(syscallHandler, pk3Path) {
        console.log(`[Q3VM Loader] Регистрация PK3 в VFS: ${pk3Path}`);
        
        try {
            // Загружаем PK3
            const response = await fetch(pk3Path);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            // Распаковываем с помощью JSZip
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip не загружен!');
            }
            
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // Регистрируем архив в VFS
            await syscallHandler.loadPK3Archive(zip, pk3Path.split('/').pop());
            
            console.log(`[Q3VM Loader] ✓ PK3 зарегистрирован в VFS`);
            
            // Предзагружаем критические файлы в кеш
            await this.preloadCriticalFiles(syscallHandler, zip, pk3Path.split('/').pop());
            
            return true;
        } catch (error) {
            console.error(`[Q3VM Loader] Ошибка регистрации PK3:`, error);
            return false;
        }
    }
    
    /**
     * Предзагрузка критических файлов в кеш для синхронного доступа
     */
    async preloadCriticalFiles(syscallHandler, zip, archiveName) {
        console.log('[Q3VM Loader] Предзагрузка критических файлов...');
        
        const filesToPreload = [];
        
        // Собираем список файлов для предзагрузки
        zip.forEach((relativePath, file) => {
            if (file.dir) return;
            
            // Шрифты (.fontdat файлы)
            if (relativePath.endsWith('.fontdat')) {
                filesToPreload.push({ path: relativePath, file: file });
            }
            // Конфигурационные файлы
            else if (relativePath.endsWith('.cfg')) {
                filesToPreload.push({ path: relativePath, file: file });
            }
            // Картинки для HUD
            else if (relativePath.match(/\.(tga|jpg|png)$/i) && relativePath.includes('gfx')) {
                filesToPreload.push({ path: relativePath, file: file });
            }
        });
        
        console.log(`[Q3VM Loader] Найдено файлов для предзагрузки: ${filesToPreload.length}`);
        
        // Находим архив в VFS для добавления в кеш
        const archive = syscallHandler.vfs.pk3Archives.find(a => a.name === archiveName);
        if (!archive) {
            console.error('[Q3VM Loader] Архив не найден в VFS!');
            return;
        }
        
        // Инициализируем кеш если нет
        if (!archive.cache) {
            archive.cache = new Map();
        }
        
        // Предзагружаем файлы
        let loadedCount = 0;
        for (const item of filesToPreload) {
            try {
                const data = await item.file.async('uint8array');
                archive.cache.set(item.path, data);
                loadedCount++;
                
                if (loadedCount <= 5) { // Логируем только первые 5
                    console.log(`[Q3VM Loader]   ✓ ${item.path} (${data.length} байт)`);
                }
            } catch (error) {
                console.error(`[Q3VM Loader]   ✗ Ошибка загрузки ${item.path}:`, error);
            }
        }
        
        console.log(`[Q3VM Loader] ✓ Предзагружено файлов: ${loadedCount}/${filesToPreload.length}`);
    }
    
    /**
     * Загрузка локальных файлов (не из PK3) в VFS
     * Используется для конфигов и других файлов вне архивов
     */
    async loadLocalFilesIntoVFS(syscallHandler, files) {
        console.log('[Q3VM Loader] Загрузка локальных файлов в VFS...');
        
        // Создаем виртуальный архив для локальных файлов
        const localArchive = {
            name: 'local-files',
            zip: null,
            cache: new Map()
        };
        
        let loadedCount = 0;
        
        for (const fileInfo of files) {
            try {
                const response = await fetch(fileInfo.url);
                if (!response.ok) {
                    console.warn(`[Q3VM Loader]   ⚠ Не удалось загрузить ${fileInfo.path}: HTTP ${response.status}`);
                    continue;
                }
                
                const arrayBuffer = await response.arrayBuffer();
                const data = new Uint8Array(arrayBuffer);
                
                // Добавляем в кеш виртуального архива
                localArchive.cache.set(fileInfo.path, data);
                loadedCount++;
                
                console.log(`[Q3VM Loader]   ✓ ${fileInfo.path} (${data.length} байт)`);
            } catch (error) {
                console.error(`[Q3VM Loader]   ✗ Ошибка загрузки ${fileInfo.path}:`, error);
            }
        }
        
        // Регистрируем виртуальный архив в VFS
        if (loadedCount > 0) {
            syscallHandler.vfs.pk3Archives.push(localArchive);
            console.log(`[Q3VM Loader] ✓ Локальных файлов загружено: ${loadedCount}/${files.length}`);
        }
        
        return loadedCount;
    }
    
    /**
     * Вывод строк из литералов (для отладки)
     */
    dumpStrings(litArray, maxStrings = 10) {
        console.log('[Q3VM Loader] Литералы (строки):');
        
        let offset = 0;
        let count = 0;
        
        while (offset < litArray.length && count < maxStrings) {
            // Читаем строку до null-терминатора
            const bytes = [];
            let foundNull = false;
            
            for (let i = offset; i < litArray.length && i < offset + 256; i++) {
                const byte = litArray[i];
                if (byte === 0) {
                    foundNull = true;
                    offset = i + 1;
                    break;
                }
                bytes.push(byte);
            }
            
            if (bytes.length > 0) {
                const str = String.fromCharCode(...bytes);
                // Показываем только печатные строки
                if (str.length > 0 && /^[\x20-\x7E]+$/.test(str)) {
                    console.log(`  [${count}] "${str}"`);
                    count++;
                }
            }
            
            if (!foundNull) break;
        }
    }
    
    /**
     * Дизассемблирование кода (для отладки)
     */
    disassemble(startInstr = 0, count = 20) {
        if (!this.lastLoadedModule) {
            console.log('[Q3VM Loader] Нет загруженного модуля');
            return;
        }
        
        const code = this.lastLoadedModule.code;
        const end = Math.min(startInstr + count, code.length);
        
        console.log(`[Q3VM Loader] Дизассемблирование (${startInstr} - ${end}):`);
        console.log('-------------------------------------------');
        
        for (let i = startInstr; i < end; i++) {
            const instr = code[i];
            const opcode = instr & 0xFF;
            const arg = (instr >> 8) & 0xFFFFFF;
            const signed_arg = (arg & 0x800000) ? (arg | 0xFF000000) : arg;
            
            const opName = this.getOpcodeName(opcode);
            
            console.log(`${String(i).padStart(6, ' ')}: 0x${instr.toString(16).padStart(8, '0')}  ${opName.padEnd(12, ' ')} ${signed_arg}`);
        }
        
        console.log('-------------------------------------------');
    }
    
    /**
     * Получение имени опкода
     */
    getOpcodeName(opcode) {
        const opcodes = {
            0x00: 'UNDEF',
            0x01: 'IGNORE',
            0x02: 'BREAK',
            0x03: 'ENTER',
            0x04: 'LEAVE',
            0x05: 'CALL',
            0x06: 'PUSH',
            0x07: 'POP',
            0x08: 'CONST',
            0x09: 'LOCAL',
            0x0A: 'JUMP',
            0x0B: 'EQ',
            0x0C: 'NE',
            0x0D: 'LTI',
            0x0E: 'LEI',
            0x0F: 'GTI',
            0x10: 'GEI',
            0x11: 'LTU',
            0x12: 'LEU',
            0x13: 'GTU',
            0x14: 'GEU',
            0x15: 'EQF',
            0x16: 'NEF',
            0x17: 'LTF',
            0x18: 'LEF',
            0x19: 'GTF',
            0x1A: 'GEF',
            0x1B: 'LOAD1',
            0x1C: 'LOAD2',
            0x1D: 'LOAD4',
            0x1E: 'STORE1',
            0x1F: 'STORE2',
            0x20: 'STORE4',
            0x21: 'ARG',
            0x22: 'BLOCK_COPY',
            0x23: 'SEX8',
            0x24: 'SEX16',
            0x25: 'NEGI',
            0x26: 'ADD',
            0x27: 'SUB',
            0x28: 'DIVI',
            0x29: 'DIVU',
            0x2A: 'MODI',
            0x2B: 'MODU',
            0x2C: 'MULI',
            0x2D: 'MULU',
            0x2E: 'BAND',
            0x2F: 'BOR',
            0x30: 'BXOR',
            0x31: 'BCOM',
            0x32: 'LSH',
            0x33: 'RSHI',
            0x34: 'RSHU',
            0x35: 'NEGF',
            0x36: 'ADDF',
            0x37: 'SUBF',
            0x38: 'DIVF',
            0x39: 'MULF',
            0x3A: 'CVIF',
            0x3B: 'CVFI'
        };
        
        return opcodes[opcode] || `UNKNOWN_0x${opcode.toString(16)}`;
    }
    
    /**
     * Анализ модуля
     */
    analyzeModule() {
        if (!this.lastLoadedModule) {
            console.log('[Q3VM Loader] Нет загруженного модуля');
            return null;
        }
        
        const module = this.lastLoadedModule;
        const code = module.code;
        
        // Считаем статистику опкодов
        const opcodeStats = {};
        for (let i = 0; i < code.length; i++) {
            const opcode = code[i] & 0xFF;
            opcodeStats[opcode] = (opcodeStats[opcode] || 0) + 1;
        }
        
        // Находим точки входа (ENTER инструкции)
        const entryPoints = [];
        for (let i = 0; i < code.length; i++) {
            const opcode = code[i] & 0xFF;
            if (opcode === 0x03) { // ENTER
                entryPoints.push(i);
            }
        }
        
        const analysis = {
            totalInstructions: code.length,
            dataSize: module.dataLength,
            litSize: module.litLength,
            bssSize: module.bssLength,
            entryPoints: entryPoints,
            opcodeStats: opcodeStats,
            topOpcodes: Object.entries(opcodeStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([op, count]) => ({
                    opcode: parseInt(op),
                    name: this.getOpcodeName(parseInt(op)),
                    count: count
                }))
        };
        
        console.log('[Q3VM Loader] ===== АНАЛИЗ МОДУЛЯ =====');
        console.log(`Инструкций: ${analysis.totalInstructions}`);
        console.log(`Данные: ${analysis.dataSize} байт`);
        console.log(`Литералы: ${analysis.litSize} байт`);
        console.log(`BSS: ${analysis.bssSize} байт`);
        console.log(`Точек входа (функций): ${analysis.entryPoints.length}`);
        console.log('Топ-10 опкодов:');
        analysis.topOpcodes.forEach((item, i) => {
            console.log(`  ${i + 1}. ${item.name}: ${item.count} (${(item.count / analysis.totalInstructions * 100).toFixed(1)}%)`);
        });
        console.log('[Q3VM Loader] =================================');
        
        return analysis;
    }
}

// Экспорт
if (typeof window !== 'undefined') {
    window.Q3VMLoader = Q3VMLoader;
}

console.log('[Q3VM Loader] Модуль загружен ✓');


