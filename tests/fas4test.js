/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';

const fs=require('fs'), vm=require('vm');
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
const fakeUi={ButtonSet:{OK:'OK',OK_CANCEL:'OK_CANCEL'},Button:{OK:'OK'},alert(t,m){alerts.push({title:t,body:String(m)});},prompt(){throw new Error('x');}};
const tokoCache={};
const cacheService={get(k){return tokoCache[k]===undefined?null:tokoCache[k];},put(k,v){tokoCache[k]=String(v);},remove(k){delete tokoCache[k];}};
const ShopeeApi={fetchDailyOrders(){return {data:{orders:[],diagnostics:{}}};}};
const sb={console,SpreadsheetApp:{getActiveSpreadsheet:()=>ss,getUi:()=>fakeUi,newDataValidation:()=>({requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return{};}})},
  Utilities:{formatDate:()=>'2026-09-27 08:00:00',sleep(){}},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})},
  CacheService:{getScriptCache:()=>cacheService},ShopeeApi:ShopeeApi};
sb.globalThis=sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(AKAR + 'gas/SheetManager.js','utf8'),sb,{filename:'SheetManager.js'});
vm.runInContext(fs.readFileSync(AKAR + 'gas/Code.js','utf8'),sb,{filename:'Code.js'});
const SM=sb.SheetManager;
let gagal=0;
const cek=(l,ok,x)=>{console.log((ok?'  OK   ':'  GAGAL ')+l+(x!==undefined?'  -> '+x:''));if(!ok)gagal++;};

SM.initAllSheets();
SM.saveTokenRecord({shop_id:'111',partner_id:'99',access_token:'A1',refresh_token:'R1',expired_at:Math.floor(Date.now()/1000)+14400,nama_toko:'Begood Satu',kode_toko:'BGD1'});
SM.saveTokenRecord({shop_id:'222',partner_id:'99',access_token:'A2',refresh_token:'R2',expired_at:Math.floor(Date.now()/1000)-3600,nama_toko:'Begood Dua',kode_toko:'BGD2'});

function baris(sn,status,kurir,amount,toko,qty,sku){
  return [sn,'2026-09-27 08:00:00','READY_TO_SHIP',status,'budi',sku,sku,'varian',qty,amount,10000,kurir,'RESI-'+sn,'','Bandung','2026-09-27 08:00:00',toko];
}
const ord=ss.getSheetByName('Pesanan Masuk');
ord.data.length=1;
ord.appendRow(baris('SN-A','[1] Siap Packing','JNE',100000,'BGD1',1,'SKU-1'));
ord.appendRow(baris('SN-B','[4] Selesai','JNE',50000,'BGD1',1,'SKU-2'));
ord.appendRow(baris('SN-C','[1] Siap Packing','SPX',70000,'BGD2',1,'SKU-3'));
ord.appendRow(baris('SN-D','[1] Siap Packing','SPX',30000,'',1,'SKU-4'));
ord.appendRow(baris('SN-E','[1] Siap Packing','JNE',20000,'BGD1',2,'SKU-5'));
ord.appendRow(baris('SN-E','[1] Siap Packing','JNE',20000,'BGD1',3,'SKU-6'));

console.log('=== 1: ringkasan seluruh toko ===');
let d=SM.getDashboardSummary();
cek('cakupan kosong', d.cakupan==='');
cek('total pesanan unik 5', d.stats.totalOrders===5, d.stats.totalOrders);
cek('omset 270000', d.stats.totalRevenue===270000, d.stats.totalRevenue);
cek('siap packing 4', d.stats.siapPacking===4, d.stats.siapPacking);
cek('selesai 1', d.stats.selesai===1, d.stats.selesai);
cek('kurir JNE 3 dan SPX 2', d.courierStats.JNE===3&&d.courierStats.SPX===2, JSON.stringify(d.courierStats));
cek('tabel pesanan berisi 6 baris produk, bukan 5 pesanan unik', d.orders.length===6, d.orders.length);
cek('setiap baris membawa kode toko', d.orders.every(o=>o.toko!==undefined));
cek('pesanan multi-item tetap dua baris', d.orders.filter(o=>o.orderSn==='SN-E').length===2, d.orders.filter(o=>o.orderSn==='SN-E').length);

console.log('=== 2: daftar toko untuk pemilih cakupan ===');
console.log('    '+JSON.stringify(d.tokoList));
cek('dua toko dari DB_Token', d.tokoList.length===2, d.tokoList.length);
cek('urut berdasarkan kode', d.tokoList.map(t=>t.kode).join(',')==='BGD1,BGD2');
cek('jumlah pesanan per toko benar', d.tokoList[0].jumlahPesanan===3&&d.tokoList[1].jumlahPesanan===1, d.tokoList.map(t=>t.kode+':'+t.jumlahPesanan).join(' '));
cek('token BGD1 aktif', d.tokoList[0].hasToken===true&&d.tokoList[0].isExpired===false, d.tokoList[0].statusText);
cek('token BGD2 kadaluarsa', d.tokoList[1].isExpired===true, d.tokoList[1].statusText);
cek('nama toko terbawa', d.tokoList[0].nama==='Begood Satu');
cek('baris tanpa kode dihitung terpisah', d.jumlahTanpaKode===1, d.jumlahTanpaKode);

console.log('=== 3: kondisi token pada cakupan semua toko ===');
cek('melaporkan berapa toko yang perlu token', d.token.isExpired===true&&d.token.statusText==='1 dari 2 toko perlu token', d.token.statusText);

console.log('=== 4: ringkasan satu toko ===');
let d1=SM.getDashboardSummary('BGD1');
cek('cakupan tercatat', d1.cakupan==='BGD1', d1.cakupan);
cek('total pesanan toko itu 3', d1.stats.totalOrders===3, d1.stats.totalOrders);
cek('omset toko itu 170000', d1.stats.totalRevenue===170000, d1.stats.totalRevenue);
cek('siap packing 2, selesai 1', d1.stats.siapPacking===2&&d1.stats.selesai===1, d1.stats.siapPacking+'/'+d1.stats.selesai);
cek('kurir hanya dari toko itu', d1.courierStats.JNE===3&&!d1.courierStats.SPX, JSON.stringify(d1.courierStats));
cek('tabel pesanan hanya baris toko itu', d1.orders.length===4&&d1.orders.every(o=>o.toko==='BGD1'), d1.orders.length);
cek('daftar toko tetap lengkap', d1.tokoList.length===2, d1.tokoList.length);
cek('token toko itu ditampilkan apa adanya', d1.token.shopId==='111'&&d1.token.isExpired===false, d1.token.statusText);
const d2=SM.getDashboardSummary('BGD2');
cek('cakupan BGD2 punya token kadaluarsa', d2.token.isExpired===true&&d2.token.shopId==='222', d2.token.statusText);
cek('cakupan BGD2 hanya 1 pesanan', d2.stats.totalOrders===1, d2.stats.totalOrders);

console.log('=== 5: filter status dengan cakupan toko ===');
const rowsAll=SM.getOrderRowsByStatus('Siap Packing',500);
const rowsBgd1=SM.getOrderRowsByStatus('Siap Packing',500,'BGD1');
cek('tanpa cakupan mengambil semua toko', rowsAll.length===5, rowsAll.length);
cek('dengan cakupan hanya toko itu', rowsBgd1.length===3, rowsBgd1.length);
cek('semua barisnya bertanda BGD1', rowsBgd1.every(r=>r.toko==='BGD1'));
const rowsBgd2=SM.getOrderRowsByStatus('Siap Packing',500,'BGD2');
cek('cakupan toko lain terpisah', rowsBgd2.length===1&&rowsBgd2[0].toko==='BGD2', rowsBgd2.length);

console.log('=== 6: ekspor dengan cakupan toko ===');
const expAll=SM.getOrderRowsForExport(2000);
const expBgd1=SM.getOrderRowsForExport(2000,'BGD1');
cek('ekspor semua toko 6 baris', expAll.length===6, expAll.length);
cek('ekspor satu toko 4 baris', expBgd1.length===4, expBgd1.length);
cek('baris ekspor membawa kode toko', expBgd1.every(r=>r.toko==='BGD1'));
const expBgd2=SM.getOrderRowsForExport(2000,'BGD2');
cek('ekspor toko kedua hanya barisnya', expBgd2.length===1, expBgd2.length);

console.log('=== 7: inventaris status dengan cakupan toko ===');
const invAll=SM.getStatusInventory();
const invBgd1=SM.getStatusInventory('BGD1');
const cari=(inv,nama)=>{const x=inv.filter(s=>s.status===nama)[0];return x?x.jumlah:0;};
cek('tanpa cakupan: siap packing 5', cari(invAll,'[1] Siap Packing')===5, JSON.stringify(invAll));
cek('dengan cakupan: siap packing 3', cari(invBgd1,'[1] Siap Packing')===3, JSON.stringify(invBgd1));
cek('dengan cakupan: selesai 1', cari(invBgd1,'[4] Selesai')===1);

console.log('=== 8: cache terpisah per cakupan ===');
cek('kunci cache berbeda per cakupan', sb.kunciCacheDashboard_('')!==sb.kunciCacheDashboard_('BGD1'), sb.kunciCacheDashboard_('BGD1'));
const viaCache1=sb.getDashboardData('',false,'BGD1');
const viaCache2=sb.getDashboardData('',false,'BGD2');
cek('cakupan BGD1 dilayani cache sendiri', viaCache1.cakupan==='BGD1', viaCache1.cakupan);
cek('cakupan BGD2 tidak tertukar', viaCache2.cakupan==='BGD2', viaCache2.cakupan);
cek('keduanya tersimpan di kunci terpisah', Object.keys(tokoCache).filter(k=>k.indexOf('ERP_DASHBOARD_')===0).length===2, Object.keys(tokoCache).join(' '));
const kunciSebelum=sb.kunciCacheDashboard_('BGD1');
sb.invalidateDashboardCache();
const kunciSesudah=sb.kunciCacheDashboard_('BGD1');
cek('kunci cache berganti setelah dibersihkan', kunciSebelum!==kunciSesudah, kunciSebelum+' vs '+kunciSesudah);
const setelahBersih=sb.getDashboardData('',false,'BGD1');
cek('setelah dibersihkan data dibaca ulang dengan benar', setelahBersih.cakupan==='BGD1'&&setelahBersih.orders.length===4, setelahBersih.orders.length);

console.log('=== 9: bentrok cache hanya mungkin bila kunci sama ===');
const k1=sb.kunciCacheDashboard_('');
const k2=sb.kunciCacheDashboard_('BGD1');
cek('kunci semua-toko dan satu-toko tidak sama', k1!==k2, k1+' vs '+k2);

console.log('');
console.log('HASIL FASE 4 (server): '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
