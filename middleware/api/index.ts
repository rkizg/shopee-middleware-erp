import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Jika Shopee mengarahkan callback ke domain dasar (root /) dengan kode otorisasi
  if (req.query.code) {
    const query = new URLSearchParams(req.query as Record<string, string>).toString();
    return res.redirect(307, `/api/auth/callback?${query}`);
  }

  // Jika diakses melalui browser (Accept: text/html)
  const acceptHeader = req.headers.accept || '';
  if (acceptHeader.includes('text/html')) {
    const secret = process.env.BEGOOD_API_SECRET || 'begood_secret_pass_2026';
    const authUrlLink = `/api/auth/url?secret=${encodeURIComponent(secret)}`;

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ERP Begood - Serverless Middleware Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
  </style>
</head>
<body class="bg-[#0b0f19] text-slate-100 min-h-screen flex flex-col justify-between antialiased selection:bg-orange-500/30 selection:text-orange-200">

  <!-- Header -->
  <header class="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur px-6 py-4">
    <div class="max-w-5xl mx-auto flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-600/30 font-bold text-lg">
          <i class="fa-solid fa-boxes-packing"></i>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="font-extrabold text-base text-white">ERP Begood</h1>
            <span class="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">SYSTEM ONLINE</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Toko Shopee: <strong class="text-slate-200">b e g o o d . b d g</strong> (ID: 1564950615)</p>
        </div>
      </div>
      <a href="/api/health" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition flex items-center gap-1.5">
        <i class="fa-solid fa-heart-pulse text-emerald-400"></i>
        <span>Health Status</span>
      </a>
    </div>
  </header>

  <!-- Main Hero Content -->
  <main class="max-w-5xl mx-auto w-full px-6 py-10 flex-1 space-y-8">
    
    <div class="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
      <div class="max-w-2xl space-y-4">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
          <span class="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          Shopee Open API v2 Integration Middleware
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
          Pusat Kontrol & Integrasi Serverless ERP Begood
        </h2>
        <p class="text-sm text-slate-300 leading-relaxed">
          Middleware serverless berkinerja tinggi yang menghubungkan toko Shopee <strong>b e g o o d . b d g</strong> dengan Google Sheets ERP secara otomatis, dilengkapi penarikan nomor resi asli, pemecahan baris SKU/variasi, dan token self-healing.
        </p>

        <div class="pt-2 flex flex-wrap gap-3 text-xs">
          <a href="${authUrlLink}" class="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-orange-600/30">
            <i class="fa-solid fa-key"></i>
            <span>Buka Otorisasi Shopee</span>
          </a>
          <a href="/api/health" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition flex items-center gap-2">
            <i class="fa-solid fa-stethoscope text-sky-400"></i>
            <span>Periksa Variabel & Konfigurasi</span>
          </a>
        </div>
      </div>
      <div class="absolute -right-8 -bottom-8 text-slate-800/40 text-9xl pointer-events-none hidden md:block">
        <i class="fa-solid fa-server"></i>
      </div>
    </div>

    <!-- Features & Endpoints Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
        <div class="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold text-sm">
          <i class="fa-solid fa-layer-group"></i>
        </div>
        <h3 class="font-bold text-sm text-white">Multi-Item Row Expansion</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Setiap variasi atau produk dalam satu pesanan dicatat mandiri pada baris terpisah dengan nomor SKU spesifik untuk memudahkan picking & packing gudang.
        </p>
      </div>

      <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
        <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center font-bold text-sm">
          <i class="fa-solid fa-truck-fast"></i>
        </div>
        <h3 class="font-bold text-sm text-white">Nomor Resi Shopee Asli</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Mengintegrasikan API Shopee Logistics Mass Tracking untuk mengambil nomor resi asli paket secara otomatis (SPX, J&T, SiCepat, dll).
        </p>
      </div>

      <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-sm">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <h3 class="font-bold text-sm text-white">Smart Upsert & Security</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Status manual internal gudang tetap terlindungi dari penimpaan saat sinkronisasi harian, dengan proteksi rahasia <code class="font-mono text-emerald-400">x-begood-secret</code>.
        </p>
      </div>
    </div>

    <!-- Active Endpoints Table -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
      <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
        <i class="fa-solid fa-code text-orange-400"></i> Endpoint API yang Tersedia
      </h3>
      <div class="overflow-x-auto text-xs font-mono">
        <table class="w-full text-left">
          <tbody class="divide-y divide-slate-800 text-slate-300">
            <tr>
              <td class="py-2.5 font-bold text-emerald-400 w-20">GET</td>
              <td class="py-2.5 text-slate-100">/api/health</td>
              <td class="py-2.5 text-slate-400 font-sans">Cek kesiapan konfigurasi & variabel lingkungan</td>
            </tr>
            <tr>
              <td class="py-2.5 font-bold text-emerald-400">GET</td>
              <td class="py-2.5 text-slate-100">/api/auth/url</td>
              <td class="py-2.5 text-slate-400 font-sans">Membuat link otorisasi login Shopee Seller</td>
            </tr>
            <tr>
              <td class="py-2.5 font-bold text-emerald-400">GET</td>
              <td class="py-2.5 text-slate-100">/api/auth/callback</td>
              <td class="py-2.5 text-slate-400 font-sans">Menerima kode otorisasi Shopee dan menukar token</td>
            </tr>
            <tr>
              <td class="py-2.5 font-bold text-sky-400">POST</td>
              <td class="py-2.5 text-slate-100">/api/auth/refresh</td>
              <td class="py-2.5 text-slate-400 font-sans">Memperbarui access token yang kedaluwarsa</td>
            </tr>
            <tr>
              <td class="py-2.5 font-bold text-sky-400">POST</td>
              <td class="py-2.5 text-slate-100">/api/orders/daily</td>
              <td class="py-2.5 text-slate-400 font-sans">Penarikan pesanan multi-chunk dengan nomor resi & SKU</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-800 bg-[#0f172a] px-6 py-4 text-center text-xs text-slate-500">
    ERP Begood • Sistem Manajemen Toko Shopee (b e g o o d . b d g) • Vercel Serverless Middleware & Google Sheets
  </footer>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  // Jika klien meminta JSON (misal API, curl, atau Google Apps Script)
  res.status(200).json({
    service: 'Begood Shopee ERP Middleware',
    version: '1.0.0',
    store: 'b e g o o d . b d g',
    shop_id: 1564950615,
    status: 'ONLINE',
    endpoints: {
      health: '/api/health',
      auth_url: '/api/auth/url',
      auth_callback: '/api/auth/callback',
      auth_refresh: '/api/auth/refresh',
      orders_daily: '/api/orders/daily',
    },
    timestamp: new Date().toISOString(),
  });
}
