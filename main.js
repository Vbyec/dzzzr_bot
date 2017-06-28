const {app, BrowserWindow} = require('electron');
const ipcMain = require('electron').ipcMain;
const path = require('path');
const url = require('url');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

let BotClass = require('./bot'),
    DataStore = require('nedb-promise'),
    TeamsInDB = new DataStore({filename: 'db/TeamSettings', autoload: true});

function save() {
    TeamsInDB.update({_id: this._id}, this)
}

function start() {
    new BotClass(this);
}

TeamsInDB.findOne({}).then(function (team_config) {
    if (team_config === null) {
        TeamsInDB.insert({
            admin_user: [{username: "", id: null}],
            registered_chat_ids: [],
            token: "",
            bot_name: "",
            log_path: "bot_logs",
            engine: "",
            classic: {pin: "", http_login: "", password: "", login: "", city: ''},
            light: {pin: "", city: ''},
        }).then(function () {
            TeamsInDB.findOne({}).then(team_config => {
                team_config.save = save;
                team_config.start = start;
                global.teamConfig = team_config;
            })
        });
    } else {
        team_config.save = save;
        team_config.start = start;
        global.teamConfig = team_config;
    }
});

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({width: 1000, height: 800});
    win.setMenu(null);

    // and load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    });
    // win.webContents.openDevTools()

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.