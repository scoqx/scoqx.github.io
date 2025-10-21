// download buttons
document.addEventListener("DOMContentLoaded", () => {
  fetch("version.json?v=" + Date.now())
    .then(response => {
      if (!response.ok) throw new Error('Failed to load version');
      return response.json();
    })
    .then(data => {
      const version = data.version;
      const versionEl = document.getElementById("version-text");
      if (versionEl) versionEl.textContent = `${version}`;
      const dl1 = document.getElementById("downloadBtn");
      if (dl1) dl1.href = `/assets/zz-osp-pak8be.pk3`;
      // второй downloadBtn2 удалён из разметки
    })
    .catch(error => {
      const versionEl = document.getElementById("version-text");
      if (versionEl) versionEl.textContent = "Error loading version";
    });
});


// contact info (multi-language)
// expose as function and call on load so language switches can re-render
window.renderContactInfo = function renderContactInfo() {
  const el = document.getElementById('contactInfo');
  if (!el) return;
  const langToggle = document.getElementById('langToggle');
  const lang = langToggle && langToggle.checked ? 'ru' : 'en';

  const labels = {
    en: { moddb: 'ModDB', source: 'Source code', by: 'by' },
    ru: { moddb: 'ModDB', source: 'Исходный код', by: 'от' }
  };
  const L = labels[lang] || labels.en;

  const rows = [
    {
      title: 'OSP2',
      icon: '/assets/blender_180_osp2.png',
      moddb: 'https://www.moddb.com/mods/osp2',
      source: 'https://github.com/snems/OSP2',
      authorText: 'Snems'
    },
    {
      title: 'OSP2-BE',
      icon: '/assets/blender_180.png',
      moddb: 'https://www.moddb.com/mods/osp2-be',
      source: 'https://github.com/scoqx/OSP2-BE',
      authorText: 'diwoc',
      authorHref: 'https://t.me/diwoc'
    }
  ];

  el.innerHTML = rows.map(r => {
    const author = r.authorHref
      ? `${L.by} <a href="${r.authorHref}" target="_blank" rel="noopener noreferrer">${r.authorText}</a>`
      : `${L.by} ${r.authorText}`;
    return `
<div class="contact-row" style="display:flex;align-items:center;gap:8px;">
  <img src="${r.icon}" alt="${r.title} icon" style="width:20px;height:20px;object-fit:contain;" />
  <strong>${r.title}:</strong>
  <a href="${r.moddb}" target="_blank" rel="noopener noreferrer">${L.moddb}</a>
  - <a href="${r.source}" target="_blank" rel="noopener noreferrer">${L.source}</a>
  - ${author}
</div>`;
  }).join('');
};

document.addEventListener('DOMContentLoaded', () => {
  window.renderContactInfo();
  
  // Добавляем обработчик изменения языка
  const langToggle = document.getElementById('langToggle');
  if (langToggle) {
    langToggle.addEventListener('change', () => {
      window.renderContactInfo();
    });
  }
});


// changelog
document.addEventListener('DOMContentLoaded', () => {
  const changelogEl = document.getElementById('changelog-content');

  fetch('/assets/changelog_be.txt?v=' + Date.now())
    .then(response => {
      if (!response.ok) throw new Error('Failed to load changelog');
      return response.text();
    })
    .then(text => {
      const lines = text.split('\n');
      const blocks = [];
      let currentBlock = [];

      const headerRegex = /^\d{2}\.\d{2}\.\d{4}\s+be\s+v\S*/i;

      for (const line of lines) {
        if (headerRegex.test(line.trim())) {
          if (currentBlock.length) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [];
          }
          currentBlock.push(line);
        } else {
          if (currentBlock.length) {
            currentBlock.push(line);
          }
        }
      }

      if (currentBlock.length) {
        blocks.push(currentBlock.join('\n'));
      }

      blocks.reverse();

      changelogEl.innerHTML = blocks.map(block => {
        const lines = block.split('\n');
        while (lines.length && lines[0].trim() === '') {
          lines.shift();
        }
        const title = lines.shift();
        const content = lines.join('\n');
        return `<div class="changelog-block">
  <div class="changelog-title">${title}</div>
  <pre class="changelog-content-pre">${content}</pre>
</div>`;
      }).join('');
    })
    .catch(err => {
      changelogEl.textContent = 'Error loading changelog: ' + err.message;
      console.error(err);
    });
});
