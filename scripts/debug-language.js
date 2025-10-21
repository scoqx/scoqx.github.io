// Debug language switching
console.log('🔍 Language debug loaded');

let beforeSizes = {};

function captureSizes() {
  const sizes = {};
  
  const h2 = document.querySelector('h2');
  if (h2) {
    const style = getComputedStyle(h2);
    sizes.h2 = style.fontSize;
  }
  
  const h3 = document.querySelector('h3');
  if (h3) {
    const style = getComputedStyle(h3);
    sizes.h3 = style.fontSize;
  }
  
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach((link, index) => {
    const style = getComputedStyle(link);
    sizes[`nav${index}`] = style.fontSize;
  });
  
  return sizes;
}

// Capture sizes before language change
document.addEventListener('click', (e) => {
  if (e.target.id === 'langToggle') {
    console.log('🔍 Language toggle clicked - capturing BEFORE:');
    beforeSizes = captureSizes();
    console.log('📏 BEFORE sizes:', beforeSizes);
    
    // Check after a delay
    setTimeout(() => {
      console.log('🔍 Checking AFTER language change:');
      const afterSizes = captureSizes();
      console.log('📏 AFTER sizes:', afterSizes);
      
      // Compare sizes
      for (const key in afterSizes) {
        if (beforeSizes[key] && beforeSizes[key] !== afterSizes[key]) {
          console.log(`🚨 SIZE CHANGED: ${key} from ${beforeSizes[key]} to ${afterSizes[key]}`);
        }
      }
    }, 100);
  }
});

console.log('🔍 Language debug ready');
