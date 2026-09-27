#!/usr/bin/env node
/* Pelari seluruh rangkaian uji ERP Begood.

   Setiap berkas uji adalah skrip Node yang berdiri sendiri: ia membaca berkas
   di gas/ atau dashboard-preview.html, menjalankannya di sandbox vm, lalu
   memeriksa hasilnya. Tidak ada yang menyentuh Google Spreadsheet maupun
   jaringan, jadi seluruh rangkaian uji dapat dijalankan berkali-kali tanpa
   mengganggu data siapa pun.

   Pakai:
     node tests/jalankan-uji.js              seluruh rangkaian
     node tests/jalankan-uji.js fas11        hanya berkas yang namanya memuat itu
     node tests/jalankan-uji.js pembagian    kata kunci lain juga boleh
*/

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DIR = __dirname;

/* Berkas uji dibaca sendiri dari folder ini, jadi berkas baru langsung ikut
   dijalankan tanpa perlu didaftarkan. Daftar di bawah hanya memberi urutan dan
   keterangan: yang paling mendasar diperiksa lebih awal supaya penyebabnya lebih
   cepat terlihat. Berkas yang belum terdaftar dijalankan paling akhir. */
const URUTAN = [
  { berkas: 'fas1test.js',    isi: 'Fase 1: pemetaan data dan penyimpanan awal' },
  { berkas: 'fas2test.js',    isi: 'Fase 2: pemetaan kolom dan kode toko' },
  { berkas: 'fas3test.js',    isi: 'Fase 3: penarikan pesanan dan idempotensinya' },
  { berkas: 'fas4test.js',    isi: 'Fase 4 server: status, filter, dan ekspor' },
  { berkas: 'fas6test.js',    isi: 'Fase 1 login: sandi, sesi, dan identitas' },
  { berkas: 'fas7test.js',    isi: 'Fase 4 kelola pengguna dan pagar superadmin' },
  { berkas: 'fas8test.js',    isi: 'Grafik dashboard dan angka arah' },
  { berkas: 'fas9test.js',    isi: 'Pembatasan data keuangan per peran' },
  { berkas: 'fas10test.js',   isi: 'Modul produksi jahit dan estimasi upah' },
  { berkas: 'fas11test.js',   isi: 'Modul pembagian jahit, rekap, dan perannya' },
  { berkas: 'diagtest.js',    isi: 'Diagnosa kode toko pada baris lama' },
  { berkas: 'surfacetest.js', isi: 'Permukaan galat sinkronisasi per toko' },
  { berkas: 'idtest.js',      isi: 'Identitas pemanggil dan penolakannya' },
  { berkas: 'sheettest.js',   isi: 'Pembacaan Pesanan Masuk lewat SheetManager' },
  { berkas: 'statustest.js',  isi: 'Penyaringan status dan versi server lama' },
  { berkas: 'uitest.js',      isi: 'Layar pengguna: pesanan, filter, dan ekspor' },
  { berkas: 'pdfharness.js',  isi: 'Tata letak PDF slip, label, dan rekap' },
  { berkas: 'prevtest.js',    isi: 'Pratinjau dashboard sebagai superadmin' },
  { berkas: 'prevtest2.js',   isi: 'Pratinjau dashboard sebagai packing' },
  { berkas: 'htmlcheck.js',   isi: 'Id, nama fungsi, dan satuan angka di halaman' },
  { berkas: 'siapdeploy.js',  isi: 'Kesiapan berkas untuk ditempel ke Apps Script' },
  { berkas: 'doccheck.js',    isi: 'Nomor baris dan nama di dokumen pembagian jahit' },
];

const KETERANGAN = {};
URUTAN.forEach((u) => { KETERANGAN[u.berkas] = u.isi; });

const NAMA_URUT = URUTAN.map((u) => u.berkas);
const DAFTAR = fs.readdirSync(DIR)
  .filter((nama) => nama.endsWith('.js') && nama !== 'jalankan-uji.js')
  .sort((a, b) => {
    const ia = NAMA_URUT.indexOf(a);
    const ib = NAMA_URUT.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  })
  .map((berkas) => ({
    berkas: berkas,
    isi: KETERANGAN[berkas] || 'berkas baru, keterangannya belum ditulis di pelari',
  }));

/* Rangkaian uji yang lulus selalu menutup keluarannya dengan salah satu penanda
   ini. Penanda itu diperiksa juga, sebab berkas yang keluar dengan kode nol
   tanpa memeriksa apa pun akan tampak lulus padahal tidak memeriksa apa-apa. */
const PENANDA = ['SEMUA LULUS', 'BERSIH'];

const saring = (process.argv[2] || '').toLowerCase();
const dipilih = DAFTAR.filter((u) => u.berkas.toLowerCase().indexOf(saring) !== -1);

if (!dipilih.length) {
  console.log('Tidak ada berkas uji yang cocok dengan "' + saring + '".');
  console.log('Yang tersedia: ' + DAFTAR.map((u) => u.berkas).join(', '));
  process.exit(1);
}

console.log('Menjalankan ' + dipilih.length + ' rangkaian uji dari ' + dipilih.length + ' berkas.');
console.log('');

let lulus = 0;
const gagal = [];

for (const u of dipilih) {
  const mulai = Date.now();
  const jalan = spawnSync(process.execPath, [path.join(DIR, u.berkas)], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  const keluaran = (jalan.stdout || '') + (jalan.stderr || '');
  const baris = keluaran.split('\n').map((l) => l.trim()).filter(Boolean);
  const ringkas = baris.length ? baris[baris.length - 1] : '(tidak ada keluaran)';
  const adaPenanda = PENANDA.some((p) => keluaran.indexOf(p) !== -1);
  const ok = jalan.status === 0 && adaPenanda;

  const detik = ((Date.now() - mulai) / 1000).toFixed(1);
  console.log((ok ? '  LULUS  ' : '  GAGAL  ') + u.berkas.padEnd(15) + (detik + 's').padStart(6) +
    '  ' + u.isi);

  if (ok) {
    lulus++;
  } else {
    gagal.push({
      berkas: u.berkas,
      sebab: jalan.status !== 0 ? 'keluar dengan kode ' + jalan.status : 'tidak menyebut hasil akhirnya',
      baris: baris.filter((l) => l.indexOf('GAGAL') !== -1).slice(0, 8),
      ekor: baris.slice(-3),
    });
  }
}

console.log('');
console.log(lulus + ' dari ' + dipilih.length + ' rangkaian uji lulus.');

if (gagal.length) {
  gagal.forEach((g) => {
    console.log('');
    console.log('  ' + g.berkas + ': ' + g.sebab);
    g.baris.forEach((l) => console.log('      ' + l.slice(0, 100)));
    if (!g.baris.length) g.ekor.forEach((l) => console.log('      ' + l.slice(0, 100)));
  });

  console.log('');
  console.log('JALANKAN ULANG SATU BERKAS: node tests/' + gagal[0].berkas);
  process.exit(1);
}

console.log('SELURUH RANGKAIAN UJI LULUS');
