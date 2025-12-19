/**
 * Система управления фоновой загрузкой оригинальных изображений
 */
class ImageLoader {
    constructor() {
        this.loadingQueue = [];
        this.loadingSet = new Set(); // Изображения, которые сейчас загружаются
        this.loadedSet = new Set(); // Уже загруженные изображения
        this.priorityQueue = []; // Приоритетная очередь (для фуллскрина)
        this.isProcessing = false;
        this.batchSize = 3; // Размер батча по умолчанию
        this.maxBatchSize = 10; // Максимальный размер батча после загрузки всех превью
        this.allThumbnailsLoaded = false;
    }

    /**
     * Добавить изображение в очередь загрузки
     * @param {string} imageSrc - Путь к изображению
     * @param {boolean} priority - Приоритетная загрузка (для фуллскрина)
     */
    addToQueue(imageSrc, priority = false) {
        // Пропускаем если уже загружено или загружается
        if (this.loadedSet.has(imageSrc) || this.loadingSet.has(imageSrc)) {
            return;
        }

        if (priority) {
            // Добавляем в приоритетную очередь
            if (!this.priorityQueue.includes(imageSrc)) {
                this.priorityQueue.push(imageSrc);
            }
        } else {
            // Добавляем в обычную очередь
            if (!this.loadingQueue.includes(imageSrc)) {
                this.loadingQueue.push(imageSrc);
            }
        }

        // Запускаем обработку если еще не запущена
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Добавить несколько изображений в очередь
     * @param {Array<string>} imageSrcs - Массив путей к изображениям
     * @param {boolean} priority - Приоритетная загрузка
     */
    addBatchToQueue(imageSrcs, priority = false) {
        imageSrcs.forEach(src => this.addToQueue(src, priority));
    }

    /**
     * Обработка очереди загрузки
     */
    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.priorityQueue.length > 0 || this.loadingQueue.length > 0) {
            // Определяем размер батча
            const currentBatchSize = this.allThumbnailsLoaded ? this.maxBatchSize : this.batchSize;

            // Сначала обрабатываем приоритетную очередь
            const priorityBatch = this.priorityQueue.splice(0, currentBatchSize);
            const normalBatch = this.loadingQueue.splice(0, Math.max(0, currentBatchSize - priorityBatch.length));

            const batch = [...priorityBatch, ...normalBatch];

            if (batch.length === 0) {
                break;
            }

            // Загружаем батч
            await this.loadBatch(batch);

            // Небольшая задержка между батчами для снижения нагрузки
            if (this.priorityQueue.length > 0 || this.loadingQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        this.isProcessing = false;
    }

    /**
     * Загрузка батча изображений
     * @param {Array<string>} batch - Массив путей к изображениям
     */
    async loadBatch(batch) {
        const promises = batch.map(imageSrc => {
            if (this.loadedSet.has(imageSrc) || this.loadingSet.has(imageSrc)) {
                return Promise.resolve();
            }

            this.loadingSet.add(imageSrc);

            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.loadedSet.add(imageSrc);
                    this.loadingSet.delete(imageSrc);
                    resolve();
                };
                img.onerror = () => {
                    this.loadingSet.delete(imageSrc);
                    resolve(); // Продолжаем даже при ошибке
                };
                img.src = imageSrc;
            });
        });

        await Promise.all(promises);
    }

    /**
     * Проверить, загружено ли изображение
     * @param {string} imageSrc - Путь к изображению
     * @returns {boolean}
     */
    isLoaded(imageSrc) {
        return this.loadedSet.has(imageSrc);
    }

    /**
     * Установить флаг, что все превью загружены
     */
    setAllThumbnailsLoaded() {
        this.allThumbnailsLoaded = true;
        // Перезапускаем обработку с новым размером батча
        if (!this.isProcessing && (this.priorityQueue.length > 0 || this.loadingQueue.length > 0)) {
            this.processQueue();
        }
    }

    /**
     * Установить размер батча
     * @param {number} size - Размер батча
     */
    setBatchSize(size) {
        this.batchSize = size;
    }

    /**
     * Установить максимальный размер батча
     * @param {number} size - Максимальный размер батча
     */
    setMaxBatchSize(size) {
        this.maxBatchSize = size;
    }

    /**
     * Очистить очередь
     */
    clear() {
        this.loadingQueue = [];
        this.priorityQueue = [];
        this.loadingSet.clear();
        this.loadedSet.clear();
    }
}

// Глобальный экземпляр загрузчика
window.imageLoader = new ImageLoader();
