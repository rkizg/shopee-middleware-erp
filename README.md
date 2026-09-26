# 📦 Sistem ERP Mandiri Begood (Shopee b e g o o d . b d g)

Sistem ERP berbasis Google Sheets yang terintegrasi penuh untuk mengelola operasional toko online **b e g o o d . b d g** di Shopee, mulai dari sinkronisasi data pesanan masuk hingga pencatatan status internal pergudangan secara otomatis.

---

## 🏗️ Arsitektur Sistem

Integrasi dibangun menggunakan pola **Serverless Middleware Pattern**:
1. **Google Sheets & Google Apps Script (GAS)**: Berperan sebagai antarmuka visual operasional harian, penyimpanan data pesanan (`Pesanan Masuk`), basis data token OAuth2 (`DB_Token`), dashboard web interaktif, dan pengatur jadwal eksekusi otomatis.
2. **Vercel Serverless Middleware**: Berperan sebagai jembatan komunikasi yang aman dengan Shopee Open API v2 menggunakan pustaka modern `@congminh1254/shopee-sdk` (Node.js 20+ ESM), mengelola penandatanganan kriptografi HMAC-SHA256, auto-refresh token, pelacakan nomor resi otomatis (`get_mass_tracking_number`), serta normalisasi data pesanan.
3. **Shopee Open API v2**: Sumber data resmi pesanan, logistik, produk, dan profil toko.

```
┌────────────────────────────────────────────────────────┐
│             Google Sheets (ERP Begood)                 │
│  - Sheet "Pesanan Masuk" (Data Order & Status Gudang)  │
│  - Multi-Item Row Expansion (1 Baris per Produk/Item)  │
│  - Sheet "DB_Token" (Penyimpanan Token OAuth2)         │
│  - Web Dashboard Interaktif (Sidebar & Layar Penuh)    │
│  - Sheet "Konfigurasi" & "Log_Aktivitas"               │
└──────────────────────────┬─────────────────────────────┘
                           │ UrlFetchApp (x-begood-secret)
                           ▼
┌────────────────────────────────────────────────────────┐
│         Vercel Serverless Middleware (Node.js)         │
│  - Pustaka: @congminh1254/shopee-sdk                   │
│  - Endpoint: /api/auth/* & /api/orders/*               │
│  - Concurrency Batching (asyncPool) & Chunking 14 Hari │
│  - Auto Fetch Resi via v2.logistics.get_mass_tracking  │
│  - Penandatanganan HMAC-SHA256 & Auto Refresh Token    │
└──────────────────────────┬─────────────────────────────┘
                           │ Shopee Open API v2
                           ▼
┌────────────────────────────────────────────────────────┐
│                Shopee Open Platform                    │
│             Toko: b e g o o d . b d g                  │
│             Shop ID: 1564950615                        │
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
│   │   │   ├── daily.ts          # Endpoint penarikan pesanan harian terformat
│   │   │   └── debug.ts          # Endpoint diagnostik & pengujian API Shopee
│   │   ├── health.ts             # Health check & verifikasi variabel env
│   │   └── index.ts              # Root endpoint middleware
│   ├── src/
│   │   ├── lib/
│   │   │   ├── shopee.ts         # Inisialisasi ShopeeSDK & TokenStorage
│   │   │   ├── auth-guard.ts     # Proteksi keamanan secret header
│   │   │   └── types.ts          # Definisi TypeScript ERP & Order
│   │   └── services/
│   │       ├── order.service.ts  # Logika pagination, mass tracking, & normalisasi
│   │       └── token.service.ts  # Logika otorisasi & pertukaran token
│   ├── package.json              # Konfigurasi npm & dependensi (@congminh1254/shopee-sdk)
│   ├── tsconfig.json             # Konfigurasi TypeScript NodeNext ESM
│   ├── vercel.json               # Konfigurasi perutean & CORS Vercel
│   └── .env.example              # Template Environment Variables
│
├── gas/                          # Kode Sumber Google Apps Script (Spreadsheet)
│   ├── Code.js                   # Menu Bar UI, Trigger Otomatis, dan Handler Aksi
│   ├── SheetManager.js           # Manajemen tabel 16 kolom, multi-baris item, & DB_Token
│   ├── ShopeeApi.js              # Klien HTTP penghubung GAS ke Vercel (fail-safe headers)
│   ├── Index.html                # Tampilan Web Dashboard Modern (Tailwind + FontAwesome)
│   ├── appsscript.json           # Manifest Google Apps Script (WIB timezone)
│   └── README.md                 # Panduan instalasi ke Google Sheets
│
├── docs/                         # Dokumentasi Lengkap
│   ├── arsitektur.md             # Penjelasan mendalam arsitektur & sequence diagram
│   ├── panduan-setup-shopee.md   # Panduan registrasi Shopee Open Platform & App
│   ├── panduan-deploy-vercel.md  # Panduan deployment Vercel & pengaturan env
│   └── struktur-spreadsheet.md   # Skema 16 kolom, aturan multi-produk, & SOP
│
└── README.md                     # Dokumentasi utama proyek
```

---

## ⚡ Langkah Cepat Memulai (Quickstart)

### 1. Siapkan Kredensial Shopee Open Platform
Ikuti panduan di [docs/panduan-setup-shopee.md](file:///Users/macbook/Documents/ERP%20Begood/docs/panduan-setup-shopee.md) untuk memperoleh:
- `Partner ID`
- `Partner Key`
- Mendaftarkan Live Redirect URL Domain: `https://shopee-middleware-erp.vercel.app/` *(hanya base domain tanpa path)*

### 2. Deploy Middleware ke Vercel
Ikuti panduan di [docs/panduan-deploy-vercel.md](file:///Users/macbook/Documents/ERP%20Begood/docs/panduan-deploy-vercel.md):
```bash
cd "/Users/macbook/Documents/ERP Begood"
npx vercel --prod
```
Setel Environment Variables di dashboard Vercel (`SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY`, `SHOPEE_SHOP_ID`, `BEGOOD_API_SECRET`, dll).

### 3. Pasang Google Apps Script
Ikuti panduan di [gas/README.md](file:///Users/macbook/Documents/ERP%20Begood/gas/README.md):
- Buka spreadsheet di [Google Sheets](https://sheets.new).
- Masuk ke **Ekstensi** > **Apps Script**, salin file:
  - `gas/Code.js` ➔ `Code.gs`
  - `gas/SheetManager.js` ➔ `SheetManager.gs`
  - `gas/ShopeeApi.js` ➔ `ShopeeApi.gs`
  - `gas/Index.html` ➔ `Index.html`
- Buka spreadsheet, klik menu **📦 ERP Begood** > **🛠️ Inisialisasi / Reset Tabel Sheet**.
- Masukkan URL Vercel dan Secret Key di sheet **Konfigurasi**.

### 4. Hubungkan Toko & Jalankan Penarikan Pesanan
- Klik menu **📦 ERP Begood** > **🔗 Buka Tautan Otorisasi Shopee Baru**.
- Login dan setujui akses toko **b e g o o d . b d g**.
- Klik **📦 ERP Begood** > **🔄 Tarik Pesanan Masuk (Hari Ini / 3 Hari)** atau menu **Pilih Rentang Hari** (1 s/d 365 hari).
- Aktifkan trigger otomatis melalui menu **⏰ Pasang Trigger Otomatis (Tiap 1 Jam)**.
- Buka visual dashboard melalui **📊 Buka Web Dashboard (Sidebar)**.

---

## 💡 Keunggulan Sistem ERP Begood
- **Multi-Item Row Expansion**: Jika satu pesanan membeli lebih dari 1 produk/variasi, masing-masing produk dicatat pada **baris terpisah** secara mandiri (memudahkan pengecekan packing & stok gudang).
- **Nomor Resi Otomatis**: Menghubungi Shopee Logistics API (`v2.logistics.get_mass_tracking_number`) untuk mengambil nomor resi asli paket (SPX, J&T, SiCepat, dll).
- **Nomor Referensi SKU & Nama Variasi**: Kolom terpisah untuk kode SKU barang dan variasi warna/ukuran.
- **Skalabilitas Ribuan Pesanan**: Mampu menarik ribuan pesanan (teruji 1.126 pesanan rentang 90 hari) dengan chunking 14-harian otomatis dan batching konkuren.
- **Self-Healing Token**: Access token diperiksa masa kedaluwarsanya sebelum penarikan pesanan, dan otomatis diperbarui menggunakan refresh token tanpa interupsi.
- **Smart In-Memory Upsert**: Update 1.000+ baris spreadsheet selesai dalam 1 detik menggunakan memori 2D array, dan **tidak menimpa** Status Internal Begood yang diubah manual oleh staf gudang.
- **Web Dashboard Terpadu**: Pantau KPI omzet harian, status siap packing, kurir pengiriman, dan cari pesanan realtime via sidebar atau layar penuh.
- **Keamanan Berlapis**: Proteksi header `x-begood-secret` mencegah pihak asing mengakses endpoint middleware.
