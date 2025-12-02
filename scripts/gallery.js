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
        this.showLoadingState();
        await this.loadImages();
        this.setupModules();
        this.setupEventListeners();
        this.renderGallery();
        this.hideLoadingState();
    }
    
    setupModules() {
        // Initialize modules
        this.fullscreenModule = new FullscreenModule(this);
        this.previewModule = new PreviewModule(this);
        this.swipeModule = new SwipeModule(this);
    }
    
    async loadImages() {
        this.images = [];
        
        // Load only from JSON config (no auto-detection for better performance)
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
            } else {
                console.log('No config file found, using fallback images');
                // Fallback to a few known images if no config
                this.images = [
                    { src: '/images/1.jpg', title: 'Image 1', description: 'Description 1', order: 1 },
                    { src: '/images/2.jpg', title: 'Image 2', description: 'Description 2', order: 2 },
                    { src: '/images/3.jpg', title: 'Image 3', description: 'Description 3', order: 3 }
                ];
            }
        } catch (error) {
            console.log('Error loading config, using fallback images');
            // Fallback to a few known images if error
            this.images = [
                { src: '/images/1.jpg', title: 'Image 1', description: 'Description 1', order: 1 },
                { src: '/images/2.jpg', title: 'Image 2', description: 'Description 2', order: 2 },
                { src: '/images/3.jpg', title: 'Image 3', description: 'Description 3', order: 3 }
            ];
        }
        
        console.log(`Total images loaded: ${this.images.length}`);
    }
    
    showLoadingState() {
        const galleryContainer = document.querySelector('.gallery-container');
        if (!galleryContainer) return;
        
        // Create loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'galleryLoadingOverlay';
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading gallery</div>
        `;
        
        // Add styles
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        
        document.body.appendChild(loadingOverlay);
        console.log('🔄 Gallery loading started');
    }
    
    hideLoadingState() {
        const loadingOverlay = document.getElementById('galleryLoadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
            console.log('✅ Gallery loading completed');
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
    
    async renderGallery() {
        // Apply saved view mode first, before rendering
        this.applySavedViewMode();
        this.renderMainImage();
        await this.renderThumbnailsAsync();
        this.updateViewModeButton();
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
        const imageContainer = document.querySelector('.gallery-image-container');
        
        if (mainImage) {
            // Show loading state
            mainImage.classList.add('loading');
            mainImage.classList.remove('loaded');
            
            // Add loading spinner
            this.showLoadingSpinner(imageContainer);
            
            // Set up image loading
            const img = new Image();
            img.onload = () => {
                console.log('Image loaded:', image.src);
                mainImage.src = image.src;
                mainImage.alt = image.title;
                mainImage.classList.remove('loading');
                mainImage.classList.add('loaded');
                this.hideLoadingSpinner(imageContainer);
            };
            
            img.onerror = () => {
                console.error('Failed to load image:', image.src);
                mainImage.classList.remove('loading');
                this.hideLoadingSpinner(imageContainer);
                this.showImageError(imageContainer, image.title);
            };
            
            img.src = image.src;
        }
        
        if (imageTitle) imageTitle.textContent = image.title;
        if (imageDescription) imageDescription.textContent = image.description;
    }
    
    showLoadingSpinner(container) {
        if (!container) return;
        
        // Remove existing loading elements
        this.hideLoadingSpinner(container);
        
        // Create loading spinner
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.id = 'mainImageSpinner';
        
        // Create loading text
        const loadingText = document.createElement('div');
        loadingText.className = 'loading-text';
        loadingText.id = 'mainImageLoadingText';
        loadingText.textContent = 'Loading';
        
        container.appendChild(spinner);
        container.appendChild(loadingText);
    }
    
    hideLoadingSpinner(container) {
        if (!container) return;
        
        const spinner = container.querySelector('#mainImageSpinner');
        const loadingText = container.querySelector('#mainImageLoadingText');
        
        if (spinner) spinner.remove();
        if (loadingText) loadingText.remove();
    }
    
    showImageError(container, imageTitle) {
        if (!container) return;
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'loading-text';
        errorDiv.style.color = '#f44336';
        errorDiv.textContent = `Failed to load: ${imageTitle}`;
        errorDiv.id = 'imageError';
        
        container.appendChild(errorDiv);
        
        // Remove error after 3 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 3000);
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
            
            // Add loading state to thumbnail
            optimizedImg.classList.add('loading');
            
            // Set up loading handlers
            optimizedImg.onload = () => {
                optimizedImg.classList.remove('loading');
                optimizedImg.classList.add('loaded');
            };
            
            optimizedImg.onerror = () => {
                optimizedImg.classList.remove('loading');
                // Show placeholder for failed thumbnails
                optimizedImg.style.background = '#333';
                optimizedImg.style.display = 'flex';
                optimizedImg.style.alignItems = 'center';
                optimizedImg.style.justifyContent = 'center';
                optimizedImg.innerHTML = '❌';
            };
            
            thumbnail.innerHTML = `
                <div class="thumbnail-overlay">
                    <span class="thumbnail-title">${image.title}</span>
                </div>
            `;
            
            // Вставляем оптимизированное изображение
            thumbnail.insertBefore(optimizedImg, thumbnail.firstChild);
            
            thumbnail.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
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
            
            // Prevent context menu on mobile devices
            thumbnail.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
            
            // Add preview on hover (only for non-touch devices)
            if (!('ontouchstart' in window)) {
                thumbnail.addEventListener('mouseenter', (e) => {
                    this.previewModule.showPreview(index, e);
                });
                
                thumbnail.addEventListener('mouseleave', () => {
                    this.previewModule.hidePreview();
                });
            }
            
            // Add preview on mousemove (only for non-touch devices)
            if (!('ontouchstart' in window)) {
                thumbnail.addEventListener('mousemove', (e) => {
                    this.previewModule.showPreview(index, e);
                });
            }
            
            container.appendChild(thumbnail);
        });
    }
    
    updateThumbnailSelection() {
        const thumbnails = document.querySelectorAll('.thumbnail');
        thumbnails.forEach((thumb, index) => {
            thumb.classList.toggle('active', index === this.currentIndex);
        });
        
        // In thumbnail mode, scroll to active thumbnail
        if (this.isThumbnailMode && thumbnails[this.currentIndex]) {
            const activeThumbnail = thumbnails[this.currentIndex];
            activeThumbnail.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
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
    
    // Async version of renderThumbnails for better performance
    async renderThumbnailsAsync() {
        const thumbnailsContainer = document.getElementById('thumbnails');
        const gridContainer = document.getElementById('gridContainer');
        
        if (!thumbnailsContainer && !gridContainer) return;
        
        const container = this.isThumbnailMode ? gridContainer : thumbnailsContainer;
        if (!container) return;
        
        container.innerHTML = '';
        
        // Load thumbnails in batches for better performance
        const batchSize = 15; // Increased batch size for faster loading
        const totalImages = this.images.length;
        
        console.log(`🔄 Loading ${totalImages} thumbnails in batches of ${batchSize}`);
        
        for (let i = 0; i < totalImages; i += batchSize) {
            const batch = this.images.slice(i, i + batchSize);
            
            // Create thumbnails for this batch (no delay between batches)
            const batchPromises = batch.map((image, batchIndex) => {
                const index = i + batchIndex;
                return this.createThumbnailAsync(image, index, container);
            });
            
            // Wait for this batch to complete before loading next
            await Promise.all(batchPromises);
        }
        
        console.log('✅ All thumbnails loaded');
    }
    
    async createThumbnailAsync(image, index, container) {
        return new Promise((resolve) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = `thumbnail ${index === this.currentIndex ? 'active' : ''}`;
            
            // Создаем оптимизированное изображение для миниатюры
            const optimizedImg = window.thumbnailOptimizer.createOptimizedImageElement(
                image.src, 
                image.title, 
                'small', 
                'thumbnail-img'
            );
            
            // Add loading state to thumbnail
            optimizedImg.classList.add('loading');
            
            // Set up loading handlers
            optimizedImg.onload = () => {
                optimizedImg.classList.remove('loading');
                optimizedImg.classList.add('loaded');
                resolve();
            };
            
            optimizedImg.onerror = () => {
                optimizedImg.classList.remove('loading');
                // Show placeholder for failed thumbnails
                optimizedImg.style.background = '#333';
                optimizedImg.style.display = 'flex';
                optimizedImg.style.alignItems = 'center';
                optimizedImg.style.justifyContent = 'center';
                optimizedImg.innerHTML = '❌';
                resolve(); // Still resolve to continue with next batch
            };
            
            thumbnail.innerHTML = `
                <div class="thumbnail-overlay">
                    <span class="thumbnail-title">${image.title}</span>
                </div>
            `;
            
            // Вставляем оптимизированное изображение
            thumbnail.insertBefore(optimizedImg, thumbnail.firstChild);
            
            thumbnail.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
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
            
            // Prevent context menu on mobile devices
            thumbnail.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
            
            // Add preview on hover (only for non-touch devices)
            if (!('ontouchstart' in window)) {
                thumbnail.addEventListener('mouseenter', (e) => {
                    this.previewModule.showPreview(index, e);
                });
                
                thumbnail.addEventListener('mouseleave', () => {
                    this.previewModule.hidePreview();
                });
                
                thumbnail.addEventListener('mousemove', (e) => {
                    this.previewModule.showPreview(index, e);
                });
            }
            
            container.appendChild(thumbnail);
        });
    }
}

// Initialize gallery when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Gallery();
});
