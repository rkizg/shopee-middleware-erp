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
      /* Dipakai saat menulis ulang setelan: seluruh isi lama dibuang lebih dulu. */
      clearContent(){s._ensure(r+nr-1,c+nc-1);for(let i=0;i<nr;i++){for(let j=0;j<nc;j++)s.data[r-1+i][c-1+j]='';}return a;},
      clear(){return a.clearContent();},
      setNumberFormat(){return a;},setBackground(){return a;},setFontColor(){return a;},setFontWeight(){return a;},setFontSize(){return a;},setHorizontalAlignment(){return a;},setDataValidation(){return a;}};
    return a;}
  getDataRange(){return this.getRange(1,1,Math.max(this.data.length,1),Math.max(this.getLastColumn(),1));}
  appendRow(v){this.data.push(v.slice());}
  insertRowBefore(p){this.data.splice(p-1,0,[]);}
  insertColumnsAfter(a,how){this._ensure(Math.max(this.data.length,1),a+how);for(let i=0;i<this.data.length;i++){const row=this.data[i];for(let k=0;k<how;k++)row.splice(a,0,'');}}
  setFrozenRows(){} autoResizeColumns(){}
  getMaxRows(){return Math.max(this.data.length,1000);} getMaxColumns(){return Math.max(this.getLastColumn(),12);}
  getName(){return this.name;}
  clearContent(){this.data=[];return this;}
  clear(){this.data=[];return this;}
}
class MockSS{constructor(){this.sheets={};}getSheetByName(n){return this.sheets[n]||null;}getSheets(){return Object.values(this.sheets);}insertSheet(n){this.sheets[n]=new MockSheet(n);return this.sheets[n];}toast(){}}
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
   PEMBAGIAN JAHIT — mesin pembagian, penjaga peran, dan pemotongan upah
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
const tAdmin=sb.masukWithKode?null:sb.masukDenganKode('admin1','sandiAdmin1').token;
const tPack=sb.masukDenganKode('packing1','sandiPacking1').token;

console.log('=== 1: sheet setelan lahir dengan isi bawaan ===');
const png=()=>ss.getSheetByName('SETTING PENJAHIT');
const rul=()=>ss.getSheetByName('SKU RULES');
const bgi=()=>ss.getSheetByName('PEMBAGIAN JAHIT');
cek('sheet SETTING PENJAHIT dibuat', Boolean(png()));
cek('sheet SKU RULES dibuat', Boolean(rul()));
cek('sheet PEMBAGIAN JAHIT dibuat', Boolean(bgi()));
cek('empat penjahit bawaan terisi', png().getLastRow()===5, png().getLastRow());
cek('aturan bawaan terisi (14 aturan)', rul().getLastRow()===15, rul().getLastRow());
cek('aturan TAS MIKA dimatikan', rul().data.some(r=>String(r[0])==='TAS MIKA'&&String(r[1])==='IGNORE'));
cek('aturan khusus lebih dulu dari yang umum',
  rul().data.findIndex(r=>String(r[0])==='SARUNG BANTAL & GULING') < rul().data.findIndex(r=>String(r[0])==='SARUNG GULING'));

console.log('=== 2: urutan aturan menentukan grup ===');
cek('pola lebih dulu menang', sb.tentukanGrupSku_('SARUNG BANTAL & GULING', [{pola:'SARUNG BANTAL',grup:'BC'},{pola:'SARUNG BANTAL & GULING',grup:'SPREI'}])==='BC');
cek('SKU tanpa aturan mengembalikan kosong', sb.tentukanGrupSku_('KAOS POLOS', [{pola:'SPREI',grup:'SPREI'}])==='');
cek('spasi dan huruf besar tidak membedakan', sb.tentukanGrupSku_('sprei  dk', [{pola:'SPREI DK',grup:'SPREI'}])==='SPREI');

console.log('=== 3: bobot mempengaruhi siapa yang dipilih ===');
cek('bobot dua menurunkan nilai keadilan', sb.skorPenjahit_({A:{upah:1000,pcs:1}},'A',2) < sb.skorPenjahit_({B:{upah:1000,pcs:1}},'B',1));
const duaOrang=[{nama:'A',bobot:2},{nama:'B',bobot:1}];
cek('saat keduanya kosong, yang pertama dipilih', sb.pilihPenjahit_(duaOrang,{}).nama==='A');
const bebanA={A:{upah:1000,pcs:1},B:{upah:1000,pcs:1}};
cek('saat upah sama, yang bobotnya besar dipilih lagi', sb.pilihPenjahit_(duaOrang,bebanA).nama==='A');
issew({A:{upah:1000,pcs:1},B:{upah:0,pcs:0}});
function issew(b){ cek('yang upahnya lebih kecil dipilih', sb.pilihPenjahit_(duaOrang,b).nama==='B'); }

console.log('=== 4: pesanan menunggu pickup jadi pcs kerja ===');
const ord=ss.getSheetByName('Pesanan Masuk');
ord.data.length=1;
const pesanRow=(sn,sku,variasi,qty,status,amount,toko)=>[
  sn,'2026-09-27 08:00:00','READY_TO_SHIP',status,'budi',sku,sku,variasi,qty,amount,10000,'JNE','RESI-'+sn,'','Bandung','2026-09-27 08:00:00',toko||'BGD'
];
ord.appendRow(pesanRow('SN-S1','SPREI DK 90/25 SET','Biru',2,'[1] Siap Packing',50000));
ord.appendRow(pesanRow('SN-S2','BEDCOVER 180','Maroon',1,'[2] Menunggu Pickup',90000));
ord.appendRow(pesanRow('SN-S3','TAS MIKA AJA','SINGLE',1,'[2] Menunggu Pickup',5000));
ord.appendRow(pesanRow('SN-S4','KAOS POLOS','M',1,'[2] Menunggu Pickup',30000));
ord.appendRow(pesanRow('SN-S5','SARUNG BANTAL & GULING','Set',1,'[1] Siap Packing',45000));
ord.appendRow(pesanRow('SN-S6','SPREI DK 90/25 SET','Biru',1,'[3] Sedang Dikirim',50000));

const pros=()=>ss.getSheetByName('DATA PROSES');
pros().data.length=1;
pros().appendRow(['SPREI DK 90/25 SET',50000,40,10,'Biru',2,'SN-S1','BGD','']);
pros().appendRow(['BEDCOVER 180',90000,60,15,'Maroon',1,'SN-S2','BGD','']);
pros().appendRow(['SARUNG BANTAL & GULING',45000,30,8,'Set',1,'SN-S5','BGD','']);
sb.hapusCacheProses_();

let v=sb.getPembagianJahit(tAdmin,'');
cek('lima pcs kerja dari pesanan siap packing & menunggu pickup', v.rekap.unitAntrian===5, v.rekap.unitAntrian);
cek('pesanan [3] tidak ikut', v.rekap.unitAntrian===5);
cek('satu baris TAS MIKA diabaikan', v.rekap.diabaikan===1, v.rekap.diabaikan);
cek('semuanya belum dibagi', v.rekap.belumDibagi===5, v.rekap.belumDibagi);
cek('empat penjahit aktif terbaca', v.rekap.penjahitAktif===4, v.rekap.penjahitAktif);
cek('setelan penjahit ikut dikirim', v.setelan.penjahit.length===4);
cek('setelan aturan ikut dikirim', v.setelan.aturan.length===14, v.setelan.aturan.length);
const tipeWarn=(t)=>v.rekap.peringatan.filter(w=>w.tipe===t).length;
cek('SKU tanpa aturan dilaporkan', tipeWarn('GRUP_TIDAK_DITEMUKAN')===1, tipeWarn('GRUP_TIDAK_DITEMUKAN'));
cek('SKU tanpa harga dilaporkan', tipeWarn('SKU_TANPA_HARGA')===1, tipeWarn('SKU_TANPA_HARGA'));

console.log('=== 5: membagi pekerjaan kepada penjahit ===');
let bagi=sb.bagiPembagianDashboard(tAdmin,'');
cek('lima pcs dibagi', bagi.qtyDitambah===5, bagi.qtyDitambah);
cek('lima baris pembagian ditulis', bagi.ditambah===5, bagi.ditambah);
cek('tidak ada baris yang ditambahi', bagi.diperbarui===0, bagi.diperbarui);
cek('tidak ada yang dilewati', bagi.dilewati===0, bagi.dilewati);
cek('satu baris diabaikan', bagi.diabaikan===1, bagi.diabaikan);
cek('sheet pembagian berisi lima baris', bgi().getLastRow()===6, bgi().getLastRow());
const barisPesan=(sn)=>bgi().data.slice(1).filter(x=>String(x[1])===sn);
const penjahitBagi=(sn,orang)=>barisPesan(sn).filter(x=>String(x[5])===orang)[0];
const grep_=(sn)=>{const r=barisPesan(sn)[0];return r?String(r[6]):'(tidak ada)'};
cek('qty tersimpan di kolom E', barisPesan('SN-S1').every(r=>Number(r[4])===1),
  JSON.stringify(barisPesan('SN-S1').map(r=>r[4])));
cek('satu baris per penjahit, bukan per pcs', barisPesan('SN-S1').length===2, barisPesan('SN-S1').length);
cek('harga total = qty x harga satuan',
  barisPesan('SN-S2').every(r=>Number(r[8])===Number(r[7])*Number(r[4])),
  JSON.stringify(barisPesan('SN-S2').map(r=>[r[4],r[7],r[8]])));
cek('kolom J berisi stempel waktu pembagian', String(barisPesan('SN-S2')[0][9]).length>10);
cek('bedcover jatuh ke grup BC', grep_('SN-S2')==='BC');
cek('sprei jatuh ke grup SPREI', grep_('SN-S1')==='SPREI');
cek('baris tanpa grup ditandai BELUM DISET', penjahitBagi('SN-S4','BELUM DISET')!==undefined,
  JSON.stringify(barisPesan('SN-S4').map(r=>r[5])));
cek('grup tanpa penjahit dilaporkan', bagi.peringatan.some(w=>w.tipe==='PENJAHIT_GRUP_KOSONG'));
/* Yang diperiksa di sini hanya jumlah pcs, karena respons untuk peran ADMIN
   memang tidak memuat nominal upah. Nominalnya diperiksa pada bagian rekap,
   memakai sesi superadmin. */
const pcsOrang=(nama)=>{const p=bagi.perPenjahit.filter(x=>x.nama===nama)[0];return p?p.pcs:'-'};
cek('nominal upah tidak ikut pada respons admin', bagi.perPenjahit.every(p=>p.upah===undefined));
cek('grup SPREI terbagi menurut bobot', pcsOrang('UGUN')===2&&pcsOrang('ZAE')===1, pcsOrang('UGUN')+'/'+pcsOrang('ZAE'));
cek('bedcover mahal ke satu penjahit BC', pcsOrang('ADUL')===1, pcsOrang('ADUL'));
cek('penjahit BC kedua belum kebagian', pcsOrang('OPIK')===0, pcsOrang('OPIK'));

console.log('=== 6: membagi ulang tidak menggandakan ===');
bagi=sb.bagiPembagianDashboard(tAdmin,'');
cek('tidak ada pcs baru', bagi.qtyDitambah===0, bagi.qtyDitambah);
cek('tidak ada baris baru', bagi.ditambah===0, bagi.ditambah);
cek('lima pcs lama dilewati', bagi.dilewati===5, bagi.dilewati);
cek('sheet pembagian tidak bertambah', bgi().getLastRow()===6, bgi().getLastRow());

console.log('=== 7: rekap upah per penjahit ===');
const rk=sb.getPembagianJahit(tSuper,'').rekap;
const orang=(nama)=>rk.perPenjahit.filter(p=>p.nama===nama)[0];
cek('rekap menghitung lima pcs di antrian', rk.unitAntrian===5, rk.unitAntrian);
cek('empat pcs sudah berpemilik', rk.pcsTerbagi===4, rk.pcsTerbagi);
cek('satu pcs belum ditetapkan dan tidak disembunyikan', rk.belumDitetapkan===1, rk.belumDitetapkan);
cek('tidak ada yang belum dibagi', rk.belumDibagi===0, rk.belumDibagi);
cek('tiga penjahit bekerja', rk.penjahitBekerja===3, rk.penjahitBekerja);
cek('total upah 235000', rk.total.upah===235000, rk.total.upah);
cek('selisih tertinggi-terendah 45000', rk.total.selisih===45000, rk.total.selisih);
cek('rata-rata upah dibulatkan', rk.total.rataUpah===Math.round(235000/3), rk.total.rataUpah);
cek('target grup SPREI dibagi dua sama', orang('UGUN').target===72500&&orang('ZAE').target===72500, orang('UGUN').target);
cek('selisih UGUN positif karena memegang lebih banyak', orang('UGUN').selisih===22500, orang('UGUN').selisih);
cek('selisih ZAE negatif', orang('ZAE').selisih===-22500, orang('ZAE').selisih);
cek('target grup BC dibagi dua sama', orang('ADUL').target===45000&&orang('OPIK').target===45000);
cek('penjahit tanpa pekerjaan tetap muncul di rekap', orang('OPIK').pcs===0);
cek('jumlah order dan SKU ikut dihitung', orang('UGUN').jumlahOrder===2&&orang('UGUN').jumlahSku===2, orang('UGUN').jumlahOrder);
const grup=(nama)=>rk.perGrup.filter(g=>g.grup===nama)[0];
cek('rekap per grup memisahkan SPREI', grup('SPREI').pcs===3&&grup('SPREI').upah===145000, grup('SPREI').pcs);
cek('rekap per grup BC terisi', grup('BC').pcs===1&&grup('BC').jumlahPenjahit===1);
const toko=(nama)=>rk.perToko.filter(t=>t.toko===nama)[0];
cek('rekap per toko menghitung order dan SKU', toko('BGD').pcs===5&&toko('BGD').jumlahOrder===4&&toko('BGD').jumlahSku===4, JSON.stringify(toko('BGD')));

console.log('=== 8: nominal upah dipotong untuk peran lain ===');
const vPack=sb.getPembagianJahit(tPack,'');
const vAdm=sb.getPembagianJahit(tAdmin,'');
const vSup=sb.getPembagianJahit(tSuper,'');
cek('packing ditandai disembunyikan', vPack.uangDisembunyikan===true);
cek('packing tetap menerima jumlah pcs', vPack.rekap.pcsTerbagi===4&&vPack.rekap.belumDitetapkan===1&&vPack.rekap.belumDibagi===0, 'pcsTerbagi '+vPack.rekap.pcsTerbagi+' belumDitetapkan '+vPack.rekap.belumDitetapkan);
cek('packing tidak menerima upah', vPack.rekap.perPenjahit.every(p=>p.upah===undefined&&p.target===undefined&&p.selisih===undefined));
cek('packing tidak menerima nominal per pcs', vPack.rekap.unit.every(u=>u.harga===undefined));
cek('packing tidak menerima total upah', vPack.rekap.total.upah===undefined&&vPack.rekap.total.selisih===undefined);
cek('admin juga tidak menerima upah', vAdm.rekap.perPenjahit.every(p=>p.upah===undefined)&&vAdm.rekap.perGrup.every(g=>g.upah===undefined));
cek('superadmin menerima upah', vSup.rekap.total.upah===235000&&vSup.rekap.perPenjahit.every(p=>p.upah!==undefined));
cek('superadmin menerima nominal per pcs', vSup.rekap.unit.every(u=>u.harga!==undefined));

console.log('=== 9: penjaga peran ===');
cek('packing boleh membaca pembagian', sb.getPembagianJahit(tPack,'').rekap.unitAntrian===5);
cek('packing ditolak membagi', (lempar(()=>sb.bagiPembagianDashboard(tPack,''))||'').indexOf('Peran PACKING tidak berhak')!==-1);
cek('packing ditolak menyimpan penjahit', (lempar(()=>sb.simpanPenjahitDashboard(tPack,[]))||'').indexOf('Peran PACKING tidak berhak')!==-1);
cek('packing ditolak menyimpan aturan', (lempar(()=>sb.simpanAturanDashboard(tPack,[]))||'').indexOf('Peran PACKING tidak berhak')!==-1);

console.log('=== 10: menyimpan daftar penjahit ===');
const galatGanda=lempar(()=>sb.simpanPenjahitDashboard(tAdmin,[{nama:'ADUL',grup:'BC'},{nama:'adul',grup:'BC'}]))||'';
cek('nama kembar ditolak', galatGanda.indexOf('muncul lebih dari sekali')!==-1, galatGanda);
const galatGrup=lempar(()=>sb.simpanPenjahitDashboard(tAdmin,[{nama:'ADUL',grup:''}]))||'';
cek('penjahit tanpa grup ditolak', galatGrup.indexOf('belum punya grup')!==-1, galatGrup);
let simpan=sb.simpanPenjahitDashboard(tAdmin,[{nama:'adul',grup:'bc',aktif:'YA',bobot:2},{nama:'opik',grup:'bc',aktif:'YA'},{nama:'ugun',grup:'sprei',aktif:'TIDAK'}]);
cek('tiga baris penjahit disimpan', simpan.jumlah===3, simpan.jumlah);
cek('nama disimpan huruf besar', String(png().data[1][0])==='ADUL');
cek('bobot tersimpan', Number(png().data[1][3])===2);
cek('yang tidak aktif tidak dihitung', sb.getPembagianJahit(tAdmin,'').rekap.penjahitAktif===2, sb.getPembagianJahit(tAdmin,'').rekap.penjahitAktif);

console.log('=== 11: menyimpan aturan SKU mempertahankan urutan ===');
const simpanA=sb.simpanAturanDashboard(tAdmin,[{pola:'SARUNG BANTAL',grup:'BC'},{pola:'SARUNG BANTAL & GULING',grup:'SPREI'}]);
cek('dua aturan disimpan', simpanA.jumlah===2, simpanA.jumlah);
cek('urutan dipertahankan di sheet', String(rul().data[1][0])==='SARUNG BANTAL'&&String(rul().data[2][0])==='SARUNG BANTAL & GULING');
const aturanBaru=sb.bacaAturanCached_();
cek('cache aturan dibuang setelah menyimpan', aturanBaru.length===2, aturanBaru.length);
cek('pola lebih dulu menang pada alur nyata', sb.tentukanGrupSku_('SARUNG BANTAL & GULING', aturanBaru)==='BC');

console.log('=== 12: jejak audit pembagian ===');
const barisLog=logSheet().getDataRange().getValues();
const bagiLog=barisLog.filter(r=>String(r[1])==='PRODUKSI_BAGI_JAHIT');
cek('pembagian tercatat di log', bagiLog.length>=1, bagiLog.length);
cek('jumlah pcs tercatat', Number(bagiLog[0][2])===5, bagiLog[0][2]);
cek('pelakunya tercatat', String(bagiLog[0][6])==='ADMIN1', bagiLog[0][6]);

console.log('=== 13: harga pcs lama diisi dari daftar harga terbaru ===');
/* Kasus yang terjadi di lapangan: pcs sudah dibagi saat SKU-nya belum dihargai,
   lalu harganya diisi belakangan. Tanpa penyelarasan, upah pcs itu selamanya nol
   walaupun daftar harganya sudah benar. */
const barisBagi=(sn)=>bgi().data.slice(1).filter((r)=>String(r[1])===sn);
/* Kedua kolom harga dikosongkan sekaligus: harga satuan dan harga totalnya. */
bgi().data.slice(1).forEach((r)=>{r[7]='';r[8]='';});

let walauKosong=sb.getPembagianJahit(tSuper,'').rekap;
cek('harga pcs kosong ditampilkan dari daftar harga terbaru',
  walauKosong.unit.filter((u)=>u.sku!=='KAOS POLOS').every((u)=>u.harga>0),
  JSON.stringify(walauKosong.unit.map((u)=>u.harga)));
cek('SKU yang memang belum dihargai tetap nol',
  walauKosong.unit.filter((u)=>u.sku==='KAOS POLOS')[0].harga===0);
cek('total upah tetap terhitung walau selnya kosong', walauKosong.total.upah===235000, walauKosong.total.upah);

/* Satu baris diberi harga hasil koreksi manusia. Angka itu tidak boleh ditimpa.
   Satu pcs lagi tidak punya harga di daftar, jadi memang tidak dapat diisi. */
barisBagi('SN-S2')[0][7]=12345;
barisBagi('SN-S2')[0][8]=12345*Number(barisBagi('SN-S2')[0][4]);
const bagiHarga=sb.bagiPembagianDashboard(tAdmin,'');
cek('sel harga yang kosong dan SKU-nya sudah dihargai terisi',
  bagiHarga.hargaDiselaraskan===3, bagiHarga.hargaDiselaraskan);
cek('pesannya menyebut penyelarasan harga', bagiHarga.pesan.indexOf('daftar harga terbaru')!==-1, bagiHarga.pesan);
cek('koreksi manusia tidak ditimpa', Number(barisBagi('SN-S2')[0][7])===12345, barisBagi('SN-S2')[0][7]);
cek('harga total dikoreksi ikut dihitung ulang dari Qty',
  Number(barisBagi('SN-S2')[0][8])===12345*Number(barisBagi('SN-S2')[0][4]), barisBagi('SN-S2')[0][8]);
cek('sel harga lain terisi dari daftar harga',
  barisBagi('SN-S1').every((r)=>Number(r[7])>0&&Number(r[8])===Number(r[7])*Number(r[4])),
  JSON.stringify(barisBagi('SN-S1').map((r)=>[r[4],r[7],r[8]])));
cek('pcs yang SKU-nya belum dihargai dibiarkan kosong, bukan diisi nol',
  barisBagi('SN-S4').every((r)=>r[7]===''), JSON.stringify(barisBagi('SN-S4').map((r)=>r[7])));
cek('harga hasil koreksi dipakai apa adanya di rekap',
  sb.getPembagianJahit(tSuper,'').rekap.unit.filter((u)=>u.noPesanan==='SN-S2')[0].harga===12345);

/* Baris yang pesanannya sudah dikirim bukan lagi pekerjaan berjalan, jadi
   harganya tidak ikut diselaraskan dan barisnya menjadi riwayat. */
ord.data[1][3]='[3] Sedang Dikirim';
barisBagi('SN-S1').forEach((r)=>{r[7]='';r[8]='';});
sb.hapusCacheProses_();
const bagiKirim=sb.bagiPembagianDashboard(tAdmin,'');
cek('pcs yang pesanannya sudah dikirim tidak ikut diselaraskan',
  bagiKirim.hargaDiselaraskan===0, bagiKirim.hargaDiselaraskan);
cek('baris lama itu dibiarkan apa adanya', barisBagi('SN-S1').every((r)=>r[7]===''));

console.log('=== 14: tutup sesi sekali tekan ===');
/* Satu kali tekan: bagi pekerjaan yang belum terbagi, isi harga pcs lama yang
   kosong, lalu simpan seluruh hasilnya ke DATA JAHIT. Penjahitnya diambil dari
   pembagian, jadi tidak ada lagi yang perlu diketik ulang. */
const jht=()=>ss.getSheetByName('DATA JAHIT');
const barisJahit=(sn)=>jht().data.slice(1).filter((r)=>String(r[6])===sn);
const sebelumTutup=jht().getLastRow();

const tutup=sb.tutupSesiJahit(tAdmin,'','PAGI','');
cek('sesi dan tanggal dilaporkan', tutup.sesi==='PAGI'&&/^\d{4}-\d{2}-\d{2}$/.test(tutup.tanggal), tutup.tanggal+' / '+tutup.sesi);
cek('hasil jahit tersimpan', tutup.ditambah>0, tutup.ditambah);
cek('pcs tanpa penjahit dilaporkan, bukan disimpan', tutup.belumBerpemilik>=1, tutup.belumBerpemilik);
cek('pesannya menyebut sesi dan tanggal',
  tutup.pesan.indexOf('PAGI')!==-1&&tutup.pesan.indexOf(tutup.tanggal)!==-1, tutup.pesan);
cek('penjahit diambil dari hasil pembagian, bukan diketik',
  barisJahit('SN-S2').length===1&&String(barisJahit('SN-S2')[0][5])==='ADUL',
  JSON.stringify(barisJahit('SN-S2').map((r)=>r[5])));
cek('sesi yang diminta ikut tersimpan', String(barisJahit('SN-S2')[0][1])==='PAGI');
cek('jumlahnya sama dengan pcs pada baris pesanan itu', Number(barisJahit('SN-S2')[0][4])===1);
cek('pcs yang belum punya penjahit tidak ikut disimpan',
  barisJahit('SN-S4').length===0, JSON.stringify(barisJahit('SN-S4').map((r)=>r[5])));

const tutupLagi=sb.tutupSesiJahit(tAdmin,'','PAGI','');
cek('menutup sesi dua kali tidak menggandakan hasil',
  tutupLagi.ditambah===0&&tutupLagi.dilewati>0, tutupLagi.ditambah+'/'+tutupLagi.dilewati);
cek('sheet DATA JAHIT tidak bertambah pada penekanan kedua',
  jht().getLastRow()===sebelumTutup+tutup.ditambah, jht().getLastRow());
const sesiAneh=sb.tutupSesiJahit(tAdmin,'','SORE','');
cek('sesi yang tidak dikenal jatuh ke jam sekarang, bukan gagal',
  sesiAneh.sesi==='PAGI'||sesiAneh.sesi==='SIANG', sesiAneh.sesi);
cek('packing ditolak menutup sesi', (lempar(()=>sb.tutupSesiJahit(tPack,'','PAGI',''))||'').indexOf('Peran PACKING tidak berhak')!==-1);

console.log('=== 15: pcs kedua dari satu baris pesanan menambah Qty, bukan baris baru ===');
/* Setelah penjahit BC kedua diaktifkan ulang, satu pcs sisa dari baris yang sama
   dapat jatuh kepadanya. Kalau pcs itu jatuh ke orang yang sama dengan pcs
   pertama, Qty barisnya bertambah dan tidak ada baris baru. */
ord.appendRow(pesanRow('SN-S7','SARUNG BANTAL & GULING','Set',2,'[2] Menunggu Pickup',45000));
const bagi2=sb.bagiPembagianDashboard(tAdmin,'');
cek('dua pcs baru dibagi', bagi2.qtyDitambah===2, bagi2.qtyDitambah);
cek('baris SN-S7 bertambah Qty-nya, bukan bertambah barisnya',
  barisPesan('SN-S7').length<=2&&barisPesan('SN-S7').some(r=>Number(r[4])===2)||barisPesan('SN-S7').length===2,
  JSON.stringify(barisPesan('SN-S7').map(r=>[r[5],r[4]])));
const qtyS7=barisPesan('SN-S7').reduce((n,r)=>n+Number(r[4]),0);
cek('jumlah pcs baris itu sama dengan jumlah pesanannya', qtyS7===2, qtyS7);
cek('harga total mengikuti Qty baru',
  barisPesan('SN-S7').every(r=>Number(r[8])===Number(r[7])*Number(r[4])),
  JSON.stringify(barisPesan('SN-S7').map(r=>[r[4],r[7],r[8]])));

console.log('=== 16: variasi dipangkas pada koma ===');
/* Variasi dari pesanan kadang berbunyi "Lilac,BC 90x220": warna di depan koma,
   lalu ukuran yang sudah tercermin pada SKU. Yang dipakai ERP hanya bagian sebelum
   koma, dan harga per variasi tetap ketemu walau nama baris DATA PROSESnya masih
   memakai teks panjang. Baris harga itu sengaja satu-satunya untuk SKU ini: kalau
   pemangkasannya tidak berjalan di kedua sisi, harganya nol dan langsung
   kelihatan. */
pros().appendRow(['SARUNG BANTAL PREMIUM LILAC,BC 90X220',13579,12,3]);
sb.hapusCacheProses_();
ord.appendRow(pesanRow('SN-S8','SARUNG BANTAL PREMIUM','Lilac,BC 90x220',1,'[2] Menunggu Pickup',40000));
const bagiVar=sb.bagiPembagianDashboard(tAdmin,'');
cek('baris baru itu ikut dibagi', bagiVar.qtyDitambah===1, bagiVar.qtyDitambah);
const barisS8=barisPesan('SN-S8')[0];
cek('variasi tersimpan tanpa keterangan sesudah koma', barisS8&&String(barisS8[3])==='Lilac', barisS8&&barisS8[3]);
cek('harga per variasi ketemu walau namanya panjang', Number(barisS8[7])===13579, barisS8&&barisS8[7]);
cek('harga totalnya ikut benar', Number(barisS8[8])===13579*Number(barisS8[4]), barisS8&&barisS8[8]);
cek('barisnya tidak dilaporkan tanpa harga',
  !bagiVar.peringatan.some(w=>w.tipe==='SKU_TANPA_HARGA'&&w.sku==='SARUNG BANTAL PREMIUM'),
  JSON.stringify(bagiVar.peringatan.map(w=>w.tipe+'/'+w.sku)));
cek('grupnya tetap terbaca dari SKU', String(barisS8[6])==='BC', barisS8&&barisS8[6]);
cek('penjahitnya dari grup itu, bukan BELUM DISET',
  String(barisS8[5])==='ADUL'||String(barisS8[5])==='OPIK', barisS8&&barisS8[5]);
const unitVar=sb.getPembagianJahit(tSuper,'').rekap.unit.filter(u=>u.noPesanan==='SN-S8')[0];
cek('rekap menampilkan variasi yang sama', unitVar&&unitVar.variasi==='Lilac', unitVar&&unitVar.variasi);

/* Baris pembagian dari sebelum perubahan masih memuat teks panjang dan belum
   berharga. Saat pembagian berjalan lagi, baris itu tidak dibagi ulang tetapi
   dirapikan: harganya diisi dan variasinya ditulis dalam bentuk pendek. */
ord.appendRow(pesanRow('SN-S9','SARUNG BANTAL PREMIUM','Lilac,BC 90x220',1,'[2] Menunggu Pickup',40000));
bgi().getRange(bgi().getLastRow()+1,1,1,10).setValues([
  ['BGD','SN-S9','SARUNG BANTAL PREMIUM','Lilac,BC 90x220',1,'ADUL','BC','','','2026-09-20 08:00:00']
]);
const bagiLama=sb.bagiPembagianDashboard(tAdmin,'');
cek('pcs yang sudah dibagi tidak dibagi ulang', bagiLama.qtyDitambah===0, bagiLama.qtyDitambah);
const barisS9=barisPesan('SN-S9')[0];
cek('harga baris lama diisi dari daftar harga', Number(barisS9[7])===13579, barisS9[7]);
cek('harga totalnya dihitung dari Qty', Number(barisS9[8])===13579, barisS9[8]);
cek('variasi baris lama ikut dirapikan di sheet', String(barisS9[3])==='Lilac', JSON.stringify(barisS9[3]));

console.log('=== 17: penjahit multi-grup (checkbox grup/kategori) ===');
/* Penjahit dapat menguasai lebih dari satu grup sekaligus (misal: "BC, SPREI").
   Penjahit yang hanya mencentang SPREI tidak boleh menerima BC, sedangkan
   penjahit yang mencentang BC dan SPREI berhak menerima keduanya. */
sb.simpanAturanDashboard(tAdmin, [
  { pola: 'BEDCOVER', grup: 'BC' },
  { pola: 'SPREI', grup: 'SPREI' }
]);
sb.simpanPenjahitDashboard(tAdmin, [
  { nama: 'ADUL', grup: 'BC, SPREI', aktif: 'YA', bobot: 1 },
  { nama: 'ELSI', grup: 'SPREI', aktif: 'YA', bobot: 1 }
]);
ord.appendRow(pesanRow('SN-MULTI-BC', 'BEDCOVER SET LUXURY', 'Standar', 1, '[2] Menunggu Pickup', 50000));
ord.appendRow(pesanRow('SN-MULTI-SPREI', 'SPREI SET LUXURY', 'Standar', 1, '[2] Menunggu Pickup', 30000));
const bagiMulti = sb.bagiPembagianDashboard(tAdmin, '');
cek('kedua pcs multi-grup terbagi', bagiMulti.qtyDitambah === 2, bagiMulti.qtyDitambah);
const barisMultiBC = barisPesan('SN-MULTI-BC')[0];
const barisMultiSP = barisPesan('SN-MULTI-SPREI')[0];
cek('pesanan BC hanya jatuh ke ADUL karena ELSI hanya di grup SPREI',
  barisMultiBC && String(barisMultiBC[5]) === 'ADUL', barisMultiBC && barisMultiBC[5]);
cek('pesanan SPREI terbagi ke penjahit yang menguasai SPREI',
  barisMultiSP && (String(barisMultiSP[5]) === 'ELSI' || String(barisMultiSP[5]) === 'ADUL'),
  barisMultiSP && barisMultiSP[5]);

console.log('=== 18: pemetaan kode toko cetak (superadmin) ===');
const defaultPeta = SM.bacaKodeTokoCetak();
cek('kode toko bawaan terisi (begood.bdg -> BG, toko tidur manis -> TM)',
  defaultPeta['begood.bdg'] === 'BG' && defaultPeta['toko tidur manis'] === 'TM');
const pembagianData = sb.getPembagianJahit(tSuper, '');
cek('setelan kode toko ikut dikirim pada getPembagianJahit',
  pembagianData.setelan && pembagianData.setelan.kodeToko && pembagianData.setelan.kodeToko['begood.bdg'] === 'BG');
cek('packing ditolak menyimpan kode toko',
  (lempar(() => sb.simpanKodeTokoDashboard(tPack, [])) || '').indexOf('Peran PACKING tidak berhak') !== -1);
cek('admin ditolak menyimpan kode toko (khusus superadmin)',
  (lempar(() => sb.simpanKodeTokoDashboard(tAdmin, [])) || '').indexOf('Peran ADMIN tidak berhak') !== -1);
const simpanTokoRes = sb.simpanKodeTokoDashboard(tSuper, [
  { toko: 'begood.bdg', kode: 'BG' },
  { toko: 'toko tidur manis', kode: 'TM' },
  { toko: 'custom.shop', kode: 'CS' }
]);
cek('superadmin berhasil menyimpan kode toko', simpanTokoRes.berhasil && simpanTokoRes.jumlah === 3);
const bacaUlangPeta = SM.bacaKodeTokoCetak();
cek('pemetaan toko baru tersimpan di Konfigurasi', bacaUlangPeta['custom.shop'] === 'CS');

console.log('=== 19: clear data pembagian jahit (bersihkanPembagianDashboard) ===');
cek('packing ditolak menjalankan clear data pembagian',
  (lempar(() => sb.bersihkanPembagianDashboard(tPack, {})) || '').indexOf('Peran PACKING tidak berhak') !== -1);
const clearRes = sb.bersihkanPembagianDashboard(tAdmin, { toko: '', hapusProduksi: 'TIDAK' });
cek('admin berhasil mengosongkan PEMBAGIAN JAHIT', clearRes.berhasil && clearRes.barisBagiDihapus > 0, clearRes.barisBagiDihapus);
cek('setelah clear data, tabel PEMBAGIAN JAHIT kosong', SM.bacaPembagian().length === 0, SM.bacaPembagian().length);
const bagiUlang = sb.bagiPembagianDashboard(tAdmin, '');
cek('setelah clear data, pesanan dapat dibagi ulang dari awal', bagiUlang.qtyDitambah > 0, bagiUlang.qtyDitambah);

console.log('=== 20: ubah penjahit pada Pcs yang sudah dibagi (ubahPenjahitPembagianDashboard) ===');
cek('packing ditolak mengubah penjahit pada baris pembagian',
  (lempar(() => sb.ubahPenjahitPembagianDashboard(tPack, { noPesanan: 'SN-MULTI-BC', sku: 'BEDCOVER SET LUXURY', variasi: 'Standar', penjahitLama: 'ADUL', penjahitBaru: 'ELSI' })) || '').indexOf('Peran PACKING tidak berhak') !== -1);
const ubahRes = sb.ubahPenjahitPembagianDashboard(tAdmin, {
  noPesanan: 'SN-MULTI-BC',
  sku: 'BEDCOVER SET LUXURY',
  variasi: 'Standar',
  penjahitLama: 'ADUL',
  penjahitBaru: 'ELSI'
});
cek('admin berhasil mengubah penjahit dari ADUL ke ELSI', ubahRes.berhasil && ubahRes.hasil && ubahRes.hasil.berubah === true);
const barisSetelahUbah = barisPesan('SN-MULTI-BC')[0];
cek('sheet PEMBAGIAN JAHIT memperbarui nama penjahit menjadi ELSI',
  barisSetelahUbah && String(barisSetelahUbah[5]) === 'ELSI', barisSetelahUbah && barisSetelahUbah[5]);

console.log('=== 21: ubah variasi warna pada Pcs yang sudah dibagi dari sheet Variasi Warna ===');
const sheetWarna = ss.insertSheet('Variasi Warna');
sheetWarna.appendRow(['Variasi Warna']);
sheetWarna.appendRow(['Mocca']);
sheetWarna.appendRow(['Sage Green']);
sheetWarna.appendRow(['Lilac']);
sheetWarna.appendRow(['Mocca']); /* duplikat diabaikan */
const daftarWarna = SM.bacaVariasiWarna();
cek('SheetManager.bacaVariasiWarna membaca warna unik tanpa header',
  Array.isArray(daftarWarna) && daftarWarna.length === 3 && daftarWarna[0] === 'Mocca' && daftarWarna[1] === 'Sage Green',
  JSON.stringify(daftarWarna));
const payloadWarna = sb.getPembagianJahit(tAdmin, '');
cek('getPembagianJahit mengirim setelan.variasiWarna ke dashboard',
  payloadWarna.setelan && Array.isArray(payloadWarna.setelan.variasiWarna) && payloadWarna.setelan.variasiWarna.indexOf('Sage Green') !== -1);
const ubahVarRes = sb.ubahPenjahitPembagianDashboard(tAdmin, {
  noPesanan: 'SN-MULTI-BC',
  sku: 'BEDCOVER SET LUXURY',
  variasi: 'Standar',
  variasiBaru: 'Sage Green',
  penjahitLama: 'ELSI'
});
cek('admin berhasil mengubah variasi menjadi Sage Green',
  ubahVarRes.berhasil && ubahVarRes.hasil && ubahVarRes.hasil.variasiBaru === 'Sage Green');
const barisSetelahUbahVar = barisPesan('SN-MULTI-BC')[0];
cek('sheet PEMBAGIAN JAHIT memperbarui kolom Variasi menjadi Sage Green',
  barisSetelahUbahVar && String(barisSetelahUbahVar[3]) === 'Sage Green', barisSetelahUbahVar && barisSetelahUbahVar[3]);
const rekapSetelahUbahVar = sb.getPembagianJahit(tAdmin, '');
const unitSetelahUbahVar = (rekapSetelahUbahVar.rekap.unit || []).filter(u => u.noPesanan === 'SN-MULTI-BC')[0];
cek('rekap Pcs yang sudah dibagi tetap menampilkan pesanan dengan variasi baru Sage Green',
  unitSetelahUbahVar && unitSetelahUbahVar.variasi === 'Sage Green' && unitSetelahUbahVar.penjahit === 'ELSI',
  JSON.stringify(unitSetelahUbahVar));
const bagiSetelahUbahVar = sb.bagiPembagianDashboard(tAdmin, '');
cek('pembagian ulang tidak membagi ganda pesanan yang variasinya sudah diubah',
  bagiSetelahUbahVar.qtyDitambah === 0 && barisPesan('SN-MULTI-BC').length === 1,
  bagiSetelahUbahVar.qtyDitambah + ' / ' + barisPesan('SN-MULTI-BC').length);

sb.tutupSesiJahit(tAdmin, '', 'PAGI', '');
sb.ubahPenjahitPembagianDashboard(tAdmin, {
  noPesanan: 'SN-MULTI-BC',
  sku: 'BEDCOVER SET LUXURY',
  variasi: 'Sage Green',
  variasiBaru: 'Mocca',
  penjahitLama: 'ELSI'
});
const prodSetelahUbahVar = SM.bacaProduksi().filter(p => p.noPesanan === 'SN-MULTI-BC')[0];
cek('sheet DATA JAHIT ikut terbarui variasinya menjadi Mocca untuk SPK PDF',
  prodSetelahUbahVar && prodSetelahUbahVar.variasi === 'Mocca', JSON.stringify(prodSetelahUbahVar));
const payloadSetelahTutupDanUbah = sb.getPembagianJahit(tAdmin, '');
const itemElsiSpk = ((payloadSetelahTutupDanUbah.estimasiHariIni.penjahit || []).filter(p => p.nama === 'ELSI')[0] || { items: [] }).items
  .filter(it => it.sku === 'BEDCOVER SET LUXURY')[0];
cek('estimasiHariIni (sumber SPK PDF) langsung memuat variasi baru Mocca',
  itemElsiSpk && itemElsiSpk.variasi === 'Mocca', JSON.stringify(itemElsiSpk));

console.log('=== 22: Tutup sesi & simpan hasil mengosongkan tabel Pcs yang sudah dibagi dan siap mengolah pesanan baru ===');
cek('setelah Tutup sesi & simpan hasil, tabel Pcs yang sudah dibagi (rekap.unit) bersih',
  Array.isArray(payloadSetelahTutupDanUbah.rekap.unit) && payloadSetelahTutupDanUbah.rekap.unit.length === 0,
  JSON.stringify(payloadSetelahTutupDanUbah.rekap.unit));
ord.appendRow(pesanRow('SN-SESI-BARU', 'BEDCOVER SET LUXURY', 'Lilac', 2, '[2] Menunggu Pickup', 50000));
const bagiPesananBaru = sb.bagiPembagianDashboard(tAdmin, '');
cek('ketika ada pesanan baru dan dibagi, hanya pesanan baru yang dihitung',
  bagiPesananBaru.qtyDitambah === 2, bagiPesananBaru.qtyDitambah);
const payloadPesananBaru = sb.getPembagianJahit(tAdmin, '');
cek('tabel Pcs yang sudah dibagi hanya menampilkan pesanan baru yang belum ditutup',
  payloadPesananBaru.rekap.unit.length === 1 &&
  payloadPesananBaru.rekap.unit[0].noPesanan === 'SN-SESI-BARU' &&
  payloadPesananBaru.rekap.unit[0].qty === 2,
  JSON.stringify(payloadPesananBaru.rekap.unit));
sb.tutupSesiJahit(tAdmin, '', 'SIANG', '');
const payloadSetelahTutupSiang = sb.getPembagianJahit(tAdmin, '');
cek('setelah Tutup sesi berikutnya (SIANG), tabel Pcs yang sudah dibagi kembali bersih',
  payloadSetelahTutupSiang.rekap.unit.length === 0,
  JSON.stringify(payloadSetelahTutupSiang.rekap.unit));

console.log('=== 23: regresi perbaikan bug pembagian jahit (BELUM DISET, multi-variasi, target multi-grup) ===');
const aturanSekarang = SM.bacaAturanSku();
aturanSekarang.push({ pola: 'KAOS', grup: 'SPREI', catatan: 'Kaos masuk grup SPREI' });
sb.simpanAturanDashboard(tAdmin, aturanSekarang);
const bagiUpgradeBelumDiset = sb.bagiPembagianDashboard(tAdmin, '');
const barisSn4SetelahAturan = barisPesan('SN-S4');
cek('baris BELUM DISET otomatis diperbarui ke penjahit aktif setelah aturan SKU ditambahkan',
  bagiUpgradeBelumDiset.qtyDitambah === 1 &&
  barisSn4SetelahAturan.length === 1 &&
  String(barisSn4SetelahAturan[0][5]) !== 'BELUM DISET' &&
  String(barisSn4SetelahAturan[0][6]) === 'SPREI',
  JSON.stringify(barisSn4SetelahAturan));
const rekapSetelahUpgradeSn4 = sb.getPembagianJahit(tSuper, '');
cek('baris yang baru di-upgrade dari BELUM DISET muncul kembali di rekap.unit agar bisa ditutup sesi',
  rekapSetelahUpgradeSn4.rekap.unit.some(u => u.noPesanan === 'SN-S4' && u.penjahit !== 'BELUM DISET'),
  JSON.stringify(rekapSetelahUpgradeSn4.rekap.unit));

ord.appendRow(pesanRow('SN-MULTIVAR', 'BEDCOVER SET LUXURY', 'Hitam', 1, '[2] Menunggu Pickup', 50000));
ord.appendRow(pesanRow('SN-MULTIVAR', 'BEDCOVER SET LUXURY', 'Putih', 1, '[2] Menunggu Pickup', 50000));
sb.bagiPembagianDashboard(tAdmin, '');
const barisMultiVarAwal = barisPesan('SN-MULTIVAR');
const barisPutih = barisMultiVarAwal.filter(r => String(r[3]) === 'Putih')[0];
sb.ubahPenjahitPembagianDashboard(tAdmin, {
  noPesanan: 'SN-MULTIVAR',
  sku: 'BEDCOVER SET LUXURY',
  variasi: 'Putih',
  variasiBaru: 'Lilac',
  penjahitLama: String(barisPutih[5])
});
const bagiMultiVarUlang = sb.bagiPembagianDashboard(tAdmin, '');
const barisMultiVarAkhir = barisPesan('SN-MULTIVAR');
cek('edit variasi pada pesanan multi-variasi tidak menggandakan variasi lain saat dibagi ulang',
  bagiMultiVarUlang.qtyDitambah === 0 &&
  barisMultiVarAkhir.length === 2 &&
  barisMultiVarAkhir.some(r => String(r[3]) === 'Hitam') &&
  barisMultiVarAkhir.some(r => String(r[3]) === 'Lilac'),
  JSON.stringify(barisMultiVarAkhir));

console.log('=== 24: regresi 8 bug akurasi data pembagian jahit sampai PDF ===');
/* Bug #6: Baris BELUM DISET yang variasinya sudah diedit manual tetap diklaim dengan variasi baru saat dibagi ulang */
ord.appendRow(pesanRow('SN-BELUM-VAR', 'ROMPI RAJUT', 'Biru', 1, '[2] Menunggu Pickup', 35000, 'BGD'));
sb.bagiPembagianDashboard(tAdmin, '');
const barisBelumVarAwal = barisPesan('SN-BELUM-VAR');
cek('pesanan ROMPI RAJUT tanpa aturan masuk BELUM DISET dengan variasi Biru',
  barisBelumVarAwal.length === 1 && String(barisBelumVarAwal[0][5]) === 'BELUM DISET' && String(barisBelumVarAwal[0][3]) === 'Biru',
  JSON.stringify(barisBelumVarAwal));
sb.ubahPenjahitPembagianDashboard(tAdmin, {
  noPesanan: 'SN-BELUM-VAR',
  sku: 'ROMPI RAJUT',
  variasi: 'Biru',
  variasiBaru: 'Sage Green',
  penjahitLama: 'BELUM DISET',
  penjahitBaru: 'BELUM DISET'
});
const aturanRompi = SM.bacaAturanSku();
aturanRompi.push({ pola: 'ROMPI', grup: 'SPREI', catatan: 'Rompi ke grup SPREI' });
sb.simpanAturanDashboard(tAdmin, aturanRompi);
const bagiRompiSetelahAturan = sb.bagiPembagianDashboard(tAdmin, '');
const barisBelumVarAkhir = barisPesan('SN-BELUM-VAR');
cek('saat aturan ditambahkan & dibagi ulang, baris BELUM DISET diklaim penjahit aktif tanpa kehilangan variasi Sage Green',
  bagiRompiSetelahAturan.qtyDitambah === 1 &&
  barisBelumVarAkhir.length === 1 &&
  String(barisBelumVarAkhir[0][3]) === 'Sage Green' &&
  String(barisBelumVarAkhir[0][5]) !== 'BELUM DISET',
  JSON.stringify(barisBelumVarAkhir));

/* Bug #4: selaraskanProduksiDenganPembagian_ pada pesanan multi-pcs yang dibagi ke >1 penjahit tidak menggandakan penjahit lain */
ord.appendRow(pesanRow('SN-SPLIT-2P', 'BEDCOVER SET LUXURY', 'Hitam', 2, '[2] Menunggu Pickup', 90000, 'BGD'));
SM.simpanQtyPembagian([
  { toko: 'BGD', noPesanan: 'SN-SPLIT-2P', sku: 'BEDCOVER SET LUXURY', variasi: 'Hitam', penjahit: 'ADUL', grup: 'BC', harga: 45000, qty: 1 },
  { toko: 'BGD', noPesanan: 'SN-SPLIT-2P', sku: 'BEDCOVER SET LUXURY', variasi: 'Hitam', penjahit: 'OPIK', grup: 'BC', harga: 45000, qty: 1 }
], '2026-10-09 10:00:00');
sb.tutupSesiJahit(tAdmin, '', 'PAGI', '');
/* Alihkan jatah ADUL ke ELSI setelah sesi ditutup */
sb.ubahPenjahitPembagianDashboard(tAdmin, {
  noPesanan: 'SN-SPLIT-2P',
  sku: 'BEDCOVER SET LUXURY',
  variasi: 'Hitam',
  variasiBaru: 'Hitam',
  penjahitLama: 'ADUL',
  penjahitBaru: 'ELSI'
});
const prodSelarasSplit = sb.selaraskanProduksiDenganPembagian_(SM.bacaProduksi(), '').filter(p => p.noPesanan === 'SN-SPLIT-2P');
const jmlOpikSplit = prodSelarasSplit.filter(p => p.penjahit === 'OPIK').reduce((s, p) => s + Number(p.jumlah || 1), 0);
const jmlElsiSplit = prodSelarasSplit.filter(p => p.penjahit === 'ELSI').reduce((s, p) => s + Number(p.jumlah || 1), 0);
cek('pengalihan 1 dari 2 penjahit pada pesanan sama tidak menggandakan jatah penjahit kedua (OPIK=1, ELSI=1)',
  jmlOpikSplit === 1 && jmlElsiSplit === 1,
  JSON.stringify(prodSelarasSplit));

/* Bug #3: Filter cakupan toko (scopedToko) menyaring estimasiHariIni agar toko lain tidak bocor ke PDF */
ord.appendRow(pesanRow('SN-TOKO-TM', 'BEDCOVER SET LUXURY', 'Navy', 1, '[2] Menunggu Pickup', 45000, 'TM'));
sb.tutupSesiJahit(tAdmin, '', 'PAGI', 'TM');
const payloadHanyaTm = sb.getPembagianJahit(tSuper, 'TM');
const semuaItemEstimasiTm = [];
(payloadHanyaTm.estimasiHariIni.penjahit || []).forEach(p => (p.items || []).forEach(it => semuaItemEstimasiTm.push(it)));
cek('getPembagianJahit dengan cakupan toko TM hanya memuat estimasiHariIni dari toko TM',
  semuaItemEstimasiTm.length > 0 && semuaItemEstimasiTm.every(it => String(it.toko).toUpperCase() === 'TM'),
  JSON.stringify(semuaItemEstimasiTm));

/* Bug #7: Kolom E (Kelengkapan) dari sheet DATA PROSES diteruskan ke kamus, rekap, dan estimasiHariIni */
pros().getRange(1, 5, 1, 1).setValues([['Kelengkapan']]);
pros().appendRow(['BEDCOVER SET LUXURY', 45000, 35, 12, '1 Bedcover + 1 Tas Mika']);
sb.hapusCacheProses_();
ord.appendRow(pesanRow('SN-KEL-PROSES', 'BEDCOVER SET LUXURY', 'Lilac', 1, '[2] Menunggu Pickup', 45000, 'TM'));
sb.bagiPembagianDashboard(tAdmin, 'TM');
const payloadKelProses = sb.getPembagianJahit(tSuper, 'TM');
const unitKelProses = (payloadKelProses.rekap.unit || []).find(u => u.noPesanan === 'SN-KEL-PROSES');
const itemEstKelProses = ((payloadKelProses.estimasiHariIni.penjahit || [])[0] || { items: [] }).items.find(it => it.sku === 'BEDCOVER SET LUXURY');
cek('kelengkapan dari Kolom E DATA PROSES diteruskan ke rekap.unit dan estimasiHariIni',
  Boolean(unitKelProses && unitKelProses.kelengkapan === '1 Bedcover + 1 Tas Mika' &&
          itemEstKelProses && itemEstKelProses.kelengkapan === '1 Bedcover + 1 Tas Mika'),
  JSON.stringify({ unit: unitKelProses && unitKelProses.kelengkapan, est: itemEstKelProses && itemEstKelProses.kelengkapan }));

console.log('=== 25: akurasi logika Bobot Kapasitas (desimal, tie-breaker awal, anti-overshoot, & target multi-grup) ===');
/* 1. Parsing bobot desimal bertitik ("0.5", "1.5") maupun berkoma ("0,5", "1,5") */
sb.simpanPenjahitDashboard(tAdmin, [
  { nama: 'KECIL', grup: 'SPREI', aktif: 'YA', bobot: '0.5' },
  { nama: 'BESAR', grup: 'SPREI', aktif: 'YA', bobot: '1,5' },
  { nama: 'OPIK', grup: 'BC', aktif: 'YA', bobot: '1.0' }
]);
const penjahitDesimal = SM.bacaPenjahit();
const pKecil = penjahitDesimal.find(p => p.nama === 'KECIL');
const pBesar = penjahitDesimal.find(p => p.nama === 'BESAR');
cek('bobot desimal "0.5" dan "1,5" terbaca akurat sebagai 0.5 dan 1.5 (bukan 5 dan 15)',
  Boolean(pKecil && pKecil.bobot === 0.5 && pBesar && pBesar.bobot === 1.5),
  JSON.stringify(penjahitDesimal.map(p => [p.nama, p.bobot])));

/* 2. Saat awal sesi (upah=0), penjahit berbobot lebih besar mendapat item pertama walau berada di urutan bawah */
const pilihAwalKosong = sb.pilihPenjahit_([
  { nama: 'KECIL', bobot: 0.5 },
  { nama: 'BESAR', bobot: 1.5 }
], {}, 20000);
cek('saat keduanya masih 0, penjahit berbobot besar (1.5x) dipilih lebih dulu daripada 0.5x',
  Boolean(pilihAwalKosong && pilihAwalKosong.nama === 'BESAR'),
  JSON.stringify(pilihAwalKosong));

/* 3. Saat rasio upah/bobot seimbang (BESAR 2x punya 2 pcs Rp 100rb, KECIL 1x punya 1 pcs Rp 50rb), tie-breaker pcs dibagi bobot */
const pilihRasioSeimbang = sb.pilihPenjahit_([
  { nama: 'KECIL', bobot: 1 },
  { nama: 'BESAR', bobot: 2 }
], { KECIL: { upah: 50000, pcs: 1 }, BESAR: { upah: 100000, pcs: 2 } }, 50000);
cek('saat rasio upah/bobot dan pcs/bobot seimbang, penjahit berbobot lebih besar mendapat giliran berikutnya',
  Boolean(pilihRasioSeimbang && pilihRasioSeimbang.nama === 'BESAR'),
  JSON.stringify(pilihRasioSeimbang));

/* 4. Anti-overshoot (Sainte-Laguë): 5 pcs @ Rp 20.000 pada bobot 0.5 vs 1.5 (target 25rb vs 75rb) dibagi 1 pcs (20rb) : 4 pcs (80rb) */
pros().data[1][1] = 20000;
sb.hapusCacheProses_();
sb.bersihkanPembagianDashboard(tAdmin, { toko: '', hapusProduksi: 'SEMUA' });
ord.data.length = 1;
ord.appendRow(pesanRow('SN-BOBOT-5', 'SPREI DK 90/25 SET', 'Biru', 5, '[2] Menunggu Pickup', 100000, 'BGD'));
const bagiBobot5 = sb.bagiPembagianDashboard(tAdmin, '');
const rekapBobot5 = sb.getPembagianJahit(tSuper, '').rekap;
const rkKecil = rekapBobot5.perPenjahit.find(p => p.nama === 'KECIL');
const rkBesar = rekapBobot5.perPenjahit.find(p => p.nama === 'BESAR');
cek('5 pcs @ Rp 20.000 dengan bobot 0.5 : 1.5 dibagi 1 pcs (Rp 20.000) untuk KECIL dan 4 pcs (Rp 80.000) untuk BESAR',
  Boolean(rkKecil && rkKecil.pcs === 1 && rkKecil.upah === 20000 && rkBesar && rkBesar.pcs === 4 && rkBesar.upah === 80000),
  JSON.stringify({ kecil: rkKecil && [rkKecil.pcs, rkKecil.upah], besar: rkBesar && [rkBesar.pcs, rkBesar.upah], bagi: bagiBobot5.qtyDitambah }));
cek('target berbobot 0.5 : 1.5 dari total Rp 100.000 adalah Rp 25.000 dan Rp 75.000',
  Boolean(rkKecil && rkKecil.target === 25000 && rkBesar && rkBesar.target === 75000),
  JSON.stringify({ targetKecil: rkKecil && rkKecil.target, targetBesar: rkBesar && rkBesar.target }));

/* 5. Multi-grup dengan pemisah garis miring (BC/SPREI) & penjahit nonaktif tidak mengacaukan total target */
const petaUjiMulti = {
  A: { nama: 'A', grup: 'BC', bobot: 1, aktif: true, upah: 30000 },
  B: { nama: 'B', grup: 'BC/SPREI', bobot: 2, aktif: true, upah: 60000 },
  C: { nama: 'C', grup: 'SPREI', bobot: 1, aktif: true, upah: 30000 },
  LIBUR: { nama: 'LIBUR', grup: 'BC', bobot: 1, aktif: false, upah: 20000 }
};
const targetA = sb.hitungTargetPenjahit_(petaUjiMulti.A, petaUjiMulti, {}, {});
const targetB = sb.hitungTargetPenjahit_(petaUjiMulti.B, petaUjiMulti, {}, {});
const targetC = sb.hitungTargetPenjahit_(petaUjiMulti.C, petaUjiMulti, {}, {});
cek('target multi-grup transitif (BC + BC/SPREI + SPREI) konsisten dan berjumlah tepat 100% pool aktif (30rb + 60rb + 30rb = 120rb)',
  targetA === 30000 && targetB === 60000 && targetC === 30000 && (targetA + targetB + targetC === 120000),
  JSON.stringify({ targetA, targetB, targetC }));

console.log('=== 26: isolasi beban sesi tertutup & penyeimbangan ulang 16 pcs multi-grup (Rp 9.000 rata) ===');
sb.bersihkanPembagianDashboard(tAdmin, { toko: '', hapusProduksi: 'SEMUA' });
ord.data.length = 1;
pros().data.length = 1;
pros().appendRow(['BC AJA 120*220', 8000, 20, 5]);
pros().appendRow(['Bantal Infinity', 5000, 15, 5]);
pros().appendRow(['SARBAN SAMBUNG', 1000, 5, 2]);
sb.hapusCacheProses_();

sb.simpanAturanDashboard(tAdmin, [
  { pola: 'BC AJA', grup: 'BC' },
  { pola: 'BANTAL INFINITY', grup: 'BC' },
  { pola: 'SARBAN', grup: 'SARBAN' },
  { pola: 'SPREI', grup: 'SPREI' }
]);
sb.simpanPenjahitDashboard(tAdmin, [
  { nama: 'ADUL', grup: 'BC, SPREI, SARBAN', aktif: 'YA', bobot: 1 },
  { nama: 'OPIK', grup: 'BC, SPREI, SARBAN', aktif: 'YA', bobot: 1 },
  { nama: 'ELSI', grup: 'SPREI, SARBAN', aktif: 'YA', bobot: 1 }
]);

/* Sesi 1 ditutup ketika pesanan masih berstatus [2] Menunggu Pickup */
ord.appendRow(pesanRow('SN-SESI-LAMA', 'BC AJA 120*220', 'Hitam', 1, '[2] Menunggu Pickup', 8000, 'BGD'));
sb.tutupSesiJahit(tAdmin, '', 'PAGI', '');

/* Sesi 2: 12 baris (16 pcs, total Rp 27.000) yang sebelumnya timpang (ADUL=15.000, OPIK=9.000, ELSI=3.000) */
ord.appendRow(pesanRow('26100973CH89D7', 'BC AJA 120*220', 'Turkish', 1, '[2] Menunggu Pickup', 8000, 'BGD'));
ord.appendRow(pesanRow('26100973CH89D7', 'Bantal Infinity', 'Blue Sky', 1, '[2] Menunggu Pickup', 5000, 'BGD'));
ord.appendRow(pesanRow('2610096QF2BHQ9', 'SARBAN SAMBUNG', 'Random', 6, '[2] Menunggu Pickup', 6000, 'BGD'));
ord.appendRow(pesanRow('2610096WRWJC56', 'SARBAN SAMBUNG', 'Random', 2, '[2] Menunggu Pickup', 2000, 'BGD'));
ord.appendRow(pesanRow('2610096XX8MEJ1', 'SARBAN SAMBUNG', 'Random', 1, '[2] Menunggu Pickup', 1000, 'BGD'));
ord.appendRow(pesanRow('2610096XX8MEJ1', 'SARBAN SAMBUNG', 'SpreiSet DoubleKaret', 1, '[2] Menunggu Pickup', 1000, 'BGD'));
ord.appendRow(pesanRow('2610096XY89G08', 'SARBAN SAMBUNG', 'Random', 2, '[2] Menunggu Pickup', 2000, 'BGD'));
ord.appendRow(pesanRow('26100974P8GKSR', 'SARBAN SAMBUNG', 'Random', 2, '[2] Menunggu Pickup', 2000, 'BGD'));

SM.simpanQtyPembagian([
  { toko: 'BGD', noPesanan: '26100973CH89D7', sku: 'BC AJA 120*220', variasi: 'Turkish', penjahit: 'ADUL', grup: 'BC', harga: 8000, qty: 1 },
  { toko: 'BGD', noPesanan: '26100973CH89D7', sku: 'Bantal Infinity', variasi: 'Blue Sky', penjahit: 'OPIK', grup: 'BC', harga: 5000, qty: 1 },
  { toko: 'BGD', noPesanan: '2610096QF2BHQ9', sku: 'SARBAN SAMBUNG', variasi: 'Black', penjahit: 'ADUL', grup: 'SARBAN', harga: 1000, qty: 5 },
  { toko: 'BGD', noPesanan: '2610096QF2BHQ9', sku: 'SARBAN SAMBUNG', variasi: 'Navy', penjahit: 'OPIK', grup: 'SARBAN', harga: 1000, qty: 1 },
  { toko: 'BGD', noPesanan: '2610096WRWJC56', sku: 'SARBAN SAMBUNG', variasi: 'Random', penjahit: 'ADUL', grup: 'SARBAN', harga: 1000, qty: 1 },
  { toko: 'BGD', noPesanan: '2610096WRWJC56', sku: 'SARBAN SAMBUNG', variasi: 'Random', penjahit: 'OPIK', grup: 'SARBAN', harga: 1000, qty: 1 },
  { toko: 'BGD', noPesanan: '2610096XX8MEJ1', sku: 'SARBAN SAMBUNG', variasi: 'Random', penjahit: 'ADUL', grup: 'SARBAN', harga: 1000, qty: 1 },
  { toko: 'BGD', noPesanan: '2610096XX8MEJ1', sku: 'SARBAN SAMBUNG', variasi: 'SpreiSet DoubleKaret', penjahit: 'ELSI', grup: 'SARBAN', harga: 1000, qty: 1 },
  { toko: 'BGD', noPesanan: '2610096XY89G08', sku: 'SARBAN SAMBUNG', variasi: 'Brown Cream', penjahit: 'ELSI', grup: 'SARBAN', harga: 1000, qty: 1 },
  { toko: 'BGD', noPesanan: '2610096XY89G08', sku: 'SARBAN SAMBUNG', variasi: 'Dusty Pink', penjahit: 'OPIK', grup: 'SARBAN', harga: 1000, qty: 1 },
  { toko: 'BGD', noPesanan: '26100974P8GKSR', sku: 'SARBAN SAMBUNG', variasi: 'Brown Cream', penjahit: 'ELSI', grup: 'SARBAN', harga: 1000, qty: 1 },
  { toko: 'BGD', noPesanan: '26100974P8GKSR', sku: 'SARBAN SAMBUNG', variasi: 'Soft Denim', penjahit: 'OPIK', grup: 'SARBAN', harga: 1000, qty: 1 }
], '2026-10-09 20:00:00');

const bagiSeimbang = sb.bagiPembagianDashboard(tAdmin, '');
const rekapSeimbang = sb.getPembagianJahit(tSuper, '').rekap;
const pAdul26 = rekapSeimbang.perPenjahit.find(p => p.nama === 'ADUL');
const pOpik26 = rekapSeimbang.perPenjahit.find(p => p.nama === 'OPIK');
const pElsi26 = rekapSeimbang.perPenjahit.find(p => p.nama === 'ELSI');
cek('penyeimbangan ulang membagi rata upah ADUL, OPIK, ELSI masing-masing Rp 9.000 (selisih Rp 0)',
  Boolean(pAdul26 && pAdul26.upah === 9000 && pAdul26.pcs === 2 &&
          pOpik26 && pOpik26.upah === 9000 && pOpik26.pcs === 5 &&
          pElsi26 && pElsi26.upah === 9000 && pElsi26.pcs === 9 &&
          rekapSeimbang.total.upah === 27000 && rekapSeimbang.total.selisih === 0),
  JSON.stringify({ adul: pAdul26 && [pAdul26.pcs, pAdul26.upah], opik: pOpik26 && [pOpik26.pcs, pOpik26.upah], elsi: pElsi26 && [pElsi26.pcs, pElsi26.upah], bagi: bagiSeimbang.qtyDitambah }));

const variasiTerjaga = rekapSeimbang.unit.map(u => u.noPesanan + ':' + u.variasi + ':' + u.qty).sort();
cek('seluruh variasi hasil suntingan manual (Black Qty 5, Navy, Dusty Pink, Soft Denim, Brown Cream) tetap terjaga',
  variasiTerjaga.indexOf('2610096QF2BHQ9:Black:5') !== -1 &&
  variasiTerjaga.indexOf('2610096QF2BHQ9:Navy:1') !== -1 &&
  variasiTerjaga.indexOf('2610096XY89G08:Dusty Pink:1') !== -1 &&
  variasiTerjaga.indexOf('26100974P8GKSR:Soft Denim:1') !== -1,
  JSON.stringify(variasiTerjaga));

/* Auto-clear cache saat mengambil / memuat ulang data (tanpa panggil hapusCacheProses_ manual) */
pros().appendRow(['SPREI BARU SEGAR', 25000, 10, 4]);
ord.appendRow(pesanRow('SN-FRESH-CACHE', 'SPREI BARU SEGAR', 'Putih', 1, '[2] Menunggu Pickup', 25000, 'BGD'));
const antrianFresh = sb.getAntrianProduksi(tSuper, '');
const itemFresh = (antrianFresh.pesanan || []).find(p => p.noPesanan === 'SN-FRESH-CACHE');
cek('getAntrianProduksi otomatis membersihkan cache DATA PROSES dan membaca harga terbaru (Rp 25.000)',
  Boolean(itemFresh && itemFresh.hargaSatuan === 25000 && !itemFresh.tanpaHarga),
  JSON.stringify(itemFresh));

/* Real-time version tracking: cekVersiData, onEdit, dan doPost */
const vAwal = sb.cekVersiData(tSuper).versi;
sb.onEdit({});
const vSetelahEdit = sb.cekVersiData(tSuper).versi;
cek('onEdit otomatis menaikkan versi data real-time (cekVersiData)',
  Boolean(vAwal && vSetelahEdit && vSetelahEdit !== vAwal),
  vAwal + ' -> ' + vSetelahEdit);

const cfgSecret = SM.getConfig().BEGOOD_API_SECRET || '';
const postRes = sb.doPost({
  postData: { contents: JSON.stringify({ secret: cfgSecret, action: 'invalidate' }) },
  parameter: {}
});
const postJson = typeof postRes === 'object' && postRes.getContent ? JSON.parse(postRes.getContent()) : postRes;
const vSetelahPost = sb.cekVersiData(tSuper).versi;
cek('doPost webhook memperbarui versi data dan mengembalikan status sukses',
  Boolean(postJson && postJson.success === true && vSetelahPost && vSetelahPost !== vSetelahEdit),
  JSON.stringify(postJson));

console.log('');
console.log('HASIL PEMBAGIAN JAHIT: '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
