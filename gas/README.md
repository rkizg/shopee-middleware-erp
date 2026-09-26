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
   - Sistem akan secara otomatis membuat 4 sheet terformat:
     - `Pesanan Masuk`: Tabel data order lengkap dengan dropdown status internal.
     - `DB_Token`: Tabel penyimpanan token OAuth2 Shopee yang aman.
     - `Konfigurasi`: Tabel variabel URL Vercel & kunci rahasia.
     - `Log_Aktivitas`: Tabel audit log penarikan pesanan & refresh token.

6. **Hubungkan ke Middleware Vercel**
   - Buka tab sheet `Konfigurasi`.
   - Ubah nilai pada kolom `Nilai`:
     - `VERCEL_MIDDLEWARE_URL`: Masukkan domain Vercel Anda (`https://shopee-middleware-erp.vercel.app`).
     - `BEGOOD_API_SECRET`: Masukkan token rahasia yang sama dengan yang disetel di Vercel env.
     - `DEFAULT_SYNC_DAYS`: `3` (atau sesuai preferensi operasional toko).

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

1. **KPI Metric Cards**:
   - Total Pesanan, Pesanan Hari Ini, Siap Packing, Menunggu Pickup / Dikirim, Pesanan Selesai, dan Total Omset Penjualan (Rp).
2. **Panel Kontrol Cepat**:
   - Tombol **Tarik Pesanan** dengan pilihan rentang hari fleksibel (1, 3, 7, 14 hari).
   - Tombol **Otorisasi Shopee** (menampilkan tautan otorisasi resmi dengan tombol salin URL).
   - Tombol **Refresh Token** (memperbarui token kedaluwarsa secara instan).
   - Tombol **Toggle Auto-Sync** (menghidupkan atau mematikan trigger 1 jam).
   - Tombol **Cek Ping Vercel** (memverifikasi kesehatan integrasi serverless).
3. **Tabel Manajemen Pesanan**:
   - Kolom pencarian realtime (cari No Pesanan, Nama Pembeli, Produk, Kurir, No Resi).
   - Filter berdasarkan Status Internal Toko.
   - **Inline Dropdown Status Internal Begood**: Ganti status pesanan (contoh: *Siap Packing* ➔ *Menunggu Pickup Kurir*) langsung di baris tabel, data otomatis tersimpan ke spreadsheet.
4. **Tab Token & Integrasi**:
   - Memantau Shop ID, status aktif token, sisa masa berlaku, dan input langsung token baru via JSON paste.
5. **Tab Riwayat Aktivitas**:
   - Audit trail 10 aktivitas sinkronisasi dan sistem terakhir lengkap dengan status dan keterangannya.
