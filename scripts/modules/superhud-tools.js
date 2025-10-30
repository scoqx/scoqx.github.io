// ========== СИСТЕМА ШЕЙДЕРОВ ==========
// Все остальные модули перенесены в отдельные файлы:
// - app-init.js - глобальные переменные, инициализация, утилиты
// - server-emulator-ui.js - UI серверного эмулятора
// - emulator-2d-ui.js - UI 2D эмулятора
// - translator-ui.js - UI переводчика C89→JS
// - hud-editor-ui.js - UI HUD редактора
// - pk3-analyzer.js - анализатор PK3 архивов
// - main-tester.js - главный тестер системы


class SuperHUDShaderRegistry {
    constructor() {
        this.shaderFiles = new Map(); // Файлы .shader
        this.shaders = new Map(); // Отдельные шейдеры из файлов
        this.textures = new Map();
        this.shaderHashTable = new Array(1024); // Хеш-таблица как в Quake3e
        this.shaderCount = 0;
    }
    
    // Генерация хеша для имени шейдера (как в Quake3e)
    generateHashValue(name, tableSize) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = ((hash << 5) + hash + name.charCodeAt(i)) % tableSize;
        }
        return hash;
    }
    
    // Поиск шейдера в хеш-таблице
    findShaderByName(name) {
        const hash = this.generateHashValue(name, 1024);
        let shader = this.shaderHashTable[hash];
        
        while (shader) {
            if (shader.name === name) {
                return shader;
            }
            shader = shader.next;
        }
        return null;
    }
    
    // Добавление шейдера в хеш-таблицу
    addShaderToHashTable(shader) {
        const hash = this.generateHashValue(shader.name, 1024);
        shader.next = this.shaderHashTable[hash];
        this.shaderHashTable[hash] = shader;
        this.shaderCount++;
    }
    
    // Загрузка шейдера для рендеринга (совместимость с trap_R_DrawStretchPic)
    async loadShader(shaderName) {
        // Просто ищем по имени
        return this.findShaderByName(shaderName);
    }
    
    findShaderByName(shaderName) {
        // Просто возвращаем по имени - теперь все шейдеры хранятся только по имени
        return this.shaders.get(shaderName) || null;
    }
    
    registerShaderFile(name, path) {
        this.shaderFiles.set(name, {
            name: name,
            path: path,
            loaded: false,
            content: null,
            parsedShaders: [] // Массив шейдеров из файла
        });
    }
    
    registerShader(name, path, shaderData = null) {
        // Проверяем, не зарегистрирован ли уже шейдер
        let existingShader = this.findShaderByName(name);
        if (existingShader) {
            return existingShader;
        }
        
        // Создаем новый шейдер с полными параметрами
        const shader = {
            name: name,
            path: path,
            loaded: false,
            content: null,
            next: null, // Для хеш-таблицы
            
            // Параметры шейдера
            stages: [],
            textures: [],
            effects: {
                deform: null,
                cull: 'front',
                nopicmip: false,
                nomipmaps: false
            },
            properties: {
                size: 0,
                lineCount: 0,
                complexity: 'simple'
            }
        };
        
        // Если есть данные шейдера, парсим их
        if (shaderData) {
            this.parseShaderProperties(shader, shaderData);
        }
        
        // Добавляем в обычную Map для совместимости
        this.shaders.set(name, shader);
        
        // Добавляем в хеш-таблицу
        this.addShaderToHashTable(shader);
        
        return shader;
    }
    
    // Парсинг свойств шейдера
    parseShaderProperties(shader, shaderData) {
        shader.content = shaderData.content;
        shader.loaded = true;
        shader.textures = shaderData.textures || [];
        shader.properties.size = shaderData.content.length;
        shader.properties.lineCount = shaderData.content.split('\n').length;
        
        // Парсим stages и эффекты
        this.parseShaderStages(shader, shaderData.content);
        
        // Определяем сложность
        shader.properties.complexity = this.determineShaderComplexity(shader);
    }
    
    // Парсинг stages шейдера (следуя структуре Quake 3)
    parseShaderStages(shader, content) {
        const lines = content.split('\n');
        let inStage = false;
        let currentStage = null;
        let braceDepth = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Пропускаем комментарии и пустые строки
            if (!line || line.startsWith('//')) {
                continue;
            }
            
            // Подсчитываем глубину скобок
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;
            
            // Начало нового stage
            if (line === '{' && braceDepth === 0) {
                inStage = true;
                braceDepth = 1;
                // Создаем структуру stage согласно shaderStage_t из tr_local.h
                currentStage = {
                    active: true,
                    // Текстурные bundles (NUM_TEXTURE_BUNDLES = 2)
                    bundle: [
                        this.createTextureBundle(),
                        this.createTextureBundle()
                    ],
                    // Цветовые параметры
                    rgbGen: 'CGEN_IDENTITY',
                    rgbWave: null,
                    alphaGen: undefined,  // НЕ указано = альфа из текстуры
                    alphaWave: null,
                    constantColor: { r: 255, g: 255, b: 255, a: 255 },
                    // Состояние рендеринга
                    stateBits: 0,
                    blendSrc: 'GL_ONE',
                    blendDst: 'GL_ZERO',
                    alphaFunc: null,
                    depthFunc: 'lequal',
                    depthWrite: true,
                    // Дополнительные флаги
                    isDetail: false,
                    mtEnv: 0
                };
            }
            // Конец stage
            else if (line === '}' && braceDepth === 1 && inStage) {
                if (currentStage) {
                    shader.stages.push(currentStage);
                }
                inStage = false;
                currentStage = null;
                braceDepth = 0;
            }
            // Парсим команды stage
            else if (inStage && currentStage) {
                braceDepth += openBraces - closeBraces;
                this.parseStageCommand(line, currentStage);
            }
            // Парсим глобальные параметры шейдера
            else if (!inStage) {
                this.parseGlobalShaderCommand(line, shader);
            }
        }
    }
    
    // Создание структуры textureBundle согласно Quake 3
    createTextureBundle() {
        return {
            // Массив изображений для анимации (MAX_IMAGE_ANIMATIONS)
            image: [],
            numImageAnimations: 0,
            imageAnimationSpeed: 0,
            // Генерация текстурных координат
            tcGen: 'TCGEN_TEXTURE',
            tcGenVectors: [[0, 0, 0], [0, 0, 0]],
            // Модификаторы текстурных координат
            numTexMods: 0,
            texMods: [],
            // Дополнительные параметры
            videoMapHandle: -1,
            lightmap: -1, // LIGHTMAP_INDEX_NONE
            isVideoMap: false,
            isScreenMap: false,
            dlight: false
        };
    }
    
    // Парсинг команд stage (следуя ParseStage из tr_shader.c)
    parseStageCommand(line, stage) {
        const lowerLine = line.toLowerCase();
        
        // map <texturename> - основная текстура в bundle[0]
        if (lowerLine.startsWith('map ') || lowerLine.startsWith('clampmap ')) {
            const isClampMap = lowerLine.startsWith('clampmap ');
            const texturePath = line.substring(isClampMap ? 9 : 4).trim();
            
            // Сохраняем имя текстуры в bundle[0]
            stage.bundle[0].image[0] = texturePath;
            stage.bundle[0].numImageAnimations = 1;
            
            // Специальные случаи
            if (texturePath === '$lightmap') {
                stage.bundle[0].lightmap = 1; // LIGHTMAP_INDEX_SHADER
                stage.bundle[0].tcGen = 'TCGEN_LIGHTMAP';
            } else if (texturePath === '$whiteimage') {
                stage.bundle[0].image[0] = '*white';
            }
            
            // Сохраняем для обратной совместимости
            stage.map = texturePath;
            stage.isClampMap = isClampMap;
        }
        // animMap <frequency> <image1> ... <imageN>
        else if (lowerLine.startsWith('animmap ')) {
            const parts = line.substring(8).trim().split(/\s+/);
            if (parts.length > 1) {
                stage.bundle[0].imageAnimationSpeed = parseFloat(parts[0]);
                // Остальные части - пути к текстурам
                for (let i = 1; i < parts.length; i++) {
                    stage.bundle[0].image[i - 1] = parts[i];
                }
                stage.bundle[0].numImageAnimations = parts.length - 1;
            }
        }
        // blendFunc <func> или blendFunc <src> <dst>
        else if (lowerLine.startsWith('blendfunc ')) {
            const blendParts = line.substring(10).trim();
            stage.blendFunc = blendParts;
            
            // Парсим blend modes
            if (blendParts.toLowerCase() === 'add') {
                stage.blendSrc = 'GL_ONE';
                stage.blendDst = 'GL_ONE';
            } else if (blendParts.toLowerCase() === 'filter') {
                stage.blendSrc = 'GL_DST_COLOR';
                stage.blendDst = 'GL_ZERO';
            } else if (blendParts.toLowerCase() === 'blend') {
                stage.blendSrc = 'GL_SRC_ALPHA';
                stage.blendDst = 'GL_ONE_MINUS_SRC_ALPHA';
            } else {
                const parts = blendParts.split(/\s+/);
                if (parts.length >= 2) {
                    stage.blendSrc = parts[0];
                    stage.blendDst = parts[1];
                } else {
                    stage.blendSrc = parts[0];
                }
            }
        }
        // rgbGen <mode> [wave params or const params]
        else if (lowerLine.startsWith('rgbgen ')) {
            const rgbParams = line.substring(7).trim();
            const parts = rgbParams.split(/\s+/);
            
            if (parts[0].toLowerCase() === 'wave' && parts.length >= 6) {
                // rgbGen wave <func> <base> <amplitude> <phase> <frequency>
                stage.rgbGen = 'CGEN_WAVE';
                stage.rgbWave = {
                    func: parts[1],
                    base: parseFloat(parts[2]),
                    amplitude: parseFloat(parts[3]),
                    phase: parseFloat(parts[4]),
                    frequency: parseFloat(parts[5])
                };
            } else if (parts[0].toLowerCase() === 'const') {
                // rgbGen const ( r g b )
                stage.rgbGen = 'CGEN_CONST';
                // Парсим ( r g b ) - убираем скобки и парсим
                const colorStart = rgbParams.indexOf('(');
                const colorEnd = rgbParams.indexOf(')');
                if (colorStart !== -1 && colorEnd !== -1) {
                    const colorStr = rgbParams.substring(colorStart + 1, colorEnd);
                    const colors = colorStr.trim().split(/\s+/).map(parseFloat);
                    if (colors.length >= 3) {
                        stage.constantColor = {
                            r: Math.floor(colors[0] * 255),
                            g: Math.floor(colors[1] * 255),
                            b: Math.floor(colors[2] * 255),
                            a: 255
                        };
                    }
                }
            } else {
                stage.rgbGen = 'CGEN_' + parts[0].toUpperCase();
            }
        }
        // alphaGen <mode> [wave params]
        else if (lowerLine.startsWith('alphagen ')) {
            const alphaParams = line.substring(9).trim();
            const parts = alphaParams.split(/\s+/);
            
            if (parts[0].toLowerCase() === 'wave' && parts.length >= 6) {
                // alphaGen wave <func> <base> <amplitude> <phase> <frequency>
                stage.alphaGen = 'AGEN_WAVE';
                stage.alphaWave = {
                    func: parts[1],           // sin, triangle, square, sawtooth, inversesawtooth
                    base: parseFloat(parts[2]),
                    amplitude: parseFloat(parts[3]),
                    phase: parseFloat(parts[4]),
                    frequency: parseFloat(parts[5])
                };
            } else {
                stage.alphaGen = 'AGEN_' + parts[0].toUpperCase();
            }
        }
        // tcGen <mode>
        else if (lowerLine.startsWith('tcgen ')) {
            const tcMode = line.substring(6).trim();
            stage.bundle[0].tcGen = 'TCGEN_' + tcMode.toUpperCase().replace(' ', '_');
        }
        // tcMod <type> <params...>
        else if (lowerLine.startsWith('tcmod ')) {
            const tcModData = line.substring(6).trim();
            stage.bundle[0].texMods.push(tcModData);
            stage.bundle[0].numTexMods++;
        }
        // alphaFunc <func>
        else if (lowerLine.startsWith('alphafunc ')) {
            stage.alphaFunc = line.substring(10).trim();
        }
        // depthFunc <func>
        else if (lowerLine.startsWith('depthfunc ')) {
            stage.depthFunc = line.substring(10).trim();
        }
        // depthWrite
        else if (lowerLine === 'depthwrite') {
            stage.depthWrite = true;
        }
        // detail
        else if (lowerLine === 'detail') {
            stage.isDetail = true;
        }
    }
    
    // Парсинг глобальных команд шейдера
    parseGlobalShaderCommand(line, shader) {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.startsWith('deformvertexes ')) {
            shader.effects.deform = line.substring(15).trim();
        } else if (lowerLine.startsWith('cull ')) {
            shader.effects.cull = line.substring(5).trim();
        } else if (lowerLine === 'nopicmip') {
            shader.effects.nopicmip = true;
        } else if (lowerLine === 'nomipmaps') {
            shader.effects.nomipmaps = true;
        }
    }
    
    // Определение сложности шейдера
    determineShaderComplexity(shader) {
        let complexity = 'simple';
        
        if (shader.stages.length > 2) complexity = 'complex';
        if (shader.effects.deform) complexity = 'advanced';
        
        // Проверяем tcMod в новой структуре (bundle[0].texMods)
        if (shader.stages.some(s => {
            if (s.bundle && s.bundle[0] && s.bundle[0].texMods && s.bundle[0].texMods.length > 0) {
                return true;
            }
            // Старая структура для обратной совместимости
            if (s.tcMod && Array.isArray(s.tcMod) && s.tcMod.length > 0) {
                return true;
            }
            return false;
        })) {
            complexity = 'animated';
        }
        
        // Проверяем blend функции
        if (shader.stages.some(s => {
            if (s.blendSrc === 'GL_ONE' && s.blendDst === 'GL_ONE') return true;
            if (s.blendFunc && s.blendFunc.includes('GL_ONE GL_ONE')) return true;
            return false;
        })) {
            complexity = 'additive';
        }
        
        return complexity;
    }
    
    registerTexture(name, path) {
        this.textures.set(name, {
            name: name,
            path: path,
            loaded: false,
            data: null
        });
    }
    
    async loadShaderFile(filename) {
        const shaderFile = this.shaderFiles.get(filename);
        if (!shaderFile) {
            throw new Error(`Файл шейдеров ${filename} не найден`);
        }
        
        if (shaderFile.loaded) {
            return shaderFile.content;
        }
        
        // Загружаем содержимое файла шейдеров
        try {
            const content = await loadShaderFromPk3(shaderFile.path);
            
            // Проверяем что content не undefined и не null
            if (!content) {
                throw new Error(`Содержимое файла ${filename} пусто или не загружено`);
            }
            
            shaderFile.content = content;
            shaderFile.loaded = true;
            
            // Парсим шейдеры из файла
            shaderFile.parsedShaders = this.parseShadersFromContent(content);
            
            // Регистрируем найденные шейдеры и их текстуры
            for (const shader of shaderFile.parsedShaders) {
                // Регистрируем ТОЛЬКО по имени шейдера (без префикса файла)
                this.registerShader(shader.name, shaderFile.path, shader);
                
                // Регистрируем текстуры из шейдера
                for (const texturePath of shader.textures) {
                    const textureName = texturePath.replace(/^.*\//, '').replace(/\.(tga|jpg|jpeg|png)$/i, '');
                    this.registerTexture(textureName, texturePath);
                }
            }
            
            return content;
        } catch (error) {
            console.error(`Детальная ошибка загрузки ${filename}:`, error);
            throw new Error(`Ошибка загрузки файла шейдеров ${filename}: ${error.message}`);
        }
    }
    
    parseShadersFromContent(content) {
        const shaders = [];
        const lines = content.split('\n');
        let currentShader = null;
        let inShader = false;
        let braceCount = 0;
        
        // Убираем отладочные логи
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Пропускаем пустые строки и комментарии
            if (!line || line.startsWith('//')) {
                continue;
            }
            
            // Подсчитываем фигурные скобки для правильного определения границ
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;
            braceCount += openBraces - closeBraces;
            
            // Убираем отладочные логи
            
            // Начало нового шейдера - строка без фигурных скобок в начале
            if (!inShader && line && !line.startsWith('{') && !line.startsWith('}')) {
                if (currentShader) {
                    shaders.push(currentShader);
                }
                currentShader = {
                    name: line,
                    content: line + '\n',
                    startLine: i + 1,
                    textures: [] // Пути к текстурам в шейдере
                };
                inShader = true;
                braceCount = 0; // Сбрасываем счетчик для нового шейдера
            } else if (inShader && currentShader) {
                currentShader.content += line + '\n';
                
                // Ищем пути к текстурам в шейдере
                this.parseTexturesFromShaderLine(line, currentShader);
                
                // Конец шейдера - когда все фигурные скобки закрыты
                if (braceCount <= 0 && closeBraces > 0) {
                    shaders.push(currentShader);
                    currentShader = null;
                    inShader = false;
                    braceCount = 0;
                }
            }
        }
        
        // Добавляем последний шейдер, если есть
        if (currentShader) {
            shaders.push(currentShader);
        }
        
        return shaders;
    }
    
    // Парсинг путей к текстурам из строки шейдера
    parseTexturesFromShaderLine(line, shader) {
        // tcMod команды - это НЕ пути к текстурам, а команды трансформации
        const tcModCommands = ['rotate', 'scale', 'scroll', 'stretch', 'transform', 'turb'];
        
        // Ищем ТОЛЬКО map, animMap, clampMap и videoMap (БЕЗ tcMod!)
        const textureCommands = ['map', 'animMap', 'clampMap', 'videoMap'];
        
        for (const cmd of textureCommands) {
            const regex = new RegExp(`\\b${cmd}\\s+([^\\s]+)`, 'i');
            const match = line.match(regex);
            if (match) {
                const texturePath = match[1];
                // Убираем кавычки если есть
                const cleanPath = texturePath.replace(/['"]/g, '');
                
                // Пропускаем tcMod команды
                if (tcModCommands.includes(cleanPath)) {
                    continue;
                }
                
                // Пропускаем специальные текстуры
                if (cleanPath.startsWith('$') || cleanPath.startsWith('*')) {
                    continue;
                }
                
                if (!shader.textures.includes(cleanPath)) {
                    shader.textures.push(cleanPath);
                }
            }
        }
        
        // Также ищем текстуры в других форматах
        const textureRegex = /['"]([^'"]*\.(tga|jpg|jpeg|png))['"]/gi;
        let match;
        while ((match = textureRegex.exec(line)) !== null) {
            const texturePath = match[1];
            if (!shader.textures.includes(texturePath)) {
                shader.textures.push(texturePath);
            }
        }
    }
    
    async loadShader(name) {
        const shader = this.shaders.get(name);
        if (!shader) {
            throw new Error(`Шейдер ${name} не найден`);
        }
        
        if (shader.loaded) {
            return shader.content;
        }
        
        // Загружаем содержимое шейдера
        try {
            const content = await loadShaderFromPk3(shader.path);
            shader.content = content;
            shader.loaded = true;
            return content;
        } catch (error) {
            throw new Error(`Ошибка загрузки шейдера ${name}: ${error.message}`);
        }
    }
    
    async loadTexture(name) {
        const texture = this.textures.get(name);
        if (!texture) {
            throw new Error(`Текстура ${name} не найдена`);
        }
        
        if (texture.loaded) {
            return texture.data;
        }
        
        // Загружаем данные текстуры
        try {
            const data = await loadTextureFromPk3(texture.path);
            texture.data = data;
            texture.loaded = true;
            return data;
        } catch (error) {
            throw new Error(`Ошибка загрузки текстуры ${name}: ${error.message}`);
        }
    }
    
    getShader(name) {
        // Используем findShaderByName для более умного поиска
        return this.findShaderByName(name);
    }
    
    getTexture(name) {
        return this.textures.get(name);
    }
    
    getAllShaders() {
        return Array.from(this.shaders.values());
    }
    
    getAllTextures() {
        return Array.from(this.textures.values());
    }
    
    // Предзагрузка всех текстур в кэш рендерера
    async preloadAllTextures(progressCallback = null) {
        // Проверяем рендерер (может быть как window.shaderRenderer так и глобальный shaderRenderer)
        let renderer = (typeof shaderRenderer !== 'undefined') ? shaderRenderer : window.shaderRenderer;
        
        // Создаем рендерер если его нет
        if (!renderer) {
            console.log('[SuperHUD] Создаем рендерер для предзагрузки...');
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            renderer = new Q32DRenderer(canvas);
            renderer.setShaderRegistry(this);
            
            // Устанавливаем в обе переменные для совместимости
            if (typeof shaderRenderer === 'undefined') {
                window.shaderRenderer = renderer;
            } else {
                shaderRenderer = renderer;
                window.shaderRenderer = renderer;
            }
        }
        
        const allTexturePaths = new Set();
        
        // Собираем все пути к текстурам из stages всех шейдеров
        for (const shader of this.shaders.values()) {
            if (shader.stages) {
                for (const stage of shader.stages) {
                    if (stage.bundle) {
                        for (const bundle of stage.bundle) {
                            if (bundle.image) {
                                for (const imagePath of bundle.image) {
                                    if (imagePath && !imagePath.startsWith('$') && !imagePath.startsWith('*')) {
                                        allTexturePaths.add(imagePath);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Сначала предзагружаем и кэшируем ZIP архив
        if (window.getCachedZip) {
            await window.getCachedZip();
        }
        
        if (allTexturePaths.size === 0) {
            console.log(`[SuperHUD] ⚠️ Нет текстур для предзагрузки`);
            return;
        }
        
        console.log(`[SuperHUD] 📦 Начинаем предзагрузку ${allTexturePaths.size} уникальных текстур...`);
        console.log(`[SuperHUD] 🎯 Рендерер: ${renderer ? 'существует' : 'НЕ СУЩЕСТВУЕТ'}`);
        if (renderer) {
            console.log(`[SuperHUD] 📊 В кеше до загрузки: ${renderer.loadedImages.size} текстур`);
        }
        
        let loaded = 0;
        let failed = 0;
        const failedFiles = [];
        
        // Загружаем текстуры пачками параллельно (ZIP уже закэширован)
        const batchSize = 100; // Увеличили до 100, т.к. ZIP закеширован
        const texturePaths = Array.from(allTexturePaths);
        
        const startTime = Date.now();
        
        for (let i = 0; i < texturePaths.length; i += batchSize) {
            const batch = texturePaths.slice(i, i + batchSize);
            
            await Promise.allSettled(batch.map(async (path) => {
                try {
                    const img = await renderer.loadImageFromPk3(path);
                    if (img) {
                        loaded++;
                    } else {
                        failed++;
                        failedFiles.push(path);
                    }
                } catch (err) {
                    failed++;
                    failedFiles.push(path);
                }
            }));
            
            // Логируем прогресс каждые 100 текстур
            const progress = Math.min(i + batchSize, texturePaths.length);
            const percent = Math.round((progress / texturePaths.length) * 100);
            console.log(`[SuperHUD] 📊 Загружено ${progress}/${texturePaths.length} (${percent}%) текстур...`);
            
            // Вызываем callback для обновления UI
            if (progressCallback) {
                progressCallback(progress, texturePaths.length);
            }
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[SuperHUD] ✅ Предзагрузка завершена за ${duration}с: ${loaded} успешно, ${failed} не найдено`);
        console.log(`[SuperHUD] 📊 В кеше после загрузки: ${renderer.loadedImages.size} текстур`);
        
        if (failed > 0 && failed < 50) {
            console.log(`[SuperHUD] ⚠️ Ненайденные файлы:`, failedFiles);
        } else if (failed >= 50) {
            console.log(`[SuperHUD] ⚠️ Ненайденных файлов: ${failed} (первые 20):`, failedFiles.slice(0, 20));
        }
    }
}

// ========== СИСТЕМА ШЕЙДЕРОВ ==========

// Эмуляция структуры cgs.media из C89 кода
class CGSMedia {
    constructor() {
        // Шейдеры для HUD элементов (как в cg_local.h)
        this.charsetShader1 = null;
        this.charsetShader = null;
        this.whiteShader = null;
        this.hboxShaderNew = null;
        this.hboxShaderNew_nocull = null;
        this.hboxShaderNew_cullback = null;
        this.outlineThinShader = null;
        this.outlineMediumShader = null;
        this.outlineWideShader = null;
        this.teamOutlineThinShader = null;
        this.teamOutlineMediumShader = null;
        this.teamOutlineWideShader = null;
        this.outlineShader = null;
        this.teamOutlineShader = null;
        
        // Шейдеры для эффектов
        this.viewBloodShader = null;
        this.damageIndicatorCenter = null;
        this.deferShader = null;
        this.smokePuffShader = null;
        this.smokePuffNoPicMipShader = null;
        this.smokePuffRageProShader = null;
        this.shotgunSmokePuffShader = null;
        this.shotgunSmokePuffNoPicMipShader = null;
        this.plasmaBallShader = null;
        
        // Шейдеры для scoreboard
        this.scoreboardName = null;
        this.scoreboardPing = null;
        this.scoreboardScore = null;
        this.scoreboardTime = null;
        
        // Массивы шейдеров
        this.numberShaders = [];
        this.botSkillShaders = [];
        this.redFlagShader = [];
        this.blueFlagShader = [];
    }
    
    // Эмуляция trap_R_RegisterShader
    registerShader(shaderName) {
        if (!shaderRegistry) {
            console.warn('ShaderRegistry не инициализирован');
            return null;
        }
        
        // Ищем шейдер в реестре
        const shader = shaderRegistry.findShaderByName(shaderName);
        if (shader) {
            return shader;
        }
        
        // Если не найден, пробуем загрузить
        return shaderRegistry.loadShader(shaderName);
    }
    
    // Эмуляция trap_R_RegisterShaderNoMip
    registerShaderNoMip(shaderName) {
        const shader = this.registerShader(shaderName);
        if (shader) {
            shader.effects.nomipmaps = true;
        }
        return shader;
    }
}

// Глобальная переменная cgs.media (как в C89)
let cgsMedia = null;

window.initShaders = async function() {
    try {
        updateStatus('shaderStatus', 'Загрузка шейдеров из PK3...', 'info');
        
        // Загружаем PK3 файл для получения шейдеров
        const pk3Data = await pk3Analyzer.loadPk3FromAssets('../../assets/zz-osp-pak8be.pk3');
        
        if (!pk3Data || pk3Data.files.length === 0) {
            throw new Error('PK3 файл не загружен или пуст');
        }
        
        // Ищем файлы шейдеров в PK3 (более точный поиск)
        const shaderFiles = pk3Data.files.filter(file => 
            file.name.toLowerCase().endsWith('.shader') ||
            file.name.toLowerCase().includes('shader')
        );
        
        // Ищем файлы текстур в PK3 (более точный поиск)
        const textureFiles = pk3Data.files.filter(file => 
            file.name.toLowerCase().endsWith('.tga') ||
            file.name.toLowerCase().endsWith('.jpg') ||
            file.name.toLowerCase().endsWith('.jpeg') ||
            file.name.toLowerCase().endsWith('.png') ||
            file.type === 'Текстуры'
        );
        
        // Убираем отладочные логи
        
        if (shaderFiles.length === 0) {
            throw new Error('Шейдеры не найдены в PK3 файле');
        }
        
        // Инициализируем реестр шейдеров
        shaderRegistry = new SuperHUDShaderRegistry();
        
        // Регистрируем найденные шейдеры
        for (const shaderFile of shaderFiles) {
            // Один .shader файл может содержать множество шейдеров
            // Регистрируем файл как контейнер шейдеров
            shaderRegistry.registerShaderFile(shaderFile.name, shaderFile.name);
        }
        
        // Автоматически загружаем все файлы шейдеров
        for (const shaderFile of shaderFiles) {
            try {
                await shaderRegistry.loadShaderFile(shaderFile.name);
            } catch (error) {
                console.error(`Ошибка загрузки файла ${shaderFile.name}:`, error);
            }
        }
        
        // Регистрируем найденные текстуры
        for (const textureFile of textureFiles.slice(0, 10)) { // Ограничиваем количество для демо
            const textureName = textureFile.name.replace(/\.(tga|jpg|jpeg|png)$/i, '');
            shaderRegistry.registerTexture(textureName, textureFile.name);
        }
        
        // Инициализируем cgs.media (как в C89 коде)
        cgsMedia = new CGSMedia();
        
        // Регистрируем шейдеры как в cg_main.c
        await registerShadersLikeC89();
        
        updateShaderList();
        updateStatus('shaderStatus', `Загружено из PK3: ${shaderFiles.length} шейдеров, ${textureFiles.length} текстур`, 'success');
        
    } catch (error) {
        updateStatus('shaderStatus', `Ошибка загрузки шейдеров: ${error.message}`, 'error');
        console.error('Ошибка инициализации шейдеров:', error);
    }
}

// Функция регистрации шейдеров как в C89 коде (cg_main.c)
async function registerShadersLikeC89() {
    if (!cgsMedia) {
        console.error('cgsMedia не инициализирован');
        return;
    }
    
    try {
        // Регистрируем шейдеры для HUD элементов
        cgsMedia.whiteShader = cgsMedia.registerShader("white");
        cgsMedia.hboxShaderNew = cgsMedia.registerShader("gfx/misc/hbox");
        cgsMedia.hboxShaderNew_nocull = cgsMedia.registerShader("gfx/misc/hbox_nocull");
        cgsMedia.hboxShaderNew_cullback = cgsMedia.registerShader("gfx/misc/hbox_cullback");
        
        // Регистрируем шейдеры для контуров
        cgsMedia.outlineThinShader = cgsMedia.registerShader("gfx/2d/outline_thin");
        cgsMedia.outlineMediumShader = cgsMedia.registerShader("gfx/2d/outline_medium");
        cgsMedia.outlineWideShader = cgsMedia.registerShader("gfx/2d/outline_wide");
        cgsMedia.teamOutlineThinShader = cgsMedia.registerShader("gfx/2d/team_outline_thin");
        cgsMedia.teamOutlineMediumShader = cgsMedia.registerShader("gfx/2d/team_outline_medium");
        cgsMedia.teamOutlineWideShader = cgsMedia.registerShader("gfx/2d/team_outline_wide");
        
        // Регистрируем шейдеры для эффектов
        cgsMedia.viewBloodShader = cgsMedia.registerShader("viewBloodBlend");
        cgsMedia.damageIndicatorCenter = cgsMedia.registerShaderNoMip("damageIndicator2");
        cgsMedia.deferShader = cgsMedia.registerShaderNoMip("gfx/2d/defer.tga");
        
        // Регистрируем шейдеры для scoreboard
        cgsMedia.scoreboardName = cgsMedia.registerShaderNoMip("menu/tab/name.tga");
        cgsMedia.scoreboardPing = cgsMedia.registerShaderNoMip("menu/tab/ping.tga");
        cgsMedia.scoreboardScore = cgsMedia.registerShaderNoMip("menu/tab/score.tga");
        cgsMedia.scoreboardTime = cgsMedia.registerShaderNoMip("menu/tab/time.tga");
        
        // Регистрируем шейдеры для дыма
        cgsMedia.smokePuffShader = cgsMedia.registerShader("smokePuff");
        cgsMedia.smokePuffNoPicMipShader = cgsMedia.registerShader("smokePuffNoPicMip");
        if (!cgsMedia.smokePuffNoPicMipShader) {
            cgsMedia.smokePuffNoPicMipShader = cgsMedia.smokePuffShader;
        }
        
        cgsMedia.smokePuffRageProShader = cgsMedia.registerShader("smokePuffRagePro");
        cgsMedia.shotgunSmokePuffShader = cgsMedia.registerShader("shotgunSmokePuff");
        cgsMedia.shotgunSmokePuffNoPicMipShader = cgsMedia.registerShader("shotgunSmokePuff");
        if (!cgsMedia.shotgunSmokePuffNoPicMipShader) {
            cgsMedia.shotgunSmokePuffNoPicMipShader = cgsMedia.shotgunSmokePuffShader;
        }
        
        cgsMedia.plasmaBallShader = cgsMedia.registerShader("sprites/plasma1");
        
        // Регистрируем числовые шейдеры (как в C89)
        const sb_nums = ["gfx/2d/numbers/zero_32b", "gfx/2d/numbers/one_32b", "gfx/2d/numbers/two_32b", 
                        "gfx/2d/numbers/three_32b", "gfx/2d/numbers/four_32b", "gfx/2d/numbers/five_32b",
                        "gfx/2d/numbers/six_32b", "gfx/2d/numbers/seven_32b", "gfx/2d/numbers/eight_32b", 
                        "gfx/2d/numbers/nine_32b", "gfx/2d/numbers/minus_32b"];
        
        for (let i = 0; i < sb_nums.length; i++) {
            cgsMedia.numberShaders[i] = cgsMedia.registerShader(sb_nums[i]);
        }
        
        // Регистрируем шейдеры навыков ботов
        cgsMedia.botSkillShaders[0] = cgsMedia.registerShader("menu/art/skill1.tga");
        cgsMedia.botSkillShaders[1] = cgsMedia.registerShader("menu/art/skill2.tga");
        cgsMedia.botSkillShaders[2] = cgsMedia.registerShader("menu/art/skill3.tga");
        cgsMedia.botSkillShaders[3] = cgsMedia.registerShader("menu/art/skill4.tga");
        cgsMedia.botSkillShaders[4] = cgsMedia.registerShader("menu/art/skill5.tga");
        cgsMedia.botSkillShaders[5] = cgsMedia.registerShader("menu/art/skill6.tga");
        
        console.log('Шейдеры зарегистрированы как в C89 коде');
        updateStatus('shaderStatus', 'Шейдеры зарегистрированы в cgs.media (как в C89)', 'success');
        
    } catch (error) {
        console.error('Ошибка регистрации шейдеров:', error);
        updateStatus('shaderStatus', `Ошибка регистрации: ${error.message}`, 'error');
    }
}

window.addDemoShader = function(name, path) {
    if (!shaderRegistry) {
        updateStatus('shaderStatus', 'Сначала инициализируйте шейдеры из PK3', 'error');
        return;
    }
    
    // Проверяем, есть ли шейдер в реестре
    if (shaderRegistry.shaders.has(name)) {
        updateStatus('shaderStatus', `Шейдер ${name} уже загружен из PK3`, 'info');
        return;
    }
    
    // Пытаемся загрузить шейдер из PK3
    shaderRegistry.registerShader(name, path);
    updateShaderList();
    updateStatus('shaderStatus', `Добавлен шейдер из PK3: ${name}`, 'success');
}

window.updateShaderList = function() {
    const list = document.getElementById('shaderList');
    list.innerHTML = '';
    
    if (!shaderRegistry) {
        list.innerHTML = '<div style="color: #ccc; text-align: center;">Шейдеры не инициализированы</div>';
        return;
    }
    
    // Разделяем на шейдеры и простые изображения
    const shaders = []; // Объекты с stages/effects
    const images = [];  // Простые текстуры
    
    for (const [name, shader] of shaderRegistry.shaders) {
        // Если есть stages или эффекты - это шейдер
        if (shader.stages && shader.stages.length > 0) {
            shaders.push({name, shader});
        } else {
            images.push({name, shader});
        }
    }
    
    // ========== КАТЕГОРИЯ: ШЕЙДЕРЫ ==========
    if (shaders.length > 0) {
        const shaderMainCategory = document.createElement('div');
        shaderMainCategory.className = 'shader-category';
        
        const mainHeader = document.createElement('div');
        mainHeader.className = 'shader-category-header';
        mainHeader.style.fontSize = '15px';
        mainHeader.style.background = '#2a2a2a';
        mainHeader.innerHTML = `
            <span>🎨 ШЕЙДЕРЫ (${shaders.length})</span>
            <span class="category-arrow">▼</span>
        `;
        
        const mainContent = document.createElement('div');
        mainContent.className = 'shader-category-content';
        
        mainHeader.addEventListener('click', () => {
            mainContent.classList.toggle('hidden');
            mainHeader.classList.toggle('collapsed');
            const arrow = mainHeader.querySelector('.category-arrow');
            arrow.textContent = mainContent.classList.contains('hidden') ? '▶' : '▼';
        });
        
        // Подкатегории шейдеров
        const shaderCategories = {
            'Crosshairs': [],
            'Decor': [],
            'OSP2': [],
            'CMPA': [],
            'FB': [],
            'Community': [],
            'Other': []
        };
        
        for (const item of shaders) {
            const lowerName = item.name.toLowerCase();
            
            if (lowerName.includes('crosshair')) {
                shaderCategories['Crosshairs'].push(item);
            } else if (lowerName.includes('decor')) {
                shaderCategories['Decor'].push(item);
            } else if (item.shader.path && item.shader.path.includes('osp2community')) {
                shaderCategories['Community'].push(item);
            } else if (item.shader.path && item.shader.path.includes('cmpa')) {
                shaderCategories['CMPA'].push(item);
            } else if (item.shader.path && item.shader.path.includes('fb.shader')) {
                shaderCategories['FB'].push(item);
            } else if (item.shader.path && item.shader.path.includes('osp2.shader')) {
                shaderCategories['OSP2'].push(item);
            } else {
                shaderCategories['Other'].push(item);
            }
        }
        
        const categoryIcons = {
            'Crosshairs': '🎯',
            'Decor': '✨',
            'OSP2': '🔧',
            'CMPA': '📦',
            'FB': '🔥',
            'Community': '👥',
            'Other': '📄'
        };
        
        for (const [categoryName, items] of Object.entries(shaderCategories)) {
            if (items.length === 0) continue;
            
            const subCategoryDiv = document.createElement('div');
            subCategoryDiv.className = 'shader-category';
            subCategoryDiv.style.marginLeft = '15px';
            
            const subHeader = document.createElement('div');
            subHeader.className = 'shader-category-header';
            subHeader.style.fontSize = '13px';
            subHeader.innerHTML = `
                <span>${categoryIcons[categoryName]} ${categoryName} (${items.length})</span>
                <span class="category-arrow">▼</span>
            `;
            
            const subContent = document.createElement('div');
            subContent.className = 'shader-category-content';
            
            subHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                subContent.classList.toggle('hidden');
                subHeader.classList.toggle('collapsed');
                const arrow = subHeader.querySelector('.category-arrow');
                arrow.textContent = subContent.classList.contains('hidden') ? '▶' : '▼';
            });
            
            for (const {name, shader} of items) {
                const div = document.createElement('div');
                div.className = 'shader-item';
                
                // Проверяем наличие изображения
                const hasImage = shader.stages && shader.stages[0] && 
                                shader.stages[0].bundle && shader.stages[0].bundle[0] && 
                                shader.stages[0].bundle[0].image && shader.stages[0].bundle[0].image[0];
                
                const imagePath = hasImage ? shader.stages[0].bundle[0].image[0] : null;
                
                // Красный цвет если нет изображения
                const borderColor = (hasImage && !imagePath.startsWith('$')) ? '#444' : '#ff0000';
                const textColor = (hasImage && !imagePath.startsWith('$')) ? '#fff' : '#ffaaaa';
                const badge = (hasImage && !imagePath.startsWith('$')) ? '' : '<span style="color: #ff0000; font-weight: bold; font-size: 9px;">❌ NO IMAGE</span>';
                
                div.style.borderLeft = `3px solid ${borderColor}`;
                
                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: ${textColor}; font-size: 12px;">${name}</strong>
                            <div style="font-size: 10px; color: #888; margin-top: 2px;">
                                ${shader.stages ? shader.stages.length : 0} stages | ${shader.textures ? shader.textures.length : 0} textures ${badge}
                            </div>
                        </div>
                    </div>
                `;
                
                div.addEventListener('click', () => {
                    console.log(`[Клик на шейдер] ${name}`);
                    testShader(name);
                });
                
                subContent.appendChild(div);
            }
            
            subCategoryDiv.appendChild(subHeader);
            subCategoryDiv.appendChild(subContent);
            mainContent.appendChild(subCategoryDiv);
        }
        
        shaderMainCategory.appendChild(mainHeader);
        shaderMainCategory.appendChild(mainContent);
        list.appendChild(shaderMainCategory);
    }
    
    // ========== КАТЕГОРИЯ: ПРОСТЫЕ ИЗОБРАЖЕНИЯ ==========
    if (images.length > 0) {
        const imageMainCategory = document.createElement('div');
        imageMainCategory.className = 'shader-category';
        
        const imgMainHeader = document.createElement('div');
        imgMainHeader.className = 'shader-category-header';
        imgMainHeader.style.fontSize = '15px';
        imgMainHeader.style.background = '#2a2a2a';
        imgMainHeader.innerHTML = `
            <span>🖼️ ПРОСТЫЕ ИЗОБРАЖЕНИЯ (${images.length})</span>
            <span class="category-arrow">▼</span>
        `;
        
        const imgMainContent = document.createElement('div');
        imgMainContent.className = 'shader-category-content';
        
        imgMainHeader.addEventListener('click', () => {
            imgMainContent.classList.toggle('hidden');
            imgMainHeader.classList.toggle('collapsed');
            const arrow = imgMainHeader.querySelector('.category-arrow');
            arrow.textContent = imgMainContent.classList.contains('hidden') ? '▶' : '▼';
        });
        
        for (const {name, shader} of images) {
            const div = document.createElement('div');
            div.className = 'shader-item';
            
            // Для простых изображений всегда красная рамка (нет stages)
            div.style.borderLeft = '3px solid #ff0000';
            
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #ffaaaa; font-size: 12px;">${name}</strong>
                        <div style="font-size: 10px; color: #888; margin-top: 2px;">
                            Простое изображение <span style="color: #ff0000; font-weight: bold; font-size: 9px;">❌ NO IMAGE</span>
                        </div>
                    </div>
                </div>
            `;
            
            div.addEventListener('click', () => {
                console.log(`[Клик на изображение] ${name}`);
                testShader(name);
            });
            
            imgMainContent.appendChild(div);
        }
        
        imageMainCategory.appendChild(imgMainHeader);
        imageMainCategory.appendChild(imgMainContent);
        list.appendChild(imageMainCategory);
    }
}

// Функция для загрузки всех шейдеров
window.loadAllShaders = async function() {
    if (!shaderRegistry) {
        updateStatus('shaderStatus', 'Шейдеры не инициализированы', 'error');
        return;
    }
    
    try {
        updateStatus('shaderStatus', 'Загрузка всех шейдеров...', 'info');
        
        let totalShaders = 0;
        let totalTextures = 0;
        
        // Загружаем все файлы шейдеров
        for (const [filename, shaderFile] of shaderRegistry.shaderFiles) {
            try {
                await shaderRegistry.loadShaderFile(filename);
                
                // Подсчитываем шейдеры и текстуры
                if (shaderFile.parsedShaders) {
                    totalShaders += shaderFile.parsedShaders.length;
                    for (const shader of shaderFile.parsedShaders) {
                        totalTextures += shader.textures ? shader.textures.length : 0;
                    }
                }
            } catch (error) {
                console.error(`Ошибка загрузки файла ${filename}:`, error);
            }
        }
        
        updateStatus('shaderStatus', `Загружено ${totalShaders} шейдеров и ${totalTextures} текстур из всех файлов`, 'success');
        
        // Обновляем список
        updateShaderList();
    } catch (error) {
        updateStatus('shaderStatus', `Ошибка загрузки всех шейдеров: ${error.message}`, 'error');
    }
}

// Функция для загрузки файла шейдеров
window.loadShaderFile = async function(filename) {
    if (!shaderRegistry) {
        updateStatus('shaderStatus', 'Шейдеры не инициализированы', 'error');
        return;
    }
    
    try {
        updateStatus('shaderStatus', `Загрузка файла шейдеров: ${filename}...`, 'info');
        
        const content = await shaderRegistry.loadShaderFile(filename);
        const shaderFile = shaderRegistry.shaderFiles.get(filename);
        
        if (content && shaderFile) {
            let totalTextures = 0;
            for (const shader of shaderFile.parsedShaders) {
                totalTextures += shader.textures ? shader.textures.length : 0;
            }
            
            updateStatus('shaderStatus', `Файл ${filename} загружен: ${shaderFile.parsedShaders.length} шейдеров, ${totalTextures} текстур`, 'success');
            
            // Обновляем список
            updateShaderList();
        } else {
            updateStatus('shaderStatus', `Не удалось загрузить файл шейдеров: ${filename}`, 'error');
        }
    } catch (error) {
        updateStatus('shaderStatus', `Ошибка загрузки файла шейдеров: ${error.message}`, 'error');
    }
}

// Функция для тестирования текстуры
window.testTexture = async function(name) {
    if (!shaderRegistry) {
        updateStatus('shaderStatus', 'Текстуры не инициализированы', 'error');
        return;
    }
    
    if (!shaderRenderer) {
        updateStatus('shaderStatus', 'Рендерер не инициализирован', 'error');
        return;
    }
    
    try {
        updateStatus('shaderStatus', `Загрузка и отрисовка текстуры: ${name}...`, 'info');
        
        // Получаем информацию о текстуре
        const textureInfo = shaderRegistry.textures.get(name);
        if (!textureInfo) {
            updateStatus('shaderStatus', `Текстура ${name} не найдена в реестре`, 'error');
            return;
        }
        
        console.log(`[testTexture] Загрузка текстуры: ${name} из ${textureInfo.path}`);
        
        // Загружаем изображение через рендерер
        const img = await shaderRenderer.loadImageFromPk3(textureInfo.path);
        
        if (img) {
            // Очищаем canvas (с текущим фоном)
            clearShaderCanvas();
            
            // Рисуем текстуру по центру
            const x = (640 - 200) / 2;
            const y = (480 - 200) / 2;
            
            shaderRenderer.ctx.drawImage(img, x * shaderRenderer.scaleX, y * shaderRenderer.scaleY, 
                                         200 * shaderRenderer.scaleX, 200 * shaderRenderer.scaleY);
            
            updateStatus('shaderStatus', `✓ Текстура ${name} отрисована: ${img.width}x${img.height}`, 'success');
            console.log(`[testTexture] ✓ Текстура отрисована: ${name}`);
        } else {
            updateStatus('shaderStatus', `Не удалось загрузить текстуру: ${name}`, 'error');
        }
    } catch (error) {
        updateStatus('shaderStatus', `Ошибка тестирования текстуры: ${error.message}`, 'error');
        console.error(`[testTexture] Ошибка:`, error);
    }
}

window.testShader = async function(name) {
    console.log(`[testShader] Вызван для шейдера: ${name}`);
    
    if (!shaderRegistry) {
        updateStatus('shaderStatus', 'Шейдеры не инициализированы из PK3', 'error');
        return;
    }
    
    try {
        updateStatus('shaderStatus', `Рендеринг шейдера: ${name}...`, 'info');
        
        // Получаем информацию о шейдере из реестра (теперь по прямому имени)
        const shader = shaderRegistry.shaders.get(name);
        if (!shader) {
            throw new Error(`Шейдер ${name} не найден в реестре`);
        }
        
        console.log(`[testShader] Шейдер найден:`, shader);
        
        // Очищаем canvas (БЕЗ сохранения, чтобы подготовить к новой отрисовке)
        clearShaderCanvas(false);
        
        // name уже содержит имя шейдера без префикса
        const shaderName = name;
        
        console.log(`[testShader] Имя шейдера для отрисовки: ${shaderName}`);
        console.log(`[testShader] Stages в шейдере:`, shader.stages);
        
        // Рендерим шейдер на canvas как в Quake 3
        if (shaderRenderer) {
            console.log(`[testShader] Рендерер найден, начинаем отрисовку...`);
            
            // ВАЖНО: Сначала регистрируем шейдер напрямую в локальном кэше рендерера
            // (чтобы window.shaderRegistry.getShader мог его найти)
            console.log(`[testShader] Добавляем шейдер в локальный кэш рендерера`);
            shaderRenderer.registeredShaders.set(shaderName, shader);
            
            // Регистрируем шейдер через trap_R_RegisterShader (получаем handle)
            console.log(`[testShader] Регистрируем через trap_R_RegisterShader...`);
            const handle = shaderRenderer.trap_R_RegisterShader(shaderName);
            console.log(`[testShader] Получен handle: ${handle}`);
            
            // Рисуем тестовый прямоугольник с шейдером используя handle
            shaderRenderer.trap_SetColor(1.0, 1.0, 1.0, 1.0);
            console.log(`[testShader] Вызываем trap_R_DrawStretchPic с handle ${handle}...`);
            shaderRenderer.trap_R_DrawStretchPic(50, 50, 200, 200, 0, 0, 1, 1, handle);
            
            // Сохраняем информацию о последнем нарисованном шейдере для перерисовки
            lastDrawnShader = {
                name: shaderName,
                shader: shader,
                x: 50,
                y: 50,
                w: 200,
                h: 200
            };
            
            // Запускаем анимацию если есть анимированные tcMod
            if (hasAnimatedTcMod(shader)) {
                console.log(`[testShader] ✓ Обнаружены анимированные tcMod, запускаем анимацию...`);
                startShaderAnimation();
            } else {
                // Останавливаем анимацию если её не нужно
                stopShaderAnimation();
            }
            
            // Обновляем статус
            if (shader.stages && shader.stages.length > 0) {
                const hasAnim = hasAnimatedTcMod(shader) ? ' 🔄' : '';
                updateStatus('shaderStatus', `✓ Шейдер ${shaderName} (${shader.stages.length} stages)${hasAnim}`, 'success');
            } else {
                updateStatus('shaderStatus', `✓ Шейдер ${shaderName}`, 'success');
            }
        } else {
            throw new Error('Рендерер не инициализирован');
        }
    } catch (error) {
        console.error('[testShader] Ошибка:', error);
        updateStatus('shaderStatus', `Ошибка рендеринга шейдера: ${error.message}`, 'error');
    }
}

// Функция для рендеринга шейдера с параметрами
async function renderShaderWithParameters(renderer, shader, shaderName) {
    // Рендерим каждый stage
    for (let i = 0; i < shader.stages.length; i++) {
        const stage = shader.stages[i];
        await renderShaderStage(renderer, stage, i + 1, shaderName);
    }
    
    // Рендерим информацию о шейдере
    renderShaderInfo(renderer, shader, shaderName);
}

// Функция для рендеринга шейдера как в Quake 3
async function renderQuake3Shader(renderer, shaderData, shaderName) {
    const lines = shaderData.content.split('\n');
    let inStage = false;
    let stageCount = 0;
    let currentStage = null;
    
    // Парсим шейдер построчно
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Начало нового stage (блока {)
        if (line === '{' && !inStage) {
            inStage = true;
            currentStage = {
                map: null,
                blendFunc: 'GL_ONE GL_ONE',
                rgbGen: 'vertex',
                tcGen: null,
                tcMod: [],
                deform: null,
                cull: 'front',
                nopicmip: false,
                nomipmaps: false
            };
            stageCount++;
        }
        // Конец stage (блок })
        else if (line === '}' && inStage) {
            if (currentStage) {
                await renderShaderStage(renderer, currentStage, stageCount, shaderName);
            }
            inStage = false;
            currentStage = null;
        }
        // Парсим команды внутри stage
        else if (inStage && currentStage) {
            parseShaderCommand(line, currentStage);
        }
    }
    
    // Рисуем информацию о шейдере
    renderShaderInfo(renderer, shaderData, shaderName);
}

// Парсинг команд шейдера
function parseShaderCommand(line, stage) {
    if (line.startsWith('map ')) {
        stage.map = line.substring(4).trim();
    } else if (line.startsWith('blendFunc ')) {
        stage.blendFunc = line.substring(10).trim();
    } else if (line.startsWith('rgbGen ')) {
        stage.rgbGen = line.substring(7).trim();
    } else if (line.startsWith('tcGen ')) {
        stage.tcGen = line.substring(6).trim();
    } else if (line.startsWith('tcmod ')) {
        stage.tcMod.push(line.substring(6).trim());
    } else if (line.startsWith('deformvertexes ')) {
        stage.deform = line.substring(15).trim();
    } else if (line.startsWith('cull ')) {
        stage.cull = line.substring(5).trim();
    } else if (line === 'nopicmip') {
        stage.nopicmip = true;
    } else if (line === 'nomipmaps') {
        stage.nomipmaps = true;
    }
}

// Рендеринг одного stage шейдера (с поддержкой новой структуры bundles)
async function renderShaderStage(renderer, stage, stageNumber, shaderName) {
    const x = 50;
    const y = 50 + (stageNumber - 1) * 120;
    const width = 250;
    const height = 110;
    
    // Фон для stage
    renderer.trap_SetColor(0.15, 0.15, 0.15, 0.95);
    renderer.trap_FillRect(x, y, width, height);
    
    // Заголовок stage
    renderer.ctx.fillStyle = '#4CAF50';
    renderer.ctx.font = 'bold 13px monospace';
    renderer.ctx.fillText(`Stage ${stageNumber}`, (x + 5) * renderer.scaleX, (y + 15) * renderer.scaleY);
    
    // Информация о stage
    renderer.ctx.font = '11px monospace';
    let textY = y + 30;
    const lineHeight = 13;
    
    // Проверяем наличие текстурных bundles
    if (stage.bundle && stage.bundle[0]) {
        const bundle = stage.bundle[0];
        
        // Отображаем текстуры из bundle
        if (bundle.image && bundle.image.length > 0) {
            // Если анимированные текстуры
            if (bundle.numImageAnimations > 1) {
                renderer.ctx.fillStyle = '#FFD700';
                renderer.ctx.fillText(`animMap (${bundle.numImageAnimations} frames, ${bundle.imageAnimationSpeed}fps)`, (x + 5) * renderer.scaleX, textY * renderer.scaleY);
                textY += lineHeight;
                
                for (let i = 0; i < Math.min(bundle.numImageAnimations, 2); i++) {
                    renderer.ctx.fillStyle = '#AAAAAA';
                    const imageName = bundle.image[i] || '';
                    const shortName = imageName.length > 28 ? '...' + imageName.slice(-25) : imageName;
                    renderer.ctx.fillText(`  ${i}: ${shortName}`, (x + 5) * renderer.scaleX, textY * renderer.scaleY);
                    textY += lineHeight;
                }
                
                if (bundle.numImageAnimations > 2) {
                    renderer.ctx.fillStyle = '#888888';
                    renderer.ctx.fillText(`  ... +${bundle.numImageAnimations - 2} more`, (x + 5) * renderer.scaleX, textY * renderer.scaleY);
                    textY += lineHeight;
                }
            } else if (bundle.image[0]) {
                // Одиночная текстура
                renderer.ctx.fillStyle = '#4CAF50';
                const imageName = bundle.image[0];
                const shortName = imageName.length > 30 ? '...' + imageName.slice(-27) : imageName;
                renderer.ctx.fillText(`map: ${shortName}`, (x + 5) * renderer.scaleX, textY * renderer.scaleY);
                textY += lineHeight;
            }
        }
        
        // TC Gen (только если не default)
        if (bundle.tcGen && bundle.tcGen !== 'TCGEN_TEXTURE') {
            renderer.ctx.fillStyle = '#00BCD4';
            renderer.ctx.fillText(`tcGen: ${bundle.tcGen.replace('TCGEN_', '')}`, (x + 5) * renderer.scaleX, textY * renderer.scaleY);
            textY += lineHeight;
        }
        
        // TC Mods
        if (bundle.texMods && bundle.texMods.length > 0) {
            renderer.ctx.fillStyle = '#FF9800';
            renderer.ctx.fillText(`tcMods: ${bundle.texMods.length}`, (x + 5) * renderer.scaleX, textY * renderer.scaleY);
            textY += lineHeight;
            for (const mod of bundle.texMods.slice(0, 1)) {
                const shortMod = mod.length > 30 ? mod.slice(0, 27) + '...' : mod;
                renderer.ctx.fillStyle = '#CCCCCC';
                renderer.ctx.fillText(`  ${shortMod}`, (x + 5) * renderer.scaleX, textY * renderer.scaleY);
                textY += lineHeight;
            }
        }
    }
    
    // Blend function
    if (stage.blendFunc) {
        renderer.ctx.fillStyle = '#E91E63';
        const blendShort = stage.blendFunc.replace(/GL_/g, '');
        renderer.ctx.fillText(`blend: ${blendShort}`, (x + 5) * renderer.scaleX, textY * renderer.scaleY);
        textY += lineHeight;
    }
    
    // RGB/Alpha Gen (только если не default)
    if (stage.rgbGen && !stage.rgbGen.includes('IDENTITY')) {
        renderer.ctx.fillStyle = '#9C27B0';
        renderer.ctx.fillText(`rgb: ${stage.rgbGen.replace('CGEN_', '')}`, (x + 5) * renderer.scaleX, textY * renderer.scaleY);
        textY += lineHeight;
    }
    
    // Визуальные индикаторы (правая часть)
    let indicatorY = y + 5;
    const indicatorX = x + width - 25;
    
    // Аддитивный блендинг
    if (stage.blendSrc === 'GL_ONE' && stage.blendDst === 'GL_ONE') {
        renderer.trap_SetColor(1.0, 1.0, 0.0, 0.8);
        renderer.trap_FillRect(indicatorX, indicatorY, 20, 8);
        indicatorY += 10;
    }
    
    // Анимация
    if (stage.bundle && stage.bundle[0] && stage.bundle[0].numTexMods > 0) {
        renderer.trap_SetColor(1.0, 0.5, 0.0, 0.8);
        renderer.trap_FillRect(indicatorX, indicatorY, 20, 8);
        indicatorY += 10;
    }
    
    // Detail
    if (stage.isDetail) {
        renderer.trap_SetColor(0.0, 1.0, 1.0, 0.8);
        renderer.trap_FillRect(indicatorX, indicatorY, 20, 8);
    }
    
    // Рисуем рамку
    renderer.trap_SetColor(0.6, 0.6, 0.6, 1.0);
    renderer.ctx.strokeStyle = 'rgba(153, 153, 153, 1.0)';
    renderer.ctx.lineWidth = 1;
    renderer.ctx.strokeRect(x * renderer.scaleX, y * renderer.scaleY, 
                           width * renderer.scaleX, height * renderer.scaleY);
}

// Рендеринг информации о шейдере (справа от изображения)
function renderShaderInfo(renderer, shader, shaderName) {
    const infoX = 280; // Правее от canvas с изображением
    const infoY = 50;
    const infoWidth = 340;
    const infoHeight = 380;
    
    // Фон для информации
    renderer.trap_SetColor(0.1, 0.1, 0.1, 0.9);
    renderer.trap_FillRect(infoX, infoY, infoWidth, infoHeight);
    
    // Заголовок
    renderer.ctx.fillStyle = '#4CAF50';
    renderer.ctx.font = 'bold 14px monospace';
    renderer.ctx.fillText(`Shader Summary`, (infoX + 10) * renderer.scaleX, (infoY + 20) * renderer.scaleY);
    
    // Текст информации
    renderer.ctx.fillStyle = '#FFFFFF';
    renderer.ctx.font = '11px monospace';
    let textY = infoY + 40;
    const lineHeight = 14;
    
    // Имя шейдера
    const shortName = shaderName.length > 40 ? '...' + shaderName.slice(-37) : shaderName;
    renderer.ctx.fillText(`Name: ${shortName}`, (infoX + 10) * renderer.scaleX, textY * renderer.scaleY);
    textY += lineHeight;
    
    // Количество stages
    renderer.ctx.fillStyle = '#FFD700';
    renderer.ctx.fillText(`Stages: ${shader.stages.length}`, (infoX + 10) * renderer.scaleX, textY * renderer.scaleY);
    textY += lineHeight;
    
    // Подсчитываем уникальные текстуры из всех bundles
    const allTextures = new Set();
    if (shader.stages) {
        for (const stage of shader.stages) {
            if (stage.bundle && stage.bundle[0] && stage.bundle[0].image) {
                for (const img of stage.bundle[0].image) {
                    if (img) allTextures.add(img);
                }
            }
        }
    }
    
    renderer.ctx.fillStyle = '#00BCD4';
    renderer.ctx.fillText(`Textures: ${allTextures.size}`, (infoX + 10) * renderer.scaleX, textY * renderer.scaleY);
    textY += lineHeight + 5;
    
    // Детали каждого stage
    renderer.ctx.fillStyle = '#FFFFFF';
    renderer.ctx.font = 'bold 11px monospace';
    renderer.ctx.fillText(`Stage Details:`, (infoX + 10) * renderer.scaleX, textY * renderer.scaleY);
    textY += lineHeight;
    
    renderer.ctx.font = '10px monospace';
    for (let i = 0; i < Math.min(shader.stages.length, 15); i++) {
        const stage = shader.stages[i];
        
        renderer.ctx.fillStyle = '#888';
        renderer.ctx.fillText(`Stage ${i + 1}:`, (infoX + 15) * renderer.scaleX, textY * renderer.scaleY);
        textY += lineHeight - 2;
        
        // BlendFunc
        if (stage.blendFunc) {
            renderer.ctx.fillStyle = '#E91E63';
            const blend = stage.blendFunc.replace(/GL_/g, '').substring(0, 30);
            renderer.ctx.fillText(`  blend: ${blend}`, (infoX + 15) * renderer.scaleX, textY * renderer.scaleY);
            textY += lineHeight - 2;
        }
        
        // RgbGen
        if (stage.rgbGen) {
            renderer.ctx.fillStyle = '#9C27B0';
            renderer.ctx.fillText(`  rgb: ${stage.rgbGen.replace('CGEN_', '')}`, (infoX + 15) * renderer.scaleX, textY * renderer.scaleY);
            textY += lineHeight - 2;
        }
        
        // Image
        if (stage.bundle && stage.bundle[0] && stage.bundle[0].image && stage.bundle[0].image[0]) {
            const img = stage.bundle[0].image[0];
            const shortImg = img.length > 35 ? '...' + img.slice(-32) : img;
            renderer.ctx.fillStyle = '#4CAF50';
            renderer.ctx.fillText(`  map: ${shortImg}`, (infoX + 15) * renderer.scaleX, textY * renderer.scaleY);
            textY += lineHeight - 2;
        }
        
        textY += 3; // Отступ между stages
    }
    
    // Рамка
    renderer.trap_SetColor(0.5, 0.5, 0.5, 1.0);
    renderer.ctx.strokeStyle = 'rgba(128, 128, 128, 1.0)';
    renderer.ctx.lineWidth = 2;
    renderer.ctx.strokeRect(infoX * renderer.scaleX, infoY * renderer.scaleY, 
                          infoWidth * renderer.scaleX, infoHeight * renderer.scaleY);
}

// Функция для загрузки содержимого шейдера из PK3
async function loadShaderFromPk3(shaderPath) {
    try {
        // Используем кэшированный ZIP архив
        const zip = await window.getCachedZip();
        
        // Ищем файл в архиве
        const file = zip.file(shaderPath);
        if (!file) {
            throw new Error(`Файл ${shaderPath} не найден в PK3 архиве`);
        }
        
        // Извлекаем содержимое как текст
        const content = await file.async('text');
        
        if (!content || content.length === 0) {
            throw new Error(`Файл ${shaderPath} пуст`);
        }
        
        console.log(`[loadShaderFromPk3] ✓ ${shaderPath} (${content.length} символов)`);
        return content;
        
    } catch (error) {
        console.error(`[loadShaderFromPk3] ✗ ${shaderPath}:`, error.message);
        throw error;
    }
}

// Функция для загрузки текстуры из PK3
async function loadTextureFromPk3(texturePath) {
    try {
        // Если рендерер не инициализирован, просто пропускаем
        if (!window.shaderRenderer) {
            return null;
        }
        
        // Используем метод рендерера для загрузки изображения (с кэшем ZIP)
        const image = await window.shaderRenderer.loadImageFromPk3(texturePath);
        
        if (image) {
            return {
                name: texturePath,
                width: image.width,
                height: image.height,
                format: 'RGBA',
                data: image
            };
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// Глобальная переменная для хранения последнего отрисованного шейдера
let lastDrawnShader = null;

// Система анимации шейдеров
let shaderAnimationFrameId = null;

function startShaderAnimation() {
    // Останавливаем предыдущую анимацию если была
    if (shaderAnimationFrameId) {
        cancelAnimationFrame(shaderAnimationFrameId);
    }
    
    function animateShader() {
        if (lastDrawnShader && shaderRenderer) {
            // Проверяем, нужна ли анимация (есть ли tcMod с анимацией)
            if (hasAnimatedTcMod(lastDrawnShader.shader)) {
                // Очищаем и применяем фон
                const bgType = shaderRenderer.canvas.dataset.bgType || 'black';
                shaderRenderer.ctx.clearRect(0, 0, shaderRenderer.canvas.width, shaderRenderer.canvas.height);
                applyCanvasBackground(shaderRenderer, bgType);
                
                // Перерисовываем шейдер
                try {
                    shaderRenderer.registeredShaders.set(lastDrawnShader.name, lastDrawnShader.shader);
                    const handle = shaderRenderer.trap_R_RegisterShader(lastDrawnShader.name);
                    shaderRenderer.trap_SetColor(1.0, 1.0, 1.0, 1.0);
                    shaderRenderer.trap_R_DrawStretchPic(
                        lastDrawnShader.x || 50, 
                        lastDrawnShader.y || 50, 
                        lastDrawnShader.w || 200, 
                        lastDrawnShader.h || 200, 
                        0, 0, 1, 1, 
                        handle
                    );
                } catch (error) {
                    console.error('[animateShader] Ошибка анимации:', error);
                    stopShaderAnimation();
                    return;
                }
                
                // Продолжаем анимацию
                shaderAnimationFrameId = requestAnimationFrame(animateShader);
            }
        }
    }
    
    // Запускаем анимацию
    shaderAnimationFrameId = requestAnimationFrame(animateShader);
}

function stopShaderAnimation() {
    if (shaderAnimationFrameId) {
        cancelAnimationFrame(shaderAnimationFrameId);
        shaderAnimationFrameId = null;
    }
}

// Проверка наличия анимированных tcMod или wave функций
function hasAnimatedTcMod(shader) {
    if (!shader || !shader.stages) {
        return false;
    }
    
    for (const stage of shader.stages) {
        // Проверяем alphaGen wave
        if (stage.alphaGen && (stage.alphaGen.includes('WAVE') || stage.alphaWave)) {
            return true;
        }
        
        // Проверяем rgbGen wave
        if (stage.rgbGen && (stage.rgbGen.includes('WAVE') || stage.rgbWave)) {
            return true;
        }
        
        // Проверяем tcMod
        if (stage.bundle) {
            for (const bundle of stage.bundle) {
                if (bundle.texMods && bundle.texMods.length > 0) {
                    // Проверяем есть ли анимированные tcMod (rotate, scroll, stretch, turb)
                    for (const texMod of bundle.texMods) {
                        const type = texMod.toLowerCase();
                        if (type.includes('rotate') || type.includes('scroll') || 
                            type.includes('stretch') || type.includes('turb')) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    
    return false;
}

window.clearShaderCanvas = function(keepLastShader = true) {
    if (shaderRenderer && shaderRenderer.ctx) {
        shaderRenderer.ctx.clearRect(0, 0, shaderRenderer.canvas.width, shaderRenderer.canvas.height);
        
        // Применяем текущий фон (сохранен в атрибуте canvas)
        const bgType = shaderRenderer.canvas.dataset.bgType || 'black';
        applyCanvasBackground(shaderRenderer, bgType);
        
        // Перерисовываем последний шейдер если нужно
        if (keepLastShader && lastDrawnShader) {
            redrawLastShader();
        } else if (!keepLastShader) {
            // Если явно не хотим сохранять - очищаем сохраненный шейдер и останавливаем анимацию
            lastDrawnShader = null;
            stopShaderAnimation();
        }
        
        updateStatus('shaderStatus', 'Canvas очищен', 'success');
    } else {
        updateStatus('shaderStatus', 'Canvas не инициализирован', 'error');
    }
}

window.setShaderCanvasBackground = function(type) {
    if (!shaderRenderer || !shaderRenderer.canvas) {
        updateStatus('shaderStatus', 'Canvas не инициализирован', 'error');
        return;
    }
    
    // Сохраняем тип фона
    shaderRenderer.canvas.dataset.bgType = type;
    
    // Очищаем canvas
    shaderRenderer.ctx.clearRect(0, 0, shaderRenderer.canvas.width, shaderRenderer.canvas.height);
    
    // Применяем новый фон
    applyCanvasBackground(shaderRenderer, type);
    
    // Перерисовываем последний шейдер
    if (lastDrawnShader) {
        redrawLastShader();
    }
    
    updateStatus('shaderStatus', `Фон изменен: ${type}`, 'success');
}

// Функция для перерисовки последнего шейдера
function redrawLastShader() {
    if (!lastDrawnShader || !shaderRenderer) {
        return;
    }
    
    try {
        // Регистрируем шейдер в локальном кэше
        shaderRenderer.registeredShaders.set(lastDrawnShader.name, lastDrawnShader.shader);
        
        // Регистрируем через trap_R_RegisterShader
        const handle = shaderRenderer.trap_R_RegisterShader(lastDrawnShader.name);
        
        // Рисуем шейдер с сохраненными параметрами
        shaderRenderer.trap_SetColor(1.0, 1.0, 1.0, 1.0);
        shaderRenderer.trap_R_DrawStretchPic(
            lastDrawnShader.x || 50, 
            lastDrawnShader.y || 50, 
            lastDrawnShader.w || 200, 
            lastDrawnShader.h || 200, 
            0, 0, 1, 1, 
            handle
        );
    } catch (error) {
        console.error('[redrawLastShader] Ошибка перерисовки:', error);
    }
}

function applyCanvasBackground(renderer, type) {
    const ctx = renderer.ctx;
    const w = renderer.canvas.width;
    const h = renderer.canvas.height;
    
    if (type === 'black') {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, w, h);
    } else if (type === 'gray') {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, w, h);
    } else if (type === 'white') {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, w, h);
    } else if (type === 'checkerboard') {
        // Рисуем шахматный узор
        const tileSize = 20;
        for (let y = 0; y < h; y += tileSize) {
            for (let x = 0; x < w; x += tileSize) {
                const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
                ctx.fillStyle = isEven ? '#cccccc' : '#ffffff';
                ctx.fillRect(x, y, tileSize, tileSize);
            }
        }
    }
}

window.testShaderRender = async function() {
    if (!shaderRegistry) {
        updateStatus('shaderStatus', 'Сначала инициализируйте шейдеры из PK3', 'error');
        return;
    }
    
    clearShaderCanvas();
    
    try {
        // Простой тест рендеринга с базовым рендерером
        shaderRenderer.trap_SetColor(0.0, 0.0, 0.0, 0.8);
        shaderRenderer.trap_FillRect(0, 0, 640, 60);
        
        shaderRenderer.trap_SetColor(1.0, 0.0, 0.0, 1.0);
        shaderRenderer.trap_DrawPic(10, 10, 32, 32, 'health');
        
        shaderRenderer.trap_SetColor(0.0, 0.0, 1.0, 1.0);
        shaderRenderer.trap_DrawPic(50, 10, 32, 32, 'armor');
        
        shaderRenderer.trap_SetColor(1.0, 1.0, 0.0, 1.0);
        shaderRenderer.trap_DrawPic(580, 10, 50, 32, 'ammo');
    
    updateStatus('shaderStatus', 'Тест рендеринга завершен', 'success');
    } catch (error) {
        updateStatus('shaderStatus', `Ошибка рендеринга: ${error.message}`, 'error');
    }
}

