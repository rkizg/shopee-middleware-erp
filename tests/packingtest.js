/* Pengujian Meja Packing Mobile dan Integrasinya
   Memverifikasi antarmuka Packing.html, pratinjau packing-preview.html,
   RPC lookupPackingOrder, selesaikanPackingMobile, doGet routing,
   proteksi konkurensi LockService, serta modal QR code di dashboard. */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const AKAR = path.join(__dirname, '..') + '/';
const packingHtml = fs.readFileSync(AKAR + 'gas/Packing.html', 'utf8');
const previewHtml = fs.readFileSync(AKAR + 'packing-preview.html', 'utf8');
const codeJs = fs.readFileSync(AKAR + 'gas/Code.js', 'utf8');
const smJs = fs.readFileSync(AKAR + 'gas/SheetManager.js', 'utf8');
const indexHtml = fs.readFileSync(AKAR + 'gas/Index.html', 'utf8');
const dashPrevHtml = fs.readFileSync(AKAR + 'dashboard-preview.html', 'utf8');

let gagal = 0;
const cek = (label, ok, nilai) => {
  console.log((ok ? '  OK   ' : '  GAGAL ') + label + (nilai !== undefined ? '  -> ' + nilai : ''));
  if (!ok) gagal++;
};

console.log('=== A: Markup dan Meta Tag Meja Packing Mobile ===');
cek('meta viewport mencegah zoom tidak sengaja (user-scalable=no)', packingHtml.includes('user-scalable=no'));
cek('meta theme-color terpasang', packingHtml.includes('<meta name="theme-color"'));
cek('pustaka html5-qrcode dimuat', packingHtml.includes('html5-qrcode'));
cek('input barcode scanner fisik tersedia', packingHtml.includes('id="input-barcode"'));
cek('tombol buka/tutup kamera scanner tersedia', packingHtml.includes('id="btn-toggle-camera"'));
cek('panel kamera dan senter (torch) tersedia', packingHtml.includes('id="btn-torch"'));
cek('banner feedback status scan tersedia', packingHtml.includes('id="feedback-banner"'));
cek('kartu paket aktif dan elemen detail tersedia', packingHtml.includes('id="pkg-sn"') && packingHtml.includes('id="pkg-resi"'));
cek('daftar checklist item tersedia', packingHtml.includes('id="pkg-items-list"'));
cek('tombol selesaikan packing dengan state loading tersedia', packingHtml.includes('id="btn-finish-packing"'));
cek('banner catatan pembeli tersedia', packingHtml.includes('id="pkg-note-wrap"'));
cek('overlay login pegawai dan PIN tersedia', packingHtml.includes('id="login-overlay"') && packingHtml.includes('id="login-kode"') && packingHtml.includes('id="login-pin"'));
cek('tombol beralih suara dan getar tersedia', packingHtml.includes('id="btn-sound-toggle"') && packingHtml.includes('id="btn-vibrate-toggle"'));

console.log('=== B: Konsistensi ID Skrip terhadap Markup Packing.html ===');
const skripPacking = [...packingHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const idsMarkup = new Set([...packingHtml.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const dipanggilId = [...skripPacking.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
const idHilang = dipanggilId.filter(x => !idsMarkup.has(x) && x !== 'reader');
cek('seluruh getElementById di JS memiliki padanan elemen di HTML', idHilang.length === 0, idHilang.join(', '));

console.log('=== C: Standalone Preview (packing-preview.html) ===');
cek('berkas packing-preview.html tersedia', fs.existsSync(AKAR + 'packing-preview.html'));
cek('pratinjau memiliki pita demo', previewHtml.includes('MODE PRATINJAU MANDIRI'));
cek('pratinjau memuat basis data mock untuk pengujian lokal', previewHtml.includes('MOCK_ORDERS'));
cek('pratinjau memiliki fungsi pemindai dan checklist yang sama', previewHtml.includes('tanganiBarcode') && previewHtml.includes('verifikasiItemProduk'));

console.log('=== D: Routing Standalone Web App di Code.js ===');
cek('doGet memeriksa parameter page=packing', codeJs.includes("page === 'packing'") || codeJs.includes('page === "packing"'));
cek('doGet memeriksa parameter page=scan', codeJs.includes("page === 'scan'") || codeJs.includes('page === "scan"'));
cek('doGet mengembalikan Packing.html untuk parameter packing', codeJs.includes("createHtmlOutputFromFile('Packing')"));
cek('doGet menyematkan viewport user-scalable=no', codeJs.includes('user-scalable=no'));

console.log('=== E: Proteksi Konkurensi LockService di Server ===');
cek('updateOrderStatusInternal menggunakan LockService', codeJs.includes('LockService.getScriptLock()'));
cek('updateBatchOrderStatusInternal menggunakan LockService', codeJs.includes('updateBatchOrderStatusInternal') && codeJs.includes('lock.tryLock(10000)'));
cek('LockService dijaga aman saat lingkungan tanpa GAS', codeJs.includes("typeof LockService !== 'undefined'"));

console.log('=== F: RPC Server untuk Meja Packing Mobile ===');
cek('RPC lookupPackingOrder terdefinisi di Code.js', codeJs.includes('function lookupPackingOrder('));
cek('RPC selesaikanPackingMobile terdefinisi di Code.js', codeJs.includes('function selesaikanPackingMobile('));
cek('RPC getWebAppPackingUrl terdefinisi di Code.js', codeJs.includes('function getWebAppPackingUrl('));
cek('SheetManager memiliki fungsi findOrderForPacking', smJs.includes('findOrderForPacking: function('));

console.log('=== G: Integrasi Dashboard (Tombol dan Modal QR Code) ===');
cek('Index.html memiliki tombol Buka di HP', indexHtml.includes('id="btn-scan-mobile-qr"'));
cek('Index.html memiliki modal QR Code Packing', indexHtml.includes('id="modal-qr-packing"'));
cek('Index.html memiliki handler bukaModalQrPacking', indexHtml.includes('function bukaModalQrPacking('));
cek('Index.html memiliki handler tutupModalQrPacking', indexHtml.includes('function tutupModalQrPacking('));
cek('Index.html memiliki handler salinLinkPackingMobile', indexHtml.includes('function salinLinkPackingMobile('));
cek('dashboard-preview.html tersinkronisasi tombol Buka di HP', dashPrevHtml.includes('id="btn-scan-mobile-qr"'));
cek('dashboard-preview.html tersinkronisasi modal QR Code Packing', dashPrevHtml.includes('id="modal-qr-packing"'));

console.log('=== H: Aturan Antislop R-02 (Bebas Em Dash) ===');
const cekEmDash = (nama, konten) => {
  const baris = konten.split('\n');
  const kena = [];
  baris.forEach((l, idx) => {
    if (l.includes('\u2014')) kena.push(idx + 1);
  });
  cek(nama + ' bebas dari karakter em dash (\u2014)', kena.length === 0, kena.length ? 'baris ' + kena.slice(0, 5).join(', ') : 'bersih');
};
cekEmDash('gas/Packing.html', packingHtml);
cekEmDash('packing-preview.html', previewHtml);

console.log('');
console.log('HASIL PENGUJIAN PACKING MOBILE: ' + (gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'));
process.exit(gagal === 0 ? 0 : 1);
