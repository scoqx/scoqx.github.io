// download buttons
document.addEventListener("DOMContentLoaded", () => {
  fetch("version.json?v=" + Date.now())
    .then(response => response.json())
    .then(data => {
      const version = data.version;
      document.getElementById("version-text").textContent = `${version}`;
      document.getElementById("downloadBtn").href = `/assets/zz-osp-pak8be.pk3`;
      document.getElementById("downloadBtn2").href = `/assets/whitelist/zz-osp-pak8be.pk3`;
    })
    .catch(error => {
      document.getElementById("version-text").textContent = "Error loading version";
      console.error(error);
    });
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
