const thumbnailsContainer = document.querySelector('.thumbnails');
const sliderContainer = document.querySelector('.slider');

let currentSlide = 0;
const images = [];

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

  showSlide(0);
}

loadImages(1);
