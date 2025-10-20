// Утилита для автоматического переименования изображений в папке images/
// Запускать в Node.js: node scripts/rename-images.js

const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'images');
const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

function renameImages() {
  try {
    // Читаем все файлы в папке images
    const files = fs.readdirSync(imagesDir);
    
    // Фильтруем только изображения
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return supportedFormats.includes(ext);
    });
    
    console.log(`Найдено ${imageFiles.length} изображений для переименования:`);
    
    // Сортируем файлы по дате создания
    const filesWithStats = imageFiles.map(file => {
      const filePath = path.join(imagesDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        path: filePath,
        created: stats.birthtime,
        modified: stats.mtime
      };
    }).sort((a, b) => a.created - b.created);
    
    // Переименовываем файлы
    filesWithStats.forEach((fileInfo, index) => {
      const oldPath = fileInfo.path;
      const ext = path.extname(fileInfo.name).toLowerCase();
      const newName = `${index + 1}${ext}`;
      const newPath = path.join(imagesDir, newName);
      
      // Проверяем, не существует ли уже файл с таким именем
      if (fs.existsSync(newPath) && oldPath !== newPath) {
        console.log(`⚠️  Файл ${newName} уже существует, пропускаем ${fileInfo.name}`);
        return;
      }
      
      try {
        fs.renameSync(oldPath, newPath);
        console.log(`✅ ${fileInfo.name} → ${newName}`);
      } catch (error) {
        console.error(`❌ Ошибка при переименовании ${fileInfo.name}:`, error.message);
      }
    });
    
    console.log('\n🎉 Переименование завершено!');
    console.log('Теперь вы можете просто добавлять новые изображения в папку images/');
    console.log('и они автоматически появятся в галерее.');
    
  } catch (error) {
    console.error('Ошибка при работе с папкой images:', error.message);
  }
}

// Функция для создания резервной копии
function createBackup() {
  const backupDir = path.join(__dirname, '..', 'images-backup');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }
  
  const files = fs.readdirSync(imagesDir);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return supportedFormats.includes(ext);
  });
  
  console.log('Создание резервной копии...');
  
  imageFiles.forEach(file => {
    const sourcePath = path.join(imagesDir, file);
    const backupPath = path.join(backupDir, file);
    fs.copyFileSync(sourcePath, backupPath);
  });
  
  console.log(`✅ Резервная копия создана в папке ${backupDir}`);
}

// Проверяем аргументы командной строки
const args = process.argv.slice(2);

if (args.includes('--backup')) {
  createBackup();
}

if (args.includes('--rename') || args.length === 0) {
  renameImages();
}

if (args.includes('--help')) {
  console.log(`
Утилита для переименования изображений в галерее

Использование:
  node scripts/rename-images.js [опции]

Опции:
  --backup    Создать резервную копию перед переименованием
  --rename    Переименовать файлы (по умолчанию)
  --help      Показать эту справку

Примеры:
  node scripts/rename-images.js --backup --rename
  node scripts/rename-images.js --backup
  node scripts/rename-images.js
  `);
}



