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

console.log('=== A: skema sheet baru ===');
cek('sheet Pengguna dibuat', Boolean(pngSheet()));
cek('header Pengguna 9 kolom', pngSheet().data[0].length===9, JSON.stringify(pngSheet().data[0]));
cek('kolom sandi tidak bernama Sandi saja', pngSheet().data[0][4]==='Sandi (hash)'&&pngSheet().data[0][5]==='Sandi (salt)');
cek('header log 7 kolom dengan Pengguna', logSheet().data[0].length===7&&logSheet().data[0][6]==='Pengguna', JSON.stringify(logSheet().data[0]));

console.log('=== C: menyimpan pengguna ===');
let hasil=SM.simpanPengguna({kode:'pemilik',nama:'Pemilik Toko',peran:'SUPERADMIN',email:'pemilik@contoh.com',sandi:'sandiRahasia1'});
cek('pengguna baru ditambahkan', hasil.aksi==='ditambahkan'&&hasil.kode==='PEMILIK', JSON.stringify(hasil));
cek('satu baris pengguna', pngSheet().getLastRow()===2, pngSheet().getLastRow());
cek('sandi asli tidak tersimpan di sheet', JSON.stringify(pngSheet().data).indexOf('sandiRahasia1')===-1);
cek('hash dan salt terisi', String(pngSheet().data[1][4]).length>20&&String(pngSheet().data[1][5]).length>10);
const hashPemilik=String(pngSheet().data[1][4]);
const dibuatPemilik=String(pngSheet().data[1][7]);

const g1=lempar(()=>SM.simpanPengguna({kode:'x',nama:'X',peran:'SUPERADMIN',sandi:'12345'}));
cek('sandi kurang dari 6 karakter ditolak', Boolean(g1&&g1.includes('minimal 6')), g1);
const g2=lempar(()=>SM.simpanPengguna({kode:'y',nama:'Y',peran:'RAJA',sandi:'sandiPanjang1'}));
cek('peran tidak dikenal ditolak', Boolean(g2&&g2.includes('tidak dikenal')), g2);
const g3=lempar(()=>SM.simpanPengguna({kode:'z',nama:'Z',peran:'PACKING'}));
cek('pengguna baru tanpa sandi ditolak', Boolean(g3&&g3.includes('harus diberi sandi')), g3);
const g4=lempar(()=>SM.simpanPengguna({kode:'',nama:'Z',peran:'PACKING',sandi:'sandiPanjang1'}));
cek('kode kosong ditolak', Boolean(g4&&g4.includes('Kode')), g4);

SM.simpanPengguna({kode:'pemilik',nama:'Nama Diubah',peran:'ADMIN'});
cek('nama dan peran berubah', pngSheet().data[1][1]==='Nama Diubah'&&pngSheet().data[1][2]==='ADMIN');
cek('hash lama tetap saat sandi tidak diisi', String(pngSheet().data[1][4])===hashPemilik);
cek('waktu dibuat tetap', String(pngSheet().data[1][7])===dibuatPemilik, String(pngSheet().data[1][7]));

SM.simpanPengguna({kode:'pemilik',nama:'Nama Diubah',peran:'SUPERADMIN',sandi:'sandiBaru2026'});
cek('hash berganti saat sandi diisi', String(pngSheet().data[1][4])!==hashPemilik);
cek('sandi lama tidak berlaku lagi', SM.periksaSandi('PEMILIK','sandiRahasia1')===null);
cek('sandi baru berlaku', Boolean(SM.periksaSandi('pemilik','sandiBaru2026')));

console.log('=== D: pemeriksaan sandi ===');
SM.simpanPengguna({kode:'admin1',nama:'Admin Satu',peran:'ADMIN',email:'admin@contoh.com',sandi:'sandiAdmin1'});
SM.simpanPengguna({kode:'packing1',nama:'Packing Satu',peran:'PACKING',sandi:'sandiPacking1'});
SM.simpanPengguna({kode:'nonaktif1',nama:'Mantan',peran:'PACKING',sandi:'sandiMantan1',aktif:'TIDAK'});
cek('kode tidak membedakan besar-kecil huruf', Boolean(SM.periksaSandi('ADMIN1','sandiAdmin1')));
cek('sandi salah ditolak', SM.periksaSandi('admin1','sandiSalah1')===null);
cek('kode tidak dikenal ditolak', SM.periksaSandi('tidakada','sandiAdmin1')===null);
cek('akun tidak aktif ditolak', SM.periksaSandi('nonaktif1','sandiMantan1')===null);
cek('hasil tidak memuat hash atau salt', !('sandi_hash' in SM.periksaSandi('admin1','sandiAdmin1')));

console.log('=== E: daftar pengguna tidak membocorkan sandi ===');
const daftar=SM.getPenggunaRecords();
cek('empat pengguna terbaca', daftar.length===4, daftar.length);
cek('daftar tidak memuat hash', daftar.every(p=>!('sandi_hash' in p)&&!('sandi' in p)));
cek('peran terbaca', daftar.filter(p=>p.kode==='ADMIN1')[0].peran==='ADMIN');

console.log('=== F: hitung pengguna aktif ===');
cek('superadmin aktif 1', SM.hitungPenggunaAktif('SUPERADMIN')===1, SM.hitungPenggunaAktif('SUPERADMIN'));
cek('packing aktif 1, yang nonaktif tidak dihitung', SM.hitungPenggunaAktif('PACKING')===1, SM.hitungPenggunaAktif('PACKING'));
cek('seluruh pengguna aktif 3', SM.hitungPenggunaAktif()===3, SM.hitungPenggunaAktif());

console.log('=== G: catat masuk ===');
SM.catatMasuk('admin1');
cek('waktu masuk terakhir terisi', String(pngSheet().data[2][8]).length>10, String(pngSheet().data[2][8]));
cek('kode tidak dikenal tidak mengubah apa pun', SM.catatMasuk('tidakada')===false);

console.log('=== H: sesi dan penjaga peran ===');
/* Penanda WAJIB_LOGIN dibaca dari sheet Konfigurasi. Uji bagian H sampai L
   memerlukan mode berlaku, karena penjaganya tidak memeriksa token selama
   mode uji. */
const setWajibLogin_=(nilai)=>{
  const cfg=ss.getSheetByName('Konfigurasi');
  const baris=cfg.data.findIndex(r=>String(r[0]).trim()==='WAJIB_LOGIN');
  cfg.getRange(baris+1,2,1,1).setValues([[nilai]]);
};
setWajibLogin_('YA');

const sesiAdmin=sb.buatSesi_({kode:'admin1',nama:'Admin Satu',peran:'ADMIN'});
cek('token sesi dibuat', Boolean(sesiAdmin.token)&&sesiAdmin.token.length>20, sesiAdmin.token.length);
cek('peran tersimpan di sesi', sesiAdmin.pengguna.peran==='ADMIN');
cek('sesi dibaca kembali dari token', sb.sesiDariToken_(sesiAdmin.token).kode==='ADMIN1');
cek('token kosong ditolak', sb.sesiDariToken_('')===null);
cek('token tidak dikenal ditolak', sb.sesiDariToken_('ngawur')===null);
cek('penjaga menerima peran lebih tinggi', sb.wajibSesi_(sesiAdmin.token,'PACKING').peran==='ADMIN');
cek('penjaga menerima peran setara', sb.wajibSesi_(sesiAdmin.token,'ADMIN').kode==='ADMIN1');
const t1=lempar(()=>sb.wajibSesi_(sesiAdmin.token,'SUPERADMIN'));
cek('penjaga menolak peran yang kurang', Boolean(t1&&t1.includes('tidak berhak')), t1);
const t2=lempar(()=>sb.wajibSesi_('','ADMIN'));
cek('penjaga menolak tanpa token', Boolean(t2&&t2.includes('Sesi tidak berlaku')), t2);
const t3=lempar(()=>sb.wajibSesi_(sb.buatSesi_({kode:'p',peran:'PACKING'}).token,'ADMIN'));
cek('peran PACKING ditolak pada aksi ADMIN', Boolean(t3&&t3.includes('PACKING')), t3);
cek('peran SUPERADMIN lolos pada aksi ADMIN', sb.wajibSesi_(sb.buatSesi_({kode:'s',peran:'SUPERADMIN'}).token,'ADMIN').peran==='SUPERADMIN');

console.log('=== I: masuk dengan kode dan sandi ===');
const masuk=sb.masukDenganKode('admin1','sandiAdmin1');
cek('masuk berhasil', masuk.berhasil===true&&Boolean(masuk.token));
cek('peran ikut dikembalikan', masuk.pengguna.peran==='ADMIN');
cek('token hasil masuk bisa dipakai', sb.sesiDariToken_(masuk.token).kode==='ADMIN1');
const logMasuk=logSheet().data.filter(x=>String(x[1]).trim()==='MASUK');
cek('masuk tercatat di log', logMasuk.length>0);
cek('log mencatat siapa yang masuk', String(logMasuk[logMasuk.length-1][6])==='ADMIN1', String(logMasuk[logMasuk.length-1][6]));

const gagalMasuk=lempar(()=>sb.masukDenganKode('admin1','sandiSalah'));
cek('sandi salah ditolak', Boolean(gagalMasuk&&gagalMasuk.includes('salah')), gagalMasuk);
const logGagal=logSheet().data.filter(x=>String(x[1]).trim()==='MASUK_GAGAL');
cek('percobaan gagal tercatat', logGagal.length>0);
cek('catatan gagal tidak memuat sandi', String(logGagal[logGagal.length-1][4]).indexOf('sandiSalah')===-1);

console.log('=== J: pembatasan percobaan ===');
for(let i=0;i<5;i++){ lempar(()=>sb.masukDenganKode('packing1','salahTerus')); }
const terkunci=lempar(()=>sb.masukDenganKode('packing1','sandiPacking1'));
cek('setelah lima kali gagal, kode dikunci walau sandi benar', Boolean(terkunci&&terkunci.includes('Terlalu banyak')), terkunci);
cek('penghitung gagal tersimpan', Number(cacheService.get('GAGAL_MASUK_PACKING1'))===5, cacheService.get('GAGAL_MASUK_PACKING1'));
cek('kode lain tidak ikut terkunci', sb.masukDenganKode('admin1','sandiAdmin1').berhasil===true);

console.log('=== K: masuk dengan email ===');
identitasAktif='';
let em=sb.masukDenganEmail();
cek('email tak terbaca: gagal dengan alasan jelas', em.berhasil===false&&em.alasan==='EMAIL_TIDAK_TERBACA', em.alasan);
identitasAktif='orangasing@contoh.com';
em=sb.masukDenganEmail();
cek('email belum terdaftar: gagal', em.berhasil===false&&em.alasan==='EMAIL_TIDAK_TERDAFTAR', em.alasan);
identitasAktif='admin@contoh.com';
em=sb.masukDenganEmail();
cek('email terdaftar: masuk tanpa sandi', em.berhasil===true&&em.pengguna.peran==='ADMIN', JSON.stringify(em.pengguna));
cek('sesi email bisa dipakai', sb.sesiDariToken_(em.token).kode==='ADMIN1');
SM.simpanPengguna({kode:'nonaktif1',nama:'Mantan',peran:'PACKING',email:'nonaktif@contoh.com',aktif:'TIDAK'});
identitasAktif='nonaktif@contoh.com';
em=sb.masukDenganEmail();
cek('email terdaftar tetapi akun nonaktif: ditolak', em.berhasil===false&&em.alasan==='AKUN_TIDAK_AKTIF', em.alasan);

console.log('=== L: keluar ===');
const tokenKeluar=sb.masukDenganKode('admin1','sandiAdmin1').token;
cek('sebelum keluar sesi berlaku', sb.siapaSaya(tokenKeluar).masuk===true);
sb.keluarSesi(tokenKeluar);
cek('sesudah keluar sesi tidak berlaku', sb.siapaSaya(tokenKeluar).masuk===false);
cek('penjaga menolak token yang sudah keluar', Boolean(lempar(()=>sb.wajibSesi_(tokenKeluar,'PACKING'))));
cek('keluar tercatat di log', logSheet().data.some(x=>String(x[1]).trim()==='KELUAR'));

console.log('=== M: pengguna ikut tercatat di log ===');
const logTerakhir=logSheet().data[logSheet().data.length-1];
cek('baris log punya tujuh kolom', logTerakhir.length>=7, logTerakhir.length);

console.log('=== N: penyandian sandi, dinilai dari isi sheet ===');
SM.simpanPengguna({kode:'uji1',nama:'Uji Satu',peran:'PACKING',sandi:'sandiSama123'});
SM.simpanPengguna({kode:'uji2',nama:'Uji Dua',peran:'PACKING',sandi:'sandiSama123'});
const semuaIsi=JSON.stringify(pngSheet().data);
const bUji1=pngSheet().data.filter(r=>r[0]==='UJI1')[0];
const bUji2=pngSheet().data.filter(r=>r[0]==='UJI2')[0];
cek('sandi asli tidak muncul di sheet sama sekali', semuaIsi.indexOf('sandiSama123')===-1);
cek('yang tersimpan hash 32 byte (44 karakter base64)', String(bUji1[4]).length===44, String(bUji1[4]).length);
cek('salt tiap pengguna berbeda', String(bUji1[5])!==String(bUji2[5]), String(bUji1[5])+' vs '+String(bUji2[5]));
cek('sandi sama tetap menghasilkan hash berbeda', String(bUji1[4])!==String(bUji2[4]));
cek('keduanya tetap bisa masuk', Boolean(SM.periksaSandi('uji1','sandiSama123'))&&Boolean(SM.periksaSandi('uji2','sandiSama123')));
cek('beda satu karakter pun tidak cocok', SM.periksaSandi('uji1','sandiSama124')===null);
const hashSebelum=String(bUji1[4]);
SM.simpanPengguna({kode:'uji1',nama:'Uji Satu',peran:'PACKING',sandi:'sandiSama123'});
const bUji1b=pngSheet().data.filter(r=>r[0]==='UJI1')[0];
cek('sandi sama disimpan ulang memakai salt baru', String(bUji1b[4])!==hashSebelum);
cek('dan tetap bisa masuk dengan sandi itu', Boolean(SM.periksaSandi('uji1','sandiSama123')));

console.log('=== O: alur menu pembuatan superadmin ===');
const matikanSuperadmin_=()=>{
  SM.getPenggunaRecords().forEach(p=>{
    if(p.peran==='SUPERADMIN'&&p.aktif==='YA') SM.simpanPengguna({kode:p.kode,nama:p.nama,peran:'SUPERADMIN',aktif:'TIDAK'});
  });
};

alerts.length=0; promptAntrean.length=0;
sb.buatSuperadminPertamaPrompt();
cek('menolak berjalan bila superadmin aktif sudah ada', alerts[0].title==='Superadmin Sudah Ada', alerts[0].title);

matikanSuperadmin_();
const barisSebelum=pngSheet().getLastRow();
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('super1','Super Satu','sandiRahasia123');
sb.buatSuperadminPertamaPrompt();
console.log('    '+(alerts[0]?alerts[0].body.split('\n').join('\n    '):'(tanpa dialog)'));
cek('akun baru dibuat', alerts[0].title==='Superadmin Dibuat', alerts[0].title);
cek('dialog menyebut baris penyimpanan', /baris \d+/.test(alerts[0].body), alerts[0].body.split('\n')[0]);
cek('baris bertambah satu', pngSheet().getLastRow()===barisSebelum+1, pngSheet().getLastRow()+' vs '+barisSebelum);
cek('akun benar-benar tersimpan', SM.getPenggunaByKode('super1')!==null);
cek('perannya SUPERADMIN', SM.getPenggunaByKode('super1').peran==='SUPERADMIN');
cek('sandi hasil pembuatan bisa dipakai', Boolean(SM.periksaSandi('super1','sandiRahasia123')));

matikanSuperadmin_();
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('kosong1','','sandiRahasia1');
const barisKosong=pngSheet().getLastRow();
sb.buatSuperadminPertamaPrompt();
cek('nama kosong ditolak dengan menyebut bagiannya', alerts[0].title==='Isian Kosong'&&alerts[0].body.includes('nama'), alerts[0].title+' / '+alerts[0].body.split('\n')[0]);
cek('tidak ada yang ditulis', pngSheet().getLastRow()===barisKosong);

matikanSuperadmin_();
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('ada spasi','Nama','sandiRahasia1');
sb.buatSuperadminPertamaPrompt();
cek('kode berspasi ditolak', alerts[0].title==='Kode Mengandung Spasi', alerts[0].title);
cek('tidak ada yang ditulis untuk kode berspasi', pngSheet().getLastRow()===barisKosong);

matikanSuperadmin_();
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('super2','Super Dua','super2');
sb.buatSuperadminPertamaPrompt();
cek('sandi sama dengan kode ditolak', alerts[0].title==='Sandi Terlalu Mudah', alerts[0].title);

matikanSuperadmin_();
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('super2','Super Dua','sandiRahasia2');
sb.buatSuperadminPertamaPrompt();
cek('penyimpanan kode yang sama memperbarui, bukan menambah', alerts[0].title==='Superadmin Dibuat'&&pngSheet().getLastRow()===barisKosong+1, alerts[0].title+' / '+(barisKosong+1)+' vs '+pngSheet().getLastRow());
cek('jumlah superadmin aktif satu', SM.hitungPenggunaAktif('SUPERADMIN')===1, SM.hitungPenggunaAktif('SUPERADMIN'));

console.log('=== P: diagnosa isi sheet Pengguna ===');
const diag=SM.diagnosaPengguna();
console.log('    '+diag.ringkas.split('\n').join('\n    '));
cek('jumlah baris terpakai dilaporkan', diag.lastRow>=2, diag.lastRow);
cek('header dilaporkan sesuai kenyataan', diag.headerAktual[0]==='Kode'&&diag.headerAktual.length===9, JSON.stringify(diag.headerAktual));
cek('kode pada kolom A terdaftar', diag.kodeTerbaca.length>=2, JSON.stringify(diag.kodeTerbaca));

console.log('=== Q: sheet Pengguna yang lahir tanpa baris header ===');
/* Tiru keadaan yang dilaporkan: baris 1 berisi data, bukan header. Ini terjadi
   bila sheet dibuat mendadak oleh penulisan data sebelum inisialisasi. */
const pngRusak=new MockSheet('Pengguna');
pngRusak.appendRow(['PEMILIK','Rizki Agustian','SUPERADMIN','','hash-lama','salt-lama','YA','2026-09-27 11:06:14','']);
ss.sheets['Pengguna']=pngRusak;

let dQ=SM.diagnosaPengguna();
console.log('    '+dQ.ringkas.split('\n').join('\n    '));
cek('mendeteksi header tidak sesuai', dQ.headerSesuai===false);
cek('melaporkan tidak ada kode yang terbaca', dQ.kodeTerbaca.length===0);
cek('menyebut langkah perbaikan', dQ.ringkas.includes('Inisialisasi'));

const hasilQ=SM.simpanPengguna({kode:'pemilik',nama:'Rizki Agustian',peran:'SUPERADMIN',sandi:'sandiBaru2026'});
console.log('    aksi: '+hasilQ.aksi+' pada baris '+hasilQ.baris);
cek('akun lama diperbarui, bukan diduplikasi', hasilQ.aksi==='diperbarui', hasilQ.aksi);
cek('header kini di baris 1', pngSheet().data[0][0]==='Kode', JSON.stringify(pngSheet().data[0].slice(0,3)));
cek('header lengkap 9 kolom', pngSheet().data[0].length===9&&pngSheet().data[0][8]==='Terakhir Masuk (WIB)');
cek('baris data tetap ada, pindah ke baris 2', String(pngSheet().data[1][0])==='PEMILIK', String(pngSheet().data[1][0]));
cek('nama tidak hilang', String(pngSheet().data[1][1])==='Rizki Agustian', String(pngSheet().data[1][1]));
cek('hanya dua baris, tidak ada baris ganda', pngSheet().getLastRow()===2, pngSheet().getLastRow());
cek('akun kini terbaca sistem', SM.getPenggunaByKode('pemilik')!==null);
cek('sandi baru berlaku', Boolean(SM.periksaSandi('pemilik','sandiBaru2026')));
cek('diagnosa menjadi sesuai sesudah perbaikan', SM.diagnosaPengguna().headerSesuai===true);
SM.simpanPengguna({kode:'pemilik',nama:'Rizki Agustian',peran:'SUPERADMIN'});
cek('perbaikan tidak menambah baris bila diulang', pngSheet().getLastRow()===2, pngSheet().getLastRow());

console.log('=== R: setiap penulis baris menulis header lebih dulu ===');
ss.sheets['Pengguna']=new MockSheet('Pengguna');
SM.simpanPengguna({kode:'baru1',nama:'Baru Satu',peran:'ADMIN',sandi:'sandiBaru123'});
cek('sheet kosong: header Pengguna ditulis lebih dulu', pngSheet().data[0][0]==='Kode'&&pngSheet().data[0].length===9);
cek('sheet kosong: data masuk baris 2', String(pngSheet().data[1][0])==='BARU1');

ss.sheets['DB_Token']=new MockSheet('DB_Token');
SM.saveTokenRecord({shop_id:'999',partner_id:'9',access_token:'ACC',refresh_token:'REF',expired_at:Math.floor(Date.now()/1000)+14400});
cek('sheet kosong: header DB_Token ditulis lebih dulu', ss.getSheetByName('DB_Token').data[0][0]==='Shop ID');
cek('sheet kosong: token masuk baris 2', String(ss.getSheetByName('DB_Token').data[1][0])==='999');
cek('token masih terbaca setelah penulisan', SM.getTokenRecords().length===1&&SM.getTokenRecord().shop_id==='999');

ss.sheets['Log_Aktivitas']=new MockSheet('Log_Aktivitas');
SM.logActivity('UJI_HEADER',0,'SUKSES','uji header');
cek('sheet kosong: header log ditulis lebih dulu', ss.getSheetByName('Log_Aktivitas').data[0][0]==='Waktu (WIB)');
cek('sheet kosong: log masuk baris 2 dengan 7 kolom', ss.getSheetByName('Log_Aktivitas').data[1].length===7);

console.log('=== S: penjaga di server, mode uji dan mode berlaku ===');
/* Berkas uji ini fokus pada pengguna dan sesi, jadi baris pesanannya perlu
   dibuat lebih dulu untuk menguji perubahan status. */
const ordSheet=ss.getSheetByName('Pesanan Masuk');
if(ordSheet.getLastRow()<2){
  ordSheet.appendRow(['SN-A','2026-09-27 08:00:00','READY_TO_SHIP','[1] Siap Packing','budi','Kaos','SKU-1','Merah',1,100000,10000,'JNE','RESI-A','','Bandung','2026-09-27 08:00:00','BGD1']);
}


setWajibLogin_('TIDAK');
cek('mode uji: penanda terbaca TIDAK', sb.modeWajibLogin_()===false);
cek('mode uji: permintaan tanpa token tetap dilayani', Array.isArray(sb.getStatusInventory('')));
cek('mode uji: sesi yang dikembalikan bertanda mode uji', sb.wajibSesi_('','PACKING').modeUji===true);

setWajibLogin_('YA');
cek('mode berlaku: penanda terbaca YA', sb.modeWajibLogin_()===true);
const tTanpaToken=lempar(()=>sb.getStatusInventory(''));
cek('mode berlaku: tanpa token ditolak', Boolean(tTanpaToken&&tTanpaToken.includes('Sesi tidak berlaku')), tTanpaToken);

const tokenPacking=sb.buatSesi_({kode:'packing1',nama:'Packing Satu',peran:'PACKING'}).token;
const tokenAdmin=sb.buatSesi_({kode:'admin1',nama:'Admin Satu',peran:'ADMIN'}).token;
const tokenSuper=sb.buatSesi_({kode:'pemilik',nama:'Pemilik',peran:'SUPERADMIN'}).token;

cek('PACKING boleh membaca inventaris status', Array.isArray(sb.getStatusInventory(tokenPacking)));
cek('PACKING boleh membaca dashboard', sb.getDashboardData(tokenPacking,true,'')!==null);
cek('PACKING boleh mengubah status pesanan', sb.updateOrderStatusInternal(tokenPacking,'SN-A','[2] Menunggu Pickup').success===true);
const logStatus=logSheet().data.filter(x=>String(x[1]).trim()==='UPDATE_STATUS');
cek('perubahan status mencatat pelakunya', String(logStatus[logStatus.length-1][6])==='PACKING1', String(logStatus[logStatus.length-1][6]));
const tPackingSync=lempar(()=>sb.triggerSyncOrders(tokenPacking,1,''));
cek('PACKING ditolak menarik pesanan', Boolean(tPackingSync&&tPackingSync.includes('tidak berhak')), tPackingSync);
cek('ADMIN boleh menarik pesanan', sb.triggerSyncOrders(tokenAdmin,1,'').success===true);
const tAdminToken=lempar(()=>sb.saveTokenFromDashboard(tokenAdmin,'{}'));
cek('ADMIN ditolak menyimpan token', Boolean(tAdminToken&&tAdminToken.includes('tidak berhak')), tAdminToken);
const tPackingExport=lempar(()=>sb.getOrderRowsForExport(tokenPacking,10,''));
cek('PACKING ditolak mengekspor', Boolean(tPackingExport&&tPackingExport.includes('tidak berhak')), tPackingExport);
cek('ADMIN boleh mengekspor', Array.isArray(sb.getOrderRowsForExport(tokenAdmin,10,'')));
const tNgawur=lempar(()=>sb.getStatusInventory('ngawur'));
cek('token ngawur ditolak', Boolean(tNgawur&&tNgawur.includes('Sesi tidak berlaku')), tNgawur);
const tPackingTrigger=lempar(()=>sb.toggleTrigger(tokenPacking,false));
cek('PACKING ditolak mengubah trigger', Boolean(tPackingTrigger&&tPackingTrigger.includes('tidak berhak')), tPackingTrigger);
cek('SUPERADMIN boleh membaca inventaris', Array.isArray(sb.getStatusInventory(tokenSuper)));

setWajibLogin_('TIDAK');
cek('dikembalikan ke mode uji', sb.modeWajibLogin_()===false);

console.log('=== T: membuat akun packing lewat menu ===');
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('packing2','Budi Packing','PACKING','sandiPacking2');
sb.kelolaPenggunaPrompt();
console.log('    '+(alerts[0]?alerts[0].body.split('\n').join('\n    '):'(tanpa dialog)'));
cek('akun packing dibuat', alerts[0].title==='Pengguna Disimpan', alerts[0].title);
const budi=SM.getPenggunaByKode('packing2');
cek('perannya PACKING', budi&&budi.peran==='PACKING', budi?budi.peran:'null');
cek('sandi akun packing bisa dipakai', Boolean(SM.periksaSandi('packing2','sandiPacking2')));
cek('akun packing aktif', budi.aktif==='YA');

console.log('=== U: menyunting tanpa sandi mempertahankan sandi lama ===');
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('packing2','Budi Packing Baru','PACKING','');
sb.kelolaPenggunaPrompt();
cek('nama berubah', SM.getPenggunaByKode('packing2').nama==='Budi Packing Baru', SM.getPenggunaByKode('packing2').nama);
cek('sandi lama tetap berlaku', Boolean(SM.periksaSandi('packing2','sandiPacking2')));
cek('peran tetap PACKING', SM.getPenggunaByKode('packing2').peran==='PACKING');

console.log('=== V: menonaktifkan dan mengaktifkan kembali ===');
alerts.length=0; promptAntrean.length=0; alertPilihan='YES';
promptAntrean.push('packing2');
sb.ubahAktifPenggunaPrompt();
cek('akun ditandai tidak aktif', SM.getPenggunaByKode('packing2').aktif==='TIDAK', SM.getPenggunaByKode('packing2').aktif);
cek('akun tidak aktif tidak bisa masuk', SM.periksaSandi('packing2','sandiPacking2')===null);

console.log('=== W: menyunting akun tidak aktif TIDAK mengaktifkannya kembali ===');
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('packing2','Budi Packing Lagi','PACKING','');
sb.kelolaPenggunaPrompt();
cek('nama berubah lagi', SM.getPenggunaByKode('packing2').nama==='Budi Packing Lagi');
cek('status tetap TIDAK AKTIF', SM.getPenggunaByKode('packing2').aktif==='TIDAK', SM.getPenggunaByKode('packing2').aktif);
cek('masih belum bisa masuk', SM.periksaSandi('packing2','sandiPacking2')===null);

alerts.length=0; promptAntrean.length=0; alertPilihan='YES';
promptAntrean.push('packing2');
sb.ubahAktifPenggunaPrompt();
cek('diaktifkan kembali', SM.getPenggunaByKode('packing2').aktif==='YA');
cek('bisa masuk lagi', Boolean(SM.periksaSandi('packing2','sandiPacking2')));

console.log('=== X: superadmin terakhir tidak boleh dikunci ===');
/* Bagian Q dan R mengganti sheet Pengguna untuk menguji perbaikan header,
   sehingga superadmin lama tidak ikut terbawa ke sini. */
SM.simpanPengguna({kode:'super2',nama:'Super Dua',peran:'SUPERADMIN',sandi:'sandiSuper2'});
const jmlSuper=SM.hitungPenggunaAktif('SUPERADMIN');
cek('ada tepat satu superadmin aktif', jmlSuper===1, jmlSuper);
alerts.length=0; promptAntrean.length=0;
promptAntrean.push('super2','Super Dua','PACKING','');
sb.kelolaPenggunaPrompt();
cek('superadmin terakhir ditolak diturunkan perannya', alerts[0].title==='Superadmin Terakhir', alerts[0].title);
cek('perannya tidak berubah', SM.getPenggunaByKode('super2').peran==='SUPERADMIN', SM.getPenggunaByKode('super2').peran);

alerts.length=0; promptAntrean.length=0;
promptAntrean.push('super2');
sb.ubahAktifPenggunaPrompt();
cek('superadmin terakhir ditolak dinonaktifkan', alerts[0].title==='Superadmin Terakhir', alerts[0].title);
cek('masih aktif', SM.getPenggunaByKode('super2').aktif==='YA');

console.log('=== Y: sesi packing memberi hak packing, bukan superadmin ===');
const sesiPacking=sb.masukDenganKode('packing2','sandiPacking2');
cek('masuk sebagai packing', sesiPacking.pengguna.peran==='PACKING', sesiPacking.pengguna.peran);
sb.keluarSesi(sesiPacking.token);

console.log('');
console.log('HASIL FASE 1 LOGIN: '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
