# -*- coding: utf-8 -*-
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SITE = "https://konstalker.github.io"
PAGES = [
    "acknowledgements",
    "commands",
    "compilations",
    "gallery",
    "index",
    "tools",
]

T = {
    "lead_ru": "Новый администратор и держатель сайта мода OSP2-BE: <strong>KONSTALKER</strong>.",
    "lead_en": "New administrator and maintainer of the OSP2-BE mod website: <strong>KONSTALKER</strong>.",
    "hint_ru": "перейти на новый сайт",
    "hint_en": "go to the new website",
    "redirect_ru": 'Перенаправление на новый сайт через <span class="sec">5</span> сек...',
    "redirect_en": 'Redirecting to the new site in <span class="sec">5</span> sec...',
    "now_ru": "Перейти сейчас",
    "now_en": "Go now",
}


def page_html(lang: str, page: str) -> str:
    file = f"{page}.html"
    target = f"{SITE}/{lang}/{file}"
    ru_active = ' class="is-active"' if lang == "ru" else ""
    en_active = ' class="is-active"' if lang == "en" else ""
    return f"""<!DOCTYPE html>
<html lang="{lang}" data-forced-lang="{lang}" data-redirect-page="{file}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="5;url={target}">
  <title>OSP2-BE</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/redirect.css">
</head>
<body>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="bg-orb" aria-hidden="true"></div>
  <nav class="lang" aria-label="Language">
    <button type="button" data-set-lang="ru"{ru_active}>RU</button>
    <button type="button" data-set-lang="en"{en_active}>EN</button>
  </nav>
  <main>
    <h1>OSP2-BE</h1>
    <p class="lead" data-lang="ru">{T["lead_ru"]}</p>
    <p class="lead" data-lang="en">{T["lead_en"]}</p>
    <a class="site-link" data-outbound href="{target}" rel="noopener">
      <span class="site-link-url">konstalker.github.io</span>
      <span class="site-link-hint" data-lang="ru">{T["hint_ru"]}</span>
      <span class="site-link-hint" data-lang="en">{T["hint_en"]}</span>
    </a>
    <p class="redirect" data-lang="ru" aria-live="polite">{T["redirect_ru"]}</p>
    <p class="redirect" data-lang="en" aria-live="polite">{T["redirect_en"]}</p>
    <p class="redirect-now" data-lang="ru"><a data-outbound href="{SITE}/ru/{file}">{T["now_ru"]}</a></p>
    <p class="redirect-now" data-lang="en"><a data-outbound href="{SITE}/en/{file}">{T["now_en"]}</a></p>
  </main>
  <footer>OSP2-BE</footer>
  <script src="/assets/redirect.js"></script>
</body>
</html>
"""


def main() -> None:
    for lang in ("en", "ru"):
        out_dir = BASE / lang
        out_dir.mkdir(parents=True, exist_ok=True)
        for page in PAGES:
            path = out_dir / f"{page}.html"
            path.write_text(page_html(lang, page), encoding="utf-8", newline="\n")
    print(f"Built {len(PAGES) * 2} redirect pages.")


if __name__ == "__main__":
    main()
