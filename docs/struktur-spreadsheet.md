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
| **F** | **Nama Produk** | Text | Nama produk yang dibeli pada baris tersebut. |
| **G** | **Nomor Referensi SKU** ✨ | Text (`@`) | Kode unik SKU variasi/produk dari Shopee (misal: `SARKUR 120/5`, `TAS MIKA AJA`). |
| **H** | **Nama Variasi** ✨ | Text | Nama variasi warna/ukuran yang dipilih pembeli (misal: `Coffee,120x200x5`, `SINGLE`). |
| **I** | **Qty** | Number | Jumlah kuantitas produk tersebut yang dibeli dalam transaksi. |
| **J** | **Total Belanja (Rp)** | Currency | Total pembayaran belanja pesanan yang dibayarkan oleh pembeli (format Rupiah `Rp #,##0`). |
| **K** | **Ongkir (Rp)** | Currency | Biaya ongkos kirim resmi pesanan. |
| **L** | **Ekspedisi / Kurir** | Text | Jasa logistik yang dipilih pembeli (SPX Express, J&T, SiCepat, dll). |
| **M** | **No. Resi** ✨ | Text (`@`) | **Nomor resi asli** (*tracking number*) yang ditarik otomatis dari Shopee Logistics API. |
| **N** | **Catatan Pembeli** | Text | Pesan khusus dari pembeli untuk penjual (misal: "minta dipacking rapat", "warna cadangan hitam"). |
| **O** | **Kota Tujuan** | Text | Kota pengiriman paket untuk analisis distribusi penjualan. |
| **P** | **Waktu Sinkronisasi** | Date/Time | Waktu terakhir baris ini diperbarui oleh sistem otomatisasi. |

---

## 2. Aturan Pemecahan Multi-Produk (Multi-Item Row Expansion)

Sistem secara otomatis memeriksa setiap produk di dalam pesanan:

1. **Pesanan 1 Produk / 1 Variasi**: Ditulis menjadi 1 baris.
2. **Pesanan Lebih dari 1 Produk / Beberapa Variasi**:
   - Ditulis menjadi **baris yang terpisah (baris berbeda)** untuk setiap jenis produk atau variasi.
   - Kolom `No. Pesanan`, `Tanggal`, `Nama Pembeli`, `Ekspedisi`, `No. Resi`, `Total Belanja`, dan `Status Internal` pada semua baris produk tersebut akan sama.
   - Kolom `Nama Produk`, `Nomor Referensi SKU`, `Nama Variasi`, dan `Qty` akan mencatat spesifik barang tersebut.

### Contoh Tampilan Multi-Produk:
| No. Pesanan | Tanggal | Status | Status Internal | Nama Pembeli | Nama Produk | No. Ref SKU | Nama Variasi | Qty | Total Belanja | Ekspedisi | No. Resi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `260911P83ME3FW` | 2026-09-11 | COMPLETED | `[4] Selesai` | nurul... | TAS MIKA BEDCOVER | `TAS MIKA AJA` | **SINGLE** | **2** | Rp 85.000 | SPX Standard | SPXID06556... |
| `260911P83ME3FW` | 2026-09-11 | COMPLETED | `[4] Selesai` | nurul... | TAS MIKA BEDCOVER | `TAS MIKA AJA` | **DOUBLE** | **3** | Rp 85.000 | SPX Standard | SPXID06556... |

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
| `SHOP_ID` | `1564950615` | ID Toko Shopee Begood. |
| `DEFAULT_SYNC_DAYS` | `3` | Jumlah hari pesanan yang ditarik secara otomatis (default 3 hari). |

---

## 6. Sheet `Log_Aktivitas`

Merekam setiap aktivitas sistem sebagai audit trail:
- **Waktu (WIB)**: Kapan aksi dilakukan.
- **Tipe Aksi**: `SYNC_PESANAN`, `AUTO_REFRESH_TOKEN`, `MANUAL_REFRESH_TOKEN`, `TRIGGER_SETUP`, `UPDATE_STATUS`.
- **Jumlah Pesanan**: Total data yang diproses.
- **Status**: `SUKSES`, `ERROR`, `GAGAL`.
- **Keterangan Detail**: Pesan teknis lengkap untuk kemudahan penelusuran jika terjadi kendala.

