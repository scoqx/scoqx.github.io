document.addEventListener("DOMContentLoaded", () => {
  fetch("version.json")
    .then(response => response.json())
    .then(data => {
      const version = data.version;
      document.getElementById("version-text").textContent = `${version}`;
      const btn1 = document.getElementById("downloadBtn");
      const btn2 = document.getElementById("downloadBtn2");

      btn1.href = `/assets/zz-osp-pak8be.pk3`;
      btn2.href = `/assets/whitelist/zz-osp-pak8be.pk3`;

      btn1.addEventListener("click", (e) => {
        e.preventDefault(); // Остановить переход
        gtag('event', 'download', {
          event_category: 'Files',
          event_label: 'Main download',
          value: 1
        });
        setTimeout(() => {
          window.location.href = btn1.href; // Перейти вручную
        }, 150); // 100–300 мс обычно достаточно
      });

      btn2.addEventListener("click", (e) => {
        e.preventDefault();
        gtag('event', 'download', {
          event_category: 'Files',
          event_label: 'Whitelist download',
          value: 1
        });
        setTimeout(() => {
          window.location.href = btn2.href;
        }, 150);
      });
    })


    
    .catch(error => {
      document.getElementById("version-text").textContent = "Error loading version";
      console.error(error);
    });
});



// changelog
document.addEventListener('DOMContentLoaded', () => {
  const changelogEl = document.getElementById('changelog-content');

  fetch('/assets/changelog_be.txt')
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
        // Убираем пустые строки в начале блока
        while (lines.length && lines[0].trim() === '') {
          lines.shift();
        }
        const title = lines.shift();
        const content = lines.join('\n');
        return `<div class="changelog-block">
  <div class="changelog-title">${title}</div>
  <pre class="changelog-content-pre">${content}</pre>
</div>`;
      }).join('');  // без добавочных переносов между блоками
    })
    .catch(err => {
      changelogEl.textContent = 'Error loading changelog: ' + err.message;
      console.error(err);
    });
});
