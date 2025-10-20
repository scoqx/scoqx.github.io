// Скрипт для выделения активной ссылки в навигации
document.addEventListener('DOMContentLoaded', function() {
  // Получаем текущую страницу из data-page атрибута body
  const currentPage = document.body.getAttribute('data-page');
  
  if (currentPage) {
    // Находим соответствующую ссылку в навигации
    const activeLink = document.querySelector(`#nav-${currentPage}`);
    
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }
  
  // Если нет data-page, определяем по URL
  if (!currentPage) {
    const currentPath = window.location.pathname;
    const currentFile = currentPath.split('/').pop().replace('.html', '');
    
    // Маппинг файлов на ID ссылок
    const pageMapping = {
      'index': 'nav-home',
      'gallery': 'nav-gallery', 
      'compilations': 'nav-compilations',
      'commands': 'nav-commands',
      'info': 'nav-info',
      'downloads': 'nav-downloads'
    };
    
    const linkId = pageMapping[currentFile];
    if (linkId) {
      const activeLink = document.getElementById(linkId);
      if (activeLink) {
        activeLink.classList.add('active');
      }
    }
  }
});

