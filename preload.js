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

  // 数据目录
  getDataDir: () => ipcRenderer.invoke('get-data-dir')
});
