# Arsitektur Sistem ERP Mandiri Begood

Dokumen ini menjelaskan rancangan arsitektur teknis sistem ERP mandiri untuk toko online **b e g o o d . b d g** di Shopee, yang mengintegrasikan Google Sheets sebagai antarmuka/database dan Vercel sebagai serverless middleware.

---

## 🏛️ Gambaran Umum Arsitektur

Integrasi langsung antara Google Apps Script (GAS) dan Shopee Open API v2 memiliki sejumlah tantangan teknis:
1. **Penandatanganan Kriptografi (HMAC-SHA256)**: Shopee Open API v2 mewajibkan setiap permintaan HTTP ditandatangani menggunakan HMAC-SHA256 dengan kombinasi `partner_id`, `path`, `timestamp`, `access_token`, dan `shop_id`. Menjalankan penandatanganan ini secara stabil di runtime GAS V8 rentan terhadap latensi dan kesalahan urutan payload.
2. **Keterbatasan Eksekusi GAS**: Runtime GAS memiliki batas waktu eksekusi maksimal 6 menit per trigger, serta kuota `UrlFetchApp` yang ketat.
3. **Pustaka Resmi / Komunitas Modern**: Pustaka `@congminh1254/shopee-sdk` berbasis TypeScript/ES Module modern (`"type": "module"`), yang dirancang untuk dieksekusi di lingkungan Node.js >= 20.

Oleh karena itu, arsitektur ERP Begood membagi sistem menjadi dua lapisan utama:

```mermaid
flowchart LR
    subgraph Klien["Lapisan Antarmuka & Database"]
        GS["Google Sheets (ERP Begood)"]
        GAS["Google Apps Script (GAS)"]
        GS --- GAS
    end

    subgraph Middleware["Lapisan Middleware (Serverless Node.js)"]
        Vercel["Vercel Serverless Function"]
        SDK["@congminh1254/shopee-sdk"]
        Vercel --- SDK
    end

    subgraph Shopee["Shopee Open Platform API v2"]
        ShopeeAuth["OAuth2 Service (/api/v2/auth)"]
        ShopeeOrder["Order Service (/api/v2/order)"]
    end

    GAS -- "REST HTTPS (x-begood-secret)" --> Vercel
    SDK -- "HMAC-SHA256 Signed API" --> ShopeeAuth
    SDK -- "HMAC-SHA256 Signed API" --> ShopeeOrder
```

---

## 🔄 Alur Otorisasi OAuth2 Shopee

Shopee menerapkan protokol OAuth 2.0 untuk memberikan akses aman bagi aplikasi penjual:
- **Access Token**: Masa aktif **4 jam** (digunakan untuk memanggil endpoint pesanan dan produk).
- **Refresh Token**: Masa aktif **30 hari** (digunakan untuk memperbarui access token tanpa login ulang).

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin Toko Begood
    participant Sheet as Google Sheets (DB_Token)
    participant GAS as Google Apps Script
    participant Vercel as Vercel Middleware
    participant Shopee as Shopee Open Platform

    Admin->>GAS: Klik "Buka Tautan Otorisasi Shopee Baru"
    GAS->>Vercel: GET /api/auth/url
    Vercel-->>GAS: Return auth_url resmi Shopee
    GAS-->>Admin: Menampilkan Dialog Tautan Login
    Admin->>Shopee: Login akun b e g o o d . b d g & Setujui Hak Akses
    Shopee->>Vercel: Redirect ke /api/auth/callback?code=xxx&shop_id=yyy
    Vercel->>Shopee: Tukar code dengan Access & Refresh Token (getAccessToken)
    Shopee-->>Vercel: Token Pair (access_token, refresh_token, expire_in)
    Vercel-->>Admin: Tampilan Web Sukses Otorisasi & Tombol Salin Token
    Admin->>Sheet: Simpan Token di sheet DB_Token
```

---

## ⚡ Alur Penarikan Pesanan & Auto-Healing Token

Sistem ERP Begood dirancang dengan fitur **Self-Healing Token**:
Jika token yang tersimpan di spreadsheet telah kedaluwarsa atau mendekati waktu kedaluwarsa (< 10 menit), middleware secara otomatis meminta token baru ke Shopee API menggunakan `refresh_token`, menyelesaikan penarikan pesanan, lalu mengembalikan pesanan sekaligus token baru untuk diperbarui di `DB_Token`.

```mermaid
sequenceDiagram
    autonumber
    participant Trigger as Trigger GAS (Berkala 1 Jam) / UI
    participant Sheet as Google Sheets (Pesanan Masuk & DB_Token)
    participant Vercel as Vercel Middleware (/api/orders/daily)
    participant ShopeeOrder as Shopee Order API
    participant ShopeeLogistics as Shopee Logistics API

    Trigger->>Sheet: Baca Token Terakhir dari DB_Token
    Trigger->>Vercel: POST /api/orders/daily { access_token, time_from, time_to, shop_id }
    
    alt Token Sudah / Mendekati Kedaluwarsa
        Vercel->>ShopeeOrder: POST /api/v2/auth/access_token/get (Refresh Token)
        ShopeeOrder-->>Vercel: Return Token Baru
    end

    loop Chunking 14 Hari (create_time & update_time)
        Vercel->>ShopeeOrder: GET /api/v2/order/get_order_list (cursor pagination)
        ShopeeOrder-->>Vercel: Array of Order SNs
    end

    Note over Vercel,ShopeeOrder: Concurrency Batch (asyncPool x3) dengan order_sn_list string koma
    Vercel->>ShopeeOrder: GET /api/v2/order/get_order_detail (limit 50 SNs per call)
    ShopeeOrder-->>Vercel: Detail Lengkap (Items, SKU, Variasi, Package List)

    Note over Vercel,ShopeeLogistics: Batching Pelacakan Resi (50 paket per call)
    Vercel->>ShopeeLogistics: POST /api/v2/logistics/get_mass_tracking_number { package_list }
    ShopeeLogistics-->>Vercel: Tracking Numbers Asli (SPX, J&T, SiCepat, dll)

    Vercel-->>Trigger: Return { orders: [ ... ], new_token: { ... } }

    opt Ada Token Baru (Refreshed)
        Trigger->>Sheet: Update DB_Token dengan Access Token Baru
    end

    Trigger->>Sheet: In-Memory Batch Upsert (Multi-Item Row Expansion ke "Pesanan Masuk")
    Trigger->>Sheet: Catat ke "Log_Aktivitas"
```

---

## 🛡️ Standar Keamanan & Proteksi Data

1. **Header Secret Guard (`BEGOOD_API_SECRET`)**:
   Setiap permintaan dari Google Apps Script ke middleware Vercel diverifikasi menggunakan header `x-begood-secret`. Permintaan tanpa secret yang cocok akan langsung ditolak dengan kode `401 Unauthorized`.
2. **Kredensial Serverless Terisolasi**:
   `SHOPEE_PARTNER_KEY` tidak pernah disimpan di Google Spreadsheet maupun terekspos ke klien; kunci utama disimpan aman di Environment Variables Vercel.
3. **Penyimpanan Plain Text Nomor Penting**:
   Kolom Nomor Pesanan, Nomor Referensi SKU, dan Nomor Resi diatur berformat teks (`@`) pada spreadsheet untuk mencegah konversi angka besar menjadi notasi ilmiah (misal: `2.60925E+13`).
4. **Proteksi Perubahan Manual (Smart Upsert)**:
   Fungsi upsert pesanan memeriksa apakah nomor pesanan sudah ada. Jika sudah ada, sistem hanya memperbarui status Shopee, ekspedisi, dan resi tanpa menimpa status internal atau catatan yang telah diedit oleh tim operasional gudang.
5. **In-Memory Batch Writing**:
   Seluruh data baris dibaca, dimodifikasi, dan ditulis ke spreadsheet dalam array 2D in-memory (bukan cell-by-cell). Proses ratusan hingga ribuan baris selesai dalam 1 detik tanpa memicu batas waktu eksekusi Google Apps Script (6 menit limit).
