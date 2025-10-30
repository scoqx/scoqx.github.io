/**
 * Q3VM Syscalls - Системные вызовы для cgame
 * 
 * Реализация trap_ функций, которые вызываются из QVM
 * Эти функции позволяют QVM взаимодействовать с движком:
 * - Рендеринг (trap_R_*)
 * - Звук (trap_S_*)
 * - Конфиги/cvars (trap_Cvar_*)
 * - Команды (trap_Cmd_*)
 * - Снапшоты и playerState (trap_GetSnapshot, trap_GetCurrentSnapshotNumber)
 * - И т.д.
 * 
 * Features:
 * - Real playerState with health, armor, weapon, ammo
 * - Proper snapshot_t structure for cgame
 * - Methods to modify player stats (setWeapon, modifyHealth, modifyArmor)
 * - Integration with Q3ServerEmulator (optional)
 * - Automatic sync with VirtualPlayer when server is connected
 * 
 * Version: 1.0.4
 */

// Константы syscall номеров (из cg_public.h cgameImport_t enum)
const CG_SYSCALLS = {
    // Системные
    CG_PRINT: 0,
    CG_ERROR: 1,
    CG_MILLISECONDS: 2,
    CG_CVAR_REGISTER: 3,
    CG_CVAR_UPDATE: 4,
    CG_CVAR_SET: 5,
    CG_CVAR_VARIABLESTRINGBUFFER: 6,
    CG_ARGC: 7,
    CG_ARGV: 8,
    CG_ARGS: 9,
    CG_FS_FOPENFILE: 10,
    CG_FS_READ: 11,
    CG_FS_WRITE: 12,
    CG_FS_FCLOSEFILE: 13,
    CG_SENDCONSOLECOMMAND: 14,
    CG_ADDCOMMAND: 15,
    CG_SENDCLIENTCOMMAND: 16,
    
    // Update/Snapshot/Collision Map
    CG_UPDATESCREEN: 17,
    CG_CM_LOADMAP: 18,
    CG_CM_NUMINLINEMODELS: 19,
    CG_CM_INLINEMODEL: 20,
    CG_CM_LOADMODEL: 21,
    CG_CM_TEMPBOXMODEL: 22,
    CG_CM_POINTCONTENTS: 23,
    CG_CM_TRANSFORMEDPOINTCONTENTS: 24,
    CG_CM_BOXTRACE: 25,
    CG_CM_TRANSFORMEDBOXTRACE: 26,
    CG_CM_MARKFRAGMENTS: 27,
    
    // Звук
    CG_S_STARTSOUND: 28,
    CG_S_STARTLOCALSOUND: 29,
    CG_S_CLEARLOOPINGSOUNDS: 30,
    CG_S_ADDLOOPINGSOUND: 31,
    CG_S_UPDATEENTITYPOSITION: 32,
    CG_S_RESPATIALIZE: 33,
    CG_S_REGISTERSOUND: 34,
    CG_S_STARTBACKGROUNDTRACK: 35,
    
    // Рендеринг - основное
    CG_R_LOADWORLDMAP: 36,
    CG_R_REGISTERMODEL: 37,
    CG_R_REGISTERSKIN: 38,
    CG_R_REGISTERSHADER: 39,
    CG_R_CLEARSCENE: 40,
    CG_R_ADDREFENTITYTOSCENE: 41,
    CG_R_ADDPOLYTOSCENE: 42,
    CG_R_ADDLIGHTTOSCENE: 43,
    CG_R_RENDERSCENE: 44,
    CG_R_SETCOLOR: 45,
    CG_R_DRAWSTRETCHPIC: 46,
    CG_R_MODELBOUNDS: 47,
    CG_R_LERPTAG: 48,
    
    // Cgame специфичные
    CG_GETGLCONFIG: 49,
    CG_GETGAMESTATE: 50,
    CG_GETCURRENTSNAPSHOTNUMBER: 51,
    CG_GETSNAPSHOT: 52,
    CG_GETSERVERCOMMAND: 53,
    CG_GETCURRENTCMDNUMBER: 54,
    CG_GETUSERCMD: 55,
    CG_SETUSERCMDVALUE: 56,
    CG_R_REGISTERSHADERNOMIP: 57,
    
    // Память и клавиатура/мышь
    CG_MEMORY_REMAINING: 58,
    CG_R_REGISTERFONT: 59,
    CG_KEY_ISDOWN: 60,
    CG_KEY_GETCATCHER: 61,
    CG_KEY_SETCATCHER: 62,
    CG_KEY_GETKEY: 63,
    
    // Парсер
    CG_PC_ADD_GLOBAL_DEFINE: 64,
    CG_PC_LOAD_SOURCE: 65,
    CG_PC_FREE_SOURCE: 66,
    CG_PC_READ_TOKEN: 67,
    CG_PC_SOURCE_FILE_AND_LINE: 68,
    
    CG_S_STOPBACKGROUNDTRACK: 69,
    CG_REAL_TIME: 70,
    CG_SNAPVECTOR: 71,
    CG_REMOVECOMMAND: 72,
    CG_R_LIGHTFORPOINT: 73,
    
    // Синематики
    CG_CIN_PLAYCINEMATIC: 74,
    CG_CIN_STOPCINEMATIC: 75,
    CG_CIN_RUNCINEMATIC: 76,
    CG_CIN_DRAWCINEMATIC: 77,
    CG_CIN_SETEXTENTS: 78,
    
    CG_R_REMAP_SHADER: 79,
    CG_S_ADDREALLOOPINGSOUND: 80,
    CG_S_STOPLOOPINGSOUND: 81,
    
    CG_CM_TEMPCAPSULEMODEL: 82,
    CG_CM_CAPSULETRACE: 83,
    CG_CM_TRANSFORMEDCAPSULETRACE: 84,
    CG_R_ADDADDITIVELIGHTTOSCENE: 85,
    CG_GET_ENTITY_TOKEN: 86,
    CG_R_ADDPOLYSTOSCENE: 87,
    CG_R_INPVS: 88,
    CG_FS_SEEK: 89,
    
    // Math lib functions (100+)
    CG_MEMSET: 100,
    CG_MEMCPY: 101,
    CG_STRNCPY: 102,
    CG_SIN: 103,
    CG_COS: 104,
    CG_ATAN2: 105,
    CG_SQRT: 106,
    CG_FLOOR: 107,
    CG_CEIL: 108,
    CG_TESTPRINTINT: 109,
    CG_TESTPRINTFLOAT: 110,
    CG_ACOS: 111
};

/**
 * Обработчик syscalls для cgame
 */
class Q3VMSyscallHandler {
    constructor(canvas, ctx, server = null) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.vm = null; // Будет установлен при привязке к VM
        this.server = server; // Ссылка на Q3ServerEmulator (опционально)
        this.localClientNum = 0; // ID локального игрока
        
        // Текущий цвет для рендеринга
        this.currentColor = [1, 1, 1, 1];
        
        // Зарегистрированные ресурсы
        this.shaders = new Map();        // handle -> shader name
        this.models = new Map();         // handle -> model name
        this.sounds = new Map();         // handle -> sound name
        this.skins = new Map();          // handle -> skin name
        
        // Счетчики для handles
        this.nextShaderHandle = 1;
        this.nextModelHandle = 1;
        this.nextSoundHandle = 1;
        this.nextSkinHandle = 1;
        
        // CVars (консольные переменные)
        this.cvars = new Map();
        
        // Команды консоли
        this.commands = new Map();
        
        // Игровое состояние
        this.gameState = {
            dataCount: 0,
            data: new Uint8Array(16384)
        };
        
        // Снапшоты
        this.snapshots = [];
        this.currentSnapshotNumber = 1000; // Начинаем с 1000 чтобы QVM точно увидел изменение
        
        // Server Commands (для xstats1 и других серверных команд)
        this.serverCommands = [];
        this.serverCommandSequence = 0;
        this.currentCommand = null; // Текущая обрабатываемая команда (для Argc/Argv)
        
        // Player State (данные игрока)
        this.playerState = {
            // Статистика (STAT_* из bg_public.h)
            health: 100,
            armor: 50,
            weapon: 2, // WP_MACHINEGUN
            ammo: [0, 100, 50, 10, 10, 100, 10, 100, 10, 0], // Патроны для каждого оружия
            weaponFlags: 0x03, // Биты доступных оружий (Gauntlet + Machinegun)
            
            // Базовые параметры
            clientNum: 0,
            commandTime: 0,
            
            // Позиция
            origin: [0, 0, 0],
            velocity: [0, 0, 0],
            viewangles: [0, 0, 0]
        };
        
        // Время запуска
        this.startTime = Date.now();
        
        // Снапшоты от сервера
        this.serverSnapshots = [];  // Массив снапшотов от сервера
        this.lastServerSnapshot = null;  // Последний полученный снапшот
        
        // Лог syscalls (для отладки)
        this.syscallLog = [];
        this.logSyscalls = false; // Включить для отладки
        
        // Виртуальная файловая система
        this.vfs = {
            pk3Archives: [],           // Загруженные PK3 архивы (JSZip объекты)
            openFiles: new Map(),      // handle -> { data, position, size }
            nextFileHandle: 1
        };
        
        // CVars из конфига (будут загружены из diwoc.cfg)
        this.configCVars = new Map();
        
        // ConfigStrings (от сервера)
        this.configStrings = new Map(); // index -> string
        
        // Флаг инициализации - команды не должны попадать в снапшоты до завершения CG_Init
        this.isInitialized = false;
        
        console.log('[Q3VM Syscalls] Обработчик создан');
    }
    
    /**
     * Парсинг .cfg файла и извлечение всех seta команд
     * Вызывается после загрузки конфига в VFS
     */
    async parseConfigFile(configPath) {
        console.log(`[Q3VM Syscalls] Парсинг конфига: ${configPath}`);
        
        // Ищем конфиг в VFS
        let configData = null;
        for (const archive of this.vfs.pk3Archives) {
            if (archive.cache && archive.cache.has(configPath)) {
                configData = archive.cache.get(configPath);
                break;
            }
        }
        
        if (!configData) {
            console.warn(`[Q3VM Syscalls] Конфиг не найден: ${configPath}`);
            return 0;
        }
        
        // Декодируем текст
        const decoder = new TextDecoder('utf-8');
        const configText = decoder.decode(configData);
        
        // Парсим строки
        const lines = configText.split('\n');
        let parsedCount = 0;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Пропускаем комментарии и пустые строки
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
                continue;
            }
            
            // Ищем команды seta (улучшенный regex для поддержки кавычек и пробелов)
            const setaMatch = trimmed.match(/^seta\s+(\S+)\s+(.+)$/);
            if (setaMatch) {
                let [, varName, varValue] = setaMatch;
                // Убираем кавычки если есть
                varValue = varValue.replace(/^"(.*)"$/, '$1').trim();
                this.configCVars.set(varName, varValue);
                parsedCount++;
                
                // Логируем первые 10 для отладки
                if (parsedCount <= 10) {
                    console.log(`[Config] ${varName} = "${varValue}"`);
                }
            }
            
            // Также поддержим set (без архивирования)
            const setMatch = trimmed.match(/^set\s+(\S+)\s+(.+)$/);
            if (setMatch && !setaMatch) {
                let [, varName, varValue] = setMatch;
                varValue = varValue.replace(/^"(.*)"$/, '$1').trim();
                this.configCVars.set(varName, varValue);
                parsedCount++;
            }
        }
        
        console.log(`[Q3VM Syscalls] ✓ Распарсено CVars из конфига: ${parsedCount}`);
        return parsedCount;
    }
    
    /**
     * Удалено: initializeDefaultCVars() - не нужно!
     * CVars регистрируются QVM через trap_Cvar_Register с default значениями
     * Мы просто проверяем есть ли переопределение в конфиге
     */
    
    // Старый метод удален для чистоты кода
    
    /**
     * Привязка к VM (для доступа к памяти)
     */
    bindToVM(vm) {
        this.vm = vm;
        console.log('[Q3VM Syscalls] Привязан к VM');
    }
    
    /**
     * Получение снапшота от сервера
     * Вызывается сервером через мост
     */
    receiveSnapshot(snapshot) {
        if (!snapshot) {
            console.log('[QVM SYSCALL] ⚠️ Снапшот пустой!');
            return;
        }
        
        this.serverSnapshots.push(snapshot);
        this.lastServerSnapshot = snapshot;
        
        // Увеличиваем currentSnapshotNumber с каждым снапшотом
        this.currentSnapshotNumber++;
        
        // КРИТИЧНО: Не передаем команды до завершения инициализации QVM!
        // Иначе QVM запомнит sequence при CG_Init и больше не будет обрабатывать
        if (!this.isInitialized && snapshot.serverCommandSequence > 0) {
            console.log(`[QVM SYSCALL] ⏸️ Снапшот #${this.currentSnapshotNumber}: команды пропущены (QVM не инициализирован)`);
            snapshot.serverCommandSequence = 0; // Обнуляем чтобы QVM не запомнил
        } else if (snapshot.serverCommandSequence > 0) {
            console.log(`[QVM SYSCALL] 📦 Снапшот #${this.currentSnapshotNumber}: serverTime=${snapshot.serverTime}ms, commandSeq=${snapshot.serverCommandSequence}`);
        }
        
        // Ограничиваем историю снапшотов
        if (this.serverSnapshots.length > 32) {
            this.serverSnapshots.shift();
        }
    }
    
    /**
     * Загрузка PK3 архива в виртуальную файловую систему
     * @param {JSZip} zipObject - JSZip объект с загруженным архивом
     * @param {string} name - Имя архива (для отладки)
     */
    async loadPK3Archive(zipObject, name = 'unknown.pk3') {
        if (!zipObject) {
            console.error('[VFS] Передан пустой ZIP объект');
            return false;
        }
        
        this.vfs.pk3Archives.push({
            name: name,
            zip: zipObject
        });
        
        // Подсчитываем файлы
        let fileCount = 0;
        zipObject.forEach(() => fileCount++);
        
        console.log(`[VFS] Загружен PK3 архив: ${name} (${fileCount} файлов)`);
        return true;
    }
    
    /**
     * Поиск файла в загруженных PK3 архивах
     * @param {string} path - Путь к файлу (например "maps/q3dm1.bsp")
     * @returns {Promise<Uint8Array|null>} Данные файла или null
     */
    async findFileInPK3(path) {
        // Нормализуем путь (убираем начальный слеш если есть)
        const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
        
        // Ищем в обратном порядке (последние загруженные PK3 имеют приоритет)
        for (let i = this.vfs.pk3Archives.length - 1; i >= 0; i--) {
            const archive = this.vfs.pk3Archives[i];
            const file = archive.zip.file(normalizedPath);
            
            if (file) {
                console.log(`[VFS] Найден файл: ${normalizedPath} в ${archive.name}`);
                try {
                    const data = await file.async('uint8array');
                    return data;
                } catch (error) {
                    console.error(`[VFS] Ошибка чтения файла ${normalizedPath}:`, error);
                    return null;
                }
            }
        }
        
        console.log(`[VFS] Файл не найден: ${normalizedPath}`);
        return null;
    }
    
    /**
     * Главный обработчик syscalls
     */
    handle(syscallNum, args) {
        // Логируем syscall если включен режим отладки
        if (this.logSyscalls) {
            const name = this.getSyscallName(syscallNum);
            this.syscallLog.push({ num: syscallNum, name: name, args: args });
            
            if (this.syscallLog.length < 50) { // Только первые 50 для производительности
                console.log(`[Syscall] ${name} (${syscallNum}):`, args.slice(0, 4));
            }
        }
        
        // Диспетчеризация syscall
        switch (syscallNum) {
            // ========== СИСТЕМНЫЕ ==========
            case CG_SYSCALLS.CG_PRINT:
                return this.trap_Print(args[0]);
                
            case CG_SYSCALLS.CG_ERROR:
                return this.trap_Error(args[0]);
                
            case CG_SYSCALLS.CG_MILLISECONDS:
                return this.trap_Milliseconds();
                
            // ========== CVAR ==========
            case CG_SYSCALLS.CG_CVAR_REGISTER:
                return this.trap_Cvar_Register(args[0], args[1], args[2], args[3]);
                
            case CG_SYSCALLS.CG_CVAR_UPDATE:
                return this.trap_Cvar_Update(args[0]);
                
            case CG_SYSCALLS.CG_CVAR_SET:
                return this.trap_Cvar_Set(args[0], args[1]);
                
            case CG_SYSCALLS.CG_CVAR_VARIABLESTRINGBUFFER:
                return this.trap_Cvar_VariableStringBuffer(args[0], args[1], args[2]);
                
            // ========== ARGC/ARGV/ARGS ==========
            case CG_SYSCALLS.CG_ARGC:
                return this.trap_Argc();
                
            case CG_SYSCALLS.CG_ARGV:
                return this.trap_Argv(args[0], args[1], args[2]);
                
            case CG_SYSCALLS.CG_ARGS:
                return this.trap_Args(args[0], args[1]);
                
            // ========== FILE SYSTEM ==========
            case CG_SYSCALLS.CG_FS_FOPENFILE:
                return this.trap_FS_FOpenFile(args[0], args[1], args[2]);
                
            case CG_SYSCALLS.CG_FS_READ:
                return this.trap_FS_Read(args[0], args[1], args[2]);
                
            case CG_SYSCALLS.CG_FS_WRITE:
                return this.trap_FS_Write(args[0], args[1], args[2]);
                
            case CG_SYSCALLS.CG_FS_FCLOSEFILE:
                return this.trap_FS_FCloseFile(args[0]);
                
            case CG_SYSCALLS.CG_FS_SEEK:
                return this.trap_FS_Seek(args[0], args[1], args[2]);
                
            // ========== КОМАНДЫ ==========
            case CG_SYSCALLS.CG_SENDCONSOLECOMMAND:
                return this.trap_SendConsoleCommand(args[0]);
                
            case CG_SYSCALLS.CG_ADDCOMMAND:
                return this.trap_AddCommand(args[0]);
                
            case CG_SYSCALLS.CG_REMOVECOMMAND:
                return this.trap_RemoveCommand(args[0]);
                
            case CG_SYSCALLS.CG_SENDCLIENTCOMMAND:
                return this.trap_SendClientCommand(args[0]);
                
            case CG_SYSCALLS.CG_UPDATESCREEN:
                return this.trap_UpdateScreen();
                
            // ========== COLLISION MAP ==========
            case CG_SYSCALLS.CG_CM_LOADMAP:
                return this.trap_CM_LoadMap(args[0]);
                
            case CG_SYSCALLS.CG_CM_NUMINLINEMODELS:
                return this.trap_CM_NumInlineModels();
                
            case CG_SYSCALLS.CG_CM_INLINEMODEL:
                return this.trap_CM_InlineModel(args[0]);
                
            case CG_SYSCALLS.CG_CM_TEMPBOXMODEL:
                return this.trap_CM_TempBoxModel(args[0], args[1]);
                
            case CG_SYSCALLS.CG_CM_TEMPCAPSULEMODEL:
                return this.trap_CM_TempCapsuleModel(args[0], args[1]);
                
            case CG_SYSCALLS.CG_CM_POINTCONTENTS:
                return this.trap_CM_PointContents(args[0], args[1]);
                
            // ========== ЗВУК ==========
            case CG_SYSCALLS.CG_S_REGISTERSOUND:
                return this.trap_S_RegisterSound(args[0], args[1]);
                
            case CG_SYSCALLS.CG_S_STARTSOUND:
                return this.trap_S_StartSound(args[0], args[1], args[2], args[3]);
                
            case CG_SYSCALLS.CG_S_STARTLOCALSOUND:
                return this.trap_S_StartLocalSound(args[0], args[1]);
                
            case CG_SYSCALLS.CG_S_CLEARLOOPINGSOUNDS:
                return this.trap_S_ClearLoopingSounds(args[0]);
                
            case CG_SYSCALLS.CG_S_ADDLOOPINGSOUND:
                return this.trap_S_AddLoopingSound(args[0], args[1], args[2], args[3]);
                
            case CG_SYSCALLS.CG_S_UPDATEENTITYPOSITION:
                return this.trap_S_UpdateEntityPosition(args[0], args[1]);
                
            case CG_SYSCALLS.CG_S_RESPATIALIZE:
                return this.trap_S_Respatialize(args[0], args[1], args[2], args[3]);
                
            case CG_SYSCALLS.CG_S_STARTBACKGROUNDTRACK:
                return this.trap_S_StartBackgroundTrack(args[0], args[1]);
                
            case CG_SYSCALLS.CG_S_STOPBACKGROUNDTRACK:
                return this.trap_S_StopBackgroundTrack();
                
            // ========== РЕНДЕРИНГ ==========
            case CG_SYSCALLS.CG_R_LOADWORLDMAP:
                return this.trap_R_LoadWorldMap(args[0]);
                
            case CG_SYSCALLS.CG_R_REGISTERMODEL:
                return this.trap_R_RegisterModel(args[0]);
                
            case CG_SYSCALLS.CG_R_REGISTERSKIN:
                return this.trap_R_RegisterSkin(args[0]);
                
            case CG_SYSCALLS.CG_R_REGISTERSHADER:
                return this.trap_R_RegisterShader(args[0]);
                
            case CG_SYSCALLS.CG_R_REGISTERSHADERNOMIP:
                return this.trap_R_RegisterShaderNoMip(args[0]);
                
            case CG_SYSCALLS.CG_R_REGISTERFONT:
                return this.trap_R_RegisterFont(args[0], args[1], args[2]);
                
            case CG_SYSCALLS.CG_R_CLEARSCENE:
                return this.trap_R_ClearScene();
                
            case CG_SYSCALLS.CG_R_ADDREFENTITYTOSCENE:
                return this.trap_R_AddRefEntityToScene(args[0]);
                
            case CG_SYSCALLS.CG_R_ADDPOLYTOSCENE:
                return this.trap_R_AddPolyToScene(args[0], args[1], args[2]);
                
            case CG_SYSCALLS.CG_R_ADDLIGHTTOSCENE:
                return this.trap_R_AddLightToScene(args[0], args[1], args[2], args[3], args[4]);
                
            case CG_SYSCALLS.CG_R_RENDERSCENE:
                return this.trap_R_RenderScene(args[0]);
                
            case CG_SYSCALLS.CG_R_SETCOLOR:
                return this.trap_R_SetColor(args[0]);
                
            case CG_SYSCALLS.CG_R_DRAWSTRETCHPIC:
                return this.trap_R_DrawStretchPic(
                    args[0], args[1], args[2], args[3], // x, y, w, h
                    args[4], args[5], args[6], args[7], // s1, t1, s2, t2
                    args[8] // shader handle
                );
                
            case CG_SYSCALLS.CG_R_MODELBOUNDS:
                return this.trap_R_ModelBounds(args[0], args[1], args[2]);
                
            case CG_SYSCALLS.CG_R_LERPTAG:
                return this.trap_R_LerpTag(args[0], args[1], args[2], args[3], args[4], args[5]);
                
            case CG_SYSCALLS.CG_R_LIGHTFORPOINT:
                return this.trap_R_LightForPoint(args[0], args[1], args[2], args[3]);
                
            // ========== SNAPSHOT/GAMESTATE ==========
            case CG_SYSCALLS.CG_GETGLCONFIG:
                return this.trap_GetGLConfig(args[0]);
                
            case CG_SYSCALLS.CG_GETGAMESTATE:
                return this.trap_GetGameState(args[0]);
                
            case CG_SYSCALLS.CG_GETCURRENTSNAPSHOTNUMBER:
                return this.trap_GetCurrentSnapshotNumber(args[0], args[1]);
                
            case CG_SYSCALLS.CG_GETSNAPSHOT:
                return this.trap_GetSnapshot(args[0], args[1]);
                
            case CG_SYSCALLS.CG_GETSERVERCOMMAND:
                return this.trap_GetServerCommand(args[0]);
                
            case CG_SYSCALLS.CG_GETCURRENTCMDNUMBER:
                return this.trap_GetCurrentCmdNumber();
                
            case CG_SYSCALLS.CG_GETUSERCMD:
                return this.trap_GetUserCmd(args[0], args[1]);
                
            case CG_SYSCALLS.CG_SETUSERCMDVALUE:
                return this.trap_SetUserCmdValue(args[0], args[1]);
                
            // ========== КЛАВИАТУРА/МЫШЬ ==========
            case CG_SYSCALLS.CG_MEMORY_REMAINING:
                return this.trap_MemoryRemaining();
                
            case CG_SYSCALLS.CG_KEY_ISDOWN:
                return this.trap_Key_IsDown(args[0]);
                
            case CG_SYSCALLS.CG_KEY_GETCATCHER:
                return this.trap_Key_GetCatcher();
                
            case CG_SYSCALLS.CG_KEY_SETCATCHER:
                return this.trap_Key_SetCatcher(args[0]);
                
            case CG_SYSCALLS.CG_KEY_GETKEY:
                return this.trap_Key_GetKey(args[0]);
                
            // ========== PARSER ==========
            case CG_SYSCALLS.CG_PC_ADD_GLOBAL_DEFINE:
                return this.trap_PC_AddGlobalDefine(args[0]);
                
            case CG_SYSCALLS.CG_PC_LOAD_SOURCE:
                return this.trap_PC_LoadSource(args[0]);
                
            case CG_SYSCALLS.CG_PC_FREE_SOURCE:
                return this.trap_PC_FreeSource(args[0]);
                
            case CG_SYSCALLS.CG_PC_READ_TOKEN:
                return this.trap_PC_ReadToken(args[0], args[1]);
                
            case CG_SYSCALLS.CG_PC_SOURCE_FILE_AND_LINE:
                return this.trap_PC_SourceFileAndLine(args[0], args[1], args[2]);
                
            // ========== ПРОЧЕЕ ==========
            case CG_SYSCALLS.CG_REAL_TIME:
                return this.trap_RealTime(args[0]);
                
            case CG_SYSCALLS.CG_SNAPVECTOR:
                return this.trap_SnapVector(args[0]);
                
            case CG_SYSCALLS.CG_GET_ENTITY_TOKEN:
                return this.trap_GetEntityToken(args[0], args[1]);
                
            default:
                // Неизвестный syscall - возвращаем 0
                if (syscallNum < 100) { // Логируем только первые 100 (не math lib)
                    console.warn(`[Q3VM Syscalls] Неизвестный syscall: ${syscallNum} ${this.getSyscallName(syscallNum)}`);
                }
                return 0;
        }
    }
    
    // ============================================================
    // РЕАЛИЗАЦИЯ SYSCALLS
    // ============================================================
    
    /**
     * trap_Print - вывод в консоль
     */
    trap_Print(stringPtr) {
        if (!this.vm) return;
        const str = this.vm.readString(stringPtr);
        // Не логируем пустые строки
        if (str && str.trim()) {
            console.log(`[CG] ${str}`);
        }
        return 0;
    }
    
    /**
     * trap_Error - вывод ошибки
     */
    trap_Error(stringPtr) {
        if (!this.vm) return;
        const str = this.vm.readString(stringPtr);
        // Не выбрасываем исключение - просто логируем
        // Выброс исключения останавливает рендеринг, что нежелательно
        if (str && str.trim()) {
            console.error(`[CG ERROR] ${str}`);
        }
        return 0;
    }
    
    /**
     * trap_Milliseconds - текущее время в миллисекундах
     */
    trap_Milliseconds() {
        return Date.now() - this.startTime;
    }
    
    /**
     * trap_Cvar_Register - регистрация консольной переменной
     * УМНАЯ ЛОГИКА: проверяет конфиг → если есть использует, если нет → defaultValue от QVM
     */
    trap_Cvar_Register(vmCvarPtr, varNamePtr, defaultValuePtr, flags) {
        if (!this.vm) return;
        
        const varName = this.vm.readString(varNamePtr);
        const defaultValue = this.vm.readString(defaultValuePtr);
        
        // Создаем или обновляем cvar
        if (!this.cvars.has(varName)) {
            // ✨ ПРОВЕРЯЕМ КОНФИГ СНАЧАЛА!
            let finalValue = defaultValue;
            
            if (this.configCVars.has(varName)) {
                finalValue = this.configCVars.get(varName);
                
                // Специальное логирование для color cvars
                if (varName.includes('color') || varName.includes('Color')) {
                    console.log(`[CVars] ⚠️ ${varName} = "${finalValue}" (из конфига, default="${defaultValue}")`);
                }
            }
            
            this.cvars.set(varName, {
                name: varName,
                string: finalValue,
                value: parseFloat(finalValue) || 0,
                integer: parseInt(finalValue) || 0,
                flags: flags
            });
        }
        
        // Записываем данные в структуру vmCvar_t
        const cvar = this.cvars.get(varName);
        if (vmCvarPtr) {
            // vmCvar_t структура:
            // int handle, int modificationCount, float value, int integer, char string[256]
            this.vm.memoryView.setInt32(vmCvarPtr, 0, true); // handle (не используется)
            this.vm.memoryView.setInt32(vmCvarPtr + 4, 0, true); // modificationCount
            this.vm.memoryView.setFloat32(vmCvarPtr + 8, cvar.value, true);
            this.vm.memoryView.setInt32(vmCvarPtr + 12, cvar.integer, true);
            this.vm.writeString(vmCvarPtr + 16, cvar.string, 256);
        }
        
        return 0;
    }
    
    /**
     * trap_Cvar_Update - обновление значения cvar
     */
    trap_Cvar_Update(vmCvarPtr) {
        // В нашей реализации cvars не изменяются динамически
        return 0;
    }
    
    /**
     * trap_Cvar_Set - установка значения cvar
     */
    trap_Cvar_Set(varNamePtr, valuePtr) {
        if (!this.vm) return;
        
        const varName = this.vm.readString(varNamePtr);
        const value = this.vm.readString(valuePtr);
        
        if (this.cvars.has(varName)) {
            const cvar = this.cvars.get(varName);
            cvar.string = value;
            cvar.value = parseFloat(value) || 0;
            cvar.integer = parseInt(value) || 0;
        }
        
        return 0;
    }
    
    /**
     * trap_Cvar_VariableStringBuffer - получение значения cvar
     */
    trap_Cvar_VariableStringBuffer(varNamePtr, bufferPtr, bufferSize) {
        if (!this.vm) return;
        
        const varName = this.vm.readString(varNamePtr);
        const cvar = this.cvars.get(varName);
        
        if (cvar) {
            this.vm.writeString(bufferPtr, cvar.string, bufferSize);
        } else {
            this.vm.writeString(bufferPtr, '', bufferSize);
        }
        
        return 0;
    }
    
    /**
     * trap_R_RegisterShader - регистрация шейдера
     */
    trap_R_RegisterShader(namePtr) {
        if (!this.vm) return 0;
        
        const name = this.vm.readString(namePtr);
        
        // Проверяем, не зарегистрирован ли уже
        for (const [handle, shaderName] of this.shaders) {
            if (shaderName === name) return handle;
        }
        
        // Регистрируем новый
        const handle = this.nextShaderHandle++;
        this.shaders.set(handle, name);
        
        return handle;
    }
    
    /**
     * trap_R_RegisterModel - регистрация модели
     */
    trap_R_RegisterModel(namePtr) {
        if (!this.vm) return 0;
        
        const name = this.vm.readString(namePtr);
        
        for (const [handle, modelName] of this.models) {
            if (modelName === name) return handle;
        }
        
        const handle = this.nextModelHandle++;
        this.models.set(handle, name);
        
        return handle;
    }
    
    /**
     * trap_R_RegisterSkin - регистрация скина
     */
    trap_R_RegisterSkin(namePtr) {
        if (!this.vm) return 0;
        
        const name = this.vm.readString(namePtr);
        
        for (const [handle, skinName] of this.skins) {
            if (skinName === name) return handle;
        }
        
        const handle = this.nextSkinHandle++;
        this.skins.set(handle, name);
        
        return handle;
    }
    
    /**
     * trap_R_SetColor - установка цвета для рендеринга
     */
    trap_R_SetColor(colorPtr) {
        if (!this.vm) return;
        
        if (colorPtr === 0) {
            // NULL = белый цвет
            this.currentColor = [1, 1, 1, 1];
        } else {
            // Читаем 4 float (RGBA)
            this.currentColor = [
                this.vm.memoryView.getFloat32(colorPtr, true),
                this.vm.memoryView.getFloat32(colorPtr + 4, true),
                this.vm.memoryView.getFloat32(colorPtr + 8, true),
                this.vm.memoryView.getFloat32(colorPtr + 12, true)
            ];
        }
        
        // Применяем к canvas context
        const [r, g, b, a] = this.currentColor;
        this.ctx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
        this.ctx.strokeStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
        
        return 0;
    }
    
    /**
     * trap_R_DrawStretchPic - рисование картинки
     */
    trap_R_DrawStretchPic(x, y, w, h, s1, t1, s2, t2, shaderHandle) {
        // Конвертируем float координаты
        const fx = this.vm.intToFloat(x);
        const fy = this.vm.intToFloat(y);
        const fw = this.vm.intToFloat(w);
        const fh = this.vm.intToFloat(h);
        
        // Рисуем прямоугольник с текущим цветом
        this.ctx.fillRect(fx, fy, fw, fh);
        
        return 0;
    }
    
    /**
     * trap_R_ClearScene - очистка сцены
     */
    trap_R_ClearScene() {
        // Очищаем canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return 0;
    }
    
    /**
     * trap_R_RenderScene - рендеринг сцены
     */
    trap_R_RenderScene(refdefPtr) {
        // В минимальной реализации просто возвращаем успех
        return 0;
    }
    
    /**
     * trap_R_AddRefEntityToScene - добавление entity в сцену
     */
    trap_R_AddRefEntityToScene(refEntityPtr) {
        return 0;
    }
    
    /**
     * trap_S_RegisterSound - регистрация звука
     */
    trap_S_RegisterSound(namePtr, compressed) {
        if (!this.vm) return 0;
        
        const name = this.vm.readString(namePtr);
        
        for (const [handle, soundName] of this.sounds) {
            if (soundName === name) return handle;
        }
        
        const handle = this.nextSoundHandle++;
        this.sounds.set(handle, name);
        
        return handle;
    }
    
    /**
     * trap_S_StartSound - воспроизведение звука
     */
    trap_S_StartSound(origin, entityNum, entchannel, sfxHandle) {
        // Звук не реализован в базовой версии
        return 0;
    }
    
    /**
     * trap_S_StartLocalSound - локальный звук
     */
    trap_S_StartLocalSound(sfxHandle, channelNum) {
        return 0;
    }
    
    /**
     * Установка configstrings от сервера (вызывается при подключении клиента или обновлении)
     * Может быть как полным набором (все configstrings), так и частичным обновлением
     */
    setConfigStrings(configStringsMap) {
        // Обновляем все configstrings из переданной Map
        for (const [index, value] of configStringsMap) {
            this.configStrings.set(index, value);
        }
        
        const isInitialLoad = configStringsMap.size >= 10; // Полная загрузка если больше 10 элементов
        
        if (isInitialLoad) {
            console.log(`[Q3VM Syscalls] ═══════════════════════════════════`);
            console.log(`[Q3VM Syscalls] 🎯 ПОЛУЧЕНЫ CONFIGSTRINGS ОТ СЕРВЕРА!`);
            console.log(`[Q3VM Syscalls]   Количество: ${configStringsMap.size} configstrings`);
            
            // Проверяем критичные CS
            const cs0 = this.configStrings.get(0);  // SERVERINFO
            const cs1 = this.configStrings.get(1);  // SYSTEMINFO
            const cs20 = this.configStrings.get(20); // GAME_VERSION
            const cs21 = this.configStrings.get(21); // LEVEL_START_TIME
            
            console.log(`[Q3VM Syscalls]   CS0 (SERVERINFO): ${cs0 ? '✓' : '✗'} "${cs0 ? cs0.substring(0, 50) + '...' : '(пусто)'}"`);
            console.log(`[Q3VM Syscalls]   CS1 (SYSTEMINFO): ${cs1 ? '✓' : '✗'} "${cs1 || '(пусто)'}"`);
            console.log(`[Q3VM Syscalls]   CS20 (GAME_VERSION): ${cs20 ? '✓' : '✗'} "${cs20 || '(пусто)'}"`);
            console.log(`[Q3VM Syscalls]   CS21 (LEVEL_START_TIME): ${cs21 ? '✓' : '✗'} "${cs21 || '(пусто)'}"`);
            console.log(`[Q3VM Syscalls] ═══════════════════════════════════`);
        } else {
            console.log(`[Q3VM Syscalls] Обновлено ${configStringsMap.size} configstrings (всего: ${this.configStrings.size})`);
        }
        
        // Пересобираем gameState с новыми configstrings
        this.updateGameStateConfigStrings();
    }
    
    /**
     * Обновление конкретного configstring
     */
    setConfigString(index, value) {
        this.configStrings.set(index, value);
        this.updateGameStateConfigStrings();
    }
    
    /**
     * Получение configstring
     */
    getConfigString(index) {
        return this.configStrings.get(index) || '';
    }
    
    /**
     * Пересборка gameState с configstrings
     * Структура gameState_t (из q_shared.h):
     *   int dataCount;  // размер stringData в БАЙТАХ (не символах!)
     *   int stringOffsets[MAX_CONFIGSTRINGS];
     *   char stringData[MAX_GAMESTATE_CHARS];
     */
    updateGameStateConfigStrings() {
        // Не требуется VM для формирования gameState (VM нужен только для записи в память)
        const MAX_CONFIGSTRINGS = 1024;
        const MAX_GAMESTATE_CHARS = 16000; // Из q_shared.h: MAX_GAMESTATE_CHARS = 16000
        
        // Создаем буфер для stringData
        let stringData = '';
        const stringOffsets = new Array(MAX_CONFIGSTRINGS).fill(0);
        
        // Упаковываем все configstrings в stringData
        for (let i = 0; i < MAX_CONFIGSTRINGS; i++) {
            const value = this.configStrings.get(i) || '';
            stringOffsets[i] = stringData.length; // Смещение в символах (потом будет конвертировано в байты)
            stringData += value + '\0'; // Добавляем null-terminator
        }
        
        // Обрезаем если слишком длинно
        if (stringData.length > MAX_GAMESTATE_CHARS) {
            console.warn(`[Q3VM Syscalls] stringData слишком длинно (${stringData.length}), обрезаем до ${MAX_GAMESTATE_CHARS}`);
            stringData = stringData.substring(0, MAX_GAMESTATE_CHARS);
        }
        
        // Кодируем в байты для вычисления правильного размера
        const stringDataBytes = new TextEncoder().encode(stringData);
        
        // ВАЖНО: dataCount должен быть размером в БАЙТАХ, а не символах!
        // Также нужно пересчитать stringOffsets в байты
        const stringOffsetsBytes = new Array(MAX_CONFIGSTRINGS);
        let byteOffset = 0;
        
        // Пересчитываем offsets в байты
        for (let i = 0; i < MAX_CONFIGSTRINGS; i++) {
            const charOffset = stringOffsets[i];
            if (charOffset === 0 && i > 0 && stringOffsets[i-1] === 0) {
                // Пустой configstring - используем offset предыдущего
                stringOffsetsBytes[i] = stringOffsetsBytes[i-1] || 0;
            } else {
                // Кодируем подстроку до этого offset для получения байтового смещения
                const substring = stringData.substring(0, charOffset);
                stringOffsetsBytes[i] = new TextEncoder().encode(substring).length;
            }
        }
        
        // Сохраняем для trap_GetGameState
        this.gameState.dataCount = stringDataBytes.length; // Размер в байтах!
        this.gameState.stringData = stringData; // Оригинальная строка (для записи байтов)
        this.gameState.stringOffsets = stringOffsetsBytes; // Offsets в байтах!
        
        // Логируем важные configstrings только если их еще не было или они изменились
        // (чтобы не спамить в консоль)
        if (!this.lastLoggedCS || this.configStrings.size !== this.lastLoggedCS.size) {
            const importantCS = [0, 1, 20, 21, 22, 5]; // SERVERINFO, SYSTEMINFO, GAME_VERSION, LEVEL_START_TIME, INTERMISSION, WARMUP
            console.log(`[Q3VM Syscalls] GameState обновлен (${this.configStrings.size} configstrings):`);
            for (const cs of importantCS) {
                const value = this.configStrings.get(cs);
                if (value !== undefined && value !== '') {
                    console.log(`[Q3VM Syscalls]   CS${cs}: "${value.substring(0, 80)}${value.length > 80 ? '...' : ''}"`);
                }
            }
            this.lastLoggedCS = new Map(this.configStrings); // Сохраняем для сравнения
        }
    }
    
    /**
     * trap_GetGameState - получение игрового состояния
     * Структура gameState_t (из q_shared.h):
     *   int stringOffsets[MAX_CONFIGSTRINGS];  // первое поле!
     *   char stringData[MAX_GAMESTATE_CHARS];   // второе поле!
     *   int dataCount;                           // третье поле!
     */
    trap_GetGameState(gameStatePtr) {
        if (!this.vm) return;
        
        // ВАЖНО: Всегда обновляем gameState при вызове trap_GetGameState
        // Это нужно на случай, если configstrings пришли после первого вызова CG_Init
        // или если они обновились
        this.updateGameStateConfigStrings();
        
        // КРИТИЧНО: gameStatePtr приходит как VM адрес, нужно конвертировать в реальный!
        const realGameStatePtr = this.vm.vmAddrToReal ? this.vm.vmAddrToReal(gameStatePtr) : gameStatePtr;
        
        const MAX_CONFIGSTRINGS = 1024;
        const MAX_GAMESTATE_CHARS = 16000;
        
        let offset = 0;
        
        // 1. Записываем stringOffsets[1024] (первое поле в структуре!)
        for (let i = 0; i < MAX_CONFIGSTRINGS; i++) {
            this.vm.memoryView.setInt32(realGameStatePtr + offset, this.gameState.stringOffsets[i], true);
            offset += 4;
        }
        
        // 2. Записываем stringData (второе поле в структуре!)
        const stringDataPtr = realGameStatePtr + offset;
        const stringDataBytes = new TextEncoder().encode(this.gameState.stringData);
        
        // Записываем данные (максимум MAX_GAMESTATE_CHARS байт)
        const bytesToWrite = Math.min(stringDataBytes.length, MAX_GAMESTATE_CHARS);
        for (let i = 0; i < bytesToWrite; i++) {
            this.vm.memoryView.setUint8(stringDataPtr + i, stringDataBytes[i]);
        }
        
        // Заполняем остаток нулями (если нужно)
        if (bytesToWrite < MAX_GAMESTATE_CHARS) {
            this.vm.memoryView.setUint8(stringDataPtr + bytesToWrite, 0);
        }
        
        // 3. Записываем dataCount (третье поле в структуре!)
        offset += MAX_GAMESTATE_CHARS; // После stringData
        this.vm.memoryView.setInt32(realGameStatePtr + offset, this.gameState.dataCount, true);
        
        // Отладочное логирование для первого вызова
        if (!this.gameStateLogged) {
            console.log(`[Q3VM Syscalls] ═══════════════════════════════════`);
            console.log(`[Q3VM Syscalls] trap_GetGameState: структура записана в память`);
            console.log(`[Q3VM Syscalls]   gameStatePtr: VM=${gameStatePtr}, Real=${realGameStatePtr}`);
            console.log(`[Q3VM Syscalls]   stringOffsets[0..1023]: offset 0`);
            console.log(`[Q3VM Syscalls]   stringData[16000]: offset ${MAX_CONFIGSTRINGS * 4}`);
            console.log(`[Q3VM Syscalls]   dataCount: offset ${MAX_CONFIGSTRINGS * 4 + MAX_GAMESTATE_CHARS}`);
            console.log(`[Q3VM Syscalls]   Записано ${bytesToWrite} байт stringData (dataCount=${this.gameState.dataCount})`);
            console.log(`[Q3VM Syscalls]   CS20 offset в байтах=${this.gameState.stringOffsets[20]}`);
            
            // Проверяем что CS20 указывает на правильное место
            if (this.gameState.stringOffsets[20] >= 0 && this.gameState.stringOffsets[20] < bytesToWrite) {
                const cs20Start = this.gameState.stringOffsets[20];
                // Читаем до null-terminator или до конца буфера
                let cs20Length = 0;
                for (let i = cs20Start; i < bytesToWrite; i++) {
                    if (stringDataBytes[i] === 0) break;
                    cs20Length++;
                }
                const cs20Bytes = stringDataBytes.slice(cs20Start, cs20Start + cs20Length);
                const cs20String = new TextDecoder().decode(cs20Bytes);
                console.log(`[Q3VM Syscalls]   CS20 по адресу stringData+${cs20Start}: "${cs20String}" (${cs20Length} байт)`);
                
                // Дополнительная проверка: читаем напрямую из памяти QVM
                // stringDataPtr это реальный адрес в WASM памяти, но QVM использует VM адреса
                // Проверяем что данные действительно записаны в память
                if (this.vm.HEAPU8) {
                    const cs20RealAddr = stringDataPtr + cs20Start;
                    if (cs20RealAddr >= 0 && cs20RealAddr + cs20Length < this.vm.HEAPU8.length) {
                        let cs20Check = '';
                        for (let i = 0; i < cs20Length && cs20RealAddr + i < this.vm.HEAPU8.length; i++) {
                            const byte = this.vm.HEAPU8[cs20RealAddr + i];
                            if (byte === 0) break;
                            cs20Check += String.fromCharCode(byte);
                        }
                        console.log(`[Q3VM Syscalls]   CS20 из WASM памяти (realAddr=${cs20RealAddr}): "${cs20Check}"`);
                    } else {
                        console.error(`[Q3VM Syscalls]   ⚠️ CS20 адрес вне диапазона: ${cs20RealAddr} (HEAPU8.length=${this.vm.HEAPU8.length})`);
                    }
                    
                    // Проверяем что gameState правильно записан - читаем dataCount
                    const dataCountOffset = MAX_CONFIGSTRINGS * 4 + MAX_GAMESTATE_CHARS;
                    const dataCountInMemory = this.vm.memoryView.getInt32(realGameStatePtr + dataCountOffset, true);
                    console.log(`[Q3VM Syscalls]   dataCount из памяти QVM: ${dataCountInMemory} (ожидается ${this.gameState.dataCount})`);
                    
                    // Проверяем stringOffsets[20] из памяти
                    const cs20OffsetInMemory = this.vm.memoryView.getInt32(realGameStatePtr + 20 * 4, true);
                    console.log(`[Q3VM Syscalls]   stringOffsets[20] из памяти QVM: ${cs20OffsetInMemory} (ожидается ${this.gameState.stringOffsets[20]})`);
                }
            }
            console.log(`[Q3VM Syscalls] ═══════════════════════════════════`);
            this.gameStateLogged = true;
        }
        
        return 0;
    }
    
    /**
     * trap_GetCurrentSnapshotNumber - получение номера текущего снапшота
     */
    trap_GetCurrentSnapshotNumber(snapshotNumberPtr, serverTimePtr) {
        if (!this.vm) return;
        
        const currentTime = this.trap_Milliseconds();
        
        // НЕ инкрементируем автоматически! Только при добавлении команды в addServerCommand()
        if (!this.lastSnapshotTime) {
            this.lastSnapshotTime = currentTime;
            this.lastReturnedSnapshotNumber = this.currentSnapshotNumber;
            console.log(`[QVM SYSCALL] 🎬 trap_GetCurrentSnapshotNumber() первый вызов, returning snapshotNum=${this.currentSnapshotNumber}`);
        }
        
        // ВАЖНО: Записываем в память QVM
        this.vm.memoryView.setInt32(snapshotNumberPtr, this.currentSnapshotNumber, true);
        this.vm.memoryView.setInt32(serverTimePtr, currentTime, true);
        
        // Отладка: логируем если номер снапшота изменился
        if (this.lastReturnedSnapshotNumber !== this.currentSnapshotNumber) {
            console.log(`[QVM SYSCALL] 📊 trap_GetCurrentSnapshotNumber() → ${this.currentSnapshotNumber} (было ${this.lastReturnedSnapshotNumber})`);
            this.lastReturnedSnapshotNumber = this.currentSnapshotNumber;
        }
        
        return 0;
    }
    
    /**
     * trap_GetSnapshot - получение снапшота
     */
    trap_GetSnapshot(snapshotNumber, snapshotPtr) {
        if (!this.vm) return 0;
        
        // Используем снапшот от сервера если доступен
        const serverSnapshot = this.lastServerSnapshot;
        const currentTime = serverSnapshot ? serverSnapshot.serverTime : this.trap_Milliseconds();
        
        // ВСЕГДА логируем чтобы видеть вызывается ли вообще
        console.log(`[QVM SYSCALL] 🎯 trap_GetSnapshot(${snapshotNumber}) запрошен QVM, seq=${serverSnapshot?.serverCommandSequence || this.serverCommandSequence}, serverTime=${currentTime}ms`);
        
        // Обновляем playerState из снапшота если доступен
        if (serverSnapshot && serverSnapshot.players && serverSnapshot.players.has(this.playerState.clientNum)) {
            const playerData = serverSnapshot.players.get(this.playerState.clientNum);
            if (playerData) {
                // Обновляем здоровье, броню, оружие из снапшота
                if (playerData.health !== undefined) this.playerState.health = playerData.health;
                if (playerData.armor !== undefined) this.playerState.armor = playerData.armor;
                if (playerData.weapon !== undefined) this.playerState.weapon = playerData.weapon;
                if (playerData.origin) {
                    this.playerState.origin = [...playerData.origin];
                }
            }
        }
        
        // Записываем snapshot_t структуру в память VM
        this.playerState.commandTime = currentTime;
        
        let offset = snapshotPtr;
        
        // snapshot_t структура (ПРАВИЛЬНАЯ):
        // int snapFlags
        this.vm.memoryView.setInt32(offset, 1, true);
        offset += 4;
        
        // int ping
        this.vm.memoryView.setInt32(offset, 0, true);
        offset += 4;
        
        // int serverTime (используем serverTime из снапшота сервера)
        const snapshotServerTime = serverSnapshot ? serverSnapshot.serverTime : currentTime;
        this.vm.memoryView.setInt32(offset, snapshotServerTime, true);
        offset += 4;
        
        // byte areamask[MAX_MAP_AREA_BYTES] = 32 байта - ВАЖНО НЕ ПРОПУСКАТЬ!
        for (let i = 0; i < 32; i++) {
            this.vm.memoryView.setUint8(offset + i, 0);
        }
        offset += 32;
        
        // playerState_t начинается здесь (offset = 12 + 32 = 44)
        // commandTime
        this.vm.memoryView.setInt32(offset, currentTime, true);
        offset += 4;
        
        // pm_type, pm_flags, pm_time (пропускаем для простоты)
        offset += 12;
        
        // origin[3] - позиция игрока (float[3])
        this.vm.memoryView.setFloat32(offset, this.playerState.origin[0], true);
        this.vm.memoryView.setFloat32(offset + 4, this.playerState.origin[1], true);
        this.vm.memoryView.setFloat32(offset + 8, this.playerState.origin[2], true);
        offset += 12;
        
        // velocity[3] (пропускаем)
        offset += 12;
        
        // weaponTime, gravity, speed (пропускаем)
        offset += 12;
        
        // delta_angles[3] (пропускаем)
        offset += 12;
        
        // groundEntityNum (пропускаем)
        offset += 4;
        
        // legsTimer, legsAnim, torsoTimer, torsoAnim (пропускаем)
        offset += 16;
        
        // movementDir, grapplePoint (пропускаем)
        offset += 16;
        
        // eFlags, eventSequence, events[2], eventParms[2] (пропускаем)
        offset += 24;
        
        // externalEvent, externalEventParm, externalEventTime (пропускаем)
        offset += 12;
        
        // clientNum
        this.vm.memoryView.setInt32(offset, this.playerState.clientNum, true);
        offset += 4;
        
        // weapon
        this.vm.memoryView.setInt32(offset, this.playerState.weapon, true);
        offset += 4;
        
        // weaponstate (пропускаем)
        offset += 4;
        
        // viewangles[3] (пропускаем для простоты)
        offset += 12;
        
        // viewheight (пропускаем)
        offset += 4;
        
        // damageEvent, damageYaw, damagePitch, damageCount (пропускаем)
        offset += 16;
        
        // stats[16] - САМОЕ ВАЖНОЕ для HUD!
        // STAT_HEALTH = 0
        this.vm.memoryView.setInt32(offset, this.playerState.health, true);
        // STAT_ARMOR = 8
        this.vm.memoryView.setInt32(offset + 32, this.playerState.armor, true);
        // STAT_WEAPONS = 2
        this.vm.memoryView.setInt32(offset + 8, this.playerState.weaponFlags, true);
        offset += 64; // 16 * 4 bytes
        
        // persistant[16] (пропускаем)
        offset += 64;
        
        // powerups[16] (пропускаем)
        offset += 64;
        
        // ammo[16]
        for (let i = 0; i < 10; i++) {
            this.vm.memoryView.setInt32(offset + i * 4, this.playerState.ammo[i] || 0, true);
        }
        offset += 64;
        
        // generic1 (пропускаем)
        offset += 4;
        
        // loopSound (пропускаем)
        offset += 4;
        
        // jumppad_ent (пропускаем)
        offset += 4;
        
        // playerState_t ЗАКОНЧЕН (примерно 472 байта от начала ps)
        
        // Теперь идем НАЗАД к началу snapshot_t и правильно записываем serverCommandSequence
        // snapshot_t имеет следующую структуру:
        // - snapFlags (4 bytes)     offset 0
        // - ping (4 bytes)          offset 4
        // - serverTime (4 bytes)    offset 8
        // - areamask[32] (32 bytes) offset 12
        // - ps (playerState_t ~472) offset 44
        // - numEntities (4)         offset ~516
        // - entities[256] (~21000)  offset ~520
        // - numServerCommands (4)   offset ~21520
        // - serverCommandSequence   offset ~21524
        
        // Сохраняем начало снапшота
        const snapshotStart = snapshotPtr;
        
        // Переходим в КОНЕЦ структуры (пропускаем все entities)
        // sizeof(playerState_t) = ~472, sizeof(entityState_t) ~= 84, count = 256
        // Но на практике engines могут быть пустыми, так что просто идем к концу
        const psOffset = 44; // snapFlags + ping + serverTime + areamask
        const psSize = 472;   // примерный размер playerState_t
        const numEntitiesOffset = psOffset + psSize;
        const entitiesSize = 256 * 84; // 256 entities * ~84 байта каждый
        const serverCommandsOffset = numEntitiesOffset + 4 + entitiesSize;
        
        // Записываем numServerCommands и serverCommandSequence В КОНЕЦ
        // Используем данные из серверного снапшота если доступны
        const commandSeq = serverSnapshot?.serverCommandSequence || this.serverCommandSequence;
        
        this.vm.memoryView.setInt32(snapshotStart + serverCommandsOffset, this.serverCommands.length, true);
        this.vm.memoryView.setInt32(snapshotStart + serverCommandsOffset + 4, commandSeq, true);
        
        // ОТЛАДКА: Проверяем что записали
        if (commandSeq > 0) {
            const writtenSeq = this.vm.memoryView.getInt32(snapshotStart + serverCommandsOffset + 4, true);
            console.log(`[QVM SYSCALL] 📝 Записан serverCommandSequence=${writtenSeq} в снапшот (из ${serverSnapshot ? 'сервера' : 'локально'})`);
        }
        
        return 1; // Успех
    }
    
    /**
     * trap_GetServerCommand - получение команды сервера
     */
    trap_GetServerCommand(serverCommandNumber) {
        // ВСЕГДА логируем этот вызов чтобы видеть запрашивает ли QVM команды
        console.log(`[QVM SYSCALL] 🔍 trap_GetServerCommand(${serverCommandNumber}) вызван! Есть команд: ${this.serverCommands.length}, последняя seq=${this.serverCommandSequence}`);
        
        // Ищем команду с указанным sequence
        const command = this.serverCommands.find(cmd => cmd.sequence === serverCommandNumber);
        
        if (command) {
            // Устанавливаем как текущую команду для Argc/Argv
            this.currentCommand = command;
            console.log(`[QVM SYSCALL] ✅ Команда найдена: "${command.commandString}"`);
            
            // Выводим в Q3 Console для наглядности
            if (window.q3Print) {
                const cmdPreview = command.commandString.length > 60 
                    ? command.commandString.substring(0, 60) + '...' 
                    : command.commandString;
                window.q3Print(`[QVM] → Обработка: ${cmdPreview}`);
            }
            
            return 1; // qtrue - команда найдена
        }
        
        console.log(`[QVM SYSCALL] ❌ Команда #${serverCommandNumber} не найдена в очереди`);
        return 0; // qfalse - команда не найдена
    }
    
    /**
     * addServerCommand - добавление серверной команды (вызывается извне)
     */
    addServerCommand(commandString) {
        this.serverCommandSequence++;
        
        const command = {
            sequence: this.serverCommandSequence,
            commandString: commandString,
            args: commandString.split(' ')
        };
        
        this.serverCommands.push(command);
        
        // Ограничиваем размер истории
        if (this.serverCommands.length > 128) {
            this.serverCommands.shift();
        }
        
        console.log(`[QVM] 📥 Получена серверная команда #${command.sequence}: ${commandString.substring(0, 80)}...`);
        
        if (window.q3Print) {
            window.q3Print(`[QVM] → Команда #${command.sequence} добавлена`);
        }
        
        return command.sequence;
    }
    
    /**
     * trap_SendConsoleCommand - отправка команды в консоль
     */
    trap_SendConsoleCommand(textPtr) {
        if (!this.vm) return;
        const text = this.vm.readString(textPtr);
        // Не логируем пустые команды
        if (text && text.trim()) {
            console.log(`[Console Command] ${text}`);
        }
        return 0;
    }
    
    /**
     * trap_AddCommand - добавление команды
     */
    trap_AddCommand(cmdNamePtr) {
        if (!this.vm) return;
        const cmdName = this.vm.readString(cmdNamePtr);
        this.commands.set(cmdName, true);
        return 0;
    }
    
    /**
     * trap_UpdateScreen - обновление экрана
     */
    trap_UpdateScreen() {
        return 0;
    }
    
    /**
     * trap_RealTime - реальное время
     */
    trap_RealTime(qTimePtr) {
        if (!this.vm) return 0;
        
        const now = new Date();
        
        // qtime_t структура (из q_shared.h):
        // typedef struct {
        //     int tm_sec;     /* seconds after the minute - [0,59] */
        //     int tm_min;     /* minutes after the hour - [0,59] */
        //     int tm_hour;    /* hours since midnight - [0,23] */
        //     int tm_mday;    /* day of the month - [1,31] */
        //     int tm_mon;     /* months since January - [0,11] */
        //     int tm_year;    /* years since 1900 */
        //     int tm_wday;    /* days since Sunday - [0,6] */
        //     int tm_yday;    /* days since January 1 - [0,365] */
        //     int tm_isdst;   /* daylight savings time flag */
        // } qtime_t;
        
        let offset = qTimePtr;
        
        // tm_sec (0-59)
        this.vm.memoryView.setInt32(offset, now.getSeconds(), true);
        offset += 4;
        
        // tm_min (0-59)
        this.vm.memoryView.setInt32(offset, now.getMinutes(), true);
        offset += 4;
        
        // tm_hour (0-23)
        this.vm.memoryView.setInt32(offset, now.getHours(), true);
        offset += 4;
        
        // tm_mday (1-31)
        this.vm.memoryView.setInt32(offset, now.getDate(), true);
        offset += 4;
        
        // tm_mon (0-11)
        this.vm.memoryView.setInt32(offset, now.getMonth(), true);
        offset += 4;
        
        // tm_year (years since 1900)
        this.vm.memoryView.setInt32(offset, now.getFullYear() - 1900, true);
        offset += 4;
        
        // tm_wday (0-6, Sunday = 0)
        this.vm.memoryView.setInt32(offset, now.getDay(), true);
        offset += 4;
        
        // tm_yday (0-365, день в году)
        const startOfYear = new Date(now.getFullYear(), 0, 0);
        const diff = now - startOfYear;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);
        this.vm.memoryView.setInt32(offset, dayOfYear, true);
        offset += 4;
        
        // tm_isdst (Daylight Saving Time flag)
        // Простая проверка: если в текущей временной зоне время отличается от UTC больше чем зимой
        const isDST = 0; // Упрощенно, можно улучшить
        this.vm.memoryView.setInt32(offset, isDST, true);
        
        // Возвращаем время в секундах с 1970 (UNIX epoch)
        return Math.floor(now.getTime() / 1000);
    }
    
    /**
     * trap_MemoryRemaining - оставшаяся память
     */
    trap_MemoryRemaining() {
        return 16 * 1024 * 1024; // 16MB
    }
    
    // ============================================================
    // ДОПОЛНИТЕЛЬНЫЕ SYSCALLS (stub implementations)
    // ============================================================
    
    /**
     * trap_Argc - количество аргументов команды
     */
    trap_Argc() {
        if (this.currentCommand && this.currentCommand.args) {
            const argc = this.currentCommand.args.length;
            console.log(`[QVM SYSCALL] Argc() → ${argc}`);
            return argc;
        }
        return 0;
    }
    
    /**
     * trap_Argv - получение аргумента команды
     */
    trap_Argv(n, bufferPtr, bufferLength) {
        if (!this.vm) return;
        
        if (this.currentCommand && this.currentCommand.args && this.currentCommand.args[n]) {
            const argValue = this.currentCommand.args[n];
            this.vm.writeString(bufferPtr, argValue, bufferLength);
            console.log(`[QVM SYSCALL] Argv(${n}) → "${argValue}"`);
            return;
        }
        
        this.vm.writeString(bufferPtr, '', bufferLength);
    }
    
    /**
     * trap_Args - получение всех аргументов команды
     */
    trap_Args(bufferPtr, bufferLength) {
        if (!this.vm) return;
        
        if (this.currentCommand && this.currentCommand.args) {
            // Все аргументы кроме первого (имя команды)
            const argsString = this.currentCommand.args.slice(1).join(' ');
            this.vm.writeString(bufferPtr, argsString, bufferLength);
            return;
        }
        
        this.vm.writeString(bufferPtr, '', bufferLength);
    }
    
    /**
     * trap_FS_FOpenFile - открытие файла
     * 
     * ВАЖНО: Это синхронная функция, но файлы должны быть предзагружены
     * используя preloadFile() перед открытием
     */
    trap_FS_FOpenFile(pathPtr, fileHandlePtr, mode) {
        if (!this.vm) return -1;
        
        // Читаем строку из памяти VM используя правильное преобразование адреса
        // как в Q3VM: VM_ArgPtr возвращает (vm->dataBase + (vmAddr & vm->dataMask))
        const realAddr = this.vm.vmAddrToReal ? this.vm.vmAddrToReal(pathPtr) : pathPtr;
        let path = '';
        
        // Читаем строку напрямую из памяти, проверяя валидность адреса
        if (realAddr > 0 && realAddr < (this.vm.HEAPU8?.length || 0x10000000)) {
            const maxLen = 256; // MAX_QPATH = 64, но можем читать больше для диагностики
            const bytes = [];
            for (let i = 0; i < maxLen; i++) {
                try {
                    const byte = this.vm.HEAPU8[realAddr + i];
                    if (byte === 0) break; // null terminator
                    bytes.push(byte);
                } catch (e) {
                    break;
                }
            }
            path = String.fromCharCode(...bytes);
        } else {
            // Если адрес невалидный, пробуем через readString
            path = this.vm.readString(pathPtr);
        }
        
        // Диагностика: если строка содержит непечатные символы, логируем детали
        const isInvalid = path && path.length > 0 && /[^\x20-\x7E]/.test(path);
        if (isInvalid) {
            // Показываем что находится в памяти по адресу pathPtr
            console.log(`[FS DEBUG] pathPtr=0x${pathPtr.toString(16)}, realAddr=0x${realAddr.toString(16)}, path="${path}"`);
            
            // Если первые 3 байта похожи на часть указателя (little-endian), 
            // проверяем может ли это быть указатель на строку
            const first4Bytes = this.vm.HEAPU8[realAddr] | 
                               (this.vm.HEAPU8[realAddr + 1] << 8) | 
                               (this.vm.HEAPU8[realAddr + 2] << 16) | 
                               (this.vm.HEAPU8[realAddr + 3] << 24);
            
            console.log(`[FS DEBUG] Первые 4 байта как int32 (little-endian): 0x${first4Bytes.toString(16)} = ${first4Bytes}`);
            
            // Если локальная переменная path[MAX_QPATH] перезаписана, она уже потеряна
            // Но параметр filename ("chatfilter") может быть доступен в стековом фрейме функции
            // Ищем строковый литерал "chatfilter" который передается как параметр функции CG_ChatfilterLoadFile
            // Строковые литералы обычно хранятся в секции литералов (.lit), но указатель на них в стеке
            const searchRadius = 1024; // Ищем в большем радиусе на случай большого стекового фрейма
            const searchStart = Math.max(0, realAddr - searchRadius);
            const searchEnd = Math.min(this.vm.HEAPU8?.length || 0x10000000, realAddr + searchRadius);
            
            // Ищем строку "chatfilter" (параметр filename)
            // Если найдем её в стеке, можем восстановить путь как "chatfilter.txt"
            const filenamePattern = new TextEncoder().encode("chatfilter");
            
            for (let addr = searchStart; addr + filenamePattern.length <= searchEnd; addr++) {
                let match = true;
                for (let i = 0; i < filenamePattern.length; i++) {
                    try {
                        if (this.vm.HEAPU8[addr + i] !== filenamePattern[i]) {
                            match = false;
                            break;
                        }
                    } catch (e) {
                        match = false;
                        break;
                    }
                }
                
                if (match) {
                    // Проверяем что это null-terminated строка
                    try {
                        const nullByte = this.vm.HEAPU8[addr + filenamePattern.length];
                        if (nullByte === 0) {
                            // Проверяем что это действительно "chatfilter" (не часть другой строки)
                            const prevByte = addr > 0 ? this.vm.HEAPU8[addr - 1] : 0;
                            // Предыдущий байт должен быть непечатным (начало строки или указатель)
                            if (prevByte < 0x20 || prevByte > 0x7E) {
                                const vmAddr = this.vm.realAddrToVM ? this.vm.realAddrToVM(addr) : addr;
                                console.log(`[FS DEBUG] ✓ Найден параметр filename="chatfilter" в стеке: real=0x${addr.toString(16)}, VM=0x${vmAddr.toString(16)}, offset от pathPtr=${addr - realAddr}`);
                                console.log(`[FS DEBUG] ✓ Восстанавливаем путь: "chatfilter" + ".txt" = "chatfilter.txt"`);
                                path = "chatfilter.txt";
                                break;
                            }
                        }
                    } catch (e) {
                        // Продолжаем поиск
                    }
                }
            }
            
            // Проверяем может ли первые 4 байта быть указателем на строку
            // (проверяем только если еще не нашли путь через поиск filename)
            const originalPath = path; // Сохраняем исходное мусорное значение для проверки
            if (isInvalid && first4Bytes > 0 && first4Bytes < 0x10000000) {
                const possibleRealAddr = this.vm.vmAddrToReal ? this.vm.vmAddrToReal(first4Bytes) : first4Bytes;
                if (possibleRealAddr > 0 && possibleRealAddr < (this.vm.HEAPU8?.length || 0x10000000)) {
                    // Пробуем прочитать строку по этому адресу
                    let possiblePath = '';
                    for (let i = 0; i < 256; i++) {
                        try {
                            const byte = this.vm.HEAPU8[possibleRealAddr + i];
                            if (byte === 0) break;
                            if (byte < 0x20 || byte > 0x7E) {
                                possiblePath = '';
                                break; // Не строка
                            }
                            possiblePath += String.fromCharCode(byte);
                        } catch (e) {
                            break;
                        }
                    }
                    
                    if (possiblePath && possiblePath.length > 0 && /^[\x20-\x7E]+$/.test(possiblePath)) {
                        console.log(`[FS DEBUG] ✓ Найдена строка по указателю: VM=0x${first4Bytes.toString(16)}, real=0x${possibleRealAddr.toString(16)}, path="${possiblePath}"`);
                        path = possiblePath;
                    }
                }
            }
            
            // Показываем дамп памяти вокруг realAddr (первые 64 байта)
            let memoryDump = '';
            for (let i = 0; i < 64; i++) {
                try {
                    const byte = this.vm.HEAPU8[realAddr + i];
                    memoryDump += '0x' + byte.toString(16).padStart(2, '0') + ' ';
                } catch (e) {
                    break;
                }
            }
            console.log(`[FS DEBUG] Memory dump around realAddr: ${memoryDump}`);
        }
        
        if (!path || !path.trim()) {
            // Пустой путь - устанавливаем handle в 0
            if (fileHandlePtr) {
                this.vm.memoryView.setInt32(fileHandlePtr, 0, true);
            }
            return -1;
        }
        
        // Проверка на валидность имени файла (фильтруем мусорные строки)
        // Мусорные строки содержат непечатные символы или неправильную кодировку
        const hasInvalidChars = /[^\x20-\x7E\/\\\.\_\-]/.test(path);
        if (hasInvalidChars && path.length < 3) {
            // Скорее всего мусор - тихо возвращаем -1
            if (fileHandlePtr) {
                this.vm.memoryView.setInt32(fileHandlePtr, 0, true);
            }
            return -1;
        }
        
        // Ищем файл в кеше предзагруженных файлов
        const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
        
        // Заглушки для font файлов и других некритичных файлов
        // Просто возвращаем -1 (файл не найден) чтобы QVM их пропустил
        // НО: не блокируем chatfilter - пусть ищет, может файл есть в PK3
        if (normalizedPath.includes('.fontdat') || 
            normalizedPath.includes('fonts/')) {
            if (fileHandlePtr) {
                this.vm.memoryView.setInt32(fileHandlePtr, 0, true);
            }
            return -1;
        }
        
        // Ищем в загруженных PK3 архивах (синхронно из кеша)
        for (let i = this.vfs.pk3Archives.length - 1; i >= 0; i--) {
            const archive = this.vfs.pk3Archives[i];
            
            // Проверяем есть ли файл в кеше архива
            if (archive.cache && archive.cache.has(normalizedPath)) {
                const data = archive.cache.get(normalizedPath);
                
                // Создаем новый file handle
                const fileHandle = this.vfs.nextFileHandle++;
                this.vfs.openFiles.set(fileHandle, {
                    data: data,
                    position: 0,
                    size: data.length,
                    path: normalizedPath
                });
                
                // Записываем file handle в память VM
                if (fileHandlePtr) {
                    this.vm.memoryView.setInt32(fileHandlePtr, fileHandle, true);
                }
                
                console.log(`[FS] Открыт файл: ${normalizedPath} (handle=${fileHandle}, size=${data.length})`);
                return data.length; // Возвращаем размер файла
            }
        }
        
        // Файл не найден - ВАЖНО: устанавливаем handle в 0 чтобы избежать чтения из мусора
        if (fileHandlePtr) {
            this.vm.memoryView.setInt32(fileHandlePtr, 0, true);
        }
        
        // Логируем только важные файлы (не .map файлы символов, не мусорные строки, не chatfilter)
        const isValidPath = path && path.trim() && 
                           !path.endsWith('.map') && 
                           !normalizedPath.includes('chatfilter') &&
                           /^[\x20-\x7E\/\\\.\_\-]+$/.test(path);
        if (isValidPath) {
            console.log(`[FS] Файл не найден: ${normalizedPath}`);
        }
        
        return -1;
    }
    
    /**
     * trap_FS_Read - чтение из файла
     */
    trap_FS_Read(bufferPtr, len, fileHandleOrPtr) {
        if (!this.vm) return 0;
        
        // ИСПРАВЛЕНИЕ: fileHandle может быть УКАЗАТЕЛЕМ на handle (в OSP2-BE)
        // Если значение большое (>100), это скорее всего указатель
        let fileHandle = fileHandleOrPtr;
        
        if (fileHandleOrPtr > 100) {
            // Читаем реальный handle из памяти
            fileHandle = this.vm.memoryView.getInt32(fileHandleOrPtr, true);
            console.log(`[FS DEBUG] Прочитан handle=${fileHandle} из указателя ${fileHandleOrPtr}`);
        }
        
        // Handle 0 означает что файл не был открыт (валидный случай)
        if (fileHandle === 0) {
            return 0;
        }
        
        const file = this.vfs.openFiles.get(fileHandle);
        if (!file) {
            console.warn(`[FS] Недопустимый handle: ${fileHandle} (из ${fileHandleOrPtr})`);
            return 0;
        }
        
        // Вычисляем сколько байт можем прочитать
        const bytesAvailable = file.size - file.position;
        const bytesToRead = Math.min(len, bytesAvailable);
        
        if (bytesToRead <= 0) {
            return 0; // Достигнут конец файла
        }
        
        // Копируем данные в память VM
        for (let i = 0; i < bytesToRead; i++) {
            this.vm.memoryView.setUint8(bufferPtr + i, file.data[file.position + i]);
        }
        
        file.position += bytesToRead;
        
        return bytesToRead;
    }
    
    /**
     * trap_FS_Write - запись в файл
     */
    trap_FS_Write(bufferPtr, len, fileHandleOrPtr) {
        // ИСПРАВЛЕНИЕ: может быть указателем на handle
        let fileHandle = fileHandleOrPtr;
        
        if (fileHandleOrPtr > 100) {
            fileHandle = this.vm.memoryView.getInt32(fileHandleOrPtr, true);
        }
        
        // Запись не поддерживается в read-only файловой системе
        return 0;
    }
    
    /**
     * trap_FS_FCloseFile - закрытие файла
     */
    trap_FS_FCloseFile(fileHandleOrPtr) {
        // ИСПРАВЛЕНИЕ: может быть указателем на handle (как в trap_FS_Read)
        let fileHandle = fileHandleOrPtr;
        
        if (fileHandleOrPtr > 100) {
            // Читаем реальный handle из памяти
            fileHandle = this.vm.memoryView.getInt32(fileHandleOrPtr, true);
        }
        
        const file = this.vfs.openFiles.get(fileHandle);
        if (file) {
            console.log(`[FS] Закрыт файл: ${file.path} (handle=${fileHandle})`);
            this.vfs.openFiles.delete(fileHandle);
        }
        return 0;
    }
    
    /**
     * trap_FS_Seek - перемещение в файле
     */
    trap_FS_Seek(fileHandleOrPtr, offset, origin) {
        // ИСПРАВЛЕНИЕ: может быть указателем на handle
        let fileHandle = fileHandleOrPtr;
        
        if (fileHandleOrPtr > 100) {
            fileHandle = this.vm.memoryView.getInt32(fileHandleOrPtr, true);
        }
        
        const file = this.vfs.openFiles.get(fileHandle);
        if (!file) {
            return -1;
        }
        
        // origin: 0=SEEK_SET, 1=SEEK_CUR, 2=SEEK_END
        let newPosition = 0;
        switch (origin) {
            case 0: // SEEK_SET
                newPosition = offset;
                break;
            case 1: // SEEK_CUR
                newPosition = file.position + offset;
                break;
            case 2: // SEEK_END
                newPosition = file.size + offset;
                break;
            default:
                return -1;
        }
        
        // Проверяем границы
        if (newPosition < 0 || newPosition > file.size) {
            return -1;
        }
        
        file.position = newPosition;
        return 0;
    }
    
    /**
     * Предзагрузка файла в кеш для синхронного доступа
     * Нужно вызывать перед использованием trap_FS_FOpenFile
     */
    async preloadFile(path) {
        const data = await this.findFileInPK3(path);
        if (data) {
            const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
            
            // Находим архив который содержит этот файл и кешируем в нем
            for (let i = this.vfs.pk3Archives.length - 1; i >= 0; i--) {
                const archive = this.vfs.pk3Archives[i];
                const file = archive.zip.file(normalizedPath);
                
                if (file) {
                    if (!archive.cache) {
                        archive.cache = new Map();
                    }
                    archive.cache.set(normalizedPath, data);
                    console.log(`[VFS] Предзагружен файл: ${normalizedPath} (${data.length} байт)`);
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * Предзагрузка всех файлов определенного типа (например, всех .bsp карт)
     */
    async preloadFilesByPattern(pattern) {
        const regex = new RegExp(pattern);
        const preloadedFiles = [];
        
        for (const archive of this.vfs.pk3Archives) {
            archive.zip.forEach(async (relativePath, file) => {
                if (regex.test(relativePath) && !file.dir) {
                    try {
                        const data = await file.async('uint8array');
                        
                        if (!archive.cache) {
                            archive.cache = new Map();
                        }
                        archive.cache.set(relativePath, data);
                        preloadedFiles.push(relativePath);
                        console.log(`[VFS] Предзагружен: ${relativePath} (${data.length} байт)`);
                    } catch (error) {
                        console.error(`[VFS] Ошибка предзагрузки ${relativePath}:`, error);
                    }
                }
            });
        }
        
        return preloadedFiles;
    }
    
    /**
     * trap_RemoveCommand - удаление команды
     */
    trap_RemoveCommand(cmdNamePtr) {
        if (!this.vm) return;
        const cmdName = this.vm.readString(cmdNamePtr);
        this.commands.delete(cmdName);
        return 0;
    }
    
    /**
     * trap_SendClientCommand - отправка команды клиента
     */
    trap_SendClientCommand(textPtr) {
        if (!this.vm) return;
        const text = this.vm.readString(textPtr);
        console.log(`[Client Command] ${text}`);
        return 0;
    }
    
    /**
     * trap_CM_LoadMap - загрузка карты коллизий
     */
    trap_CM_LoadMap(mapNamePtr) {
        if (!this.vm) return;
        const mapName = this.vm.readString(mapNamePtr);
        // Логируем только если имя не пустое
        if (mapName && mapName.trim()) {
            console.log(`[CM] LoadMap: ${mapName}`);
        }
        return 0;
    }
    
    /**
     * trap_CM_NumInlineModels - количество inline моделей
     */
    trap_CM_NumInlineModels() {
        return 0;
    }
    
    /**
     * trap_CM_InlineModel - получение inline модели
     */
    trap_CM_InlineModel(index) {
        return 0;
    }
    
    /**
     * trap_CM_TempBoxModel - создание временной box модели
     */
    trap_CM_TempBoxModel(minsPtr, maxsPtr) {
        return 0;
    }
    
    /**
     * trap_CM_TempCapsuleModel - создание временной capsule модели
     */
    trap_CM_TempCapsuleModel(minsPtr, maxsPtr) {
        return 0;
    }
    
    /**
     * trap_CM_PointContents - проверка содержимого точки
     */
    trap_CM_PointContents(pointPtr, model) {
        return 0;
    }
    
    /**
     * trap_S_ClearLoopingSounds - очистка зацикленных звуков
     */
    trap_S_ClearLoopingSounds(killall) {
        return 0;
    }
    
    /**
     * trap_S_AddLoopingSound - добавление зацикленного звука
     */
    trap_S_AddLoopingSound(entityNum, originPtr, velocityPtr, sfxHandle) {
        return 0;
    }
    
    /**
     * trap_S_UpdateEntityPosition - обновление позиции entity для звука
     */
    trap_S_UpdateEntityPosition(entityNum, originPtr) {
        return 0;
    }
    
    /**
     * trap_S_Respatialize - пространственная обработка звука
     */
    trap_S_Respatialize(entityNum, originPtr, axisPtr, inwater) {
        return 0;
    }
    
    /**
     * trap_S_StartBackgroundTrack - запуск фоновой музыки
     */
    trap_S_StartBackgroundTrack(introPtr, loopPtr) {
        return 0;
    }
    
    /**
     * trap_S_StopBackgroundTrack - остановка фоновой музыки
     */
    trap_S_StopBackgroundTrack() {
        return 0;
    }
    
    /**
     * trap_R_LoadWorldMap - загрузка карты мира
     */
    trap_R_LoadWorldMap(mapNamePtr) {
        if (!this.vm) return;
        const mapName = this.vm.readString(mapNamePtr);
        // Логируем только если имя не пустое
        if (mapName && mapName.trim()) {
            console.log(`[R] LoadWorldMap: ${mapName}`);
        }
        return 0;
    }
    
    /**
     * trap_R_RegisterShaderNoMip - регистрация шейдера без мипмапов
     */
    trap_R_RegisterShaderNoMip(namePtr) {
        return this.trap_R_RegisterShader(namePtr);
    }
    
    /**
     * trap_R_RegisterFont - регистрация шрифта
     */
    trap_R_RegisterFont(fontNamePtr, pointSize, fontPtr) {
        return 0;
    }
    
    /**
     * trap_R_AddPolyToScene - добавление полигона в сцену
     */
    trap_R_AddPolyToScene(shaderHandle, numVerts, vertsPtr) {
        return 0;
    }
    
    /**
     * trap_R_AddLightToScene - добавление света в сцену
     */
    trap_R_AddLightToScene(orgPtr, intensity, r, g, b) {
        return 0;
    }
    
    /**
     * trap_R_ModelBounds - получение границ модели
     */
    trap_R_ModelBounds(modelHandle, minsPtr, maxsPtr) {
        if (!this.vm) return;
        // Возвращаем нулевые границы
        for (let i = 0; i < 3; i++) {
            this.vm.memoryView.setFloat32(minsPtr + i * 4, 0, true);
            this.vm.memoryView.setFloat32(maxsPtr + i * 4, 0, true);
        }
        return 0;
    }
    
    /**
     * trap_R_LerpTag - интерполяция тега модели
     */
    trap_R_LerpTag(tagPtr, model, startFrame, endFrame, frac, tagNamePtr) {
        return 0;
    }
    
    /**
     * trap_R_LightForPoint - получение освещения в точке
     */
    trap_R_LightForPoint(pointPtr, ambientLightPtr, directedLightPtr, lightDirPtr) {
        return 0;
    }
    
    /**
     * trap_GetGLConfig - получение конфигурации OpenGL
     */
    trap_GetGLConfig(glconfigPtr) {
        if (!this.vm) return;
        
        // glconfig_t структура
        // vidWidth, vidHeight, windowAspect
        this.vm.memoryView.setInt32(glconfigPtr, this.canvas.width, true);
        this.vm.memoryView.setInt32(glconfigPtr + 4, this.canvas.height, true);
        this.vm.memoryView.setFloat32(glconfigPtr + 8, this.canvas.width / this.canvas.height, true);
        
        return 0;
    }
    
    /**
     * trap_GetCurrentCmdNumber - получение номера текущей команды
     */
    trap_GetCurrentCmdNumber() {
        return 0;
    }
    
    /**
     * trap_GetUserCmd - получение пользовательской команды
     */
    trap_GetUserCmd(cmdNumber, ucmdPtr) {
        return 0;
    }
    
    /**
     * trap_SetUserCmdValue - установка значения пользовательской команды
     */
    trap_SetUserCmdValue(stateValue, sensitivityScale) {
        return 0;
    }
    
    /**
     * trap_Key_IsDown - проверка нажатия клавиши
     */
    trap_Key_IsDown(keynum) {
        return 0;
    }
    
    /**
     * trap_Key_GetCatcher - получение перехватчика клавиатуры
     */
    trap_Key_GetCatcher() {
        return 0;
    }
    
    /**
     * trap_Key_SetCatcher - установка перехватчика клавиатуры
     */
    trap_Key_SetCatcher(catcher) {
        return 0;
    }
    
    /**
     * trap_Key_GetKey - получение клавиши по привязке
     */
    trap_Key_GetKey(bindingPtr) {
        return -1;
    }
    
    /**
     * trap_PC_AddGlobalDefine - добавление глобального определения парсера
     */
    trap_PC_AddGlobalDefine(definePtr) {
        return 0;
    }
    
    /**
     * trap_PC_LoadSource - загрузка источника парсера
     */
    trap_PC_LoadSource(filenamePtr) {
        return 0;
    }
    
    /**
     * trap_PC_FreeSource - освобождение источника парсера
     */
    trap_PC_FreeSource(handle) {
        return 0;
    }
    
    /**
     * trap_PC_ReadToken - чтение токена из парсера
     */
    trap_PC_ReadToken(handle, tokenPtr) {
        return 0;
    }
    
    /**
     * trap_PC_SourceFileAndLine - получение файла и строки источника
     */
    trap_PC_SourceFileAndLine(handle, filenamePtr, linePtr) {
        return 0;
    }
    
    /**
     * trap_SnapVector - привязка вектора к сетке
     */
    trap_SnapVector(vecPtr) {
        return 0;
    }
    
    /**
     * trap_GetEntityToken - получение токена entity
     */
    trap_GetEntityToken(bufferPtr, bufferSize) {
        return 0;
    }
    
    // ============================================================
    // СИСТЕМНЫЕ ФУНКЦИИ ВЫВОДА
    // ============================================================
    
    /**
     * trap_Print - вывод сообщения в консоль
     * Используется CG_Printf в cgame для вывода информации
     */
    trap_Print(textPtr) {
        if (!this.vm) {
            return;
        }
        
        const text = this.vm.readString(textPtr);
        
        if (!text || !text.trim()) {
            return;
        }
        
        // Убираем Q3 color codes для консоли браузера
        const cleanText = text.replace(/\^[0-9]/g, '');
        
        console.log(`[QVM] ${cleanText}`);
        
        // Вывод в Q3 консоль на странице (как в настоящем Q3)
        if (typeof window !== 'undefined' && window.q3Print) {
            window.q3Print(cleanText);
        }
        
        // Если есть глобальный лог для страницы, добавляем туда
        if (typeof window !== 'undefined' && window.qvmPrintLog) {
            window.qvmPrintLog(text);
        }
        
        return 0;
    }
    
    /**
     * trap_Error - вывод ошибки
     */
    trap_Error(textPtr) {
        if (!this.vm) return;
        
        const text = this.vm.readString(textPtr);
        const cleanText = text.replace(/\^[0-9]/g, '');
        
        console.error(`[QVM Error] ${cleanText}`);
        
        // Если есть глобальный лог для страницы
        if (typeof window !== 'undefined' && window.qvmPrintLog) {
            window.qvmPrintLog(`^1ERROR: ${text}`, 'log-error');
        }
        
        return 0;
    }
    
    /**
     * Получение имени syscall (для отладки)
     */
    getSyscallName(num) {
        for (const [name, value] of Object.entries(CG_SYSCALLS)) {
            if (value === num) {
                return name;
            }
        }
        return `UNKNOWN_${num}`;
    }
    
    /**
     * Включить/выключить логирование syscalls
     */
    setLogging(enabled) {
        this.logSyscalls = enabled;
        if (!enabled) {
            this.syscallLog = [];
        }
    }
    
    /**
     * Получить лог syscalls
     */
    getSyscallLog() {
        return this.syscallLog;
    }
    
    /**
     * Статистика syscalls
     */
    getSyscallStats() {
        const stats = {};
        for (const entry of this.syscallLog) {
            stats[entry.name] = (stats[entry.name] || 0) + 1;
        }
        return stats;
    }
    
    /**
     * Получение текущего playerState
     * Если сервер подключен, берем данные из VirtualPlayer
     */
    getPlayerState() {
        if (this.server) {
            const player = this.server.getPlayer(this.localClientNum);
            if (player) {
                // Синхронизируем с VirtualPlayer
                return {
                    health: player.health,
                    armor: player.armor,
                    weapon: player.weapon,
                    ammo: this.playerState.ammo, // Используем локальный массив
                    weaponFlags: this.playerState.weaponFlags,
                    clientNum: player.id,
                    commandTime: this.playerState.commandTime,
                    origin: player.origin,
                    velocity: player.velocity,
                    viewangles: player.angles
                };
            }
        }
        return this.playerState;
    }
    
    /**
     * Обновление playerState (для тестирования/симуляции)
     */
    updatePlayerState(updates) {
        if (this.server) {
            const player = this.server.getPlayer(this.localClientNum);
            if (player) {
                if (updates.health !== undefined) player.health = updates.health;
                if (updates.armor !== undefined) player.armor = updates.armor;
                if (updates.weapon !== undefined) player.weapon = updates.weapon;
                if (updates.origin !== undefined) player.origin = updates.origin;
                if (updates.velocity !== undefined) player.velocity = updates.velocity;
                if (updates.viewangles !== undefined) player.angles = updates.viewangles;
                return;
            }
        }
        Object.assign(this.playerState, updates);
    }
    
    /**
     * Установка оружия
     */
    setWeapon(weaponNum) {
        const weaponNames = [
            'Gauntlet', 'Machinegun', 'Shotgun', 'Grenade Launcher',
            'Rocket Launcher', 'Lightning Gun', 'Railgun', 'Plasma Gun', 'BFG'
        ];
        
        if (weaponNum >= 0 && weaponNum < weaponNames.length) {
            if (this.server) {
                const player = this.server.getPlayer(this.localClientNum);
                if (player) {
                    player.weapon = weaponNum;
                }
            } else {
                this.playerState.weapon = weaponNum;
            }
            this.playerState.weaponFlags |= (1 << weaponNum); // Добавляем бит оружия
            console.log(`[Syscalls] Оружие изменено: ${weaponNames[weaponNum]}`);
        }
    }
    
    /**
     * Изменение здоровья
     */
    modifyHealth(delta) {
        if (this.server) {
            const player = this.server.getPlayer(this.localClientNum);
            if (player) {
                player.health = Math.max(0, Math.min(200, player.health + delta));
                console.log(`[Syscalls] Здоровье: ${player.health}`);
                return;
            }
        }
        this.playerState.health = Math.max(0, Math.min(200, this.playerState.health + delta));
        console.log(`[Syscalls] Здоровье: ${this.playerState.health}`);
    }
    
    /**
     * Изменение брони
     */
    modifyArmor(delta) {
        if (this.server) {
            const player = this.server.getPlayer(this.localClientNum);
            if (player) {
                player.armor = Math.max(0, Math.min(200, player.armor + delta));
                console.log(`[Syscalls] Броня: ${player.armor}`);
                return;
            }
        }
        this.playerState.armor = Math.max(0, Math.min(200, this.playerState.armor + delta));
        console.log(`[Syscalls] Броня: ${this.playerState.armor}`);
    }
    
    /**
     * Установка сервера
     */
    setServer(server) {
        this.server = server;
        console.log('[Syscalls] Подключен к эмулятору сервера');
    }
}

// Экспорт
if (typeof window !== 'undefined') {
    window.Q3VMSyscallHandler = Q3VMSyscallHandler;
    window.CG_SYSCALLS = CG_SYSCALLS;
}

console.log('[Q3VM Syscalls] Модуль загружен ✓');


