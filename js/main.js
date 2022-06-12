const { app, BrowserWindow } = require("electron");
const path = require("path");
const remote = require('@electron/remote/main');

const loadMainWindow = () => {
    const mainWindow = new BrowserWindow({
        width : 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    remote.enable(mainWindow.webContents);
    remote.initialize();

    mainWindow.webContents.openDevTools();
    mainWindow.loadFile(path.join(__dirname, "../editor.html"));
}

app.on("ready", loadMainWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});