// CFG Injector - extracts commands from source files and injects them into target config
(function() {
    'use strict';
    
    const sourceFilesInput = document.getElementById('sourceFiles');
    const targetFileInput = document.getElementById('targetFile');
    const processButton = document.getElementById('processButton');
    const sourceFileList = document.getElementById('sourceFileList');
    const targetFileList = document.getElementById('targetFileList');
    const statusMessage = document.getElementById('statusMessage');
    const previewContainer = document.getElementById('previewContainer');
    const previewContent = document.getElementById('previewContent');
    const sortPreviewButton = document.getElementById('sortPreviewButton');
    
    let sourceFiles = [];
    let targetFile = null;
    let excludedCommands = new Set(); // Commands excluded from processing
    let previewItems = []; // Store preview items for sorting
    let isPreviewSorted = false; // Track if preview is currently sorted
    let previewUpdateTimeout = null; // Debounce timer for preview updates
    
    // Check if we're on the tools page
    if (!sourceFilesInput || !targetFileInput || !processButton) {
        return;
    }
    
    // Update file list display
    function updateSourceFileList() {
        if (sourceFiles.length === 0) {
            sourceFileList.innerHTML = '';
            return;
        }
        
        const lang = document.documentElement.lang || 'en';
        const upText = '↑';
        const downText = '↓';
        const showControls = sourceFiles.length > 1; // Only show controls if more than 1 file
        
        sourceFileList.innerHTML = sourceFiles.map((file, index) => {
            const canMoveUp = index > 0;
            const canMoveDown = index < sourceFiles.length - 1;
            
            return `<div class="file-item" data-index="${index}">
                <span class="file-item-name">${escapeHtml(file.name)}</span>
                ${showControls ? `<div class="file-item-controls">
                    <button class="file-move-btn" data-action="up" data-index="${index}" ${!canMoveUp ? 'disabled' : ''} title="${lang === 'ru' ? 'Вверх' : 'Move up'}">${upText}</button>
                    <button class="file-move-btn" data-action="down" data-index="${index}" ${!canMoveDown ? 'disabled' : ''} title="${lang === 'ru' ? 'Вниз' : 'Move down'}">${downText}</button>
                </div>` : ''}
            </div>`;
        }).join('');
        
        // Attach event listeners to move buttons
        const moveButtons = sourceFileList.querySelectorAll('.file-move-btn');
        moveButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const index = parseInt(this.getAttribute('data-index'));
                const action = this.getAttribute('data-action');
                
                if (action === 'up' && index > 0) {
                    // Move file up
                    [sourceFiles[index - 1], sourceFiles[index]] = [sourceFiles[index], sourceFiles[index - 1]];
                    updateSourceFileList();
                    // Debounce preview update to avoid flickering
                    schedulePreviewUpdate();
                } else if (action === 'down' && index < sourceFiles.length - 1) {
                    // Move file down
                    [sourceFiles[index], sourceFiles[index + 1]] = [sourceFiles[index + 1], sourceFiles[index]];
                    updateSourceFileList();
                    // Debounce preview update to avoid flickering
                    schedulePreviewUpdate();
                }
            });
        });
    }
    
    function updateTargetFileList() {
        if (!targetFile) {
            targetFileList.innerHTML = '';
            return;
        }
        
        targetFileList.innerHTML = `<div class="file-item">${targetFile.name}</div>`;
    }
    
    // Schedule preview update with debounce to avoid flickering when moving files
    function schedulePreviewUpdate() {
        // Clear existing timeout
        if (previewUpdateTimeout) {
            clearTimeout(previewUpdateTimeout);
        }
        
        // Schedule update after 300ms of inactivity
        previewUpdateTimeout = setTimeout(() => {
            updatePreview();
            previewUpdateTimeout = null;
        }, 300);
    }
    
    // Handle source files selection
    sourceFilesInput.addEventListener('change', function(e) {
        sourceFiles = Array.from(e.target.files);
        excludedCommands.clear(); // Reset excluded commands when files change
        updateSourceFileList();
        updateProcessButton();
        // Reset preview before updating
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
        if (previewContent) {
            previewContent.innerHTML = '';
        }
        // Update preview after a short delay to ensure files are ready
        setTimeout(() => {
            updatePreview();
        }, 100);
    });
    
    // Handle target file selection
    targetFileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            targetFile = e.target.files[0];
        } else {
            targetFile = null;
        }
        excludedCommands.clear(); // Reset excluded commands when files change
        updateTargetFileList();
        updateProcessButton();
        // Reset preview before updating
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
        if (previewContent) {
            previewContent.innerHTML = '';
        }
        // Update preview after a short delay to ensure files are ready
        setTimeout(() => {
            updatePreview();
        }, 100);
    });
    
    // Toggle command exclusion
    function toggleCommandExclusion(commandName) {
        if (excludedCommands.has(commandName)) {
            excludedCommands.delete(commandName);
        } else {
            excludedCommands.add(commandName);
        }
        
        // Update only the specific item instead of refreshing entire preview
        const button = previewContent.querySelector(`button[data-command="${commandName.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"]`);
        if (button) {
            const item = button.closest('.preview-item');
            if (item) {
                const isExcluded = excludedCommands.has(commandName);
                const buttonClass = isExcluded ? 'preview-toggle-btn excluded' : 'preview-toggle-btn';
                const buttonText = isExcluded ? '+' : '×';
                const itemClass = isExcluded ? 'preview-item excluded' : 'preview-item';
                
                // Update button
                button.className = buttonClass;
                button.textContent = buttonText;
                button.title = isExcluded 
                    ? (document.documentElement.lang === 'ru' ? 'Вернуть изменение' : 'Restore change')
                    : (document.documentElement.lang === 'ru' ? 'Отменить изменение' : 'Exclude change');
                
                // Update item class
                item.className = itemClass;
            }
        } else {
            // Fallback: update entire preview if button not found
            updatePreview();
        }
    }
    
    // Update process button state
    function updateProcessButton() {
        processButton.disabled = sourceFiles.length === 0 || !targetFile;
    }
    
    // Parse command from a line
    function parseCommand(line) {
        // Store original line for comment extraction
        const originalLine = line;
        
        // Remove comments (everything after //)
        // But be careful with // inside quoted strings
        let commentIndex = -1;
        let inQuotes = false;
        let quoteChar = null;
        
        for (let i = 0; i < line.length - 1; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    inQuotes = false;
                    quoteChar = null;
                }
            } else if (!inQuotes && char === '/' && nextChar === '/') {
                commentIndex = i;
                break;
            }
        }
        
        if (commentIndex !== -1) {
            line = line.substring(0, commentIndex);
        }
        
        // Trim whitespace
        line = line.trim();
        
        // Skip empty lines
        if (!line) {
            return null;
        }
        
        // Match command patterns:
        // seta command "value"
        // seta command value
        // command "value"
        // command value
        // set command "value"
        // set command value
        // bind key "value"
        // bind key value
        // vstr variable
        // exec filename
        
        // Extract prefix (seta/set)
        const prefixMatch = line.match(/^(seta|set)\s+/);
        const prefix = prefixMatch ? prefixMatch[1] : '';
        const commandPart = prefix ? line.substring(prefixMatch[0].length) : line;
        
        // Find command name (first word, can be tab-separated)
        const nameMatch = commandPart.match(/^(\S+)[\s\t]+/);
        if (!nameMatch) {
            return null;
        }
        
        const commandName = nameMatch[1];
        let commandValue = commandPart.substring(nameMatch[0].length).trim();
        
        // Handle quoted values - need to handle nested quotes properly
        let hasQuotes = false;
        if (commandValue.length > 0) {
            // Check if value starts and ends with matching quotes
            const firstChar = commandValue[0];
            const lastChar = commandValue[commandValue.length - 1];
            
            if ((firstChar === '"' && lastChar === '"') || (firstChar === "'" && lastChar === "'")) {
                // Count quotes to see if they're properly matched (not nested)
                let quoteCount = 0;
                let inQuotes = false;
                let currentQuote = null;
                
                for (let i = 0; i < commandValue.length; i++) {
                    const char = commandValue[i];
                    if ((char === '"' || char === "'") && (i === 0 || commandValue[i - 1] !== '\\')) {
                        if (!inQuotes) {
                            inQuotes = true;
                            currentQuote = char;
                            quoteCount++;
                        } else if (char === currentQuote) {
                            inQuotes = false;
                            currentQuote = null;
                            quoteCount++;
                        }
                    }
                }
                
                // If we have even number of matching quotes, it's a simple quoted value
                // Otherwise, it might have nested quotes
                if (quoteCount % 2 === 0 && !inQuotes) {
                    // Simple case: remove outer quotes
                    commandValue = commandValue.slice(1, -1);
                    hasQuotes = true;
                } else {
                    // Complex case with nested quotes
                    // Try to remove outer quotes if first and last chars are matching quotes
                    // and the result doesn't start/end with the same quote type
                    if (firstChar === lastChar) {
                        const withoutOuter = commandValue.slice(1, -1);
                        const newFirst = withoutOuter.length > 0 ? withoutOuter[0] : '';
                        const newLast = withoutOuter.length > 0 ? withoutOuter[withoutOuter.length - 1] : '';
                        // Remove outer quotes if result doesn't start/end with same quote (meaning outer quotes were removed)
                        if (newFirst !== firstChar && newLast !== lastChar) {
                            commandValue = withoutOuter;
                            hasQuotes = true;
                        } else {
                            // Keep as is - outer quotes are needed
                            hasQuotes = true;
                        }
                    } else {
                        // Different quote types at start/end - keep as is
                        hasQuotes = true;
                    }
                }
            }
        }
        
        // Special handling for bind command - key is part of command name
        // bind KEY VALUE should be stored as "bind_KEY" to avoid conflicts
        let finalCommandName = commandName;
        if (commandName === 'bind' && commandValue.length > 0) {
            // Extract the key (first part of value, before space)
            // Handle both quoted and unquoted keys
            let key = '';
            let keyLength = 0;
            let keyWasQuoted = false;
            
            // Check if key starts with quotes (but not if the key itself IS a quote)
            const firstChar = commandValue[0];
            const secondChar = commandValue.length > 1 ? commandValue[1] : '';
            
            // Key is quoted if: first char is quote AND second char is not space AND there's a matching quote
            if ((firstChar === '"' || firstChar === "'") && secondChar !== ' ' && secondChar !== '\t') {
                // Find matching quote
                let quoteEnd = -1;
                for (let i = 1; i < commandValue.length; i++) {
                    if (commandValue[i] === firstChar && commandValue[i - 1] !== '\\') {
                        quoteEnd = i;
                        break;
                    }
                }
                if (quoteEnd !== -1 && quoteEnd > 1) {
                    // Extract key without quotes
                    key = commandValue.substring(1, quoteEnd);
                    keyLength = quoteEnd + 1;
                    keyWasQuoted = true;
                } else {
                    // No closing quote or key is just a quote character, treat as unquoted
                    const keyMatch = commandValue.match(/^([^\s]+)/);
                    if (keyMatch) {
                        key = keyMatch[1];
                        keyLength = keyMatch[0].length;
                    }
                }
            } else {
                // Unquoted key
                const keyMatch = commandValue.match(/^([^\s]+)/);
                if (keyMatch) {
                    key = keyMatch[1];
                    keyLength = keyMatch[0].length;
                }
            }
            
            if (key) {
                finalCommandName = `bind_${key}`;
                // Remove key from value
                commandValue = commandValue.substring(keyLength).trim();
                // Store if key was quoted for later reconstruction
                return {
                    name: finalCommandName,
                    value: commandValue,
                    hasQuotes: hasQuotes,
                    prefix: prefix,
                    originalLine: originalLine,
                    originalCommandName: commandName,
                    bindKeyWasQuoted: keyWasQuoted
                };
            }
        }
        
        return {
            name: finalCommandName,
            value: commandValue,
            hasQuotes: hasQuotes,
            prefix: prefix,
            originalLine: originalLine,
            originalCommandName: commandName // Keep original for reconstruction
        };
    }
    
    // Extract commands from file content
    function extractCommands(content) {
        const lines = content.split('\n');
        const commands = new Map();
        
        for (const line of lines) {
            const command = parseCommand(line);
            if (command) {
                // If command already exists, keep the last one
                commands.set(command.name, {
                    value: command.value,
                    hasQuotes: command.hasQuotes,
                    prefix: command.prefix,
                    originalCommandName: command.originalCommandName,
                    bindKeyWasQuoted: command.bindKeyWasQuoted
                });
            }
        }
        
        return commands;
    }
    
    // Read file as text
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }
    
    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Update preview
    async function updatePreview() {
        if (!previewContainer || !previewContent) {
            return;
        }
        
        // Check if files are still selected
        if (sourceFiles.length === 0 || !targetFile) {
            previewContainer.style.display = 'none';
            previewContent.innerHTML = '';
            return;
        }
        
        // Verify files are still valid
        if (!sourceFilesInput.files || sourceFilesInput.files.length === 0) {
            previewContainer.style.display = 'none';
            previewContent.innerHTML = '';
            return;
        }
        
        if (!targetFileInput.files || targetFileInput.files.length === 0) {
            previewContainer.style.display = 'none';
            previewContent.innerHTML = '';
            return;
        }
        
        try {
            // Keep preview visible if it was already shown (for smooth updates)
            const wasHidden = previewContainer.style.display === 'none' || previewContainer.style.display === '';
            if (wasHidden) {
                previewContainer.style.display = 'block';
                const lang = document.documentElement.lang || 'en';
                const analyzingMsg = lang === 'ru' ? 'Анализ...' : 'Analyzing...';
                previewContent.innerHTML = `<div style="color: var(--text-color); opacity: 0.7;">${analyzingMsg}</div>`;
            }
            // If preview was already visible, don't show "Analyzing..." - just update content smoothly
            
            // Read all source files and extract commands
            const allCommands = new Map();
            
            // Use sourceFiles array to maintain order (not sourceFilesInput.files)
            for (const file of sourceFiles) {
                try {
                    const content = await readFileAsText(file);
                    const commands = extractCommands(content);
                    
                    // Merge commands (later files override earlier ones)
                    for (const [name, cmd] of commands) {
                        allCommands.set(name, cmd);
                    }
                } catch (error) {
                    console.error(`Error reading file ${file.name}:`, error);
                    const lang = document.documentElement.lang || 'en';
                    const errorMsg = lang === 'ru' 
                        ? `Ошибка чтения файла: ${file.name}`
                        : `Error reading file: ${file.name}`;
                    previewContent.innerHTML = `<div style="color: #ff6666;">${errorMsg}</div>`;
                    return;
                }
            }
            
            // Read target file - use current file from input
            const currentTargetFile = targetFileInput.files[0];
            if (!currentTargetFile) {
                previewContainer.style.display = 'none';
                previewContent.innerHTML = '';
                return;
            }
            
            let targetContent;
            try {
                targetContent = await readFileAsText(currentTargetFile);
            } catch (error) {
                console.error('Error reading target file:', error);
                const lang = document.documentElement.lang || 'en';
                const errorMsg = lang === 'ru' 
                    ? 'Ошибка чтения целевого файла'
                    : 'Error reading target file';
                previewContent.innerHTML = `<div style="color: #ff6666;">${errorMsg}</div>`;
                return;
            }
            
            // Parse target file
            const targetLines = targetContent.split('\n');
            const targetCommands = new Map();
            
            for (const line of targetLines) {
                const command = parseCommand(line);
                if (command) {
                    targetCommands.set(command.name, {
                        value: command.value,
                        originalLine: line
                    });
                }
            }
            
            // Helper function to convert internal command name to display name
            function getDisplayName(internalName, cmd) {
                if (internalName.startsWith('bind_')) {
                    const key = internalName.substring(5); // Remove "bind_" prefix
                    const keyWasQuoted = cmd && cmd.bindKeyWasQuoted !== undefined ? cmd.bindKeyWasQuoted : false;
                    const keyStr = keyWasQuoted ? `"${key}"` : key;
                    return `bind ${keyStr}`;
                }
                return internalName;
            }
            
            // Build preview
            previewItems = [];
            const addedCommands = new Set();
            
            // Show updated commands
            for (const [name, sourceCmd] of allCommands) {
                if (targetCommands.has(name)) {
                    const targetCmd = targetCommands.get(name);
                    if (targetCmd.value !== sourceCmd.value) {
                        previewItems.push({
                            type: 'updated',
                            name: name,
                            displayName: getDisplayName(name, sourceCmd),
                            oldValue: targetCmd.value,
                            newValue: sourceCmd.value
                        });
                        addedCommands.add(name);
                    }
                } else {
                    previewItems.push({
                        type: 'added',
                        name: name,
                        displayName: getDisplayName(name, sourceCmd),
                        value: sourceCmd.value
                    });
                    addedCommands.add(name);
                }
            }
            
            // Reset sort state when preview is updated
            isPreviewSorted = false;
            
            // Render preview
            renderPreview();
            
        } catch (error) {
            console.error('Error updating preview:', error);
            const lang = document.documentElement.lang || 'en';
            const errorMsg = lang === 'ru' 
                ? `Ошибка: ${error.message}`
                : `Error: ${error.message}`;
            previewContent.innerHTML = `<div style="color: #ff6666;">${errorMsg}</div>`;
        }
    }
    
    // Render preview items
    function renderPreview() {
        if (previewItems.length === 0) {
            const lang = document.documentElement.lang || 'en';
            const message = lang === 'ru' 
                ? 'Нет изменений для отображения'
                : 'No changes to display';
            previewContent.innerHTML = `<div style="color: var(--text-color); opacity: 0.7;">${message}</div>`;
        } else {
            // Use sorted items if sorted, otherwise use original order
            const itemsToRender = isPreviewSorted ? [...previewItems].sort((a, b) => {
                // Extract command name ignoring set/seta prefix
                const getSortName = (displayName) => {
                    // Remove set/seta prefix if present
                    let name = displayName.trim();
                    if (name.startsWith('seta ')) {
                        name = name.substring(5).trim();
                    } else if (name.startsWith('set ')) {
                        name = name.substring(4).trim();
                    }
                    // For bind commands, extract the key part and prepend "bind" for sorting
                    if (name.startsWith('bind ')) {
                        let key = name.substring(5).trim();
                        // Remove quotes if present
                        if ((key.startsWith('"') && key.endsWith('"')) || 
                            (key.startsWith("'") && key.endsWith("'"))) {
                            key = key.slice(1, -1);
                        }
                        // Sort by "bind" + key to keep bind commands together but sorted by key
                        return ('bind ' + key).toLowerCase();
                    }
                    // Extract first word (command name or cvar name)
                    const firstSpace = name.indexOf(' ');
                    if (firstSpace > 0) {
                        name = name.substring(0, firstSpace);
                    }
                    return name.toLowerCase();
                };
                
                const nameA = getSortName(a.displayName);
                const nameB = getSortName(b.displayName);
                return nameA.localeCompare(nameB);
            }) : previewItems;
            
            const html = itemsToRender.map(item => {
                    const isExcluded = excludedCommands.has(item.name);
                    const buttonClass = isExcluded ? 'preview-toggle-btn excluded' : 'preview-toggle-btn';
                    const buttonText = isExcluded ? '+' : '×';
                    const itemClass = isExcluded ? 'preview-item excluded' : 'preview-item';
                    
                    // Store original command name in data attribute (will be decoded when reading)
                    const commandNameForData = item.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                    
                    if (item.type === 'updated') {
                        return `<div class="${itemClass}">
                            <button class="${buttonClass}" data-command="${commandNameForData}" title="${isExcluded ? (document.documentElement.lang === 'ru' ? 'Вернуть изменение' : 'Restore change') : (document.documentElement.lang === 'ru' ? 'Отменить изменение' : 'Exclude change')}">${buttonText}</button>
                            <span class="preview-command">${escapeHtml(item.displayName)}</span>
                            <span class="preview-arrow">→</span>
                            <span class="preview-old">${escapeHtml(item.oldValue)}</span>
                            <span class="preview-arrow">→</span>
                            <span class="preview-new">${escapeHtml(item.newValue)}</span>
                        </div>`;
                    } else if (item.type === 'added') {
                        return `<div class="${itemClass}">
                            <button class="${buttonClass}" data-command="${commandNameForData}" title="${isExcluded ? (document.documentElement.lang === 'ru' ? 'Вернуть изменение' : 'Restore change') : (document.documentElement.lang === 'ru' ? 'Отменить изменение' : 'Exclude change')}">${buttonText}</button>
                            <span class="preview-added">+ ${escapeHtml(item.displayName)} = ${escapeHtml(item.value)}</span>
                        </div>`;
                    }
                }).join('');
                previewContent.innerHTML = html;
                
                // Attach event listeners to buttons
                const toggleButtons = previewContent.querySelectorAll('.preview-toggle-btn');
                toggleButtons.forEach(button => {
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const commandName = this.getAttribute('data-command');
                        if (commandName) {
                            // Decode HTML entities
                            const decodedName = commandName
                                .replace(/&quot;/g, '"')
                                .replace(/&#39;/g, "'")
                                .replace(/&amp;/g, '&');
                            toggleCommandExclusion(decodedName);
                        }
                    });
                });
            }
    }
    
    // Sort preview items
    function sortPreview() {
        isPreviewSorted = !isPreviewSorted;
        renderPreview();
        
        // Update button text
        if (sortPreviewButton) {
            const lang = document.documentElement.lang || 'en';
            sortPreviewButton.textContent = isPreviewSorted 
                ? (lang === 'ru' ? 'Отменить сортировку' : 'Unsort')
                : (lang === 'ru' ? 'Сортировать' : 'Sort');
        }
    }
    
    // Process files
    async function processFiles() {
        if (sourceFiles.length === 0 || !targetFile) {
            const lang = document.documentElement.lang || 'en';
            const message = lang === 'ru' 
                ? 'Пожалуйста, выберите исходные файлы и целевой файл'
                : 'Please select source files and target file';
            showStatus('error', message);
            return;
        }
        
        try {
            processButton.disabled = true;
            const lang = document.documentElement.lang || 'en';
            const processingMsg = lang === 'ru' ? 'Обработка...' : 'Processing...';
            showStatus('', processingMsg);
            
            // Read all source files and extract commands
            // Use sourceFiles array to maintain order
            const allCommands = new Map();
            
            for (const file of sourceFiles) {
                try {
                    const content = await readFileAsText(file);
                    const commands = extractCommands(content);
                    
                    // Merge commands (later files override earlier ones)
                    for (const [name, cmd] of commands) {
                        allCommands.set(name, cmd);
                    }
                } catch (error) {
                    console.error(`Error reading file ${file.name}:`, error);
                    const message = lang === 'ru'
                        ? `Ошибка чтения файла: ${file.name}`
                        : `Error reading file: ${file.name}`;
                    showStatus('error', message);
                    processButton.disabled = false;
                    return;
                }
            }
            
            // Read target file
            let targetContent;
            try {
                targetContent = await readFileAsText(targetFile);
            } catch (error) {
                console.error('Error reading target file:', error);
                const message = lang === 'ru'
                    ? 'Ошибка чтения целевого файла'
                    : 'Error reading target file';
                showStatus('error', message);
                processButton.disabled = false;
                return;
            }
            
            // Parse target file to preserve structure
            const targetLines = targetContent.split('\n');
            const targetCommands = new Map();
            const targetStructure = [];
            
            // First pass: extract existing commands from target
            for (let i = 0; i < targetLines.length; i++) {
                const line = targetLines[i];
                const command = parseCommand(line);
                
                if (command) {
                    targetCommands.set(command.name, {
                        value: command.value,
                        hasQuotes: command.hasQuotes,
                        prefix: command.prefix,
                        originalCommandName: command.originalCommandName,
                        bindKeyWasQuoted: command.bindKeyWasQuoted,
                        lineIndex: i,
                        originalLine: line
                    });
                }
                
                targetStructure.push({
                    line: line,
                    isCommand: !!command,
                    commandName: command ? command.name : null
                });
            }
            
            // Merge commands: source commands override target commands (excluding excluded ones)
            for (const [name, sourceCmd] of allCommands) {
                if (excludedCommands.has(name)) {
                    continue; // Skip excluded commands
                }
                
                if (targetCommands.has(name)) {
                    // Update existing command
                    const targetCmd = targetCommands.get(name);
                    targetCmd.value = sourceCmd.value;
                    targetCmd.hasQuotes = sourceCmd.hasQuotes;
                    targetCmd.prefix = sourceCmd.prefix;
                    targetCmd.originalCommandName = sourceCmd.originalCommandName;
                    targetCmd.bindKeyWasQuoted = sourceCmd.bindKeyWasQuoted;
                } else {
                    // Add new command
                    targetCommands.set(name, {
                        value: sourceCmd.value,
                        hasQuotes: sourceCmd.hasQuotes,
                        prefix: sourceCmd.prefix,
                        originalCommandName: sourceCmd.originalCommandName,
                        bindKeyWasQuoted: sourceCmd.bindKeyWasQuoted,
                        lineIndex: -1,
                        originalLine: null
                    });
                }
            }
            
            // Build output content
            const outputLines = [];
            const addedCommands = new Set();
            
            // First, process existing structure
            for (const item of targetStructure) {
                if (item.isCommand && item.commandName) {
                    const cmd = targetCommands.get(item.commandName);
                    if (cmd) {
                        // Reconstruct command line
                        const originalLine = item.line;
                        
                        // Extract leading whitespace (tabs/spaces) to preserve indentation
                        const leadingWhitespaceMatch = originalLine.match(/^[\s\t]*/);
                        const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : '';
                        
                        // Extract comment (everything after //, but not inside quotes)
                        let commentIndex = -1;
                        let inQuotes = false;
                        let quoteChar = null;
                        
                        for (let i = 0; i < originalLine.length - 1; i++) {
                            const char = originalLine[i];
                            const nextChar = originalLine[i + 1];
                            
                            if ((char === '"' || char === "'") && (i === 0 || originalLine[i - 1] !== '\\')) {
                                if (!inQuotes) {
                                    inQuotes = true;
                                    quoteChar = char;
                                } else if (char === quoteChar) {
                                    inQuotes = false;
                                    quoteChar = null;
                                }
                            } else if (!inQuotes && char === '/' && nextChar === '/') {
                                commentIndex = i;
                                break;
                            }
                        }
                        
                        const comment = commentIndex !== -1 ? originalLine.substring(commentIndex) : '';
                        
                        // Check if this is a bind command (stored as bind_KEY)
                        let displayCommandName = item.commandName;
                        let keyPart = '';
                        if (item.commandName.startsWith('bind_')) {
                            displayCommandName = 'bind';
                            keyPart = item.commandName.substring(5); // Remove "bind_" prefix
                        }
                        
                        // Commands that should not have seta/set prefix
                        const noPrefixCommands = ['bind', 'exec', 'vstr', 'unbind', 'unbindall', 'cvar_restart', 'clear', 'echo'];
                        const isNoPrefixCommand = noPrefixCommands.includes(displayCommandName);
                        
                        // Use prefix from command, but don't add seta for special commands
                        let prefix = cmd.prefix || '';
                        if (!prefix && !isNoPrefixCommand) {
                            prefix = 'seta';
                        }
                        const prefixStr = prefix ? prefix + ' ' : '';
                        
                        // Determine if value should have quotes
                        // Use hasQuotes from source if available, otherwise check if value contains spaces or special chars
                        // But don't add quotes if value already starts and ends with quotes
                        const valueAlreadyQuoted = (cmd.value.length > 0 && 
                            ((cmd.value[0] === '"' && cmd.value[cmd.value.length - 1] === '"') ||
                             (cmd.value[0] === "'" && cmd.value[cmd.value.length - 1] === "'")));
                        const needsQuotes = valueAlreadyQuoted 
                            ? false 
                            : (cmd.hasQuotes !== undefined 
                                ? cmd.hasQuotes 
                                : (cmd.value.includes(' ') || cmd.value.includes(';') || cmd.value === ''));
                        const valueStr = needsQuotes ? `"${cmd.value}"` : cmd.value;
                        
                        // For bind commands, reconstruct as "bind KEY VALUE"
                        let commandPart = '';
                        if (displayCommandName === 'bind' && keyPart) {
                            // Check if key was quoted in original or source
                            const keyWasQuoted = cmd.bindKeyWasQuoted !== undefined 
                                ? cmd.bindKeyWasQuoted 
                                : false;
                            
                            let keyStr = keyPart;
                            if (!keyWasQuoted) {
                                // If key wasn't quoted, keep it unquoted (as in original)
                                // Quake 3 accepts unquoted single character keys
                                keyStr = keyPart;
                            } else {
                                // Key was quoted, preserve quotes (use double quotes for consistency)
                                keyStr = `"${keyPart}"`;
                            }
                            commandPart = `${displayCommandName} ${keyStr} ${valueStr}`;
                        } else {
                            commandPart = `${displayCommandName} ${valueStr}`;
                        }
                        
                        const newLine = `${leadingWhitespace}${prefixStr}${commandPart}${comment ? ' ' + comment : ''}`;
                        
                        outputLines.push(newLine);
                        addedCommands.add(item.commandName);
                    }
                } else {
                    // Keep non-command lines as is
                    outputLines.push(item.line);
                }
            }
            
            // Add new commands that weren't in target
            for (const [name, cmd] of targetCommands) {
                if (!addedCommands.has(name)) {
                    // Check if this is a bind command (stored as bind_KEY)
                    let displayCommandName = name;
                    let keyPart = '';
                    if (name.startsWith('bind_')) {
                        displayCommandName = 'bind';
                        keyPart = name.substring(5); // Remove "bind_" prefix
                    }
                    
                    // Commands that should not have seta/set prefix
                    const noPrefixCommands = ['bind', 'exec', 'vstr', 'unbind', 'unbindall', 'cvar_restart', 'clear', 'echo'];
                    const isNoPrefixCommand = noPrefixCommands.includes(displayCommandName);
                    
                    // Use prefix from command, but don't add seta for special commands
                    let prefix = cmd.prefix || '';
                    if (!prefix && !isNoPrefixCommand) {
                        prefix = 'seta';
                    }
                    const prefixStr = prefix ? prefix + ' ' : '';
                    // Don't add quotes if value already starts and ends with quotes
                    const valueAlreadyQuoted = (cmd.value.length > 0 && 
                        ((cmd.value[0] === '"' && cmd.value[cmd.value.length - 1] === '"') ||
                         (cmd.value[0] === "'" && cmd.value[cmd.value.length - 1] === "'")));
                    const needsQuotes = valueAlreadyQuoted 
                        ? false 
                        : (cmd.hasQuotes !== undefined 
                            ? cmd.hasQuotes 
                            : (cmd.value.includes(' ') || cmd.value === ''));
                    const valueStr = needsQuotes ? `"${cmd.value}"` : cmd.value;
                    
                    // For bind commands, reconstruct as "bind KEY VALUE"
                    let commandPart = '';
                    if (displayCommandName === 'bind' && keyPart) {
                        // Check if key was quoted in source
                        const keyWasQuoted = cmd.bindKeyWasQuoted !== undefined 
                            ? cmd.bindKeyWasQuoted 
                            : false;
                        
                        let keyStr = keyPart;
                        if (!keyWasQuoted) {
                            // If key wasn't quoted, keep it unquoted (as in original)
                            keyStr = keyPart;
                        } else {
                            // Key was quoted, preserve quotes
                            keyStr = `"${keyPart}"`;
                        }
                        commandPart = `${displayCommandName} ${keyStr} ${valueStr}`;
                    } else {
                        commandPart = `${displayCommandName} ${valueStr}`;
                    }
                    
                    outputLines.push(`${prefixStr}${commandPart}`);
                }
            }
            
            // Create output file
            const outputContent = outputLines.join('\n');
            const targetFileName = targetFile.name;
            const baseName = targetFileName.replace(/\.(cfg|txt)$/i, '');
            const extension = targetFileName.match(/\.(cfg|txt)$/i)?.[1] || 'cfg';
            const outputFileName = `${baseName}.${extension}`;
            
            // Create zip archive
            const zip = new JSZip();
            zip.file(outputFileName, outputContent);
            
            // Generate zip file
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipFileName = `${baseName}.zip`;
            
            // Download zip file
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = zipFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            const message = lang === 'ru'
                ? `Файл ${zipFileName} успешно загружен!`
                : `File ${zipFileName} downloaded successfully!`;
            showStatus('success', message);
            processButton.disabled = false;
            
        } catch (error) {
            console.error('Error processing files:', error);
            showStatus('error', `Error: ${error.message}`);
            processButton.disabled = false;
        }
    }
    
    // Show status message
    function showStatus(type, message) {
        statusMessage.className = `status-message ${type}`;
        statusMessage.textContent = message;
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusMessage.className = 'status-message';
                statusMessage.textContent = '';
            }, 5000);
        }
    }
    
    // Attach event listeners
    processButton.addEventListener('click', processFiles);
    
    if (sortPreviewButton) {
        sortPreviewButton.addEventListener('click', sortPreview);
    }
    
    // Initialize
    updateProcessButton();
})();

