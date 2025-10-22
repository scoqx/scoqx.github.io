class PreviewModule {
    constructor(gallery) {
        this.gallery = gallery;
        this.previewTimeout = null;
        this.previewElement = null;
        this.init();
    }
    
    init() {
        this.createPreviewHTML();
    }
    
    createPreviewHTML() {
        // Create preview element if it doesn't exist
        if (!document.getElementById('imagePreview')) {
            const preview = document.createElement('div');
            preview.id = 'imagePreview';
            preview.className = 'image-preview hidden';
            preview.innerHTML = `
                <img class="preview-image" alt="Preview">
                <div class="preview-info">
                    <h3 class="preview-title"></h3>
                    <p class="preview-description"></p>
                </div>
            `;
            document.body.appendChild(preview);
        }
    }
    
    showPreview(imageIndex, event) {
        if (!this.gallery.images || this.gallery.images.length === 0) return;
        
        const image = this.gallery.images[imageIndex];
        if (!image) return;
        
        // Clear existing timeout
        if (this.previewTimeout) {
            clearTimeout(this.previewTimeout);
        }
        
        // Set new timeout
        this.previewTimeout = setTimeout(() => {
            this.displayPreview(image, event);
        }, 600); // 0.6 seconds
    }
    
    hidePreview() {
        if (this.previewTimeout) {
            clearTimeout(this.previewTimeout);
            this.previewTimeout = null;
        }
        
        const preview = document.getElementById('imagePreview');
        if (preview) {
            preview.classList.add('hidden');
        }
    }
    
    async displayPreview(image, event) {
        const preview = document.getElementById('imagePreview');
        if (!preview) return;
        
        const previewImage = preview.querySelector('.preview-image');
        const previewTitle = preview.querySelector('.preview-title');
        const previewDescription = preview.querySelector('.preview-description');
        
        if (previewImage) {
            // Для Firefox используем упрощенный подход
            const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
            
            if (isFirefox) {
                // Для Firefox просто используем оригинальное изображение с параметром
                const timestamp = Date.now();
                previewImage.src = `${image.src}?v=${timestamp}&preview=1`;
                console.log('🦊 Firefox preview using original image');
            } else {
                // Для других браузеров используем оптимизированное изображение
                try {
                    const optimizedSrc = await window.thumbnailOptimizer.createOptimizedThumbnail(image.src, 'medium');
                    previewImage.src = optimizedSrc;
                } catch (error) {
                    console.warn('Failed to create optimized preview, using original:', error);
                    previewImage.src = image.src;
                }
            }
            previewImage.alt = image.title;
        }
        
        if (previewTitle) {
            previewTitle.textContent = image.title;
        }
        
        if (previewDescription) {
            previewDescription.textContent = image.description;
        }
        
        // Position preview near cursor
        this.positionPreview(preview, event);
        
        // Show preview
        preview.classList.remove('hidden');
    }
    
    positionPreview(preview, event) {
        const rect = preview.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = event.clientX + 20;
        let top = event.clientY - 20;
        
        // Adjust if preview goes off screen
        if (left + rect.width > viewportWidth) {
            left = event.clientX - rect.width - 20;
        }
        
        if (top + rect.height > viewportHeight) {
            top = event.clientY - rect.height - 20;
        }
        
        // Ensure preview stays within viewport
        left = Math.max(10, Math.min(left, viewportWidth - rect.width - 10));
        top = Math.max(10, Math.min(top, viewportHeight - rect.height - 10));
        
        preview.style.left = left + 'px';
        preview.style.top = top + 'px';
    }
}
