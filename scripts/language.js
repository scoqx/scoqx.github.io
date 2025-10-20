const texts = {
  en: {
    title: "OSP2-BE",
    subtitle: "Quake 3 Arena mod",
    desc: "Extended edition of the OSP2.<br/>OSP2 is an attempt to recover the old OSP mod source code and improve upon it.<br/>Based on vanilla Q3 and OSP files analysis.",
    downloadBtn: "Download",
    downloadBtn2: "Download",
    lastVersion: "Latest version",
    changeLog: "Changelog",
    nav: {
      home: "Home",
      gallery: "Gallery",
      compilations: "Compilations",
      mode: "Mode",
      commands: "Console Commands",
      downloads: "Downloads"
    }
  },
  ru: {
    title: "OSP2-BE",
    subtitle: "Quake 3 Arena мод",
    desc: "Расширенная версия мода OSP2.<br/>OSP2 — это попытка восстановить исходный код старого мода OSP и улучшить его.<br/>Основано на анализе файлов ванильного Q3 и OSP.",
    downloadBtn: "Скачать",
    downloadBtn2: "Скачать",
    lastVersion: "Последняя версия",
    changeLog: "Список изменений",
    nav: {
      home: "Главная",
      gallery: "Галерея",
      compilations: "Сборки",
      mode: "Режим",
      commands: "Консольные команды",
      downloads: "Загрузки"
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const langBtn = document.getElementById("langBtn");

  const bindings = {
    title: "title",
    subtitle: "subtitle",
    desc: "desc", // innerHTML
    downloadBtn: "downloadBtn",
    downloadBtn2: "downloadBtn2",
    lastVersion: "lastVersion",
    secondVersion: "secondVersion",
    changeLog: "changeLog",
    downloadsTitle: "nav.downloads",
    galleryTitle: "nav.gallery",
    commandsTitle: "nav.commands"
  };

  const navLinks = {
    home: document.getElementById("nav-home"),
    gallery: document.getElementById("nav-gallery"),
    compilations: document.getElementById("nav-compilations"),
    commands: document.getElementById("nav-commands"),
    downloads: document.getElementById("nav-downloads"),
    
  };

  let currentLang = localStorage.getItem("language") || "en";
  updateLanguage(currentLang);

  if (langBtn) {
    langBtn.addEventListener("click", () => {
      currentLang = currentLang === "en" ? "ru" : "en";
      localStorage.setItem("language", currentLang);
      updateLanguage(currentLang);

      if (typeof window.loadConfig === "function") {
        window.loadConfig();
      }

      if (typeof window.renderContactInfo === "function") {
        window.renderContactInfo();
      }

    });
  }

  function updateLanguage(lang) {
    const langData = texts[lang];
    if (!langData) {
      console.error(`Нет перевода для языка: ${lang}`);
      return;
    }

    console.log("Смена языка на:", lang);
    
    // Add transition class to body for smooth transitions
    document.body.classList.add('language-transition');
    
    if (langBtn) langBtn.innerText = lang === "en" ? "RU" : "EN";

    const page = document.body.getAttribute("data-page");
    let pageTitlePart = "";

    if (page && langData.nav[page]) {
      pageTitlePart = ` - ${langData.nav[page]}`;
    }

    document.title = langData.title + pageTitlePart;

    // Update elements with smooth transition
    Object.entries(bindings).forEach(([id, keyPath]) => {
      const element = document.getElementById(id);
      if (!element) return;

      const value = keyPath.split('.').reduce((acc, key) => acc?.[key], langData);
      if (value) {
        // Add transition class to element
        element.classList.add('language-transition');
        
        if (id === "desc") {
          element.innerHTML = value;
        } else {
          element.innerText = value;
        }
      }
    });

    Object.keys(navLinks).forEach(key => {
      const linkEl = navLinks[key];
      if (!linkEl) return;
      linkEl.classList.add('language-transition');

      if (key === 'gallery') {
        const modeTextEl = linkEl.querySelector('.mode-toggle__text');
        if (modeTextEl) {
          // Переводим текст у переключателя режима и сохраняем разметку
          modeTextEl.innerText = langData.nav.mode || 'Mode';
          return; // не затираем содержимое ссылки
        }
      }

      // Обычная логика для остальных ссылок
      if (langData.nav[key]) {
        linkEl.innerText = langData.nav[key];
      }
    });

    // Remove transition class after animation completes
    setTimeout(() => {
      document.body.classList.remove('language-transition');
      document.querySelectorAll('.language-transition').forEach(el => {
        el.classList.remove('language-transition');
      });
    }, 300);
  }
});
