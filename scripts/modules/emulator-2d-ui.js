// ========== 2D ЭМУЛЯТОР - UI ФУНКЦИИ ==========
// Функции для управления интерфейсом 2D эмулятора

window.clearEmulator = function() {
    emulatorRenderer.clear();
    updateStatus('emulatorStatus', 'Canvas очищен');
}

window.testSetColor = function() {
    emulatorRenderer.trap_SetColor(1.0, 0.0, 0.0, 1.0);
    emulatorRenderer.trap_FillRect(50, 50, 100, 50);
    updateStatus('emulatorStatus', 'trap_SetColor(1.0, 0.0, 0.0, 1.0) - красный цвет');
}

window.testFillRect = function() {
    emulatorRenderer.trap_SetColor(0.0, 1.0, 0.0, 1.0);
    emulatorRenderer.trap_FillRect(200, 100, 150, 80);
    updateStatus('emulatorStatus', 'trap_FillRect(200, 100, 150, 80) - зеленый прямоугольник');
}

window.testDrawPic = function() {
    emulatorRenderer.trap_SetColor(0.0, 0.0, 1.0, 1.0);
    emulatorRenderer.trap_DrawPic(300, 200, 80, 60, "gfx/test");
    updateStatus('emulatorStatus', 'trap_DrawPic(300, 200, 80, 60, "gfx/test") - синяя картинка');
}

window.demoBasic = function() {
    clearEmulator();
    
    emulatorRenderer.trap_SetColor(0.0, 0.0, 0.0, 0.8);
    emulatorRenderer.trap_FillRect(0, 0, 640, 60);
    
    emulatorRenderer.trap_SetColor(1.0, 0.0, 0.0, 1.0);
    emulatorRenderer.trap_DrawPic(10, 10, 32, 32, "health");
    
    emulatorRenderer.trap_SetColor(0.0, 0.0, 1.0, 1.0);
    emulatorRenderer.trap_DrawPic(50, 10, 32, 32, "armor");
    
    emulatorRenderer.trap_SetColor(1.0, 1.0, 0.0, 1.0);
    emulatorRenderer.trap_DrawPic(580, 10, 50, 32, "ammo");
    
    updateStatus('emulatorStatus', 'Базовый HUD создан');
}

window.demoColors = function() {
    clearEmulator();
    
    const colors = [
        [1.0, 0.0, 0.0, 1.0], [0.0, 1.0, 0.0, 1.0], [0.0, 0.0, 1.0, 1.0],
        [1.0, 1.0, 0.0, 1.0], [1.0, 0.0, 1.0, 1.0], [0.0, 1.0, 1.0, 1.0]
    ];
    
    for (let i = 0; i < colors.length; i++) {
        emulatorRenderer.trap_SetColor(colors[i][0], colors[i][1], colors[i][2], colors[i][3]);
        emulatorRenderer.trap_FillRect(50 + i * 80, 100, 60, 60);
    }
    
    updateStatus('emulatorStatus', 'Демонстрация цветов');
}

window.demoPics = function() {
    clearEmulator();
    
    const pics = [
        {name: "health", color: [1.0, 0.0, 0.0, 1.0]},
        {name: "armor", color: [0.0, 0.0, 1.0, 1.0]},
        {name: "ammo", color: [1.0, 1.0, 0.0, 1.0]},
        {name: "weapon", color: [0.0, 1.0, 0.0, 1.0]}
    ];
    
    pics.forEach((pic, i) => {
        emulatorRenderer.trap_SetColor(pic.color[0], pic.color[1], pic.color[2], pic.color[3]);
        emulatorRenderer.trap_DrawPic(50 + i * 120, 150, 80, 60, pic.name);
    });
    
    updateStatus('emulatorStatus', 'Демонстрация картинок');
}

window.demoComplex = function() {
    clearEmulator();
    
    emulatorRenderer.trap_SetColor(0.0, 0.0, 0.0, 0.7);
    emulatorRenderer.trap_FillRect(0, 0, 640, 60);
    emulatorRenderer.trap_FillRect(0, 420, 640, 60);
    
    emulatorRenderer.trap_SetColor(1.0, 1.0, 1.0, 1.0);
    emulatorRenderer.trap_FillRect(0, 58, 640, 2);
    emulatorRenderer.trap_FillRect(0, 418, 640, 2);
    
    emulatorRenderer.trap_SetColor(1.0, 0.0, 0.0, 1.0);
    emulatorRenderer.trap_DrawPic(10, 10, 32, 32, "health");
    
    emulatorRenderer.trap_SetColor(0.0, 0.0, 1.0, 1.0);
    emulatorRenderer.trap_DrawPic(50, 10, 32, 32, "armor");
    
    emulatorRenderer.trap_SetColor(1.0, 1.0, 0.0, 1.0);
    emulatorRenderer.trap_DrawPic(580, 10, 50, 32, "ammo");
    
    emulatorRenderer.trap_SetColor(0.0, 1.0, 0.0, 0.7);
    emulatorRenderer.trap_FillRect(10, 440, 120, 30);
    
    emulatorRenderer.trap_SetColor(1.0, 1.0, 1.0, 1.0);
    emulatorRenderer.trap_FillRect(300, 440, 100, 30);
    
    updateStatus('emulatorStatus', 'Сложный HUD создан');
}

