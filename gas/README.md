# Panduan Instalasi Google Apps Script - ERP Begood

Modul Google Apps Script ini bertindak sebagai antarmuka pengguna (UI), basis data tabel operasional, dan mesin otomatisasi terjadwal untuk toko Shopee **b e g o o d . b d g**.

---

## 📋 Langkah Instalasi di Google Sheets

1. **Buat Spreadsheet Baru**
   - Buka [Google Sheets](https://sheets.new) di browser Anda.
   - Beri judul spreadsheet: `ERP Begood - Shopee b e g o o d . b d g`.

2. **Buka Script Editor**
   - Di menu atas Google Sheets, klik **Ekstensi (Extensions)** > **Apps Script**.

3. **Salin File Skrip & HTML**
   - Pada panel kiri Apps Script:
     - Ganti isi file `Code.gs` bawaan dengan isi file [`gas/Code.js`](file:///Users/macbook/Documents/ERP%20Begood/gas/Code.js).
     - Klik tombol **+** (Add a file) > **Script**, beri nama `SheetManager`, lalu salin isi file [`gas/SheetManager.js`](file:///Users/macbook/Documents/ERP%20Begood/gas/SheetManager.js).
     - Klik tombol **+** (Add a file) > **Script**, beri nama `ShopeeApi`, lalu salin isi file [`gas/ShopeeApi.js`](file:///Users/macbook/Documents/ERP%20Begood/gas/ShopeeApi.js).
     - Klik tombol **+** (Add a file) > **HTML**, beri nama `Index` (akan menjadi `Index.html`), lalu salin seluruh isi file [`gas/Index.html`](file:///Users/macbook/Documents/ERP%20Begood/gas/Index.html).
   - (Opsional) Jika mengaktifkan manifest:
     - Klik icon gerigi **Project Settings** > centang **"Show "appsscript.json" manifest file in editor"**.
     - Buka file `appsscript.json` di editor dan tempelkan konfigurasi dari `gas/appsscript.json`.

4. **Simpan Proyek**
   - Klik tombol ikon disket **Save Project** (atau `Ctrl+S` / `Cmd+S`).

5. **Inisialisasi Lembar Kerja**
   - Kembali ke tab spreadsheet Google Sheets, lalu refresh halaman browser Anda (`F5` / `Cmd+R`).
   - Akan muncul menu baru di bar menu: **📦 ERP Begood**.
   - Klik **📦 ERP Begood** > **🛠️ Inisialisasi / Reset Tabel Sheet**.
   - Google akan meminta persetujuan izin akses pertama kali (*Authorization Required*):
     - Klik **Review Permissions** > pilih akun Google Anda.
     - Klik **Advanced** > klik **Go to ERP Begood (unsafe)** > klik **Allow**.
   - Sistem akan secara otomatis membuat 10 sheet terformat:
     - `Pesanan Masuk`: Tabel data order 17 kolom terstruktur (dilengkapi Nomor Referensi SKU, Nama Variasi, Nomor Resi asli, pemecahan baris per-item produk, dropdown status internal, dan kolom Toko berisi kode toko pemilik baris).
     - `DB_Token`: Tabel penyimpanan token OAuth2 Shopee yang aman.
     - `Konfigurasi`: Tabel variabel URL Vercel & kunci rahasia.
     - `Log_Aktivitas`: Tabel audit log penarikan pesanan & refresh token.
     - `Pengguna`: Tabel akun dashboard beserta perannya.
     - `DATA PROSES`: Daftar harga dan waktu proses per SKU (SKU, Harga Jahit, Waktu Jahit, Waktu Potong). Satu baris mewakili satu SKU dan berlaku untuk seluruh variasi serta seluruh pesanannya. Rinciannya ada di [docs/struktur-spreadsheet.md](file:///Users/macbook/Documents/ERP%20Begood/docs/struktur-spreadsheet.md) bagian 8.
     - `DATA JAHIT`: Hasil jahit per baris pesanan, lengkap dengan sesi, penjahit, dan nomor pesanannya. Rinciannya ada di bagian 9 dokumen yang sama.
     - `SETTING PENJAHIT`: Daftar penjahit beserta grup, status aktif, dan bobot kapasitasnya. Rinciannya ada di bagian 10 dokumen yang sama.
     - `SKU RULES`: Pemetaan pola SKU ke grup pekerjaan, termasuk grup `IGNORE` untuk barang non-jahit. Rinciannya ada di bagian 11 dokumen yang sama.
     - `PEMBAGIAN JAHIT`: Hasil pembagian per penjahit, lengkap dengan Qty, grup, harga satuan, dan harga totalnya. Rinciannya ada di bagian 12 dokumen yang sama.

6. **Hubungkan ke Middleware Vercel**
   - Buka tab sheet `Konfigurasi`.
   - Ubah nilai pada kolom `Nilai`:
     - `VERCEL_MIDDLEWARE_URL`: Masukkan domain Vercel Anda (`https://shopee-middleware-erp.vercel.app`).
     - `BEGOOD_API_SECRET`: Masukkan token rahasia yang sama dengan yang disetel di Vercel env.
     - `DEFAULT_SYNC_DAYS`: `3` (atau sesuai preferensi operasional toko).
     - `TOKO_AKTIF`: Kode toko yang ikut sinkron otomatis, dipisah koma (contoh: `BGD,BGD2`). Biarkan kosong bila semua toko aktif ingin ikut.

7. **Menambah Toko Kedua dan Berikutnya**
   - Jalankan otorisasi lagi dengan akun Shopee toko berikutnya. Token toko baru akan **ditambahkan sebagai baris baru** di `DB_Token`, dan token toko yang sudah ada tidak tersentuh.
   - Buka sheet `DB_Token`, isi `Nama Toko` (kolom I) dan `Kode Toko` (kolom J) untuk baris toko baru itu. Kode toko dipakai sebagai penanda pada kolom Q `Pesanan Masuk`, jadi pakai kode pendek, misalnya `BGD` dan `BGD2`.
   - Untuk data lama yang belum punya penanda, jalankan **📦 ERP Begood** > **Isi Kolom Toko untuk Baris Lama (Migrasi)**. Menu itu hanya mengisi baris yang kolom Tokonya masih kosong, jadi aman dijalankan berulang. Menjalankan sinkronisasi juga akan mengisinya sendiri.
   - Isi `TOKO_AKTIF` seperti pada langkah 6.
   - Bila ringkasan sinkronisasi menyebut toko dengan angka panjang (Shop ID) dan bukan kode toko, berarti kolom `Kode Toko` belum terbaca. Jalankan **📦 ERP Begood** > **Periksa Isi DB_Token**. Menu itu menampilkan header baris 1 apa adanya, isi mentah kolom I dan J, dan setiap rekaman token yang terbaca sistem, sehingga kolom yang bergeser atau belum terisi langsung kelihatan.
   - Panduan lengkapnya ada di [docs/arsitektur-multi-toko.md](file:///Users/macbook/Documents/ERP%20Begood/docs/arsitektur-multi-toko.md).

   **Catatan durasi:** sampai trigger per toko dipasang, penarikan otomatis menjalankan seluruh toko berurutan dalam satu eksekusi, sedangkan Apps Script menghentikan eksekusi sekitar 6 menit. Bila toko Anda lebih dari dua, turunkan `DEFAULT_SYNC_DAYS` menjadi `1` lebih dulu.

8. **Buat Akun Pengguna Pertama**
   - Jalankan **📦 ERP Begood** > **Buat Akun Superadmin Pertama**.
   - Tulis kode, nama, dan sandi dalam satu baris, dipisah tanda pipa:

     ```text
     pemilik | Nama Anda | sandiRahasia123
     ```

     Sandi minimal 6 karakter. Sandi tidak disimpan apa adanya, hanya hasil hitungannya, sehingga sandi tidak dapat dilihat kembali, hanya dapat diganti.
   - Periksa hasilnya lewat **📦 ERP Begood** > **Lihat Daftar Pengguna**.
   - Rincian rancangan, pembagian peran, dan tahapan pekerjaannya ada di [docs/arsitektur-login-peran.md](file:///Users/macbook/Documents/ERP%20Begood/docs/arsitektur-login-peran.md).

   **Catatan penting:** membuat akun pengguna belum menutup apa pun. Pembatasan hak baru berlaku setelah Fase 2 dikerjakan. Sampai saat itu, siapa pun yang dapat membuka dashboard masih dapat memakai seluruh fiturnya.

---

## 📊 Menggunakan Web Dashboard Terpadu

Dashboard kontrol interaktif dapat diakses melalui 3 cara:

### 1. Sidebar di Google Sheets (Rekomendasi untuk Kerja Cepat)
- Di menu Google Sheets: klik **📦 ERP Begood** > **📊 Buka Web Dashboard (Sidebar)**.
- Panel kontrol akan terbuka di bilah sisi kanan sheet tanpa mengganggu tampilan tabel.

### 2. Layar Penuh Modal (Untuk Tampilan Luas & Detail)
- Di menu Google Sheets: klik **📦 ERP Begood** > **🚀 Buka Web Dashboard (Layar Penuh)**.
- Jendela pop-up berukuran 1200x780 pixel akan terbuka menampilkan seluruh statistik KPI, tabel pesanan, dan kontrol.

### 3. Standalone Web App URL (Bisa Dibuka di Tab Browser / Handphone)
- Di editor Google Apps Script, klik tombol biru **Deploy** (di pojok kanan atas) > **New deployment**.
- Klik ikon gerigi **Select type** > pilih **Web app**.
- Konfigurasi:
  - **Description**: `ERP Begood Web Dashboard v1.0`
  - **Execute as**: `Me (email-anda@gmail.com)`
  - **Who has access**: `Only myself` (atau `Anyone with Google account` jika staf Anda memiliki akun Google).
- Klik **Deploy**, salin **Web app URL**, dan Anda dapat membukanya kapan saja dari peramban desktop maupun ponsel!

---

## 🎯 Fitur-Fitur di Web Dashboard

Tata letaknya terbagi dua bidang: **menu gelap di kiri, bidang data terang di kanan**. Menu di kiri adalah satu-satunya jalan berpindah bagian, dan pada layar sempit ia berubah menjadi laci yang dibuka tombol di bilah atas.

1. **Bilah atas**: judul bagian yang sedang dibuka, cakupan angka, jam WIB, kondisi token dan auto-sync, pemilih cakupan toko, interval muat ulang, tombol ganti mode terang atau gelap, dan tombol muat ulang.
2. **Pemilih cakupan toko**: `Semua toko` atau satu toko tertentu. Pilihan ini membatasi seluruh dashboard sekaligus, yaitu angka kartu, tabel pesanan, filter status, riwayat, grafik, dan semua ekspor. Cakupan yang sedang aktif selalu ditulis di dekat angkanya, sehingga tidak ada angka yang cakupannya harus ditebak.
3. **Kartu angka ringkas**: Total pesanan, Pesanan hari ini, Total omzet, dan Dalam pengiriman. Dua kartu membawa lencana arah angka: hijau bila naik, merah bila turun, dan abu-abu bila pembandingnya belum ada, sehingga persentase dari nol tidak pernah dipaksakan. Arahnya dihitung dari seri harian yang dikirim server.
4. **Panel Kontrol Cepat**:
   - Tombol **Tarik Pesanan** dengan pilihan rentang hari fleksibel (1, 3, 7, 14 hari). Bila satu toko dipilih pada pemilih cakupan, hanya toko itu yang ditarik.
   - Tombol **Otorisasi Shopee** (menampilkan tautan otorisasi resmi dengan tombol salin URL).
   - Tombol **Refresh Token** untuk toko yang sedang dipilih pada pemilih cakupan.
   - Tombol **Toggle Auto-Sync** (menghidupkan atau mematikan trigger 1 jam).
   - Tombol **Cek Ping Vercel** (memverifikasi kesehatan integrasi serverless).
5. **Tabel Manajemen Pesanan**:
   - Kolom pencarian realtime (cari No Pesanan, Nama Pembeli, Produk, Kurir, No Resi).
   - Kolom **Toko**, tampil hanya pada cakupan `Semua toko`.
   - Filter berdasarkan Status Internal Toko.
   - **Inline Dropdown Status Internal Begood**: Ganti status pesanan (contoh: *Siap Packing* ➔ *Menunggu Pickup Kurir*) langsung di baris tabel, data otomatis tersimpan ke spreadsheet.
6. **Bagian Analisis**: satu grafik batang **Pesanan masuk per hari** untuk empat belas hari terakhir, lalu tiga kartu sebaran bersebelahan, yaitu Status internal, Jasa ekspedisi, dan Toko. Grafiknya sengaja monokrom, karena warna sudah dipakai untuk menandai keadaan. Angka aslinya tetap tertulis di tiap batang, dan hari yang tidak ada pesanannya tetap tampil dengan angka nol, karena hari kosong itu kenyataan, bukan data yang hilang.
7. **Bagian Produksi & antrian**: daftar pekerjaan yang menunggu, diambil langsung dari pesanan berstatus `[2] Menunggu Pickup` setiap kali panelnya dibuka. Kolomnya No. Pesanan, Toko, SKU, variasi, jumlah, harga jahit, dan keadaan setiap baris: belum dijahit atau sudah dijahit, ditambah penanda belum dihargai. Di panel ini juga ada formulir **Harga dan waktu proses** untuk mengisi upah serta menit kerja sebuah SKU — SKU yang belum ada di daftar `DATA PROSES` langsung ditambahkan saat disimpan — dan tabel input yang tinggal dilengkapi nama penjahitnya sebelum disimpan ke `DATA JAHIT`.
8. **Bagian Estimasi kerja**: memilih satu tanggal, lalu menghitung dari `DATA JAHIT` × harga pada `DATA PROSES`. Yang ditampilkan lebih dulu beban kerjanya, yaitu jumlah pcs dan menit kerja per sesi dan per penjahit, baru kemudian nominal upahnya. Baris yang SKU-nya belum dihargai dilaporkan di panel ini, dan upahnya memang tidak dihitung.
9. **Bagian Pembagian jahit**: membagi pesanan menunggu pickup menjadi satuan pcs, lalu menetapkannya kepada penjahit menurut grup dan bobot kapasitasnya. Isinya angka pcs di antrian, pcs yang sudah berpemilik, yang belum ditetapkan, dan yang belum dibagi; tabel beban dan upah per penjahit beserta target dan selisihnya; rekap per grup dan per toko; daftar hal yang perlu ditindaklanjuti; serta panel setelan penjahit dan aturan SKU. Tombol **Tutup sesi & simpan hasil** mengerjakan rangkaian hariannya sekali tekan: bagi yang belum terbagi, isi harga pcs lama yang kosong, lalu simpan hasilnya ke `DATA JAHIT`. Menekannya dua kali tidak menggandakan pekerjaan, upah, maupun hasil jahit.
10. **Bagian Token & Integrasi**:
   - Satu baris per toko, memuat kode dan nama toko, Shop ID, kondisi token, waktu kedaluwarsa, dan jumlah pesanannya. Ada juga input token baru lewat JSON paste.
11. **Bagian Pengguna & peran**: hanya tampil untuk superadmin. Isinya dijelaskan pada bagian Akun dan Peran di bawah.
12. **Bagian Riwayat Aktivitas**:
   - Audit trail 10 aktivitas sinkronisasi dan sistem terakhir, lengkap dengan toko pelaksana, status, dan keterangannya.

#### Dua satuan angka, dan mengapa keduanya berbeda

Satu pesanan dapat berisi lebih dari satu produk, dan setiap produk disimpan pada barisnya sendiri di sheet. Karena itu ada dua satuan angka di dashboard, dan keduanya benar:

| Satuan | Artinya | Muncul di |
|---|---|---|
| **pesanan** | satu nomor pesanan (Order SN), yaitu satu paket yang perlu dikemas | kartu angka, panel antrian, lencana arah angka |
| **baris** | satu baris produk di sheet. Satu pesanan menjadi dua baris bila pembeli membeli dua produk | pilihan filter status, keterangan jumlah baris di bawah tabel |

Contoh yang sering membingungkan: panel antrian menulis **22 pesanan**, sedangkan pilihan filter **[1] Siap Packing** menulis **31 baris**. Keduanya benar, karena 31 baris itu milik 22 paket. Karena itu satuannya selalu ikut ditulis di kedua tempat, dan panel antrian menampilkan keduanya sekaligus.

---

## 🖨️ Cetak Slip Packing & Export PDF

Dashboard sudah menyediakan pratinjau cetak slip packing yang dapat dipakai untuk satu pesanan, dari modal detail pesanan, atau untuk banyak pesanan sekaligus lewat bilah aksi massal. Slip dicetak dari pratinjau memakai dialog cetak peramban, sehingga printer dan ukuran kertas dapat dipilih sendiri.

Untuk menambahkan ekspor berkas PDF, yaitu arsip slip per pesanan, rekap tabel lintas halaman, dan label alamat paket ukuran thermal, ikuti [docs/panduan-export-pdf.md](file:///Users/macbook/Documents/ERP%20Begood/docs/panduan-export-pdf.md).


---

## 🧵 Modul Produksi & Estimasi Kerja

Dua sheet produksi, `DATA PROSES` dan `DATA JAHIT`, dipakai untuk menghitung beban kerja dan estimasi upah dari pesanan yang menunggu pickup.

Ringkasnya:

- Sumber daftar kerja adalah pesanan berstatus `[2] Menunggu Pickup` pada sheet `Pesanan Masuk`, dibaca langsung setiap kali panelnya dibuka dan **tidak disimpan** di sheet mana pun. SKU, variasi, dan jumlahnya diambil dari sana, sedangkan sesi dan nama penjahit tetap diisi manusia karena keduanya tidak ada di pesanan.
- **Alur hariannya satu kali tekan.** Tombol **Tutup sesi & simpan hasil** pada tab Pembagian jahit membagi pcs yang belum terbagi, mengisi harga pcs lama yang masih kosong, lalu menyimpan seluruh hasilnya ke `DATA JAHIT` beserta penjahit, sesi, dan tanggalnya. Padanannya di menu spreadsheet: **Tutup Sesi Jahit (Bagi + Simpan Hasil)**.
- Mengirim tabel input dua kali tidak menggandakan hasil jahit. Kuncinya nomor pesanan, SKU, variasi, dan penjahit — nama penjahit ikut masuk kunci supaya satu baris pesanan yang dikerjakan dua orang tetap tercatat sebagai dua baris.
- `DATA PROSES` adalah daftar harga, bukan daftar kerja: satu baris untuk satu SKU, dan nilainya berlaku untuk seluruh variasi serta seluruh pesanannya. SKU yang belum ada ditambahkan sebagai baris baru saat harga disimpan, sedangkan isian yang dikosongkan tidak pernah menimpa nilai lama.
- Nominal upah hanya dikirim kepada peran `SUPERADMIN`. Peran lain tetap menerima jumlah pcs dan menit kerja, karena itu yang dipakai mengatur beban kerja.
- Status pesanan **tidak** diubah modul ini. Setelah paket diserahkan ke kurir, statusnya diubah manual, dan itulah yang mengeluarkan pesanan dari antrian.

Panduan lengkapnya, termasuk bentuk kedua sheet, keempat RPC-nya, SOP harian, daftar uji terima, dan batas yang perlu diketahui, ada di [docs/panduan-adaptasi-data-jahit-data-proses.md](file:///Users/macbook/Documents/ERP%20Begood/docs/panduan-adaptasi-data-jahit-data-proses.md).

---

## 🧵 Pembagian Jahit & Upah per Penjahit

Tiga sheet terakhir dipakai membagi pekerjaan jahit kepada penjahit secara adil.

Ringkasnya:

- Nama variasi dipakai sampai koma pertama saja: variasi `Lilac,BC 90x220` menjadi `Lilac`, karena keterangan sesudah koma adalah ukuran yang sudah ada pada SKU. Pemotongan itu berlaku saat data masuk, saat dibaca, dan saat kunci disusun, sehingga baris lama tetap cocok dengan baris baru.
- Sumber kerjanya juga pesanan berstatus `[2] Menunggu Pickup`, dan satuannya **pcs**. Hasilnya ditulis ke sheet `PEMBAGIAN JAHIT` satu baris per penjahit pada satu baris pesanan, dengan kolom **Qty** (jumlah pcs bagiannya) serta **Harga Satuan** dan **Harga Total**; tiap pcs tetap boleh jatuh ke orang yang berbeda.
- SKU dipetakan ke grup lewat sheet `SKU RULES`. Grup `IGNORE` menandai barang yang bukan pekerjaan jahit, misalnya tas mika dan plastik.
- Penjahit dipilih dari grup yang sama, dengan pembanding **upah yang sudah dipegang dibagi bobot**. Yang dibandingkan upah, bukan jumlah pcs, karena satu bedcover dan satu sarung bantal tidak sama beratnya. Pcs termahal dibagi lebih dahulu supaya selisih upah tidak melebar.
- Setiap pcs punya kunci, sehingga menekan tombol bagi dua kali tidak menggandakan pekerjaan maupun upahnya. Penetapan penjahit pada baris lama juga tidak pernah ditimpa, jadi penyesuaian manual tetap aman.
- Rekap upah per penjahit, per grup, dan per toko dihitung saat diminta, bukan disimpan sebagai sheet. Target tiap orang adalah rata-rata berbobot kelompoknya, dan selisihnya ditampilkan terbuka.
- Nominal upah hanya dikirim kepada peran `SUPERADMIN`. Peran `PACKING` tetap membaca pcs, grup, dan penjahitnya, karena itu yang dipakai bekerja.
- Peringatan yang muncul antara lain SKU yang belum punya aturan grup, SKU yang belum dihargai, dan grup yang belum punya penjahit aktif. Peringatan tidak menghentikan pembagian; yang menghentikan hanya tidak adanya penjahit aktif sama sekali.

Panduan lengkapnya, termasuk bentuk ketiga sheetnya, keempat RPC-nya, SOP harian, daftar uji terima, dan batas yang perlu diketahui, ada di [docs/pembagian-jahit.md](file:///Users/macbook/Documents/ERP%20Begood/docs/pembagian-jahit.md).

---

## 👥 Mengelola Lebih dari Satu Toko

Satu spreadsheet dapat menampung beberapa toko Shopee sekaligus, asalkan semuanya berada di bawah satu app Shopee (satu `partner_id`). Ringkasnya:

- `DB_Token` menyimpan **satu baris per toko**. Menambahkan toko berarti menambahkan baris, bukan menimpa baris lama.
- Kolom `Toko` (Q) pada `Pesanan Masuk` menandai toko pemilik setiap baris, dan diisi otomatis saat sinkronisasi.
- `Log_Aktivitas` mencatat kode toko pelaksana pada kolom F.
- Sinkronisasi berjalan berurutan per toko. Kegagalan satu toko tidak menghentikan toko lainnya.
- Yang belum dikerjakan: trigger otomatis belum dipecah per toko.
- Bila satu toko melaporkan `0 pesanan` sementara toko lain normal, jalankan **📦 ERP Begood** > **Tarik Pesanan Satu Toko Tertentu** dengan kode toko itu, lalu baca bagian `Catatan API` pada dialog. Di situ ada pesan galat asli dari Shopee, dan `Log_Aktivitas` mencatat barisnya dengan status `ERROR`.

Rencana, alasan keputusan, dan urutan migrasinya ada di [docs/arsitektur-multi-toko.md](file:///Users/macbook/Documents/ERP%20Begood/docs/arsitektur-multi-toko.md).

---

## 🔐 Akun dan Peran

Satu spreadsheet dapat menampung beberapa pengguna dengan hak berbeda. Daftarnya ada di sheet `Pengguna`.

| Peran | Peruntukan |
|---|---|
| `SUPERADMIN` | Pemilik sistem. Semua fitur, termasuk kelola pengguna dan konfigurasi |
| `ADMIN` | Staf administrasi. Pesanan, status, ekspor, dan penarikan pesanan |
| `PACKING` | Staf gudang. Antrian packing, ubah status terbatas, cetak slip dan label |

Dua cara masuk, dan yang kedua selalu tersedia:

1. **Email akun Google**, tanpa sandi. Hanya bekerja bila server mengenali email pemanggil dan emailnya terdaftar di sheet `Pengguna`.
2. **Kode dan sandi.** Dipakai di perangkat gudang, dan menjadi jalur utama bila email tidak terbaca.

Menu yang berkaitan:

| Menu | Guna |
|---|---|
| **Buat Akun Superadmin Pertama** | Membuat akun pertama. Menolak berjalan bila superadmin aktif sudah ada |
| **Tambah / Ubah Pengguna** | Membuat akun admin atau packing, dan mengubah nama, peran, atau sandi |
| **Aktifkan / Nonaktifkan Pengguna** | Menandai akun tidak dipakai lagi tanpa menghapus barisnya |
| **Lihat Daftar Pengguna** | Menampilkan kode, peran, nama, email, dan waktu masuk terakhir. Tidak menampilkan sandi |
| **Periksa Identitas Pemanggil** | Menampilkan email pemanggil seperti yang dilihat server, untuk memastikan jalur email dapat dipakai atau tidak |

Rancangannya, termasuk mengapa halaman masuk saja tidak mengamankan apa pun, ada di [docs/arsitektur-login-peran.md](file:///Users/macbook/Documents/ERP%20Begood/docs/arsitektur-login-peran.md).

### Membuat akun admin atau packing

Menu pembuatan superadmin pertama hanya membuat satu akun. Akun lain dibuat lewat **Tambah / Ubah Pengguna**:

1. Jalankan **📦 ERP Begood** > **Tambah / Ubah Pengguna**.
2. Isi empat kotak yang muncul, satu per satu: **kode**, **nama**, **peran**, lalu **sandi**.
3. Untuk peran, tulis salah satu dari `PACKING`, `ADMIN`, atau `SUPERADMIN`.
4. Sandi minimal 6 karakter. Setelah tersimpan, sandi tidak dapat dilihat kembali, hanya dapat diganti.
5. Pesan penutup akan menyebut **nomor baris** tempat akun disimpan. Itu tanda akunnya sudah dibaca ulang dari sheet.
6. Periksa lewat **Lihat Daftar Pengguna**.

Bila kodenya sudah ada, datanya diperbarui, bukan ditambah. **Sandi hanya diganti bila kotaknya diisi**, sehingga nama atau peran dapat diubah tanpa mengganggu sandi yang sedang dipakai.

Untuk akun percobaan berperan packing: buat dengan kode misalnya `ujiPacking`, peran `PACKING`, lalu masuk dari tautan Web App memakai kode itu. Panel kendali, tab token, dan tombol ekspor tidak akan tampil. Setelah selesai diuji, jalankan **Aktifkan / Nonaktifkan Pengguna** untuk menonaktifkannya, atau ubah sandinya menjadi acak.

Dua pagar pengaman yang berlaku pada kedua menu itu:

- **Superadmin aktif terakhir tidak dapat diturunkan perannya atau dinonaktifkan.** Tanpa pagar ini, satu kali salah isi dapat mengunci semua orang dari dashboard.
- **Akun yang dinonaktifkan tetap tidak aktif walaupun namanya disunting.** Statusnya hanya berubah lewat menu aktifkan atau nonaktifkan.

### Mengelola pengguna dari dashboard

Menu di atas juga tersedia di dalam dashboard, pada tab **Pengguna & peran**. Tab itu hanya tampil untuk superadmin.

| Yang bisa dilakukan | Keterangan |
|---|---|
| Melihat daftar akun | Kode, nama, peran, email, status, dan waktu masuk terakhir. Hash dan sandi tidak pernah ikut dikirim ke halaman |
| Menambah akun | Mengisi kode, nama, peran, email yang boleh dikosongkan, dan sandi |
| Mengubah akun | Nama, peran, email, dan sandi. Kode akun dikunci karena kode itulah kunci barisnya, dan sandi hanya diganti bila isinya diisi |
| Menonaktifkan atau mengaktifkan | Satu langkah konfirmasi yang menyebut akibatnya. Barisnya tidak dihapus, sehingga namanya tetap dapat ditelusuri di riwayat |

Dua hal berlaku pada setiap perubahan:

- **Superadmin aktif terakhir tidak dapat diturunkan perannya dan tidak dapat dinonaktifkan.** Barisnya menampilkan alasan itu dan tombolnya mati. Server juga menolak, jadi memaksa tombolnya dari konsol peramban tidak menolong.
- **Perubahan peran, status, atau sandi mengakhiri sesi orang itu saat itu juga.** Tanpa itu, hak yang sudah dicabut masih terpakai sampai sesinya berakhir sendiri, yaitu sampai enam jam kemudian. Menyunting nama atau email tidak mengakhiri sesi, karena haknya tidak berubah.

Selama `WAJIB_LOGIN` masih `TIDAK`, tab itu tetap hanya tampil untuk superadmin, tetapi server belum menolak permintaan dari peran lain yang dibuat di luar halaman. Setelah menempel ulang `gas/Code.js` dan `gas/Index.html`, **buat deployment Web App versi baru**, karena tiga RPC baru harus dikenal oleh server yang melayani tautan Anda.

### Nominal uang hanya untuk superadmin

Peran `PACKING` dan `ADMIN` tidak menerima angka keuangan sama sekali. Yang hilang dari layar mereka:

- Kartu **Total omzet** beserta rata-rata per pesanan dan lencana arah omzetnya
- Kolom **Total** pada tabel pesanan, termasuk baris ongkir di bawahnya
- Blok **Total belanja** dan **Ongkir** pada modal detail pesanan
- Pilihan urutan **Nominal terbesar** dan **Nominal terkecil**
- Kolom nominal pada berkas **CSV** dan **rekap PDF** yang mereka ekspor

**Yang dipotong adalah datanya, bukan hanya tampilannya.** Server tidak mengirim kolom nominal kepada kedua peran itu, sehingga membuka konsol peramban tidak menampakkan angka apa pun. Yang tetap mereka terima: jumlah barang, nomor resi, ekspedisi, kota, status, dan seluruh antrian packing. Slip packing dan label tidak memuat nominal sama sekali, jadi cetaknya tidak terpengaruh.

Angka yang tidak dikirim tidak pernah ditulis sebagai `Rp 0`, karena nol berarti nilai pesanannya nol. Kartu omzetnya hilang dari layar, bukan menampilkan nol.

Selama `WAJIB_LOGIN` masih `TIDAK`, pemotongan itu belum bekerja, karena server belum mengenali siapa yang meminta. Pada mode uji yang berlaku hanya penyembunyian di layar. Untuk memeriksa tampilan kedua peran itu tanpa deploy, buka `dashboard-preview.html` dengan tambahan `?peran=packing` atau `?peran=admin` pada alamatnya.

### Memberlakukan halaman masuk

Laman masuk dan penjaganya sudah terpasang, tetapi **penolakan belum berlaku**. Selama `WAJIB_LOGIN` di sheet `Konfigurasi` bernilai `TIDAK`, semua permintaan tetap dilayani. Itu disengaja, supaya laman masuk dapat diuji tanpa risiko mengunci siapa pun.

| Tahap | `WAJIB_LOGIN` | Yang terjadi |
|---|---|---|
| Uji coba | `TIDAK` | Laman masuk muncul dan dapat dipakai. Kendali yang bukan haknya sudah tersembunyi. Server belum menolak apa pun |
| Berlaku | `YA` | Permintaan tanpa sesi ditolak, dan permintaan yang perannya kurang ditolak |

Urutan yang disarankan:

1. Tempel ulang ketiga berkas, lalu **buat deployment Web App versi baru**, karena tanda tangan seluruh RPC berubah.
2. Buka tautan Web App, masuk dengan akun yang sudah dibuat, lalu pastikan dashboard berjalan normal dan tombol **Keluar** berfungsi.
3. Setelah itu baru ubah `WAJIB_LOGIN` menjadi `YA`.

Bila ada yang tidak berfungsi pada tahap berlaku, kembalikan `WAJIB_LOGIN` menjadi `TIDAK`. Penolakan berhenti tanpa perlu menempel ulang kode.

Karena tanda tangan RPC berubah, **simpan salinan ketiga berkas sebelum menempel yang baru**, supaya dapat dikembalikan dengan menempel ulang saja.
