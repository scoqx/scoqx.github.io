// ========== TGA ЗАГРУЗЧИК ==========
// Простой загрузчик TGA файлов для Quake 3

class TGALoader {
    constructor() {
        this.cache = new Map(); // Кэш загруженных TGA
    }
    
    /**
     * Загрузка TGA файла из ArrayBuffer
     * @param {ArrayBuffer} buffer - данные TGA файла
     * @returns {Object} - объект с данными изображения {width, height, data, hasAlpha}
     */
    load(buffer) {
        const data = new Uint8Array(buffer);
        
        // Проверяем минимальный размер заголовка TGA (18 байт)
        if (data.length < 18) {
            throw new Error('TGA файл слишком маленький');
        }
        
        // Читаем заголовок TGA
        const header = {
            idLength: data[0],              // Длина ID поля
            colorMapType: data[1],          // Тип палитры (0 = нет)
            imageType: data[2],             // Тип изображения
            colorMapStart: data[3] | (data[4] << 8),
            colorMapLength: data[5] | (data[6] << 8),
            colorMapDepth: data[7],
            xOrigin: data[8] | (data[9] << 8),
            yOrigin: data[10] | (data[11] << 8),
            width: data[12] | (data[13] << 8),
            height: data[14] | (data[15] << 8),
            pixelDepth: data[16],           // Бит на пиксель (24 или 32)
            imageDescriptor: data[17]       // Флаги изображения
        };
        
        // Проверяем поддерживаемые форматы
        // Quake 3 обычно использует:
        // - Type 2 (Uncompressed RGB/RGBA)
        // - Type 10 (RLE compressed RGB/RGBA)
        if (header.imageType !== 2 && header.imageType !== 10) {
            throw new Error(`Неподдерживаемый тип TGA: ${header.imageType}`);
        }
        
        // Поддерживаем только 24-bit и 32-bit
        if (header.pixelDepth !== 24 && header.pixelDepth !== 32) {
            throw new Error(`Неподдерживаемая глубина цвета TGA: ${header.pixelDepth}`);
        }
        
        const hasAlpha = header.pixelDepth === 32;
        const bytesPerPixel = header.pixelDepth / 8;
        
        // Пропускаем ID поле
        let offset = 18 + header.idLength;
        
        // Пропускаем color map если есть
        if (header.colorMapType === 1) {
            offset += header.colorMapLength * (header.colorMapDepth / 8);
        }
        
        // Декодируем данные изображения
        let imageData;
        if (header.imageType === 2) {
            // Uncompressed
            imageData = this.decodeUncompressed(data, offset, header.width, header.height, bytesPerPixel);
        } else if (header.imageType === 10) {
            // RLE compressed
            imageData = this.decodeRLE(data, offset, header.width, header.height, bytesPerPixel);
        }
        
        // Переворачиваем изображение если нужно (TGA часто хранится вверх ногами)
        const originAtTop = (header.imageDescriptor & 0x20) !== 0;
        if (!originAtTop) {
            imageData = this.flipVertical(imageData, header.width, header.height, bytesPerPixel);
        }
        
        return {
            width: header.width,
            height: header.height,
            data: imageData,
            hasAlpha: hasAlpha,
            bytesPerPixel: bytesPerPixel
        };
    }
    
    /**
     * Декодирование несжатых TGA данных
     */
    decodeUncompressed(data, offset, width, height, bytesPerPixel) {
        const pixelCount = width * height;
        const imageSize = pixelCount * bytesPerPixel;
        const imageData = new Uint8Array(imageSize);
        
        // TGA хранит данные в формате BGR(A), конвертируем в RGB(A)
        for (let i = 0; i < pixelCount; i++) {
            const srcOffset = offset + i * bytesPerPixel;
            const dstOffset = i * bytesPerPixel;
            
            // Меняем местами B и R (BGR -> RGB)
            imageData[dstOffset + 0] = data[srcOffset + 2]; // R
            imageData[dstOffset + 1] = data[srcOffset + 1]; // G
            imageData[dstOffset + 2] = data[srcOffset + 0]; // B
            
            if (bytesPerPixel === 4) {
                imageData[dstOffset + 3] = data[srcOffset + 3]; // A
            }
        }
        
        return imageData;
    }
    
    /**
     * Декодирование RLE сжатых TGA данных
     */
    decodeRLE(data, offset, width, height, bytesPerPixel) {
        const pixelCount = width * height;
        const imageData = new Uint8Array(pixelCount * bytesPerPixel);
        
        let pixelIndex = 0;
        let dataOffset = offset;
        
        while (pixelIndex < pixelCount) {
            const packet = data[dataOffset++];
            const isRLE = (packet & 0x80) !== 0;
            const count = (packet & 0x7F) + 1;
            
            if (isRLE) {
                // RLE пакет - повторяем один пиксель
                const b = data[dataOffset++];
                const g = data[dataOffset++];
                const r = data[dataOffset++];
                const a = bytesPerPixel === 4 ? data[dataOffset++] : 255;
                
                for (let i = 0; i < count; i++) {
                    const idx = (pixelIndex + i) * bytesPerPixel;
                    imageData[idx + 0] = r;
                    imageData[idx + 1] = g;
                    imageData[idx + 2] = b;
                    if (bytesPerPixel === 4) {
                        imageData[idx + 3] = a;
                    }
                }
            } else {
                // Raw пакет - копируем пиксели как есть
                for (let i = 0; i < count; i++) {
                    const b = data[dataOffset++];
                    const g = data[dataOffset++];
                    const r = data[dataOffset++];
                    const a = bytesPerPixel === 4 ? data[dataOffset++] : 255;
                    
                    const idx = (pixelIndex + i) * bytesPerPixel;
                    imageData[idx + 0] = r;
                    imageData[idx + 1] = g;
                    imageData[idx + 2] = b;
                    if (bytesPerPixel === 4) {
                        imageData[idx + 3] = a;
                    }
                }
            }
            
            pixelIndex += count;
        }
        
        return imageData;
    }
    
    /**
     * Переворот изображения по вертикали
     */
    flipVertical(data, width, height, bytesPerPixel) {
        const rowSize = width * bytesPerPixel;
        const flipped = new Uint8Array(data.length);
        
        for (let y = 0; y < height; y++) {
            const srcRow = y * rowSize;
            const dstRow = (height - 1 - y) * rowSize;
            
            for (let x = 0; x < rowSize; x++) {
                flipped[dstRow + x] = data[srcRow + x];
            }
        }
        
        return flipped;
    }
    
    /**
     * Создание canvas из TGA данных
     * @param {Object} tgaData - результат load()
     * @param {boolean} convertBlackToAlpha - конвертировать черный цвет в прозрачность (для градиентов)
     * @returns {HTMLCanvasElement}
     */
    createCanvas(tgaData, convertBlackToAlpha = false) {
        const canvas = document.createElement('canvas');
        canvas.width = tgaData.width;
        canvas.height = tgaData.height;
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(tgaData.width, tgaData.height);
        
        // Конвертируем в RGBA для canvas
        for (let i = 0; i < tgaData.width * tgaData.height; i++) {
            const srcOffset = i * tgaData.bytesPerPixel;
            const dstOffset = i * 4;
            
            const r = tgaData.data[srcOffset + 0];
            const g = tgaData.data[srcOffset + 1];
            const b = tgaData.data[srcOffset + 2];
            
            imageData.data[dstOffset + 0] = r; // R
            imageData.data[dstOffset + 1] = g; // G
            imageData.data[dstOffset + 2] = b; // B
            
            // Если есть альфа-канал - используем его
            if (tgaData.bytesPerPixel === 4) {
                imageData.data[dstOffset + 3] = tgaData.data[srcOffset + 3]; // A
            } 
            // Если нет альфа-канала, но нужно конвертировать черный в прозрачность
            else if (convertBlackToAlpha) {
                // Яркость пикселя (0-255) используем как альфу
                // Черный (0,0,0) = прозрачный, белый (255,255,255) = непрозрачный
                const brightness = Math.max(r, g, b);
                imageData.data[dstOffset + 3] = brightness;
            }
            // Иначе - полная непрозрачность
            else {
                imageData.data[dstOffset + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }
    
    /**
     * Загрузка TGA из URL
     * @param {string} url - путь к TGA файлу
     * @returns {Promise<Object>}
     */
    async loadFromURL(url) {
        // Проверяем кэш
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Не удалось загрузить TGA: ${response.status}`);
        }
        
        const buffer = await response.arrayBuffer();
        const tgaData = this.load(buffer);
        
        // Сохраняем в кэш
        this.cache.set(url, tgaData);
        
        return tgaData;
    }
    
    /**
     * Очистка кэша
     */
    clearCache() {
        this.cache.clear();
    }
}

// Глобальный экземпляр загрузчика
window.tgaLoader = new TGALoader();


