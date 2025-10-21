// Simple app functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check if nocache parameter is present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('nocache')) {
        console.log('🚫 No-cache mode detected, clearing all caches...');
        clearCache();
    }
    
    loadChangelog();
});

// Clear cache function
async function clearCache() {
    try {
        console.log('🧹 Clearing cache...');
        
        // Clear service worker cache
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
            console.log('✅ Service Worker cache cleared');
        }
        
        // Clear localStorage
        localStorage.clear();
        console.log('✅ LocalStorage cleared');
        
        // Clear sessionStorage
        sessionStorage.clear();
        console.log('✅ SessionStorage cleared');
        
        // Clear IndexedDB if available
        if ('indexedDB' in window) {
            try {
                const databases = await indexedDB.databases();
                await Promise.all(
                    databases.map(db => {
                        return new Promise((resolve, reject) => {
                            const deleteReq = indexedDB.deleteDatabase(db.name);
                            deleteReq.onsuccess = () => resolve();
                            deleteReq.onerror = () => reject(deleteReq.error);
                        });
                    })
                );
                console.log('✅ IndexedDB cleared');
            } catch (e) {
                console.log('⚠️ IndexedDB clear failed:', e);
            }
        }
        
        // Show success message
        showMessage('Cache cleared successfully! Page will reload...', 'success');
        
        // Force reload with cache busting
        setTimeout(() => {
            const timestamp = new Date().getTime();
            const currentUrl = window.location.href.split('?')[0];
            window.location.href = currentUrl + '?v=' + timestamp + '&nocache=1';
        }, 1500);
        
    } catch (error) {
        console.error('Error clearing cache:', error);
        showMessage('Error clearing cache: ' + error.message, 'error');
    }
}

// Show message function
function showMessage(message, type = 'info') {
    // Remove existing message if any
    const existingMessage = document.querySelector('.cache-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `cache-message cache-message-${type}`;
    messageEl.textContent = message;
    
    // Add styles
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Set background color based on type
    if (type === 'success') {
        messageEl.style.backgroundColor = '#4caf50';
    } else if (type === 'error') {
        messageEl.style.backgroundColor = '#f44336';
    } else {
        messageEl.style.backgroundColor = '#2196f3';
    }
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(messageEl);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.remove();
                }
            }, 300);
        }
    }, 3000);
}

// Load changelog
async function loadChangelog() {
    try {
        console.log('🔍 Loading changelog...');
        const response = await fetch('/assets/changelog_be.txt?v=' + Date.now(), {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        console.log('🔍 Changelog response status:', response.status);
        const text = await response.text();
        const changelogEl = document.getElementById('changelog-content');
        
        if (changelogEl) {
            changelogEl.textContent = text;
            console.log('🔍 Changelog loaded successfully');
        }
    } catch (error) {
        console.error('Error loading changelog:', error);
        const changelogEl = document.getElementById('changelog-content');
        if (changelogEl) {
            changelogEl.textContent = 'Error loading changelog: ' + error.message;
        }
    }
}