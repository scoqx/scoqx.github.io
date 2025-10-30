# Интеграция xstats1 в SuperHUD Editor

## Что нужно сделать:

### В superhud-tools.html во вкладке "Клиент":

1. **После запуска Q3VM клиента**, выполни в консоли браузера (F12):

```javascript
// 1. Подключить эмулятор сервера к QVM syscalls
const q3vmClient = getQ3VMClientV2();
if (q3vmClient && q3vmClient.syscalls) {
    // Подключаем syscalls к эмулятору
    if (window.serverQVMBridge) {
        window.serverQVMBridge.connect(globalQ3Server, q3vmClient.syscalls);
        console.log('✓ Мост подключен!');
    }
}
```

2. **Отправить команду xstats1:**

```javascript
// Отправить xstats1 для игрока 0
globalQ3Server.sendXStats1(0, 0);
```

3. **Вызвать обработку в QVM:**

```javascript
// Получить последнюю команду
const seq = q3vmClient.syscalls.serverCommandSequence;

// Вызвать vmMain для обработки команды
if (q3vmClient.vm && q3vmClient.vm.vmMain) {
    const serverTime = Date.now() - q3vmClient.syscalls.startTime;
    q3vmClient.vm.vmMain(3, serverTime, 0, seq);
}
```

4. **QVM выполнит:**
   - `CG_ExecuteNewServerCommands()`
   - `trap_GetServerCommand()` - получит команду
   - `CG_ServerCommand()` - распарсит
   - `CG_OSPPrintXStats()` - обработает xstats1
   - `CG_Printf()` → `trap_Print()` - выведет в консоль

## Автоматический вариант:

Добавь кнопку в superhud-tools.html во вкладку "Клиент":

```html
<button onclick="testXStats1()" class="btn-secondary" style="width: 100%;">
    📊 Тест xstats1
</button>
```

И функцию:

```javascript
window.testXStats1 = function() {
    const q3vmClient = getQ3VMClientV2();
    
    if (!q3vmClient) {
        console.error('QVM не запущен');
        return;
    }
    
    // Подключить мост если не подключен
    if (!window.serverQVMBridge || !window.serverQVMBridge.isConnected) {
        if (window.serverQVMBridge && q3vmClient.syscalls) {
            window.serverQVMBridge.connect(globalQ3Server, q3vmClient.syscalls);
        }
    }
    
    // Отправить команду
    globalQ3Server.sendXStats1(0, 0);
    
    // Вызвать обработку в QVM
    setTimeout(() => {
        const seq = q3vmClient.syscalls.serverCommandSequence;
        const serverTime = Date.now() - q3vmClient.syscalls.startTime;
        
        if (q3vmClient.vm && q3vmClient.vm.vmMain) {
            q3vmClient.vm.vmMain(3, serverTime, 0, seq);
            console.log('✓ Команда отправлена в QVM');
        }
    }, 100);
};
```

## Проверка результата:

После вызова ты должен увидеть в консоли:

```
[QVM Print] 
Accuracy info for: TestWarrior

Weapon          Accrcy Hits/Atts Kills Deaths Pickup Drops
----------------------------------------------------------
Gauntlet     :   45.5%   91/200      5      3      2     1
...

Damage Given:  1847  Armor Taken :   342
...
```

Это значит что настоящий QVM обработал команду!



