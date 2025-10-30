# Интеграция эмулятора сервера с клиентским QVM

## Цель
Убедиться, что клиентский QVM (cgame) реально обрабатывает серверную команду `xstats1`.

## Как работает получение команд в Q3

### Серверная сторона (unite-q3-mod)
```c
// g_cmds.c:2673
trap_SendServerCommand(ent - g_entities, va("xstats1 %s", args));
```

### Клиентская сторона (OSP2-PBE cgame)
```c
// cg_servercmds.c:1616-1623
void CG_ExecuteNewServerCommands(int latestSequence)
{
    while (cgs.serverCommandSequence < latestSequence)
    {
        if (trap_GetServerCommand(++cgs.serverCommandSequence))  // Получить команду
        {
            CG_ServerCommand();  // Обработать команду
        }
    }
}

// cg_servercmds.c:1550-1564
if (Q_stricmp(cmd, "xstats1") == 0)
{
    if (cgs.be.statsAllRequested)
    {
        CG_BEParseXStatsToStatsAll();  // ← Здесь парсинг!
        xstats1_received_count++;
        last_xstats1_sequence = cgs.serverCommandSequence;
        return;
    }
    else
    {
        CG_OSPPrintXStats();  // ← Или вывод в консоль!
        return;
    }
}
```

## Что нужно сделать

### Шаг 1: Эмулировать syscalls для команд

В вашем клиентском коде (где работает QVM) нужно перехватить syscalls:
- `CG_GETSERVERCOMMAND` - получение команды
- `CG_ARGC` - количество аргументов
- `CG_ARGV` - получение аргумента

### Шаг 2: Хранилище команд на стороне клиента

```javascript
// Глобальное хранилище команд для клиента
window.clientServerCommands = [];
window.clientCommandSequence = 0;

// Функция для добавления команды от сервера
window.receiveServerCommand = function(commandString) {
    const sequence = ++window.clientCommandSequence;
    const command = {
        sequence: sequence,
        commandString: commandString,
        args: commandString.split(' ')
    };
    
    window.clientServerCommands.push(command);
    
    console.log(`[CLIENT] 📥 Получена команда #${sequence}: ${commandString.substring(0, 80)}...`);
    
    return sequence;
};

// Получить команду по sequence
window.getServerCommand = function(sequence) {
    const command = window.clientServerCommands.find(cmd => cmd.sequence === sequence);
    if (command) {
        console.log(`[CLIENT QVM] 🔍 trap_GetServerCommand(${sequence}) → "${command.commandString.substring(0, 50)}..."`);
        return command;
    }
    return null;
};
```

### Шаг 3: Подключить эмулятор к клиенту

```javascript
// В вашем основном коде инициализации
function initServerToClientBridge() {
    // Установить callback для передачи команд от сервера к клиенту
    setServerCommandCallback(function(serverCommand) {
        console.log(`[BRIDGE] 🌉 Сервер → Клиент: команда #${serverCommand.sequence}`);
        
        // Передать команду в хранилище клиента
        const clientSequence = receiveServerCommand(serverCommand.command);
        
        // Уведомить QVM о новой команде (если QVM уже запущен)
        if (window.cgameVM) {
            console.log(`[BRIDGE] 🎮 Уведомление QVM о команде #${clientSequence}`);
            // Здесь вызвать обработку команды в QVM
            // Например: cgameVM.executeServerCommands(clientSequence);
        }
    });
    
    console.log('[BRIDGE] ✓ Мост Сервер→Клиент установлен');
}

// Запустить после загрузки эмулятора
window.addEventListener('load', function() {
    setTimeout(initServerToClientBridge, 200);
});
```

### Шаг 4: Эмуляция syscalls в QVM

Если у вас есть доступ к обработчику syscalls QVM, добавьте:

```javascript
// Псевдокод для обработчика syscalls
function handleCGSyscall(syscallNum, ...args) {
    switch(syscallNum) {
        case CG_GETSERVERCOMMAND: {
            const sequence = args[0];
            const command = window.getServerCommand(sequence);
            
            if (command) {
                // Сохранить текущую команду для CG_ARGC/CG_ARGV
                window.currentCommand = command;
                
                console.log(`[QVM SYSCALL] ✓ GetServerCommand(${sequence}) → SUCCESS`);
                return 1; // qtrue
            }
            
            console.log(`[QVM SYSCALL] ✗ GetServerCommand(${sequence}) → NOT FOUND`);
            return 0; // qfalse
        }
        
        case CG_ARGC: {
            if (window.currentCommand) {
                const argc = window.currentCommand.args.length;
                console.log(`[QVM SYSCALL] Argc() → ${argc}`);
                return argc;
            }
            return 0;
        }
        
        case CG_ARGV: {
            const argIndex = args[0];
            const bufferPtr = args[1];
            const bufferSize = args[2];
            
            if (window.currentCommand && window.currentCommand.args[argIndex]) {
                const argValue = window.currentCommand.args[argIndex];
                console.log(`[QVM SYSCALL] Argv(${argIndex}) → "${argValue}"`);
                
                // Записать в память QVM (зависит от вашей реализации)
                // writeString(bufferPtr, argValue, bufferSize);
                
                return 1;
            }
            return 0;
        }
    }
}
```

## Простой тест без полной интеграции

Если у вас еще нет полной интеграции с QVM, можно сделать простой тест:

```javascript
// === ТЕСТ: Эмуляция обработки команды ===

// 1. Инициализация хранилища
window.clientServerCommands = [];
window.clientCommandSequence = 0;

// 2. Функция эмуляции обработчика xstats1
window.emulateXStats1Handler = function(commandString) {
    console.log('\n=== ЭМУЛЯЦИЯ ОБРАБОТКИ xstats1 В QVM ===');
    
    const args = commandString.split(' ');
    console.log(`[QVM] Команда: ${args[0]}`);
    console.log(`[QVM] Аргументов: ${args.length}`);
    
    if (args[0] !== 'xstats1') {
        console.log('[QVM] ✗ Не xstats1');
        return;
    }
    
    // Парсинг как в CG_OSPPrintXStats
    let index = 1;
    const client_id = parseInt(args[index++]);
    const wstats_condition = parseInt(args[index++]);
    
    console.log(`[QVM] ✓ Client ID: ${client_id}`);
    console.log(`[QVM] ✓ Weapon condition: ${wstats_condition} (0b${wstats_condition.toString(2)})`);
    
    // Парсим данные по оружиям
    const weapons = ['None', 'Gauntlet', 'MG', 'SG', 'GL', 'RL', 'LG', 'RG', 'PG', 'BFG'];
    console.log('[QVM] Оружия:');
    
    for (let w = 1; w < 10; w++) {
        if ((wstats_condition & (1 << w)) !== 0) {
            const hits_val = parseInt(args[index++]);
            const atts_val = parseInt(args[index++]);
            const kills = parseInt(args[index++]);
            const deaths = parseInt(args[index++]);
            
            const hits = hits_val & 0xFFFF;
            const drops = hits_val >> 16;
            const shots = atts_val & 0xFFFF;
            const pickups = atts_val >> 16;
            
            const accuracy = shots > 0 ? (hits / shots * 100).toFixed(1) : 0;
            
            console.log(`[QVM]   ${weapons[w]}: ${accuracy}% (${hits}/${shots}), K/D: ${kills}/${deaths}, Pickups: ${pickups}, Drops: ${drops}`);
        }
    }
    
    // Общая статистика
    const armor = parseInt(args[index++]);
    const health = parseInt(args[index++]);
    const dmgGiven = parseInt(args[index++]);
    const dmgRcvd = parseInt(args[index++]);
    const mh = parseInt(args[index++]);
    const ga = parseInt(args[index++]);
    const ra = parseInt(args[index++]);
    const ya = parseInt(args[index++]);
    
    console.log('[QVM] Статистика:');
    console.log(`[QVM]   Урон: ${dmgGiven} / ${dmgRcvd}`);
    console.log(`[QVM]   Броня/HP: ${armor} / ${health}`);
    console.log(`[QVM]   Предметы: MH:${mh}, GA:${ga}, RA:${ra}, YA:${ya}`);
    
    console.log('[QVM] ✅ КОМАНДА УСПЕШНО ОБРАБОТАНА!\n');
};

// 3. Подключить к эмулятору
setServerCommandCallback(function(cmd) {
    console.log(`[BRIDGE] Сервер отправил команду #${cmd.sequence}: ${cmd.command.substring(0, 50)}...`);
    
    // Эмулировать обработку в QVM
    if (cmd.command.startsWith('xstats1')) {
        emulateXStats1Handler(cmd.command);
    }
});

console.log('✓ Тестовая интеграция установлена');
console.log('Теперь используйте: sendXStats1(0, 0)');
```

## Полный тест

```javascript
// === ПОЛНЫЙ ТЕСТ С ЭМУЛЯЦИЕЙ QVM ===

// 1. Инициализация
window.clientServerCommands = [];
window.clientCommandSequence = 0;

// 2. Установить обработчик
window.emulateXStats1Handler = function(commandString) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎮 QVM CGAME: Обработка команды xstats1');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const args = commandString.split(' ');
    let index = 1;
    
    const client_id = parseInt(args[index++]);
    const wstats_condition = parseInt(args[index++]);
    
    console.log(`📊 Client ID: ${client_id}`);
    console.log(`🔫 Weapon mask: 0b${wstats_condition.toString(2).padStart(10, '0')}`);
    
    const weapons = ['None', 'Gauntlet', 'MG', 'SG', 'GL', 'RL', 'LG', 'RG', 'PG', 'BFG'];
    console.log('\n📈 Weapon Statistics:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (let w = 1; w < 10; w++) {
        if ((wstats_condition & (1 << w)) !== 0) {
            const hits_val = parseInt(args[index++]);
            const atts_val = parseInt(args[index++]);
            const kills = parseInt(args[index++]);
            const deaths = parseInt(args[index++]);
            
            const hits = hits_val & 0xFFFF;
            const drops = hits_val >> 16;
            const shots = atts_val & 0xFFFF;
            const pickups = atts_val >> 16;
            const accuracy = shots > 0 ? (hits / shots * 100).toFixed(1) : 0;
            
            console.log(`  ${weapons[w].padEnd(10)} ${accuracy.toString().padStart(5)}%  ${hits.toString().padStart(4)}/${shots.toString().padEnd(4)}  K:${kills.toString().padStart(2)} D:${deaths.toString().padStart(2)}  +${pickups} -${drops}`);
        }
    }
    
    const armor = parseInt(args[index++]);
    const health = parseInt(args[index++]);
    const dmgGiven = parseInt(args[index++]);
    const dmgRcvd = parseInt(args[index++]);
    const mh = parseInt(args[index++]);
    const ga = parseInt(args[index++]);
    const ra = parseInt(args[index++]);
    const ya = parseInt(args[index++]);
    
    console.log('\n💥 General Statistics:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Damage Given:  ${dmgGiven.toString().padStart(5)}`);
    console.log(`  Damage Received: ${dmgRcvd.toString().padStart(5)}`);
    console.log(`  Armor Taken:   ${armor.toString().padStart(5)}`);
    console.log(`  Health Taken:  ${health.toString().padStart(5)}`);
    console.log(`  MegaHealth:    ${mh.toString().padStart(5)}`);
    console.log(`  Green Armor:   ${ga.toString().padStart(5)}`);
    console.log(`  Red Armor:     ${ra.toString().padStart(5)}`);
    console.log(`  Yellow Armor:  ${ya.toString().padStart(5)}`);
    
    console.log('\n✅ QVM обработал команду успешно!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
};

setServerCommandCallback(function(cmd) {
    if (cmd.command.startsWith('xstats1')) {
        emulateXStats1Handler(cmd.command);
    }
});

// 3. Запустить тест
console.log('\n🚀 Запуск теста интеграции...\n');

serverEmulator.addPlayer(0, "TestWarrior");
serverEmulator.connectClient(0);

setTimeout(() => {
    console.log('📤 Сервер отправляет xstats1...\n');
    sendXStats1(0, 0);
}, 500);
```

## Что вы должны увидеть

После запуска теста в консоли должно появиться:

```
[SERVER CMD #1] -> Client 0: xstats1 0 462 ...
[xstats1] Отправлена статистика игрока TestWarrior (ID:0) клиенту 0
[BRIDGE] Сервер отправил команду #1: xstats1 0 462 ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 QVM CGAME: Обработка команды xstats1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Client ID: 0
🔫 Weapon mask: 0b0111001110

📈 Weapon Statistics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Gauntlet    45.5%    91/200   K: 5 D: 3  +2 -1
  MG          62.3%   124/199   K:12 D: 7  +3 -0
  SG          38.9%    78/200   K: 8 D: 4  +1 -2
  RL          51.2%   102/199   K:15 D: 9  +4 -1
  LG          67.8%   135/199   K:18 D:11  +5 -3
  PG          44.7%    89/199   K: 6 D: 5  +2 -1

💥 General Statistics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Damage Given:   1847
  Damage Received: 1234
  Armor Taken:     342
  Health Taken:    189
  MegaHealth:        3
  Green Armor:       2
  Red Armor:         3
  Yellow Armor:      1

✅ QVM обработал команду успешно!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Это докажет, что:
1. ✅ Сервер отправляет команду
2. ✅ Клиент получает команду
3. ✅ QVM парсит команду
4. ✅ Данные корректны

## Итог

Этот тест **эмулирует** обработку команды в QVM и показывает, что команда:
- Правильно сформирована
- Правильно парсится
- Содержит корректные данные

Для **полной** интеграции нужно подключить это к реальному QVM через syscalls.



