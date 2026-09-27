/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';

const fs=require('fs'), vm=require('vm');
class MockSheet{
  constructor(n){this.name=n;this.data=[];}
  getLastRow(){let l=0;for(let r=0;r<this.data.length;r++){if((this.data[r]||[]).some(v=>v!==''&&v!=null))l=r+1;}return l;}
  getLastColumn(){let lc=0;this.data.forEach(row=>{for(let c=(row||[]).length;c>0;c--){const v=row[c-1];if(v!==''&&v!=null){if(c>lc)lc=c;break;}}});return lc;}
  _ensure(r,c){while(this.data.length<r)this.data.push([]);for(let i=0;i<r;i++){if(!this.data[i])this.data[i]=[];while(this.data[i].length<c)this.data[i].push('');}}
  getRange(r,c,nr,nc){const s=this;const a={
    getValues(){s._ensure(r+nr-1,c+nc-1);const o=[];for(let i=0;i<nr;i++){const w=[];for(let j=0;j<nc;j++)w.push(s.data[r-1+i][c-1+j]);o.push(w);}return o;},
    setValues(v){for(let i=0;i<v.length;i++){s._ensure(r+i,c+v[i].length-1);for(let j=0;j<v[i].length;j++)s.data[r-1+i][c-1+j]=v[i][j];}return a;},
    setValue(v){return a.setValues([[v]]);},
    setNumberFormat(){return a;},setBackground(){return a;},setFontColor(){return a;},setFontWeight(){return a;},setFontSize(){return a;},setHorizontalAlignment(){return a;},setDataValidation(){return a;}};return a;}
  getDataRange(){return this.getRange(1,1,Math.max(this.data.length,1),Math.max(this.getLastColumn(),1));}
  appendRow(v){this.data.push(v.slice());}
  insertRowBefore(p){this.data.splice(p-1,0,[]);}
  insertColumnsAfter(a,how){this._ensure(this.data.length||1,a+how);for(let i=0;i<this.data.length;i++){const row=this.data[i];for(let k=0;k<how;k++)row.splice(a,0,'');}}
  setFrozenRows(){} autoResizeColumns(){}}
class MockSS{constructor(){this.sheets={};}getSheetByName(n){return this.sheets[n]||null;}insertSheet(n){this.sheets[n]=new MockSheet(n);return this.sheets[n];}}
let ss=new MockSS();
const sb={console,SpreadsheetApp:{getActiveSpreadsheet:()=>ss,newDataValidation:()=>({requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return{};}})},Utilities:{formatDate:()=>"2026-09-27 08:00:00"},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})},CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})}};
sb.globalThis=sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(AKAR + 'gas/SheetManager.js','utf8'), sb);
const SM=sb.SheetManager;
let gagal=0;
const cek=(l,ok,x)=>{console.log((ok?'  OK   ':'  GAGAL ')+l+(x!==undefined?'  -> '+x:'')); if(!ok)gagal++;};
const tokenRow=i=>ss.getSheetByName('DB_Token').data[i]?ss.getSheetByName('DB_Token').data[i].slice(0,12):null;
SM.initAllSheets();

console.log('=== A: toko pertama disimpan (kompatibilitas perilaku lama) ===');
let r1=SM.saveTokenRecord({shop_id:'1564950615',partner_id:'1234567',access_token:'ACC-A',refresh_token:'REF-A',expired_at:4000000000,nama_toko:'b e g o o d . b d g',kode_toko:'BGD'});
console.log('  aksi:',r1.aksi,'| baris:',r1.baris);
cek('baris pertama ditambahkan', r1.aksi==='ditambahkan' && r1.baris===2);
const recA=SM.getTokenRecord('1564950615');
cek('getTokenRecord(shopId) mengembalikan toko A', recA && recA.access_token==='ACC-A' && recA.kode_toko==='BGD');
cek('getTokenRecord() tanpa argumen tetap bekerja', SM.getTokenRecord() && SM.getTokenRecord().access_token==='ACC-A');
cek('getTokenRecords() = 1', SM.getTokenRecords().length===1, SM.getTokenRecords().length);
const konfVal=()=>{const d=ss.getSheetByName('Konfigurasi').getDataRange().getValues();const r=d.find(x=>String(x[0]).trim()==='SHOP_ID');return r?String(r[1]):'-';};
cek('Konfigurasi SHOP_ID diisi saat masih satu toko', konfVal()==='1564950615', konfVal());

console.log('\n=== B: KRITIS - toko kedua disimpan, token toko pertama tidak boleh berubah ===');
const Asebelum=JSON.stringify(tokenRow(1));
let r2=SM.saveTokenRecord({shop_id:'1564950616',partner_id:'1234567',access_token:'ACC-B',refresh_token:'REF-B',expired_at:4000000000,nama_toko:'Begood Store 2',kode_toko:'BGD2'});
console.log('  aksi:',r2.aksi,'| baris:',r2.baris);
cek('toko kedua DITAMBAHKAN, bukan menimpa', r2.aksi==='ditambahkan' && r2.baris===3);
const Asesudah=JSON.stringify(tokenRow(1));
cek('BARIS TOKO PERTAMA IDENTIK SEBELUM DAN SESUDAH', Asebelum===Asesudah);
console.log('    sebelum:',Asebelum.slice(0,90));
console.log('    sesudah:',Asesudah.slice(0,90));
cek('toko A masih bisa dibaca', SM.getTokenRecord('1564950615').access_token==='ACC-A');
cek('toko B bisa dibaca', SM.getTokenRecord('1564950616').access_token==='ACC-B');
cek('jumlah rekaman = 2', SM.getTokenRecords().length===2, SM.getTokenRecords().length);
cek('Konfigurasi SHOP_ID TIDAK ditimpa toko B', konfVal()==='1564950615', konfVal());

console.log('\n=== C: penyegaran token mempertahankan kolom I-L ===');
SM.saveTokenRecord({shop_id:'1564950615',access_token:'ACC-A-BARU',refresh_token:'REF-A-BARU',expired_at:5000000000});
const recA2=SM.getTokenRecord('1564950615');
cek('access_token tersegarkan', recA2.access_token==='ACC-A-BARU', recA2.access_token);
cek('nama_toko TETAP', recA2.nama_toko==='b e g o o d . b d g', recA2.nama_toko);
cek('kode_toko TETAP', recA2.kode_toko==='BGD', recA2.kode_toko);
cek('aktif TETAP', recA2.aktif==='YA', recA2.aktif);
cek('region TETAP', recA2.region==='GLOBAL', recA2.region);
cek('jumlah baris tetap 2', SM.getTokenRecords().length===2);

console.log('\n=== D: simpan tanpa shop_id (kurikulum lama) ===');
SM.saveTokenRecord({access_token:'TANPA-SHOPID',refresh_token:'R',expired_at:5000000000});
cek('tidak menambah baris baru', SM.getTokenRecords().length===2, SM.getTokenRecords().length);
cek('baris pertama yang diperbarui', SM.getTokenRecord('1564950615').access_token==='TANPA-SHOPID', SM.getTokenRecord('1564950615').access_token);

console.log('\n=== E: backfillKodeToko ===');
const ord=ss.getSheetByName('Pesanan Masuk');
ord.data=[]; ord.appendRow(['No. Pesanan','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Toko']);
const baris=q=>['SN'+q,'x','y','z','b','i','s','v',1,1,1,'kurir','resi','','kota','waktu',q];
ord.appendRow(baris('')); ord.appendRow(baris('')); ord.appendRow(baris('OLD'));
ord.appendRow(['','','','','','','','',0,0,0,'','','','','','']);
let h=SM.backfillKodeToko('bgd');
console.log('  hasil:',JSON.stringify(h));
cek('diisi 2 baris', h.diisi===2, h.diisi);
cek('dilewati 1 baris yang sudah terisi', h.dilewati===1, h.dilewati);
cek('kolom Q terisi BGD untuk baris kosong', String(ord.data[1][16])==='BGD' && String(ord.data[2][16])==='BGD');
cek('baris yang sudah terisi TIDAK diubah', String(ord.data[3][16])==='OLD', ord.data[3][16]);
cek('kolom A-P tidak berubah', String(ord.data[1][0])==='SN' && String(ord.data[1][11])==='kurir');
h=SM.backfillKodeToko('BGD');
cek('dijalankan ulang: diisi 0 (idempoten)', h.diisi===0, h.diisi);

console.log('\n=== F: tempelan JSON mentah di A2 ===');
const t=ss.getSheetByName('DB_Token');
t.data=[]; t.appendRow(['Shop ID','Partner ID','Access Token','Refresh Token','Expired At (Unix)','Expired At (WIB)','Terakhir Diperbarui (WIB)','Status Token','Nama Toko','Kode Toko','Aktif','Region']);
t.appendRow(['{"shop_id":999,"access_token":"JSON-ACC","refresh_token":"JSON-REF"}','','','','','','','','','','','']);
const recJson=SM.getTokenRecord();
cek('JSON mentah terbaca sebagai token', recJson && recJson.access_token==='JSON-ACC', recJson?recJson.access_token:'null');
cek('shop_id dibaca dari JSON', recJson && recJson.shop_id==='999', recJson?recJson.shop_id:'null');
cek('sel mentah dibersihkan', String(t.data[1][0])==='', JSON.stringify(t.data[1][0]));
cek('hanya 1 rekaman (tidak ganda)', SM.getTokenRecords().length===1, SM.getTokenRecords().length);

console.log('\nHASIL FASE 2:', gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN');
