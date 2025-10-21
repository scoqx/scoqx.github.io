# 🔍 Debug Instructions for Font Size Changes

## Как использовать дебаг:

1. **Откройте страницу** `index.html` в браузере
2. **Откройте Developer Tools** (F12)
3. **Перейдите на вкладку Console**
4. **Выполните жесткую перезагрузку** (Ctrl+F5)
5. **Наблюдайте за логами** в консоли

## Что отслеживает дебаг:

### 📏 **Размеры шрифтов:**
- `Header H1 font-size` - размер заголовка
- `Nav link font-size` - размеры навигационных ссылок
- `Root font-size` - базовый размер шрифта документа
- `Body font-size` - размер шрифта body

### 🔍 **Изменения в реальном времени:**
- Любые изменения `font-size` через JavaScript
- Изменения CSS переменных
- Изменения стилей элементов
- Изменения `document.documentElement.style`

## Ожидаемое поведение:

### ✅ **Правильно:**
```
🔍 Initial state:
📏 Header H1 font-size: 2.5rem
📏 Nav link 0 font-size: 0.9rem
📏 Root font-size: 16px
📏 Body font-size: 16px

🔍 After DOMContentLoaded:
📏 Header H1 font-size: 2.5rem
📏 Nav link 0 font-size: 0.9rem
📏 Root font-size: 16px
📏 Body font-size: 16px

🔍 After window load:
📏 Header H1 font-size: 2.5rem
📏 Nav link 0 font-size: 0.9rem
📏 Root font-size: 16px
📏 Body font-size: 16px
```

### ❌ **Проблема (если есть):**
```
🔍 Font-size being set via setProperty: font-size = 1.2rem on [object HTMLElement]
🔍 Document element style being set: font-size: 14px
```

## Как интерпретировать результаты:

1. **Если размеры одинаковые** на всех этапах - проблема решена ✅
2. **Если размеры меняются** - дебаг покажет, какой код это делает 🔍
3. **Если есть ошибки** - дебаг покажет, где именно происходит изменение 🚨

## Удаление дебага:

После решения проблемы удалите:
- `scripts/debug-font-sizes.js`
- Строку `<script defer src="scripts/debug-font-sizes.js"></script>` из `index.html`
- Этот файл `DEBUG_INSTRUCTIONS.md`
