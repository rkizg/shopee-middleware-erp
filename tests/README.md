# Uji ERP Begood

Folder ini memuat rangkaian uji yang dijalankan di komputer, bukan di Google
Apps Script. Setiap berkas uji adalah skrip Node yang berdiri sendiri: ia membaca
berkas di `gas/` atau `dashboard-preview.html`, menjalankannya di dalam sandbox
`vm`, lalu memeriksa hasilnya.

Tidak ada berkas uji yang menghubungi Google Spreadsheet, Shopee, atau jaringan.
Datanya tiruan, jadi seluruh rangkaian dapat dijalankan berkali-kali tanpa
mengganggu data siapa pun.

## Menjalankannya

```
node tests/jalankan-uji.js            # seluruh rangkaian
node tests/jalankan-uji.js fas11      # hanya berkas yang namanya memuat fas11
node tests/fas11test.js               # satu berkas, keluarannya lengkap
```

Pelarinya menjalankan tiap berkas di prosesnya sendiri, lalu menutup dengan
`SELURUH RANGKAIAN UJI LULUS` dan kode keluar nol. Bila ada yang gagal, baris
`GAGAL` milik berkas itu ikut dicetak, dan kode keluarnya satu. Satu rangkaian
dihitung lulus hanya bila kode keluarnya nol dan keluarannya memuat penanda
`SEMUA LULUS` atau `BERSIH`, supaya berkas yang keluar dengan kode nol tanpa
memeriksa apa pun tidak tampak lulus.

Prasyarat: Node.js. Tidak ada paket yang perlu dipasang.

Pelarinya membaca sendiri semua berkas `.js` di folder ini, kecuali dirinya
sendiri. Jadi berkas uji baru langsung ikut dijalankan tanpa perlu didaftarkan;
yang perlu ditambahkan hanya keterangannya pada `URUTAN` di `jalankan-uji.js`,
supaya namanya muncul di daftar hasil.

## Isi tiap berkas

Jumlah pernyataan di bawah ini terukur dari keluaran tiap berkas. Seluruhnya
berjumlah 971 pernyataan, ditambah audit tata letak pada `pdfharness.js`.

| Berkas | Pernyataan | Yang diperiksa |
|---|---|---|
| `fas1test.js` | 26 | Pemetaan data pesanan dan penyimpanannya |
| `fas2test.js` | 29 | Pemetaan kolom, kode toko, dan bentuk baris |
| `fas3test.js` | 65 | Penarikan pesanan, penggantian baris, idempotensinya, dan pemangkasan variasi |
| `fas4test.js` | 45 | Status internal, filter, ekspor, dan jejak aktivitas |
| `fas6test.js` | 146 | Sandi, sesi, identitas pemanggil, dan pembatasan percobaan masuk |
| `fas7test.js` | 76 | Kelola pengguna dan pagar superadmin terakhir |
| `fas8test.js` | 28 | Angka grafik dashboard dan arah angkanya |
| `fas9test.js` | 31 | Pembatasan data keuangan per peran |
| `fas10test.js` | 95 | Modul produksi jahit: daftar kerja, daftar harga per SKU, hasil jahit, estimasi upah, pemangkasan variasi |
| `fas11test.js` | 127 | Modul pembagian jahit: mesin, keadilan, Qty per penjahit, pemangkasan variasi, idempotensi, harga baris lama, tutup sesi, peran, audit |
| `diagtest.js` | 17 | Diagnosa kode toko pada baris lama |
| `surfacetest.js` | 32 | Permukaan galat sinkronisasi per toko |
| `idtest.js` | 27 | Identitas pemanggil dan penolakannya |
| `sheettest.js` | 23 | Pembacaan `Pesanan Masuk` lewat `SheetManager`, termasuk pemangkasan variasi |
| `statustest.js` | 10 | Penyaringan status dan perilaku saat versi server lebih lama |
| `uitest.js` | 110 | Layar pengguna: tabel pesanan, filter, dan ekspor |
| `pdfharness.js` | audit | Tata letak PDF slip, label, dan rekap tidak keluar batas halaman |
| `prevtest.js` | 39 | Pratinjau dashboard sebagai superadmin |
| `prevtest2.js` | 16 | Pratinjau dashboard sebagai packing, termasuk nominal yang disembunyikan |
| `htmlcheck.js` | 29 | Id, nama fungsi yang dipanggil markup, dan satuan angka di halaman |
| `siapdeploy.js` | 24 | Kesiapan berkas untuk ditempel ke Apps Script: nama RPC, fungsi bantu, id, benturan nama, batas sheet, masa simpan cache, dan gaya berkas |
| `doccheck.js` | 20 | Nomor baris, nama kolom, nama RPC, dan jenis peringatan pada dokumen |

## Cara berkas uji menemukan berkas proyek

Setiap berkas menghitung akar proyek dari lokasi dirinya sendiri:

```js
const AKAR = require('node:path').join(__dirname, '..') + '/';
```

Jadi rangkaian uji dapat dijalankan dari direktori mana pun, dan folder proyek
boleh dipindah atau diganti namanya tanpa menyunting berkas uji.

## Kebiasaan saat merevisi

1. **Mulai dari yang gagal.** Jalankan pelarinya lebih dulu untuk mengetahui titik
   awalnya, lalu ulangi pada berkas yang paling dekat dengan perubahan.
2. **Satu perilaku baru, satu pernyataan baru.** Pernyataan yang menjelaskan
   alasannya lebih berguna daripada pernyataan yang hanya menyalin kode.
3. **Jangan memeriksa berdasarkan posisi baris.** Tabel di halaman dan sheet
   menyimpan barisnya dalam urutan yang dapat berubah, jadi carilah berdasarkan
   nomor pesanan, SKU, atau variasinya.
4. **Tutup dengan penanda dan kode keluar.** Setiap berkas mengakhiri keluarannya
   dengan `SEMUA LULUS` atau `BERSIH`, lalu `process.exit(gagal === 0 ? 0 : 1)`.
   Tanpa keduanya, pelari menganggap berkasnya gagal.
5. **Nomor baris paling cepat basi.** Bila `gas/Code.js`, `gas/SheetManager.js`,
   atau `gas/Index.html` berubah, perbarui dulu tabel nomor baris pada
   [docs/pembagian-jahit.md](../docs/pembagian-jahit.md) bagian 5, karena
   `doccheck.js` memeriksanya terhadap isi berkas. Bila `gas/Index.html` berubah,
   bangun ulang juga `dashboard-preview.html`, lalu jalankan `prevtest.js`.

## Yang bukan termasuk di sini

Berkas uji ini tidak diunggah ke Apps Script dan tidak ikut terpasang di
spreadsheet. Yang berjalan di sana hanya `gas/Code.js`, `gas/SheetManager.js`,
`gas/ShopeeApi.js`, dan `gas/Index.html`.
