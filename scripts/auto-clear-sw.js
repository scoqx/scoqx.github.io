// Автоматическая очистка Service Worker при каждом заходе
console.log('🧹 Автоматическая очистка Service Worker...');

// Функция очистки
function clearServiceWorker() {
  // 1. Удаление всех Service Worker регистраций
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      console.log('🔍 Найдено Service Worker регистраций:', registrations.length);
      for(let registration of registrations) {
        registration.unregister().then(function(boolean) {
          console.log('✅ Service Worker удален:', boolean);
        });
      }
    });
  }

  // 2. Очистка всех кэшей
  if ('caches' in window) {
    caches.keys().then(function(cacheNames) {
      console.log('🔍 Найдено кэшей:', cacheNames.length);
      return Promise.all(
        cacheNames.map(function(cacheName) {
          console.log('🗑️ Удаляем кэш:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      console.log('✅ Все кэши очищены');
    });
  }

  // 3. Очистка localStorage (только старые данные)
  try {
    const oldKeys = ['language', 'sw-cache-version'];
    oldKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`✅ Удален старый ключ: ${key}`);
      }
    });
  } catch (e) {
    console.log('❌ Ошибка очистки localStorage:', e);
  }

  // 4. Очистка sessionStorage
  try {
    sessionStorage.clear();
    console.log('✅ sessionStorage очищен');
  } catch (e) {
    console.log('❌ Ошибка очистки sessionStorage:', e);
  }
}

// Запускаем очистку сразу при загрузке
clearServiceWorker();

// Также очищаем при каждом переходе на страницу
window.addEventListener('beforeunload', clearServiceWorker);
window.addEventListener('load', clearServiceWorker);

console.log('🎯 Автоматическая очистка настроена');

