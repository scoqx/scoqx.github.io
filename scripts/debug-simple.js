// Простой debug для проверки отображения
console.log('🔍 Debug script loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('🔍 DOMContentLoaded fired');
  
  // Проверяем основные элементы
  const body = document.body;
  console.log('🔍 Body classes:', body.className);
  
  // Проверяем элементы языка
  const langEn = document.querySelectorAll('.lang-en');
  const langRu = document.querySelectorAll('.lang-ru');
  console.log('🔍 .lang-en elements:', langEn.length);
  console.log('🔍 .lang-ru elements:', langRu.length);
  
  if (langEn.length > 0) {
    const firstEn = langEn[0];
    const style = getComputedStyle(firstEn);
    console.log('🔍 First .lang-en display:', style.display);
  }
  
  if (langRu.length > 0) {
    const firstRu = langRu[0];
    const style = getComputedStyle(firstRu);
    console.log('🔍 First .lang-ru display:', style.display);
  }
  
  // Проверяем основные элементы страницы
  const header = document.querySelector('header');
  const main = document.querySelector('main');
  console.log('🔍 Header found:', !!header);
  console.log('🔍 Main found:', !!main);
  
  if (header) {
    const headerStyle = getComputedStyle(header);
    console.log('🔍 Header display:', headerStyle.display);
  }
  
  if (main) {
    const mainStyle = getComputedStyle(main);
    console.log('🔍 Main display:', mainStyle.display);
  }
});