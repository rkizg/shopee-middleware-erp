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
  /* formatDate harus benar-benar menghormati format yang diminta, karena seri
     harian grafik dibentuk darinya. Mock yang selalu menjawab satu tanggal
     tetap tidak akan bisa menguji grafik per hari sama sekali. */
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
   GRAFIK: agregat harian, status, dan toko dari getDashboardSummary
   ========================================================================== */
const hariJakarta_=(offsetHari)=>{
  const j=new Date(Date.now()+7*3600*1000-offsetHari*86400000);
  const p=(n)=>String(n).padStart(2,'0');
  return j.getUTCFullYear()+'-'+p(j.getUTCMonth()+1)+'-'+p(j.getUTCDate());
};

const pesanRow=(sn,hari,status,amount,kurir,toko,qty,sku)=>[
  sn, hari+' 08:00:00','READY_TO_SHIP',status,'budi',sku||sn,(sku||sn)+'-V','varian',qty||1,amount,
  10000,kurir,'RESI-'+sn,'',  'Bandung', hari+' 08:00:00', toko
];

const ord=ss.getSheetByName('Pesanan Masuk');
ord.data.length=1;
const H0=hariJakarta_(0), H1=hariJakarta_(1), H5=hariJakarta_(5), H20=hariJakarta_(20);
ord.appendRow(pesanRow('SN-A',H0,'[1] Siap Packing',100000,'JNE','BGD1'));
ord.appendRow(pesanRow('SN-B',H0,'[1] Siap Packing',50000,'SPX','BGD1'));
ord.appendRow(pesanRow('SN-C',H0,'[4] Selesai',30000,'JNE','BGD2'));
ord.appendRow(pesanRow('SN-D',H1,'[1] Siap Packing',200000,'JNE','BGD1'));
ord.appendRow(pesanRow('SN-E',H1,'[1] Siap Packing',200000,'JNE','BGD1'));
ord.appendRow(pesanRow('SN-F',H5,'[2] Menunggu Pickup',70000,'SPX','BGD1'));
ord.appendRow(pesanRow('SN-G',H20,'[4] Selesai',90000,'JNE','BGD1'));
/* Satu pesanan yang dipecah menjadi dua baris produk: dihitung sekali. */
ord.appendRow(pesanRow('SN-B',H0,'[1] Siap Packing',50000,'SPX','BGD1',3,'SKU-X'));

console.log('=== A: seri harian empat belas hari ===');
let d=SM.getDashboardSummary('');
cek('seri memuat empat belas hari', d.seriHarian.length===14, d.seriHarian.length);
cek('hari terakhir adalah hari ini', d.seriHarian[13].tanggal===H0, d.seriHarian[13].tanggal);
cek('hari pertama empat belas hari lalu', d.seriHarian[0].tanggal===hariJakarta_(13), d.seriHarian[0].tanggal);
cek('hari ini tiga pesanan', d.seriHarian[13].jumlah===3, d.seriHarian[13].jumlah);
cek('omzet hari ini 180000', d.seriHarian[13].omzet===180000, d.seriHarian[13].omzet);
cek('kemarin dua pesanan', d.seriHarian[12].jumlah===2, d.seriHarian[12].jumlah);
cek('omzet kemarin 400000', d.seriHarian[12].omzet===400000, d.seriHarian[12].omzet);
cek('pesanan yang dipecah dua baris tetap dihitung sekali', d.seriHarian[13].jumlah===3, d.seriHarian[13].jumlah);
const limaHari=d.seriHarian.filter(h=>h.tanggal===H5)[0];
cek('hari lima hari lalu terisi satu', limaHari&&limaHari.jumlah===1, limaHari?limaHari.jumlah:'-' );
const kosong=d.seriHarian.filter(h=>h.jumlah===0);
cek('hari tanpa pesanan tetap muncul dengan angka nol', kosong.length===11, kosong.length);
cek('pesanan di luar empat belas hari tidak ikut', d.seriHarian.reduce((t,h)=>t+h.jumlah,0)===6, d.seriHarian.reduce((t,h)=>t+h.jumlah,0));
cek('total pesanan tetap menghitung semuanya', d.stats.totalOrders===7, d.stats.totalOrders);

console.log('=== B: sebaran status internal ===');
cek('status terbanyak di urutan pertama', d.statusStats[0].nama==='[1] Siap Packing'&&d.statusStats[0].jumlah===4, JSON.stringify(d.statusStats[0]));
cek('status lain ikut terbaca', d.statusStats.some(s=>s.nama==='[4] Selesai'&&s.jumlah===2));
cek('jumlah seluruh sebaran sama dengan total pesanan', d.statusStats.reduce((t,s)=>t+s.jumlah,0)===7, d.statusStats.reduce((t,s)=>t+s.jumlah,0));
cek('urut dari yang terbanyak', d.statusStats.every((s,i)=>i===0||d.statusStats[i-1].jumlah>=s.jumlah));

console.log('=== C: sebaran toko ===');
cek('toko terbanyak di urutan pertama', d.tokoStats[0].nama==='BGD1'&&d.tokoStats[0].jumlah===6, JSON.stringify(d.tokoStats[0]));
cek('toko kedua terbaca', d.tokoStats.some(s=>s.nama==='BGD2'&&s.jumlah===1));

console.log('=== D: cakupan satu toko menyaring grafiknya juga ===');
const bgd1=SM.getDashboardSummary('BGD1');
cek('seri BGD1 tidak memuat pesanan BGD2', bgd1.seriHarian[13].jumlah===2, bgd1.seriHarian[13].jumlah);
cek('omzet BGD1 hanya dari tokonya', bgd1.seriHarian[13].omzet===150000, bgd1.seriHarian[13].omzet);
cek('sebaran tokonya hanya BGD1', bgd1.tokoStats.length===1&&bgd1.tokoStats[0].nama==='BGD1', JSON.stringify(bgd1.tokoStats));
cek('sebaran status BGD1 lebih kecil', bgd1.statusStats.reduce((t,s)=>t+s.jumlah,0)===6, bgd1.statusStats.reduce((t,s)=>t+s.jumlah,0));

console.log('=== E: sebaran dibatasi enam baris dan tetap lengkap jumlahnya ===');
for(let i=1;i<=8;i++) ord.appendRow(pesanRow('SN-Z'+i,H0,'[9] Status Uji '+i,1000,'JNE','BGD3'));
const banyak=SM.getDashboardSummary('');
cek('sebaran status dipotong enam', banyak.statusStats.length===6, banyak.statusStats.length);
cek('yang dipotong adalah yang paling sedikit', banyak.statusStats.every(s=>s.jumlah>=banyak.statusStats[5].jumlah));

console.log('=== F: satu status, dua satuan angka ===');
/* Satu pesanan yang berisi dua produk menjadi dua baris di sheet. Panel
   antrian menghitung pesanannya, filter status menghitung barisnya. */
ord.data.length=1;
ord.appendRow(pesanRow('SN-P1',H0,'[1] Siap Packing',120000,'JNE','BGD1'));
ord.appendRow(pesanRow('SN-P1',H0,'[1] Siap Packing',120000,'JNE','BGD1',2,'SKU-P2'));
ord.appendRow(pesanRow('SN-P2',H0,'[1] Siap Packing',90000,'SPX','BGD1'));
const inv=SM.getStatusInventory('');
const siap=inv.filter((x)=>x.status==='[1] Siap Packing')[0];
const ringkas2=SM.getDashboardSummary('');
cek('filter status menghitung baris', siap&&siap.jumlah===3, siap?siap.jumlah:'-');
cek('panel antrian menghitung pesanan unik', ringkas2.stats.siapPacking===2, ringkas2.stats.siapPacking);
cek('selisihnya satuan, bukan galat hitung', siap.jumlah===ringkas2.stats.siapPacking+1);
cek('inventaris tetap menyebut semua status', inv.length>=1&&inv[0].status==='[1] Siap Packing');

console.log('');
console.log('HASIL GRAFIK (server): '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
