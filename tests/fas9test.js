/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';

const fs=require('fs'), vm=require('vm'), crypto=require('crypto');
class MockSheet{
  constructor(n){this.name=n;this.data=[];}
  getLastRow(){let l=0;for(let r=0;r<this.data.length;r++){if((this.data[r]||[]).some(v=>v!==''&&v!=null))l=r+1;}return l;}
  getLastColumn(){let lc=0;this.data.forEach(row=>{for(let c=(row||[]).length;c>0;c--){const v=row[c-1];if(v!==''&&v!=null){if(c>lc)lc=c;break;}}});return lc;}
  _ensure(r,c){while(this.data.length<r)this.data.push([]);for(let i=0;i<r;i++){if(!this.data[i])this.data[i]=[];while(this.data[i].length<c)this.data[i].push('');}}
  getRange(r,c,nr,nc){
    if(typeof r==='string'){const a={getValues:()=>[['']],setValues(){return a;},setValue(){return a;},setNumberFormat(){return a;},setBackground(){return a;},setFontColor(){return a;},setFontWeight(){return a;},setFontSize(){return a;},setHorizontalAlignment(){return a;},setDataValidation(){return a;}};return a;}
    const s=this;const a={
      getValues(){s._ensure(r+nr-1,c+nc-1);const o=[];for(let i=0;i<nr;i++){const w=[];for(let j=0;j<nc;j++)w.push(s.data[r-1+i][c-1+j]);o.push(w);}return o;},
      setValues(v){for(let i=0;i<v.length;i++){s._ensure(r+i,c+v[i].length-1);for(let j=0;j<v[i].length;j++)s.data[r-1+i][c-1+j]=v[i][j];}return a;},
      setValue(v){return a.setValues([[v]]);},
      setNumberFormat(){return a;},setBackground(){return a;},setFontColor(){return a;},setFontWeight(){return a;},setFontSize(){return a;},setHorizontalAlignment(){return a;},setDataValidation(){return a;}};
    return a;}
  getDataRange(){return this.getRange(1,1,Math.max(this.data.length,1),Math.max(this.getLastColumn(),1));}
  appendRow(v){this.data.push(v.slice());}
  insertRowBefore(p){this.data.splice(p-1,0,[]);}
  insertColumnsAfter(a,how){this._ensure(Math.max(this.data.length,1),a+how);for(let i=0;i<this.data.length;i++){const row=this.data[i];for(let k=0;k<how;k++)row.splice(a,0,'');}}
  setFrozenRows(){} autoResizeColumns(){}
}
class MockSS{constructor(){this.sheets={};}getSheetByName(n){return this.sheets[n]||null;}insertSheet(n){this.sheets[n]=new MockSheet(n);return this.sheets[n];}toast(){}}
const ss=new MockSS();
const alerts=[];
let promptJawaban=''; let promptDibatalkan=false; const promptAntrean=[];
let alertPilihan='YES';
const fakeUi={ButtonSet:{OK:'OK',OK_CANCEL:'OK_CANCEL',YES_NO:'YES_NO'},Button:{OK:'OK',YES:'YES',NO:'NO'},alert(t,m){alerts.push({title:t,body:String(m)});return alertPilihan;},prompt(){const isi=promptAntrean.length?promptAntrean.shift():(promptJawaban||'');return {getSelectedButton:()=>promptDibatalkan?'CANCEL':'OK',getResponseText:()=>isi};}};
const tokoCache={};
const cacheService={get(k){return tokoCache[k]===undefined?null:tokoCache[k];},put(k,v){tokoCache[k]=String(v);},remove(k){delete tokoCache[k];}};
let identitasAktif='';
const Utilities={
  formatDate(tgl, zona, format){
    const ms=(tgl instanceof Date)?tgl.getTime():new Date(tgl).getTime();
    const j=new Date(ms+7*3600*1000);
    const p=(n)=>String(n).padStart(2,'0');
    const tgl3=j.getUTCFullYear()+'-'+p(j.getUTCMonth()+1)+'-'+p(j.getUTCDate());
    if(format==='yyyy-MM-dd') return tgl3;
    return tgl3+' '+p(j.getUTCHours())+':'+p(j.getUTCMinutes())+':'+p(j.getUTCSeconds());
  },
  sleep(){},
  getUuid:()=>crypto.randomBytes(16).toString('hex'),
  base64Encode(v){return Buffer.from(typeof v==='string'?Buffer.from(v,'utf8'):Buffer.from(v)).toString('base64');},
  newBlob(v){const b=typeof v==='string'?Buffer.from(v,'utf8'):Buffer.from(v);return {getBytes:()=>Array.from(b)};},
  computeHmacSha256Signature(value,key){
    const vArr=Array.isArray(value), kArr=Array.isArray(key);
    if(vArr!==kArr){
      const nama=v=>Array.isArray(v)?'number[]':(typeof v==='string'?'String':typeof v);
      throw new Error('Parameter ('+nama(value)+','+nama(key)+') tidak cocok dengan tanda tangan metode untuk Utilities.computeHmacSha256Signature.');
    }
    const val=Buffer.from(vArr?value:Buffer.from(value,'utf8'));
    const k=Buffer.from(kArr?key:Buffer.from(key,'utf8'));
    return Array.from(crypto.createHmac('sha256',k).update(val).digest());
  }
};
const ShopeeApi={fetchDailyOrders(){return {data:{orders:[],diagnostics:{}}};}};
const sb={console,SpreadsheetApp:{getActiveSpreadsheet:()=>ss,getUi:()=>fakeUi,newDataValidation:()=>({requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return{};}})},
  Utilities:Utilities,
  Session:{getActiveUser:()=>({getEmail:()=>identitasAktif}),getEffectiveUser:()=>({getEmail:()=>'pemilik@contoh.com'}),getTemporaryActiveUserKey:()=>'kunci-abc'},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})},
  CacheService:{getScriptCache:()=>cacheService},ShopeeApi:ShopeeApi};
sb.globalThis=sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(AKAR + 'gas/SheetManager.js','utf8'),sb,{filename:'SheetManager.js'});
vm.runInContext(fs.readFileSync(AKAR + 'gas/Code.js','utf8'),sb,{filename:'Code.js'});
const SM=sb.SheetManager;
let gagal=0;
const cek=(l,ok,x)=>{console.log((ok?'  OK   ':'  GAGAL ')+l+(x!==undefined?'  -> '+x:''));if(!ok)gagal++;};
const lempar=(fn)=>{try{fn();return null;}catch(e){return e.message;}};
const logSheet=()=>ss.getSheetByName('Log_Aktivitas');
const pngSheet=()=>ss.getSheetByName('Pengguna');

SM.initAllSheets();

/* ==========================================================================
   PEMBATASAN DATA KEUANGAN
   Nominal uang hanya untuk SUPERADMIN, dan dipotong di server, bukan hanya
   disembunyikan di peramban.
   ========================================================================== */
const setWajibLogin_=(nilai)=>{
  const cfg=ss.getSheetByName('Konfigurasi');
  const baris=cfg.data.findIndex(r=>String(r[0]).trim()==='WAJIB_LOGIN');
  cfg.getRange(baris+1,2,1,1).setValues([[nilai]]);
};
setWajibLogin_('YA');

const ord=ss.getSheetByName('Pesanan Masuk');
ord.data.length=1;
ord.appendRow(['SN-K1','2026-09-27 08:00:00','READY_TO_SHIP','[1] Siap Packing','budi','Tas','SKU-1','Hitam',2,150000,12000,'JNE','RESI-1','','Bandung','2026-09-27 08:00:00','BGD1']);
ord.appendRow(['SN-K2','2026-09-27 09:00:00','READY_TO_SHIP','[1] Siap Packing','sari','Sepatu','SKU-2','Merah',1,250000,15000,'SPX','RESI-2','','Bandung','2026-09-27 09:00:00','BGD1']);

SM.simpanPengguna({kode:'pemilik',nama:'Pemilik',peran:'SUPERADMIN',sandi:'sandiPemilik1'});
SM.simpanPengguna({kode:'admin1',nama:'Admin Satu',peran:'ADMIN',sandi:'sandiAdmin1'});
SM.simpanPengguna({kode:'packing1',nama:'Packing Satu',peran:'PACKING',sandi:'sandiPacking1'});

const tSuper=sb.masukDenganKode('pemilik','sandiPemilik1').token;
const tAdmin=sb.masukDenganKode('admin1','sandiAdmin1').token;
const tPacking=sb.masukDenganKode('packing1','sandiPacking1').token;

console.log('=== A: payload dashboard per peran ===');
const dSuper=sb.getDashboardData(tSuper,true,'');
const dAdmin=sb.getDashboardData(tAdmin,true,'');
const dPack=sb.getDashboardData(tPacking,true,'');

cek('superadmin menerima total omzet', dSuper.stats.totalRevenue===400000, dSuper.stats.totalRevenue);
cek('superadmin menerima nominal per baris', dSuper.orders[0].totalAmount!==undefined&&dSuper.orders[0].shippingFee!==undefined);
cek('superadmin menerima omzet harian', dSuper.seriHarian.some(h=>h.omzet>0));
cek('superadmin tidak ditandai disembunyikan', dSuper.uangDisembunyikan===undefined);

cek('admin tidak menerima total omzet', dAdmin.stats.totalRevenue===undefined, dAdmin.stats.totalRevenue);
cek('admin tidak menerima nominal baris', dAdmin.orders.every(o=>o.totalAmount===undefined&&o.shippingFee===undefined));
cek('admin tidak menerima omzet harian', dAdmin.seriHarian.every(h=>h.omzet===undefined));
cek('admin ditandai disembunyikan', dAdmin.uangDisembunyikan===true);

cek('packing tidak menerima total omzet', dPack.stats.totalRevenue===undefined);
cek('packing tidak menerima nominal baris', dPack.orders.every(o=>o.totalAmount===undefined&&o.shippingFee===undefined));
cek('packing tidak menerima omzet harian', dPack.seriHarian.every(h=>h.omzet===undefined));
cek('packing ditandai disembunyikan', dPack.uangDisembunyikan===true);

console.log('=== B: yang tidak keuangan tetap utuh ===');
/* Payload mengirim baris terbaru lebih dulu, jadi barisnya dicari lewat nomor
   pesanannya, bukan lewat posisinya. */
const cariBaris_=(data,sn)=>data.orders.filter(o=>o.orderSn===sn)[0];
cek('jumlah barang tetap ada', cariBaris_(dPack,'SN-K1').qty===2, cariBaris_(dPack,'SN-K1').qty);
cek('nomor resi tetap ada', cariBaris_(dPack,'SN-K1').resi==='RESI-1', cariBaris_(dPack,'SN-K1').resi);
cek('ekspedisi tetap ada', cariBaris_(dPack,'SN-K2').courier==='SPX', cariBaris_(dPack,'SN-K2').courier);
cek('jumlah pesanan tetap dihitung', dPack.stats.totalOrders===2, dPack.stats.totalOrders);
cek('jumlah siap packing tetap dihitung', dPack.stats.siapPacking===2, dPack.stats.siapPacking);
cek('sebaran harian tetap memuat jumlahnya', dPack.seriHarian.reduce((t,h)=>t+h.jumlah,0)===2);

console.log('=== C: cache tidak membocorkan angka superadmin ===');
const dSuper2=sb.getDashboardData(tSuper,true,'');       /* mengisi cache lebih dulu */
const dPackCache=sb.getDashboardData(tPacking,false,'');  /* lalu dibaca dari cache yang sama */
cek('superadmin mengisi cache', dSuper2.stats.totalRevenue===400000);
cek('packing yang membaca cache tetap tanpa nominal', dPackCache.stats.totalRevenue===undefined, dPackCache.stats.totalRevenue);
cek('baris dari cache juga tanpa nominal', dPackCache.orders.every(o=>o.totalAmount===undefined));
cek('cache tidak ikut rusak untuk superadmin', sb.getDashboardData(tSuper,false,'').stats.totalRevenue===400000);

console.log('=== D: RPC baris lain juga dipotong ===');
const barisAdmin=sb.getOrderRowsByStatus(tAdmin,'Siap Packing',500,'');
cek('baris per status untuk admin tanpa nominal', barisAdmin.length>0&&barisAdmin.every(r=>r.totalAmount===undefined&&r.shippingFee===undefined), barisAdmin.length);
const barisPack=sb.getOrderRowsByStatus(tPacking,'Siap Packing',500,'');
cek('baris per status untuk packing tanpa nominal', barisPack.every(r=>r.totalAmount===undefined));
const barisSuper=sb.getOrderRowsByStatus(tSuper,'Siap Packing',500,'');
cek('baris per status untuk superadmin utuh', barisSuper.every(r=>r.totalAmount!==undefined));
const eksporAdmin=sb.getOrderRowsForExport(tAdmin,2000,'');
cek('baris ekspor untuk admin tanpa nominal', eksporAdmin.every(r=>r.totalAmount===undefined));
const eksporSuper=sb.getOrderRowsForExport(tSuper,2000,'');
cek('baris ekspor untuk superadmin utuh', eksporSuper.every(r=>r.totalAmount!==undefined));

console.log('=== E: superadmin tetap yang paling lengkap ===');
cek('satu-satunya yang menerima uang adalah SUPERADMIN',
  sb.PERAN_LIHAT_UANG==='SUPERADMIN');
cek('admin dianggap tidak boleh', sb.bolehLihatUang_({peran:'ADMIN'})===false);
cek('packing dianggap tidak boleh', sb.bolehLihatUang_({peran:'PACKING'})===false);
cek('superadmin dianggap boleh', sb.bolehLihatUang_({peran:'SUPERADMIN'})===true);

console.log('');
console.log('HASIL PEMBATASAN UANG: '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
