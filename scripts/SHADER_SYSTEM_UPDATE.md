# Обновление системы шейдеров SuperHUD Tools

## Дата обновления: 25 октября 2025

## Обзор изменений

Система шейдеров была полностью переработана для соответствия архитектуре рендера Quake 3 Engine. Теперь шейдеры правильно сохраняют имена текстур и параметры для каждого stage.

## Ключевые изменения

### 1. Структура данных шейдера (shader_t)

Теперь следует структуре из `tr_local.h` движка Quake 3:

```javascript
const shader = {
    name: string,              // Имя шейдера (game path)
    path: string,              // Путь к файлу .shader
    loaded: boolean,
    content: string,
    
    // Массив stages
    stages: [
        {
            active: true,
            // Текстурные bundles (2 bundle как в Q3)
            bundle: [
                {
                    image: [],                    // Массив текстур
                    numImageAnimations: 0,
                    imageAnimationSpeed: 0,
                    tcGen: 'TCGEN_TEXTURE',
                    texMods: [],
                    numTexMods: 0,
                    lightmap: -1,
                    isVideoMap: false,
                    // ...
                },
                { /* bundle[1] */ }
            ],
            // Параметры цвета и смешивания
            rgbGen: 'CGEN_IDENTITY',
            alphaGen: 'AGEN_IDENTITY',
            blendSrc: 'GL_ONE',
            blendDst: 'GL_ZERO',
            // ...
        }
    ],
    
    effects: {
        deform: null,
        cull: 'front',
        nopicmip: false,
        nomipmaps: false
    },
    
    properties: {
        size: 0,
        lineCount: 0,
        complexity: 'simple'
    }
}
```

### 2. Парсинг текстур в stages

#### До:
- Текстуры хранились только в `stage.map`
- Не поддерживались `animMap`
- Не было структуры `textureBundle`

#### После:
- Текстуры хранятся в `stage.bundle[0].image[]`
- Поддержка `animMap` с несколькими текстурами
- Правильная структура `textureBundle` как в Quake 3
- Сохраняются все параметры: `tcGen`, `tcMod`, `lightmap`, и т.д.

### 3. Улучшенный парсинг команд

Реализован полный парсинг команд stage согласно `ParseStage()` из `tr_shader.c`:

- ✅ `map <texture>` - сохраняется в `bundle[0].image[0]`
- ✅ `clampmap <texture>` - с флагом clamp
- ✅ `animMap <freq> <img1> <img2>...` - массив анимированных текстур
- ✅ `blendFunc` - парсинг add/filter/blend и GL_* констант
- ✅ `rgbGen` / `alphaGen` - конвертация в CGEN_* / AGEN_*
- ✅ `tcGen` - конвертация в TCGEN_*
- ✅ `tcMod` - массив модификаторов
- ✅ `$lightmap` - специальная обработка lightmap текстур
- ✅ `depthFunc`, `alphaFunc`, `detail`, и др.

### 4. Улучшенная визуализация

#### Новый рендеринг stage:
- Показывает имена всех текстур из `bundle[0].image[]`
- Отображает количество кадров анимации и FPS
- Цветовая кодировка параметров (map, tcGen, tcMod, blend)
- Визуальные индикаторы: аддитивный блендинг, анимация, detail
- Компактное отображение с автоматическим сокращением длинных путей

#### Shader Summary:
- Подсчет уникальных текстур из всех bundles
- Отображение первой текстуры
- Информация о сложности и эффектах

#### Список шейдеров:
- Группировка по файлам .shader
- Подсчет уникальных текстур для каждого шейдера
- Показ первой текстуры в предпросмотре
- Цветовая кодировка информации

## Примеры правильного сохранения

### Пример 1: Простой шейдер

```
gfx/2d/crosshair1
{
    nopicmip
    {
        map gfx/2d/crosshair1.tga
        blendFunc GL_SRC_ALPHA GL_ONE_MINUS_SRC_ALPHA
        rgbGen vertex
    }
}
```

Сохраняется как:
```javascript
stages: [{
    bundle: [{
        image: ['gfx/2d/crosshair1.tga'],
        numImageAnimations: 1,
        tcGen: 'TCGEN_TEXTURE'
    }],
    blendSrc: 'GL_SRC_ALPHA',
    blendDst: 'GL_ONE_MINUS_SRC_ALPHA',
    rgbGen: 'CGEN_VERTEX'
}]
```

### Пример 2: Анимированный шейдер

```
textures/effects/frozen
{
    deformvertexes wave 100 sin 3 0 0 0
    {
        map textures/effects/frozen.tga
        blendFunc GL_ONE GL_ONE
        tcGen environment
        tcmod rotate 30
        tcmod scroll 1 .1
        rgbGen entity
    }
}
```

Сохраняется как:
```javascript
effects: {
    deform: 'wave 100 sin 3 0 0 0'
},
stages: [{
    bundle: [{
        image: ['textures/effects/frozen.tga'],
        numImageAnimations: 1,
        tcGen: 'TCGEN_ENVIRONMENT',
        texMods: ['rotate 30', 'scroll 1 .1'],
        numTexMods: 2
    }],
    blendSrc: 'GL_ONE',
    blendDst: 'GL_ONE',
    rgbGen: 'CGEN_ENTITY'
}]
```

### Пример 3: Анимированная текстура (animMap)

```
gfx/effects/explosion
{
    {
        animMap 10 gfx/exp1.tga gfx/exp2.tga gfx/exp3.tga
        blendFunc add
    }
}
```

Сохраняется как:
```javascript
stages: [{
    bundle: [{
        image: ['gfx/exp1.tga', 'gfx/exp2.tga', 'gfx/exp3.tga'],
        numImageAnimations: 3,
        imageAnimationSpeed: 10,
        tcGen: 'TCGEN_TEXTURE'
    }],
    blendSrc: 'GL_ONE',
    blendDst: 'GL_ONE'
}]
```

## Тестирование

### Как протестировать изменения:

1. **Откройте superhud-tools.html**
2. **Перейдите на вкладку "Система Шейдеров"**
3. **Нажмите "Инициализировать шейдеры"** - загрузит шейдеры из PK3
4. **Нажмите "Загрузить все шейдеры"** - парсит все .shader файлы
5. **Проверьте список шейдеров** - должны показываться:
   - Количество stages
   - Количество уникальных текстур
   - Имя первой текстуры

6. **Кликните на любой шейдер** для отображения:
   - Каждый stage с его параметрами
   - Имена текстур из bundle[0].image[]
   - tcGen, tcMod, blend функции
   - Shader Summary с подсчетом текстур

### Ожидаемые результаты:

✅ Шейдеры правильно парсятся из .shader файлов
✅ Текстуры сохраняются в bundle[0].image[] для каждого stage
✅ animMap корректно сохраняет массив текстур
✅ Визуализация показывает все параметры stage
✅ Подсчет уникальных текстур работает корректно

## Соответствие Quake 3 Engine

Новая структура полностью соответствует:

- ✅ `shader_t` из `code/renderer/tr_local.h`
- ✅ `shaderStage_t` из `code/renderer/tr_local.h`
- ✅ `textureBundle_t` из `code/renderer/tr_local.h`
- ✅ Парсинг команд из `code/renderer/tr_shader.c`

## Обратная совместимость

Для обратной совместимости сохранены старые поля:
- `stage.map` - копия `bundle[0].image[0]`
- `stage.blendFunc` - текстовое представление blend режима
- `stage.tcMod` - для старого кода, дублирует `bundle[0].texMods`

## Файлы изменены

- ✅ `scripts/superhud-tools.js` - полная переработка системы шейдеров

## Следующие шаги

1. ✅ Структура данных - ГОТОВО
2. ✅ Парсинг шейдеров - ГОТОВО
3. ✅ Функции рендеринга - ГОТОВО
4. ⏳ Тестирование - требует проверки пользователя

## Автор

Реализовано в соответствии с архитектурой Quake 3 Engine (id Software)
Дата: 25 октября 2025



