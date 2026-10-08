import { Database } from '../db/database';
import { Permission, SessionUser, Product, SaleInput, ReturnInput, LoadInput } from '../domain/types';
import { hashPassword, verifyPassword } from './security';

const ALL:Permission[]=['USER_MANAGE','PRODUCT_CREATE','PRODUCT_UPDATE','PRODUCT_DELETE','SALE_CREATE','RETURN_CREATE','LOAD_CREATE','REVENUE_VIEW'];
const money=(n:number)=>{ if(!Number.isFinite(n)||n<0) throw new Error('Valor monetário inválido.'); return Math.round(n*100); };
const fromCents=(n:number)=>n/100;
export class AppService {
  private session:SessionUser|null=null;
  constructor(private db:Database){}
  login(username:string,password:string){ const u=this.db.queryOne<any>('SELECT * FROM users WHERE username=? AND active=1',[username]); if(!u||!verifyPassword(password,u.password_hash)) throw new Error('Usuário ou senha inválidos.'); const ps=this.db.query< any>('SELECT permission FROM permissions WHERE user_id=?',[u.id]).map(x=>x.permission as Permission); if(u.is_admin) ps.splice(0,ps.length,...ALL); this.session={id:u.id,username:u.username,permissions:ps}; return this.session; }
  logout(){this.session=null;} current(){return this.session;}
  private require(p:Permission){ if(!this.session) throw new Error('Sessão expirada.'); if(this.session.permissions.includes(p)) return; throw new Error('Você não possui permissão para esta operação.'); }
  users(){this.require('USER_MANAGE'); return this.db.query<any>('SELECT id,username,is_admin,active,created_at FROM users WHERE active=1 ORDER BY username');}
  userPermissions(username:string){this.require('USER_MANAGE'); const u=this.db.queryOne<any>('SELECT id FROM users WHERE username=?',[username]); if(!u) throw new Error('Perfil não cadastrado no sistema.'); return this.db.query<any>('SELECT permission FROM permissions WHERE user_id=? ORDER BY permission',[u.id]).map(x=>x.permission);}
  createUser(username:string,password:string,permissions:Permission[]){this.require('USER_MANAGE'); if(!/^[A-Za-z0-9_-]+$/.test(username)) throw new Error('Nome de perfil contém caracteres inválidos.'); if(!password) throw new Error('Senha obrigatória.'); if(this.db.queryOne('SELECT id FROM users WHERE username=?',[username])) throw new Error('Já existe um perfil com o nome informado.'); this.db.transaction(()=>{this.db.exec('INSERT INTO users(username,password_hash) VALUES(?,?)',[username,hashPassword(password)]); const id=this.db.queryOne<any>('SELECT id FROM users WHERE username=?',[username])!.id; for(const p of permissions)this.db.exec('INSERT INTO permissions(user_id,permission) VALUES(?,?)',[id,p]); this.audit('CREATE','USER',id,username);});}
  updateUser(username:string,password:string|undefined,permissions:Permission[]){this.require('USER_MANAGE'); const u=this.db.queryOne<any>('SELECT * FROM users WHERE username=?',[username]); if(!u) throw new Error('Perfil não cadastrado no sistema.'); if(u.is_admin) throw new Error('O perfil admin não pode ser alterado.'); this.db.transaction(()=>{if(password)this.db.exec('UPDATE users SET password_hash=? WHERE id=?',[hashPassword(password),u.id]); this.db.exec('DELETE FROM permissions WHERE user_id=?',[u.id]); for(const p of permissions)this.db.exec('INSERT INTO permissions(user_id,permission) VALUES(?,?)',[u.id,p]); this.audit('UPDATE','USER',u.id,username);});}
  deleteUser(username:string){this.require('USER_MANAGE'); const u=this.db.queryOne<any>('SELECT * FROM users WHERE username=?',[username]); if(!u) throw new Error('Perfil não cadastrado no sistema.'); if(u.is_admin) throw new Error('O perfil admin não pode ser removido.'); this.db.transaction(()=>{this.db.exec(`UPDATE users SET active=0,username=username||'#removido-'||id WHERE id=?`,[u.id]); this.audit('DELETE','USER',u.id,username);});}
  products():Product[]{return this.db.query<any>('SELECT id,name,code,price_cents/100.0 price,cost_cents/100.0 costPrice,stock FROM products WHERE active=1 ORDER BY name');}
  createProduct(name:string,code:string,price:number,costPrice:number|null){this.require('PRODUCT_CREATE'); if(!name.trim()||!code.trim()||price<0)throw new Error('Preencha corretamente os campos obrigatórios.'); if(this.db.queryOne('SELECT id FROM products WHERE code=?',[code]))throw new Error('Já existe um produto com o código informado.'); this.db.transaction(()=>{this.db.exec('INSERT INTO products(name,code,price_cents,cost_cents) VALUES(?,?,?,?)',[name.trim(),code.trim(),money(price),costPrice==null?null:money(costPrice)]);});}
  updateProduct(id:number,name:string,code:string,price:number,costPrice:number|null){this.require('PRODUCT_UPDATE'); if(!name.trim()||!code.trim()||price<0)throw new Error('Preencha corretamente os campos obrigatórios.'); const dup=this.db.queryOne<any>('SELECT id FROM products WHERE code=? AND id<>?',[code,id]); if(dup)throw new Error('Já existe um produto com o código informado.'); this.db.transaction(()=>this.db.exec('UPDATE products SET name=?,code=?,price_cents=?,cost_cents=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[name.trim(),code.trim(),money(price),costPrice==null?null:money(costPrice),id]));}
  deleteProduct(id:number){this.require('PRODUCT_DELETE'); const product=this.db.queryOne<any>('SELECT id,active FROM products WHERE id=?',[id]); if(!product||!product.active) throw new Error('Produto não encontrado.'); this.db.transaction(()=>{this.db.exec(`UPDATE products SET active=0,code=code||'#removido-'||id,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[id]); this.audit('DELETE','PRODUCT',id);});}
  createSale(input:SaleInput){
    this.require('SALE_CREATE');
    if(!input.items.length) throw new Error('A venda precisa ter ao menos um produto.');
    const validPayments=['DINHEIRO','PIX','CARTAO_CREDITO','CARTAO_DEBITO','OUTRO'];
    if(!validPayments.includes(input.paymentMethod)) throw new Error('Método de pagamento inválido.');
    const grouped=new Map<number,number>();
    for(const i of input.items){ if(!Number.isInteger(i.quantity)||i.quantity<=0) throw new Error('Quantidade inválida.'); grouped.set(i.productId,(grouped.get(i.productId)||0)+i.quantity); }
    return this.db.transaction(()=>{
      const items=[...grouped.entries()].map(([productId,quantity])=>({productId,quantity})); let total=0;
      for(const i of items){ const p=this.db.queryOne<any>('SELECT * FROM products WHERE id=? AND active=1',[i.productId]); if(!p) throw new Error('Produto não encontrado.'); if(p.stock<i.quantity) throw new Error(`Estoque insuficiente para ${p.name}.`); total+=p.price_cents*i.quantity; }
      this.db.exec('INSERT INTO sales(user_id,payment_method,total_cents) VALUES(?,?,?)',[this.session!.id,input.paymentMethod,total]);
      const sale=this.db.queryOne<any>('SELECT last_insert_rowid() id')!.id;
      for(const i of items){ const p=this.db.queryOne<any>('SELECT price_cents,cost_cents FROM products WHERE id=?',[i.productId]); this.db.exec('INSERT INTO sale_items(sale_id,product_id,quantity,unit_price_cents,unit_cost_cents) VALUES(?,?,?,?,?)',[sale,i.productId,i.quantity,p.price_cents,p.cost_cents??0]); this.db.exec('UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[i.quantity,i.productId]); }
      this.audit('CREATE','SALE',sale,`total=${total}`); return sale;
    });
  }

  createReturn(input:ReturnInput){
    this.require('RETURN_CREATE');
    if(!input.items.length) throw new Error('Selecione ao menos um item para devolver.');
    const validReasons=['DEFEITO','ARREPENDIMENTO','TROCA','OUTRO','NAO_ESPECIFICADO'];
    if(!validReasons.includes(input.reason)) throw new Error('Motivo de devolução inválido.');
    if(input.reason==='OUTRO'&&!input.reasonOther?.trim()) throw new Error('Informe o motivo da devolução.');
    const grouped=new Map<number,number>();
    for(const i of input.items){ if(!Number.isInteger(i.quantity)||i.quantity<=0) throw new Error('Quantidade de devolução inválida.'); grouped.set(i.saleItemId,(grouped.get(i.saleItemId)||0)+i.quantity); }
    return this.db.transaction(()=>{
      const sale=this.db.queryOne<any>('SELECT id FROM sales WHERE id=?',[input.saleId]); if(!sale) throw new Error('Venda não encontrada.');
      const items=[...grouped.entries()].map(([saleItemId,quantity])=>({saleItemId,quantity})); let total=0;
      for(const i of items){ const row=this.db.queryOne<any>('SELECT * FROM sale_items WHERE id=? AND sale_id=?',[i.saleItemId,input.saleId]); if(!row) throw new Error('Item da venda não encontrado.'); const returned=this.db.queryOne<any>('SELECT COALESCE(SUM(quantity),0) q FROM return_items WHERE sale_item_id=?',[i.saleItemId]).q; if(returned+i.quantity>row.quantity) throw new Error('Quantidade devolvida não pode ser superior à quantidade vendida.'); total+=row.unit_price_cents*i.quantity; }
      this.db.exec('INSERT INTO returns(sale_id,user_id,reason,reason_other,total_cents) VALUES(?,?,?,?,?)',[input.saleId,this.session!.id,input.reason,input.reasonOther?.trim()||null,total]);
      const rid=this.db.queryOne<any>('SELECT last_insert_rowid() id')!.id;
      for(const i of items){ const row=this.db.queryOne<any>('SELECT unit_price_cents,unit_cost_cents,product_id FROM sale_items WHERE id=?',[i.saleItemId]); this.db.exec('INSERT INTO return_items(return_id,sale_item_id,quantity,unit_price_cents,unit_cost_cents) VALUES(?,?,?,?,?)',[rid,i.saleItemId,i.quantity,row.unit_price_cents,row.unit_cost_cents??0]); this.db.exec('UPDATE products SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[i.quantity,row.product_id]); }
      this.audit('CREATE','RETURN',rid,`sale=${input.saleId}`); return rid;
    });
  }

  createLoad(input:LoadInput){this.require('LOAD_CREATE'); if(!input.items.length)throw new Error('O carregamento precisa ter ao menos um produto.'); return this.db.transaction(()=>{this.db.exec('INSERT INTO loads(user_id) VALUES(?)',[this.session!.id]); const load=this.db.queryOne<any>('SELECT last_insert_rowid() id')!.id; for(const i of input.items){if(!Number.isInteger(i.quantity)||i.quantity<=0)throw new Error('Quantidade deve ser válida.'); if(!i.source.trim())throw new Error('Fonte do produto é obrigatória.'); const p=this.db.queryOne<any>('SELECT id FROM products WHERE id=? AND active=1',[i.productId]); if(!p)throw new Error('Produto não encontrado.'); const unitCost=i.unitCost==null?null:money(i.unitCost); this.db.exec('INSERT INTO load_items(load_id,product_id,quantity,source,unit_cost_cents) VALUES(?,?,?,?,?)',[load,i.productId,i.quantity,i.source.trim(),unitCost]); if(unitCost==null) this.db.exec('UPDATE products SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[i.quantity,i.productId]); else this.db.exec('UPDATE products SET stock=stock+?,cost_cents=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[i.quantity,unitCost,i.productId]);} this.audit('CREATE','LOAD',load); return load;});}
  saleItems(saleId:number){ if(!this.session) throw new Error('Sessão expirada.'); const sale=this.db.queryOne<any>('SELECT id FROM sales WHERE id=?',[saleId]); if(!sale) throw new Error('Venda não encontrada.'); return this.db.query<any>(`SELECT si.id,si.product_id productId,p.name,p.code,si.quantity,si.unit_price_cents/100.0 unitPrice,COALESCE(SUM(ri.quantity),0) returned FROM sale_items si JOIN products p ON p.id=si.product_id LEFT JOIN return_items ri ON ri.sale_item_id=si.id WHERE si.sale_id=? GROUP BY si.id,p.name,p.code,si.quantity,si.unit_price_cents ORDER BY si.id`,[saleId]);}
  sales(){return this.db.query<any>(`SELECT s.id,s.total_cents/100.0 total,s.payment_method paymentMethod,s.created_at createdAt,u.username FROM sales s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC`);}
  revenue(start:string,end:string){
    this.require('REVENUE_VIEW');
    if(!start||!end) throw new Error('Informe a data inicial e a data final.');
    if(start>end) throw new Error('A data inicial deve ser anterior ou igual à data final.');
    const daily=this.db.query<any>(`SELECT day,SUM(sales) sales,SUM(returns) returns FROM (SELECT date(created_at,'localtime') day,SUM(total_cents)/100.0 sales,0.0 returns FROM sales WHERE date(created_at,'localtime') BETWEEN date(?) AND date(?) GROUP BY day UNION ALL SELECT date(created_at,'localtime') day,0.0 sales,SUM(total_cents)/100.0 returns FROM returns WHERE date(created_at,'localtime') BETWEEN date(?) AND date(?) GROUP BY day) GROUP BY day ORDER BY day`,[start,end,start,end]);
    const sales=this.db.queryOne<any>(`SELECT COALESCE(SUM(total_cents),0)/100.0 value FROM sales WHERE date(created_at,'localtime') BETWEEN date(?) AND date(?)`,[start,end])!.value;
    const returns=this.db.queryOne<any>(`SELECT COALESCE(SUM(total_cents),0)/100.0 value FROM returns WHERE date(created_at,'localtime') BETWEEN date(?) AND date(?)`,[start,end])!.value;
    const cost=this.db.queryOne<any>(`SELECT (SELECT COALESCE(SUM(si.quantity*si.unit_cost_cents),0) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE date(s.created_at,'localtime') BETWEEN date(?) AND date(?)) - (SELECT COALESCE(SUM(ri.quantity*ri.unit_cost_cents),0) FROM return_items ri JOIN returns r ON r.id=ri.return_id WHERE date(r.created_at,'localtime') BETWEEN date(?) AND date(?)) value`,[start,end,start,end])!.value/100;
    return {salesTotal:sales,returnsTotal:returns,result:sales-returns,costTotal:Math.max(0,cost),daily};
  }
  history(){
    if(!this.session) throw new Error('Sessão expirada.');
    return {
      sales:this.db.query<any>(`SELECT s.id,s.total_cents/100.0 total,s.payment_method paymentMethod,s.created_at createdAt,u.username FROM sales s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC LIMIT 200`),
      returns:this.db.query<any>(`SELECT r.id,r.sale_id saleId,r.total_cents/100.0 total,r.reason,r.reason_other reasonOther,r.created_at createdAt,u.username FROM returns r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 200`),
      loads:this.db.query<any>(`SELECT l.id,l.created_at createdAt,u.username FROM loads l JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 200`)
    };
  }

  audit(action:string,entity:string,entityId:number|undefined,details?:string){if(this.session)this.db.exec('INSERT INTO audit_logs(user_id,action,entity,entity_id,details) VALUES(?,?,?,?,?)',[this.session.id,action,entity,entityId??null,details??null]);}
  dashboard(){return {products:this.db.queryOne<any>('SELECT COUNT(*) n FROM products WHERE active=1')!.n,units:this.db.queryOne<any>('SELECT COALESCE(SUM(stock),0) n FROM products WHERE active=1')!.n,lowStock:this.db.queryOne<any>('SELECT COUNT(*) n FROM products WHERE active=1 AND stock=0')!.n,stockValue:this.db.queryOne<any>('SELECT COALESCE(SUM(stock*cost_cents),0)/100.0 n FROM products WHERE active=1')!.n};}
}
