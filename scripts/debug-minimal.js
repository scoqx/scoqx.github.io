// Minimal debug
console.log('🔍 Minimal debug loaded');

// Just show sizes every 3 seconds
setInterval(() => {
  const h2 = document.querySelector('h2');
  if (h2) {
    const style = getComputedStyle(h2);
    console.log('📏 H2 size:', style.fontSize);
  }
  
  const h3 = document.querySelector('h3');
  if (h3) {
    const style = getComputedStyle(h3);
    console.log('📏 H3 size:', style.fontSize);
  }
}, 3000);

console.log('🔍 Minimal debug ready');
