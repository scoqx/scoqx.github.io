const thumbnailsContainer = document.querySelector('.thumbnails');
const sliderContainer = document.querySelector('.slider');

let currentSlide = 0;
const images = [];

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

  // Автоскролл миниатюр к активному элементу
  scrollToThumbnail(index);
}


function addImage(src, index) {
  // Миниатюра
  const thumb = document.createElement('img');
  thumb.src = src;
  thumb.className = 'thumbnail';
  if (index === 0) thumb.classList.add('active');
  thumb.dataset.index = index;
  thumbnailsContainer.appendChild(thumb);

  // Слайд
  const slide = document.createElement('img');
  slide.src = src;
  slide.className = 'slide';
  if (index === 0) slide.classList.add('active');
  sliderContainer.insertBefore(slide, sliderContainer.querySelector('.prev'));
}

let initialized = false;

function loadImages(start = 1) {
  let index = start;

  function tryLoad() {
    const src = `images/${index}.jpg`;
    const img = new Image();

    img.onload = () => {
      images.push(src);
      addImage(src, images.length - 1);

      if (!initialized) {
        initGallery();
        initialized = true;
      }

      index++;
      tryLoad();
    };

    img.onerror = () => {
    };

    img.src = src;
  }

  tryLoad();
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

  // Вот сюда добавляем прокрутку колесом
  thumbnailsContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    thumbnailsContainer.scrollLeft += e.deltaY;
  });

  showSlide(0);
}

thumbnailsContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('thumbnail')) {
    const index = parseInt(e.target.dataset.index, 10);
    showSlide(index);

    // Автоскролл миниатюр
    const thumbnails = thumbnailsContainer.querySelectorAll('.thumbnail');
    const thumbCount = thumbnails.length;

    const visibleThreshold = thumbCount - 4; // если индекс >= этого, прокручиваем заранее

    if (index >= visibleThreshold) {
      // Сдвигаем так, чтобы выбранная миниатюра была видна и немного смещена влево
      const thumb = thumbnails[index];
      const containerRect = thumbnailsContainer.getBoundingClientRect();
      const thumbRect = thumb.getBoundingClientRect();

      // Текущий сдвиг прокрутки
      const currentScroll = thumbnailsContainer.scrollLeft;

      // Считаем сколько пикселей нужно проскроллить, чтобы миниатюра была ближе к началу видимой области (с запасом)
      const offset = (thumbRect.right - containerRect.right) + thumbRect.width * 2;

      if (offset > 0) {
        thumbnailsContainer.scrollBy({ left: offset, behavior: 'smooth' });
      }
    } else {
      // Если индекс меньше, можно прокрутить к самой миниатюре по центру (необязательно)
      const thumb = thumbnails[index];
      thumbnailsContainer.scrollBy({
        left: thumb.offsetLeft - thumbnailsContainer.scrollLeft - thumbnailsContainer.clientWidth / 2 + thumb.clientWidth / 2,
        behavior: 'smooth'
      });
    }
  }
});

loadImages(1);
