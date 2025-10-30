let emulatorRenderer;
let translator;
let shaderRenderer;
let shaderRegistry;
let hudRenderer;
let loadedFiles = {};
let pk3Analyzer;
let currentPk3Data = null;
let cachedPk3Data = null;

document.addEventListener('DOMContentLoaded', function() {
    const emulatorCanvas = document.getElementById('emulatorCanvas');
    emulatorRenderer = new Q32DRenderer(emulatorCanvas);
    
    // ИСПОЛЬЗУЕМ НОВЫЙ ТРАНСЛЯТОР V2 с поддержкой CVARs
    // translator = new CToJSTranslatorV2();
    // console.log('[App] Инициализирован CToJSTranslatorV2 с поддержкой CVARs');
    console.log('[App] Транслятор C89→JS временно отключен (класс не найден)');
    
    const shaderCanvas = document.getElementById('shaderCanvas');
    shaderRenderer = new Q32DRenderer(shaderCanvas);
    
    const hudCanvas = document.getElementById('hudCanvas');
    hudRenderer = new Q32DRenderer(hudCanvas);
    
    pk3Analyzer = new PK3Analyzer();
    
    setInterval(updateServerStats, 1000);
    
    document.addEventListener('click', function(event) {
        const contextMenu = document.getElementById('playerContextMenu');
        if (contextMenu && !contextMenu.contains(event.target)) {
            hidePlayerContextMenu();
        }
    });
    
    document.addEventListener('DOMContentLoaded', function() {
        const contextMenu = document.getElementById('playerContextMenu');
        if (contextMenu) {
            contextMenu.addEventListener('click', function(event) {
                event.stopPropagation();
            });
        }
    });
    
    updateStatus('emulatorStatus', 'SuperHUD Tools инициализированы', 'success');
});

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

window.updateStatus = function(elementId, message, type = 'info') {
    const status = document.getElementById(elementId);
    status.textContent = message;
    status.className = `status ${type}`;
}
