/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';

const fs=require('fs');
const html=fs.readFileSync(AKAR + 'gas/Index.html','utf8');
const code=fs.readFileSync(AKAR + 'gas/Code.js','utf8');
const sm=fs.readFileSync(AKAR + 'gas/SheetManager.js','utf8');

const skrip=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const ids=new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
let gagal=0;
const lapor=(judul,daftar)=>{const a=[...new Set(daftar)];console.log((a.length?'  GAGAL ':'  OK    ')+judul+(a.length?': '+a.join(', '):''));if(a.length)gagal+=a.length;};

console.log('=== id yang dipanggil JS ===');
const dipanggil=[...skrip.matchAll(/getElementById\('([^']+)'\)/g)].map(m=>m[1])
  .concat([...skrip.matchAll(/setText\('([^']+)'/g)].map(m=>m[1]));
lapor('semua getElementById dan setText ada di markup', dipanggil.filter(x=>!ids.has(x)));

console.log('=== atribut for pada label ===');
const forAttr=[...html.matchAll(/\sfor="([^"]+)"/g)].map(m=>m[1]);
lapor('semua target label ada', forAttr.filter(x=>!ids.has(x)));

console.log('=== handler di atribut on* ===');
const handler=[...html.matchAll(/\son(?:click|change|input)="([a-zA-Z_][a-zA-Z0-9_]*)\(/g)].map(m=>m[1]);
const fungsiSkrip=new Set([...skrip.matchAll(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)].map(m=>m[1]));
lapor('semua handler onclick/onchange/oninput terdefinisi', handler.filter(x=>!fungsiSkrip.has(x)));

console.log('=== nama RPC yang dipanggil ===');
const rpc=[];
const rangkai=skrip.split('google.script.run').slice(1);
rangkai.forEach((bagian)=>{
  const garis=[...bagian.matchAll(/\}\)\s*\n\s*\.([a-zA-Z_][a-zA-Z0-9_]*)\(/g)].map(x=>x[1])
    .filter(x=>x!=='withSuccessHandler'&&x!=='withFailureHandler');
  if(garis.length) rpc.push(garis[garis.length-1]);
});
const fungsiServer=new Set([...code.matchAll(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)].map(m=>m[1]));
lapor('semua RPC ada di Code.js', rpc.filter(x=>!fungsiServer.has(x)));
console.log('    RPC yang dipanggil: '+[...new Set(rpc)].join(', '));

console.log('=== cakupan toko benar-benar diteruskan ===');
const rpcScope=['getDashboardData','getOrderRowsByStatus','getStatusInventory','getOrderRowsForExport','triggerSyncOrders','refreshTokenFromDashboard'];
rpcScope.forEach(nama=>{
  const dipakai=new RegExp('\\.'+nama+'\\(([^;]*)').exec(skrip);
  const ok=dipakai && /scopedToko|Boolean\(isManual\), scopedToko/.test(dipakai[1]);
  lapor(nama+' memakai scopedToko', ok?[]:[dipakai?dipakai[1]:'(tidak dipanggil)']);
});

console.log('=== kolom Toko tampil kondisional ===');
lapor('.col-toko ada di CSS dan dipakai markup', (/\.ledger \.col-toko/.test(html)&&/is-semuwa/.test(html))?[]:['tidak lengkap']);

console.log('=== setiap RPC terjaga meneruskan token ===');
const perluToken=['ambilDaftarPengguna','simpanPenggunaDariDashboard','ubahStatusPenggunaDariDashboard','getDashboardData','getStatusInventory','getOrderRowsByStatus','getOrderRowsForExport','triggerSyncOrders','triggerSyncBySn','updateOrderStatusInternal','updateBatchOrderStatusInternal','refreshTokenFromDashboard','toggleTrigger','saveTokenFromDashboard','pingMiddleware','getAuthUrlFromDashboard'];
const klienTanpaToken=perluToken.filter((nama)=>{
  const m=new RegExp('\\\.'+nama+'\\\(([^;]*)').exec(skrip);
  return !m || m[1].indexOf('sesiToken')!==0;
});
lapor('klien meneruskan sesiToken pada argumen pertama', klienTanpaToken);

const serverTanpaToken=perluToken.filter((nama)=>{
  const m=new RegExp('function '+nama+'\\\(([^)]*)').exec(code);
  return !m || m[1].trim().indexOf('token')!==0;
});
lapor('server menerima token pada argumen pertama', serverTanpaToken);

const tanpaJaga=[];
perluToken.forEach((nama)=>{
  const i=code.indexOf('function '+nama+'(');
  if(i<0){tanpaJaga.push(nama);return;}
  const akhir=code.indexOf('\n}',i);
  const tubuh=code.slice(i, akhir<0?code.length:akhir);
  if(tubuh.indexOf('wajibSesi_')===-1) tanpaJaga.push(nama);
});
lapor('semua RPC terjaga memanggil wajibSesi_', tanpaJaga);

console.log('=== penjaga memakai peran yang benar ===');
const peranHarus={'ambilDaftarPengguna':'SUPERADMIN','simpanPenggunaDariDashboard':'SUPERADMIN','ubahStatusPenggunaDariDashboard':'SUPERADMIN','saveTokenFromDashboard':'SUPERADMIN','toggleTrigger':'SUPERADMIN','refreshTokenFromDashboard':'SUPERADMIN','getAuthUrlFromDashboard':'SUPERADMIN','triggerSyncOrders':'ADMIN','getOrderRowsForExport':'ADMIN','getDashboardData':'PACKING','updateBatchOrderStatusInternal':'PACKING'};
const peranSalah=[];
Object.keys(peranHarus).forEach((nama)=>{
  const i=code.indexOf('function '+nama+'(');
  const tubuh=code.slice(i, i+400);
  const m=/wajibSesi_\(token, '([A-Z]+)'\)/.exec(tubuh);
  if(!m || m[1]!==peranHarus[nama]) peranSalah.push(nama+(m?' ('+m[1]+')':' (tidak ada)'));
});
lapor('peran terendah setiap RPC sesuai usulan', peranSalah);

console.log('=== layar pengguna terpasang lengkap ===');
lapor('tab pengguna ada dan hanya untuk superadmin', (/id="tab-pengguna"[^>]*butuh-superadmin/.test(html)||/butuh-superadmin"[^>]*id="tab-pengguna"/.test(html))?[]:['kelas atau tabnya tidak ada']);
lapor('panel pengguna ada', /id="content-pengguna"/.test(html)?[]:['panelnya tidak ada']);
lapor('tab pengguna terdaftar di TAB_NAMES', /TAB_NAMES = \[[^\]]*'pengguna'/.test(skrip)?[]:['tidak terdaftar']);
const blokEscape=(()=>{const i=skrip.indexOf("addEventListener('keydown'");return i<0?"":skrip.slice(i,i+700);})();
lapor('kedua modal pengguna ditutup oleh tombol Escape', (blokEscape.indexOf("closeModal('pengguna-modal')")>=0 && blokEscape.indexOf("closeModal('pengguna-konfirmasi-modal')")>=0) ? [] : ['ada yang belum terdaftar']);

const kontrolPengguna=['muatDaftarPengguna','bukaFormPengguna','tutupFormPengguna','simpanFormPengguna','ubahStatusPengguna','tutupKonfirmasiPengguna','jalankanUbahStatusPengguna','bersihkanKodePengguna_','kosongkanTabelPengguna_'];
lapor('fungsi kendali layar pengguna ada', kontrolPengguna.filter(x=>!fungsiSkrip.has(x)));

console.log('=== pembatasan data keuangan ===');
const rpcUang=['getDashboardData','getOrderRowsByStatus','getOrderRowsForExport'];
const tanpaPotong=rpcUang.filter((nama)=>{
  const i=code.indexOf('function '+nama+'(');
  if(i<0) return nama+' (tidak ada)';
  const akhir=code.indexOf('\n}',i);
  const tubuh=code.slice(i, akhir<0?code.length:akhir);
  return tubuh.indexOf('bolehLihatUang_')===-1 ? nama : '';
}).filter(Boolean);
lapor('setiap RPC pengirim baris pesanan memotong nominal untuk peran lain', tanpaPotong);
lapor('hanya superadmin yang boleh melihat nominal',
  /var PERAN_LIHAT_UANG = 'SUPERADMIN'/.test(code) ? [] : ['konstantanya hilang']);
const tandaUang=['class="kpi-card butuh-uang"','class="butuh-uang">Total<','class="kv butuh-uang"','ledger-money butuh-uang'];
lapor('setiap tempat nominal di layar ditandai butuh-uang', tandaUang.filter(t=>html.indexOf(t)===-1));
lapor('penyembunyian mengikuti dua penanda, peran dan jawaban server',
  (skrip.indexOf('uangTersembunyiPeran')!==-1 && skrip.indexOf('uangTersembunyiServer')!==-1)
    ? [] : ['penandanya tidak lengkap']);
lapor('kolom uang dibuang dari ekspor untuk peran yang tidak boleh',
  (skrip.indexOf('kolomUang ?')!==-1 && skrip.indexOf('rekapHeaders_')!==-1)
    ? [] : ['ekspor masih menyusun kolom nominal tanpa syarat']);

console.log('=== satuan angka ditulis di setiap tempat ===');
lapor('pilihan filter status menyebut baris',
  /jumlahPerStatus\[status\] \+ ' baris\)'/.test(skrip) ? [] : ['label pilihan filter kehilangan satuannya']);
lapor('keterangan tabel menyebut baris dan cakupan sumbernya',
  (skrip.indexOf("total + ' baris'")!==-1 && skrip.indexOf('baris terbaru yang dimuat')!==-1)
    ? [] : ['keterangan tabel tidak menyebut satuan atau cakupannya']);
lapor('panel antrian menulis jumlah baris produk',
  skrip.indexOf('queue-baris-siap-packing')!==-1 ? [] : ['panel antrian kehilangan jumlah barisnya']);

console.log('=== panjang minimum sandi tidak berbeda antara klien dan server ===');
const minServer=/PANJANG_SANDI_MIN = (\d+)/.exec(code);
const minKlien=[...new Set([...skrip.matchAll(/[Ss]andi minimal (\d+) karakter/g)].map(m=>m[1]))];
lapor('angka di klien sama dengan konstanta di server',
  (minServer && minKlien.length===1 && minKlien[0]===minServer[1]) ? [] : ['server '+(minServer?minServer[1]:'?')+', klien '+minKlien.join('/')]);

console.log('');
console.log('HASIL PEMERIKSAAN HTML: '
+(gagal===0?'BERSIH':gagal+' MASALAH'));
process.exit(gagal===0?0:1);
