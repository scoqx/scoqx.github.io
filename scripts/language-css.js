// Simple CSS-based language switching
document.addEventListener('DOMContentLoaded', () => {
  const langToggle = document.getElementById('langToggle');
  
  if (!langToggle) return;
  
  // Load saved language preference - DISABLED FOR TESTING
  /*
  const savedLang = localStorage.getItem('language');
  if (savedLang === 'ru') {
    langToggle.checked = true;
    document.body.classList.add('lang-ru');
  }
  */
  
  // Handle toggle change - DISABLED FOR TESTING
  /*
  langToggle.addEventListener('change', () => {
    console.log('🔍 Language change detected!');
    
    // Capture sizes BEFORE change
    const h2 = document.querySelector('h2');
    const h3 = document.querySelector('h3');
    const navLinks = document.querySelectorAll('nav a');
    
    console.log('📏 BEFORE language change:');
    if (h2) {
      const style = getComputedStyle(h2);
      console.log(`  H2: ${style.fontSize}`);
    }
    if (h3) {
      const style = getComputedStyle(h3);
      console.log(`  H3: ${style.fontSize}`);
    }
    navLinks.forEach((link, index) => {
      const style = getComputedStyle(link);
      console.log(`  Nav ${index}: ${style.fontSize}`);
    });
    
    if (langToggle.checked) {
      document.body.classList.add('lang-ru');
      localStorage.setItem('language', 'ru');
    } else {
      document.body.classList.remove('lang-ru');
      localStorage.setItem('language', 'en');
    }
    
    // Check sizes AFTER change
    setTimeout(() => {
      console.log('📏 AFTER language change:');
      if (h2) {
        const style = getComputedStyle(h2);
        console.log(`  H2: ${style.fontSize}`);
      }
      if (h3) {
        const style = getComputedStyle(h3);
        console.log(`  H3: ${style.fontSize}`);
      }
      navLinks.forEach((link, index) => {
        const style = getComputedStyle(link);
        console.log(`  Nav ${index}: ${style.fontSize}`);
      });
    }, 100);
  });
  */
});
