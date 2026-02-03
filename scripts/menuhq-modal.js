// MenuHQ Maker Modal — image split into 4 or 24 parts -> pk3 (Quake menu collage).
// Logic 1:1 from OSP2BE_MenuHQ_Maker.cpp, implemented in JS.

(function() {
    'use strict';

    const MAX_SIDE_MODE1 = 2048;   // Mode 1: 4 parts (2x2)
    const MAX_WIDTH_MODE2 = 6144;  // Mode 2: 24 parts (4 rows x 6 cols)
    const MAX_HEIGHT_MODE2 = 4096;
    const TEX_DIR = 'textures/sfx';
    const SHADER_PATH_MODE1 = 'scripts/menu_HQ.shader';
    const SHADER_PATH_MODE2 = 'scripts/menuHQ.shader';

    function getLanguage() {
        return window.location.pathname.includes('/ru/') ? 'ru' : 'en';
    }

    function getMenuHQToolHTML(lang) {
        const isRu = lang === 'ru';
        return `
<style>
  .menuhq-tool-root { color-scheme: dark; --black:#000; --white:#fff; --accent:#8A2BE2; }
  .menuhq-tool-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .menuhq-tool-root { background: var(--black); color: var(--white); font-family: system-ui, sans-serif; }
  .menuhq-tool-app { width: 100%; max-width: 900px; border-radius: 18px; padding: 0 20px 16px; }
  .menuhq-tool-app h1 { font-size: 1.25rem; text-transform: uppercase; letter-spacing: .12em; margin-bottom: 4px; }
  .menuhq-tool-app h1 span { color: var(--accent); }
  .menuhq-tool-app .subtitle { font-size: .8rem; color: rgba(255,255,255,0.7); margin-bottom: 12px; }
  .menuhq-tool-app .menuhq-small-warning { display: none; margin-bottom: 12px; padding: 8px 0; font-size: .85rem; color: #f44; line-height: 1.4; }
  .menuhq-tool-app .layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(220px, 1fr); gap: 14px; }
  @media (max-width: 700px) { .menuhq-tool-app .layout { grid-template-columns: 1fr; } }
  .menuhq-tool-app #menuhqDropzone {
    position: relative; min-height: 280px; border-radius: 16px;
    border: 1px dashed rgba(255,255,255,0.25); background: var(--black);
    display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer;
  }
  .menuhq-tool-app #menuhqDropzone.dragover { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .menuhq-tool-app #menuhqPreviewCanvas { max-width: 100%; max-height: 100%; display: block; }
  .menuhq-tool-app .menuhq-drop-hint {
    position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 4px; pointer-events: none; text-align: center; font-size: .82rem; color: rgba(255,255,255,0.7);
    background: radial-gradient(circle, rgba(0,0,0,0.4), rgba(0,0,0,0.9));
  }
  .menuhq-tool-app .menuhq-drop-hint strong { color: var(--white); font-size: .9rem; }
  .menuhq-tool-app .menuhq-controls {
    background: var(--black); border-radius: 16px; border: 1px solid rgba(255,255,255,0.25);
    padding: 12px; font-size: .85rem; display: flex; flex-direction: column; gap: 10px;
  }
  .menuhq-tool-app .menuhq-controls label { display: block; margin-bottom: 2px; font-size: .8rem; }
  .menuhq-tool-app .menuhq-mode-group { display: flex; gap: 8px; margin-top: 2px; }
  .menuhq-tool-app .menuhq-mode-group label { display: flex; align-items: center; gap: 4px; margin: 0; }
  .menuhq-tool-app .menuhq-mode-group input[type=radio] { accent-color: var(--accent); }
  .menuhq-tool-app .menuhq-controls small { font-size: .72rem; color: rgba(255,255,255,0.6); }
  .menuhq-tool-app #menuhqBuildBtn {
    border-radius: 999px; border: 1px solid var(--accent); background: #000; color: #fff;
    padding: 8px 14px; font-size: .8rem; cursor: pointer; text-transform: uppercase; letter-spacing: .08em;
  }
  .menuhq-tool-app #menuhqBuildBtn:hover:not(:disabled) { background: var(--accent); }
  .menuhq-tool-app #menuhqBuildBtn:disabled { opacity: .45; cursor: not-allowed; }
  .menuhq-tool-app #menuhqStatus { margin-top: 8px; font-size: .78rem; color: rgba(255,255,255,0.75); white-space: pre-wrap; }
  .menuhq-tool-app .menuhq-title-row { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
  .menuhq-tool-app .menuhq-title-link { font-size: .85rem; font-weight: normal; color: rgba(255,255,255,0.7); text-decoration: none; }
  .menuhq-tool-app .menuhq-title-link:hover { color: var(--accent); text-decoration: underline; }
</style>

<div class="menuhq-tool-app">
  <div class="menuhq-title-row">
    <h1><span>MenuHQ</span> Maker</h1>
    <a href="https://github.com/scoqx/OSP2BE_MenuHQ_Maker" target="_blank" rel="noopener noreferrer" class="menuhq-title-link">Desktop Version</a>
  </div>
  <p class="subtitle">
    ${isRu ? 'Подготовка HD/4K фона меню для OSP2-BE — с автоматическим сжатием при необходимости' : 'HD/4K menu background for OSP2-BE — with automatic resizing when needed'}
  </p>
  <div id="menuhqSmallImageWarning" class="menuhq-small-warning" role="alert"></div>

  <div class="layout">
    <div id="menuhqDropzone" tabindex="0">
      <canvas id="menuhqPreviewCanvas"></canvas>
      <div class="menuhq-drop-hint" id="menuhqHint">
        <strong>${isRu ? 'Клик / Перетащить / Ctrl+V' : 'Click / Drop / Ctrl+V'}</strong>
        <div>${isRu ? 'Поддерживаются: JPG, PNG, TGA, WebP.' : 'Supported: JPG, PNG, TGA, WebP.'}</div>
      </div>
    </div>
    <div class="menuhq-controls">
      <div>
        <label>${isRu ? 'Режим' : 'Mode'}</label>
        <div class="menuhq-mode-group">
          <label><input type="radio" name="menuhqMode" value="1" checked> ${isRu ? '1 (HD) — 4 части' : '1 (HD) — 4 parts'}</label>
          <label><input type="radio" name="menuhqMode" value="2"> ${isRu ? '2 (4K+) — 24 части' : '2 (4K+) — 24 parts'}</label>
        </div>
        <small>${isRu ? 'HD: до 2048×2048. 4K+: до 6144×4096.' : 'HD: up to 2048×2048. 4K+: up to 6144×4096.'}</small>
      </div>
      <div>
        <button id="menuhqBuildBtn" type="button" disabled>${isRu ? 'Создать pk3' : 'Build pk3'}</button>
        <small style="display:block; margin-top:4px;">${isRu ? 'Создаёт zz-menuHQ-{имя}.pk3' : 'Creates zz-menuHQ-{name}.pk3'}</small>
      </div>
    </div>
  </div>
  <div id="menuhqStatus"></div>
</div>

<canvas id="menuhqWorkCanvas" style="display:none"></canvas>
`;
    }

    const menuhqToolJS = `
(function() {
  const MAX_SIDE_MODE1 = ${MAX_SIDE_MODE1};
  const MAX_WIDTH_MODE2 = ${MAX_WIDTH_MODE2};
  const MAX_HEIGHT_MODE2 = ${MAX_HEIGHT_MODE2};
  const PREVIEW_MAX_SIDE = 2048;
  const TEX_DIR = '${TEX_DIR}';
  const SHADER_PATH_MODE1 = '${SHADER_PATH_MODE1}';
  const SHADER_PATH_MODE2 = '${SHADER_PATH_MODE2}';

  function getLanguage() {
    return window.location.pathname.indexOf('/ru/') >= 0 ? 'ru' : 'en';
  }

  const dropzone = document.getElementById('menuhqDropzone');
  const hint = document.getElementById('menuhqHint');
  const previewCanvas = document.getElementById('menuhqPreviewCanvas');
  const previewCtx = previewCanvas.getContext('2d');
  const workCanvas = document.getElementById('menuhqWorkCanvas');
  const workCtx = workCanvas.getContext('2d');
  const buildBtn = document.getElementById('menuhqBuildBtn');
  const statusEl = document.getElementById('menuhqStatus');
  const previewWorkCanvas = document.createElement('canvas');
  const previewWorkCtx = previewWorkCanvas.getContext('2d');

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.tga,.webp';

  let currentImage = null;
  let currentFileName = '';
  let currentFileExt = '.png';

  function getMode() {
    const r = document.querySelector('input[name="menuhqMode"]:checked');
    return r ? parseInt(r.value, 10) : 1;
  }

  function getExt(path) {
    const i = path.lastIndexOf('.');
    if (i < 0) return '';
    return path.slice(i).toLowerCase();
  }

  function getOutputFormat(ext) {
    if (ext === '.jpg' || ext === '.jpeg') return { mime: 'image/jpeg', ext: '.jpg', quality: 0.95 };
    if (ext === '.png') return { mime: 'image/png', ext: '.png', quality: 1 };
    if (ext === '.webp') return { mime: 'image/webp', ext: '.webp', quality: 0.95 };
    return { mime: 'image/png', ext: '.png', quality: 1 };
  }

  function baseNameNoExt(path) {
    const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\\\'));
    const base = slash >= 0 ? path.slice(slash + 1) : path;
    const dot = base.lastIndexOf('.');
    return dot >= 0 ? base.slice(0, dot) : base;
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f) loadImage(f);
  });

  dropzone.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  });

  const menuhqModal = document.getElementById('menuhqModal');
  if (menuhqModal) {
    menuhqModal.addEventListener('paste', e => {
      if (!menuhqModal.classList.contains('active')) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            loadImage(file);
            e.preventDefault();
            break;
          }
        }
      }
    });
  }

  function loadImage(file) {
    const lang = getLanguage();
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      currentFileName = file.name || 'image';
      currentFileExt = getExt(currentFileName) || '.png';
      const fmt = getOutputFormat(currentFileExt);
      if (fmt.ext !== currentFileExt) currentFileExt = fmt.ext;
      workCanvas.width = img.width;
      workCanvas.height = img.height;
      workCtx.clearRect(0, 0, img.width, img.height);
      workCtx.drawImage(img, 0, 0);
      currentImage = { w: img.width, h: img.height };
      drawPreview();
      statusEl.textContent = (lang === 'ru' ? 'Загружено ' : 'Loaded ') + img.width + '×' + img.height + (lang === 'ru' ? '.' : '.');
      const smallWarning = document.getElementById('menuhqSmallImageWarning');
      if (smallWarning) {
        if (img.width <= 1024 && img.height <= 1024) {
          smallWarning.textContent = lang === 'ru'
            ? 'Изображение 1024×1024 или меньше. Подготовка не имеет смысла — такое изображение проще использовать напрямую'
            : 'Image is 1024×1024 or smaller. Preparation is unnecessary — such an image is easier to use directly.';
          smallWarning.style.display = 'block';
        } else {
          smallWarning.textContent = '';
          smallWarning.style.display = 'none';
        }
      }
      buildBtn.disabled = false;
      hint.style.display = 'none';
      if (window.ChangeTracker) window.ChangeTracker.markChanges('menuhq');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      statusEl.textContent = lang === 'ru' ? 'Ошибка загрузки изображения.' : 'Failed to load image.';
    };
    img.src = url;
  }

  function drawPreview() {
    const w = workCanvas.width;
    const h = workCanvas.height;
    const bounds = dropzone.getBoundingClientRect();
    const maxW = bounds.width - 12;
    const maxH = bounds.height - 12;
    let sourceCanvas = workCanvas;
    let sw = w, sh = h;
    if (w > PREVIEW_MAX_SIDE || h > PREVIEW_MAX_SIDE) {
      const scale = PREVIEW_MAX_SIDE / Math.max(w, h);
      sw = Math.max(1, Math.round(w * scale));
      sh = Math.max(1, Math.round(h * scale));
      previewWorkCanvas.width = sw;
      previewWorkCanvas.height = sh;
      previewWorkCtx.clearRect(0, 0, sw, sh);
      previewWorkCtx.drawImage(workCanvas, 0, 0, w, h, 0, 0, sw, sh);
      sourceCanvas = previewWorkCanvas;
    }
    const scale = Math.min(maxW / sw, maxH / sh, 1);
    previewCanvas.width = Math.round(sw * scale);
    previewCanvas.height = Math.round(sh * scale);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.drawImage(sourceCanvas, 0, 0, sw, sh, 0, 0, previewCanvas.width, previewCanvas.height);
  }

  window.addEventListener('resize', () => {
    if (currentImage) drawPreview();
  });

  function canvasPartToBlob(sourceCanvas, sx, sy, sw, sh, mime, quality) {
    const c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    const ctx = c.getContext('2d');
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return new Promise(resolve => {
      c.toBlob(blob => resolve(blob), mime || 'image/png', quality);
    });
  }

  function buildShaderMode1(ext) {
    let s = '';
    for (let i = 1; i <= 4; i++) {
      s += 'menuback_' + i + '\\n{\\n\\tnopicmip\\n\\tnomipmaps\\n         {\\n                map textures/sfx/logo_HQ' + i + ext + '\\n                rgbgen identity\\n        }        \\n}\\n';
    }
    return s.replace(/\\\\n/g, String.fromCharCode(10));
  }

  function buildShaderMode2(ext) {
    let s = '';
    for (let i = 1; i <= 24; i++) {
      s += 'menuback' + i + '\\n{\\n\\tnopicmip\\n\\tnomipmaps\\n         {\\n                map textures/sfx/logoHQ' + i + ext + '\\n                rgbgen identity\\n        }        \\n}\\n';
    }
    return s.replace(/\\\\n/g, String.fromCharCode(10));
  }

  function getBuildCanvas(mode) {
    let w = workCanvas.width;
    let h = workCanvas.height;
    if (mode === 1) {
      if (w > MAX_SIDE_MODE1 || h > MAX_SIDE_MODE1) {
        const scale = MAX_SIDE_MODE1 / Math.max(w, h);
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
      }
    } else {
      if (w > MAX_WIDTH_MODE2 || h > MAX_HEIGHT_MODE2) {
        const scaleW = MAX_WIDTH_MODE2 / w;
        const scaleH = MAX_HEIGHT_MODE2 / h;
        const scale = Math.min(scaleW, scaleH);
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
      }
    }
    if (w === workCanvas.width && h === workCanvas.height) {
      return workCanvas;
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(workCanvas, 0, 0, workCanvas.width, workCanvas.height, 0, 0, w, h);
    return c;
  }

  buildBtn.addEventListener('click', async () => {
    if (!currentImage || typeof JSZip === 'undefined') {
      statusEl.textContent = getLanguage() === 'ru' ? 'Ошибка: загрузите изображение.' : 'Error: load an image.';
      return;
    }
    const mode = getMode();
    const buildCanvas = getBuildCanvas(mode);
    const w = buildCanvas.width;
    const h = buildCanvas.height;
    const fmt = getOutputFormat(currentFileExt);
    const ext = fmt.ext;
    const base = baseNameNoExt(currentFileName) || 'image';
    const pk3Name = 'zz-menuHQ-' + base + '.pk3';
    const lang = getLanguage();
    statusEl.textContent = (lang === 'ru' ? 'Создание pk3…' : 'Building pk3…');

    const zip = new JSZip();

    if (mode === 1) {
      const halfW = Math.floor(w / 2);
      const halfH = Math.floor(h / 2);
      for (let i = 0; i < 4; i++) {
        const x0 = (i % 2) ? halfW : 0;
        const y0 = (i < 2) ? 0 : halfH;
        const x1 = x0 + halfW;
        const y1 = y0 + halfH;
        const qw = x1 - x0;
        const qh = y1 - y0;
        const blob = await canvasPartToBlob(buildCanvas, x0, y0, qw, qh, fmt.mime, fmt.quality);
        const arcname = TEX_DIR + '/logo_HQ' + (i + 1) + ext;
        zip.file(arcname, blob, { compression: 'DEFLATE', compressionOptions: { level: 9 } });
      }
      const shader = buildShaderMode1(ext);
      zip.file(SHADER_PATH_MODE1, shader, { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    } else {
      const ROWS = 4;
      const COLS = 6;
      const partW = Math.floor(w / COLS);
      const partH = Math.floor(h / ROWS);
      for (let partNum = 1; partNum <= 24; partNum++) {
        const row = Math.floor((partNum - 1) / COLS);
        const col = (partNum - 1) % COLS;
        const x0 = col * partW;
        const y0 = row * partH;
        const x1 = col === COLS - 1 ? w : x0 + partW;
        const y1 = row === ROWS - 1 ? h : y0 + partH;
        const pw = x1 - x0;
        const ph = y1 - y0;
        const blob = await canvasPartToBlob(buildCanvas, x0, y0, pw, ph, fmt.mime, fmt.quality);
        const arcname = TEX_DIR + '/logoHQ' + partNum + ext;
        zip.file(arcname, blob, { compression: 'DEFLATE', compressionOptions: { level: 9 } });
      }
      const shader = buildShaderMode2(ext);
      zip.file(SHADER_PATH_MODE2, shader, { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    }

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pk3Name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      statusEl.textContent = (lang === 'ru' ? 'Готово: ' : 'Done: ') + pk3Name;
      if (window.ChangeTracker) window.ChangeTracker.markCompleted('menuhq');
    } catch (e) {
      console.error(e);
      statusEl.textContent = (lang === 'ru' ? 'Ошибка: ' : 'Error: ') + e.message;
    }
  });
})();
`;

    document.addEventListener('DOMContentLoaded', function() {
        const openBtn = document.getElementById('openMenuHQModal');
        const modal = document.getElementById('menuhqModal');
        const closeBtn = document.getElementById('closeMenuHQModal');
        const content = document.getElementById('menuhqToolContent');

        if (!openBtn || !modal || !closeBtn || !content) return;

        let isContentLoaded = false;

        function loadTool() {
            if (isContentLoaded) return;
            content.className = 'menuhq-tool-root';
            content.innerHTML = getMenuHQToolHTML(getLanguage());
            const script = document.createElement('script');
            script.textContent = menuhqToolJS;
            content.appendChild(script);
            isContentLoaded = true;
        }

        function openModal() {
            loadTool();
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            if (history.pushState) {
                history.pushState(null, null, '#menuhq');
            } else {
                window.location.hash = '#menuhq';
            }
            if (window.ChangeTracker) window.ChangeTracker.resetChanges('menuhq');
            setTimeout(() => {
                const dz = document.getElementById('menuhqDropzone');
                if (dz) dz.focus();
            }, 100);
        }

        function closeModal() {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            if (history.pushState) {
                history.pushState(null, null, window.location.pathname + window.location.search);
            } else {
                window.location.hash = '';
            }
            if (window.ChangeTracker) window.ChangeTracker.resetChanges('menuhq');
        }

        openBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openModal();
        });

        closeBtn.addEventListener('click', closeModal);

        let mouseDownOnBg = false;
        modal.addEventListener('mousedown', function(e) {
            mouseDownOnBg = (e.target === modal);
        });
        const handleMouseUp = function(e) {
            if (mouseDownOnBg && (e.target === modal || !modal.contains(e.target))) {
                closeModal();
            }
            mouseDownOnBg = false;
        };
        modal.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseup', handleMouseUp);

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                e.preventDefault();
                if (window.ChangeTracker) {
                    window.ChangeTracker.handleEscPress('menuhq', closeModal);
                } else {
                    closeModal();
                }
            }
        });

        if (window.location.hash === '#menuhq') openModal();
        window.addEventListener('hashchange', function() {
            if (window.location.hash === '#menuhq') openModal();
            else if (modal.classList.contains('active')) closeModal();
        });
    });
})();
