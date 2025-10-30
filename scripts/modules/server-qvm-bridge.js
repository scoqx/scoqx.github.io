/**
 * Server-QVM Bridge
 * Мост между эмулятором сервера и клиентским QVM
 * 
 * Передает серверные команды от эмулятора в QVM через syscalls
 */

class ServerQVMBridge {
    constructor() {
        this.serverEmulator = null;
        this.qvmSyscalls = null;
        this.isConnected = false;
    }
    
    /**
     * Подключить эмулятор сервера и syscalls QVM
     */
    connect(serverEmulator, qvmSyscalls) {
        this.serverEmulator = serverEmulator;
        this.qvmSyscalls = qvmSyscalls;
        
        if (!serverEmulator || !qvmSyscalls) {
            console.error('[Bridge] ✗ Не удалось подключить: serverEmulator или qvmSyscalls не найдены');
            return false;
        }
        
        // Установить callback на серверные команды
        serverEmulator.setServerCommandCallback((command) => {
            this.onServerCommand(command);
        });
        
        // Установить callback на снапшоты
        serverEmulator.onSnapshot = (snapshot, connectedClients) => {
            this.onSnapshot(snapshot, connectedClients);
        };
        
        this.isConnected = true;
        console.log('[Bridge] ✓ Мост Сервер→QVM установлен (команды + снапшоты)');
        return true;
    }
    
    /**
     * Обработка серверной команды
     */
    onServerCommand(command) {
        if (!this.qvmSyscalls) return;
        
        console.log(`[Bridge] 🌉 Сервер → QVM: команда #${command.sequence}`);
        console.log(`[Bridge] → ${command.command.substring(0, 80)}${command.command.length > 80 ? '...' : ''}`);
        
        // Передать команду в QVM через syscalls (УЖЕ НЕ инкрементирует снапшот!)
        const sequence = this.qvmSyscalls.addServerCommand(command.command);
        
        // Уведомить QVM о новой команде (если QVM имеет функцию обработки)
        if (window.cgameVM && window.cgameVM.executeServerCommands) {
            window.cgameVM.executeServerCommands(sequence);
        }
    }
    
    /**
     * Обработка снапшота от сервера
     */
    onSnapshot(snapshot, connectedClients) {
        if (!this.qvmSyscalls) {
            console.log('[Bridge] ⚠️ qvmSyscalls не установлены!');
            return;
        }
        
        // КРИТИЧНО: Синхронизируем serverCommandSequence из qvmSyscalls в снапшот!
        // Потому что команды могут быть добавлены напрямую через qvmSyscalls.addServerCommand()
        if (this.qvmSyscalls.serverCommandSequence > 0) {
            snapshot.serverCommandSequence = this.qvmSyscalls.serverCommandSequence;
        }
        
        // Логируем только снапшоты с командами
        if (snapshot?.serverCommandSequence > 0) {
            console.log(`[Bridge] 🔵 Снапшот с командами! serverTime=${snapshot.serverTime}ms, seq=${snapshot.serverCommandSequence}`);
        }
        
        // Передать снапшот в QVM через syscalls
        this.qvmSyscalls.receiveSnapshot(snapshot);
    }
    
    /**
     * Отправить тестовую команду
     */
    sendTestCommand(commandString) {
        if (!this.serverEmulator) {
            console.error('[Bridge] Эмулятор не подключен');
            return;
        }
        
        // Отправить всем подключенным клиентам
        this.serverEmulator.sendServerCommandToAll(commandString);
    }
}

// Глобальный экземпляр моста
window.serverQVMBridge = new ServerQVMBridge();

// Функция для автоматической установки моста
window.connectServerToQVM = function() {
    if (!window.serverEmulator) {
        console.error('[Bridge] Эмулятор сервера не найден. Загрузите сначала q3-server-emulator.js');
        return false;
    }
    
    if (!window.qvmSyscalls) {
        console.error('[Bridge] QVM Syscalls не найдены. Убедитесь, что QVM инициализирован');
        return false;
    }
    
    return window.serverQVMBridge.connect(window.serverEmulator, window.qvmSyscalls);
};

console.log('[Server-QVM Bridge] Модуль загружен ✓');

