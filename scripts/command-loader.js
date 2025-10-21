// Функция для определения ширины текста в пикселях
function getTextWidth(text, font) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = font || getComputedStyle(document.body).font;
  return context.measureText(text).width;
}

// Функция для определения ширины имени команды с учетом CSS стилей
function getCommandNameWidth(commandName, prefix = "") {
  const fullName = prefix + commandName;
  
  // Создаем временный элемент для измерения
  const tempElement = document.createElement('code');
  tempElement.className = 'command-name';
  tempElement.style.visibility = 'hidden';
  tempElement.style.position = 'absolute';
  tempElement.style.top = '-9999px';
  tempElement.textContent = fullName;
  
  document.body.appendChild(tempElement);
  
  try {
    const computedStyle = getComputedStyle(tempElement);
    const fontFamily = computedStyle.fontFamily;
    const fontSize = computedStyle.fontSize;
    const fontWeight = computedStyle.fontWeight;
    const font = `${fontWeight} ${fontSize} ${fontFamily}`;
    
    const width = getTextWidth(fullName, font);
    return width;
  } finally {
    document.body.removeChild(tempElement);
  }
}

// Функция для получения максимальной ширины среди всех команд
function getMaxCommandNameWidth(entries) {
  let maxWidth = 0;
  
  for (const entry of entries) {
    let prefix = "";
    if (entry.type === "command" && !/^[\/+\-]/.test(entry.name)) {
      prefix = "/";
    }
    
    const width = getCommandNameWidth(entry.name, prefix);
    if (width > maxWidth) {
      maxWidth = width;
    }
  }
  
  return maxWidth;
}

async function loadConfig() {
  // Определяем язык по URL
  const isRussian = window.location.pathname.includes('/ru/');
  const filename = isRussian ? "/assets/OSP2.cfg" : "/assets/OSP2English.cfg";

  // Проверяем, является ли устройство мобильным
  const isMobile = window.innerWidth <= 768;
  
  console.log('🔍 Loading config:', filename);
  console.log('📱 Is mobile:', isMobile);

  const response = await fetch(filename + "?v=" + Date.now());
  const text = await response.text();

  const lines = text.split("\n");

  const entries = [];
  let current = null;

  for (let rawLine of lines) {
    let line = rawLine.trim();

    if (line === "") continue;

    // --- Закомментированная CVar ---
    const commentedCvarMatch = line.match(/^\/\/\s*seta\s+(\S+)\s+"([^"]*)"\s*\/\/(.*)$/);
    if (commentedCvarMatch) {
      const [, name, value, desc] = commentedCvarMatch;
      current = {
        type: "cvar",
        name,
        value,
        description: desc.trim(),
      };
      entries.push(current);
      continue;
    }

    // --- Активная CVar ---
    const activeCvarMatch = line.match(/^seta\s+(\S+)\s+"([^"]*)"\s*\/\/(.*)$/);
    if (activeCvarMatch) {
      const [, name, value, desc] = activeCvarMatch;
      current = {
        type: "cvar",
        name,
        value,
        description: desc.trim(),
      };
      entries.push(current);
      continue;
    }

    // --- Закомментированная команда ---
    const commentedCommandMatch = line.match(/^\/\/\s*([/+/-][\w]+)(?:\s+"([^"]*)")?\s*\/\/(.*)$/);
    if (commentedCommandMatch) {
      const [, name, value, desc] = commentedCommandMatch;
      current = {
        type: "command",
        name,
        value: value || null,
        description: desc.trim(),
      };
      entries.push(current);
      continue;
    }

    // --- Активная команда ---
    const activeCommandMatch = line.match(/^([/+/-][\w]+)(?:\s+"([^"]*)")?\s*\/\/(.*)$/);
    if (activeCommandMatch) {
      const [, name, value, desc] = activeCommandMatch;
      current = {
        type: "command",
        name,
        value: value || null,
        description: desc.trim(),
      };
      entries.push(current);
      continue;
    }

    // --- Продолжение описания ---
    if (/^\/\/\s*/.test(line)) {
      if (current && current.description) {
        current.description += " " + line.replace(/^\/\/\s*/, "").trim();
      }
      continue;
    }

    // Прочее игнорируем
  }

  // Сортировка: сначала cvar по имени, потом команды по имени
  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "cvar" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  // Получаем максимальную ширину имени команды только для десктопа
  const maxCommandWidth = isMobile ? 0 : getMaxCommandNameWidth(entries);
  console.log(`Максимальная ширина имени команды: ${maxCommandWidth.toFixed(2)}px`);

  // Генерация HTML
  let html = "";
  
  // Добавляем подсказку
  const copyHint = isRussian ? 
    'Подсказка: нажмите на команду, чтобы скопировать' : 
    'Hint: click a command to copy';
  html += `<div class="copy-hint">${copyHint}</div>`;
  
  for (const entry of entries) {
    let prefix = "";
    if (entry.type === "command" && !/^[\/+\-]/.test(entry.name)) {
      prefix = "/";
    }
    
    let cmdHtml = `<code class="command-name">${prefix}${entry.name}</code>`;
    if (entry.value !== null) {
      cmdHtml += ` <code class="command-arg">"${entry.value}"</code>`;
    }
    
    if (isMobile) {
      // На мобильных устройствах используем простую структуру без умного отступа
      html += `
        <div class="command-block">
          <div class="command-line mobile-layout">
            <div class="command-part">${cmdHtml}</div>
            <div class="command-separator"> — </div>
            <div class="command-description">${entry.description}</div>
          </div>
        </div>
      `;
    } else {
      // На десктопе используем умный отступ
      const currentWidth = getCommandNameWidth(entry.name, prefix);
      html += `
        <div class="command-block">
          <div class="command-line">
            <span class="command-part">${cmdHtml}</span>
            <span class="command-separator"> — </span>
            <span class="command-description" style="--command-width: ${currentWidth.toFixed(2)}px">
              <span class="description-text">${entry.description}</span>
            </span>
          </div>
        </div>
      `;
    }
  }

  document.getElementById("commands-content").innerHTML = html;
  
  // Выводим статистику в консоль
  console.log(`Всего команд: ${entries.length}`);
  console.log(`Максимальная ширина: ${maxCommandWidth.toFixed(2)}px`);

  // Клик по имени команды — копирование команды (с аргументом если есть)
  const container = document.getElementById('commands-content');
  container.addEventListener('click', (e) => {
    const codeEl = e.target.closest('code.command-name');
    if (!codeEl) return;
    const line = codeEl.closest('.command-line');
    if (!line) return;
    const nameText = codeEl.textContent.trim(); // копируем только команду
    try {
      navigator.clipboard.writeText(nameText);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = nameText;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    // Визуальная обратная связь: краткая подсветка и тост у курсора
    codeEl.classList.add('copied-flash');
    setTimeout(() => { codeEl.classList.remove('copied-flash'); }, 250);

    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = isRussian ? 'Скопировано' : 'Copied';
    // позиция справа-сверху от курсора
    const x = (e.clientX || 0) + 12;
    const y = (e.clientY || 0) - 12;
    toast.style.left = `${x}px`;
    toast.style.top = `${y}px`;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); }, 800);
  });
}

// Экспортируем функции в глобальную область видимости
window.loadConfig = loadConfig;
window.getTextWidth = getTextWidth;
window.getCommandNameWidth = getCommandNameWidth;
window.getMaxCommandNameWidth = getMaxCommandNameWidth;

document.addEventListener("DOMContentLoaded", loadConfig);