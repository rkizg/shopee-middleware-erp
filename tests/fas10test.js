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
      /* Nilai tampilan pada sheet nyata selalu berupa teks. Modul produksi membacanya lebih dulu untuk kolom SKU, jadi tiruannya harus menyediakannya. */
      getDisplayValues(){return a.getValues().map(function(b){return b.map(function(v){return (v===null||v===undefined)?'':String(v);});});},
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
   MODUL PRODUKSI JAHIT — uji terima bagian 8 dokumen, dijalankan otomatis.
   Dokumen: docs/panduan-adaptasi-data-jahit-data-proses.md
   ========================================================================== */
const setWajibLogin_=(nilai)=>{
  const cfg=ss.getSheetByName('Konfigurasi');
  const baris=cfg.data.findIndex(r=>String(r[0]).trim()==='WAJIB_LOGIN');
  cfg.getRange(baris+1,2,1,1).setValues([[nilai]]);
};
setWajibLogin_('YA');

SM.simpanPengguna({kode:'pemilik',nama:'Pemilik',peran:'SUPERADMIN',sandi:'sandiPemilik1'});
SM.simpanPengguna({kode:'admin1',nama:'Admin Satu',peran:'ADMIN',sandi:'sandiAdmin1'});
SM.simpanPengguna({kode:'packing1',nama:'Packing Satu',peran:'PACKING',sandi:'sandiPacking1'});
const tSuper=sb.masukDenganKode('pemilik','sandiPemilik1').token;
const tAdmin=sb.masukDenganKode('admin1','sandiAdmin1').token;
const tPack=sb.masukDenganKode('packing1','sandiPacking1').token;

const hariIni=sb.tanggalWibHariIni_();
const pesanRow=(sn,sku,variasi,qty,status,toko)=>[
  sn, hariIni+' 08:00:00','READY_TO_SHIP',status,'budi',sku,sku,variasi,qty,150000,10000,'JNE','RESI-'+sn,'','Bandung',hariIni+' 08:00:00',toko||'BGD'
];
const ord=ss.getSheetByName('Pesanan Masuk');
const pros=()=>ss.getSheetByName('DATA PROSES');
const jahit=()=>ss.getSheetByName('DATA JAHIT');
ord.data.length=1;
ord.appendRow(pesanRow('SN-P1','SARKUR 120/5','Coffee',2,'[2] Menunggu Pickup'));
ord.appendRow(pesanRow('SN-P1','TAS MIKA AJA','SINGLE',1,'[2] Menunggu Pickup'));
ord.appendRow(pesanRow('SN-P2','SARKUR 120/5','Coffee',3,'[2] Menunggu Pickup'));
ord.appendRow(pesanRow('SN-P3','KAOS POLOS','M',1,'[1] Siap Packing'));

console.log('=== 1: belum ada pesanan [2] pada cakupan ===');
let a=sb.getAntrianProduksi(tPack,'TOKOX');
cek('tidak melempar galat', Boolean(a));
cek('ringkasan bernilai nol', a.ringkasan.baris===0&&a.ringkasan.qty===0, JSON.stringify(a.ringkasan));
cek('tabel antriannya kosong', a.pesanan.length===0);

console.log('=== 2: antrian berisi pesanan [2] saja ===');
a=sb.getAntrianProduksi(tAdmin,'');
cek('tiga baris kerja', a.ringkasan.baris===3, a.ringkasan.baris);
cek('dua nomor pesanan', a.ringkasan.pesanan===2, a.ringkasan.pesanan);
cek('qty seluruhnya enam', a.ringkasan.qty===6, a.ringkasan.qty);
cek('semuanya belum dijahit', a.ringkasan.belumDijahit===3);
/* Daftar kerja tidak lagi disimpan di sheet, jadi tandanya pun tidak ada lagi:
   keadaan satu baris hanya ditentukan oleh apakah barisnya sudah masuk DATA JAHIT. */
cek('tidak ada lagi tanda sudah masuk daftar kerja',
  a.pesanan.every(p=>p.sudahDitarik===undefined&&p.ringkasan===undefined));
cek('ringkasan tidak lagi memuat hitungan belum ditarik', a.ringkasan.belumDitarik===undefined);
cek('pesanan [1] tidak ikut', a.pesanan.every(p=>p.status.indexOf('Menunggu Pickup')!==-1));
cek('dua variasi pesanan SN-P1 jadi dua baris', a.pesanan.filter(p=>p.noPesanan==='SN-P1').length===2);

console.log('=== 3: DATA PROSES adalah daftar harga, satu baris per SKU ===');
/* Daftar kerja tidak lagi ditulis ke sheet ini, jadi sebelum ada yang diisi
   sheetnya hanya berisi baris header. */
cek('sheet hanya berisi header', pros().getLastRow()===1, pros().getLastRow());
let h=sb.saveHargaProses(tAdmin,[{sku:'SARKUR 120/5',harga:12000,jahit:20,potong:5}]);
cek('satu SKU diproses', h.sku===1, h.sku);
cek('baris baru ditambahkan sebagai satu baris utuh',
  h.selDiperbarui===0&&h.barisDitambah===1, h.selDiperbarui+'/'+h.barisDitambah);
cek('sheet bertambah satu baris data', pros().getLastRow()===2, pros().getLastRow());
cek('kolomnya empat, tanpa sisa kolom antrian', pros().getLastColumn()===4, pros().getLastColumn());
const barisHarga=(sku)=>{
  for(let i=1;i<pros().data.length;i++){
    if(String(pros().data[i][0]).trim()===sku) return pros().data[i];
  }
  return null;
};
cek('SKU tersimpan di kolom A', String(barisHarga('SARKUR 120/5')[0])==='SARKUR 120/5');
cek('harga di B, waktu jahit di C, waktu potong di D',
  Number(barisHarga('SARKUR 120/5')[1])===12000&&Number(barisHarga('SARKUR 120/5')[2])===20&&
  Number(barisHarga('SARKUR 120/5')[3])===5);

console.log('=== 4: menyimpan SKU yang sama mengubah barisnya, bukan menambah baris ===');
h=sb.saveHargaProses(tAdmin,[{sku:'SARKUR 120/5',harga:15000}]);
cek('satu sel berubah', h.selDiperbarui===1, h.selDiperbarui);
cek('tidak ada baris baru', h.barisDitambah===0, h.barisDitambah);
cek('waktu jahit dan potong tidak tersentuh',
  Number(barisHarga('SARKUR 120/5')[2])===20&&Number(barisHarga('SARKUR 120/5')[3])===5);
cek('sheet tetap satu baris data', pros().getLastRow()===2, pros().getLastRow());
h=sb.saveHargaProses(tAdmin,[{sku:'SARKUR 120/5',harga:15000,jahit:20,potong:5}]);
cek('menyimpan nilai yang sama tidak mengubah apa pun',
  h.selDiperbarui===0&&h.barisDitambah===0, h.selDiperbarui+'/'+h.barisDitambah);

console.log('=== 5: isian yang dikosongkan tidak menimpa nilai lama ===');
h=sb.saveHargaProses(tAdmin,[{sku:'BG-UJI/1',harga:5000,jahit:10}]);
cek('kolom yang tidak diisi dibiarkan kosong, bukan nol',
  barisHarga('BG-UJI/1')[3]===''&&barisHarga('BG-UJI/1')[3]!==0, JSON.stringify(barisHarga('BG-UJI/1')[3]));
h=sb.saveHargaProses(tAdmin,[{sku:'BG-UJI/1',potong:3}]);
cek('hanya waktu potong yang berubah', h.selDiperbarui===1, h.selDiperbarui);
cek('harga dan waktu jahit lama tetap',
  Number(barisHarga('BG-UJI/1')[1])===5000&&Number(barisHarga('BG-UJI/1')[2])===10);

console.log('=== 6: pesanan membaca harga langsung dari daftar itu ===');
a=sb.getAntrianProduksi(tSuper,'');
const hargaUntuk=(sn,variasi)=>{
  const p=a.pesanan.filter(x=>x.noPesanan===sn&&x.variasi===variasi)[0];
  return p?p.hargaSatuan:'(tidak ada)';
};
const tandanyaUntuk=(sn,variasi)=>{
  const p=a.pesanan.filter(x=>x.noPesanan===sn&&x.variasi===variasi)[0];
  return p?Boolean(p.tanpaHarga):'(tidak ada)';
};
cek('harga SKU terbaca pada baris pesanannya', hargaUntuk('SN-P1','Coffee')===15000, hargaUntuk('SN-P1','Coffee'));
cek('SKU yang belum dihargai tetap ditandai', tandanyaUntuk('SN-P1','SINGLE')===true);
cek('SKU yang belum dihargai tidak dianggap gratis', hargaUntuk('SN-P1','SINGLE')===0);

console.log('=== 7: satu variasi dapat punya harga sendiri lewat nama gabungan ===');
ord.appendRow(pesanRow('SN-P5','SARKUR 120/5','Navy',1,'[2] Menunggu Pickup'));
sb.saveHargaProses(tAdmin,[{sku:'SARKUR 120/5 NAVY',harga:99000}]);
a=sb.getAntrianProduksi(tSuper,'');
cek('variasi yang punya baris sendiri memakai harga itu', hargaUntuk('SN-P5','Navy')===99000, hargaUntuk('SN-P5','Navy'));
cek('variasi lain tetap memakai harga SKU', hargaUntuk('SN-P1','Coffee')===15000, hargaUntuk('SN-P1','Coffee'));

console.log('=== 8: SKU tanpa harga tetap dilaporkan, bukan dihitung nol ===');
cek('satu baris belum dihargai', a.ringkasan.tanpaHarga===1, a.ringkasan.tanpaHarga);
cek('yang belum dihargai adalah SKU yang memang tidak ada di daftar',
  a.pesanan.filter(p=>p.tanpaHarga).every(p=>p.sku==='TAS MIKA AJA'));

console.log('=== 9: harga SKU baru diisi dari daftar antrian, tanpa tarik ulang ===');
ord.appendRow(pesanRow('SN-P6','BC AJA 115x210','',1,'[2] Menunggu Pickup'));
a=sb.getAntrianProduksi(tSuper,'');
cek('SKU baru muncul sebagai belum dihargai', tandanyaUntuk('SN-P6','')===true);
h=sb.saveHargaProses(tAdmin,[{sku:'BC AJA 115x210',harga:7000,jahit:5,potong:2}]);
a=sb.getAntrianProduksi(tSuper,'');
cek('barisnya ditambahkan untuk SKU yang belum pernah dihargai', h.barisDitambah===1, h.barisDitambah);
cek('harga langsung terbaca tanpa penarikan ulang', hargaUntuk('SN-P6','')===7000, hargaUntuk('SN-P6',''));

console.log('=== 10: simpan hasil jahit ===');
let simpan=sb.simpanProduksiBatch(tAdmin,[
  {tanggal:hariIni,sesi:'SIANG',sku:'SARKUR 120/5',variasi:'Coffee',jumlah:2,penjahit:'OPIK',noPesanan:'SN-P1',toko:'BGD'},
  {tanggal:hariIni,sesi:'PAGI',sku:'TAS MIKA AJA',variasi:'SINGLE',jumlah:1,penjahit:'ADUL',noPesanan:'SN-P1',toko:'BGD'}
]);
cek('dua baris tersimpan', simpan.ditambah===2, simpan.ditambah);
cek('tidak ada yang dilewati', simpan.dilewati===0);
cek('sheet hasil jahit bertambah dua baris', jahit().getLastRow()===3, jahit().getLastRow());
const barisJahit=(sku)=>jahit().data.slice(1).filter(r=>String(r[2])===sku)[0];
cek('nomor pesanan tersimpan di kolom G', String(barisJahit('SARKUR 120/5')[6])==='SN-P1');
cek('toko tersimpan di kolom H', String(barisJahit('SARKUR 120/5')[7])==='BGD');
cek('sesi dan penjahit tersimpan', String(barisJahit('SARKUR 120/5')[1])==='SIANG'&&String(barisJahit('SARKUR 120/5')[5])==='OPIK');

console.log('=== 11: kirim tabel input dua kali ===');
simpan=sb.simpanProduksiBatch(tAdmin,[
  {tanggal:hariIni,sesi:'SIANG',sku:'SARKUR 120/5',variasi:'Coffee',jumlah:2,penjahit:'OPIK',noPesanan:'SN-P1',toko:'BGD'},
  {tanggal:hariIni,sesi:'PAGI',sku:'TAS MIKA AJA',variasi:'SINGLE',jumlah:1,penjahit:'ADUL',noPesanan:'SN-P1',toko:'BGD'}
]);
cek('tidak menambah baris', simpan.ditambah===0, simpan.ditambah);
cek('dua baris dilewati', simpan.dilewati===2, simpan.dilewati);
cek('sheet hasil jahit tidak bertambah', jahit().getLastRow()===3);

console.log('=== 12: baris yang belum lengkap ditolak dengan nomor barisnya ===');
const galat1=lempar(()=>sb.simpanProduksiBatch(tAdmin,[
  {tanggal:hariIni,sesi:'SIANG',sku:'',variasi:'',jumlah:2,penjahit:'OPIK'},
  {tanggal:hariIni,sesi:'SIANG',sku:'X1',variasi:'',jumlah:0,penjahit:'OPIK'},
  {tanggal:hariIni,sesi:'SORE',sku:'X2',variasi:'',jumlah:1,penjahit:'OPIK'},
  {tanggal:hariIni,sesi:'SIANG',sku:'X3',variasi:'',jumlah:1,penjahit:''}
]))||'';
cek('SKU kosong dilaporkan', galat1.indexOf('Baris 1: SKU kosong.')!==-1, galat1.slice(0,60));
cek('jumlah nol dilaporkan', galat1.indexOf('Baris 2: jumlah harus lebih dari nol.')!==-1);
cek('sesi salah dilaporkan', galat1.indexOf('Baris 3: sesi harus PAGI atau SIANG.')!==-1);
cek('penjahit kosong dilaporkan', galat1.indexOf('Baris 4: nama penjahit belum diisi.')!==-1);
cek('semua pesan digabung dalam satu galat, dengan keterangan pembuka', galat1.indexOf('Baris berikut belum lengkap.')===0&&galat1.split('Baris ').length===6, galat1.slice(0,40));

console.log('=== 13: estimasi satu tanggal ===');
const est=sb.getProduksiRingkasan(tSuper,hariIni);
cek('tanggal dilaporkan', est.tanggal===hariIni, est.tanggal);
cek('dua baris dihitung', est.total.baris===2, est.total.baris);
cek('pcs tiga', est.total.pcs===3, est.total.pcs);
cek('waktu jahit (20x2) = 40', est.total.waktuJahit===40, est.total.waktuJahit);
cek('waktu potong (5x2) = 10', est.total.waktuPotong===10, est.total.waktuPotong);
cek('total waktu 50', est.total.waktu===50, est.total.waktu);
cek('upah (15000x2) = 30000', est.total.upah===30000, est.total.upah);
cek('sesi SIANG memisahkan dua pcs', est.sesi.SIANG.pcs===2&&est.sesi.SIANG.upah===30000);
cek('sesi PAGI memisahkan satu pcs', est.sesi.PAGI.pcs===1);
cek('dua penjahit terhitung', est.jumlahPenjahit===2, est.jumlahPenjahit);
const opik=est.penjahit.filter(p=>p.nama==='OPIK')[0];
cek('penjahit OPIK memuat rinciannya', Boolean(opik)&&opik.pcs===2&&opik.upah===30000);
cek('rincian per SKU ikut dikirim', Boolean(opik)&&opik.items.length===1&&opik.items[0].sku==='SARKUR 120/5');
cek('baris tanpa harga dihitung, bukan dianggap galat', est.barisTanpaHarga===1, est.barisTanpaHarga);
cek('SKU tanpa harga dilaporkan', est.skuTanpaHarga.length===1&&est.skuTanpaHarga[0].sku==='TAS MIKA AJA', JSON.stringify(est.skuTanpaHarga));
cek('pcs baris tanpa harga tetap dihitung', est.total.pcs===3);

console.log('=== 14: matriks peran ===');
const pak=sb.getAntrianProduksi(tPack,'');
const adm=sb.getAntrianProduksi(tAdmin,'');
const sup=sb.getAntrianProduksi(tSuper,'');
cek('packing boleh membaca antrian', pak.ringkasan.baris>0);
cek('packing tidak menerima nominal', pak.uangDisembunyikan===true&&pak.pesanan.every(p=>p.hargaSatuan===undefined));
cek('admin tidak menerima nominal', adm.uangDisembunyikan===true&&adm.pesanan.every(p=>p.hargaSatuan===undefined));
cek('superadmin menerima nominal', sup.uangDisembunyikan===false&&sup.pesanan.every(p=>p.hargaSatuan!==undefined));
const estPack=sb.getProduksiRingkasan(tPack,hariIni);
const estAdm=sb.getProduksiRingkasan(tAdmin,hariIni);
cek('packing tetap menerima beban kerja', estPack.total.pcs===3&&estPack.total.waktu===50);
cek('packing tidak menerima upah', estPack.total.upah===undefined&&estPack.uangDisembunyikan===true);
cek('admin tidak menerima upah', estAdm.total.upah===undefined&&estAdm.uangDisembunyikan===true);
cek('upah per sesi juga dipotong', estPack.sesi.PAGI.upah===undefined&&estPack.sesi.SIANG.upah===undefined);
cek('upah per penjahit juga dipotong', estPack.penjahit.every(p=>p.upah===undefined));
cek('upah per rincian juga dipotong', estPack.penjahit.every(p=>(p.items||[]).every(it=>it.upah===undefined&&it.hargaSatuan===undefined)));
cek('superadmin menerima upah', sb.getProduksiRingkasan(tSuper,hariIni).total.upah===30000);
for(const [nama,aksi,peran] of [['simpan hasil',()=>sb.simpanProduksiBatch(tPack,[]),'PACKING'],['simpan harga',()=>sb.saveHargaProses(tPack,[]),'PACKING']]){
  const pesan=lempar(aksi)||'';
  cek(nama+' ditolak untuk packing', pesan.indexOf('Peran PACKING tidak berhak')!==-1, pesan.slice(0,50));
}
/* Penarikan antrian ke daftar kerja sudah tidak ada lagi: daftar kerjanya
   adalah daftar pesanan menunggu pickup itu sendiri. */
cek('RPC tarik antrian sudah tidak ada lagi', typeof sb.tarikAntrianProduksi==='undefined');
const galatHarga=lempar(()=>sb.saveHargaProses(tAdmin,[{sku:'X9',harga:0,jahit:0,potong:0}]))||'';
cek('harga nol seluruhnya ditolak', galatHarga.indexOf('isi minimal salah satu')!==-1, galatHarga.slice(0,60));
const galatNegatif=lempar(()=>sb.saveHargaProses(tAdmin,[{sku:'X9',harga:-1}]))||'';
cek('harga negatif ditolak', galatNegatif.indexOf('tidak boleh negatif')!==-1, galatNegatif.slice(0,60));

console.log('=== 15: aturan kamus harga ===');
pros().data.length=1;
pros().appendRow(['SARKUR 120/5',12000,20,5]);
pros().appendRow(['SARKUR 120/5',15000,22,6]);
sb.hapusCacheProses_();
a=sb.getAntrianProduksi(tSuper,'');
cek('baris SKU terakhir yang berharga yang dipakai (15000)',
  hargaUntuk('SN-P1','Coffee')===15000, hargaUntuk('SN-P1','Coffee'));
pros().appendRow(['SARKUR 120/5 COFFEE',22000,30,8]);
sb.hapusCacheProses_();
a=sb.getAntrianProduksi(tSuper,'');
cek('nama gabungan lebih khusus daripada nama SKU (22000)',
  hargaUntuk('SN-P1','Coffee')===22000, hargaUntuk('SN-P1','Coffee'));
cek('variasi lain tetap memakai harga SKU (15000)',
  hargaUntuk('SN-P5','Navy')===15000, hargaUntuk('SN-P5','Navy'));
/* Butir 10 dokumen: satu baris baru yang belum dihargai tidak boleh membuat
   upah SKU itu menjadi nol. */
pros().appendRow(['SARKUR 120/5','','','']);
sb.hapusCacheProses_();
a=sb.getAntrianProduksi(tSuper,'');
cek('baris tanpa angka tidak menghapus harga yang sudah ada',
  hargaUntuk('SN-P1','Coffee')===22000, hargaUntuk('SN-P1','Coffee'));
cek('SKU di luar daftar tetap ditandai belum dihargai', tandanyaUntuk('SN-P1','SINGLE')===true);

console.log('=== 16: satu baris pesanan boleh dikerjakan dua orang ===');
pros().data.length=1;
pros().appendRow(['SARKUR 120/5', 15000, 20, 5]);
sb.hapusCacheProses_();
/* Dua pcs dari satu baris pesanan dapat jatuh ke penjahit berbeda, karena
   pembagian bekerja per pcs. Keduanya harus dapat tersimpan sebagai dua baris
   hasil jahit — tanpa nama penjahit pada kunci, pcs kedua dianggap duplikat dan
   upahnya hilang. */
ord.appendRow(pesanRow('SN-P7','SARKUR 120/5','Coffee',2,'[2] Menunggu Pickup'));
const duaOrang=sb.simpanProduksiBatch(tAdmin,[
  {tanggal:hariIni,sesi:'PAGI',sku:'SARKUR 120/5',variasi:'Coffee',jumlah:1,penjahit:'ADUL',noPesanan:'SN-P7',toko:'BGD'},
  {tanggal:hariIni,sesi:'PAGI',sku:'SARKUR 120/5',variasi:'Coffee',jumlah:1,penjahit:'OPIK',noPesanan:'SN-P7',toko:'BGD'}
]);
cek('dua baris tersimpan untuk satu baris pesanan', duaOrang.ditambah===2, duaOrang.ditambah);
cek('dua penjahit tercatat pada baris pesanan itu',
  jahit().data.slice(1).filter(r=>String(r[6])==='SN-P7').length===2,
  jahit().data.slice(1).filter(r=>String(r[6])==='SN-P7').length);
const kirimUlang=sb.simpanProduksiBatch(tAdmin,[
  {tanggal:hariIni,sesi:'PAGI',sku:'SARKUR 120/5',variasi:'Coffee',jumlah:1,penjahit:'ADUL',noPesanan:'SN-P7',toko:'BGD'},
  {tanggal:hariIni,sesi:'PAGI',sku:'SARKUR 120/5',variasi:'Coffee',jumlah:1,penjahit:'OPIK',noPesanan:'SN-P7',toko:'BGD'}
]);
cek('mengirim ulang tabel yang sama tetap dilewati',
  kirimUlang.ditambah===0&&kirimUlang.dilewati===2, kirimUlang.ditambah+'/'+kirimUlang.dilewati);

console.log('=== variasi dipangkas pada koma ===');
/* Variasi dari pesanan kadang berbunyi "Coffee,BC 90x220": warna di depan koma,
   lalu ukuran yang sudah ada pada SKU. Yang dipakai ERP hanya bagian sebelum koma,
   dan harga per variasi tetap ketemu walau nama baris DATA PROSESnya masih
   memakai teks panjang. */
pros().appendRow(['SARKUR 120/5 COFFEE,BC 90X220',22000,30,8]);
sb.hapusCacheProses_();
ord.appendRow(pesanRow('SN-P8','SARKUR 120/5','Coffee,BC 90x220',1,'[2] Menunggu Pickup'));
const antrianVariasi=sb.getAntrianProduksi(tPack,'').pesanan.filter(x=>x.noPesanan==='SN-P8')[0];
cek('variasi ditampilkan tanpa keterangan sesudah koma', antrianVariasi.variasi==='Coffee', antrianVariasi.variasi);
/* Nominalnya hanya ikut pada sesi yang boleh melihat uang, karena itu harga
   per variasi diperiksa lewat sesi superadmin. */
const variasiSuper=sb.getAntrianProduksi(tSuper,'').pesanan.filter(x=>x.noPesanan==='SN-P8')[0];
cek('nominal tidak ikut pada sesi packing', antrianVariasi.hargaSatuan===undefined, antrianVariasi.hargaSatuan);
cek('harga per variasi tetap ketemu walau namanya panjang', variasiSuper.hargaSatuan===22000,
  variasiSuper.hargaSatuan+' dari '+JSON.stringify(pros().data.slice(1).map(r=>[r[0],r[1]])));

const simpanVariasi=sb.simpanProduksiBatch(tAdmin,[
  {tanggal:hariIni,sesi:'PAGI',sku:'SARKUR 120/5',variasi:'Coffee,BC 90x220',jumlah:1,penjahit:'ADUL',noPesanan:'SN-P8',toko:'BGD'}
]);
const barisVariasi=jahit().data.slice(1).filter(r=>String(r[6])==='SN-P8')[0];
cek('baris tersimpan memakai variasi yang sudah dipangkas', barisVariasi&&String(barisVariasi[3])==='Coffee', barisVariasi&&barisVariasi[3]);
const kirimVariasi=sb.simpanProduksiBatch(tAdmin,[
  {tanggal:hariIni,sesi:'PAGI',sku:'SARKUR 120/5',variasi:'Coffee',jumlah:1,penjahit:'ADUL',noPesanan:'SN-P8',toko:'BGD'}
]);
cek('pengiriman ulang dengan ejaan pendek tetap dianggap sama',
  kirimVariasi.ditambah===0&&kirimVariasi.dilewati===1, kirimVariasi.ditambah+'/'+kirimVariasi.dilewati);
const antrianVariasi2=sb.getAntrianProduksi(tPack,'').pesanan.filter(x=>x.noPesanan==='SN-P8')[0];
cek('barisnya ditandai sudah dijahit', antrianVariasi2.sudahDijahit===true);

console.log('');
console.log('HASIL MODUL PRODUKSI: '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
