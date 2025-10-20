const thumbnailsContainer = document.querySelector('.thumbnails');
const sliderContainer = document.querySelector('.slider');

let currentSlide = 0;
const images = [];
let galleryConfig = null;

// Загружаем конфигурацию галереи
async function loadGalleryConfig() {
  try {
    const response = await fetch('gallery-config.json');
    if (response.ok) {
      galleryConfig = await response.json();
      console.log('Конфигурация галереи загружена:', galleryConfig);
    }
  } catch (error) {
    console.log('Конфигурация не найдена, используем автосканирование');
  }
}

// Сканирование папки с изображениями
async function scanImagesFolder() {
  const imageFiles = [];
  const supportedFormats = galleryConfig?.settings?.supportedFormats || ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  
  // Если есть конфигурация, используем её
  if (galleryConfig && galleryConfig.images) {
    return galleryConfig.images.map(img => ({
      src: img.src,
      title: img.title || '',
      description: img.description || '',
      order: img.order || 0
    })).sort((a, b) => a.order - b.order);
  }
  
  // Автосканирование
  for (let i = 1; i <= (galleryConfig?.settings?.maxImages || 999); i++) {
    for (const format of supportedFormats) {
      const src = `images/${i}.${format}`;
      const exists = await checkImageExists(src);
      if (exists) {
        imageFiles.push({
          src: src,
          title: `Image ${i}`,
          description: '',
          order: i
        });
        break;
      }
    }
  }
  
  return imageFiles;
}

// Проверка существования изображения
function checkImageExists(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
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

  if (slides.length === 0) return;

  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === index);
  });

  thumbnails.forEach((thumb, i) => {
    thumb.classList.toggle('active', i === index);
  });

  currentSlide = index;
  scrollToThumbnail(index);
}

function addImage(imageData, index) {
  // Миниатюра
  const thumb = document.createElement('img');
  thumb.src = imageData.src;
  thumb.className = 'thumbnail';
  thumb.alt = imageData.title || `Image ${index + 1}`;
  thumb.title = imageData.description || imageData.title || `Image ${index + 1}`;
  if (index === 0) thumb.classList.add('active');
  thumb.dataset.index = index;
  thumbnailsContainer.appendChild(thumb);

  // Слайд
  const slide = document.createElement('img');
  slide.src = imageData.src;
  slide.className = 'slide';
  slide.alt = imageData.title || `Image ${index + 1}`;
  slide.title = imageData.description || imageData.title || `Image ${index + 1}`;
  if (index === 0) slide.classList.add('active');
  sliderContainer.insertBefore(slide, sliderContainer.querySelector('.prev'));
}

let initialized = false;

async function loadImages() {
  try {
    console.log('Загрузка конфигурации галереи...');
    await loadGalleryConfig();
    
    console.log('Сканирование папки images...');
    const imageFiles = await scanImagesFolder();
    
    if (imageFiles.length === 0) {
      console.log('Изображения не найдены в папке images/');
      return;
    }
    
    console.log(`Найдено ${imageFiles.length} изображений:`, imageFiles);
    
    // Добавляем все найденные изображения
    imageFiles.forEach((imageData, index) => {
      images.push(imageData.src);
      addImage(imageData, index);
    });
    
    if (!initialized) {
      initGallery();
      initialized = true;
    }
    
  } catch (error) {
    console.error('Ошибка при загрузке изображений:', error);
  }
}

const fullscreenOverlay = document.getElementById('fullscreenOverlay');
const fullscreenImage = document.getElementById('fullscreenImage');
const closeFullscreenBtn = document.getElementById('closeFullscreen');

function openFullscreen(src) {
  fullscreenImage.src = src;
  fullscreenOverlay.classList.remove('hidden');
}

function closeFullscreen() {
  fullscreenOverlay.classList.add('hidden');
  fullscreenImage.src = '';
}

sliderContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('slide')) {
    openFullscreen(e.target.src);
  }
});

closeFullscreenBtn.addEventListener('click', closeFullscreen);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !fullscreenOverlay.classList.contains('hidden')) {
    closeFullscreen();
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

  showSlide(0);
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

// Загружаем изображения при инициализации
loadImages();


