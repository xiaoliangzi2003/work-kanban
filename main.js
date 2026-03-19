const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// ========== 设置文件 ==========
function getSettingsPath() {
  // 设置文件始终存放在 exe 旁（打包）或项目根目录（开发）
  const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
  return path.join(baseDir, 'settings.json');
}

function loadSettings() {
  const p = getSettingsPath();
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return {};
}

function saveSettings(settings) {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

// 获取用户数据目录下的 data 文件夹路径
function getDataDir() {
  // 优先使用用户在设置中指定的自定义目录
  const settings = loadSettings();
  if (settings.dataDir && fs.existsSync(settings.dataDir)) {
    return settings.dataDir;
  }

  // 优先使用 exe 所在目录下的 data/，便于数据随程序携带
  const exeDir = path.dirname(app.getPath('exe'));
  const portableDataDir = path.join(exeDir, 'data');

  // 开发模式使用项目根目录下的 data/
  if (!app.isPackaged) {
    const devDataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(devDataDir)) fs.mkdirSync(devDataDir, { recursive: true });
    return devDataDir;
  }

  // 打包后使用 exe 旁边的 data/ 目录
  if (!fs.existsSync(portableDataDir)) fs.mkdirSync(portableDataDir, { recursive: true });
  return portableDataDir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: '项目看板',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('kanban.html');

  // 开发模式下打开 DevTools
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ========== IPC: 文件系统操作 ==========

// 获取数据目录路径
ipcMain.handle('get-data-dir', () => {
  return getDataDir();
});

// 读取 projects 目录下所有项目文件
ipcMain.handle('read-projects', async () => {
  const dataDir = getDataDir();
  const projectsDir = path.join(dataDir, 'projects');
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });

  const files = fs.readdirSync(projectsDir).filter(f => f.startsWith('project_') && f.endsWith('.json'));
  const projects = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(projectsDir, file), 'utf-8');
      projects.push(JSON.parse(content));
    } catch (e) { /* skip corrupt files */ }
  }
  return projects;
});

// 保存单个项目
ipcMain.handle('save-project', async (event, proj) => {
  const dataDir = getDataDir();
  const projectsDir = path.join(dataDir, 'projects');
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });
  const filePath = path.join(projectsDir, `project_${proj.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(proj, null, 2), 'utf-8');
  return true;
});

// 删除项目文件
ipcMain.handle('delete-project', async (event, projId) => {
  const dataDir = getDataDir();
  const filePath = path.join(dataDir, 'projects', `project_${projId}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

// 读取 people.json
ipcMain.handle('read-people', async () => {
  const dataDir = getDataDir();
  const filePath = path.join(dataDir, 'people.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { return []; }
});

// 保存 people.json
ipcMain.handle('save-people', async (event, people) => {
  const dataDir = getDataDir();
  fs.writeFileSync(path.join(dataDir, 'people.json'), JSON.stringify(people, null, 2), 'utf-8');
  return true;
});

// 保存任务图片
ipcMain.handle('save-image', async (event, taskId, index, base64Data) => {
  const dataDir = getDataDir();
  const filePath = path.join(dataDir, `${taskId}_${index}.jpg`);
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);
  return true;
});

// 读取任务图片
ipcMain.handle('read-image', async (event, taskId, index) => {
  const dataDir = getDataDir();
  const filePath = path.join(dataDir, `${taskId}_${index}.jpg`);
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
});

// 删除任务图片
ipcMain.handle('delete-image', async (event, taskId, index) => {
  const dataDir = getDataDir();
  const filePath = path.join(dataDir, `${taskId}_${index}.jpg`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

// ========== IPC: 设置 ==========

// 读取设置
ipcMain.handle('get-settings', async () => {
  return loadSettings();
});

// 保存设置
ipcMain.handle('save-settings', async (event, settings) => {
  saveSettings(settings);
  return true;
});

// 选择数据目录（弹出文件夹选择对话框）
ipcMain.handle('select-data-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择数据存储目录',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
