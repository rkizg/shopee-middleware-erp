/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';

const fs=require('fs'), vm=require('vm');

/* --- mock SpreadsheetApp yang meniru getRange(row, col, nRows, nCols) --- */
const dataRows = [];           // tanpa baris header
function push(sn, status){ dataRows.push([sn,'27/09/2026 09:00','READY_TO_SHIP',status,'Pembeli','Produk','BG-1','M',1,100000,10000,'SPX Express','R'+sn,'','Bandung','x']); }
function pushVar(sn, variasi, status){ dataRows.push([sn,'27/09/2026 09:00','READY_TO_SHIP',status,'Pembeli','Produk','BG-1',variasi,1,100000,10000,'SPX Express','R'+sn,'','Bandung','x']); }

// 23 antrian Siap Packing di baris LAMA (jauh dari ekor sheet)
for (let i=0;i<23;i++) push('A'+i, '[1] Siap Packing');
// 5 menunggu pickup di baris lama
for (let i=0;i<5;i++) push('P'+i, '[2] Menunggu Pickup');
// 1 status varian (tanpa awalan nomor) untuk menguji ketahanan filter
push('V1', 'Siap Packing');
// 1 status di luar daftar resmi
push('X1', 'TO_CONFIRM_RECEIVE');
// 80 baris TERBARU semuanya Selesai  <-- inilah yang masuk payload dashboard
for (let i=0;i<80;i++) push('Z'+i, '[4] Selesai');
// variasi memuat keterangan sesudah koma, dan pasangannya tanpa koma
pushVar('C1', 'Lilac,BC 90x220', '[2] Menunggu Pickup');
pushVar('C2', 'Lilac', '[2] Menunggu Pickup');
// 1 baris kolom D kosong
push('K1', '');
// 1 baris tanpa nomor pesanan (harus diabaikan)
dataRows.push(['','','','[1] Siap Packing','','','','',0,0,0,'','','','','']);

const total = dataRows.length;
const sheet = {
  getLastRow: () => total + 1,
  getRange: (r, c, nr, nc) => ({
    getValues: () => dataRows.slice(r - 2, r - 2 + nr).map(row => row.slice(c - 1, c - 1 + nc))
  })
};
const sandbox = {
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => n === 'Pesanan Masuk' ? sheet : null }) },
  Utilities: { formatDate: () => '2026-09-27 09:00:00' },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(AKAR + 'gas/SheetManager.js','utf8'), sandbox);
const SM = sandbox.SheetManager;

console.log('Total baris data :', total, '(satu di antaranya tanpa nomor pesanan)');
console.log('80 baris terakhir:', dataRows.slice(-80).filter(r=>r[3]==='[4] Selesai').length, 'berstatus [4] Selesai\n');

console.log('=== getOrderRowsByStatus ===');
[['Siap Packing',24],['Pickup',7],['Dikirim',0],['Selesai',80]].forEach(([kata,harap])=>{ const r=SM.getOrderRowsByStatus(kata,500); console.log(`  ${kata.padEnd(14)} -> ${String(r.length).padStart(3)} baris  harap ${harap}  ${r.length===harap?'OK':'BEDA'}`); });
const sp=SM.getOrderRowsByStatus('Siap Packing',500);
console.log('  semua hasil benar-benar cocok :', sp.every(o=>o.internalStatus.toLowerCase().includes('siap packing')));
console.log('  termasuk varian tanpa awalan  :', sp.some(o=>o.internalStatus==='Siap Packing'));
console.log('  urutan terbaru lebih dulu     :', sp[0].orderSn === 'V1' || sp[0].orderSn.startsWith('A'));

console.log('\n=== getOrderRowsForExport ===');
const ex=SM.getOrderRowsForExport(5000);
console.log('  baris dikembalikan            :', ex.length, '(harus', total-1, ')');
console.log('  pasti lebih dari 80           :', ex.length>80);

console.log('\n=== getStatusInventory ===');
SM.getStatusInventory().forEach(x=>console.log(`  ${x.jumlah.toString().padStart(4)} x  ${JSON.stringify(x.status)}`));
const inv=SM.getStatusInventory();
console.log('\n  memunculkan status di luar daftar resmi :', inv.some(x=>x.status==='TO_CONFIRM_RECEIVE'));

/* Sebelumnya berkas ini hanya mencetak nilainya. Sekarang nilainya diperiksa,
   supaya perubahan pada SheetManager yang merusak salah satunya berhenti di
   sini, bukan terbaca lewat oleh mata. */
let gagal = 0;
const cek = (label, ok, nilai) => {
  console.log((ok ? '  OK   ' : '  GAGAL ') + label + (nilai !== undefined ? '  -> ' + nilai : ''));
  if (!ok) gagal++;
};

console.log('\n=== pemeriksaan ===');
const harap = [['Siap Packing', 24], ['Pickup', 7], ['Dikirim', 0], ['Selesai', 80]];
harap.forEach(([kata, jumlah]) => {
  cek('getOrderRowsByStatus(' + kata + ') mengembalikan ' + jumlah + ' baris',
    SM.getOrderRowsByStatus(kata, 500).length === jumlah, SM.getOrderRowsByStatus(kata, 500).length);
});
cek('semua hasil cocok dengan kata kuncinya', sp.every(o => o.internalStatus.toLowerCase().includes('siap packing')));
cek('status varian tanpa awalan nomor ikut terbaca', sp.some(o => o.internalStatus === 'Siap Packing'));
cek('urutan baris terbaru lebih dulu', sp[0].orderSn === 'V1' || sp[0].orderSn.startsWith('A'));
cek('ekspor mengembalikan seluruh baris berisi nomor pesanan', ex.length === total - 1, ex.length);
cek('ekspor tidak terbatas pada 80 baris payload', ex.length > 80, ex.length);
cek('status di luar daftar resmi muncul apa adanya', inv.some(x => x.status === 'TO_CONFIRM_RECEIVE'));
cek('kolom D yang kosong tetap terlihat', inv.some(x => x.status === '(kolom D kosong)'));

/* Variasi dari pesanan kadang memuat dua keterangan sekaligus, misalnya warna
   lalu ukuran sesudah koma. Yang dipakai ERP hanya bagian sebelum koma, dan
   pemangkasan itu harus terjadi juga pada baris yang sudah lama tersimpan. */
console.log('\n=== pemangkasan variasi sesudah koma ===');
cek('variasi dipotong pada koma pertama', SM.bersihkanVariasi('Lilac,BC 90x220') === 'Lilac', SM.bersihkanVariasi('Lilac,BC 90x220'));
cek('spasi sesudah koma ikut hilang', SM.bersihkanVariasi('Lilac , BC 90x220') === 'Lilac', SM.bersihkanVariasi('Lilac , BC 90x220'));
cek('variasi tanpa koma tidak diubah', SM.bersihkanVariasi('Coffee') === 'Coffee', SM.bersihkanVariasi('Coffee'));
cek('tanda - tetap berarti tanpa variasi', SM.bersihkanVariasi('-') === '-', SM.bersihkanVariasi('-'));
cek('nilai kosong tetap kosong', SM.bersihkanVariasi(null) === '' && SM.bersihkanVariasi(undefined) === '',
  JSON.stringify([SM.bersihkanVariasi(null), SM.bersihkanVariasi(undefined)]));
cek('spasi berlebih dirapatkan', SM.bersihkanVariasi('  Lilac,  BC 90x220  ') === 'Lilac', SM.bersihkanVariasi('  Lilac,  BC 90x220  '));

const pickup = SM.getOrderRowsByStatus('Pickup', 500);
const barisC1 = pickup.filter((o) => o.orderSn === 'C1')[0];
const barisC2 = pickup.filter((o) => o.orderSn === 'C2')[0];
cek('baris pesanan dibaca dengan variasi terpangkas', barisC1 && barisC1.variation === 'Lilac', barisC1 && barisC1.variation);
cek('baris yang sudah pendek dibiarkan', barisC2 && barisC2.variation === 'Lilac', barisC2 && barisC2.variation);
cek('variasi panjang dan pendek menunjuk baris yang sama',
  SM.kunciAntrian('BG-1', 'Lilac,BC 90x220', 'C1') === SM.kunciAntrian('BG-1', 'Lilac', 'C1'));
cek('kunci hasil jahit ikut sama',
  SM.kunciProduksi('BG-1', 'Lilac,BC 90x220', 'C1', 'ADUL') === SM.kunciProduksi('BG-1', 'Lilac', 'C1', 'ADUL'));
cek('kunci pembagian ikut sama',
  SM.kunciPembagian('BG-1', 'Lilac,BC 90x220', 'C1', 'ADUL') === SM.kunciPembagian('BG-1', 'Lilac', 'C1', 'ADUL'));
cek('variasi berbeda tetap menunjuk baris berbeda',
  SM.kunciAntrian('BG-1', 'Lilac', 'C1') !== SM.kunciAntrian('BG-1', 'Coffee', 'C1'));

console.log('');
console.log('HASIL PEMBACAAN SHEET: ' + (gagal === 0 ? 'SEMUA LULUS' : gagal + ' KEGAGALAN'));
process.exit(gagal === 0 ? 0 : 1);
console.log('  memunculkan kolom kosong                :', inv.some(x=>x.status==='(kolom D kosong)'));
