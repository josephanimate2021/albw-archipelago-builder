// Update before running.
try {
  require('update-electron-app')();
} catch {}

// Run the app after update checking.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const serverPort = 3000;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (runServer = false) => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the apploader file.
  if (runServer) mainWindow.loadFile(path.join(__dirname, "appLoader.html"));
  else mainWindow.loadURL("http://localhost:" + serverPort);

  // Open the DevTools.
  if (isRunningFromSource()) mainWindow.webContents.openDevTools();
  if (runServer) (require("../backend"))(serverPort, mainWindow, isRunningFromSource);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow(true);

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function isRunningFromSource() {
  return (process.platform == "win32" && process.env.HOME)
}