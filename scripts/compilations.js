document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('compilationsGrid');
  if (!grid) return;

  // Pre-filled card: Quake 3 n8mare
  const n8mareImages = Array.from({ length: 12 }, (_, i) => `/images/n8mare/${i + 1}.jpg`);
  const compilations = [
    {
      title: 'Quake 3 n8mare',
      author: 'Mirage',
      link: 'https://mjrage.github.io/download',
      description: `With this Quake 3 build, you will be able to improve your gaming experience up to a new level. This build contains several key elements that make the game even better.
      <ul>
        <li>This Quake 3 build has best response based on the tuned config.</li>
        <li>The build uses the updated \"quake3e\" engine, which allows you to achieve smooth and stable gameplay.</li>
      </ul>`,
      images: n8mareImages
    },
    {
      title: 'Quake III Arena Remastered 1.32e - [Runo] Edition',
      author: '[Runo]',
      authorHref: 'https://t.me/abyss_wanderer1708',
      link: 'https://www.moddb.com/mods/quake-iii-arena-remastered-runo-edition/downloads/quake-iii-arena-v132e-runo-edition',
      description: `Quake III Arena Remastered by [Runo]. This Compilations contains High Resolution Textures, HD Models, Effects, 2D Elements, custom Sounds and made basically for players, who likes High Quality Graphics, Sounds and Effects in Quake III Arena. Author made it based on his personal taste.`,
      images: (function(){
        const jpgs = Array.from({ length: 30 }, (_, i) => `/images/runo/${i + 1}.jpg`);
        const pngs = Array.from({ length: 30 }, (_, i) => `/images/runo/${i + 1}.png`);
        return [...jpgs, ...pngs];
      })()
    }
  ];

  // Helpers: filter only existing images
  function checkImageExists(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  function parsePathInfo(src) {
    // returns { group: '/images/runo/.png', index: 5 } for '/images/runo/5.png'
    const m = src.match(/^(.*\/)\s*(\d+)\.(\w+)$/);
    if (!m) return { group: null, index: null };
    const dir = m[1];
    const idx = parseInt(m[2], 10);
    const ext = m[3].toLowerCase();
    return { group: `${dir}.${ext}`, index: isNaN(idx) ? null : idx };
  }

  async function filterExistingImages(srcs) {
    const kept = [];
    let currentGroup = null;
    let expectedIndex = 1;
    const skippedGroups = new Set();

    for (const s of srcs) {
      const info = parsePathInfo(s);
      const group = info.group;
      const index = info.index;

      if (group) {
        if (skippedGroups.has(group)) continue; // уже знаем что дальше нет файлов
        if (group !== currentGroup) {
          currentGroup = group;
          expectedIndex = 1;
        }
        // если индекс не распознан — просто проверим единично
        if (index == null) {
          if (await checkImageExists(s)) kept.push(s);
          continue;
        }
        // синхронизируем ожидаемый индекс, если последовательность начинается не с 1
        if (expectedIndex !== index) expectedIndex = index;

        const ok = await checkImageExists(s);
        if (ok) {
          kept.push(s);
          expectedIndex++;
        } else {
          // первый пробел в последовательности — больше не проверяем этот group
          skippedGroups.add(group);
        }
      } else {
        // без распознанной группы — просто проверяем
        if (await checkImageExists(s)) kept.push(s);
      }
    }
    return kept;
  }

  const normalized = [];
  for (const c of compilations) {
    const existing = await filterExistingImages(Array.isArray(c.images) ? c.images : []);
    normalized.push({ ...c, images: existing });
  }

  // Shuffle order on every load
  normalized.sort(() => Math.random() - 0.5);

  // Сразу показываем карточки без ожидания загрузки изображений
  grid.innerHTML = normalized.map(renderCard).join('');
  const cards = grid.querySelectorAll('.compilation-card');
  cards.forEach(card => {
    card.style.opacity = '1';
    card.style.transition = 'opacity 0.3s ease';
  });

  // Generate low-quality previews in background without blocking UI
  (function generateLowQualityPreviews(){
    const thumbs = Array.from(grid.querySelectorAll('.card-images img'));
    let currentIndex = 0;
    
    function loadNextThumbnail() {
      if (currentIndex >= thumbs.length) return;
      
      const imgEl = thumbs[currentIndex];
      const fullSrc = imgEl.getAttribute('data-fullsrc') || imgEl.src;
      if (!fullSrc) {
        currentIndex++;
        setTimeout(loadNextThumbnail, 0);
        return;
      }
      
      // ensure we store original
      imgEl.setAttribute('data-fullsrc', fullSrc);
      // Загружаем превью в фоне, не блокируя UI
      makeLowQualityPreview(fullSrc, imgEl, 120, 0.5, () => {
        // Просто обновляем изображение, карточка уже видна
      });
      
      currentIndex++;
      // Load next thumbnail after a short delay to prevent blocking
      setTimeout(loadNextThumbnail, 20);
    }
    
    // Start loading thumbnails
    loadNextThumbnail();
  })();

  // Wire fullscreen openers for card images
  grid.addEventListener('click', (e) => {
    const img = e.target.closest('.card-images img');
    if (img) {
      const full = img.getAttribute('data-fullsrc') || img.src;
      openFullscreen(full);
    }
  });

  // Fullscreen controls
  const fullscreenOverlay = document.getElementById('fullscreenOverlay');
  const fullscreenImage = document.getElementById('fullscreenImage');
  const closeFullscreenBtn = document.getElementById('closeFullscreen');
  const fullscreenPrev = document.getElementById('fullscreenPrev');
  const fullscreenNext = document.getElementById('fullscreenNext');

  function openFullscreen(src) {
    fullscreenImage.src = src;
    fullscreenOverlay.classList.remove('hidden');
    // lock scroll like gallery
    document.body.classList.add('no-scroll');
    // ensure overlay can receive focus and keyboard events
    if (!fullscreenOverlay.hasAttribute('tabindex')) {
      fullscreenOverlay.setAttribute('tabindex', '-1');
    }
    try { fullscreenOverlay.focus(); } catch(_) {}
  }

  function closeFullscreen() {
    fullscreenOverlay.classList.add('hidden');
    fullscreenImage.src = '';
    document.body.classList.remove('no-scroll');
  }

  if (closeFullscreenBtn) closeFullscreenBtn.addEventListener('click', closeFullscreen);
  const onKeyDown = (e) => {
    if (fullscreenOverlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeFullscreen();
    if (e.key === 'ArrowLeft') {
      const { list, index, srcOf } = getCurrentImagesList();
      if (!list || index < 0) return;
      const nextIndex = (index - 1 + list.length) % list.length;
      fullscreenImage.src = srcOf(list[nextIndex]);
      e.preventDefault();
    }
    if (e.key === 'ArrowRight') {
      const { list, index, srcOf } = getCurrentImagesList();
      if (!list || index < 0) return;
      const nextIndex = (index + 1) % list.length;
      fullscreenImage.src = srcOf(list[nextIndex]);
      e.preventDefault();
    }
  };
  // Listen on both document and window to be safe
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keydown', onKeyDown, true);
  if (fullscreenOverlay) fullscreenOverlay.addEventListener('click', (e) => {
    if (e.target === fullscreenOverlay) closeFullscreen();
  });
  // Prev/Next just cycle images within the current card
  function normalizeSrc(u) {
    try { return new URL(u, window.location.origin).pathname; } catch(_) { return u; }
  }

  function getCurrentImagesList() {
    const currentSrcNorm = normalizeSrc(fullscreenImage.src);
    const allImgs = Array.from(grid.querySelectorAll('.card-images img'));
    const srcOf = (el) => normalizeSrc(el.getAttribute('data-fullsrc') || el.src);
    const currentImgEl = allImgs.find(n => srcOf(n) === currentSrcNorm);
    if (!currentImgEl) return { list: allImgs, index: allImgs.findIndex(n => srcOf(n) === currentSrcNorm), srcOf };
    const card = currentImgEl.closest('.compilation-card');
    const list = Array.from(card.querySelectorAll('.card-images img'));
    const index = list.findIndex(n => srcOf(n) === currentSrcNorm);
    return { list, index, srcOf };
  }
  if (fullscreenPrev) fullscreenPrev.addEventListener('click', () => {
    const { list, index, srcOf } = getCurrentImagesList();
    if (!list || index < 0) return;
    const nextIndex = (index - 1 + list.length) % list.length;
    fullscreenImage.src = srcOf(list[nextIndex]);
  });
  if (fullscreenNext) fullscreenNext.addEventListener('click', () => {
    const { list, index, srcOf } = getCurrentImagesList();
    if (!list || index < 0) return;
    const nextIndex = (index + 1) % list.length;
    fullscreenImage.src = srcOf(list[nextIndex]);
  });

  // Hover preview like gallery preview
  let hoverTimeout = null;
  let hoveredImage = null;

  function ensureHoverElement() {
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
        transition: opacity 0.2s ease;
        background: rgba(0,0,0,0.85);
      `;
      const img = document.createElement('img');
      img.style.cssText = `width:100%;height:100%;object-fit:contain;display:block;`;
      hoveredImage.appendChild(img);
      document.body.appendChild(hoveredImage);
    }
  }

  function showHoverImage(src) {
    ensureHoverElement();
    const img = hoveredImage.querySelector('img');
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
    img.src = src;
  }

  function hideHoverImage() {
    if (!hoveredImage) return;
    hoveredImage.style.opacity = '0';
    setTimeout(() => {
      if (hoveredImage) {
        hoveredImage.style.display = 'none';
        const img = hoveredImage.querySelector('img');
        if (img) img.src = '';
      }
    }, 200);
  }

  // Delegated hover handlers for images
  grid.addEventListener('mouseenter', (e) => {
    const wrap = e.target.closest('.img-wrap');
    if (!wrap) return;
    if (hoverTimeout) clearTimeout(hoverTimeout);
    const img = wrap.querySelector('img');
    if (!img) return;
    const fullSrc = img.getAttribute('data-fullsrc') || img.src;
    hoverTimeout = setTimeout(() => showHoverImage(fullSrc), 400);
  }, true);

  grid.addEventListener('mouseleave', (e) => {
    const wrap = e.target.closest('.img-wrap');
    if (!wrap) return;
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    hideHoverImage();
  }, true);
});

function renderCard(item) {
  const many = (item.images || []).length > 6;
  const imgs = (item.images || []).map(src => `
    <div class="img-wrap"><img data-fullsrc="${src}" alt="${item.title}" /><div class="img-border"></div></div>
  `).join('');
  const imagesBlock = `<div class="card-images">${imgs}</div>`;

  const cardHtml = `
  <article class="compilation-card">
    <div class="card-header">
      <h3 class="card-title"><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a></h3>
      <div class="card-meta">
        <span class="card-author">${item.authorHref ? `<a href="${item.authorHref}" target="_blank" rel="noopener noreferrer">${item.author}</a>` : item.author}</span>
      </div>
    </div>
    <div class="card-description">${item.description || ''}</div>
    ${imagesBlock}
  </article>`;

  // Wheel -> horizontal scroll for image rows (like gallery)
  setTimeout(() => {
    const rows = document.querySelectorAll('.compilation-card .card-images');
    rows.forEach((row) => {
      row.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          row.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    });
  }, 0);

  return cardHtml;
}

// Create a low-quality preview using canvas and assign to the target <img>
function makeLowQualityPreview(src, targetImgEl, targetHeight = 120, quality = 0.3, callback) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    
    // Более агрессивное сжатие для мобильных
    const scale = targetHeight / ih;
    const tw = Math.max(1, Math.floor(iw * scale));
    const th = Math.max(1, Math.floor(targetHeight));
    
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    
    // Настройки для быстрого рендеринга
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.clearRect(0, 0, tw, th);
    ctx.drawImage(img, 0, 0, iw, ih, 0, 0, tw, th);
    
    try {
      // Более низкое качество для быстрой загрузки
      const dataUrl = canvas.toDataURL('image/jpeg', Math.max(0.1, Math.min(quality, 0.5)));
      targetImgEl.src = dataUrl;
      if (callback) callback();
    } catch (_) {
      // Fallback: use original if toDataURL fails
      targetImgEl.src = src;
      if (callback) callback();
    }
  };
  img.onerror = function() {
    // On error, use original src as fallback
    targetImgEl.src = src;
    if (callback) callback();
  };
  img.src = src;
}


