// ========== ГЛАВНЫЙ ТЕСТЕР ==========
// Функции для тестирования различных модулей системы

window.runC89ToJsTest = async function() {
    const button = document.getElementById('c89ToJsButton');
    const status = document.getElementById('c89ToJsStatus');
    
    // Устанавливаем состояние загрузки
    button.className = 'tester-button loading';
    status.textContent = '⏳';
    addLogEntry('Начинаем тест C89 → JS...', 'info');
    
    try {
        addLogEntry('Загрузка файлов из assets/code/...', 'info');
        
        // Автоматически загружаем файлы из assets/code/
        const jsCode = await translator.processOSP2Files();
        
        if (jsCode && jsCode.length > 0) {
            addLogEntry(`✓ C89 → JS перевод завершен успешно (${jsCode.length} символов)`, 'success');
            
            // Устанавливаем состояние успеха
            button.className = 'tester-button success';
            status.textContent = '✓';
        } else {
            throw new Error('Перевод не дал результата');
        }
        
    } catch (error) {
        addLogEntry(`✗ Ошибка C89 → JS: ${error.message}`, 'error');
        
        // Устанавливаем состояние ошибки
        button.className = 'tester-button error';
        status.textContent = '✗';
    }
}

window.runPk3LoaderTest = async function() {
    const button = document.getElementById('pk3LoaderButton');
    const status = document.getElementById('pk3LoaderStatus');
    
    // Устанавливаем состояние загрузки
    button.className = 'tester-button loading';
    status.textContent = '⏳';
    addLogEntry('Начинаем тест PK3 LOADER...', 'info');
    
    try {
        addLogEntry('Загрузка основного PK3 файла из assets/...', 'info');
        
        // Загружаем основной PK3 файл (не whitelist)
        const pk3Data = await pk3Analyzer.loadPk3FromAssets('../../assets/zz-osp-pak8be.pk3');
        
        if (pk3Data && pk3Data.totalFiles > 0) {
            addLogEntry(`✓ PK3 загружен успешно: ${pk3Data.totalFiles} файлов, ${Math.round(pk3Data.totalSize/1024)}KB`, 'success');
            
            // Показываем краткую статистику
            for (const [type, count] of pk3Data.fileTypes) {
                addLogEntry(`  - ${type}: ${count} файлов`, 'info');
            }
            
            // Устанавливаем состояние успеха
            button.className = 'tester-button success';
            status.textContent = '✓';
        } else {
            throw new Error('PK3 файл пуст или поврежден');
        }
        
    } catch (error) {
        addLogEntry(`✗ Ошибка PK3 LOADER: ${error.message}`, 'error');
        
        // Устанавливаем состояние ошибки
        button.className = 'tester-button error';
        status.textContent = '✗';
    }
}

window.addLogEntry = function(message, type = 'info') {
    const logContent = document.getElementById('logContent');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContent.appendChild(entry);
    
    // Также выводим в консоль браузера
    const consoleMethod = type === 'error' ? 'error' : type === 'success' ? 'log' : 'info';
    console[consoleMethod](`[SuperHUD] ${message}`);
    
    // Прокручиваем к последней записи
    logContent.scrollTop = logContent.scrollHeight;
}

// Функция для добавления записи в лог шейдеров
window.addShaderLogEntry = function(message, type = 'info') {
    const shaderLogContent = document.getElementById('shaderLogContent');
    if (!shaderLogContent) return;
    
    const entry = document.createElement('div');
    const colors = {
        'info': '#AAAAAA',
        'success': '#4CAF50',
        'error': '#f44336',
        'warning': '#FF9800'
    };
    
    entry.style.color = colors[type] || '#AAAAAA';
    entry.style.marginBottom = '3px';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    shaderLogContent.appendChild(entry);
    
    // Прокручиваем к последней записи
    shaderLogContent.scrollTop = shaderLogContent.scrollHeight;
    
    // Также добавляем в основной лог
    addLogEntry(message, type);
}

// Функция для копирования всего лога в буфер обмена
window.copyLogToClipboard = async function() {
    const logContent = document.getElementById('logContent');
    if (!logContent) {
        console.error('Лог не найден');
        return;
    }
    
    // Собираем весь текст из лога
    const logEntries = logContent.querySelectorAll('.log-entry');
    const logText = Array.from(logEntries)
        .map(entry => entry.textContent)
        .join('\n');
    
    if (!logText || logText.trim().length === 0) {
        console.warn('Лог пуст');
        return;
    }
    
    const button = event.target;
    const originalText = button.textContent;
    
    try {
        // Копируем в буфер обмена
        await navigator.clipboard.writeText(logText);
        
        // Показываем уведомление на кнопке
        button.textContent = '✓ Скопировано!';
        button.style.background = '#4CAF50';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#555';
        }, 2000);
        
        console.log('Лог скопирован в буфер обмена');
    } catch (error) {
        console.error('Ошибка копирования в буфер обмена:', error);
        
        // Fallback для старых браузеров
        const textarea = document.createElement('textarea');
        textarea.value = logText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            button.textContent = '✓ Скопировано!';
            button.style.background = '#4CAF50';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '#555';
            }, 2000);
        } catch (err) {
            button.textContent = '✗ Ошибка';
            button.style.background = '#f44336';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '#555';
            }, 2000);
            
            console.error('Не удалось скопировать');
        }
        
        document.body.removeChild(textarea);
    }
}

// Функция для детального вывода информации о шейдере в консоль
function logShaderDetails(shaderName, shader) {
    console.group(`%c🎨 Shader: ${shaderName}`, 'color: #4CAF50; font-weight: bold; font-size: 14px;');
    
    console.log(`%cФайл: ${shader.path}`, 'color: #888;');
    console.log(`%cStages: ${shader.stages ? shader.stages.length : 0}`, 'color: #FFD700;');
    
    // Подсчитываем уникальные текстуры
    const uniqueTextures = new Set();
    if (shader.stages) {
        shader.stages.forEach((stage, idx) => {
            console.group(`%c  Stage ${idx + 1}`, 'color: #00BCD4; font-weight: bold;');
            
            if (stage.bundle && stage.bundle[0]) {
                const bundle = stage.bundle[0];
                
                // Текстуры
                if (bundle.image && bundle.image.length > 0) {
                    if (bundle.numImageAnimations > 1) {
                        console.log(`%c    ⚡ animMap (${bundle.numImageAnimations} frames, ${bundle.imageAnimationSpeed}fps)`, 'color: #FF9800;');
                        bundle.image.forEach((img, i) => {
                            if (img) {
                                console.log(`%c      [${i}]: ${img}`, 'color: #AAAAAA;');
                                uniqueTextures.add(img);
                            }
                        });
                    } else if (bundle.image[0]) {
                        console.log(`%c    📦 map: ${bundle.image[0]}`, 'color: #4CAF50;');
                        uniqueTextures.add(bundle.image[0]);
                    }
                }
                
                // tcGen
                if (bundle.tcGen && bundle.tcGen !== 'TCGEN_TEXTURE') {
                    console.log(`%c    🔄 tcGen: ${bundle.tcGen}`, 'color: #9C27B0;');
                }
                
                // tcMod
                if (bundle.texMods && bundle.texMods.length > 0) {
                    console.log(`%c    🎭 tcMods (${bundle.texMods.length}):`, 'color: #E91E63;');
                    bundle.texMods.forEach(mod => {
                        console.log(`%c      - ${mod}`, 'color: #CCCCCC;');
                    });
                }
                
                // Lightmap
                if (bundle.lightmap >= 0) {
                    console.log(`%c    💡 lightmap: ${bundle.lightmap}`, 'color: #FFC107;');
                }
            }
            
            // Blend функция
            if (stage.blendFunc) {
                console.log(`%c    🎨 blend: ${stage.blendSrc} ${stage.blendDst}`, 'color: #E91E63;');
            }
            
            // RGB/Alpha Gen
            if (stage.rgbGen && !stage.rgbGen.includes('IDENTITY')) {
                console.log(`%c    🌈 rgbGen: ${stage.rgbGen}`, 'color: #9C27B0;');
            }
            if (stage.alphaGen && !stage.alphaGen.includes('IDENTITY')) {
                console.log(`%c    ⚪ alphaGen: ${stage.alphaGen}`, 'color: #9C27B0;');
            }
            
            console.groupEnd();
        });
    }
    
    // Итоговая информация
    console.log(`%c📊 Уникальных текстур: ${uniqueTextures.size}`, 'color: #00BCD4; font-weight: bold;');
    if (uniqueTextures.size > 0) {
        console.log('%cСписок текстур:', 'color: #888;');
        Array.from(uniqueTextures).forEach((tex, i) => {
            console.log(`  ${i + 1}. ${tex}`);
        });
    }
    
    // Эффекты
    if (shader.effects) {
        if (shader.effects.deform) {
            console.log(`%c🔧 Deform: ${shader.effects.deform}`, 'color: #FF5722;');
        }
        if (shader.effects.cull !== 'front') {
            console.log(`%c✂️ Cull: ${shader.effects.cull}`, 'color: #795548;');
        }
        if (shader.effects.nopicmip) {
            console.log(`%c🚫 NoPicMip`, 'color: #607D8B;');
        }
        if (shader.effects.nomipmaps) {
            console.log(`%c🚫 NoMipmaps`, 'color: #607D8B;');
        }
    }
    
    console.groupEnd();
}

// Функции для управления loading bar
function showLoadingBar(text = 'Загрузка...') {
    const button = document.getElementById('initShaderButton');
    const loadingBarContainer = document.getElementById('loadingBarContainer');
    const loadingBar = document.getElementById('initLoadingBar');
    const loadingText = document.getElementById('initLoadingText');
    const shaderStatus = document.getElementById('shaderStatus');
    
    if (button) {
        button.disabled = true;
        button.style.opacity = '0.5';
    }
    
    if (loadingBarContainer) {
        loadingBarContainer.style.display = 'block';
    }
    
    if (shaderStatus) {
        shaderStatus.style.display = 'none';
    }
    
    if (loadingBar && loadingText) {
        loadingText.textContent = text;
        loadingBar.style.width = '0%';
    }
}

async function updateLoadingBar(percent, text = null) {
    const loadingBar = document.getElementById('initLoadingBar');
    const loadingText = document.getElementById('initLoadingText');
    const loadingPercent = document.getElementById('initLoadingPercent');
    
    // Округляем процент
    const roundedPercent = Math.round(percent);
    
    if (loadingBar) {
        loadingBar.style.width = roundedPercent + '%';
    }
    
    if (text && loadingText) {
        loadingText.textContent = text;
    }
    
    if (loadingPercent) {
        loadingPercent.textContent = roundedPercent + '%';
    }
    
    // Эффект инверсии текста через background clip (обновляем для обоих текстов)
    if (loadingText) {
        loadingText.style.background = `linear-gradient(to right, black 0%, black ${roundedPercent}%, white ${roundedPercent}%, white 100%)`;
        loadingText.style.webkitBackgroundClip = 'text';
        loadingText.style.backgroundClip = 'text';
        loadingText.style.webkitTextFillColor = 'transparent';
    }
    
    if (loadingPercent) {
        loadingPercent.style.background = `linear-gradient(to right, black 0%, black ${roundedPercent}%, white ${roundedPercent}%, white 100%)`;
        loadingPercent.style.webkitBackgroundClip = 'text';
        loadingPercent.style.backgroundClip = 'text';
        loadingPercent.style.webkitTextFillColor = 'transparent';
    }
    
    // Небольшая задержка для визуализации прогресса
    if (percent < 100) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

function hideLoadingBar(success = true) {
    const button = document.getElementById('initShaderButton');
    const loadingBarContainer = document.getElementById('loadingBarContainer');
    const shaderStatus = document.getElementById('shaderStatus');
    
    // Небольшая задержка перед скрытием для показа 100%
    setTimeout(() => {
        if (button) {
            button.disabled = false;
            button.style.opacity = '1';
        }
        
        if (loadingBarContainer) {
            loadingBarContainer.style.display = 'none';
        }
        
        if (shaderStatus) {
            shaderStatus.style.display = 'block';
        }
    }, 500);
}

// Тест системы шейдеров
window.runShaderSystemTest = async function() {
    // Проверяем не идет ли уже загрузка
    const initButton = document.getElementById('initShaderButton');
    if (initButton && initButton.disabled) {
        console.log('[runShaderSystemTest] Загрузка уже идет, ждите завершения');
        return;
    }
    
    // Проверяем откуда вызвана функция
    const isMainPage = document.getElementById('shaderSystemButton') !== null;
    const button = document.getElementById('shaderSystemButton');
    const status = document.getElementById('shaderSystemStatus');
    
    // Очищаем лог шейдеров если есть
    const shaderLogContent = document.getElementById('shaderLogContent');
    if (shaderLogContent) {
        shaderLogContent.innerHTML = '';
    }
    
    // Показываем loading bar
    showLoadingBar('Инициализация...');
    
    // Устанавливаем состояние загрузки (если на главной)
    if (isMainPage && button && status) {
        button.className = 'tester-button loading';
        status.textContent = '⏳';
    }
    
    addShaderLogEntry('Начинаем инициализацию системы шейдеров...', 'info');
    
    try {
        // Загружаем PK3 файл
        await updateLoadingBar(5, 'Загрузка PK3...');
        addLogEntry('Загрузка PK3 файла из assets/...', 'info');
        const pk3Data = await pk3Analyzer.loadPk3FromAssets('../../assets/zz-osp-pak8be.pk3');
        
        if (!pk3Data || pk3Data.files.length === 0) {
            throw new Error('PK3 файл не загружен или пуст');
        }
        
        await updateLoadingBar(10, 'PK3 загружен');
        addShaderLogEntry(`✓ PK3 загружен: ${pk3Data.totalFiles} файлов`, 'success');
        
        // Ищем файлы шейдеров
        const shaderFiles = pk3Data.files.filter(file => 
            file.name.toLowerCase().endsWith('.shader')
        );
        
        await updateLoadingBar(15, `Найдено ${shaderFiles.length} файлов`);
        addShaderLogEntry(`Найдено ${shaderFiles.length} .shader файлов`, 'info');
        
        // Инициализируем реестр шейдеров
        shaderRegistry = new SuperHUDShaderRegistry();
        window.shaderRegistry = shaderRegistry; // Делаем глобально доступным
        
        await updateLoadingBar(20, 'Регистрация...');
        
        // Регистрируем файлы шейдеров
        for (const shaderFile of shaderFiles) {
            shaderRegistry.registerShaderFile(shaderFile.name, shaderFile.name);
        }
        
        // Загружаем и парсим все шейдеры
        let totalShaders = 0;
        let totalTextures = 0;
        
        await updateLoadingBar(25, 'Парсинг шейдеров...');
        
        console.log('%c═══════════════════════════════════════════════', 'color: #4CAF50; font-weight: bold;');
        console.log('%c   СИСТЕМА ШЕЙДЕРОВ QUAKE 3 - ДЕТАЛЬНЫЙ ОТЧЕТ', 'color: #4CAF50; font-weight: bold;');
        console.log('%c═══════════════════════════════════════════════', 'color: #4CAF50; font-weight: bold;');
        
        const totalFiles = shaderFiles.length;
        for (let fileIdx = 0; fileIdx < shaderFiles.length; fileIdx++) {
            const shaderFile = shaderFiles[fileIdx];
            try {
                // Прогресс парсинга: 25% -> 60%
                const parseProgress = 25 + Math.floor((fileIdx / totalFiles) * 35);
                await updateLoadingBar(parseProgress, `Парсинг ${fileIdx + 1}/${totalFiles}...`);
                
                addShaderLogEntry(`Парсинг ${shaderFile.name}...`, 'info');
                await shaderRegistry.loadShaderFile(shaderFile.name);
                
                const fileData = shaderRegistry.shaderFiles.get(shaderFile.name);
                if (fileData && fileData.parsedShaders) {
                    totalShaders += fileData.parsedShaders.length;
                    
                    console.group(`%c📁 ${shaderFile.name} (${fileData.parsedShaders.length} шейдеров)`, 'color: #2196F3; font-weight: bold; font-size: 13px;');
                    
                    // Детальный вывод каждого шейдера
                    for (const parsedShader of fileData.parsedShaders) {
                        const shaderKey = `${shaderFile.name}:${parsedShader.name}`;
                        const shader = shaderRegistry.shaders.get(shaderKey);
                        
                        if (shader) {
                            logShaderDetails(parsedShader.name, shader);
                            
                            // Подсчитываем текстуры
                            if (shader.stages) {
                                shader.stages.forEach(stage => {
                                    if (stage.bundle && stage.bundle[0] && stage.bundle[0].image) {
                                        totalTextures += stage.bundle[0].image.filter(img => img).length;
                                    }
                                });
                            }
                        }
                    }
                    
                    console.groupEnd();
                    addShaderLogEntry(`  ✓ ${shaderFile.name}: ${fileData.parsedShaders.length} шейдеров`, 'success');
                }
            } catch (error) {
                addShaderLogEntry(`  ✗ Ошибка загрузки ${shaderFile.name}: ${error.message}`, 'error');
                console.error(`Ошибка загрузки ${shaderFile.name}:`, error);
            }
        }
        
        console.log('%c═══════════════════════════════════════════════', 'color: #4CAF50; font-weight: bold;');
        console.log(`%c📊 ИТОГО: ${totalShaders} шейдеров, ${totalTextures} текстурных ссылок`, 'color: #4CAF50; font-weight: bold; font-size: 14px;');
        console.log('%c═══════════════════════════════════════════════', 'color: #4CAF50; font-weight: bold;');
        
        await updateLoadingBar(60, 'Парсинг завершен');
        addShaderLogEntry(`✓ Система шейдеров инициализирована успешно!`, 'success');
        addShaderLogEntry(`  📊 Всего: ${totalShaders} шейдеров, ${totalTextures} текстурных ссылок`, 'info');
        addShaderLogEntry(`  💡 Откройте консоль браузера (F12) для детального просмотра`, 'info');
        
        // Предзагружаем все текстуры в кэш рендерера
        await updateLoadingBar(65, 'Кеширование текстур...');
        addShaderLogEntry(`🎨 Предзагрузка текстур в кэш...`, 'info');
        const preloadStart = Date.now();
        
        // Передаем callback для обновления прогресса
        await shaderRegistry.preloadAllTextures((loaded, total) => {
            // Прогресс кеширования: 65% -> 95%
            const cacheProgress = 65 + Math.floor((loaded / total) * 30);
            updateLoadingBar(cacheProgress, `Кеш: ${loaded}/${total}`);
        });
        
        const preloadTime = ((Date.now() - preloadStart) / 1000).toFixed(2);
        await updateLoadingBar(95, 'Завершение...');
        addShaderLogEntry(`✓ Текстуры закешированы за ${preloadTime}с`, 'success');
        
        // Обновляем список шейдеров
        await updateLoadingBar(98, 'Построение списка...');
        updateShaderList();
        
        // Финальный этап
        await updateLoadingBar(100, '✓ Готово!');
        
        // Устанавливаем состояние успеха (если на главной)
        if (isMainPage && button && status) {
            button.className = 'tester-button success';
            status.textContent = '✓';
        }
        
        // Обновляем статус на вкладке шейдеров
        updateStatus('shaderStatus', `Загружено ${totalShaders} шейдеров из ${shaderFiles.length} файлов`, 'success');
        
        // Скрываем loading bar
        hideLoadingBar(true);
        
    } catch (error) {
        addShaderLogEntry(`✗ Ошибка инициализации шейдеров: ${error.message}`, 'error');
        console.error('Ошибка инициализации шейдеров:', error);
        
        // Устанавливаем состояние ошибки (если на главной)
        if (isMainPage && button && status) {
            button.className = 'tester-button error';
            status.textContent = '✗';
        }
        
        updateStatus('shaderStatus', `Ошибка: ${error.message}`, 'error');
        
        // Скрываем loading bar
        hideLoadingBar(false);
    }
}

