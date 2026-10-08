import { contextBridge, ipcRenderer } from 'electron';

const channels = [
  'auth:login','auth:logout','auth:current',
  'users:list','users:create','users:update','users:permissions','users:delete',
  'products:list','products:create','products:update','products:delete',
  'sale:create','sale:list','sale:items','return:create','load:create',
  'revenue:get','history:get','dashboard:get',
] as const;

type Channel = typeof channels[number];

contextBridge.exposeInMainWorld('bestand', {
  invoke(channel: Channel, ...args: unknown[]) {
    if (!channels.includes(channel)) {
      return Promise.reject(new Error('Canal IPC não permitido.'));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
});
