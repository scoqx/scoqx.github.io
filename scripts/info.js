document.addEventListener("DOMContentLoaded", () => {
  fetch('assets/Superhud.md')
    .then(response => {
      if (!response.ok) throw new Error('Ошибка загрузки файла');
      return response.text();
    })
    .then(text => {
      const contentEl = document.getElementById('content');
      // Преобразуем Markdown в HTML и вставляем
      contentEl.innerHTML = marked.parse(text);
    })
    .catch(error => {
      const contentEl = document.getElementById('content');
      contentEl.textContent = 'Не удалось загрузить файл.';
      console.error(error);
    });
});
