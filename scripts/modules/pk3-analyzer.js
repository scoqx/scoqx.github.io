// ========== PK3 АНАЛИЗАТОР ==========
// Класс и функции для анализа PK3 архивов

class PK3Analyzer {
    constructor() {
        this.currentPk3Data = null;
    }
    
    async loadPk3FromAssets(filename) {
        try {
            // Проверяем кэш
            if (cachedPk3Data && cachedPk3Data.filename === filename) {
                console.log(`Используем кэшированные данные PK3: ${filename}`);
                return cachedPk3Data.data;
            }
            
            console.log(`Попытка загрузки PK3 файла: ${filename}`);
            const response = await fetch(filename);
            console.log(`Ответ сервера: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                throw new Error(`Не удалось загрузить файл: ${response.statusText} (${response.status})`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            console.log(`Файл загружен, размер: ${arrayBuffer.byteLength} байт`);
            
            const pk3Data = this.parsePk3Archive(arrayBuffer);
            
            // Сохраняем в кэш
            cachedPk3Data = {
                filename: filename,
                data: pk3Data
            };
            
            return pk3Data;
        } catch (error) {
            console.error('Ошибка загрузки PK3:', error);
            throw error;
        }
    }
    
    parsePk3Archive(arrayBuffer) {
        // PK3 файлы - это ZIP архивы
        // Простая реализация для анализа структуры
        const data = new Uint8Array(arrayBuffer);
        const files = [];
        const fileTypes = new Map();
        let totalSize = 0;
        
        // Ищем ZIP сигнатуру
        let offset = 0;
        while (offset < data.length - 4) {
            if (data[offset] === 0x50 && data[offset + 1] === 0x4B && 
                data[offset + 2] === 0x03 && data[offset + 3] === 0x04) {
                // Найден локальный заголовок файла
                const fileNameLength = data[offset + 26] | (data[offset + 27] << 8);
                const extraFieldLength = data[offset + 28] | (data[offset + 29] << 8);
                const compressedSize = data[offset + 18] | (data[offset + 19] << 8) | 
                                      (data[offset + 20] << 16) | (data[offset + 21] << 24);
                
                // Читаем имя файла
                const fileNameBytes = data.slice(offset + 30, offset + 30 + fileNameLength);
                const fileName = new TextDecoder('utf-8').decode(fileNameBytes);
                
                // Определяем тип файла
                const extension = fileName.split('.').pop().toLowerCase();
                const fileType = this.getFileType(extension);
                
                files.push({
                    name: fileName,
                    size: compressedSize,
                    type: fileType,
                    extension: extension
                });
                
                fileTypes.set(fileType, (fileTypes.get(fileType) || 0) + 1);
                totalSize += compressedSize;
                
                offset += 30 + fileNameLength + extraFieldLength + compressedSize;
            } else {
                offset++;
            }
        }
        
        return {
            files: files,
            fileTypes: fileTypes,
            totalFiles: files.length,
            totalSize: totalSize,
            uniqueTypes: fileTypes.size
        };
    }
    
    getFileType(extension) {
        const typeMap = {
            'tga': 'Текстуры',
            'jpg': 'Текстуры', 
            'png': 'Текстуры',
            'md3': '3D Модели',
            'md2': '3D Модели',
            'skin': 'Скины',
            'shader': 'Шейдеры',
            'cfg': 'Конфигурация',
            'txt': 'Текстовые файлы',
            'wav': 'Звуки',
            'mp3': 'Звуки',
            'ogg': 'Звуки',
            'c': 'Исходный код C',
            'h': 'Заголовочные файлы',
            'asm': 'Ассемблер',
            'qvm': 'QVM байт-код'
        };
        
        return typeMap[extension] || 'Другие';
    }
}

window.loadPk3File = async function() {
    const selectElement = document.getElementById('pk3FileSelect');
    const customFile = document.getElementById('customPk3File');
    
    let pk3File = null;
    
    if (selectElement.value) {
        pk3File = selectElement.value;
    } else if (customFile.files[0]) {
        pk3File = customFile.files[0];
    } else {
        updateStatus('pk3Status', 'Выберите PK3 файл для загрузки', 'error');
        return;
    }
    
    updateStatus('pk3Status', 'Загрузка PK3 файла...', 'info');
    
    try {
        if (typeof pk3File === 'string') {
            // Загрузка из assets
            currentPk3Data = await pk3Analyzer.loadPk3FromAssets(pk3File);
        } else {
            // Загрузка пользовательского файла
            const arrayBuffer = await pk3File.arrayBuffer();
            currentPk3Data = pk3Analyzer.parsePk3Archive(arrayBuffer);
        }
        
        updateStatus('pk3Status', `PK3 файл загружен: ${currentPk3Data.totalFiles} файлов`, 'success');
        analyzePk3();
    } catch (error) {
        updateStatus('pk3Status', `Ошибка загрузки: ${error.message}`, 'error');
        console.error('Ошибка загрузки PK3:', error);
    }
}

window.analyzePk3 = function() {
    if (!currentPk3Data) {
        updateStatus('pk3Status', 'Сначала загрузите PK3 файл', 'error');
        return;
    }
    
    updateStatus('pk3Status', 'Анализ PK3 содержимого...', 'info');
    
    // Обновляем статистику
    document.getElementById('totalFiles').textContent = currentPk3Data.totalFiles;
    document.getElementById('fileTypes').textContent = currentPk3Data.uniqueTypes;
    document.getElementById('totalSize').textContent = Math.round(currentPk3Data.totalSize / 1024);
    
    // Показываем статистику
    document.getElementById('pk3Stats').style.display = 'grid';
    
    // Показываем типы файлов
    const fileTypesContent = document.getElementById('fileTypesContent');
    fileTypesContent.innerHTML = '';
    
    for (const [type, count] of currentPk3Data.fileTypes) {
        const div = document.createElement('div');
        div.style.cssText = 'margin: 5px 0; padding: 5px; background: #3a3a3a; border-radius: 3px;';
        div.innerHTML = `<strong>${type}:</strong> ${count} файлов`;
        fileTypesContent.appendChild(div);
    }
    
    document.getElementById('fileTypesList').style.display = 'block';
    
    // Показываем список файлов
    const fileListContent = document.getElementById('fileListContent');
    fileListContent.innerHTML = '';
    
    currentPk3Data.files.forEach(file => {
        const div = document.createElement('div');
        div.style.cssText = 'margin: 2px 0; padding: 2px; border-bottom: 1px solid #4a4a4a;';
        div.innerHTML = `${file.name} <span style="color: #888;">(${file.type}, ${Math.round(file.size/1024)}KB)</span>`;
        fileListContent.appendChild(div);
    });
    
    document.getElementById('fileList').style.display = 'block';
    
    updateStatus('pk3Status', 'Анализ PK3 завершен успешно', 'success');
}

window.clearPk3Analysis = function() {
    currentPk3Data = null;
    
    document.getElementById('pk3Stats').style.display = 'none';
    document.getElementById('fileTypesList').style.display = 'none';
    document.getElementById('fileList').style.display = 'none';
    
    document.getElementById('pk3FileSelect').value = '';
    document.getElementById('customPk3File').value = '';
    
    updateStatus('pk3Status', 'Анализ очищен');
}

window.scanAssetsForPk3 = async function() {
    updateStatus('pk3Status', 'Проверка доступности PK3 файлов...', 'info');
    
    try {
        // Захардкоженные PK3 файлы из assets
        const knownPk3Files = [
            '../../assets/zz-osp-pak8be.pk3',
            '../../assets/whitelist/zz-osp-pak8be.pk3'
        ];
        
        const selectElement = document.getElementById('pk3FileSelect');
        let foundFiles = 0;
        
        // Проверяем доступность каждого файла
        for (const filePath of knownPk3Files) {
            try {
                const response = await fetch(filePath, { method: 'HEAD' });
                if (response.ok) {
                    foundFiles++;
                    console.log(`✓ PK3 файл доступен: ${filePath}`);
                } else {
                    console.log(`✗ PK3 файл недоступен: ${filePath} (${response.status})`);
                }
            } catch (error) {
                console.log(`✗ Ошибка проверки файла ${filePath}:`, error.message);
            }
        }
        
        if (foundFiles > 0) {
            updateStatus('pk3Status', `Найдено ${foundFiles} доступных PK3 файлов в assets/`, 'success');
        } else {
            updateStatus('pk3Status', 'PK3 файлы в assets/ недоступны. Проверьте, что файлы существуют.', 'error');
        }
        
    } catch (error) {
        updateStatus('pk3Status', `Ошибка проверки: ${error.message}`, 'error');
        console.error('Ошибка проверки assets:', error);
    }
}

