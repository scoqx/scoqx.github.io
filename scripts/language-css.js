// Pure CSS language switching with minimal JS for localStorage
document.addEventListener('DOMContentLoaded', () => {
  const langToggle = document.getElementById('langToggle');
  const langButton = document.querySelector('.lang-button');
  
  if (!langToggle || !langButton) return;
  
  // Load saved language preference
  const savedLang = localStorage.getItem('language');
  if (savedLang === 'ru') {
    langToggle.checked = true;
    langButton.textContent = 'EN'; // Показываем язык, на который переключаемся
  } else {
    langToggle.checked = false;
    langButton.textContent = 'RU'; // Показываем язык, на который переключаемся
  }
  
  // Save language preference on change
  langToggle.addEventListener('change', () => {
    langButton.textContent = langToggle.checked ? 'EN' : 'RU'; // Показываем язык, на который переключаемся
    localStorage.setItem('language', langToggle.checked ? 'ru' : 'en');
  });
});
