# 📦 Sistem ERP Mandiri Begood (Shopee b e g o o d . b d g)

Sistem ERP berbasis Google Sheets yang terintegrasi penuh untuk mengelola operasional toko online **b e g o o d . b d g** di Shopee, mulai dari sinkronisasi data pesanan masuk hingga pencatatan status internal pergudangan secara otomatis.

---

## 🏗️ Arsitektur Sistem

Integrasi dibangun menggunakan pola **Serverless Middleware Pattern**:
1. **Google Sheets & Google Apps Script (GAS)**: Berperan sebagai antarmuka visual operasional harian, penyimpanan data pesanan (`Pesanan Masuk`), basis data token OAuth2 (`DB_Token`), dan pengatur jadwal eksekusi otomatis.
2. **Vercel Serverless Middleware**: Berperan sebagai jembatan komunikasi yang aman dengan Shopee Open API v2 menggunakan pustaka modern `@congminh1254/shopee-sdk` (Node.js 20+ ESM), mengelola penandatanganan kriptografi HMAC-SHA256, auto-refresh token, serta normalisasi data pesanan.
3. **Shopee Open API v2**: Sumber data resmi pesanan, logistik, dan profil toko.

```
┌────────────────────────────────────────────────────────┐
│             Google Sheets (ERP Begood)                 │
│  - Sheet "Pesanan Masuk" (Data Order & Status Gudang)  │
│  - Sheet "DB_Token" (Penyimpanan Token OAuth2)         │
│  - Sheet "Konfigurasi" & "Log_Aktivitas"               │
└──────────────────────────┬─────────────────────────────┘
                           │ UrlFetchApp (x-begood-secret)
                           ▼
┌────────────────────────────────────────────────────────┐
│         Vercel Serverless Middleware (Node.js)         │
│  - Pustaka: @congminh1254/shopee-sdk                   │
│  - Endpoint: /api/auth/* & /api/orders/*               │
│  - Penandatanganan HMAC-SHA256 & Auto Refresh Token    │
└──────────────────────────┬─────────────────────────────┘
                           │ Shopee Open API v2
                           ▼
┌────────────────────────────────────────────────────────┐
│                Shopee Open Platform                    │
│             Toko: b e g o o d . b d g                  │
└────────────────────────────────────────────────────────┘
```

---

## 📁 Struktur Direktori Proyek

```
ERP Begood/
├── middleware/                   # Proyek Vercel Serverless Middleware
│   ├── api/                      # Serverless Route Handlers
│   │   ├── auth/
│   │   │   ├── url.ts            # Endpoint generate URL login Shopee
│   │   │   ├── callback.ts       # Endpoint callback OAuth2 & tukar token
│   │   │   └── refresh.ts        # Endpoint refresh token
│   │   ├── orders/
│   │   │   └── daily.ts          # Endpoint penarikan pesanan harian terformat
│   │   ├── health.ts             # Health check & verifikasi variabel env
│   │   └── index.ts              # Root endpoint middleware
│   ├── src/
│   │   ├── lib/
│   │   │   ├── shopee.ts         # Inisialisasi ShopeeSDK & TokenStorage
│   │   │   ├── auth-guard.ts     # Proteksi keamanan secret header
│   │   │   └── types.ts          # Definisi TypeScript ERP & Order
│   │   └── services/
│   │       ├── order.service.ts  # Logika pagination & normalisasi pesanan
│   │       └── token.service.ts  # Logika otorisasi & pertukaran token
│   ├── package.json              # Konfigurasi npm & dependensi (@congminh1254/shopee-sdk)
│   ├── tsconfig.json             # Konfigurasi TypeScript NodeNext ESM
│   ├── vercel.json               # Konfigurasi perutean & CORS Vercel
│   └── .env.example              # Template Environment Variables
│
├── gas/                          # Kode Sumber Google Apps Script (Spreadsheet)
│   ├── Code.js                   # Menu Bar UI, Trigger Otomatis, dan Handler Aksi
│   ├── SheetManager.js           # Manajemen tabel, format kolom, dan DB_Token
│   ├── ShopeeApi.js              # Klien HTTP penghubung GAS ke Vercel
│   ├── appsscript.json           # Manifest Google Apps Script (WIB timezone)
│   └── README.md                 # Panduan instalasi ke Google Sheets
│
├── docs/                         # Dokumentasi Lengkap
│   ├── arsitektur.md             # Penjelasan mendalam arsitektur & sequence diagram
│   ├── panduan-setup-shopee.md   # Panduan registrasi Shopee Open Platform & App
│   ├── panduan-deploy-vercel.md  # Panduan deployment Vercel & pengaturan env
│   └── struktur-spreadsheet.md   # Skema kolom tabel & SOP tim operasional
│
└── README.md                     # Dokumentasi utama proyek
```

---

## ⚡ Langkah Cepat Memulai (Quickstart)

### 1. Siapkan Kredensial Shopee Open Platform
Ikuti panduan di [docs/panduan-setup-shopee.md](file:///Users/macbook/Documents/ERP%20Begood/docs/panduan-setup-shopee.md) untuk memperoleh:
- `Partner ID`
- `Partner Key`
- Mendaftarkan URL Callback: `https://<domain-vercel-anda>/api/auth/callback`

### 2. Deploy Middleware ke Vercel
Ikuti panduan di [docs/panduan-deploy-vercel.md](file:///Users/macbook/Documents/ERP%20Begood/docs/panduan-deploy-vercel.md):
```bash
cd middleware
npm install
npx vercel --prod
```
Setel Environment Variables di dashboard Vercel (`SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY`, `SHOPEE_SHOP_ID`, `BEGOOD_API_SECRET`, dll).

### 3. Pasang Google Apps Script
Ikuti panduan di [gas/README.md](file:///Users/macbook/Documents/ERP%20Begood/gas/README.md):
- Buka spreadsheet baru di [Google Sheets](https://sheets.new).
- Masuk ke **Extensions** > **Apps Script**, salin `gas/Code.js`, `gas/SheetManager.js`, `gas/ShopeeApi.js`.
- Buka spreadsheet, klik menu **📦 ERP Begood** > **🛠️ Inisialisasi / Reset Tabel Sheet**.
- Masukkan URL Vercel dan Secret Key di sheet **Konfigurasi**.

### 4. Hubungkan Toko & Jalankan Penarikan Pesanan
- Klik menu **📦 ERP Begood** > **🔗 Buka Tautan Otorisasi Shopee Baru**.
- Login dan setujui akses toko **b e g o o d . b d g**.
- Klik **📦 ERP Begood** > **🔄 Tarik Pesanan Masuk**.
- Aktifkan trigger otomatis melalui menu **⏰ Pasang Trigger Otomatis (Tiap 1 Jam)**.

---

## 💡 Keunggulan Solusi Ini
- **Bebas Kompatibilitas**: Menggunakan arsitektur NodeNext ESM murni untuk `@congminh1254/shopee-sdk`, meniadakan kendala keterbatasan runtime GAS.
- **Self-Healing Token**: Access token diperiksa masa kedaluwarsanya sebelum penarikan pesanan, dan otomatis diperbarui menggunakan refresh token tanpa interupsi.
- **Smart Upsert**: Tidak menduplikasi nomor pesanan dan tidak menimpa status internal atau catatan yang telah diinput secara manual oleh staf gudang.
- **Keamanan Berlapis**: Proteksi `x-begood-secret` mencegah pihak asing mengakses endpoint middleware Anda.
