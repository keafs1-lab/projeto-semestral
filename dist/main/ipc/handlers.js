"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandlers = registerHandlers;
const electron_1 = require("electron");
function registerHandlers(s) {
    const safe = (fn) => (...args) => { try {
        return { ok: true, data: fn(...args) };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Erro inesperado.' };
    } };
    electron_1.ipcMain.handle('auth:login', (_, u, p) => safe((a, b) => s.login(a, b))(u, p));
    electron_1.ipcMain.handle('auth:logout', () => safe(() => s.logout())());
    electron_1.ipcMain.handle('auth:current', () => safe(() => s.current())());
    electron_1.ipcMain.handle('users:list', () => safe(() => s.users())());
    electron_1.ipcMain.handle('users:create', (_, a, b, c) => safe(s.createUser.bind(s))(a, b, c));
    electron_1.ipcMain.handle('users:update', (_, a, b, c) => safe(s.updateUser.bind(s))(a, b, c));
    electron_1.ipcMain.handle('users:permissions', (_, a) => safe(s.userPermissions.bind(s))(a));
    electron_1.ipcMain.handle('users:delete', (_, a) => safe(s.deleteUser.bind(s))(a));
    electron_1.ipcMain.handle('products:list', () => safe(() => s.products())());
    electron_1.ipcMain.handle('products:create', (_, a, b, c, d) => safe(s.createProduct.bind(s))(a, b, c, d));
    electron_1.ipcMain.handle('products:update', (_, a, b, c, d, e) => safe(s.updateProduct.bind(s))(a, b, c, d, e));
    electron_1.ipcMain.handle('products:delete', (_, a) => safe(s.deleteProduct.bind(s))(a));
    electron_1.ipcMain.handle('sale:create', (_, a) => safe(s.createSale.bind(s))(a));
    electron_1.ipcMain.handle('sale:list', () => safe(() => s.sales())());
    electron_1.ipcMain.handle('sale:items', (_, a) => safe(s.saleItems.bind(s))(a));
    electron_1.ipcMain.handle('return:create', (_, a) => safe(s.createReturn.bind(s))(a));
    electron_1.ipcMain.handle('load:create', (_, a) => safe(s.createLoad.bind(s))(a));
    electron_1.ipcMain.handle('revenue:get', (_, a, b) => safe(s.revenue.bind(s))(a, b));
    electron_1.ipcMain.handle('history:get', () => safe(() => s.history())());
    electron_1.ipcMain.handle('dashboard:get', () => safe(() => s.dashboard())());
}
