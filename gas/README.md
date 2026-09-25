# Panduan Instalasi Google Apps Script - ERP Begood

Modul Google Apps Script ini bertindak sebagai antarmuka pengguna (UI), basis data tabel operasional, dan mesin otomatisasi terjadwal untuk toko Shopee **b e g o o d . b d g**.

---

## 📋 Langkah Instalasi di Google Sheets

1. **Buat Spreadsheet Baru**
   - Buka [Google Sheets](https://sheets.new) di browser Anda.
   - Beri judul spreadsheet: `ERP Begood - Shopee b e g o o d . b d g`.

2. **Buka Script Editor**
   - Di menu atas Google Sheets, klik **Ekstensi (Extensions)** > **Apps Script**.

3. **Salin File Skrip**
   - Pada panel kiri Apps Script:
     - Ganti isi file `Code.gs` bawaan dengan isi file `gas/Code.js`.
     - Klik tombol **+** (Add a file) > **Script**, beri nama `SheetManager`, lalu salin isi file `gas/SheetManager.js`.
     - Klik tombol **+** (Add a file) > **Script**, beri nama `ShopeeApi`, lalu salin isi file `gas/ShopeeApi.js`.
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
     - `VERCEL_MIDDLEWARE_URL`: Masukkan domain Vercel Anda (contoh: `https://erp-begood.vercel.app`).
     - `BEGOOD_API_SECRET`: Masukkan token rahasia yang sama dengan yang disetel di Vercel env.
     - `DEFAULT_SYNC_DAYS`: `3` (atau sesuai preferensi operasional toko).

---

## 🚀 Alur Kerja Otorisasi Akun Shopee

1. Di Google Sheets, klik menu **📦 ERP Begood** > **🔗 Buka Tautan Otorisasi Shopee Baru**.
2. Klik tombol **🔗 Buka Halaman Login Shopee** pada dialog yang muncul.
3. Login menggunakan akun penjual **b e g o o d . b d g**, lalu setujui perizinan aplikasi.
4. Anda akan diarahkan ke halaman callback Vercel yang menampilkan status sukses dan Shop ID toko Anda.
5. Klik **Salin Data Token untuk DB_Token** atau masukkan data token ke sheet `DB_Token`.

---

## ⏰ Mengaktifkan Sinkronisasi Otomatis

Untuk memastikan pesanan ditarik secara reguler tanpa perlu membuka spreadsheet:
1. Klik menu **📦 ERP Begood** > **⏰ Pasang Trigger Otomatis (Tiap 1 Jam)**.
2. Selesai! Google Apps Script akan menarik pesanan secara background di server Google setiap 60 menit.
