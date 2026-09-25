# Panduan Konfigurasi Shopee Open Platform

Panduan ini memandu langkah demi langkah mendapatkan kredensial resmi dari Shopee Open Platform untuk menghubungkan toko **b e g o o d . b d g** ke sistem ERP Begood.

---

## 1. Pendaftaran Pengembang (Developer Account)

1. Buka portal resmi [Shopee Open Platform](https://open.shopee.com/).
2. Masuk menggunakan akun Shopee Anda (disarankan menggunakan akun utama pemilik toko).
3. Jika belum terdaftar sebagai pengembang, klik **Register** dan isi formulir pendaftaran:
   - **Developer Type**: Pilih **In-House Developer** (karena aplikasi ini dibangun khusus untuk toko Anda sendiri).
   - **Entity**: Pilih sesuai badan usaha Anda (Individual / Company).
   - Masukkan kontak dan email resmi.
4. Verifikasi email dan tunggu proses persetujuan akun developer (biasanya otomatis atau membutuhkan 1-2 hari kerja untuk verifikasi dokumen).

---

## 2. Pembuatan Aplikasi (Create App)

1. Masuk ke **Console** di Shopee Open Platform.
2. Klik tombol **Create App**.
3. Isi informasi aplikasi:
   - **App Name**: `ERP Begood Management`
   - **App Type**: Pilih **In-House System**
   - **Target Market**: Centang **Indonesia (ID)**
   - **Category**: Pilih **ERP / Order Management**
4. Pada bagian **API Permissions / Scopes**, pastikan izin berikut diaktifkan:
   - `Order Management` (`v2.order.get_order_list`, `v2.order.get_order_detail`, `v2.order.get_shipment_list`)
   - `Logistics Management` (`v2.logistics.*`)
   - `Shop & Authorization` (`v2.auth.*`, `v2.public.*`)
5. Simpan formulir.

---

## 3. Mengambil Partner ID & Partner Key

Setelah aplikasi dibuat:
1. Masuk ke menu detail aplikasi di Shopee Console (**App Info**).
2. Anda akan melihat dua parameter utama:
   - **Partner ID**: Berupa angka unik (misal: `1005234`).
   - **Partner Key**: Berupa kombinasi string rahasia (hash 64 karakter).
3. Simpan kedua parameter ini dengan aman. Keduanya akan dimasukkan ke Environment Variables Vercel.

---

## 4. Mendaftarkan Redirect URL (Callback URL)

Agar alur OAuth2 dapat mengembalikan kode otorisasi ke middleware:
1. Di halaman detail aplikasi Shopee Console, buka tab **App Setting** > **Redirect URL**.
2. Masukkan alamat URL callback middleware Vercel Anda:
   ```
   https://<nama-proyek-vercel-anda>.vercel.app/api/auth/callback
   ```
   *(Ganti `<nama-proyek-vercel-anda>` dengan domain yang diberikan setelah Anda deploy ke Vercel).*
3. Klik **Save** / **Submit**.

---

## 5. Mengetahui Shop ID Toko Anda

Shop ID toko `b e g o o d . b d g` dapat dilihat melalui salah satu cara berikut:
- **Shopee Seller Centre**: Buka [seller.shopee.co.id](https://seller.shopee.co.id) > Pengaturan Toko / Profil.
- **URL Profil Toko**: ID numerik yang muncul pada profil toko Anda.
- **Otomatis Saat Otorisasi**: Ketika Anda membuka tautan otorisasi dan menyetujui akses di Shopee, Shopee akan mengirimkan `shop_id` secara langsung ke halaman callback middleware dan akan ditampilkan di layar.
