# Panduan Export PDF & Cetak Slip Packing (ERP Begood)

Panduan ini menjelaskan cara menambah ekspor PDF ke Web Dashboard ERP Begood dan cara memakai jalur cetak slip yang sudah terpasang di dashboard. Isinya disusun untuk kode yang ada di repository ini, sehingga setiap rujukan dapat dibuka langsung pada berkas yang disebut.

> **Status: fitur ekspor PDF sudah terpasang.** Cuplikan kode di dokumen ini adalah catatan rancangan saat fiturnya belum ada, dan sebagian sudah berbeda dari kode yang berjalan sekarang. Yang berubah setelah dokumen ini ditulis: rekap memakai kolom Toko, penyusun tabel bersama `rekapRowsFrom()` beserta `rekapBaris_()` dan `REKAP_HEADERS`, slip dan label mencetak nama toko dari pesanan yang dicetak, dan penomoran baris pada rujukan kode sudah bergeser. Yang tetap berlaku adalah bagian alur, keputusan, dan alasan di baliknya. Untuk rincian per toko, lihat `docs/arsitektur-multi-toko.md`.

Referensi kode:

| Berkas | Peran |
|---|---|
| `gas/Index.html` | Seluruh tampilan dashboard: token desain (CSS), markup, dan logika (JS) dalam satu berkas |
| `gas/Code.js` | Menu spreadsheet, endpoint Web App, dan seluruh RPC `google.script.run` |
| `gas/SheetManager.js` | Pembacaan sheet dan bentuk payload `getDashboardSummary()` |
| `gas/appsscript.json` | Manifest GAS: `timeZone` Asia/Jakarta, runtime V8, daftar `oauthScopes` |

Status kemampuan pada saat panduan ini ditulis:

| Kemampuan | Status | Titik rujukan |
|---|---|---|
| Cetak slip packing lewat pratinjau di dashboard | Sudah ada | `gas/Index.html:2028` sampai `gas/Index.html:2104` |
| Ekspor CSV daftar pesanan | Sudah ada | `gas/Index.html:1906` |
| Ekspor PDF memakai jsPDF | Belum ada | Tidak ada rujukan di repository ini |

Seluruh ekspor PDF pada panduan ini berjalan di sisi peramban. Tidak ada endpoint baru di middleware Vercel, tidak ada perubahan `oauthScopes`, dan tidak ada panggilan tambahan ke Shopee Open API.

---

## 1. Ringkasan

Ada dua jalur keluaran dokumen yang dipakai bergantian, dan pemilihannya ditentukan oleh bentuk dokumen, bukan oleh selera:

| Jalur | Cara kerja | Cocok untuk |
|---|---|---|
| Cetak HTML | Slip disusun sebagai HTML, ditampilkan di dashboard, lalu dicetak lewat dialog cetak peramban | Slip packing, dokumen yang tinggi barisnya mengikuti panjang teks, dokumen yang perlu dipilih printernya |
| jsPDF | Dokumen digambar dengan koordinat milimeter, lalu diunduh sebagai berkas `.pdf` | Dokumen berukuran tetap dan kecil, label alamat, tiket, arsip yang harus tersimpan sebagai berkas |

Kesimpulan praktis untuk project ini:

1. **Pertahankan jalur cetak HTML yang sudah ada** untuk slip packing harian. Alasannya ada di bagian 4.
2. **Tambahkan jsPDF hanya untuk tiga kebutuhan** yang tidak dapat dipenuhi jalur cetak: arsip PDF per pesanan, rekap tabel lintas halaman, dan label atau tiket berukuran tetap.

---

## 2. Kondisi Cetak di Dashboard Saat Ini

Pratinjau slip packing sudah terpasang dan dipakai dari tiga tempat berbeda. Ketiganya bermuara ke fungsi yang sama, jadi tidak ada duplikasi penyusunan slip.

### 2.1 Tiga pintu masuk

| Pintu masuk | Fungsi | Lokasi |
|---|---|---|
| Tombol cetak pada baris tabel pesanan | `printSingleOrder(orderSn)` | `gas/Index.html:2028` |
| Tombol cetak di dalam modal detail pesanan | `printSingleOrderFromModal()` | `gas/Index.html:2035` |
| Tombol cetak slip pada bilah aksi massal | `printSelectedOrders()` | `gas/Index.html:2040` |

### 2.2 Alur dari tombol sampai kertas

```text
[1] Pengguna menekan tombol cetak (baris tabel, modal detail, atau aksi massal)
      |
      +--> printSingleOrder(orderSn)             gas/Index.html:2028
      +--> printSingleOrderFromModal()           gas/Index.html:2035
      +--> printSelectedOrders()                 gas/Index.html:2040
      |
[2] Ketiganya memanggil renderPrintArea(orders)  gas/Index.html:2096
      |
      +--> slipFor(order) untuk setiap pesanan   gas/Index.html:2045
      |
[3] Hasil HTML ditulis ke wadah pratinjau
      +--> #print-area di dalam #print-modal     gas/Index.html:1187 dan gas/Index.html:1175
      |
[4] Pengguna menekan tombol Cetak, yang memanggil window.print()
      |
[5] Aturan @media print menentukan apa yang keluar ke kertas   gas/Index.html:585
```

### 2.3 Mengapa pencetakan tidak mencetak seluruh dashboard

Aturan cetak di `gas/Index.html:585` memakai pemilih `body:has(#print-modal:not([hidden]))`. Artinya:

- Ketika pratinjau slip dibuka, seluruh elemen `body` selain `#print-modal` disembunyikan, sehingga yang tercetak hanya slip.
- Ketika pratinjau tertutup dan pengguna menekan `Ctrl+P` dari dashboard, aturan tersebut tidak aktif dan peramban mencetak halaman dashboard apa adanya. Ini disengaja: tanpa syarat itu, menekan `Ctrl+P` di luar pratinjau akan menghasilkan halaman kosong.

Satu slip ditulis dengan kelas `.slip` (`gas/Index.html:564`) dan diberi `break-after: page` saat dicetak, sehingga beberapa slip terpilih otomatis terpisah ke halaman masing-masing.

### 2.4 Yang belum ada

| Kebutuhan | Kondisi | Catatan |
|---|---|---|
| Berkas PDF slip packing | Belum ada | Jalur cetak saat ini menghasilkan kertas, atau "Save as PDF" dari dialog peramban |
| Berkas PDF rekap pesanan | Belum ada | Yang tersedia baru CSV lewat `exportTableToCSV()` di `gas/Index.html:1906` |
| Label alamat paket berukuran tetap | Belum ada | Dibutuhkan bila label dicetak dari printer thermal |
| Pratinjau PDF langsung di dashboard | Belum ada | Modal pratinjau yang ada hanya untuk jalur cetak HTML |

Sebelum merancang rekap PDF, baca batas jumlah baris pada payload dashboard di bagian 4.6.

---

## 3. Memilih Teknik: Cetak HTML atau jsPDF

Aturan penentuan yang dipakai pada panduan ini:

| Kebutuhan | Pilihan | Alasan |
|---|---|---|
| Staf gudang mencetak slip dan memilih printer atau ukuran kertas sendiri | Cetak HTML | Dialog cetak peramban memberi kendali penuh atas printer dan kertas |
| Tinggi baris mengikuti panjang teks (nama produk atau SKU panjang) | Cetak HTML | Peramban yang menghitung tinggi, bukan kita |
| Perlu berkas `.pdf` langsung terunduh untuk arsip | jsPDF | Hasilnya berkas, bukan kertas |
| Ukuran kertas tidak standar (label 100 x 150 mm, thermal) | jsPDF | Ukuran ditentukan sebagai larik milimeter |
| Perlu banyak tiket atau label identik dalam satu lembar | jsPDF | Grid digambar lalu `addPage()` untuk lembar berikutnya |
| Data sudah tersusun di DOM dan ingin diekspor apa adanya | jsPDF | Baca baris dari DOM, lalu kirim sebagai larik ke exporter |

Keputusan yang sudah konsisten dengan aturan tersebut di project ini: slip packing harian tetap di jalur cetak HTML, sedangkan arsip PDF per pesanan dan label thermal masuk ke jsPDF.

---

## 4. Kendala Google Apps Script yang Membentuk Desain Fitur

Bagian ini menjelaskan hal-hal yang membuat export PDF di project ini berbeda dari export PDF di aplikasi web biasa. Semuanya berasal dari kode yang ada di repository ini.

### 4.1 Dashboard disajikan dari tiga konteks berbeda

Ketiganya memuat berkas yang sama, yaitu `Index`:

| Konteks | Fungsi penyaji | Pemanggil dari menu | Baris |
|---|---|---|---|
| Web App mandiri | `doGet(e)` | Menu `ERP Begood` > `Buka Web Dashboard (Tab Baru)` | `gas/Code.js:598` |
| Modal layar penuh di Spreadsheet | `openDashboardModal()` | Menu `ERP Begood` > `Buka Web Dashboard (Layar Penuh)` | `gas/Code.js:670` |
| Sidebar kanan Spreadsheet | `openDashboardSidebar()` | Menu `ERP Begood` > `Buka Web Dashboard (Sidebar)` | `gas/Code.js:660` |

Ketiganya memakai `HtmlService.createHtmlOutputFromFile('Index')` dengan `XFrameOptionsMode.ALLOWALL`. Konsekuensinya, dashboard selalu berjalan di dalam iframe yang disajikan oleh Google, termasuk saat dibuka sebagai sidebar atau modal di dalam Google Sheets.

### 4.2 Pencetakan terjadi dari dalam iframe, dan itu justru menguntungkan

`window.print()` yang dipanggil dari skrip di dalam iframe mencetak dokumen iframe tersebut. Karena pratinjau slip berada di dokumen yang sama, mencetak dari dashboard secara otomatis mencetak slip saja, bukan antarmuka Google Sheets di sekelilingnya.

Inilah alasan jalur cetak HTML di bagian 2 sebaiknya dipertahankan: ia bekerja tanpa keluar dari iframe, tanpa jendela baru, dan tanpa izin tambahan.

### 4.3 Jangan bergantung pada jendela popup

Pola cetak yang lazim di aplikasi web biasa adalah membuka jendela baru dengan `window.open()`, menulis dokumen ke dalamnya, lalu memanggil `window.print()` dari dalam dokumen baru itu. Pola tersebut tetap dapat dipakai di project ini, tetapi tidak boleh dijadikan jalur utama karena dua sebab:

1. Peramban dapat memblokir popup. Di dalam sidebar Google Sheets ruangnya sempit, sehingga jendela popup sering tertutup atau langsung ditutup pengguna.
2. `window.open()` mengembalikan `null` ketika popup diblokir, sehingga kode wajib memeriksanya sebelum menulis dokumen.

Urutan yang dipakai di project ini tetap: pratinjau di dalam modal, lalu dialog cetak peramban. Jendela popup hanya dipakai sebagai alternatif bila memang dibutuhkan dokumen di jendela terpisah.

### 4.4 Unduhan berkas dari dalam iframe perlu jalur cadangan

`doc.save()` pada jsPDF memicu unduhan dari dalam iframe. Pada sebagian kombinasi peramban dan kebijakan organisasi, unduhan otomatis dari iframe dapat diblokir sehingga tombol terlihat tidak bereaksi.

Karena itu kit pada Lampiran A menyediakan dua jalur keluaran:

| Jalur | Perilaku | Dipakai kapan |
|---|---|---|
| `doc.save(nama)` | Unduhan langsung | Percobaan pertama, jalur normal |
| `doc.output('bloburl')` lalu `window.open(url, '_blank')` | Berkas PDF dibuka di tab baru | Bila unduhan langsung tidak terjadi, atau pengguna memakai Safari |

Kedua jalur diuji pada checklist bagian 12 butir 11.

### 4.5 Dashboard juga dipakai pada lebar sempit

Karena dashboard hidup di sidebar Google Sheets, lebarnya bisa jauh lebih kecil daripada modal 1200 piksel di `gas/Code.js:672`. Berkas `gas/Index.html` sudah menangani ini melalui dua titik henti:

| Titik henti | Yang berubah |
|---|---|
| `@media (max-width: 900px)` | Susunan strip angka berubah dari satu baris menjadi beberapa baris |
| `@media (max-width: 640px)` | Bilah atas, panel fokus, tabel, dan kaki modal menyesuaikan diri |

Tombol export baru wajib mengikuti aturan yang sama: memakai kelas `.btn` yang sudah ada dan tidak memberi lebar piksel tetap.

### 4.6 Payload dashboard membatasi jumlah baris

Ini kendala yang paling menentukan saat merancang rekap PDF. `getDashboardSummary()` sengaja memotong data agar transfer RPC tetap cepat:

| Data | Batas | Bukti |
|---|---|---|
| Daftar pesanan | 80 baris terbaru | `gas/SheetManager.js:638` |
| Log aktivitas | 7 catatan terakhir | `gas/SheetManager.js:712` dan `gas/SheetManager.js:717` |

Artinya, rekap PDF yang dibangun dari `globalData.orders` **tidak akan pernah lebih dari 80 baris**, walaupun sheet memuat ribuan pesanan. Untuk rekap penuh, tambahkan RPC baru yang membaca sheet langsung. Kodenya ada di bagian 8.3, dan sifatnya menambah fungsi, bukan mengubah fungsi yang sudah ada.

Batas ini juga pernah membuat **filter status menampilkan tabel kosong**. Penyebabnya: `stats.siapPacking` dihitung dari seluruh baris sheet, sedangkan daftar pesanan yang dikirim hanya 80 baris terbaru. Ketika antrian "[1] Siap Packing" berada di baris yang lebih lama, panel fokus menampilkan angka yang benar sementara tabelnya kosong.

Perbaikan yang sudah terpasang: filter selain "Semua status" memakai RPC `getOrderRowsByStatus()` yang membaca sheet langsung, sedangkan "Semua status" tetap memakai payload 80 baris supaya pemuatan awal tetap cepat. Rinciannya ada di bagian 8.5.

Pelajaran yang berlaku umum: **jangan pernah membandingkan angka dari dua sumber yang berbeda cakupannya.** Bila satu angka dihitung dari seluruh sheet, angka pembandingnya juga harus berasal dari seluruh sheet, atau setidaknya keduanya harus menjelaskan cakupannya masing-masing.


### 4.7 Berkas tambahan tidak bisa disisipkan otomatis

Karena `Index` disajikan dengan `createHtmlOutputFromFile()` (`gas/Code.js:599`, `gas/Code.js:661`, `gas/Code.js:671`), berkas tersebut bukan templat. Skriplet seperti `<?!= include('PdfKit') ?>` tidak akan dieksekusi.

Dua pilihan yang tersedia:

| Pilihan | Cara | Cocok untuk |
|---|---|---|
| Sisipkan langsung (disarankan) | Tempel isi kit ke dalam blok `<script>` yang sudah ada di `gas/Index.html` | Perubahan paling kecil, tidak menyentuh `Code.js` |
| Pisahkan berkas templat | Ubah penyajian menjadi `HtmlService.createTemplateFromFile('Index').evaluate()` lalu tambahkan skriplet `include` | Bila kit akan dipakai bersama beberapa halaman HTML |

Langkah untuk kedua pilihan ada di bagian 10.

---

## 5. Kontrak Data dari Dashboard

Semua dokumen pada panduan ini dibangun dari dua sumber yang sudah tersedia, jadi tidak ada pembacaan sheet baru kecuali pada bagian 8.3.

### 5.1 Objek pesanan satu baris

Setiap baris pada `globalData.orders` berasal dari pemetaan 16 kolom pertama sheet `Pesanan Masuk`, yaitu kolom A sampai P. Kolom ke-17 `Toko` belum ikut dipetakan; penambahannya menyusul bersama pemilih cakupan toko di dashboard. Pemetaan ini diambil dari `mapBarisPesanan_()` di `gas/SheetManager.js:203` sampai `gas/SheetManager.js:221`.

| Kolom sheet | Indeks | Properti | Contoh nilai | Catatan untuk dokumen PDF |
|---|---|---|---|---|
| A No. Pesanan | `row[0]` | `orderSn` | `260927A1B2C3` | Selalu berformat teks, aman dipakai sebagai nama berkas |
| B Tanggal Pesanan (WIB) | `row[1]` | `date` | `27/09/2026 09:14` | Sudah berupa tampilan siap cetak, lihat 5.4 |
| C Status Shopee | `row[2]` | `shopeeStatus` | `READY_TO_SHIP` | Kode huruf besar dari Shopee |
| D Status Internal Begood | `row[3]` | `internalStatus` | `[1] Siap Packing` | Bernilai penuh termasuk nomor urut |
| E Nama Pembeli | `row[4]` | `buyer` | `Rina Kartika` | Perlu di-escape sebelum masuk HTML |
| F Ringkasan Produk | `row[5]` | `items` | `Kaos Polos Premium` | Perlu di-escape |
| G Nomor Referensi SKU | `row[6]` | `sku` | `BG-KS-001` | Bernilai `-` bila kosong |
| H Nama Variasi | `row[7]` | `variation` | `Hitam, L` | Bernilai `-` bila kosong |
| I Total Qty | `row[8]` | `qty` | `2` | Angka |
| J Total Belanja (Rp) | `row[9]` | `totalAmount` | `175000` | Angka tanpa titik, diformat saat render |
| K Ongkir (Rp) | `row[10]` | `shippingFee` | `12000` | Angka tanpa titik |
| L Ekspedisi / Kurir | `row[11]` | `courier` | `SPX Express` | Bernilai `Lainnya` bila kolom kosong |
| M No. Resi | `row[12]` | `resi` | `SPXID0091827364` | Bernilai `-` bila belum tersedia |
| N Catatan Pembeli | `row[13]` | `note` | `Tolong bubble wrap` | Perlu di-escape |
| O Kota Tujuan | `row[14]` | `city` | `Bandung` | Dipakai pada slip dan label |
| P Waktu Sinkronisasi | `row[15]` | `syncTime` | `27/09/2026 09:20` | Berguna sebagai jejak audit saat dicetak |

Tiga nilai sentinel perlu diperhatikan saat menyusun dokumen, karena semuanya berarti "tidak ada data":

| Nilai | Arti | Penanganan |
|---|---|---|
| `-` pada `sku`, `variation`, `resi` | Kolom kosong di sheet | Tampilkan sebagai kosong atau sebagai keterangan, jangan sebagai tanda hubung mentah |
| `Lainnya` pada `courier` | Kolom ekspedisi kosong | Tetap ditampilkan apa adanya |
| String kosong pada `note` | Pembeli tidak menulis catatan | Sembunyikan blok catatan, jangan cetak kotak kosong |

### 5.2 Payload lengkap `getDashboardData()`

Bentuk pengembalian tercatat di `gas/SheetManager.js:754` sampai `gas/SheetManager.js:766`:

```text
{
  stats:         { totalOrders, ordersToday, siapPacking, menungguPickup,
                   sedangDikirim, selesai, batal, totalRevenue },
  orders:        [ objek pesanan pada 5.1 ],   // maksimum 80 baris
  courierStats:  { "SPX Express": 612, "J&T Express": 281, ... },
  topSkus:       [ { sku, qty } ],             // maksimum 5, urut menurun
  token:         { hasToken, shopId, expiredAtWIB, statusText,
                   isExpired, remainingMinutes },
  logs:          [ { time, action, count, status, detail } ],   // maksimum 7
  config:        { KEY: VALUE },               // isi sheet Konfigurasi
  isTriggerActive: true | false,
  statusOptions: [ '[0] Menunggu Pembayaran', '[1] Siap Packing',
                   '[2] Menunggu Pickup', '[3] Sedang Dikirim',
                   '[4] Selesai', '[5] Pengajuan Batal', '[6] Dibatalkan' ],
  webAppUrl:     'https://script.google.com/macros/s/.../exec',
  nowWIB:        '2026-09-27 09:20:11'
}
```

`stats.totalRevenue` dan `stats.totalOrders` sudah dihitung dari pesanan unik, bukan dari jumlah baris produk. Gunakan keduanya untuk ringkasan, dan jangan menjumlah ulang dari `orders` karena `orders` sudah terpotong pada 80 baris.

### 5.3 Fungsi yang sudah ada dan sebaiknya dipakai ulang

Kit PDF tidak perlu membawa helper baru. Tiga fungsi berikut sudah tersedia di `gas/Index.html` dan dapat dipanggil langsung bila kit disisipkan ke blok `<script>` yang sama:

| Fungsi | Lokasi | Kegunaan |
|---|---|---|
| `esc(value)` | `gas/Index.html:1246` | Meng-escape `&`, `<`, `>`, `"`, dan `'`. Aman untuk isi teks maupun nilai atribut |
| `rupiah(value)` | `gas/Index.html:1261` | Mengubah `175000` menjadi `Rp 175.000` dengan locale `id-ID` |
| `showToast(message, type)` | `gas/Index.html:1317` | Notifikasi `success`, `error`, atau `loading` memakai gaya yang sudah ada |

Menggunakan ulang ketiganya menjaga agar PDF dan tampilan dashboard memformat angka dengan cara yang sama. Bila kit dipindahkan ke berkas terpisah, ketiga helper itu harus ikut disalin.

### 5.4 Catatan tentang properti `date`

Properti `date` berasal dari `String(row[1])` pada sheet (`gas/SheetManager.js:606`), sehingga bentuknya bergantung pada bagaimana sel terbaca. Nilai yang sudah berupa tampilan siap pakai seperti `27/09/2026 09:14` sebaiknya dipakai apa adanya. Bila nilainya berupa string objek tanggal JavaScript, perlu dinormalkan lebih dulu:

```javascript
function fmtTanggalId(value) {
  if (!value) return '-';
  var teks = String(value).trim();

  // Sudah berupa tampilan siap pakai dari sheet, misalnya "27/09/2026 09:14"
  if (/^\d{2}\/\d{2}\/\d{4}/.test(teks)) return teks;

  var tanggal = new Date(teks);
  if (isNaN(tanggal.getTime())) return teks;

  return tanggal.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
```

Untuk nama berkas, selalu pakai bentuk tanpa garis miring. Fungsi `yyyymmdd()` pada Lampiran A menangani hal ini.

---

## 6. Modul A: Cetak Slip Packing (Jalur yang Sudah Terpasang)

Bagian ini mendokumentasikan jalur cetak yang sudah ada, lalu menunjukkan cara menambah variasi slip baru tanpa menyentuh yang lama.

### 6.1 Anatomi slip yang tercetak sekarang

Seluruh slip dibangun oleh satu fungsi, `slipFor(order)` di `gas/Index.html:2045`. Susunannya:

| Bagian | Kelas | Isi | Baris |
|---|---|---|---|
| Kop kiri | `.slip-brand` | Nama toko `b e g o o d . b d g` | `gas/Index.html:2050` |
| Kop kiri, baris dua | `.slip-kicker` | Keterangan `Slip packing gudang` | `gas/Index.html:2051` |
| Kop kanan | `.num` | Nomor pesanan | `gas/Index.html:2054` |
| Kop kanan, baris dua | `.slip-kicker` | Tanggal pesanan | `gas/Index.html:2055` |
| Blok penerima | `.slip-party` | Nama pembeli dan kota tujuan | `gas/Index.html:2058` |
| Blok pengiriman | `.slip-party .right` | Ekspedisi dan nomor resi, atau `RESI BELUM TERSEDIA` | `gas/Index.html:2064` |
| Daftar barang | `table` di dalam `.slip` | Kolom Cek, Produk, SKU, Variasi, Qty | `gas/Index.html:2071` |
| Catatan pembeli | `.notice` | Hanya muncul bila pembeli menulis catatan | `gas/Index.html:2085` |
| Kaki dokumen | `.slip-foot` | Status internal dan waktu cetak | `gas/Index.html:2089` |

Dua keputusan pada slip ini perlu dipertahankan saat menambah variasi baru:

1. **Kolom Cek berisi kotak kosong** `[   ]` yang dicentang manual oleh petugas, bukan kotak centang interaktif. Saat mencetak, kotak centang HTML tidak berguna karena kertas tidak bisa diklik.
2. **Resi kosong ditulis sebagai keterangan**, bukan sebagai tanda hubung. Tanda hubung pada kolom resi mudah terbaca sebagai nomor resi yang sah.

### 6.2 Kontrak data slip yang digeneralisasi

Bila nanti perlu slip dengan bentuk lain (misalnya slip retur atau slip pengiriman antar cabang), pakai bentuk payload berikut agar penyusun dokumen hanya ditulis sekali:

```javascript
var slipPayload = {
  brand:   { nama: 'b e g o o d . b d g', tagline: 'Slip packing gudang' },
  judul:   'SLIP PACKING',
  nomor:   '260927A1B2C3',            // nomor pesanan, tampil di kop kanan
  tanggal: '27/09/2026 09:14',
  penerima: {
    nama: 'Rina Kartika',
    kota: 'Bandung'
  },
  pengiriman: {
    ekspedisi: 'SPX Express',
    resi: 'SPXID0091827364'             // string kosong bila belum ada
  },
  tabel: {
    headers: ['Produk', 'SKU', 'Variasi', 'Qty'],
    rows: [
      ['Kaos Polos Premium', 'BG-KS-001', 'Hitam, L', '2 pcs']
    ]
  },
  kalkulasi: [                          // opsional
    { label: 'Total Belanja', value: 'Rp 175.000' },
    { label: 'Ongkir', value: 'Rp 12.000' }
  ],
  catatan: 'Tolong bubble wrap',        // string kosong menyembunyikan blok catatan
  ttd:     { kiri: 'Petugas Packing', kanan: 'Kurir' }
};
```

Perbedaan dari bentuk payload generik pada banyak panduan porting: blok `potongan` (rincian kasbon, saldo, cicilan) **tidak dipakai** di sini karena ERP Begood tidak mengelola penggajian. Yang dibutuhkan adalah blok `kalkulasi` ringkas untuk total belanja dan ongkir, plus `catatan` pembeli.

### 6.3 Menambah variasi slip tanpa menyentuh jalur yang lama

Alur yang aman, semuanya bersifat menambah:

1. Buat fungsi penyusun baru, misalnya `slipReturFor(order)`, dengan pola yang sama seperti `slipFor()`.
2. Buat fungsi pratinjau baru yang memanggil `openModal()` dan menulis ke wadah sendiri, misalnya `#retur-area`. Jangan menulis ke `#print-area`, karena aturan cetak di `gas/Index.html:585` hanya mengenali `#print-modal`.
3. Bila ingin memakai modal yang sama, cukup ubah isi `#print-area` dari fungsi baru, lalu panggil `openModal('print-modal')`.
4. Tambahkan tombol pemanggil dengan kelas `.btn` yang sudah ada.

Aturan umum: satu dokumen, satu fungsi penyusun. Bila dua tombol menyusun slip dengan cara yang berbeda, cepat atau lambat keduanya akan menghasilkan slip yang tidak identik untuk pesanan yang sama.

### 6.4 Aturan wajib saat menulis slip baru

| Aturan | Alasan |
|---|---|
| Escape setiap nilai dari sheet memakai `esc()` | Nama pembeli dan catatan bisa memuat `<`, `&`, atau `"` |
| Sembunyikan blok yang kosong, jangan mencetak kotak kosong | Kotak catatan tanpa isi hanya membingungkan petugas |
| Tulis keterangan bila resi belum ada | Tanda hubung mudah disalahartikan sebagai resi sah |
| Selalu cetak waktu cetak | Slip yang tertukar antar sesi bisa ditelusuri |
| Pertahankan `id` `#print-modal` dan `#print-area` | Aturan cetak dan `openModal()` mengandalkan keduanya |
| Jangan memakai lebar piksel tetap pada elemen slip | Slip juga dicetak dari sidebar yang sempit |

### 6.5 Ukuran kertas khusus untuk printer thermal

Bila slip akan dicetak ke printer label thermal, ukuran kertas bisa ditentukan lewat aturan `@page`:

```css
@media print {
  @page {
    size: 100mm 150mm;
    margin: 4mm;
  }
}
```

Catatan penting: aturan `@page` berlaku untuk seluruh dokumen, bukan hanya slip. Bila dashboard ini juga dipakai untuk mencetak ke kertas A4, menambahkan `@page` akan mengubah semua hasil cetak. Dua cara yang aman:

1. Tambahkan `@page` hanya bila seluruh pemakaian dashboard memang untuk printer thermal.
2. Bila butuh keduanya, sisipkan elemen `<style>` berisi `@page` secara sementara saat mencetak label, lalu hapus setelah `window.print()` selesai.

Untuk label berukuran tetap yang berulang, jsPDF pada bagian 9 lebih tepat daripada mengatur `@page`.

### 6.6 Satu pesanan bisa terdiri dari beberapa baris

Ini kondisi data yang wajib dipahami sebelum menambah dokumen apa pun, karena daftar pesanan di dashboard bukan daftar pesanan unik.

Sheet `Pesanan Masuk` memecah satu pesanan menjadi beberapa baris ketika pembeli membeli lebih dari satu produk atau variasi (lihat `docs/struktur-spreadsheet.md` bagian 2). `getDashboardSummary()` menyimpan satu entri untuk setiap baris sheet (`gas/SheetManager.js:640`), sehingga beberapa entri bisa memiliki `orderSn` yang sama dan berbeda pada `items`, `sku`, `variation`, serta `qty`.

Akibatnya, tiga jalur cetak yang ada sekarang memperlakukan pesanan multi-produk secara berbeda:

| Fungsi | Cara mengambil data | Yang terlihat pengguna |
|---|---|---|
| `printSingleOrder(orderSn)` | `Array.find()` di `gas/Index.html:2030` | Satu slip, memuat produk pertama saja |
| `printSingleOrderFromModal()` | Memakai `activeModalOrder` yang juga berasal dari `find()` di `gas/Index.html:1965` | Satu slip, memuat produk pertama saja |
| `printSelectedOrders()` | `Array.filter()` di `gas/Index.html:2042` | Beberapa slip dengan nomor pesanan sama, satu slip per baris produk |

Perlu dicatat bahwa perubahan status internal tidak mengalami hal ini: `changeInternalStatus()` memperbarui seluruh baris dengan `orderSn` yang sama (`gas/Index.html:1832` sampai `gas/Index.html:1836`).

Untuk setiap dokumen baru (slip PDF, rekap, label), kelompokkan baris lebih dulu agar satu pesanan menghasilkan satu dokumen:

```javascript
/**
 * Mengelompokkan baris pesanan menjadi satu kelompok per nomor pesanan.
 * Baris pertama dipakai untuk data pengiriman, seluruh baris dipakai untuk daftar barang.
 */
function groupOrdersBySn(rows) {
  var peta = {};
  var urutan = [];

  (rows || []).forEach(function (baris) {
    var sn = String(baris.orderSn || '').trim();
    if (!sn) return;

    if (!peta[sn]) {
      peta[sn] = { kepala: baris, barang: [] };
      urutan.push(sn);
    }
    peta[sn].barang.push(baris);
  });

  return urutan.map(function (sn) { return peta[sn]; });
}
```

Setiap kelompok memiliki `kepala` (dipakai untuk pembeli, kota, ekspedisi, resi, dan tanggal) dan `barang` (dipakai untuk mengisi tabel daftar barang pada slip). Untuk slip packing, tabel barang biasanya berisi satu baris, tetapi kode harus tetap benar bila berisi lebih dari satu.

Apakah tiga jalur lama juga perlu diperbaiki agar konsisten, itu keputusan pemilik project. Yang penting, jangan menambah jalur keempat yang memperlakukan data dengan cara berbeda lagi.

---

## 7. Modul B: Export PDF Slip Packing per Pesanan

Modul ini menghasilkan berkas `.pdf` slip packing. Dipakai untuk arsip, atau untuk mengirim slip ke pihak lain tanpa harus mencetak.

### 7.1 Ukuran kertas dan konstanta layout

Ukuran dipilih menurut cara slip akan dipakai:

| Format | Lebar x Tinggi (mm) | Pemakaian |
|---|---|---|
| A5 portrait | 148 x 210 | Slip packing untuk printer kantor, paling nyaman dibaca |
| A6 portrait | 105 x 148 | Slip ringkas untuk kertas kecil |
| Label 100 x 150 | 100 x 150 | Mendekati label 4 x 6 inci (101,6 x 152,4 mm), ukuran umum printer thermal |
| A4 portrait | 210 x 297 | Beberapa slip dalam satu lembar, lihat bagian 9 |

Konstanta untuk A5 portrait, yang menjadi acuan modul ini:

```javascript
var pageW = 148;      // mm
var pageH = 210;
var margin = 8;
var rowH = 7;         // tinggi satu baris tabel
var headH = 8;        // tinggi baris judul tabel
var lineStep = 3.2;   // jarak baris teks saat kalimat dibungkus
var perPage = 24;     // batas atas jumlah baris per halaman
```

Lebar kolom harus dijumlahkan agar sama dengan `pageW - (margin * 2)`. Untuk A5 portrait dengan margin 8, total lebar kolom adalah 132 mm.

### 7.2 Rumus pagination

**Jangan** membagi sisa ruang halaman dengan tinggi baris tetap. Cara itu gagal begitu ada teks yang dibungkus: satu baris yang teksnya panjang menjadi dua kali lebih tinggi, sehingga jumlah baris yang dianggap muat ternyata melebihi halaman dan baris terakhir menembus kaki dokumen.

Contoh nyata dari pengujian di bagian 12: rekap 120 baris dengan nama pembeli panjang memakai tinggi baris 6,5 mm saat dihitung, tetapi tinggi sebenarnya menjadi 11,1 mm karena teks dibungkus. Hasilnya 852 elemen tergambar di luar batas halaman.

Cara yang benar adalah mengukur tinggi setiap baris lebih dulu, lalu mengisi halaman sampai ruangnya habis:

```javascript
// Ukur tinggi satu baris tanpa menggambarnya
function ukurTinggiBaris(doc, layout, cells, isHeader) {
  if (isHeader) return layout.headH;

  var colW = layout.tabelW / cells.length;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(layout.fontSize);

  var barisTertinggi = 1;
  for (var i = 0; i < cells.length; i++) {
    var teks = String(cells[i] === null || cells[i] === undefined ? '' : cells[i]);
    var jumlah = doc.splitTextToSize(teks, colW - 2.4).length || 1;
    if (jumlah > barisTertinggi) barisTertinggi = jumlah;
  }

  // Batasi agar satu baris tidak pernah lebih tinggi dari satu halaman
  if (barisTertinggi > BARIS_MAKS) barisTertinggi = BARIS_MAKS;

  return Math.max(layout.rowH, (barisTertinggi * layout.lineStep) + 2.4);
}

// Isi halaman sampai ruangnya habis
var ruangHalaman1 = pageH - margin - page1HeaderH - headH - footerH;
var ruangHalamanN = pageH - margin - 10 - headH - footerH;

var halaman = [];
var isi = [];
var terpakai = 0;
var ruang = ruangHalaman1;

barang.forEach(function (item) {
  var tinggi = ukurTinggiBaris(doc, layout, item, false);
  if (isi.length > 0 && (terpakai + tinggi) > ruang) {
    halaman.push(isi);
    isi = [];
    terpakai = 0;
    ruang = ruangHalamanN;
  }
  isi.push(item);
  terpakai += tinggi;
});
halaman.push(isi);
```

Tiga hal yang menentukan hasil akhir:

1. Hitung `halaman` **sebelum** menggambar, lalu pakai `halaman.length` sebagai jumlah halaman total. Bila dihitung setelah penggambaran, nomor halaman pada kaki dokumen akan salah.
2. **Rumus ukur dan rumus gambar harus identik**, termasuk batas `BARIS_MAKS`. Bila keduanya berbeda satu baris saja, akan ada baris yang menembus kaki halaman atau ruang yang terbuang.
3. `BARIS_MAKS` (dipakai nilai 4) membatasi tinggi satu baris. Tanpa batas itu, satu sel berisi teks 400 karakter dapat menghasilkan baris setinggi satu halaman dan memaksa dokumen keluar dari batas.

Batasan yang tetap berlaku: satu baris data tidak boleh dipotong ke halaman berikutnya. Bila satu baris lebih tinggi daripada sisa ruang, baris itu pindah ke halaman baru secara utuh.


### 7.3 Urutan menggambar

```javascript
function buildSlipPdf(JsPDF, kelompok) {
  var pageW = 148, pageH = 210, margin = 8, headH = 8, rowH = 7;
  var colWidths = [70, 34, 28];           // total 132 = pageW - (margin * 2)
  var colStarts = [margin];
  for (var i = 1; i < colWidths.length; i++) {
    colStarts.push(colStarts[i - 1] + colWidths[i - 1]);
  }

  var kepala = kelompok.kepala;
  var barang = kelompok.barang || [];
  var halaman = potongHalaman(barang);
  var totalHalaman = halaman.length;

  var doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, pageH] });

  for (var p = 0; p < totalHalaman; p++) {
    if (p > 0) doc.addPage([pageW, pageH], 'portrait');

    var y = margin;
    if (p === 0) y = gambarKopDanPenerima(doc, kepala, y, pageW, margin);
    y = gambarJudulTabel(doc, colStarts, colWidths, y, headH);

    if (halaman[p].length === 0) {
      y = gambarBarisKosong(doc, y, colWidths, colStarts, rowH);
    } else {
      halaman[p].forEach(function (item) {
        y = gambarBarisBarang(doc, item, y, colStarts, colWidths, rowH);
      });
    }

    gambarKakiHalaman(doc, pageW, pageH, p + 1, totalHalaman);
  }

  return doc;
}
```

### 7.4 Teknik menggambar yang menentukan kerapian hasil

| Teknik | Kode | Alasan |
|---|---|---|
| Tinggi baris mengikuti panjang teks | `var lines = doc.splitTextToSize(teks, colWidths[0] - 3); var h = Math.max(rowH, lines.length * lineStep + 2.5);` | Nama produk dan SKU panjang tidak menimpa baris berikutnya |
| Angka rata kanan dengan posisi yang benar | `doc.text(nilai, colStarts[2] + colWidths[2] - 1.5, y + h - 2, { align: 'right' })` | Rata kanan tanpa menyesuaikan posisi `x` membuat teks keluar dari sel |
| Kotak centang digambar manual | `doc.rect(x, y, 3.8, 3.8)` | jsPDF tidak menyediakan komponen kotak centang |
| Warna teks dikembalikan setelah dipakai | `doc.setTextColor(60)` lalu `doc.setTextColor(0)` | Warna kaki halaman tidak menular ke halaman berikutnya |
| Ketebalan garis ditentukan eksplisit | `doc.setDrawColor(0); doc.setLineWidth(0.2);` | Garis tabel konsisten, tidak terlihat pudar |
| Huruf diperkecil bila teks terlalu panjang | `pdfKit.fitText(doc, teks, lebarMaks, 9, 6)` pada Lampiran A | Nama ekspedisi atau kota yang panjang tetap terbaca utuh |

### 7.5 Penamaan berkas yang aman

Nama berkas wajib dibersihkan sebelum dipakai. Nomor pesanan sudah berformat teks di sheet dan aman, tetapi nama pembeli bisa memuat garis miring, titik dua, atau tanda kutip yang membuat `doc.save()` gagal tanpa pesan galat.

```javascript
var namaAman = String(kepala.buyer || 'pesanan')
  .replace(/[^\w\s-]/g, '')      // buang semua kecuali huruf, angka, spasi, dan tanda hubung
  .replace(/\s+/g, '_');         // spasi menjadi garis bawah

doc.save('SlipPacking_' + kepala.orderSn + '_' + namaAman + '.pdf');
```

Pakai `safeFilename()` pada Lampiran A bila tidak ingin menulis regex sendiri.

---

## 8. Modul C: Export PDF Rekap Tabel

Modul ini menghasilkan satu berkas PDF berisi tabel rekap, dengan judul kolom yang berulang di setiap halaman. Dipakai untuk rekap pesanan, rekap log aktivitas, dan laporan per ekspedisi.

### 8.1 Tiga rekap yang bisa dibangun dari payload sekarang

| Rekap | Sumber data | Baris maksimum | Catatan |
|---|---|---|---|
| Daftar pesanan sesuai filter | `currentFilteredOrders` | 80 pada "Semua status", sampai 500 per status | Status selain "Semua status" memakai `getOrderRowsByStatus()`, lihat bagian 8.5 |
| Rekap ekspedisi | `globalData.courierStats` | Sebanyak jumlah ekspedisi | Angkanya dihitung dari pesanan unik |
| Log aktivitas | `globalData.logs` | 7 | Hanya 7 catatan terakhir |

Rekap pesanan sebaiknya memakai `currentFilteredOrders`, bukan `globalData.orders`, karena itulah yang sedang dilihat pengguna. Ini juga yang dilakukan `exportTableToCSV()` di `gas/Index.html:1906`, sehingga PDF dan CSV memuat baris yang sama.

Perhatikan batas 80 baris. Bila pengguna menyaring ke "Semua kurir" dan "Semua status", rekap tetap berisi paling banyak 80 baris walaupun sheet memuat lebih banyak. Bagian 8.3 menjelaskan cara mengatasinya.

### 8.2 Satu fungsi rekap untuk semua tabel

Semua rekap memakai satu fungsi yang menerima larik dua dimensi, dengan baris pertama sebagai judul kolom:

```javascript
pdfKit.exportTable({
  filename: 'Rekap_Pesanan_20260927',
  title: 'Rekap Pesanan Masuk',
  subtitle: 'Toko b e g o o d . b d g, 27 September 2026',
  rows: [
    ['No. Pesanan', 'Tanggal', 'Pembeli', 'Ekspedisi', 'No. Resi', 'Status', 'Total'],
    ['260927A1B2C3', '27/09/2026 09:14', 'Rina Kartika', 'SPX Express',
     'SPXID0091827364', '[1] Siap Packing', 'Rp 175.000']
  ]
});
```

Cara membangun `rows` dari data yang sudah ada:

```javascript
function rekapPesananRows() {
  var rows = [REKAP_HEADERS.slice()];

  currentFilteredOrders.forEach(function (order) {
    rows.push(rekapBaris_(order, Number(order.qty) || 1));
  });

  return rows;
}
```

`REKAP_HEADERS` dan `rekapBaris_()` dipakai bersama oleh rekap dari layar dan rekap penuh dari sheet, sehingga kedua berkas selalu memuat kolom yang sama. Kolom pertamanya adalah `Toko`, dan pada cakupan satu toko isinya seragam.

`rupiah()` dari `gas/Index.html:1261` dipakai langsung, sehingga angka pada PDF sama persis dengan angka di layar dan di CSV.

### 8.3 Rekap lebih dari 80 baris

Bila rekap penuh memang dibutuhkan, tambahkan RPC baru. Sifatnya menambah fungsi, bukan mengubah yang sudah ada. Pola berikut mengikuti gaya penulisan di `gas/Code.js`, yaitu `var`, deklarasi fungsi, dan indentasi dua spasi.

Tambahkan pada objek yang dikembalikan `gas/SheetManager.js`:

```javascript
/**
 * Membaca baris pesanan langsung dari sheet untuk kebutuhan ekspor.
 * Berbeda dari getDashboardSummary(), fungsi ini tidak memotong jumlah baris.
 */
getOrderRowsForExport: function(limit) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var orderSheet = ss.getSheetByName(SHEETS.ORDERS);
  if (!orderSheet) return [];

  var lastRow = orderSheet.getLastRow();
  if (lastRow < 2) return [];

  var maxBaris = Number(limit) || 2000;
  var mulai = Math.max(2, lastRow - maxBaris + 1);
  var nilai = orderSheet.getRange(mulai, 1, lastRow - mulai + 1, 16).getValues();

  return nilai
    .map(function(row) {
      return {
        orderSn: String(row[0] || '').trim(),
        date: String(row[1] || ''),
        shopeeStatus: String(row[2] || ''),
        internalStatus: String(row[3] || ''),
        buyer: String(row[4] || ''),
        items: String(row[5] || ''),
        sku: String(row[6] || '').trim() || '-',
        variation: String(row[7] || '-') || '-',
        qty: Number(row[8]) || 1,
        totalAmount: Number(row[9]) || 0,
        shippingFee: Number(row[10]) || 0,
        courier: String(row[11] || '').trim() || 'Lainnya',
        resi: String(row[12] || '-'),
        note: String(row[13] || ''),
        city: String(row[14] || ''),
        syncTime: String(row[15] || '')
      };
    })
    .filter(function(item) { return item.orderSn !== ''; });
}
```

Pemetaan 16 kolomnya sengaja ditulis sama persis seperti pada `mapBarisPesanan_()` di `gas/SheetManager.js:203` sampai `gas/SheetManager.js:221`, termasuk nilai bawaan `Lainnya` untuk ekspedisi dan `-` untuk SKU, variasi, serta resi. Dengan begitu objek yang dihasilkan dapat dipakai oleh fungsi penyusun dokumen yang sama.

Lalu tambahkan pada `gas/Code.js`:

```javascript
/**
 * RPC: Membaca baris pesanan untuk ekspor PDF dengan jumlah baris penuh
 */
function getOrderRowsForExport(limit) {
  var rows = SheetManager.getOrderRowsForExport(limit);
  SheetManager.logActivity(
    'EXPORT_ORDER_ROWS',
    rows.length,
    'SUKSES',
    'Membaca ' + rows.length + ' baris pesanan untuk ekspor PDF via Dashboard.'
  );
  return rows;
}
```

Pencatatan lewat `SheetManager.logActivity()` membuat jejak ekspor muncul di sheet `Log_Aktivitas`, sama seperti aksi lain dari dashboard.

Pemanggilan dari dashboard tetap memakai pola `google.script.run` yang sudah ada:

```javascript
function exportRekapPesananPdf() {
  showToast('Menyiapkan rekap pesanan...', 'loading');

  google.script.run
    .withSuccessHandler(function (rows) {
      pdfKit.exportTable({
        filename: 'Rekap_Pesanan_Lengkap',
        title: 'Rekap Pesanan Masuk',
        subtitle: 'Toko b e g o o d . b d g',
        rows: rekapRowsFrom(groupOrdersBySn(rows))
      });
    })
    .withFailureHandler(function (err) {
      showToast('Rekap gagal disiapkan: ' + (err && err.message ? err.message : err), 'error');
    })
    .getOrderRowsForExport(2000);
}
```

Dua catatan penting untuk fungsi baru ini:

1. `getOrderRowsForExport` sengaja **tidak** memakai `CacheService`, berbeda dari `getDashboardData()` di `gas/Code.js:682`. Tujuan fungsi ini membaca data saat itu juga. Menambahkan cache pada jalur ekspor membuat hasilnya membingungkan ketika pengguna baru saja mengubah status pesanan.
2. Batas `limit` tetap diperlukan. Membaca seluruh sheet pada spreadsheet berisi puluhan ribu baris akan mendekati batas waktu eksekusi GAS.

### 8.4 Export langsung dari tabel yang terlihat

Pola ini menghindari penulisan ulang judul kolom: baca tabel HTML yang sedang tampil, lalu kirim apa adanya.

```javascript
function exportPanelPdf() {
  var tabel = document.querySelector('#content-orders table.ledger');
  var rows = pdfKit.tableFromElement(tabel);

  if (rows.length < 2) {
    showToast('Belum ada baris untuk diekspor.', 'error');
    return;
  }

  pdfKit.exportTable({
    filename: 'Rekap_' + pdfKit.yyyymmdd(new Date()),
    title: 'Daftar Pesanan Masuk',
    subtitle: 'Toko b e g o o d . b d g',
    rows: rows
  });
}
```

Pemilih `#content-orders table.ledger` mengacu pada tabel yang sudah ada di `gas/Index.html:876`.

Perlu diperhatikan: tabel HTML hanya memuat baris yang sedang ditampilkan, jadi hasilnya mengikuti pagination di layar. Bila rekap harus memuat seluruh hasil filter, ambil dari `currentFilteredOrders` seperti pada bagian 8.2, bukan dari DOM.

### 8.5 Filter status yang membaca sheet langsung

Filter status di dashboard tidak boleh hanya menyaring payload 80 baris, karena hasilnya bisa kosong walaupun sheet masih memuat antriannya. Karena itu filter selain "Semua status" memakai RPC tersendiri.

#### 8.5.1 RPC di sisi server

Di `gas/SheetManager.js` ada `getOrderRowsByStatus(statusKeyword, limit)`, dan di `gas/Code.js` ada pembungkus RPC dengan nama yang sama. Perilakunya:

| Aspek | Nilai | Alasan |
|---|---|---|
| Pembanding status | `indexOf` tanpa membedakan huruf besar kecil | Nilai di sheet berbentuk `[1] Siap Packing`, sedangkan kata kunci dari filter berbentuk `Siap Packing` |
| Urutan baca | Dari baris bawah ke atas | Baris terbaru muncul lebih dulu, sama seperti payload dashboard |
| `limit` | Bawaan 500 | Membatasi jumlah baris yang dikirim ke peramban |
| `jendelaBaca` | 5000 baris | Mencegah pembacaan puluhan ribu baris sekaligus |
| Pencatatan log | Tidak dicatat | Ini pembacaan untuk tampilan, bukan aksi ekspor. Bila setiap perubahan filter dicatat, sheet `Log_Aktivitas` akan penuh dalam sehari |

Pemetaan 16 kolomnya memakai satu fungsi bersama, `mapBarisPesanan_()`, yang juga dipakai `getOrderRowsForExport()`. Tujuannya agar bentuk objek dari kedua jalur selalu sama dan dapat diproses penyusun dokumen yang sama.

#### 8.5.2 Rantai di sisi peramban

| Fungsi atau variabel | Peran |
|---|---|
| `sumberBarisFilter_()` | Menentukan baris mana yang dipakai: payload untuk "Semua status", hasil RPC untuk status lain |
| `muatBarisStatus()` | Memanggil RPC, menyimpan hasilnya, lalu menyaring ulang |
| `cacheBarisStatus` | Cache per kata kunci status, supaya perpindahan filter berikutnya tidak memanggil server lagi |
| `semuaBarisPesanan_()` | Gabungan payload dan seluruh cache, untuk pencarian berdasarkan nomor pesanan |

Empat hal yang wajib dijaga bila bagian ini diubah:

1. **Cache harus dibersihkan** setiap `loadDashboard()` berhasil dan setiap kali status pesanan diubah lewat `changeInternalStatus()`. Tanpa itu, tabel dapat menampilkan status yang sudah lama.
2. **Pencarian berdasarkan nomor pesanan harus memakai `semuaBarisPesanan_()`**, bukan `globalData.orders`. Detail pesanan, cetak slip, dan ekspor slip mencari pesanan dari daftar itu, sehingga pesanan di luar 80 baris terbaru tetap dapat dibuka.
3. **Baris dengan nomor pesanan sama harus tetap terpisah.** Penyaringan duplikat memakai identitas `orderSn + sku + variation + items`, bukan hanya `orderSn`, karena satu pesanan bisa terdiri dari beberapa baris produk.
4. **Label tab pesanan harus mengikuti jumlah baris yang benar-benar ditampilkan.** Sebelumnya label menulis 80 walaupun sheet memuat lebih dari seribu pesanan.

#### 8.5.3 Pilihan filter disusun dari data sheet

Daftar pilihan pada filter status **tidak** ditulis tetap di kode. Dashboard memanggil `getStatusInventory()`, yang menghitung jumlah baris untuk setiap nilai di kolom D, lalu menyusun pilihan dari hasil itu. Urutannya: status resmi lebih dulu sesuai `STATUS_OPTIONS`, lalu nilai lain yang ditemukan di sheet. Setiap pilihan menampilkan jumlahnya, misalnya `[1] Siap Packing (23)`.

Alasan memilih cara ini:

| Masalah bila daftar ditulis tetap | Akibatnya |
|---|---|
| Nilai di kolom D berbeda dari daftar resmi, misalnya `Siap Packing` tanpa awalan `[1]` | Dulu: pilihan tidak tersedia sehingga data tidak bisa disaring. Sekarang: nilai itu muncul sebagai pilihannya sendiri |
| Kolom D kosong pada sebagian baris | Dulu: baris tersebut tidak pernah muncul di filter mana pun. Sekarang: muncul sebagai `(kolom D kosong)` |
| Status dari Shopee yang tidak dikenal, misalnya `TO_CONFIRM_RECEIVE` | Middleware mengembalikan status mentahnya (`gas/../middleware/src/services/order.service.ts`), dan dulu baris itu tidak terjangkau filter. Sekarang: muncul dengan jumlahnya |

Bila kolom D memang berisi nilai yang tidak seharusnya, daftar filter menjadi tempat pertama yang memperlihatkannya, sehingga perbaikannya bisa dimulai dari sana.

#### 8.5.4 Mendeteksi versi server yang belum diperbarui

Perubahan pada `gas/SheetManager.js` dan `gas/Code.js` hanya terpakai setelah deployment Web App dibuat ulang. Bila belum, fungsi barunya tidak ada di sisi server sehingga filter status kembali menyaring 80 baris terbaru saja. Ini kondisi yang mudah disalahartikan sebagai "data tidak muncul".

Karena itu dashboard memeriksa sendiri:

| Keadaan | Tampilan |
|---|---|
| RPC tersedia | Tidak ada catatan apa pun; pilihan filter memuat jumlah per status |
| RPC tidak tersedia | Muncul catatan tetap di atas tabel: fungsi server mana yang belum ada, berapa baris yang sedang disaring, dan dua jalan keluarnya (buat deployment versi baru, atau buka ulang panel dari menu Spreadsheet) |
| RPC gagal saat filter dipakai | Pesan tabel menjelaskan bahwa datanya kemungkinan ada di sheet tetapi di luar baris yang dimuat, lalu mengarahkan ke catatan di atas tabel |

Catatan itu sengaja dibuat menetap, bukan notifikasi sesaat, karena masalahnya tidak hilang sampai deployment diperbarui. Notifikasi sesaat untuk keadaan seperti ini akan terlewat begitu saja.

Satu hal yang perlu diingat tentang Apps Script: menu di spreadsheet selalu menjalankan kode terbaru, sedangkan alamat `/exec` menyajikan **versi yang pernah di-deploy**. Jadi dua pintu masuk itu bisa memakai kode yang berbeda sampai deployment baru dibuat.



---

## 9. Modul D: Batch, Label Alamat, dan Thermal

Modul ini untuk dokumen yang dicetak banyak sekaligus dalam ukuran tetap. Semuanya memakai jsPDF, karena ukuran kertasnya tidak standar dan hasilnya harus identik satu sama lain.

### 9.1 Beberapa slip dalam satu lembar

Aritmetika kertasnya ditulis eksplisit agar jumlah sel per lembar tidak perlu ditebak:

| Format sel | Susunan pada A4 portrait (210 x 297 mm) | Jumlah per lembar | Perhitungan |
|---|---|---|---|
| A5 landscape (210 x 148 mm) | 1 kolom, 2 baris | 2 slip | tinggi 148 x 2 = 296 mm, masih di bawah 297 mm |
| A6 portrait (105 x 148 mm) | 2 kolom, 2 baris | 4 slip | lebar 105 x 2 = 210 mm, tinggi 148 x 2 = 296 mm |

Karena jsPDF tidak punya perintah untuk menggeser titik asal gambar, fungsi penggambar harus menerima titik awal `x0` dan `y0`, lalu menambahkan keduanya pada setiap koordinat:

```javascript
var selW = 105, selH = 148;      // ukuran sel A6
var kolom = 2, baris = 2;
var perLembar = kolom * baris;   // 4 slip per lembar A4

function gambarSlipDiSel(doc, kelompok, x0, y0) {
  // Semua koordinat di dalam fungsi ini memakai pola (x0 + x) dan (y0 + y)
  var y = y0 + 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(String(kelompok.kepala.orderSn), x0 + 6, y);
  // Lanjutkan menggambar isi slip dengan pola yang sama
}

function buildBatchSlipPdf(JsPDF, kelompokList) {
  var doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  kelompokList.forEach(function (kelompok, i) {
    if (i > 0 && i % perLembar === 0) doc.addPage('a4', 'portrait');

    var slot = i % perLembar;
    var x0 = (slot % kolom) * selW;
    var y0 = Math.floor(slot / kolom) * selH;

    gambarSlipDiSel(doc, kelompok, x0, y0);
  });

  return doc;
}
```

Bila satu lembar akan dipotong menjadi beberapa slip, tambahkan garis potong tipis di tepi setiap sel. Tanpa garis potong, ukuran potongan menjadi tidak konsisten.

### 9.2 Label alamat paket

Label alamat dicetak satu per halaman dengan format kustom, dan biasanya memuat lebih sedikit informasi daripada slip packing: penerima, kota, ekspedisi, dan nomor resi dalam ukuran besar.

```javascript
var lebarLabel = 100;    // mm, mendekati label 4 inci
var tinggiLabel = 150;   // mm, mendekati label 6 inci

function buildLabelPdf(JsPDF, kelompokList) {
  var doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [lebarLabel, tinggiLabel]
  });

  kelompokList.forEach(function (kelompok, i) {
    if (i > 0) doc.addPage([lebarLabel, tinggiLabel], 'portrait');

    var kepala = kelompok.kepala;
    var margin = 6;
    var lebarIsi = lebarLabel - (margin * 2);

    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.rect(margin, margin, lebarIsi, tinggiLabel - (margin * 2));

    var y = margin + 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('PENERIMA', margin + 4, y);

    y += 6;
    doc.setFont('helvetica', 'bold');
    // Perkecil huruf bila nama penerima terlalu panjang
    pdfKit.fitText(doc, String(kepala.buyer || '-'), lebarIsi - 8, 16, 9);
    doc.splitTextToSize(String(kepala.buyer || '-'), lebarIsi - 8)
      .forEach(function (baris) {
        doc.text(baris, margin + 4, y);
        y += 7;
      });

    y += 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(String(kepala.city || '-'), margin + 4, y);

    // Nomor resi dibuat besar karena selalu dibaca dari jarak dekat
    y = tinggiLabel - margin - 26;
    doc.setLineWidth(0.3);
    doc.line(margin + 4, y - 8, lebarLabel - margin - 4, y - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('NO. RESI', margin + 4, y - 3);

    var resi = (kepala.resi && kepala.resi !== '-') ? kepala.resi : 'BELUM TERSEDIA';
    doc.setFont('helvetica', 'bold');
    pdfKit.fitText(doc, resi, lebarIsi - 8, 15, 9);
    doc.text(resi, margin + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(String(kepala.courier || '-'), margin + 4, y + 13);
  });

  return doc;
}
```

Tiga hal yang membuat label gagal kalau diabaikan:

1. **Nomor resi kosong harus ditulis sebagai keterangan**, bukan dibiarkan kosong. Label tanpa resi tidak bisa dipakai kurir, dan petugas harus tahu bahwa label itu memang belum lengkap.
2. **Nama penerima panjang harus diperkecil hurufnya** memakai `fitText()`. Nama yang meluber keluar kotak membuat label terlihat rusak.
3. **Ukuran format harus dipakai ulang pada `addPage()`**. Untuk format berupa larik milimeter, `addPage('a4')` akan menghasilkan halaman dengan ukuran yang salah.

### 9.3 Menggabungkan dengan pemilihan di dashboard

Label dan slip batch paling berguna bila dipanggil dari bilah aksi massal yang sudah ada, yaitu `#batch-action-bar` di `gas/Index.html:786`. Pola pemanggilannya:

```javascript
function cetakSlipPdfTerpilih() {
  if (selectedOrderSns.size === 0) {
    showToast('Centang pesanan yang akan dicetak lebih dulu.', 'error');
    return;
  }

  // Ambil seluruh baris, lalu kelompokkan agar satu pesanan menjadi satu slip
  var baris = globalData.orders.filter(function (order) {
    return selectedOrderSns.has(order.orderSn);
  });
  var kelompokList = groupOrdersBySn(baris);

  showToast('Menyiapkan ' + kelompokList.length + ' slip...', 'loading');

  pdfKit.withLib(function (JsPDF) {
    var doc = buildBatchSlipPdf(JsPDF, kelompokList);
    pdfKit.simpan(doc, 'SlipPacking_' + pdfKit.yyyymmdd(new Date()));
    showToast(kelompokList.length + ' slip siap diunduh.');
  });
}
```

Pemakaian `groupOrdersBySn()` di sini penting. Tanpa pengelompokan, pesanan yang terdiri dari tiga produk akan menghasilkan tiga slip terpisah dengan nomor pesanan yang sama, yaitu perilaku `printSelectedOrders()` yang dijelaskan pada bagian 6.6.

---

## 10. Langkah Integrasi ke gas/Index.html

Seluruh langkah pada bagian ini bersifat menambah. Tidak ada fungsi, `id`, atau atribut yang sudah ada yang perlu diubah, dan jalur cetak di bagian 2 tetap berjalan seperti sebelumnya.

### 10.1 Langkah 1: tambahkan jsPDF

Sisipkan satu baris pada bagian `<head>` di `gas/Index.html`, yaitu setelah tautan Font Awesome pada baris 11 dan sebelum tag `<style>` pada baris 13:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
        integrity="sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk"
        crossorigin="anonymous"></script>
```

Nilai `integrity` di atas bukan salinan dari panduan lain. Nilainya dihitung ulang dari berkas yang benar-benar disajikan cdnjs, dengan perintah berikut:

```bash
curl -sSL -o jspdf.umd.min.js \
  https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
openssl dgst -sha384 -binary jspdf.umd.min.js | openssl base64 -A
```

Keluaran perintahnya persis sama dengan nilai `integrity` di atas. Berkasnya juga mencantumkan `Version 2.5.1` pada blok lisensi di baris pertama. Setelah dimuat, pustakanya tersedia sebagai `window.jspdf.jsPDF`.

Bila CDN utama tidak dapat diakses, kit pada Lampiran A memuat dari sumber kedua:

```text
https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js
```

Bila project berjalan pada jaringan internal tanpa akses CDN, unduh berkasnya sekali, simpan sebagai berkas lokal di project, lalu hapus atribut `integrity` karena berkas lokal tidak lagi diverifikasi terhadap CDN.

### 10.2 Langkah 2: sisipkan kit

Kit disisipkan **di dalam blok `<script>` yang sudah ada**, tepat sebelum penanda BOOT pada `gas/Index.html:2227`:

```javascript
    /* ======================= BOOT ======================= */

    window.addEventListener('DOMContentLoaded', () => {
```

Sisipkan isi Lampiran A di atas baris penanda tersebut. Penempatan ini penting karena dua alasan:

1. Berada di blok yang sama berarti kit dapat memanggil `esc()`, `rupiah()`, dan `showToast()` langsung, tanpa perlu menyalin ulang.
2. Berada sebelum BOOT berarti fungsi kit sudah terdefinisi ketika dashboard mulai dimuat, sehingga tombol tidak pernah memanggil fungsi yang belum ada.

Jangan meletakkan kit sesudah blok BOOT, dan jangan menaruhnya di luar tag `<script>`.

### 10.3 Langkah 3: tambahkan tombol pemicu

Ada dua tempat pemasangan yang masuk akal, dan keduanya memakai kelas `.btn` yang sudah ada agar mengikuti tema terang dan gelap secara otomatis.

**Pilihan A, tombol per baris pada tabel pesanan.** Tambahkan satu tombol pada blok aksi baris yang dibangun di `gas/Index.html:1696`, di samping tombol detail dan tombol cetak:

```javascript
'<button type="button" class="btn btn-sm btn-icon" data-sn="' + sn + '"' +
  ' onclick="exportSlipPdf(this.dataset.sn)" title="Unduh slip packing sebagai PDF">' +
  '<i class="fa-solid fa-file-pdf" aria-hidden="true"></i>' +
  '<span class="sr-only">Unduh PDF</span></button>' +
```

**Pilihan B, tombol pada panel kendali.** Tambahkan di deretan tombol yang sama dengan tombol `Ekspor CSV` pada `gas/Index.html:760`:

```html
<button type="button" class="btn" onclick="exportRekapPesananPdf()"
        title="Unduh daftar pesanan yang sedang tampil sebagai berkas PDF">
  <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
  Ekspor PDF
</button>
```

Dua aturan saat memasang tombol:

1. Jangan memberi lebar piksel tetap. Dashboard juga dibuka di sidebar yang sempit, dan tombol dengan lebar tetap akan memaksa tabel melebar.
2. Sertakan `<span class="sr-only">` berisi nama aksi bila tombol hanya menampilkan ikon. Tanpa itu, tombol tidak dapat dibaca pembaca layar.

Fungsi pemanggil untuk Pilihan A:

```javascript
function exportSlipPdf(orderSn) {
  if (!globalData || !globalData.orders) return;

  var kelompokList = groupOrdersBySn(
    globalData.orders.filter(function (order) { return order.orderSn === orderSn; })
  );
  if (kelompokList.length === 0) {
    showToast('Pesanan ' + orderSn + ' tidak ditemukan di data yang sedang tampil.', 'error');
    return;
  }

  showToast('Menyiapkan slip PDF...', 'loading');

  pdfKit.withLib(function (JsPDF) {
    var doc = buildSlipPdf(JsPDF, kelompokList[0]);
    pdfKit.simpan(doc, 'SlipPacking_' + orderSn);
    showToast('Slip PDF siap diunduh.');
  });
}
```

### 10.4 Langkah 4: perubahan pada Code.js

Tanpa rekap penuh, `gas/Code.js` **tidak perlu diubah sama sekali**. Seluruh proses berjalan di peramban memakai data yang sudah dikirim `getDashboardData()`.

`gas/Code.js` hanya berubah bila memakai rekap lebih dari 80 baris pada bagian 8.3, yaitu menambah dua fungsi baru:

| Fungsi baru | Ditempatkan di | Sifat |
|---|---|---|
| `getOrderRowsForExport(limit)` | `gas/Code.js`, di antara fungsi RPC yang sudah ada | Menambah fungsi baru |
| `getOrderRowsForExport` sebagai properti objek | `gas/SheetManager.js`, di dalam objek yang dikembalikan | Menambah properti baru |

Konsekuensi yang perlu dicatat: menambah fungsi baru pada project Apps Script **memerlukan deploy ulang** Web App agar versi terbaru terpakai. Ini tidak berlaku untuk perubahan pada `gas/Index.html` saja, karena HTML selalu diambil dari versi terbaru saat halaman dimuat.

### 10.5 Alternatif: memisahkan kit sebagai berkas templat

Bila kit akan dipakai pada lebih dari satu halaman HTML, pisahkan menjadi berkas sendiri. Ini menuntut perubahan kecil pada pihak penyaji.

Ubah ketiga penyaji di `gas/Code.js` dari `createHtmlOutputFromFile('Index')` menjadi `createTemplateFromFile('Index').evaluate()`:

```javascript
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('ERP Begood - Dashboard Kontrol Shopee')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Skriplet pembantu untuk menyisipkan berkas HTML lain ke dalam templat */
function include(namaBerkas) {
  return HtmlService.createHtmlOutputFromFile(namaBerkas).getContent();
}
```

Tambahkan berkas HTML baru bernama `PdfKit` di editor Apps Script, lalu sisipkan pada `Index.html`:

```html
<?!= include('PdfKit'); ?>
```

Peringatan penting untuk pilihan ini: perlakuan yang sama harus diterapkan pada `openDashboardSidebar()` di `gas/Code.js:661` dan `openDashboardModal()` di `gas/Code.js:671`. Bila hanya satu penyaji yang diubah, dashboard akan berjalan benar dari satu pintu dan gagal dari pintu lain, dan gejalanya sulit dilacak karena halaman yang dimuat terlihat sama.

---

## 11. Cheat Sheet jsPDF dan Konstanta Layout

### 11.1 Perintah jsPDF yang dipakai

| Perintah | Fungsi | Contoh |
|---|---|---|
| `new jsPDF({ orientation, unit, format })` | Membuat dokumen | `{ orientation: 'portrait', unit: 'mm', format: [148, 210] }` |
| `doc.addPage(ukuran, orientasi)` | Menambah halaman | `doc.addPage([100, 150], 'portrait')` |
| `doc.setFontSize(n)` | Ukuran huruf dalam point | 6 sampai 9 untuk tabel kecil, 15 sampai 16 untuk nomor resi |
| `doc.setFont(family, style)` | Jenis dan gaya huruf | `doc.setFont('helvetica', 'bold')` |
| `doc.text(teks, x, y, { align })` | Menulis teks | `doc.text(nilai, x, y, { align: 'right' })` |
| `doc.splitTextToSize(teks, lebarMaks)` | Memotong teks menjadi larik baris | Dipakai untuk tinggi baris dinamis |
| `doc.getTextWidth(teks)` | Mengukur lebar teks pada huruf aktif | Dipakai oleh `fitText()` |
| `doc.rect(x, y, w, h)` | Menggambar kotak atau sel | Garis tabel dan kotak centang |
| `doc.line(x1, y1, x2, y2)` | Menggambar garis | Pemisah blok dan garis potong |
| `doc.setDrawColor(r, g, b)` | Warna garis | `doc.setDrawColor(0)` |
| `doc.setLineWidth(mm)` | Ketebalan garis | `0.2` untuk sel, `0.3` sampai `0.45` untuk kotak label |
| `doc.setTextColor(r)` | Warna teks | `doc.setTextColor(60)` untuk kaki halaman, lalu dikembalikan ke `doc.setTextColor(0)` |
| `doc.save(nama)` | Mengunduh berkas | Nama wajib sudah dibersihkan |
| `doc.output('bloburl')` | URL blob untuk dibuka di tab baru | Jalur cadangan, lihat bagian 4.4 |

### 11.2 Satuan dan konversi

- `unit: 'mm'` membuat semua koordinat dan ukuran memakai milimeter. Satu milimeter sama dengan 2,8346 point.
- Ukuran huruf tetap memakai point, walaupun halaman memakai milimeter. Untuk dokumen kecil, 6 sampai 9 point adalah rentang yang normal.
- Format kertas dapat berupa string (`'a4'`, `'a5'`, `'a6'`, `'letter'`) atau larik `[lebar, tinggi]` untuk ukuran bebas.
- Orientasi `'portrait'` atau `'landscape'`. Untuk format berupa larik, `addPage()` wajib memakai larik dan orientasi yang sama.

### 11.3 Anggaran ruang halaman A5 portrait (148 x 210 mm)

Anggaran ini yang menjadi dasar angka `page1HeaderH = 58` pada bagian 7.2:

| Elemen | Tinggi (mm) | Catatan |
|---|---|---|
| Margin atas dan bawah | 8 + 8 | `margin = 8` |
| Kop dokumen | 14 | Nama toko, keterangan, nomor pesanan, dan tanggal |
| Blok penerima dan pengiriman | 34 | Dua kolom, termasuk padding sel |
| Judul kolom tabel | 8 | `headH = 8` |
| Baris barang | 7 per baris | Bertambah otomatis bila teks dibungkus |
| Blok catatan pembeli | 12 | Hanya bila pembeli menulis catatan |
| Kaki halaman | 8 | Waktu cetak dan nomor halaman |
| Sisa untuk baris barang pada halaman pertama | sekitar 120 mm | Jumlah barisnya bergantung tinggi baris sebenarnya, bukan tinggi tetap, lihat bagian 7.2 |

Karena satu pesanan biasanya hanya memuat beberapa baris produk, slip packing hampir selalu cukup satu halaman. Pagination pada bagian 7.2 tetap diperlukan karena rekap tabel dan daftar log bisa panjang.

### 11.4 API peramban yang sudah dipakai dashboard

| API | Lokasi | Kegunaan untuk export |
|---|---|---|
| `window.print()` | `gas/Index.html:1181` | Mencetak slip dari pratinjau |
| `new Blob([...])` | `gas/Index.html:1928` | Menyusun berkas, pola yang sama dapat dipakai untuk berkas lain |
| `URL.createObjectURL()` | `gas/Index.html:1929` | Membuat URL sementara untuk berkas |
| `URL.revokeObjectURL()` | `gas/Index.html:1936` | Menghapus URL sementara setelah dipakai |

Pola `Blob` dan `createObjectURL` pada `exportTableToCSV()` adalah contoh yang sudah teruji di project ini untuk memicu unduhan dari dalam iframe Google. Pola ini dapat dipakai ulang bila suatu saat perlu menghasilkan berkas selain PDF.

---

## 12. Pengujian dan Checklist

### 12.1 Matriks uji

Jalankan pada ketiga konteks penyajian di bagian 4.1, karena sidebar dan modal tidak selalu berperilaku sama seperti Web App mandiri.

| No | Skenario | Hasil yang diharapkan |
|---|---|---|
| 1 | Rekap dengan nol baris | PDF tetap terbentuk dan menampilkan "Tidak ada data." |
| 2 | Rekap dengan satu baris | Satu halaman, tidak ada halaman kosong di belakang |
| 3 | Rekap tepat sebanyak kapasitas halaman pertama | Tidak ada baris yang terpotong di tepi bawah |
| 4 | Rekap satu baris lebih banyak dari kapasitas halaman pertama | Halaman kedua muncul, judul kolom terulang, kaki menulis "Halaman 2 / 2" |
| 5 | Rekap 200 baris | Jumlah baris pada PDF sama dengan jumlah baris sumber |
| 6 | SKU sangat panjang, misalnya `BC AJA 120x220 PUTIH PREMIUM` | Baris tumbuh, tidak menimpa baris berikutnya |
| 7 | Nama pembeli sangat panjang | Nama tetap berada di dalam kotak, atau hurufnya mengecil |
| 8 | Nominal besar, misalnya `Rp 1.234.567.890` | Rata kanan, tidak meluber keluar sel |
| 9 | Nama pembeli memuat garis miring, titik dua, atau tanda kutip | `doc.save()` tetap berhasil, nama berkas tersanitasi |
| 10 | Catatan pembeli memuat `<script>` atau `&` | Tidak ada markup yang tereksekusi, teks tampil utuh |
| 11 | Unduhan otomatis diblokir peramban | Jalur cadangan tab baru berjalan, atau muncul pesan yang jelas |
| 12 | CDN jsPDF tidak dapat diakses | Muncul pesan bahwa pustaka gagal dimuat, bukan tombol yang diam |
| 13 | Tombol export ditekan dua kali berturut-turut | Tidak ada berkas ganda dan tidak ada galat |
| 14 | Pesanan tanpa nomor resi | Slip dan label menulis "BELUM TERSEDIA", bukan ruang kosong dan bukan tanda hubung |
| 15 | Pesanan dengan tiga baris produk | Satu dokumen berisi tiga baris barang, bukan tiga dokumen |
| 16 | Dashboard dibuka di sidebar yang sempit | Tombol tetap dapat ditekan, tidak ada yang terpotong |
| 17 | Tema gelap aktif saat menekan tombol export | PDF tetap berlatar putih, tidak mengikuti tema dashboard |
| 18 | Sheet `Pesanan Masuk` masih kosong | Muncul pesan kosong yang menjelaskan cara mengisinya |
| 19 | Cetak slip dari pratinjau pada Chrome, Firefox, dan Safari | Tata letak sama, margin dan posisi blok sejajar |
| 20 | Tekan `Ctrl+P` tanpa membuka pratinjau slip | Peramban mencetak halaman dashboard, bukan halaman kosong |
| 21 | Filter "[1] Siap Packing" ketika antriannya di luar 80 baris terbaru | Tabel memuat baris dari sheet, bukan kosong |
| 22 | Ubah status satu baris sementara filter status aktif | Baris itu hilang dari daftar, dan daftarnya diambil ulang dari sheet |
| 23 | Buka detail pesanan yang hanya ada di hasil filter status | Modal terbuka berisi data pesanan tersebut |
| 24 | Buka pilihan filter status | Daftar memuat status yang benar-benar ada di sheet beserta jumlahnya |
| 25 | Deployment belum diperbarui, sehingga fungsi server baru tidak ada | Muncul catatan tetap yang menyebut fungsi mana yang belum ada dan jalan keluarnya |
| 26 | Kolom D berisi nilai di luar daftar resmi atau kosong | Nilai itu tetap muncul sebagai pilihan filter beserta jumlahnya |

Butir 15 dan 20 menguji dua perilaku yang paling mudah rusak saat menambah kode baru, yaitu pengelompokan baris pesanan dan syarat pencetakan pada `body:has(...)`.

### 12.2 Checklist adaptasi

- [ ] Tag `<script>` jsPDF sudah ditambahkan pada bagian `<head>` di `gas/Index.html`.
- [ ] Nilai `integrity` jsPDF sudah diverifikasi ulang dengan perintah pada bagian 10.1.
- [ ] Isi kit sudah disisipkan sebelum penanda BOOT pada `gas/Index.html:2227`.
- [ ] Kit memakai `esc()`, `rupiah()`, dan `showToast()` yang sudah ada, bukan helper duplikat.
- [ ] Setiap nilai dari sheet melewati `esc()` sebelum masuk ke dokumen.
- [ ] Nama berkas melewati `safeFilename()` atau regex sanitasi.
- [ ] Baris dikelompokkan dengan `groupOrdersBySn()` sebelum mencetak dokumen per pesanan.
- [ ] Judul kolom terulang di setiap halaman rekap.
- [ ] Kaki dokumen memuat waktu ekspor dan nomor halaman.
- [ ] Tombol export memakai kelas `.btn` tanpa lebar piksel tetap.
- [ ] Tombol yang hanya berisi ikon memiliki `<span class="sr-only">`.
- [ ] Pesan sukses dan gagal ditampilkan lewat `showToast()`.
- [ ] Jalur cetak lama di bagian 2 diuji ulang dan masih berjalan.
- [ ] Diuji pada ketiga konteks: Web App, modal, dan sidebar.
- [ ] Diuji pada minimal dua peramban.
- [ ] Bila memakai rekap penuh, Web App sudah di-deploy ulang setelah menambah fungsi baru.

### 12.3 Catatan hasil pengujian saat fitur ini dipasang

Pengujian dilakukan dengan mengganti jsPDF menjadi objek tiruan yang mencatat setiap panggilan gambar (teks, garis, kotak), lalu memeriksa apakah ada koordinat yang keluar dari batas halaman. Hasilnya:

| Dokumen | Hasil |
|---|---|
| Slip 1 barang | 1 halaman, 0 elemen di luar batas |
| Slip 30 barang | 2 halaman, kaki menulis "Halaman 1 / 2" dan "Halaman 2 / 2", 0 elemen di luar batas |
| Slip tanpa resi dan tanpa barang | 1 halaman, menulis "BELUM TERSEDIA", 0 elemen di luar batas |
| Batch 5 slip | 2 lembar A4 (4 + 1), 0 elemen di luar batas |
| Label 3 paket | 3 halaman, 0 elemen di luar batas |
| Rekap 120 baris dengan nama panjang | 8 halaman, judul kolom terulang 8 kali, 0 elemen di luar batas |

Satu kesalahan nyata ditemukan pada versi pertama dan sudah diperbaiki. Pagination versi awal membagi ruang halaman dengan tinggi baris tetap 6,5 mm, sementara baris dengan nama pembeli panjang tumbuh menjadi 11,1 mm. Akibatnya rekap 120 baris **852 elemen tergambar di luar batas halaman** dan teksnya menembus kaki dokumen. Perbaikan yang dipakai adalah mengukur tinggi setiap baris lebih dulu, seperti pada bagian 7.2, dan membatasi tinggi baris dengan `BARIS_MAKS`.

Kesimpulan untuk pemasangan berikutnya: jangan percaya perhitungan kapasitas baris yang memakai tinggi tetap. Selalu bandingkan rumus ukur dengan rumus gambar, dan uji dengan teks yang panjang, bukan hanya dengan data pendek.


---

## 13. Masalah Umum dan Penanganannya

| Gejala | Penyebab | Penanganan |
|---|---|---|
| Seluruh dashboard rusak setelah kit disisipkan | Ada penutup tag script yang ditulis utuh di dalam string, sehingga blok `<script>` induk tertutup lebih awal | Pecah penutup tag menjadi dua bagian string, lihat bagian 13.1 |
| Tombol export tidak bereaksi | jsPDF gagal dimuat dari CDN, atau `pdfKit` belum terdefinisi | Pastikan kit berada sebelum penanda BOOT, dan tambahkan pesan galat saat `window.jspdf` tidak ada |
| Berkas tidak terunduh | Unduhan otomatis diblokir di dalam iframe | Pakai jalur cadangan `doc.output('bloburl')` lalu `window.open()`, lihat bagian 4.4 |
| PDF terbentuk tetapi kosong | Tidak ada keadaan kosong saat `rows` kosong | Kirim satu baris "Tidak ada data." ketika tidak ada baris data |
| Baris terakhir menembus kaki halaman | Pagination membagi ruang dengan tinggi baris tetap, padahal baris yang teksnya dibungkus menjadi lebih tinggi | Ukur tinggi setiap baris lebih dulu memakai rumus yang sama dengan penggambaran, seperti pada bagian 7.2 |
| Nomor halaman menulis "1 / 1" padahal ada tiga halaman | Jumlah halaman dihitung setelah penggambaran | Hitung potongan halaman sebelum loop penggambaran dimulai |
| Teks angka keluar dari kolom | `align: 'right'` dipakai tanpa menyesuaikan posisi `x` | Pakai `x = colStarts[kolom] + colWidths[kolom] - 1.5` |
| Halaman kedua dan seterusnya kehilangan judul | Blok judul hanya digambar ketika `pageIndex === 0` | Gambar judul ringkas pada halaman lanjutan, seperti pola pada bagian 8.2 |
| Warna kaki halaman menular ke halaman berikutnya | `setTextColor` tidak dikembalikan | Kembalikan ke `doc.setTextColor(0)` setelah menggambar kaki halaman |
| `doc.save()` tidak terjadi | Nama berkas memuat karakter ilegal | Sanitasi nama dengan `safeFilename()` sebelum `doc.save()` |
| `doc.splitTextToSize is not a function` | Fungsi dipanggil pada kelas jsPDF, bukan pada instance | Pastikan memakai hasil `new window.jspdf.jsPDF(...)` |
| Huruf tampil kotak-kotak | Karakter di luar rentang latin-1 | Huruf bawaan jsPDF hanya mencakup latin-1. Nama produk dan catatan pembeli pada umumnya aman, tetapi bila memuat aksara non-latin, huruf TTF perlu di-embed |
| PDF terasa lambat dibuat | Terlalu banyak `doc.rect` pada rekap ratusan baris | Kurangi jumlah kolom, atau gambar hanya garis luar dan garis horizontal |
| Satu pesanan menghasilkan beberapa slip | Baris belum dikelompokkan | Pakai `groupOrdersBySn()`, lihat bagian 6.6 |
| Dashboard gagal dibuka dari sidebar tetapi normal dari Web App | Penyaji `doGet` diubah menjadi templat, sedangkan `openDashboardSidebar` dan `openDashboardModal` tidak | Ubah ketiga penyaji sekaligus, lihat bagian 10.5 |

### 13.1 Penutup tag script di dalam string

Penyebab kerusakan yang paling sering terjadi saat menempel kode slip ke dalam `gas/Index.html` adalah penutup tag script yang ditulis utuh di dalam string. Peramban membaca penutup tag itu sebagai akhir blok `<script>`, sehingga sisa kode halaman dianggap teks biasa dan seluruh dashboard berhenti bekerja.

Dua cara yang aman:

```javascript
// Cara 1: pecah penutup tag menjadi dua bagian string
var autoPrint = '<scr' + 'ipt>window.onload = function () { window.print(); };</scr' + 'ipt>';

// Cara 2: escape garis miringnya
var autoPrint = '<\/script>';
```

Untuk jalur cetak HTML di bagian 2, masalah ini tidak muncul karena slip ditulis sebagai potongan elemen HTML, bukan sebagai dokumen lengkap yang memuat tag script.

---

## 14. Lampiran A: pdf-kit untuk ERP Begood

Kit ini disisipkan ke dalam blok `<script>` yang sudah ada di `gas/Index.html`, tepat sebelum penanda BOOT pada `gas/Index.html:2227`, sesuai langkah pada bagian 10.2.

Seluruh isi kit berada di dalam satu IIFE, sehingga hanya satu nama baru yang muncul di lingkup halaman, yaitu `pdfKit`. Nama fungsi dashboard yang sudah ada tidak tertimpa.

### 14.1 Bagian pertama: konfigurasi dan fungsi dasar

```javascript
/* =========================================================================
   pdf-kit: utilitas export PDF untuk ERP Begood
   Prasyarat: jsPDF 2.5.1 UMD dimuat di <head> (lihat bagian 10.1)
   Semua nama internal bersifat privat; hanya window.pdfKit yang diekspos.
   ========================================================================= */
var pdfKit = (function () {
  'use strict';

  var CONFIG = {
    brand: 'b e g o o d . b d g',
    subBrand: 'ERP Begood',
    prefix: 'Begood',
    fallbackCdn: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    page: { w: 148, h: 210 }          // A5 portrait dalam milimeter
  };

  /* --- helper: pakai milik dashboard bila ada, agar hasilnya identik --- */

  function esc_(value) {
    if (typeof esc === 'function') return esc(value);
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function rupiah_(value) {
    if (typeof rupiah === 'function') return rupiah(value);
    return 'Rp ' + Number(value || 0).toLocaleString('id-ID');
  }

  function toast_(message, type) {
    if (typeof showToast === 'function') { showToast(message, type || 'success'); return; }
    if (type === 'error') console.error(message); else console.log(message);
  }

  /* --- helper: nama berkas dan tanggal --- */

  function safeFilename_(teks) {
    return String(teks === null || teks === undefined ? '' : teks)
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 60) || 'dokumen';
  }

  function yyyymmdd_(nilai) {
    var d = (nilai instanceof Date) ? nilai : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var bulan = String(d.getMonth() + 1);
    var hari = String(d.getDate());
    if (bulan.length < 2) bulan = '0' + bulan;
    if (hari.length < 2) hari = '0' + hari;
    return d.getFullYear() + bulan + hari;
  }

  function fmtTanggalId_(nilai) {
    if (!nilai) return '-';
    var teks = String(nilai).trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(teks)) return teks;
    var d = new Date(teks);
    if (isNaN(d.getTime())) return teks;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }
```

### 14.2 Bagian kedua: pemuat pustaka jsPDF

```javascript
  /* --- pemuat pustaka: dari <head>, atau disuntikkan saat dibutuhkan --- */

  function resolveLib_() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    return null;
  }

  function injectScript_(src, onLoad, onError) {
    var tag = document.createElement('script');
    tag.src = src;
    tag.async = true;
    tag.onload = onLoad;
    tag.onerror = function () { onError(new Error('Gagal memuat ' + src)); };
    document.head.appendChild(tag);
  }

  /**
   * Menjalankan callback dengan kelas jsPDF.
   * Bila pustaka belum ada, kit mencoba memuatnya dari sumber cadangan.
   */
  function withLib_(callback) {
    var JsPDF = resolveLib_();
    if (JsPDF) { callback(JsPDF); return; }

    toast_('Memuat pustaka PDF...', 'loading');
    injectScript_(CONFIG.fallbackCdn, function () {
      var loaded = resolveLib_();
      if (!loaded) { toast_('Pustaka PDF gagal dimuat.', 'error'); return; }
      toast_('Pustaka PDF siap.', 'success');
      callback(loaded);
    }, function () {
      toast_('Pustaka PDF gagal dimuat. Periksa koneksi lalu coba lagi.', 'error');
    });
  }

  /* --- keluaran berkas: unduhan langsung, dan alternatif tab baru --- */

  /**
   * Menyimpan dokumen sebagai unduhan.
   * Catatan: peramban dapat memblokir unduhan dari dalam iframe tanpa
   * melempar galat sama sekali, sehingga keberhasilan tidak dapat
   * dideteksi dari sini. Karena itu sediakan tombol alternatif yang
   * memanggil bukaDiTabBaru() bila berkas tidak muncul.
   *
   * @param {object} doc       instance jsPDF
   * @param {string} namaBerkas nama tanpa ekstensi, misalnya 'SlipPacking_260927A1B2C3'
   */
  function simpan_(doc, namaBerkas) {
    var nama = safeFilename_(namaBerkas) + '.pdf';
    doc.save(nama);
    return nama;
  }

  /**
   * Alternatif keluaran: membuka PDF di tab baru lewat blob URL.
   * Dipakai bila unduhan langsung diblokir oleh peramban.
   */
  function bukaDiTabBaru_(doc) {
    try {
      var url = doc.output('bloburl');
      var win = window.open(url, '_blank');
      if (!win) toast_('Popup diblokir. Izinkan popup untuk membuka PDF.', 'error');
      return win;
    } catch (err) {
      toast_('PDF tidak dapat dibuka di tab baru.', 'error');
      return null;
    }
  }
```

### 14.3 Bagian ketiga: pengukuran huruf dan pagination

```javascript
  /* --- tata letak: pengukuran huruf dan pemotongan halaman --- */

  /**
   * Memperkecil ukuran huruf sampai teks muat pada lebar tertentu.
   * Mengembalikan ukuran huruf yang akhirnya dipakai.
   */
  function fitText_(doc, teks, lebarMaks, ukuranAwal, ukuranMinimum) {
    var nilai = String(teks === null || teks === undefined ? '-' : teks).trim() || '-';
    var ukuran = ukuranAwal;
    doc.setFontSize(ukuran);
    while (ukuran > ukuranMinimum && doc.getTextWidth(nilai) > lebarMaks) {
      ukuran -= 0.5;
      doc.setFontSize(ukuran);
    }
    return ukuran;
  }

  function layoutFor_(page, opsi) {
    var jumlahKolom = opsi.jumlahKolom || 1;
    // Semakin banyak kolom, semakin kecil hurufnya agar tetap muat
    var fontSize = opsi.fontSize || (jumlahKolom > 6 ? 5.5 : (jumlahKolom > 4 ? 6 : 6.5));
    var margin = opsi.margin === undefined ? 6 : opsi.margin;
    return {
      fontSize: fontSize,
      headH: opsi.headH || 7,
      rowH: opsi.rowH || 6.5,
      lineStep: opsi.lineStep || 2.9,
      margin: margin,
      tabelW: page.w - (margin * 2)
    };
  }

  /* Tinggi baris tumbuh ketika teks dibungkus. Batas ini menjaga agar
     satu baris tidak pernah lebih tinggi dari ruang satu halaman. */
  var BARIS_MAKS = 4;

  /**
   * Mengukur tinggi satu baris tanpa menggambarnya.
   * Dipakai oleh pagination agar pemotongan halaman memakai tinggi
   * sebenarnya, bukan tinggi minimum.
   */
  function ukurTinggiBaris_(doc, layout, cells, isHeader) {
    if (isHeader) return layout.headH;

    var colW = layout.tabelW / cells.length;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(layout.fontSize);

    var barisTertinggi = 1;
    for (var i = 0; i < cells.length; i++) {
      var teks = String(cells[i] === null || cells[i] === undefined ? '' : cells[i]);
      var jumlah = doc.splitTextToSize(teks, colW - 2.4).length || 1;
      if (jumlah > barisTertinggi) barisTertinggi = jumlah;
    }

    if (barisTertinggi > BARIS_MAKS) barisTertinggi = BARIS_MAKS;

    return Math.max(layout.rowH, (barisTertinggi * layout.lineStep) + 2.4);
  }

  /**
   * Memotong baris data menjadi beberapa halaman berdasarkan tinggi
   * sebenarnya setiap baris. Halaman pertama memuat blok judul, sehingga
   * ruangnya lebih kecil daripada halaman lanjutan.
   */
  function paginateRows_(doc, headers, dataRows, page, opsi) {
    opsi = opsi || {};
    var layout = layoutFor_(page, {
      jumlahKolom: headers.length,
      fontSize: opsi.fontSize,
      headH: opsi.headH,
      rowH: opsi.rowH,
      lineStep: opsi.lineStep,
      margin: opsi.margin
    });

    var margin = layout.margin;
    var titleBlockH = opsi.titleBlockH === undefined ? 24 : opsi.titleBlockH;
    var footerH = 7;

    var ruangHalaman1 = page.h - margin - titleBlockH - layout.headH - footerH;
    var ruangHalamanN = page.h - margin - 10 - layout.headH - footerH;

    var chunks = [];
    var halaman = [];
    var terpakai = 0;
    var ruang = ruangHalaman1;

    for (var r = 0; r < dataRows.length; r++) {
      var tinggi = ukurTinggiBaris_(doc, layout, dataRows[r], false);

      if (halaman.length > 0 && (terpakai + tinggi) > ruang) {
        chunks.push(halaman);
        halaman = [];
        terpakai = 0;
        ruang = ruangHalamanN;
      }

      halaman.push(dataRows[r]);
      terpakai += tinggi;
    }

    // Halaman pertama tetap ada walaupun tidak ada baris data
    chunks.push(halaman);

    return { chunks: chunks, layout: layout };
  }

  /**
   * Mendeteksi apakah sebuah sel berisi angka, agar bisa diratakan kanan.
   * Nilai Rupiah dan persen ikut dikenali.
   */
  function isNumericCell_(nilai) {
    if (typeof nilai === 'number') return true;
    return /^[\d.,+\-%Rp\s]+$/.test(String(nilai === null || nilai === undefined ? '' : nilai));
  }
```

### 14.4 Bagian keempat: penggambaran judul, kaki halaman, dan tabel

```javascript
  /* --- penggambaran: judul, kaki halaman, dan tabel --- */

  /**
   * Penyesuaian baseline agar teks terlihat berada di tengah baris.
   * jsPDF memakai titik sebagai satuan huruf dan milimeter sebagai satuan
   * halaman, sehingga 36 persen tinggi huruf dikonversi lebih dulu.
   */
  function baselineTengah_(y, h, fontSize) {
    return y + (h / 2) + ((fontSize * 0.36) / 2.8346);
  }

  function drawTitleBlock_(doc, page, judul, subjudul, y, layout) {
    var margin = layout.margin;

    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(String(judul || ''), page.w / 2, y + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(CONFIG.brand, page.w / 2, y + 9, { align: 'center' });

    if (subjudul) {
      doc.setFontSize(7.5);
      doc.setTextColor(90);
      doc.text(String(subjudul), page.w / 2, y + 13.5, { align: 'center' });
      doc.setTextColor(0);
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 17, page.w - margin, y + 17);

    return y + 21;
  }

  function drawFooter_(doc, page, halamanKe, totalHalaman) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(90);
    doc.text('Diekspor ' + new Date().toLocaleString('id-ID'),
      page.w / 2, page.h - 3.5, { align: 'center' });
    doc.text('Halaman ' + halamanKe + ' / ' + totalHalaman,
      page.w - 6, page.h - 3.5, { align: 'right' });
    // Warna dikembalikan agar tidak menular ke halaman berikutnya
    doc.setTextColor(0);
  }

  /**
   * Menggambar satu baris tabel. Tinggi baris mengikuti sel terpanjang,
   * sehingga teks panjang tidak menimpa baris berikutnya.
   */
  function drawRow_(doc, page, layout, cells, y, isHeader) {
    var margin = layout.margin;
    var jumlahKolom = cells.length;
    var colW = layout.tabelW / jumlahKolom;

    doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
    doc.setFontSize(layout.fontSize);

    // Ukur lebih dulu, gambar kemudian
    var potongan = [];
    var barisTertinggi = 1;
    for (var i = 0; i < jumlahKolom; i++) {
      var teks = String(cells[i] === null || cells[i] === undefined ? '' : cells[i]);
      var lines = doc.splitTextToSize(teks, colW - 2.4);
      potongan.push(lines.length ? lines : ['']);
      if (potongan[i].length > barisTertinggi) barisTertinggi = potongan[i].length;
    }

    if (barisTertinggi > BARIS_MAKS) barisTertinggi = BARIS_MAKS;

    var h = isHeader
      ? layout.headH
      : Math.max(layout.rowH, (barisTertinggi * layout.lineStep) + 2.4);

    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    for (var c = 0; c < jumlahKolom; c++) {
      doc.rect(margin + (c * colW), y, colW, h);
    }

    for (var k = 0; k < jumlahKolom; k++) {
      var rataKanan = !isHeader && k > 0 && isNumericCell_(cells[k]);
      var align = rataKanan ? 'right' : 'left';
      var tx = rataKanan
        ? margin + (k * colW) + colW - 1.2
        : margin + (k * colW) + 1.2;

      if (isHeader) {
        doc.text(potongan[k][0], tx, baselineTengah_(y, h, layout.fontSize), { align: align });
      } else {
        var ty = y + 3.2;
        for (var b = 0; b < potongan[k].length; b++) {
          if (ty > y + h - 1.2) break;   // jangan sampai melewati batas sel
          doc.text(potongan[k][b], tx, ty, { align: align });
          ty += layout.lineStep;
        }
      }
    }

    return y + h;
  }

  /**
   * Menggambar tabel lengkap. Judul kolom selalu digambar di awal halaman,
   * termasuk pada halaman lanjutan.
   */
  function drawTable_(doc, page, layout, headers, dataRows, startY) {
    var y = drawRow_(doc, page, layout, headers, startY, true);

    if (!dataRows.length) {
      var h = layout.rowH;
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.rect(layout.margin, y, layout.tabelW, h);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(layout.fontSize);
      doc.text('Tidak ada data.', page.w / 2, baselineTengah_(y, h, layout.fontSize), { align: 'center' });
      return y + h;
    }

    for (var r = 0; r < dataRows.length; r++) {
      y = drawRow_(doc, page, layout, dataRows[r], y, false);
    }
    return y;
  }
```

### 14.5 Bagian kelima: API publik dan penutup

```javascript
  /* --- API publik --- */

  /**
   * Mengekspor larik dua dimensi menjadi PDF bertabel.
   * Baris pertama diperlakukan sebagai judul kolom.
   *
   * @param {{
   *   filename?: string, title?: string, subtitle?: string,
   *   rows: Array<Array>,
   *   page?: {w:number,h:number}, orientation?: string,
   *   margin?: number, fontSize?: number, titleBlockH?: number
   * }} opsi
   */
  function exportTable(opsi) {
    opsi = opsi || {};
    var rows = opsi.rows || [];

    if (!rows.length) {
      toast_('Tidak ada data untuk diekspor.', 'error');
      return;
    }

    var page = opsi.page || CONFIG.page;
    var orientasi = opsi.orientation || 'portrait';
    var headers = rows[0];
    var dataRows = rows.length > 1 ? rows.slice(1) : [];
    var titleBlockH = opsi.titleBlockH === undefined ? 24 : opsi.titleBlockH;

    withLib_(function (JsPDF) {
      var doc = new JsPDF({
        orientation: orientasi,
        unit: 'mm',
        format: [page.w, page.h]
      });

      // Potongan dihitung sebelum menggambar agar jumlah halaman sudah pasti
      var hasil = paginateRows_(doc, headers, dataRows, page, {
        fontSize: opsi.fontSize,
        headH: opsi.headH,
        rowH: opsi.rowH,
        lineStep: opsi.lineStep,
        margin: opsi.margin,
        titleBlockH: titleBlockH
      });

      var chunks = hasil.chunks;
      var layout = hasil.layout;
      var totalHalaman = chunks.length;

      for (var p = 0; p < totalHalaman; p++) {
        if (p > 0) doc.addPage([page.w, page.h], orientasi);

        var y = layout.margin + 2;
        if (p === 0) {
          y = drawTitleBlock_(doc, page, opsi.title, opsi.subtitle, y, layout);
        } else {
          // Halaman lanjutan: judul ringkas, lalu judul kolom diulang oleh drawTable_
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(String(opsi.title || ''), page.w / 2, y + 2, { align: 'center' });
          y += 8;
        }

        drawTable_(doc, page, layout, headers, chunks[p], y);
        drawFooter_(doc, page, p + 1, totalHalaman);
      }

      var nama = simpan_(doc, opsi.filename || ('Rekap_' + yyyymmdd_(new Date())));
      toast_('PDF siap: ' + nama, 'success');
    });
  }

  /**
   * Mengekspor kartu statistik berisi satu nilai utama.
   *
   * @param {{filename?:string, label:string, value:string,
   *          section?:string, extra?:Array<{label:string,value:string}>}} opsi
   */
  function exportStat(opsi) {
    opsi = opsi || {};
    var page = opsi.page || CONFIG.page;

    withLib_(function (JsPDF) {
      var doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [page.w, page.h] });
      var layout = layoutFor_(page, { jumlahKolom: 2, margin: opsi.margin });
      var y = drawTitleBlock_(doc, page, opsi.label, opsi.section || '', layout.margin + 2, layout);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.splitTextToSize(String(opsi.value || '-'), layout.tabelW).forEach(function (baris) {
        doc.text(baris, page.w / 2, y + 6, { align: 'center' });
        y += 7;
      });

      y += 4;
      (opsi.extra || []).forEach(function (baris) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(String(baris.label), layout.margin, y);
        doc.setFont('helvetica', 'bold');
        doc.text(String(baris.value), page.w - layout.margin, y, { align: 'right' });
        y += 5;
        doc.setDrawColor(200);
        doc.setLineWidth(0.1);
        doc.line(layout.margin, y - 3, page.w - layout.margin, y - 3);
        doc.setDrawColor(0);
      });

      drawFooter_(doc, page, 1, 1);
      simpan_(doc, opsi.filename || ('Stat_' + yyyymmdd_(new Date())));
      toast_('PDF siap.', 'success');
    });
  }
```

### 14.6 Bagian keenam: membaca tabel dari DOM

```javascript
  /**
   * Mengubah elemen <table> menjadi larik dua dimensi.
   * Baris pertama yang dikembalikan adalah judul kolom.
   */
  function tableFromElement(tabelEl) {
    if (!tabelEl) return [];

    var rows = [];
    var trs = tabelEl.querySelectorAll('tr');

    for (var i = 0; i < trs.length; i++) {
      var sel = trs[i].querySelectorAll('th, td');
      var cells = [];
      for (var c = 0; c < sel.length; c++) {
        cells.push(String(sel[c].innerText || '').replace(/\s+/g, ' ').trim());
      }
      if (cells.length) rows.push(cells);
    }

    return rows;
  }

  /* --- ekspos hanya satu nama ke lingkup halaman --- */

  return {
    CONFIG: CONFIG,

    // pemuat pustaka dan keluaran berkas
    withLib: withLib_,
    resolveLib: resolveLib_,
    simpan: simpan_,
    bukaDiTabBaru: bukaDiTabBaru_,

    // exporter
    exportTable: exportTable,
    exportStat: exportStat,
    tableFromElement: tableFromElement,

    // penggambaran, untuk dokumen berlayout kustom seperti slip dan label
    fitText: fitText_,
    paginateRows: paginateRows_,
    drawTitleBlock: drawTitleBlock_,
    drawFooter: drawFooter_,
    drawTable: drawTable_,

    // helper
    safeFilename: safeFilename_,
    yyyymmdd: yyyymmdd_,
    fmtTanggalId: fmtTanggalId_,
    fmtRupiah: rupiah_,
    isNumericCell: isNumericCell_,
    esc: esc_
  };
})();
```

### 14.7 Pemakaian ringkas

```javascript
// Rekap tabel multi-halaman
pdfKit.exportTable({
  filename: 'Rekap_Pesanan_' + pdfKit.yyyymmdd(new Date()),
  title: 'Rekap Pesanan Masuk',
  subtitle: 'Toko b e g o o d . b d g',
  rows: rekapPesananRows()
});

// Kartu statistik
pdfKit.exportStat({
  filename: 'Stat_Omzet',
  label: 'Total Omzet',
  value: rupiah(98765432),
  section: 'Ringkasan Dashboard',
  extra: [
    { label: 'Jumlah Pesanan', value: '1.126' },
    { label: 'Rata-rata per Pesanan', value: rupiah(87714) }
  ]
});

// Layout kustom untuk slip dan label
pdfKit.withLib(function (JsPDF) {
  var doc = buildSlipPdf(JsPDF, kelompokList[0]);
  pdfKit.simpan(doc, 'SlipPacking_' + kelompokList[0].kepala.orderSn);
});

// Ukur lebar teks sebelum menulis
var ukuran = pdfKit.fitText(doc, 'BC AJA 120x220 PUTIH PREMIUM', 70, 9, 6);
```

---

## 15. Lampiran B: Peta Fungsi dan Titik Sisip

### 15.1 Padanan istilah dari panduan porting umum

Banyak panduan export PDF ditulis untuk aplikasi web biasa, sehingga nama fungsinya berbeda dari yang ada di project ini. Tabel berikut memetakan keduanya agar panduan lain tetap dapat dibaca tanpa menebak.

| Istilah pada panduan umum | Padanan di project ini | Lokasi |
|---|---|---|
| Cetak slip lewat jendela popup | Cetak slip lewat modal di dalam dashboard | `slipFor()` di `gas/Index.html:2045` |
| Dokumen kustom ukuran khusus | Pola `buildSlipPdf()` dan `buildLabelPdf()` | Bagian 7.3 dan 9.2 |
| `buildSummaryTablePdfPages` | `pdfKit.paginateRows()` | Bagian 14.3 |
| `drawSummaryTable` | `pdfKit.drawTable()` | Bagian 14.4 |
| `drawSummaryPdfTitleBlock` | `pdfKit.drawTitleBlock()` | Bagian 14.4 |
| `drawSummaryPdfFooter` | `pdfKit.drawFooter()` | Bagian 14.4 |
| `downloadSummaryTablePdf` | `pdfKit.exportTable()` | Bagian 14.5 |
| `exportSummaryStatPdf` | `pdfKit.exportStat()` | Bagian 14.5 |
| `tableElementToRows` | `pdfKit.tableFromElement()` | Bagian 14.6 |
| `fitPdfText` | `pdfKit.fitText()` | Bagian 14.3 |
| `resolveJsPdf_` dan `loadJsPdfFallback_` | `pdfKit.resolveLib()` dan `pdfKit.withLib()` | Bagian 14.2 |
| `slugifyExportName` | `pdfKit.safeFilename()` | Bagian 14.1 |
| `formatRupiah` | `rupiah()` milik dashboard, atau `pdfKit.fmtRupiah()` | `gas/Index.html:1261` |
| `formatTanggalDenganHari` | `pdfKit.fmtTanggalId()` | Bagian 14.1 |
| `escapeHtml` | `esc()` milik dashboard | `gas/Index.html:1246` |
| `showToast` | `showToast()` milik dashboard | `gas/Index.html:1317` |

### 15.2 Titik sisip lengkap

| Yang ditambahkan | Berkas | Titik sisip | Bagian |
|---|---|---|---|
| Tag script jsPDF | `gas/Index.html` | Bagian `<head>`, setelah baris 11 | 10.1 |
| Isi `pdfKit` | `gas/Index.html` | Sebelum penanda BOOT di baris 2227 | 10.2 |
| `groupOrdersBySn()` | `gas/Index.html` | Di dalam blok `<script>` yang sama | 6.6 |
| `buildSlipPdf()` | `gas/Index.html` | Di dalam blok `<script>` yang sama | 7.3 |
| `buildBatchSlipPdf()` | `gas/Index.html` | Di dalam blok `<script>` yang sama | 9.1 |
| `buildLabelPdf()` | `gas/Index.html` | Di dalam blok `<script>` yang sama | 9.2 |
| `exportSlipPdf()` | `gas/Index.html` | Di dalam blok `<script>` yang sama | 10.3 |
| `exportRekapPesananPdf()` | `gas/Index.html` | Di dalam blok `<script>` yang sama | 8.3 |
| `cetakSlipPdfTerpilih()` | `gas/Index.html` | Di dalam blok `<script>` yang sama | 9.3 |
| Tombol PDF per baris | `gas/Index.html` | Blok aksi baris di baris 1696 | 10.3 |
| Tombol PDF panel kendali | `gas/Index.html` | Deret tombol Ekspor CSV di baris 760 | 10.3 |
| `getOrderRowsForExport()` | `gas/SheetManager.js` | Di dalam objek yang dikembalikan | 8.3 |
| `getOrderRowsForExport()` | `gas/Code.js` | Di antara fungsi RPC yang sudah ada | 8.3 |
| `getOrderRowsByStatus()` | `gas/SheetManager.js` | Di dalam objek yang dikembalikan | 8.5 |
| `getOrderRowsByStatus()` | `gas/Code.js` | Di antara fungsi RPC yang sudah ada | 8.5 |
| `getStatusInventory()` | `gas/SheetManager.js` | Di dalam objek yang dikembalikan | 8.5.3 |
| `getStatusInventory()` | `gas/Code.js` | Di antara fungsi RPC yang sudah ada | 8.5.3 |

### 15.3 Urutan pengerjaan yang disarankan

Urutan ini dipilih agar setiap langkah dapat diuji sebelum langkah berikutnya ditambahkan:

1. **Cetak slip ulang tanpa perubahan.** Buka dashboard, cetak satu slip, pastikan jalur di bagian 2 masih berjalan. Ini titik acuan sebelum ada perubahan.
2. **Tambahkan jsPDF dan kit kosong.** Sisipkan tag script dan IIFE kit, lalu pastikan dashboard tetap dimuat tanpa galat di console.
3. **Uji exporter tabel.** Panggil `pdfKit.exportTable()` dengan larik kecil dari console. Ini menguji pustaka, pemuatan, dan unduhan sekaligus.
4. **Tambahkan tombol rekap.** Pasang tombol Ekspor PDF pada panel kendali dan hubungkan ke `rekapPesananRows()`.
5. **Tambahkan pengelompokan baris.** Sisipkan `groupOrdersBySn()` dan pakai pada rekap, lalu uji dengan pesanan tiga produk.
6. **Tambahkan slip PDF.** Pasang tombol per baris dan uji pada pesanan dengan nama pembeli panjang serta pesanan tanpa resi.
7. **Tambahkan label dan batch.** Kerjakan terakhir, karena ukuran kertasnya paling tidak standar dan paling banyak memakan waktu penyesuaian.
8. **Uji pada ketiga konteks.** Jalankan checklist bagian 12.2 dari Web App, modal, dan sidebar.

---

Berkas yang dirujuk pada panduan ini: `gas/Index.html`, `gas/Code.js`, `gas/SheetManager.js`, `gas/appsscript.json`, serta `docs/struktur-spreadsheet.md` untuk skema kolom. Nomor baris merujuk pada isi berkas tersebut saat panduan ini disusun, dan perlu diperiksa ulang setelah ada perubahan besar pada berkas yang bersangkutan.

















