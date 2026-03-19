const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

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

// ========== IPC: 复盘数据 ==========

// 读取所有复盘记录
ipcMain.handle('read-reviews', async () => {
  const dataDir = getDataDir();
  const files = fs.readdirSync(dataDir).filter(f => f.startsWith('review_') && f.endsWith('.json'));
  const reviews = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      reviews.push(JSON.parse(content));
    } catch {}
  }
  return reviews;
});

// 保存单个复盘
ipcMain.handle('save-review', async (event, rec) => {
  const dataDir = getDataDir();
  const filePath = path.join(dataDir, `review_${rec.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(rec, null, 2), 'utf-8');
  return true;
});

// 删除复盘
ipcMain.handle('delete-review', async (event, recId) => {
  const dataDir = getDataDir();
  const filePath = path.join(dataDir, `review_${recId}.json`);
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

// ========== IPC: 日历日程 ==========

function getCalendarDir() {
  const dir = path.join(getDataDir(), 'calendar');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('read-events', async () => {
  const calDir = getCalendarDir();
  const files = fs.readdirSync(calDir).filter(f => f.startsWith('event_') && f.endsWith('.json'));
  const events = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(calDir, file), 'utf-8');
      events.push(JSON.parse(content));
    } catch (e) { /* skip corrupt files */ }
  }
  return events;
});

ipcMain.handle('save-event', async (event, ev) => {
  const calDir = getCalendarDir();
  const filePath = path.join(calDir, `event_${ev.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(ev, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('delete-event', async (event, eventId) => {
  const calDir = getCalendarDir();
  const filePath = path.join(calDir, `event_${eventId}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

// ========== 应用使用时长统计模块 ==========

const DEFAULT_EXCLUDED_APPS = [
  'explorer', 'Taskmgr', 'SystemSettings', 'ShellExperienceHost',
  'SearchHost', 'StartMenuExperienceHost', 'TextInputHost',
  'LockApp', 'ScreenClippingHost', 'ApplicationFrameHost'
];

// 采集状态
let trackingState = {
  psProcess: null,        // PowerShell 持久子进程
  pollInterval: null,     // 轮询 interval
  saveInterval: null,     // 定期持久化 interval
  isRunning: false,
  todayData: null,        // 内存中的当日数据
  todayDate: null,        // 当前日期字符串
  lastApp: null,          // 上次检测到的前台应用
  lastTimestamp: null      // 上次检测时间
};

function getUsageDir() {
  const dir = path.join(getDataDir(), 'app-usage');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getIconsDir() {
  const dir = path.join(getUsageDir(), 'icons');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getTrackingConfigPath() {
  return path.join(getUsageDir(), 'config.json');
}

function loadTrackingConfig() {
  const p = getTrackingConfigPath();
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return {
    trackingEnabled: true,
    intervalMs: 1000,
    excludedApps: DEFAULT_EXCLUDED_APPS,
    retentionDays: 180
  };
}

function saveTrackingConfigFile(config) {
  fs.writeFileSync(getTrackingConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function getUsageFilePath(dateStr) {
  return path.join(getUsageDir(), `usage_${dateStr}.json`);
}

function loadDayData(dateStr) {
  const fp = getUsageFilePath(dateStr);
  try {
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch {}
  return { date: dateStr, apps: {} };
}

function saveDayData(dateStr, data) {
  fs.writeFileSync(getUsageFilePath(dateStr), JSON.stringify(data, null, 2), 'utf-8');
}

// PowerShell 脚本：持续输出前台窗口信息
const PS_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinAPI {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@

while ($true) {
    try {
        $hwnd = [WinAPI]::GetForegroundWindow()
        $procId = [uint32]0
        [WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
        if ($procId -gt 0) {
            $sb = New-Object System.Text.StringBuilder 512
            [WinAPI]::GetWindowText($hwnd, $sb, 512) | Out-Null
            $title = $sb.ToString()
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName) {
                $name = $proc.ProcessName
                $exePath = ""
                try { $exePath = $proc.Path } catch {}
                [Console]::Out.WriteLine("$name|$exePath|$title")
                [Console]::Out.Flush()
            }
        }
    } catch {}
    Start-Sleep -Milliseconds INTERVAL_PLACEHOLDER
}
`;

function startTracking() {
  if (trackingState.isRunning) return;

  const config = loadTrackingConfig();
  const interval = config.intervalMs || 1000;
  const excludedApps = config.excludedApps || DEFAULT_EXCLUDED_APPS;

  // 加载今日数据到内存
  const today = getTodayStr();
  trackingState.todayDate = today;
  trackingState.todayData = loadDayData(today);

  // 启动 PowerShell 持久子进程
  const script = PS_SCRIPT.replace('INTERVAL_PLACEHOLDER', String(interval));
  const ps = spawn('powershell.exe', [
    '-NoProfile', '-NoLogo', '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-Command', script
  ], {
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true
  });

  trackingState.psProcess = ps;
  trackingState.isRunning = true;

  let lineBuffer = '';
  ps.stdout.setEncoding('utf8');
  ps.stdout.on('data', (chunk) => {
    lineBuffer += chunk;
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop(); // 保留未完成的行

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split('|');
      if (parts.length < 2) continue;

      const processName = parts[0];
      const exePath = parts[1] || '';
      const windowTitle = parts.slice(2).join('|') || '';

      // 跳过排除的应用和本应用
      if (excludedApps.includes(processName)) continue;
      if (processName === 'electron' || processName === 'weekly-work-review') continue;

      const now = new Date();
      const currentDate = getTodayStr();

      // 跨日处理
      if (currentDate !== trackingState.todayDate) {
        saveDayData(trackingState.todayDate, trackingState.todayData);
        trackingState.todayDate = currentDate;
        trackingState.todayData = loadDayData(currentDate);
        trackingState.lastApp = null;
        trackingState.lastTimestamp = null;
      }

      const data = trackingState.todayData;
      if (!data.apps[processName]) {
        data.apps[processName] = {
          name: processName,
          exePath: exePath,
          totalSeconds: 0,
          launches: 1,
          sessions: [{ start: getTimeStr(), end: getTimeStr() }]
        };
        // 异步提取图标
        extractAppIcon(processName, exePath);
      }

      const appData = data.apps[processName];
      // 更新 exePath（以最新为准）
      if (exePath && !appData.exePath) appData.exePath = exePath;

      // 计算时长增量
      const elapsedSec = Math.round(interval / 1000);

      if (trackingState.lastApp === processName) {
        // 继续使用同一应用
        appData.totalSeconds += elapsedSec;
        const lastSession = appData.sessions[appData.sessions.length - 1];
        if (lastSession) lastSession.end = getTimeStr();
      } else {
        // 切换到新应用
        if (trackingState.lastApp && data.apps[trackingState.lastApp]) {
          const prevApp = data.apps[trackingState.lastApp];
          const prevSession = prevApp.sessions[prevApp.sessions.length - 1];
          if (prevSession) prevSession.end = getTimeStr();
        }
        appData.totalSeconds += elapsedSec;
        // 判断是否为新 session（距上次使用该应用超过 60 秒）
        const lastSession = appData.sessions[appData.sessions.length - 1];
        const timeNow = getTimeStr();
        if (!lastSession || (trackingState.lastApp !== processName)) {
          // 如果最后一个 session 的 end 距当前时间较远，新建 session
          const shouldNewSession = !lastSession ||
            timeDiffSeconds(lastSession.end, timeNow) > 60;
          if (shouldNewSession) {
            appData.sessions.push({ start: timeNow, end: timeNow });
            appData.launches++;
          } else {
            lastSession.end = timeNow;
          }
        }
      }

      trackingState.lastApp = processName;
      trackingState.lastTimestamp = now;
    }
  });

  ps.on('close', () => {
    // 进程意外退出时保存数据
    if (trackingState.todayData && trackingState.todayDate) {
      saveDayData(trackingState.todayDate, trackingState.todayData);
    }
    trackingState.isRunning = false;
    trackingState.psProcess = null;
  });

  // 每 30 秒持久化一次
  trackingState.saveInterval = setInterval(() => {
    if (trackingState.todayData && trackingState.todayDate) {
      saveDayData(trackingState.todayDate, trackingState.todayData);
    }
  }, 30000);
}

function timeDiffSeconds(time1, time2) {
  // time format: "HH:MM:SS"
  const [h1, m1, s1] = time1.split(':').map(Number);
  const [h2, m2, s2] = time2.split(':').map(Number);
  return Math.abs((h2 * 3600 + m2 * 60 + s2) - (h1 * 3600 + m1 * 60 + s1));
}

function stopTracking() {
  if (trackingState.psProcess) {
    trackingState.psProcess.kill();
    trackingState.psProcess = null;
  }
  if (trackingState.saveInterval) {
    clearInterval(trackingState.saveInterval);
    trackingState.saveInterval = null;
  }
  // 保存当前数据
  if (trackingState.todayData && trackingState.todayDate) {
    saveDayData(trackingState.todayDate, trackingState.todayData);
  }
  trackingState.isRunning = false;
  trackingState.lastApp = null;
  trackingState.lastTimestamp = null;
}

// 图标提取
async function extractAppIcon(processName, exePath) {
  const iconsDir = getIconsDir();
  const iconPath = path.join(iconsDir, `${processName}.png`);

  // 已缓存则跳过
  if (fs.existsSync(iconPath)) return;

  try {
    const targetPath = exePath || processName;
    if (!targetPath) return;
    const nativeImage = await app.getFileIcon(targetPath, { size: 'large' });
    const pngBuffer = nativeImage.toPNG();
    fs.writeFileSync(iconPath, pngBuffer);
  } catch {
    // 图标提取失败，不影响主流程
  }
}

// ========== IPC: 使用时长统计 ==========

ipcMain.handle('tracking-start', async () => {
  startTracking();
  return true;
});

ipcMain.handle('tracking-stop', async () => {
  stopTracking();
  return true;
});

ipcMain.handle('tracking-status', async () => {
  return { isRunning: trackingState.isRunning };
});

ipcMain.handle('get-usage-data', async (event, startDate, endDate) => {
  const result = {};
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // 如果是今天且有内存数据，用内存数据
    if (dateStr === trackingState.todayDate && trackingState.todayData) {
      result[dateStr] = trackingState.todayData;
    } else {
      const dayData = loadDayData(dateStr);
      if (dayData && Object.keys(dayData.apps).length > 0) {
        result[dateStr] = dayData;
      }
    }
  }
  return result;
});

ipcMain.handle('get-app-icon', async (event, processName, exePath) => {
  const iconsDir = getIconsDir();
  const iconPath = path.join(iconsDir, `${processName}.png`);

  // 尝试读缓存
  if (fs.existsSync(iconPath)) {
    return fs.readFileSync(iconPath).toString('base64');
  }

  // 尝试提取
  try {
    const targetPath = exePath || processName;
    if (!targetPath) return null;
    const nativeImage = await app.getFileIcon(targetPath, { size: 'large' });
    const pngBuffer = nativeImage.toPNG();
    fs.writeFileSync(iconPath, pngBuffer);
    return pngBuffer.toString('base64');
  } catch {
    return null;
  }
});

ipcMain.handle('get-tracking-config', async () => {
  return loadTrackingConfig();
});

ipcMain.handle('save-tracking-config', async (event, config) => {
  saveTrackingConfigFile(config);
  // 如果正在采集，重启以应用新配置
  if (trackingState.isRunning) {
    stopTracking();
    if (config.trackingEnabled !== false) {
      startTracking();
    }
  }
  return true;
});

ipcMain.handle('clear-usage-data', async (event, startDate, endDate, clearIcons) => {
  const usageDir = getUsageDir();
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fp = path.join(usageDir, `usage_${dateStr}.json`);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    // 如果清理的是今天的数据，同时重置内存
    if (dateStr === trackingState.todayDate) {
      trackingState.todayData = { date: dateStr, apps: {} };
      trackingState.lastApp = null;
    }
  }

  if (clearIcons) {
    const iconsDir = getIconsDir();
    if (fs.existsSync(iconsDir)) {
      const files = fs.readdirSync(iconsDir);
      for (const f of files) {
        try { fs.unlinkSync(path.join(iconsDir, f)); } catch {}
      }
    }
  }
  return true;
});

ipcMain.handle('export-usage-csv', async (event, startDate, endDate) => {
  const data = {};
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dateStr === trackingState.todayDate && trackingState.todayData) {
      data[dateStr] = trackingState.todayData;
    } else {
      const dayData = loadDayData(dateStr);
      if (dayData && Object.keys(dayData.apps).length > 0) {
        data[dateStr] = dayData;
      }
    }
  }

  // 生成 CSV
  let csv = '\ufeff日期,应用名称,使用时长(秒),使用时长(格式化),启动次数,可执行文件路径\n';
  for (const [dateStr, dayData] of Object.entries(data)) {
    for (const [, appInfo] of Object.entries(dayData.apps)) {
      const hours = Math.floor(appInfo.totalSeconds / 3600);
      const mins = Math.floor((appInfo.totalSeconds % 3600) / 60);
      const secs = appInfo.totalSeconds % 60;
      const formatted = `${hours}h ${mins}m ${secs}s`;
      csv += `${dateStr},${appInfo.name},${appInfo.totalSeconds},${formatted},${appInfo.launches || 0},"${(appInfo.exePath || '').replace(/"/g, '""')}"\n`;
    }
  }

  // 弹出保存对话框
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出使用时长数据',
    defaultPath: `usage_${startDate}_${endDate}.csv`,
    filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
  });

  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, csv, 'utf-8');
  return true;
});

// 应用启动时自动开始采集
app.whenReady().then(() => {
  const config = loadTrackingConfig();
  if (config.trackingEnabled !== false) {
    startTracking();
  }
});

// 应用退出前保存数据并停止采集
app.on('before-quit', () => {
  stopTracking();
});
