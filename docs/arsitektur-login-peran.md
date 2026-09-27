# Arsitektur Login & Pembatasan Peran (ERP Begood)

Dokumen ini merancang masuk dan pembatasan hak di Web Dashboard ERP Begood untuk tiga peran: **superadmin**, **admin**, dan **packing**. Isinya menjelaskan apa yang benar-benar mengamankan, apa yang hanya terlihat mengamankan, dan urutan pengerjaannya.

Status: **Fase 1 dan 2 selesai diimplementasikan.** Fase 3 sampai 5 belum dikerjakan. Penolakan peran belum berlaku sampai `WAJIB_LOGIN` diubah menjadi `YA`.

| Fase | Isi | Status |
|---|---|---|
| 1 | Sheet `Pengguna`, penyandian sandi, sesi di server, kolom `Pengguna` pada log | **Selesai** |
| 2 | Penjaga di setiap RPC, halaman masuk, tombol keluar | **Selesai** |
| 3 | Aturan per peran, misalnya packing hanya boleh memindahkan `[1]` ke `[2]` | Menunggu |
| 4 | Tampilan menyesuaikan peran, dan layar kelola pengguna | Menunggu |
| 5 | Pembatasan percobaan, uji kedaluwarsa, dan pemeriksaan jejak audit | Menunggu |

---

## 1. Mengapa halaman masuk saja tidak mengamankan apa pun

Halaman masuk di dalam Apps Script mudah dibuat, dan justru karena itu berbahaya: hasilnya terlihat aman padahal tidak.

Dua sebabnya:

1. **Sumber halaman dapat dibaca siapa saja yang dapat membukanya.** Kata sandi yang ditulis atau diperiksa di sisi peramban dapat ditemukan dengan membuka sumber halaman.
2. **Setiap fungsi server dapat dipanggil langsung.** Dashboard berbicara ke server lewat `google.script.run`. Siapa pun yang dapat memuat halaman itu dapat memanggil fungsi yang sama tanpa melewati halaman masuk, tanpa menekan tombol apa pun.

Pemeriksaan di sisi peramban karena itu hanya mengatur tampilan. Ia berguna supaya staf tidak melihat tombol yang bukan haknya, tetapi ia bukan pengaman.

Yang membuatnya nyata ada dua syarat, dan keduanya harus ada:

| Syarat | Artinya |
|---|---|
| Server tahu siapa pemanggilnya | Identitas ditentukan di server, bukan dikirim oleh peramban. Peran tidak boleh ikut dari peramban karena dapat diubah siapa saja |
| Setiap fungsi menolak sendiri | Setiap RPC memeriksa sesi dan peran di baris pertamanya, sebelum membaca data apa pun. Menolak berarti tidak ada data yang terkirim, bukan sekadar kosong di layar |

### 1.1 Login tidak menutup pintu yang sudah terbuka

Ada batas yang tidak dapat dilewati halaman masuk: **orang yang sudah punya akses edit ke spreadsheet dapat membuka `DB_Token` dan `Pesanan Masuk` langsung**, termasuk token Shopee. Bila staf sekarang sudah diberi akses ke spreadsheet, halaman masuk tidak menutup pintu itu.

Pintu itu hanya tertutup dengan berhenti membagikan spreadsheet kepada mereka, dan menjadikan dashboard satu-satunya jalan masuk.

Konsekuensi yang mengikuti keputusan itu: **`Pengguna` harus berada di spreadsheet yang tidak dibagikan ke staf.** Kalau tidak, staf dapat mengubah perannya sendiri di sheet, dan seluruh pembatasan kehilangan artinya.

### 1.2 Pintu masuk menentukan arti login

Dashboard dapat dibuka lewat tiga jalan, dan arti login berbeda di masing-masing jalan:

| Jalan masuk | Siapa yang sudah lolos sebelum sampai dashboard | Arti login di sini |
|---|---|---|
| Menu spreadsheet (sidebar atau modal) | Hanya orang yang punya akses ke spreadsheet | Memisahkan peran, bukan menahan orang luar |
| Tautan Web App dengan akses terbatas | Tergantung pengaturan akses deployment | Pengaman yang sebenarnya |
| Tautan Web App dengan akses `Anyone` | Siapa saja yang punya tautannya | Hanya halaman masuk yang berdiri di depan |

Karena itu pengaturan akses deployment harus ditentukan lebih dulu, dan tidak boleh diserahkan pada halaman masuk saja.

---

## 2. Identitas pemanggil di Apps Script

Sebelum memilih rancangan, perlu dipastikan apa yang dapat diketahui server tentang pemanggilnya.

| Cara | Ketersediaan | Catatan |
|---|---|---|
| `Session.getActiveUser().getEmail()` | Kadang kosong | Bergantung pengaturan deployment dan domain pemanggil. Butuh izin email pada manifest |
| `Session.getEffectiveUser().getEmail()` | Selalu terisi | Email pemilik skrip, bukan email pemanggil. Karena itu tidak dapat dipakai membedakan orang |
| `Session.getTemporaryActiveUserKey()` | Selalu ada | Tidak butuh izin tambahan, tetapi kuncinya berganti sekitar sebulan sekali, sehingga tidak cocok menjadi identitas tetap |

Email pemanggil hanya terbaca bila Web App **dijalankan atas nama pemilik** dan pemanggilnya berada **di domain Google yang sama** dengan pemilik skrip. Bila pemanggil memakai Gmail pribadi, emailnya kembali kosong.

Ada perangkap di sini. Agar email pemanggil terbaca, deployment dapat diubah menjadi **atas nama pengguna**. Tetapi pilihan itu membuat skrip berjalan dengan izin pengguna, sehingga setiap pengguna membutuhkan akses ke spreadsheet, dan token Shopee ikut terlihat. Untuk kebutuhan ini, itu pertukaran yang merugikan.

Karena itu urutan yang dipakai:

1. **Tetap jalankan atas nama pemilik**, supaya staf tidak pernah menyentuh spreadsheet.
2. **Jadikan email sebagai jalan pintas**, bukan satu-satunya jalan. Bila terbaca dan emailnya terdaftar, pengguna masuk tanpa sandi.
3. **Jadikan kode dan sandi sebagai jalur utama**, karena jalur itu bekerja tanpa akun Google dan tanpa akses spreadsheet.

Untuk memastikan keadaan sebenarnya, jalankan menu **Periksa Identitas Pemanggil**. Pemeriksaan itu harus dilakukan **oleh orang selain pemilik** lewat tautan Web App, karena dari menu spreadsheet yang terbaca adalah identitas pemiliknya.

---

## 3. Keputusan yang diambil

Rancangan yang dipilih adalah **gabungan**:

| Jalur | Siapa | Cara kerja |
|---|---|---|
| Email akun Google | Admin dan superadmin | Bila server mengenali email pemanggil dan emailnya terdaftar, sesi dibuat tanpa sandi |
| Kode dan sandi | Packing, dan siapa pun bila email tidak terbaca | Formulir masuk, diperiksa di server terhadap hash di sheet `Pengguna` |

Alasan memilih gabungan:

1. **Packing tidak perlu akun Google.** Di lantai gudang, perangkat sering dipakai bersama dan akun pribadi tidak praktis.
2. **Admin memperoleh kenyamanan bila syaratnya terpenuhi.** Bila email terbaca, admin tidak perlu mengetik sandi.
3. **Kegagalan jalur email tidak mengunci siapa pun.** Bila email tidak terbaca, halaman masuk menampilkan formulir kode dan sandi, dan pekerjaan tetap berjalan.

Yang **tidak** dilakukan, beserta alasannya:

| Tidak dilakukan | Alasan |
|---|---|
| Menyimpan sandi apa adanya | Isi sheet dapat terbaca orang lain, dan sandi yang sama sering dipakai ulang di tempat lain |
| Mempercayai peran yang dikirim peramban | Peramban dapat diubah siapa saja. Peran selalu dibaca dari sesi di server |
| Menjalankan deployment atas nama pengguna | Membuat setiap staf butuh akses spreadsheet, dan token Shopee ikut terlihat |
| Memakai PIN empat angka | Hanya 10.000 kemungkinan. Panjang minimum ditetapkan enam karakter |
| Menyimpan sesi di sheet | Sesi bersifat sementara. Menyimpannya di sheet menambah penulisan pada setiap permintaan tanpa manfaat |

---

## 4. Peran dan haknya

Tiga peran, dengan urutan hak yang dipakai untuk membandingkan, bukan untuk ditampilkan:

| Peran | Peringkat | Peruntukan |
|---|---|---|
| `PACKING` | 1 | Staf gudang di perangkat bersama |
| `ADMIN` | 2 | Staf administrasi dan operasional |
| `SUPERADMIN` | 3 | Pemilik sistem |

Pembagian hak yang berlaku sekarang:

| Kemampuan | Superadmin | Admin | Packing |
|---|---|---|---|
| Lihat pesanan | Ya | Ya, tanpa nominal | Ya, tanpa nominal |
| Lihat nominal uang: omzet, total belanja, ongkir, upah produksi, urutan berdasarkan nominal | Ya | Tidak | Tidak |
| Lihat antrian produksi dan estimasi kerja | Ya | Ya | Ya |
| Tarik antrian produksi, simpan harga proses, simpan hasil jahit | Ya | Ya | Tidak |
| Ubah status internal | Semua nilai | Semua nilai | Hanya `[1]` ke `[2]` |
| Cetak slip dan label | Ya | Ya | Ya |
| Ekspor CSV dan rekap PDF | Ya | Ya | Tidak |
| Tarik pesanan dari Shopee | Ya | Ya | Tidak |
| Tab token dan konfigurasi | Ya | Tidak | Tidak |
| Otorisasi Shopee, refresh token | Ya | Tidak | Tidak |
| Trigger otomatis | Ya | Tidak | Tidak |
| Inisialisasi atau reset sheet | Ya | Tidak | Tidak |
| Kelola pengguna dan peran | Ya | Tidak | Tidak |

Dua aturan yang menyertai tabel itu:

1. **Menyembunyikan tombol bukan keamanan.** Tampilan disembunyikan supaya staf tidak bingung, dan server tetap menolak. Keduanya dikerjakan, bukan salah satu.
2. **Peringkat dipakai untuk membandingkan, bukan untuk menaikkan.** Aksi yang membutuhkan `ADMIN` boleh dijalankan `SUPERADMIN` karena peringkatnya lebih tinggi. Sebaliknya tidak.
3. **Nominal uang dipotong di server, bukan disembunyikan di peramban.** Peran di bawah superadmin tidak menerima kolom nominal sama sekali, sehingga membuka konsol peramban tidak menampakkan apa pun. Rinciannya di bagian 7.1.

#### 4.1 Yang tidak boleh ditulis sebagai nol

Angka yang tidak dikirim tidak ditulis sebagai `Rp 0`. Nol berarti nilai pesanannya nol, dan itu keterangan yang berbeda artinya dari disembunyikan. Karena itu tempat yang kosong dibiarkan kosong, dan kartu omzet hilang seluruhnya dari layar, bukan menampilkan nol.

---

## 5. Penyimpanan sandi

Yang tersimpan di sheet hanya hasil hitungan, bukan sandinya:

| Nilai | Isi |
|---|---|
| `Sandi (hash)` | Hasil HMAC-SHA256 atas sandi, diulang 1000 kali, dengan salt sebagai kuncinya |
| `Sandi (salt)` | 24 karakter acak, dibuat ulang setiap kali sandi diganti, dan berbeda untuk setiap pengguna |

Tiga keputusan di dalamnya, beserta harga yang harus diterima:

1. **Salt per pengguna.** Tanpa salt, dua orang bersandi sama akan punya hash sama, sehingga satu tabel tebakan dapat membuka banyak akun sekaligus. Dengan salt, hasilnya berbeda walau sandinya sama.
2. **Pengulangan 1000 kali.** Aplikasi Script terlalu lambat untuk PBKDF2 sungguhan pada batas waktu eksekusi yang berlaku, sehingga jumlah putaran dibatasi. Karena itu **panjang minimum sandi ditetapkan enam karakter**, bukan empat. Untuk PIN di lantai gudang, enam angka berarti sejuta kemungkinan, dan itu hanya berarti bila pembatasan percobaan ikut bekerja.
3. **Sandi tidak pernah dibandingkan langsung.** Keduanya dihitung lebih dulu, lalu hasilnya dibandingkan.

Yang tidak dapat dijanjikan, dan sebaiknya diketahui:

| Batas | Akibatnya |
|---|---|
| Tidak ada perbandingan yang benar-benar bebas waktu | Perbedaan waktu pembandingan ada, tetapi jitter jaringan jauh lebih besar daripada selisihnya, sehingga tidak dapat dipakai menebak |
| Hash tidak dirancang lambat seperti PBKDF2 | Bila isi sheet terbaca, menebak sandi lebih mudah daripada di sistem yang memakai PBKDF2. Karena itu isi sheet tidak boleh terbaca siapa pun |
| Tidak ada masa berlaku sandi | Sandi hanya berganti bila diubah manual |

---

## 6. Sesi

Sesi diciptakan di server dan disimpan di cache server, bukan di sheet dan bukan di peramban.

| Aspek | Keputusan | Alasan |
|---|---|---|
| Bentuk | Token acak sepanjang 40 karakter | Tidak memuat data apa pun, sehingga tidak dapat dibaca maupun diubah |
| Penyimpanan | `CacheService` dengan masa berlaku 6 jam | Enam jam adalah batas maksimum cache, dan sekaligus batas satu giliran kerja |
| Isi sesi | Kode, nama, peran, dan waktu masuk | Peran dibaca dari sini, bukan dari peramban |
| Kedaluwarsa | Dihapus sendiri oleh cache | Bila cache dibersihkan lebih awal, pengguna cukup masuk lagi |
| Keluar | Token dihapus di server | Salinan yang masih tertinggal di peramban tidak dapat dipakai lagi |
| Yang disimpan peramban | Hanya tokennya | Peran tidak disimpan di peramban, sehingga tidak ada yang bisa dinaikkan dari sana |
| Daftar token per pengguna | Cache, pada kunci per kode pengguna | Satu-satunya cara menemukan sesi seseorang ketika perannya berubah atau akunnya dinonaktifkan. Ditambahkan di Fase 4 |
| Pemutusan sesi | Seluruh token orang itu dihapus | Perubahan hak berlaku saat itu juga, bukan menunggu sesinya berakhir sendiri |

Konsekuensi yang perlu diketahui: karena sesi disimpan di cache dan bukan di sheet, **tidak ada riwayat sesi**. Yang tercatat hanya peristiwa masuk dan keluar di `Log_Aktivitas`. Kemampuan memutus sesi orang lain sudah ada sejak Fase 4, tetapi hanya sebagai bagian dari perubahan hak. Memutus sesi tanpa mengubah haknya, misalnya sebuah tombol yang mengeluarkan semua perangkat, belum ada.

---

## 7. Penjaga di server

Satu fungsi penjaga dipakai semua RPC, supaya aturannya hanya ditulis di satu tempat.

```text
wajibSesi_(token, peranMinimal)
```

Aturannya:

1. **Dipanggil di baris pertama setiap RPC** yang menyentuh data pesanan, sebelum satu baris sheet pun dibaca.
2. **Token yang tidak berlaku langsung ditolak**, dengan pesan yang menyuruh masuk ulang.
3. **Peran dibandingkan memakai peringkat.** `PACKING` tidak dapat memanggil aksi yang membutuhkan `ADMIN`.
4. **Peran diambil dari sesi server**, bukan dari argumen yang dikirim peramban.

### 7.1 Pembatasan data keuangan

Nominal uang hanya dikirim kepada `SUPERADMIN`. Yang dipotong, pada setiap RPC yang mengirim baris pesanan:

| Yang dipotong | Ada di |
|---|---|
| `stats.totalRevenue` | ringkasan dashboard, sumber kartu omzet dan AOV |
| `orders[].totalAmount` dan `orders[].shippingFee` | setiap baris pesanan, sumber kolom Total, modal detail, CSV, dan rekap PDF |
| `seriHarian[].omzet` | seri grafik harian, sumber lencana arah omzet |
| Kolom nominal pada ekspor | CSV tabel dan rekap PDF disusun tanpa kolom itu untuk peran selain superadmin |

Tiga hal yang menyertainya:

1. **Payload dashboard tetap disimpan utuh di cache.** Pemotongan dilakukan saat jawabannya keluar, bukan saat menyimpan. Kalau yang disimpan justru versi yang sudah dipotong, superadmin yang membaca sesudahnya akan ikut kehilangan angkanya. Ada ujinya.
2. **Urutan berdasarkan nominal ikut dibuang**, karena mengurutkan daftar berdasarkan nominal tetap membocorkan peringkat nilainya walaupun angkanya tidak tampil.
3. **Yang tidak keuangan tetap utuh**: jumlah barang, nomor resi, ekspedisi, kota, dan status. Itu yang dipakai bekerja.

### 7.2 Peran pada modul produksi jahit

Modul produksi menambah empat RPC, dan pembagian perannya berbeda dari modul pesanan: membaca terbuka untuk semua peran, menulis hanya `ADMIN`.

| RPC | Peran terendah |
|---|---|
| `getAntrianProduksi()` | `PACKING` |
| `getProduksiRingkasan()` | `PACKING` |
| `simpanProduksiBatch()` | `ADMIN` |
| `saveHargaProses()` | `ADMIN` |

Nominal upah dipotong dengan cara yang sama seperti nominal pesanan: `PACKING` dan `ADMIN` tetap menerima jumlah pcs dan menit kerja, tetapi tidak menerima rupiah. Yang dipotong adalah `total.upah`, `sesi.*.upah`, `penjahit[].upah`, `penjahit[].sesi.*.upah`, `items[].upah`, dan `items[].hargaSatuan`, lalu jawabannya ditandai `uangDisembunyikan`.

Rancangan modulnya ada di `docs/panduan-adaptasi-data-jahit-data-proses.md`, dan skema kedua sheetnya di `docs/struktur-spreadsheet.md` bagian 8 dan 9.

Selama `WAJIB_LOGIN` masih `TIDAK`, penjaga ini belum bekerja sepenuhnya, karena `wajibSesi_()` meloloskan semua permintaan tanpa mengenali perannya. Pada mode uji, yang berlaku hanya penyembunyian di layar, dan itu bukan pengaman. Pemotongan yang sesungguhnya mulai berlaku bersama `WAJIB_LOGIN` bernilai `YA`.

Daftar pasti RPC yang wajib dijaga, beserta peran terendah masing-masing, dicatat di Fase 2.

---

### 7.3 Peran pada modul pembagian jahit

Modul pembagian jahit menentukan siapa mengerjakan apa dan berapa upahnya, jadi
batasnya diletakkan di antara keduanya: pekerjaannya boleh dibaca siapa saja yang
mengerjakannya, sedangkan nominal upahnya hanya untuk superadmin.

| RPC | Peran terendah | Alasan |
|---|---|---|
| `getPembagianJahit()` | `PACKING` | Isinya mengatur pekerjaan: pcs, penjahit, dan grup |
| `bagiPembagianDashboard()` | `ADMIN` | Membagi pekerjaan menentukan siapa dibayar berapa |
| `tutupSesiJahit()` | `ADMIN` | Menutup satu sesi kerja: bagi, isi harga yang kosong, lalu simpan hasilnya ke `DATA JAHIT` — satu langkah yang sama-sama menentukan upah |
| `simpanPenjahitDashboard()` | `ADMIN` | Mengubah siapa yang menerima pekerjaan |
| `simpanAturanDashboard()` | `ADMIN` | Mengubah grup pekerjaan, yang menentukan pembagiannya |

Yang dipotong untuk peran di bawah superadmin: upah, target, dan selisih tiap
penjahit; upah per grup dan per toko; total upah, selisih, dan rata-ratanya; serta
harga satuan dan harga total tiap baris. Jumlah pcs, bobot, jumlah order, dan jumlah SKU tetap
terkirim, karena itulah yang dipakai mengatur beban kerja.

Pemotongannya dilakukan di server oleh `tanpaUangBagi_()`, bukan sekadar
disembunyikan di halaman. Halaman menyembunyikan sel nominalnya sebagai lapis
kedua agar tidak ada kolom kosong yang membingungkan, tetapi jawaban RPC tetap
dapat dibaca siapa saja yang membuka konsol peramban.

Setiap kali pembagian dijalankan, jejaknya dicatat ke `Log_Aktivitas` dengan aksi
`PRODUKSI_BAGI_JAHIT`, jumlah pcs, kode toko sebagai penanda, dan kode pengguna
pelakunya. Pembagian menentukan upah, jadi jejaknya harus dapat ditelusuri.

Rincian modulnya ada di [docs/pembagian-jahit.md](file:///Users/macbook/Documents/ERP%20Begood/docs/pembagian-jahit.md).

## 8. Rencana bertahap

Urutan ini disengaja. Halaman masuk dikerjakan di Fase 2, **setelah** penjaga di server, karena halaman masuk tanpa penjaga hanya menghasilkan rasa aman yang palsu.

### Fase 1: Pengguna, sandi, sesi, dan jejak siapa

**Status: selesai diimplementasikan.** Fase ini tidak menolak apa pun, sehingga tidak ada yang rusak bagi pengguna yang sedang bekerja hari ini.

| Berkas | Yang berubah |
|---|---|
| `gas/SheetManager.js` | Sheet `Pengguna` beserta `PENGGUNA_HEADERS`; `LOG_HEADERS` menjadi satu daftar bersama; `acakSalt_()`, `hashSandi_()`, `sandiCocok_()`; `getPenggunaRecords()`, `getPenggunaByKode()`, `getPenggunaByEmail()`, `simpanPengguna()`, `catatMasuk()`, `hitungPenggunaAktif()`, `periksaSandi()`; `logActivity()` menerima kolom Pengguna |
| `gas/Code.js` | `buatSesi_()`, `sesiDariToken_()`, `wajibSesi_()`; RPC `masukDenganEmail()`, `masukDenganKode()`, `keluarSesi()`, `siapaSaya()`; menu **Buat Akun Superadmin Pertama**, **Lihat Daftar Pengguna**, dan **Periksa Identitas Pemanggil** |
| `gas/Index.html` | Kolom Pengguna pada tabel riwayat aktivitas |

Keputusan pelengkap saat implementasi:

| Hal | Keputusan | Alasan |
|---|---|---|
| Pemeriksaan sandi | Berada di dalam `SheetManager`, tidak diekspos | Hash dan salt tidak pernah keluar dari modul itu. Pemanggil di luar hanya menerima ya atau tidak |
| Mengganti nama atau peran | Tidak menyentuh kolom sandi | Perubahan administratif tidak memaksa pengguna mengganti sandinya |
| Waktu Dibuat dan Terakhir Masuk | Dipertahankan saat penyimpanan | Mengubah peran tidak menghapus riwayat kapan akun dibuat dan kapan terakhir dipakai |
| Membuat akun superadmin | Lewat menu, bukan otomatis | Sheet `Pengguna` tetap kosong sampai pemilik sengaja mengisinya. Menunya juga menolak berjalan bila superadmin aktif sudah ada |
| Kegagalan pemeriksaan identitas | Dikumpulkan, bukan dilempar | Satu sistem yang menolak tidak menghalangi bagian lain melaporkan keadaannya |
| Salinan peramban | Hanya token, tanpa peran | Peran tidak dapat dinaikkan dari peramban karena tidak pernah disimpan di sana |
| Alur pembuatan akun | Tiga kotak isian terpisah, lalu akun dibaca ulang dari sheet | Satu isian berpemisah membuat kegagalan tidak jelas. Pembacaan ulang memastikan akunnya benar-benar tersimpan sebelum pengguna diberi tahu |
| Diagnosa isi sheet | Menu daftar pengguna selalu melaporkan header, apakah headernya sesuai, dan kode yang terbaca | Bila akun tidak muncul, penyebabnya terlihat langsung, bukan ditebak |
| Header sheet | Ditulis lebih dulu oleh **setiap** fungsi yang menambah baris | Sheet yang lahir mendadak dari penulisan data tidak punya baris header, sehingga datanya masuk ke baris 1 dan pembacaan berikutnya tidak menemukan apa pun |

Verifikasi yang sudah dijalankan, dengan spreadsheet tiruan dan perhitungan hash yang sungguhan:

| Uji | Hasil |
|---|---|
| Sheet `Pengguna` dibuat dengan 9 kolom, `Log_Aktivitas` menjadi 7 kolom | Lulus |
| Sandi asli tidak muncul di sheet sama sekali, yang tersimpan hash 32 byte | Lulus |
| Salt berbeda per pengguna, dan sandi yang sama menghasilkan hash berbeda | Lulus |
| Sandi salah, kode tidak dikenal, dan akun tidak aktif ditolak | Lulus |
| Sandi baru membuat sandi lama tidak berlaku lagi | Lulus |
| Menyimpan tanpa sandi mempertahankan hash lama, waktu dibuat, dan waktu masuk | Lulus |
| Daftar pengguna tidak memuat hash maupun salt | Lulus |
| Token sesi berlaku, dan token yang tidak dikenal ditolak | Lulus |
| Penjaga menolak peran yang kurang, dan menerima peran yang lebih tinggi | Lulus |
| Masuk berhasil mencatat pelakunya di `Log_Aktivitas` | Lulus |
| Lima kali gagal mengunci kode itu, tanpa mengunci kode lain | Lulus |
| Email tidak terbaca, belum terdaftar, dan akun tidak aktif menghasilkan alasan yang berbeda | Lulus |
| Keluar menghapus sesi di server, sehingga token lamanya tidak berlaku lagi | Lulus |
| Alur menu pembuatan superadmin: penjaga, tiga isian, pembacaan ulang, dan penolakan isian kosong | Lulus |
| Diagnosa isi sheet melaporkan header, kecocokan header, dan kode yang benar-benar terbaca | Lulus |
| Sheet `Pengguna` tanpa baris header diperbaiki sendiri, dan akun yang sudah ada diperbarui di tempat tanpa duplikasi | Lulus |
| Ketiga penulis baris (Pengguna, DB_Token, Log) menulis header lebih dulu pada sheet kosong | Lulus |

Selama pengerjaan, empat hal tertangkap dan sudah diperbaiki:

1. **Koma pemisah metode yang hilang** di `SheetManager.js`, sehingga berkasnya gagal dimuat sama sekali. Ini terjadi **dua kali**, keduanya saat menyisipkan metode baru ke dalam objek yang sudah ada. Sejak kejadian itu, pemeriksaan sintaks dijalankan sebelum uji, bukan sesudah.
2. **`Utilities.computeHmacSha256Signature` menolak argumen dengan tipe berbeda.** Kode awal mengirim `Byte[]` sebagai nilai dan `String` sebagai kunci, dan Apps Script menolaknya saat berjalan dengan pesan "parameter tidak cocok dengan tanda tangan metode". Yang diterima hanya pasangan yang tipenya sama: `(String, String)` atau `(Byte[], Byte[])`. Sekarang kunci dan nilai sama-sama diubah menjadi `Byte[]` lebih dulu, dan hasil tiap putaran tetap `Byte[]`, sehingga tidak ada pengubahan tipe di tengah jalan.
3. **Satu uji lama masih mengharapkan `Log_Aktivitas` 6 kolom**, padahal sekarang 7 karena kolom Pengguna. Ekspektasi ujinya diperbarui, kodenya tidak diubah.
4. **Kode menghitung hash dua kali** dengan salt berbeda di antaranya, di `simpanPengguna`.
5. **Alur pembuatan akun yang mudah gagal.** Menu pertama kali meminta kode, nama, dan sandi dalam **satu baris berpemisah tanda pipa**. Satu isian yang salah bentuk membuat penyimpanan tidak terjadi, dan pesannya tidak menjelaskan bagian mana yang salah. Sekarang menu memakai **tiga kotak isian terpisah**, menyebutkan bagian yang kosong satu per satu, dan **membaca ulang akun dari sheet** setelah menyimpan. Bila penulisan berhasil tetapi pembacaan tidak menemukannya, itu dilaporkan saat itu juga.

6. **Tiga fungsi menambah baris tanpa memastikan header ada.** `saveTokenRecord()`, `logActivity()`, dan `simpanPengguna()` semuanya memakai `appendRow()`, dan semuanya memakai sheet yang dibuat mendadak bila belum ada. Pada sheet yang baru lahir, `appendRow()` menulis ke **baris 1**, sehingga datanya menempati tempat header. Akibatnya pembacaan berikutnya yang mulai dari baris 2 tidak menemukan apa pun, dan dari luar tampak seperti "data tidak tersimpan". Penolong `tulisHeader_()` sudah ada dan sudah menangani keadaan itu, termasuk menggeser baris data ke bawah, tetapi hanya dipanggil dari inisialisasi. Sekarang ketiga fungsi itu memanggilnya lebih dulu.

7. **Menyunting pengguna diam-diam mengaktifkan kembali akun yang sudah dinonaktifkan.** `simpanPengguna()` menganggap kolom `Aktif` yang tidak dikirim sebagai `YA`, sehingga mengganti nama atau peran seorang mantan pegawai akan menghidupkan kembali aksesnya. Sekarang nilainya dipertahankan bila tidak dikirim, sama seperti kolom `Dibuat` dan `Terakhir Masuk`.

Pelajaran dari hal nomor 7, yang berlaku umum: **nilai yang tidak dikirim harus dipertahankan, bukan diisi dengan nilai bawaan.** Mengisi bawaan pada kolom yang menyangkut hak akses berarti keputusan yang tidak pernah diambil tetap dianggap sudah diambil.

Pelajaran dari hal nomor 6: **setiap fungsi yang menambah baris harus memastikan baris headernya ada lebih dulu.** Mengharapkan pengguna menjalankan inisialisasi sebelum memakai fitur bukan pengaman, karena urutan pemakaian tidak dapat dipaksakan.

Pelajaran dari hal nomor 2, yang berlaku untuk pekerjaan berikutnya: **mock harus mengikuti batasan nyata platform, bukan dugaan penulisnya.** Mock uji awal menerima campuran tipe, sehingga uji lulus padahal gagal di Apps Script. Setelah mock diperketat agar menolak tipe yang tidak sepasang, ia menghasilkan pesan galat yang sama persis dengan yang muncul di Apps Script, dan bug itu tidak dapat lolos lagi.

Pelajaran dari hal nomor 5, yang juga berlaku umum: **jangan menuntut pengguna mengingat format.** Satu kotak isian dengan pemisah buatan memindahkan beban ingatan ke pengguna, dan bila salah, kegagalannya samar. Lebih baik beberapa kotak terpisah yang masing-masing menjelaskan dirinya.

#### Verifikasi yang perlu Anda jalankan sendiri

1. Tempel ulang `gas/SheetManager.js`, `gas/Code.js`, dan `gas/Index.html`, lalu jalankan **Inisialisasi / Reset Tabel Sheet**.
2. Periksa muncul sheet baru bernama `Pengguna` dengan 9 kolom.
3. Jalankan **Buat Akun Superadmin Pertama**. Menu meminta **tiga isian terpisah**: kode, nama, lalu sandi. Isi satu per satu. Bila sheet `Pengguna` sebelumnya lahir tanpa baris header, fungsi ini menuliskan headernya lebih dulu dan menggeser baris data yang ada ke bawah, tanpa menghapusnya.
4. Setelah menekan OK pada isian ketiga, akan muncul pesan yang menyebut **nomor baris tempat akun disimpan**. Pesan itu juga berarti akunnya sudah dibaca ulang dari sheet dan ditemukan.
5. Jalankan **Lihat Daftar Pengguna**, lalu pastikan akun itu muncul, dan periksa bagian bawah pesannya: **jumlah baris terpakai, header, dan kode pada kolom A**. Inilah yang dilihat sistem.
6. Buka sheet `Pengguna`, lalu pastikan kolom `Sandi (hash)` tidak berisi sandi yang Anda ketik.
7. Jalankan **Periksa Identitas Pemanggil** dari menu, lalu ulangi dari tautan Web App dengan akun admin, dan kirimkan kedua hasilnya.

### Fase 2: Penjaga dan halaman masuk

**Status: selesai diimplementasikan.** Penolakan belum berlaku sampai `WAJIB_LOGIN` diubah menjadi `YA`, sehingga fase ini dapat diuji tanpa risiko mengunci siapa pun.

| Berkas | Yang berubah |
|---|---|
| `gas/SheetManager.js` | Parameter `WAJIB_LOGIN` pada sheet `Konfigurasi`, bawaan `TIDAK` |
| `gas/Code.js` | `modeWajibLogin_()`; cabang mode uji pada `wajibSesi_()`; tiga belas RPC menerima `token` sebagai argumen pertama dan memanggil `wajibSesi_`; pelaku perubahan status ikut dicatat di `Log_Aktivitas` |
| `gas/Index.html` | Layar masuk beserta formulir kode dan sandi; pemeriksaan sesi tersimpan; percobaan masuk lewat email; tombol keluar dan identitas pengguna di bilah atas; token pada seluruh pemanggilan RPC; penanganan sesi berakhir; penyembunyian kendali yang bukan hak peran |
#### RPC yang dijaga, beserta peran terendahnya

| RPC | Peran terendah | Alasan |
|---|---|---|
| `getDashboardData()` | `PACKING` | Membaca data yang memang dipakai bekerja |
| `getStatusInventory()` | `PACKING` | Menyusun pilihan filter status |
| `getOrderRowsByStatus()` | `PACKING` | Menampilkan antrian pada filter status |
| `updateOrderStatusInternal()` | `PACKING` | Memindahkan status satu pesanan |
| `updateBatchOrderStatusInternal()` | `PACKING` | Memindahkan status banyak pesanan sekaligus |
| `pingMiddleware()` | `PACKING` | Sekadar memeriksa koneksi |
| `triggerSyncOrders()` | `ADMIN` | Menarik pesanan dari Shopee mengubah isi sheet |
| `triggerSyncBySn()` | `ADMIN` | Sama, untuk satu nomor pesanan |
| `getOrderRowsForExport()` | `ADMIN` | Membaca seluruh baris dan mencatat aksi ekspor |
| `saveTokenFromDashboard()` | `SUPERADMIN` | Menyentuh kredensial toko |
| `refreshTokenFromDashboard()` | `SUPERADMIN` | Sama, memperbarui token satu toko |
| `toggleTrigger()` | `SUPERADMIN` | Mengubah jadwal otomatis seluruh sistem |
| `getAuthUrlFromDashboard()` | `SUPERADMIN` | Menambah toko baru |
| `getPembagianJahit()` | `PACKING` | Membaca setelan dan rekap pembagian. Nominal upahnya ikut dipotong |
| `bagiPembagianDashboard()` | `ADMIN` | Membagi pekerjaan jahit kepada penjahit |
| `simpanPenjahitDashboard()` | `ADMIN` | Mengubah daftar penjahit beserta bobotnya |
| `simpanAturanDashboard()` | `ADMIN` | Mengubah pemetaan SKU ke grup |

Yang **tidak** dijaga, beserta alasannya:

| Fungsi | Alasan tidak dijaga |
|---|---|
| `doGet()` | Hanya menyajikan halaman. Tidak ada data di dalamnya |
| `masukDenganEmail()`, `masukDenganKode()` | Jalan masuknya sendiri. Dijaga oleh pemeriksaan sandi dan pembatasan percobaan |
| `keluarSesi()` | Menutup sesi. Tidak ada yang perlu dilindungi dari menutup sesi sendiri |
| Menu spreadsheet | Untuk membukanya, seseorang sudah harus punya akses ke spreadsheet |

#### Penanda WAJIB_LOGIN dan dua tahap pemberlakuan

Selama `WAJIB_LOGIN` bernilai `TIDAK`, `wajibSesi_()` meloloskan seluruh permintaan dan mengembalikan sesi bertanda `modeUji`. Gunanya agar laman masuk, sesi, dan penyembunyian kendali dapat diuji lebih dulu tanpa risiko mengunci siapa pun. Memberlakukan penolakan sekaligus sulit dibatalkan bila ada yang salah, karena yang terkunci termasuk pemiliknya.

| Tahap | Isi `WAJIB_LOGIN` | Yang diuji |
|---|---|---|
| Uji coba | `TIDAK` | Laman masuk muncul, masuk berhasil, sesi bertahan setelah muat ulang, keluar berfungsi, dashboard tetap normal, dan kendali yang bukan haknya tersembunyi |
| Berlaku | `YA` | Penolakan benar-benar bekerja, termasuk menolak permintaan tanpa sesi dan permintaan yang perannya kurang |

Pada tahap uji coba, penyembunyian kendali sudah mengikuti peran yang tersimpan di peramban, sedangkan servernya belum menolak. Jadi tampilan peran dapat diperiksa lebih dulu tanpa memberlakukan penolakan.

#### Yang perlu dipastikan sebelum tahap berlaku

**Kode klien dan server harus dipasang bersamaan, dan deployment Web App harus dibuat ulang.** Tanda tangan seluruh RPC berubah karena `token` menjadi argumen pertama. Bila klien baru berjalan di atas server lama, argumennya bergeser dan penyaring toko dapat berperilaku salah. Bila itu terjadi, halaman masuk menampilkan pesan bahwa versi kode yang dilayani server belum memuat fungsi masuk.

Cara mundurnya sederhana: tempel kembali ketiga berkas versi sebelumnya. Karena itu **simpan salinan ketiga berkas sebelum menempel yang baru**.

#### Keputusan pelengkap saat implementasi

| Hal | Keputusan | Alasan |
|---|---|---|
| Penyimpanan token di peramban | `sessionStorage`, bukan `localStorage` | Di perangkat gudang bersama, menutup tab sudah mengakhiri sesi tanpa langkah tambahan |
| Peran di peramban | Tidak disimpan | Peran selalu dibaca dari sesi di server, sehingga tidak dapat dinaikkan dari peramban |
| Penjaga yang gagal membaca konfigurasi | Dianggap mode uji | Salah membaca konfigurasi tidak boleh mengunci seluruh dashboard |
| Sesi berakhir di tengah pemakaian | Seluruh data yang tampil dibuang, lalu kembali ke layar masuk | Data toko tidak boleh tetap terlihat setelah sesinya tidak berlaku |
| Kendali yang bukan haknya | Disembunyikan sesuai peran | Server tetap penolak sebenarnya. Penyembunyian hanya mencegah kebingungan |
| Grup tombol yang seluruh isinya disembunyikan | Grupnya ikut disembunyikan | Supaya tidak meninggalkan celah kosong di panel |

#### Verifikasi yang sudah dijalankan

| Uji | Hasil |
|---|---|
| Mode uji: permintaan tanpa token tetap dilayani, dan sesinya bertanda mode uji | Lulus |
| Mode berlaku: permintaan tanpa token ditolak | Lulus |
| Mode berlaku: token yang tidak dikenal ditolak | Lulus |
| `PACKING` boleh membaca dashboard, inventaris status, dan mengubah status | Lulus |
| `PACKING` ditolak menarik pesanan, mengekspor, dan mengubah trigger | Lulus |
| `ADMIN` boleh menarik pesanan dan mengekspor, tetapi ditolak menyimpan token | Lulus |
| `SUPERADMIN` boleh menjalankan aksi superadmin | Lulus |
| Perubahan status mencatat kode pelakunya di `Log_Aktivitas` | Lulus |
| Klien meneruskan token pada argumen pertama untuk ketiga belas RPC | Lulus |
| Server menerima token pada argumen pertama untuk ketiga belas RPC | Lulus |
| Setiap RPC terjaga memanggil `wajibSesi_`, dengan peran terendah yang sesuai usulan | Lulus |
| Setiap id, handler, dan nama RPC yang dipakai klien benar-benar ada | Lulus |

Pemeriksaan tanda tangan RPC itu penting: mengubah argumen pertama menyentuh dua berkas sekaligus, dan ketidakcocokan antara klien dan server tidak memunculkan galat sintaks, hanya perilaku yang salah. Karena itu pemeriksaannya otomatis.

Saat Fase 2 dikerjakan, dua harness uji lama ikut gagal karena meniru pemanggilan klien dengan tanda tangan lama. Keduanya diperbarui. Itu memang efek yang harus dibayar ketika sebuah antarmuka bersama berubah, bukan kerusakan yang tidak terduga.

#### Verifikasi yang perlu Anda jalankan sendiri

**Tahap uji coba, `WAJIB_LOGIN` masih `TIDAK`:**

1. Tempel ulang ketiga berkas, lalu **buat deployment Web App versi baru**.
2. Buka tautan Web App. Layar masuk harus muncul, dan setelah formulir ditampilkan, isi kode `PEMILIK` dan sandinya.
3. Setelah masuk, bilah atas harus menampilkan nama Anda dan tombol **Keluar**. Muat ulang halaman, dan sesinya harus bertahan.
4. Periksa dashboard tetap berjalan seperti sebelumnya: angka, tabel, filter status, dan ekspor.
5. Tekan **Keluar**, lalu pastikan layar masuk muncul lagi dan dashboard tidak lagi memuat data.
6. Bila Anda membuat akun percobaan berperan `PACKING`, masuk dengan akun itu dan pastikan panel kendali, tab token, serta tombol ekspor tidak tampil.

**Tahap berlaku, setelah tahap uji coba bersih:**

7. Ubah `WAJIB_LOGIN` di sheet `Konfigurasi` menjadi `YA`.
8. Ulangi langkah 2 sampai 5. Bedanya, sekarang penolakan benar-benar berlaku, termasuk untuk permintaan yang dibuat di luar halaman.
9. Bila ada yang tidak berfungsi, kembalikan `WAJIB_LOGIN` menjadi `TIDAK`. Penolakan langsung berhenti tanpa perlu menempel ulang kode.


### Fase 3: Aturan per peran

Yang dikerjakan: batas hak di server untuk tiap aksi, terutama batas packing pada perubahan status, dan penetapan peran terendah untuk setiap RPC.

### Fase 4: Tampilan dan kelola pengguna

**Status: selesai diimplementasikan.** Penyembunyian tab dan tombol dilaksanakan di Fase 2, karena tanpa itu seorang packing akan melihat tombol yang selalu gagal. Kelola pengguna kini tersedia di dua tempat, menu spreadsheet dan tab di dalam dashboard, dan keduanya memakai pemeriksaan yang sama.

| Berkas | Yang berubah |
|---|---|
| `gas/Code.js` | Tiga RPC baru, pemeriksaan isian bersama `bersihkanIsianPengguna_`, pagar `tolakBilaSuperadminTerakhir_`, dan pencabutan sesi saat peran, status, atau sandi berubah |
| `gas/Index.html` | Tab **Pengguna & peran** khusus superadmin, tabel akun, formulir tambah atau ubah, konfirmasi nonaktifkan, serta keadaan kosong, memuat, dan galat |
| `gas/SheetManager.js` | Tidak berubah di fase ini. Aturan penyimpanannya sudah memadai; yang ditambahkan hanya jalan masuk keduanya |

#### RPC yang ditambahkan

| RPC | Peran terendah | Guna |
|---|---|---|
| `ambilDaftarPengguna()` | `SUPERADMIN` | Daftar akun tanpa hash dan salt, ditambah jumlah superadmin aktif, daftar peran sah, dan panjang sandi minimum |
| `simpanPenggunaDariDashboard()` | `SUPERADMIN` | Menambah atau mengubah akun |
| `ubahStatusPenggunaDariDashboard()` | `SUPERADMIN` | Mengaktifkan atau menonaktifkan akun |

Dua angka ikut dikirim bersama daftarnya, yaitu jumlah superadmin aktif dan panjang sandi minimum, supaya layar dapat mematikan tombol yang akan ditolak server. Alasannya terlihat sebelum tombol ditekan, bukan sesudahnya. Server tetap menolak walaupun tombolnya dipaksa dari konsol peramban.

#### Keputusan: perubahan hak mengakhiri sesi yang sedang berjalan

Ini ditemukan saat mengerjakan layar ini, dan tidak tertulis di rancangan awal. Peran disimpan **di dalam sesi**, sedangkan `wajibSesi_` tidak membaca sheet Pengguna pada setiap permintaan. Akibatnya menonaktifkan akun atau menurunkan perannya **tidak langsung berlaku**: orang itu masih memakai perannya yang lama sampai sesinya berakhir sendiri, yaitu sampai enam jam kemudian. Tombol nonaktifkan yang tidak mencabut apa pun lebih buruk daripada tidak ada tombol, karena membuat pemiliknya merasa sudah aman padahal belum.

Karena itu setiap token yang dibuat kini ikut dicatat di cache pada kunci per pengguna, dan perubahan peran, status, atau sandi menghapus seluruh token orang itu.

| Kejadian | Yang terjadi pada sesinya |
|---|---|
| Peran berubah | Seluruh sesinya berakhir, dan ia masuk lagi dengan peran barunya |
| Sandi diganti | Seluruh sesinya berakhir |
| Akun dinonaktifkan | Seluruh sesinya berakhir, dan ia tidak dapat masuk lagi |
| Nama atau email disunting | Sesi tidak diganggu, karena haknya tidak berubah |
| Keluar sendiri | Hanya token itu yang dibuang dari daftar |

Daftar token disimpan di cache, bukan di sheet, karena isinya hanya berguna selama sesinya hidup. Isinya dibatasi dua puluh sesi terakhir, jauh di atas pemakaian nyata.

#### Keputusan: kode akun dikunci saat menyunting

Kode adalah kunci barisnya. Bila kode boleh diubah dari dalam formulir, `simpanPengguna()` akan menulis baris **baru** dan meninggalkan baris yang lama, sehingga satu orang menjadi dua akun tanpa ada yang menyadarinya. Karena itu isian kode dikunci saat menyunting, dengan keterangan di bawahnya bahwa penggantian kode dilakukan dengan membuat akun baru lalu menonaktifkan yang lama.

#### Dua pagar pengaman

Keduanya berlaku di menu spreadsheet maupun di layar dashboard, karena keduanya memanggil pemeriksaan yang sama.

1. **Superadmin aktif terakhir tidak dapat diturunkan perannya atau dinonaktifkan.** Tanpa pagar ini, satu kali salah isi dapat mengunci semua orang dari dashboard, dan satu-satunya jalan keluar adalah editor Apps Script.
2. **Akun yang sudah dinonaktifkan tidak akan aktif kembali hanya karena disunting.** Statusnya dipertahankan bila tidak dikirim.

#### Verifikasi yang sudah dijalankan

| Uji | Hasil |
|---|---|
| Membuat akun packing lewat menu, dan sandinya dapat dipakai untuk masuk | Lulus |
| Menyunting nama tanpa sandi mempertahankan sandi, peran, dan status | Lulus |
| Menonaktifkan akun membuat sandinya tidak dapat dipakai | Lulus |
| Menyunting akun yang tidak aktif tidak mengaktifkannya kembali | Lulus |
| Mengaktifkan kembali akun membuat sandinya berlaku lagi | Lulus |
| Sesi packing menghasilkan peran `PACKING`, bukan peran yang lebih tinggi | Lulus |
| Ketiga RPC baru menolak permintaan tanpa token, dan menolak `ADMIN` maupun `PACKING` | Lulus |
| Daftar akun tidak memuat hash, salt, maupun sandi asli | Lulus |
| Isian yang salah ditolak: kode kosong, kode berspasi, kode bertanda kutip, peran tidak dikenal, sandi kurang dari enam karakter, sandi sama dengan kode, akun baru tanpa sandi, dan email tanpa tanda at | Lulus |
| Mengubah peran mengakhiri seluruh sesi orang itu, diuji dengan dua sesi sekaligus | Lulus |
| Mengganti sandi mengakhiri sesinya, dan perannya tidak ikut berubah | Lulus |
| Menyunting nama tidak mengakhiri sesi dan tidak mengubah hash sandi | Lulus |
| Menonaktifkan akun membuat sesi yang sedang berjalan langsung berakhir | Lulus |
| Menekan nonaktifkan dua kali tidak mengubah apa pun | Lulus |
| Keluar menghapus tokennya dari daftar token pengguna | Lulus |
| Superadmin terakhir ditolak saat diturunkan perannya, dan ditolak saat dinonaktifkan | Lulus |
| Menyunting nama superadmin terakhir tetap boleh | Lulus |
| Penurunan peran boleh setelah ada superadmin kedua | Lulus |
| Layar: baris superadmin terakhir mengunci tombol statusnya dan menuliskan alasannya, dan kuncinya hilang setelah ada cadangan | Lulus |
| Layar: nama akun yang berisi tag HTML ditulis sebagai teks, bukan dijalankan | Lulus |
| Layar: keadaan kosong, memuat, dan galat masing-masing menyebut sebab dan tindakan berikutnya | Lulus |
| Layar: tab Pengguna hanya tampil untuk superadmin, dan daftarnya dibaca saat tab dibuka, sekali saja | Lulus |
| Layar: keluar dari sesi membuang daftar akun dari layar | Lulus |
| Angka panjang sandi minimum di klien sama dengan konstanta di server, diperiksa otomatis | Lulus |
| Riwayat mencatat pelakunya di kolom Pengguna pada setiap perubahan | Lulus |

#### Verifikasi yang perlu Anda jalankan sendiri

1. Tempel ulang `gas/Code.js` dan `gas/Index.html`, lalu buat deployment Web App versi baru.
2. Masuk sebagai superadmin, lalu buka tab **Pengguna & peran**.
3. Pastikan akun Anda muncul dengan label **Superadmin terakhir, status dan perannya terkunci**, dan tombol **Nonaktifkan** pada baris itu mati.
4. Tekan **Tambah pengguna**, isi kode `ujiPacking`, nama, peran `PACKING`, dan sandi minimal enam karakter. Setelah tersimpan, daftarnya dimuat ulang sendiri.
5. Buka tautan Web App di jendela penyamaran, masuk dengan `ujiPacking`, lalu pastikan panel kendali, tab Token, dan tab Pengguna tidak tampil.
6. Kembali ke jendela superadmin, lalu tekan **Nonaktifkan** pada baris `ujiPacking`. Pesan konfirmasi menyebut akibatnya. Setelah itu, halaman packing yang sedang terbuka akan kembali ke layar masuk pada permintaan berikutnya.
7. Bila akun Anda sendiri yang dinonaktifkan padahal bukan superadmin terakhir, sesi Anda berakhir dan Anda perlu dimasukkan kembali oleh superadmin lain. Itu memang disengaja, karena menyerahkan kunci harus mengakhiri akses pemberinya.
8. Masuk dengan akun berperan `PACKING`, lalu pastikan kartu **Total omzet**, kolom **Total** pada tabel, blok nominal di modal detail pesanan, dan pilihan urutan **Nominal terbesar** tidak ada. Ulangi untuk akun `ADMIN`. Untuk memeriksanya di peramban tanpa deploy, buka `dashboard-preview.html` dengan tambahan `?peran=packing` pada alamatnya.
9. Dengan akun packing itu, buka konsol peramban lalu periksa jawaban `getDashboardData`. Isinya tidak boleh memuat `totalAmount`, `shippingFee`, maupun `totalRevenue`. Selama `WAJIB_LOGIN` masih `TIDAK`, langkah ini belum akan lolos, karena pemotongannya baru bekerja pada mode berlaku.

### Fase 5: Pengerasan dan uji terima

Yang dikerjakan: pembatasan percobaan yang lebih rapi, uji kedaluwarsa sesi, pemeriksaan jejak audit, dan pembersihan.

Yang masih terbuka setelah Fase 4, di luar rancangan awal:

| Hal | Keadaan sekarang |
|---|---|
| Pengguna mengganti sandinya sendiri | Belum ada. Setiap penggantian sandi dilakukan superadmin. Untuk perangkat gudang bersama, itu berarti staf yang ingin mengganti sandinya harus menunggu superadmin |
| Memutus sesi tanpa mengubah hak | Belum ada. Yang tersedia hanya pencabutan yang menyertai perubahan peran, status, atau sandi |
| Nominal uang bagi packing dan admin | Sudah diputuskan dan dikerjakan. Dipotong di server, bukan disembunyikan di peramban. Rinciannya di bagian 7.1 |

---

## 9. Risiko dan hal yang belum tertutup

| # | Risiko | Ditangani di | Cara |
|---|---|---|---|
| 1 | Pengguna memakai fitur yang bukan haknya | Fase 2 dan 3 | Penjaga di setiap RPC |
| 2 | Staf mengubah perannya sendiri di sheet | Sudah tertutup | Spreadsheet tidak dibagikan ke staf, sehingga mereka tidak punya jalan ke sheet |
| 3 | Sesi tetap terbuka di perangkat gudang bersama | Fase 2 | Tombol keluar, masa sesi 6 jam, dan tombol ganti pengguna |
| 4 | PIN ditebak berulang | Fase 1 dan 5 | Lima kali gagal mengunci 15 menit, dan panjang minimum 6 karakter |
| 5 | Cache dibersihkan sehingga semua orang keluar mendadak | Diterima | Pengguna cukup masuk lagi. Sesi memang bukan data yang perlu bertahan |
| 6 | Tautan Web App dibuka orang luar | **Gerbang utama saat ini** | Dashboard dibuka lewat tautan Web App, sehingga pengaturan akses deployment adalah satu-satunya pintu sampai Fase 2 selesai. Perlu dipastikan lebih dulu, lalu dicatat |
| 7 | Dashboard dibuka dari menu spreadsheet oleh orang yang punya akses sheet | Tidak berlaku | Staf tidak memakai jalur ini, karena spreadsheet tidak dibagikan kepada mereka |
| 8 | Kata sandi tertinggal di peramban bersama | Fase 2 | Formulir masuk tidak menyimpan sandi, dan hanya token yang disimpan |
| 9 | Hak yang sudah dicabut masih dipakai sampai sesinya berakhir | Fase 4 | Perubahan peran, status, atau sandi menghapus seluruh token orang itu |
| 10 | Penolakan sudah ada di kode tetapi belum dinyatakan berlaku | Terbuka sampai Anda mengubahnya | Selama `WAJIB_LOGIN` bernilai `TIDAK`, penjaganya meloloskan semua permintaan. Satu sel di sheet `Konfigurasi` menutupnya |

Karena spreadsheet tidak dibagikan ke staf dan dashboard dibuka lewat tautan Web App, susunannya menjadi lebih sederhana dan lebih kuat daripada dugaan awal: **hanya ada satu pintu**, yaitu tautan Web App. Penjaganya dua lapis: pengaturan akses deployment, dan halaman masuk beserta penjaga peran di server yang ditambahkan pada Fase 2.

Catatan penting yang berlaku sekarang: **penolakan sudah ada di dalam kode, tetapi belum dinyatakan berlaku.** Selama `WAJIB_LOGIN` di sheet `Konfigurasi` bernilai `TIDAK`, `wajibSesi_()` meloloskan seluruh permintaan. Jadi siapa pun yang berhasil memuat halaman dashboard masih dapat memakai seluruh fiturnya, sekalipun layar masuknya tampil. Penolakan yang sesungguhnya baru bekerja setelah nilai itu diubah menjadi `YA`.

---

## 10. Pertanyaan yang masih terbuka

### Sudah terjawab

| # | Pertanyaan | Jawaban | Akibatnya |
|---|---|---|---|
| 1 | Apakah staf packing sudah diberi akses ke spreadsheet `ERP Begood`? | Belum | Pintu kedua sudah tertutup. Login di dashboard menjadi satu-satunya pengaman, dan tidak ada jalan samping lewat spreadsheet |
| 2 | Dari jalan mana mereka membuka dashboard? | Tautan Web App | Login benar-benar bekerja sebagai pengaman, bukan sekadar pembatas peran |
| 3 | Bolehkah packing dan admin melihat nominal uang? | Tidak | Nominal dipotong di server untuk kedua peran itu, dan urutan berdasarkan nominal ikut dibuang. Rinciannya di bagian 7.1 |

Kedua jawaban itu menjadikan rancangan ini lebih kuat daripada dugaan awal, karena hanya ada satu pintu. Konsekuensinya, pengaturan akses deployment menjadi **satu-satunya penjaga** sampai Fase 2 selesai.

### Masih terbuka

| # | Pertanyaan | Mengapa penting | Menghambat fase |
|---|---|---|---|
| 3 | Berapa batas akses pada deployment Web App, dan apakah admin punya akun Google di domain yang sama dengan pemilik skrip? | Menentukan apakah jalur email dapat bekerja, dan seberapa kuat pintu terluar sebelum Fase 2 | Fase 2 |
| 4 | Berapa lama sesi boleh bertahan di perangkat gudang bersama? | Batas teknis 6 jam. Usulan: 6 jam, ditambah tombol ganti pengguna | Fase 2 |
| 5 | Apakah perlu tombol ganti pengguna cepat, tanpa menutup peramban? | Perangkat gudang dipakai bergiliran | Fase 2 |
| 6 | Apakah packing perlu memindahkan status selain `[1]` ke `[2]`, misalnya menandai paket diserahkan kurir? | Menentukan batas perubahan status | Fase 3 |

Pertanyaan 3 adalah gerbang Fase 2. Bila akses deployment masih `Anyone`, pintu terluar terbuka untuk siapa pun yang memegang tautannya, dan sebaiknya diubah menjadi `Anyone with Google account` atau dibatasi ke domain Anda lebih dulu. Pilihan itu juga prasyarat agar jalur email dapat bekerja.

---

## 11. Uji terima

Dijalankan setelah Fase 5. Seluruh butir harus lulus sebelum pembatasan peran dinyatakan siap.

| # | Uji | Hasil yang diharapkan |
|---|---|---|
| 1 | Panggil `getDashboardData()` tanpa token dari konsol peramban | Ditolak, dan tidak ada data yang terkirim |
| 2 | Panggil RPC perubahan status dengan token berperan `PACKING` | Ditolak |
| 3 | Masuk dengan sandi salah lima kali | Kode itu terkunci, dan kode lain tetap dapat dipakai |
| 4 | Masuk dengan kode dan sandi yang benar | Sesi terbentuk, dan namanya tercatat di `Log_Aktivitas` |
| 5 | Masuk dengan email yang terdaftar | Sesi terbentuk tanpa mengetik sandi |
| 6 | Masuk dengan email yang belum terdaftar | Ditolak dengan keterangan jelas, dan formulir kode tampil |
| 7 | Tekan keluar, lalu pakai token lamanya lagi | Ditolak |
| 8 | Diamkan sesi lebih dari 6 jam, lalu lanjut bekerja | Diminta masuk lagi |
| 9 | Buka dashboard sebagai packing | Tab token, tombol tarik, dan tombol ekspor tidak tampil |
| 10 | Panggil aksi admin memakai token packing dari konsol peramban | Ditolak, walau tombolnya ada |
| 11 | Ubah status pesanan sebagai packing dari `[1]` ke `[2]` | Berhasil, dan tercatat atas nama pengguna itu |
| 12 | Ubah status pesanan sebagai packing dari `[2]` ke `[4]` | Ditolak |
| 13 | Buka dashboard dari menu spreadsheet | Berperilaku sama seperti lewat tautan Web App |
| 14 | Periksa `Log_Aktivitas` setelah satu hari kerja | Setiap perubahan status memuat kode pengguna pelakunya |

---

Berkas yang dirujuk pada dokumen ini: `gas/Code.js`, `gas/SheetManager.js`, dan `gas/Index.html`. Nomor dan nama fungsi merujuk pada isi berkas tersebut saat dokumen ini disusun, dan perlu diperiksa ulang bila berkasnya berubah.