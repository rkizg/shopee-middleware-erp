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
    if(typeof r==='string'){const s=this;const a={getValues:()=>[[ '']],setValues(){return a;},setValue(){return a;},setNumberFormat(){return a;},setBackground(){return a;},setFontColor(){return a;},setFontWeight(){return a;},setFontSize(){return a;},setHorizontalAlignment(){return a;},setDataValidation(){return a;}};return a;}
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

class MockSS{
  constructor(){this.sheets={};}
  getSheetByName(n){return this.sheets[n]||null;}
  insertSheet(n){this.sheets[n]=new MockSheet(n);return this.sheets[n];}
  toast(){}
}

const ss=new MockSS();
const alerts=[]; let tidur=0;
const fakeUi={ButtonSet:{OK:'OK',OK_CANCEL:'OK_CANCEL'},Button:{OK:'OK'},
  alert(t,m){alerts.push({title:t,body:String(m)});},prompt(){throw new Error('prompt tidak dipakai');}};

const panggilan=[];
let gagalUntuk={};
let dataPerToko={};
const ShopeeApi={fetchDailyOrders(p){panggilan.push(p);
  if(gagalUntuk[p.shop_id]) throw new Error(gagalUntuk[p.shop_id]);
  return {data:{orders:(dataPerToko[p.shop_id]||[]).slice(),diagnostics:{time_from_wib:'2026-09-24 00:00:00',time_to_wib:'2026-09-27 00:00:00',chunks_total:1,order_sns_found:(dataPerToko[p.shop_id]||[]).length}}};}};

const sb={console,
  SpreadsheetApp:{getActiveSpreadsheet:()=>ss,getUi:()=>fakeUi,
    newDataValidation:()=>({requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return{};}})},
  Utilities:{formatDate:()=>'2026-09-27 08:00:00',sleep:ms=>{tidur+=ms;}},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})},
  CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
  ShopeeApi:ShopeeApi};
sb.globalThis=sb;
vm.createContext(sb);
vm.runInContext(fs.readFileSync(AKAR + 'gas/SheetManager.js','utf8'),sb,{filename:'SheetManager.js'});
vm.runInContext(fs.readFileSync(AKAR + 'gas/Code.js','utf8'),sb,{filename:'Code.js'});
const SM=sb.SheetManager;

let gagal=0;
const cek=(l,ok,x)=>{console.log((ok?'  OK   ':'  GAGAL ')+l+(x!==undefined?'  -> '+x:''));if(!ok)gagal++;};
const ord=()=>ss.getSheetByName('Pesanan Masuk');
const logSheet=()=>ss.getSheetByName('Log_Aktivitas');
const barisSn=sn=>ord().data.filter(r=>String(r[0]).trim()===sn);
const header=()=>ord().data[0];
function pesan(sn,items){return {order_sn:sn,create_time_formatted:'2026-09-27 08:00:00',order_status:'READY_TO_SHIP',
  internal_status:'[1] Siap Packing',buyer_username:'budi',items:items,total_amount:100000,
  actual_shipping_fee:20000,shipping_carrier:'JNE',tracking_number:'RESI-'+sn,note:'',recipient_city:'Bandung'};}
function item(nama,sku,varian,qty){return {item_name:nama,model_sku:sku,model_name:varian,model_quantity_purchased:qty};}

SM.initAllSheets();
SM.saveTokenRecord({shop_id:'111',partner_id:'99',access_token:'ACC-BGD',refresh_token:'R1',expired_at:4000000000,nama_toko:'Begood Bandung',kode_toko:'BGD'});
SM.saveTokenRecord({shop_id:'222',partner_id:'99',access_token:'ACC-BGD2',refresh_token:'R2',expired_at:4000000000,nama_toko:'Begood Jakarta',kode_toko:'BGD2'});

console.log('=== A: nama kolom F dan I tidak lagi berganti saat sinkronisasi ===');
cek('sebelum sync F = Ringkasan Produk', header()[5]==='Ringkasan Produk', header()[5]);
cek('sebelum sync I = Total Qty', header()[8]==='Total Qty', header()[8]);
SM.upsertOrders([pesan('A1',[item('Kaos','SKU-1','Merah',1)])],'BGD');
cek('sesudah sync F tetap Ringkasan Produk', header()[5]==='Ringkasan Produk', header()[5]);
cek('sesudah sync I tetap Total Qty', header()[8]==='Total Qty', header()[8]);
cek('tidak ada lagi nama kolom lama di header', header().indexOf('Nama Produk')===-1 && header().indexOf('Qty')===-1);

console.log('\n=== B: tarik satu toko, hanya baris toko itu yang bertambah ===');
cek('pesanan A1 tercatat sebagai baris toko BGD', barisSn('A1').length===1 && barisSn('A1')[0][16]==='BGD', barisSn('A1')[0]&&barisSn('A1')[0][16]);
cek('baris ditulis lengkap 17 kolom', barisSn('A1')[0].length===17, barisSn('A1')[0].length);
const b1=barisSn('A1')[0];
cek('kolom A-P terisi wajar', b1[1]==='2026-09-27 08:00:00' && b1[5]==='Kaos' && b1[6]==='SKU-1' && b1[8]===1);

console.log('\n=== C: tarik toko kedua, baris toko pertama tidak tersentuh ===');
const sebelum=JSON.stringify(barisSn('A1')[0]);
SM.upsertOrders([pesan('B1',[item('Sepatu','SKU-9','Hitam',1)])],'BGD2');
cek('baris toko pertama identik sebelum dan sesudah', JSON.stringify(barisSn('A1')[0])===sebelum);
cek('pesanan toko kedua tertulis dengan tanda BGD2', barisSn('B1')[0][16]==='BGD2', barisSn('B1')[0][16]);

console.log('\n=== D: baris lama bertanda kosong diadopsi, bukan diduplikasi ===');
ord().appendRow(['LAMA1','2026-09-01 08:00:00','READY_TO_SHIP','[1] Siap Packing','siti','Topi','SKU-L','Biru',1,50000,10000,'JNE','RESI-LAMA','','Surabaya','2026-09-01 08:00:00','']);
cek('baris lama ditambahkan tanpa tanda toko', barisSn('LAMA1')[0][16]==='', JSON.stringify(barisSn('LAMA1')[0][16]));
let r=SM.upsertOrders([pesan('LAMA1',[item('Topi','SKU-L','Biru',1)])],'BGD');
cek('baris lama diperbarui, bukan ditambah', r.added===0&&r.updated===1, 'added='+r.added+' updated='+r.updated);
cek('hanya ada satu baris untuk LAMA1', barisSn('LAMA1').length===1, barisSn('LAMA1').length);
cek('baris lama kini ditandai BGD', barisSn('LAMA1')[0][16]==='BGD', barisSn('LAMA1')[0][16]);
const jmlSebelum=ord().getLastRow();
r=SM.upsertOrders([pesan('LAMA1',[item('Topi','SKU-L','Biru',1)])],'BGD');
cek('dijalankan lagi tidak menambah baris', ord().getLastRow()===jmlSebelum && r.added===0, 'added='+r.added);

console.log('\n=== E: baris milik toko lain tidak dianggap sudah ada ===');
SM.upsertOrders([pesan('A1',[item('Kaos','SKU-1','Merah',1)])],'BGD2');
const a1=barisSn('A1');
cek('A1 kini punya baris terpisah per toko', a1.length===2, a1.length);
cek('tanda tokonya BGD dan BGD2', a1.map(x=>x[16]).sort().join(',')==='BGD,BGD2', a1.map(x=>x[16]).join(','));

console.log('\n=== F: Status Internal Begood yang diubah manual tidak tertimpa ===');
const idxBgd=ord().data.findIndex(x=>String(x[0]).trim()==='A1'&&x[16]==='BGD');
ord().getRange(idxBgd+1,4,1,1).setValues([['[4] Selesai']]);
SM.upsertOrders([pesan('A1',[item('Kaos','SKU-1','Merah',1)])],'BGD');
const stlh=ord().data.findIndex(x=>String(x[0]).trim()==='A1'&&x[16]==='BGD');
cek('status manual [4] Selesai bertahan', ord().data[stlh][3]==='[4] Selesai', ord().data[stlh][3]);

console.log('\n=== G: satu pesanan dua produk tetap dua baris ===');
r=SM.upsertOrders([pesan('C1',[item('Baju','SKU-A','L',1),item('Celana','SKU-B','32',2)])],'BGD');
const c1=barisSn('C1');
cek('menghasilkan dua baris', c1.length===2, c1.length);
cek('keduanya ditandai BGD', c1.every(x=>x[16]==='BGD'));
cek('SKU dan variasi terpisah', c1.map(x=>x[6]+'/'+x[7]).join(' ').includes('SKU-A/L') && c1.map(x=>x[6]).includes('SKU-B'));

console.log('\n=== H: getTokoUntukSync ===');
cek('tanpa argumen mengembalikan dua toko', SM.getTokoUntukSync().length===2, SM.getTokoUntukSync().length);
cek('kode toko menyaring satu toko', SM.getTokoUntukSync('BGD').length===1 && SM.getTokoUntukSync('BGD')[0].shop_id==='111');
cek('tidak membedakan besar-kecil huruf', SM.getTokoUntukSync('bgd2').length===1 && SM.getTokoUntukSync('bgd2')[0].shop_id==='222');
let pesanGalat='';try{SM.getTokoUntukSync('XXX');}catch(e){pesanGalat=e.message;}
cek('kode salah ditolak', pesanGalat!=='');
cek('pesan galat menyebut kode yang tersedia', pesanGalat.includes('BGD')&&pesanGalat.includes('BGD2'), pesanGalat);
const cfgSheet=ss.getSheetByName('Konfigurasi');
const barisTok=cfgSheet.data.findIndex(x=>String(x[0]).trim()==='TOKO_AKTIF');
cfgSheet.getRange(barisTok+1,2,1,1).setValues([['BGD2']]);
cek('TOKO_AKTIF menyaring daftar', SM.getTokoUntukSync().length===1 && SM.getTokoUntukSync()[0].shop_id==='222');
cfgSheet.getRange(barisTok+1,2,1,1).setValues([['SALAH']]);
let pg2='';try{SM.getTokoUntukSync();}catch(e){pg2=e.message;}
cek('TOKO_AKTIF salah tulis ditolak dengan pesan jelas', pg2.includes('TOKO_AKTIF')&&pg2.includes('BGD'), pg2);
cfgSheet.getRange(barisTok+1,2,1,1).setValues([['']]);
cek('TOKO_AKTIF kosong berarti semua toko', SM.getTokoUntukSync().length===2);

console.log('\n=== I: sinkronisasi gabungan lewat syncOrdersCore ===');
dataPerToko={'111':[pesan('S1',[item('Produk-1','SKU-S1','A',1)])],'222':[pesan('S2',[item('Produk-2','SKU-S2','B',1)])]};
alerts.length=0; tidur=0; panggilan.length=0;
let hasil=sb.syncOrdersCore(3,false);
cek('kedua toko ditanyai', panggilan.length===2, panggilan.length);
cek('setiap toko memakai shop_id sendiri', panggilan.map(p=>p.shop_id).sort().join(',')==='111,222', panggilan.map(p=>p.shop_id).join(','));
cek('nilai balik memuat ringkasan per toko', hasil.toko.length===2, hasil.toko.length);
cek('hanya satu kotak dialog untuk banyak toko', alerts.length===1, alerts.length);
cek('ringkasan menyebut kedua toko', alerts[0].body.includes('BGD')&&alerts[0].body.includes('BGD2'));
cek('ada jeda antar toko', tidur>=1000, tidur+' ms');
cek('pesanan tiap toko ditandai kodenya', barisSn('S1')[0][16]==='BGD'&&barisSn('S2')[0][16]==='BGD2');
const logSync=logSheet().data.filter(x=>String(x[1]).trim()==='SYNC_PESANAN');
cek('log SYNC_PESANAN satu baris per toko', logSync.some(x=>x[5]==='BGD')&&logSync.some(x=>x[5]==='BGD2'), logSync.map(x=>x[5]).join(','));

console.log('\n=== J: menarik satu toko saja ===');
alerts.length=0; const sblm=ord().getLastRow(); panggilan.length=0;
hasil=sb.syncOrdersCore(3,false,'BGD2');
cek('hanya toko BGD2 yang ditanyai', panggilan.length===1&&panggilan[0].shop_id==='222', panggilan.length);
cek('data sama tidak menambah baris', ord().getLastRow()===sblm, ord().getLastRow()+' vs '+sblm);
cek('satu toko memakai dialog rinci', alerts.length===1&&alerts[0].body.includes('[SUKSES]'), alerts[0]&&alerts[0].body.slice(0,30));

console.log('\n=== K: satu toko gagal, toko lain tetap jalan ===');
gagalUntuk={'222':'Access token kedaluwarsa'}; alerts.length=0;
dataPerToko={'111':[pesan('S3',[item('Produk-3','SKU-S3','C',1)])],'222':[]};
hasil=sb.syncOrdersCore(3,false);
cek('tidak melempar walau satu toko gagal', hasil.success===true);
cek('nilai balik memisahkan berhasil dan gagal', hasil.toko.filter(t=>t.success).length===1&&hasil.toko.filter(t=>!t.success).length===1);
cek('toko yang berhasil tetap tersimpan', barisSn('S3').length===1&&barisSn('S3')[0][16]==='BGD');
cek('ringkasan menyebut kegagalan', alerts[0].body.includes('GAGAL')&&alerts[0].body.includes('kedaluwarsa'), alerts[0].body.slice(0,90));
const logGagal=logSheet().data.filter(x=>String(x[4]).includes('kedaluwarsa'));
cek('kegagalan tercatat dengan kode toko', logGagal.length>0&&logGagal[0][5]==='BGD2', logGagal[0]&&logGagal[0][5]);

console.log('\n=== L: seluruh toko gagal tetap dianggap gagal ===');
gagalUntuk={'111':'Token 111 rusak','222':'Token 222 rusak'};
let lempar='';try{sb.syncOrdersCore(3,false);}catch(e){lempar=e.message;}
cek('melempar bila seluruh toko gagal', lempar!=='');
cek('pesan memuat kedua kegagalan', lempar.includes('Token 111 rusak')&&lempar.includes('Token 222 rusak'), lempar);
gagalUntuk={};

console.log('\n=== M: toko tanpa Kode Toko tetap ditarik, tanpa tanda ===');
SM.saveTokenRecord({shop_id:'333',partner_id:'99',access_token:'ACC-KETIGA',refresh_token:'R3',expired_at:4000000000,nama_toko:'Begood Ketiga'});
dataPerToko={'111':[],'222':[],'333':[pesan('S4',[item('Produk-4','SKU-S4','D',1)])]};
alerts.length=0;
hasil=sb.syncOrdersCore(3,false);
cek('toko tanpa kode tetap ikut ditarik', barisSn('S4').length===1, barisSn('S4').length);
cek('barisnya dibiarkan tanpa tanda toko', barisSn('S4')[0][16]==='', JSON.stringify(barisSn('S4')[0][16]));
const logTanpaKode=logSheet().data.filter(x=>String(x[4]).includes('Kode Toko (kolom J)'));
cek('peringatan kolom J tercatat di log', logTanpaKode.length>0);
cek('log memakai shop_id sebagai penanda', logTanpaKode[0]&&logTanpaKode[0][5]==='333', logTanpaKode[0]&&logTanpaKode[0][5]);
let pgTiga='';try{SM.getTokoUntukSync('333');}catch(e){pgTiga=e.message;}
cek('toko tanpa kode tidak bisa ditunjuk lewat kode', pgTiga!=='');
cek('pesannya menyebut kolom J', pgTiga.includes('kolom J'), pgTiga);

console.log('\n=== N: pencarian nomor SN menelusuri semua toko ===');
dataPerToko={'111':[],'222':[pesan('SN-CARI',[item('Produk-5','SKU-S5','E',1)])],'333':[]};
alerts.length=0;
const snHasil=sb.syncOrdersBySnCore('SN-CARI',false);
cek('SN ditemukan di toko kedua', snHasil.success===true&&snHasil.toko==='BGD2', snHasil.toko);
cek('barisnya ditandai BGD2', barisSn('SN-CARI')[0][16]==='BGD2', barisSn('SN-CARI')[0][16]);
cek('dialog menyebut toko penemunya', alerts[0].body.includes('BGD2'), alerts[0].body.slice(0,80));

console.log('\n=== O: ubah status dari dashboard tidak menimpa kode toko ===');
dataPerToko={'111':[pesan('T1',[item('Produk-T','SKU-T','T',1)])],'222':[]};
sb.syncOrdersCore(3,false,'BGD');
let iT1=ord().data.findIndex(x=>String(x[0]).trim()==='T1');
cek('sebelum: kode toko terisi', ord().data[iT1][16]==='BGD', ord().data[iT1][16]);
SM.updateBatchInternalStatus(['T1'],'[4] Selesai');
iT1=ord().data.findIndex(x=>String(x[0]).trim()==='T1');
cek('status berubah jadi [4] Selesai', ord().data[iT1][3]==='[4] Selesai', ord().data[iT1][3]);
cek('kode toko kolom Q TIDAK tertimpa stempel waktu', ord().data[iT1][16]==='BGD', JSON.stringify(ord().data[iT1][16]));
cek('waktu sinkronisasi masuk kolom P', String(ord().data[iT1][15]).startsWith('2026-09-27'), JSON.stringify(ord().data[iT1][15]));

console.log('\n=== P: variasi dipangkas pada koma saat pesanan masuk ===');
/* Variasi dari Shopee kadang berbunyi "Lilac,BC 90x220": warna di depan koma,
   lalu ukuran yang sudah tercermin pada SKU. Yang disimpan adalah bagian sebelum
   koma, pada ketiga jalan penulisan: pesanan baru dengan rincian barang, pesanan
   lama yang diperbarui, dan pesanan tanpa rincian barang. */
const ordP=ord();
ordP.data.length=1;
dataPerToko={'111':[pesan('VAR-1',[item('Sarung Bantal','SARUNG BANTAL PREMIUM','Lilac,BC 90x220',1)])],'222':[]};
sb.syncOrdersCore(3,false,'BGD');
cek('pesanan baru menyimpan variasi tanpa keterangan sesudah koma',
  String(barisSn('VAR-1')[0][7])==='Lilac', JSON.stringify(barisSn('VAR-1')[0][7]));
SM.upsertOrders([pesan('VAR-1',[item('Sarung Bantal','SARUNG BANTAL PREMIUM','Lilac,BC 90x220',1)])],'BGD');
cek('penarikan ulang tidak mengembalikan teks panjangnya',
  String(barisSn('VAR-1')[0][7])==='Lilac', JSON.stringify(barisSn('VAR-1')[0][7]));
cek('SKU-nya tidak ikut dipangkas', String(barisSn('VAR-1')[0][6])==='SARUNG BANTAL PREMIUM', barisSn('VAR-1')[0][6]);
SM.upsertOrders([{order_sn:'VAR-2',create_time_formatted:'2026-09-27 08:00:00',order_status:'READY_TO_SHIP',
  internal_status:'[1] Siap Packing',buyer_username:'budi',variation_summary:'Coffee,120x200x5',total_items_count:2}],'BGD');
cek('pesanan tanpa rincian barang ikut dipangkas',
  String(barisSn('VAR-2')[0][7])==='Coffee', JSON.stringify(barisSn('VAR-2')[0][7]));
const sprei=SM.upsertOrders([pesan('VAR-3',[item('Sprei','SPREI DK 90/25 SET','Biru',1)])],'BGD');
cek('variasi tanpa koma dibiarkan apa adanya',
  sprei.added===1 && String(barisSn('VAR-3')[0][7])==='Biru', JSON.stringify(barisSn('VAR-3')[0][7]));

console.log('\nHASIL FASE 3: '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
