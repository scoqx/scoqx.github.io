/**
 * Q3VM Client Integration V2
 * 
 * Универсальная интеграция - поддерживает и WASM и JS интерпретатор
 * Автоматически выбирает лучший доступный вариант
 * 
 * Features:
 * - Real-time debug overlay (Press D to toggle)
 * - FPS counter
 * - Syscall statistics
 * - VM call statistics
 * - Integration with Q3ServerEmulator for real player stats
 * - Player data from server (health, armor, weapon, ammo)
 * 
 * Version: 0.06
 */

// Константы cgame экспортов (из cg_public.h cgameExport_t)
const CG_EXPORTS = {
    CG_INIT: 0,                 // void CG_Init(int serverMessageNum, int serverCommandSequence, int clientNum)
    CG_SHUTDOWN: 1,             // void CG_Shutdown(void)
    CG_CONSOLE_COMMAND: 2,      // qboolean CG_ConsoleCommand(void)
    CG_DRAW_ACTIVE_FRAME: 3,    // void CG_DrawActiveFrame(int serverTime, stereoFrame_t stereoView, qboolean demoPlayback)
    CG_CROSSHAIR_PLAYER: 4,     // int CG_CrosshairPlayer(void)
    CG_LAST_ATTACKER: 5,        // int CG_LastAttacker(void)
    CG_KEY_EVENT: 6,            // void CG_KeyEvent(int key, qboolean down)
    CG_MOUSE_EVENT: 7,          // void CG_MouseEvent(int dx, int dy)
    CG_EVENT_HANDLING: 8        // void CG_EventHandling(int type)
};

class Q3VMClientEmulatorV2 {
    constructor(canvas, server = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Сервер может быть передан извне (опционально)
        this.server = server;
        
        // Компоненты (создаем ДО connectToServer, чтобы syscallHandler был готов)
        this.loader = new Q3VMLoader();
        this.syscallHandler = new Q3VMSyscallHandler(canvas, this.ctx, this.server);
        
        // ВАЖНО: Если сервер передан, сразу подключаемся к нему (устанавливаем callback)
        // Это нужно сделать ДО инициализации и ДО регистрации на сервере, чтобы callback был готов
        if (this.server) {
            console.log('[Q3VM Client V2] Сервер передан, подключаемся...');
            this.connectToServer(this.server);
        } else {
            console.log('[Q3VM Client V2] Работаем без сервера (локальный playerState)');
        }
        this.vm = null;
        this.vmType = null; // 'wasm' или 'js'
        
        // Состояние
        this.isInitialized = false;
        this.isRunning = false;
        this.animationFrameId = null;
        
        // Игровое время
        this.serverTime = 0;
        this.frameDelta = 16; // ~60 FPS
        this.lastFrameTime = 0;
        
        // Параметры клиента
        this.clientNum = 0;
        this.serverMessageNum = 0;
        this.serverCommandSequence = 0;
        
        // Debug overlay
        this.debugOverlay = true; // Включен по умолчанию
        
        // Имена оружий для отображения
        this.weaponNames = [
            'Gauntlet', 'Machinegun', 'Shotgun', 'Grenade Launcher',
            'Rocket Launcher', 'Lightning Gun', 'Railgun', 'Plasma Gun', 'BFG'
        ];
        
        // Обработчик клавиш для debug overlay
        this.setupKeyboardHandler();
        
        console.log('[Q3VM Client V2] Эмулятор создан');
    }
    
    /**
     * Настройка обработчика клавиш
     */
    setupKeyboardHandler() {
        document.addEventListener('keydown', (e) => {
            // Пропускаем если фокус в input/textarea
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                return;
            }
            
            // Toggle debug overlay (D)
            if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
                if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.toggleDebugOverlay();
                    e.preventDefault();
                }
            }
            
            // Переключение оружия (1-9)
            if (e.key >= '1' && e.key <= '9') {
                const weaponIndex = parseInt(e.key) - 1;
                if (weaponIndex < this.weaponNames.length && this.syscallHandler) {
                    this.syscallHandler.setWeapon(weaponIndex);
                    e.preventDefault();
                }
            }
            
            // Симуляция урона (H - heal, J - damage)
            if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
                if (this.syscallHandler) {
                    this.syscallHandler.modifyHealth(25);
                }
                e.preventDefault();
            }
            if (e.key === 'j' || e.key === 'J' || e.key === 'о' || e.key === 'О') {
                if (this.syscallHandler) {
                    this.syscallHandler.modifyHealth(-20);
                }
                e.preventDefault();
            }
            
            // Броня (K - add armor, L - remove armor)
            if (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л') {
                if (this.syscallHandler) {
                    this.syscallHandler.modifyArmor(25);
                }
                e.preventDefault();
            }
            if (e.key === 'l' || e.key === 'L' || e.key === 'д' || e.key === 'Д') {
                if (this.syscallHandler) {
                    this.syscallHandler.modifyArmor(-20);
                }
                e.preventDefault();
            }
        });
    }
    
    /**
     * Автоматический выбор лучшего VM
     */
    async detectBestVM() {
        // Проверяем доступность WASM
        if (typeof Q3VMWasm !== 'undefined' && typeof Q3VM_WASM !== 'undefined') {
            console.log('[Q3VM Client V2] ✓ WASM доступен - используем его (33x быстрее!)');
            return 'wasm';
        }
        
        // Fallback на JS интерпретатор
        if (typeof Q3VM !== 'undefined') {
            console.log('[Q3VM Client V2] ⚠ WASM недоступен, используем JS интерпретатор');
            return 'js';
        }
        
        throw new Error('Ни WASM, ни JS интерпретатор не доступны!');
    }
    
    /**
     * Инициализация - загрузка и запуск cgame.qvm
     */
    async initialize(preferWasm = true) {
        console.log('[Q3VM Client V2] ═══════════════════════════════════');
        console.log('[Q3VM Client V2] Инициализация Q3VM клиента V2...');
        console.log('[Q3VM Client V2] ═══════════════════════════════════');
        
        try {
            // 1. Определяем какую VM использовать
            this.vmType = await this.detectBestVM();
            console.log(`[Q3VM Client V2] Выбран тип VM: ${this.vmType.toUpperCase()}`);
            
            // 2. Загружаем cgame.qvm
            console.log('[Q3VM Client V2] Шаг 1/5: Загрузка cgame.qvm...');
            const qvmModule = await this.loader.loadCGameFromOSP2();
            console.log('[Q3VM Client V2] ✓ cgame.qvm загружен');
            
            // Анализируем модуль
            const analysis = this.loader.analyzeModule();
            console.log(`[Q3VM Client V2] Инструкций: ${analysis.totalInstructions}`);
            console.log(`[Q3VM Client V2] Функций: ${analysis.entryPoints.length}`);
            
            // 2.5. Регистрируем PK3 архив в файловой системе
            if (qvmModule.pk3Path) {
                console.log('[Q3VM Client V2] Шаг 1.5/5: Регистрация PK3 в VFS...');
                await this.loader.registerPK3InVFS(this.syscallHandler, qvmModule.pk3Path);
                console.log('[Q3VM Client V2] ✓ PK3 зарегистрирован в VFS');
            } else {
                console.warn('[Q3VM Client V2] ⚠ Информация о PK3 недоступна, файлы не будут загружены');
            }
            
            // 2.6. Загружаем локальные файлы (конфиги)
            console.log('[Q3VM Client V2] Шаг 1.6/5: Загрузка локальных файлов...');
            const localFiles = [
                { path: 'cfg/diwoc.cfg', url: '../assets/cfg/diwoc.cfg' },
                { path: 'diwoc.cfg', url: '../assets/cfg/diwoc.cfg' }  // Дублируем на случай если QVM ищет без префикса
            ];
            
            try {
                await this.loader.loadLocalFilesIntoVFS(this.syscallHandler, localFiles);
                console.log('[Q3VM Client V2] ✓ Локальные файлы загружены');
                
                // Парсим конфиг для извлечения CVars
                await this.syscallHandler.parseConfigFile('cfg/diwoc.cfg');
            } catch (error) {
                console.warn('[Q3VM Client V2] ⚠ Не удалось загрузить локальные файлы:', error);
            }
            
            // 3. Создаем выбранную VM
            console.log(`[Q3VM Client V2] Шаг 2/5: Создание ${this.vmType.toUpperCase()} VM...`);
            
            if (this.vmType === 'wasm') {
                this.vm = new Q3VMWasm();
                await this.vm.initialize();
            } else {
                this.vm = new Q3VM((syscallNum, args) => {
                    return this.syscallHandler.handle(syscallNum, args);
                });
            }
            
            // Привязываем syscall handler
            if (this.vmType === 'js') {
                this.syscallHandler.bindToVM(this.vm);
            } else {
                // WASM - устанавливаем handler и привязываем VM
                this.vm.setSyscallHandler(this.syscallHandler);
                this.syscallHandler.bindToVM(this.vm);
            }
            
            console.log('[Q3VM Client V2] ✓ VM создана');
            
            // 4. Загружаем модуль в VM
            console.log('[Q3VM Client V2] Шаг 3/5: Загрузка модуля в VM...');
            
            if (this.vmType === 'wasm') {
                await this.vm.loadModule(qvmModule);
            } else {
                this.vm.loadModule(qvmModule);
            }
            
            console.log('[Q3VM Client V2] ✓ Модуль загружен в память VM');
            
            // 5. Вызываем vmMain(CG_INIT)
            console.log('[Q3VM Client V2] Шаг 4/5: Инициализация cgame (CG_INIT)...');
            
            // Очищаем старые команды перед инициализацией
            this.syscallHandler.serverCommands = [];
            this.syscallHandler.serverCommandSequence = 0;
            console.log('[Q3VM Client V2] Очередь команд сброшена перед CG_Init');
            
            // Начинаем на 1 меньше текущего снапшота, чтобы QVM запросил первый снапшот
            const initSnapshotNum = this.syscallHandler.currentSnapshotNumber - 1;
            
            console.log(`[Q3VM Client V2] Вызов vmMain(${CG_EXPORTS.CG_INIT}, ${initSnapshotNum}, ${this.serverCommandSequence}, ${this.clientNum})`);
            console.log(`[Q3VM Client V2] Текущий снапшот: ${this.syscallHandler.currentSnapshotNumber}, QVM начнет с: ${initSnapshotNum}`);
            
            try {
                const result = this.vm.call(
                    0, // vmMain address
                    CG_EXPORTS.CG_INIT,
                    initSnapshotNum, // На 1 меньше, чтобы цикл while() выполнился
                    this.serverCommandSequence,
                    this.clientNum
                );
                
                console.log(`[Q3VM Client V2] ✓ CG_Init завершен, результат: ${result}`);
                
            } catch (initError) {
                console.error('[Q3VM Client V2] ✗ Ошибка в CG_Init:', initError);
                
                // Для WASM это не критично (заглушка)
                if (this.vmType === 'wasm') {
                    console.log('[Q3VM Client V2] ⚠ WASM в режиме заглушки, продолжаем...');
                } else {
                    throw initError;
                }
            }
            
            this.isInitialized = true;
            
            // ВАЖНО: Устанавливаем флаг в syscallHandler что QVM инициализирован
            // Теперь команды будут передаваться в снапшотах
            this.syscallHandler.isInitialized = true;
            console.log('[Q3VM Client V2] ✓ Syscalls готовы принимать команды');
            
            // Статистика
            if (this.vm.getStats) {
                const stats = this.vm.getStats();
                console.log('[Q3VM Client V2] Статистика VM:', stats);
            }
            
            console.log('[Q3VM Client V2] ═══════════════════════════════════');
            console.log('[Q3VM Client V2] ✓ Инициализация завершена!');
            console.log(`[Q3VM Client V2] Используется: ${this.vmType.toUpperCase()}`);
            console.log('[Q3VM Client V2] ═══════════════════════════════════');
            
            return true;
            
        } catch (error) {
            console.error('[Q3VM Client V2] ═══════════════════════════════════');
            console.error('[Q3VM Client V2] ✗ Ошибка инициализации:', error);
            console.error('[Q3VM Client V2] ═══════════════════════════════════');
            throw error;
        }
    }
    
    /**
     * Запуск рендеринга
     */
    startRendering() {
        if (!this.isInitialized) {
            console.error('[Q3VM Client V2] Клиент не инициализирован!');
            return;
        }
        
        if (this.isRunning) {
            console.warn('[Q3VM Client V2] Рендеринг уже запущен');
            return;
        }
        
        console.log('[Q3VM Client V2] Запуск рендеринга...');
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.renderLoop();
    }
    
    /**
     * Основной цикл рендеринга
     */
    renderLoop() {
        if (!this.isRunning) return;
        
        try {
            // Обновляем время
            const currentTime = performance.now();
            const deltaTime = Math.min(currentTime - this.lastFrameTime, 100); // Макс 100ms
            this.lastFrameTime = currentTime;
            
            this.serverTime += Math.round(deltaTime);
            
            // Подсчитываем FPS
            if (!this.fpsCounter) {
                this.fpsCounter = { frames: 0, lastTime: currentTime, fps: 0 };
            }
            this.fpsCounter.frames++;
            if (currentTime - this.fpsCounter.lastTime >= 1000) {
                this.fpsCounter.fps = Math.round((this.fpsCounter.frames * 1000) / (currentTime - this.fpsCounter.lastTime));
                // Логируем FPS для диагностики частоты вызовов CG_DRAW_ACTIVE_FRAME
                console.log(`[Q3VM Client V2] Рендеринг: ${this.fpsCounter.fps} FPS (renderLoop вызывается каждый кадр)`);
                this.fpsCounter.frames = 0;
                this.fpsCounter.lastTime = currentTime;
            }
            
            // Сбрасываем VM для нового кадра (только для JS)
            if (this.vmType === 'js' && this.vm.reset) {
                this.vm.reset();
            }
            
            // Вызываем CG_DRAW_ACTIVE_FRAME - вызывается КАЖДЫЙ КАДР через requestAnimationFrame
            this.vm.call(
                0, // vmMain address
                CG_EXPORTS.CG_DRAW_ACTIVE_FRAME,
                this.serverTime,
                0, // stereoView (normal)
                0  // demoPlayback (not playing)
            );
            
            // Рисуем debug overlay если включен
            if (this.debugOverlay) {
                this.drawDebugOverlay();
            }
            
        } catch (error) {
            console.error('[Q3VM Client V2] Ошибка рендеринга:', error);
            this.stopRendering();
            return;
        }
        
        // Следующий кадр
        this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
    }
    
    /**
     * Отрисовка debug overlay
     */
    drawDebugOverlay() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // Полупрозрачный фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(10, 10, 350, 300);
        
        // Заголовок
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('Q3VM DEBUG INFO', 20, 32);
        
        // Линия разделитель
        ctx.strokeStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(20, 38);
        ctx.lineTo(350, 38);
        ctx.stroke();
        
        let y = 60;
        const lineHeight = 22;
        
        // ═══ ИГРОВАЯ ИНФОРМАЦИЯ ═══
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('PLAYER STATUS', 20, y);
        y += lineHeight;
        
        // Получаем playerState из syscallHandler
        const ps = this.syscallHandler ? this.syscallHandler.getPlayerState() : null;
        
        if (ps) {
            // Здоровье с цветовой индикацией
            ctx.font = '16px monospace';
            const health = ps.health;
            if (health > 100) {
                ctx.fillStyle = '#00ffff'; // Cyan для мега
            } else if (health >= 75) {
                ctx.fillStyle = '#00ff00'; // Зеленый
            } else if (health >= 50) {
                ctx.fillStyle = '#ffff00'; // Желтый
            } else if (health >= 25) {
                ctx.fillStyle = '#ff8800'; // Оранжевый
            } else {
                ctx.fillStyle = '#ff0000'; // Красный
            }
            ctx.fillText(`Health: ${health}`, 20, y);
            
            // Прогресс бар здоровья
            const healthBarWidth = 200;
            const healthBarHeight = 12;
            const healthPercent = Math.min(health / 200, 1); // Max 200 HP
            
            ctx.fillStyle = '#333333';
            ctx.fillRect(135, y - 12, healthBarWidth, healthBarHeight);
            
            if (health > 100) {
                ctx.fillStyle = '#00ffff';
            } else if (health >= 75) {
                ctx.fillStyle = '#00ff00';
            } else if (health >= 50) {
                ctx.fillStyle = '#ffff00';
            } else if (health >= 25) {
                ctx.fillStyle = '#ff8800';
            } else {
                ctx.fillStyle = '#ff0000';
            }
            ctx.fillRect(135, y - 12, healthBarWidth * healthPercent, healthBarHeight);
            
            ctx.strokeStyle = '#ffffff';
            ctx.strokeRect(135, y - 12, healthBarWidth, healthBarHeight);
            
            y += lineHeight;
            
            // Броня
            ctx.fillStyle = '#8888ff';
            ctx.fillText(`Armor:  ${ps.armor}`, 20, y);
            y += lineHeight + 5;
            
            // Оружие
            const weaponName = this.weaponNames[ps.weapon] || 'Unknown';
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 16px monospace';
            ctx.fillText(`Weapon: ${weaponName}`, 20, y);
            y += lineHeight;
            
            // Патроны
            const ammo = ps.ammo[ps.weapon] || 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px monospace';
            ctx.fillText(`Ammo:   ${ammo}`, 20, y);
            y += lineHeight + 8;
        } else {
            // Если playerState недоступен
            ctx.fillStyle = '#ff0000';
            ctx.font = '14px monospace';
            ctx.fillText('Player data unavailable', 20, y);
            y += lineHeight * 2;
        }
        
        // ═══ ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ ═══
        ctx.fillStyle = '#00aaff';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('TECHNICAL', 20, y);
        y += lineHeight;
        
        // VM Type
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.fillText(`VM: ${this.vmType ? this.vmType.toUpperCase() : 'N/A'}`, 20, y);
        y += lineHeight;
        
        // FPS
        const fps = this.fpsCounter ? this.fpsCounter.fps : 0;
        ctx.fillStyle = fps >= 50 ? '#00ff00' : (fps >= 30 ? '#ffff00' : '#ff0000');
        ctx.fillText(`FPS: ${fps}`, 20, y);
        ctx.fillStyle = '#ffffff';
        y += lineHeight;
        
        // Server Time
        ctx.fillText(`Time: ${(this.serverTime / 1000).toFixed(1)}s`, 20, y);
        y += lineHeight;
        
        // Статистика вызовов
        if (this.vm && this.vm.callStats && this.vm.callStats.size > 0) {
            const drawFrameCount = this.vm.callStats.get('CG_DRAW_ACTIVE_FRAME') || 0;
            ctx.fillText(`Frames: ${drawFrameCount}`, 20, y);
            y += lineHeight;
        }
        
        // Hint
        ctx.fillStyle = '#888888';
        ctx.font = '10px monospace';
        ctx.fillText('D: toggle | 1-9: weapon | H/J: health | K/L: armor', 20, canvas.height - 20);
    }
    
    /**
     * Переключение debug overlay
     */
    toggleDebugOverlay() {
        this.debugOverlay = !this.debugOverlay;
        console.log(`[Q3VM Client V2] Debug overlay: ${this.debugOverlay ? 'ON' : 'OFF'}`);
        return this.debugOverlay;
    }
    
    /**
     * Подключение к серверу
     */
    connectToServer(server) {
        if (!server) {
            console.warn('[Q3VM Client V2] Передан пустой сервер');
            return false;
        }
        
        this.server = server;
        this.syscallHandler.setServer(server);
        
        // Устанавливаем callback для получения configstrings от сервера
        // ВАЖНО: Этот callback должен быть установлен ДО вызова connectClient
        server.setConfigStringsCallback((clientId, configStringsMap) => {
            const isInitialLoad = configStringsMap.size >= 10; // Полная загрузка
            
            if (isInitialLoad) {
                console.log(`[Q3VM Client V2] ═══════════════════════════════════`);
                console.log(`[Q3VM Client V2] 🎯 ПОЛУЧЕНЫ CONFIGSTRINGS ОТ СЕРВЕРА!`);
                console.log(`[Q3VM Client V2]   Клиент: ${clientId}`);
                console.log(`[Q3VM Client V2]   Количество: ${configStringsMap.size} configstrings`);
            } else {
                console.log(`[Q3VM Client V2] ✓ Получены ${configStringsMap.size} configstrings (частичное обновление)`);
            }
            
            // Передаем configstrings в syscallHandler
            this.syscallHandler.setConfigStrings(configStringsMap);
            
            // Логируем важные configstrings только при полном обновлении
            if (isInitialLoad) {
                const cs20 = configStringsMap.get(20); // CS_GAME_VERSION
                if (cs20 && cs20 === 'baseq3-1') {
                    console.log(`[Q3VM Client V2] ✓✓✓ CS_GAME_VERSION получен: "${cs20}"`);
                    console.log(`[Q3VM Client V2] ✓✓✓ Configstrings готовы для CG_Init!`);
                } else {
                    console.error(`[Q3VM Client V2] ✗✗✗ CS_GAME_VERSION отсутствует или неправильный!`);
                    console.error(`[Q3VM Client V2]   Получено: "${cs20 || '(пусто)'}"`);
                }
                console.log(`[Q3VM Client V2] ═══════════════════════════════════`);
            }
        });
        
        // ВАЖНО: setConfigStringsCallback автоматически отправит configstrings всем подключенным клиентам
        // Поэтому здесь не нужно явно вызывать sendConfigStringsToClient
        
        // Устанавливаем callback для получения снапшотов от сервера
        if (server.setSnapshotCallback) {
            server.setSnapshotCallback((snapshot, connectedClients) => {
                // Проверяем что снапшот предназначен для этого клиента
                if (connectedClients && connectedClients.includes(this.clientNum)) {
                    // Передаем снапшот в syscallHandler
                    this.syscallHandler.receiveSnapshot(snapshot);
                }
            });
            console.log('[Q3VM Client V2]   Callback для снапшотов установлен');
        } else {
            console.warn('[Q3VM Client V2]   ⚠️ Сервер не поддерживает setSnapshotCallback');
        }
        
        console.log('[Q3VM Client V2] ✓ Подключен к серверу');
        console.log(`[Q3VM Client V2]   Игроков на сервере: ${server.players.size}`);
        console.log('[Q3VM Client V2]   Callback для configstrings установлен');
        
        return true;
    }
    
    /**
     * Отключение от сервера
     */
    disconnectFromServer() {
        if (!this.server) {
            console.log('[Q3VM Client V2] Сервер не подключен');
            return;
        }
        
        this.server = null;
        this.syscallHandler.setServer(null);
        
        console.log('[Q3VM Client V2] Отключен от сервера, используем локальный playerState');
    }
    
    /**
     * Остановка рендеринга
     */
    stopRendering() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        this.isRunning = false;
        console.log('[Q3VM Client V2] Рендеринг остановлен');
    }
    
    /**
     * Остановка и очистка
     */
    shutdown() {
        this.stopRendering();
        
        if (this.isInitialized && this.vm) {
            // Вызываем CG_SHUTDOWN
            try {
                if (this.vmType === 'js' && this.vm.reset) {
                    this.vm.reset();
                }
                this.vm.call(0, CG_EXPORTS.CG_SHUTDOWN);
            } catch (error) {
                console.error('[Q3VM Client V2] Ошибка при shutdown:', error);
            }
            
            // Освобождаем ресурсы
            if (this.vm.free) {
                this.vm.free();
            }
        }
        
        this.isInitialized = false;
        console.log('[Q3VM Client V2] Клиент остановлен');
    }
    
    /**
     * Получение статуса
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            vmType: this.vmType,
            clientNum: this.clientNum,
            serverTime: this.serverTime,
            hasVM: !!this.vm,
            vmStats: this.vm && this.vm.getStats ? this.vm.getStats() : null
        };
    }
    
    /**
     * Дамп информации для отладки
     */
    dump() {
        console.log('[Q3VM Client V2] ===== СОСТОЯНИЕ КЛИЕНТА =====');
        console.log('VM Type:', this.vmType);
        console.log('Инициализирован:', this.isInitialized);
        console.log('Рендеринг:', this.isRunning);
        console.log('Client Num:', this.clientNum);
        console.log('Server Time:', this.serverTime);
        
        if (this.vm && this.vm.dumpState) {
            console.log('\nСостояние VM:');
            this.vm.dumpState();
        }
        
        if (this.vm && this.vm.getStats) {
            console.log('\nСтатистика VM:');
            const stats = this.vm.getStats();
            for (const [key, value] of Object.entries(stats)) {
                console.log(`  ${key}: ${value}`);
            }
        }
        
        console.log('\nЗарегистрированные ресурсы:');
        console.log(`  Шейдеры: ${this.syscallHandler.shaders.size}`);
        console.log(`  Модели: ${this.syscallHandler.models.size}`);
        console.log(`  Звуки: ${this.syscallHandler.sounds.size}`);
        console.log(`  CVars: ${this.syscallHandler.cvars.size}`);
        
        console.log('[Q3VM Client V2] =====================================');
    }
}

// Глобальный экземпляр
let globalQ3VMClientV2 = null;

/**
 * Создание и инициализация Q3VM клиента V2
 * @param {HTMLCanvasElement} canvas - Canvas для рендеринга
 * @param {Q3ServerEmulator} server - Сервер для подключения (обязательный!)
 */
window.createQ3VMClientV2 = async function(canvas, server = null) {
    if (globalQ3VMClientV2) {
        console.warn('[Q3VM Client V2] Клиент уже существует, останавливаем предыдущий...');
        globalQ3VMClientV2.shutdown();
    }
    
    if (!server) {
        throw new Error('Q3VM Client требует подключения к серверу! Передайте Q3ServerEmulator как второй параметр.');
    }
    
    // Создаем клиент (connectToServer уже вызывается внутри конструктора)
    globalQ3VMClientV2 = new Q3VMClientEmulatorV2(canvas, server);
    
    // ВАЖНО: Регистрируем клиент на сервере ДО инициализации QVM
    // Это нужно чтобы configstrings были отправлены до того, как CG_Init вызовет trap_GetGameState
    const clientId = globalQ3VMClientV2.clientNum; // обычно 0
    
    // Проверяем что callback установлен
    if (!server.onConfigStringsReady) {
        console.error(`[Q3VM Client V2] ⚠ КРИТИЧНО: Callback для configstrings не установлен!`);
        throw new Error('Callback для configstrings не установлен! Клиент должен быть подключен к серверу.');
    }
    
    if (server && !server.connectedClients.has(clientId)) {
        console.log(`[Q3VM Client V2] ┌────────────────────────────────────────────`);
        console.log(`[Q3VM Client V2] │ Регистрация клиента ${clientId} на сервере`);
        console.log(`[Q3VM Client V2] │ (отправит configstrings синхронно)`);
        console.log(`[Q3VM Client V2] └────────────────────────────────────────────`);
        
        // ВЫЗОВ СИНХРОННЫЙ - configstrings должны быть получены сразу же
        server.connectClient(clientId);
        
        // Проверяем что configstrings получены
        const cs20 = globalQ3VMClientV2.syscallHandler.getConfigString(20);
        const totalCS = globalQ3VMClientV2.syscallHandler.configStrings.size;
        
        if (cs20 && cs20 === 'baseq3-1') {
            console.log(`[Q3VM Client V2] ✓✓✓ CS_GAME_VERSION получен: "${cs20}"`);
            console.log(`[Q3VM Client V2] ✓✓✓ Всего configstrings: ${totalCS}`);
            console.log(`[Q3VM Client V2] ✓✓✓ Готов к инициализации QVM!`);
        } else {
            console.error(`[Q3VM Client V2] ✗✗✗ CS_GAME_VERSION НЕ получен!`);
            console.error(`[Q3VM Client V2]   Получено: "${cs20 || '(пусто)'}"`);
            console.error(`[Q3VM Client V2]   Всего configstrings: ${totalCS}`);
            console.error(`[Q3VM Client V2]   Будет ошибка "game mismatch" в CG_Init!`);
        }
    }
    
    // Теперь инициализируем клиент (configstrings должны быть получены)
    await globalQ3VMClientV2.initialize();
    
    return globalQ3VMClientV2;
};

/**
 * Получение текущего клиента V2
 */
window.getQ3VMClientV2 = function() {
    return globalQ3VMClientV2;
};

/**
 * Глобальные функции для управления debug overlay
 */
window.toggleQ3VMDebug = function() {
    if (!globalQ3VMClientV2) {
        console.warn('[Q3VM] Клиент не инициализирован');
        return false;
    }
    return globalQ3VMClientV2.toggleDebugOverlay();
};

window.showQ3VMDebug = function() {
    if (!globalQ3VMClientV2) {
        console.warn('[Q3VM] Клиент не инициализирован');
        return;
    }
    globalQ3VMClientV2.debugOverlay = true;
    console.log('[Q3VM] Debug overlay включен');
};

window.hideQ3VMDebug = function() {
    if (!globalQ3VMClientV2) {
        console.warn('[Q3VM] Клиент не инициализирован');
        return;
    }
    globalQ3VMClientV2.debugOverlay = false;
    console.log('[Q3VM] Debug overlay выключен');
};

// Экспорт
if (typeof window !== 'undefined') {
    window.Q3VMClientEmulatorV2 = Q3VMClientEmulatorV2;
}

console.log('[Q3VM Client Integration V2] Модуль загружен ✓');
console.log('[Q3VM Client V2] Debug overlay включен по умолчанию');
console.log('[Q3VM Client V2] Интеграция с Q3ServerEmulator: ' + (typeof window.Q3ServerEmulator !== 'undefined' ? 'доступна' : 'недоступна'));
console.log('[Q3VM Client V2] Управление: D=toggle | 1-9=weapon | H/J=health | K/L=armor');


