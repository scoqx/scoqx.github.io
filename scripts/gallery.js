class Gallery {
    constructor() {
        this.images = [];
        this.currentIndex = 0;
        this.isThumbnailMode = this.loadViewMode();
        this.isFullscreen = false;
        this.fullscreenModule = null;
        this.previewModule = null;
        this.swipeModule = null;
        
        this.init();
    }
    
    async init() {
        await this.loadImages();
        this.setupModules();
        this.setupEventListeners();
        this.renderGallery();
    }
    
    setupModules() {
        // Initialize modules
        this.fullscreenModule = new FullscreenModule(this);
        this.previewModule = new PreviewModule(this);
        this.swipeModule = new SwipeModule(this);
    }
    
    async loadImages() {
        this.images = [];
        
        // First, try to load from JSON config
        try {
            const response = await fetch('/images/gallery-config.json');
            if (response.ok) {
                const data = await response.json();
                console.log('Loaded config:', data);
                
                // Add images from JSON
                const jsonImages = data.images.sort((a, b) => a.order - b.order).map(img => ({
                    ...img,
                    src: img.src.startsWith('/') ? img.src : '/' + img.src
                }));
                this.images = [...jsonImages];
                console.log('Processed JSON images:', this.images);
            }
        } catch (error) {
            console.log('No config file found or error loading config');
        }
        
        // Then, auto-detect additional images not in JSON
        console.log('Auto-detecting additional images...');
        await this.loadAdditionalImages();
        
        console.log(`Total images loaded: ${this.images.length}`);
    }
    
    async loadAdditionalImages() {
        // Get existing image paths from JSON to avoid duplicates
        const existingPaths = this.images.map(img => img.src);
        console.log(`Starting additional images scan. Existing images: ${existingPaths.length}`);
        
        // Try to detect additional images by checking if they exist
        // Проверяем самые популярные расширения сначала
        const imageExtensions = ['jpg', 'png', 'jpeg', 'webp', 'gif'];
        const maxImages = 100; // Reasonable limit
        
        for (let i = 1; i <= maxImages; i++) {
            let imageFound = false;
            
            for (const ext of imageExtensions) {
                const imagePath = `/images/${i}.${ext}`;
                
                // Skip if already in JSON
                if (existingPaths.includes(imagePath)) {
                    imageFound = true;
                    break;
                }
                
                const exists = await this.checkImageExists(imagePath);
                if (exists) {
                    console.log(`Found additional image: ${imagePath}`);
                    this.images.push({
                        src: imagePath,
                        title: `Image ${i}`,
                        description: `Description for image ${i}`,
                        order: this.images.length + 1000 // Put additional images after JSON ones
                    });
                    imageFound = true;
                    break; // Found image with this number, move to next
                }
            }
            
            // Если не нашли изображение с текущим номером, прекращаем поиск сразу
            if (!imageFound) {
                console.log(`Image ${i} not found, stopping scan (no more images expected)`);
                break;
            }
        }
        
        // Try common names if no numbered images found
        if (this.images.length === existingPaths.length) {
            const commonNames = ['image', 'photo', 'pic', 'img', 'gallery', 'screenshot'];
            for (const name of commonNames) {
                let nameFound = false;
                
                for (const ext of imageExtensions) {
                    const imagePath = `/images/${name}.${ext}`;
                    
                    // Skip if already in JSON
                    if (existingPaths.includes(imagePath)) {
                        nameFound = true;
                        break;
                    }
                    
                    const exists = await this.checkImageExists(imagePath);
                    if (exists) {
                        this.images.push({
                            src: imagePath,
                            title: name.charAt(0).toUpperCase() + name.slice(1),
                            description: `Description for ${name}`,
                            order: this.images.length + 1000
                        });
                        nameFound = true;
                        break; // Found image with this name, move to next
                    }
                }
                
                // Если не нашли изображение с текущим именем, переходим к следующему
                if (!nameFound) {
                    continue;
                }
            }
        }
        
        // Sort by order to maintain JSON images first, then additional ones
        this.images.sort((a, b) => a.order - b.order);
        
        const additionalCount = this.images.length - existingPaths.length;
        console.log(`Found ${additionalCount} additional images not in JSON`);
    }
    
    async loadImagesFromDirectory() {
        // Fallback method to load images if config fails
        this.images = [];
        
        // Try to detect images by checking if they exist
        const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        const maxImages = 50; // Reasonable limit
        
        for (let i = 1; i <= maxImages; i++) {
            for (const ext of imageExtensions) {
                const imagePath = `/images/${i}.${ext}`;
                const exists = await this.checkImageExists(imagePath);
                if (exists) {
                    this.images.push({
                        src: imagePath,
                        title: `Image ${i}`,
                        description: `Description for image ${i}`,
                        order: i
                    });
                    break; // Found image with this number, move to next
                }
            }
        }
        
        // If no numbered images found, try common names
        if (this.images.length === 0) {
            const commonNames = ['image', 'photo', 'pic', 'img'];
            for (const name of commonNames) {
                for (const ext of imageExtensions) {
                    const imagePath = `/images/${name}.${ext}`;
                    const exists = await this.checkImageExists(imagePath);
                    if (exists) {
                        this.images.push({
                            src: imagePath,
                            title: name.charAt(0).toUpperCase() + name.slice(1),
                            description: `Description for ${name}`,
                            order: this.images.length + 1
                        });
                    }
                }
            }
        }
        
        console.log(`Auto-detected ${this.images.length} images`);
    }
    
    async checkImageExists(imagePath) {
        try {
            const response = await fetch(imagePath, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    setupEventListeners() {
        // View mode toggle
        const modeToggle = document.getElementById('modeToggle');
        
        if (modeToggle) {
            modeToggle.addEventListener('change', () => this.toggleViewMode());
        }
        
        // Navigation buttons
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        if (prevBtn) prevBtn.addEventListener('click', () => this.previousImage());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextImage());
        
        // Fullscreen controls
        const fullscreenPrev = document.getElementById('fullscreenPrev');
        const fullscreenNext = document.getElementById('fullscreenNext');
        const closeFullscreen = document.getElementById('closeFullscreen');
        
        if (fullscreenPrev) fullscreenPrev.addEventListener('click', () => this.previousImage());
        if (fullscreenNext) fullscreenNext.addEventListener('click', () => this.nextImage());
        if (closeFullscreen) closeFullscreen.addEventListener('click', () => this.closeFullscreen());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Click on main image to open fullscreen (only in main mode)
        const mainImage = document.getElementById('mainImage');
        if (mainImage) {
            mainImage.addEventListener('click', () => {
                if (!this.isThumbnailMode) {
                    this.fullscreenModule.open(this.currentIndex);
                }
            });
        }
    }
    
    renderGallery() {
        this.renderMainImage();
        this.renderThumbnails();
        this.updateViewModeButton();
        this.applySavedViewMode();
    }
    
    renderMainImage() {
        if (this.images.length === 0) {
            console.log('No images loaded');
            this.showNoImagesMessage();
            return;
        }
        
        const image = this.images[this.currentIndex];
        console.log('Rendering image:', image);
        
        const mainImage = document.getElementById('mainImage');
        const imageTitle = document.getElementById('imageTitle');
        const imageDescription = document.getElementById('imageDescription');
        
        if (mainImage) {
            mainImage.src = image.src;
            mainImage.alt = image.title;
            console.log('Set image src to:', image.src);
        }
        
        if (imageTitle) imageTitle.textContent = image.title;
        if (imageDescription) imageDescription.textContent = image.description;
    }
    
    showNoImagesMessage() {
        const mainImage = document.getElementById('mainImage');
        const imageTitle = document.getElementById('imageTitle');
        const imageDescription = document.getElementById('imageDescription');
        
        if (mainImage) {
            mainImage.style.display = 'none';
        }
        
        if (imageTitle) {
            imageTitle.textContent = document.documentElement.lang === 'ru' ? 'Изображения не найдены' : 'No images found';
        }
        
        if (imageDescription) {
            imageDescription.textContent = document.documentElement.lang === 'ru' 
                ? 'Поместите изображения в папку /images/ или создайте файл gallery-config.json'
                : 'Place images in /images/ folder or create gallery-config.json file';
        }
    }
    
    renderThumbnails() {
        const thumbnailsContainer = document.getElementById('thumbnails');
        const gridContainer = document.getElementById('gridContainer');
        
        if (!thumbnailsContainer && !gridContainer) return;
        
        const container = this.isThumbnailMode ? gridContainer : thumbnailsContainer;
        if (!container) return;
        
        container.innerHTML = '';
        
        this.images.forEach((image, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = `thumbnail ${index === this.currentIndex ? 'active' : ''}`;
            
            // Создаем оптимизированное изображение для миниатюры
            const optimizedImg = window.thumbnailOptimizer.createOptimizedImageElement(
                image.src, 
                image.title, 
                'small', 
                'thumbnail-img'
            );
            
            thumbnail.innerHTML = `
                <div class="thumbnail-overlay">
                    <span class="thumbnail-title">${image.title}</span>
                </div>
            `;
            
            // Вставляем оптимизированное изображение
            thumbnail.insertBefore(optimizedImg, thumbnail.firstChild);
            
            thumbnail.addEventListener('click', () => {
                if (this.isThumbnailMode) {
                    // In thumbnail mode, open fullscreen directly
                    this.fullscreenModule.open(index);
                } else {
                    // In main mode, switch to image
                    this.currentIndex = index;
                    this.renderMainImage();
                    this.updateThumbnailSelection();
                }
            });
            
            // Add preview on hover
            thumbnail.addEventListener('mouseenter', (e) => {
                this.previewModule.showPreview(index, e);
            });
            
            thumbnail.addEventListener('mouseleave', () => {
                this.previewModule.hidePreview();
            });
            
            thumbnail.addEventListener('mousemove', (e) => {
                this.previewModule.showPreview(index, e);
            });
            
            container.appendChild(thumbnail);
        });
    }
    
    updateThumbnailSelection() {
        const thumbnails = document.querySelectorAll('.thumbnail');
        thumbnails.forEach((thumb, index) => {
            thumb.classList.toggle('active', index === this.currentIndex);
        });
    }
    
    toggleViewMode() {
        this.isThumbnailMode = !this.isThumbnailMode;
        
        const mainGallery = document.getElementById('mainGallery');
        const thumbnailGrid = document.getElementById('thumbnailGrid');
        const modeToggle = document.getElementById('modeToggle');
        
        if (this.isThumbnailMode) {
            mainGallery.classList.add('hidden');
            thumbnailGrid.classList.remove('hidden');
        } else {
            mainGallery.classList.remove('hidden');
            thumbnailGrid.classList.add('hidden');
        }
        
        // Sync toggle switch
        if (modeToggle) {
            modeToggle.checked = this.isThumbnailMode;
        }
        
        this.renderThumbnails();
        this.updateViewModeButton();
        this.saveViewMode(); // Save the new state
    }
    
    updateViewModeButton() {
        // No need to update button text anymore
    }
    
    previousImage() {
        this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.images.length - 1;
        this.renderMainImage();
        this.updateThumbnailSelection();
        if (this.isFullscreen) {
            this.renderFullscreenImage();
        }
    }
    
    nextImage() {
        this.currentIndex = this.currentIndex < this.images.length - 1 ? this.currentIndex + 1 : 0;
        this.renderMainImage();
        this.updateThumbnailSelection();
        if (this.isFullscreen) {
            this.renderFullscreenImage();
        }
    }
    
    
    handleKeyboard(e) {
        if (this.isFullscreen) {
            switch (e.key) {
                case 'Escape':
                    this.closeFullscreen();
                    break;
                case 'ArrowLeft':
                    this.previousImage();
                    break;
                case 'ArrowRight':
                    this.nextImage();
                    break;
            }
        } else {
            switch (e.key) {
                case 'ArrowLeft':
                    this.previousImage();
                    break;
                case 'ArrowRight':
                    this.nextImage();
                    break;
            }
        }
    }
    
    // Save and load view mode state
    saveViewMode() {
        const mode = this.isThumbnailMode ? 'thumbnail' : 'main';
        localStorage.setItem('galleryViewMode', mode);
        console.log('Saving view mode:', mode);
    }
    
    loadViewMode() {
        const savedMode = localStorage.getItem('galleryViewMode');
        console.log('Loading view mode:', savedMode);
        return savedMode === 'thumbnail';
    }
    
    applySavedViewMode() {
        // Apply the saved view mode after initial render
        const mainGallery = document.getElementById('mainGallery');
        const thumbnailGrid = document.getElementById('thumbnailGrid');
        const modeToggle = document.getElementById('modeToggle');
        
        if (this.isThumbnailMode) {
            if (mainGallery) mainGallery.classList.add('hidden');
            if (thumbnailGrid) thumbnailGrid.classList.remove('hidden');
        } else {
            if (mainGallery) mainGallery.classList.remove('hidden');
            if (thumbnailGrid) thumbnailGrid.classList.add('hidden');
        }
        
        // Sync toggle switch
        if (modeToggle) {
            modeToggle.checked = this.isThumbnailMode;
        }
        
        this.updateViewModeButton();
    }
}

// Initialize gallery when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Gallery();
});
