# Panduan Pembagian Jahit

Dokumen ini menjelaskan modul pembagian pekerjaan jahit di ERP Begood: sumber
datanya, aturan pembagiannya, RPC-nya, dan apa yang belum dikerjakan.

Modulnya diadaptasi dari berkas `PEMBAGIAN DATA JAHIT` milik tim jahit (Google
Apps Script terpisah dengan menu `JAHIT AUTO`). Berkas asalnya membaca berkas
ekxpor Shopee yang diunggah, sedangkan modul ini membaca pesanan yang sudah ada
di sheet `Pesanan Masuk`.

Yang berubah, yang sengaja tidak diambil, dan alasannya ada di bagian 1. Kontrak
datanya di bagian 2. Perilaku pembagiannya di bagian 3. RPC dan tangga perannya
di bagian 4. Nomor baris tiap fungsi ada di bagian 5, dan bagian itu paling cepat
basi: perbarui lebih dulu bila `gas/Code.js`, `gas/SheetManager.js`, atau
`gas/Index.html` diubah.

## Daftar Isi

1. [Asal dan lingkup adaptasi](#1-asal-dan-lingkup-adaptasi)
2. [Kontrak data](#2-kontrak-data)
3. [Cara pembagiannya bekerja](#3-cara-pembagiannya-bekerja)
4. [Referensi RPC dan peran](#4-referensi-rpc-dan-peran)
5. [Nomor baris tiap fungsi](#5-nomor-baris-tiap-fungsi)
6. [SOP harian](#6-sop-harian)
7. [Pemasangan](#7-pemasangan)
8. [Uji terima](#8-uji-terima)
9. [Troubleshooting](#9-troubleshooting)
10. [Batas dan utang teknis](#10-batas-dan-utang-teknis)
11. [Rencana lanjut](#11-rencana-lanjut)

---

## 1. Asal dan lingkup adaptasi

Berkas asalnya melakukan lima hal: membaca berkas pesanan Shopee, memetakan SKU
ke grup kerja, memecah pesanan menjadi satuan pcs, membagikan pcs itu ke penjahit,
lalu menulis lembar hasil, rekap upah, dan peringatan.

### 1.1 Yang diambil

| Dari berkas asal | Di modul ini | Catatan |
|---|---|---|
| `SETTING PENJAHIT` | Sheet dengan nama sama, 5 kolom | Ditambah kolom Catatan |
| `SKU RULES` | Sheet dengan nama sama, 3 kolom | Aturan bawaannya disalin apa adanya |
| `4. FINAL PEMBAGIAN JAHIT` | Sheet `PEMBAGIAN JAHIT` | Satu baris per penjahit, berkunci, lihat bagian 2.3 |
| `REKAP UPAH` | Dihitung saat diminta | Tidak disimpan sebagai sheet |
| `WARNING` | Dihitung saat diminta | Tidak disimpan sebagai sheet |
| Pembagian adil per grup dan bobot | Sama | Rumusnya di bagian 3.3 |
| Grup `IGNORE` untuk barang non-jahit | Sama | Barisnya tidak ikut dibagi |

### 1.2 Yang sengaja tidak diambil

1. **Unggah berkas XLSX/CSV beserta pengurai di peramban.** Pesanannya sudah masuk
   lewat sinkronisasi Shopee ke sheet `Pesanan Masuk`, jadi mengunggah berkas
   hanya menambah satu langkah yang dapat salah. Sumbernya pesanan berstatus
   `[2] Menunggu Pickup`, sama seperti modul produksi.
2. **Sheet `MASTER DATA` untuk harga jahit.** Harganya dibaca dari daftar harga
   `DATA PROSES` yang sudah ada, lengkap dengan urutan pencariannya: SKU + variasi
   (untuk baris yang ditulis sebagai nama gabungan), lalu SKU saja. Dua sumber
   harga untuk barang yang sama akan bertengkar soal mana yang benar, dan yang
   kalah selalu orang yang upahnya dihitung dari sumber yang salah.
3. **Sheet `SETTING TOKO`.** Daftar toko beserta status aktifnya sudah ada di
   `DB_Token`.
4. **Sheet `2. Filter Pesanan`, `3.RAW DATA JAHIT`, `1. Download Data`.** Ketiganya
   adalah perhentian antara yang isinya dapat dihitung ulang dari sheet yang
   sudah ada.
5. **Kolom `Kain Dibutuhkan (per cm)`.** Di berkas asalnya kolom itu dibaca dari
   `MASTER DATA` tetapi tidak pernah dipakai menghitung apa pun. Membawanya ke
   sini berarti menambah kolom yang tidak punya pemakai. Bila nanti bahan mau
   dihitung, kolomnya ditambahkan bersama perhitungannya.
6. **Kolom `DEADLINE KIRIM`.** ERP Begood belum menyimpan tenggat kirim Shopee,
   jadi kolomnya tidak dapat diisi.
7. **Grup toko pada berkas asal.** Cakupan toko di sini memakai pemilih cakupan
   yang sudah ada di dashboard.

### 1.3 Perubahan yang disengaja

1. **Pembagiannya berkunci.** Berkas asal membangun ulang seluruh hasil setiap
   kali dijalankan, sehingga satu penetapan penjahit yang sudah disesuaikan
   manusia akan hilang pada penekanan tombol berikutnya. Di sini kuncinya nomor
   pesanan + SKU + variasi + penjahit, pcs yang sudah pernah dibagi dilewati, dan
   penjahit pada baris lama tidak pernah diubah.
2. **Bebannya dibaca dari sheet, bukan dari memori.** Pembagian hari ini
   menyambung pembagian sebelumnya. Tanpa itu, tiap penekanan tombol membuat
   semua orang dianggap kosong, dan orang yang baru menerima banyak pekerjaan
   kembali mendapat yang paling banyak.
3. **Rekap dan peringatan dihitung, bukan disimpan.** Isinya mengikuti pesanan
   yang masih menunggu, jadi menyimpannya sebagai sheet berarti menyimpan angka
   yang cepat basi.
4. **Satu tombol untuk menutup sesi.** Berkas asal memisahkan pembagian dan
   pencatatan hasil, sehingga nama penjahit harus diketik ulang ke tabel input
   padahal pembagiannya sudah tahu siapa mengerjakan apa. Di sini `tutupSesiJahit`
   mengerjakan keduanya sekali tekan: bagi, isi harga yang masih kosong, lalu
   simpan hasil jahitnya ke `DATA JAHIT`.

---

## 2. Kontrak data

Tiga sheet baru dibuat oleh `SheetManager.initAllSheets()`. Dua yang pertama
diisi manusia, yang ketiga ditulis modul. Isi bawaan hanya ditulis bila sheetnya
belum punya satu baris data pun, jadi sheet yang sudah disesuaikan tim tidak
pernah ditimpa.

### 2.1 `SETTING PENJAHIT` (5 kolom)

| Kolom | Nama | Tipe | Keterangan |
|---|---|---|---|
| A | Penjahit | Text (`@`) | Nama orang. Disimpan huruf besar. Wajib. |
| B | Grup | Text (`@`) | Harus sama dengan grup pada `SKU RULES`, misalnya `BC` atau `SPREI`. Wajib. |
| C | Aktif | Text (`@`) | `YA` atau `TIDAK`. Sel kosong dianggap `YA`. |
| D | Bobot | Number | `1` berarti kapasitas biasa. Bobot lebih besar membuat orang itu menerima pcs lebih sedikit pada upah yang sama. |
| E | Catatan | Text | Keterangan bebas. |

Isi bawaannya empat orang dari berkas tim: ADUL dan OPIK pada grup BC, UGUN dan
ZAE pada grup SPREI.

### 2.2 `SKU RULES` (3 kolom)

| Kolom | Nama | Tipe | Keterangan |
|---|---|---|---|
| A | Pola SKU | Text (`@`) | Dibandingkan sebagai bagian dari nama SKU, bukan kecocokan persis. |
| B | Grup | Text (`@`) | `BC`, `SPREI`, atau `IGNORE`. |
| C | Catatan | Text | Keterangan bebas. |

Urutan baris berarti: aturan yang dibaca lebih dulu menang. Karena itu pola yang
khusus diletakkan di atas pola yang umum. Contohnya `SARUNG BANTAL` juga cocok
dengan `SARUNG BANTAL & GULING`, sehingga keduanya tidak boleh bertukar tempat.

Isi bawaannya 14 aturan, termasuk tiga grup `IGNORE` untuk TAS MIKA, PLASTIK, dan
BONUS.

### 2.3 `PEMBAGIAN JAHIT` (10 kolom)

| Kolom | Nama | Tipe | Keterangan |
|---|---|---|---|
| A | Toko | Text (`@`) | Kode toko pemilik pesanan. |
| B | No. Pesanan | Text (`@`) | Nomor pesanan asal. |
| C | SKU | Text (`@`) | SKU yang dikerjakan. |
| D | Variasi | Text (`@`) | Variasi dari pesanan. |
| E | Qty | Number (`0`) | Jumlah pcs yang menjadi bagian penjahit itu pada baris pesanan itu. |
| F | Penjahit | Text (`@`) | Nama penjahit, atau `BELUM DISET` bila grupnya belum punya penjahit aktif. |
| G | Grup | Text (`@`) | Grup pekerjaan baris ini. |
| H | Harga Satuan | Currency | Upah per pcs, disalin saat pembagian dibuat. |
| I | Harga Total | Currency | Qty × Harga Satuan, disimpan supaya tidak perlu dihitung ulang saat membaca. |
| J | Dibagi (WIB) | Text (`@`) | Stempel waktu pembagian. Satu nilai untuk satu kali pembagian. |

Satu baris mewakili **satu penjahit pada satu baris pesanan**, bukan satu pcs.
Pesanan berisi tiga pcs yang jatuh ke satu orang menjadi satu baris berisi Qty 3,
sedangkan tiga pcs yang jatuh ke tiga orang menjadi tiga baris berisi Qty 1. Yang
dicatat memang jumlahnya, bukan pcs yang mana, sehingga satu pesanan tetap dapat
dikerjakan beberapa orang sekaligus.

Bentuk lama sheet ini menulis satu baris per pcs dengan kolom `Part` (`1/3`, `2/3`).
Baris seperti itu digabung otomatis menjadi bentuk Qty saat inisialisasi atau saat
pembagian dijalankan dari menu (`rapikanPembagianLama_`), dan hasilnya sama: yang
diperlukan rekap dan rekap upah hanyalah jumlah pcs per orang.

### 2.4 Kunci dan bentuk baku

Nama variasi dipotong sampai koma pertama sebelum dipakai di mana pun. Variasi
Shopee berbunyi "Lilac,BC 90x220": warna di depan koma, lalu ukuran yang sudah
tercermin pada SKU. Yang tersimpan dan ditampilkan hanya "Lilac", supaya satu
pesanan tidak terbelah menjadi dua baris hanya karena keterangan tambahannya
berbeda, dan supaya harga per variasi di `DATA PROSES` tetap ketemu walau namanya
ditulis panjang.

Kunci satu baris adalah **nomor pesanan + SKU + variasi + penjahit**, disusun oleh
`SheetManager.kunciPembagian()`. Nomor pesanan dan SKU dibakukan lebih dulu
(spasi dirapatkan, huruf diseragamkan), karena satu perbedaan spasi cukup untuk
membuat baris yang sama tercatat dua kali dan dihitung upahnya dua kali. Nama
penjahit ikut masuk kunci supaya satu baris pesanan dapat dikerjakan dua orang,
sedangkan penekanan tombol yang sama dua kali tetap tidak menggandakan apa pun.

Kolom A sampai D, F, G, dan J berformat teks. Nomor pesanan Shopee berupa deretan
angka panjang, dan tanpa format teks isinya berubah menjadi notasi eksponensial
lalu tidak lagi cocok saat dicocokkan. Kolom E berformat `0`, dan kolom H serta I
berformat `Rp #,##0` supaya dapat
dijumlahkan.

---

## 3. Cara pembagiannya bekerja

### 3.1 Sumber kerja

Baris kerja diambil dari pesanan berstatus `[2] Menunggu Pickup` pada sheet
`Pesanan Masuk`, dibaca lewat `SheetManager.getOrderRowsByStatus()`, dibatasi
`BATAS_BAGI_PEMBAGIAN` (2.000 baris) dan disaring menurut cakupan toko. Jadi satu
pcs dapat masuk daftar pembagian tanpa menunggu apa pun, karena daftar kerja itu
memang tidak disimpan di sheet: modul pembagian dan panel produksi membaca sumber
yang sama, lalu menyimpan hasilnya masing-masing.

### 3.2 Menentukan grup

`tentukanGrupSku_()` membandingkan SKU dengan tiap pola pada `SKU RULES` secara
berurutan dan mengambil kecocokan pertama. Perbandingannya pada bentuk baku
(huruf besar, spasi dirapatkan), jadi `sprei  dk` tetap cocok dengan pola `SPREI DK`.

- Grup `IGNORE`: barisnya tidak dibagi dan tidak dihitung sebagai pekerjaan.
- Tidak ada pola yang cocok: barisnya tetap dibagi dengan grup `BELUM DISET`,
  supaya pekerjaannya tidak hilang, dan muncul sebagai peringatan
  `GRUP_TIDAK_DITEMUKAN`.

### 3.3 Memilih penjahit

Urutan pembagiannya: **harga tertinggi dibagi lebih dahulu**, lalu nama grup, lalu
nomor pesanan. Alasannya, sisa pembagian berikutnya menjadi bagian yang lebih
murah, sehingga selisih upah antar penjahit tidak melebar hanya karena urutan
kedatangan pesanan.

Untuk tiap pcs, penjahitnya dipilih dari penjahit **aktif** yang grupnya sama,
dengan nilai terkecil pada:

```
nilai = upah yang sudah dipegang / bobot + jumlah pcs * 0,0001
```

Yang dibandingkan adalah upah, bukan jumlah pcs, karena satu bedcover dan satu
sarung bantal tidak sama beratnya. Bobot membagi upah itu: orang dengan bobot 2
dianggap mampu mengerjakan dua kali lebih banyak pada upah yang sama, sehingga
nilainya menjadi separuh dan ia cenderung menerima pcs berikutnya. Suku
`jumlah pcs * 0,0001` hanya memecah nilai yang benar-benar sama, supaya orang yang
pcs-nya lebih sedikit didahulukan tanpa mengubah urutan berdasarkan upah.

Contoh yang benar-benar dijalankan uji: tiga pcs grup SPREI berharga 50.000,
50.000, dan 45.000, dengan UGUN dan ZAE sama-sama berbobot 1. Hasilnya pcs pertama
ke UGUN, kedua ke ZAE (karena UGUN sudah 50.000), dan ketiga ke UGUN (karena
ZAE sudah 50.000, sedangkan UGUN 50.000 lalu ditambah 45.000). Akhirnya UGUN
memegang 2 pcs senilai 95.000 dan ZAE 1 pcs senilai 50.000.

Bila tidak ada penjahit aktif di grup itu, pcs-nya diberi penjahit `BELUM DISET`
dan muncul peringatan `PENJAHIT_GRUP_KOSONG` sekali per grup, bukan sekali per baris.

### 3.4 Aman dijalankan berulang

Tombol bagi boleh ditekan berkali-kali. Yang terjadi pada penekanan kedua:

1. Pcs yang sudah tercatat pada `PEMBAGIAN JAHIT` dilewati. Yang dihitung adalah
   **jumlah** pcs per baris pesanan, bukan pcs yang mana, jadi yang dibagi hanya
   sisanya. Bila penjahitnya jatuh ke orang yang sama dengan pembagian sebelumnya,
   Qty barisnya bertambah; bila ke orang lain, barisnya baru.
2. Penjahit pada baris lama tidak diubah, karena penetapan itu dapat saja sudah
   disesuaikan manusia.
3. Bebannya dihitung dari baris yang pesanannya masih menunggu pickup, sehingga
   pembagian lanjutan menyambung beban yang sedang berjalan, bukan mulai dari nol.
4. Harga pada baris lama yang masih kosong diisi dari daftar harga terbaru
   (`perbaruiHargaPembagian()`), dan Harga Totalnya dihitung ulang dari Qty × Harga
   Satuan yang baru. Harga yang sudah terisi tidak disentuh. Tanpa langkah ini,
   baris yang dibagi sebelum SKU-nya dihargai akan berupah nol selamanya. Jumlah
   sel Harga Satuan yang terisi dilaporkan sebagai `hargaDiselaraskan`.

Baris yang pesanannya sudah dikirim tidak dihapus. Isinya tetap menjadi riwayat
siapa mengerjakan apa, tetapi tidak lagi ikut dihitung sebagai beban atau rekap,
dan harganya tidak ikut diselaraskan.

### 3.5 Rekap

`rekapPembagian_()` menghitung dari baris `PEMBAGIAN JAHIT` yang pesanannya masih
menunggu pickup, lalu menyusun empat kelompok angka:

| Kelompok | Isinya |
|---|---|
| Per penjahit | pcs, upah, bobot, jumlah order, jumlah SKU, target, selisih |
| Per grup | pcs, upah, jumlah penjahit yang mengerjakan, jumlah order |
| Per toko | pcs, upah, jumlah order, jumlah SKU |
| Total | upah, selisih upah tertinggi dengan terendah, rata-rata upah per penjahit |

**Target** tiap penjahit adalah upah seluruh grupnya dibagi menurut bobot, jadi ia
rata-rata berbobot kelompoknya, bukan angka yang ditetapkan manusia. **Selisih**
adalah upah dikurangi target: positif berarti orang itu memegang lebih banyak
daripada rata-rata kelompoknya.

Tiga angka di luar rekap menyebut keadaan pekerjaan:

| Angka | Artinya |
|---|---|
| `unitAntrian` | Jumlah pcs dari pesanan menunggu pickup, termasuk yang bukan pekerjaan jahit |
| `pcsTerbagi` | Pcs yang sudah ada penjahitnya, dijumlahkan dari kolom Qty |
| `belumDitetapkan` | Pcs yang barisnya sudah ada tetapi penjahitnya `BELUM DISET` |

Angka **pcs** pada rekap adalah jumlah kolom **Qty**, dan **upah** adalah jumlah
kolom **Harga Total** barisnya. Keduanya dibaca apa adanya dari sheet, bukan
dihitung ulang dari harga terbaru, supaya rekap lama tidak berubah sendiri ketika
daun harganya diperbaiki.
| `belumDibagi` | Pcs yang belum masuk `PEMBAGIAN JAHIT` sama sekali |
| `diabaikan` | Baris pesanan bergrup `IGNORE` |

Pemisahan `pcsTerbagi` dan `belumDitetapkan` disengaja: pekerjaan yang belum
berpemilik tidak boleh terlihat seperti pekerjaan yang sudah dibagikan.

### 3.6 Jenis peringatan

| Tipe | Artinya |
|---|---|
| `ATURAN_KOSONG` | Sheet `SKU RULES` belum berisi aturan sama sekali |
| `GRUP_TIDAK_DITEMUKAN` | Ada SKU yang belum punya pola |
| `SKU_TANPA_HARGA` | SKU belum dihargai di `DATA PROSES`, jadi upah pcs itu nol |
| `QTY_INVALID` | Jumlah pada baris pesanan nol atau tidak terbaca |
| `PENJAHIT_GRUP_KOSONG` | Ada grup yang tidak punya penjahit aktif |
| `PENJAHIT_TIDAK_AKTIF` | Baris lama menunjuk nama yang sudah tidak ada di daftar penjahit aktif |

Peringatan adalah daftar yang dilaporkan, bukan kesalahan yang menghentikan proses.
Yang menghentikan proses hanya dua: tidak ada penjahit aktif sama sekali, dan
permintaan dari peran yang tidak berhak.

---

## 4. Referensi RPC dan peran

### 4.1 Daftar RPC

| RPC | Peran minimum | Yang dilakukan |
|---|---|---|
| `getPembagianJahit(token, kodeToko)` | `PACKING` | Membaca setelan dan rekap. Hanya membaca |
| `bagiPembagianDashboard(token, kodeToko)` | `ADMIN` | Membagi pcs yang belum pernah dibagi, lalu menulis jejaknya |
| `tutupSesiJahit(token, tanggal, sesi, kodeToko)` | `ADMIN` | Menutup satu sesi kerja sekali jalan: bagi, isi harga yang kosong, lalu simpan hasilnya ke `DATA JAHIT` |
| `simpanPenjahitDashboard(token, daftar)` | `ADMIN` | Mengganti seluruh isi `SETTING PENJAHIT` |
| `simpanAturanDashboard(token, daftar)` | `ADMIN` | Mengganti seluruh isi `SKU RULES` |

`kodeToko` boleh kosong, dan artinya seluruh toko. Isinya kode toko huruf besar,
sama seperti pemilih cakupan di dashboard. Pembacaan sengaja terbuka untuk
`PACKING`, karena isinya mengatur pekerjaan; yang dibatasi hanya nama uangnya
(bagian 4.5).

### 4.2 `getPembagianJahit`

```
{
  cakupan: string,
  setelan: {
    penjahit: [{ nama, grup, aktif, bobot, catatan, barisSheet }],
    aturan:   [{ pola, grup, catatan, barisSheet }]
  },
  rekap: {
    cakupan, unitAntrian, pcsTerbagi, belumDitetapkan, belumDibagi,
    diabaikan, penjahitAktif, penjahitBekerja,
    perPenjahit: [{ nama, grup, bobot, pcs, upah, jumlahOrder, jumlahSku, target, selisih }],
    perGrup:     [{ grup, pcs, upah, jumlahPenjahit, jumlahOrder }],
    perToko:     [{ toko, pcs, upah, jumlahOrder, jumlahSku }],
    total:       { upah, selisih, rataUpah },
    unit:        [{ toko, noPesanan, sku, variasi, qty, penjahit, grup, harga, hargaTotal, dibagi }],
    peringatan:  [{ tipe, noPesanan, sku, variasi, pesan }]
  },
  uangDisembunyikan: true   // hanya ada bila pemanggilnya bukan superadmin
}
```

Setelan dikirim lengkap, termasuk penjahit yang tidak aktif, karena halaman
memakainya untuk menyunting. `PENJAHIT_DEFAULT` bawaan ditulis lebih dulu bila
sheetnya masih kosong, jadi pemanggilan pertama tidak gagal hanya karena setelan
belum pernah dibuka.

### 4.3 `bagiPembagianDashboard`

```
{ berhasil: true, ditambah, diperbarui, qtyDitambah, dilewati, diabaikan,
  unitAntrian, hargaDiselaraskan, peringatan: [...], perPenjahit: [...], pesan: string }
```

`qtyDitambah` adalah jumlah pcs yang baru dibagi, `ditambah` jumlah baris baru yang
ditulis untuk pcs itu, dan `diperbarui` jumlah baris lama yang Qty-nya ditambahi
karena pcs berikutnya jatuh ke orang yang sama. `dilewati` adalah pcs yang sudah
tercatat sebelumnya, dan `diabaikan` baris pesanan bergrup `IGNORE`. Yang nol pada
`qtyDitambah` bukan kegagalan: artinya memang tidak ada pcs baru.

`hargaDiselaraskan` adalah jumlah sel **Harga Satuan** pada baris lama yang masih
kosong dan kini diisi dari daftar harga terbaru. Baris seperti itu ada karena pcs
sudah dibagi saat SKU-nya belum ada di `DATA PROSES`, sehingga upahnya nol
walaupun harganya sudah diisi kemudian. Harga yang sudah terisi tidak pernah
ditimpa, karena angka itu bisa jadi hasil koreksi manusia (lihat bagian 9.1).

Setiap pemanggilan dicatat ke `Log_Aktivitas` dengan aksi `PRODUKSI_BAGI_JAHIT`,
jumlah pcs, jumlah harga yang diselaraskan, keterangan singkat, kode toko sebagai
penanda, dan kode pengguna pelakunya. Pembagian menentukan siapa dibayar berapa,
jadi jejaknya harus dapat ditelusuri.

### 4.4 `simpanPenjahitDashboard` dan `simpanAturanDashboard`

Keduanya menerima tabel lengkap dan **mengganti** seluruh isi sheetnya, bukan
menambahi. Alasannya: yang dikirim halaman adalah hasil suntingan penggunanya, dan
menambahkan baris ke daftar lama akan meninggalkan baris yang sudah dihapus di
halaman tetapi masih ikut bekerja.

Yang ditolak dengan pesan jelas:

| Keadaan | Pesan |
|---|---|
| Daftar penjahit kosong | `Daftar penjahit tidak boleh kosong. Sisakan minimal satu penjahit aktif.` |
| Nama penjahit kembar | `Nama penjahit ADUL muncul lebih dari sekali. Setiap penjahit hanya boleh punya satu baris.` |
| Penjahit tanpa grup | `Penjahit ADUL belum punya grup. Grup menentukan pekerjaan mana yang boleh diterimanya.` |
| Aturan SKU kosong | `Aturan SKU tidak boleh kosong. Sisakan minimal satu aturan.` |

Nama kembar ditolak karena beban dihitung per nama: dua baris bernama sama akan
saling menimpa bacaannya, dan orang itu bisa menerima pekerjaan dua kali lebih
banyak dari yang seharusnya.

Penyimpanan penjahit juga membakukan isinya: nama dan grup menjadi huruf besar,
`Aktif` selain `TIDAK` menjadi `YA`, dan bobot nol atau tidak terbaca menjadi `1`.
Menyimpan aturan membuang cache aturan, jadi aturan baru langsung berlaku.

### 4.5 Pemotongan nominal upah

Untuk pemanggil selain superadmin, `tanpaUangBagi_()` menghapus dari jawaban:

- `rekap.perPenjahit[].upah`, `.target`, `.selisih`
- `rekap.perGrup[].upah` dan `rekap.perToko[].upah`
- `rekap.total.upah`, `.selisih`, `.rataUpah`
- `rekap.unit[].harga` dan `rekap.unit[].hargaTotal`

Lalu `uangDisembunyikan` diisi `true`. Jumlah pcs, bobot, dan jumlah order tetap
terkirim, karena itulah yang dipakai mengatur pekerjaan.

Pemotongannya dilakukan di server, bukan dengan menyembunyikan kolom di halaman:
jawaban RPC dapat dibaca siapa saja yang membuka konsol peramban. Halaman juga
menyembunyikan sel nominalnya (kelas `butuh-uang`) supaya tidak ada kolom kosong
yang membingungkan, tetapi itu hanya lapis kedua.

### 4.6 `tutupSesiJahit` — satu kali tekan untuk menutup sesi

```
masukan: (token, tanggal?, sesi?, kodeToko?)
  tanggal kosong -> hari ini menurut WIB
  sesi kosong    -> mengikuti jam WIB (sebelum 13.00 = PAGI, sesudahnya SIANG)

balikan: { berhasil, tanggal, sesi, ditambah, dilewati, pcsBaruDibagi,
           hargaDiselaraskan, belumBerpemilik, pcsAntrian, peringatan, pesan }
```

Yang dikerjakannya, berurutan, dalam satu panggilan:

1. Memastikan setelan produksi ada (`SETTING PENJAHIT`, `SKU RULES`, `PEMBAGIAN JAHIT`).
2. **Membagi** pcs yang belum pernah dibagi, sekaligus mengisi harga pcs lama yang
   masih kosong dari daftar harga terbaru.
3. **Menyimpan hasilnya ke `DATA JAHIT`**, dengan penjahit dan grup yang sudah
   ditetapkan pada pembagian. Tidak ada lagi yang perlu diketik ke tabel input.

Aturan penyimpanannya:

| Keadaan pcs | Perlakuan |
|---|---|
| Sudah punya penjahit | Disimpan sebagai baris hasil jahit. Beberapa pcs yang jatuh ke orang yang sama digabung menjadi satu baris berjumlah sekian, persis seperti pengisian lewat tabel input |
| Belum punya penjahit (`BELUM DISET`) | Tidak disimpan, dan dihitung pada `belumBerpemilik`. Baris seperti itu belum punya pemilik upah, jadi menyimpannya hanya akan mengarang angka |
| Pesanannya sudah tidak menunggu pickup | Tidak ikut disimpan: barisnya riwayat, dan upahnya sudah tercatat saat sesinya ditutup dahulu |

Kunci anti-duplikatnya nomor pesanan + SKU + variasi + **penjahit**, sehingga
menutup sesi dua kali tidak menggandakan upah, dan satu baris pesanan yang
dikerjakan dua orang tetap tercatat sebagai dua baris.

Sesi dan tanggal yang dipakai selalu dilaporkan pada balikan, karena keduanya
menentukan laporan menit kerja per sesi. Isian yang tidak dikenal tidak
menggagalkan aksi; sesi jatuh ke jam WIB dan tanggalnya jatuh ke hari ini.

Setiap pemanggilan dicatat ke `Log_Aktivitas` dengan aksi `PRODUKSI_TUTUP_SESI`
beserta jumlah pcs yang dibagi, harga yang diisi, baris yang disimpan, pcs tanpa
penjahit, dan pelakunya.

### 4.7 Menu spreadsheet

Tiga menu baru di menu `ERP Begood`:

| Menu | Fungsi | Kegunaan |
|---|---|---|
| Siapkan Aturan & Penjahit Produksi | `siapkanSettingProduksiPrompt()` | Membuat ketiga sheet dan menulis isi bawaannya bila masih kosong |
| Bagi Pekerjaan Jahit Sekarang | `bagiPembagianJahitPrompt()` | Membagi untuk seluruh toko lalu menampilkan ringkasan dan peringatannya |
| Tutup Sesi Jahit (Bagi + Simpan Hasil) | `tutupSesiJahitPrompt()` | Rangkaian penuh satu kali tekan: bagi, isi harga yang kosong, lalu simpan hasil jahitnya. Sesi ditanyakan, dan isian kosong diartikan mengikuti jam sekarang |

Ketiganya untuk dipakai saat setelan belum pernah diisi, atau saat dashboard tidak
dapat dibuka. Alur hariannya tetap dari dashboard.

---

## 5. Nomor baris tiap fungsi

Nomor di bawah ini berlaku untuk berkas saat dokumen ini disusun. Bagian ini
paling cepat basi, jadi perbarui lebih dulu begitu salah satu berkasnya diubah.
Untuk memeriksanya, cari namanya langsung:

```
grep -n "bagiPembagianJahit_" gas/Code.js
grep -n "BAGI_HEADERS" gas/SheetManager.js
```

### 5.1 `gas/SheetManager.js`

| Baris | Isi |
|---|---|
| 9 | Daftar `SHEETS`, tempat `PENJAHIT`, `RULES`, dan `BAGI` didaftarkan |
| 129 | `PENJAHIT_HEADERS` (Penjahit, Grup, Aktif, Bobot, Catatan) |
| 144 | `RULES_HEADERS` (Pola SKU, Grup, Catatan) |
| 162 | `BAGI_HEADERS` (10 kolom hasil pembagian: Qty dan Harga Total) |
| 186 | `PENJAHIT_DEFAULT`, isi bawaan sheet setelan (4 penjahit) |
| 201 | `RULES_DEFAULT`, isi bawaan sheet aturan (14 aturan) |
| 732 | `bacaBarisPenjahit_()` |
| 764 | `bacaBarisAturan_()` |
| 790 | `bacaBarisPembagian_()` |
| 862 | `kunciPembagian_()`, kunci baris per penjahit |
| 881 | `rapikanPembagianLama_()`, penggabungan baris bentuk lama |
| 978 | `isiBawaanBilaKosong_()` |
| 2892 | `pastikanSettingProduksi()` |
| 2956 | `simpanQtyPembagian()`, penulis satu-satunya PEMBAGIAN JAHIT |
| 3050 | `perbaruiHargaPembagian()`, mengisi harga baris lama yang masih kosong |
| 3111 | `simpanPenjahit()` |
| 3147 | `simpanAturanSku()` |

Blok inisialisasi ketiga sheet ada di dalam `initAllSheets()` (bagian 8, 9, dan 10
pada komentar bloknya), di bawah blok `DATA PROSES` dan `DATA JAHIT`.

### 5.2 `gas/Code.js`

| Baris | Isi |
|---|---|
| 3412 | `BATAS_BAGI_PEMBAGIAN`, batas baris pesanan yang dibaca |
| 3426 | `kunciCacheAturan_()` |
| 3440 | `bacaAturanCached_()` |
| 3466 | `tentukanGrupSku_()` |
| 3500 | `penjahitAktif_()` |
| 3524 | `skorPenjahit_()` |
| 3531 | `pilihPenjahit_()` |
| 3563 | `kumpulkanUnitPembagian_()` |
| 3641 | `kumpulkanPcsAntrian_()`, pcs antrian dan ringkasannya per baris pesanan |
| 3683 | `upahBarisBagi_()`, upah satu baris pembagian |
| 3698 | `hargaTerbaruPcs_()`, harga terbaru per baris pesanan |
| 3710 | `sesiMenurutJamWib_()`, sesi cadangan saat pemanggil tidak memilih |
| 3716 | `hitungBebanKeDaftar_()` |
| 3748 | `bagiPembagianJahit_()` |
| 3954 | `tutupSesiJahit_()`, bagi + simpan hasil dalam satu kali jalan |
| 4052 | `rekapPembagian_()` |
| 4179 | `rekapPerPenjahit_()` |
| 4262 | `rekapPerGrup_()` |
| 4293 | `rekapPerToko_()` |
| 4328 | `tanpaUangBagi_()` |
| 4370 | `getPembagianJahit()` |
| 4396 | `bagiPembagianDashboard()` |
| 4448 | `tutupSesiJahit()` |
| 4469 | `simpanPenjahitDashboard()` |
| 4498 | `simpanAturanDashboard()` |
| 4512 | `simpanKodeTokoDashboard()` |
| 4547 | `siapkanSettingProduksiPrompt()`, dipanggil menu |
| 4574 | `tutupSesiJahitPrompt()`, dipanggil menu |
| 4616 | `bagiPembagianJahitPrompt()`, dipanggil menu |

Dua menu pada `onOpen()` ada di bagian atas berkas, di kelompok `ERP Begood`.

### 5.3 `gas/Index.html`

| Baris | Isi |
|---|---|
| 1159 | Tombol tab `tab-pembagian` |
| 2041 | Panel `content-pembagian` |
| 5028 | `muatPembagianJahit()` |
| 5072 | `teksUangBagi_()` |
| 5077 | `renderPembagianJahit()` |
| 5112 | `renderTabelPenjahitPembagian_()` |
| 5574 | `renderPeringatanPembagian_()` |
| 5601 | `renderUnitPembagian_()` |
| 5644 | `tsvDariTabel_()` |
| 5655 | `tabelDariTsv_()` |
| 5933 | `isiSetelanPembagian_()` |
| 5976 | `bagiJahitAction()` |
| 6007 | `sesiDefaultKlien_()` |
| 6011 | `siapkanSesiPembagian_()` |
| 6024 | `tutupSesiJahitAction()` |
| 6062 | `simpanPenjahitAction()` |
| 6101 | `simpanAturanAction()` |

Daftar tabnya ada pada `TAB_NAMES` dan `JUDUL_TAB`, dan `switchTab()` memanggil
`muatPembagianJahit()` setiap kali tabnya dibuka.

### 5.4 Berkas turunan

`dashboard-preview.html` memuat salinan `gas/Index.html` ditambah skrip tiruan
RPC-nya. Berkas itu dibangun ulang dengan menyisipkan blok `<script>` tiruannya
sebelum penanda `LOGIC` pada salinan terbaru `gas/Index.html`. Cara memeriksa
keduanya masih selaras: tidak boleh ada satu baris pun yang hanya ada di
`gas/Index.html` ketika keduanya dibandingkan.

---

## 6. SOP harian

Rangkaian hariannya dua baris saja:

1. **Sinkronkan pesanan.** Pesanan baru masuk ke `[2] Menunggu Pickup`. Ini pun
   dapat dihilangkan dengan memasang trigger otomatis dari menu
   **Pasang Trigger Otomatis (Tiap 1 Jam)**.
2. **Buka tab Pembagian jahit, tekan Tutup sesi & simpan hasil.** Pilih sesinya
   (PAGI atau SIANG; bawaannya mengikuti jam), lalu satu kali tekan itu:

   - membagi seluruh pcs yang belum pernah dibagi,
   - mengisi harga pcs lama yang masih kosong dari daftar harga terbaru,
   - menyimpan seluruh hasilnya ke `DATA JAHIT` lengkap dengan penjahit, sesi, dan
     tanggalnya.

Setelah itu tab **Estimasi kerja** sudah dapat dihitung untuk tanggal tersebut.
Yang perlu diperiksa manusia:

- **Yang perlu ditindaklanjuti**: pola SKU belum ada, atau harga SKU belum diisi.
  Selama ada SKU tanpa harga, upahnya nol dan itu bukan kerusakan.
- **Belum ditetapkan** pada kartu ringkasan: pcs yang grupnya belum punya
  penjahit aktif. Pcs itu sengaja tidak disimpan; perbaiki setelannya, lalu tekan
  tutup sesi sekali lagi — pcs yang sudah berpemilik tidak akan dibagi atau
  disimpan dua kali.
- Kolom **Penjahit** dan **Qty** pada sheet `PEMBAGIAN JAHIT` boleh disunting
  langsung bila ada pekerjaan yang harus berpindah orang atau berpindah jumlah.
  Bila Qty disunting, sesuaikan **Harga Total**-nya sekalian, karena kedua angka itu
  disimpan apa adanya. Susunan yang benar adalah **sebelum** sesi ditutup, supaya
  baris hasil jahitnya ikut memakai nama dan jumlah yang benar.

Tombol **Bagi pekerjaan sekarang** tetap ada untuk pembagian saja, tanpa menyimpan
hasil jahit — berguna bila pembagian ingin diperiksa lebih dulu.

Yang tidak perlu dilakukan: menyamakan angka di lembar kerja dengan dashboard.
Rekapnya dihitung dari `PEMBAGIAN JAHIT`, jadi keduanya selalu sama.

---

## 7. Pemasangan

0. Jalankan `node tests/siapdeploy.js` lebih dulu. Pemeriksaan itu memastikan nama
   RPC yang dipanggil halaman ada di sisi server, fungsi bantu pada jalur galat tidak
   ada yang hilang, tidak ada benturan nama antar berkas, dan batas teknis Google
   Sheets serta Apps Script tidak dilewati. Seluruh rangkaian uji lainnya dijalankan
   dengan `node tests/jalankan-uji.js`.
1. Tempel ulang ketiga berkas: `gas/SheetManager.js`, `gas/Code.js`, `gas/Index.html`.
2. Jalankan menu **Inisialisasi / Reset Tabel Sheet**, atau menu **Siapkan Aturan &
   Penjahit Produksi**. Keduanya membuat ketiga sheet beserta isi bawaannya, dan
   **mengubah `PEMBAGIAN JAHIT` bentuk lama** (satu baris per pcs dengan kolom
   `Part`) menjadi bentuk Qty. Baris yang pesanan, SKU, variasi, dan penjahitnya
   sama digabung, dan jumlah pcs-nya menjadi nilai kolom Qty; Harga Total dihitung
   dari Qty × Harga Satuan. Tidak ada upah yang hilang, karena yang dicatat memang
   jumlah pcs per orang.
3. Buka tab **Pembagian jahit**. Bila muncul catatan bahwa versi server belum
   memuat fungsinya, buat deployment Web App versi baru.
4. Sesuaikan `SETTING PENJAHIT` dengan nama penjahit yang sebenarnya, dan
   `SKU RULES` dengan pola SKU yang benar-benar dipakai.

Setelan boleh juga diubah dari dashboard, di panel **Setelan pembagian**. Kedua
jalan itu menulis ke sheet yang sama.

---

## 8. Uji terima

### 8.1 Yang sudah diperiksa otomatis

Seluruh rangkaian uji ada di folder `tests/` dan dijalankan dari komputer, bukan
dari Apps Script. Satu perintah menjalankan semuanya:

```
node tests/jalankan-uji.js
```

| Berkas uji | Yang diperiksa |
|---|---|
| `tests/fas11test.js` (127 pernyataan) | Mesin pembagian, keadilan per grup dan bobot, penggabungan Qty, pemangkasan variasi pada koma, idempotensi, peringatan, penyelarasan harga baris lama, tutup sesi sekali tekan, tangga peran, pemotongan upah, penyimpanan setelan, jejak audit |
| `tests/prevtest.js` (39 pernyataan, 14 di antaranya untuk modul ini) | Tab pembagian pada pratinjau sebagai superadmin |
| `tests/prevtest2.js` (16 pernyataan, 9 di antaranya untuk modul ini) | Tab pembagian pada pratinjau sebagai packing, termasuk nominal yang tidak boleh tampil |
| `tests/htmlcheck.js` (29 pernyataan) | Setiap id dan setiap nama fungsi yang dipanggil dari markup |
| `tests/doccheck.js` (20 pernyataan) | Nomor baris pada bagian 5 dokumen ini, ditambah nama kolom, nama RPC, jenis peringatan, dan nama sheet terhadap isi berkasnya |
| `tests/siapdeploy.js` (24 pernyataan) | Kesiapan berkas untuk ditempel: nama RPC yang dipanggil halaman, fungsi bantu, id yang dibaca, benturan nama antar berkas, batas nama sheet dan kolom, masa simpan cache, gaya berkas, serta mekanisme penyembunyian peran dan nominal |

`doccheck.js` sengaja ikut menjaga dokumen ini: nomor baris pada bagian 5 diperiksa
terhadap isi berkasnya, sehingga tabel itu tidak dapat basi tanpa ketahuan.

Angka yang diperiksa antara lain: 5 pcs dari pesanan menunggu pickup menjadi 5 baris,
1 baris `TAS MIKA` diabaikan, penekanan kedua menambah 0 pcs dan melewati 5 pcs,
total upah 235.000, selisih tertinggi-terendah 45.000, dan target grup SPREI
72.500 per orang.

### 8.2 Matriks peran

| Peran | Boleh | Ditolak |
|---|---|---|
| `PACKING` | Membaca pembagian dan rekapnya, tanpa nominal upah | Membagi, menyimpan penjahit, menyimpan aturan |
| `ADMIN` | Membaca, membagi, menyimpan penjahit dan aturan. Tanpa nominal upah | - |
| `SUPERADMIN` | Seluruhnya, termasuk nominal upah | - |

### 8.3 Yang masih perlu diperiksa manusia

- Apakah angka upah yang muncul cocok dengan kesepakatan upah borongan yang berlaku.
- Apakah daftar pola pada `SKU RULES` sudah mencakup seluruh SKU yang benar-benar dijual.
  Aturan bawaannya disalin dari berkas tim, dan berkas itu dibuat saat daftar SKU-nya
  masih lebih pendek.
- Apakah pembagiannya terasa adil bagi penjahitnya. Rumusnya membandingkan upah,
  dan yang tidak dapat dihitungnya adalah kemampuan orang per barang.

---

## 9. Troubleshooting

| Gejala | Sebab yang paling sering | Tindakan |
|---|---|---|
| Tombol bagi tidak menambah pcs | Semua pcs sudah pernah dibagi | Lihat angka **Belum dibagi**. Bila nol, memang tidak ada yang baru |
| Banyak pcs bertanda `BELUM DISET` | Grupnya tidak punya penjahit aktif, atau SKU-nya belum punya pola | Isi `SETTING PENJAHIT` atau `SKU RULES`, lalu bagi ulang |
| Upah baris nol | SKU belum dihargai | Isi harga untuk SKU itu di tab Antrian & tarif SKU |
| Aturan baru belum berpengaruh | Cache aturan belum kedaluwarsa | Tunggu paling lama 120 detik, atau simpan ulang aturannya dari dashboard |
| Tab pembagian melaporkan versi server belum memuat fungsinya | Deployment Web App masih versi lama | Buat deployment versi baru setelah menempel ulang berkasnya |
| Peringatan `PENJAHIT_TIDAK_AKTIF` | Baris lama menunjuk nama yang sudah dihapus atau dinonaktifkan | Ubah kolom Penjahit pada baris itu, atau masukkan kembali namanya ke daftar |

### 9.1 Memindahkan satu penugasan ke penjahit lain

Kolom **Penjahit** dan **Qty** pada sheet `PEMBAGIAN JAHIT` boleh disunting langsung.
Beban yang dipakai pembagian berikutnya dibaca dari sheet itu, jadi perubahan
langsung ikut terhitung pada pembagian berikutnya. Yang tidak ikut berubah adalah
rekap lama: barisnya tetap dihitung memakai **Harga Satuan** dan **Harga Total**
yang tersimpan di barisnya. Bila Qty disunting, sesuaikan Harga Totalnya sekalian
(Qty × Harga Satuan), karena kedua angka itu disimpan, bukan dihitung saat dibaca.

### 9.2 Harga yang belum terisi, dan harga yang terlanjur salah

Harga pcs disalin dari daftar harga saat pembagian dibuat. Dua keadaan perlu
dibedakan:

| Keadaan baris | Perlakuan |
|---|---|
| Baris sudah punya penjahit, tetapi Harga Satuan dan Harga Total-nya masih **kosong** | Diisi dari daftar harga terbaru, dan Harga Total dihitung dari Qty × Harga Satuan yang baru. Rekap sudah menampilkannya memakai harga yang berlaku sekarang, dan selnya ikut terisi saat **Tutup sesi & simpan hasil** ditekan lagi. SKU yang memang belum ada di `DATA PROSES` tetap kosong dan tetap muncul sebagai peringatan `SKU_TANPA_HARGA` |
| Harga Satuan sudah **terisi** | Tidak pernah ditimpa. Nominal itu bisa jadi koreksi manusia, jadi membetulkannya dilakukan dengan menyunting kolom H dan I baris yang bersangkutan |

Baris yang pesanannya sudah tidak menunggu pickup juga tidak ikut diselaraskan:
baris itu sudah menjadi riwayat, dan upahnya memang harus tetap mencerminkan
upah yang berlaku saat pekerjaannya dibagi.

---

## 10. Batas dan utang teknis

1. **Belum ada rekap upah per periode.** Rekap hanya menghitung pekerjaan yang
   pesanannya masih menunggu pickup. Begitu pesanannya dikirim, pcs itu keluar
   dari rekap. Untuk menghitung upah mingguan atau bulanan diperlukan rentang
   tanggal dan salinan angka per periode, dan keduanya belum ada.
2. **Satu penjahit satu grup.** Bobot dan beban dihitung per nama, jadi satu nama
   hanya boleh muncul satu kali. Orang yang mengerjakan dua grup berbeda perlu
   dua nama, dan itu akan terlihat sebagai dua orang di rekap.
3. **Kolom kain belum dibawa.** Lihat bagian 1.2 butir 5.
4. **Tenggat kirim belum dibawa.** Lihat bagian 1.2 butir 6.
5. **Batas 2.000 baris pesanan satu kali pembagian.** Bila pesanan menunggu pickup
   lebih banyak dari itu, sisanya masuk pada pembagian berikutnya. Angkanya
   dapat dinaikkan lewat `BATAS_BAGI_PEMBAGIAN`, dengan konsekuensi waktu proses.
6. **Keadilan dihitung dari upah, bukan dari tingkat kesulitan barang.** Dua barang
   dengan upah sama dianggap sama beratnya walaupun pengerjaannya berbeda.
7. **Penetapan awal tidak menghormati keahlian per barang.** Yang dibaca hanya
   grup dan bobot, bukan siapa yang biasa mengerjakan barang tertentu.
8. **Angka target adalah rata-rata berbobot, bukan target yang disepakati.** Ia
   dipakai membaca keadilan, bukan sebagai janji upah.

---

## 11. Rencana lanjut

Yang paling terasa dibutuhkan lebih dulu:

1. **Rekap upah per rentang tanggal**, memakai tanggal pesanan dikirim, supaya
   upah mingguan dan bulanan dapat dihitung dari sistem, bukan dari ingatan.
2. **Tindakan memindahkan pcs dari dashboard**, supaya tidak perlu menyunting
   sheet untuk satu perubahan kecil.
3. **Papan per penjahit**, yaitu daftar pekerjaan yang masih dipegang tiap orang,
   supaya dapat dicetak dan ditempel di ruang jahit.
4. **Perbandingan harga dengan kesepakatan upah**, untuk menandai SKU yang
   harganya tertinggal dari daftar upah borongan yang berlaku.

---

## Penutup

Modul pembagian jahit ini menambah tiga sheet dan empat RPC pada ERP Begood, dan
menggantungkan dirinya pada dua hal yang sudah ada: pesanan pada `Pesanan Masuk`
dan harga pada `DATA PROSES`. Karena itu daftar kerjanya tidak perlu diunggah
ulang, dan harga tidak perlu diisi di dua tempat.

Berkas yang dirujuk dokumen ini: `gas/Code.js`, `gas/SheetManager.js`,
`gas/Index.html`. Nomor dan nama fungsi merujuk pada isi berkas itu saat dokumen
ini disusun, dan perlu diperiksa ulang bila berkasnya berubah.
