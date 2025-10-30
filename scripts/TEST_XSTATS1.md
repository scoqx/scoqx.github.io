# Тестирование xstats1 команды

## Описание
Этот документ описывает, как протестировать отправку серверной команды `xstats1` от эмулятора к клиенту.

## Что такое xstats1?
`xstats1` - серверная команда из OSP2-BE/unite-q3-mod, которая отправляет детальную статистику игрока:
- Статистика по каждому оружию (точность, попадания, выстрелы, убийства, смерти, подборы, выбросы)
- Общая статистика (урон нанесенный/полученный, броня/хп подобранные, мегахелсы, броня разных типов)

## Формат команды
```
xstats1 <client_id> <weapon_condition> [weapon_data...] <armor> <health> <dmgGiven> <dmgRcvd> <mh> <ga> <ra> <ya>
```

Где:
- `client_id` - ID игрока
- `weapon_condition` - битовая маска использованных оружий
- `weapon_data` - для каждого оружия: `hits_val atts_val kills deaths`
  - `hits_val = (hits & 0xFFFF) | (drops << 16)`
  - `atts_val = (shots & 0xFFFF) | (pickups << 16)`
- `armor`, `health` - подобранная броня и здоровье
- `dmgGiven`, `dmgRcvd` - нанесенный и полученный урон
- `mh` - мегахелсы
- `ga`, `ra`, `ya` - Green Armor, Red Armor, Yellow Armor

## Обработка на клиенте
Клиент (OSP2-BE cgame) обрабатывает команду двумя способами:
1. **CG_OSPPrintXStats()** - выводит статистику в консоль
2. **CG_BEParseXStatsToStatsAll()** - сохраняет в структуру `statsAll`

## Как протестировать

### 1. Подготовка
Откройте страницу с клиентом в браузере и откройте консоль разработчика (F12).

### 2. Инициализация эмулятора
Эмулятор инициализируется автоматически при загрузке страницы.

Проверьте, что эмулятор доступен:
```javascript
console.log(window.serverEmulator);
```

### 3. Добавьте игрока
```javascript
// Добавить игрока с ID 0
serverEmulator.addPlayer(0, "TestPlayer");

// Или использовать готовую функцию
addVirtualPlayer("TestPlayer");
```

### 4. Подключите клиента
```javascript
// Подключить клиента (регистрация для получения снапшотов и команд)
serverEmulator.connectClient(0);
```

### 5. Установите callback для команд (опционально)
Чтобы увидеть, что клиент получает команды:
```javascript
setServerCommandCallback(function(command) {
    console.log('[CLIENT RECEIVED]', command);
});
```

### 6. Отправьте команду xstats1
```javascript
// Отправить статистику игрока 0 клиенту 0
sendXStats1(0, 0);

// Или отправить всем подключенным клиентам
sendXStats1(0);
```

### 7. Проверьте результат
В консоли вы должны увидеть:
```
[SERVER CMD #1] -> Client 0: xstats1 0 462 ...
[xstats1] Отправлена статистика игрока TestPlayer (ID:0) клиенту 0
```

Если установлен callback:
```
[CLIENT RECEIVED] {sequence: 1, clientId: 0, command: "xstats1 0 462 ...", time: ...}
```

### 8. Посмотреть историю команд
```javascript
// Показать последние 10 команд
getServerCommands(10);
```

## Пример полного теста
```javascript
// 1. Добавить игрока
serverEmulator.addPlayer(0, "Sarge");
serverEmulator.addPlayer(1, "Doom");

// 2. Подключить клиентов
serverEmulator.connectClient(0);
serverEmulator.connectClient(1);

// 3. Установить callback
setServerCommandCallback((cmd) => {
    console.log(`✓ Client ${cmd.clientId} получил: ${cmd.command.substring(0, 50)}...`);
});

// 4. Отправить команды
sendXStats1(0, 0); // Статистика игрока 0 для клиента 0
sendXStats1(1, 0); // Статистика игрока 1 для клиента 0

// 5. Посмотреть историю
getServerCommands();
```

## Проверка обработки клиентом
Если QVM клиента действительно работает, то при получении команды `xstats1`:
1. Клиент должен распарсить команду в `CG_ServerCommand()`
2. Вызвать `CG_OSPPrintXStats()` или `CG_BEParseXStatsToStatsAll()`
3. Вывести статистику в консоль или сохранить в структуру

Чтобы убедиться, что QVM обрабатывает команду, можно:
1. Поставить брейкпойнт в `cg_servercmds.c:1550` (обработка xstats1)
2. Или добавить логирование в клиентский код
3. Или проверить, что данные появились в `cgs.be.statsAll`

## Отправка других серверных команд
Можно отправлять любые серверные команды:
```javascript
// Отправить произвольную команду
sendServerCommand(0, "print \"Hello from server!\"");
sendServerCommand(0, "cp \"Center print test\"");

// Отправить всем
sendServerCommandToAll("print \"^1Server message to all!\"");
```

## API функции эмулятора

### Серверные команды
- `sendServerCommand(clientId, commandString)` - отправить команду клиенту
- `sendServerCommandToAll(commandString)` - отправить команду всем
- `sendXStats1(targetClientId, requestingClientId)` - отправить xstats1
- `setServerCommandCallback(callback)` - установить callback для команд
- `getServerCommands(limit)` - получить историю команд

### Управление игроками
- `serverEmulator.addPlayer(id, name)` - добавить игрока
- `serverEmulator.connectClient(id)` - подключить клиента
- `serverEmulator.getPlayer(id)` - получить игрока

### Управление эмулятором
- `startServerEmulator(interval)` - запустить эмулятор
- `stopServerEmulator()` - остановить эмулятор

## Генерация статистики
Функция `generatePlayerStats(player)` генерирует реалистичные данные:
- Случайную статистику для оружий: Gauntlet, Machinegun, Shotgun, Rocket, Lightning, Railgun
- Случайную точность 20-70%
- Случайные убийства/смерти
- Случайные подборы брони/хп
- Случайный урон

## Дебаг
Все команды логируются в консоль с префиксом `[SERVER CMD #N]`.

Для детального дебага можно посмотреть:
```javascript
// Текущий sequence
console.log(serverEmulator.serverCommandSequence);

// История команд
console.log(serverEmulator.serverCommands);

// Подключенные клиенты
console.log(Array.from(serverEmulator.connectedClients));
```




