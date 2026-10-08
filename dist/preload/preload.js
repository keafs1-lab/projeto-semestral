"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const channels = [
    'auth:login', 'auth:logout', 'auth:current',
    'users:list', 'users:create', 'users:update', 'users:permissions', 'users:delete',
    'products:list', 'products:create', 'products:update', 'products:delete',
    'sale:create', 'sale:list', 'sale:items', 'return:create', 'load:create',
    'revenue:get', 'history:get', 'dashboard:get',
];
electron_1.contextBridge.exposeInMainWorld('bestand', {
    invoke(channel, ...args) {
        if (!channels.includes(channel)) {
            return Promise.reject(new Error('Canal IPC não permitido.'));
        }
        return electron_1.ipcRenderer.invoke(channel, ...args);
    },
});
