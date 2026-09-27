# Struktur Tabel & Panduan Operasional Google Sheets ERP Begood

Sistem ERP Begood menggunakan Google Sheets sebagai antarmuka visual operasional harian. Seluruh skema tabel telah dirancang secara optimal untuk mendukung alur kerja gudang, admin pesanan, dan manajemen keuangan toko **b e g o o d . b d g**.

---

## 1. Sheet `Pesanan Masuk` (Tabel Operasional Utama - 16 Kolom)

Tabel ini menampung seluruh pesanan pelanggan yang ditarik dari Shopee. Setiap baris mewakili **1 produk/variasi pembelian** (jika pembeli membeli lebih dari 1 barang dalam 1 pesanan, akan dicatat pada baris yang berbeda).

| No | Nama Kolom | Tipe Data | Keterangan & Fungsi |
|---|---|---|---|
| **A** | **No. Pesanan** | Text (`@`) | Kode unik nomor pesanan Shopee (Order SN). Format string menjaga agar angka tidak berubah menjadi format eksponensial. |
| **B** | **Tanggal Pesanan (WIB)** | Date/Time | Waktu pesanan dibuat oleh pembeli dalam zona waktu Indonesia Barat (WIB). |
| **C** | **Status Shopee** | Text | Status resmi dari Shopee (`UNPAID`, `READY_TO_SHIP`, `PROCESSED`, `SHIPPED`, `COMPLETED`, `CANCELLED`). |
| **D** | **Status Internal Begood** | Dropdown | Status alur kerja internal tim Begood (bisa diubah manual oleh staf gudang/packing). |
| **E** | **Nama Pembeli** | Text | Username atau nama penerima pesanan. |
| **F** | **Ringkasan Produk** | Text | Nama produk yang dibeli pada baris tersebut. |
| **G** | **Nomor Referensi SKU** ✨ | Text (`@`) | Kode unik SKU variasi/produk dari Shopee (misal: `SARKUR 120/5`, `TAS MIKA AJA`). |
| **H** | **Nama Variasi** ✨ | Text | Nama variasi warna/ukuran yang dipilih pembeli (misal: `Coffee,120x200x5`, `SINGLE`). ERP memakai bagian sebelum koma saja, sebab keterangan sesudahnya adalah ukuran yang sudah tercermin pada SKU. |
| **I** | **Total Qty** | Number | Jumlah kuantitas produk tersebut yang dibeli dalam transaksi. |
| **J** | **Total Belanja (Rp)** | Currency | Total pembayaran belanja pesanan yang dibayarkan oleh pembeli (format Rupiah `Rp #,##0`). |
| **K** | **Ongkir (Rp)** | Currency | Biaya ongkos kirim resmi pesanan. |
| **L** | **Ekspedisi / Kurir** | Text | Jasa logistik yang dipilih pembeli (SPX Express, J&T, SiCepat, dll). |
| **M** | **No. Resi** ✨ | Text (`@`) | **Nomor resi asli** (*tracking number*) yang ditarik otomatis dari Shopee Logistics API. |
| **N** | **Catatan Pembeli** | Text | Pesan khusus dari pembeli untuk penjual (misal: "minta dipacking rapat", "warna cadangan hitam"). |
| **O** | **Kota Tujuan** | Text | Kota pengiriman paket untuk analisis distribusi penjualan. |
| **P** | **Waktu Sinkronisasi** | Date/Time | Waktu terakhir baris ini diperbarui oleh sistem otomatisasi. |
| **Q** | **Toko** ✨ | Text (`@`) | Kode toko pemilik baris ini, misalnya `BGD`. Diisi otomatis saat sinkronisasi. Baris lama yang kolomnya masih kosong akan terisi sendiri saat pesanannya ditarik ulang, atau bisa diisi sekaligus lewat menu **Isi Kolom Toko untuk Baris Lama (Migrasi)**. Lihat `docs/arsitektur-multi-toko.md`. |

---

## 2. Aturan Pemecahan Multi-Produk (Multi-Item Row Expansion)

Sistem secara otomatis memeriksa setiap produk di dalam pesanan:

1. **Pesanan 1 Produk / 1 Variasi**: Ditulis menjadi 1 baris.
2. **Pesanan Lebih dari 1 Produk / Beberapa Variasi**:
   - Ditulis menjadi **baris yang terpisah (baris berbeda)** untuk setiap jenis produk atau variasi.
   - Kolom `No. Pesanan`, `Tanggal`, `Nama Pembeli`, `Ekspedisi`, `No. Resi`, `Total Belanja`, dan `Status Internal` pada semua baris produk tersebut akan sama.
   - Kolom `Ringkasan Produk`, `Nomor Referensi SKU`, `Nama Variasi`, dan `Total Qty` akan mencatat spesifik barang tersebut.

### Contoh Tampilan Multi-Produk:
| No. Pesanan | Tanggal | Status | Status Internal | Nama Pembeli | Ringkasan Produk | No. Ref SKU | Nama Variasi | Total Qty | Total Belanja | Ekspedisi | No. Resi | Toko |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `260911P83ME3FW` | 2026-09-11 | COMPLETED | `[4] Selesai` | nurul... | TAS MIKA BEDCOVER | `TAS MIKA AJA` | **SINGLE** | **2** | Rp 85.000 | SPX Standard | SPXID06556... | `BGD` |
| `260911P83ME3FW` | 2026-09-11 | COMPLETED | `[4] Selesai` | nurul... | TAS MIKA BEDCOVER | `TAS MIKA AJA` | **DOUBLE** | **3** | Rp 85.000 | SPX Standard | SPXID06556... | `BGD` |

### Akibatnya: dua satuan angka yang berbeda

Karena satu pesanan dapat menjadi beberapa baris, ada dua satuan angka yang dipakai di seluruh sistem, dan keduanya benar:

| Satuan | Cara menghitungnya | Dipakai oleh |
|---|---|---|
| **pesanan** | satu nomor pesanan unik, yaitu satu paket yang perlu dikemas | kartu angka dashboard, panel antrian, seluruh angka omzet dan rata-rata |
| **baris** | satu baris produk di sheet | pilihan filter status, keterangan jumlah baris di bawah tabel, sebaran status pada grafik |

Bila keduanya tidak dibedakan, angkanya terlihat bertentangan: pada satu contoh nyata, filter `[1] Siap Packing` menulis **31 baris** sementara panel antrian menulis **22 pesanan**. Keduanya benar, karena 31 baris itu milik 22 paket. Karena itu setiap angka di dashboard selalu menuliskan satuannya.

---

## 3. Pilihan Status Internal Begood (Dropdown Kolom D)

Status operasional pergudangan toko:
- `[0] Menunggu Pembayaran`: Pesanan belum diselesaikan pembayarannya.
- `[1] Siap Packing`: Pesanan lunas dan barang siap diambil serta dibungkus oleh tim gudang.
- `[2] Menunggu Pickup`: Paket telah selesai dipacking dan ditempeli resi, menunggu kedatangan kurir ekspedisi.
- `[3] Sedang Dikirim`: Paket telah dipindai (scanned) oleh kurir dan sedang dalam perjalanan.
- `[4] Selesai`: Paket telah sampai ke pembeli dan dana telah dilepaskan.
- `[5] Pengajuan Batal`: Pembeli mengajukan pembatalan (perlu konfirmasi admin).
- `[6] Dibatalkan`: Pesanan resmi batal.

> 🛡️ **Proteksi Data Manual (Smart Upsert)**: Jika staf gudang telah mengubah status kolom D menjadi `[1] Siap Packing` atau `[2] Menunggu Pickup`, proses penarikan pesanan otomatis **TIDAK AKAN** menimpa status manual tersebut. Jika pesanan memiliki beberapa baris produk, seluruh baris produk tersebut otomatis mewarisi status internal yang sama.

---

## 4. Sheet `DB_Token` (Penyimpanan Token OAuth2)

Menyimpan token otentikasi Shopee Open API v2.

| Kolom | Nama Kolom | Keterangan |
|---|---|---|
| **A** | **Shop ID** | ID unik toko Shopee Anda (`1564950615`). |
| **B** | **Partner ID** | Partner ID developer aplikasi. |
| **C** | **Access Token** | Kunci akses aktif untuk memanggil API (berlaku 4 jam). |
| **D** | **Refresh Token** | Kunci untuk memperbarui access token (berlaku ~30 hari). |
| **E** | **Expired At (Unix)** | Timestamp batas kedaluwarsa dalam milidetik. |
| **F** | **Expired At (WIB)** | Waktu kedaluwarsa yang mudah dibaca dalam WIB. |
| **G** | **Terakhir Diperbarui (WIB)** | Waktu saat token diperbarui terakhir kali. |
| **H** | **Status Token** | Status kondisi token (`AKTIF`, `KADALUARSA`). |

---

## 5. Sheet `Konfigurasi`

Menyimpan parameter aplikasi yang dapat disesuaikan tanpa perlu mengubah baris kode:

| Parameter | Contoh Nilai | Keterangan |
|---|---|---|
| `VERCEL_MIDDLEWARE_URL` | `https://shopee-middleware-erp.vercel.app` | URL middleware Vercel tempat API di-deploy. |
| `BEGOOD_API_SECRET` | `begood_secret_pass_2026` | Kunci rahasia API penjaga middleware. |
| `SHOP_ID` | `1564950615` | ID toko asal saat sistem masih satu toko. Sejak multi-toko, yang menentukan toko adalah sheet `DB_Token`, bukan nilai ini. |
| `TOKO_AKTIF` | `BGD,BGD2` | Kode toko yang ikut sinkron otomatis, dipisah koma. Kosong berarti semua toko aktif ikut. |
| `DEFAULT_SYNC_DAYS` | `3` | Jumlah hari pesanan yang ditarik secara otomatis (default 3 hari). |

---

## 6. Sheet `Log_Aktivitas`

Merekam setiap aktivitas sistem sebagai audit trail:
- **Waktu (WIB)**: Kapan aksi dilakukan.
- **Tipe Aksi**: `SYNC_PESANAN`, `AUTO_REFRESH_TOKEN`, `MANUAL_REFRESH_TOKEN`, `TRIGGER_SETUP`, `UPDATE_STATUS`.
- **Jumlah Pesanan**: Total data yang diproses.
- **Status**: `SUKSES`, `ERROR`, `GAGAL`.
- **Keterangan Detail**: Pesan teknis lengkap untuk kemudahan penelusuran jika terjadi kendala.
- **Toko** ✨: Kode toko yang menjalankan aksi itu, atau `SEMUA` untuk aksi yang mencakup seluruh toko. Kosong berarti pemanggilnya belum menyebutkan toko.
- **Pengguna** ✨: Kode pengguna yang menjalankan aksi itu. Kosong berarti aksinya dijalankan sistem, bukan orang, misalnya sinkronisasi terjadwal.

---

## 7. Sheet `Pengguna`

Satu baris per orang yang boleh membuka dashboard. Berbeda dari sheet lain, kolom sandi di sini tidak pernah berisi sandi aslinya.

| Kolom | Nama Kolom | Keterangan |
|---|---|---|
| **A** | **Kode** | Kunci untuk masuk, disimpan huruf besar. Dipakai juga di kolom Pengguna pada `Log_Aktivitas`. |
| **B** | **Nama** | Nama yang tampil di dashboard. |
| **C** | **Peran** | `SUPERADMIN`, `ADMIN`, atau `PACKING`. |
| **D** | **Email** | Email akun Google untuk masuk tanpa sandi. Boleh kosong. Hanya berguna bila Apps Script mengenali email pemanggilnya. |
| **E** | **Sandi (hash)** | Hasil hitungan berulang dari sandi, bukan sandi aslinya, dan tidak dapat dibalik menjadi sandi. |
| **F** | **Sandi (salt)** | Angka acak per pengguna, sehingga dua orang dengan sandi sama tetap menghasilkan hash berbeda. |
| **G** | **Aktif** | `YA` atau `TIDAK`. Akun yang tidak dipakai cukup ditandai, tidak perlu dihapus. |
| **H** | **Dibuat (WIB)** | Waktu akun dibuat. |
| **I** | **Terakhir Masuk (WIB)** | Waktu masuk terakhir yang berhasil. |

Dua hal yang perlu diperhatikan:

1. **Jangan menyunting kolom E atau F secara manual.** Hash dan salt harus sepasang, jadi mengubah salah satunya membuat sandi pengguna itu tidak dapat dipakai lagi. Untuk mengganti sandi, gunakan jalur di aplikasi, bukan menyunting sel.
2. **Sheet ini hanya cocok disimpan di spreadsheet yang tidak dibagikan ke staf.** Bila staf memiliki akses edit ke spreadsheet, mereka dapat mengubah peran sendiri, dan pembatasan peran kehilangan artinya.

Rancangan dan alasan di baliknya ada di `docs/arsitektur-login-peran.md`.

---

## 8. Sheet `DATA PROSES` (Daftar Harga Proses)

Satu baris mewakili **satu SKU**, bukan satu baris pesanan. Isinya adalah daftar harga dan waktu proses yang diisi manusia, dan daftar itu dipakai menghitung upah serta menit kerja setiap pekerjaan dari SKU tersebut. Daftar kerja jahitnya sendiri tidak disimpan di sini, melainkan dibaca langsung dari pesanan berstatus `[2] Menunggu Pickup` pada `Pesanan Masuk`.

| Kolom | Nama Kolom | Tipe Data | Keterangan |
|---|---|---|---|
| **A** | **SKU** | Text (`@`) | Nomor referensi SKU, sama penulisannya dengan kolom G `Pesanan Masuk`. Kunci barisnya. |
| **B** | **Harga Jahit** | Currency | Upah borongan per unit. Kosong berarti belum dihargai, bukan berarti gratis. |
| **C** | **Waktu Jahit (menit)** | Number | Menit menjahit per unit. |
| **D** | **Waktu Potong (menit)** | Number | Menit memotong per unit. |

Tiga hal yang berlaku pada sheet ini:

1. **Kolom A sampai D tidak boleh berpindah posisi.** Pembaca harga membacanya menurut nomor kolom, bukan menurut nama, sehingga kolom tambahan (bila kelak ada) diletakkan di sebelah kanan.
2. **Satu SKU cukup satu baris.** Nilainya berlaku untuk seluruh variasi dan seluruh pesanan SKU itu, karena harganya memang per pcs, bukan per pesanan. Baris yang dobel diwakili baris terakhirnya.
3. **Label kolomnya milik pemilik sheet.** Inisialisasi hanya mengisi kolom yang masih kosong, sehingga kata yang sudah dipilih manusia untuk header tidak pernah ditimpa kode.

Harga yang khusus berlaku untuk satu variasi ditulis sebagai baris tersendiri dengan nama gabungan, misalnya `SARKUR 120/5 COFFEE`. Pencocokannya mencoba nama gabungan itu lebih dulu, baru nama SKU, sehingga harga khusus variasi menang tanpa perlu kolom tambahan.

Menambah SKU tidak perlu menyiapkan baris kosong: panel **Harga dan waktu proses** memperbarui baris SKU yang sudah ada di tempatnya, dan menambahkan baris baru di bawah daftar untuk SKU yang belum pernah dihargai.

---

## 9. Sheet `DATA JAHIT` (Hasil Jahit)

Satu baris mewakili **satu baris pekerjaan yang sudah dijahit**.

| Kolom | Nama Kolom | Tipe Data | Keterangan |
|---|---|---|---|
| **A** | **Tanggal** | Date (`yyyy-mm-dd`) | Tanggal kerja, bukan tanggal pesanan. |
| **B** | **Sesi** | Text | `PAGI` atau `SIANG`. Tidak ada di pesanan, jadi selalu diisi di dashboard. |
| **C** | **Nama/SKU** | Text (`@`) | Diambil dari antrian. |
| **D** | **Variasi** | Text (`@`) | Diambil dari antrian, yaitu nama variasi sampai koma pertama. |
| **E** | **Jumlah** | Number | Jumlah yang dijahit. |
| **F** | **Penjahit** | Text (`@`) | Nama penjahit. Wajib diisi, karena upah dihitung per orang. |
| **G** | **No. Pesanan** | Text (`@`) | Nomor pesanan asal. Bersama kolom C dan D menjadi kunci anti duplikat. |
| **H** | **Toko** | Text (`@`) | Kode toko pemilik pesanan. |

Kolom **G** dan **H** bukan hiasan: keduanya yang membuat penyimpanan ulang tabel yang sama tidak menghitung upah dua kali. Barisnya biasanya lahir dari tombol **Tutup sesi & simpan hasil** pada tab Pembagian jahit, yang menyalin penjahit dan jumlah pcs dari hasil pembagian; tabel input manual dipakai untuk baris yang tidak lewat pembagian.

Angka estimasi dibaca dari kedua sheet ini: `Jumlah × Harga Jahit` untuk upah, dan `Jumlah × Waktu Jahit` atau `Waktu Potong` untuk menit kerja. Baris yang SKU-nya belum punya harga tetap terhitung jumlah dan menitnya, tetapi upahnya tidak dihitung dan baris itu dilaporkan sebagai belum dihargai.

Urutan pencarian harga satu baris: **SKU + variasi** (untuk baris `DATA PROSES` yang ditulis sebagai nama gabungan), lalu **SKU saja**. Nilai kosong pada `DATA PROSES` tidak pernah menimpa nilai yang sudah terisi, sehingga satu baris yang belum dihargai tidak dapat membuat upah sebuah SKU menjadi nol. Bila beberapa baris memuat nilai berbeda untuk kunci yang sama, yang dipakai adalah nilai terakhir yang tidak kosong, sehingga baris yang lebih baru menggantikan yang lama.

---

## 10. Sheet `SETTING PENJAHIT` (Daftar Penjahit)

Satu baris mewakili **satu orang yang mengerjakan jahitan**. Sheet ini dipakai modul pembagian jahit untuk menentukan siapa yang menerima pekerjaan.

| Kolom | Nama Kolom | Tipe Data | Keterangan |
|---|---|---|---|
| **A** | **Penjahit** | Text (`@`) | Nama orang, disimpan huruf besar. Wajib. |
| **B** | **Grup** | Text (`@`) | Harus sama dengan grup pada `SKU RULES`, misalnya `BC` atau `SPREI`. Wajib. |
| **C** | **Aktif** | Text (`@`) | `YA` atau `TIDAK`. Sel kosong dianggap `YA`. |
| **D** | **Bobot** | Number | `1` berarti kapasitas biasa. Bobot lebih besar membuat orang itu menerima pcs lebih sedikit pada upah yang sama. |
| **E** | **Catatan** | Text | Keterangan bebas. |

Isi bawaannya empat orang dari berkas tim jahit: ADUL dan OPIK pada grup BC, UGUN dan ZAE pada grup SPREI. Isi bawaan hanya ditulis bila sheetnya belum punya satu baris data pun, jadi daftar yang sudah disesuaikan tim tidak pernah ditimpa.

Satu nama hanya boleh muncul satu kali, karena beban kerja dihitung per nama. Daftar ini boleh disunting langsung di sheet, atau dari panel **Setelan pembagian** pada tab **Pembagian jahit**.

---

## 11. Sheet `SKU RULES` (Pemetaan SKU ke Grup)

Satu baris mewakili **satu pola SKU beserta grup pekerjaannya**.

| Kolom | Nama Kolom | Tipe Data | Keterangan |
|---|---|---|---|
| **A** | **Pola SKU** | Text (`@`) | Dibandingkan sebagai bagian dari nama SKU, bukan kecocokan persis. |
| **B** | **Grup** | Text (`@`) | `BC`, `SPREI`, atau `IGNORE`. |
| **C** | **Catatan** | Text | Keterangan bebas. |

**Urutan baris berarti.** Aturan dibaca dari atas dan kecocokan pertama yang dipakai, sehingga pola yang khusus harus diletakkan di atas pola yang umum. Contohnya pola `SARUNG BANTAL` juga cocok dengan SKU `SARUNG BANTAL & GULING`, jadi keduanya tidak boleh bertukar tempat.

Grup `IGNORE` menandai barang yang bukan pekerjaan jahit, misalnya tas mika, plastik, atau bonus. Baris pesanan bergrup `IGNORE` tidak ikut dibagi dan tidak dihitung sebagai pekerjaan.

Isi bawaannya 14 aturan, termasuk tiga aturan `IGNORE`.

---

## 12. Sheet `PEMBAGIAN JAHIT` (Hasil Pembagian per Penjahit)

Satu baris mewakili **satu penjahit pada satu baris pesanan**, bukan satu pcs. Tiga pcs yang jatuh ke satu orang menjadi satu baris berisi Qty 3; tiga pcs yang jatuh ke tiga orang menjadi tiga baris berisi Qty 1. Dengan begitu satu pesanan tetap dapat dikerjakan beberapa orang sekaligus.

| Kolom | Nama Kolom | Tipe Data | Keterangan |
|---|---|---|---|
| **A** | **Toko** | Text (`@`) | Kode toko pemilik pesanan. |
| **B** | **No. Pesanan** | Text (`@`) | Nomor pesanan asal. |
| **C** | **SKU** | Text (`@`) | SKU yang dikerjakan. |
| **D** | **Variasi** | Text (`@`) | Variasi dari pesanan, dipotong sampai koma pertama. |
| **E** | **Qty** | Number (`0`) | Jumlah pcs yang menjadi bagian penjahit itu pada baris pesanan itu. |
| **F** | **Penjahit** | Text (`@`) | Nama penjahit, atau `BELUM DISET` bila grupnya belum punya penjahit aktif. |
| **G** | **Grup** | Text (`@`) | Grup pekerjaan baris ini. |
| **H** | **Harga Satuan** | Currency | Upah per pcs, disalin saat pembagian dibuat. |
| **I** | **Harga Total** | Currency | Qty × Harga Satuan. Disimpan supaya rekap tidak perlu menghitung ulang, dan supaya nominal yang berlaku saat pembagian dibuat tetap terekam. |
| **J** | **Dibagi (WIB)** | Text (`@`) | Stempel waktu pembagian. Satu nilai untuk satu kali pembagian. |

Empat hal yang berlaku pada sheet ini:

1. **Kunci barisnya nomor pesanan + SKU + variasi + penjahit.** Baris yang kuncinya sudah ada ditambahi Qty-nya, penjahit pada baris lama tidak pernah diubah, dan penekanan tombol yang sama dua kali tidak menggandakan apa pun.
2. **Kolom H dan I disalin, bukan dihitung ulang.** Harga pada baris ini tidak berubah walaupun harga di `DATA PROSES` diperbaiki kemudian, sehingga rekap lama tetap mencerminkan upah yang berlaku saat pembagiannya dibuat. Baris yang harganya masih kosong diisi dari daftar harga terbaru saat pembagian dijalankan lagi; Harga Total ikut dihitung ulang dari Qty.
3. **Baris tidak dihapus setelah pesanannya dikirim.** Isinya menjadi riwayat siapa mengerjakan apa, tetapi tidak lagi ikut dihitung sebagai beban maupun rekap.
4. **Bentuk lama (kolom `Part`) dirapikan otomatis.** Sheet yang masih menulis satu baris per pcs digabung menjadi bentuk Qty saat inisialisasi atau saat pembagian dijalankan dari menu.

Rekap upah dan daftar peringatan **tidak** disimpan sebagai sheet, melainkan dihitung saat diminta dari sheet ini beserta pesanan yang masih menunggu pickup. Alasannya sama dengan estimasi kerja: angkanya mengikuti keadaan sekarang, dan salinannya akan cepat basi. Rinciannya ada di [docs/pembagian-jahit.md](file:///Users/macbook/Documents/ERP%20Begood/docs/pembagian-jahit.md).


---

Skema 17 kolom di atas sudah berlaku, termasuk kolom `Toko` (Q) serta kolom baru pada `DB_Token` (Nama Toko, Kode Toko, Aktif, Region) dan `Log_Aktivitas` (Toko, lalu Pengguna). Kolom-kolom itu sengaja ditempatkan di ujung supaya kolom A sampai P tidak bergeser. Urutan migrasinya ada di `docs/arsitektur-multi-toko.md`, sedangkan kolom `Pengguna` dijelaskan di `docs/arsitektur-login-peran.md`.

Dua nama kolom ikut berubah: kolom F dari `Nama Produk` menjadi `Ringkasan Produk`, dan kolom I dari `Qty` menjadi `Total Qty`. Isinya tidak berubah, hanya namanya. Sebelum ini kedua nama sempat bergantian sendiri setiap kali pesanan ditarik, karena daftar header disimpan di dua tempat yang berbeda.


