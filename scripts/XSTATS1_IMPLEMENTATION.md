# Реализация серверных команд в Q3 Server Emulator

## Что было сделано

В эмулятор сервера добавлен полноценный механизм отправки серверных команд клиентам, включая реализацию команды `xstats1` из OSP2-BE/unite-q3-mod.

## Изменения в q3-server-emulator.js (v0.006)

### 1. Добавлена инфраструктура серверных команд

```javascript
// В конструкторе Q3ServerEmulator
this.serverCommandSequence = 0;           // Счетчик команд
this.serverCommands = [];                 // История команд (до 100)
this.onServerCommand = null;              // Callback для клиента
```

### 2. Базовые функции отправки команд

#### `sendServerCommand(clientId, commandString)`
Отправляет серверную команду конкретному клиенту.

**Параметры:**
- `clientId` - ID клиента-получателя
- `commandString` - строка команды (например, `"print \"Hello\""`)

**Возвращает:** объект команды с полями `{sequence, clientId, command, time}`

**Пример:**
```javascript
serverEmulator.sendServerCommand(0, 'print "^2Hello from server!"');
```

#### `sendServerCommandToAll(commandString)`
Отправляет команду всем подключенным клиентам.

**Пример:**
```javascript
serverEmulator.sendServerCommandToAll('cp "Match starting!"');
```

### 3. Реализация команды xstats1

#### `sendXStats1(targetClientId, requestingClientId = null)`
Отправляет детальную статистику игрока.

**Параметры:**
- `targetClientId` - ID игрока, чью статистику отправляем
- `requestingClientId` - ID клиента-получателя (null = всем)

**Формат команды:**
```
xstats1 <client_id> <weapon_condition> [weapon_data...] <armor> <health> <dmgGiven> <dmgRcvd> <mh> <ga> <ra> <ya>
```

**Пример:**
```javascript
// Отправить статистику игрока 0 клиенту 0
serverEmulator.sendXStats1(0, 0);

// Отправить всем подключенным
serverEmulator.sendXStats1(0);
```

#### `generatePlayerStats(player)`
Генерирует реалистичные статистические данные для игрока.

**Генерируемые данные:**
- Статистика по 6 оружиям (Gauntlet, MG, SG, RL, LG, RG)
- Попадания/выстрелы с точностью 20-70%
- Убийства/смерти (0-20 / 0-15)
- Подборы/выбросы оружия (0-10 / 0-5)
- Урон нанесенный/полученный (500-2500 / 400-2200)
- Подобранная броня/хп (0-500 / 0-300)
- MegaHealth, Green/Red/Yellow Armor (0-5 / 0-3 / 0-4 / 0-2)

**Формат данных по оружию:**
```javascript
hits_val = (hits & 0xFFFF) | (drops << 16)
atts_val = (shots & 0xFFFF) | (pickups << 16)
```
Совпадает с форматом unite-q3-mod (g_cmds.c:2651-2652).

### 4. Callback механизм

#### `setServerCommandCallback(callback)`
Устанавливает функцию, которая будет вызываться при каждой отправке команды.

**Пример:**
```javascript
serverEmulator.setServerCommandCallback(function(command) {
    console.log('Command sent:', command);
    // Здесь можно передать команду в QVM клиента
});
```

## API для браузера

Все функции доступны глобально через `window`:

```javascript
// Отправка команд
sendServerCommand(clientId, commandString)
sendServerCommandToAll(commandString)
sendXStats1(targetClientId, requestingClientId)

// Управление
setServerCommandCallback(callback)
getServerCommands(limit)  // Показать историю в консоли
```

## Как использовать

### Вариант 1: Из консоли браузера

```javascript
// 1. Добавить игрока
serverEmulator.addPlayer(0, "Sarge");

// 2. Подключить клиента
serverEmulator.connectClient(0);

// 3. Установить callback (опционально)
setServerCommandCallback((cmd) => {
    console.log('Получена команда:', cmd);
});

// 4. Отправить xstats1
sendXStats1(0, 0);

// 5. Посмотреть историю
getServerCommands(10);
```

### Вариант 2: Тестовая страница

Открыть `scripts/test-xstats1.html` в браузере.

Функции:
- ✅ Быстрый тест (автоматический)
- ✅ Добавление игроков
- ✅ Подключение/отключение клиентов
- ✅ Отправка xstats1
- ✅ Отправка произвольных команд
- ✅ Просмотр истории
- ✅ Цветная консоль с логами

## Проверка обработки клиентом

### Клиентская часть (OSP2-PBE cgame)

Команда обрабатывается в `cg_servercmds.c:1550`:

```c
if (Q_stricmp(cmd, "xstats1") == 0)
{
    if (cgs.be.statsAllRequested)
    {
        CG_BEParseXStatsToStatsAll();  // Сохранить в структуру
        ...
    }
    else
    {
        CG_OSPPrintXStats();  // Вывести в консоль
        ...
    }
}
```

### Как убедиться, что QVM обрабатывает команду

1. **Через логи клиента**: Если QVM работает, в консоли должен появиться вывод от `CG_OSPPrintXStats()`
2. **Через брейкпойнт**: Поставить точку останова в `cg_servercmds.c:1550`
3. **Через callback**: Проверить, что callback вызывается при отправке команды

## Структура данных xstats1

### Weapon condition (битовая маска)
```
Bit 1: Gauntlet
Bit 2: Machinegun
Bit 3: Shotgun
Bit 4: Grenade Launcher
Bit 5: Rocket Launcher
Bit 6: Lightning Gun
Bit 7: Railgun
Bit 8: Plasma Gun
Bit 9: BFG
```

### Weapon data (для каждого оружия)
```
hits_val  = (hits & 0xFFFF) | (drops << 16)
atts_val  = (shots & 0xFFFF) | (pickups << 16)
kills_val = kills
deaths_val = deaths
```

### General stats (в конце команды)
```
armor_taken    - подобрано брони
health_taken   - подобрано здоровья
damage_given   - нанесено урона
damage_rcvd    - получено урона
megahealth     - подобрано мегахелсов
green_armor    - подобрано GA
red_armor      - подобрано RA
yellow_armor   - подобрано YA
```

## Пример команды

```
xstats1 0 462 85983 163912 5 3 98371 147525 12 7 ...
```

Разбор:
- `0` - client_id игрока
- `462` - weapon_condition (0b111001110 = биты 1,2,3,5,6,8 = Gauntlet, MG, SG, RL, LG, PG)
- `85983` - hits_val для первого оружия (hits=65503, drops=1)
- `163912` - atts_val для первого оружия (shots=32968, pickups=2)
- `5` - kills
- `3` - deaths
- ... (остальные оружия)
- ... (общая статистика в конце)

## Совместимость

### Серверная часть
Формат команды **полностью совместим** с unite-q3-mod (g_cmds.c:2673).

### Клиентская часть
Формат команды **полностью совместим** с OSP2-BE (cg_servercmds.c:1550, cg_be_util.c:190).

## Дополнительные возможности

### Отправка других команд OSP2-BE
```javascript
sendServerCommand(0, 'cp "^1Center Print Test"');
sendServerCommand(0, 'print "^2Console message"');
sendServerCommand(0, 'scores');
sendServerCommand(0, 'map_restart');
```

### История команд
```javascript
// Последние 10 команд
getServerCommands(10);

// Все команды
console.log(serverEmulator.serverCommands);

// Текущий sequence
console.log(serverEmulator.serverCommandSequence);
```

## Debugging

Все команды логируются:
```
[SERVER CMD #1] -> Client 0: xstats1 0 462 85983 163912 ...
[xstats1] Отправлена статистика игрока TestPlayer (ID:0) клиенту 0
```

При установленном callback:
```
[CLIENT RECEIVED] {sequence: 1, clientId: 0, command: "xstats1 ...", time: ...}
```

## Файлы

- `scripts/modules/q3-server-emulator.js` - основной эмулятор (v0.006)
- `scripts/test-xstats1.html` - тестовая страница
- `scripts/TEST_XSTATS1.md` - детальная инструкция по тестированию
- `scripts/XSTATS1_IMPLEMENTATION.md` - этот файл

## Следующие шаги

1. **Интеграция с клиентом**: Подключить callback эмулятора к QVM клиента
2. **Другие команды**: Реализовать `specsinfo`, `astats`, `bstats` и др.
3. **Автоматическая отправка**: Отправлять xstats1 автоматически при определенных событиях
4. **UI**: Добавить UI элементы для отправки команд в основной интерфейс

## Заключение

Теперь можно полноценно тестировать обработку серверных команд клиентским QVM. Эмулятор генерирует реалистичные данные в правильном формате, полностью совместимом с оригинальными модами OSP2-BE и unite-q3-mod.



