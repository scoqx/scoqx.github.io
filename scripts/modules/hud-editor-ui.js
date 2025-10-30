// ========== HUD РЕДАКТОР - UI ФУНКЦИИ ==========
// Функции для управления интерфейсом HUD редактора

window.addHudElement = function(type) {
    // Простая реализация добавления элементов
    updateStatus('hudStatus', `Добавлен элемент: ${type}`);
}

window.clearHud = function() {
    hudRenderer.clear();
    updateStatus('hudStatus', 'HUD очищен');
}

window.resetHud = function() {
    clearHud();
    updateStatus('hudStatus', 'HUD сброшен');
}

window.exportHud = function() {
    updateStatus('hudStatus', 'Экспорт HUD (в разработке)');
}

window.importHud = function() {
    updateStatus('hudStatus', 'Импорт HUD (в разработке)');
}

