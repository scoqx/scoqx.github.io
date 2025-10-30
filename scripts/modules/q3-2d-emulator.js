/**
 * Quake 3 2D Renderer Emulator
 * Простой эмулятор 2D рендера для создания худа
 * 
 * Version: be-1.00-beta-12
 * 
 * Changelog beta-12:
 * - ИСПРАВЛЕНО: tcMod transform теперь применяется относительно центра
 *   * Игнорируются параметры t0/t1 для смещения Canvas (они для UV space)
 *   * Трансформация применяется вокруг центра изображения как rotate/scale
 *   * Изображение остаётся в центре при повороте
 * 
 * Changelog beta-11:
 * - ИСПРАВЛЕНО: tcMod rotate теперь использует правильное направление вращения
 *   * Добавлен знак минус как в оригинале (degs = -degsPerSecond × time)
 * - ИСПРАВЛЕНО: tcMod transform теперь инвертирует матрицу
 *   * UV трансформация (откуда брать пиксели) vs позиционная (куда рисовать)
 * 
 * Changelog beta-10:
 * - ИСПРАВЛЕНО: tcMod transform - убрано двойное смещение из-за translate(center)
 * 
 * Changelog beta-9:
 * - Исправлено использование единиц времени в tcMod согласно спецификации Quake 3
 * - tcMod scroll: единицы текстурных координат в секунду
 * - tcMod rotate: градусы в секунду
 * - tcMod turb/stretch: frequency в Герцах (циклов в секунду)
 * - Исправлена формула wave: фаза = phase + time × frequency
 */

// Глобальный кэш для распакованного PK3 архива
let cachedZip = null;
let cachedZipPromise = null;

// Функция для получения кэшированного ZIP
async function getCachedZip() {
    // Если уже загружаем - возвращаем тот же промис
    if (cachedZipPromise) {
        return cachedZipPromise;
    }
    
    // Если уже загружен - возвращаем кэш
    if (cachedZip) {
        return cachedZip;
    }
    
    // Загружаем и кэшируем
    cachedZipPromise = (async () => {
        console.log('[Q32DRenderer] Загрузка PK3 архива для кэширования...');
        const response = await fetch('../../assets/zz-osp-pak8be.pk3');
        const arrayBuffer = await response.arrayBuffer();
        cachedZip = await JSZip.loadAsync(arrayBuffer);
        console.log(`[Q32DRenderer] ✓ PK3 архив загружен и закэширован (${Object.keys(cachedZip.files).length} файлов)`);
        cachedZipPromise = null;
        return cachedZip;
    })();
    
    return cachedZipPromise;
}

// Экспортируем глобально
window.getCachedZip = getCachedZip;

class Q32DRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.currentColor = [1.0, 1.0, 1.0, 1.0]; // RGBA
        this.virtualWidth = 640;
        this.virtualHeight = 480;
        this.scaleX = canvas.width / this.virtualWidth;
        this.scaleY = canvas.height / this.virtualHeight;
        
        // Кэш зарегистрированных шейдеров (по имени и по handle)
        this.registeredShaders = new Map(); // name -> shader
        this.shaderHandles = [];  // qhandle_t array (index -> shader)
        this.shaderNameToHandle = new Map(); // name -> handle
        this.loadedImages = new Map();
        this.loadingImages = new Set(); // Набор изображений которые сейчас загружаются
        
        this.initializeRenderer();
    }
    
    initializeRenderer() {
        // Устанавливаем дефолтный фон если не задан
        if (!this.canvas.dataset.bgType) {
            this.canvas.dataset.bgType = 'black';
        }
        
        // Очищаем canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Создаем дефолтное изображение "NO IMAGE"
        this.createNoImagePlaceholder();
    }
    
    /**
     * Создание дефолтного изображения для отсутствующих текстур
     */
    createNoImagePlaceholder() {
        // Загружаем no-image.png из assets
        const img = new Image();
        img.onload = () => {
            console.log('[Q32DRenderer] ✓ NO IMAGE placeholder загружен');
        };
        img.onerror = () => {
            console.warn('[Q32DRenderer] ⚠️ Не удалось загрузить no-image.png, создаем программно');
            // Fallback - создаем программно
            this.createNoImageFallback();
        };
        img.src = '../../assets/no-image.png';
        
        // Сохраняем в кеш под специальным именем
        this.loadedImages.set('*noimage', img);
        this.loadedImages.set('$noimage', img);
    }
    
    /**
     * Fallback - программное создание NO IMAGE если файл не загрузился
     */
    createNoImageFallback() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Красный фон с градиентом
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#c83232');
        gradient.addColorStop(1, '#a02020');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // Темная рамка
        ctx.strokeStyle = '#640000';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, size - 2, size - 2);
        
        // Крестик
        ctx.strokeStyle = 'rgba(100, 0, 0, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(10, 10);
        ctx.lineTo(size - 10, size - 10);
        ctx.moveTo(size - 10, 10);
        ctx.lineTo(10, size - 10);
        ctx.stroke();
        
        // Конвертируем в Image
        const img = new Image();
        img.src = canvas.toDataURL();
        
        // Обновляем в кеше
        this.loadedImages.set('*noimage', img);
        this.loadedImages.set('$noimage', img);
    }
    
    /**
     * Установка цвета (аналог trap_SetColor)
     */
    trap_SetColor(r, g, b, a) {
        this.currentColor[0] = Math.max(0.0, Math.min(1.0, r));
        this.currentColor[1] = Math.max(0.0, Math.min(1.0, g));
        this.currentColor[2] = Math.max(0.0, Math.min(1.0, b));
        this.currentColor[3] = Math.max(0.0, Math.min(1.0, a));
        
        // Сразу применяем цвет
        const r255 = Math.floor(this.currentColor[0] * 255);
        const g255 = Math.floor(this.currentColor[1] * 255);
        const b255 = Math.floor(this.currentColor[2] * 255);
        const a255 = this.currentColor[3];
        
        this.ctx.fillStyle = `rgba(${r255}, ${g255}, ${b255}, ${a255})`;
        this.ctx.strokeStyle = `rgba(${r255}, ${g255}, ${b255}, ${a255})`;
    }
    
    /**
     * Регистрация шейдера (аналог trap_R_RegisterShader)
     * Возвращает qhandle_t (индекс шейдера)
     */
    trap_R_RegisterShader(shaderName) {
        // Проверяем не зарегистрирован ли уже
        if (this.shaderNameToHandle.has(shaderName)) {
            const handle = this.shaderNameToHandle.get(shaderName);
            console.log(`[trap_R_RegisterShader] Шейдер ${shaderName} уже зарегистрирован, handle: ${handle}`);
            return handle;
        }
        
        console.log(`[trap_R_RegisterShader] Регистрация: ${shaderName}`);
        
        // Сначала проверяем локальный кэш рендерера
        let shader = this.registeredShaders.get(shaderName);
        
        // Если не нашли локально, ищем в глобальном реестре
        if (!shader && window.shaderRegistry) {
            shader = window.shaderRegistry.getShader(shaderName);
        }
        
        if (!shader) {
            console.warn(`[trap_R_RegisterShader] Шейдер не найден в реестре: ${shaderName}`);
            // Создаем пустой шейдер
            shader = { name: shaderName, stages: [], path: null };
        } else {
            console.log(`[trap_R_RegisterShader] Шейдер найден, stages: ${shader.stages?.length || 0}`);
        }
        
        // Регистрируем шейдер с новым handle
        const handle = this.shaderHandles.length;
        this.shaderHandles.push(shader);
        this.registeredShaders.set(shaderName, shader);
        this.shaderNameToHandle.set(shaderName, handle);
        
        console.log(`[trap_R_RegisterShader] ✓ Шейдер зарегистрирован: ${shaderName} -> handle ${handle}`);
        
        return handle;
    }
    
    /**
     * Регистрация шейдера без миpmaps (аналог trap_R_RegisterShaderNoMip)
     */
    trap_R_RegisterShaderNoMip(shaderName) {
        // В нашей 2D реализации это то же самое что и обычная регистрация
        return this.trap_R_RegisterShader(shaderName);
    }
    
    /**
     * Получить шейдер по handle
     */
    getShaderByHandle(handle) {
        if (handle >= 0 && handle < this.shaderHandles.length) {
            return this.shaderHandles[handle];
        }
        return null;
    }
    
    /**
     * Загрузка изображения из PK3
     */
    async loadImageFromPk3(imagePath) {
        // Проверяем кеш
        if (this.loadedImages.has(imagePath)) {
            return this.loadedImages.get(imagePath);
        }
        
        // Проверяем не загружается ли уже
        if (this.loadingImages.has(imagePath)) {
            console.log(`[Q32DRenderer] Изображение ${imagePath} уже загружается, пропускаем...`);
            return null; // Вернем null, загрузка идет в другом месте
        }
        
        // Отмечаем что начали загрузку
        this.loadingImages.add(imagePath);
        
        try {
            // Используем путь как есть из шейдера - автопоиск найдет альтернативы
            let fullPath = imagePath;
            
            // Используем кэшированный ZIP архив вместо повторной загрузки
            const zip = await getCachedZip();
            
            // Сначала ищем файл напрямую
            let file = zip.file(fullPath);
            let actualPath = fullPath; // Реальный путь найденного файла
            
            // Если не найден, ищем с учетом разного регистра
            if (!file) {
                const allFiles = Object.keys(zip.files);
                
                // Пробуем найти файл игнорируя регистр
                const lowerPath = fullPath.toLowerCase();
                let foundFile = allFiles.find(f => f.toLowerCase() === lowerPath);
                
                // Если не нашли с тем же расширением, пробуем другие расширения
                if (!foundFile && fullPath.endsWith('.tga')) {
                    const basePath = fullPath.substring(0, fullPath.length - 4);
                    const alternatives = [
                        basePath + '.png',
                        basePath + '.jpg',
                        basePath + '.jpeg'
                    ];
                    
                    for (const altPath of alternatives) {
                        foundFile = allFiles.find(f => f.toLowerCase() === altPath.toLowerCase());
                        if (foundFile) {
                            console.log(`[Q32DRenderer] ✓ Найдена альтернатива: ${fullPath} -> ${foundFile}`);
                            break;
                        }
                    }
                }
                
                if (foundFile) {
                    file = zip.file(foundFile);
                    actualPath = foundFile; // Сохраняем реальный путь
                } else {
                    // Файл не найден - используем дефолтное изображение NO IMAGE
                    console.warn(`[Q32DRenderer] ⚠️ Файл не найден: ${imagePath}, используем заглушку`);
                    
                    // Убираем из списка загружаемых
                    this.loadingImages.delete(imagePath);
                    
                    const noImagePlaceholder = this.loadedImages.get('*noimage');
                    if (noImagePlaceholder) {
                        this.loadedImages.set(imagePath, noImagePlaceholder);
                        return noImagePlaceholder;
                    }
                    return null;
                }
            }
            
            // Создаем Image объект
            const img = new Image();
            
            // Обработка TGA формата (проверяем РЕАЛЬНОЕ расширение)
            if (actualPath.toLowerCase().endsWith('.tga')) {
                // Извлекаем как ArrayBuffer для TGA декодера
                const arrayBuffer = await file.async('arraybuffer');
                
                // Используем наш TGA loader
                if (window.tgaLoader) {
                    const tgaData = window.tgaLoader.load(arrayBuffer);
                    
                    // Создаем canvas из TGA данных
                    // Для 24-битных TGA (без альфа) конвертируем яркость в альфа-канал
                    // Это нужно для градиентов где черный = прозрачный, белый = непрозрачный
                    const convertBlackToAlpha = !tgaData.hasAlpha;
                    const tempCanvas = window.tgaLoader.createCanvas(tgaData, convertBlackToAlpha);
                    
                    // Конвертируем canvas в Image
                    img.src = tempCanvas.toDataURL();
                } else {
                    console.warn(`[Q32DRenderer] TGA загрузчик не инициализирован`);
                    return null;
                }
            } else {
                // Извлекаем как Blob для обычных форматов
                const blob = await file.async('blob');
                const imageUrl = URL.createObjectURL(blob);
                img.src = imageUrl;
            }
            
            // Ждем загрузки изображения
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            
            // Кешируем по всем возможным путям для быстрого поиска
            this.loadedImages.set(imagePath, img); // Оригинальный путь из шейдера
            if (actualPath !== imagePath) {
                this.loadedImages.set(actualPath, img); // Реальный путь из PK3
            }
            if (fullPath !== imagePath && fullPath !== actualPath) {
                this.loadedImages.set(fullPath, img); // Полный путь
            }
            
            // Убираем из списка загружаемых
            this.loadingImages.delete(imagePath);
            
            return img;
            
        } catch (error) {
            console.error(`[Q32DRenderer] ✗ Ошибка загрузки ${imagePath}:`, error);
            
            // Убираем из списка загружаемых
            this.loadingImages.delete(imagePath);
            
            // При ошибке также используем заглушку
            const noImagePlaceholder = this.loadedImages.get('*noimage');
            if (noImagePlaceholder) {
                this.loadedImages.set(imagePath, noImagePlaceholder);
                return noImagePlaceholder;
            }
            return null;
        }
    }
    
    /**
     * Рисование картинки (аналог trap_DrawPic)
     * Просто вызывает trap_R_DrawStretchPic с полными UV координатами
     */
    trap_DrawPic(x, y, width, height, shaderName) {
        // trap_DrawPic это просто обертка над trap_R_DrawStretchPic
        // с UV координатами от 0,0 до 1,1 (вся текстура)
        this.trap_R_DrawStretchPic(x, y, width, height, 0, 0, 1, 1, shaderName);
    }
    
    /**
     * Заливка прямоугольника (аналог trap_FillRect)
     */
    trap_FillRect(x, y, width, height) {
        const scaledX = x * this.scaleX;
        const scaledY = y * this.scaleY;
        const scaledWidth = width * this.scaleX;
        const scaledHeight = height * this.scaleY;
        
        this.ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
    }
    
    /**
     * Рисование растянутой картинки с шейдером (аналог trap_R_DrawStretchPic)
     * Это основная функция которую вызывает QVM для отрисовки текстур!
     */
    trap_R_DrawStretchPic(x, y, w, h, s1, t1, s2, t2, shaderHandle) {
        const scaledX = x * this.scaleX;
        const scaledY = y * this.scaleY;
        const scaledW = w * this.scaleX;
        const scaledH = h * this.scaleY;
        
        // Сохраняем оригинальный handle для повторного вызова после загрузки
        const originalHandle = shaderHandle;
        
        // Получаем шейдер по handle или имени
        let shader = null;
        let shaderName = null;
        
        if (typeof shaderHandle === 'number') {
            // Это qhandle_t - ищем по индексу
            shader = this.getShaderByHandle(shaderHandle);
            shaderName = shader ? shader.name : `handle_${shaderHandle}`;
            console.log(`[trap_R_DrawStretchPic] Handle ${shaderHandle} -> ${shaderName}`);
        } else {
            // Это строка - имя шейдера
            shaderName = shaderHandle;
            shader = this.registeredShaders.get(shaderName);
            
            if (!shader) {
                console.log(`[trap_R_DrawStretchPic] Шейдер ${shaderName} не зарегистрирован, регистрируем...`);
                const handle = this.trap_R_RegisterShader(shaderName);
                shader = this.getShaderByHandle(handle);
            }
        }
        
        if (!shader) {
            console.error(`[trap_R_DrawStretchPic] ✗ Не удалось получить шейдер: ${shaderHandle}`);
            return;
        }
        
        console.log(`[trap_R_DrawStretchPic] Рисуем шейдер: ${shaderName} at (${x},${y}) size ${w}x${h}`);
        
        // Пытаемся найти изображение
        let imagePath = null;
        if (shader.stages && shader.stages[0] && shader.stages[0].bundle && shader.stages[0].bundle[0]) {
            imagePath = shader.stages[0].bundle[0].image[0];
            console.log(`[trap_R_DrawStretchPic] Путь к текстуре из шейдера: ${imagePath}`);
        } else {
            console.warn(`[trap_R_DrawStretchPic] Не найдены stages/bundle в шейдере ${shaderName}`, shader);
        }
        
        // Если есть загруженное изображение - рисуем его
        if (imagePath && this.loadedImages.has(imagePath)) {
            const img = this.loadedImages.get(imagePath);
            
            this.ctx.save();
            
            // ВАЖНО: Ограничиваем область рисования (clip) чтобы не затереть фон
            this.ctx.beginPath();
            this.ctx.rect(scaledX, scaledY, scaledW, scaledH);
            this.ctx.clip();
            
            // Применяем blend mode из stage
            if (shader.stages && shader.stages[0]) {
                const stage = shader.stages[0];
                this.applyBlendMode(stage);
                this.applyRgbGen(stage);
                this.applyAlphaGen(stage);
            } else {
                // Дефолтные параметры для простых изображений
                this.ctx.globalAlpha = this.currentColor[3];
            }
            
            // Рассчитываем координаты текстуры (s1,t1,s2,t2 - это UV координаты 0.0-1.0)
            const srcX = s1 * img.width;
            const srcY = t1 * img.height;
            const srcW = (s2 - s1) * img.width;
            const srcH = (t2 - t1) * img.height;
            
            // Сохраняем состояние перед tcMod трансформациями
            this.ctx.save();
            
            // Применяем tcMod трансформации если есть
            if (shader.stages && shader.stages[0] && shader.stages[0].bundle && shader.stages[0].bundle[0]) {
                this.applyTexCoordTransforms(shader.stages[0].bundle[0], scaledX, scaledY, scaledW, scaledH);
            }
            
            // Рисуем часть изображения (с учетом UV координат)
            this.ctx.drawImage(
                img,
                srcX, srcY, srcW, srcH,  // источник (какую часть текстуры брать)
                scaledX, scaledY, scaledW, scaledH  // назначение (куда рисовать)
            );
            
            // Восстанавливаем состояние после tcMod трансформаций
            this.ctx.restore();
            
            // Восстанавливаем состояние после clip
            this.ctx.restore();
        } else {
            console.warn(`[trap_R_DrawStretchPic] ✗ Изображение не загружено для ${shaderName}, imagePath=${imagePath}, в кеше: ${this.loadedImages.size} текстур`);
            
            // Используем NO IMAGE placeholder вместо рисования прямоугольника
            const noImagePlaceholder = this.loadedImages.get('*noimage');
            
            if (noImagePlaceholder && noImagePlaceholder.complete) {
                // Рисуем NO IMAGE с применением всех эффектов шейдера
                this.ctx.save();
                
                // ВАЖНО: Ограничиваем область рисования (clip)
                this.ctx.beginPath();
                this.ctx.rect(scaledX, scaledY, scaledW, scaledH);
                this.ctx.clip();
                
                // Применяем blend mode из stage (чтобы NO IMAGE получал все эффекты)
                if (shader.stages && shader.stages[0]) {
                    const stage = shader.stages[0];
                    this.applyBlendMode(stage);
                    this.applyRgbGen(stage);
                    this.applyAlphaGen(stage);
                } else {
                    this.ctx.globalAlpha = this.currentColor[3];
                }
                
                // Рисуем NO IMAGE изображение (растягиваем на весь прямоугольник)
                this.ctx.drawImage(
                    noImagePlaceholder,
                    scaledX, scaledY, scaledW, scaledH
                );
                
                this.ctx.restore();
                
                // Добавляем текст с путем к изображению ПОВЕРХ (без clip)
                this.ctx.save();
                
                // Метка "NO IMAGE" поверх изображения
                this.ctx.fillStyle = 'rgba(255, 50, 50, 0.95)';
                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
                this.ctx.lineWidth = 4;
                this.ctx.font = 'bold 16px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                const labelX = scaledX + scaledW / 2;
                const labelY = scaledY + scaledH / 2;
                
                this.ctx.strokeText('NO IMAGE', labelX, labelY);
                this.ctx.fillText('NO IMAGE', labelX, labelY);
                
                // Путь к файлу под NO IMAGE
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                this.ctx.font = 'bold 10px monospace';
                this.ctx.lineWidth = 3;
                const pathText = imagePath || shaderName;
                const displayPath = pathText.length > 35 ? '...' + pathText.slice(-32) : pathText;
                
                // Рисуем путь под изображением с фоном для читаемости
                const textX = scaledX + scaledW / 2;
                const textY = scaledY + scaledH + 8;
                
                // Полупрозрачный фон под текстом
                const textMetrics = this.ctx.measureText(displayPath);
                const textWidth = textMetrics.width;
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(textX - textWidth/2 - 5, textY - 10, textWidth + 10, 16);
                
                // Текст пути
                this.ctx.fillStyle = 'rgba(255, 200, 200, 1.0)';
                this.ctx.strokeStyle = 'rgba(100, 0, 0, 0.9)';
                this.ctx.lineWidth = 2;
                
                this.ctx.strokeText(displayPath, textX, textY);
                this.ctx.fillText(displayPath, textX, textY);
                
                // Сбрасываем настройки текста
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'alphabetic';
                
                this.ctx.restore();
            }
            
            // Если imagePath найден, но изображение не загружено - попробуем загрузить
            if (imagePath && !imagePath.startsWith('$') && !this.loadedImages.has(imagePath)) {
                this.loadImageFromPk3(imagePath).then((img) => {
                    // Перерисовываем только если загрузилось реальное изображение (не placeholder)
                    if (img && img !== this.loadedImages.get('*noimage')) {
                        console.log(`[trap_R_DrawStretchPic] Изображение загружено асинхронно, автоматически перерисовываем...`);
                        // Автоматически перерисовываем после загрузки (используем оригинальный handle)
                        this.trap_R_DrawStretchPic(x, y, w, h, s1, t1, s2, t2, originalHandle);
                    } else if (img === this.loadedImages.get('*noimage')) {
                        console.log(`[trap_R_DrawStretchPic] Файл не найден, используется заглушка NO IMAGE`);
                    }
                }).catch(err => {
                    console.error(`[trap_R_DrawStretchPic] Ошибка асинхронной загрузки ${imagePath}:`, err);
                });
            }
        }
    }
    
    /**
     * УСТАРЕВШАЯ async версия - оставлена для совместимости
     */
    async trap_R_DrawStretchPic_Async(x, y, w, h, s1, t1, s2, t2, shader) {
        const scaledX = x * this.scaleX;
        const scaledY = y * this.scaleY;
        const scaledW = w * this.scaleX;
        const scaledH = h * this.scaleY;
        
        // Попытка загрузить шейдер из реестра (старый код)
        if (this.shaderRegistry) {
            try {
                const shaderData = await this.shaderRegistry.loadShader(shader);
                if (shaderData) {
                    // Рисуем шейдер с его параметрами
                    await this.renderShaderWithData(shaderData, scaledX, scaledY, scaledW, scaledH);
                    return;
                }
            } catch (error) {
                console.warn(`Ошибка загрузки шейдера ${shader}:`, error);
            }
        }
        
        // Fallback - рисуем заглушку
        this.ctx.fillRect(scaledX, scaledY, scaledW, scaledH);
        this.ctx.strokeRect(scaledX, scaledY, scaledW, scaledH);
        
        // Текст с именем шейдера
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(shader, scaledX + 5, scaledY + 15);
        
        // Восстанавливаем цвет
        const r = Math.floor(this.currentColor[0] * 255);
        const g = Math.floor(this.currentColor[1] * 255);
        const b = Math.floor(this.currentColor[2] * 255);
        const a = this.currentColor[3];
        this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    
    /**
     * Рендеринг шейдера с данными
     */
    async renderShaderWithData(shaderData, x, y, w, h) {
        if (shaderData.stages && shaderData.stages.length > 0) {
            // Рендерим каждый stage
            for (let i = 0; i < shaderData.stages.length; i++) {
                const stage = shaderData.stages[i];
                await this.renderShaderStage(stage, x, y, w, h, i);
            }
        } else {
            // Простой рендер
            this.ctx.fillRect(x, y, w, h);
            this.ctx.strokeRect(x, y, w, h);
        }
    }
    
    /**
     * Рендеринг одного stage шейдера
     */
    async renderShaderStage(stage, x, y, w, h, stageIndex) {
        // Определяем цвет на основе параметров stage
        let r = 0.5, g = 0.5, b = 0.5, a = 1.0;
        
        if (stage.rgbGen === 'vertex') {
            r = 0.8; g = 0.6; b = 0.4; // Оранжевый для vertex
        } else if (stage.rgbGen === 'entity') {
            r = 0.4; g = 0.8; b = 0.6; // Зеленый для entity
        } else if (stage.rgbGen === 'identity') {
            r = 0.6; g = 0.6; b = 0.8; // Синий для identity
        }
        
        // Применяем blendFunc
        if (stage.blendFunc.includes('GL_ONE GL_ONE')) {
            a = 0.8; // Полупрозрачность для аддитивного блендинга
        } else if (stage.blendFunc.includes('blend')) {
            a = 0.6; // Меньшая прозрачность для обычного блендинга
        }
        
        // Устанавливаем цвет
        this.ctx.fillStyle = `rgba(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)}, ${a})`;
        
        // Рисуем основной прямоугольник stage
        this.ctx.fillRect(x, y, w, h);
        
        // Рисуем текстуру если есть
        if (stage.map) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(stage.map, x + 5, y + 15);
        }
        
        // Добавляем эффекты
        if (stage.tcMod.length > 0) {
            // Анимированные эффекты
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            this.ctx.fillRect(x + 5, y + 5, w - 10, 20);
        }
        
        if (stage.deform) {
            // Деформации
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
            this.ctx.fillRect(x + 5, y + h - 25, w - 10, 20);
        }
        
        // Рисуем рамку
        this.ctx.strokeStyle = 'rgba(200, 200, 200, 1)';
        this.ctx.strokeRect(x, y, w, h);
    }
    
    /**
     * Установка реестра шейдеров
     */
    setShaderRegistry(registry) {
        this.shaderRegistry = registry;
    }
    
    /**
     * Установка размера canvas
     */
    setCanvasSize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.scaleX = width / this.virtualWidth;
        this.scaleY = height / this.virtualHeight;
    }
    
    /**
     * Применение blend mode из шейдера (как в оригинальном движке)
     */
    applyBlendMode(stage) {
        // Парсим blendFunc из stage
        const blendFunc = stage.blendFunc || '';
        const blendSrc = stage.blendSrc || '';
        const blendDst = stage.blendDst || '';
        
        let compositeOp = 'source-over'; // дефолт
        
        // blendFunc add = GL_ONE + GL_ONE
        if (blendFunc.includes('add') || (blendSrc === 'GL_ONE' && blendDst === 'GL_ONE')) {
            compositeOp = 'lighter'; // аддитивный blend
        }
        // blendFunc filter = GL_DST_COLOR + GL_ZERO
        else if (blendFunc.includes('filter') || (blendSrc === 'GL_DST_COLOR' && blendDst === 'GL_ZERO')) {
            compositeOp = 'multiply';
        }
        // blendFunc blend = GL_SRC_ALPHA + GL_ONE_MINUS_SRC_ALPHA (дефолт)
        else if (blendFunc.includes('blend') || (blendSrc === 'GL_SRC_ALPHA' && blendDst === 'GL_ONE_MINUS_SRC_ALPHA')) {
            compositeOp = 'source-over'; // стандартный blend
        }
        // GL_ONE + GL_ZERO = replace (без блендинга)
        else if (blendSrc === 'GL_ONE' && blendDst === 'GL_ZERO') {
            compositeOp = 'copy';
        }
        
        this.ctx.globalCompositeOperation = compositeOp;
    }
    
    /**
     * Применение rgbGen (генерация цвета)
     * ВАЖНО: rgbGen влияет ТОЛЬКО на RGB, не на альфу!
     */
    applyRgbGen(stage) {
        const rgbGen = stage.rgbGen || 'identity';
        
        if (rgbGen === 'vertex' || rgbGen === 'CGEN_VERTEX') {
            // Используем цвет из trap_SetColor
            // В Quake 3 vertex color умножается на текстуру
            // Canvas не поддерживает это напрямую, но если цвет белый - текстура остается как есть
            // Для других цветов нужна более сложная реализация (композиция через multiply)
            const r = this.currentColor[0];
            const g = this.currentColor[1];
            const b = this.currentColor[2];
            
            // Если цвет не белый, применяем через globalCompositeOperation
            if (r !== 1.0 || g !== 1.0 || b !== 1.0) {
                // TODO: Реализовать модуляцию цвета через временный canvas
                // Пока просто игнорируем (большинство шейдеров используют белый vertex color)
            }
        } else if (rgbGen === 'identity' || rgbGen === 'CGEN_IDENTITY') {
            // Белый цвет (1,1,1) - текстура без изменений RGB
            // НЕ трогаем globalAlpha - это работа applyAlphaGen
        } else if (rgbGen === 'CGEN_CONST' && stage.constantColor) {
            // Константный цвет - применяется ко всей текстуре
            // Используем filter для окрашивания (упрощенная реализация)
            const r = stage.constantColor.r || 255;
            const g = stage.constantColor.g || 255;
            const b = stage.constantColor.b || 255;
            
            // Устанавливаем fillStyle для модуляции
            this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            
            // Применяем через multiply если цвет не белый
            if (r !== 255 || g !== 255 || b !== 255) {
                const oldOp = this.ctx.globalCompositeOperation;
                this.ctx.globalCompositeOperation = 'multiply';
                // После рисования текстуры нужно будет восстановить
                // TODO: Лучше реализовать через временный canvas
            }
        } else if (rgbGen === 'CGEN_WAVE' && stage.rgbWave) {
            // Анимированный цвет через wave функцию
            const time = Date.now() / 1000.0;
            const intensity = this.evaluateWaveForm(
                stage.rgbWave.func,
                stage.rgbWave.base,
                stage.rgbWave.amplitude,
                stage.rgbWave.phase,
                stage.rgbWave.frequency,
                time
            );
            // Применяем intensity к текстуре (упрощенно - через альфу)
            // TODO: Правильная реализация требует модуляции RGB каналов
        }
    }
    
    /**
     * Применение alphaGen (генерация альфы)
     */
    applyAlphaGen(stage) {
        const alphaGen = stage.alphaGen;
        
        // ВАЖНО: Если alphaGen не указан, используется альфа из ТЕКСТУРЫ (не трогаем globalAlpha)
        if (!alphaGen) {
            // Альфа будет взята из альфа-канала текстуры автоматически
            return;
        }
        
        if (alphaGen === 'vertex' || alphaGen === 'AGEN_VERTEX') {
            // Используем альфу из trap_SetColor
            this.ctx.globalAlpha = this.currentColor[3];
        } else if (alphaGen === 'identity' || alphaGen === 'AGEN_IDENTITY') {
            // Полная непрозрачность
            this.ctx.globalAlpha = 1.0;
        } else if (alphaGen === 'const' || alphaGen === 'AGEN_CONST') {
            // Константная альфа из stage
            if (stage.constantColor && stage.constantColor.a !== undefined) {
                this.ctx.globalAlpha = stage.constantColor.a / 255.0;
            }
        } else if (alphaGen === 'AGEN_WAVE' && stage.alphaWave) {
            // Анимированная альфа через wave функцию
            const time = Date.now() / 1000.0;
            const alpha = this.evaluateWaveForm(
                stage.alphaWave.func,
                stage.alphaWave.base,
                stage.alphaWave.amplitude,
                stage.alphaWave.phase,
                stage.alphaWave.frequency,
                time
            );
            this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        }
    }
    
    /**
     * Применение tcMod трансформаций (все типы из Quake 3)
     * tcMod применяется к UV координатам ТЕКСТУРЫ, а не к позиции на экране
     * 
     * Единицы измерения времени:
     * - Все параметры используют СЕКУНДЫ как базовую единицу
     * - time = Date.now() / 1000.0 = время в секундах
     */
    applyTexCoordTransforms(bundle, x, y, w, h) {
        if (!bundle.texMods || bundle.texMods.length === 0) {
            return;
        }
        
        // Находим центр изображения для трансформаций
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        
        const time = Date.now() / 1000.0; // shaderTime в секундах (floatTime)
        
        // Применяем трансформации последовательно
        for (const texModStr of bundle.texMods) {
            // Парсим строку tcMod
            const parts = texModStr.trim().split(/\s+/);
            const type = parts[0].toLowerCase();
            
            if (type === 'rotate') {
                // tcMod rotate <degreesPerSecond>
                // Единицы: градусы в секунду
                // Формула из Quake 3 (tr_shade_calc.c:1150):
                // degs = -degsPerSecond × shaderTime
                //
                // ВАЖНО: Знак минус! 
                // tcMod вращает UV координаты (откуда брать пиксели из текстуры)
                // Canvas rotate вращает позицию рисования (куда рисовать картинку)
                // Это обратные операции, поэтому нужен минус.
                const degreesPerSec = parseFloat(parts[1]) || 0;
                const angle = -degreesPerSec * time * (Math.PI / 180.0); // конвертируем в радианы
                
                this.ctx.translate(centerX, centerY);
                this.ctx.rotate(angle);
                this.ctx.translate(-centerX, -centerY);
            }
            else if (type === 'scale') {
                // tcMod scale <sScale> <tScale>
                const sScale = parseFloat(parts[1]) || 1.0;
                const tScale = parseFloat(parts[2]) || 1.0;
                
                this.ctx.translate(centerX, centerY);
                this.ctx.scale(sScale, tScale);
                this.ctx.translate(-centerX, -centerY);
            }
            else if (type === 'scroll') {
                // tcMod scroll <sSpeed> <tSpeed>
                // Единицы: единицы текстурных координат в секунду
                // Формула: offset = scrollSpeed × время_в_секундах
                // sSpeed, tSpeed - скорость прокрутки в UV единицах/сек
                const sSpeed = parseFloat(parts[1]) || 0;
                const tSpeed = parseFloat(parts[2]) || 0;
                
                // Смещение в UV единицах (1.0 = полная ширина/высота текстуры)
                // Умножаем на размеры quad чтобы конвертировать из UV в пиксели экрана
                const offsetX = sSpeed * time * w;
                const offsetY = tSpeed * time * h;
                
                this.ctx.translate(offsetX, offsetY);
            }
            else if (type === 'stretch') {
                // tcMod stretch <func> <base> <amplitude> <phase> <frequency>
                // Растягивает UV с помощью wave функции
                // frequency в единицах: Герц (циклов в секунду)
                const func = parts[1]; // sin, triangle, square, sawtooth, inversesawtooth
                const base = parseFloat(parts[2]) || 1.0;
                const amplitude = parseFloat(parts[3]) || 0;
                const phase = parseFloat(parts[4]) || 0;
                const frequency = parseFloat(parts[5]) || 1.0; // Гц (1/сек)
                
                const value = this.evaluateWaveForm(func, base, amplitude, phase, frequency, time);
                
                this.ctx.translate(centerX, centerY);
                this.ctx.scale(value, value);
                this.ctx.translate(-centerX, -centerY);
            }
            else if (type === 'transform') {
                // tcMod transform <m00> <m01> <m10> <m11> <t0> <t1>
                // 2x3 матрица трансформации UV координат
                // 
                // Формула в Quake 3 (tr_shade_calc.c:1133-1134):
                // s' = s * matrix[0][0] + t * matrix[1][0] + translate[0]
                // t' = s * matrix[0][1] + t * matrix[1][1] + translate[1]
                //
                // Где s,t в диапазоне [0,1], а translate уже в UV пространстве
                const m00 = parseFloat(parts[1]) || 1;
                const m01 = parseFloat(parts[2]) || 0;
                const m10 = parseFloat(parts[3]) || 0;
                const m11 = parseFloat(parts[4]) || 1;
                const t0 = parseFloat(parts[5]) || 0;
                const t1 = parseFloat(parts[6]) || 0;
                
                // ВАЖНАЯ КОНЦЕПЦИЯ:
                // tcMod transform изменяет UV координаты: "какой UV взять для позиции (x,y)"
                // Canvas transform изменяет позицию рисования: "куда нарисовать UV"
                // Это ОБРАТНЫЕ операции! Нужно инвертировать матрицу.
                //
                // Вычисляем обратную матрицу 2x2:
                // | m00  m10 |^-1       1      | m11  -m10 |
                // | m01  m11 |    = --------- * |-m01   m00 |
                //                   det(M)
                const det = m00 * m11 - m01 * m10;
                
                if (Math.abs(det) < 0.0001) {
                    // Вырожденная матрица - пропускаем
                    console.warn('[tcMod transform] Вырожденная матрица, det =', det);
                } else {
                    const invDet = 1.0 / det;
                    const inv_m00 = m11 * invDet;
                    const inv_m01 = -m01 * invDet;
                    const inv_m10 = -m10 * invDet;
                    const inv_m11 = m00 * invDet;
                    
                    // ВАЖНО: Применяем трансформацию относительно ЦЕНТРА изображения
                    // Параметры t0/t1 содержат смещение для вращения вокруг (0.5, 0.5) в UV,
                    // но для Canvas нам нужно вращать вокруг центра (centerX, centerY) в пикселях
                    // 
                    // Поэтому НЕ используем t0/t1 для смещения Canvas transform,
                    // а делаем translate к центру, как для rotate/scale
                    this.ctx.translate(centerX, centerY);
                    this.ctx.transform(inv_m00, inv_m01, inv_m10, inv_m11, 0, 0);
                    this.ctx.translate(-centerX, -centerY);
                }
            }
            else if (type === 'turb') {
                // tcMod turb <base> <amplitude> <phase> <frequency>
                // Турбулентность - искажает UV координаты (сложно в 2D canvas)
                // frequency в единицах: Герц (циклов в секунду)
                // Формула: фаза_волны = phase + время_в_секундах × frequency
                const base = parseFloat(parts[1]) || 0;
                const amplitude = parseFloat(parts[2]) || 1.0;
                const phase = parseFloat(parts[3]) || 0;
                const frequency = parseFloat(parts[4]) || 1.0; // Гц (1/сек)
                
                // Упрощенная турбулентность - синусоидальное смещение
                // Формула волны: phase + time * frequency (в радианах для sin/cos)
                const wavePhase = (phase + time * frequency) * Math.PI * 2.0;
                const offsetX = Math.sin(wavePhase) * amplitude * w * 0.1; // масштабируем по ширине
                const offsetY = Math.cos(wavePhase) * amplitude * h * 0.1; // масштабируем по высоте
                
                this.ctx.translate(offsetX, offsetY);
            }
        }
    }
    
    /**
     * Вычисление wave функции (для tcMod stretch, rgbGen wave, alphaGen wave)
     * 
     * Параметры:
     * - func: тип волны (sin, triangle, square, sawtooth, inversesawtooth)
     * - base: базовое значение
     * - amplitude: амплитуда колебаний
     * - phase: начальная фаза (в циклах)
     * - frequency: частота в Герцах (циклов в секунду)
     * - time: время в секундах
     * 
     * Формула: фаза_волны = phase + время_в_секундах × frequency
     * Результат: base + amplitude × wave_func(фаза_волны)
     */
    evaluateWaveForm(func, base, amplitude, phase, frequency, time) {
        // Фаза волны = phase + time * frequency (в циклах)
        const cyclePhase = phase + time * frequency;
        
        // Нормализуем к диапазону 0-1 для периодических функций (берем дробную часть)
        const t = cyclePhase - Math.floor(cyclePhase);
        
        let value = 0;
        
        switch(func.toLowerCase()) {
            case 'sin':
                // Синусоида: sin(2π × фаза)
                value = Math.sin(cyclePhase * Math.PI * 2.0);
                break;
            case 'triangle':
                // Треугольная волна: линейно от -1 до 1 и обратно
                value = (t < 0.25) ? (t * 4) :
                        (t < 0.75) ? (2 - t * 4) :
                        (t * 4 - 4);
                break;
            case 'square':
                // Прямоугольная волна: -1 или 1
                value = (t < 0.5) ? 1 : -1;
                break;
            case 'sawtooth':
                // Пилообразная волна: линейно от 0 до 1
                value = t;
                break;
            case 'inversesawtooth':
                // Обратная пилообразная: линейно от 1 до 0
                value = 1.0 - t;
                break;
            default:
                value = 0;
        }
        
        // Итоговое значение: base + amplitude × value
        return base + value * amplitude;
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Q32DRenderer;
}
