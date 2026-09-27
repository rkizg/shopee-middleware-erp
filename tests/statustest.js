/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';

const fs=require('fs'), vm=require('vm');

class FakeEl{
  constructor(id){this.id=id;this._a={};this._h='';this._t='';this._v='';this.hidden=false;this.style={};this.dataset={};this._c=new Set();this._opts=null;const s=this;
    this.classList={add:c=>s._c.add(c),remove:c=>s._c.delete(c),contains:c=>s._c.has(c),toggle:(c,o)=>{o?s._c.add(c):s._c.delete(c);}};}
  get className(){return Array.from(this._c).join(' ');} set className(v){this._c=new Set(String(v).split(/\s+/).filter(Boolean));}
  get innerHTML(){return this._h;} set innerHTML(v){this._h=String(v); if(this.id==='filter-status'){this._opts=[{value:'ALL',innerText:'Semua status'}];this.options=this._opts;}}
  get innerText(){return this._t;} set innerText(v){this._t=String(v);}
  get value(){return this._v;} set value(v){this._v=String(v);}
  setAttribute(k,v){this._a[k]=String(v);} getAttribute(k){return this._a[k]===undefined?null:this._a[k];}
  appendChild(c){ if(c&&c._tag==='option'&&this.id==='filter-status'){ if(!this._opts)this._opts=[{value:'ALL',innerText:'Semua status'}]; this._opts.push(c); this.options=this._opts; } return c;}
  removeChild(){} querySelector(){return new FakeEl('x');} querySelectorAll(){return [];} focus(){} select(){}
}
const reg=new Map();
const el=id=>{if(!reg.has(id))reg.set(id,new FakeEl(id));return reg.get(id);};
el('order-search').value=''; el('sort-orders').value='NEWEST'; el('items-per-page').value='25'; el('filter-courier').value='ALL';
const document={documentElement:new FakeEl('html'),body:new FakeEl('body'),head:new FakeEl('head'),
  getElementById:el,createElement:t=>{const e=new FakeEl('x');e._tag=t;return e;},addEventListener(){}};
// isi awal #filter-status seperti markup: sebuah select dengan opsi ALL
el('filter-status').innerHTML='<option value="ALL">Semua status</option>';
el('filter-status').value='ALL'; el('filter-status').value='ALL';

let SERVER={}, GAGAL=false;
function makeRun(){let ok=null,fail=null;
  const base={withSuccessHandler(f){ok=f;return px;},withFailureHandler(f){fail=f;return px;}};
  const px=new Proxy(base,{get(t,p){if(p in t)return t[p];
    return (...a)=>{ var baru = (p==='getStatusInventory'||p==='getOrderRowsByStatus');
      if(GAGAL && baru){ if(fail) fail(new Error('Script function not found: '+String(p))); return; }
      try{const r=SERVER[p]?SERVER[p](...a):{};if(ok)ok(r);}catch(e){if(fail)fail(e);} };}});
  return px;}
const sandbox={document,console,google:{script:{run:makeRun()}},
  setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
  navigator:{},localStorage:{getItem:()=>null,setItem:()=>{}},Blob:class{},URL:{createObjectURL:()=>'b',revokeObjectURL:()=>{}},
  alert:()=>{},prompt:()=>null};
sandbox.window=sandbox; sandbox.window.matchMedia=()=>({matches:false}); sandbox.window.addEventListener=()=>{}; sandbox.window.isSecureContext=true;
sandbox.window.jspdf={jsPDF:class{constructor(){this.pages=1;}addPage(){}setFontSize(){}setFont(){}setTextColor(){}setDrawColor(){}setLineWidth(){}text(){}line(){}rect(){}getTextWidth(){return 1;}splitTextToSize(t){return [String(t)];}save(){}output(){return 'b';}}};
const html=fs.readFileSync(AKAR + 'gas/Index.html','utf8');
vm.createContext(sandbox);
vm.runInContext(html.split('<script>')[1].split('</script>')[0]+'\nglobalThis.__api={loadDashboard,filterOrdersTable,filterByQuickCard,getState:()=>({filtered:currentFilteredOrders.length,gagal:rpcStatusGagal,inv:statusInventaris.length}),setFilter:v=>{document.getElementById("filter-status").value=v;},opsi:()=>document.getElementById("filter-status").options};',sandbox);
const A=sandbox.__api;

const mk=(i,st)=>({orderSn:'SN'+i,date:'x',shopeeStatus:'X',internalStatus:st,buyer:'P'+i,items:'I'+i,sku:'S'+i,variation:'M',qty:1,totalAmount:10000,shippingFee:0,courier:'SPX Express',resi:'R'+i,city:'Kota',note:''});
const terbaru=Array.from({length:80},(_,i)=>mk(500+i,'[4] Selesai'));
const antrian=Array.from({length:23},(_,i)=>mk(i,'[1] Siap Packing'));
const pickup=Array.from({length:5},(_,i)=>mk(200+i,'[2] Menunggu Pickup'));
const inventaris=[{status:'[4] Selesai',jumlah:80},{status:'[1] Siap Packing',jumlah:23},{status:'[2] Menunggu Pickup',jumlah:5},{status:'(kolom D kosong)',jumlah:2}];
SERVER={
  getDashboardData:()=>({stats:{totalOrders:110,ordersToday:1,siapPacking:23,menungguPickup:5,sedangDikirim:0,selesai:80,totalRevenue:1000},
    token:{hasToken:true,isExpired:false,statusText:'AKTIF',shopId:'1',expiredAtWIB:'x'},isTriggerActive:true,config:{},courierStats:{'SPX Express':110},topSkus:[],
    orders:terbaru,logs:[],statusOptions:[],webAppUrl:'u'}),
  getStatusInventory:()=>inventaris,
  getOrderRowsByStatus:(k,l)=>{ if(k==='[1] Siap Packing') return antrian.slice(0,l); if(k==='[2] Menunggu Pickup') return pickup.slice(0,l); if(k==='[4] Selesai') return terbaru.slice(0,l); return []; }
};

function label(){console.log('\n'+'='.repeat(64));}

/* Berkas ini sebelumnya hanya mencetak pengamatan. Sekarang pengamatannya juga
   diperiksa, supaya perubahan pada halaman yang merusaknya berhenti di sini. */
let gagal=0;
const cek=(label,ok,nilai)=>{console.log((ok?'  OK   ':'  GAGAL ')+label+(nilai!==undefined?'  -> '+nilai:''));if(!ok)gagal++;};

label(); console.log('KASUS A: server SUDAH memuat fungsi baru');
GAGAL=false; A.loadDashboard(false);
const opsi=A.opsi().map(o=>String(o.innerText||o.value)).join(' | ');
console.log('1. opsi filter dari sheet  :', opsi);
cek('pilihan filter memuat jumlah baris per status', opsi.includes('[1] Siap Packing (23 baris)')&&opsi.includes('(kolom D kosong) (2 baris)'));
console.log('2. catatan server tersembunyi:', el('server-notice').hidden);
cek('catatan server disembunyikan saat fungsinya ada', el('server-notice').hidden===true);

A.setFilter('[1] Siap Packing'); A.filterOrdersTable();
console.log('3. filter [1] Siap Packing :', A.getState().filtered, 'baris | RPC gagal?', A.getState().gagal);
/* Nol di sini benar: payload dashboard hanya memuat 80 baris terbaru, dan semua
   baris Siap Packing berada di luar jendela itu. Yang diperiksa adalah halaman
   tidak mengarang baris dan tidak melaporkan RPC-nya gagal. */
cek('filter hanya menyaring baris yang sudah dimuat', A.getState().filtered===0&&A.getState().gagal===false, A.getState().filtered);
console.log('4. tab count               :', el('tab-count-orders').innerText);
A.setFilter('[2] Menunggu Pickup'); A.filterOrdersTable();
console.log('5. filter [2] Menunggu Pickup:', A.getState().filtered, 'baris');
A.setFilter('ALL'); A.filterOrdersTable();
console.log('6. semua status            :', A.getState().filtered, 'baris (payload)');
cek('pilihan semua status menampilkan seluruh payload', A.getState().filtered===80, A.getState().filtered);
A.filterByQuickCard('[1] Siap Packing');
console.log('7. tombol fokus antrian    :', A.getState().filtered, 'baris | filter =', el('filter-status').value);
cek('tombol fokus antrian memindahkan pilihan filter', el('filter-status').value==='[1] Siap Packing', el('filter-status').value);

label(); console.log('KASUS B: deployment lama, fungsi server belum ada');
GAGAL=false; A.loadDashboard(true); // segarkan cache
GAGAL=true; A.loadDashboard(true);
console.log('1. catatan server muncul   :', !el('server-notice').hidden);
cek('catatan server muncul saat fungsinya belum ada', !el('server-notice').hidden===true);
console.log('2. isi catatan             :', el('server-notice-text').innerText.slice(0,140)+'...');
cek('catatan menyebut nama fungsi yang belum ada', /getStatusInventory/.test(el('server-notice-text').innerText)&&/getOrderRowsByStatus/.test(el('server-notice-text').innerText));
A.setFilter('[1] Siap Packing'); A.filterOrdersTable();
console.log('3. filter [1] Siap Packing :', A.getState().filtered, 'baris | RPC gagal?', A.getState().gagal);
cek('kegagalan RPC dilaporkan apa adanya', A.getState().gagal===true);
const tbody=el('orders-tbody').innerHTML;
const pesan=(tbody.match(/state-note">([^<]*)/)||[])[1]||'';
console.log('4. pesan tabel             :', pesan.slice(0,120)+'...');
console.log('5. pesan menyebut deploi   :', /deployment|versi|Lihat catatan/.test(pesan));
cek('pesan tabel menyebut versi server yang belum lengkap', /deployment|versi|Lihat catatan/.test(pesan));
console.log('6. TIDAK mengklaim ada 80  :', !/Ada 80 pesanan pada status/.test(pesan));
cek('halaman tidak mengklaim jumlah baris untuk status yang tidak dimuat', !/Ada 80 pesanan pada status/.test(pesan));

console.log('');
console.log('HASIL PENYARINGAN STATUS: '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
