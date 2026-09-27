/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';

const fs=require('fs'), vm=require('vm');

/* ---------- mock Google Sheets yang melacak array 2D ---------- */
class MockSheet {
  constructor(name){ this.name=name; this.data=[]; this.frozen=0; }
  getLastRow(){ let last=0;
    for(let r=0;r<this.data.length;r++){ const row=this.data[r]||[];
      if(row.some(v=>v!==''&&v!==null&&v!==undefined)) last=r+1; } return last; }
  getLastColumn(){ let lc=0;
    this.data.forEach(row=>{ for(let c=(row||[]).length;c>0;c--){ const v=row[c-1];
      if(v!==''&&v!==null&&v!==undefined){ if(c>lc) lc=c; break; } } }); return lc; }
  _ensure(r,c){ while(this.data.length<r) this.data.push([]);
    for(let i=0;i<r;i++){ if(!this.data[i]) this.data[i]=[];
      while(this.data[i].length<c) this.data[i].push(''); } }
  getRange(r,c,nr,nc){ const self=this; const api={
      getValues(){ self._ensure(r+nr-1,c+nc-1); const out=[];
        for(let i=0;i<nr;i++){ const row=[];
          for(let j=0;j<nc;j++) row.push(self.data[r-1+i][c-1+j]); out.push(row); } return out; },
      setValues(vals){ for(let i=0;i<vals.length;i++){ self._ensure(r+i,c+vals[i].length-1);
          for(let j=0;j<vals[i].length;j++) self.data[r-1+i][c-1+j]=vals[i][j]; } return api; },
      setNumberFormat(){ return api; }, setBackground(){ return api; }, setFontColor(){ return api; },
      setFontWeight(){ return api; }, setFontSize(){ return api; },
      setHorizontalAlignment(){ return api; }, setDataValidation(){ return api; } };
    return api; }
  getDataRange(){ return this.getRange(1,1,Math.max(this.data.length,1),Math.max(this.getLastColumn(),1)); }
  appendRow(vals){ this.data.push(vals.slice()); }
  insertRowBefore(beforePos){ this.data.splice(beforePos-1,0,[]); }
  insertColumnsAfter(afterPos,howMany){ this._ensure(this.data.length||1, afterPos+howMany);
    for(let i=0;i<this.data.length;i++){ const row=this.data[i];
      for(let k=0;k<howMany;k++) row.splice(afterPos,0,''); } }
  setFrozenRows(){ } autoResizeColumns(){ }
}
class MockSS {
  constructor(){ this.sheets={}; }
  getSheetByName(n){ return this.sheets[n]||null; }
  insertSheet(n){ this.sheets[n]=new MockSheet(n); return this.sheets[n]; }
}
let ss=new MockSS();
const sandbox={ console,
  SpreadsheetApp:{ getActiveSpreadsheet:()=>ss, newDataValidation:()=>({ requireValueInList(){return this;}, setAllowInvalid(){return this;}, build(){return {};} }) },
  Utilities:{ formatDate:()=> '2026-09-27 08:00:00' },
  PropertiesService:{ getScriptProperties:()=>({getProperty:()=>null,setProperty(){}}) },
  CacheService:{ getScriptCache:()=>({get:()=>null,put(){},remove(){}}) } };
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(AKAR + 'gas/SheetManager.js','utf8'), sandbox);
const SM=sandbox.SheetManager;

const head=name=>{ const s=ss.getSheetByName(name); if(!s) return [];
  const lc=s.getLastColumn(); return lc?s.getRange(1,1,1,lc).getValues()[0]:[]; };
let gagal=0;
const cek=(label,ok,extra)=>{ console.log((ok?'  OK   ':'  GAGAL ')+label+(extra!==undefined?'  -> '+extra:'')); if(!ok) gagal++; };

console.log('=== KASUS A: spreadsheet baru ===');
ss=new MockSS();
SM.initAllSheets();
const oh=head('Pesanan Masuk');
console.log('  header Pesanan Masuk ('+oh.length+'):', oh.join(' | '));
cek('kolom ke-17 bernama Toko', oh.length===17 && oh[16]==='Toko');
cek('kolom A sampai P tidak berubah', oh[3]==='Status Internal Begood' && oh[5]==='Ringkasan Produk' && oh[9]==='Total Belanja (Rp)' && oh[15]==='Waktu Sinkronisasi');
const th=head('DB_Token');
console.log('  header DB_Token ('+th.length+'):', th.join(' | '));
cek('DB_Token 12 kolom', th.length===12 && th[8]==='Nama Toko' && th[9]==='Kode Toko' && th[10]==='Aktif' && th[11]==='Region');
const lh=head('Log_Aktivitas');
console.log('  header Log_Aktivitas ('+lh.length+'):', lh.join(' | '));
cek('Log_Aktivitas 7 kolom dengan Toko dan Pengguna', lh.length===7 && lh[5]==='Toko' && lh[6]==='Pengguna');
const cfg=ss.getSheetByName('Konfigurasi').getDataRange().getValues();
const keys=cfg.slice(1).map(r=>String(r[0]).trim()).filter(Boolean);
console.log('  parameter Konfigurasi:', keys.join(', '));
cek('TOKO_AKTIF ditambahkan', keys.indexOf('TOKO_AKTIF')!==-1);

console.log('\n=== KASUS B: dijalankan dua kali (idempotensi) ===');
SM.initAllSheets();
const oh2=head('Pesanan Masuk'), th2=head('DB_Token'), lh2=head('Log_Aktivitas');
const cfg2=ss.getSheetByName('Konfigurasi').getDataRange().getValues();
const keys2=cfg2.slice(1).map(r=>String(r[0]).trim()).filter(Boolean);
cek('Pesanan Masuk tetap 17 kolom', oh2.length===17, oh2.length);
cek('DB_Token tetap 12 kolom', th2.length===12, th2.length);
cek('Log_Aktivitas tetap 7 kolom', lh2.length===7, lh2.length);
cek('TOKO_AKTIF tidak terduplikasi', keys2.filter(k=>k==='TOKO_AKTIF').length===1, keys2.filter(k=>k==='TOKO_AKTIF').length);
cek('parameter tidak ada yang ganda', keys2.length===new Set(keys2).size, keys2.length+' vs '+new Set(keys2).size);

console.log('\n=== KASUS C: sheet lama 16 kolom berisi data ===');
ss=new MockSS();
const lama=ss.insertSheet('Pesanan Masuk');
const headers16=['No. Pesanan','Tanggal Pesanan (WIB)','Status Shopee','Status Internal Begood','Nama Pembeli','Ringkasan Produk','Nomor Referensi SKU','Nama Variasi','Qty','Total Belanja (Rp)','Ongkir (Rp)','Ekspedisi / Kurir','No. Resi','Catatan Pembeli','Kota Tujuan','Waktu Sinkronisasi'];
lama.appendRow(headers16);
lama.appendRow(['260925A001','25/09/2026 08:00','READY_TO_SHIP','[1] Siap Packing','Rina','Kaos','BG-1','L',2,175000,12000,'SPX','SPX123','bubble wrap','Bandung','2026-09-25 08:05']);
lama.appendRow(['260925A002','25/09/2026 09:00','COMPLETED','[4] Selesai','Bayu','Hoodie','BG-2','M',1,289000,15000,'J&T','JT999','','Surabaya','2026-09-25 09:05']);
const dataSebelum=JSON.stringify(lama.data.slice(1));
const tk=ss.insertSheet('DB_Token');
tk.appendRow(['Shop ID','Partner ID','Access Token','Refresh Token','Expired At (Unix)','Expired At (WIB)','Terakhir Diperbarui (WIB)','Status Token']);
tk.appendRow(['1564950615','1234567','ACC','REF',1,'x','y','AKTIF']);
ss.insertSheet('Log_Aktivitas').appendRow(['Waktu (WIB)','Tipe Aksi','Jumlah Pesanan','Status','Keterangan Detail']);
ss.getSheetByName('Log_Aktivitas').appendRow(['2026-09-25 08:00','SYNC_PESANAN',10,'SUKSES','uji']);
const konf=ss.insertSheet('Konfigurasi');
konf.appendRow(['Parameter','Nilai','Keterangan']);
konf.appendRow(['VERCEL_MIDDLEWARE_URL','https://sudah-diisi.vercel.app','URL']);
konf.appendRow(['BEGOOD_API_SECRET','RAHASIA-PUNYA-SAYA','Kunci']);
konf.appendRow(['SHOP_ID','1564950615','ID']);
konf.appendRow(['DEFAULT_SYNC_DAYS','7','Hari']);

SM.initAllSheets();
const oh3=head('Pesanan Masuk');
cek('menjadi 17 kolom', oh3.length===17, oh3.length);
cek('kolom Q = Toko', oh3[16]==='Toko');
const dataSesudah=JSON.stringify(ss.getSheetByName('Pesanan Masuk').data.slice(1));
cek('DATA BARIS LAMA TIDAK BERUBAH', dataSebelum===dataSesudah);
const cfg3=ss.getSheetByName('Konfigurasi').getDataRange().getValues();
const getV=k=>{ const r=cfg3.find(x=>String(x[0]).trim()===k); return r?String(r[1]):'(tidak ada)'; };
cek('secret pengguna TIDAK tertimpa', getV('BEGOOD_API_SECRET')==='RAHASIA-PUNYA-SAYA', getV('BEGOOD_API_SECRET'));
cek('DEFAULT_SYNC_DAYS pengguna TIDAK tertimpa', getV('DEFAULT_SYNC_DAYS')==='7', getV('DEFAULT_SYNC_DAYS'));
cek('URL Vercel pengguna TIDAK tertimpa', getV('VERCEL_MIDDLEWARE_URL')==='https://sudah-diisi.vercel.app', getV('VERCEL_MIDDLEWARE_URL'));
cek('TOKO_AKTIF ditambahkan', getV('TOKO_AKTIF')!=='(tidak ada)');
const logData=ss.getSheetByName('Log_Aktivitas').data;
cek('baris log lama tidak hilang', logData.length===2 && String(logData[1][1])==='SYNC_PESANAN', 'rows='+logData.length);
cek('header log jadi 7 kolom', head('Log_Aktivitas').length===7);

console.log('\n=== KASUS D: token sheet lama 8 kolom ===');
const t8=head('DB_Token');
cek('DB_Token jadi 12 kolom', t8.length===12, t8.length);
cek('token lama tetap ada', String(ss.getSheetByName('DB_Token').getRange(2,1,1,4).getValues()[0].join('|'))==='1564950615|1234567|ACC|REF');

console.log('\n=== KASUS E: baris 1 berisi data tanpa header (risiko kehilangan data) ===');
ss=new MockSS();
const logTanpaHeader=ss.insertSheet('Log_Aktivitas');
logTanpaHeader.appendRow(['2026-09-25 08:00','SYNC_PESANAN',10,'SUKSES','log sebelum inisialisasi']);
const ordTanpaHeader=ss.insertSheet('Pesanan Masuk');
ordTanpaHeader.appendRow(['260925A009','25/09/2026 08:00','READY_TO_SHIP','[1] Siap Packing','Budi','Kaos','BG-9','L',1,50000,9000,'SPX','SPX9','','Bogor','2026-09-25 08:10']);
SM.initAllSheets();
const ld=ss.getSheetByName('Log_Aktivitas').data;
cek('log: header di baris 1', String(ld[0][0])==='Waktu (WIB)', String(ld[0][0]));
cek('log: DATA LAMA TETAP ADA di baris 2', String(ld[1][1])==='SYNC_PESANAN', ld.length>1?String(ld[1][1]):'(hilang)');
const od=ss.getSheetByName('Pesanan Masuk').data;
cek('pesanan: header di baris 1', String(od[0][0])==='No. Pesanan', String(od[0][0]));
cek('pesanan: DATA LAMA TETAP ADA di baris 2', String(od[1][0])==='260925A009', od.length>1?String(od[1][0]):'(hilang)');
cek('pesanan: 17 kolom', (od[0]||[]).length===17, (od[0]||[]).length);

console.log('\nHASIL FASE 1:', gagal===0?'SEMUA LULUS ('+0+' kegagalan)':gagal+' KEGAGALAN');
