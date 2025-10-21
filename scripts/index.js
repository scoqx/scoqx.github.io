// Simple app functionality
document.addEventListener('DOMContentLoaded', function() {
    loadChangelog();
});

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