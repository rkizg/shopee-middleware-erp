/* Memeriksa nomor baris yang disebut di docs/pembagian-jahit.md terhadap isi
   berkasnya. Nomor baris adalah bagian yang paling cepat basi, jadi ia diperiksa
   otomatis, bukan dibaca ulang dengan mata. */
const fs = require('fs');
const AKAR = require('node:path').join(__dirname, '..') + '/';
const dok = fs.readFileSync(AKAR + 'docs/pembagian-jahit.md', 'utf8').split('\n');

let gagal = 0, lulus = 0;
const cek = (label, ok, nilai) => {
  console.log((ok ? '  OK   ' : '  GAGAL ') + label + (nilai !== undefined ? '  -> ' + nilai : ''));
  if (ok) lulus++; else gagal++;
};

const berkas = { '5.1': 'gas/SheetManager.js', '5.2': 'gas/Code.js', '5.3': 'gas/Index.html' };
const isi = {};
for (const k in berkas) isi[k] = fs.readFileSync(AKAR + berkas[k], 'utf8').split('\n');

let bagian = null;
let jumlahBaris = { '5.1': 0, '5.2': 0, '5.3': 0 };
const salah = [];

dok.forEach((baris, i) => {
  const judul = /^### (5\.[123])/.exec(baris);
  if (judul) bagian = judul[1];
  if (!bagian) return;
  if (/^## /.test(baris)) { bagian = null; return; }

  const sel = /^\| (\d+) \| (.*)$/.exec(baris);
  if (!sel) return;

  /* Nama yang diperiksa adalah token berkurung miring pertama pada baris itu,
     jadi penjelasan sesudahnya boleh ditulis bebas. */
  const miring = sel[2].match(/`([A-Za-z0-9_.\-]+)/);
  if (!miring) return;

  const nomor = Number(sel[1]);
  const nama = miring[1];
  jumlahBaris[bagian]++;

  /* Token harus ada pada baris yang disebut, atau tidak jauh di bawahnya, sebab
     beberapa nama memang terdaftar pada daftar yang dibuka tepat sesudahnya. */
  const jendela = isi[bagian].slice(nomor - 1, nomor + 12);
  const ketemu = jendela.some((l) => l !== undefined && l.indexOf(nama) !== -1);
  if (!ketemu) {
    const isinya = isi[bagian][nomor - 1];
    salah.push('baris ' + nomor + ' di ' + berkas[bagian] + ' tidak memuat ' + nama +
      (isinya === undefined ? ' (baris tidak ada)' : ' (isinya: ' + isinya.trim().slice(0, 60) + ')'));
  }
});

console.log('=== nomor baris pada dokumen cocok dengan berkasnya ===');
for (const k of ['5.1', '5.2', '5.3']) {
  const total = jumlahBaris[k];
  const rusak = salah.filter((s) => s.indexOf(berkas[k]) !== -1).length;
  cek('bagian ' + k + ' (' + berkas[k] + '): ' + total + ' nomor diperiksa', total > 0 && rusak === 0, rusak + ' meleset');
}
salah.forEach((s) => console.log('       ' + s));

console.log('=== nama kolom, RPC, dan peringatan pada dokumen cocok dengan kode ===');
const sm = fs.readFileSync(AKAR + 'gas/SheetManager.js', 'utf8');
const cd = fs.readFileSync(AKAR + 'gas/Code.js', 'utf8');
const isiDok = dok.join('\n');

/* Kolom pada tabel bagian 2.1 sampai 2.3 harus sama dengan daftar header di kode. */
const headerCocok = [
  ['SETTING PENJAHIT', ['Penjahit', 'Grup', 'Aktif', 'Bobot', 'Catatan']],
  ['SKU RULES', ['Pola SKU', 'Grup', 'Catatan']],
  ['PEMBAGIAN JAHIT', ['Toko', 'No. Pesanan', 'SKU', 'Variasi', 'Qty', 'Penjahit', 'Grup', 'Harga Satuan', 'Harga Total', 'Dibagi (WIB)']]
];
headerCocok.forEach(([nama, kolom]) => {
  const blok = dok.slice(dok.findIndex((l) => l.indexOf('### 2.') !== -1 && l.indexOf(nama) !== -1) + 1)
    .slice(0, 20).join('\n');
  const kurang = kolom.filter((k) => blok.indexOf('| ' + k + ' |') === -1);
  cek('kolom ' + nama + ' lengkap di dokumen', kurang.length === 0, kurang.join(', '));
});

/* Nama RPC pada bagian 4.1 harus ada di Code.js. */
['getPembagianJahit', 'bagiPembagianDashboard', 'simpanPenjahitDashboard', 'simpanAturanDashboard'].forEach((rpc) => {
  cek('RPC ' + rpc + ' ada di dokumen dan di kode', isiDok.indexOf(rpc) !== -1 && cd.indexOf('function ' + rpc) !== -1);
});

/* Jenis peringatan pada bagian 3.6 harus benar-benar dipakai di kode. */
['ATURAN_KOSONG', 'GRUP_TIDAK_DITEMUKAN', 'SKU_TANPA_HARGA', 'QTY_INVALID', 'PENJAHIT_GRUP_KOSONG', 'PENJAHIT_TIDAK_AKTIF'].forEach((t) => {
  cek('peringatan ' + t + ' ada di dokumen dan dipakai kode', isiDok.indexOf(t) !== -1 && cd.indexOf("'" + t + "'") !== -1);
});

/* Nama sheet pada dokumen harus sama dengan yang didaftarkan modul. */
['SETTING PENJAHIT', 'SKU RULES', 'PEMBAGIAN JAHIT'].forEach((nama) => {
  cek('nama sheet ' + nama + ' cocok', sm.indexOf("'" + nama + "'") !== -1 && isiDok.indexOf(nama) !== -1);
});

console.log('=== berkas pendamping masih selaras ===');
const idx = fs.readFileSync(AKAR + 'gas/Index.html', 'utf8').split('\n');
const prev = fs.readFileSync(AKAR + 'dashboard-preview.html', 'utf8').split('\n');
const dipakai = new Set(prev);
const hanyaDiIndeks = idx.filter((l) => l.trim() !== '' && !dipakai.has(l) && l.indexOf('<') === -1);
/* Yang memang berbeda hanya blok tiruan RPC pratinjau, dan blok itu tidak memuat
   markup, jadi tidak ada baris kode dashboard yang boleh hanya ada di Index. */
const kodeHilang = idx.filter((l, n) => {
  const t = l.trim();
  return t !== '' && !dipakai.has(l) && /^(function |const |let |    \/\*)/.test(t);
});
cek('tidak ada kode dashboard yang hanya ada di Index.html', kodeHilang.length === 0, kodeHilang.length + ' baris');
kodeHilang.slice(0, 5).forEach((l) => console.log('       ' + l.trim().slice(0, 70)));

console.log('');
console.log('HASIL PEMERIKSAAN DOKUMEN: ' + (gagal === 0 ? 'BERSIH' : gagal + ' KEGAGALAN'));
process.exit(gagal === 0 ? 0 : 1);
