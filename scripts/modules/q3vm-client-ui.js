/**
 * Q3VM Client UI
 * 
 * UI для управления Q3VM клиентом
 * Замена старого client-emulator-ui.js
 * 
 * Features:
 * - Q3VM Client control (start/stop, analysis, dump)
 * - Server Emulator control (start/stop, add bots, player info)
 * - Real-time player stats display (health, armor, weapon)
 * - Integration with VirtualPlayer from server
 * 
 * Version: 1.0.2
 */

/**
 * Инициализация и запуск Q3VM клиента (V2 - автоматический выбор WASM/JS)
 */
window.initAndStartQ3VMClient = async function() {
    const button = document.getElementById('initClientButton');
    const status = document.getElementById('clientStatus');
    const canvas = document.getElementById('clientCanvas');
    
    if (!canvas) {
        console.error('[Q3VM UI] Canvas не найден!');
        updateStatus('clientStatus', 'Ошибка: Canvas не найден', 'error');
        return;
    }
    
    // ВАЖНО: Проверяем что сервер запущен
    if (!globalQ3Server) {
        addLogEntry('[Q3VM V2] ✗ Сервер не запущен!', 'error');
        addLogEntry('[Q3VM V2] Сначала запустите сервер (кнопка "▶️ Запустить сервер")', 'warning');
        updateStatus('clientStatus', 'Ошибка: Сервер не запущен', 'error');
        
        if (button) {
            button.textContent = '⚠️ Сначала запустите сервер';
            button.style.background = '#ff9800';
            setTimeout(() => {
                button.textContent = '🎮 Запустить Q3VM клиент';
                button.style.background = '#4CAF50';
            }, 3000);
        }
        return;
    }
    
    if (!globalQ3Server.isRunning) {
        addLogEntry('[Q3VM V2] ✗ Сервер не работает!', 'error');
        addLogEntry('[Q3VM V2] Сервер создан, но остановлен. Запустите его.', 'warning');
        updateStatus('clientStatus', 'Ошибка: Сервер остановлен', 'error');
        
        if (button) {
            button.textContent = '⚠️ Сервер остановлен';
            button.style.background = '#ff9800';
            setTimeout(() => {
                button.textContent = '🎮 Запустить Q3VM клиент';
                button.style.background = '#4CAF50';
            }, 3000);
        }
        return;
    }
    
    try {
        if (button) {
            button.disabled = true;
            button.textContent = '⏳ Загрузка...';
        }
        
        updateStatus('clientStatus', 'Загрузка Q3VM...', 'info');
        addLogEntry('[Q3VM V2] ═══════════════════════════════════', 'info');
        addLogEntry('[Q3VM V2] Подключение к серверу...', 'info');
        addLogEntry('[Q3VM V2] Запуск Q3VM (WASM или JS)...', 'info');
        
        // Создаем и инициализируем Q3VM клиент V2 с подключением к серверу
        // ВАЖНО: connectClient вызывается ВНУТРИ createQ3VMClientV2 ДО инициализации QVM
        // Это нужно чтобы configstrings были отправлены до того, как CG_Init вызовет trap_GetGameState
        const q3vmClient = await createQ3VMClientV2(canvas, globalQ3Server);
        
        // Клиент уже зарегистрирован на сервере в createQ3VMClientV2, здесь ничего делать не нужно
        
        addLogEntry('[Q3VM V2] ═══════════════════════════════════', 'success');
        addLogEntry('[Q3VM V2] ✓ Q3VM клиент инициализирован!', 'success');
        
        // Выводим информацию о клиенте
        const clientStatus = q3vmClient.getStatus();
        addLogEntry(`[Q3VM V2] Тип VM: ${clientStatus.vmType ? clientStatus.vmType.toUpperCase() : 'Unknown'}`, 'info');
        addLogEntry(`[Q3VM V2] Client ID: ${clientStatus.clientNum}`, 'info');
        addLogEntry(`[Q3VM V2] Server Time: ${clientStatus.serverTime}`, 'info');
        
        if (clientStatus.vmStats) {
            if (clientStatus.vmStats.instructions) {
                addLogEntry(`[Q3VM V2] VM - Инструкций: ${clientStatus.vmStats.instructions}`, 'info');
                addLogEntry(`[Q3VM V2] VM - Syscalls: ${clientStatus.vmStats.syscalls}`, 'info');
            }
            if (clientStatus.vmStats.type) {
                addLogEntry(`[Q3VM V2] VM - Тип: ${clientStatus.vmStats.type}`, 'info');
            }
        }
        
        // Запускаем рендеринг
        addLogEntry('[Q3VM V2] Запуск рендеринга...', 'info');
        q3vmClient.startRendering();
        
        addLogEntry('[Q3VM V2] ✓ Рендеринг запущен!', 'success');
        addLogEntry('[Q3VM V2] ═══════════════════════════════════', 'success');
        
        const vmTypeEmoji = clientStatus.vmType === 'wasm' ? '🚀' : '🐌';
        updateStatus('clientStatus', `${vmTypeEmoji} Q3VM ${clientStatus.vmType ? clientStatus.vmType.toUpperCase() : ''} работает`, 'success');
        
        if (button) {
            button.textContent = `✓ ${clientStatus.vmType ? clientStatus.vmType.toUpperCase() : ''} запущен`;
            button.style.background = clientStatus.vmType === 'wasm' ? '#00C853' : '#4CAF50';
        }
        
        // Обновляем информацию о клиенте
        updateQ3VMClientInfo();
        
    } catch (error) {
        console.error('[Q3VM UI] Ошибка:', error);
        addLogEntry(`[Q3VM V2] ✗ Ошибка: ${error.message}`, 'error');
        updateStatus('clientStatus', `Ошибка: ${error.message}`, 'error');
        
        if (button) {
            button.disabled = false;
            button.textContent = '✗ Ошибка';
            button.style.background = '#f44336';
            
            setTimeout(() => {
                button.textContent = '🎮 Запустить Q3VM клиент';
                button.style.background = '#4CAF50';
            }, 3000);
        }
    }
};

/**
 * Остановка Q3VM клиента
 */
window.stopQ3VMClient = function() {
    const q3vmClient = getQ3VMClientV2();
    
    if (!q3vmClient) {
        addLogEntry('[Q3VM] Клиент не запущен', 'warning');
        return;
    }
    
    // Отключаем клиента от сервера
    if (globalQ3Server) {
        globalQ3Server.disconnectClient(0);
    }
    
    addLogEntry('[Q3VM] Остановка клиента...', 'info');
    q3vmClient.shutdown();
    
    updateStatus('clientStatus', 'Q3VM клиент остановлен', 'info');
    addLogEntry('[Q3VM] ✓ Клиент остановлен', 'info');
    
    const button = document.getElementById('initClientButton');
    if (button) {
        button.textContent = '🎮 Запустить Q3VM клиент';
        button.style.background = '#4CAF50';
        button.disabled = false;
    }
};

/**
 * Обновление информации о Q3VM клиенте
 */
function updateQ3VMClientInfo() {
    const infoElement = document.getElementById('clientInfo');
    const q3vmClient = getQ3VMClientV2();
    
    if (!infoElement || !q3vmClient) return;
    
    const status = q3vmClient.getStatus();
    
    const vmTypeIcon = status.vmType === 'wasm' ? '🚀' : status.vmType === 'js' ? '🐌' : '❓';
    const vmTypeName = status.vmType ? status.vmType.toUpperCase() : 'Unknown';
    
    let html = '<div style="font-family: monospace; font-size: 12px; color: #ccc;">';
    html += `<div>${vmTypeIcon} <strong>Q3VM ${vmTypeName} Статус:</strong></div>`;
    html += `<div style="margin-left: 20px;">`;
    html += `  • Инициализирован: ${status.isInitialized ? '✓' : '✗'}</div>`;
    html += `<div style="margin-left: 20px;">`;
    html += `  • Рендеринг: ${status.isRunning ? '✓' : '✗'}</div>`;
    html += `<div style="margin-left: 20px;">`;
    html += `  • Тип VM: ${vmTypeName}</div>`;
    html += `<div style="margin-left: 20px;">`;
    html += `  • Client ID: ${status.clientNum}</div>`;
    html += `<div style="margin-left: 20px;">`;
    html += `  • Server Time: ${status.serverTime}ms</div>`;
    html += `<div style="margin-left: 20px;">`;
    html += `  • VM: ${status.hasVM ? '✓' : '✗'}</div>`;
    
    if (status.vmStats) {
        html += `<div style="margin-top: 10px;">📊 <strong>Статистика VM:</strong></div>`;
        
        if (status.vmStats.type) {
            html += `<div style="margin-left: 20px;">`;
            html += `  • Тип: ${status.vmStats.type}</div>`;
        }
        
        if (status.vmStats.instructions) {
            html += `<div style="margin-left: 20px;">`;
            html += `  • Инструкций: ${status.vmStats.instructions}</div>`;
            html += `<div style="margin-left: 20px;">`;
            html += `  • Syscalls: ${status.vmStats.syscalls}</div>`;
            html += `<div style="margin-left: 20px;">`;
            html += `  • Вызовов функций: ${status.vmStats.calls}</div>`;
            html += `<div style="margin-left: 20px;">`;
            html += `  • Прыжков: ${status.vmStats.jumps}</div>`;
        }
    }
    
    html += '</div>';
    
    infoElement.innerHTML = html;
}

/**
 * Дамп информации Q3VM (для отладки)
 */
window.dumpQ3VMInfo = function() {
    const q3vmClient = getQ3VMClientV2();
    
    if (!q3vmClient) {
        console.log('[Q3VM] Клиент не запущен');
        return;
    }
    
    q3vmClient.dump();
};

/**
 * Дизассемблирование кода (для отладки)
 */
window.disassembleQ3VM = function(start = 0, count = 50) {
    const q3vmClient = getQ3VMClientV2();
    
    if (!q3vmClient) {
        console.log('[Q3VM] Клиент не запущен');
        return;
    }
    
    q3vmClient.loader.disassemble(start, count);
};

/**
 * Скачать анализ QVM модуля
 */
window.downloadQ3VMAnalysis = function() {
    const q3vmClient = getQ3VMClientV2();
    
    if (!q3vmClient) {
        addLogEntry('[Q3VM] Клиент не запущен', 'error');
        return;
    }
    
    const analysis = q3vmClient.loader.analyzeModule();
    const status = q3vmClient.getStatus();
    
    const report = {
        timestamp: new Date().toISOString(),
        status: status,
        analysis: analysis,
        syscalls: q3vmClient.syscallHandler.getSyscallStats()
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'q3vm-analysis.json';
    a.click();
    URL.revokeObjectURL(url);
    
    addLogEntry('[Q3VM] Анализ сохранен: q3vm-analysis.json', 'success');
};

// Обновляем информацию каждые 500ms
setInterval(() => {
    const q3vmClient = getQ3VMClientV2();
    
    // Обновляем инфо клиента если он запущен
    if (q3vmClient && q3vmClient.isRunning) {
        updateQ3VMClientInfo();
    }
    
    // Обновляем информацию о сервере если он создан (независимо от клиента)
    if (globalQ3Server) {
        updateServerInfo();
    }
}, 500);

/**
 * ═══════════════════════════════════════════════════════════════
 *  УПРАВЛЕНИЕ СЕРВЕРОМ
 * ═══════════════════════════════════════════════════════════════
 */

// Глобальный сервер (независимый от клиента)
let globalQ3Server = null;

/**
 * Создание и запуск независимого сервера
 */
window.startClientServer = function() {
    // Проверяем доступность Q3ServerEmulator
    if (typeof window.Q3ServerEmulator === 'undefined') {
        addLogEntry('[Server] ⚠ Q3ServerEmulator недоступен', 'error');
        updateStatus('serverStatus', 'Модуль недоступен', 'error');
        return;
    }
    
    // Создаем сервер если еще не создан
    if (!globalQ3Server) {
        globalQ3Server = new window.Q3ServerEmulator();
        // Добавляем локального игрока
        globalQ3Server.addPlayer(0, 'LocalPlayer');
        addLogEntry('[Server] ✓ Сервер создан', 'success');
    }
    
    // Если клиент запущен - подключаем его к серверу
    const q3vmClient = getQ3VMClientV2();
    if (q3vmClient && !q3vmClient.server) {
        q3vmClient.connectToServer(globalQ3Server);
        globalQ3Server.connectClient(0); // Регистрируем клиент на сервере
        addLogEntry('[Server] ✓ Клиент подключен к серверу', 'success');
    }
    
    // Запускаем обновления сервера
    globalQ3Server.start(500); // 500ms между обновлениями
    
    addLogEntry('[Server] ✓ Сервер запущен (обновление 500ms)', 'success');
    updateStatus('serverStatus', '✓ Сервер работает независимо', 'success');
    
    const btn = document.getElementById('serverStartBtn');
    if (btn) {
        btn.textContent = '✓ Сервер запущен';
        btn.style.background = '#00C853';
        btn.disabled = true;
    }
    
    updateServerInfo();
};

/**
 * Остановка сервера
 */
window.stopClientServer = function() {
    if (!globalQ3Server) {
        addLogEntry('[Server] Сервер не создан', 'warning');
        return;
    }
    
    globalQ3Server.stop();
    
    addLogEntry('[Server] ⏹ Сервер остановлен', 'info');
    updateStatus('serverStatus', 'Сервер остановлен', 'info');
    
    const btn = document.getElementById('serverStartBtn');
    if (btn) {
        btn.textContent = '▶️ Запустить сервер';
        btn.style.background = '';
        btn.disabled = false;
    }
};

/**
 * Добавление бота на сервер
 */
window.addServerBot = function() {
    if (!globalQ3Server) {
        addLogEntry('[Server] Сервер не создан', 'warning');
        return;
    }
    
    const botName = `Bot${globalQ3Server.players.size}`;
    const bot = globalQ3Server.addVirtualPlayer(botName);
    
    addLogEntry(`[Server] ✓ Добавлен бот: ${botName} (ID: ${bot.id})`, 'success');
    updateServerInfo();
};

/**
 * Дамп информации о сервере в консоль
 */
window.dumpServerInfo = function() {
    if (!globalQ3Server) {
        console.log('[Server] Сервер не создан');
        return;
    }
    
    console.log('═══════════════════════════════════════');
    console.log('        Q3 SERVER EMULATOR INFO');
    console.log('═══════════════════════════════════════');
    console.log('Running:', globalQ3Server.isRunning);
    console.log('Players:', globalQ3Server.players.size);
    console.log('Game Type:', globalQ3Server.gameState.gameType);
    console.log('Match State:', globalQ3Server.gameState.matchState);
    console.log('');
    console.log('Players List:');
    
    for (const [id, player] of globalQ3Server.players) {
        console.log(`  [${id}] ${player.name}`);
        console.log(`      HP: ${player.health} | Armor: ${player.armor}`);
        console.log(`      Weapon: ${player.weapon} | Score: ${player.score}`);
        console.log(`      Position: [${player.origin.map(v => v.toFixed(1)).join(', ')}]`);
    }
    
    console.log('═══════════════════════════════════════');
};

/**
 * Обновление информации о сервере в UI
 */
function updateServerInfo() {
    const serverInfoElement = document.getElementById('serverInfo');
    const playerInfoElement = document.getElementById('playerInfo');
    
    if (!serverInfoElement || !globalQ3Server) return;
    
    const server = globalQ3Server;
    
    // Информация о сервере
    let html = '<div style="font-family: monospace; font-size: 12px; color: #ccc;">';
    html += '<div><strong>🖥️ Сервер:</strong></div>';
    html += '<div style="margin-left: 20px;">';
    html += `  • Статус: ${server.isRunning ? '✓ Работает' : '✗ Остановлен'}</div>`;
    html += '<div style="margin-left: 20px;">';
    html += `  • Игроков: ${server.players.size}</div>`;
    html += '<div style="margin-left: 20px;">';
    html += `  • Режим: ${getGameTypeName(server.gameState.gameType)}</div>`;
    html += '<div style="margin-left: 20px;">';
    html += `  • Матч: ${server.gameState.matchState}</div>`;
    html += '</div>';
    
    serverInfoElement.innerHTML = html;
    
    // Информация о локальном игроке
    if (playerInfoElement) {
        const localPlayer = server.getPlayer(0); // LocalPlayer
        
        if (localPlayer) {
            const weaponNames = [
                'Gauntlet', 'Machinegun', 'Shotgun', 'Grenade Launcher',
                'Rocket Launcher', 'Lightning Gun', 'Railgun', 'Plasma Gun', 'BFG'
            ];
            
            let playerHtml = '<div style="font-family: monospace; font-size: 11px; color: #ccc;">';
            playerHtml += '<div><strong>👤 LocalPlayer (ID: 0):</strong></div>';
            playerHtml += '<div style="margin-left: 15px;">';
            
            // Здоровье с цветом
            const healthColor = localPlayer.health > 100 ? '#00ffff' : 
                               localPlayer.health >= 75 ? '#00ff00' : 
                               localPlayer.health >= 50 ? '#ffff00' : 
                               localPlayer.health >= 25 ? '#ff8800' : '#ff0000';
            playerHtml += `  • HP: <span style="color: ${healthColor}; font-weight: bold;">${localPlayer.health}</span></div>`;
            
            // Броня
            playerHtml += '<div style="margin-left: 15px;">';
            playerHtml += `  • Armor: <span style="color: #8888ff;">${localPlayer.armor}</span></div>`;
            
            // Оружие
            const weaponName = weaponNames[localPlayer.weapon] || 'Unknown';
            playerHtml += '<div style="margin-left: 15px;">';
            playerHtml += `  • Weapon: <span style="color: #ffff00;">${weaponName}</span></div>`;
            
            // Позиция
            playerHtml += '<div style="margin-left: 15px;">';
            playerHtml += `  • Pos: [${localPlayer.origin.map(v => v.toFixed(0)).join(', ')}]</div>`;
            
            playerHtml += '</div>';
            
            playerInfoElement.innerHTML = playerHtml;
        }
    }
}

/**
 * Получение названия игрового типа
 */
function getGameTypeName(gameType) {
    const types = {
        0: 'FFA',
        1: 'Tournament',
        2: 'Single Player',
        3: 'Team DM',
        4: 'CTF',
        5: '1Flag CTF',
        6: 'Obelisk',
        7: 'Harvester'
    };
    return types[gameType] || 'Unknown';
}

console.log('[Q3VM UI] Модуль загружен ✓');

