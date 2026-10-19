(() => { // PUBLISH-CHECK-20261019
'use strict';
// Public/publishable key is intended for browser use. Never put service_role keys here.
const SUPABASE_URL = 'https://gkuclyokfvythmkbkzxa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sOOgECuDL1bcyXynX7vNIw_2vwUZ-yD';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const LOCS = [
 {id:'a8b32f45-c1fe-4db7-bcb6-6728e1939132', name:'หน้าร้าน', key:'central'},
 {name:'Facebook',key:'facebook'}, {name:'TikTok Shop',key:'tiktok'}, {name:'Shopee',key:'shopee'}
];
let me=null, products=[], locations=[], balances=[], movements=[], page='dashboard', busy=false;
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
 locations.forEach(l=>{l.key=l.name==='หน้าร้าน'?'central':l.name==='Facebook'?'facebook':l.name==='TikTok Shop'?'tiktok':l.name==='Shopee'?'shopee':l.name});
}

async function boot(){
  $('#app').innerHTML='<div class="login-wrap"><section class="login-card"><h1>แก้มบุ๋ม เพ-ลาเล่น</h1><p>ระบบจัดการสต็อกออนไลน์</p><div class="field"><label>อีเมล</label><input id="email" type="email" autocomplete="username" class="input" required></div><div class="field"><label>รหัสผ่าน</label><input id="password" type="password" autocomplete="current-password" class="input" required></div><button id="login" class="btn btn-primary btn-block">เข้าสู่ระบบ</button><p class="muted">ใช้บัญชีที่ผู้ดูแลสร้างไว้ใน Supabase</p></section></div>';

  $('#login').onclick=login;
  $('#password').onkeydown=e=>{if(e.key==='Enter')login()};

  // ตรวจ Session โดยไม่ปล่อยให้คำขอค้างตลอดไป
  let timedOut=false;
  const timeout=new Promise(resolve=>{
    setTimeout(()=>{timedOut=true;resolve(null)},8000);
  });

  try{
    const result=await Promise.race([
      sb.auth.getSession(),
      timeout
    ]);

    if(timedOut){
      toast('ตรวจสอบการเชื่อมต่อล่าช้า กรุณาลองเข้าสู่ระบบ',true);
    }else if(result.error){
      fail(result.error);
    }else if(result.data?.session){
      await enter(result.data.session.user);
    }
  }catch(e){
    fail(e);
  }

  sb.auth.onAuthStateChange((_event,session)=>{
    if(session&&!me){
      setTimeout(()=>enter(session.user).catch(fail),0);
    }else if(!session){
      me=null;
      $('#app').innerHTML='';
      showLogin();
    }
  });
}

}
function showLogin(){me=null;boot().catch(fail)}
async function login(){const email=$('#email').value.trim(),password=$('#password').value; if(!email||!password)return toast('กรอกอีเมลและรหัสผ่านก่อน',true);const b=$('#login');b.disabled=true;b.textContent='กำลังเข้าสู่ระบบ…';const {data,error}=await sb.auth.signInWithPassword({email,password});b.disabled=false;b.textContent='เข้าสู่ระบบ';if(error)return fail(error);try{await enter(data.user)}catch(e){fail(e)}}
async function enter(user){const {data,error}=await sb.from('profiles').select('id,display_name,role').eq('id',user.id).single();if(error)throw error;if(!data||!['ceo','employee'].includes(data.role))throw new Error('บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน');me={...data,email:user.email};await loadAll();render()}
function shell(){return `<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">ก</div><div><b>แก้มบุ๋ม เพ-ลาเล่น</b><small>STOCK MANAGEMENT</small></div></div><nav>${[['dashboard','▦','ภาพรวม'],['products','▣','สินค้า'],['stock','▤','สต็อกแยกช่องทาง'],['receive','＋','รับสินค้าเข้า'],['transfer','⇄','โอนสต็อก'],['sale','↘','ขายออก'],['adjust','±','ปรับสต็อก'],['history','☷','ประวัติ']].map(([k,i,t])=>`<button class="nav-item ${page===k?'active':''}" data-page="${k}"><span>${i}</span>${t}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="user-chip"><b>${esc(me.display_name||me.email)}</b><small>${isCEO()?'CEO / ผู้ดูแลระบบ':'พนักงาน'}</small></div><button class="btn btn-block" id="logout">ออกจากระบบ</button></div></aside><main class="main"><header class="topbar"><div><b>${esc(pageTitle())}</b><small>ข้อมูลออนไลน์จาก Supabase</small></div><button class="btn" id="refresh">↻ รีเฟรช</button></header><div class="content" id="content"></div></main></div>`}
function pageTitle(){return ({dashboard:'ภาพรวมสต็อก',products:'รายการสินค้า',stock:'สต็อกแยกช่องทาง',receive:'รับสินค้าเข้า',transfer:'โอนสต็อก',sale:'บันทึกขายออก',adjust:'ปรับสต็อก',history:'ประวัติการเคลื่อนไหว'})[page]||'สต็อก'}
function render(){ $('#app').innerHTML=shell(); document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;render()});$('#logout').onclick=async()=>{await sb.auth.signOut();showLogin()};$('#refresh').onclick=async()=>{try{await loadAll();render();toast('อัปเดตข้อมูลแล้ว')}catch(e){fail(e)}};const c=$('#content');({dashboard:dashboard,products:productPage,stock:stockPage,receive:()=>movementForm('receive'),transfer:()=>movementForm('transfer'),sale:()=>movementForm('sale'),adjust:()=>movementForm('adjustment'),history:historyPage})[page](c)}
function head(title,desc,extra=''){return `<div class="page-head"><div><h1>${title}</h1><p>${desc}</p></div>${extra}</div>`}
function dashboard(el){const sum=products.filter(p=>p.active).reduce((a,p)=>a+total(p),0);const low=products.filter(p=>p.active&&locations.some(l=>qty(p.id,l.id)<=Number(p.threshold||3))).length;el.innerHTML=head('ภาพรวมสต็อก','ยอดล่าสุดจากฐานข้อมูลกลาง')+`<div class="stats-grid"><div class="stat-card"><span>สินค้าเปิดใช้งาน</span><strong>${num(products.filter(p=>p.active).length)}</strong><small>SKU</small></div><div class="stat-card"><span>สต็อกรวมทุกช่องทาง</span><strong>${num(sum)}</strong><small>ชิ้น</small></div><div class="stat-card"><span>รายการสต็อกต่ำ/หมด</span><strong>${num(low)}</strong><small>สินค้า</small></div><div class="stat-card"><span>ประวัติล่าสุด</span><strong>${num(movements.length)}</strong><small>รายการที่โหลด</small></div></div><div class="card"><h2>ยอดแยกช่องทาง</h2>${locations.map(l=>`<div class="confirm-row"><span>${esc(l.name)}</span><strong>${num(products.reduce((s,p)=>s+qty(p.id,l.id),0))} ชิ้น</strong></div>`).join('')}</div><div class="card"><h2>รายการเคลื่อนไหวล่าสุด</h2>${movementTable(movements.slice(0,8))}</div>`}
function productPage(el){el.innerHTML=head('รายการสินค้า','ข้อมูลสินค้าอ่านจาก Supabase โดยตรง')+`<div class="card"><div class="toolbar"><input class="input" id="q" placeholder="ค้นหา SKU / รหัสขาย / ชื่อสินค้า"><span class="muted">${products.length} รายการ</span></div><div id="product-table">${productTable(products)}</div></div>`;$('#q').oninput=e=>$('#product-table').innerHTML=productTable(products.filter(p=>[p.sku,p.vrich_code,p.name,p.category,p.size].some(x=>String(x||'').toLowerCase().includes(e.target.value.toLowerCase()))))}
function productTable(list){return `<div class="table-wrap"><table><thead><tr><th>SKU</th><th>รหัสขาย</th><th>ชื่อสินค้า</th><th>ไซซ์</th><th>ราคาขาย</th><th>ต้นทุน</th><th>สถานะ</th></tr></thead><tbody>${list.map(p=>`<tr><td>${esc(p.sku)}</td><td>${esc(p.vrich_code||'—')}</td><td>${esc(p.name)}</td><td>${esc(p.size||'—')}</td><td>${isCEO()?money(p.price):'••••'}</td><td>${isCEO()?money(p.cost):'••••'}</td><td>${p.active?'ใช้งาน':'ปิดใช้งาน'}</td></tr>`).join('')}</tbody></table></div>`}
function stockPage(el){el.innerHTML=head('สต็อกแยกช่องทาง','ยอดคงเหลือแต่ละสินค้าใน 4 จุด')+`<div class="card"><div class="toolbar"><input class="input" id="q" placeholder="ค้นหา SKU / รหัสขาย / ชื่อสินค้า"></div><div id="stock-table">${stockTable(products)}</div></div>`;$('#q').oninput=e=>$('#stock-table').innerHTML=stockTable(products.filter(p=>[p.sku,p.vrich_code,p.name].some(x=>String(x||'').toLowerCase().includes(e.target.value.toLowerCase()))))}
function stockTable(list){return `<div class="table-wrap"><table><thead><tr><th>SKU / ชื่อ</th>${locations.map(l=>`<th>${esc(l.name)}</th>`).join('')}<th>รวม</th></tr></thead><tbody>${list.map(p=>`<tr><td><b>${esc(p.sku)}</b><br><small>${esc(p.name)}</small></td>${locations.map(l=>`<td>${num(qty(p.id,l.id))}</td>`).join('')}<td><b>${num(total(p))}</b></td></tr>`).join('')}</tbody></table></div>`}
function productOptions(){return products.filter(p=>p.active).map(p=>`<option value="${p.id}">${esc(p.sku)} · ${esc(p.name)}${p.size?' · '+esc(p.size):''}</option>`).join('')}
function locationOptions(except=''){return locations.filter(l=>l.id!==except).map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}
function movementForm(type){const cfg={receive:['รับสินค้าเข้า','รับของเข้าจาก Supplier',false],transfer:['โอนสต็อก','ย้ายสินค้าไปอีกช่องทาง',false],sale:['ขายออก','ตัดยอดจากช่องทางที่ขาย',false],adjustment:['ปรับสต็อก','ใช้เมื่อของเสีย/หาย/นับคลาดเคลื่อน ต้องใส่เหตุผล',true]}[type];const fromField=type==='transfer'||type==='sale'?`<div class="field"><label>${type==='sale'?'ช่องทางที่ขายออก':'จากช่องทาง'} *</label><select class="select" name="from" required>${locations.map((l,i)=>`<option value="${l.id}" ${i===0?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div>`:'';const toField=type==='receive'||type==='transfer'?`<div class="field"><label>${type==='receive'?'รับเข้าที่':'โอนไปที่'} *</label><select class="select" name="to" required>${locations.map((l,i)=>`<option value="${l.id}" ${type==='transfer'&&i===1?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div>`:type==='adjustment'?`<div class="field"><label>ช่องทาง *</label><select class="select" name="to" required>${locations.map((l,i)=>`<option value="${l.id}" ${i===0?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div>`:'';$('#content').innerHTML=head(cfg[0],cfg[1])+`<div class="card operation-card"><form id="move-form"><div class="field"><label>สินค้า *</label><select class="select" name="product" required><option value="">เลือกสินค้า</option>${productOptions()}</select></div><div class="form-grid">${fromField}${toField}<div class="field"><label>จำนวน ${type==='adjustment'?'(+ เพิ่ม / - ลด)':''} *</label><input class="input" name="quantity" type="number" step="1" ${type==='adjustment'?'':'min="1"'} required placeholder="จำนวนชิ้น"></div><div class="field"><label>เลขอ้างอิง / เลขออเดอร์</label><input class="input" name="reference" placeholder="ถ้ามี"></div></div><div class="field"><label>หมายเหตุ ${type==='adjustment'?'(ระบุเหตุผล)':'(ถ้ามี)'}</label><input class="input" name="note" ${type==='adjustment'?'required':''} placeholder="ระบุรายละเอียด"></div><button class="btn btn-primary btn-block" type="submit">ตรวจสอบและบันทึก</button></form></div>`;$('#move-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.target),q=Number(f.get('quantity')),from=f.get('from')||null,to=f.get('to')||null;if(!Number.isInteger(q)||q===0||(type!=='adjustment'&&q<1))return toast('จำนวนไม่ถูกต้อง',true);if(type==='transfer'&&from===to)return toast('ต้นทางกับปลายทางต้องต่างกัน',true);const product=products.find(p=>p.id===f.get('product'));if(!product)return toast('เลือกสินค้าก่อน',true);if(type==='sale'&&qty(product.id,from)<q)return toast('สต็อกไม่พอในช่องทางนี้',true);if(type==='transfer'&&qty(product.id,from)<q)return toast('สต็อกต้นทางไม่พอ',true);const label={receive:'รับสินค้าเข้า',transfer:'โอนสต็อก',sale:'ขายออก',adjustment:'ปรับสต็อก'}[type];if(!confirm(`${label}\nสินค้า: ${product.sku} ${product.name}\nจำนวน: ${q}\n\nยืนยันหรือไม่?`))return;busy=true;const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;try{const {data,error}=await sb.rpc('apply_stock_movement_v2',{p_product_id:product.id,p_movement_type:type,p_quantity:q,p_from_location_id:from,p_to_location_id:to,p_note:f.get('note')||null,p_channel:type==='sale'?locations.find(l=>l.id===from)?.name:null,p_external_order_id:f.get('reference')||null});if(error)throw error;await loadAll();render();toast('บันทึกและอัปเดตสต็อกแล้ว')}catch(err){fail(err)}finally{busy=false;}}}
function movementTable(list){const nameById=Object.fromEntries(products.map(p=>[p.id,p]));const locById=Object.fromEntries(locations.map(l=>[l.id,l.name]));return `<div class="table-wrap"><table><thead><tr><th>เวลา</th><th>สินค้า</th><th>ประเภท</th><th>จาก → ไป</th><th>จำนวน</th><th>ช่องทาง/อ้างอิง</th><th>หมายเหตุ</th></tr></thead><tbody>${list.map(m=>{const p=nameById[m.product_id];return `<tr><td>${esc(new Date(m.created_at).toLocaleString('th-TH'))}</td><td>${esc(p?.sku||m.product_id)}<br><small>${esc(p?.name||'')}</small></td><td>${esc(({receive:'รับเข้า',transfer:'โอน',sale:'ขายออก',adjustment:'ปรับ',return:'คืนสินค้า'})[m.movement_type]||m.movement_type)}</td><td>${esc(locById[m.from_location_id]||'—')} → ${esc(locById[m.to_location_id]||'—')}</td><td>${num(m.quantity)}</td><td>${esc(m.channel||'—')}<br><small>${esc(m.external_order_id||'')}</small></td><td>${esc(m.note||'—')}</td></tr>`}).join('')}</tbody></table></div>`}
function historyPage(el){el.innerHTML=head('ประวัติการเคลื่อนไหว','ประวัติจากฐานข้อมูลกลาง (สูงสุด 500 รายการล่าสุด)')+`<div class="card"><div class="toolbar"><input class="input" id="q" placeholder="ค้นหา SKU / หมายเหตุ / เลขออเดอร์"></div><div id="history-table">${movementTable(movements)}</div></div>`;$('#q').oninput=e=>{const q=e.target.value.toLowerCase();$('#history-table').innerHTML=movementTable(movements.filter(m=>{const p=products.find(p=>p.id===m.product_id);return [p?.sku,p?.name,m.note,m.external_order_id,m.channel,m.movement_type].some(v=>String(v||'').toLowerCase().includes(q))}))}}
boot().catch(fail);
})();
