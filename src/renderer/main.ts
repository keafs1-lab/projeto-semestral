import './styles.css';

const api = window.bestand;
const permissions = ['USER_MANAGE','PRODUCT_CREATE','PRODUCT_UPDATE','PRODUCT_DELETE','SALE_CREATE','RETURN_CREATE','LOAD_CREATE','REVENUE_VIEW'];
type Perm = string;
let session: any = null;
const app = document.querySelector<HTMLDivElement>('#app')!;

function esc(value: unknown) { return String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!)); }
function dt(utc: string) { return new Date(utc.replace(' ', 'T') + 'Z').toLocaleString('pt-BR'); }
function money(n: number) { return Number(n || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
async function call(channel: string, ...args: any[]) { const r = await api.invoke(channel, ...args); if (!r.ok) throw new Error(r.error); return r.data; }
function has(p: Perm) { return session?.permissions?.includes(p); }
function selectedPermissions(): string[] { return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="perm"]:checked')).map(x => x.value); }

function shell() {
  const nav = [
    ['dashboard','Painel',true], ['products','Produtos',has('PRODUCT_CREATE') || has('PRODUCT_UPDATE') || has('PRODUCT_DELETE')],
    ['sale','Venda',has('SALE_CREATE')], ['return','Devolução',has('RETURN_CREATE')], ['load','Carregamento',has('LOAD_CREATE')],
    ['revenue','Receita',has('REVENUE_VIEW')], ['history','Histórico',true], ['users','Perfis',has('USER_MANAGE')]
  ];
  app.innerHTML = `<div class="layout"><aside><div class="brand">BESTAND</div><div class="muted">Estoque desktop</div><nav id="nav">${nav.filter(x=>x[2]).map(x=>`<button data-page="${x[0]}">${x[1]}</button>`).join('')}</nav><button id="logout" class="danger">Sair</button></aside><main><header><div><h1 id="title">Painel de Controle</h1><span>Usuário: ${esc(session.username)}</span></div></header><section id="content"></section></main></div>`;
  document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(b => b.onclick = () => route(b.dataset.page!));
  document.querySelector('#logout')!.addEventListener('click', async () => { await call('auth:logout'); location.reload(); });
  route('dashboard');
}

async function route(page: string) {
  const title = document.querySelector<HTMLElement>('#title')!;
  const c = document.querySelector<HTMLElement>('#content')!;
  try {
    if (page === 'dashboard') {
      title.textContent = 'Painel de Controle';
      const d = await call('dashboard:get');
      c.innerHTML = `<div class="cards"><div><b>Produtos</b><strong>${d.products}</strong></div><div><b>Unidades em estoque</b><strong>${d.units}</strong></div><div><b>Produtos zerados</b><strong>${d.lowStock}</strong></div><div><b>Valor do estoque</b><strong>${money(d.stockValue)}</strong></div></div>`;
    } else if (page === 'products') await productsPage(c, title);
    else if (page === 'sale') await saleForm(c, title);
    else if (page === 'return') await returnForm(c, title);
    else if (page === 'load') await loadForm(c, title);
    else if (page === 'revenue') revenueForm(c, title);
    else if (page === 'history') await historyPage(c, title);
    else if (page === 'users') await usersPage(c, title);
  } catch (e) { c.innerHTML = `<div class="error">${esc((e as Error).message)}</div>`; }
}

async function productsPage(c: HTMLElement, title: HTMLElement) {
  title.textContent = 'Produtos';
  const p = await call('products:list');
  c.innerHTML = `<div class="toolbar">${has('PRODUCT_CREATE') ? '<button id="new">Novo produto</button>' : ''}</div><table><thead><tr><th>Nome</th><th>Código</th><th>Preço</th><th>Custo</th><th>Estoque</th><th>Ações</th></tr></thead><tbody>${p.map((x:any)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.code)}</td><td>${money(x.price)}</td><td>${x.costPrice==null?'—':money(x.costPrice)}</td><td>${x.stock}</td><td>${has('PRODUCT_UPDATE')?`<button class="edit" data-id="${x.id}">Editar</button>`:''} ${has('PRODUCT_DELETE')?`<button class="del" data-id="${x.id}">Remover</button>`:''}</td></tr>`).join('')}</tbody></table>`;
  document.querySelector('#new')?.addEventListener('click', () => productForm());
  document.querySelectorAll<HTMLElement>('.edit').forEach(b => b.addEventListener('click', () => productForm(p.find((x:any)=>x.id === Number(b.dataset.id)))));
  document.querySelectorAll<HTMLElement>('.del').forEach(b => b.addEventListener('click', async () => { if (confirm('Remover produto?')) { try { await call('products:delete', Number(b.dataset.id)); await productsPage(c,title); } catch(e) { alert((e as Error).message); } } }));
}

function productForm(p?: any) {
  const c = document.querySelector<HTMLElement>('#content')!;
  c.innerHTML = `<form id="pf" class="panel"><h2>${p?'Alterar':'Cadastrar'} produto</h2><label>Nome<input name="name" value="${esc(p?.name)}" required></label><label>Código<input name="code" value="${esc(p?.code)}" required></label><label>Preço de venda<input name="price" type="number" min="0" step="0.01" value="${p?.price??0}" required></label><label>Custo de aquisição (opcional)<input name="cost" type="number" min="0" step="0.01" value="${p?.costPrice??''}"></label><div><button type="submit">Confirmar</button><button type="button" id="cancel">Cancelar</button></div></form>`;
  document.querySelector('#cancel')!.addEventListener('click', () => route('products'));
  document.querySelector('#pf')!.addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target as HTMLFormElement); try { const cost = f.get('cost') === '' ? null : Number(f.get('cost')); if (p) await call('products:update',p.id,f.get('name'),f.get('code'),Number(f.get('price')),cost); else await call('products:create',f.get('name'),f.get('code'),Number(f.get('price')),cost); await route('products'); } catch(e) { alert((e as Error).message); } });
}

function itemRows(prefix: string, products: any[], allowSource = false) {
  const options = products.map(x=>`<option value="${x.id}">${esc(x.name)} — código ${esc(x.code)} — estoque ${x.stock}</option>`).join('');
  return `<div id="${prefix}Rows" class="items"><div class="item-row"><select class="item-product">${options}</select><input class="item-qty" type="number" min="1" value="1">${allowSource?'<input class="item-source" placeholder="Fonte" required><input class="item-cost" type="number" min="0" step="0.01" placeholder="Custo unitário">':''}<button type="button" class="remove-row">Remover</button></div></div><button type="button" id="addRow">Adicionar produto</button>`;
}
function collectRows(prefix: string, extra: (row: HTMLElement)=>any) {
  return Array.from(document.querySelectorAll<HTMLElement>(`#${prefix}Rows .item-row`)).map(row => extra(row));
}

async function saleForm(c: HTMLElement, title: HTMLElement) {
  title.textContent='Registrar venda'; const p=await call('products:list');
  c.innerHTML=`<div class="panel"><h2>Nova venda</h2>${itemRows('sale',p)}<label>Pagamento<select id="pay"><option>DINHEIRO</option><option>PIX</option><option>CARTAO_CREDITO</option><option>CARTAO_DEBITO</option><option>OUTRO</option></select></label><div><button id="sell">Confirmar venda</button><button id="cancelSale" type="button">Cancelar</button></div></div>`;
  document.querySelector('#addRow')!.addEventListener('click',()=>{const first=document.querySelector<HTMLElement>('#saleRows .item-row')!; const clone=first.cloneNode(true) as HTMLElement; clone.querySelector<HTMLInputElement>('.item-qty')!.value='1'; first.parentElement!.appendChild(clone); bindRemoveRows();});
  bindRemoveRows();
  document.querySelector('#cancelSale')!.addEventListener('click',()=>route('dashboard'));
  document.querySelector('#sell')!.addEventListener('click',async()=>{try{const items=collectRows('sale',r=>({productId:Number((r.querySelector('.item-product') as HTMLSelectElement).value),quantity:Number((r.querySelector('.item-qty') as HTMLInputElement).value)})); await call('sale:create',{items,paymentMethod:(document.querySelector('#pay') as HTMLSelectElement).value}); alert('Venda registrada com sucesso.'); route('dashboard');}catch(e){alert((e as Error).message);}});
}
function bindRemoveRows(){document.querySelectorAll<HTMLButtonElement>('.remove-row').forEach(b=>b.onclick=()=>{const rows=document.querySelectorAll('#saleRows .item-row, #loadRows .item-row'); if(rows.length>1)b.parentElement?.remove();});}

async function returnForm(c: HTMLElement, title: HTMLElement) {
  title.textContent='Registrar devolução';
  const sales=await call('sale:list');
  if(!sales.length){ c.innerHTML='<div class="panel"><p>Nenhuma venda registrada ainda.</p></div>'; return; }
  c.innerHTML=`<div class="panel"><h2>Devolução</h2><label>ID da venda<select id="rs">${sales.map((s:any)=>`<option value="${s.id}">#${s.id} — ${money(s.total)}</option>`).join('')}</select></label><div id="returnItems"></div><label>Motivo<select id="rr"><option>NAO_ESPECIFICADO</option><option>DEFEITO</option><option>ARREPENDIMENTO</option><option>TROCA</option><option>OUTRO</option></select></label><label>Outro motivo (se necessário)<input id="ro"></label><button id="ret">Confirmar devolução</button></div>`;
  const renderItems=async()=>{const saleId=Number((document.querySelector('#rs') as HTMLSelectElement).value); const items=await call('sale:items',saleId); const available=items.filter((x:any)=>x.quantity-x.returned>0); document.querySelector('#returnItems')!.innerHTML=available.length?`<table><thead><tr><th>Produto</th><th>Vendida</th><th>Disponível para devolver</th><th>Quantidade</th></tr></thead><tbody>${available.map((x:any)=>`<tr data-item="${x.id}"><td>${esc(x.name)} (${esc(x.code)})</td><td>${x.quantity}</td><td>${x.quantity-x.returned}</td><td><input class="ret-qty" type="number" min="0" max="${x.quantity-x.returned}" value="0"></td></tr>`).join('')}</tbody></table>`:'<p>Nenhum item restante para devolução nesta venda.</p>';};
  await renderItems(); document.querySelector('#rs')!.addEventListener('change',renderItems);
  document.querySelector('#ret')!.addEventListener('click',async()=>{try{const items=Array.from(document.querySelectorAll<HTMLElement>('#returnItems tr[data-item]')).map(r=>({saleItemId:Number(r.dataset.item),quantity:Number((r.querySelector('.ret-qty') as HTMLInputElement).value)})).filter(x=>x.quantity>0); await call('return:create',{saleId:Number((document.querySelector('#rs') as HTMLSelectElement).value),items,reason:(document.querySelector('#rr') as HTMLSelectElement).value,reasonOther:(document.querySelector('#ro') as HTMLInputElement).value});alert('Devolução registrada.');route('dashboard');}catch(e){alert((e as Error).message);}});
}

async function loadForm(c: HTMLElement, title: HTMLElement) {
  title.textContent='Registrar carregamento'; const p=await call('products:list');
  c.innerHTML=`<div class="panel"><h2>Novo carregamento</h2>${itemRows('load',p,true)}<div><button id="load">Confirmar carregamento</button><button id="cancelLoad" type="button">Cancelar</button></div></div>`;
  document.querySelector('#addRow')!.addEventListener('click',()=>{const first=document.querySelector<HTMLElement>('#loadRows .item-row')!; const clone=first.cloneNode(true) as HTMLElement; clone.querySelectorAll('input').forEach((x:any)=>x.value=''); clone.querySelector<HTMLInputElement>('.item-qty')!.value='1'; first.parentElement!.appendChild(clone); bindLoadRemoveRows();});
  bindLoadRemoveRows(); document.querySelector('#cancelLoad')!.addEventListener('click',()=>route('dashboard'));
  document.querySelector('#load')!.addEventListener('click',async()=>{try{const items=collectRows('load',r=>({productId:Number((r.querySelector('.item-product') as HTMLSelectElement).value),quantity:Number((r.querySelector('.item-qty') as HTMLInputElement).value),source:(r.querySelector('.item-source') as HTMLInputElement).value,unitCost:(()=>{const v=(r.querySelector('.item-cost') as HTMLInputElement)?.value; return v===''||v==null?undefined:Number(v)})()})); await call('load:create',{items}); alert('Carregamento registrado.'); route('dashboard');}catch(e){alert((e as Error).message);}});
}
function bindLoadRemoveRows(){document.querySelectorAll<HTMLButtonElement>('#loadRows .remove-row').forEach(b=>b.onclick=()=>{const rows=document.querySelectorAll('#loadRows .item-row'); if(rows.length>1)b.parentElement?.remove();});}

function revenueForm(c: HTMLElement, title: HTMLElement) {
  let chart: { destroy: () => void } | null = null;
  title.textContent='Receita por janela de tempo'; c.innerHTML=`<div class="panel"><label>Data inicial<input id="from" type="date" required></label><label>Data final<input id="to" type="date" required></label><button id="calc">Consultar</button><div id="rev"></div><canvas id="chart"></canvas></div>`;
  document.querySelector('#calc')!.addEventListener('click',async()=>{try{const r=await call('revenue:get',(document.querySelector('#from') as HTMLInputElement).value,(document.querySelector('#to') as HTMLInputElement).value); document.querySelector('#rev')!.innerHTML=`<div class="cards"><div>Vendas<strong>${money(r.salesTotal)}</strong></div><div>Devoluções<strong>${money(r.returnsTotal)}</strong></div><div>Resultado<strong>${money(r.result)}</strong></div><div>Custo<strong>${money(r.costTotal)}</strong></div></div>`; const mod=await import('chart.js/auto'); chart?.destroy(); chart = new mod.Chart(document.querySelector('#chart') as HTMLCanvasElement,{type:'line',data:{labels:r.daily.map((x:any)=>x.day),datasets:[{label:'Vendas',data:r.daily.map((x:any)=>x.sales)},{label:'Devoluções',data:r.daily.map((x:any)=>x.returns)}]}});}catch(e){alert((e as Error).message);}});
}

async function historyPage(c: HTMLElement, title: HTMLElement){
  title.textContent='Histórico'; const h=await call('history:get');
  c.innerHTML=`<h2>Vendas</h2><table><thead><tr><th>ID</th><th>Usuário</th><th>Total</th><th>Pagamento</th><th>Data</th></tr></thead><tbody>${h.sales.map((x:any)=>`<tr><td>#${x.id}</td><td>${esc(x.username)}</td><td>${money(x.total)}</td><td>${esc(x.paymentMethod)}</td><td>${esc(dt(x.createdAt))}</td></tr>`).join('')}</tbody></table><h2>Devoluções</h2><table><thead><tr><th>ID</th><th>Venda</th><th>Total</th><th>Motivo</th><th>Data</th></tr></thead><tbody>${h.returns.map((x:any)=>`<tr><td>#${x.id}</td><td>#${x.saleId}</td><td>${money(x.total)}</td><td>${esc(x.reasonOther||x.reason)}</td><td>${esc(dt(x.createdAt))}</td></tr>`).join('')}</tbody></table><h2>Carregamentos</h2><table><thead><tr><th>ID</th><th>Usuário</th><th>Data</th></tr></thead><tbody>${h.loads.map((x:any)=>`<tr><td>#${x.id}</td><td>${esc(x.username)}</td><td>${esc(dt(x.createdAt))}</td></tr>`).join('')}</tbody></table>`;
}

async function usersPage(c: HTMLElement, title: HTMLElement){
  title.textContent='Perfis de usuário'; const users=await call('users:list');
  c.innerHTML=`<div class="panel"><h2>Novo perfil</h2><form id="uf"><label>Nome<input name="u" required></label><label>Senha<input name="p" type="password" required></label><fieldset>${permissions.map(p=>`<label class="check"><input type="checkbox" name="perm" value="${p}">${p}</label>`).join('')}</fieldset><button>Cadastrar</button></form></div><table><thead><tr><th>Perfil</th><th>Admin</th><th>Ações</th></tr></thead><tbody>${users.map((u:any)=>`<tr><td>${esc(u.username)}</td><td>${u.is_admin?'Sim':'Não'}</td><td>${u.is_admin?'Protegido':`<button class="uu" data-u="${esc(u.username)}">Alterar</button> <button class="ud" data-u="${esc(u.username)}">Remover</button>`}</td></tr>`).join('')}</tbody></table>`;
  document.querySelector('#uf')!.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target as HTMLFormElement);try{await call('users:create',f.get('u'),f.get('p'),selectedPermissions());await usersPage(c,title);}catch(e){alert((e as Error).message);}});
  document.querySelectorAll<HTMLElement>('.uu').forEach(b=>b.onclick=()=>userEdit(c,title,b.dataset.u!));
  document.querySelectorAll<HTMLElement>('.ud').forEach(b=>b.onclick=async()=>{try{await call('users:delete',b.dataset.u);await usersPage(c,title);}catch(e){alert((e as Error).message);}});
}
async function userEdit(c: HTMLElement,title: HTMLElement,username:string){const u=(await call('users:list')).find((x:any)=>x.username===username); const ps=await call('users:permissions',username); c.innerHTML=`<form id="ue" class="panel"><h2>Alterar perfil: ${esc(username)}</h2><label>Nova senha (opcional)<input name="p" type="password"></label><fieldset>${permissions.map(p=>`<label class="check"><input type="checkbox" name="perm" value="${p}" ${ps.includes(p)?'checked':''}>${p}</label>`).join('')}</fieldset><button>Confirmar</button><button type="button" id="uc">Cancelar</button></form>`; document.querySelector('#uc')!.addEventListener('click',()=>usersPage(c,title)); document.querySelector('#ue')!.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target as HTMLFormElement);try{await call('users:update',username,f.get('p')||undefined,selectedPermissions());await usersPage(c,title);}catch(e){alert((e as Error).message);}}); void u;}

function login(){app.innerHTML=`<div class="login"><div class="panel"><h1>BESTAND</h1><p>Sistema de gerenciamento de estoque</p><form id="login"><label>Perfil<input name="u" value="admin" required></label><label>Senha<input name="p" type="password" required></label><button>Entrar</button></form></div></div>`;document.querySelector('#login')!.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target as HTMLFormElement);try{session=await call('auth:login',f.get('u'),f.get('p'));shell();}catch(e){alert((e as Error).message);}});}
(async()=>{session=await call('auth:current').catch(()=>null);session?shell():login();})();
