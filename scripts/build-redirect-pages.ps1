$ErrorActionPreference = "Stop"
$base = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding $false
$site = "https://konstalker.github.io"
$pages = @("acknowledgements", "commands", "compilations", "gallery", "index", "tools")

function Get-PageHtml([string]$lang, [string]$pageName) {
  $file = "$pageName.html"
  $target = "$site/$lang/$file"
  $ruActive = if ($lang -eq "ru") { ' class="is-active"' } else { "" }
  $enActive = if ($lang -eq "en") { ' class="is-active"' } else { "" }
  @"
<!DOCTYPE html>
<html lang="$lang" data-forced-lang="$lang" data-redirect-page="$file">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="5;url=$target">
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
    <button type="button" data-set-lang="ru"$ruActive>RU</button>
    <button type="button" data-set-lang="en"$enActive>EN</button>
  </nav>
  <main>
    <h1>OSP2-BE</h1>
    <p class="lead" data-lang="ru">Новый администратор и держатель сайта мода OSP2-BE: <strong>KONSTALKER</strong>.</p>
    <p class="lead" data-lang="en">New administrator and maintainer of the OSP2-BE mod website: <strong>KONSTALKER</strong>.</p>
    <a class="site-link" data-outbound href="$target" rel="noopener">
      <span class="site-link-url">konstalker.github.io</span>
      <span class="site-link-hint" data-lang="ru">перейти на новый сайт</span>
      <span class="site-link-hint" data-lang="en">go to the new website</span>
    </a>
    <p class="redirect" data-lang="ru" aria-live="polite">Перенаправление на новый сайт через <span class="sec">5</span> сек…</p>
    <p class="redirect" data-lang="en" aria-live="polite">Redirecting to the new site in <span class="sec">5</span> sec…</p>
    <p class="redirect-now" data-lang="ru"><a data-outbound href="$site/ru/$file">Перейти сейчас</a></p>
    <p class="redirect-now" data-lang="en"><a data-outbound href="$site/en/$file">Go now</a></p>
  </main>
  <footer>OSP2-BE</footer>
  <script src="/assets/redirect.js"></script>
</body>
</html>
"@
}

foreach ($lang in @("en", "ru")) {
  $dir = Join-Path $base $lang
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  foreach ($page in $pages) {
    $html = Get-PageHtml $lang $page
    [System.IO.File]::WriteAllText((Join-Path $dir "$page.html"), $html, $utf8)
  }
}
Write-Host "Built $($pages.Count * 2) redirect pages."
