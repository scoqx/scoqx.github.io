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
      commands: "Консольные команды",
      downloads: "Загрузки"
    }
  }
};

// Preload all language content to prevent layout shifts
function preloadLanguageContent() {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.height = 'auto';
  container.style.width = 'auto';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  
  // Create elements for each language to measure their dimensions
  Object.keys(texts).forEach(lang => {
    const langContainer = document.createElement('div');
    langContainer.className = `lang-${lang}`;
    langContainer.style.position = 'absolute';
    langContainer.style.visibility = 'hidden';
    
    const langData = texts[lang];
    
    // Create main text elements
    const subtitle = document.createElement('h2');
    subtitle.textContent = langData.subtitle;
    subtitle.className = 'main-text h2';
    
    const desc = document.createElement('p');
    desc.innerHTML = langData.desc;
    desc.className = 'main-text p';
    
    // Create download card elements
    const lastVersion = document.createElement('h3');
    lastVersion.textContent = langData.lastVersion;
    lastVersion.className = 'download-card h3';
    
    const secondVersion = document.createElement('h3');
    secondVersion.textContent = langData.secondVersion;
    secondVersion.className = 'download-card h3';
    
    // Create nav elements
    const navContainer = document.createElement('div');
    navContainer.className = 'nav';
    Object.keys(langData.nav).forEach(key => {
      const navLink = document.createElement('a');
      navLink.textContent = langData.nav[key];
      navLink.className = 'nav-link';
      navContainer.appendChild(navLink);
    });
    
    langContainer.appendChild(subtitle);
    langContainer.appendChild(desc);
    langContainer.appendChild(lastVersion);
    langContainer.appendChild(secondVersion);
    langContainer.appendChild(navContainer);
    
    container.appendChild(langContainer);
  });
  
  document.body.appendChild(container);
  
  // Measure and store dimensions
  const dimensions = {};
  Object.keys(texts).forEach(lang => {
    const langContainer = container.querySelector(`.lang-${lang}`);
    if (langContainer) {
      dimensions[lang] = {
        subtitle: langContainer.querySelector('h2').offsetHeight,
        desc: langContainer.querySelector('p').offsetHeight,
        lastVersion: langContainer.querySelector('.download-card.h3').offsetHeight,
        secondVersion: langContainer.querySelectorAll('.download-card.h3')[1].offsetHeight,
        navLinks: Array.from(langContainer.querySelectorAll('.nav-link')).map(link => link.offsetWidth)
      };
    }
  });
  
  // Clean up
  document.body.removeChild(container);
  
  return dimensions;
}

document.addEventListener("DOMContentLoaded", () => {
  const langBtn = document.getElementById("langBtn");
  
  // Preload content dimensions
  const contentDimensions = preloadLanguageContent();
  
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
    commands: document.getElementById("nav-commands"),
    downloads: document.getElementById("nav-downloads")
  };

  let currentLang = localStorage.getItem("language") || "en";
  
  // Set initial dimensions based on current language
  setElementDimensions(currentLang, contentDimensions);
  updateLanguage(currentLang);

  if (langBtn) {
    langBtn.addEventListener("click", () => {
      currentLang = currentLang === "en" ? "ru" : "en";
      localStorage.setItem("language", currentLang);
      
      // Set dimensions before updating content
      setElementDimensions(currentLang, contentDimensions);
      updateLanguage(currentLang);

      if (typeof window.loadConfig === "function") {
        window.loadConfig();
      }
    });
  }

  function setElementDimensions(lang, dimensions) {
    const langDims = dimensions[lang];
    if (!langDims) return;
    
    // Set fixed heights for main text elements
    const subtitle = document.getElementById('subtitle');
    if (subtitle) {
      subtitle.style.minHeight = `${langDims.subtitle}px`;
    }
    
    const desc = document.getElementById('desc');
    if (desc) {
      desc.style.minHeight = `${langDims.desc}px`;
    }
    
    // Set fixed heights for download card elements
    const lastVersion = document.getElementById('lastVersion');
    if (lastVersion) {
      lastVersion.style.minHeight = `${langDims.lastVersion}px`;
    }
    
    const secondVersion = document.getElementById('secondVersion');
    if (secondVersion) {
      secondVersion.style.minHeight = `${langDims.secondVersion}px`;
    }
    
    // Set fixed widths for nav links
    Object.keys(navLinks).forEach((key, index) => {
      if (navLinks[key] && langDims.navLinks[index]) {
        navLinks[key].style.minWidth = `${langDims.navLinks[index]}px`;
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
    if (langBtn) langBtn.innerText = lang === "en" ? "RU" : "EN";

    const page = document.body.getAttribute("data-page");
    let pageTitlePart = "";

    if (page && langData.nav[page]) {
      pageTitlePart = ` - ${langData.nav[page]}`;
    }

    document.title = langData.title + pageTitlePart;

    Object.entries(bindings).forEach(([id, keyPath]) => {
      const element = document.getElementById(id);
      if (!element) return;

      const value = keyPath.split('.').reduce((acc, key) => acc?.[key], langData);
      if (value) {
        if (id === "desc") {
          element.innerHTML = value;
        } else {
          element.innerText = value;
        }
      }
    });

    Object.keys(navLinks).forEach(key => {
      if (navLinks[key]) {
        navLinks[key].innerText = langData.nav[key];
      }
    });
  }
});

