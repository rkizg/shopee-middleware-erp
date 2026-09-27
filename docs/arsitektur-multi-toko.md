# Arsitektur & Rencana Migrasi Multi-Toko (ERP Begood)

Dokumen ini merancang kemampuan **satu sistem ERP untuk mengelola beberapa toko Shopee sekaligus**, dengan syarat semua toko berada di bawah satu app Shopee (satu `partner_id` dan satu `partner_key`), dan setiap toko memiliki `shop_id` serta pasangan token sendiri.

Status: **sedang dikerjakan bertahap.** Fase 1 sampai 4 sudah diimplementasikan dan terverifikasi. Tiga pertanyaan penghambat sudah terjawab (bagian 10): app Shopee boleh diotorisasi lebih dari satu toko, jumlah tokonya lebih dari dua, dan nama kolom F adalah `Ringkasan Produk`. Fase 5 dan 6 belum dikerjakan.

| Fase | Isi | Status |
|---|---|---|
| 0 | Persiapan: backup, putuskan kode toko, pastikan app boleh multi-toko | Sebagian; app sudah dipastikan multi-toko, backup dan pengisian kode toko menunggu Anda |
| 1 | Skema sheet: kolom `Toko`, kolom `DB_Token`, kolom log, parameter `TOKO_AKTIF` | **Selesai** |
| 2 | `DB_Token` menjadi multi-baris | **Selesai** |
| 3 | Sinkronisasi per toko | **Selesai** |
| 4 | Dashboard multi-toko | **Selesai** |
| 5 | Trigger dan log per toko | Menunggu, dan **sebaiknya dikerjakan sebelum Fase 4**, lihat alasannya di bagian Fase 5 |
| 6 | Uji terima dan pembersihan | Menunggu |

Ruang lingkup:

| Termasuk | Tidak termasuk |
|---|---|
| Beberapa toko Shopee di bawah satu app | Beberapa app atau beberapa `partner_id` |
| Token per toko pada sheet `DB_Token` | Penyimpanan `partner_key` di Google Sheets |
| Kolom penanda toko pada sheet pesanan dan log | Pemisahan sheet pesanan per toko |
| Filter dan cakupan data per toko di dashboard | Marketplace lain di luar Shopee |

Dokumen terkait: `docs/arsitektur.md` untuk alur integrasi saat ini, `docs/struktur-spreadsheet.md` untuk skema kolom yang berlaku sekarang, dan `docs/panduan-export-pdf.md` untuk fitur ekspor yang ikut terpengaruh.

---

## 1. Mengapa perubahan ini tidak kecil

Menambah toko kedua bukan sekadar menambah satu baris token. Ada tiga hal yang membuatnya menyentuh hampir seluruh sistem:

1. **Token disimpan pada satu baris tetap.** Selama itu belum diubah, mengotorisasi toko kedua akan **menimpa token toko pertama**, dan seketika sinkronisasi toko pertama berhenti bekerja tanpa pesan galat yang jelas.
2. **Sheet `Pesanan Masuk` tidak punya kolom penanda toko.** Walaupun tokennya beres, pesanan dua toko akan bercampur dalam satu tabel yang tidak bisa difilter atau direkap per toko.
3. **Seluruh pembacaan sheet memakai indeks kolom**, bukan nama kolom. Menambah atau menggeser kolom berpotensi merusak pemetaan 16 kolom yang sudah ada di enam fungsi berbeda. Karena itu urutan penambahan kolom menjadi keputusan penting, dan dibahas di bagian 3.3.

---

## 2. Kondisi Saat Ini

### 2.1 Bagian yang sudah siap multi-toko

Penelusuran kode menunjukkan bahwa **lapisan middleware Vercel sebenarnya sudah dirancang menerima akun per permintaan**, bukan terpaku pada satu toko. Ini mengurangi besar pekerjaan secara signifikan.

| Bagian | Bukti | Keterangan |
|---|---|---|
| Klien SDK Shopee | `createShopeeClient({ partnerId, partnerKey, shopId, region, initialToken })` di `middleware/src/lib/shopee.ts` | Keempat nilai kredensial dapat ditimpa per pemanggilan |
| Tarik pesanan | `middleware/api/orders/daily.ts` membaca `shop_id`, `access_token`, `refresh_token` dari payload, header, atau query | Satu endpoint melayani toko mana pun |
| Tujuan SDK pada order | `middleware/src/services/order.service.ts` memakai `shopId: params.shop_id` | Token yang dikirim menentukan toko yang dibaca |
| OAuth callback | `middleware/api/auth/callback.ts` membaca `shop_id` dari query atau body | Toko penerima token tidak ditentukan oleh env |
| Refresh token | `middleware/api/auth/refresh.ts` membaca `refresh_token` dan `shop_id` per permintaan | Token toko mana pun dapat diperbarui |
| Tukar kode otorisasi | `TokenService.exchangeCodeForToken(code, shopId)` | Menerima `shopId` sebagai argumen |
| Perbarui token | `TokenService.refreshToken(refreshToken, shopId)` | Menerima `shopId` sebagai argumen |
| Klien HTTP di Apps Script | `ShopeeApi.fetchDailyOrders(params)` dan `ShopeeApi.refreshToken(refreshToken, shopId)` | Sudah meneruskan token dan `shop_id` dari pemanggil |

Kesimpulan bagian ini: **middleware tidak perlu diubah besar.** Yang perlu disesuaikan hanya nilai bawaan dari environment dan cara pemanggil memilih token.

### 2.2 Bagian yang masih mengunci ke satu toko

| # | Pengunci | Bukti di kode | Akibatnya bila tidak diubah |
|---|---|---|---|
| 1 | `DB_Token` menyimpan satu rekaman pada **baris 2 tetap** | `getTokenRecord()` membaca `sheet.getRange(2, 1, 1, 8)`; `saveTokenRecord()` menulis ke baris 2 | Token toko kedua menimpa token toko pertama |
| 2 | `Konfigurasi` hanya punya satu `SHOP_ID` | `defaultConfigs` di `initAllSheets()`, dan `saveTokenRecord()` menulis ulang nilai itu | Hanya satu toko yang dikenal sistem |
| 3 | Sheet `Pesanan Masuk` **tidak punya kolom toko** (16 kolom A sampai P) | `orderHeaders` di `initAllSheets()`, dan pemetaan `row[0]` sampai `row[15]` | Pesanan dua toko bercampur dan tidak bisa dipisahkan |
| 4 | `Log_Aktivitas` tidak punya kolom toko (5 kolom) | Pembacaan `getRange(sRow, 1, lRows, 5)` | Riwayat sinkronisasi tidak bisa dipisah per toko |
| 5 | Sinkronisasi memakai satu token | `syncOrdersCore(days, isBackground)` mengambil satu `tokenRec` dan mengirim satu `shop_id` | Hanya toko yang tokennya tersimpan yang ikut tersinkron |
| 6 | Trigger otomatis menyinkronkan satu toko | `automatedSyncTrigger()` memanggil `syncOrdersCore(days, true)` sekali | Toko lain tidak pernah ikut sinkron otomatis |
| 7 | Dashboard menulis identitas toko langsung di markup | Nama `b e g o o d . b d g` dan Shop ID `1564950615` ditulis tetap di `gas/Index.html` | Tampilan tidak mengikuti toko yang sedang dilihat |
| 8 | Pencocokan baris pesanan hanya memakai nomor pesanan | `upsertOrders()` mencocokkan berdasarkan Order SN | Bila nomor pesanan sama muncul di dua toko, satu bisa menimpa yang lain |

Pengunci nomor 1, 3, dan 8 adalah inti persoalan. Nomor 1 membuat token kedua tidak bisa hidup berdampingan, nomor 3 membuat data dua toko tidak bisa dipisahkan, dan nomor 8 membuat penggabungan data berisiko saling menimpa.

---

## 3. Keputusan Desain

Setiap keputusan disertai alasan dan alternatif yang ditolak, supaya pilihan yang sama tidak perlu diperdebatkan lagi saat implementasi.

### 3.1 Identitas toko: `shop_id` sebagai kunci, kode toko sebagai penanda

| Peran | Nilai | Sifat |
|---|---|---|
| Kunci teknis | `shop_id` dari Shopee, misalnya `1564950615` | Diberikan Shopee, tidak boleh dikarang, dipakai untuk semua pencocokan token |
| Penanda manusia | Kode toko pendek, misalnya `BGD` dan `BGD2` | Ditentukan pemilik toko, dipakai di sheet dan dashboard |

Kode toko sengaja tidak dibuat otomatis dari `shop_id`. Alasannya, kode toko akan muncul di ribuan baris sheet dan di nama berkas ekspor, sehingga harus stabil, pendek, dan mudah dibaca. Kode yang dihasilkan mesin cenderung panjang dan berubah bila logika pembuatnya berubah.

Aturan penulisan kode toko: huruf kapital, tanpa spasi, tanpa karakter khusus, panjang 2 sampai 8 karakter. Contoh yang sah: `BGD`, `BGD2`, `SBY1`.

### 3.2 `DB_Token` menjadi penyimpanan multi-baris

Kolom bertambah dari 8 menjadi 12, dengan `Shop ID` tetap sebagai kunci pencocokan:

| Kolom | Isi | Catatan |
|---|---|---|
| A Shop ID | `1564950615` | Kunci utama, tidak boleh kosong, tidak boleh ganda |
| B Partner ID | `1234567` | Sama untuk semua toko karena satu app |
| C Access Token | | Per toko |
| D Refresh Token | | Per toko |
| E Expired At (Unix) | | Per toko |
| F Expired At (WIB) | | Per toko |
| G Terakhir Diperbarui (WIB) | | Per toko |
| H Status Token | | Per toko |
| I Nama Toko | `b e g o o d . b d g` | Baru, untuk tampilan |
| J Kode Toko | `BGD` | Baru, dipakai pada kolom toko di sheet pesanan |
| K Aktif | `YA` atau `TIDAK` | Baru, menentukan apakah toko ikut sinkron otomatis |
| L Region | `GLOBAL` | Baru, untuk berjaga bila kelak ada toko dari region lain |

Perubahan perilaku fungsi:

| Fungsi sekarang | Fungsi setelah perubahan | Perilaku |
|---|---|---|
| `getTokenRecord()` tanpa argumen | `getTokenRecords()` | Mengembalikan **semua** rekaman token |
| `getTokenRecord()` | `getTokenRecord(shopId)` | Mengembalikan satu rekaman; tanpa argumen mengembalikan rekaman pertama yang aktif, agar kode lama tetap berjalan selama migrasi |
| `saveTokenRecord(data)` menulis baris 2 | `saveTokenRecord(data)` | Mencocokkan berdasarkan `shop_id`. Bila sudah ada, baris itu diperbarui. Bila belum ada, baris baru ditambahkan. Tidak pernah lagi menulis ke baris tetap |

Satu hal yang membuat perubahan ini aman: **Shopee mengembalikan `shop_id` di halaman callback otorisasi**, sehingga tidak perlu parameter `state` untuk mengetahui token itu milik toko mana. `middleware/api/auth/callback.ts` sudah membaca `shop_id` dari query. Jadi alurnya tetap seperti sekarang: buka tautan otorisasi, login dengan akun toko yang dituju, salin JSON token, tempel di dashboard, dan `saveTokenRecord` menyimpannya ke baris yang benar.

### 3.3 Kolom toko pada `Pesanan Masuk`: ditambahkan di **akhir**, bukan di depan

Ini keputusan paling menentukan keamanan migrasi, jadi alasannya ditulis lengkap.

Seluruh pembacaan sheet memakai **indeks kolom**, bukan nama kolom. Sebagai contoh, pemetaan pesanan membaca `row[0]` untuk No. Pesanan sampai `row[15]` untuk Waktu Sinkronisasi, dan ada di enam tempat: `getDashboardSummary()`, `getOrderRowsForExport()`, `getOrderRowsByStatus()`, `getStatusInventory()`, `mapBarisPesanan_()`, dan `upsertOrders()`.

| Pilihan | Dampak | Risiko |
|---|---|---|
| Menyisipkan `Toko` sebagai kolom A (menggeser semua) | Seluruh 16 indeks bergeser satu, ditambah 5 aturan format dan 1 aturan validasi dropdown harus dipindah (dropdown status dari D ke E, format mata uang dari J:K ke K:L, dan seterusnya) | Tinggi. Satu indeks yang terlewat akan membuat kolom tertukar tanpa galat |
| **Menambahkan `Toko` sebagai kolom Q (paling kanan)** | Semua indeks lama tetap sahih. Tidak ada aturan format yang bergeser | Rendah |

**Keputusan: kolom `Toko` ditambahkan sebagai kolom Q.**

Keberatan yang wajar adalah bahwa kolom toko "seharusnya" berada di depan karena toko adalah pengelompokan utama. Jawabannya: **urutan penyimpanan dan urutan tampilan adalah dua hal yang berbeda.** Di sheet, kolom Q tetap di kanan. Di dashboard, penanda toko ditampilkan di kolom paling kiri tabel karena urutan render ditentukan kode, bukan urutan kolom sheet. Pemisahan ini justru sehat: penyimpanan dijaga stabil, tampilan bebas diatur.

Bila kelak kolom toko ingin dipindah ke depan, itu langkah kosmetik tersendiri setelah seluruh sistem stabil. Daftar titik yang wajib diperbarui sudah tercatat di bagian 6, jadi pemindahan itu menjadi perubahan yang terbatas dan dapat diperiksa.

### 3.4 Kolom toko pada `Log_Aktivitas`

Kolom bertambah dari 5 menjadi 6, dengan `Toko` di kolom F (paling kanan) dan alasan yang sama seperti bagian 3.3. Isinya kode toko, atau `SEMUA` untuk aksi yang mencakup semua toko seperti penarikan gabungan.

### 3.5 `Konfigurasi`: dari satu `SHOP_ID` ke daftar toko

| Parameter | Status | Keterangan |
|---|---|---|
| `SHOP_ID` | Dipertahankan, ditandai usang | Selama migrasi masih dibaca sebagai cadangan; setelah Fase 6 tidak lagi dipakai |
| `TOKO_AKTIF` | Baru | Daftar kode toko yang ikut sinkron otomatis, dipisah koma. Contoh: `BGD,BGD2` |
| `VERCEL_MIDDLEWARE_URL` | Tetap | Satu middleware melayani semua toko |
| `BEGOOD_API_SECRET` | Tetap | Satu kunci untuk semua toko, karena middleware-nya satu |
| `DEFAULT_SYNC_DAYS` | Tetap | Rentang hari untuk sinkronisasi otomatis |

### 3.6 Kunci idempotensi baris pesanan harus memuat toko

Saat ini `upsertOrders()` mencocokkan baris lama dengan baris baru berdasarkan **nomor pesanan** saja. Setelah ada dua toko, cara itu tidak lagi aman: bila nomor pesanan yang sama muncul di dua toko, baris salah satu toko dapat dianggap sebagai baris yang sudah ada lalu diperbarui, sehingga datanya tertukar.

Nomor pesanan Shopee memang praktis unik, tetapi mengandalkan kebetulan itu pada data keuangan berarti satu kesalahan kecil bisa merusak catatan penjualan dua toko sekaligus. Kunci pencocokan dibuat eksplisit:

```text
kunci = Kode Toko + "|" + No. Pesanan + "|" + SKU + "|" + Nama Variasi
```

SKU dan variasi ikut masuk kunci karena satu pesanan dapat dipecah menjadi beberapa baris, satu baris per produk, sebagaimana dijelaskan di `docs/struktur-spreadsheet.md` bagian 2. Tanpa keduanya, baris produk kedua dari pesanan yang sama akan dianggap sebagai duplikat lalu ditimpa.

Yang akhirnya diterapkan adalah kunci `toko + nomor pesanan`, dengan alasan yang dijelaskan pada catatan Fase 3 di bagian 5. Hasil isolasinya sama: baris milik dua toko berbeda tidak akan pernah dianggap sebagai baris yang sama.

### 3.7 Kredensial tetap hanya di Environment Variables Vercel

`partner_id` dan `partner_key` **tidak** disimpan di Google Sheets, dan keputusan ini tidak berubah walau ada beberapa toko. Alasannya, `partner_key` adalah kunci yang menandatangani seluruh permintaan HMAC-SHA256; siapa pun yang memegangnya dapat memanggil API atas nama aplikasi Anda. Spreadsheet dibagikan ke beberapa staf gudang, sehingga kunci sebesar itu tidak boleh ikut terbagi.

Konsekuensi yang harus diterima: **semua toko wajib berada di bawah satu app dan satu region.** Bila kelak ada toko dari region berbeda, atau toko milik entitas usaha lain, itu memerlukan app kedua dan berada di luar lingkup dokumen ini.

Catatan keamanan terkait: access token dan refresh token tetaplah berada di sheet `DB_Token` seperti sekarang. Itu memang tidak terhindarkan karena Apps Script yang memanggil middleware. Yang tidak ikut ke sheet hanyalah `partner_key`, yang justru bagian paling berbahaya.

### 3.8 Sinkronisasi berurutan per toko, bukan paralel

`syncOrdersCore()` akan menerima parameter ketiga berupa kode toko. Tanpanya, fungsi menjalankan seluruh toko aktif secara berurutan.

| Aspek | Keputusan | Alasan |
|---|---|---|
| Urutan | Berurutan, bukan bersamaan | Kegagalan satu toko tidak menggagalkan toko lain, dan progresnya dapat ditampilkan per toko |
| Isolasi galat | Setiap toko dibungkus `try` sendiri | Satu token kedaluwarsa tidak boleh menghentikan seluruh penarikan |
| Jeda antar toko | Jeda singkat sebelum pindah toko | Batas laju Shopee berlaku per toko, tetapi middleware tetap sebaiknya tidak dibombardir |
| Pencatatan | Satu baris log per toko, memuat kode toko | Agar kegagalan dapat ditelusuri ke toko tertentu |
| Pilihan toko | Daftar dari `TOKO_AKTIF` | Toko yang tidak dipakai cukup ditandai tidak aktif tanpa menghapus tokennya |

Ada satu batas yang harus diwaspadai dan perlu diukur, bukan diasumsikan: **durasi satu pemanggilan.** Google Apps Script membatasi satu eksekusi sekitar 6 menit, dan fungsi Vercel juga memiliki batas durasi sesuai paket yang dipakai. Menarik 30 hari untuk lima toko dalam satu pemanggilan berpotensi melewati batas itu. Karena itu:

1. Penarikan manual menyediakan pilihan toko, sehingga pengguna dapat menarik satu toko bila rentangnya panjang.
2. Trigger otomatis dipecah **satu pemanggilan per toko**, bukan satu pemanggilan untuk semua toko.
3. Bila jumlah toko bertambah lagi, penyelesaian berikutnya adalah menyimpan posisi terakhir per toko agar penarikan dapat dilanjutkan.

Angka batas durasi Vercel yang berlaku pada akun Anda perlu dipastikan lebih dulu; itu salah satu pertanyaan terbuka di bagian 10.

### 3.9 Dashboard: cakupan data mengikuti filter toko

Perubahan pada dashboard mengikuti satu aturan: **setiap angka dan daftar harus menyebut cakupannya.** Ini pelajaran dari masalah filter status yang pernah terjadi, ketika satu angka dihitung dari seluruh sheet sementara daftar pembandingnya hanya 80 baris terbaru.

| Bagian dashboard | Setelah perubahan |
|---|---|
| Bilah atas | Nama toko dan Shop ID diambil dari data, tidak lagi ditulis tetap di markup |
| Pemilih toko | Baru, berisi `Semua toko` dan tiap kode toko yang aktif |
| Panel fokus dan strip angka | Mengikuti cakupan pemilih toko, dan labelnya menyebut cakupan itu |
| Filter status dan filter kurir | Tetap, bekerja di dalam cakupan toko yang dipilih |
| Kolom pertama tabel | Penanda kode toko, tampil hanya ketika cakupan `Semua toko` |
| Ekspor CSV dan PDF | Memuat kolom Toko, dan nama berkas menyebut cakupan bila bukan seluruh toko |
| Tab token | Menampilkan seluruh toko beserta status tokennya, bukan satu baris saja |

Untuk mendukung ini, RPC yang membaca sheet menerima parameter opsional `kodeToko`: `getDashboardSummary()`, `getOrderRowsByStatus()`, `getOrderRowsForExport()`, dan `getStatusInventory()`. Tanpa parameter, semuanya berperilaku seperti sekarang, sehingga migrasi dapat berjalan bertahap.

Satu RPC baru ditambahkan, `getDaftarToko()`, yang mengembalikan daftar toko untuk pemilih dan tab token:

```text
[
  { kode: 'BGD',  nama: 'b e g o o d . b d g', shopId: '1564950615',
    aktif: true, statusToken: 'AKTIF (3j 12m)', isExpired: false },
  { kode: 'BGD2', nama: 'Begood Store 2',      shopId: '1564950616',
    aktif: true, statusToken: 'KADALUARSA',     isExpired: true }
]
```

Daftar ini berasal dari sheet `DB_Token` dan sudah memuat status token masing-masing, sehingga tab token tidak perlu membaca token satu per satu.

---

## 4. Skema Sheet Setelah Perubahan

### 4.1 `Pesanan Masuk`: 16 menjadi 17 kolom

Kolom A sampai P tidak berubah sama sekali, baik urutan maupun artinya. Kolom baru ditambahkan di ujung.

| Kolom | Nama | Status |
|---|---|---|
| A | No. Pesanan | Tetap |
| B | Tanggal Pesanan (WIB) | Tetap |
| C | Status Shopee | Tetap |
| D | Status Internal Begood | Tetap |
| E | Nama Pembeli | Tetap |
| F | Ringkasan Produk | Tetap |
| G | Nomor Referensi SKU | Tetap |
| H | Nama Variasi | Tetap |
| I | Total Qty | Tetap |
| J | Total Belanja (Rp) | Tetap |
| K | Ongkir (Rp) | Tetap |
| L | Ekspedisi / Kurir | Tetap |
| M | No. Resi | Tetap |
| N | Catatan Pembeli | Tetap |
| O | Kota Tujuan | Tetap |
| P | Waktu Sinkronisasi | Tetap |
| **Q** | **Toko** | **Baru**, berisi kode toko, misalnya `BGD` |

Aturan pengisian kolom Q:

1. Baris lama diisi kode toko pada **Fase 2**, setelah kode toko terisi di `DB_Token` kolom J. Pada Fase 1 kolom ini masih kosong dengan sengaja.
2. Baris baru diisi otomatis dari token yang dipakai saat sinkronisasi, pada Fase 3.
3. Setelah Fase 2 kolom ini tidak boleh kosong. Baris tanpa kode toko akan diabaikan oleh filter toko, sehingga dianggap data yatim. Pemeriksaannya dilaporkan, bukan diabaikan diam-diam.

### 4.2 `DB_Token`: satu baris menjadi banyak baris

| Kolom | Nama | Status |
|---|---|---|
| A | Shop ID | Tetap, menjadi kunci |
| B | Partner ID | Tetap |
| C | Access Token | Tetap |
| D | Refresh Token | Tetap |
| E | Expired At (Unix) | Tetap |
| F | Expired At (WIB) | Tetap |
| G | Terakhir Diperbarui (WIB) | Tetap |
| H | Status Token | Tetap |
| **I** | **Nama Toko** | **Baru**, untuk tampilan dashboard |
| **J** | **Kode Toko** | **Baru**, dipakai pada kolom Q `Pesanan Masuk` |
| **K** | **Aktif** | **Baru**, `YA` atau `TIDAK` |
| **L** | **Region** | **Baru**, bawaan `GLOBAL` |

Baris: **satu baris per toko**, tidak ada lagi batas baris 2. Baris kosong di tengah tidak menjadi masalah karena pencocokan dilakukan berdasarkan `Shop ID`.

### 4.3 `Konfigurasi`

| Parameter | Status | Nilai awal |
|---|---|---|
| `VERCEL_MIDDLEWARE_URL` | Tetap | URL deployment Vercel |
| `BEGOOD_API_SECRET` | Tetap | Sama dengan env Vercel |
| `DEFAULT_SYNC_DAYS` | Tetap | `3` |
| `SHOP_ID` | Ditandai usang | Dibaca sebagai cadangan selama migrasi |
| **`TOKO_AKTIF`** | **Baru** | Daftar kode toko, misalnya `BGD,BGD2` |

### 4.4 `Log_Aktivitas`: 5 menjadi 6 kolom

| Kolom | Nama | Status |
|---|---|---|
| A | Waktu (WIB) | Tetap |
| B | Tipe Aksi | Tetap |
| C | Jumlah | Tetap |
| D | Status | Tetap |
| E | Keterangan | Tetap |
| **F** | **Toko** | **Baru**, kode toko atau `SEMUA` |

### 4.5 Enam titik kode yang membaca kolom berdasarkan indeks

Ini daftar yang harus diperiksa setiap kali urutan kolom `Pesanan Masuk` berubah. Dengan keputusan bagian 3.3, ke enamnya **tidak perlu diubah** saat migrasi, kecuali untuk menambahkan kolom Q.

| # | Lokasi | Indeks yang dibaca |
|---|---|---|
| 1 | `SheetManager.getDashboardSummary()` | `row[0]` sampai `row[15]` |
| 2 | `SheetManager.getOrderRowsForExport()` dan `mapBarisPesanan_()` | `row[0]` sampai `row[15]` |
| 3 | `SheetManager.getOrderRowsByStatus()` | `row[0]` dan `row[3]` untuk pencocokan, `row[0]` sampai `row[15]` untuk keluaran |
| 4 | `SheetManager.getStatusInventory()` | `row[0]` dan `row[3]` |
| 5 | `SheetManager.upsertOrders()` | `allData[rowIdx][2]`, `[3]`, `[6]`, `[7]`, `[8]`, `[11]`, `[12]`, `[15]` |
| 6 | Aturan format dan validasi di `initAllSheets()` | Rentang `D2:D5000`, `J2:K5000`, `A2:A5000`, `G2:H5000`, `M2:M5000` |

Semuanya perlu ditambah pembacaan `row[16]` untuk kolom Toko, dan tidak ada yang perlu digeser.

### 4.6 Temuan saat Fase 1: daftar header pesanan ada dua salinan

Ditemukan ketika Fase 1 dikerjakan: daftar header `Pesanan Masuk` ditulis **dua kali** di `gas/SheetManager.js`, dan keduanya sudah berbeda.

| Lokasi | Nama kolom F |
|---|---|
| `initAllSheets()` | `Ringkasan Produk` |
| `upsertOrders()` | `Nama Produk` |
| `docs/struktur-spreadsheet.md` | `Nama Produk` |

Jadi ada dua nama yang beredar untuk kolom yang sama, dan dokumen memihak yang berbeda dari kode yang biasanya berjalan lebih dulu.

Dampaknya sekarang masih terbatas: `upsertOrders()` hanya menulis header ketika sheet benar-benar kosong, sehingga pada spreadsheet yang sudah berjalan nilai dari `initAllSheets()` yang menang. Tetapi ini tetap bahaya pemeliharaan, karena setiap penambahan kolom harus dilakukan di dua tempat dan satu tempat yang terlewat akan membuat header sheet baru berbeda dari sheet lama.

**Keputusan untuk Fase 1:** kedua salinan sama-sama ditambahi `Toko`, tanpa digabungkan, supaya fase ini benar-benar tidak mengubah perilaku apa pun. Penggabungan menjadi satu konstanta bersama sebaiknya dikerjakan sebagai langkah kecil tersendiri sebelum Fase 3, karena Fase 3 memang akan menyentuh `upsertOrders()`.

**Yang perlu Anda putuskan:** nama kolom F yang benar `Ringkasan Produk` atau `Nama Produk`? Setelah pemecahan baris per produk, kolom itu berisi satu produk per baris sehingga `Nama Produk` lebih tepat secara arti, tetapi `Ringkasan Produk` itulah yang sekarang terpasang di spreadsheet Anda.


---

## 5. Rencana Migrasi Bertahap

Prinsip yang dipakai: **setiap fase harus meninggalkan sistem dalam keadaan berfungsi.** Tidak ada fase yang boleh mengharuskan dua fase berikutnya selesai lebih dulu, dan setiap fase punya cara verifikasi dan cara mundur.

### Fase 0: Persiapan, tanpa satu pun perubahan kode

| Langkah | Cara | Alasan |
|---|---|---|
| Pastikan app boleh multi-toko | Tanyakan ke Shopee Open Platform, atau coba otorisasi toko kedua dan lihat apakah tokennya diterima | Ini prasyarat yang menentukan. Bila app dibatasi satu toko, seluruh dokumen ini tidak berlaku dan perlu app kedua |
| Cadangkan spreadsheet | Menu File, Make a copy | Migrasi menyentuh ribuan baris; salinan adalah jaring pengaman termurah |
| Catat `shop_id` toko yang ada sekarang | Lihat sheet `DB_Token` baris 2 | Jadi kode toko default untuk data lama |
| Tentukan kode dan nama setiap toko | Tulis daftarnya | Kode dipakai ribuan kali, jadi harus diputuskan sekali dan tidak berubah |
| Pastikan kode deployment Vercel terbaru sudah aktif | Halaman deployment Vercel | Agar kegagalan fase berikutnya tidak tertukar dengan masalah deployment |
| Pastikan tidak ada trigger ganda terpasang | Menu ERP Begood, Matikan Semua Trigger, lalu pasang ulang bila perlu | Trigger ganda membuat dua proses sinkronisasi berjalan bersamaan saat migrasi |

**Mundur dari fase ini:** tidak ada yang perlu dibatalkan.

### Fase 1: Skema sheet, belum mengubah perilaku

**Status: selesai diimplementasikan.** Yang diubah hanya `initAllSheets()` di `gas/SheetManager.js`, memakai pola tambah-bila-belum-ada.

| Sheet | Yang ditambahkan | Cara memastikan aman |
|---|---|---|
| `Pesanan Masuk` | Kolom Q `Toko`, beserta format teks untuk kolom itu | Kolom dibiarkan kosong; lihat koreksi di bawah |
| `DB_Token` | Kolom I sampai L (`Nama Toko`, `Kode Toko`, `Aktif`, `Region`) | Hanya baris header yang ditulis; baris data tidak disentuh |
| `Log_Aktivitas` | Kolom F `Toko` | Hanya baris header yang ditulis ulang |
| `Konfigurasi` | Parameter `TOKO_AKTIF` | Ditambahkan hanya bila belum ada, sehingga nilai yang sudah diisi pengguna tidak tertimpa |

#### Koreksi terhadap rencana awal

Rencana awal menyebut kolom Q diisi kode toko default untuk seluruh baris lama pada fase ini. **Itu dibatalkan.** Alasannya dua: kode toko belum diputuskan pada Fase 1, dan kolom Q belum dibaca oleh apa pun sampai Fase 3. Mengisinya lebih dulu berarti menulis kode sementara ke ribuan baris yang kemudian harus ditulis ulang. Pengisian dipindahkan ke Fase 2, setelah kode toko terisi di `DB_Token` kolom J.

Konsekuensinya, setelah Fase 1 kolom Q masih kosong dan itu memang keadaan yang benar.

#### Pengaman tambahan: penulisan header tidak boleh menimpa data

Saat Fase 1 dikerjakan, ditemukan jalur yang bisa menghapus data. `logActivity()` memakai `appendRow()` tanpa memeriksa apakah sheet sudah punya header. Bila sheet log masih kosong, baris pertama menjadi **baris data tanpa header**. Sebelumnya itu tidak berbahaya karena header log hanya ditulis ketika sheet benar-benar kosong. Namun penambahan kolom pada Fase 1 membuat header log perlu ditulis ulang, dan penulisan ulang itu akan menimpa baris data tersebut.

Perbaikannya: satu fungsi pengaman, `tulisHeader_(sheet, headers)`, dipakai untuk sheet pesanan, token, dan log. Perilakunya:

| Keadaan sheet | Tindakan |
|---|---|
| Kosong | Sisipkan baris header |
| Baris 1 sudah berisi header yang sama | Tulis ulang baris 1, seperti sebelumnya |
| Baris 1 berisi data, bukan header | **Sisipkan satu baris header di atasnya**, sehingga seluruh data lama bergeser turun dan tetap utuh |

Ini satu-satunya perubahan perilaku pada Fase 1, dan sifatnya memperbaiki jalur yang berpotensi menghapus data, bukan mengubah cara kerja normal.

#### Yang tidak diubah pada fase ini

`upsertOrders()` masih menulis 16 kolom pertama, `getTokenRecord()` masih membaca baris 2, `logActivity()` masih menulis 5 kolom, dan sinkronisasi masih satu toko. Kolom baru hanya berupa header.

#### Verifikasi yang sudah dijalankan

Dijalankan memakai spreadsheet tiruan di luar Google Sheets, sehingga dapat menguji hal yang sulit diuji manual seperti idempotensi.

| Uji | Hasil |
|---|---|
| Spreadsheet baru menghasilkan 17 kolom pesanan, 12 kolom token, 6 kolom log, dan parameter `TOKO_AKTIF` | Lulus |
| Dijalankan dua kali tidak menggandakan kolom maupun parameter | Lulus |
| Sheet lama 16 kolom berisi data menjadi 17 kolom, dan seluruh baris data lama tetap identik | Lulus |
| Nilai `Konfigurasi` yang sudah diisi pengguna tidak tertimpa | Lulus |
| Baris data `Log_Aktivitas` dan baris token `DB_Token` tetap utuh | Lulus |
| Sheet yang baris 1-nya berisi data tanpa header: header disisipkan di atasnya dan **data lama tetap utuh** | Lulus |


#### Verifikasi yang perlu Anda jalankan sendiri

Uji di atas memakai spreadsheet tiruan. Yang berikut harus dijalankan pada spreadsheet asli, setelah Anda menjalankan menu **Inisialisasi / Reset Tabel Sheet** (menu ini tidak menghapus data).

1. Buka spreadsheet, pastikan kolom A sampai P tidak bergeser sama sekali: periksa bahwa kolom D masih berisi Status Internal dan kolom J masih berformat Rupiah.
2. Buka dashboard, pastikan seluruh baris tetap terbaca dan filter status serta filter kurir masih bekerja.
3. Jalankan penarikan satu hari, pastikan tidak ada galat dan baris baru tetap masuk.
4. Periksa kolom Q berjudul Toko dan masih kosong, serta sheet `Konfigurasi` memuat baris `TOKO_AKTIF`.

**Mundur:** hapus kolom Q dan kolom baru lain, atau pulihkan dari salinan Fase 0. Karena belum ada kode yang bergantung pada kolom baru, pemulihan tidak memengaruhi apa pun.

### Fase 2: `DB_Token` menjadi multi-baris

**Status: selesai diimplementasikan.**

| Berkas | Yang berubah |
|---|---|
| `gas/SheetManager.js` | `getTokenRecords()` baru; `getTokenRecord(shopId)` menerima argumen opsional; `saveTokenRecord()` menjadi upsert berdasarkan Shop ID; `backfillKodeToko()` baru; konstanta `TOKEN_HEADERS` dipakai bersama agar susunan kolom token tidak lagi ditulis di dua tempat |
| `gas/Code.js` | Fungsi `backfillKodeTokoPrompt()` dan satu butir menu baru, `Isi Kolom Toko untuk Baris Lama (Migrasi)` |

Aturan yang dipatuhi fungsi `saveTokenRecord()`:

1. Kunci pencocokan adalah `shop_id`. Baris yang cocok diperbarui, yang tidak cocok ditambahkan.
2. Fungsi ini **tidak boleh** menyentuh baris selain baris yang cocok.
3. `getTokenRecord()` tanpa argumen tetap ada dan mengembalikan rekaman pertama yang aktif, supaya kode lama tidak perlu diubah sekaligus.
4. Bila satu `shop_id` muncul lebih dari satu kali, hanya baris pertama yang dipakai dan sisanya dilaporkan lewat log, bukan dihapus diam-diam.

#### Keputusan pelengkap saat implementasi

Empat hal muncul ketika Fase 2 dikerjakan dan tidak tercantum di rencana awal.

| Hal | Keputusan | Alasan |
|---|---|---|
| Kolom I-L saat token disegarkan | Dipertahankan bila tidak ikut dikirim | Penyegaran token otomatis dari middleware hanya mengirim lima kolom. Tanpa ini, setiap auto-refresh akan menghapus `Nama Toko`, `Kode Toko`, `Aktif`, dan `Region` |
| `saveTokenRecord()` tanpa `shop_id` | Baris pertama yang sudah berisi access token yang diperbarui | Menjaga perilaku lama tetap jalan, karena JSON hasil otorisasi bisa saja tidak memuat `shop_id` |
| `SHOP_ID` di `Konfigurasi` | Hanya ditulis bila jumlah toko masih satu | Satu nilai tidak dapat mewakili beberapa toko, dan menulis toko terakhir yang diotorisasi akan menyesatkan |
| Baris yang Shop ID-nya kosong | Tetap dianggap rekaman bila punya access token | Mencegah token yang tersimpan tanpa Shop ID menjadi tidak terbaca dan hilang diam-diam |

Selain itu, baris `DB_Token` yang masih berisi tempelan JSON mentah di sel A2 kini dipindahkan ke kolom yang benar lalu sel mentahnya dibersihkan, sehingga tidak terbaca sebagai baris token kedua.

#### Verifikasi yang sudah dijalankan

Dijalankan dengan spreadsheet tiruan. Uji kedua adalah uji terpenting dari seluruh migrasi ini.

| Uji | Hasil |
|---|---|
| Toko pertama disimpan: satu rekaman, `getTokenRecord()` tanpa argumen tetap mengembalikan rekaman itu | Lulus |
| **Toko kedua disimpan: baris toko pertama identik sebelum dan sesudah** | Lulus |
| Setelah dua toko: `getTokenRecord(shopId)` mengembalikan toko yang benar masing-masing | Lulus |
| `Konfigurasi` `SHOP_ID` tidak ditimpa oleh toko kedua | Lulus |
| Penyegaran token mempertahankan `Nama Toko`, `Kode Toko`, `Aktif`, dan `Region` | Lulus |
| Simpan tanpa `shop_id` memperbarui baris yang ada, tidak menambah baris baru | Lulus |
| `backfillKodeToko()` mengisi hanya baris kosong, tidak mengubah baris yang sudah terisi, dan idempoten | Lulus |
| Tempelan JSON mentah di A2 terbaca sebagai token, sel dibersihkan, tidak menghasilkan rekaman ganda | Lulus |

#### Verifikasi yang perlu Anda jalankan sendiri

Setelah menjalankan menu **Inisialisasi / Reset Tabel Sheet** (menu ini tidak menghapus data):

1. Pastikan token toko yang ada sekarang masih terbaca: buka dashboard, status token pada bilah atas harus tetap menunjukkan kondisi aktif.
2. Isi kolom `Kode Toko` (kolom J) pada `DB_Token` untuk toko yang ada, misalnya `BGD`. Isi juga `Nama Toko` pada kolom I bila ingin namanya tampil di dashboard.
3. Jalankan menu **Isi Kolom Toko untuk Baris Lama (Migrasi)**, lalu periksa kolom Q `Pesanan Masuk` terisi pada baris lama.
4. Catat `access_token` toko pertama. Otorisasi toko kedua, tempel tokennya, lalu **periksa token toko pertama masih sama** dan `DB_Token` kini berisi dua baris.

Langkah 4 adalah pengujian langsung untuk pengunci nomor 1. Bila token toko pertama berubah, hentikan migrasi dan pulihkan dari salinan Fase 0.

**Mundur:** hapus baris toko kedua di `DB_Token`, dan kembalikan fungsi ke versi sebelumnya. Selama Fase 3 belum dikerjakan, sistem kembali berperilaku satu toko.

### Fase 3: Sinkronisasi per toko

**Status: selesai diimplementasikan.**

| Berkas | Yang berubah |
|---|---|
| `gas/SheetManager.js` | `PESANAN_HEADERS` menjadi satu-satunya daftar kolom; `upsertOrders(ordersList, kodeToko)`; `getTokoUntukSync(kodeToko)` baru; `logActivity()` mengisi kolom Toko |
| `gas/Code.js` | `syncOrdersCore()` memanggil `syncSatuToko_()` per toko; `syncOrdersBySnCore()` menerima kode toko dan menelusuri semua toko; `rincianToko_()` dan `ringkasanSemuaToko_()` menyusun kotak dialog |

```text
syncOrdersCore(days, isBackground, kodeToko)   // kodeToko opsional
```

| Perilaku | Tanpa `kodeToko` | Dengan `kodeToko` |
|---|---|---|
| Token yang dipakai | Seluruh toko aktif, disaring `TOKO_AKTIF` bila diisi | Hanya toko itu |
| Isolasi galat | Satu `try` per toko | Satu `try` untuk toko itu |
| Log | Satu baris per toko, kolom Toko terisi | Satu baris |
| Kotak dialog | Satu ringkasan, satu baris per toko | Dialog rinci seperti versi satu toko |
| Nilai balik | Ringkasan per toko pada properti `toko` | Ringkasan toko itu |
| Kegagalan | Dilempar hanya bila seluruh toko gagal | Sama |

#### Cara mencocokkan baris: toko dan nomor pesanan, bukan empat bagian

Bagian 3.6 menulis kunci `Kode Toko + No. Pesanan + SKU + Nama Variasi`. Yang diterapkan versi lebih pendek: **baris dianggap milik satu toko bila kode tokonya sama, atau bila kolom Tokonya masih kosong.**

Alasannya, kunci empat bagian menuntut penulisan ulang cara `upsertOrders()` memperbarui pesanan yang dipecah menjadi beberapa baris. Fungsi itu mencocokkan per nomor pesanan lalu memakai urutan baris untuk menentukan baris produk mana yang diperbarui, dan urutan itulah yang juga menjaga Status Internal Begood tidak tertimpa. Menulis ulang bagian itu berarti menyentuh aturan yang dokumen ini sendiri minta untuk tidak diubah. Pemisahan baris berdasarkan SKU dan variasi sudah dikerjakan oleh mekanisme urutan tersebut.

Hasilnya tetap seperti yang dimaksud bagian 3.6: baris milik dua toko berbeda tidak akan pernah dianggap sebagai baris yang sama.

#### Baris lama yang belum bertanda diadopsi

Baris yang kolom Q-nya masih kosong ikut tercocokkan, lalu **diisi kode toko saat sinkronisasi**. Ini disengaja, dan menjadi alasan kolom Q bisa bertambah tanpa membuat baris lama terduplikasi.

Tanpa toleransi ini, seluruh pesanan lama akan dianggap baru pada sinkronisasi pertama karena kode tokonya berbeda dari yang tertulis di sheet, dan setiap pesanan tercatat dua kali. Karena itu menu backfill tidak wajib dijalankan lebih dulu: sinkronisasi membetulkannya sendiri.

Yang tidak pernah dilakukan: menimpa kolom Q yang **sudah** terisi.

#### Keputusan lain saat implementasi

| Hal | Keputusan | Alasan |
|---|---|---|
| Toko yang kolom Kode Tokonya masih kosong | Tetap ditarik, barisnya dibiarkan tanpa tanda, dan peringatan berisi sel yang perlu diisi dicatat di `Log_Aktivitas` | Menggagalkannya akan menghentikan sinkronisasi toko yang hari ini sudah berjalan hanya karena satu kolom belum diisi |
| Toko tanpa kode pada pilihan toko | Tidak dapat ditunjuk lewat kode, hanya ikut pada penarikan semua toko | Kode toko satu-satunya penanda; setelah kolom J diisi, toko itu langsung dapat ditunjuk |
| `TOKO_AKTIF` berisi kode yang tidak cocok | Ditolak dengan pesan yang menyebut kode yang benar-benar tersedia | Menarik semua toko padahal konfigurasi menyebut toko tertentu berarti menjalankan hal yang tidak diminta |
| Pencarian nomor SN | Menelusuri semua toko aktif sampai ketemu | Nomor SN hanya dimiliki satu toko, dan pengguna tidak perlu tahu toko mana pemiliknya |
| Kolom Toko di `Log_Aktivitas` | Diisi kode toko, atau `SHOP_ID` bila kode toko belum ada | Kolomnya ada sejak Fase 1 tetapi belum pernah diisi |

#### Temuan: kolom Q sempat tertimpa saat status diubah dari dashboard

`updateBatchInternalStatus()` menulis stempel waktu ke kolom terakhir yang berisi data. Sejak kolom `Toko` ditambahkan di Q pada Fase 1, kolom terakhir itu berubah menjadi kolom Toko. Akibatnya **setiap perubahan Status Internal Begood dari dashboard menimpa kode toko pada baris itu dengan stempel waktu.**

Bug ini lahir di Fase 1 dan baru terlihat sekarang, karena sebelum Fase 3 tidak ada yang mengisi kolom Q. Perbaikannya, stempel waktu ditulis ke kolom `Waktu Sinkronisasi` berdasarkan namanya, bukan posisinya. Dibuktikan dengan mengembalikan kode lamanya: kolom Q memang berubah menjadi `2026-09-27 08:00:00`.

Pelajaran untuk fase berikutnya: **setiap kode yang memakai "kolom terakhir" harus diperiksa**, karena penambahan kolom di ujung mengubah artinya tanpa memunculkan galat apa pun.

#### Verifikasi yang sudah dijalankan

Dijalankan dengan spreadsheet tiruan dan API Shopee tiruan, memuat `SheetManager.js` serta `Code.js` yang sebenarnya.

| Uji | Hasil |
|---|---|
| Nama kolom F dan I tidak berubah lagi setelah sinkronisasi | Lulus |
| Tarik satu toko: hanya baris toko itu yang bertambah, baris terisi 17 kolom | Lulus |
| Tarik toko kedua: baris toko pertama identik sebelum dan sesudah | Lulus |
| Baris lama tanpa tanda diadopsi; dijalankan ulang tidak menambah baris | Lulus |
| Baris bertanda BGD tidak dianggap sebagai baris milik BGD2 | Lulus |
| Status Internal Begood yang diubah manual bertahan setelah ditarik ulang | Lulus |
| Satu pesanan dua produk tetap dua baris, masing-masing bertanda benar | Lulus |
| Toko tanpa Kode Toko tetap ditarik, tanpa tanda, dan tercatat di log | Lulus |
| `TOKO_AKTIF` menyaring toko; salah tulis ditolak dengan daftar kode yang tersedia | Lulus |
| Penarikan gabungan: satu kotak dialog, satu baris log per toko, ada jeda antar toko | Lulus |
| Satu toko gagal: toko lain tetap tersimpan, kegagalan tercatat dengan kode tokonya | Lulus |
| Seluruh toko gagal: tetap dilempar sebagai kegagalan | Lulus |
| Pencarian nomor SN menemukan pesanan di toko kedua | Lulus |
| Kolom Q tidak lagi tertimpa saat status diubah dari dashboard | Lulus |

#### Bila kolom Q masih kosong

Jalankan **Isi Kolom Toko untuk Baris Lama (Migrasi)** atau **Periksa Isi DB_Token**. Menu kedua menampilkan header baris 1 apa adanya, isi mentah kolom I dan J, dan setiap rekaman token yang terbaca sistem.

Penyebab yang paling sering adalah kolom J belum terisi, atau baris header tidak lengkap sehingga kolomnya bergeser. Perhatikan bahwa **kode toko hanya terbaca dari kolom J**. Bila kolom itu kosong, sistem tetap menarik pesanannya, tetapi kolom Q dibiarkan kosong dan nama toko pada ringkasan ditampilkan sebagai Shop ID. Dialog ringkasan sinkronisasi kini menyebutkan jumlah toko yang belum berkode, jadi gejala ini tidak lagi lolos tanpa pemberitahuan.

#### Bila satu toko melaporkan 0 pesanan

Shopee membalas galat lewat daftar pesanan yang kosong, bukan lewat kode HTTP. Itu sebabnya toko yang ditolak Shopee dan toko yang memang tidak punya pesanan sama-sama tampil sebagai "0 pesanan". Sejak perbaikan ini, pesan galat aslinya ikut terlihat di tiga tempat:

1. Ringkasan sinkronisasi mencantumkan `Catatan API` di bawah toko yang bersangkutan.
2. `Log_Aktivitas` mencatat baris itu dengan status `ERROR`, dan pesan galatnya ada di kolom Keterangan.
3. Menu **Tarik Pesanan Satu Toko Tertentu** menarik satu toko saja, sehingga dialog rincinya menampilkan seluruh catatan API toko itu.

Cara memeriksanya: jalankan menu itu dengan kode toko yang bermasalah, lalu baca bagian `Catatan API`. Bila pesannya menyebut token atau otorisasi, ulangi otorisasi untuk toko itu. Bila pesannya menyebut parameter atau region, toko itu kemungkinan berada di region Shopee yang berbeda dari app-nya, dan itu memerlukan app kedua.

Yang perlu dipahami: penarikan tetap dianggap berhasil pada tingkat operasi, karena Apps Script memang menerima jawaban dari middleware. Yang menandai masalahnya adalah status `ERROR` di log dan catatan API di dialog, bukan kegagalan yang dilempar.

#### Verifikasi yang perlu Anda jalankan sendiri

1. Isi kolom `Kode Toko` (kolom J) di `DB_Token` untuk setiap toko.
2. Jalankan **Periksa Isi DB_Token**, lalu pastikan tiap rekaman menampilkan `kode_toko` yang benar. Bila masih `(KOSONG)`, bandingkan dengan bagian Isi mentah kolom J pada dialog yang sama.
3. Jalankan **Tarik Pesanan Masuk (Hari Ini / 3 Hari)**. Bila ada lebih dari satu toko, muncul satu ringkasan berisi satu baris per toko, dan tiap barisnya memakai kode toko, bukan Shop ID.
4. Periksa kolom Q `Pesanan Masuk` terisi, dan kolom A sampai P tidak bergeser.
5. Buka `Log_Aktivitas`, pastikan ada satu baris `SYNC_PESANAN` per toko dengan kolom Toko terisi.
6. Ubah status satu baris dari dashboard, lalu **pastikan kolom Q baris itu tidak berubah**.

**Mundur:** karena kolom Q hanya bertambah, baris lama tetap sah. Kembalikan `syncOrdersCore` ke versi satu toko dan sistem berjalan seperti semula.

### Fase 4: Dashboard multi-toko

**Status: selesai diimplementasikan.**

| Berkas | Yang berubah |
|---|---|
| `gas/SheetManager.js` | `getDashboardSummary(kodeToko)` menerima cakupan dan sekaligus menyusun `tokoList` berisi jumlah pesanan per toko; `mapBarisPesanan_()` menambah properti `toko`; `getOrderRowsByStatus()`, `getOrderRowsForExport()`, dan `getStatusInventory()` menerima cakupan; penolong `barisSesuaiToko_()` dan `hitungKondisiToken_()` |
| `gas/Code.js` | `getDashboardData()`, ketiga RPC pembaca, `triggerSyncOrders()`, dan `refreshTokenFromDashboard()` meneruskan cakupan; cache diberi nomor generasi lewat `kunciCacheDashboard_()` |
| `gas/Index.html` | Pemilih cakupan di bilah atas; identitas toko di bilah atas berasal dari data; cakupan ditulis di dekat angkanya; kolom Toko pada tabel pesanan, riwayat, dan rekap; tab token menjadi daftar seluruh toko; ekspor CSV, slip, label, dan rekap memakai data toko |

Urutan pengerjaan yang direncanakan, semuanya sudah dikerjakan:

1. Daftar toko beserta status token per toko.
2. Pemilih toko, dengan `Semua toko` sebagai bawaan.
3. Identitas toko di bilah atas berasal dari data, bukan ditulis di kode.
4. Parameter `kodeToko` pada setiap RPC pembaca sheet, dengan perilaku lama sebagai bawaan.
5. Penanda kode toko pada kolom pertama tabel, tampil hanya pada cakupan `Semua toko`.
6. Ekspor CSV dan PDF memuat kolom Toko.
7. Tab token menampilkan seluruh toko, satu baris per toko.

**Aturan yang tidak boleh dilanggar dan sudah dipegang:** setiap angka menyebut cakupannya. Cakupan ditulis di baris tersendiri di atas angka panel fokus, pada label antrian gudang, dan pada bilah atas. Ini mencegah terulangnya masalah filter status, ketika angka dan daftar dihitung dari cakupan yang berbeda.

**Mundur:** pemilih cakupan cukup disembunyikan; selama RPC masih menerima ketiadaan `kodeToko` dan berperilaku lama, dashboard kembali seperti semula.

#### Keputusan pelengkap saat implementasi

| Hal | Keputusan | Alasan |
|---|---|---|
| `getDaftarToko()` sebagai RPC tersendiri | Tidak dibuat | Daftar toko beserta jumlah pesanannya sudah ikut di dalam payload dashboard, dihitung dalam satu kali baca sheet. RPC terpisah berarti satu perjalanan bolak-balik tambahan tanpa menambah informasi |
| Cache dashboard | Kunci memuat nomor generasi dan cakupan | Satu kunci tunggal akan menyajikan data toko yang salah saat cakupan berganti. CacheService tidak dapat menghapus banyak kunci sekaligus, sehingga pembersihan dilakukan dengan menaikkan nomor generasi |
| Jumlah pesanan per toko | Dihitung dari seluruh baris, termasuk di luar cakupan | Angka itu yang mengisi pemilih cakupan, jadi harus lengkap walau tabelnya sedang disaring |
| Nama toko pada slip dan label | Diambil dari pesanan yang dicetak | Slip memuat satu pesanan. Bila barisnya belum bertanda toko, yang dicetak adalah nama aplikasi, bukan nama toko yang mungkin salah |
| Refresh token | Menolak berjalan bila cakupan masih `Semua toko` | Refresh token berlaku per toko. Menebak rekaman pertama berisiko memperbarui token toko yang salah |
| Kode toko yang ada di baris pesanan tetapi tidak ada di `DB_Token` | Tetap tampil di pemilih dengan keterangan `TIDAK ADA DI DB_Token` | Baris yatim tidak boleh menghilang dari pandangan hanya karena baris tokennya sudah dihapus |

#### Verifikasi yang sudah dijalankan

Panel server diuji dengan spreadsheet tiruan berisi dua toko, satu baris tanpa kode, dan satu pesanan dua produk. Panel klien diuji dengan pemeriksa statis yang membaca `Index.html` beserta `Code.js`.

| Uji | Hasil |
|---|---|
| Cakupan kosong: statistik, kurir, dan tabel memuat seluruh toko | Lulus |
| Cakupan satu toko: statistik, kurir, dan tabel hanya toko itu | Lulus |
| Pesanan multi-item tetap dua baris pada tabel, sementara `stats.totalOrders` menghitung pesanan unik | Lulus |
| Daftar toko memuat jumlah pesanan, nama, dan kondisi token masing-masing | Lulus |
| Baris tanpa kode dihitung terpisah dan tidak ikut cakupan toko mana pun | Lulus |
| Kondisi token pada cakupan semua toko berbunyi berapa toko yang perlu token | Lulus |
| Filter status, ekspor, dan inventaris status menghormati cakupan | Lulus |
| Cache terpisah per cakupan dan berganti setelah dibersihkan | Lulus |
| Setiap id yang dipanggil JS ada di markup; setiap handler dan nama RPC ada | Lulus |
| Seluruh RPC pembaca menerima cakupan | Lulus |
| Rekap PDF dengan kolom Toko masih muat di halaman | Lulus |

Satu kelalaian tertangkap oleh pemeriksa statis ini dan sudah diperbaiki: `triggerSyncOrders()` sempat tidak meneruskan cakupan, sehingga menekan tombol tarik saat satu toko dipilih akan tetap menarik semua toko.

#### Verifikasi yang perlu Anda jalankan sendiri

1. Buka dashboard, lalu pilih satu toko pada pemilih cakupan di bilah atas.
2. Cocokkan angka panel fokus dan jumlah baris tabel dengan hitungan langsung di sheet untuk toko itu, dengan menyaring kolom Q pada kode toko tersebut.
3. Ganti kembali ke `Semua toko`, lalu pastikan angkanya menjadi jumlah gabungan dan kolom Toko muncul di tabel.
4. Jalankan **Tarik pesanan** saat satu toko dipilih, lalu pastikan hanya toko itu yang muncul di `Log_Aktivitas`.
5. Ekspor CSV dan rekap PDF pada cakupan satu toko, lalu pastikan berkasnya hanya memuat baris toko itu dan namanya memuat kode tokonya.

### Fase 5: Trigger dan log

Yang diubah: `automatedSyncTrigger()` dan `setupHourlyTrigger()`.

**Mengapa fase ini sebaiknya didahulukan sebelum Fase 4.** Sinkronisasi otomatis saat ini berjalan lewat satu trigger yang menarik **seluruh** toko berurutan dalam satu eksekusi. Untuk dua toko itu masih longgar, tetapi Anda menyebut jumlah toko **lebih dari dua**. Setiap toko menambah satu rangkaian permintaan HTTP ke middleware, sedangkan Google Apps Script menghentikan eksekusi sekitar 6 menit. Bila batas itu terlampaui, trigger berhenti di tengah dan toko yang belum diproses tidak ikut tertarik pada jam itu.

Selama fase ini belum dikerjakan, ada dua penambat sementara:

1. Turunkan `DEFAULT_SYNC_DAYS` di `Konfigurasi`, misalnya menjadi `1`.
2. Isi `TOKO_AKTIF` dengan sebagian kode toko, lalu ganti isinya bergantian. Tidak nyaman, tetapi menghentikan risiko kehabisan waktu.

Keputusan: trigger dipecah **satu pemanggilan per toko**, dipasang dengan menelusuri isi `DB_Token`, bukan dengan menuliskan kode toko di dalam kode program. Untuk tiga toko, terpasang tiga trigger, masing-masing memanggil `syncOrdersCore(days, true, kodeToko)`, dengan waktu digeser beberapa menit agar tidak bertumpuk.

Alasan memilih pemecahan per toko dibanding satu trigger yang meloop semua: batas durasi eksekusi per pemanggilan menjadi jauh lebih longgar, kegagalan satu toko tidak memengaruhi jadwal toko lain, dan penyebab kegagalan langsung terlihat dari trigger mana yang dilaporkan gagal.

Batas praktisnya perlu diketahui: Apps Script membatasi sekitar 20 trigger per proyek, dan sebagian dipakai trigger lain. Cara ini nyaman sampai sekitar 10 sampai 15 toko. Bila jumlah toko melewati itu, penyelesaian berikutnya adalah satu trigger yang memproses sebagian toko per jam secara bergiliran, dengan posisi terakhir disimpan di `Konfigurasi`.

Verifikasi: jalankan `automatedSyncTrigger` dari editor, periksa `Log_Aktivitas` memuat baris per toko dengan kolom Toko terisi.

### Fase 6: Uji terima dan pembersihan

1. Jalankan seluruh checklist bagian 8.
2. Tandai `SHOP_ID` di `Konfigurasi` sebagai usang beserta keterangannya.
3. Perbarui dokumentasi agar sesuai kenyataan: `docs/struktur-spreadsheet.md` untuk 17 kolom, `docs/arsitektur.md` untuk alur multi-toko, `gas/README.md` untuk langkah otorisasi toko kedua, dan `README.md` untuk daftar berkas.
4. Simpan salinan cadangan di luar spreadsheet kerja, atau hapus bila sudah yakin.

---

## 6. Daftar Perubahan per Berkas

### 6.1 `gas/SheetManager.js`

| Fungsi | Perubahan | Fase |
|---|---|---|
| `initAllSheets()` | Tambah kolom Q `Toko`, kolom I-L `DB_Token`, kolom F `Log_Aktivitas`, parameter `TOKO_AKTIF`. Semua dengan pola tambah-bila-belum-ada | 1 |
| `getTokenRecord(shopId)` | Terima `shopId` opsional; tanpa argumen kembalikan rekaman aktif pertama | 2 |
| `getTokenRecords()` | Baru: seluruh rekaman token | 2 |
| `saveTokenRecord(data)` | Upsert berdasarkan `shop_id`, bukan baris 2 | 2 |
| `getDaftarToko()` | Tidak dibuat: daftar toko beserta jumlah pesanannya ikut di dalam payload `getDashboardSummary()`, lihat catatan Fase 4 | 4 |
| `PESANAN_HEADERS` | **Selesai**: baru, satu-satunya daftar kolom `Pesanan Masuk`, dipakai `initAllSheets` dan `upsertOrders` | 3 |
| `upsertOrders(ordersList, kodeToko)` | **Selesai**: tulis kolom Q, batasi pencocokan pada baris toko ini, adopsi baris lama yang belum bertanda | 3 |
| `getTokoUntukSync(kodeToko)` | **Selesai**: baru, menentukan toko yang ditarik dari `DB_Token` dan `TOKO_AKTIF` | 3 |
| `diagnosaToken()` | **Selesai**: baru, isi `DB_Token` seperti yang dibaca sistem | 3 |
| `mapBarisPesanan_(row)` | **Selesai**: menambah properti `toko` dari kolom Q | 4 |
| `barisSesuaiToko_(row, kode)` | **Selesai**: baru, satu tempat penyaring cakupan untuk semua pembaca | 4 |
| `hitungKondisiToken_(rec)` | **Selesai**: baru, kondisi token per toko | 4 |
| `getDashboardSummary(kodeToko)` | **Selesai**: statistik dan tabel mengikuti cakupan, sekaligus menyusun daftar toko beserta jumlah pesanannya | 4 |
| `getOrderRowsByStatus(kata, limit, kodeToko)` | **Selesai**: cakupan diterapkan sebelum penyaringan status | 4 |
| `getOrderRowsForExport(limit, kodeToko)` | **Selesai**: cakupan diterapkan saat memilih baris | 4 |
| `getStatusInventory(kodeToko)` | **Selesai**: pembacaannya naik ke 17 kolom agar kolom Q ikut tersaring | 4 |
| `logActivity(..., kodeToko)` | **Selesai**: argumen terakhir mengisi kolom Toko, dikerjakan bersama Fase 3 | 3 |

### 6.2 `gas/Code.js`

| Fungsi | Perubahan | Fase |
|---|---|---|
| `syncOrdersCore(days, isBackground, kodeToko)` | **Selesai**: tanpa kode toko, seluruh toko aktif ditarik berurutan dengan isolasi galat per toko | 3 |
| `syncOrdersBySnCore(orderSn, isBackground, kodeToko)` | **Selesai**: menelusuri seluruh toko aktif sampai pesanannya ketemu | 3 |
| `syncSatuToko_(rekaman, days, ui, urutan, total)` | **Selesai**: baru, penarikan satu toko dengan galat yang ditangkap sendiri | 3 |
| `rincianToko_(hasil, days)` | **Selesai**: baru, rincian diagnostik untuk dialog satu toko | 3 |
| `ringkasanSemuaToko_(hasil, days)` | **Selesai**: baru, ringkasan satu baris per toko | 3 |
| `cekIsiDbTokenPrompt()` | **Selesai**: baru, menu pemeriksa isi `DB_Token` | 3 |
| `tarikTokoTertentuPrompt()` | **Selesai**: baru, menu penarikan satu toko supaya dialog rinci beserta catatan API dapat dicapai | 3 |
| `catatanApi_(hasil)` | **Selesai**: baru, merangkum galat Shopee per toko untuk kotak dialog | 3 |
| `getDashboardData(forceRefresh, kodeToko)` | **Selesai**: meneruskan cakupan, cache diberi nomor generasi per cakupan | 4 |
| `kunciCacheDashboard_(cakupan)` | **Selesai**: baru, kunci cache per cakupan | 4 |
| `getDaftarToko()` | Tidak dibuat: daftar toko ikut di payload dashboard, lihat catatan Fase 4 | 4 |
| `automatedSyncTrigger(kodeToko)` | Terima kode toko agar dapat dipasang satu trigger per toko | 5 |
| `setupHourlyTrigger()` | Pasang satu trigger per toko aktif, dengan waktu bergeser | 5 |
| `invalidateDashboardCache()` | **Selesai**: menaikkan nomor generasi, sehingga seluruh cache cakupan ikut bersih | 4 |

Catatan penting untuk `invalidateDashboardCache()`: cache saat ini memakai satu kunci tetap. Dengan beberapa cakupan toko, satu kunci tunggal akan menyajikan data toko yang salah. Pilihannya: kunci cache memuat kode toko, atau cache dimatikan selama jumlah toko masih sedikit dan volumenya masih ringan.

### 6.3 `gas/ShopeeApi.js` dan middleware Vercel

Kedua bagian ini **tidak perlu diubah**, dan itu temuan yang menguntungkan karena keduanya berisi logika kriptografi yang paling berisiko bila disentuh.

| Berkas | Alasan tidak perlu diubah |
|---|---|
| `gas/ShopeeApi.js` | `request()` sudah meneruskan `x-shopee-shop-id` dari payload, dan `fetchDailyOrders()` serta `refreshToken()` sudah menerima token dan `shop_id` dari pemanggil |
| `middleware/src/lib/shopee.ts` | `createShopeeClient()` sudah menerima `partnerId`, `partnerKey`, `shopId`, `region`, dan `initialToken` sebagai argumen |
| `middleware/api/orders/daily.ts` | Sudah membaca `shop_id`, `access_token`, `refresh_token` dari payload, header, atau query |
| `middleware/api/auth/callback.ts` | Sudah membaca `shop_id` dari query, sehingga token tersimpan untuk toko yang benar |
| `middleware/api/auth/refresh.ts` | Sudah membaca `refresh_token` dan `shop_id` per permintaan |
| `middleware/api/auth/url.ts` | URL otorisasi tidak bergantung pada `shop_id`; toko ditentukan saat pengguna login |

Satu-satunya berkas middleware yang disentuh adalah `middleware/.env.example`, dan itu hanya perubahan komentar. Karena tidak ada perubahan runtime, **fitur ini tidak memerlukan deploy ulang Vercel.**

### 6.4 `gas/Index.html`

| Bagian | Perubahan | Fase |
|---|---|---|
| Bilah atas | Nama toko dan Shop ID dari data, bukan ditulis tetap | 4 |
| Pemilih toko | Baru, di panel kendali | 4 |
| Panel fokus dan strip angka | Label menyebut cakupan toko | 4 |
| Baris tabel | Penanda kode toko di kolom pertama, tampil hanya pada cakupan semua toko | 4 |
| Ekspor CSV | Tambah kolom Toko | 4 |
| Rekap PDF | Tambah kolom Toko | 4 |
| Tab token | Daftar seluruh toko beserta status token | 4 |
| `loadDashboard()` | Teruskan cakupan toko ke RPC, dan kosongkan cache per status saat cakupan berubah | 4 |

Yang **tidak** berubah di dashboard: filter status termasuk daftar status yang dibangun dari sheet, filter kurir, pencarian, urutan, pagination, aksi massal, pratinjau cetak slip, dan seluruh jalur ekspor PDF. Semuanya bekerja di dalam cakupan toko yang dipilih, tanpa perlu ditulis ulang.

---

## 7. Risiko dan Mitigasi

Diurutkan dari yang paling berbahaya.

| # | Risiko | Kapan muncul | Mitigasi |
|---|---|---|---|
| 1 | Token toko pertama tertimpa token toko kedua | Fase 2 | Kunci `shop_id`; uji khusus yang membandingkan token toko pertama sebelum dan sesudah (bagian 5, Fase 2 langkah 3) |
| 2 | Data dua toko saling menimpa saat sinkronisasi | Fase 3 | Kunci pencocokan memuat kode toko, SKU, dan variasi (bagian 3.6) |
| 3 | Status internal yang diubah manual tertimpa | Fase 3 | Perilaku pemeliharaan status yang ada dipertahankan, dan diuji ulang sebagai langkah verifikasi Fase 3 |
| 4 | Kolom tertukar akibat indeks bergeser | Fase 1 | Kolom baru ditambahkan di ujung, bukan disisipkan (bagian 3.3); enam titik berindeks dicatat di bagian 4.5 |
| 5 | Statistik dashboard salah cakupan | Fase 4 | Setiap angka menyebut cakupannya; kunci cache dibedakan per toko atau cache dimatikan |
| 6 | Pemanggilan melewati batas durasi | Fase 3 dan 5 | Satu toko per pemanggilan pada trigger; pilihan toko pada penarikan manual |
| 7 | Batas laju Shopee tercapai | Fase 3 | Sinkronisasi berurutan dengan jeda, bukan paralel |
| 8 | Baris lama menjadi data yatim karena kolom toko kosong | Fase 1 | Seluruh baris lama diisi kode toko default saat migrasi; baris tanpa kode toko dilaporkan, bukan diabaikan diam-diam |
| 9 | Kegagalan satu toko menghentikan seluruh penarikan | Fase 3 | Satu `try` per toko |
| 10 | Trigger ganda menjalankan sinkronisasi bersamaan | Fase 0 dan 5 | Matikan semua trigger sebelum migrasi, lalu pasang ulang satu per toko |
| 11 | `partner_key` ikut tersimpan di sheet | seluruh fase | Kredensial tetap hanya di Environment Variables Vercel (bagian 3.7) |
| 12 | Migrasi gagal di tengah jalan | seluruh fase | Setiap fase berhenti dalam keadaan berfungsi, dan ada salinan cadangan dari Fase 0 |

---

## 8. Uji Terima

Dijalankan setelah Fase 6. Seluruh butir harus lulus sebelum sistem dinyatakan siap multi-toko.

| # | Uji | Hasil yang diharapkan |
|---|---|---|
| 1 | `DB_Token` berisi dua baris dengan `shop_id` berbeda | Dua baris, tidak ada yang saling menimpa |
| 2 | Perbarui token toko kedua | Baris toko pertama tidak berubah |
| 3 | Tarik pesanan toko pertama saja | Hanya baris bertanda toko itu yang bertambah |
| 4 | Tarik pesanan toko kedua saja | Baris toko pertama tidak tersentuh |
| 5 | Tarik pesanan semua toko | Kedua toko bertambah, log berisi satu baris per toko |
| 6 | Ubah status internal satu baris secara manual, lalu tarik ulang | Status manual tidak kembali ke nilai semula |
| 7 | Satu pesanan dengan dua produk | Tetap menjadi dua baris, masing-masing dengan kode toko yang benar |
| 8 | Dashboard pada cakupan semua toko | Panel fokus memuat jumlah gabungan, dan labelnya menyebut semua toko |
| 9 | Dashboard pada cakupan satu toko | Angka panel fokus sama dengan hitungan manual di sheet untuk toko itu |
| 10 | Filter status pada cakupan satu toko | Hanya baris toko itu yang muncul |
| 11 | Ekspor CSV pada cakupan satu toko | Berkas memuat kolom Toko dan hanya berisi baris toko itu |
| 12 | Slip packing PDF pada cakupan semua toko | Mencetak slip dengan nomor pesanan yang benar |
| 13 | Buka detail pesanan dari toko kedua | Modal terbuka berisi data pesanan yang benar, bukan pesanan toko lain |
| 14 | Tab token | Menampilkan kedua toko beserta status token masing-masing |
| 15 | Token toko kedua dibuat kedaluwarsa | Dashboard menandai toko itu bermasalah tanpa mengganggu toko pertama |
| 16 | Trigger otomatis dijalankan | Kedua toko tersinkron, log memuat kolom Toko |
| 17 | Kolom A sampai P di sheet | Tidak ada yang bergeser, format Rupiah dan dropdown status tetap di kolomnya |
| 18 | Dashboard dibuka dari sidebar dan dari Web App | Keduanya menampilkan data yang sama |

---

## 9. Yang Tidak Berubah

Daftar ini sengaja ditulis agar batas pekerjaan jelas dan tidak melebar saat implementasi.

1. **Bukan multi-marketplace.** Hanya Shopee. TikTok Shop, Tokopedia, dan lainnya memerlukan lapisan adapter per penyedia dan berada di luar lingkup ini.
2. **Bukan multi-app.** Hanya satu `partner_id` dan satu `partner_key`. Bila kelak ada toko milik entitas usaha lain, itu app kedua dan perlu dokumen tersendiri.
3. **Tidak memisahkan sheet per toko.** Satu sheet `Pesanan Masuk` dengan kolom Toko. Alasannya, pemisahan sheet menggandakan setiap fungsi pembaca dan membuat rekap lintas toko menjadi pekerjaan tersendiri.
4. **Tidak menyimpan `partner_key` di sheet.** Sudah dijelaskan di bagian 3.7.
5. **Tidak mengubah middleware Vercel.** Sudah dijelaskan di bagian 6.3.
6. **Tidak mengubah alur cetak slip dan ekspor PDF yang sudah ada.** Keduanya hanya ikut memuat kolom Toko.
7. **Tidak mengubah mekanisme self-healing token.** Auto-refresh saat sinkronisasi tetap berjalan; yang berubah hanya bahwa token yang diperbarui adalah token toko yang sedang diproses.
8. **Tidak menghapus token toko yang tidak dipakai.** Toko yang berhenti dipakai cukup ditandai `Aktif = TIDAK`, sehingga riwayatnya tetap utuh dan dapat diaktifkan kembali.

---

## 10. Pertanyaan yang Perlu Dijawab

### Sudah terjawab

| # | Pertanyaan | Jawaban | Dampak |
|---|---|---|---|
| 1 | Apakah app Shopee boleh diotorisasi lebih dari satu toko? | Boleh | Gerbang utama terbuka, sehingga Fase 2 sampai 6 berlaku |
| 2 | Berapa toko yang akan dikelola? | Lebih dari dua | Desain memakai perulangan untuk N toko, bukan pasangan dua toko yang ditulis khusus. Fase 5 menjadi penting karena durasi eksekusi bertambah seiring jumlah toko |
| 3 | Nama kolom F | `Ringkasan Produk` | Daftar header disatukan menjadi satu konstanta, dan dokumen diperbaiki mengikuti nama ini |

### Masih terbuka

| # | Pertanyaan | Mengapa penting | Menghambat fase |
|---|---|---|---|
| 4 | Apa kode dan nama tiap toko? | Kode toko masuk ke kolom Q dan ke label dashboard | Fase 1 dan 3 sudah selesai tanpa ini, tetapi kolom Q baru terisi setelah Anda mengisi kolom J di `DB_Token` |
| 5 | Apakah semua toko berada di satu region Shopee? | Satu app hanya melayani satu region | Fase 0 |
| 6 | Berapa batas durasi fungsi Vercel pada paket yang dipakai? | Menentukan berapa toko yang aman diproses dalam satu pemanggilan | Angka ini diperlukan untuk Fase 5 |
| 7 | Apakah panel fokus dashboard pada cakupan semua toko menampilkan gabungan, atau per toko? | Menentukan bentuk panel fokus | Fase 4 |
| 8 | Nama kolom I: `Total Qty` atau `Qty`? | Tampil pada baris header sheet | Sudah dipilih `Total Qty` mengikuti `initAllSheets`. Satu baris untuk diubah bila Anda lebih suka `Qty` |

Dua pertanyaan dari daftar lama terjawab oleh implementasi, bukan oleh jawaban lisan: penarikan manual kini menyediakan pilihan toko lewat parameter `kodeToko`, dan kode toko memang tersimpan di kolom Q karena itulah yang membuat pencocokan baris per toko mungkin.

---

Berkas yang dirujuk pada dokumen ini: `gas/Code.js`, `gas/SheetManager.js`, `gas/ShopeeApi.js`, `gas/Index.html`, serta berkas di dalam `middleware/src` dan `middleware/api`. Nomor dan nama fungsi merujuk pada isi berkas tersebut saat dokumen ini disusun, dan perlu diperiksa ulang bila berkasnya berubah.








