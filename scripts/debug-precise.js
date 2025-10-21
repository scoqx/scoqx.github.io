// Precise debug to catch font size changes
console.log('🔍 Precise debug loaded');

let lastSizes = {};

function captureSizes() {
  const navLinks = document.querySelectorAll('nav a');
  const sizes = {};
  
  navLinks.forEach((link, index) => {
    const style = getComputedStyle(link);
    sizes[`nav${index}`] = style.fontSize;
  });
  
  const body = document.body;
  const bodyStyle = getComputedStyle(body);
  sizes.body = bodyStyle.fontSize;
  
  const html = document.documentElement;
  const htmlStyle = getComputedStyle(html);
  sizes.html = htmlStyle.fontSize;
  
  return sizes;
}

function compareSizes() {
  const currentSizes = captureSizes();
  
  for (const key in currentSizes) {
    if (lastSizes[key] && lastSizes[key] !== currentSizes[key]) {
      console.log(`🚨 SIZE CHANGED: ${key} from ${lastSizes[key]} to ${currentSizes[key]}`);
    }
  }
  
  lastSizes = currentSizes;
}

// Capture initial state
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔍 Initial capture:');
  lastSizes = captureSizes();
  console.log('📏 Initial sizes:', lastSizes);
});

// Check every 100ms
setInterval(compareSizes, 100);

// Check on every click
document.addEventListener('click', (e) => {
  console.log('🔍 Click detected, checking sizes...');
  setTimeout(compareSizes, 50);
});

// Check on every change
document.addEventListener('change', (e) => {
  console.log('🔍 Change detected, checking sizes...');
  setTimeout(compareSizes, 50);
});

console.log('🔍 Precise debug ready');
