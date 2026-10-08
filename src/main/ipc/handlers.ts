import { ipcMain } from 'electron';
import { AppService } from '../services/app.service';
export function registerHandlers(s:AppService){
 const safe=(fn:any)=>(...args:any[])=>{try{return {ok:true,data:fn(...args)}}catch(e){return {ok:false,error:e instanceof Error?e.message:'Erro inesperado.'}}};
 ipcMain.handle('auth:login',(_,u,p)=>safe((a:string,b:string)=>s.login(a,b))(u,p)); ipcMain.handle('auth:logout',()=>safe(()=>s.logout())()); ipcMain.handle('auth:current',()=>safe(()=>s.current())());
 ipcMain.handle('users:list',()=>safe(()=>s.users())()); ipcMain.handle('users:create',(_,a,b,c)=>safe(s.createUser.bind(s))(a,b,c)); ipcMain.handle('users:update',(_,a,b,c)=>safe(s.updateUser.bind(s))(a,b,c)); ipcMain.handle('users:permissions',(_,a)=>safe(s.userPermissions.bind(s))(a)); ipcMain.handle('users:delete',(_,a)=>safe(s.deleteUser.bind(s))(a));
 ipcMain.handle('products:list',()=>safe(()=>s.products())()); ipcMain.handle('products:create',(_,a,b,c,d)=>safe(s.createProduct.bind(s))(a,b,c,d)); ipcMain.handle('products:update',(_,a,b,c,d,e)=>safe(s.updateProduct.bind(s))(a,b,c,d,e)); ipcMain.handle('products:delete',(_,a)=>safe(s.deleteProduct.bind(s))(a));
 ipcMain.handle('sale:create',(_,a)=>safe(s.createSale.bind(s))(a)); ipcMain.handle('sale:list',()=>safe(()=>s.sales())()); ipcMain.handle('sale:items',(_,a)=>safe(s.saleItems.bind(s))(a)); ipcMain.handle('return:create',(_,a)=>safe(s.createReturn.bind(s))(a)); ipcMain.handle('load:create',(_,a)=>safe(s.createLoad.bind(s))(a)); ipcMain.handle('revenue:get',(_,a,b)=>safe(s.revenue.bind(s))(a,b)); ipcMain.handle('history:get',()=>safe(()=>s.history())()); ipcMain.handle('dashboard:get',()=>safe(()=>s.dashboard())());
}
