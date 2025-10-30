/**
 * UI для серверного эмулятора
 */

// Обновление статистики сервера
function updateServerStats() {
    if (!serverEmulator) return;
    
    const stats = serverEmulator.getStats();
    const statusElement = document.getElementById('serverStatus');
    const playersElement = document.getElementById('serverPlayers');
    
    if (statusElement) {
        statusElement.textContent = stats.isRunning ? 'Запущен' : 'Остановлен';
        statusElement.className = stats.isRunning ? 'status-active' : 'status-inactive';
    }
    
    if (playersElement) {
        playersElement.textContent = `Игроков: ${stats.playersCount}`;
    }
}

// Запуск сервера
window.startServer = function() {
    if (serverEmulator) {
        serverEmulator.start(1000);
        updateServerStats();
    }
};

// Остановка сервера
window.stopServer = function() {
    if (serverEmulator) {
        serverEmulator.stop();
        updateServerStats();
    }
};

// Добавление игрока
window.addPlayer = function(name) {
    if (serverEmulator) {
        const player = serverEmulator.addVirtualPlayer(name || null);
        updateServerStats();
        return player;
    }
};

// Удаление игрока
window.removePlayer = function(id) {
    if (serverEmulator) {
        serverEmulator.removePlayer(id);
        updateServerStats();
    }
};

// Обновление статуса при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Server UI] Инициализирован');
    updateServerStats();
});


