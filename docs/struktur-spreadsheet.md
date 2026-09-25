# Struktur Tabel & Panduan Operasional Google Sheets ERP Begood

Sistem ERP Begood menggunakan Google Sheets sebagai antarmuka visual operasional harian. Seluruh skema tabel telah dirancang secara optimal untuk mendukung alur kerja gudang, admin pesanan, dan manajemen keuangan toko **b e g o o d . b d g**.

---

## 1. Sheet `Pesanan Masuk` (Tabel Operasional Utama)

Tabel ini menampung seluruh pesanan pelanggan yang ditarik dari Shopee.

| No | Nama Kolom | Tipe Data | Keterangan & Fungsi |
|---|---|---|---|
| **A** | **No. Pesanan** | Text (`@`) | Kode unik nomor pesanan Shopee (Order SN). Format string menjaga agar angka tidak berubah menjadi format eksponensial. |
| **B** | **Tanggal Pesanan (WIB)** | Date/Time | Waktu pesanan dibuat oleh pembeli dalam zona waktu Indonesia Barat (WIB). |
| **C** | **Status Shopee** | Text | Status resmi dari Shopee (`UNPAID`, `READY_TO_SHIP`, `PROCESSED`, `SHIPPED`, `COMPLETED`, `CANCELLED`). |
| **D** | **Status Internal Begood** | Dropdown | Status alur kerja internal tim Begood (bisa diubah manual oleh staf gudang/packing). |
| **E** | **Nama Pembeli** | Text | Username atau nama penerima pesanan. |
| **F** | **Ringkasan Produk** | Text | Nama produk, variasi/warna/ukuran, dan jumlah item (contoh: *Kaos Begood Classic (Hitam - L) x2*). |
| **G** | **Total Qty** | Number | Akumulasi jumlah item yang dipesan dalam transaksi tersebut. |
| **H** | **Total Belanja (Rp)** | Currency | Total pembayaran belanja yang dibayarkan oleh pembeli (format Rupiah `Rp #,##0`). |
| **I** | **Ongkir (Rp)** | Currency | Biaya ongkos kirim resmi pesanan. |
| **J** | **Ekspedisi / Kurir** | Text | Jasa logistik yang dipilih pembeli (SPX Express, J&T, SiCepat, dll). |
| **K** | **No. Resi** | Text (`@`) | Nomor pelacakan paket (*tracking number*). |
| **L** | **Catatan Pembeli** | Text | Pesan khusus dari pembeli untuk penjual (misal: "minta dipacking rapat", "warna cadangan hitam"). |
| **M** | **Kota Tujuan** | Text | Kota pengiriman paket untuk analisis distribusi penjualan. |
| **N** | **Waktu Sinkronisasi** | Date/Time | Waktu terakhir baris ini diperbarui oleh sistem otomatisasi. |

### 🏷️ Pilihan Status Internal Begood (Dropdown Kolom D):
- `[0] Menunggu Pembayaran`: Pesanan belum diselesaikan pembayarannya.
- `[1] Siap Packing`: Pesanan lunas dan barang siap diambil serta dibungkus oleh tim gudang.
- `[2] Menunggu Pickup`: Paket telah selesai dipacking dan ditempeli resi, menunggu kedatangan kurir ekspedisi.
- `[3] Sedang Dikirim`: Paket telah dipindai (scanned) oleh kurir dan sedang dalam perjalanan.
- `[4] Selesai`: Paket telah sampai ke pembeli dan dana telah dilepaskan.
- `[5] Pengajuan Batal`: Pembeli mengajukan pembatalan (perlu konfirmasi admin).
- `[6] Dibatalkan`: Pesanan resmi batal.

> **Catatan Penting**: Fitur *Smart Upsert* memastikan bahwa jika staf gudang telah mengubah status kolom D menjadi `[2] Menunggu Pickup`, proses penarikan otomatis harian **TIDAK AKAN** menimpa status manual tersebut, sehingga proses pencatatan gudang tetap terjaga rapi.

---

## 2. Sheet `DB_Token` (Penyimpanan Token OAuth2)

Menyimpan token otentikasi Shopee Open API v2.

| Kolom | Nama Kolom | Keterangan |
|---|---|---|
| **A** | **Shop ID** | ID unik toko Shopee Anda. |
| **B** | **Partner ID** | Partner ID developer aplikasi. |
| **C** | **Access Token** | Kunci akses aktif untuk memanggil API (berlaku 4 jam). |
| **D** | **Refresh Token** | Kunci untuk memperbarui access token (berlaku ~30 hari). |
| **E** | **Expired At (Unix)** | Timestamp batas kedaluwarsa dalam detik/milidetik. |
| **F** | **Expired At (WIB)** | Waktu kedaluwarsa yang mudah dibaca dalam WIB. |
| **G** | **Terakhir Diperbarui (WIB)** | Waktu saat token diperbarui terakhir kali. |
| **H** | **Status Token** | Status kondisi token (`AKTIF`, `KADALUARSA`). |

---

## 3. Sheet `Konfigurasi`

Menyimpan parameter aplikasi yang dapat disesuaikan tanpa perlu mengubah baris kode:

| Parameter | Contoh Nilai | Keterangan |
|---|---|---|
| `VERCEL_MIDDLEWARE_URL` | `https://begood-shopee-erp.vercel.app` | URL middleware Vercel tempat API di-deploy. |
| `BEGOOD_API_SECRET` | `your_secret_key_here` | Kunci rahasia API penjaga middleware. |
| `SHOP_ID` | `100234567` | ID Toko Shopee Begood. |
| `DEFAULT_SYNC_DAYS` | `3` | Jumlah hari pesanan yang ditarik secara otomatis (default 3 hari). |

---

## 4. Sheet `Log_Aktivitas`

Merekam setiap aktivitas sistem sebagai audit trail:
- **Waktu (WIB)**: Kapan aksi dilakukan.
- **Tipe Aksi**: `SYNC_PESANAN`, `AUTO_REFRESH_TOKEN`, `MANUAL_REFRESH_TOKEN`, `TRIGGER_SETUP`.
- **Jumlah Pesanan**: Total data yang diproses.
- **Status**: `SUKSES`, `ERROR`, `GAGAL`.
- **Keterangan Detail**: Pesan teknis lengkap untuk kemudahan penelusuran jika terjadi kendala.
