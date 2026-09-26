# Panduan Deploy Middleware ke Vercel

Dokumen ini menjelaskan cara men-deploy proyek serverless middleware ERP Begood ke Vercel agar dapat diakses oleh Google Apps Script selama 24/7 dengan ketersediaan tinggi dan latensi rendah.

---

## Prasyarat
- Akun [Vercel](https://vercel.com) (dapat login menggunakan GitHub/GitLab atau Email).
- Node.js versi 20 ke atas telah terpasang.

---

## Opsi 1: Deploy Cepat Menggunakan Vercel CLI (Disarankan)

1. **Buka Terminal di Direktori Proyek**:
   ```bash
   cd "/Users/macbook/Documents/ERP Begood"
   ```

2. **Login ke Akun Vercel**:
   ```bash
   npx vercel login
   ```
   Ikuti petunjuk di terminal untuk memverifikasi via browser.

3. **Deploy ke Lingkungan Produksi (Production)**:
   ```bash
   npx vercel --prod
   ```
   Setelah selesai, proyek Anda terhubung ke domain:
   ```text
   https://shopee-middleware-erp.vercel.app
   ```

> ⚠️ **PENTING - Pengaturan Root Directory di Vercel:**
> Pastikan di dashboard Vercel (**Settings** > **General** > **Root Directory**) diatur ke:
> `middleware`
> Ini memastikan Vercel menemukan folder `api/` dan file `package.json` middleware tanpa memicu error 404.

---

## Opsi 2: Deploy Melalui Git Repository (GitHub)

Repositori resmi proyek ini terhubung ke:
`https://github.com/rkizg/shopee-middleware-erp.git`

Jika melakukan clone baru:
1. Hubungkan repo ke Vercel via **Import Project**.
2. Pada bagian **Root Directory**, masukkan: `middleware`.
3. Klik **Deploy**.

---

## Pengaturan Environment Variables di Vercel

Setelah proyek terdaftar di Vercel, atur variabel lingkungan agar middleware dapat berkomunikasi dengan Shopee Open API:

1. Buka dashboard proyek di Vercel > tab **Settings** > menu **Environment Variables**.
2. Tambahkan variabel berikut:

| Nama Variabel | Contoh Nilai | Keterangan |
|---|---|---|
| `SHOPEE_PARTNER_ID` | `1005234` | Partner ID dari Shopee Console |
| `SHOPEE_PARTNER_KEY` | `4b71a2c8...` | Partner Key dari Shopee Console |
| `SHOPEE_SHOP_ID` | `1564950615` | ID Toko `b e g o o d . b d g` |
| `SHOPEE_REGION` | `GLOBAL` | Default Shopee Indonesia |
| `SHOPEE_REDIRECT_URI` | `https://shopee-middleware-erp.vercel.app/api/auth/callback` | Callback URL aplikasi Vercel |
| `BEGOOD_API_SECRET` | `begood_secret_pass_2026` | Token otentikasi antara GAS & Vercel |

3. Klik **Save**.
4. Lakukan **Redeploy** (atau jalankan `npx vercel --prod` lagi) agar variabel lingkungan diterapkan secara penuh.

---

## Verifikasi Deployment

Setelah deploy selesai, Anda dapat memverifikasi status middleware melalui peramban:

1. **Cek Status Kesehatan Server**:
   Akses `https://shopee-middleware-erp.vercel.app/api/health`.
   Jika konfigurasi lengkap, respons JSON akan menampilkan:
   ```json
   {
     "status": "READY",
     "message": "All environment variables configured. Middleware ready for operations."
   }
   ```

2. **Cek Pembuatan URL Otorisasi**:
   Akses `https://shopee-middleware-erp.vercel.app/api/auth/url?secret=begood_secret_pass_2026`.
   Middleware akan mengembalikan URL resmi Shopee yang siap digunakan.
