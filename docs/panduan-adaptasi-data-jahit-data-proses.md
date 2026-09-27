# Panduan Modul Produksi Jahit — `DATA PROSES` & `DATA JAHIT`

Dokumen ini menjelaskan modul produksi jahit pada **ERP Begood**: dari mana datanya datang, bagaimana dua sheet produksinya diisi, fungsi server mana yang melayaninya, dan apa yang harus diperiksa sebelum angkanya dipercaya.

Modul ini diadaptasi dari dashboard produksi lama (**Begood.bdg Dashboard**, `code.gs` dan `index.html` satu berkas di `/Users/macbook/Documents/WEBAPPSCRIPT`), dengan satu perubahan mendasar: **sumber daftar kerjanya bukan lagi ketikan bebas, melainkan pesanan Shopee berstatus `[2] Menunggu Pickup`** pada sheet `Pesanan Masuk`.

| Item | Nilai |
| --- | --- |
| Sheet | `DATA PROSES` (4 kolom) dan `DATA JAHIT` (8 kolom) |
| Sumber daftar kerja | `Pesanan Masuk`, kolom D mengandung `Menunggu Pickup`. Daftar itu dibaca langsung, tidak disimpan di sheet |
| Fungsi server | 4 RPC: `getAntrianProduksi`, `simpanProduksiBatch`, `saveHargaProses`, `getProduksiRingkasan` |
| Bagian dashboard | tab **Produksi & antrian**, dan tab **Estimasi kerja** |
| Peran | baca `PACKING` · tulis `ADMIN` · nominal upah hanya `SUPERADMIN` |
| Berkas kode | `gas/Code.js` (mulai baris 2439), `gas/SheetManager.js` (baris 71 dan 469), `gas/Index.html` (baris 1393 dan 1598) |
| Dampak ke modul lain | Tidak ada perubahan skema `Pesanan Masuk`; status pesanan tidak diubah otomatis |

Dokumen terkait: [`struktur-spreadsheet.md`](./struktur-spreadsheet.md) bagian 8 dan 9 untuk skema kolomnya, [`arsitektur-login-peran.md`](./arsitektur-login-peran.md) untuk peran dan sesi, [`panduan-export-pdf.md`](./panduan-export-pdf.md) bila hasil estimasi ini kelak ingin dicetak.

---

## Daftar Isi

1. [Asal dan Lingkup Adaptasi](#1-asal-dan-lingkup-adaptasi)
2. [Kontrak Data](#2-kontrak-data)
3. [Alur Kerja Modul](#3-alur-kerja-modul)
4. [Referensi API](#4-referensi-api)
5. [Titik Sisipan Kode](#5-titik-sisipan-kode)
6. [SOP Harian Operator](#6-sop-harian-operator)
7. [Pemasangan dan Prasyarat](#7-pemasangan-dan-prasyarat)
8. [Uji Terima](#8-uji-terima)
9. [Troubleshooting](#9-troubleshooting)
10. [Batas dan Utang Teknis](#10-batas-dan-utang-teknis)
11. [Rencana Lanjut](#11-rencana-lanjut)

---

## 1. Asal dan Lingkup Adaptasi

### 1.1 Yang diambil

| Kebutuhan | Asal (`/Users/macbook/Documents/WEBAPPSCRIPT`) | Bentuk di ERP Begood |
| --- | --- | --- |
| Kamus harga & waktu per SKU | `buildProsesDict_` (`code.gs` 729) | `bangunKamusProses_` (`Code.js` 2579), kini berkunci nama SKU |
| Pencocokan SKU + variasi | `buildSkuLookupCandidates_` (786), `lookupProsesEntry_` (806) | `kunciSkuProduksi_` (2513), `kandidatKunciProses_` (2555), `cariProsesSku_` (2607) |
| Baca teks sel dari nilai tampilan | `parseSheetTextCell_` (752), `readSheetTextColumnsFresh_` (760) | `teksKolom_` (`SheetManager.js` 549) |
| Baris kosong & sesi | `isEmptyJahitRow` (1802), `normalizeSesi` (1808) | `sesiProduksi_` (2502) |
| Agregasi estimasi per penjahit & sesi | `aggregateRingkasanPenjahit_` (2084), `buildRingkasanPenjahitPayload_` (2138), `consolidateRingkasanLineItems_` (915) | `kumpulkanEstimasiProduksi_` (2770) |
| Simpan hasil produksi | `submitBatchData` (1864) | `simpanProduksiBatch` (3147) |
| Tampilan panel & tabel | `index.html` 2561 (`page-ringkasan`), 2645 (`page-input-data`), 5855 (`renderRingkasanPerPenjahit`) | `content-produksi` (`Index.html` 1388), `content-estimasi` (1614), `renderAntrianProduksi` (5855), `renderEstimasiProduksi` (6330) |

### 1.2 Yang sengaja tidak diambil

Modul ini berhenti di **beban kerja dan estimasi upah**. Berikut yang ada di project asal tetapi tidak ikut, beserta alasannya:

| Tidak diambil | Alasan |
| --- | --- |
| `getPenggajian` (2284), `getGajiKaryawan` (3115), `finalizePayroll` (6424), `PAYROLL_RUN` / `PAYROLL_DETAIL` | Finalisasi gaji belum menjadi lingkup ERP Begood. Estimasi di sini tidak memposting transaksi apa pun |
| `KASBON`, potong gaji, uang makan dari `GAJI` / `HELPER` | Butuh sheet `PERSONIL`, `GAJI`, dan `HELPER` yang belum ada di ERP Begood |
| BOM, `Jurnal Stock`, `STOCK OPNAME`, `postPemakaianBahanProduksi_` (7558) | Auto-deduct bahan saat produksi belum diperlukan; stok gudang di ERP Begood dikelola lewat status pesanan |
| `Master Produk HPP` | Estimasi di sini memakai harga proses dari `DATA PROSES`, bukan HPP per SKU |
| `getRingkasanAI` (2007) | Di project asal pun sudah tidak dipakai halaman mana pun |
| `SPREADSHEET_ID` dan `ALLOWED_USERS = ['*']` | ERP Begood memakai spreadsheet aktif dan RBAC token (`wajibSesi_`), bukan daftar email |

### 1.3 Perubahan yang disengaja

Enam hal ini berbeda dari project asal, dan perbedaannya bukan kebetulan:

1. **Sumber daftar kerja.** Pesanan `[2] Menunggu Pickup` yang menentukan SKU, variasi, dan qty. Daftar itu dibaca ulang setiap kali layarnya dibuka, dan **tidak disimpan** di sheet mana pun. Sesi dan nama penjahit tetap diisi manusia karena keduanya tidak ada di pesanan.
2. **Satu harga per SKU.** `DATA PROSES` adalah daftar harga, bukan daftar kerja: satu baris mewakili satu SKU dan berlaku untuk seluruh variasi serta seluruh pesanannya. Harga khusus satu variasi ditulis sebagai baris dengan nama gabungan, misalnya `SARKUR 120/5 COFFEE`. Petugas cukup mengisi sekali per SKU, dan SKU baru dari pesanan langsung mendapat barisnya saat disimpan.
3. **Kunci idempotensi memakai nomor pesanan.** Mengirim tabel input hasil jahit dua kali tidak menggandakan baris (dan karena itu tidak menggandakan upah). Project asal tidak punya kunci ini karena datanya memang diketik.
4. **Salin per kolom, dan baris kosong tidak pernah menimpa.** Project asal menimpa seluruh entri dengan baris terakhir (`code.gs` 741); satu baris baru yang belum dihargai sudah cukup untuk membuat upah sebuah SKU menjadi Rp 0. Di sini nilai disalin per kolom (`terapkanNilaiKamus_`, `Code.js` 2531).
5. **Nominal upah dipisahkan dari beban kerja.** Peran selain `SUPERADMIN` tetap menerima jumlah pcs dan menit kerja, tetapi tidak menerima rupiah (`tanpaUangEstimasi_`, 2959).
6. **Variasi dipotong pada koma pertama.** Variasi berbunyi "Lilac,BC 90x220" dipakai sebagai "Lilac" saja, karena keterangan sesudah koma adalah ukuran yang sudah tercermin pada SKU. Pemotongan ini berlaku saat data masuk, saat dibaca, dan saat kunci disusun, sehingga baris lama tetap cocok dengan baris baru; rinciannya di bagian 2.4.

---

## 2. Kontrak Data

### 2.1 `DATA PROSES` — daftar harga dan waktu proses (4 kolom)

| Kol | Header | Tipe | Diisi oleh | Aturan |
| --- | --- | --- | --- | --- |
| **A** | SKU | Text (`@`) | **manusia** | Kunci baris; dinormalkan (spasi dirapatkan, huruf kecil) saat dicocokkan |
| **B** | Harga Jahit | Number | **manusia** | Upah per pcs. Kosong berarti belum dihargai, bukan berarti gratis |
| **C** | Waktu Jahit (menit) | Number | **manusia** | Menit per pcs |
| **D** | Waktu Potong (menit) | Number | **manusia** | Menit per pcs |

Satu baris mewakili **satu SKU**, bukan satu baris pesanan. Karena itu tidak ada kolom Variasi, Qty, maupun nomor pesanan: barisnya berlaku untuk seluruh variasi dan seluruh pesanan SKU itu. Daftar kerja jahitnya sendiri tidak disimpan di sini, melainkan dibaca langsung dari pesanan `[2] Menunggu Pickup` (`getAntrianProduksi`).

Kolom **A sampai D tidak boleh berpindah posisi**, karena seluruh pembaca membacanya menurut nomor kolom, bukan menurut nama header. Nama header sendiri milik pemilik sheet: inisialisasi hanya mengisi kolom yang masih kosong (`tulisHeaderProses_`, `SheetManager.js` 475), sehingga kata yang sudah dipilih manusia tidak pernah ditimpa kode.

Harga khusus untuk satu variasi ditulis sebagai baris tersendiri dengan nama gabungan, misalnya `SARKUR 120/5 COFFEE`. Pencocokannya mencoba nama gabungan lebih dulu, baru nama SKU (`kandidatKunciProses_`, `Code.js` 2557), sehingga harga khusus variasi menang tanpa perlu kolom tambahan.

### 2.2 `DATA JAHIT` — hasil jahit (8 kolom)

| Kol | Header | Tipe | Diisi oleh |
| --- | --- | --- | --- |
| **A** | Tanggal | Date (`yyyy-mm-dd`) | operator; bawaannya tanggal kerja yang dipilih |
| **B** | Sesi | Text | **operator** — `PAGI` atau `SIANG` |
| **C** | Nama/SKU | Text (`@`) | dari daftar kerja di layar |
| **D** | Variasi | Text (`@`) | dari daftar kerja di layar |
| **E** | Jumlah | Number (`0`) | dari daftar kerja di layar |
| **F** | Penjahit | Text (`@`) | **operator** |
| **G** | No. Pesanan | Text (`@`) | ditarik dari antrian |
| **H** | Toko | Text (`@`) | ditarik dari antrian |

### 2.3 Aturan pengisian yang berlaku di kedua sheet

| Aturan | Alasan |
| --- | --- |
| Sel kosong berarti "belum dihargai"; angka 0 berarti "gratis" | Keduanya berbeda arti. Baris yang belum dihargai ditulis kosong supaya terlihat dan bisa ditindaklanjuti (`barisHargaProses_`, `SheetManager.js` 671) |
| Kolom teks dipaksa format `@` | Nomor pesanan Shopee adalah deretan angka panjang. Tanpa format teks, isinya berubah menjadi notasi eksponensial lalu tidak lagi cocok saat dicocokkan |
| Tanggal dibaca apa adanya | Membacanya sebagai `Date` lalu memformatnya akan menggeser hari bila zona waktu skrip berbeda dengan zona waktu lembar kerja (`bacaBarisProduksi_`, 626) |
| Angka dari halaman selalu datang sebagai teks | `angkaProduksi_` (`Code.js` 2490) menerima `"Rp 12.000"` dan mengembalikan 0 untuk isian yang tidak terbaca, supaya satu baris salah isi tidak membuat seluruh laporan menjadi `NaN` |

### 2.4 Kunci dan bentuk baku

Dua kunci dipakai modul ini, dan keduanya didefinisikan **satu kali saja** supaya penulisan dan pembacaan tidak pernah berbeda pendapat:

| Kunci | Bentuk | Gunanya | Fungsi |
| --- | --- | --- | --- |
| Kunci baris hasil jahit (anti-duplikat) | `nopesanan\|sku\|variasi\|penjahit` | mencegah satu baris hasil jahit tercatat dua kali, tanpa menghalangi satu baris pesanan dikerjakan dua orang | `kunciProduksi_` (`SheetManager.js` 631) |
| Kunci kamus harga | `sku` dan `sku variasi` | mencari harga & waktu | `kandidatKunciProses_` (`Code.js` 2557) |

Bentuk bakunya: trim, rapatkan spasi ganda menjadi satu, lalu huruf kecil (`normalTeks_` 582, `kunciSkuProduksi_` 2515). Tanpa ini, `"SARKUR 120/5"` dan `"sarkur  120/5"` dianggap dua barang berbeda, dan satu baris hasil jahit tercatat dua kali.

#### Pencarian harga: dua kandidat, berhenti pada temuan pertama

| Urutan | Kandidat | Dipakai kapan |
| --- | --- | --- |
| 1 | `sku variasi` (nama gabungan) | ada baris khusus untuk kombinasi SKU dan variasi itu, misalnya `SARKUR 120/5 COFFEE` |
| 2 | `sku` | harga umum SKU itu, berlaku untuk seluruh variasi dan seluruh pesanannya |

Variasi yang isinya hanya tanda `-` tidak ikut digabungkan, karena tanda itu dipakai pesanan untuk mengatakan "tidak ada variasi".

#### Variasi dipotong pada koma pertama

Nama variasi dari Shopee kadang memuat dua keterangan sekaligus, misalnya
`Lilac,BC 90x220`: warna di depan koma, lalu ukuran yang sebenarnya sudah tercermin
pada SKU. ERP memakai bagian sebelum koma saja, di satu tempat saja
(`bersihkanVariasi_`, `SheetManager.js` 602), dan pemotongan itu berlaku di tiga
lapis sekaligus:

| Lapis | Tempatnya | Alasannya |
| --- | --- | --- |
| Saat data masuk | penyimpanan hasil tarikan Shopee | sheet `Pesanan Masuk` menyimpan bentuk yang dipakai ERP, dan penarikan berikutnya menulis bentuk yang sama |
| Saat dibaca | `mapBarisPesanan_` dan pembaca sheet produksi | baris yang sudah lama tersimpan tetap terbaca pendek, tanpa perlu menyunting sheetnya |
| Saat kunci disusun | `kunciAntrian_`, dan karena itu juga kunci hasil jahit serta kunci harga | variasi panjang dan pendek menunjuk baris yang sama, sehingga tidak ada pekerjaan yang terhitung dua kali |

Nama baris `DATA PROSES` dipotong dengan aturan yang sama saat kamus harga dibangun
(`bangunKamusProses_`), sebab baris harga khusus variasi ditulis sebagai nama
gabungan SKU dan variasinya. Tanpa itu, baris bertuliskan
`SARKUR 120/5 COFFEE,BC 90X220` tidak lagi cocok dengan variasi yang sudah menjadi
`Coffee`.

Bila beberapa baris memuat nilai berbeda untuk kunci yang sama, yang dipakai adalah **nilai terakhir yang tidak kosong**. Nilai nol dan kosong tidak pernah menimpa nilai yang sudah terisi, tetapi nilai berharga yang lebih baru menggantikan yang lama. Artinya harga sebuah SKU diambil dari baris terakhir yang sudah dihargai, bukan dari baris pertamanya.

---

## 3. Alur Kerja Modul

```text
Pesanan Masuk (kolom D = "[2] Menunggu Pickup")
        │   SheetManager.getOrderRowsByStatus('Menunggu Pickup', 2000, kodeToko)
        │   dibaca ulang tiap kali layar dibuka; tidak disimpan di sheet
        ▼
  [1] DAFTAR KERJA  ────────────────►  layar saja (getAntrianProduksi)
        SKU, variasi, qty dari pesanan;  ├─ sudah ada di DATA JAHIT → "sudah dijahit"
        keadaan dibaca dari DATA JAHIT   └─ SKU belum dihargai → daftar "tanpa harga"
        ▼
  [2] ISI HARGA & WAKTU  ───────────►  DATA PROSES kolom A-D
        saveHargaProses               (baris SKU lama diperbarui di tempat,
        │                              SKU baru ditambahkan sebagai baris baru)
        ▼
  [3] LENGKAPI & SIMPAN HASIL  ─────►  DATA JAHIT
        simpanProduksiBatch           (tanggal, sesi, penjahit wajib terisi)
        │   atau, satu kali tekan dari tab Pembagian jahit:
        └─ tutupSesiJahit ──► bagi pcs + isi harga yang kosong + simpan hasilnya
        ▼
  [4] ESTIMASI SATU TANGGAL  ───────►  beban kerja (pcs, menit) untuk semua peran,
        getProduksiRingkasan          nominal upah hanya untuk SUPERADMIN
```

### 3.1 Langkah 1 — Daftar kerja (`getAntrianProduksi`)

Pesanan `[2]` dibaca dari sheet `Pesanan Masuk`, disaring, lalu dipakai apa adanya sebagai daftar kerja. Tidak ada yang ditulis ke sheet pada langkah ini, sehingga satu pun tidak ada yang perlu ditarik atau diselaraskan.

| Keadaan baris | Perlakuan |
| --- | --- |
| SKU kosong atau `-` | Dilewati (`jadikanBarisAntrian_`, `Code.js` 2686) |
| Qty 0 atau kosong | Dilewati |
| Sudah ada di `DATA JAHIT` | Ditandai `sudahDijahit: true`, dan tombol **Isi ke tabel input** tidak ditawarkan |
| SKU belum punya harga | Ditandai `tanpaHarga: true`, dan muncul sebagai pilihan cepat di panel harga |

Satu pesanan dapat muncul lebih dari sekali — satu baris untuk setiap produk yang dibeli — karena satu pesanan memang dapat berisi dua variasi barang, dan keduanya dua baris pekerjaan yang berbeda.

Harga pada daftar ini dibaca dari kamus `DATA PROSES` yang disimpan di cache 120 detik (`bacaProsesCached_`, `Code.js` 2641). Karena itu, setiap kali harga disimpan, cache dibuang lebih dulu (`hapusCacheProses_`, 2669) supaya angka yang tampil tidak tertinggal satu langkah.

### 3.2 Langkah 2 — Isi harga & waktu (`saveHargaProses`)

Formulir mengirim satu SKU: nama SKU, harga jahit, menit jahit, dan menit potong. Penyimpanannya berupa **upsert**, jadi pemanggil tidak perlu tahu SKU-nya sudah ada atau belum:

| Keadaan SKU di `DATA PROSES` | Perlakuan |
| --- | --- |
| Sudah punya baris | Barisnya diperbarui di tempat; nilai yang dikirim menggantikan nilai lama |
| Belum punya baris | Satu baris baru ditambahkan di bawah daftar |

Dua pagar berlaku, dan keduanya melindungi pekerjaan manusia:

1. Isian yang **kosong atau nol tidak pernah ditulis**. Tanpa pagar ini, satu kolom yang lupa diisi bisa menghapus nilai yang sudah benar. Untuk mengosongkan sebuah nilai, selnya dihapus langsung di sheet.
2. Nilai yang **sama persis tidak dihitung sebagai perubahan**, sehingga pesan yang dilaporkan jujur dan penulisan ulang yang tidak perlu bisa dihindari (`simpanHargaProses`, `SheetManager.js` 1149).

Isi yang tersimpan langsung terbaca oleh daftar kerja dan estimasi, tanpa tindakan lain.

### 3.3 Langkah 3 — Simpan hasil jahit (`simpanProduksiBatch` atau `tutupSesiJahit`)

Ada dua jalan, dan keduanya menulis ke sheet yang sama:

| Jalan | Kapan dipakai | Sumber penjahitnya |
| --- | --- | --- |
| Tombol **Tutup sesi & simpan hasil** di tab Pembagian jahit (`tutupSesiJahit`) | Alur harian biasa | Hasil pembagian: sistem sudah tahu siapa mengerjakan pcs mana |
| Tabel input manual (`simpanProduksiBatch`) | Baris yang penjahitnya berbeda dari hasil pembagian, atau pekerjaan yang tidak lewat pembagian | Diketik operator |

Pada jalan pertama, beberapa pcs yang jatuh ke orang yang sama digabung menjadi satu baris berjumlah sekian, dan pcs yang belum punya penjahit tidak disimpan — jadi tidak ada nama yang dikarang. Rinciannya ada di [`pembagian-jahit.md`](./pembagian-jahit.md) bagian 4.6.

Untuk jalan manual, baris divalidasi satu per satu, dan baris yang belum lengkap **ditolak dengan menyebut nomor barisnya**, bukan diterima diam-diam lalu hilang dari laporan:

| Syarat | Pesan bila gagal |
| --- | --- |
| SKU terisi | `Baris n: SKU kosong.` |
| Jumlah > 0 | `Baris n: jumlah harus lebih dari nol.` |
| Sesi = `PAGI` atau `SIANG` | `Baris n: sesi harus PAGI atau SIANG.` |
| Nama penjahit terisi | `Baris n: nama penjahit belum diisi.` |

Seluruh pesan itu digabung dalam satu `Error`, sehingga pengirim tidak perlu mencoba berulang kali untuk menemukan baris yang salah. Tanggal yang tidak terbaca akan jatuh ke tanggal hari ini menurut WIB (`tanggalWibHariIni_`, 2471).

### 3.4 Langkah 4 — Estimasi (`getProduksiRingkasan`)

Hanya baris `DATA JAHIT` pada tanggal itu yang dijumlahkan. Untuk setiap baris: `pcs × menit` dan `pcs × harga`. Baris yang SKU-nya belum punya harga **tetap dihitung jumlah dan menitnya**, lalu dicatat pada `barisTanpaHarga` dan `skuTanpaHarga`, karena baris seperti itu bukan kekeliruan perhitungan melainkan harga yang memang belum diisi.

Rincian per SKU dalam satu sesi yang sama digabung, sehingga satu SKU yang dijahit dua kali sehari tidak muncul sebagai dua baris laporan yang harus dibaca terpisah (`Code.js` 2843).

### 3.5 Aman dijalankan berulang

| Tindakan | Dijalankan dua kali | Hasil |
| --- | --- | --- |
| Membuka daftar kerja | Membaca ulang pesanan `[2]` | Daftar sama selama status pesanannya sama; tidak ada sheet yang bertambah |
| Kirim tabel input jahit | Tidak menambah baris `DATA JAHIT` | Dilewati, dilaporkan sebagai `dilewati` |
| Simpan harga SKU yang sama | Baris SKU itu diperbarui, bukan digandakan | 0 sel berubah bila nilainya sama |
| Hitung estimasi | Idempoten | Angka sama selama isi sheet sama |

---

## 4. Referensi API

Semua fungsi di bawah dipanggil dari halaman memakai `google.script.run` dengan `sesiToken` sebagai argumen pertama, dan semuanya melewati `wajibSesi_` (`Code.js` 1192). Kesalahan selalu dilempar sebagai `Error` dengan pesan berbahasa Indonesia yang siap ditampilkan.

### 4.1 Daftar RPC

| RPC | Peran minimal | Argumen | Mengubah data | Efek samping |
| --- | --- | --- | --- | --- |
| `getAntrianProduksi(token, kodeToko)` | `PACKING` | `kodeToko` opsional; kosong = semua toko | tidak | — |
| `simpanProduksiBatch(token, baris)` | `ADMIN` | `baris`: array objek | ya, `DATA JAHIT` | `Log_Aktivitas`: `PRODUKSI_SIMPAN_HASIL` |
| `saveHargaProses(token, daftar)` | `ADMIN` | `daftar`: array objek | ya, `DATA PROSES` kolom A–D; SKU baru ditambahkan sebagai baris | `Log_Aktivitas`: `PRODUKSI_HARGA_PROSES`; cache kamus dibuang |
| `getProduksiRingkasan(token, tanggal)` | `PACKING` | `tanggal` `yyyy-MM-dd` | tidak | — |
| `tutupSesiJahit(token, tanggal, sesi, kodeToko)` | `ADMIN` | `tanggal`/`sesi` opsional, kosong = hari ini / jam WIB | ya, `PEMBAGIAN JAHIT` lalu `DATA JAHIT` | `Log_Aktivitas`: `PRODUKSI_TUTUP_SESI`; cache kamus dibuang bila harga diselaraskan |

### 4.2 `getAntrianProduksi` — bentuk balikan

```js
{
  cakupan: 'BGD',                       // kode toko yang dipakai menyaring
  pesanan: [
    {
      noPesanan: '260911P83ME3FW',
      toko: 'BGD',
      sku: 'SARKUR 120/5',
      variasi: 'Coffee',
      qty: 2,
      status: '[2] Menunggu Pickup',
      sudahDijahit: false,              // sudah ada di DATA JAHIT
      tanpaHarga: true,                 // SKU belum dihargai
      hargaSatuan: 0                    // hanya dikirim ke peran yang boleh lihat uang
    }
  ],
  ringkasan: { baris: 0, pesanan: 0, qty: 0, belumDijahit: 0, tanpaHarga: 0 },
  penjahitTersimpan: ['OPIK', 'ADUL'],  // pilihan kolom Penjahit, dari DATA JAHIT
  sesi: ['PAGI', 'SIANG'],
  uangDisembunyikan: true               // true bila pemanggil bukan SUPERADMIN
}
```

### 4.3 `simpanProduksiBatch` — bentuk masukan dan balikan

```js
// masukan
[{
  tanggal: '2026-09-27',   // boleh kosong -> jatuh ke hari ini menurut WIB
  sesi: 'SIANG',           // wajib PAGI atau SIANG
  sku: 'SARKUR 120/5',
  variasi: 'Coffee',
  jumlah: 2,               // wajib > 0
  penjahit: 'OPIK',        // wajib
  noPesanan: '260911P83ME3FW',
  toko: 'BGD'
}]

// balikan
{ ditambah: 2, dilewati: 0, pesan: '2 baris hasil jahit disimpan.' }
```

### 4.4 `saveHargaProses` — bentuk masukan dan balikan

```js
// masukan
[{
  sku: 'SARKUR 120/5',
  harga: 12000,    // minimal salah satu dari tiga ini harus > 0
  jahit: 20,
  potong: 5
}]

// balikan
{
  sku: 1,                 // jumlah SKU yang diproses
  selDiperbarui: 6,       // sel yang nilainya benar-benar berubah
  barisDitambah: 1,       // SKU yang belum ada di daftar, ditambahkan sebagai baris baru
  pesan: 'Harga 1 SKU disimpan, 6 sel diperbarui, 1 SKU baru ditambahkan ke daftar.'
}
```

Nilai negatif ditolak, dan baris yang ketiga angkanya nol juga ditolak dengan pesan `isi minimal salah satu dari harga, waktu jahit, atau waktu potong`. Nama variasi tidak dikirim lagi: harga berlaku per SKU, sedangkan harga khusus satu variasi ditulis sebagai baris bernama gabungan.

### 4.5 `tutupSesiJahit` — bentuk balikan

```js
{
  berhasil: true,
  tanggal: '2026-09-27',
  sesi: 'SIANG',
  ditambah: 4,                 // baris hasil jahit yang tersimpan
  dilewati: 1,                 // baris yang sudah pernah tersimpan
  pcsBaruDibagi: 5,            // pcs baru yang masuk daftar pembagian
  hargaDiselaraskan: 2,        // sel harga pcs lama yang terisi
  belumBerpemilik: 1,          // pcs tanpa penjahit, sengaja tidak disimpan
  pcsAntrian: 9,
  peringatan: [{ tipe, noPesanan, sku, variasi, pesan }],
  pesan: '4 baris hasil jahit disimpan untuk sesi SIANG tanggal 2026-09-27. ...'
}
```

RPC ini adalah jalan pintas untuk rangkaian harian: bagi pekerjaan, isi harga yang
masih kosong, lalu simpan hasilnya. Rinciannya ada di
[`pembagian-jahit.md`](./pembagian-jahit.md) bagian 4.6, bersama aturan penyimpanan
per pcs. `simpanProduksiBatch` tetap ada untuk pengisian manual, misalnya bila ada
baris yang penjahitnya berbeda dari hasil pembagian.

### 4.6 `getProduksiRingkasan` — bentuk balikan

```js
{
  tanggal: '2026-09-27',
  total: { baris: 14, pcs: 31, waktuJahit: 620, waktuPotong: 155, waktu: 775, upah: 372000 },
  sesi: {
    PAGI:  { baris: 6, pcs: 12, waktuJahit: 240, waktuPotong: 60, waktu: 300, upah: 144000 },
    SIANG: { baris: 8, pcs: 19, waktuJahit: 380, waktuPotong: 95, waktu: 475, upah: 228000 }
  },
  penjahit: [{
    nama: 'OPIK',
    pcs: 20, waktuJahit: 400, waktuPotong: 100, waktu: 500, upah: 240000,
    sesi: { PAGI: { /* bentuknya sama seperti blok sesi di atas */ },
             SIANG: { /* ... */ } },
    items: [{ sesi: 'SIANG', sku: 'SARKUR 120/5', variasi: 'Coffee',
              jumlah: 2, waktuJahit: 40, waktuPotong: 10, waktu: 50, upah: 24000,
              hargaSatuan: 12000 }]
  }],
  jumlahPenjahit: 2,
  barisTanpaHarga: 1,
  skuTanpaHarga: [{ sku: 'TAS MIKA AJA', variasi: 'SINGLE' }],
  uangDisembunyikan: false
}
```

Untuk peran selain `SUPERADMIN`, `tanpaUangEstimasi_` (2954) menghapus `total.upah`, `sesi.*.upah`, `penjahit[].upah`, `penjahit[].sesi.*.upah`, `items[].upah`, dan `items[].hargaSatuan`, lalu menandai `uangDisembunyikan: true`. Yang dihapus hanya nominalnya; jumlah pcs dan menit kerja tetap ada karena keduanya yang dipakai mengatur beban kerja. Nominal yang tidak berhak dilihat tidak ditulis sebagai Rp 0, sebab angka nol adalah keterangan yang keliru.

---

## 5. Titik Sisipan Kode

Tabel ini dipakai untuk menelusuri modul saat ada perubahan. Nomor baris mengikuti keadaan berkas saat dokumen ini ditulis.

### 5.1 `gas/SheetManager.js`

| Bagian | Baris | Isi |
| --- | --- | --- |
| `SHEETS` | 9–27 | Tambahan `PROSES: 'DATA PROSES'` dan `PRODUKSI: 'DATA JAHIT'` |
| `PROSES_HEADERS` / `PRODUKSI_HEADERS` | 89–112 | 4 kolom dan 8 kolom, satu-satunya sumber kebenaran urutan kolom |
| `KOLOM_PROSES` / `KOLOM_PRODUKSI` | 114–122 | Indeks kolom bernama, dipakai seluruh pembaca |
| `tulisHeaderProses_` | 475 | Menyiapkan header DATA PROSES tanpa menimpa label yang sudah ada |
| Blok helper produksi | 555–718 | `teksKolom_` 555, `angkaKolom_` 564, `normalTeks_` 582, `bersihkanVariasi_` 597 (pemangkasan sesudah koma), `kunciAntrian_` 612, `kunciProduksi_` 626, `bacaBarisProses_` 636, `bacaBarisProduksi_` 663, `barisHargaProses_` 708, `barisProduksiUntukSheet_` 718 |
| `initAllSheets` blok 6 & 7 | 1048–1083 | Membuat kedua sheet, menulis header, memasang format kolom, membekukan baris 1 |
| API keluar | 1242–2971 | `bacaProses` 1242, `bacaProduksi` 1252, `kunciAntrian` 1268, `kunciProduksi` 1282, `bersihkanVariasi` 1294, `tambahProduksiBatch` 1305, `simpanHargaProses` 1337, `simpanQtyPembagian` 2877, `perbaruiHargaPembagian` 2971 |

`initAllSheets` (1012) aman dijalankan berulang: `tulisHeader_` menulis header hanya bila baris pertama memang bukan header, dan menyisipkan satu baris di atasnya bila perlu, sehingga data lama tidak tertimpa. DATA PROSES memakai penjagaan yang lebih longgar lagi (`tulisHeaderProses_`, 475): label yang sudah ada dibiarkan, dan hanya kolom yang masih kosong yang diisi.

### 5.2 `gas/Code.js`

| Bagian | Baris | Isi |
| --- | --- | --- |
| Awal modul & batas | 2466–2473 | Komentar modul, `BATAS_ANTRIAN_PRODUKSI` 2466, `SESI_PRODUKSI` 2468, `STATUS_ANTRIAN_PRODUKSI` 2473 |
| Utilitas | 2492–2515 | `stempelWib_`, `tanggalWibHariIni_`, `angkaProduksi_` 2492, `sesiProduksi_` 2504, `kunciSkuProduksi_` 2515 |
| Kamus harga | 2531–2613 | `terapkanNilaiKamus_` 2531, `kandidatKunciProses_` 2557, `bangunKamusProses_` 2581, `cariProsesSku_` 2613 |
| Cache | 2632–2681 | `kunciCacheProses_` 2632, `bacaProsesCached_` 2646, `hapusCacheProses_` 2674, `nomorGenerasiCache_` 2681 |
| Persiapan baris | 2691–2762 | `jadikanBarisAntrian_` 2691, `daftarPenjahit_` 2720, `normalisasiTanggalProduksi_` 2762 |
| Perhitungan estimasi | 2793–2958 | `kosongSesiProduksi_` 2793, `kumpulkanEstimasiProduksi_` 2810, `tanpaUangEstimasi_` 2958 |
| RPC | 2993–3251 | `getAntrianProduksi` 2993, `simpanProduksiBatch` 3067, `saveHargaProses` 3167, `getProduksiRingkasan` 3251 |
| RPC penutup sesi (modul pembagian) | 4246 | `tutupSesiJahit`, satu kali tekan untuk bagi + simpan hasil |

### 5.3 `gas/Index.html`

| Bagian | Baris | Isi |
| --- | --- | --- |
| Tombol tab | 882–891 | `tab-produksi` (berkelas `butuh-admin`) dan `tab-estimasi` |
| Panel Produksi & antrian | 1393–1597 | Notis versi kode, catatan cakupan `produksi-scope`, kartu ringkasan, filter keadaan, tabel `prod-antrian-table`, formulir harga (`prod-harga-sku`, `prod-harga-nilai`, `prod-harga-jahit`, `prod-harga-potong`), tabel input, daftar `prod-sku-belum-harga-wrap` |
| Panel Estimasi kerja | 1598–1730 | `est-tanggal`, `btn-hitung-estimasi`, `est-note`, kartu `est-pcs`, `est-baris`, `est-waktu`, `est-waktu-jahit`, `est-waktu-potong`, `est-penjahit`, dan kartu upah `est-upah` yang berkelas `butuh-uang` |
| Daftar tab | 4108–4545 | `JUDUL_TAB` 4108 dan `TAB_NAMES` 4545 (urutannya menentukan urutan di layar) |
| Logika halaman | 6383–6895 | `teksUangProduksi_` 6383, `tampilkanPeringatanProduksi_` 6392, `siapkanEstimasiProduksi` 6405, `muatAntrianProduksi` 6413, `lolosFilterAntrian_` 6452, `lencanaAntrian_` 6459, `renderAntrianProduksi` 6466, `kunciProduksiKlien_` 6598, `isiSatuBarisAntrian` 6620, `isiTabelDariAntrian` 6641, `tambahBarisProduksi` 6676, `hapusBarisProduksi` 6683, `ubahBarisProduksi` 6691, `perbaruiInfoInputProduksi_` 6697, `renderTabelInputProduksi` 6709, `simpanProduksiAction` 6744, `simpanHargaProsesAction` 6816, `muatEstimasiProduksi` 6865, `renderEstimasiProduksi` 6895 |
| Logika tab pembagian | 4148–4508 | `muatPembagianJahit` 4148, `renderPembagianJahit` 4197, `renderUnitPembagian_` 4303, `bagiJahitAction` 4383, `sesiDefaultKlien_` 4414, `siapkanSesiPembagian_` 4418, `tutupSesiJahitAction` 4431, `simpanPenjahitAction` 4469, `simpanAturanAction` 4508 |

Penjagaan peran di halaman memakai kelas `butuh-admin` dan `butuh-uang` yang sudah ada sejak modul Pengguna (`setel('.butuh-admin', ...)`), sehingga tab dan kartu upah tersembunyi di peramban **sebelum** jawaban server tiba. Penjagaan di server tetap yang menentukan; penyembunyian di halaman hanya menghindari tempat yang terlanjur terlihat.

---

## 6. SOP Harian Operator

Peran yang dibutuhkan: `ADMIN` untuk langkah 2–4, `PACKING` cukup untuk langkah 1, 5, dan 6. Nominal upah hanya tampil untuk `SUPERADMIN`.

Rangkaian hariannya dua baris: **sinkronkan pesanan** (dapat diotomatiskan dengan trigger per jam), lalu **satu kali tekan** pada tombol tutup sesi di tab Pembagian jahit. Sisanya memeriksa.

| # | Langkah | Di mana | Hasil yang diharapkan |
| --- | --- | --- | --- |
| 1 | Periksa kartu ringkasan **Produksi & antrian** | sidebar | Terbaca berapa baris menunggu pickup, berapa yang belum dijahit, dan berapa yang belum dihargai |
| 2 | Isi **Harga dan waktu proses** (bila ada yang belum dihargai) | formulir di panel Produksi & antrian | Pilih SKU dari daftar (yang belum dihargai muncul sebagai tombol pintas), isi minimal satu dari harga jahit / menit jahit / menit potong, lalu Simpan. Isian yang dikosongkan membiarkan nilai lama apa adanya. Langkah ini boleh ditunda: tab Pembagian jahit sudah menampilkannya sebagai peringatan |
| 3 | Pilih sesi, lalu tekan **Tutup sesi & simpan hasil** | tab **Pembagian jahit** | Satu kali tekan: pcs yang belum terbagi dibagi, harga pcs lama yang kosong diisi, dan seluruh hasilnya disimpan ke `DATA JAHIT` lengkap dengan penjahitnya. Pesan menyebut jumlah baris tersimpan dan pcs yang belum punya penjahit |
| 4 | Periksa **Yang perlu ditindaklanjuti** dan kartu **Belum ditetapkan** | tab **Pembagian jahit** | Bila ada yang bukan nol, betulkan setelannya (pola SKU atau penjahit aktif), lalu tekan tombolnya sekali lagi. Pcs yang sudah berpemilik tidak dibagi atau disimpan dua kali |
| 5 | Buka **Estimasi kerja**, pilih tanggal, tekan **Hitung estimasi** | sidebar | Total pcs, total menit, jumlah penjahit, dan bila berhak, total upah |
| 6 | Setelah paket diserahkan ke kurir, ubah **Status Internal Begood** dari `[2]` ke `[3]` | bagian Pesanan masuk | Pesanan keluar dari antrian. Perubahan ini **manual**; modul produksi tidak mengubah status pesanan |
| 7 | Bila angka terasa janggal, buka **Log aktivitas** | sidebar | Jejak `PRODUKSI_TUTUP_SESI`, `PRODUKSI_SIMPAN_HASIL`, dan `PRODUKSI_HARGA_PROSES` beserta jumlah dan pelakunya |

Tabel input manual pada tab Produksi & antrian tetap ada untuk keadaan yang tidak lewat pembagian, misalnya pekerjaan tambahan atau pcs yang penjahitnya berbeda dari hasil pembagian.

Catatan penting untuk langkah 6: pesanan yang tetap berstatus `[2]` akan **terus muncul** di antrian. Itu memang perilakunya, karena status dikelola manusia. Anti-duplikat hanya mencegah baris hasil jahit tercatat dua kali, bukan mencegah baris tampil kembali.

---

## 7. Pemasangan dan Prasyarat

| # | Langkah | Perintah atau tindakan | Tanda berhasil |
| --- | --- | --- | --- |
| 1 | Pastikan struktur sheet terpasang | Di Google Sheets: menu **ERP Begood** > **Inisialisasi / Reset Tabel Sheet** | Muncul pesan bahwa `Pesanan Masuk`, `DB_Token`, `Konfigurasi`, `Log_Aktivitas`, `Pengguna`, `DATA PROSES`, dan `DATA JAHIT` siap; dua sheet terakhir muncul dengan header berwarna |
| 2 | Periksa format kolom | Lihat `DATA PROSES` A–D dan `DATA JAHIT` A–H | Harga berformat Rp, waktu berformat angka, kolom teks (SKU, variasi, nomor pesanan, toko) rata kiri |
| 3 | Setel kebijakan masuk | Sheet `Konfigurasi`, parameter `WAJIB_LOGIN` | `TIDAK` selama uji coba, `YA` bila dashboard sudah boleh menuntut masuk |
| 4 | Pastikan ada akun berperan `ADMIN` | Sheet `Pengguna` | Satu baris aktif dengan peran `ADMIN`, dan satu `SUPERADMIN` untuk melihat upah |
| 5 | Salin berkas ke editor Apps Script | `gas/Code.js` → `Code.gs`, `gas/SheetManager.js` → `SheetManager.gs`, `gas/ShopeeApi.js` → `ShopeeApi.gs`, `gas/Index.html` → `Index.html` | Tidak ada galat saat disimpan |
| 6 | Perbarui deployment | **Deploy** > **Manage deployments** > **Edit** > **Version: New version** | URL `/exec` memuat bagian **Produksi & antrian** |
| 7 | Uji tanpa deploy (opsional) | `open dashboard-preview.html` | Tampilan panel muncul dengan data contoh; berkas ini bukan bagian yang di-deploy dan tidak dirujuk kode mana pun |

Prasyarat data: minimal satu pesanan berstatus `[2] Menunggu Pickup` di sheet `Pesanan Masuk`. Tanpa itu, panel produksi akan benar-benar kosong dan itu bukan kerusakan.

---

## 8. Uji Terima

Semua pengujian dijalankan dari dashboard (bagian Produksi & antrian dan Estimasi kerja), karena keempat RPC memerlukan token sesi. Uji dilakukan berurutan pada satu spreadsheet uji.

Butir 1 sampai 12 sudah dijalankan otomatis pada sisi server, bersama matriks perannya, sifat aman-dijalankan-berulang, pemotongan nominal upah, dan aturan kamus harganya. Berkasnya adalah `tests/fas10test.js` (89 pernyataan) dan `tests/fas11test.js` (104 pernyataan), dan seluruh
rangkaian uji dijalankan dengan `node tests/jalankan-uji.js`. Daftar isi tiap berkas uji
ada di [tests/README.md](file:///Users/macbook/Documents/ERP%20Begood/tests/README.md). Yang tetap perlu diperiksa manusia adalah hal yang tidak dapat diuji dari kode: apakah angka yang muncul memang sesuai dengan pekerjaan hari itu, dan apakah harga yang diisi sudah harga yang benar.

| # | Kasus | Cara menjalankan | Hasil yang diharapkan |
| --- | --- | --- | --- |
| 1 | Belum ada pesanan `[2]` | Buka bagian Produksi | Kartu ringkasan bernilai nol dan tabel kosong, bukan galat |
| 2 | Daftar kerja terbaca | Buka bagian Produksi | Baris SKU, variasi, dan qty dari pesanan `[2]` muncul; yang sudah ada di `DATA JAHIT` bertanda sudah dijahit, dan tidak ada sheet yang bertambah |
| 3 | Isi harga SKU baru | Formulir **Harga dan waktu proses** → Simpan | Satu baris baru muncul di `DATA PROSES`; pesan menyebut jumlah sel yang diperbarui dan jumlah SKU baru |
| 4 | Betulkan harga | Simpan harga SKU yang sama dengan angka lain | Baris SKU itu yang berubah, jumlah barisnya tetap, dan baris SKU itu tidak lagi bertanda belum dihargai |
| 5 | Isian dikosongkan | Kosongkan satu kolom, misalnya menit potong, lalu Simpan | Kolom itu dibiarkan apa adanya; nilai lama tidak ikut terhapus |
| 6 | Simpan hasil jahit | Lengkapi Sesi + Penjahit, tekan Simpan | Baris muncul di `DATA JAHIT` dengan kolom G (No. Pesanan) dan H (Toko) terisi |
| 7 | Kirim tabel input dua kali | Tekan Simpan sekali lagi | `ditambah: 0`, `dilewati: n`; `DATA JAHIT` tidak bertambah |
| 8 | Hitung estimasi | Pilih tanggal, tekan **Hitung estimasi** | `pcs` = Σ Jumlah; `waktu` = Σ(menit jahit + menit potong) × Jumlah; `upah` = Σ harga × Jumlah |
| 9 | Baris tanpa harga | Biarkan satu SKU tanpa harga, lalu hitung estimasi | pcs dan menit tetap dihitung, `barisTanpaHarga` > 0, SKU itu muncul di daftar "belum dihargai", upah tidak dihitung |
| 10 | Regresi harga menjadi nol | Tambahkan baris `DATA PROSES` untuk SKU yang sudah dihargai dengan kolom angka dikosongkan, lalu hitung estimasi | Harga SKU itu **tetap**, tidak berubah menjadi 0. Ini uji khusus untuk perilaku warisan project asal |
| 11 | Sesi terpisah | Buat dua baris, satu `PAGI` dan satu `SIANG` | Blok per sesi memisahkan baris, pcs, menit, dan upahnya |
| 12 | Peran | Masuk sebagai `PACKING`, lalu `ADMIN`, lalu `SUPERADMIN` | Lihat tabel di bawah |

### 8.1 Matriks peran

| Peran | Tab Produksi | Tombol Simpan | Kolom & kartu upah |
| --- | --- | --- | --- |
| `PACKING` | tersembunyi | ditolak server: `Peran PACKING tidak berhak menjalankan aksi ini. Diperlukan peran ADMIN.` | disembunyikan (`uangDisembunyikan: true`) |
| `ADMIN` | tampil | diizinkan | disembunyikan |
| `SUPERADMIN` | tampil | diizinkan | tampil |

---

## 9. Troubleshooting

| Gejala | Sebab yang paling sering | Tindakan |
| --- | --- | --- |
| Panel produksi kosong padahal ada pesanan | Kolom D berisi nilai selain `Menunggu Pickup`, atau statusnya `[1] Siap Packing` | Periksa sebaran nilai kolom D (RPC `getStatusInventory`), lalu samakan isinya dengan salah satu pilihan dropdown. Modul ini hanya membaca kata kunci `Menunggu Pickup` |
| `Sesi tidak berlaku atau sudah berakhir.` | Token sesi habis (`SESI_TTL_DETIK` 6 jam) | Masuk ulang dari halaman |
| `Peran PACKING tidak berhak menjalankan aksi ini. Diperlukan peran ADMIN.` | Tombol simpan ditekan dengan peran kurang | Pakai akun berperan `ADMIN` |
| Kartu **Total upah** kosong atau bertanda strip | Peran bukan `SUPERADMIN` | Itu perilaku yang disengaja; nominal memang tidak dikirim. Untuk melihatnya, masuk sebagai `SUPERADMIN` |
| `Baris n: nama penjahit belum diisi.` | Kolom Penjahit pada baris itu kosong | Isi dari daftar nama yang sudah pernah tercatat di `DATA JAHIT` |
| `Baris n: sesi harus PAGI atau SIANG.` | Kolom Sesi berisi nilai lain, misalnya `Sore` | Pilih `PAGI` atau `SIANG` |
| Upah terlihat Rp 0 pada baris yang jelas terisi | SKU itu belum ada di `DATA PROSES`, atau penulisan SKU-nya berbeda (spasi ganda, huruf besar-kecil) dari yang ada di sheet | Isi lewat formulir **Harga dan waktu proses** supaya kuncinya dinormalkan sama seperti saat pembacaan |
| SKU tetap bertanda belum dihargai walau barisnya sudah ada | Baris itu berada di luar kolom A–D, atau sel harganya benar-benar kosong | Periksa kolomnya: pembaca hanya membaca A, B, C, dan D |
| Baris tidak mau tersimpan walau kelihatannya benar | Tidak ada No. Pesanan, dan kombinasi SKU + variasi itu sudah pernah tersimpan | Lihat bagian 10 butir 4; isi No. Pesanan atau ubah kombinasi SKU/variasi |
| Perubahan langsung di sheet tidak segera terbaca | Cache kamus harga berlaku 120 detik | Tunggu dua menit, atau tekan **Simpan harga** sekali; penyimpanan membuang cache |
| Pesanan lama tidak ikut muncul di daftar kerja | Barisnya berada di luar jendela baca 5.000 baris terakhir `Pesanan Masuk` | Lihat bagian 10 butir 1 |
| Pesan `Versi kode yang sedang dimuat belum lengkap.` | Deployment belum diperbarui setelah berkas disalin | Deploy versi baru, lalu muat ulang halaman |

---

## 10. Batas dan Utang Teknis

Semua angka di bawah diambil dari kode, bukan perkiraan. Tujuannya supaya batas ini dapat diperiksa ulang saat datanya membesar.

| # | Batas | Angka dan bukti | Akibat dan cara menyikapinya |
| --- | --- | --- | --- |
| 1 | Antrian maksimum yang dibaca sekali buka | `BATAS_ANTRIAN_PRODUKSI = 2000` (`Code.js` 2464); pembaca status hanya menjangkau 5.000 baris terakhir `Pesanan Masuk` (`jendelaBaca`, `SheetManager.js` 2254) | Pesanan yang lebih tua dari jendela itu tidak akan pernah ikut terbaca. Bila antriannya menumpuk, bagi pekerjaannya atau ubah status pesanannya lebih rutin |
| 2 | Cache kamus harga | JSON hanya disimpan bila panjangnya < 90.000 karakter, TTL 120 detik (`Code.js` 2641) | Bila `DATA PROSES` membesar melewati batas itu, cache berhenti menyimpan dan itu bukan galat; akibatnya setiap estimasi membaca seluruh sheet |
| 3 | Estimasi membaca seluruh `DATA JAHIT` | `kumpulkanEstimasiProduksi_` menyaring per tanggal setelah semua baris dibaca | Waktu muat naik seiring umur sheet. Kandidat perbaikan: jendela baca terbatas, ditambah arsip tahunan |
| 4 | Baris manual tanpa No. Pesanan hanya bisa tersimpan sekali | Kunci anti-duplikat memakai `nopesanan\|sku\|variasi\|penjahit`, jadi tanpa nomor pesanan kuncinya menjadi `\|sku\|variasi\|penjahit` (`Code.js` 3112) | Baris kedua dengan SKU, variasi, dan penjahit yang sama akan dilewati sebagai duplikat. Selalu isi No. Pesanan bila barisnya berasal dari pesanan |
| 5 | Tidak ada penyuntingan dan tidak ada pembatalan | Tidak ada kolom Status atau Void seperti modul keuangan pada project asal | Koreksi dilakukan dengan menyunting sel langsung, dan jejak koreksi itu tidak tercatat di `Log_Aktivitas` |
| 6 | Status pesanan tidak diubah modul ini | Kolom D dirancang manual, dan penulisnya tetap manusia | Antrian tidak menyusut dengan sendirinya; perlu kebiasaan mengubah status setelah paket diserahkan kurir |
| 7 | SKU tidak divalidasi terhadap daftar master | `simpanProduksiBatch` hanya memastikan SKU tidak kosong | Salah tulis SKU menghasilkan baris tanpa harga. Gejalanya terlihat di daftar "SKU yang belum dihargai", bukan sebagai galat |
| 8 | Estimasi hanya satu tanggal | `getProduksiRingkasan(token, tanggal)` | Belum ada rekap rentang tanggal, maupun rekap lintas toko dalam satu panggilan |

---

## 11. Rencana Lanjut

Modul ini berhenti pada beban kerja dan estimasi upah. Berikut lanjutan yang sudah jelas arahnya, diurutkan dari yang paling murah:

| # | Rencana | Yang perlu disiapkan | Rujukan di project asal |
| --- | --- | --- | --- |
| 1 | Kartu produksi di bagian Analisis: beban kerja hari ini, jumlah SKU belum dihargai | Tidak ada sheet baru; cukup RPC yang sudah ada dipanggil saat bagian itu dibuka | — |
| 2 | Ekspor PDF estimasi kerja dan slip per penjahit | jsPDF 2.5.1 sudah dimuat di `Index.html`, dan polanya sudah ada | `docs/panduan-export-pdf.md`, serta `buildRingkasanPenjahitPdfDocument` (`index.html` 5606) |
| 3 | Rekap rentang tanggal dan rekap per toko | Perluas `getProduksiRingkasan` dengan parameter rentang; pertimbangkan jendela baca agar tetap ringan | `getPenggajian` (`code.gs` 2284) |
| 4 | Arsip tahunan `DATA PROSES` dan `DATA JAHIT` | Sheet arsip + pemindahan baris yang lebih tua dari satu tahun | — |
| 5 | Validasi SKU terhadap daftar master | Master SKU dari `Pesanan Masuk` kolom G, dipakai sebagai allowlist dengan opsi "tetap simpan" | `resolveValueAgainstValidationList_` (`code.gs` 3711) |
| 6 | Perbaikan kunci baris manual | Kunci manual memakai tanggal + sesi + penjahit agar input tanpa No. Pesanan bisa lebih dari sekali | — |
| 7 | **Varian B — penggajian penuh**: uang makan, potongan kasbon, finalisasi, slip | Sheet `PERSONIL`, `GAJI`, `HELPER`, `KASBON`, `PAYROLL_RUN`, `PAYROLL_DETAIL`, plus kolom audit Status/Void | `getGajiKaryawan` (3115), `finalizePayroll` (6424), `postPayrollKasbonPayments_` |
| 8 | **Varian C — bahan baku**: auto-deduct saat hasil jahit disimpan | Sheet `BOM`, `Jurnal Stock`, `STOCK OPNAME` | auto-deduct `submitBatchData` (1909–1943), `postPemakaianBahanProduksi_` (7558) |

Untuk varian B dan C, pelajaran yang sudah terbukti di modul ini sebaiknya dipertahankan: kunci idempotensi, kamus yang tidak pernah ditimpa nilai kosong, penjagaan peran di server, dan penulisan batch satu kali.

---

## Penutup

Modul ini sengaja kecil: dua sheet, lima RPC, dua bagian dashboard. Yang membuatnya aman dipakai sehari-hari bukan jumlah fiturnya, melainkan tiga hal yang dijaga ketat, yaitu kunci anti-duplikat yang memakai nomor pesanan, kamus harga yang tidak pernah kehilangan nilai hanya karena ada baris baru yang masih kosong, dan pemisahan antara beban kerja yang boleh dilihat semua orang dan nominal upah yang hanya boleh dilihat sebagian orang.

Bila salah satu dari ketiga hal itu diubah, ubah dokumen ini bersamanya.
