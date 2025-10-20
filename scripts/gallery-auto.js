const thumbnailsContainer = document.querySelector('.thumbnails');
const sliderContainer = document.querySelector('.slider');

let currentSlide = 0;
const images = [];
let imageFiles = []; // Добавляем глобальную переменную для данных изображений
let galleryConfig = null; // Конфигурация галереи из JSON
let isPreviewMode = false;
let showPreviewText = false; // toggle for showing labels in preview
let hoverTimeout = null;
let hoveredImage = null;
let scrollLockY = 0;

// Настройки качества превью
const PREVIEW_SETTINGS = {
  width: 640,           // Ширина превью
  height: 480,          // Высота превью
  blur: 0,              // Размытие (0 = нет, 1 = легкое, 2 = сильное)
  quality: 0.5,         // Качество сжатия (0.1-1.0)
  batchSize: 20         // Количество превью за раз
};

// Список поддерживаемых форматов изображений
const supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

// Функция для загрузки конфигурации галереи
async function loadGalleryConfig() {
  try {
    const response = await fetch('images/gallery-config.json');
    if (response.ok) {
      galleryConfig = await response.json();
      
    }
  } catch (error) {
    
  }
}


// Функция для получения всех изображений из папки
async function scanImagesFolder() {
  const discovered = [];
  const seen = new Set();

  // 1) Если есть конфиг — берем из него, но не ограничиваемся только им
  if (galleryConfig && galleryConfig.images) {
    galleryConfig.images.forEach((img, idx) => {
      const item = {
        src: img.src,
        index: typeof img.order === 'number' ? img.order : (idx + 1),
        format: (img.src.split('.').pop() || '').toLowerCase(),
        description: img.description || img.title || `Screenshot ${idx + 1}`
      };
      if (!seen.has(item.src)) {
        seen.add(item.src);
        discovered.push(item);
      }
    });
  }

  // 2) Автосканирование по шаблону N.ext, чтобы файлы отображались даже без JSON
  let lastFoundIndex = 0;
  const maxGap = 1;
  for (let i = 1; i <= 200; i++) {
    if (lastFoundIndex > 0 && (i - lastFoundIndex) > maxGap) {
      break;
    }
    for (const format of supportedFormats) {
      const src = `images/${i}.${format}`;
      if (seen.has(src)) { lastFoundIndex = i; break; }
      const exists = await checkImageExists(src);
      if (exists) {
        discovered.push({ src, index: i, format, description: `Screenshot ${i}` });
        seen.add(src);
        lastFoundIndex = i;
        break;
      }
    }
  }

  // 3) При необходимости можно добавить поиск произвольных имен
  const additionalFiles = await scanAdditionalImages();
  for (const f of additionalFiles) {
    if (!seen.has(f.src)) {
      seen.add(f.src);
      discovered.push(f);
    }
  }

  // Сортируем по index, а при равенстве — по src
  discovered.sort((a, b) => (a.index || 0) - (b.index || 0) || a.src.localeCompare(b.src));
  return discovered;
}

// Быстрая проверка существования изображения через fetch
function checkImageExists(src) {
  return fetch(src, { method: 'HEAD' })
    .then(response => response.ok)
    .catch(() => false);
}

// Сканирование дополнительных файлов (если есть)
async function scanAdditionalImages() {
  const additionalFiles = [];
  
  // Здесь можно добавить логику для сканирования файлов с произвольными именами
  // Например, если у вас есть файлы типа "screenshot1.jpg", "photo_2023.png" и т.д.
  
  return additionalFiles;
}

function scrollToThumbnail(index) {
  const thumbnails = thumbnailsContainer.querySelectorAll('.thumbnail');
  const thumbCount = thumbnails.length;
  const visibleThreshold = thumbCount - 4;

  if (index >= visibleThreshold) {
    const thumb = thumbnails[index];
    const containerRect = thumbnailsContainer.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();

    const offset = (thumbRect.right - containerRect.right) + thumbRect.width * 2;

    if (offset > 0) {
      thumbnailsContainer.scrollBy({ left: offset, behavior: 'smooth' });
    }
  } else {
    const thumb = thumbnails[index];
    thumbnailsContainer.scrollBy({
      left: thumb.offsetLeft - thumbnailsContainer.scrollLeft - thumbnailsContainer.clientWidth / 2 + thumb.clientWidth / 2,
      behavior: 'smooth'
    });
  }
}

function showSlide(index) {
  const slides = document.querySelectorAll('.slide');
  const thumbnails = document.querySelectorAll('.thumbnail');
  const previewItems = document.querySelectorAll('.preview-item');

  if (slides.length === 0) return;

  // Обновляем слайды
  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === index);
  });

  // Обновляем миниатюры
  thumbnails.forEach((thumb, i) => {
    thumb.classList.toggle('active', i === index);
  });

  // Обновляем превью если они есть
  previewItems.forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });

  currentSlide = index;
  scrollToThumbnail(index);
  
}

function addImage(imageData, index) {
  // Миниатюра
  const thumb = document.createElement('img');
  thumb.src = imageData.src;
  thumb.className = 'thumbnail';
  thumb.alt = `Image ${imageData.index}`;
  if (index === 0) thumb.classList.add('active');
  thumb.dataset.index = index;
  thumbnailsContainer.appendChild(thumb);

  // Слайд
  const slide = document.createElement('img');
  slide.src = imageData.src;
  slide.className = 'slide';
  slide.alt = `Image ${imageData.index}`;
  if (index === 0) slide.classList.add('active');
  sliderContainer.insertBefore(slide, sliderContainer.querySelector('.prev'));
}

let initialized = false;

async function loadImages() {
  try {
    await loadGalleryConfig();
    
    imageFiles = await scanImagesFolder();
    
    if (imageFiles.length === 0) {
      return;
    }
    
    
    
    // Добавляем только первые 20 изображений для быстрой загрузки
    const initialLoad = Math.min(20, imageFiles.length);
    
    for (let i = 0; i < initialLoad; i++) {
      images.push(imageFiles[i].src);
      addImage(imageFiles[i], i);
    }
    
    if (!initialized) {
      initGallery();
      initialized = true;
    }
    
    // Загружаем остальные изображения постепенно
    if (imageFiles.length > initialLoad) {
      loadRemainingImages(imageFiles, initialLoad);
    }
    
  } catch (error) {
    
  }
}

// Функция для постепенной загрузки остальных изображений
async function loadRemainingImages(imageFiles, startIndex) {
  const batchSize = 10; // Загружаем по 10 изображений за раз
  let currentIndex = startIndex;
  
  while (currentIndex < imageFiles.length) {
    const endIndex = Math.min(currentIndex + batchSize, imageFiles.length);
    
    for (let i = currentIndex; i < endIndex; i++) {
      const imageData = imageFiles[i];
      images.push(imageData.src);
      addImage(imageData, i);
    }
    
    currentIndex = endIndex;
    
    // Небольшая пауза между батчами для плавности
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  
}

const fullscreenOverlay = document.getElementById('fullscreenOverlay');
const fullscreenImage = document.getElementById('fullscreenImage');
const closeFullscreenBtn = document.getElementById('closeFullscreen');

function openFullscreen(src) {
  fullscreenImage.src = src;
  fullscreenOverlay.classList.remove('hidden');
  lockScroll();
}

function closeFullscreen() {
  fullscreenOverlay.classList.add('hidden');
  fullscreenImage.src = '';
  unlockScroll();
}

// Открытие полноэкранного режима из превью (с навигацией по изображениям)
function openFullscreenFromPreview(src) {
  fullscreenImage.src = src;
  fullscreenOverlay.classList.remove('hidden');
  lockScroll();
}

function lockScroll() {
  if (!document.body) return;
  scrollLockY = window.scrollY || window.pageYOffset || 0;
  document.body.classList.add('no-scroll');
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollLockY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockScroll() {
  if (!document.body) return;
  document.body.classList.remove('no-scroll');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, scrollLockY || 0);
}

// Функция для показа полного изображения при наведении
function showHoverImage(src) {
  // Создаем элемент для показа изображения при наведении
  if (!hoveredImage) {
    hoveredImage = document.createElement('div');
    hoveredImage.id = 'hoverImage';
    hoveredImage.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9998;
      pointer-events: none;
      border: 2px solid rgba(255, 255, 255, 0.8);
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
      max-width: 95vw;
      max-height: 95vh;
      min-width: 400px;
      min-height: 300px;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    const img = document.createElement('img');
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    `;
    hoveredImage.appendChild(img);
    document.body.appendChild(hoveredImage);
  }
  
  const img = hoveredImage.querySelector('img');
  // Ждём полной загрузки изображения, затем показываем плавно
  hoveredImage.style.display = 'block';
  hoveredImage.style.opacity = '0';
  const onLoad = () => {
    hoveredImage.style.opacity = '1';
    img.removeEventListener('load', onLoad);
    img.removeEventListener('error', onError);
  };
  const onError = () => {
    hoveredImage.style.opacity = '0';
    img.removeEventListener('load', onLoad);
    img.removeEventListener('error', onError);
  };
  img.addEventListener('load', onLoad);
  img.addEventListener('error', onError);
  img.src = src + '?v=' + Date.now();
}

// Функция для скрытия изображения при наведении
function hideHoverImage() {
  if (hoveredImage) {
    hoveredImage.style.opacity = '0';
    setTimeout(() => {
      if (hoveredImage) {
        hoveredImage.style.display = 'none';
        // Сбрасываем src чтобы освободить память
        const img = hoveredImage.querySelector('img');
        if (img) {
          img.src = '';
        }
      }
    }, 300);
  }
}

sliderContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('slide')) {
    openFullscreen(e.target.src);
  }
});

closeFullscreenBtn.addEventListener('click', closeFullscreen);

document.addEventListener('keydown', (e) => {
  if (fullscreenOverlay.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeFullscreen();
  if (e.key === 'ArrowLeft') {
    const newIndex = (currentSlide - 1 + images.length) % images.length;
    showSlide(newIndex);
    fullscreenImage.src = images[newIndex];
  }
  if (e.key === 'ArrowRight') {
    const newIndex = (currentSlide + 1) % images.length;
    showSlide(newIndex);
    fullscreenImage.src = images[newIndex];
  }
});

fullscreenOverlay.addEventListener('click', (e) => {
  if (e.target === fullscreenOverlay) {
    closeFullscreen();
  }
});

function initGallery() {
  const prevBtn = document.querySelector('.prev');
  const nextBtn = document.querySelector('.next');

  prevBtn.addEventListener('click', () => {
    showSlide((currentSlide - 1 + images.length) % images.length);
  });

  nextBtn.addEventListener('click', () => {
    showSlide((currentSlide + 1) % images.length);
  });

  thumbnailsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('thumbnail')) {
      const index = parseInt(e.target.dataset.index, 10);
      showSlide(index);
    }
  });

  // Прокрутка колесом
  thumbnailsContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    thumbnailsContainer.scrollLeft += e.deltaY;
  });

  // Добавляем обработчик клика на ссылку галереи для переключения режимов
  addGalleryToggleHandler();

  showSlide(0);
}

// Функция для добавления обработчика клика на ссылку галереи
function addGalleryToggleHandler() {
  const galleryLink = document.getElementById('nav-gallery');
  const modeCheckbox = document.getElementById('modeToggle');
  
  if (galleryLink) {
    // Клик по ссылке — не навигируем, но переключаем только при клике на свободную область, не на чекбокс
    galleryLink.addEventListener('click', (e) => {
      const target = e.target;
      if (target && (target.id === 'modeToggle' || target.classList.contains('mode-toggle__switch'))) {
        // чекбокс сам управляет состоянием
        return;
      }
      e.preventDefault();
      toggleViewMode();
      if (modeCheckbox) modeCheckbox.checked = isPreviewMode;
    });
    
  } else {
    
  }

  // Инициализация и обработчик чекбокса
  if (document.body && document.body.getAttribute('data-page') === 'gallery') {
    if (modeCheckbox) {
      try {
        const saved = localStorage.getItem('isPreviewMode');
        if (saved === '1' && !isPreviewMode) toggleViewMode();
      } catch(_) {}
      modeCheckbox.checked = isPreviewMode;
      modeCheckbox.addEventListener('change', function() {
        const wantPreview = !!modeCheckbox.checked;
        if (wantPreview !== isPreviewMode) toggleViewMode();
      });
    }
  }
}

// Функция переключения между слайдером и превью
function toggleViewMode() {
  // Очищаем таймаут и скрываем изображение при наведении
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
  hideHoverImage();
  
  isPreviewMode = !isPreviewMode;
  const slider = document.querySelector('.slider');
  const thumbnails = document.querySelector('.thumbnails');
  
  if (isPreviewMode) {
    // Переключаемся в режим превью
    slider.style.display = 'none';
    thumbnails.style.display = 'none';
    createPreviewGrid();
  } else {
    // Переключаемся в режим слайдера
    removePreviewGrid();
    slider.style.display = 'block';
    thumbnails.style.display = 'flex';
  }

  // сохраняем состояние
  try { localStorage.setItem('isPreviewMode', isPreviewMode ? '1' : '0'); } catch(_) {}

  // синхронизируем UI переключателя, если он есть
  const modeCheckbox = document.getElementById('modeToggle');
  if (modeCheckbox) {
    modeCheckbox.checked = isPreviewMode;
  }

  // Проставляем класс на body для CSS-правил (например, отступы в слайдере)
  if (document.body) {
    document.body.classList.toggle('preview-mode', isPreviewMode);
  }
}

// Функция создания сетки превью
function createPreviewGrid() {
  // Создаем контейнер для превью
  const previewContainer = document.createElement('div');
  previewContainer.id = 'previewContainer';
  previewContainer.className = 'preview-container';
  
  
  // Создаем сетку изображений
  const previewGrid = document.createElement('div');
  previewGrid.className = 'preview-grid';
  
  // Загружаем превью постепенно для быстродействия
  loadPreviewImages(previewGrid, imageFiles);
  
  previewContainer.appendChild(previewGrid);
  
  // Вставляем после слайдера
  const slider = document.querySelector('.slider');
  slider.parentNode.insertBefore(previewContainer, slider.nextSibling);
}

// Функция для загрузки превью изображений с низким качеством
function loadPreviewImages(previewGrid, imageFiles) {
  const batchSize = PREVIEW_SETTINGS.batchSize;
  let currentIndex = 0;
  
  function loadBatch() {
    const endIndex = Math.min(currentIndex + batchSize, images.length);
    
    for (let i = currentIndex; i < endIndex; i++) {
      const previewItem = document.createElement('div');
      previewItem.className = 'preview-item';
      previewItem.dataset.index = i;
      
      // Создаем canvas для низкокачественного превью
      const canvas = document.createElement('canvas');
      canvas.className = 'preview-canvas';
      // логические размеры канваса для рендера, визуально масштабируется через CSS
      canvas.width = PREVIEW_SETTINGS.width;
      canvas.height = PREVIEW_SETTINGS.height;

      // Точная рамка поверх отрисованной области картинки
      const border = document.createElement('div');
      border.className = 'preview-border';
      
      const label = document.createElement('div');
      label.className = 'preview-label';
      const imageData = imageFiles[i];
      label.textContent = imageData ? imageData.description : `Screenshot ${i + 1}`;
      // уважаем настройку показа текста
      label.style.display = showPreviewText ? 'block' : 'none';
      
      previewItem.appendChild(canvas);
      previewItem.appendChild(border);
      previewItem.appendChild(label);
      previewGrid.appendChild(previewItem);
      
      // Обработчик клика: в превью открываем собственный fullscreen, не переключая режим
      previewItem.addEventListener('click', () => {
        currentSlide = i;
        openFullscreenFromPreview(images[i]);
      });
      
      // Обработчики для показа полного изображения при наведении
      previewItem.addEventListener('mouseenter', () => {
        // Очищаем предыдущий таймаут если есть
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
        }
        
        // Устанавливаем новый таймаут на 0.5 секунды
        hoverTimeout = setTimeout(() => {
          showHoverImage(images[i]);
        }, 500);
      });
      
      previewItem.addEventListener('mouseleave', () => {
        // Очищаем таймаут при уходе мыши
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
        
        // Скрываем изображение
        hideHoverImage();
      });
      
      // Загружаем изображение в фоне и создаем превью
      loadLowQualityPreview(images[i], canvas, border);
    }
    
    currentIndex = endIndex;
    
    // Загружаем следующий батч с небольшой задержкой
    if (currentIndex < images.length) {
      setTimeout(loadBatch, 50);
    }
  }
  
  loadBatch();
}

// Функция для создания низкокачественного превью
function loadLowQualityPreview(src, canvas, borderEl) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  
  img.onload = function() {
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    // Настраиваем качество рендеринга
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low'; // 'low', 'medium', 'high'

    // Очищаем и заполняем фон как у слайдера (чёрный) и рисуем с сохранением пропорций (contain)
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);

    const scale = Math.min(cw / iw, ch / ih);
    const drawW = Math.max(1, Math.floor(iw * scale));
    const drawH = Math.max(1, Math.floor(ih * scale));
    const dx = Math.floor((cw - drawW) / 2);
    const dy = Math.floor((ch - drawH) / 2);
    ctx.drawImage(img, 0, 0, iw, ih, dx, dy, drawW, drawH);

    // если есть элемент рамки, позиционируем его точно по изображению
    if (borderEl && canvas.parentElement) {
      // позиционируем рамку строго по области изображения с учётом толщины рамки
      const borderPx = 2; // столько же, как в CSS
      const leftPct = ((dx + borderPx) / cw) * 100;
      const topPct = ((dy + borderPx) / ch) * 100;
      const widthPct = ((drawW - borderPx * 2) / cw) * 100;
      const heightPct = ((drawH - borderPx * 2) / ch) * 100;
      borderEl.style.left = leftPct + '%';
      borderEl.style.top = topPct + '%';
      borderEl.style.width = Math.max(0, widthPct) + '%';
      borderEl.style.height = Math.max(0, heightPct) + '%';

      // показываем рамку только при ховере карточки
      canvas.parentElement.addEventListener('mouseenter', function() {
        borderEl.style.display = 'block';
      });
      canvas.parentElement.addEventListener('mouseleave', function() {
        borderEl.style.display = 'none';
      });
    }
    
    // Добавляем эффект размытия если настроено
    if (PREVIEW_SETTINGS.blur > 0) {
      ctx.filter = `blur(${PREVIEW_SETTINGS.blur}px)`;
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';
    }
    
    // Дополнительное снижение качества через пикселизацию
    if (PREVIEW_SETTINGS.quality < 1.0) {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      const scale = PREVIEW_SETTINGS.quality;
      
      tempCanvas.width = cw * scale;
      tempCanvas.height = ch * scale;
      
      tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(tempCanvas, 0, 0, cw, ch);
    }
  };
  
  img.onerror = function() {
    // Если изображение не загрузилось, рисуем заглушку
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('?', canvas.width / 2, canvas.height / 2);
  };
  
  img.src = src;
}

// Функция удаления сетки превью
function removePreviewGrid() {
  // Очищаем таймаут и скрываем изображение при наведении
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
  hideHoverImage();
  
  const previewContainer = document.getElementById('previewContainer');
  if (previewContainer) {
    previewContainer.remove();
  }
}

const fullscreenPrev = document.getElementById('fullscreenPrev');
const fullscreenNext = document.getElementById('fullscreenNext');

fullscreenPrev.addEventListener('click', () => {
  const newIndex = (currentSlide - 1 + images.length) % images.length;
  showSlide(newIndex);
  fullscreenImage.src = images[newIndex];
});

fullscreenNext.addEventListener('click', () => {
  const newIndex = (currentSlide + 1) % images.length;
  showSlide(newIndex);
  fullscreenImage.src = images[newIndex];
});

// Очистка при закрытии страницы
window.addEventListener('beforeunload', () => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
  }
  hideHoverImage();
});

// Загружаем изображения при инициализации
// инициализируем флаг показа текста из localStorage и query
(function initPreviewTextFlag(){
  try {
    const params = new URLSearchParams(location.search);
    if (params.has('previewText')) {
      showPreviewText = params.get('previewText') === '1' || params.get('previewText') === 'true';
      localStorage.setItem('showPreviewText', showPreviewText ? '1' : '0');
    } else {
      const saved = localStorage.getItem('showPreviewText');
      showPreviewText = saved === '1';
    }
  } catch (_) {}
})();

// хоткей: T — переключение текста в превью
document.addEventListener('keydown', (e) => {
  if (isPreviewMode && (e.key === 't' || e.key === 'T')) {
    showPreviewText = !showPreviewText;
    try { localStorage.setItem('showPreviewText', showPreviewText ? '1' : '0'); } catch(_) {}
    const labels = document.querySelectorAll('.preview-label');
    labels.forEach(function(label){
      label.style.display = showPreviewText ? 'block' : 'none';
    });
  }
});

loadImages();
