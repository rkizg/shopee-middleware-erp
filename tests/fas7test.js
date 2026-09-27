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
  formatDate:()=>'2026-09-27 08:00:00',
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
   FASE 4: KELOLA PENGGUNA DARI DASHBOARD
   Semua uji di bawah memakai mode berlaku, karena penjaga peran tidak
   memeriksa token selama WAJIB_LOGIN masih TIDAK.
   ========================================================================== */
const setWajibLogin_=(nilai)=>{
  const cfg=ss.getSheetByName('Konfigurasi');
  const baris=cfg.data.findIndex(r=>String(r[0]).trim()==='WAJIB_LOGIN');
  cfg.getRange(baris+1,2,1,1).setValues([[nilai]]);
};
setWajibLogin_('YA');

SM.simpanPengguna({kode:'pemilik',nama:'Pemilik Toko',peran:'SUPERADMIN',sandi:'sandiPemilik1'});
SM.simpanPengguna({kode:'packing1',nama:'Packing Satu',peran:'PACKING',sandi:'sandiPacking1'});
SM.simpanPengguna({kode:'admin1',nama:'Admin Satu',peran:'ADMIN',sandi:'sandiAdmin1'});

const sesiSuper=sb.masukDenganKode('pemilik','sandiPemilik1').token;
const sesiPacking=sb.masukDenganKode('packing1','sandiPacking1').token;
const sesiAdmin=sb.masukDenganKode('admin1','sandiAdmin1').token;
const galat=(fn)=>lempar(fn)||'';
const cari=(teks,kata)=>String(teks).indexOf(kata)!==-1;
const barisPengguna_=(kode)=>pngSheet().data.findIndex(r=>String(r[0]).toUpperCase()===kode.toUpperCase());

console.log('=== A: penjaga peran pada tiga RPC baru ===');
cek('RPC daftar menolak permintaan tanpa token', cari(galat(()=>sb.ambilDaftarPengguna('')),'Sesi tidak berlaku'));
cek('RPC daftar menolak token asing', cari(galat(()=>sb.ambilDaftarPengguna('ngawur')),'Sesi tidak berlaku'));
cek('RPC daftar menolak packing', cari(galat(()=>sb.ambilDaftarPengguna(sesiPacking)),'tidak berhak'));
cek('RPC daftar menolak admin', cari(galat(()=>sb.ambilDaftarPengguna(sesiAdmin)),'tidak berhak'));
cek('RPC simpan menolak admin', cari(galat(()=>sb.simpanPenggunaDariDashboard(sesiAdmin,{kode:'x1',nama:'X',peran:'PACKING',sandi:'sandiX1234'})),'tidak berhak'));
cek('RPC ubah status menolak packing', cari(galat(()=>sb.ubahStatusPenggunaDariDashboard(sesiPacking,'PACKING1','TIDAK')),'tidak berhak'));
cek('superadmin diterima', sb.ambilDaftarPengguna(sesiSuper).pengguna.length===3);

console.log('=== B: daftar tidak membocorkan sandi ===');
const d=sb.ambilDaftarPengguna(sesiSuper);
cek('memuat kolom yang dipakai layar', d.pengguna.every(p=>'kode' in p&&'nama' in p&&'peran' in p&&'aktif' in p&&'terakhir_masuk' in p));
cek('tidak ada hash atau salt', d.pengguna.every(p=>!('sandi_hash' in p)&&!('sandi_salt' in p)));
cek('sandi asli tidak ada di jawaban', !cari(JSON.stringify(d),'sandiPemilik1'));
cek('jumlah superadmin aktif ikut dikirim', d.superadminAktif===1, d.superadminAktif);
cek('daftar peran sah ikut dikirim', d.peranSah.join(',')==='PACKING,ADMIN,SUPERADMIN', d.peranSah.join(','));
cek('panjang sandi minimum ikut dikirim', d.panjangSandiMin===6, d.panjangSandiMin);
cek('pelakunya dilaporkan', d.dimintaOleh==='PEMILIK', d.dimintaOleh);

console.log('=== C: membuat akun packing dari layar ===');
let h=sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'packing2',nama:'Budi Packing',peran:'PACKING',email:'budi@contoh.com',sandi:'sandiBudi123'});
cek('dilaporkan ditambahkan', h.berhasil&&h.aksi==='ditambahkan', h.aksi);
cek('sandi langsung berlaku', Boolean(SM.periksaSandi('packing2','sandiBudi123')));
cek('peran dan email tersimpan', SM.getPenggunaByKode('packing2').peran==='PACKING'&&SM.getPenggunaByKode('packing2').email==='budi@contoh.com');
cek('akun baru belum punya sesi', h.sesiDiakhiri===0, h.sesiDiakhiri);
cek('jawaban tidak memuat hash atau sandi', !('sandi_hash' in h.pengguna)&&!cari(JSON.stringify(h),'sandiBudi123'));

console.log('=== D: isian yang salah ditolak server ===');
cek('kode kosong ditolak', cari(galat(()=>sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'',nama:'X',peran:'PACKING',sandi:'sandiX1234'})),'Kode pengguna harus diisi'));
cek('kode berspasi ditolak', cari(galat(()=>sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'pak king',nama:'X',peran:'PACKING',sandi:'sandiX1234'})),'tanpa spasi'));
cek('kode bertanda kutip ditolak', cari(galat(()=>sb.simpanPenggunaDariDashboard(sesiSuper,{kode:"pak'king",nama:'X',peran:'PACKING',sandi:'sandiX1234'})),'tanpa spasi'));
cek('peran ngawur ditolak', cari(galat(()=>sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'x1',nama:'X',peran:'GUDANG',sandi:'sandiX1234'})),'Peran harus salah satu dari'));
cek('sandi pendek ditolak', cari(galat(()=>sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'x1',nama:'X',peran:'PACKING',sandi:'12345'})),'minimal 6 karakter'));
cek('sandi sama dengan kode ditolak', cari(galat(()=>sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'x12345',nama:'X',peran:'PACKING',sandi:'x12345'})),'tidak boleh sama dengan kode'));
cek('akun baru tanpa sandi ditolak', cari(galat(()=>sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'x1',nama:'X',peran:'PACKING'})),'harus diberi sandi'));
cek('nama kosong pada akun baru ditolak', cari(galat(()=>sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'x1',nama:'',peran:'PACKING',sandi:'sandiX1234'})),'Nama pengguna harus diisi'));
cek('email tanpa tanda @ ditolak', cari(galat(()=>sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'x1',nama:'X',peran:'PACKING',email:'buditanpaat',sandi:'sandiX1234'})),'tanda @'));
cek('akun yang gagal tidak ikut tersimpan', SM.getPenggunaByKode('x1')===null);

console.log('=== E: mengubah peran mengakhiri sesi yang berjalan ===');
const kunciBudi=sb.kunciSesiPengguna_('packing2');
const sesiBudi=sb.masukDenganKode('packing2','sandiBudi123').token;
const sesiBudi2=sb.masukDenganKode('packing2','sandiBudi123').token;
cek('dua sesi tercatat untuk satu akun', sb.bacaDaftarToken_(kunciBudi).length===2, sb.bacaDaftarToken_(kunciBudi).length);
cek('sesi packing belum berhak mengelola pengguna', cari(galat(()=>sb.ambilDaftarPengguna(sesiBudi)),'tidak berhak'));
h=sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'packing2',nama:'Budi Packing',peran:'ADMIN',sandi:''});
cek('peran berubah menjadi ADMIN', SM.getPenggunaByKode('packing2').peran==='ADMIN');
cek('kedua sesinya diakhiri', h.sesiDiakhiri===2, h.sesiDiakhiri);
cek('sesi pertama tidak berlaku lagi', cari(galat(()=>sb.ambilDaftarPengguna(sesiBudi)),'Sesi tidak berlaku'));
cek('sesi kedua tidak berlaku lagi', cari(galat(()=>sb.ambilDaftarPengguna(sesiBudi2)),'Sesi tidak berlaku'));

console.log('=== F: mengganti sandi mengakhiri sesi, peran tidak tersentuh ===');
const sesiSandiLama=sb.masukDenganKode('packing2','sandiBudi123').token;
h=sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'packing2',nama:'Budi Packing',peran:'ADMIN',sandi:'sandiBudi456'});
cek('sandi lama tidak berlaku', SM.periksaSandi('packing2','sandiBudi123')===null);
cek('sandi baru berlaku', Boolean(SM.periksaSandi('packing2','sandiBudi456')));
cek('perannya tetap ADMIN', SM.getPenggunaByKode('packing2').peran==='ADMIN');
cek('satu sesi diakhiri', h.sesiDiakhiri===1, h.sesiDiakhiri);
cek('sesi dengan sandi lama berakhir', cari(galat(()=>sb.wajibSesi_(sesiSandiLama,'PACKING')),'Sesi tidak berlaku'));

console.log('=== G: menyunting nama tidak mengakhiri sesi dan tidak mengubah yang lain ===');
const sesiBudiHidup=sb.masukDenganKode('packing2','sandiBudi456').token;
const b2=barisPengguna_('packing2');
const hashAwal=String(pngSheet().data[b2][4]);
h=sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'packing2',nama:'Budi Packing Baru',peran:'ADMIN',email:'budi@contoh.com'});
cek('nama diperbarui', SM.getPenggunaByKode('packing2').nama==='Budi Packing Baru');
cek('hash tidak berubah tanpa sandi baru', String(pngSheet().data[b2][4])===hashAwal);
cek('tidak ada sesi yang diakhiri', h.sesiDiakhiri===0, h.sesiDiakhiri);
cek('sesi yang berjalan masih hidup', sb.wajibSesi_(sesiBudiHidup,'PACKING').kode==='PACKING2');

console.log('=== H: menonaktifkan akun mencabut aksesnya sekarang ===');
cek('satu sesi tercatat sebelum dinonaktifkan', sb.bacaDaftarToken_(kunciBudi).length===1, sb.bacaDaftarToken_(kunciBudi).length);
let s=sb.ubahStatusPenggunaDariDashboard(sesiSuper,'packing2','TIDAK');
cek('ditandai tidak aktif', SM.getPenggunaByKode('packing2').aktif==='TIDAK');
cek('sesinya diakhiri', s.sesiDiakhiri===1, s.sesiDiakhiri);
cek('sesi yang sedang berjalan langsung berakhir', cari(galat(()=>sb.wajibSesi_(sesiBudiHidup,'PACKING')),'Sesi tidak berlaku'));
cek('tidak dapat masuk lagi', SM.periksaSandi('packing2','sandiBudi456')===null);
cek('sandi dan perannya tidak berubah', String(pngSheet().data[b2][4])===hashAwal&&SM.getPenggunaByKode('packing2').peran==='ADMIN');
cek('pesannya menyebut sesi diakhiri', cari(s.pesan,'sesinya diakhiri'), s.pesan);
const ulang=sb.ubahStatusPenggunaDariDashboard(sesiSuper,'packing2','TIDAK');
cek('menekan dua kali tidak mengubah apa pun', ulang.sesiDiakhiri===0&&cari(ulang.pesan,'memang sudah'), ulang.pesan);
cek('kode yang tidak ada ditolak', cari(galat(()=>sb.ubahStatusPenggunaDariDashboard(sesiSuper,'tidakada','TIDAK')),'tidak ada di sheet'));
s=sb.ubahStatusPenggunaDariDashboard(sesiSuper,'packing2','YA');
cek('diaktifkan kembali', SM.getPenggunaByKode('packing2').aktif==='YA');
cek('sandi lama berlaku lagi', Boolean(sb.masukDenganKode('packing2','sandiBudi456').token));

console.log('=== I: superadmin terakhir tidak dapat dikunci ===');
cek('hanya satu superadmin aktif', SM.hitungPenggunaAktif('SUPERADMIN')===1, SM.hitungPenggunaAktif('SUPERADMIN'));
const e1=galat(()=>sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'pemilik',nama:'Pemilik Toko',peran:'ADMIN'}));
cek('perannya ditolak diturunkan', cari(e1,'superadmin aktif terakhir'), e1);
cek('perannya tidak berubah', SM.getPenggunaByKode('pemilik').peran==='SUPERADMIN');
const e2=galat(()=>sb.ubahStatusPenggunaDariDashboard(sesiSuper,'pemilik','TIDAK'));
cek('akunnya ditolak dinonaktifkan', cari(e2,'superadmin aktif terakhir'), e2);
cek('masih aktif', SM.getPenggunaByKode('pemilik').aktif==='YA');
cek('sesi superadmin tidak ikut dibuang', sb.wajibSesi_(sesiSuper,'SUPERADMIN').kode==='PEMILIK');
cek('menyunting namanya masih boleh', sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'pemilik',nama:'Pemilik Toko Baru',peran:'SUPERADMIN'}).aksi==='diperbarui');
sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'pemilik2',nama:'Pemilik Dua',peran:'SUPERADMIN',sandi:'sandiPemilik2'});
cek('dua superadmin aktif', SM.hitungPenggunaAktif('SUPERADMIN')===2, SM.hitungPenggunaAktif('SUPERADMIN'));
h=sb.simpanPenggunaDariDashboard(sesiSuper,{kode:'pemilik2',nama:'Pemilik Dua',peran:'ADMIN'});
cek('penurunan peran boleh saat ada cadangan', SM.getPenggunaByKode('pemilik2').peran==='ADMIN', h.aksi);

console.log('=== J: menu spreadsheet tetap berjalan dan ikut mencabut sesi ===');
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('packing3','Packing Tiga','PACKING','sandiTiga123');
sb.kelolaPenggunaPrompt();
cek('akun baru dibuat dari menu', Boolean(SM.periksaSandi('packing3','sandiTiga123')), alerts[0]?alerts[0].title:'(tidak ada dialog)');
cek('menu melaporkan tersimpan', Boolean(alerts[0]&&alerts[0].title==='Pengguna Disimpan'), alerts[0]?alerts[0].title:'-');
const sesiTiga=sb.masukDenganKode('packing3','sandiTiga123').token;
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('packing3','Packing Tiga','ADMIN','');
sb.kelolaPenggunaPrompt();
cek('peran berubah lewat menu', SM.getPenggunaByKode('packing3').peran==='ADMIN');
cek('sesi berjalan diakhiri lewat menu', cari(galat(()=>sb.wajibSesi_(sesiTiga,'PACKING')),'Sesi tidak berlaku'));
cek('pesan menu menyebut sesinya diakhiri', cari(alerts[0]?alerts[0].body:'','sesi yang sedang berjalan untuk akun ini diakhiri'));

console.log('=== K: keluar membersihkan daftar token dan riwayat mencatat pelakunya ===');
const sesiKeluar=sb.masukDenganKode('packing3','sandiTiga123').token;
cek('daftar token terisi', sb.bacaDaftarToken_(sb.kunciSesiPengguna_('packing3')).length===1, sb.bacaDaftarToken_(sb.kunciSesiPengguna_('packing3')).length);
sb.keluarSesi(sesiKeluar);
cek('token dihapus dari daftar', sb.bacaDaftarToken_(sb.kunciSesiPengguna_('packing3')).length===0);
cek('sesi tidak berlaku setelah keluar', cari(galat(()=>sb.wajibSesi_(sesiKeluar,'PACKING')),'Sesi tidak berlaku'));

const barisLog=logSheet().getDataRange().getValues();
const logTipe=(tipe)=>barisLog.filter(r=>String(r[1])===tipe);
cek('riwayat kelola pengguna tercatat', logTipe('KELOLA_PENGGUNA').length>0, logTipe('KELOLA_PENGGUNA').length);
cek('pelakunya tercatat di kolom Pengguna', logTipe('KELOLA_PENGGUNA').every(r=>String(r[6])==='PEMILIK'));
cek('riwayat nonaktifkan tercatat dua kali', logTipe('UBAH_AKTIF_PENGGUNA').length===2, logTipe('UBAH_AKTIF_PENGGUNA').length);
cek('keterangan nonaktif menyebut sesi diakhiri', logTipe('UBAH_AKTIF_PENGGUNA').some(r=>cari(String(r[4]),'sesi diakhiri')));

console.log('');
console.log('HASIL FASE 4 (kelola pengguna): '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
