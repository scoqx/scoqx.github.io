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
    loadOSP2Version();
});

// Clear cache function
async function clearCache() {
    try {
        console.log('🚀 Enhanced Cache Clear Service started');
        
        // Set flag to prevent infinite loop
        sessionStorage.setItem('cache_clearing', 'true');
        
        // Show working status
        showMessage('Initializing complete cache cleanup...', 'working');
        
        // Step 1: Clear Service Worker cache
        console.log('🧹 Clearing Service Worker cache...');
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
            console.log('✅ Service Worker cache cleared');
        }
        await delay(500);
        
        // Step 2: Clear localStorage
        console.log('🗄️ Clearing localStorage...');
        localStorage.clear();
        console.log('✅ localStorage cleared');
        await delay(500);
        
        // Step 3: Clear sessionStorage
        console.log('💾 Clearing sessionStorage...');
        const cacheClearingFlag = sessionStorage.getItem('cache_clearing');
        sessionStorage.clear();
        sessionStorage.setItem('cache_clearing', cacheClearingFlag);
        console.log('✅ sessionStorage cleared');
        await delay(500);
        
        // Step 4: Clear IndexedDB
        console.log('🗃️ Clearing IndexedDB...');
        if ('indexedDB' in window) {
            try {
                const databases = await indexedDB.databases();
                await Promise.all(databases.map(db => {
                    return new Promise((resolve, reject) => {
                        const deleteReq = indexedDB.deleteDatabase(db.name);
                        deleteReq.onsuccess = () => resolve();
                        deleteReq.onerror = () => reject(deleteReq.error);
                    });
                }));
                console.log('✅ IndexedDB cleared');
            } catch (e) {
                console.log('⚠️ IndexedDB clearing failed:', e);
            }
        }
        await delay(500);
        
        // Step 5: Clear domain-specific data
        console.log('🌐 Clearing domain-specific data...');
        
        // Clear all cookies for the domain
        document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        
        // Clear any domain-specific storage
        try {
            // Clear all possible storage keys related to scoqx.github.io
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('osp2') || key.includes('scoqx') || key.includes('thumbnail'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            // Clear any cached data in memory
            if (window.thumbnailOptimizer) {
                window.thumbnailOptimizer.clearCache();
            }
            
            console.log('✅ Domain-specific data cleared');
        } catch (e) {
            console.log('⚠️ Domain-specific clearing failed:', e);
        }
        await delay(500);
        
        // Step 6: Unregister Service Workers
        console.log('⚙️ Unregistering Service Workers...');
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(registration => registration.unregister()));
                console.log('✅ Service Workers unregistered');
            } catch (e) {
                console.log('⚠️ Service Worker unregistration failed:', e);
            }
        }
        await delay(500);
        
        // Step 7: Redirect to updated page
        console.log('🔄 Redirecting to updated page...');
        showMessage('Cache cleared successfully! Redirecting...', 'success');
        
        setTimeout(() => {
            const timestamp = new Date().getTime();
            window.location.href = `/en/index.html?nocache=1&v=${timestamp}&cleared=1`;
        }, 2000);
        
    } catch (error) {
        console.error('❌ Enhanced cache clearing failed:', error);
        showMessage('Cache clearing failed: ' + error.message, 'error');
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
        messageEl.style.backgroundColor = '#ffffff';
        messageEl.style.color = '#000000';
    } else if (type === 'error') {
        messageEl.style.backgroundColor = '#f44336';
    } else if (type === 'working') {
        messageEl.style.backgroundColor = '#666666';
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
    }).join('');
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
            // Initialize search after changelog is loaded
            initializeChangelogSearch();
        }
    } catch (error) {
        console.error('Error loading changelog:', error);
        const changelogEl = document.getElementById('changelog-content');
        if (changelogEl) {
            changelogEl.textContent = 'Error loading changelog: ' + error.message;
        }
    }
}

// Initialize changelog search
function initializeChangelogSearch() {
    const searchToggle = document.getElementById('changelog-search-toggle');
    const searchSection = document.querySelector('.changelog-search-section');
    const searchInput = document.getElementById('changelog-search');
    const clearBtn = document.getElementById('clear-changelog-search');
    
    if (!searchToggle || !searchSection || !searchInput || !clearBtn) return;
    
    const versionBlocks = document.querySelectorAll('.version-block');
    const totalCount = versionBlocks.length;
    
    if (totalCount === 0) {
        console.warn('No version blocks found for search');
        return;
    }
    
    // Store original HTML for each block to restore highlights
    versionBlocks.forEach(block => {
        if (!block.dataset.originalHtml) {
            block.dataset.originalHtml = block.innerHTML;
        }
    });
    
    // Function to highlight text in element
    function highlightText(element, query) {
        if (!query || !element) return;
        
        const text = element.textContent;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const highlightedText = text.replace(regex, '<mark class="search-highlight">$1</mark>');
        
        if (highlightedText !== text) {
            element.innerHTML = highlightedText;
        }
    }
    
    // Function to clear highlight
    function clearHighlight(element) {
        if (!element) return;
        
        const marks = element.querySelectorAll('mark.search-highlight');
        marks.forEach(mark => {
            mark.outerHTML = mark.textContent;
        });
    }
    
    // Search function
    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        let visibleCount = 0;
        
        versionBlocks.forEach(block => {
            // Restore original HTML if exists
            if (block.dataset.originalHtml) {
                block.innerHTML = block.dataset.originalHtml;
            }
            
            if (query === '') {
                // Show all blocks and clear highlights
                block.classList.remove('hidden');
                visibleCount++;
                
                const versionHeader = block.querySelector('.version-header');
                if (versionHeader) clearHighlight(versionHeader);
            } else {
                // Get text content from the entire block
                const blockText = block.textContent.toLowerCase();
                const isMatch = blockText.includes(query);
                
                if (isMatch) {
                    block.classList.remove('hidden');
                    visibleCount++;
                    
                    // Highlight in header if match found there
                    const versionHeader = block.querySelector('.version-header');
                    if (versionHeader) {
                        const headerText = versionHeader.textContent.toLowerCase();
                        if (headerText.includes(query)) {
                            highlightText(versionHeader, query);
                        }
                    }
                } else {
                    block.classList.add('hidden');
                }
            }
        });
    }
    
    // Toggle search section
    searchToggle.addEventListener('click', () => {
        searchSection.classList.toggle('hidden');
        if (!searchSection.classList.contains('hidden')) {
            // Focus on input when opened
            setTimeout(() => searchInput.focus(), 100);
        } else {
            // Clear search when closed
            searchInput.value = '';
            performSearch();
        }
    });
    
    // Event handlers
    searchInput.addEventListener('input', performSearch);
    searchInput.addEventListener('keyup', performSearch);
    
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        performSearch();
        searchInput.focus();
    });
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

// Load OSP2 version from GitHub
async function loadOSP2Version() {
    try {
        console.log('🔍 Loading OSP2 version...');
        // Use GitHub API to avoid CORS issues
        const response = await fetch('https://api.github.com/repos/snems/OSP2/contents/code/cgame/cg_local.h?ref=master', {
            cache: 'no-cache'
        });
        
        if (response.ok) {
            const data = await response.json();
            // Decode base64 content
            const text = atob(data.content.replace(/\s/g, ''));
            // Parse version from #define OSP_VERSION "version"
            const versionMatch = text.match(/#define\s+OSP_VERSION\s+"([^"]+)"/);
            
            if (versionMatch && versionMatch[1]) {
                const version = versionMatch[1];
                const versionEl = document.getElementById('version-text-osp2');
                
                if (versionEl) {
                    versionEl.textContent = version;
                    console.log('✅ OSP2 version loaded:', version);
                }
            } else {
                console.log('⚠️ OSP2 version not found in file');
            }
        } else {
            console.log('⚠️ OSP2 version file not found, using default');
        }
    } catch (error) {
        console.error('Error loading OSP2 version:', error);
        // Keep default version if loading fails
    }
}

// Helper function for delays
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Support modal functions
function openSupportModal() {
    const modal = document.getElementById('supportModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeSupportModal() {
    const modal = document.getElementById('supportModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Если открываем дочернее модальное окно, закрываем основное окно поддержки
        if (modalId === 'donationModal' || modalId === 'cryptoModal' || modalId === 'cardModal') {
            const supportModal = document.getElementById('supportModal');
            if (supportModal && supportModal.classList.contains('active')) {
                supportModal.classList.remove('active');
            }
        }
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Crypto tab switching
function switchCrypto(crypto) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.crypto-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.crypto-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    document.querySelector(`[data-crypto="${crypto}"]`).classList.add('active');
    document.querySelector(`[data-crypto-content="${crypto}"]`).classList.add('active');
}

// Copy address function
function copyAddress(address) {
    navigator.clipboard.writeText(address).then(() => {
        // Find the clicked address element and add copied class
        const addressElements = document.querySelectorAll('.crypto-address');
        addressElements.forEach(element => {
            if (element.textContent.trim() === address) {
                element.classList.add('copied');
                setTimeout(() => {
                    element.classList.remove('copied');
                }, 2000);
            }
        });
    }).catch(err => {
        console.error('Failed to copy address: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = address;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    });
}

// Event listeners for modals
document.addEventListener('DOMContentLoaded', function() {
    // Modal open buttons
    const openCardModal = document.getElementById('openCardModal');
    const openDonationModal = document.getElementById('openDonationModal');
    const openCryptoModal = document.getElementById('openCryptoModal');
    
    if (openCardModal) {
        openCardModal.addEventListener('click', () => openModal('cardModal'));
    }
    if (openDonationModal) {
        openDonationModal.addEventListener('click', () => openModal('donationModal'));
    }
    if (openCryptoModal) {
        openCryptoModal.addEventListener('click', () => openModal('cryptoModal'));
    }
    
    // Modal close buttons
    const closeSupportModalBtn = document.getElementById('closeSupportModal');
    const closeCardModal = document.getElementById('closeCardModal');
    const closeModalBtn = document.getElementById('closeModal');
    const closeCryptoModal = document.getElementById('closeCryptoModal');
    
    if (closeSupportModalBtn) {
        closeSupportModalBtn.addEventListener('click', () => closeSupportModal());
    }
    if (closeCardModal) {
        closeCardModal.addEventListener('click', () => closeModal('cardModal'));
    }
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => closeModal('donationModal'));
    }
    if (closeCryptoModal) {
        closeCryptoModal.addEventListener('click', () => closeModal('cryptoModal'));
    }
    
    // Crypto tab switching
    document.querySelectorAll('.crypto-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const crypto = tab.getAttribute('data-crypto');
            switchCrypto(crypto);
        });
    });
    
    // Address copying
    document.querySelectorAll('.crypto-address').forEach(address => {
        address.addEventListener('click', () => {
            const addressText = address.getAttribute('data-address') || address.textContent.trim();
            copyAddress(addressText);
        });
    });
});

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('donation-modal')) {
        const modalId = event.target.id;
        if (modalId === 'supportModal') {
            closeSupportModal();
        } else {
            closeModal(modalId);
        }
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const activeModal = document.querySelector('.donation-modal.active');
        if (activeModal) {
            if (activeModal.id === 'supportModal') {
                closeSupportModal();
            } else if (activeModal.id === 'donationModal' || activeModal.id === 'cryptoModal' || activeModal.id === 'cardModal') {
                // Закрываем дочернее окно и открываем основное окно поддержки
                closeModal(activeModal.id);
                openSupportModal();
            } else {
                closeModal(activeModal.id);
            }
        }
    }
});