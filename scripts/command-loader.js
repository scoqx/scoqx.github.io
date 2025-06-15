async function loadConfig() {
  const currentLang = localStorage.getItem("language") || "en";
  const filename = currentLang === "ru" ? "/assets/OSP2.cfg" : "/assets/OSP2English.cfg";

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

  // Генерация HTML
  let html = "";
  for (const entry of entries) {
    let prefix = "";
    if (entry.type === "command" && !/^[\/+\-]/.test(entry.name)) {
      prefix = "/";
    }
    let cmdHtml = `<code class="command-name">${prefix}${entry.name}</code>`;
    if (entry.value !== null) {
      cmdHtml += ` <code class="command-arg">"${entry.value}"</code>`;
    }
    html += `
      <div class="command-block">
        <p>${cmdHtml} — ${entry.description}</p>
      </div>
    `;
  }


  document.getElementById("content").innerHTML = html;
}

window.loadConfig = loadConfig;

document.addEventListener("DOMContentLoaded", loadConfig);
