// Simple app functionality
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if cache was just cleared
    if (urlParams.has('cleared')) {
        showMessage('Cache cleared successfully!', 'success');
        // Clean up URL
        const cleanUrl = window.location.href.split('?')[0];
        window.history.replaceState({}, document.title, cleanUrl);
    }
    // Check if nocache parameter is present (for manual cache clearing)
    else if (urlParams.has('nocache') && !sessionStorage.getItem('cache_clearing')) {
        console.log('🚫 No-cache mode detected, clearing all caches...');
        clearCache();
    }
    
    loadChangelog();
    loadVersion();
});

// Clear cache function
async function clearCache() {
    try {
        console.log('🧹 Clearing cache...');
        
        // Set flag to prevent infinite loop
        sessionStorage.setItem('cache_clearing', 'true');
        
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
        
        // Clear sessionStorage (but keep our flag for now)
        const cacheClearingFlag = sessionStorage.getItem('cache_clearing');
        sessionStorage.clear();
        sessionStorage.setItem('cache_clearing', cacheClearingFlag);
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
        
        // Force reload with cache busting (without nocache parameter to avoid loop)
        setTimeout(() => {
            const timestamp = new Date().getTime();
            const currentUrl = window.location.href.split('?')[0];
            window.location.href = currentUrl + '?v=' + timestamp + '&cleared=1';
        }, 1500);
        
    } catch (error) {
        console.error('Error clearing cache:', error);
        showMessage('Error clearing cache: ' + error.message, 'error');
        // Clear the flag on error
        sessionStorage.removeItem('cache_clearing');
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

// Reverse changelog order (newest first)
function reverseChangelogOrder(text) {
    // Split by lines and find version entries
    const lines = text.split('\n');
    const versionBlocks = [];
    let currentBlock = null;
    
    for (const line of lines) {
        // Check if line contains version info (date + version pattern)
        if (line.match(/\d{1,2}\.\d{1,2}\s*\.?\s*\d{4}.*v\d+\.\d+/) || 
            line.match(/v\d+\.\d+.*beta/) ||
            line.match(/Version\s+\d+\.\d+/)) {
            // Save previous block if exists
            if (currentBlock) {
                versionBlocks.push(currentBlock);
            }
            // Start new block and extract version info
            const versionMatch = line.match(/v(\d+\.\d+.*?)(?:\s|$)/);
            const version = versionMatch ? versionMatch[1] : line.trim();
            const dateMatch = line.match(/(\d{1,2}\.\d{1,2}\.?\d{4})/);
            const date = dateMatch ? dateMatch[1] : '';
            
            currentBlock = {
                header: `Version: ${version}`,
                date: date,
                content: []
            };
        } else if (currentBlock && line.trim()) {
            // Add content to current block
            currentBlock.content.push(line);
        }
    }
    
    // Add last block
    if (currentBlock) {
        versionBlocks.push(currentBlock);
    }
    
    // Reverse the order (newest first)
    versionBlocks.reverse();
    
    // Reconstruct the text with HTML
    return versionBlocks.map(block => {
        const content = block.content.join('\n');
        const dateAttr = block.date ? ` title="${block.date}"` : '';
        return `<div class="version-block"><div class="version-header"${dateAttr}>${block.header}</div>\n${content}</div>`;
    }).join('\n\n');
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
            // Parse and reverse changelog entries
            const reversedText = reverseChangelogOrder(text);
            changelogEl.innerHTML = reversedText;
            console.log('🔍 Changelog loaded and reversed successfully');
        }
    } catch (error) {
        console.error('Error loading changelog:', error);
        const changelogEl = document.getElementById('changelog-content');
        if (changelogEl) {
            changelogEl.textContent = 'Error loading changelog: ' + error.message;
        }
    }
}

// Load version from version.json
async function loadVersion() {
    try {
        console.log('🔍 Loading version...');
        const response = await fetch('/version.json?v=' + Date.now(), {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const versionEl = document.getElementById('version-text');
            
            if (versionEl && data.version) {
                versionEl.textContent = data.version;
                console.log('✅ Version loaded:', data.version);
            }
        } else {
            console.log('⚠️ Version file not found, using default');
        }
    } catch (error) {
        console.error('Error loading version:', error);
        // Keep default version if loading fails
    }
}