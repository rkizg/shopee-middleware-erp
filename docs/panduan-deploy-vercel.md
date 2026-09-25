# Panduan Deploy Middleware ke Vercel

Dokumen ini menjelaskan cara men-deploy proyek serverless middleware ERP Begood ke Vercel agar dapat diakses oleh Google Apps Script selama 24/7 dengan ketersediaan tinggi dan latensi rendah.

---

## Prasyarat
- Akun [Vercel](https://vercel.com) (dapat login menggunakan GitHub/GitLab atau Email).
- Node.js versi 20 ke atas telah terpasang.

---

## Opsi 1: Deploy Cepat Menggunakan Vercel CLI (Disarankan)

1. **Buka Terminal di Direktori Middleware**:
   ```bash
   cd "/Users/macbook/Documents/ERP Begood/middleware"
   ```

2. **Login ke Akun Vercel**:
   ```bash
   npx vercel login
   ```
   Ikuti petunjuk di terminal untuk memverifikasi via browser.

3. **Inisialisasi & Deploy ke Preview**:
   ```bash
   npx vercel
   ```
   Jawab pertanyaan konfigurasi Vercel:
   - *Set up and deploy?* → **y**
   - *Which scope?* → Pilih akun/tim Vercel Anda.
   - *Link to existing project?* → **n**
   - *What's your project's name?* → **begood-shopee-erp** (atau nama pilihan Anda).
   - *In which directory is your code located?* → `./`
   - *Want to modify settings?* → **n**

4. **Deploy ke Lingkungan Produksi (Production)**:
   ```bash
   npx vercel --prod
   ```
   Setelah selesai, Anda akan mendapatkan URL produksi (misal: `https://begood-shopee-erp.vercel.app`).

---

## Opsi 2: Deploy Melalui Git Repository (GitHub)

1. Buat repositori baru di GitHub (misal: `erp-begood`).
2. Masukkan direktori proyek ke Git dan dorong (push) ke GitHub:
   ```bash
   cd "/Users/macbook/Documents/ERP Begood"
   git init
   git add .
   git commit -m "feat: inisiasi erp begood middleware dan gas"
   git branch -M main
   git remote add origin https://github.com/<username>/<nama-repo>.git
   git push -u origin main
   ```
3. Buka dashboard [Vercel](https://vercel.com/new).
4. Klik **Import Project** dari repositori GitHub Anda.
5. Pada bagian **Root Directory**, pilih folder `middleware`.
6. Klik **Deploy**.

---

## Pengaturan Environment Variables di Vercel

Setelah proyek terdaftar di Vercel, atur variabel lingkungan agar middleware dapat berkomunikasi dengan Shopee Open API:

1. Buka dashboard proyek di Vercel > tab **Settings** > menu **Environment Variables**.
2. Tambahkan variabel berikut:

| Nama Variabel | Contoh Nilai | Keterangan |
|---|---|---|
| `SHOPEE_PARTNER_ID` | `1005234` | Partner ID dari Shopee Console |
| `SHOPEE_PARTNER_KEY` | `4b71a2c8...` | Partner Key dari Shopee Console |
| `SHOPEE_SHOP_ID` | `987654321` | ID Toko `b e g o o d . b d g` |
| `SHOPEE_REGION` | `GLOBAL` | Default Shopee Indonesia |
| `SHOPEE_REDIRECT_URI` | `https://begood-shopee-erp.vercel.app/api/auth/callback` | Callback URL aplikasi Vercel |
| `BEGOOD_API_SECRET` | `begood_secret_pass_2026` | Token otentikasi antara GAS & Vercel |

3. Klik **Save**.
4. Lakukan **Redeploy** (atau jalankan `npx vercel --prod` lagi) agar variabel lingkungan diterapkan secara penuh.

---

## Verifikasi Deployment

Setelah deploy selesai, Anda dapat memverifikasi status middleware melalui peramban:

1. **Cek Status Kesehatan Server**:
   Akses `https://<domain-vercel-anda>/api/health`.
   Jika konfigurasi lengkap, respons JSON akan menampilkan:
   ```json
   {
     "status": "READY",
     "message": "All environment variables configured. Middleware ready for operations."
   }
   ```

2. **Cek Pembuatan URL Otorisasi**:
   Akses `https://<domain-vercel-anda>/api/auth/url?secret=<BEGOOD_API_SECRET>`.
   Middleware akan mengembalikan URL resmi Shopee yang siap digunakan.
