const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 项目数据
  readProjects: () => ipcRenderer.invoke('read-projects'),
  saveProject: (proj) => ipcRenderer.invoke('save-project', proj),
  deleteProject: (projId) => ipcRenderer.invoke('delete-project', projId),

  // 人员数据
  readPeople: () => ipcRenderer.invoke('read-people'),
  savePeople: (people) => ipcRenderer.invoke('save-people', people),

  // 图片
  saveImage: (taskId, index, base64) => ipcRenderer.invoke('save-image', taskId, index, base64),
  readImage: (taskId, index) => ipcRenderer.invoke('read-image', taskId, index),
  deleteImage: (taskId, index) => ipcRenderer.invoke('delete-image', taskId, index),

  // 复盘数据
  readReviews: () => ipcRenderer.invoke('read-reviews'),
  saveReview: (rec) => ipcRenderer.invoke('save-review', rec),
  deleteReview: (recId) => ipcRenderer.invoke('delete-review', recId),

  // 数据目录
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),

  // 设置
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectDataDir: () => ipcRenderer.invoke('select-data-dir'),

  // 日历日程
  readEvents: () => ipcRenderer.invoke('read-events'),
  saveEvent: (ev) => ipcRenderer.invoke('save-event', ev),
  deleteEvent: (eventId) => ipcRenderer.invoke('delete-event', eventId),

  // 会议纪要
  readMeetings: () => ipcRenderer.invoke('read-meetings'),
  saveMeeting: (meeting) => ipcRenderer.invoke('save-meeting', meeting),
  deleteMeeting: (meetingId) => ipcRenderer.invoke('delete-meeting', meetingId),
  getMeetingConfig: () => ipcRenderer.invoke('get-meeting-config'),
  saveMeetingConfig: (config) => ipcRenderer.invoke('save-meeting-config', config),
  checkWemeetRunning: () => ipcRenderer.invoke('check-wemeet-running'),
  startMeetingWatch: () => ipcRenderer.invoke('start-meeting-watch'),
  stopMeetingWatch: () => ipcRenderer.invoke('stop-meeting-watch'),
  getMeetingWatchStatus: () => ipcRenderer.invoke('get-meeting-watch-status'),
  onMeetingEnded: (callback) => ipcRenderer.on('meeting-ended', (event, data) => callback(data)),

  // 使用时长统计
  startTracking: () => ipcRenderer.invoke('tracking-start'),
  stopTracking: () => ipcRenderer.invoke('tracking-stop'),
  getTrackingStatus: () => ipcRenderer.invoke('tracking-status'),
  getUsageData: (startDate, endDate) => ipcRenderer.invoke('get-usage-data', startDate, endDate),
  getAppIcon: (processName, exePath) => ipcRenderer.invoke('get-app-icon', processName, exePath),
  getTrackingConfig: () => ipcRenderer.invoke('get-tracking-config'),
  saveTrackingConfig: (config) => ipcRenderer.invoke('save-tracking-config', config),
  clearUsageData: (startDate, endDate, clearIcons) => ipcRenderer.invoke('clear-usage-data', startDate, endDate, clearIcons),
  exportUsageCsv: (startDate, endDate) => ipcRenderer.invoke('export-usage-csv', startDate, endDate)
});
