(() => {
'use strict';
// Public/publishable key is intended for browser use. Never put service_role keys here.
const SUPABASE_URL = 'https://gkuclyokfvythmkbkzxa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sOOgECuDL1bcyXynX7vNIw_2vwUZ-yD';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const AUTH_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/swift-service`;
let loginInProgress = false;
const LOCS = [
 {id:'a8b32f45-c1fe-4db7-bcb6-6728e1939132', name:'หน้าร้าน', key:'central'},
 {name:'Facebook',key:'facebook'}, {name:'TikTok Shop',key:'tiktok'}, {name:'Shopee',key:'shopee'}
];
let me=null, products=[], locations=[], balances=[], movements=[], movementProfiles={}, page='dashboard', busy=false;
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n||0).toLocaleString('th-TH'), money=n=>Number(n||0).toLocaleString('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2});
function toast(msg,err=false){const r=$('#toast-root'); if(!r)return;const e=document.createElement('div');e.className='toast '+(err?'error':'success');e.textContent=msg;r.append(e);setTimeout(()=>e.remove(),3500)}
function fail(e){console.error(e);toast(e?.message||'เกิดข้อผิดพลาด กรุณาลองใหม่',true)}
function loc(key){return locations.find(x=>x.key===key)}
function qty(pid,lid){return Number(balances.find(b=>b.product_id===pid&&b.location_id===lid)?.quantity||0)}
function total(p){return locations.reduce((s,l)=>s+qty(p.id,l.id),0)}
function isCEO(){return me?.role==='ceo'}
async function loadAll(){
 const [pr,lo,ba,mv]=await Promise.all([
  sb.from('products').select(isCEO()?'id,sku,vrich_code,name,category,size,cost,price,threshold,active':'id,sku,vrich_code,name,category,size,threshold,active').order('sku'),
  sb.from('locations').select('id,name').order('name'),
  sb.from('stock_balances').select('product_id,location_id,quantity,updated_at'),
  sb.from('stock_movements').select('id,product_id,from_location_id,to_location_id,quantity,movement_type,channel,external_order_id,performed_by,note,created_at').order('created_at',{ascending:false}).limit(500)
 ]);
 for(const r of [pr,lo,ba,mv])if(r.error)throw r.error;
 products=pr.data||[]; locations=lo.data||[]; balances=ba.data||[]; movements=mv.data||[];
 movementProfiles={};
 // Resolve movement actor IDs to display names where the current user's RLS policy allows it.
 const actorIds=[...new Set(movements.map(m=>m.performed_by).filter(Boolean))];
 if(actorIds.length){
  try{
   const {data:profiles,error:profileError}=await sb.from('profiles').select('id,display_name,username').in('id',actorIds);
   if(profileError)console.warn('Unable to resolve movement actor names under current RLS policy:',profileError.message);
   else for(const profile of (profiles||[])) movementProfiles[profile.id]=profile.display_name||profile.username||profile.id;
  }catch(profileError){console.warn('Unable to resolve movement actor names:',profileError)}
 }
 locations.forEach(l=>{l.key=l.name==='หน้าร้าน'?'central':l.name==='Facebook'?'facebook':l.name==='TikTok Shop'?'tiktok':l.name==='Shopee'?'shopee':l.name});
}
function loginMarkup(){
 return '<div class="login-wrap"><section class="login-card"><h1>แก้มบุ๋ม เพ-ลาเล่น</h1><p>ระบบจัดการสต็อกออนไลน์</p><div class="field"><label for="login-mode">ประเภทบัญชี</label><select id="login-mode" class="select"><option value="ceo">CEO / ผู้ดูแล (Email)</option><option value="employee">พนักงาน (Username)</option></select></div><div class="field" id="email-field"><label for="email">อีเมล CEO</label><input id="email" type="email" autocomplete="username" class="input" placeholder="อีเมลที่ใช้เดิม"></div><div class="field" id="username-field"><label for="username">Username พนักงาน</label><input id="username" type="text" autocomplete="username" class="input" maxlength="32" placeholder="Username ที่ CEO สร้างให้"></div><div class="field"><label for="password">รหัสผ่าน</label><input id="password" type="password" autocomplete="current-password" class="input" required></div><button id="login" class="btn btn-primary btn-block">เข้าสู่ระบบ</button><p class="muted" id="login-help">CEO ใช้อีเมลและรหัสผ่านเดิมของระบบ</p></section></div>';
}
function bindLoginForm(){
 const mode=$('#login-mode');
 const updateMode=()=>{
  const employee=mode.value==='employee';
  $('#email-field').style.display=employee?'none':'';
  $('#username-field').style.display=employee?'':'none';
  $('#login-help').textContent=employee?'ใช้ Username และรหัสผ่านที่ CEO สร้างให้':'CEO ใช้อีเมลและรหัสผ่านเดิมของระบบ';
  const field=employee?$('#username'):$('#email');
  if(field)field.focus();
 };
 mode.onchange=updateMode;
 $('#login').onclick=login;
 $('#password').onkeydown=e=>{if(e.key==='Enter')login()};
 updateMode();
}
async function boot(){
 $('#app').innerHTML=loginMarkup();
 bindLoginForm();
 const {data:{session},error}=await sb.auth.getSession();if(error)fail(error); if(session) await enter(session.user);
 sb.auth.onAuthStateChange((_event,session)=>{
  if(session&&!me&&!loginInProgress) setTimeout(()=>{if(!me&&!loginInProgress)enter(session.user).catch(fail)},0);
  else if(!session){me=null;showLogin()}
 });
}
function showLogin(){
 me=null;
 $('#app').innerHTML=loginMarkup();
 bindLoginForm();
}
async function callAuthFunction(payload, needsSession=true){
 const headers={'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY};
 if(needsSession){
  const {data,error}=await sb.auth.getSession();
  if(error)throw error;
  if(!data.session?.access_token)throw new Error('กรุณาเข้าสู่ระบบใหม่');
  headers.Authorization=`Bearer ${data.session.access_token}`;
 }
 const response=await fetch(AUTH_FUNCTION_URL,{method:'POST',headers,body:JSON.stringify(payload)});
 let result={};
 try{result=await response.json()}catch{}
 if(!response.ok)throw new Error(result.error||'เชื่อมต่อบริการจัดการบัญชีไม่สำเร็จ');
 return result;
}
async function login(){
 const mode=$('#login-mode').value,password=$('#password').value;
 const email=mode==='ceo'?$('#email').value.trim():'';
 const username=mode==='employee'?$('#username').value.trim():'';
 if(mode==='ceo'&&!email)return toast('กรอกอีเมล CEO ก่อน',true);
 if(mode==='employee'&&!username)return toast('กรอก Username ก่อน',true);
 if(!password)return toast('กรอกรหัสผ่านก่อน',true);
 const b=$('#login');b.disabled=true;b.textContent='กำลังเข้าสู่ระบบ…';loginInProgress=true;
 try{
  if(mode==='ceo'){
   // Keep the CEO's existing Supabase email/password authentication unchanged.
   const {data,error}=await sb.auth.signInWithPassword({email,password});
   if(error)throw error;
   if(!data.user)throw new Error('เข้าสู่ระบบแล้วแต่ไม่พบข้อมูล CEO');
   await enter(data.user);
  }else{
   const result=await callAuthFunction({action:'login',username,password},false);
   if(!result.access_token||!result.refresh_token)throw new Error('ระบบไม่ได้ส่งข้อมูลเซสชันกลับมา');
   const {data,error}=await sb.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
   if(error)throw error;
   if(!data.user)throw new Error('เข้าสู่ระบบสำเร็จแต่ไม่พบข้อมูลผู้ใช้');
   await enter(data.user);
  }
 }catch(e){fail(e)}
 finally{loginInProgress=false;if($('#login')){b.disabled=false;b.textContent='เข้าสู่ระบบ'}}
}
async function enter(user){
 const {data,error}=await sb.from('profiles').select('id,display_name,role,username,is_active').eq('id',user.id).single();
 if(error)throw error;
 if(!data||!['ceo','employee'].includes(data.role))throw new Error('บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน');
 if(data.is_active===false){await sb.auth.signOut();throw new Error('บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อ CEO')}
 me={...data,email:user.email};await loadAll();render();
}
function shell(){return `<div class="app-shell"><aside class="sidebar"><div class="brand"><img class="brand-logo" src="assets/logo.png" alt="โลโก้ร้านแก้มบุ๋ม เพ-ลาเล่น"><div><b>แก้มบุ๋ม เพ-ลาเล่น</b><small>STOCK MANAGEMENT</small></div></div><nav>${[['dashboard','▦','ภาพรวม'],['products','▣','สินค้า'],['stock','▤','สต็อกแยกช่องทาง'],['receive','＋','รับสินค้าเข้า'],['transfer','⇄','โอนสต็อก'],['sale','↘','ขายออก'],['adjust','±','ปรับสต็อก'],['history','☷','ประวัติ'],...(isCEO()?[['staff','♙','จัดการพนักงาน']]:[])].map(([k,i,t])=>`<button class="nav-item ${page===k?'active':''}" data-page="${k}"><span>${i}</span>${t}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="user-chip"><b>${esc(me.display_name||me.email)}</b><small>${isCEO()?'CEO / ผู้ดูแลระบบ':'พนักงาน'}</small></div><button class="btn btn-block" id="logout">ออกจากระบบ</button></div></aside><main class="main"><header class="topbar"><div><b>${esc(pageTitle())}</b><small>ข้อมูลออนไลน์จาก Supabase</small></div><div class="topbar-actions"><button class="btn" id="export-data">⇩ Export</button><button class="btn" id="refresh">↻ รีเฟรช</button></div></header><div class="content" id="content"></div></main></div>`}
function pageTitle(){return ({dashboard:'ภาพรวมสต็อก',products:'รายการสินค้า',stock:'สต็อกแยกช่องทาง',receive:'รับสินค้าเข้า',transfer:'โอนสต็อก',sale:'บันทึกขายออก',adjust:'ปรับสต็อก',history:'ประวัติการเคลื่อนไหว',staff:'จัดการพนักงาน'})[page]||'สต็อก'}
function render(){ $('#app').innerHTML=shell(); document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;render()});$('#logout').onclick=async()=>{await sb.auth.signOut();showLogin()};$('#refresh').onclick=async()=>{try{await loadAll();render();toast('อัปเดตข้อมูลแล้ว')}catch(e){fail(e)}};$('#export-data').onclick=exportData;const c=$('#content');({dashboard:dashboard,products:productPage,stock:stockPage,receive:()=>movementForm('receive'),transfer:()=>movementForm('transfer'),sale:()=>movementForm('sale'),adjust:()=>movementForm('adjustment'),history:historyPage,staff:staffPage})[page](c)}
function head(title,desc,extra=''){return `<div class="page-head"><div><h1>${title}</h1><p>${desc}</p></div>${extra}</div>`}
function dashboard(el){const sum=products.filter(p=>p.active).reduce((a,p)=>a+total(p),0);const lowProducts=products.filter(p=>p.active&&total(p)<=Number(p.threshold||3));const low=lowProducts.length;el.innerHTML=head('ภาพรวมสต็อก','ยอดล่าสุดจากฐานข้อมูลกลาง')+`<div class="stats-grid"><div class="stat-card"><span>สินค้าเปิดใช้งาน</span><strong>${num(products.filter(p=>p.active).length)}</strong><small>SKU</small></div><div class="stat-card"><span>สต็อกรวมทุกช่องทาง</span><strong>${num(sum)}</strong><small>ชิ้น</small></div><div class="stat-card"><span>รายการสต็อกต่ำ/หมด</span><strong>${num(low)}</strong><small>สินค้า</small></div><div class="stat-card"><span>ประวัติล่าสุด</span><strong>${num(movements.length)}</strong><small>รายการที่โหลด</small></div></div><div class="card"><h2>ยอดแยกช่องทาง</h2>${locations.map(l=>`<div class="confirm-row"><span>${esc(l.name)}</span><strong>${num(products.reduce((s,p)=>s+qty(p.id,l.id),0))} ชิ้น</strong></div>`).join('')}</div><div class="card"><h2>รายการสินค้าสต็อกต่ำ/หมด (${num(lowProducts.length)} รายการ)</h2>${lowProducts.length?productTable(lowProducts):'<div class="empty">ไม่มีสินค้าที่สต็อกต่ำหรือหมด</div>'}</div><div class="card"><h2>รายการเคลื่อนไหวล่าสุด</h2>${movementTable(movements.slice(0,8))}</div>`}
function productPage(el){const cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'th'));el.innerHTML=head('รายการสินค้า','ข้อมูลสินค้าอ่านจาก Supabase โดยตรง')+`<div class="card"><div class="toolbar"><input class="input" id="q" placeholder="ค้นหา SKU / รหัสขาย / ชื่อสินค้า" autocomplete="off"><select class="select filter-select" id="category-filter"><option value="">หมวดหมู่ทั้งหมด</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select><select class="select filter-select" id="sort-by"><option value="sku">เรียงตาม SKU</option><option value="name">ชื่อสินค้า A-Z</option><option value="stock-high">สต็อกมากไปน้อย</option><option value="stock-low">สต็อกน้อยไปมาก</option></select><span class="muted" id="product-count">${products.length} รายการ</span></div><div class="suggestions" id="search-suggestions"></div><div id="product-table">${productTable(products)}</div></div>`;const update=()=>{const q=$('#q').value.trim().toLowerCase(),cat=$('#category-filter').value,sort=$('#sort-by').value;let list=products.filter(p=>(!q||[p.sku,p.vrich_code,p.name,p.category,p.size].some(x=>String(x||'').toLowerCase().includes(q)))&&(!cat||p.category===cat));list.sort((a,b)=>sort==='name'?String(a.name||'').localeCompare(String(b.name||''),'th'):sort==='stock-high'?total(b)-total(a):sort==='stock-low'?total(a)-total(b):String(a.sku||'').localeCompare(String(b.sku||''),undefined,{numeric:true}));$('#product-count').textContent=list.length+' รายการ';$('#product-table').innerHTML=productTable(list);const sug=$('#search-suggestions');if(q){const matches=list.slice(0,8);sug.innerHTML=matches.length?matches.map(p=>`<button type="button" class="suggestion-item" data-sku="${esc(p.sku)}"><b>${esc(p.sku)}</b> · ${esc(p.name)} <small>${esc(p.category||'')}</small></button>`).join(''):'<div class="suggestion-empty">ไม่พบสินค้าที่ตรงกัน</div>';sug.querySelectorAll('[data-sku]').forEach(b=>b.onclick=()=>{$('#q').value=b.dataset.sku;update();sug.innerHTML='';});}else sug.innerHTML='';};$('#q').oninput=update;$('#category-filter').onchange=update;$('#sort-by').onchange=update;}
function productTable(list){return `<div class="table-wrap"><table><thead><tr><th>SKU</th><th>รหัสขาย</th><th>ชื่อสินค้า</th><th>ไซซ์</th><th>ราคาขาย</th><th>ต้นทุน</th><th>สถานะ</th></tr></thead><tbody>${list.map(p=>`<tr><td>${esc(p.sku)}</td><td>${esc(p.vrich_code||'—')}</td><td>${esc(p.name)}</td><td>${esc(p.size||'—')}</td><td>${isCEO()?money(p.price):'••••'}</td><td>${isCEO()?money(p.cost):'••••'}</td><td>${p.active?'ใช้งาน':'ปิดใช้งาน'}</td></tr>`).join('')}</tbody></table></div>`}
function stockPage(el){const cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'th'));el.innerHTML=head('สต็อกแยกช่องทาง','ยอดคงเหลือแต่ละสินค้าในทุกช่องทาง')+`<div class="card"><div class="toolbar"><input class="input" id="q" placeholder="ค้นหา SKU / รหัสขาย / ชื่อสินค้า" autocomplete="off"><select class="select filter-select" id="category-filter"><option value="">หมวดหมู่ทั้งหมด</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}<option value="__all__">ทั้งหมด</option></select><select class="select filter-select" id="sort-by"><option value="sku">เรียงตาม SKU</option><option value="stock-high">สต็อกรวมมากไปน้อย</option><option value="stock-low">สต็อกรวมน้อยไปมาก</option></select></div><div class="suggestions" id="search-suggestions"></div><div id="stock-table">${stockTable(products)}</div></div>`;const update=()=>{const q=$('#q').value.trim().toLowerCase(),cat=$('#category-filter').value,sort=$('#sort-by').value;let list=products.filter(p=>(!q||[p.sku,p.vrich_code,p.name,p.category].some(x=>String(x||'').toLowerCase().includes(q)))&&(!cat||cat==='__all__'||p.category===cat));list.sort((a,b)=>sort==='stock-high'?total(b)-total(a):sort==='stock-low'?total(a)-total(b):String(a.sku||'').localeCompare(String(b.sku||''),undefined,{numeric:true}));$('#stock-table').innerHTML=stockTable(list);const sug=$('#search-suggestions');if(q){sug.innerHTML=list.length?list.slice(0,8).map(p=>`<button type="button" class="suggestion-item" data-sku="${esc(p.sku)}"><b>${esc(p.sku)}</b> · ${esc(p.name)}</button>`).join(''):'<div class="suggestion-empty">ไม่พบสินค้าที่ตรงกัน</div>';sug.querySelectorAll('[data-sku]').forEach(b=>b.onclick=()=>{$('#q').value=b.dataset.sku;update();sug.innerHTML='';});}else sug.innerHTML='';};$('#q').oninput=update;$('#category-filter').onchange=update;$('#sort-by').onchange=update;}
function stockTable(list){return `<div class="table-wrap"><table><thead><tr><th>SKU / ชื่อ</th>${locations.map(l=>`<th>${esc(l.name)}</th>`).join('')}<th>รวม</th></tr></thead><tbody>${list.map(p=>`<tr><td><b>${esc(p.sku)}</b><br><small>${esc(p.name)}</small></td>${locations.map(l=>`<td>${num(qty(p.id,l.id))}</td>`).join('')}<td><b>${num(total(p))}</b></td></tr>`).join('')}</tbody></table></div>`}
function productOptions(){return products.filter(p=>p.active).map(p=>`<option value="${p.id}">${esc(p.sku)} · ${esc(p.name)}${p.size?' · '+esc(p.size):''}</option>`).join('')}
function productPicker(){return `<div class="field"><label>สินค้า *</label><input class="input" id="product-search" autocomplete="off" placeholder="พิมพ์ SKU / รหัสขาย / ชื่อสินค้าเพื่อค้นหา"><input type="hidden" name="product" id="product-id" required><div class="suggestions" id="product-suggestions"></div><div class="muted" id="picked-product">ยังไม่ได้เลือกสินค้า</div></div>`}
function bindProductPicker(){const input=$('#product-search'),box=$('#product-suggestions'),hidden=$('#product-id'),picked=$('#picked-product');if(!input)return;const update=()=>{const q=input.value.trim().toLowerCase();hidden.value='';picked.textContent='ยังไม่ได้เลือกสินค้า';if(!q){box.innerHTML='';return;}const list=products.filter(p=>p.active&&[p.sku,p.vrich_code,p.name,p.category,p.size].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,10);box.innerHTML=list.length?list.map(p=>`<button type="button" class="suggestion-item" data-id="${p.id}"><b>${esc(p.sku)}</b> · ${esc(p.name)} <small>${esc(p.size||'')} ${esc(p.category||'')}</small></button>`).join(''):'<div class="suggestion-empty">ไม่พบสินค้า</div>';box.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{const p=products.find(x=>x.id===b.dataset.id);hidden.value=p.id;input.value=`${p.sku} · ${p.name}`;picked.textContent=`เลือกแล้ว: ${p.sku} · ${p.name} | สต็อกรวม ${num(total(p))} ชิ้น`;box.innerHTML='';input.dispatchEvent(new Event('change',{bubbles:true}));});};input.addEventListener('input',update);}
function locationOptions(except=''){return locations.filter(l=>l.id!==except).map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}
function movementForm(type){const cfg={receive:['รับสินค้าเข้า','รับของเข้าจาก Supplier',false],transfer:['โอนสต็อก','ย้ายสินค้าไปอีกช่องทาง',false],sale:['ขายออก','ตัดยอดจากช่องทางที่ขาย',false],adjustment:['ปรับสต็อก','ใช้เมื่อของเสีย/หาย/นับคลาดเคลื่อน ต้องใส่เหตุผล',true]}[type];const fromField=type==='transfer'||type==='sale'?`<div class="field"><label>${type==='sale'?'ช่องทางที่ขายออก':'จากช่องทาง'} *</label><select class="select" name="from" required>${locations.map((l,i)=>`<option value="${l.id}" ${i===0?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div>`:'';const toField=type==='receive'||type==='transfer'?`<div class="field"><label>${type==='receive'?'รับเข้าที่':'โอนไปที่'} *</label><select class="select" name="to" required>${locations.map((l,i)=>`<option value="${l.id}" ${type==='transfer'&&i===1?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div>`:type==='adjustment'?`<div class="field"><label>ช่องทาง *</label><select class="select" name="to" required>${locations.map((l,i)=>`<option value="${l.id}" ${i===0?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div>`:'';$('#content').innerHTML=head(cfg[0],cfg[1])+`<div class="card operation-card"><form id="move-form">${productPicker()}<div class="form-grid">${fromField}${toField}<div class="field"><label>จำนวน ${type==='adjustment'?'(+ เพิ่ม / - ลด)':''} *</label><input class="input" name="quantity" type="number" step="1" ${type==='adjustment'?'':'min="1"'} required placeholder="จำนวนชิ้น"></div><div class="field"><label>เลขอ้างอิง / เลขออเดอร์</label><input class="input" name="reference" placeholder="ถ้ามี"></div></div><div class="field"><label>หมายเหตุ ${type==='adjustment'?'(ระบุเหตุผล)':'(ถ้ามี)'}</label><input class="input" name="note" ${type==='adjustment'?'required':''} placeholder="ระบุรายละเอียด"></div><div id="stock-check" class="info-box">เลือกสินค้าเพื่อดูยอดคงเหลือก่อนทำรายการ</div><button class="btn btn-primary btn-block" type="submit">ตรวจสอบและบันทึก</button></form></div>`;bindProductPicker();const form=$('#move-form');const checkBox=$('#stock-check');const refreshStockCheck=()=>{const f=new FormData(form),p=products.find(x=>x.id===$('#product-id').value),q=Number(f.get('quantity')||0),from=f.get('from')||null,to=f.get('to')||null;if(!p){checkBox.className='info-box';checkBox.textContent='เลือกสินค้าเพื่อดูยอดคงเหลือก่อนทำรายการ';return;}const source=from?qty(p.id,from):null,dest=to?qty(p.id,to):null;let msg=`${p.sku} · ${p.name} | สต็อกรวม ${num(total(p))} ชิ้น`;let bad=false;if(type==='transfer'||type==='sale'){msg+=` | ต้นทางคงเหลือ ${num(source)} ชิ้น`;if(q>0&&source<q){msg+=` — สต็อกไม่พอ ขาด ${num(q-source)} ชิ้น`;bad=true;}else if(q>0)msg+=` — เพียงพอหลังทำรายการ ${num(source-q)} ชิ้น`;}else if(type==='adjustment'&&q<0){msg+=` | ช่องทางนี้มี ${num(dest)} ชิ้น`;if(dest+q<0){msg+=` — ปรับไม่ได้ เพราะยอดจะติดลบ`;bad=true;}else msg+=` — หลังปรับจะเหลือ ${num(dest+q)} ชิ้น`;}else if(type==='receive'&&q>0)msg+=` | หลังรับเข้าจะเป็น ${num((dest||0)+q)} ชิ้น`;checkBox.className=bad?'danger-box':'success-box';checkBox.textContent=msg;};form.addEventListener('input',refreshStockCheck);form.addEventListener('change',refreshStockCheck);$('#product-search').addEventListener('change',refreshStockCheck);$('#move-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.target),q=Number(f.get('quantity')),from=f.get('from')||null,to=f.get('to')||null;if(!Number.isInteger(q)||q===0||(type!=='adjustment'&&q<1))return toast('จำนวนไม่ถูกต้อง',true);if(type==='transfer'&&from===to)return toast('ต้นทางกับปลายทางต้องต่างกัน',true);const product=products.find(p=>p.id===f.get('product'));if(!product)return toast('เลือกสินค้าก่อน',true);if(type==='sale'&&qty(product.id,from)<q)return toast('สต็อกไม่พอในช่องทางนี้',true);if(type==='transfer'&&qty(product.id,from)<q)return toast('สต็อกต้นทางไม่พอ',true);if(type==='adjustment'&&qty(product.id,to)+q<0)return toast('ปรับไม่ได้ เพราะยอดสต็อกจะติดลบ',true);const label={receive:'รับสินค้าเข้า',transfer:'โอนสต็อก',sale:'ขายออก',adjustment:'ปรับสต็อก'}[type];if(!confirm(`${label}\nสินค้า: ${product.sku} ${product.name}\nจำนวน: ${q}\n\nยืนยันหรือไม่?`))return;busy=true;const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;try{const {data,error}=await sb.rpc('apply_stock_movement_v2',{p_product_id:product.id,p_movement_type:type,p_quantity:q,p_from_location_id:from,p_to_location_id:to,p_note:f.get('note')||null,p_channel:type==='sale'?locations.find(l=>l.id===from)?.name:null,p_external_order_id:f.get('reference')||null});if(error)throw error;await loadAll();render();toast('บันทึกและอัปเดตสต็อกแล้ว')}catch(err){fail(err)}finally{busy=false;}}}
function movementTable(list){const nameById=Object.fromEntries(products.map(p=>[p.id,p]));const locById=Object.fromEntries(locations.map(l=>[l.id,l.name]));return `<div class="table-wrap"><table><thead><tr><th>เวลา</th><th>สินค้า</th><th>ประเภท</th><th>จาก → ไป</th><th>จำนวน</th><th>พนักงาน</th><th>ช่องทาง/อ้างอิง</th><th>หมายเหตุ</th></tr></thead><tbody>${list.map(m=>{const p=nameById[m.product_id];const actor=m.performed_by?(movementProfiles[m.performed_by]||'ไม่พบชื่อพนักงาน'): 'ไม่ระบุผู้ดำเนินการ';return `<tr><td>${esc(new Date(m.created_at).toLocaleString('th-TH'))}</td><td>${esc(p?.sku||m.product_id)}<br><small>${esc(p?.name||'')}</small></td><td>${esc(({receive:'รับเข้า',transfer:'โอน',sale:'ขายออก',adjustment:'ปรับ',return:'คืนสินค้า'})[m.movement_type]||m.movement_type)}</td><td>${esc(locById[m.from_location_id]||'—')} → ${esc(locById[m.to_location_id]||'—')}</td><td>${num(m.quantity)}</td><td>${esc(actor)}</td><td>${esc(m.channel||'—')}<br><small>${esc(m.external_order_id||'')}</small></td><td>${esc(m.note||'—')}</td></tr>`}).join('')}</tbody></table></div>`}
function historyPage(el){el.innerHTML=head('ประวัติการเคลื่อนไหว','ประวัติจากฐานข้อมูลกลาง (สูงสุด 500 รายการล่าสุด)')+`<div class="card"><div class="toolbar"><input class="input" id="q" placeholder="ค้นหา SKU / หมายเหตุ / เลขออเดอร์"></div><div id="history-table">${movementTable(movements)}</div></div>`;$('#q').oninput=e=>{const q=e.target.value.toLowerCase();$('#history-table').innerHTML=movementTable(movements.filter(m=>{const p=products.find(p=>p.id===m.product_id);return [p?.sku,p?.name,m.note,m.external_order_id,m.channel,m.movement_type,movementProfiles[m.performed_by],m.performed_by].some(v=>String(v||'').toLowerCase().includes(q))}))}}
async function staffPage(el){
 if(!isCEO()){page='dashboard';render();return}
 el.innerHTML=head('จัดการพนักงาน','สร้างบัญชีและจัดการสิทธิ์พนักงาน')+`<div class="card"><h2>สร้างบัญชีพนักงาน</h2><form id="staff-create-form"><div class="form-grid"><div class="field"><label>Username *</label><input class="input" name="username" required minlength="2" maxlength="32" pattern="[A-Za-z0-9._-]{2,32}" autocomplete="off" placeholder="เช่น staff01"><small class="muted">ภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง 2–32 ตัว</small></div><div class="field"><label>ชื่อพนักงาน *</label><input class="input" name="display_name" required maxlength="80" placeholder="ชื่อที่แสดงในระบบ"></div><div class="field"><label>รหัสผ่านเริ่มต้น *</label><input class="input" name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร"></div></div><button class="btn btn-primary" type="submit">＋ สร้างบัญชีพนักงาน</button></form></div><div class="card"><div class="toolbar"><h2>บัญชีพนักงาน</h2><button class="btn" id="staff-reload">↻ โหลดรายชื่อ</button></div><div id="staff-list"><div class="loading">กำลังโหลดรายชื่อ…</div></div></div>`;
 const listEl=$('#staff-list');
 async function loadStaff(){
  listEl.innerHTML='<div class="loading">กำลังโหลดรายชื่อ…</div>';
  try{
   const result=await callAuthFunction({action:'list-staff'});
   const staff=(result.staff||[]).filter(x=>x.role!=='ceo');
   listEl.innerHTML=staff.length?`<div class="table-wrap"><table><thead><tr><th>Username</th><th>ชื่อพนักงาน</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${staff.map(x=>`<tr><td><b>${esc(x.username||'—')}</b></td><td>${esc(x.display_name||'—')}</td><td>${x.is_active===false?'<span class="status-inactive">ปิดใช้งาน</span>':'<span class="status-active">ใช้งาน</span>'}</td><td><div class="toolbar"><button type="button" class="btn" data-reset="${esc(x.id)}">เปลี่ยนรหัสผ่าน</button><button type="button" class="btn" data-active="${esc(x.id)}" data-value="${x.is_active===false?'true':'false'}">${x.is_active===false?'เปิดใช้งาน':'ปิดใช้งาน'}</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">ยังไม่มีบัญชีพนักงาน</div>';
   listEl.querySelectorAll('[data-reset]').forEach(btn=>btn.onclick=async()=>{
    const password=prompt('ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)');
    if(password===null)return;
    if(password.length<8)return toast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',true);
    if(!confirm('ยืนยันเปลี่ยนรหัสผ่านของพนักงานบัญชีนี้หรือไม่?'))return;
    btn.disabled=true;
    try{await callAuthFunction({action:'reset-password',id:btn.dataset.reset,password});toast('เปลี่ยนรหัสผ่านแล้ว')}
    catch(e){fail(e)}finally{btn.disabled=false}
   });
   listEl.querySelectorAll('[data-active]').forEach(btn=>btn.onclick=async()=>{
    const is_active=btn.dataset.value==='true';
    if(!confirm(`${is_active?'เปิด':'ปิด'}การใช้งานบัญชีนี้หรือไม่?`))return;
    btn.disabled=true;
    try{await callAuthFunction({action:'set-active',id:btn.dataset.active,is_active});toast(is_active?'เปิดใช้งานบัญชีแล้ว':'ปิดใช้งานบัญชีแล้ว');await loadStaff()}
    catch(e){fail(e)}finally{btn.disabled=false}
   });
  }catch(e){listEl.innerHTML='<div class="empty">โหลดรายชื่อพนักงานไม่สำเร็จ</div>';fail(e)}
 }
 $('#staff-reload').onclick=loadStaff;
 $('#staff-create-form').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,fd=new FormData(form);
  const username=String(fd.get('username')||'').trim(),display_name=String(fd.get('display_name')||'').trim(),password=String(fd.get('password')||'');
  if(!/^[A-Za-z0-9._-]{2,32}$/.test(username))return toast('Username ต้องมี 2–32 ตัว ใช้ภาษาอังกฤษ ตัวเลข . _ - เท่านั้น',true);
  if(!display_name||display_name.length>80)return toast('กรุณากรอกชื่อพนักงานไม่เกิน 80 ตัวอักษร',true);
  if(password.length<8)return toast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',true);
  const btn=form.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='กำลังสร้างบัญชี…';
  try{
   await callAuthFunction({action:'create-staff',username,display_name,password});
   form.reset();toast('สร้างบัญชีพนักงานสำเร็จ');await loadStaff();
  }catch(err){fail(err)}
  finally{btn.disabled=false;btn.textContent='＋ สร้างบัญชีพนักงาน'}
 };
 await loadStaff();
}
function exportData(){
 if($('#export-modal'))return;
 const modal=document.createElement('div');modal.id='export-modal';modal.className='modal-backdrop';modal.innerHTML=`<section class="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title"><div class="modal-head"><div><h2 id="export-title">ส่งออกข้อมูล</h2><small class="muted">เลือกประเภทไฟล์ที่ต้องการส่งออก</small></div><button type="button" class="close" data-export-close aria-label="ปิด">×</button></div><div class="modal-body"><div class="export-options"><button type="button" class="btn export-card" data-export-kind="stock"><strong>📦 Stock ปัจจุบัน</strong><span>ยอดคงเหลือแยกตามสินค้าและช่องทาง (CSV)</span></button><button type="button" class="btn export-card" data-export-kind="products"><strong>🧾 รายการสินค้า</strong><span>SKU รายละเอียด ราคา ต้นทุน และสถานะ (CSV)</span></button><button type="button" class="btn export-card" data-export-kind="history"><strong>🔄 Movement History</strong><span>ประวัติการเคลื่อนไหว รวมชื่อผู้ดำเนินการ (CSV)</span></button><button type="button" class="btn export-card" data-export-kind="backup"><strong>🗄️ Backup ทั้งระบบ</strong><span>ข้อมูลที่โหลดอยู่ในระบบเป็นไฟล์ JSON</span></button></div><p class="muted export-warning">หมายเหตุ: Backup นี้รวมข้อมูลที่บัญชีปัจจุบันมีสิทธิ์อ่านและที่โหลดมาในหน้านี้เท่านั้น</p></div></section>`;
 document.body.appendChild(modal);
 const close=()=>modal.remove();modal.querySelectorAll('[data-export-close]').forEach(b=>b.onclick=close);
 modal.addEventListener('click',e=>{if(e.target===modal)close()});
 const onKey=e=>{if(e.key==='Escape'){close();document.removeEventListener('keydown',onKey)}};document.addEventListener('keydown',onKey);
 modal.querySelectorAll('[data-export-kind]').forEach(button=>button.onclick=()=>{const kind=button.dataset.exportKind;close();try{downloadExport(kind)}catch(error){fail(error)}});
}
function downloadExport(kind){let rows=[],filename='',headers=[];if(kind==='products'){headers=['SKU','รหัสขาย','ชื่อสินค้า','หมวดหมู่','ไซซ์','ราคา','ต้นทุน','สถานะ'];rows=products.map(p=>[p.sku,p.vrich_code,p.name,p.category,p.size,p.price,p.cost,p.active?'ใช้งาน':'ปิดใช้งาน']);filename='products.csv';}else if(kind==='stock'){headers=['SKU','รหัสขาย','ชื่อสินค้า','หมวดหมู่',...locations.map(l=>l.name),'รวม'];rows=products.map(p=>[p.sku,p.vrich_code,p.name,p.category,...locations.map(l=>qty(p.id,l.id)),total(p)]);filename='stock-by-location.csv';}else if(kind==='history'){headers=['เวลา','SKU','สินค้า','ประเภท','จาก','ไป','จำนวน','พนักงาน','รหัสผู้ดำเนินการ','ช่องทาง','เลขออเดอร์','หมายเหตุ'];rows=movements.map(m=>{const p=products.find(x=>x.id===m.product_id);return [m.created_at,p?.sku||m.product_id,p?.name||'',m.movement_type,locations.find(l=>l.id===m.from_location_id)?.name||'',locations.find(l=>l.id===m.to_location_id)?.name||'',m.quantity,movementProfiles[m.performed_by]|| (m.performed_by?'ไม่พบชื่อพนักงาน':'ไม่ระบุผู้ดำเนินการ'),m.performed_by||'',m.channel,m.external_order_id,m.note]});filename='stock-history.csv';}else if(kind==='backup'){const data={exported_at:new Date().toISOString(),products,locations,balances,movements};downloadFile(JSON.stringify(data,null,2),'stock-backup.json','application/json');toast('ส่งออก Backup แล้ว');return;}else throw new Error('ไม่รู้จักประเภทการส่งออก');const csv='\ufeff'+[headers,...rows].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');downloadFile(csv,filename,'text/csv;charset=utf-8');toast('ส่งออกไฟล์สำเร็จ: '+filename)}
function downloadFile(content,name,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
boot().catch(fail);
})();
