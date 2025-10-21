document.addEventListener('DOMContentLoaded', async () => {
    const n8mareContainer = document.getElementById('n8mare-screenshots');
    const runoContainer = document.getElementById('runo-screenshots');
    
    // Load n8mare screenshots (up to 12 images)
    if (n8mareContainer) {
        await loadCompilationScreenshots('n8mare', n8mareContainer, 12);
    }
    
    // Load runo screenshots (up to 30 images)
    if (runoContainer) {
        await loadCompilationScreenshots('runo', runoContainer, 30);
    }
});

async function loadCompilationScreenshots(compilationName, container, maxImages) {
    const screenshots = [];
    const extensions = ['jpg', 'png', 'jpeg', 'webp']; // Оптимизированный порядок
    
    console.log(`Starting ${compilationName} screenshots scan`);
    
    // Try to load numbered images
    for (let i = 1; i <= maxImages; i++) {
        let screenshotFound = false;
        
        for (const ext of extensions) {
            const imagePath = `/images/${compilationName}/${i}.${ext}`;
            const exists = await checkImageExists(imagePath);
            if (exists) {
                console.log(`Found ${compilationName} screenshot: ${imagePath}`);
                screenshots.push({
                    src: imagePath,
                    alt: `${compilationName} screenshot ${i}`,
                    index: i
                });
                screenshotFound = true;
                break; // Found image with this number, move to next
            }
        }
        
        // Если не нашли скриншот с текущим номером, прекращаем поиск сразу
        if (!screenshotFound) {
            console.log(`${compilationName} screenshot ${i} not found, stopping scan`);
            break;
        }
    }
    
    if (screenshots.length > 0) {
        screenshots.forEach((screenshot, index) => {
            const screenshotElement = createScreenshotElement(screenshot, index);
            container.appendChild(screenshotElement);
        });
    } else {
        container.innerHTML = '<p class="no-screenshots">Screenshots coming soon...</p>';
    }
}

async function checkImageExists(imagePath) {
    try {
        const response = await fetch(imagePath, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

function createScreenshotElement(screenshot, index) {
    const screenshotDiv = document.createElement('div');
    screenshotDiv.className = 'screenshot-item';
    
    // Создаем оптимизированное изображение для скриншота
    const optimizedImg = window.thumbnailOptimizer.createOptimizedImageElement(
        screenshot.src, 
        screenshot.alt, 
        'small', 
        'screenshot-img'
    );
    
    screenshotDiv.innerHTML = `
        <div class="screenshot-overlay">
            <span class="screenshot-number">${index + 1}</span>
        </div>
    `;
    
    // Вставляем оптимизированное изображение
    screenshotDiv.insertBefore(optimizedImg, screenshotDiv.firstChild);
    
    // Add click to open in fullscreen
    screenshotDiv.addEventListener('click', () => {
        openScreenshotFullscreen(screenshot.src, index);
    });
    
    return screenshotDiv;
}

// Global variables for fullscreen navigation
let currentScreenshots = [];
let currentScreenshotIndex = 0;

function openScreenshotFullscreen(imageSrc, index) {
    // Get all screenshots from the current compilation
    const currentCard = document.querySelector('.compilation-card:has(.screenshot-item img[src="' + imageSrc + '"])');
    if (!currentCard) return;
    
    const screenshotItems = currentCard.querySelectorAll('.screenshot-item img');
    currentScreenshots = Array.from(screenshotItems).map(img => img.src);
    currentScreenshotIndex = currentScreenshots.indexOf(imageSrc);
    
    // Create fullscreen overlay if it doesn't exist
    let overlay = document.getElementById('screenshotFullscreen');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'screenshotFullscreen';
        overlay.className = 'screenshot-fullscreen hidden';
        overlay.innerHTML = `
            <div class="screenshot-fullscreen-controls">
                <button id="screenshotFullscreenPrev" class="screenshot-fullscreen-btn">‹</button>
                <button id="closeScreenshotFullscreen" class="screenshot-fullscreen-btn">×</button>
                <button id="screenshotFullscreenNext" class="screenshot-fullscreen-btn">›</button>
            </div>
            <img id="screenshotFullscreenImage" class="screenshot-fullscreen-image" alt="Fullscreen screenshot">
        `;
        document.body.appendChild(overlay);
        
        // Add event listeners
        const closeBtn = document.getElementById('closeScreenshotFullscreen');
        const prevBtn = document.getElementById('screenshotFullscreenPrev');
        const nextBtn = document.getElementById('screenshotFullscreenNext');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                overlay.classList.add('hidden');
            });
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                navigateScreenshot(-1);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                navigateScreenshot(1);
            });
        }
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', handleScreenshotKeyboard);
        
        // Touch/swipe navigation
        setupSwipeNavigation(overlay);
    }
    
    // Show the image
    const fullscreenImage = document.getElementById('screenshotFullscreenImage');
    if (fullscreenImage) {
        fullscreenImage.src = imageSrc;
    }
    
    overlay.classList.remove('hidden');
}

function navigateScreenshot(direction) {
    if (currentScreenshots.length === 0) return;
    
    currentScreenshotIndex += direction;
    
    // Wrap around
    if (currentScreenshotIndex < 0) {
        currentScreenshotIndex = currentScreenshots.length - 1;
    } else if (currentScreenshotIndex >= currentScreenshots.length) {
        currentScreenshotIndex = 0;
    }
    
    const fullscreenImage = document.getElementById('screenshotFullscreenImage');
    if (fullscreenImage) {
        fullscreenImage.src = currentScreenshots[currentScreenshotIndex];
    }
}

function handleScreenshotKeyboard(e) {
    const overlay = document.getElementById('screenshotFullscreen');
    if (!overlay || overlay.classList.contains('hidden')) return;
    
    switch (e.key) {
        case 'Escape':
            overlay.classList.add('hidden');
            break;
        case 'ArrowLeft':
            navigateScreenshot(-1);
            e.preventDefault();
            break;
        case 'ArrowRight':
            navigateScreenshot(1);
            e.preventDefault();
            break;
    }
}

function setupSwipeNavigation(overlay) {
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    const minSwipeDistance = 50;
    const maxVerticalDistance = 100;
    
    overlay.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }
    }, { passive: true });
    
    overlay.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            endX = e.touches[0].clientX;
            endY = e.touches[0].clientY;
        }
    }, { passive: true });
    
    overlay.addEventListener('touchend', (e) => {
        if (!startX || !startY || !endX || !endY) {
            return;
        }
        
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        // Check if it's a horizontal swipe (not vertical scroll)
        if (absDeltaX > minSwipeDistance && absDeltaX > absDeltaY && absDeltaY < maxVerticalDistance) {
            if (deltaX > 0) {
                // Swipe right - previous image
                navigateScreenshot(-1);
            } else {
                // Swipe left - next image
                navigateScreenshot(1);
            }
        }
        
        // Reset values
        startX = 0;
        startY = 0;
        endX = 0;
        endY = 0;
    }, { passive: true });
}
