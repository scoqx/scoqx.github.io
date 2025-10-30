/**
 * Quake 3 Server Emulator
 * Эмулятор сервера для отправки снапов с данными игроков
 * 
 * Features:
 * - VirtualPlayer с реальными game stats (health, armor, weapon, ammo)
 * - ConfigStrings management
 * - Server Commands (sendServerCommand, sendXStats1)
 * - addPlayer(id, name) - добавление игрока с заданным ID
 * - getPlayer(id) - получение игрока по ID
 * - connectClient(id) / disconnectClient(id) - регистрация клиентов для получения снапшотов
 * - start(interval) / stop() - управление игровым циклом
 * - Независимый от клиента (может работать без подключенных клиентов)
 * 
 * Version: 0.006
 */

// ConfigString константы из bg_public.h
const CS_CONSTANTS = {
    // Основные
    CS_SERVERINFO: 0,
    CS_SYSTEMINFO: 1,
    CS_MUSIC: 2,
    CS_MESSAGE: 3,
    CS_MOTD: 4,
    CS_WARMUP: 5,
    CS_SCORES1: 6,
    CS_SCORES2: 7,
    CS_VOTE_TIME: 8,
    CS_VOTE_STRING: 9,
    CS_VOTE_YES: 10,
    CS_VOTE_NO: 11,
    CS_TEAMVOTE_TIME: 12,
    CS_TEAMVOTE_STRING: 14,
    CS_TEAMVOTE_YES: 16,
    CS_TEAMVOTE_NO: 18,
    CS_GAME_VERSION: 20,
    CS_LEVEL_START_TIME: 21,
    CS_INTERMISSION: 22,
    CS_FLAGSTATUS: 23,
    CS_SHADERSTATE: 24,
    CS_BOTINFO: 25,
    CS_ITEMS: 27,
    
    // Динамические
    CS_MODELS: 32,
    CS_SOUNDS: 32 + 256, // CS_MODELS + MAX_MODELS
    CS_PLAYERS: 32 + 256 + 256, // CS_SOUNDS + MAX_SOUNDS
    CS_LOCATIONS: 32 + 256 + 256 + 32, // CS_PLAYERS + MAX_CLIENTS
    CS_PARTICLES: 32 + 256 + 256 + 32 + 64, // CS_LOCATIONS + MAX_LOCATIONS
    
    // OSP2-BE расширения
    CS_OSP_FREEZE_GAME_TYPE: 873,
    CS_OSP_CUSTOM_CLIENT2: 874,
    CS_OSP2BE_SUPPORTED: 887,
    CS_OSP2BE_DISABLED_FEATURES: 888,
    XQ3E_ALLOW_FEATURES: 1000
};

// Игровые типы
const GAME_TYPES = {
    GT_FFA: 0,           // free for all
    GT_TOURNAMENT: 1,     // one on one tournament
    GT_SINGLE_PLAYER: 2,  // single player ffa
    GT_TEAM: 3,          // team deathmatch
    GT_CTF: 4,           // capture the flag
    GT_1FCTF: 5,         // one flag CTF
    GT_OBELISK: 6,       // obelisk
    GT_HARVESTER: 7      // harvester
};

// Команды
const TEAMS = {
    TEAM_FREE: 0,
    TEAM_RED: 1,
    TEAM_BLUE: 2,
    TEAM_SPECTATOR: 3
};

// Состояния игрока
const PLAYER_STATES = {
    PM_NORMAL: 0,        // can accelerate and turn
    PM_NOCLIP: 1,        // noclip movement
    PM_SPECTATOR: 2,     // still run into walls
    PM_DEAD: 3,         // no acceleration or turning, but free falling
    PM_FREEZE: 4,       // stuck in place with no control
    PM_INTERMISSION: 5,   // no movement or status bar
    PM_SPINTERMISSION: 6 // no movement or status bar
};

// Класс виртуального игрока
class VirtualPlayer {
    constructor(id, name = `Player${id}`) {
        this.id = id;
        this.name = name;
        this.team = TEAMS.TEAM_FREE; // По умолчанию свободный
        
        // Основные параметры
        this.health = 125;
        this.armor = 50;
        this.ammo = 30;
        this.weapon = 1; // gauntlet
        
        // Позиция и углы
        this.origin = [0, 0, 0];
        this.angles = [0, 0, 0];
        this.velocity = [0, 0, 0];
        
        // Состояние
        this.pm_type = PLAYER_STATES.PM_NORMAL;
        this.pm_flags = 0;
        this.pm_time = 0;
        
        // Очки и статистика
        this.score = 0;
        this.frags = 0;
        this.deaths = 0;
        
        // Время
        this.lastUpdate = Date.now();
        this.isAlive = true;
        
        // OSP2-BE расширения
        this.ospFeatures = {
            freezeTime: 0,
            customClient: true,
            supported: true
        };
    }
    
    // Обновление состояния игрока
    update() {
        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
        
        // Простая симуляция движения
        if (this.pm_type === PLAYER_STATES.PM_NORMAL && this.isAlive) {
            // Небольшие случайные изменения позиции
            this.origin[0] += (Math.random() - 0.5) * 10;
            this.origin[1] += (Math.random() - 0.5) * 10;
            this.origin[2] += (Math.random() - 0.5) * 5;
            
            // Ограничиваем координаты
            this.origin[0] = Math.max(-1000, Math.min(1000, this.origin[0]));
            this.origin[1] = Math.max(-1000, Math.min(1000, this.origin[1]));
            this.origin[2] = Math.max(0, Math.min(200, this.origin[2]));
            
            // Обновляем углы
            this.angles[0] += (Math.random() - 0.5) * 2;
            this.angles[1] += (Math.random() - 0.5) * 2;
            this.angles[2] += (Math.random() - 0.5) * 1;
        }
        
        // Автоматическое снижение HP если больше 100
        if (this.health > 100) {
            this.health = Math.max(100, this.health - 1);
        }
        
        // Случайные изменения здоровья
        if (Math.random() < 0.01) { // 1% шанс
            this.health = Math.max(1, this.health + Math.floor((Math.random() - 0.5) * 20));
        }
        
        // Случайные изменения оружия
        if (Math.random() < 0.005) { // 0.5% шанс
            this.weapon = Math.floor(Math.random() * 7) + 1;
        }
        
        // Случайные фраги (очень редко)
        if (Math.random() < 0.001) { // 0.1% шанс
            this.score++;
            this.frags++;
        }
    }
    
    // Получение данных для снапа
    getSnapshotData() {
        return {
            id: this.id,
            name: this.name,
            team: this.team,
            health: this.health,
            armor: this.armor,
            ammo: this.ammo,
            weapon: this.weapon,
            origin: [...this.origin],
            angles: [...this.angles],
            velocity: [...this.velocity],
            pm_type: this.pm_type,
            pm_flags: this.pm_flags,
            pm_time: this.pm_time,
            score: this.score,
            frags: this.frags,
            deaths: this.deaths,
            isAlive: this.isAlive
        };
    }
}

// Класс эмулятора сервера
class Q3ServerEmulator {
    constructor() {
        this.players = new Map();
        this.configStrings = new Map();
        this.gameState = {
            gameType: GAME_TYPES.GT_FFA,
            fragLimit: 20,
            captureLimit: 8,
            timeLimit: 20,
            warmupTime: 0,
            intermission: false,
            levelStartTime: Date.now(),
            teamScores: [0, 0], // [red, blue]
            matchState: 'warmup' // warmup, active, intermission
        };
        
        this.updateInterval = null;
        this.isRunning = false;
        this.connectedClients = new Set(); // Симуляция подключенных клиентов
        
        // Server time
        this.serverTime = 0; // Игровое время в миллисекундах
        this.tickDelta = 1000; // Приращение времени за тик (будет установлено в start())
        
        // Server commands
        this.serverCommandSequence = 0;
        this.serverCommands = []; // История команд для дебага
        
        // Callbacks
        this.onServerCommand = null; // Callback для отправки команд клиенту
        this.onConfigStringsReady = null; // Callback для отправки configstrings клиенту (clientId, configStringsMap)
        
        // Инициализация базовых configstrings
        this.initializeConfigStrings();
    }
    
    // Инициализация configstrings
    initializeConfigStrings() {
        this.updateServerInfo();
        this.updateGameSettings();
        this.updateInitialConfigStrings();
    }
    
    // Configstrings, которые устанавливаются при инициализации игры (G_InitGame)
    updateInitialConfigStrings() {
        // Эти configstrings устанавливаются один раз при старте игры
        this.configStrings.set(CS_CONSTANTS.CS_INTERMISSION, "0");
        this.configStrings.set(CS_CONSTANTS.CS_OSP_FREEZE_GAME_TYPE, "1");
        this.configStrings.set(CS_CONSTANTS.CS_OSP_CUSTOM_CLIENT2, "1");
        this.configStrings.set(CS_CONSTANTS.CS_OSP2BE_SUPPORTED, "1");
        this.configStrings.set(CS_CONSTANTS.CS_OSP2BE_DISABLED_FEATURES, "0");
    }
    
    // Configstrings, которые обновляются при старте матча
    updateMatchStartConfigStrings() {
        this.configStrings.set(CS_CONSTANTS.CS_SCORES1, "0");
        this.configStrings.set(CS_CONSTANTS.CS_SCORES2, "0");
        this.configStrings.set(CS_CONSTANTS.CS_WARMUP, "0");
        this.configStrings.set(CS_CONSTANTS.CS_LEVEL_START_TIME, this.gameState.levelStartTime.toString());
    }
    
    // Обновление serverinfo
    updateServerInfo() {
        const gameType = this.gameState.gameType;
        const fragLimit = this.gameState.fragLimit;
        const captureLimit = this.gameState.captureLimit;
        const timeLimit = this.gameState.timeLimit;
        
        const serverInfo = `\\g_gametype\\${gameType}\\g_fraglimit\\${fragLimit}\\g_capturelimit\\${captureLimit}\\g_timelimit\\${timeLimit}\\g_maxGameClients\\0\\mapname\\q3dm1\\sv_hostname\\OSP2-BE Server Emulator\\sv_maxclients\\16`;
        
        // Обновляем только если изменилось
        const oldServerInfo = this.configStrings.get(CS_CONSTANTS.CS_SERVERINFO);
        if (oldServerInfo !== serverInfo) {
            this.configStrings.set(CS_CONSTANTS.CS_SERVERINFO, serverInfo);
            this.sendConfigStringUpdate(CS_CONSTANTS.CS_SERVERINFO, serverInfo);
        }
        
        this.configStrings.set(CS_CONSTANTS.CS_SYSTEMINFO, 
            `\\sv_punkbuster\\0\\sv_allowDownload\\1\\sv_floodProtect\\1\\sv_maxRate\\25000`);
    }
    
    // Обновление игровых настроек
    updateGameSettings() {
        // ВАЖНО: QVM проверяет эту версию через strcmp в CG_Init!
        // Должно быть СТРОГО "baseq3-1" (см. bg_public.h: #define GAME_VERSION "baseq3-1")
        this.configStrings.set(CS_CONSTANTS.CS_GAME_VERSION, "baseq3-1");
        this.configStrings.set(CS_CONSTANTS.CS_MOTD, "Welcome to OSP2-BE Server Emulator!");
        this.configStrings.set(CS_CONSTANTS.CS_LEVEL_START_TIME, this.gameState.levelStartTime.toString());
        this.configStrings.set(CS_CONSTANTS.CS_INTERMISSION, this.gameState.intermission ? "1" : "0");
        this.configStrings.set(CS_CONSTANTS.CS_WARMUP, this.gameState.warmupTime > 0 ? this.gameState.warmupTime.toString() : "");
        
        // OSP2-BE расширения
        this.configStrings.set(CS_CONSTANTS.CS_OSP_FREEZE_GAME_TYPE, "1");
        this.configStrings.set(CS_CONSTANTS.CS_OSP_CUSTOM_CLIENT2, "1");
        this.configStrings.set(CS_CONSTANTS.CS_OSP2BE_SUPPORTED, "1");
        this.configStrings.set(CS_CONSTANTS.CS_OSP2BE_DISABLED_FEATURES, "0");
    }
    
    // Добавление игрока с заданным ID
    addPlayer(id, name = null) {
        const playerName = name || `Player${id}`;
        const player = new VirtualPlayer(id, playerName);
        
        this.players.set(id, player);
        
        // Обновляем configstring для игрока
        this.updatePlayerConfigString(id);
        
        console.log(`[Server] Добавлен игрок: ${playerName} (ID: ${id})`);
        return player;
    }
    
    // Добавление виртуального игрока (автоматический ID)
    addVirtualPlayer(name = null) {
        const id = this.players.size;
        return this.addPlayer(id, name);
    }
    
    // Получение игрока по ID
    getPlayer(id) {
        return this.players.get(id);
    }
    
    // Подключение клиента (регистрация для получения снапшотов)
    connectClient(clientId) {
        if (!this.players.has(clientId)) {
            console.warn(`[Server] Попытка подключить несуществующего клиента ${clientId}`);
            return false;
        }
        
        this.connectedClients.add(clientId);
        console.log(`[Server] ✓ Клиент ${clientId} подключен (получает снапшоты)`);
        
        // Отправляем все configstrings новому клиенту (как в unite-q3-mod при ClientConnect)
        this.sendConfigStringsToClient(clientId);
        
        return true;
    }
    
    // Отключение клиента
    disconnectClient(clientId) {
        if (this.connectedClients.has(clientId)) {
            this.connectedClients.delete(clientId);
            console.log(`[Server] Клиент ${clientId} отключен`);
            return true;
        }
        return false;
    }
    
    // Удаление игрока
    removePlayer(id) {
        if (this.players.has(id)) {
            this.players.delete(id);
            this.connectedClients.delete(id); // Также удаляем из подключенных
            console.log(`[Server] Удален игрок с ID: ${id}`);
        }
    }
    
    // Обновление configstring игрока
    updatePlayerConfigString(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        const configString = `n\\${player.name}\\t\\${player.team}\\model\\sarge\\hmodel\\sarge\\g_redteam\\Red\\g_blueteam\\Blue\\c1\\4\\c2\\5\\hc\\100\\w\\0\\l\\0\\tt\\0\\tl\\0`;
        const oldValue = this.configStrings.get(CS_CONSTANTS.CS_PLAYERS + playerId);
        
        if (oldValue !== configString) {
            this.configStrings.set(CS_CONSTANTS.CS_PLAYERS + playerId, configString);
            // Отправляем обновление всем клиентам
            this.sendConfigStringUpdate(CS_CONSTANTS.CS_PLAYERS + playerId, configString);
        }
    }
    
    // Обновление всех configstrings
    updateConfigStrings() {
        // Обновляем время (всегда)
        this.configStrings.set(CS_CONSTANTS.CS_LEVEL_START_TIME, this.gameState.levelStartTime.toString());
        
        // Обновляем счета команд (только если есть изменения)
        this.updateTeamScores();
        
        // Обновляем configstrings игроков (только при изменениях)
        for (const [id, player] of this.players) {
            this.updatePlayerConfigString(id);
        }
        
        // Обновляем warmup (только при изменении)
        this.updateWarmupConfigString();
        
        // Проверяем лимиты
        this.checkGameLimits();
    }
    
    // Обновление warmup configstring
    updateWarmupConfigString() {
        if (this.gameState.warmupTime > 0) {
            this.configStrings.set(CS_CONSTANTS.CS_WARMUP, this.gameState.warmupTime.toString());
        } else {
            this.configStrings.set(CS_CONSTANTS.CS_WARMUP, "");
        }
    }
    
    // Обновление счетов команд
    updateTeamScores() {
        let redScore = 0, blueScore = 0;
        let redAlive = 0, blueAlive = 0;
        
        for (const player of this.players.values()) {
            if (player.team === TEAMS.TEAM_RED) {
                redScore += player.score;
                if (player.isAlive) redAlive++;
            } else if (player.team === TEAMS.TEAM_BLUE) {
                blueScore += player.score;
                if (player.isAlive) blueAlive++;
            }
        }
        
        this.gameState.teamScores = [redScore, blueScore];
        
        // Обновляем configstrings в зависимости от типа игры
        let scores1Value, scores2Value;
        
        if (this.gameState.gameType >= GAME_TYPES.GT_TEAM) {
            scores1Value = `${redScore} ${redAlive}`;
            scores2Value = `${blueScore} ${blueAlive}`;
        } else {
            // Для FFA/Tournament показываем только лучших игроков
            const sortedPlayers = Array.from(this.players.values())
                .sort((a, b) => b.score - a.score);
            
            if (sortedPlayers.length > 0) {
                scores1Value = sortedPlayers[0].score.toString();
                scores2Value = sortedPlayers.length > 1 ? sortedPlayers[1].score.toString() : "0";
            } else {
                scores1Value = "0";
                scores2Value = "0";
            }
        }
        
        // Обновляем только если значения изменились
        const oldScores1 = this.configStrings.get(CS_CONSTANTS.CS_SCORES1);
        const oldScores2 = this.configStrings.get(CS_CONSTANTS.CS_SCORES2);
        
        if (oldScores1 !== scores1Value) {
            this.configStrings.set(CS_CONSTANTS.CS_SCORES1, scores1Value);
            this.sendConfigStringUpdate(CS_CONSTANTS.CS_SCORES1, scores1Value);
        }
        
        if (oldScores2 !== scores2Value) {
            this.configStrings.set(CS_CONSTANTS.CS_SCORES2, scores2Value);
            this.sendConfigStringUpdate(CS_CONSTANTS.CS_SCORES2, scores2Value);
        }
    }
    
    // Проверка игровых лимитов
    checkGameLimits() {
        const now = Date.now();
        const gameTime = (now - this.gameState.levelStartTime) / 1000;
        
        // Проверка timelimit
        if (this.gameState.timeLimit > 0 && gameTime >= this.gameState.timeLimit * 60) {
            this.endGame('timelimit');
            return;
        }
        
        // Проверка fraglimit для командных игр
        if (this.gameState.gameType >= GAME_TYPES.GT_TEAM && this.gameState.fragLimit > 0) {
            if (this.gameState.teamScores[TEAMS.TEAM_RED] >= this.gameState.fragLimit) {
                this.endGame('fraglimit', 'red');
                return;
            }
            if (this.gameState.teamScores[TEAMS.TEAM_BLUE] >= this.gameState.fragLimit) {
                this.endGame('fraglimit', 'blue');
                return;
            }
        }
        
        // Проверка fraglimit для FFA
        if (this.gameState.gameType < GAME_TYPES.GT_TEAM && this.gameState.fragLimit > 0) {
            for (const player of this.players.values()) {
                if (player.score >= this.gameState.fragLimit) {
                    this.endGame('fraglimit', player.name);
                    return;
                }
            }
        }
        
        // Проверка capturelimit для CTF
        if (this.gameState.gameType === GAME_TYPES.GT_CTF && this.gameState.captureLimit > 0) {
            if (this.gameState.teamScores[TEAMS.TEAM_RED] >= this.gameState.captureLimit) {
                this.endGame('capturelimit', 'red');
                return;
            }
            if (this.gameState.teamScores[TEAMS.TEAM_BLUE] >= this.gameState.captureLimit) {
                this.endGame('capturelimit', 'blue');
                return;
            }
        }
    }
    
    // Завершение игры
    endGame(reason, winner = null) {
        this.gameState.intermission = true;
        this.gameState.matchState = 'intermission';
        
        console.log(`Игра завершена: ${reason}${winner ? ` (победитель: ${winner})` : ''}`);
        
        // Обновляем configstrings
        this.configStrings.set(CS_CONSTANTS.CS_INTERMISSION, "1");
        
        // Через 5 секунд перезапускаем игру
        setTimeout(() => {
            this.restartGame();
        }, 5000);
    }
    
    // Перезапуск игры
    restartGame() {
        this.gameState.intermission = false;
        this.gameState.matchState = 'warmup';
        this.gameState.levelStartTime = Date.now();
        this.gameState.teamScores = [0, 0];
        
        // Сбрасываем очки всех игроков
        for (const player of this.players.values()) {
            player.score = 0;
            player.frags = 0;
            player.deaths = 0;
            player.health = 100;
            player.isAlive = true;
        }
        
        // Обновляем configstrings при перезапуске
        this.updateMatchStartConfigStrings();
        this.configStrings.set(CS_CONSTANTS.CS_INTERMISSION, "0");
        console.log('Игра перезапущена');
    }
    
    // Симуляция подключения клиента
    simulateClientConnect(clientId) {
        this.connectedClients.add(clientId);
        console.log(`Клиент ${clientId} подключился`);
        
        // Отправляем все configstrings новому клиенту
        this.sendConfigStringsToClient(clientId);
    }
    
    // Симуляция отключения клиента
    simulateClientDisconnect(clientId) {
        this.connectedClients.delete(clientId);
        console.log(`Клиент ${clientId} отключился`);
    }
    
    // Отправка configstrings клиенту (как в unite-q3-mod при ClientConnect)
    sendConfigStringsToClient(clientId) {
        console.log(`[Server] Отправка ${this.configStrings.size} configstrings клиенту ${clientId}...`);
        
        // Детальный дебаг для важных configstrings
        const importantCS = [
            CS_CONSTANTS.CS_SERVERINFO,
            CS_CONSTANTS.CS_SYSTEMINFO,
            CS_CONSTANTS.CS_GAME_VERSION,
            CS_CONSTANTS.CS_LEVEL_START_TIME,
            CS_CONSTANTS.CS_INTERMISSION,
            CS_CONSTANTS.CS_WARMUP,
            CS_CONSTANTS.CS_SCORES1,
            CS_CONSTANTS.CS_SCORES2,
            CS_CONSTANTS.CS_FLAGSTATUS
        ];
        
        for (const csIndex of importantCS) {
            const value = this.configStrings.get(csIndex);
            if (value !== undefined && value !== '') {
                console.log(`[CS] CS${csIndex} -> Client${clientId}: "${value.substring(0, 100)}${value.length > 100 ? '...' : ''}"`);
            }
        }
        
        // Отправляем configstrings через callback если установлен
        if (this.onConfigStringsReady) {
            // ВАЖНО: Вызываем callback СИНХРОННО, чтобы configstrings были получены ДО возврата из функции
            console.log(`[Server] Вызов callback для отправки ${this.configStrings.size} configstrings...`);
            this.onConfigStringsReady(clientId, this.configStrings);
            console.log(`[Server] ✓ Configstrings отправлены клиенту ${clientId} через callback (синхронно)`);
        } else {
            console.warn(`[Server] ⚠ Callback onConfigStringsReady не установлен, configstrings не переданы клиенту`);
            console.warn(`[Server]   Это вызовет ошибку "game mismatch" в CG_Init!`);
        }
        
        return this.configStrings;
    }
    
    // Отправка измененного configstring всем клиентам
    sendConfigStringUpdate(index, value) {
        const connectedClients = Array.from(this.connectedClients);
        console.log(`[Server] Configstring ${index} обновлен: "${value.substring(0, 100)}${value.length > 100 ? '...' : ''}" для ${connectedClients.length} клиентов`);
        
        // Отправляем обновление через callback если установлен
        if (this.onConfigStringsReady) {
            // Создаем Map с одним обновленным configstring
            const updateMap = new Map();
            updateMap.set(index, value);
            
            // Отправляем всем подключенным клиентам
            for (const clientId of connectedClients) {
                // Отправляем обновление каждому клиенту
                // (в реальном сервере это делается через отдельный механизм обновления CS)
                // Но для простоты можем передавать полный набор configstrings с обновлением
                this.onConfigStringsReady(clientId, updateMap);
            }
        }
        
        return {
            index: index,
            value: value,
            clients: connectedClients
        };
    }
    
    // Создание снапа в формате Q3
    createSnapshot() {
        const snapshot = {
            // Метаданные снапшота
            snapFlags: 0, // SNAPFLAG_NOT_ACTIVE = 2
            ping: 0,
            serverTime: this.serverTime, // Игровое время (увеличивается на tickDelta каждый тик)
            areamask: new Array(32).fill(0),
            
            // PlayerState (данные локального игрока)
            ps: null,
            
            // Entities (все сущности в мире)
            entities: [],
            numEntities: 0,
            
            // Server commands
            numServerCommands: this.serverCommands.length,
            serverCommandSequence: this.serverCommandSequence
        };
        
        // Если есть хотя бы один игрок, создаём playerState из первого
        const playersArray = Array.from(this.players.values());
        if (playersArray.length > 0) {
            const localPlayer = playersArray[0]; // Локальный игрок (для клиента)
            
            // Создаём playerState в формате Q3
            snapshot.ps = {
                clientNum: localPlayer.id,
                origin: [...localPlayer.origin],
                velocity: [...localPlayer.velocity],
                viewangles: [...localPlayer.angles],
                weapon: localPlayer.weapon,
                pm_type: localPlayer.pm_type,
                pm_flags: localPlayer.pm_flags,
                pm_time: localPlayer.pm_time,
                
                // Stats array (STAT_HEALTH=5, STAT_ARMOR=6, STAT_WEAPONS=7)
                stats: new Array(16).fill(0)
            };
            
            // Заполняем stats
            snapshot.ps.stats[5] = localPlayer.health; // STAT_HEALTH
            snapshot.ps.stats[6] = localPlayer.armor;  // STAT_ARMOR
            snapshot.ps.stats[7] = localPlayer.weapon; // STAT_WEAPONS
        }
        
        // Добавляем все сущности (игроков)
        for (const player of this.players.values()) {
            const entity = {
                number: player.id,
                eType: 1, // ET_PLAYER
                eFlags: 0,
                origin: [...player.origin],
                angles: [...player.angles],
                weapon: player.weapon,
                clientNum: player.id,
                
                // Дополнительные поля
                pos: {
                    trType: 0, // TR_STATIONARY
                    trTime: 0,
                    trDuration: 0,
                    trBase: [...player.origin],
                    trDelta: [...player.velocity]
                },
                
                apos: {
                    trType: 0,
                    trTime: 0,
                    trDuration: 0,
                    trBase: [...player.angles],
                    trDelta: [0, 0, 0]
                }
            };
            
            snapshot.entities.push(entity);
        }
        
        snapshot.numEntities = snapshot.entities.length;
        
        // Создаем Map с данными игроков для удобства (ключ: clientNum)
        snapshot.players = new Map();
        for (const player of this.players.values()) {
            snapshot.players.set(player.id, {
                clientNum: player.id,
                health: player.health,
                armor: player.armor,
                weapon: player.weapon,
                origin: [...player.origin],
                velocity: [...player.velocity],
                angles: [...player.angles]
            });
        }
        
        return snapshot;
    }
    
    // Отправка снапа (симуляция)
    sendSnapshot() {
        const snapshot = this.createSnapshot();
        const connectedClients = Array.from(this.connectedClients);
        
        // Снапы отправляются только подключенным клиентам
        if (connectedClients.length === 0) {
            console.log(`[${new Date().toLocaleTimeString()}] Snapshot: нет подключенных клиентов`);
            return snapshot;
        }
        
        // Отправляем снап каждому клиенту
        // Логируем только снапшоты с командами (чтобы не спамить)
        if (snapshot.serverCommandSequence > 0) {
            for (const clientId of connectedClients) {
                console.log(`[${new Date().toLocaleTimeString()}] Snapshot с командами #${clientId}:`, {
                    seq: snapshot.serverCommandSequence,
                    serverTime: snapshot.serverTime
                });
            }
        }
        
        // Вызываем callback если есть
        if (this.onSnapshot) {
            this.onSnapshot(snapshot, connectedClients);
        }
        
        return snapshot;
    }
    
    // Запуск эмулятора
    start(updateIntervalMs = 1000) {
        if (this.isRunning) {
            console.log("Эмулятор уже запущен");
            return;
        }
        
        this.isRunning = true;
        this.tickDelta = updateIntervalMs; // Устанавливаем приращение времени
        console.log(`Запуск эмулятора сервера (обновление каждые ${updateIntervalMs}ms, serverTime += ${updateIntervalMs}ms)`);
        
        this.updateInterval = setInterval(() => {
            // Увеличиваем игровое время на фиксированное значение
            this.serverTime += this.tickDelta;
            
            // Обновляем всех игроков
            for (const player of this.players.values()) {
                player.update();
            }
            
            // Автоматическая симуляция событий
            this.simulateRandomEvents();
            
            // Обновляем configstrings
            this.updateConfigStrings();
            
            // Отправляем снап
            this.sendSnapshot();
            
        }, updateIntervalMs);
    }
    
    // Остановка эмулятора
    stop() {
        if (!this.isRunning) {
            console.log("Эмулятор не запущен");
            return;
        }
        
        this.isRunning = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        // Сбрасываем серверное время
        this.serverTime = 0;
        
        console.log("Эмулятор сервера остановлен");
    }
    
    // Получение статистики
    getStats() {
        return {
            isRunning: this.isRunning,
            playersCount: this.players.size,
            gameState: this.gameState,
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                health: p.health,
                score: p.score,
                team: p.team
            }))
        };
    }
    
    // Установка callback для снапов
    setSnapshotCallback(callback) {
        this.onSnapshot = callback;
    }
    
    // Изменение игрового типа
    setGameType(gameType) {
        if (gameType >= 0 && gameType < 8) {
            this.gameState.gameType = gameType;
            this.updateServerInfo();
            
            // Обновляем команды игроков в зависимости от режима
            this.updatePlayerTeams(gameType);
            
            console.log(`Игровой тип изменен на: ${this.getGameTypeName(gameType)}`);
        }
    }
    
    // Обновление команд игроков в зависимости от режима игры
    updatePlayerTeams(gameType) {
        for (const player of this.players.values()) {
            if (gameType >= GAME_TYPES.GT_TEAM) {
                // Для командных режимов: TEAM_RED, TEAM_BLUE, TEAM_SPECTATOR
                if (player.team === TEAMS.TEAM_FREE) {
                    // Случайно назначаем команду для свободных игроков
                    player.team = Math.random() < 0.5 ? TEAMS.TEAM_RED : TEAMS.TEAM_BLUE;
                }
            } else {
                // Для FFA режимов: TEAM_FREE, TEAM_SPECTATOR
                if (player.team === TEAMS.TEAM_RED || player.team === TEAMS.TEAM_BLUE) {
                    player.team = TEAMS.TEAM_FREE;
                }
            }
        }
    }
    
    // Изменение лимитов
    setFragLimit(limit) {
        this.gameState.fragLimit = Math.max(0, limit);
        this.updateServerInfo();
        console.log(`Frag limit установлен: ${this.gameState.fragLimit}`);
    }
    
    setCaptureLimit(limit) {
        this.gameState.captureLimit = Math.max(0, limit);
        this.updateServerInfo();
        console.log(`Capture limit установлен: ${this.gameState.captureLimit}`);
    }
    
    setTimeLimit(limit) {
        this.gameState.timeLimit = Math.max(0, limit);
        this.updateServerInfo();
        console.log(`Time limit установлен: ${this.gameState.timeLimit} минут`);
    }
    
    // Получение названия игрового типа
    getGameTypeName(gameType) {
        const names = {
            [GAME_TYPES.GT_FFA]: 'Free For All',
            [GAME_TYPES.GT_TOURNAMENT]: 'Tournament',
            [GAME_TYPES.GT_SINGLE_PLAYER]: 'Single Player',
            [GAME_TYPES.GT_TEAM]: 'Team Deathmatch',
            [GAME_TYPES.GT_CTF]: 'Capture The Flag',
            [GAME_TYPES.GT_1FCTF]: 'One Flag CTF',
            [GAME_TYPES.GT_OBELISK]: 'Obelisk',
            [GAME_TYPES.GT_HARVESTER]: 'Harvester'
        };
        return names[gameType] || 'Unknown';
    }
    
    // Симуляция захвата флага (для CTF)
    simulateFlagCapture(team) {
        if (this.gameState.gameType === GAME_TYPES.GT_CTF) {
            if (team === TEAMS.TEAM_RED) {
                this.gameState.teamScores[TEAMS.TEAM_RED]++;
            } else if (team === TEAMS.TEAM_BLUE) {
                this.gameState.teamScores[TEAMS.TEAM_BLUE]++;
            }
            
            // Обновляем CS_FLAGSTATUS
            this.updateFlagStatus();
            
            console.log(`Флаг захвачен командой: ${team === TEAMS.TEAM_RED ? 'Red' : 'Blue'}`);
        }
    }
    
    // Обновление статуса флагов
    updateFlagStatus() {
        if (this.gameState.gameType === GAME_TYPES.GT_CTF) {
            // Формат: "red_flag_status blue_flag_status"
            // 0 = на базе, 1 = захвачен, 2 = сброшен
            const redFlagStatus = this.gameState.teamScores[TEAMS.TEAM_RED] > 0 ? "1" : "0";
            const blueFlagStatus = this.gameState.teamScores[TEAMS.TEAM_BLUE] > 0 ? "1" : "0";
            const flagStatus = `${redFlagStatus} ${blueFlagStatus}`;
            
            const oldFlagStatus = this.configStrings.get(CS_CONSTANTS.CS_FLAGSTATUS);
            if (oldFlagStatus !== flagStatus) {
                this.configStrings.set(CS_CONSTANTS.CS_FLAGSTATUS, flagStatus);
                this.sendConfigStringUpdate(CS_CONSTANTS.CS_FLAGSTATUS, flagStatus);
            }
        }
    }
    
    // Симуляция сброса флага
    simulateFlagReturn(team) {
        if (this.gameState.gameType === GAME_TYPES.GT_CTF) {
            console.log(`Флаг сброшен командой: ${team === TEAMS.TEAM_RED ? 'Red' : 'Blue'}`);
            // Обновляем статус флагов
            this.updateFlagStatus();
        }
    }
    
    // Изменение HP игрока
    changePlayerHealth(playerId, amount) {
        const player = this.players.get(playerId);
        if (player) {
            player.health = Math.max(1, Math.min(200, player.health + amount));
            console.log(`${player.name} HP изменено на ${amount}: ${player.health}`);
            return player.health;
        }
        return null;
    }
    
    // Изменение брони игрока
    changePlayerArmor(playerId, amount) {
        const player = this.players.get(playerId);
        if (player) {
            player.armor = Math.max(0, Math.min(200, player.armor + amount));
            console.log(`${player.name} Armor изменено на ${amount}: ${player.armor}`);
            return player.armor;
        }
        return null;
    }
    
    // Получение списка игроков для выбора
    getPlayersList() {
        return Array.from(this.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            health: p.health,
            armor: p.armor
        }));
    }
    
    // Симуляция фрага
    simulateFrag(killerId, victimId) {
        const killer = this.players.get(killerId);
        const victim = this.players.get(victimId);
        
        if (killer && victim && killer !== victim) {
            killer.score++;
            killer.frags++;
            victim.deaths++;
            victim.health = 0;
            victim.isAlive = false;
            
            // Возрождение через 3 секунды
            setTimeout(() => {
                victim.health = 100;
                victim.isAlive = true;
            }, 3000);
            
            console.log(`${killer.name} убил ${victim.name} (${killer.score} фрагов)`);
        }
    }
    
    // Автоматическая симуляция случайных событий
    simulateRandomEvents() {
        if (this.players.size < 2) return;
        
        const players = Array.from(this.players.values());
        
        // Случайные фраги между игроками
        if (Math.random() < 0.02) { // 2% шанс
            const killer = players[Math.floor(Math.random() * players.length)];
            const victim = players[Math.floor(Math.random() * players.length)];
            if (killer !== victim) {
                this.simulateFrag(killer.id, victim.id);
            }
        }
        
        // Случайные захваты флагов для CTF
        if (this.gameState.gameType === GAME_TYPES.GT_CTF && Math.random() < 0.01) { // 1% шанс
            const team = Math.random() < 0.5 ? TEAMS.TEAM_RED : TEAMS.TEAM_BLUE;
            this.simulateFlagCapture(team);
        }
        
        // Случайные изменения команд игроков
        if (this.gameState.gameType >= GAME_TYPES.GT_TEAM && Math.random() < 0.005) { // 0.5% шанс
            const player = players[Math.floor(Math.random() * players.length)];
            player.team = player.team === TEAMS.TEAM_RED ? TEAMS.TEAM_BLUE : TEAMS.TEAM_RED;
            this.updatePlayerConfigString(player.id);
            console.log(`${player.name} сменил команду на ${player.team === TEAMS.TEAM_RED ? 'Red' : 'Blue'}`);
        }
    }
    
    // ========== SERVER COMMANDS ==========
    
    // Отправка серверной команды клиенту
    sendServerCommand(clientId, commandString) {
        this.serverCommandSequence++;
        
        const command = {
            sequence: this.serverCommandSequence,
            clientId: clientId,
            command: commandString,
            time: Date.now()
        };
        
        // Сохраняем в историю
        this.serverCommands.push(command);
        
        // Ограничиваем размер истории
        if (this.serverCommands.length > 100) {
            this.serverCommands.shift();
        }
        
        console.log(`[SERVER CMD #${command.sequence}] -> Client ${clientId}: ${commandString}`);
        
        // Вызываем callback если установлен
        if (this.onServerCommand) {
            this.onServerCommand(command);
        }
        
        return command;
    }
    
    // Отправка команды всем подключенным клиентам
    sendServerCommandToAll(commandString) {
        const commands = [];
        for (const clientId of this.connectedClients) {
            commands.push(this.sendServerCommand(clientId, commandString));
        }
        return commands;
    }
    
    // Отправка команды xstats1 для игрока
    sendXStats1(targetClientId, requestingClientId = null) {
        // Если не указан запрашивающий клиент, отправляем всем подключенным
        if (requestingClientId === null) {
            for (const clientId of this.connectedClients) {
                this.sendXStats1(targetClientId, clientId);
            }
            return;
        }
        
        const player = this.players.get(targetClientId);
        if (!player) {
            console.warn(`[xstats1] Игрок ${targetClientId} не найден`);
            return;
        }
        
        // Генерируем тестовые данные статистики
        const stats = this.generatePlayerStats(player);
        
        // Формируем команду в формате unite-q3-mod
        // xstats1 <client_id> <weapon_condition> [weapon_data...] <armor> <health> <dmgGiven> <dmgRcvd> <mh> <ga> <ra> <ya>
        
        let args = `${targetClientId} ${stats.weaponCondition}`;
        
        // Добавляем данные по оружию
        for (let w = 1; w < 10; w++) {
            if ((stats.weaponCondition & (1 << w)) !== 0) {
                const weapon = stats.weapons[w];
                args += ` ${weapon.hits_val} ${weapon.atts_val} ${weapon.kills} ${weapon.deaths}`;
            }
        }
        
        // Добавляем общую статистику
        args += ` ${stats.armorTaken} ${stats.healthTaken} ${stats.damageGiven} ${stats.damageReceived}`;
        args += ` ${stats.megaHealth} ${stats.greenArmor} ${stats.redArmor} ${stats.yellowArmor}`;
        
        const commandString = `xstats1 ${args}`;
        this.sendServerCommand(requestingClientId, commandString);
        
        console.log(`[xstats1] Отправлена статистика игрока ${player.name} (ID:${targetClientId}) клиенту ${requestingClientId}`);
    }
    
    // Генерация реалистичных статистических данных для игрока
    generatePlayerStats(player) {
        const stats = {
            weaponCondition: 0, // Битовая маска используемых оружий
            weapons: {},
            armorTaken: Math.floor(Math.random() * 500),
            healthTaken: Math.floor(Math.random() * 300),
            damageGiven: Math.floor(Math.random() * 2000) + 500,
            damageReceived: Math.floor(Math.random() * 1800) + 400,
            megaHealth: Math.floor(Math.random() * 5),
            greenArmor: Math.floor(Math.random() * 3),
            redArmor: Math.floor(Math.random() * 4),
            yellowArmor: Math.floor(Math.random() * 2)
        };
        
        // Генерируем статистику для нескольких оружий (1-9)
        const weaponsToGenerate = [1, 2, 3, 6, 7, 8]; // gauntlet, machinegun, shotgun, rocket, lightning, railgun
        
        for (const weaponId of weaponsToGenerate) {
            stats.weaponCondition |= (1 << weaponId);
            
            const shots = Math.floor(Math.random() * 200) + 50;
            const hits = Math.floor(shots * (0.2 + Math.random() * 0.5)); // 20-70% точность
            const kills = Math.floor(Math.random() * 20);
            const deaths = Math.floor(Math.random() * 15);
            const pickups = Math.floor(Math.random() * 10);
            const drops = Math.floor(Math.random() * 5);
            
            // Формируем значения как в unite-q3-mod:
            // hits_val = (hits & 0xFFFF) | (drops << 16)
            // atts_val = (shots & 0xFFFF) | (pickups << 16)
            const hits_val = (hits & 0xFFFF) | (drops << 16);
            const atts_val = (shots & 0xFFFF) | (pickups << 16);
            
            stats.weapons[weaponId] = {
                hits_val: hits_val,
                atts_val: atts_val,
                kills: kills,
                deaths: deaths
            };
        }
        
        return stats;
    }
    
    // Установка callback для серверных команд
    setServerCommandCallback(callback) {
        this.onServerCommand = callback;
    }
    
    // Установка callback для configstrings
    setConfigStringsCallback(callback) {
        this.onConfigStringsReady = callback;
        console.log('[Server] Callback для configstrings установлен');
        
        // ВАЖНО: Если есть уже подключенные клиенты, сразу отправляем им configstrings
        // (на случай если они подключились до установки callback)
        for (const clientId of this.connectedClients) {
            console.log(`[Server] Отправка configstrings клиенту ${clientId} (callback только что установлен)`);
            this.sendConfigStringsToClient(clientId);
        }
    }
}

// Глобальный экземпляр эмулятора
let serverEmulator = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    serverEmulator = new Q3ServerEmulator();
    window.serverEmulator = serverEmulator; // Экспорт в глобальную область
    console.log('Q3 Server Emulator инициализирован');
});

// Глобальные функции для управления эмулятором
window.startServerEmulator = function(interval = 1000) {
    if (serverEmulator) {
        serverEmulator.start(interval);
    }
};

window.stopServerEmulator = function() {
    if (serverEmulator) {
        serverEmulator.stop();
    }
};

window.addVirtualPlayer = function(name) {
    if (serverEmulator) {
        return serverEmulator.addVirtualPlayer(name);
    }
};

window.removeVirtualPlayer = function(id) {
    if (serverEmulator) {
        serverEmulator.removePlayer(id);
    }
};

window.getServerStats = function() {
    if (serverEmulator) {
        return serverEmulator.getStats();
    }
    return null;
};

window.setSnapshotCallback = function(callback) {
    if (serverEmulator) {
        serverEmulator.setSnapshotCallback(callback);
    }
};

// Управление игровыми настройками
window.setGameType = function(gameType) {
    if (serverEmulator) {
        serverEmulator.setGameType(gameType);
    }
};

window.setFragLimit = function(limit) {
    if (serverEmulator) {
        serverEmulator.setFragLimit(limit);
    }
};

window.setCaptureLimit = function(limit) {
    if (serverEmulator) {
        serverEmulator.setCaptureLimit(limit);
    }
};

window.setTimeLimit = function(limit) {
    if (serverEmulator) {
        serverEmulator.setTimeLimit(limit);
    }
};

window.simulateFlagCapture = function(team) {
    if (serverEmulator) {
        serverEmulator.simulateFlagCapture(team);
    }
};

window.simulateFlagReturn = function(team) {
    if (serverEmulator) {
        serverEmulator.simulateFlagReturn(team);
    }
};

window.simulateFrag = function(killerId, victimId) {
    if (serverEmulator) {
        serverEmulator.simulateFrag(killerId, victimId);
    }
};

// Симуляция клиентов
window.simulateClientConnect = function(clientId) {
    if (serverEmulator) {
        serverEmulator.simulateClientConnect(clientId);
    }
};

window.simulateClientDisconnect = function(clientId) {
    if (serverEmulator) {
        serverEmulator.simulateClientDisconnect(clientId);
    }
};

// Управление HP/броней игроков
let selectedPlayerId = 0;

window.setSelectedPlayer = function(playerId) {
    selectedPlayerId = playerId;
    updateSelectedPlayerDisplay();
};

window.changePlayerHealth = function(amount) {
    if (serverEmulator) {
        const newHealth = serverEmulator.changePlayerHealth(selectedPlayerId, amount);
        if (newHealth !== null) {
            updateServerStats();
        }
    }
};

window.changePlayerArmor = function(amount) {
    if (serverEmulator) {
        const newArmor = serverEmulator.changePlayerArmor(selectedPlayerId, amount);
        if (newArmor !== null) {
            updateServerStats();
        }
    }
};

window.updateSelectedPlayerDisplay = function() {
    const displayElement = document.getElementById('selectedPlayerDisplay');
    if (displayElement && serverEmulator) {
        const players = serverEmulator.getPlayersList();
        const selectedPlayer = players.find(p => p.id === selectedPlayerId);
        
        if (selectedPlayer) {
            displayElement.innerHTML = `
                <strong>Выбранный игрок:</strong> ${selectedPlayer.name} (ID:${selectedPlayer.id})<br>
                <strong>HP:</strong> ${selectedPlayer.health} | <strong>Armor:</strong> ${selectedPlayer.armor}
            `;
        } else {
            displayElement.innerHTML = '<strong>Нет выбранного игрока</strong>';
        }
    }
};

// ========== SERVER COMMANDS API ==========

// Отправка произвольной серверной команды
window.sendServerCommand = function(clientId, commandString) {
    if (serverEmulator) {
        return serverEmulator.sendServerCommand(clientId, commandString);
    }
    console.error('[sendServerCommand] Эмулятор не инициализирован');
    return null;
};

// Отправка команды всем клиентам
window.sendServerCommandToAll = function(commandString) {
    if (serverEmulator) {
        return serverEmulator.sendServerCommandToAll(commandString);
    }
    console.error('[sendServerCommandToAll] Эмулятор не инициализирован');
    return null;
};

// Отправка xstats1 для игрока
window.sendXStats1 = function(targetClientId, requestingClientId = null) {
    if (serverEmulator) {
        serverEmulator.sendXStats1(targetClientId, requestingClientId);
        return true;
    }
    console.error('[sendXStats1] Эмулятор не инициализирован');
    return false;
};

// Установка callback для серверных команд
window.setServerCommandCallback = function(callback) {
    if (serverEmulator) {
        serverEmulator.setServerCommandCallback(callback);
        console.log('[Server] Server command callback установлен');
        return true;
    }
    console.error('[setServerCommandCallback] Эмулятор не инициализирован');
    return false;
};

// Получить историю серверных команд
window.getServerCommands = function(limit = 10) {
    if (serverEmulator) {
        const commands = serverEmulator.serverCommands.slice(-limit);
        console.table(commands);
        return commands;
    }
    console.error('[getServerCommands] Эмулятор не инициализирован');
    return [];
};

// Экспорт для браузера
if (typeof window !== 'undefined') {
    window.Q3ServerEmulator = Q3ServerEmulator;
    window.VirtualPlayer = VirtualPlayer;
    window.CS_CONSTANTS = CS_CONSTANTS;
    window.GAME_TYPES = GAME_TYPES;
    window.PLAYER_STATES = PLAYER_STATES;
    window.TEAMS = TEAMS;
}

// Экспорт для Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Q3ServerEmulator, VirtualPlayer, CS_CONSTANTS, GAME_TYPES, PLAYER_STATES, TEAMS };
}

console.log('[Q3 Server Emulator] Модуль загружен ✓');
