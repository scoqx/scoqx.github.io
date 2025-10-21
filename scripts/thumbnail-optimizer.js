class ThumbnailOptimizer {
    constructor() {
        this.thumbnailCache = new Map();
        this.thumbnailSizes = {
            small: 150,    // Для миниатюр в галерее
            medium: 300,   // Для превью
            large: 600     // Для полноэкранного режима
        };
        this.quality = 0.7; // Качество сжатия JPEG
    }
    
    /**
     * Создает оптимизированную миниатюру из исходного изображения
     * @param {string} imageSrc - Путь к исходному изображению
     * @param {string} size - Размер миниатюры ('small', 'medium', 'large')
     * @returns {Promise<string>} - Data URL оптимизированной миниатюры
     */
    async createOptimizedThumbnail(imageSrc, size = 'small') {
        const cacheKey = `${imageSrc}_${size}`;
        
        // Проверяем кэш
        if (this.thumbnailCache.has(cacheKey)) {
            return this.thumbnailCache.get(cacheKey);
        }
        
        try {
            const thumbnailSize = this.thumbnailSizes[size];
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Загружаем изображение
            const img = await this.loadImage(imageSrc);
            
            // Вычисляем размеры с сохранением пропорций
            const { width, height } = this.calculateDimensions(
                img.width, 
                img.height, 
                thumbnailSize
            );
            
            canvas.width = width;
            canvas.height = height;
            
            // Рисуем изображение на canvas
            ctx.drawImage(img, 0, 0, width, height);
            
            // Конвертируем в оптимизированный JPEG
            const dataUrl = canvas.toDataURL('image/jpeg', this.quality);
            
            // Кэшируем результат
            this.thumbnailCache.set(cacheKey, dataUrl);
            
            return dataUrl;
        } catch (error) {
            console.warn('Failed to create thumbnail for:', imageSrc, error);
            return imageSrc; // Возвращаем исходное изображение в случае ошибки
        }
    }
    
    /**
     * Загружает изображение с обработкой ошибок
     */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            img.src = src;
        });
    }
    
    /**
     * Вычисляет размеры с сохранением пропорций
     */
    calculateDimensions(originalWidth, originalHeight, maxSize) {
        const aspectRatio = originalWidth / originalHeight;
        
        let width, height;
        if (aspectRatio > 1) {
            // Широкое изображение
            width = Math.min(maxSize, originalWidth);
            height = width / aspectRatio;
        } else {
            // Высокое изображение
            height = Math.min(maxSize, originalHeight);
            width = height * aspectRatio;
        }
        
        return { width: Math.round(width), height: Math.round(height) };
    }
    
    /**
     * Создает lazy loading изображение с оптимизированной миниатюрой
     */
    createOptimizedImageElement(originalSrc, alt, size = 'small', className = '') {
        const img = document.createElement('img');
        img.alt = alt;
        img.className = className + ' loading';
        img.loading = 'lazy';
        
        // Устанавливаем placeholder пока загружается оптимизированная версия
        img.src = this.createPlaceholder(originalSrc, size);
        
        // Асинхронно загружаем оптимизированную версию
        this.createOptimizedThumbnail(originalSrc, size).then(optimizedSrc => {
            if (img.src === this.createPlaceholder(originalSrc, size)) {
                img.src = optimizedSrc;
                img.classList.remove('loading');
                img.classList.add('loaded');
            }
        }).catch(error => {
            console.warn('Failed to create optimized thumbnail, using original:', error);
            img.src = originalSrc;
            img.classList.remove('loading');
            img.classList.add('loaded');
        });
        
        return img;
    }
    
    /**
     * Создает placeholder изображение
     */
    createPlaceholder(originalSrc, size) {
        const thumbnailSize = this.thumbnailSizes[size];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = thumbnailSize;
        canvas.height = thumbnailSize;
        
        // Создаем серый placeholder
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, thumbnailSize, thumbnailSize);
        
        // Добавляем текст "Loading..."
        ctx.fillStyle = '#999';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Loading...', thumbnailSize / 2, thumbnailSize / 2);
        
        return canvas.toDataURL();
    }
    
    /**
     * Очищает кэш миниатюр
     */
    clearCache() {
        this.thumbnailCache.clear();
    }
    
    /**
     * Получает статистику кэша
     */
    getCacheStats() {
        return {
            size: this.thumbnailCache.size,
            keys: Array.from(this.thumbnailCache.keys())
        };
    }
}

// Создаем глобальный экземпляр
window.thumbnailOptimizer = new ThumbnailOptimizer();
