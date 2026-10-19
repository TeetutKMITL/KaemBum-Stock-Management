(() => {
  'use strict';

  const STORAGE_KEY = 'stockflow_beta_20261013_state';
  const LOCATIONS = {
    central: 'หน้าร้าน',
    facebook: 'Facebook Page',
    tiktok: 'TikTok Shop',
    shopee: 'Shopee'
  };
  const LOCATION_LABELS = { central: 'หน้าร้าน', facebook: 'Facebook Page', tiktok: 'TikTok', shopee: 'Shopee' };
  const SALE_LOCATIONS = { facebook: 'Facebook Page', tiktok: 'TikTok Shop', shopee: 'Shopee', storefront: 'หน้าร้าน', other: 'อื่นๆ' };
  const MOVEMENT_TYPES = { RECEIVE: 'รับสินค้าเข้า', TRANSFER: 'โอน Stock', SALE: 'ขายออก', ADJUSTMENT: 'ปรับ Stock' };
  const EMPLOYEES = ['Boom', 'Employee 1', 'Employee 2', 'Employee 3'];
  const navItems = [
    ['dashboard', '▦', 'Dashboard'], ['products', '▣', 'สินค้า'], ['stock', '▤', 'Stock'], ['receive', '＋', 'รับสินค้าเข้า'],
    ['transfer', '⇄', 'โอน Stock'], ['sale', '−', 'ขายออก'], ['adjustment', '±', 'ปรับ Stock'], ['history', '☷', 'ประวัติ'], ['import', '⇧', 'Import Stock']
  ];

  // Legacy demo/test products and movements removed. Beta data comes only from stock-data.js.
  const demoProducts = [];
  const demoMovements = [];

  function makeInitialState(){
    if(window.STOCK_IMPORT?.products?.length){
      return { products: window.STOCK_IMPORT.products, movements: window.STOCK_IMPORT.movements || [], employee: 'Boom', initializedAt: new Date().toISOString(), importSource: window.STOCK_IMPORT.sourceFile, importMode: 'MASTER_STOCK' };
    }
    return { products: demoProducts, movements: demoMovements, employee: 'Boom', initializedAt: new Date().toISOString(), importMode: 'DEMO' };
  }
  function loadState(){ try { const raw=localStorage.getItem(STORAGE_KEY); if(raw) return JSON.parse(raw); } catch(e){} const s=makeInitialState(); saveState(s); return s; }
  function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  // Beta build intentionally clears known legacy localStorage keys so old test inventory cannot be reused.
  try { ['stockflow_v2_real_state','stockflow_v1_state','stockflow_state','stockflow_v1_demo_state'].forEach(k => localStorage.removeItem(k)); } catch(e) {}
  let state = loadState();
  let currentPage = 'dashboard';
  let searchTerm = '';
  let mobileNavOpen = false;

  const app = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');
  const fmt = new Intl.NumberFormat('th-TH');
  const currency = new Intl.NumberFormat('th-TH', { style:'currency', currency:'THB', maximumFractionDigits:0 });
  const dateFmt = new Intl.DateTimeFormat('th-TH', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const escapeHtml = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const getProduct = sku => state.products.find(p => p.sku === sku);
  const activeProducts = () => state.products.filter(p=>p.active);
  const productMap = () => Object.fromEntries(state.products.map(p=>[p.sku,p]));

  function stockForSku(sku){
    const result={central:0,facebook:0,tiktok:0,shopee:0};
    for(const m of state.movements.filter(x=>x.sku===sku)){
      if(m.to in result) result[m.to] += Number(m.quantity);
      if(m.from in result) result[m.from] -= Number(m.quantity);
    }
    return result;
  }
  function stockTotal(sku){ const s=stockForSku(sku); return s.central+s.facebook+s.tiktok+s.shopee; }
  function allStock(){ const out={}; state.products.forEach(p=>out[p.sku]=stockForSku(p.sku)); return out; }
  function statusForLocation(product, qty){ if(qty<=0) return ['หมด','red']; if(qty<=2) return ['Stock ต่ำ','red']; return ['ปกติ','green']; }
  function statusBadge(product, qty){ const [label,c]=statusForLocation(product,qty); return `<span class="badge badge-${c}">${c==='red'?'🔴':c==='yellow'?'⚠️':'●'} ${label}</span>`; }
  function totalStatus(product){ const qty=stockTotal(product.sku); if(qty<=0) return ['หมด','red']; return ['มีสินค้า','green']; }
  function showToast(msg,type='success'){ const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=msg; toastRoot.appendChild(el); setTimeout(()=>el.remove(),3200); }
  function money(n){ return currency.format(Number(n)||0); }
  function fmtDate(s){ return dateFmt.format(new Date(s)); }
  function locationLabel(loc){ return LOCATIONS[loc] || SALE_LOCATIONS[loc] || loc || '—'; }
  function movementLabel(type){ return MOVEMENT_TYPES[type] || type; }
  function movementBadge(type){ const cls={RECEIVE:'green',TRANSFER:'blue',SALE:'yellow',ADJUSTMENT:'gray'}[type]||'gray'; return `<span class="badge badge-${cls}">${movementLabel(type)}</span>`; }

  function renderShell(){
    app.innerHTML = `<aside class="sidebar" id="sidebar">
      <div class="brand"><img class="brand-logo" src="assets/logo.png" alt="โลโก้ร้านแก้มบุ๋ม เพ-ลาเล่น"><div class="brand-copy"><div class="brand-title">แก้มบุ๋ม เพ-ลาเล่น</div><div class="brand-sub">ระบบจัดการสต็อกสินค้า</div></div></div>
      <nav class="nav">${navItems.map(([id,icon,label])=>`<button class="${currentPage===id?'active':''}" data-nav="${id}"><span>${icon}</span><span>${label}</span></button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="employee-mini">พนักงานปัจจุบัน</div><div class="employee-name">${escapeHtml(state.employee)}</div></div>
    </aside>
    <div class="mobile-overlay ${mobileNavOpen?'show':''}" id="mobile-overlay"></div>
    <main class="main">
      <header class="topbar"><div class="topbar-right"><button class="mobile-menu" id="mobile-menu">☰</button><div class="topbar-title">${navItems.find(x=>x[0]===currentPage)?.[2]||'Dashboard'}</div></div><div class="topbar-right"><button class="btn btn-sm" id="export-menu">⇩ Export</button><select class="select employee-btn" id="employee-select" style="width:auto;min-width:145px"><option value="">พนักงาน...</option>${EMPLOYEES.map(e=>`<option ${state.employee===e?'selected':''}>${e}</option>`).join('')}</select></div></header>
      <section class="page" id="page-content"></section>
    </main>`;
    document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
    document.getElementById('mobile-menu').addEventListener('click',()=>{mobileNavOpen=!mobileNavOpen; renderShell();});
    document.getElementById('mobile-overlay').addEventListener('click',()=>{mobileNavOpen=false;renderShell();});
    document.getElementById('export-menu').addEventListener('click',openExportModal);
    document.getElementById('employee-select').addEventListener('change',e=>{ if(!e.target.value)return; state.employee=e.target.value; saveState(state); renderShell(); showToast(`เปลี่ยนพนักงานเป็น ${state.employee}`); });
  }
  function navigate(page){ currentPage=page; searchTerm=''; mobileNavOpen=false; render(); }
  function render(){ renderShell(); const el=document.getElementById('page-content'); const pages={dashboard:renderDashboard,products:renderProducts,stock:renderStock,receive:renderReceive,transfer:renderTransfer,sale:renderSale,adjustment:renderAdjustment,history:renderHistory,import:renderImport}; pages[currentPage](el); }

  function pageHead(title,desc,actions=''){ return `<div class="page-head"><div><h1>${title}</h1><p>${desc}</p></div>${actions}</div>`; }
  function inventorySummary(){ const products=activeProducts(); const stocks=allStock(); const totals={central:0,facebook:0,tiktok:0,shopee:0}; products.forEach(p=>{const st=stocks[p.sku]||stockForSku(p.sku); Object.keys(totals).forEach(k=>totals[k]+=Number(st[k]||0));}); totals.total=totals.central+totals.facebook+totals.tiktok+totals.shopee; return {products,stocks,totals}; }
  function renderDashboard(el){
    const {products,stocks,totals}=inventorySummary();
    const recent=[...state.movements].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8);
    el.innerHTML=`${pageHead('Dashboard','ภาพรวม Stock ทุกช่องทางในจุดเดียว','<button class="btn btn-primary" id="go-receive">＋ รับสินค้าเข้า</button>')}
      <div class="grid cards-4"><div class="card location-card"><div class="location-icon">📦</div><div class="stat-label" style="margin-top:8px">สินค้าทั้งหมด</div><div class="stat-value">${fmt.format(products.length)}</div><div class="stat-note">SKU</div></div><div class="card location-card"><div class="location-icon">🔢</div><div class="stat-label" style="margin-top:8px">Stock รวม</div><div class="stat-value">${fmt.format(totals.total)}</div><div class="stat-note">หน่วย</div></div>${[['central','🏬','หน้าร้าน'],['facebook','📘','Facebook Page']].map(([k,icon,label])=>`<div class="card location-card"><div class="location-icon">${icon}</div><div class="stat-label" style="margin-top:8px">${label}</div><div class="stat-value">${fmt.format(totals[k])}</div><div class="stat-note">หน่วย</div></div>`).join('')}</div><div class="grid cards-4" style="margin-top:16px">${[['tiktok','🎵','TikTok Shop'],['shopee','🛍️','Shopee']].map(([k,icon,label])=>`<div class="card location-card"><div class="location-icon">${icon}</div><div class="stat-label" style="margin-top:8px">${label}</div><div class="stat-value">${fmt.format(totals[k])}</div><div class="stat-note">หน่วย</div></div>`).join('')}</div>
      <div class="grid" style="margin-top:16px">
        <div class="card"><div class="split"><h2 class="section-title">การเคลื่อนไหวล่าสุด</h2><button class="btn btn-sm" id="go-history">ดูทั้งหมด</button></div>${recent.length?`<div class="table-wrap"><table class="table" style="min-width:560px"><thead><tr><th>เวลา</th><th>ประเภท</th><th>SKU</th><th>จำนวน</th></tr></thead><tbody>${recent.map(m=>`<tr><td>${fmtDate(m.createdAt)}</td><td>${movementBadge(m.type)}</td><td class="sku">${escapeHtml(m.sku)}</td><td>${m.type==='SALE'||(m.type==='ADJUSTMENT'&&m.quantity<0)?'-':''}${fmt.format(Math.abs(m.quantity))}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">ยังไม่มีประวัติ</div>`}</div>
      </div>
      <div class="card" style="margin-top:16px"><div class="split"><div><h2 class="section-title">Stock แยกตาม SKU</h2><div class="muted" style="font-size:12px">คลิกแถวเพื่อดูรายละเอียด</div></div><button class="btn btn-sm" id="go-stock">ดู Stock ทั้งหมด</button></div>${renderStockTable(products.slice(0,12),stocks,true)}</div>`;
    document.getElementById('go-receive')?.addEventListener('click',()=>navigate('receive')); document.getElementById('go-history')?.addEventListener('click',()=>navigate('history')); document.getElementById('go-stock')?.addEventListener('click',()=>navigate('stock')); 
    document.querySelectorAll('[data-product-row]').forEach(r=>r.addEventListener('click',()=>openProductDetail(r.dataset.productRow)));
  }

  function stockCellClass(qty){ return qty >= 3 ? 'stock-ok' : 'stock-zero'; }
  function productSort(a,b){
    const ta=stockTotal(a.sku), tb=stockTotal(b.sku);
    if(ta>0 && tb===0) return -1;
    if(ta===0 && tb>0) return 1;
    return String(a.sku).localeCompare(String(b.sku), undefined, {numeric:true, sensitivity:'base'});
  }
  function renderStockTable(products,stocks=allStock(),compact=false){
    if(!products.length)return '<div class="empty">ไม่พบสินค้า</div>';
    const sorted=[...products].sort((a,b)=>{const mode=window.stockSortFilter||'sku'; if(mode==='high') return stockTotal(b.sku)-stockTotal(a.sku)||productSort(a,b); if(mode==='low') return stockTotal(a.sku)-stockTotal(b.sku)||productSort(a,b); return productSort(a,b);});
    return `<div class="table-wrap"><table class="table"><thead><tr><th>รหัส Vrich / SKU</th><th>สินค้า</th><th>หน้าร้าน</th><th>Facebook Page</th><th>TikTok</th><th>Shopee</th><th>Total</th><th>Status</th></tr></thead><tbody>${sorted.map(p=>{
      const s=stocks[p.sku]||stockForSku(p.sku); const total=Object.values(s).reduce((a,b)=>a+b,0);
      const hasOut=Object.values(s).some(q=>q===0), hasLow=Object.values(s).some(q=>q>0&&q<=2);
      return `<tr class="clickable" data-product-row="${escapeHtml(p.sku)}"><td class="sku"><strong>${escapeHtml(p.saleCode||p.sku)}</strong><div class="muted" style="font-size:11px">${escapeHtml(p.sku)}</div></td><td><div class="product-cell"><div class="product-thumb">👕</div><div><strong>${escapeHtml(p.name)}</strong><div class="muted" style="font-size:12px">${escapeHtml(p.color)} · ${escapeHtml(p.size)}</div></div></div></td><td class="stock-num ${stockCellClass(s.central)}">${fmt.format(s.central)}</td><td class="stock-num ${stockCellClass(s.facebook)}">${fmt.format(s.facebook)}</td><td class="stock-num ${stockCellClass(s.tiktok)}">${fmt.format(s.tiktok)}</td><td class="stock-num ${stockCellClass(s.shopee)}">${fmt.format(s.shopee)}</td><td class="stock-num ${total>=3?'stock-ok':'stock-zero'}">${fmt.format(total)}</td><td>${hasOut?'<span class="badge badge-red">🔴 มีจุดหมด</span>':hasLow?'<span class="badge badge-red">🔴 Stock ต่ำ</span>':'<span class="badge badge-green">● ปกติ</span>'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function bindLiveSearch(inputId, renderFn){
    const input=document.getElementById(inputId); if(!input) return;
    let composing=false;
    input.addEventListener('compositionstart',()=>{composing=true;});
    input.addEventListener('compositionend',()=>{composing=false;searchTerm=input.value;renderFn(document.getElementById('page-content'));restoreSearchFocus(inputId,input.value.length);});
    input.addEventListener('input',()=>{
      searchTerm=input.value;
      if(composing) return;
      const pos=input.selectionStart ?? input.value.length;
      renderFn(document.getElementById('page-content'));
      restoreSearchFocus(inputId,pos);
    });
  }
  function restoreSearchFocus(inputId,pos){ requestAnimationFrame(()=>{const next=document.getElementById(inputId); if(next){next.focus(); const p=Math.min(pos,next.value.length); next.setSelectionRange(p,p);}}); }

  function renderProducts(el){
    const categories=[...new Set(state.products.map(p=>p.category))];
    const filtered=state.products.filter(p=>{const q=searchTerm.toLowerCase(); return (!q||[p.saleCode,p.sku,p.name,p.color,p.size].join(' ').toLowerCase().includes(q)) && (!window.productCategoryFilter||p.category===window.productCategoryFilter) && (!window.productActiveFilter||window.productActiveFilter==='all'||(window.productActiveFilter==='active'?p.active:!p.active));});
    el.innerHTML=`${pageHead('สินค้า','จัดการสินค้า โดยค้นหาด้วยรหัส Vrich ที่ใช้ไลฟ์ และเก็บ SKU ภายในไว้ระบุรายการ','<button class="btn btn-primary" id="add-product">＋ เพิ่มสินค้า</button>')}
      <div class="card"><div class="toolbar"><input class="input search" id="product-search" value="${escapeHtml(searchTerm)}" placeholder="ค้นหารหัสไลฟ์ Vrich / ชื่อสินค้า / SKU"/><select class="select" id="category-filter" style="max-width:200px"><option value="">ทุกหมวดหมู่</option>${categories.map(c=>`<option value="${escapeHtml(c)}" ${window.productCategoryFilter===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select><select class="select" id="active-filter" style="max-width:170px"><option value="all">ทั้งหมด</option><option value="active" ${window.productActiveFilter==='active'?'selected':''}>ใช้งาน</option><option value="inactive" ${window.productActiveFilter==='inactive'?'selected':''}>ปิดใช้งาน</option></select></div>${filtered.length?`<div class="table-wrap"><table class="table"><thead><tr><th>รหัส Vrich / SKU</th><th>สินค้า</th><th>หมวดหมู่</th><th>ต้นทุน</th><th>ราคาขาย</th><th>Threshold</th><th>สถานะ</th><th></th></tr></thead><tbody>${filtered.map(p=>`<tr><td class="sku">${escapeHtml(p.sku)}</td><td><strong>${escapeHtml(p.name)}</strong><div class="muted" style="font-size:12px">${escapeHtml(p.color)} · ${escapeHtml(p.size)}</div></td><td>${escapeHtml(p.category)}</td><td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${fmt.format(p.threshold)}</td><td>${p.active?'<span class="badge badge-green">ใช้งาน</span>':'<span class="badge badge-gray">ปิดใช้งาน</span>'}</td><td><div style="display:flex;gap:6px"><button class="btn btn-sm" data-edit="${escapeHtml(p.sku)}">แก้ไข</button>${p.active?`<button class="btn btn-sm btn-danger" data-deactivate="${escapeHtml(p.sku)}">ปิด</button>`:`<button class="btn btn-sm" data-activate="${escapeHtml(p.sku)}">เปิด</button>`}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">ไม่พบสินค้า</div>'}</div>`;
    document.getElementById('add-product').addEventListener('click',()=>openProductForm());
    bindLiveSearch('product-search',renderProducts);
    document.getElementById('category-filter').addEventListener('change',e=>{window.productCategoryFilter=e.target.value; renderProducts(document.getElementById('page-content'));});
    document.getElementById('active-filter').addEventListener('change',e=>{window.productActiveFilter=e.target.value; renderProducts(document.getElementById('page-content'));});
    document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openProductForm(b.dataset.edit))); document.querySelectorAll('[data-deactivate]').forEach(b=>b.addEventListener('click',()=>toggleProduct(b.dataset.deactivate,false))); document.querySelectorAll('[data-activate]').forEach(b=>b.addEventListener('click',()=>toggleProduct(b.dataset.activate,true)));
  }

  function openProductForm(sku='', options={}){ const p=sku?getProduct(sku):null; const modal=document.createElement('div'); modal.className='modal-backdrop'; modal.innerHTML=`<div class="modal"><div class="modal-head"><h2>${p?'แก้ไขสินค้า':'เพิ่มสินค้า'}</h2><button class="close" id="close">×</button></div><form id="product-form"><div class="modal-body"><div class="form-grid"><div class="field"><label>SKU *</label><input class="input" name="sku" required value="${escapeHtml(p?.sku||'')}" ${p?'readonly':''} placeholder="เช่น SHIRT-001-BLK-M"/><small>SKU ต้องไม่ซ้ำ และไม่ใช่เลข Tracking</small></div><div class="field"><label>ชื่อสินค้า *</label><input class="input" name="name" required value="${escapeHtml(p?.name||'')}" placeholder="เสื้อรุ่น 001"/></div><div class="field"><label>หมวดหมู่ *</label><input class="input" name="category" required value="${escapeHtml(p?.category||'')}" placeholder="เสื้อยืด"/></div><div class="field"><label>สี</label><input class="input" name="color" value="${escapeHtml(p?.color||'')}"/></div><div class="field"><label>ไซซ์</label><input class="input" name="size" value="${escapeHtml(p?.size||'')}"/></div><div class="field"><label>ต้นทุน (บาท)</label><input class="input" name="cost" type="number" min="0" step="0.01" value="${p?.cost??0}"/></div><div class="field"><label>ราคาขาย (บาท)</label><input class="input" name="price" type="number" min="0" step="0.01" value="${p?.price??0}"/></div><div class="field"><label>Low Stock Threshold *</label><input class="input" name="threshold" type="number" min="0" step="1" required value="${p?.threshold??3}"/></div><div class="field"><label>Barcode (ถ้ามี)</label><input class="input" name="barcode" value="${escapeHtml(p?.barcode||'')}" placeholder="สำหรับอนาคต"/></div><div class="field"><label>รูปสินค้า URL (ถ้ามี)</label><input class="input" name="image" value="${escapeHtml(p?.image||'')}" placeholder="สำหรับอนาคต"/></div></div></div><div class="modal-foot"><button type="button" class="btn" id="cancel">ยกเลิก</button><button class="btn btn-primary">บันทึกสินค้า</button></div></form></div>`; document.body.appendChild(modal); const close=()=>modal.remove(); modal.querySelector('#close').onclick=close; modal.querySelector('#cancel').onclick=close; modal.querySelector('form').onsubmit=e=>{e.preventDefault(); const f=new FormData(e.target); const newSku=f.get('sku').trim().toUpperCase(); if(!newSku)return; if(!p&&state.products.some(x=>x.sku===newSku)){showToast('SKU นี้มีอยู่แล้ว กรุณาใช้ SKU ใหม่','error');return;} const data={id:p?.id||crypto.randomUUID(),sku:newSku,name:f.get('name').trim(),category:f.get('category').trim(),color:f.get('color').trim(),size:f.get('size').trim(),cost:Number(f.get('cost')||0),price:Number(f.get('price')||0),threshold:Number(f.get('threshold')||0),active:p?.active??true,barcode:f.get('barcode').trim(),image:f.get('image').trim()}; if(p) Object.assign(p,data); else state.products.push(data); saveState(state); close(); render(); showToast(p?'แก้ไขสินค้าแล้ว':'เพิ่มสินค้าแล้ว'); options.afterSave?.(data);}; }
  function toggleProduct(sku,active){ const p=getProduct(sku); if(!p)return; p.active=active; saveState(state); renderProducts(document.getElementById('page-content')); showToast(active?'เปิดใช้งานสินค้าแล้ว':'ปิดใช้งานสินค้าแล้ว'); }

  function renderStock(el){
    const stocks=allStock(); const categories=[...new Set(activeProducts().map(p=>p.category))]; const locFilter=window.stockLocFilter||''; const statusFilter=window.stockStatusFilter||''; const sortFilter=window.stockSortFilter||'sku'; const filtered=activeProducts().filter(p=>{const q=searchTerm.toLowerCase(); const s=stocks[p.sku]; const status=statusFilter==='out'?Object.values(s).some(v=>v===0):statusFilter==='low'?Object.entries(s).some(([k,v])=>v>0&&v<=2):true; const loc=locFilter?s[locFilter]<=2:true; return (!q||[p.saleCode,p.sku,p.name,p.color,p.size].join(' ').toLowerCase().includes(q))&&status&&loc;});
    el.innerHTML=`${pageHead('Stock Overview','ดู Stock ของทุก SKU แยกตามจุดเก็บสินค้า','<button class="btn" id="reset-stock">รีเซ็ตตัวกรอง</button>')}
      <div class="card"><div class="toolbar"><input class="input search" id="stock-search" value="${escapeHtml(searchTerm)}" placeholder="ค้นหารหัสไลฟ์ Vrich / ชื่อสินค้า / SKU"/><select class="select" id="stock-loc" style="max-width:190px"><option value="">ทุก Location</option>${Object.entries(LOCATION_LABELS).map(([k,v])=>`<option value="${k}" ${locFilter===k?'selected':''}>${v}</option>`).join('')}</select><select class="select" id="stock-status" style="max-width:190px"><option value="">ทุกสถานะ</option><option value="low" ${statusFilter==='low'?'selected':''}>Stock ต่ำ</option><option value="out" ${statusFilter==='out'?'selected':''}>มีจุดหมด</option></select><select class="select" id="stock-sort" style="max-width:220px"><option value="sku" ${sortFilter==='sku'?'selected':''}>เรียงตาม SKU</option><option value="high" ${sortFilter==='high'?'selected':''}>Stock เยอะสุด → น้อยสุด</option><option value="low" ${sortFilter==='low'?'selected':''}>Stock น้อยสุด → เยอะสุด</option></select></div>${renderStockTable(filtered,stocks)}</div>`;
    bindLiveSearch('stock-search',renderStock); document.getElementById('stock-loc').addEventListener('change',e=>{window.stockLocFilter=e.target.value;renderStock(document.getElementById('page-content'));}); document.getElementById('stock-status').addEventListener('change',e=>{window.stockStatusFilter=e.target.value;renderStock(document.getElementById('page-content'));}); document.getElementById('stock-sort').addEventListener('change',e=>{window.stockSortFilter=e.target.value;renderStock(document.getElementById('page-content'));}); document.getElementById('reset-stock').addEventListener('click',()=>{searchTerm='';window.stockLocFilter='';window.stockStatusFilter='';window.stockSortFilter='sku';renderStock(document.getElementById('page-content'));}); document.querySelectorAll('[data-product-row]').forEach(r=>r.addEventListener('click',()=>openProductDetail(r.dataset.productRow)));
  }

  function productOptions(){ return activeProducts().sort((a,b)=>String(a.saleCode||a.sku).localeCompare(String(b.saleCode||b.sku), undefined, {numeric:true})).map(p=>`<option value="${escapeHtml(p.sku)}">${escapeHtml(p.saleCode||p.sku)} — ${escapeHtml(p.name)} ${escapeHtml(p.color)} ${escapeHtml(p.size)}</option>`).join(''); }
  function productSearchField(options={}){
    const allowNew=options.allowNew===true;
    return `<div class="field product-picker-wrap"><label>สินค้า / SKU *</label><div class="product-picker-row"><input class="input product-picker" name="sku" autocomplete="off" required placeholder="พิมพ์รหัส Vrich หรือชื่อสินค้าเพื่อค้นหา" />${allowNew?'<button type="button" class="btn" id="new-sku-btn">＋ สร้าง SKU ใหม่</button>':''}</div><div class="product-suggestions" id="product-suggestions"></div><small>พิมพ์รหัส Vrich บางส่วนได้ เช่น KK175 ระบบจะแนะนำสินค้าที่ใกล้เคียง</small></div>`;
  }
  function productMatchScore(p, raw){
    const q=String(raw||'').trim().toLowerCase(); if(!q)return 0;
    const sku=String(p.sku||'').toLowerCase(), code=String(p.saleCode||'').toLowerCase(), name=String(p.name||'').toLowerCase(), color=String(p.color||'').toLowerCase(), size=String(p.size||'').toLowerCase();
    if(code===q)return 1100;
    if(sku===q)return 1000;
    if(code.startsWith(q))return 950-q.length;
    if(sku.startsWith(q))return 900-q.length;
    if(name.startsWith(q))return 800-q.length;
    if(code.includes(q))return 750-q.length;
    if(sku.includes(q))return 700-q.length;
    if(name.includes(q))return 600-q.length;
    if(color.includes(q)||size.includes(q))return 500-q.length;
    return 0;
  }
  function productMatches(value, limit=8){
    const raw=String(value||'').trim(); if(!raw)return [];
    return activeProducts().map(p=>({p,score:productMatchScore(p,raw)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.p.sku.localeCompare(b.p.sku,undefined,{numeric:true,sensitivity:'base'})).slice(0,limit).map(x=>x.p);
  }
  function resolveProductValue(value){
    const raw=String(value||'').trim().toLowerCase(); if(!raw)return null;
    const exact=state.products.find(p=>p.active && p.sku.toLowerCase()===raw); if(exact)return exact;
    const codeMatches=state.products.filter(p=>p.active && String(p.saleCode||'').toLowerCase()===raw); if(codeMatches.length===1)return codeMatches[0];
    const matches=productMatches(value,2); return matches.length===1?matches[0]:null;
  }
  function bindProductPicker(form, {allowNew=false}={}){
    const input=form?.querySelector('.product-picker'), box=form?.querySelector('#product-suggestions'); if(!input||!box)return;
    const show=()=>{
      const matches=productMatches(input.value,8);
      if(!input.value.trim()){box.innerHTML='';box.classList.remove('show');return;}
      box.innerHTML=matches.length?matches.map(p=>`<button type="button" class="product-suggestion" data-sku="${escapeHtml(p.sku)}"><strong>${escapeHtml(p.saleCode||p.sku)}</strong><span>${escapeHtml(p.name||'')} ${escapeHtml(p.color||'')} ${escapeHtml(p.size||'')}</span></button>`).join(''):'<div class="product-no-match">ไม่พบสินค้า — ลองพิมพ์ SKU หรือชื่อสินค้าใหม่</div>';
      box.classList.add('show');
      box.querySelectorAll('[data-sku]').forEach(btn=>btn.addEventListener('mousedown',e=>{e.preventDefault(); input.value=btn.dataset.sku; box.classList.remove('show'); box.innerHTML=''; input.dispatchEvent(new Event('input',{bubbles:true})); input.focus();}));
    };
    input.addEventListener('input',show); input.addEventListener('focus',show); input.addEventListener('blur',()=>setTimeout(()=>box.classList.remove('show'),160));
    if(allowNew){
      form.querySelector('#new-sku-btn')?.addEventListener('click',()=>openProductForm('',{afterSave:(p)=>{input.value=p.sku; input.focus(); input.dispatchEvent(new Event('input',{bubbles:true}));}}));
    }
  }

  function operationLayout(title,desc,formHtml){ return `${pageHead(title,desc)}<div class="grid cards-2"><div class="card"><form id="operation-form">${formHtml}</form></div><div class="card" id="operation-preview"><h2 class="section-title">สรุปก่อนบันทึก</h2><div class="info-box">กรอกข้อมูลทางซ้าย ระบบจะแสดงผลกระทบต่อ Stock และขอให้ยืนยันก่อนบันทึกทุกครั้ง</div></div></div>`; }
  function employeeField(){return `<div class="field"><label>พนักงาน *</label><select class="select" name="employee" required>${EMPLOYEES.map(e=>`<option ${state.employee===e?'selected':''}>${e}</option>`).join('')}</select></div>`;}

  function renderReceive(el){ el.innerHTML=operationLayout('รับสินค้าเข้า','รับสินค้าใหม่เข้าระบบ โดย V1 แนะนำให้รับเข้าที่ หน้าร้าน',`${productSearchField({allowNew:true})}<div class="form-grid"><div class="field"><label>จำนวน *</label><input class="input" name="quantity" type="number" min="1" step="1" required placeholder="เช่น 10"/></div><div class="field"><label>ปลายทาง *</label><select class="select" name="to"><option value="central">หน้าร้าน</option></select></div></div>${employeeField()}<div class="form-grid"><div class="field"><label>Reference</label><input class="input" name="reference" placeholder="เช่น PO-1001"/></div><div class="field"><label>หมายเหตุ</label><input class="input" name="note" placeholder="เช่น รับล็อตแรก"/></div></div><div style="margin-top:16px"><button class="btn btn-primary btn-block">ตรวจสอบและยืนยันการรับสินค้า</button></div>`); bindReceive(); }
  function bindReceive(){
    const form=document.getElementById('operation-form'),preview=document.getElementById('operation-preview');
    bindProductPicker(form,{allowNew:true});
    const update=()=>{
      const selected=resolveProductValue(form.sku.value),sku=selected?.sku||form.sku.value,q=Number(form.quantity.value||0),p=selected;
      if(p&&q>0){
        preview.innerHTML='<h2 class="section-title">สรุปก่อนบันทึก</h2><div class="confirm-box">'
          +'<div class="confirm-row"><span>SKU</span><strong>'+escapeHtml(p.sku)+'</strong></div>'
          +'<div class="confirm-row"><span>สินค้า</span><strong>'+escapeHtml(p.name)+' '+escapeHtml(p.color)+' '+escapeHtml(p.size)+'</strong></div>'
          +'<div class="confirm-row"><span>จำนวน</span><strong class="movement-positive">+'+fmt.format(q)+' ตัว</strong></div>'
          +'<div class="confirm-row"><span>เส้นทาง</span><strong>Supplier → หน้าร้าน</strong></div>'
          +'<div class="confirm-row"><span>หลังรับ</span><strong>'+fmt.format(stockTotal(sku)+q)+' ตัวรวม</strong></div></div>';
      } else preview.innerHTML='<h2 class="section-title">สรุปก่อนบันทึก</h2><div class="info-box">เลือกสินค้าและใส่จำนวนเพื่อดูตัวอย่าง</div>';
    };
    form.addEventListener('input',update);form.addEventListener('change',update);
    form.addEventListener('submit',e=>{
      e.preventDefault(); const selected=resolveProductValue(form.sku.value),sku=selected?.sku||form.sku.value,q=Number(form.quantity.value),employee=form.employee.value;
      if(!validateQty(q)||!selected){showToast('กรุณาตรวจสอบ SKU และจำนวน','error');return;}
      confirmAction('รับสินค้าเข้า '+getProduct(sku).name+' '+getProduct(sku).color+' '+getProduct(sku).size+' จำนวน '+q+' ตัว → หน้าร้าน',()=>{
        addMovement({type:'RECEIVE',sku,quantity:q,from:'Supplier',to:'central',employee,reference:form.reference.value.trim(),note:form.note.value.trim()});
        navigate('receive');showToast('รับสินค้าเข้าเรียบร้อยแล้ว');
      });
    }); update();
  }

  function renderTransfer(el){ el.innerHTML=operationLayout('โอน Stock','ย้ายสินค้าออกจาก Location หนึ่งไปอีก Location หนึ่ง โดยห้ามโอนเกิน Stock ที่มี',`${productSearchField()}<div class="form-grid"><div class="field"><label>จาก *</label><select class="select" name="from" required>${Object.entries(LOCATIONS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div class="field"><label>ไปยัง *</label><select class="select" name="to" required>${Object.entries(LOCATIONS).map(([k,v])=>`<option value="${k}" ${k==='facebook'?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="field"><label>จำนวน *</label><input class="input" name="quantity" type="number" min="1" step="1" required placeholder="เช่น 3"/></div>${employeeField()}<div class="form-grid"><div class="field"><label>Reference</label><input class="input" name="reference" placeholder="ถ้ามี"/></div><div class="field"><label>หมายเหตุ</label><input class="input" name="note" placeholder="เช่น เติม TikTok"/></div></div><div style="margin-top:16px"><button class="btn btn-primary btn-block">ตรวจสอบและยืนยันการโอน</button></div>`); bindTransfer(); }
  function bindTransfer(){
    const form=document.getElementById('operation-form'),preview=document.getElementById('operation-preview');
    bindProductPicker(form);
    const update=()=>{
      const selected=resolveProductValue(form.sku.value),sku=selected?.sku||form.sku.value,from=form.from.value,to=form.to.value,q=Number(form.quantity.value||0),p=selected,st=stockForSku(sku);
      if(p&&q>0){
        preview.innerHTML='<h2 class="section-title">สรุปก่อนบันทึก</h2><div class="confirm-box">'
          +'<div class="confirm-row"><span>สินค้า</span><strong>'+escapeHtml(p.name)+' '+escapeHtml(p.color)+' '+escapeHtml(p.size)+'</strong></div>'
          +'<div class="confirm-row"><span>จำนวน</span><strong>'+fmt.format(q)+' ตัว</strong></div>'
          +'<div class="confirm-row"><span>เส้นทาง</span><strong>'+locationLabel(from)+' → '+locationLabel(to)+'</strong></div>'
          +'<div class="confirm-row"><span>Stock ก่อน</span><strong>'+fmt.format(st[from])+' ตัว</strong></div>'
          +(q>st[from]?'<div class="danger-box" style="margin-top:10px">Stock ต้นทางไม่พอ — ไม่สามารถโอนได้</div>':'<div class="success-box" style="margin-top:10px">หลังโอน: '+fmt.format(st[from]-q)+' → '+locationLabel(from)+' / '+fmt.format(st[to]+q)+' → '+locationLabel(to)+'</div>')
          +'</div>';
      } else preview.innerHTML='<h2 class="section-title">สรุปก่อนบันทึก</h2><div class="info-box">เลือกสินค้า ต้นทาง ปลายทาง และจำนวน</div>';
    };
    form.addEventListener('input',update);form.addEventListener('change',update);
    form.addEventListener('submit',e=>{
      e.preventDefault();const selected=resolveProductValue(form.sku.value),sku=selected?.sku||form.sku.value,from=form.from.value,to=form.to.value,q=Number(form.quantity.value),employee=form.employee.value,s=stockForSku(sku);
      if(!getProduct(sku)||!validateQty(q)||!LOCATIONS[from]||!LOCATIONS[to]||from===to||q>s[from]){showToast(from===to?'ต้นทางและปลายทางต้องไม่เหมือนกัน':q>s[from]?'Stock ต้นทางไม่เพียงพอ':'กรุณาตรวจสอบข้อมูล','error');return;}
      const p=getProduct(sku);confirmAction('โอน '+p.name+' '+p.color+' '+p.size+' จำนวน '+q+' ตัว\nจาก '+locationLabel(from)+' → '+locationLabel(to),()=>{
        addMovement({type:'TRANSFER',sku,quantity:q,from,to,employee,reference:form.reference.value.trim(),note:form.note.value.trim()});navigate('transfer');showToast('โอน Stock เรียบร้อยแล้ว');
      });
    });update();
  }

  function renderSale(el){ el.innerHTML=operationLayout('ขายออก','ตัด Stock จากช่องทางขายแบบ Manual ใน V1 — ยังไม่เชื่อม API Marketplace',`${productSearchField()}<div class="form-grid"><div class="field"><label>Platform *</label><select class="select" name="platform" required>${Object.entries(SALE_LOCATIONS).map(([k,v])=>`<option value="${k}" ${k==='facebook'?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>จำนวน *</label><input class="input" name="quantity" type="number" min="1" step="1" required placeholder="เช่น 1"/></div></div>${employeeField()}<div class="form-grid"><div class="field"><label>Order Reference (ถ้ามี)</label><input class="input" name="reference" placeholder="เช่น FB-24003 / เลขออเดอร์"/></div><div class="field"><label>หมายเหตุ</label><input class="input" name="note" placeholder="เช่น ขายหน้าร้าน"/></div></div><div style="margin-top:16px"><button class="btn btn-primary btn-block">ตรวจสอบและยืนยันการขายออก</button></div>`); bindSale(); }
  function bindSale(){
    const form=document.getElementById('operation-form'),preview=document.getElementById('operation-preview');
    bindProductPicker(form);
    const update=()=>{
      const selected=resolveProductValue(form.sku.value),sku=selected?.sku||form.sku.value,platform=form.platform.value,q=Number(form.quantity.value||0),p=selected,st=stockForSku(sku),source=platform==='storefront'||platform==='other'?'central':platform;
      if(p&&q>0){
        preview.innerHTML='<h2 class="section-title">สรุปก่อนบันทึก</h2><div class="confirm-box">'
          +'<div class="confirm-row"><span>สินค้า</span><strong>'+escapeHtml(p.name)+' '+escapeHtml(p.color)+' '+escapeHtml(p.size)+'</strong></div>'
          +'<div class="confirm-row"><span>Platform</span><strong>'+locationLabel(platform)+'</strong></div>'
          +'<div class="confirm-row"><span>ตัดจาก Stock</span><strong>'+locationLabel(source)+'</strong></div>'
          +'<div class="confirm-row"><span>จำนวน</span><strong>'+fmt.format(q)+' ตัว</strong></div>'
          +(q>st[source]?'<div class="danger-box" style="margin-top:10px">Stock ที่จะตัดไม่เพียงพอ</div>':'<div class="success-box" style="margin-top:10px">Stock หลังขายออก: '+fmt.format(st[source]-q)+' ตัว</div>')
          +'</div>';
      } else preview.innerHTML='<h2 class="section-title">สรุปก่อนบันทึก</h2><div class="info-box">เลือกสินค้า Platform และจำนวน</div>';
    };
    form.addEventListener('input',update);form.addEventListener('change',update);
    form.addEventListener('submit',e=>{
      e.preventDefault();const selected=resolveProductValue(form.sku.value),sku=selected?.sku||form.sku.value,platform=form.platform.value,q=Number(form.quantity.value),employee=form.employee.value,source=platform==='storefront'||platform==='other'?'central':platform,s=stockForSku(sku);
      if(!selected||!validateQty(q)||!SALE_LOCATIONS[platform]||q>s[source]){showToast(q>s[source]?'Stock ไม่เพียงพอสำหรับการขายออก':'กรุณาตรวจสอบข้อมูล','error');return;}
      const p=getProduct(sku);confirmAction('ขายออก '+p.name+' '+p.color+' '+p.size+' จำนวน '+q+' ตัว\nPlatform: '+SALE_LOCATIONS[platform]+((platform==='storefront'||platform==='other')?' (ตัดจากหน้าร้าน)':''),()=>{
        addMovement({type:'SALE',sku,quantity:q,from:source,to:'Customer',employee,reference:form.reference.value.trim(),note:(form.note.value.trim()?SALE_LOCATIONS[platform]+': '+form.note.value.trim():SALE_LOCATIONS[platform])});navigate('sale');showToast('บันทึกขายออกเรียบร้อยแล้ว');
      });
    });update();
  }

  function renderAdjustment(el){ el.innerHTML=operationLayout('ปรับ Stock','ใช้สำหรับของเสีย ของหาย นับผิด เจอของ หรือแก้ไข Stock เท่านั้น ทุกครั้งต้องมีเหตุผล',`${productSearchField()}<div class="form-grid"><div class="field"><label>Location *</label><select class="select" name="location" required>${Object.entries(LOCATIONS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div class="field"><label>จำนวนปรับ *</label><input class="input" name="quantity" type="number" step="1" required placeholder="เช่น -1 หรือ 2"/><small>ใช้ + เมื่อต้องการเพิ่ม, - เมื่อต้องการลด</small></div></div><div class="field"><label>เหตุผล *</label><select class="select" name="reason" required><option value="">เลือกเหตุผล</option><option>สินค้าเสียหาย</option><option>สินค้าหาย</option><option>นับ Stock ผิด</option><option>พบ Stock เพิ่ม</option><option>แก้ไข Stock</option><option>อื่นๆ</option></select></div>${employeeField()}<div class="form-grid"><div class="field"><label>Reference</label><input class="input" name="reference" placeholder="เช่น ADJ-001"/></div><div class="field"><label>หมายเหตุ</label><input class="input" name="note" placeholder="รายละเอียดเพิ่มเติม"/></div></div><div style="margin-top:16px"><button class="btn btn-primary btn-block">ตรวจสอบและยืนยันการปรับ Stock</button></div>`); bindAdjustment(); }
  function bindAdjustment(){
    const form=document.getElementById('operation-form'),preview=document.getElementById('operation-preview');
    bindProductPicker(form);
    const update=()=>{
      const selected=resolveProductValue(form.sku.value),sku=selected?.sku||form.sku.value,loc=form.location.value,q=Number(form.quantity.value||0),p=selected,st=stockForSku(sku);
      if(p&&q!==0){
        preview.innerHTML='<h2 class="section-title">สรุปก่อนบันทึก</h2><div class="confirm-box">'
          +'<div class="confirm-row"><span>สินค้า</span><strong>'+escapeHtml(p.name)+' '+escapeHtml(p.color)+' '+escapeHtml(p.size)+'</strong></div>'
          +'<div class="confirm-row"><span>Location</span><strong>'+locationLabel(loc)+'</strong></div>'
          +'<div class="confirm-row"><span>ปรับ</span><strong class="'+(q>0?'movement-positive':'movement-negative')+'">'+(q>0?'+':'')+fmt.format(q)+' ตัว</strong></div>'
          +'<div class="confirm-row"><span>Stock ก่อน → หลัง</span><strong>'+fmt.format(st[loc])+' → '+fmt.format(st[loc]+q)+'</strong></div>'
          +(st[loc]+q<0?'<div class="danger-box" style="margin-top:10px">ปรับแล้ว Stock จะติดลบ — ไม่สามารถบันทึก</div>':'')
          +'</div>';
      } else preview.innerHTML='<h2 class="section-title">สรุปก่อนบันทึก</h2><div class="info-box">เลือกสินค้า Location และจำนวนปรับ</div>';
    };
    form.addEventListener('input',update);form.addEventListener('change',update);
    form.addEventListener('submit',e=>{
      e.preventDefault();const selected=resolveProductValue(form.sku.value),sku=selected?.sku||form.sku.value,loc=form.location.value,q=Number(form.quantity.value),employee=form.employee.value,reason=form.reason.value,st=stockForSku(sku);
      if(!getProduct(sku)||!LOCATIONS[loc]||!Number.isInteger(q)||q===0||!reason||st[loc]+q<0){showToast(st[loc]+q<0?'ปรับแล้ว Stock จะติดลบ ไม่สามารถทำรายการได้':'กรุณากรอกข้อมูลให้ครบ','error');return;}
      const p=getProduct(sku);confirmAction('ปรับ Stock '+p.name+' '+p.color+' '+p.size+'\n'+locationLabel(loc)+': '+(q>0?'+':'')+q+' ตัว\nเหตุผล: '+reason,()=>{
        addMovement({type:'ADJUSTMENT',sku,quantity:q,from:q<0?loc:'Adjustment',to:q>0?loc:'Adjustment',employee,reference:form.reference.value.trim(),note:reason+(form.note.value.trim()?' — '+form.note.value.trim():'')});navigate('adjustment');showToast('ปรับ Stock เรียบร้อยแล้ว');
      });
    });update();
  }

  function renderHistory(el){
    const typeFilter=window.historyType||'',employeeFilter=window.historyEmployee||'',locationFilter=window.historyLocation||''; const q=searchTerm.toLowerCase(); const list=[...state.movements].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).filter(m=>{const p=getProduct(m.sku);const text=[m.sku,p?.saleCode||'',p?.name||'',m.employee,m.reference,m.note].join(' ').toLowerCase();return (!q||text.includes(q))&&(!typeFilter||m.type===typeFilter)&&(!employeeFilter||m.employee===employeeFilter)&&(!locationFilter||m.from===locationFilter||m.to===locationFilter);});
    el.innerHTML=`${pageHead('ประวัติ Stock Movement','ทุกการเปลี่ยนแปลง Stock ต้องมีรายการบันทึกและพนักงานกำกับ','')}
      <div class="card"><div class="toolbar"><input class="input search" id="history-search" value="${escapeHtml(searchTerm)}" placeholder="ค้นหา SKU / สินค้า / Reference / พนักงาน"/><select class="select" id="history-type" style="max-width:180px"><option value="">ทุกประเภท</option>${Object.keys(MOVEMENT_TYPES).map(k=>`<option value="${k}" ${typeFilter===k?'selected':''}>${MOVEMENT_TYPES[k]}</option>`).join('')}</select><select class="select" id="history-loc" style="max-width:180px"><option value="">ทุก Location</option>${Object.entries(LOCATIONS).map(([k,v])=>`<option value="${k}" ${locationFilter===k?'selected':''}>${v}</option>`).join('')}</select><select class="select" id="history-employee" style="max-width:160px"><option value="">ทุกพนักงาน</option>${EMPLOYEES.map(e=>`<option ${employeeFilter===e?'selected':''}>${e}</option>`).join('')}</select></div><div class="table-wrap"><table class="table" style="min-width:1050px"><thead><tr><th>วัน/เวลา</th><th>ประเภท</th><th>รหัส Vrich / SKU</th><th>สินค้า</th><th>จำนวน</th><th>จาก</th><th>ไปยัง</th><th>พนักงาน</th><th>Reference</th><th>หมายเหตุ</th></tr></thead><tbody>${list.length?list.map(m=>{const p=getProduct(m.sku);return `<tr><td>${fmtDate(m.createdAt)}</td><td>${movementBadge(m.type)}</td><td class="sku">${escapeHtml(m.sku)}</td><td>${escapeHtml(p?.name||'ไม่พบสินค้า')}</td><td class="${m.type==='ADJUSTMENT'?m.quantity>0?'movement-positive':'movement-negative':m.type==='RECEIVE'?'movement-positive':'movement-negative'}">${m.type==='TRANSFER'||m.type==='SALE'?'-':''}${m.type==='ADJUSTMENT'?(m.quantity>0?'+':''):''}${fmt.format(Math.abs(m.quantity))}</td><td>${escapeHtml(locationLabel(m.from))}</td><td>${escapeHtml(locationLabel(m.to))}</td><td>${escapeHtml(m.employee)}</td><td>${escapeHtml(m.reference||'—')}</td><td>${escapeHtml(m.note||'—')}</td></tr>`}).join(''):`<tr><td colspan="10"><div class="empty">ไม่พบประวัติ</div></td></tr>`}</tbody></table></div></div>`;
    bindLiveSearch('history-search',renderHistory); document.getElementById('history-type').addEventListener('change',e=>{window.historyType=e.target.value;renderHistory(document.getElementById('page-content'));}); document.getElementById('history-loc').addEventListener('change',e=>{window.historyLocation=e.target.value;renderHistory(document.getElementById('page-content'));}); document.getElementById('history-employee').addEventListener('change',e=>{window.historyEmployee=e.target.value;renderHistory(document.getElementById('page-content'));});
  }

  function renderImport(el){
    el.innerHTML=`${pageHead('Import XLSX (CEO)','นำเข้าไฟล์ Excel (สำหรับ CEO ในเวอร์ชันถัดไป) เพื่อแทนรายการสินค้าและยอดตั้งต้นในระบบ Beta — ตอนนี้ยังไม่มีระบบล็อกอินจำกัดสิทธิ์ CEO','')}
      <div class="grid cards-2">
        <div class="card">
          <h2 class="section-title">นำเข้าไฟล์ Excel (สำหรับ CEO ในเวอร์ชันถัดไป)</h2>
          <div class="info-box">ระบบจะอ่าน SKU และจำนวน Stock จากไฟล์ Excel แล้วตั้งยอดทั้งหมดไว้ที่ หน้าร้าน เท่านั้น Platform อื่นจะเริ่มที่ 0</div>
          <div class="field" style="margin-top:14px"><label>เลือกไฟล์ .xlsx *</label><input class="input" id="import-xlsx-file" type="file" accept=".xlsx,.xls" /></div>
          <div class="form-grid" style="margin-top:12px"><div class="field"><label>ชื่อคอลัมน์ SKU</label><input class="input" id="import-sku-column" value="รหัสสต็อก" placeholder="เช่น รหัสสต็อก / SKU" /></div><div class="field"><label>ชื่อคอลัมน์ Stock</label><input class="input" id="import-stock-column" value="จำนวน" placeholder="เช่น จำนวน / Stock" /></div></div>
          <div style="margin-top:16px"><button class="btn btn-primary btn-block" id="import-preview-btn">ตรวจสอบไฟล์</button></div>
        </div>
        <div class="card" id="import-preview"><h2 class="section-title">ตัวอย่างก่อน Import</h2><div class="info-box">เลือกไฟล์ แล้วกด “ตรวจสอบไฟล์” ระบบจะแสดงจำนวน SKU และ Stock ก่อนบันทึก</div></div>
      </div>`;
    let pending=null;
    const fileInput=document.getElementById('import-xlsx-file'), preview=document.getElementById('import-preview');
    document.getElementById('import-preview-btn').addEventListener('click',async()=>{
      const file=fileInput.files?.[0]; if(!file){showToast('กรุณาเลือกไฟล์ .xlsx ก่อน','error');return;}
      if(typeof XLSX==='undefined'){showToast('ไม่พบตัวอ่าน Excel กรุณาเปิดเครื่องที่มีอินเทอร์เน็ตแล้วลองใหม่','error');return;}
      try{
        const data=await file.arrayBuffer(); const wb=XLSX.read(data,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; let rows=XLSX.utils.sheet_to_json(ws,{defval:''});
        // Support the shop's multi-category layout: repeated code/name/quantity/price blocks across every sheet.
        const firstGrid=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        if(firstGrid[0]?.[0]==='รหัส' && firstGrid[0]?.[1]==='ชื่อสินค้า' && firstGrid[0]?.[2]==='จำนวน'){
          rows=[]; const seenCodes={}; const priceSet=[250,350,390,420,450];
          const isCode=v=>typeof v==='string' && /^[A-Za-zก-๙]+[0-9]+(?:[A-Za-zก-๙]+| [A-Za-zก-๙]+)?$|^[0-9]+[A-Za-zก-๙]+$/.test(v.trim()) && v.trim().length<=12;
          wb.SheetNames.forEach(sheetName=>{
            const grid=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:''});
            for(let ri=1;ri<grid.length;ri++){
              const cells=grid[ri]||[]; let ci=0;
              while(ci<cells.length){
                if(isCode(cells[ci])){
                  const code=String(cells[ci]).trim(); let ni=ci+1;
                  while(ni<cells.length && (cells[ni]===''||cells[ni]===null))ni++;
                  if(ni<cells.length && typeof cells[ni]==='string' && cells[ni].trim() && !isCode(cells[ni]) && !['หมด','ไม่ลงตต.','ค้าง Stock','ยังไม่ได้นับ','ของกระจายมาก'].includes(cells[ni].trim())){
                    const name=String(cells[ni]).trim(); let k=ni+1, nums=[];
                    while(k<cells.length && !isCode(cells[k])){if(typeof cells[k]==='number' && Number.isFinite(cells[k]))nums.push(cells[k]);k++;}
                    let qty=0, price=0;
                    if(nums.length){
                      if(priceSet.includes(nums[0]) && (nums.length===1 || (k<cells.length && isCode(cells[k])))){qty=0;price=nums[0];}
                      else {qty=Number.isInteger(nums[0])&&nums[0]>=0?nums[0]:0;price=nums.slice(1).find(n=>priceSet.includes(n))|| (priceSet.includes(nums[0])?nums[0]:0);}
                    }
                    const groupStart=[1,8,15,22].filter(s=>s<=ci+1).pop()||1;
                    const cat=String(grid[0]?.[Math.min(groupStart+3,grid[0].length-1)]||sheetName).replace(/\n/g,' ').trim()||sheetName;
                    seenCodes[code]=(seenCodes[code]||0)+1;
                    rows.push({SKU:`BETA-${code}${seenCodes[code]>1?'-'+seenCodes[code]:''}`,จำนวน:qty,ชื่อสินค้า:name,ราคา:price,กลุ่มสินค้า:cat,'รหัสขาย':code});
                    ci=k;
                  }else ci++;
                }else ci++;
              }
            }
          });
        }
        if(!rows.length) throw new Error('ไม่พบข้อมูลใน Sheet แรก');
        const headers=Object.keys(rows[0]);
        const findHeader=(typed,candidates)=>{ const t=String(typed||'').trim().toLowerCase(); const direct=t && headers.find(h=>String(h).trim().toLowerCase()===t); if(direct) return direct; return candidates.find(c=>headers.some(h=>String(h).trim().toLowerCase()===c.toLowerCase())) || ''; };
        const skuCol=findHeader(document.getElementById('import-sku-column').value,['SKU','รหัสสต็อก','รหัสสินค้า','Stock Code']);
        const stockCol=findHeader(document.getElementById('import-stock-column').value,['Stock','จำนวน','จำนวนคงเหลือ','คงเหลือ']);
        if(!skuCol) throw new Error('หา Column SKU ไม่เจอ (ลองใช้ รหัสสต็อก หรือ SKU)');
        if(!stockCol) throw new Error('หา Column Stock ไม่เจอ (ลองใช้ จำนวน หรือ Stock)');
        const col=(names)=>names.find(c=>headers.some(h=>String(h).trim().toLowerCase()===c.toLowerCase()))||'';
        const saleCol=col(['รหัสขาย','Sale Code']); const nameCol=col(['รายละเอียด','สินค้า','ชื่อสินค้า','Product Name']); const unitCol=col(['หน่วย','Unit']); const priceCol=col(['ราคา','ราคาขาย','Selling Price']); const costCol=col(['ต้นทุน','Cost']); const categoryCol=col(['กลุ่มสินค้า','หมวดหมู่','Category']); const colorCol=col(['สี','Color']); const sizeCol=col(['ไซส์','ไซซ์','Size']); const typeCol=col(['ประเภทสินค้า','Type']); const weightCol=col(['น้ำหนัก (กรัม)','น้ำหนัก','Weight']);
        const normalized=[]; const stockRows=[]; const seen=new Set(); let total=0;
        for(const row of rows){
          const sku=String(row[skuCol]??'').trim(); const qty=Number(String(row[stockCol]??'').replace(/,/g,''));
          if(!sku) continue; if(seen.has(sku)) throw new Error('พบ SKU ซ้ำในไฟล์: '+sku); seen.add(sku);
          if(!Number.isFinite(qty)||qty<0||!Number.isInteger(qty)) throw new Error('Stock ของ SKU '+sku+' ต้องเป็นจำนวนเต็ม 0 ขึ้นไป');
          const existing=state.products.find(p=>p.sku===sku);
          normalized.push({id:existing?.id||sku,sku,name:String(row[nameCol]??existing?.name??sku).trim()||sku,category:String(row[categoryCol]??existing?.category??'').trim(),color:String(row[colorCol]??existing?.color??'').trim(),size:String(row[sizeCol]??existing?.size??'').trim(),cost:Number(row[costCol]??existing?.cost??0)||0,price:Number(row[priceCol]??existing?.price??0)||0,threshold:Number(existing?.threshold??3),active:true,barcode:existing?.barcode||'',image:existing?.image||'',unit:String(row[unitCol]??existing?.unit??'ชิ้น').trim()||'ชิ้น',saleCode:String(row[saleCol]??existing?.saleCode??'').trim(),sourceType:String(row[typeCol]??existing?.sourceType??'').trim(),weightGrams:Number(row[weightCol]??existing?.weightGrams??0)||0});
          stockRows.push({sku,quantity:qty}); total+=qty;
        }
        if(!normalized.length) throw new Error('ไม่พบข้อมูล SKU ในไฟล์');
        pending={fileName:file.name,products:normalized,stockRows:rows.map(row=>({sku:String(row[skuCol]??'').trim(),quantity:Number(String(row[stockCol]??'').replace(/,/g,''))})).filter(x=>x.sku),total};
        preview.innerHTML=`<h2 class="section-title">ตรวจสอบก่อน Import</h2><div class="mini-grid"><div class="mini-stock"><div class="label">SKU</div><div class="value">${fmt.format(normalized.length)}</div></div><div class="mini-stock"><div class="label">Stock รวม</div><div class="value">${fmt.format(total)} ตัว</div></div></div><div class="confirm-box" style="margin-top:12px"><div class="confirm-row"><span>ไฟล์</span><strong>${escapeHtml(file.name)}</strong></div><div class="confirm-row"><span>ปลายทาง</span><strong>หน้าร้าน</strong></div><div class="confirm-row"><span>Platform</span><strong>เริ่มต้น 0 ทุก Platform</strong></div></div><div class="danger-box" style="margin-top:12px">การ Import จะเขียนทับ Stock หลักใน Browser นี้ และล้าง Movement เดิมออกจากระบบนี้ ควร Export Backup ก่อน Import</div><button class="btn btn-primary btn-block" id="confirm-import" style="margin-top:12px">ยืนยัน Import ไฟล์นี้</button>`;
        document.getElementById('confirm-import').onclick=()=>confirmAction('Import '+normalized.length+' SKU / '+total+' ตัว จากไฟล์ '+file.name+'\nยอดทั้งหมดจะเริ่มที่ หน้าร้าน และ Platform อื่นเป็น 0',()=>applyImportedStock(pending));
      }catch(err){pending=null;preview.innerHTML='<div class="danger-box">'+escapeHtml(err.message||'อ่านไฟล์ไม่สำเร็จ')+'</div>';}
    });
  }
  function applyImportedStock(payload){
    const products=payload.products.map((p,i)=>({...p,id:'import-'+Date.now()+'-'+i}));
    const nowIso=new Date().toISOString();
    const movements=payload.stockRows.filter(x=>x.quantity>0).map((x,i)=>({id:'import-receive-'+Date.now()+'-'+i,type:'RECEIVE',sku:x.sku,quantity:x.quantity,from:'Supplier',to:'central',employee:state.employee||'Import',reference:'IMPORT-'+new Date().toISOString().slice(0,10),note:'ยอด Stock ตั้งต้นจาก '+payload.fileName,createdAt:nowIso}));
    state={products,movements,employee:state.employee||'Boom',initializedAt:nowIso,importSource:payload.fileName,importMode:'MASTER_STOCK'};
    saveState(state); searchTerm=''; render(); showToast('Import XLSX (CEO)เรียบร้อยแล้ว '+fmt.format(products.length)+' SKU / '+fmt.format(payload.total)+' ตัว');
  }

  function validateQty(q){return Number.isInteger(q)&&q>0;}
  function addMovement(m){ state.movements.push({id:crypto.randomUUID(),createdAt:new Date().toISOString(),...m}); saveState(state); }
  function confirmAction(message,onConfirm){ const modal=document.createElement('div');modal.className='modal-backdrop';modal.innerHTML=`<div class="modal"><div class="modal-head"><h2>ยืนยันรายการ</h2><button class="close" id="close">×</button></div><div class="modal-body"><div class="confirm-box" style="white-space:pre-line">${escapeHtml(message)}</div><div class="danger-box" style="margin-top:12px">เมื่อกดยืนยัน ระบบจะบันทึก Movement History และเปลี่ยน Stock ทันที</div></div><div class="modal-foot"><button class="btn" id="cancel">ยกเลิก</button><button class="btn btn-primary" id="confirm">ยืนยัน</button></div></div>`;document.body.appendChild(modal);const close=()=>modal.remove();modal.querySelector('#close').onclick=close;modal.querySelector('#cancel').onclick=close;modal.querySelector('#confirm').onclick=()=>{close();onConfirm();};}
  function openProductDetail(sku){const p=getProduct(sku);if(!p)return;const s=stockForSku(sku);const total=stockTotal(sku);const suggestions=[];Object.entries(s).forEach(([loc,q])=>{if(q<=p.threshold)suggestions.push({loc,q});});const modal=document.createElement('div');modal.className='modal-backdrop';modal.innerHTML=`<div class="modal"><div class="modal-head"><div><h2>${escapeHtml(p.name)}</h2><div class="muted" style="font-size:12px">${escapeHtml(p.sku)} · ${escapeHtml(p.color)} · ${escapeHtml(p.size)}</div></div><button class="close" id="close">×</button></div><div class="modal-body"><div class="mini-grid">${Object.entries(LOCATION_LABELS).map(([k,v])=>`<div class="mini-stock"><div class="label">${v}</div><div class="value">${fmt.format(s[k])} ตัว</div>${statusBadge(p,s[k])}</div>`).join('')}</div><div class="confirm-box"><div class="confirm-row"><span>Total Stock</span><strong>${fmt.format(total)} ตัว</strong></div><div class="confirm-row"><span>Threshold</span><strong>${fmt.format(p.threshold)} ตัว / Location</strong></div></div>${suggestions.length?`<div class="info-box" style="margin-top:12px">${suggestions.map(x=>x.q===0?`🔴 ${LOCATION_LABELS[x.loc]} หมด`:`⚠️ ${LOCATION_LABELS[x.loc]} เหลือ ${x.q} ตัว`).join(' · ')}${s.central>0&&s.facebook===0?' · สามารถโอนจากหน้าร้านได้ '+s.central+' ตัว':''}</div>`:'<div class="success-box" style="margin-top:12px">Stock ทุก Location อยู่เหนือ Threshold</div>'}<div style="margin-top:14px"><button class="btn btn-primary btn-block" id="quick-transfer">โอน Stock สินค้านี้</button></div></div></div>`;document.body.appendChild(modal);const close=()=>modal.remove();modal.querySelector('#close').onclick=close;modal.querySelector('#quick-transfer').onclick=()=>{close();navigate('transfer');setTimeout(()=>{const sel=document.querySelector('#operation-form input[name="sku"]');if(sel){sel.value=sku;sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));}},0);};}

  function csvCell(v){
    const value = v === null || v === undefined ? '' : String(v);
    return '"' + value.replace(/"/g,'""') + '"';
  }
  function downloadBlob(content, filename, mime='text/csv;charset=utf-8'){
    const blob = new Blob([content], {type:mime});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportStockCsv(){
    const headers=['SKU','รหัสขาย','สินค้า','หมวดหมู่','สี','ไซซ์','ต้นทุน','ราคาขาย','หน้าร้าน','Facebook Page','TikTok Shop','Shopee','Total Stock','สถานะ'];
    const rows=activeProducts().map(p=>{const s=stockForSku(p.sku);const total=stockTotal(p.sku);const status=total===0?'หมด':Object.values(s).some(q=>q===0)?'มีจุดหมด':Object.entries(s).some(([k,q])=>q>0&&q<=2)?'Stock ต่ำ':'ปกติ';return [p.sku,p.saleCode||'',p.name,p.category,p.color,p.size,p.cost,p.price,s.central,s.facebook,s.tiktok,s.shopee,total,status];});
    downloadBlob('\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'),'stock-current.csv');
    showToast('Export Stock ปัจจุบันแล้ว');
  }
  function exportProductsCsv(){
    const headers=['SKU','รหัสขาย','สินค้า','หมวดหมู่','สี','ไซซ์','ต้นทุน','ราคาขาย','Threshold','หน่วย','Active'];
    const rows=state.products.map(p=>[p.sku,p.saleCode||'',p.name,p.category,p.color,p.size,p.cost,p.price,p.threshold,p.unit||'',p.active?'ใช้งาน':'ปิดใช้งาน']);
    downloadBlob('\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'),'products.csv');
    showToast('Export รายการสินค้าแล้ว');
  }
  function exportMovementsCsv(){
    const headers=['Date/Time','Type','SKU','Product','Quantity','From','To','Employee','Reference','Note'];
    const rows=[...state.movements].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).map(m=>[m.createdAt,m.type,getProduct(m.sku)?.sku||m.sku,getProduct(m.sku)?.name||'',m.quantity,locationLabel(m.from),locationLabel(m.to),m.employee,m.reference||'',m.note||'']);
    downloadBlob('\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'),'stock-movement-history.csv');
    showToast('Export Movement History แล้ว');
  }
  function exportBackupJson(){
    downloadBlob(JSON.stringify(state,null,2),'stockflow-backup.json','application/json;charset=utf-8');
    showToast('Export Backup แล้ว');
  }
  function openExportModal(){
    const modal=document.createElement('div'); modal.className='modal-backdrop';
    modal.innerHTML=`<div class="modal"><div class="modal-head"><div><h2>Export ข้อมูล</h2><div class="muted" style="font-size:12px">ข้อมูลจริงจาก Stock หลักและ Movement ปัจจุบัน</div></div><button class="close" id="close">×</button></div>
      <div class="modal-body"><div class="grid cards-2">
        <button class="card export-card" id="export-stock"><strong>📦 Stock ปัจจุบัน</strong><span>SKU + Stock หน้าร้าน / Platform + Total</span><small>CSV เปิดด้วย Excel ได้</small></button>
        <button class="card export-card" id="export-products"><strong>🧾 รายการสินค้า</strong><span>ข้อมูล SKU, ราคา, ต้นทุน, หมวดหมู่</span><small>CSV เปิดด้วย Excel ได้</small></button>
        <button class="card export-card" id="export-movements"><strong>📋 Movement History</strong><span>ประวัติรับ / โอน / ขาย / ปรับ Stock</span><small>CSV เปิดด้วย Excel ได้</small></button>
        <button class="card export-card" id="export-json"><strong>💾 Backup ทั้งระบบ</strong><span>เก็บข้อมูลสำหรับย้ายเครื่องหรือสำรองข้อมูล</span><small>JSON</small></button>
      </div></div></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.remove(); modal.querySelector('#close').onclick=close;
    [['export-stock',exportStockCsv],['export-products',exportProductsCsv],['export-movements',exportMovementsCsv],['export-json',exportBackupJson]].forEach(([id,fn])=>modal.querySelector('#'+id).onclick=()=>{fn();close();});
  }

  // Lightweight client-side self-checks for the core inventory invariants.
  function selfCheck(){ for(const p of state.products){ const s=stockForSku(p.sku); if(Object.values(s).some(v=>v<0)){ console.error('Invalid negative stock',p.sku,s); } if(Object.values(s).reduce((a,b)=>a+b,0)<0){ console.error('Invalid total stock',p.sku); } } }
  window.StockFlow = { getState:()=>state, resetDemo:()=>{state=makeInitialState();saveState(state);render();}, exportData:()=>JSON.stringify(state,null,2) };
  selfCheck(); render();
})();
