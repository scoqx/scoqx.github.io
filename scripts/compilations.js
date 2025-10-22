document.addEventListener('DOMContentLoaded', async () => {
    // Randomize compilation cards order
    randomizeCompilationCards();
    
    // Load compilations config
    let compilationsConfig = {};
    try {
        const response = await fetch('/images/compilations-config.json');
        compilationsConfig = await response.json();
        console.log('Compilations config loaded:', compilationsConfig);
    } catch (error) {
        console.error('Failed to load compilations config:', error);
        return;
    }
    
    const n8mareContainer = document.getElementById('n8mare-screenshots');
    const runoContainer = document.getElementById('runo-screenshots');
    const eliteContainer = document.getElementById('elite-screenshots');
    
    // Load screenshots asynchronously in batches
    const loadPromises = [];
    
    if (n8mareContainer && compilationsConfig.n8mare) {
        loadPromises.push(loadCompilationScreenshotsAsync('n8mare', n8mareContainer, compilationsConfig.n8mare));
    }
    
    if (runoContainer && compilationsConfig.runo) {
        loadPromises.push(loadCompilationScreenshotsAsync('runo', runoContainer, compilationsConfig.runo));
    }
    
    if (eliteContainer && compilationsConfig.elite) {
        loadPromises.push(loadCompilationScreenshotsAsync('elite', eliteContainer, compilationsConfig.elite));
    }
    
    // Wait for all screenshots to load
    await Promise.all(loadPromises);
});

async function loadCompilationScreenshotsAsync(compilationName, container, config) {
    console.log(`🔄 Loading ${compilationName} screenshots asynchronously`);
    
    const maxImages = config.count;
    const extension = config.extension;
    
    // Load screenshots in batches for better performance
    const batchSize = 3; // Load 3 screenshots at a time
    
    for (let i = 1; i <= maxImages; i += batchSize) {
        const batch = [];
        
        // Create batch of screenshots to load
        for (let j = i; j < i + batchSize && j <= maxImages; j++) {
            batch.push(createScreenshotAsync(compilationName, j, extension, container));
        }
        
        // Wait for this batch to complete
        await Promise.all(batch);
        
        // Small delay between batches
        if (i + batchSize <= maxImages) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log(`✅ ${compilationName} screenshots loaded`);
}

async function createScreenshotAsync(compilationName, index, extension, container) {
    return new Promise((resolve) => {
        const imagePath = `/images/${compilationName}/${index}.${extension}`;
        
        const screenshot = {
            src: imagePath,
            alt: `${compilationName} screenshot ${index}`,
            index: index
        };
        
        const screenshotElement = createScreenshotElement(screenshot, index - 1);
        container.appendChild(screenshotElement);
        
        resolve();
    });
}


function createScreenshotElement(screenshot, index) {
    const screenshotDiv = document.createElement('div');
    screenshotDiv.className = 'screenshot-item';
    
    // Create loading spinner
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    
    // Создаем оптимизированное изображение для скриншота
    const optimizedImg = window.thumbnailOptimizer.createOptimizedImageElement(
        screenshot.src, 
        screenshot.alt, 
        'small', 
        'screenshot-img'
    );
    
    // Добавляем data-original-src для поиска
    optimizedImg.setAttribute('data-original-src', screenshot.src);
    
    // Add loading state to screenshot
    optimizedImg.classList.add('loading');
    
    // Set up loading handlers
    optimizedImg.onload = () => {
        optimizedImg.classList.remove('loading');
        optimizedImg.classList.add('loaded');
        spinner.remove(); // Remove spinner when image loads
    };
    
    optimizedImg.onerror = () => {
        optimizedImg.classList.remove('loading');
        spinner.remove(); // Remove spinner on error
        // Show placeholder for failed screenshots
        optimizedImg.style.background = '#333';
        optimizedImg.style.display = 'flex';
        optimizedImg.style.alignItems = 'center';
        optimizedImg.style.justifyContent = 'center';
        optimizedImg.innerHTML = '❌';
    };
    
    screenshotDiv.innerHTML = `
        <div class="screenshot-overlay">
            <span class="screenshot-number">${index + 1}</span>
        </div>
    `;
    
    // Вставляем спиннер и оптимизированное изображение
    screenshotDiv.insertBefore(spinner, screenshotDiv.firstChild);
    screenshotDiv.insertBefore(optimizedImg, screenshotDiv.firstChild);
    
    // Add click to open in fullscreen
    screenshotDiv.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Screenshot clicked:', screenshot.src, index);
        openScreenshotFullscreen(screenshot.src, index);
    });
    
    return screenshotDiv;
}

// Global variables for fullscreen navigation
let currentScreenshots = [];
let currentScreenshotIndex = 0;

function openScreenshotFullscreen(imageSrc, index) {
    console.log('Opening fullscreen for:', imageSrc, index);
    
    // Get all screenshots from the current compilation
    // Try to find by exact src first, then by data attribute or class
    let screenshotImg = document.querySelector('.screenshot-item img[src="' + imageSrc + '"]');
    
    if (!screenshotImg) {
        // Try to find by data-original-src
        screenshotImg = document.querySelector('.screenshot-item img[data-original-src="' + imageSrc + '"]');
    }
    
    if (!screenshotImg) {
        // Try to find by looking through all screenshot images and matching the source
        const allScreenshotImgs = document.querySelectorAll('.screenshot-item img');
        for (let img of allScreenshotImgs) {
            if (img.src === imageSrc || img.getAttribute('data-original-src') === imageSrc) {
                screenshotImg = img;
                break;
            }
        }
    }
    
    if (!screenshotImg) {
        console.log('No screenshot image found for:', imageSrc);
        console.log('Available images:', Array.from(document.querySelectorAll('.screenshot-item img')).map(img => img.src));
        return;
    }
    
    // Remove active class from all screenshots in current card
    const currentCard = screenshotImg.closest('.compilation-card');
    if (currentCard) {
        const allScreenshots = currentCard.querySelectorAll('.screenshot-item');
        allScreenshots.forEach(item => item.classList.remove('active'));
        
        // Add active class to current screenshot
        const screenshotItem = screenshotImg.closest('.screenshot-item');
        if (screenshotItem) {
            screenshotItem.classList.add('active');
        }
    }
    
    const screenshotItems = currentCard.querySelectorAll('.screenshot-item img');
    currentScreenshots = Array.from(screenshotItems).map(img => {
        // Используем data-original-src если доступен, иначе src
        return img.getAttribute('data-original-src') || img.src;
    });
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
        console.log('Fullscreen image set to:', imageSrc);
    }
    
    overlay.classList.remove('hidden');
    console.log('Fullscreen overlay shown');
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
    
    // Update active screenshot in the grid
    updateActiveScreenshot();
}

function updateActiveScreenshot() {
    // Remove active class from all screenshots in current card
    const allScreenshots = document.querySelectorAll('.screenshot-item');
    allScreenshots.forEach(item => item.classList.remove('active'));
    
    // Find and activate the current screenshot
    if (currentScreenshots.length > 0 && currentScreenshotIndex >= 0 && currentScreenshotIndex < currentScreenshots.length) {
        const currentScreenshotSrc = currentScreenshots[currentScreenshotIndex];
        
        // Find the screenshot element with matching src
        const screenshotImg = document.querySelector('.screenshot-item img[src="' + currentScreenshotSrc + '"]') ||
                            document.querySelector('.screenshot-item img[data-original-src="' + currentScreenshotSrc + '"]');
        
        if (screenshotImg) {
            const screenshotItem = screenshotImg.closest('.screenshot-item');
            if (screenshotItem) {
                screenshotItem.classList.add('active');
            }
        }
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
    let isSwipeActive = false;
    const minSwipeDistance = 50;
    const maxVerticalDistance = 100;
    
    overlay.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isSwipeActive = true;
        }
    }, { passive: true });
    
    overlay.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isSwipeActive) {
            endX = e.touches[0].clientX;
            endY = e.touches[0].clientY;
            
            // Prevent default scrolling if it's a horizontal swipe
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);
            
            if (absDeltaX > absDeltaY && absDeltaX > 10) {
                e.preventDefault();
            }
        }
    }, { passive: false });
    
    overlay.addEventListener('touchend', (e) => {
        if (!isSwipeActive || !startX || !startY || !endX || !endY) {
            isSwipeActive = false;
            return;
        }
        
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        // Check if it's a horizontal swipe (not vertical scroll)
        if (absDeltaX > minSwipeDistance && absDeltaX > absDeltaY && absDeltaY < maxVerticalDistance) {
            e.preventDefault();
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
        isSwipeActive = false;
    }, { passive: false });
}

// Function to randomize compilation cards order
function randomizeCompilationCards() {
    const compilationsGrid = document.querySelector('.compilations-grid');
    if (!compilationsGrid) return;
    
    const cards = Array.from(compilationsGrid.children);
    
    // Fisher-Yates shuffle algorithm
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    
    // Re-append cards in new random order
    cards.forEach(card => compilationsGrid.appendChild(card));
}
