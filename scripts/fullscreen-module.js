class FullscreenModule {
    constructor(gallery) {
        this.gallery = gallery;
        this.isOpen = false;
        this.currentIndex = 0;
        this.init();
    }
    
    init() {
        this.createFullscreenHTML();
        this.setupEventListeners();
    }
    
    createFullscreenHTML() {
        // Create fullscreen overlay if it doesn't exist
        if (!document.getElementById('fullscreenOverlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'fullscreenOverlay';
            overlay.className = 'fullscreen-overlay hidden';
            overlay.innerHTML = `
                <div class="fullscreen-controls">
                    <button id="fullscreenPrev" class="fullscreen-btn">‹</button>
                    <button id="closeFullscreen" class="fullscreen-btn">×</button>
                    <button id="fullscreenNext" class="fullscreen-btn">›</button>
                </div>
                <img id="fullscreenImage" class="fullscreen-image" alt="Fullscreen image">
            `;
            document.body.appendChild(overlay);
        }
    }
    
    setupEventListeners() {
        const overlay = document.getElementById('fullscreenOverlay');
        const prevBtn = document.getElementById('fullscreenPrev');
        const nextBtn = document.getElementById('fullscreenNext');
        const closeBtn = document.getElementById('closeFullscreen');
        
        if (prevBtn) prevBtn.addEventListener('click', () => this.previousImage());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextImage());
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        
        // Close on overlay click
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close();
                }
            });
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }
    
    open(imageIndex = 0) {
        this.currentIndex = imageIndex;
        this.isOpen = true;
        
        const overlay = document.getElementById('fullscreenOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            this.renderImage();
        }
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
    
    close() {
        this.isOpen = false;
        
        const overlay = document.getElementById('fullscreenOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
    
    renderImage() {
        if (!this.gallery.images || this.gallery.images.length === 0) return;
        
        const image = this.gallery.images[this.currentIndex];
        const fullscreenImage = document.getElementById('fullscreenImage');
        
        if (fullscreenImage && image) {
            fullscreenImage.src = image.src;
            fullscreenImage.alt = image.title;
        }
    }
    
    previousImage() {
        if (!this.gallery.images || this.gallery.images.length === 0) return;
        
        this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.gallery.images.length - 1;
        this.renderImage();
    }
    
    nextImage() {
        if (!this.gallery.images || this.gallery.images.length === 0) return;
        
        this.currentIndex = this.currentIndex < this.gallery.images.length - 1 ? this.currentIndex + 1 : 0;
        this.renderImage();
    }
    
    handleKeyboard(e) {
        if (!this.isOpen) return;
        
        switch (e.key) {
            case 'Escape':
                this.close();
                break;
            case 'ArrowLeft':
                this.previousImage();
                break;
            case 'ArrowRight':
                this.nextImage();
                break;
        }
    }
}
