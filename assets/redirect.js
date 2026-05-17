(function () {
  const NEW_SITE = "https://konstalker.github.io";
  const REDIRECT_DELAY_SEC = 5;
  const html = document.documentElement;
  const langButtons = document.querySelectorAll("[data-set-lang]");
  const secEls = document.querySelectorAll(".sec");
  const outboundLinks = document.querySelectorAll("[data-outbound]");
  const forcedLang = html.dataset.forcedLang;
  const redirectPage = html.dataset.redirectPage || "index.html";

  let redirectTimer = null;
  let tickTimer = null;

  function targetForLang(code) {
    return `${NEW_SITE}/${code}/${redirectPage}`;
  }

  function updateOutbound(url) {
    outboundLinks.forEach((el) => { el.href = url; });
    let meta = document.querySelector('meta[http-equiv="refresh"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.httpEquiv = "refresh";
      document.head.appendChild(meta);
    }
    meta.content = `${REDIRECT_DELAY_SEC};url=${url}`;
  }

  function setLang(code) {
    html.lang = code;
    langButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.setLang === code);
    });
    try { localStorage.setItem("scoqx-lang", code); } catch (_) {}
    scheduleRedirect();
  }

  function scheduleRedirect() {
    const url = targetForLang(html.lang);
    updateOutbound(url);

    if (redirectTimer) clearTimeout(redirectTimer);
    if (tickTimer) clearInterval(tickTimer);

    let left = REDIRECT_DELAY_SEC;
    secEls.forEach((el) => { el.textContent = String(left); });

    tickTimer = setInterval(() => {
      left -= 1;
      if (left < 0) left = 0;
      secEls.forEach((el) => { el.textContent = String(left); });
      if (left <= 0) clearInterval(tickTimer);
    }, 1000);

    redirectTimer = setTimeout(() => {
      window.location.replace(url);
    }, REDIRECT_DELAY_SEC * 1000);
  }

  if (forcedLang === "en" || forcedLang === "ru") {
    setLang(forcedLang);
  } else {
    const saved = (() => {
      try { return localStorage.getItem("scoqx-lang"); } catch (_) { return null; }
    })();
    if (saved === "en" || saved === "ru") setLang(saved);
    else if (navigator.language && navigator.language.startsWith("en")) setLang("en");
    else setLang("ru");
  }

  langButtons.forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.setLang));
  });
})();
