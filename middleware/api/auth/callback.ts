import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TokenService } from '../../src/services/token.service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = (req.query.code || req.body?.code) as string;
  const shopIdParam = req.query.shop_id || req.body?.shop_id;
  const shopId = shopIdParam ? Number(shopIdParam) : Number(process.env.SHOPEE_SHOP_ID || 0);

  if (!code) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ERP Begood - Otorisasi Gagal</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
            .card { background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); max-width: 500px; width: 100%; text-align: center; border: 1px solid #ef4444; }
            h1 { color: #ef4444; margin-bottom: 12px; }
            p { color: #94a3b8; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>❌ Otorisasi Gagal</h1>
            <p>Parameter kode otorisasi (code) tidak ditemukan dari Shopee. Silakan coba klik tautan otorisasi ulang dari Google Sheets Anda.</p>
          </div>
        </body>
      </html>
    `);
  }

  try {
    const token = await TokenService.exchangeCodeForToken(code, shopId);
    const expiredDate = new Date(Date.now() + (token.expire_in || 14400) * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const isJson = req.headers.accept?.includes('application/json') || req.query.format === 'json';

    if (isJson) {
      return res.status(200).json({
        success: true,
        message: 'Shopee OAuth token successfully obtained',
        token: {
          shop_id: token.shop_id || shopId,
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expire_in: token.expire_in,
          expired_at: token.expired_at || (Date.now() + (token.expire_in || 14400) * 1000),
          expired_at_formatted: expiredDate,
        },
      });
    }

    const tokenJsonString = JSON.stringify({
      shop_id: token.shop_id || shopId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expire_in: token.expire_in,
      expired_at: token.expired_at || (Date.now() + (token.expire_in || 14400) * 1000),
    });

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>ERP Begood - Otorisasi Shopee Berhasil</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: #0f172a;
              color: #f8fafc;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 24px;
              box-sizing: border-box;
            }
            .card {
              background: #1e293b;
              border-radius: 16px;
              border: 1px solid #334155;
              padding: 36px;
              max-width: 580px;
              width: 100%;
              box-shadow: 0 20px 30px -10px rgba(0,0,0,0.5);
              text-align: center;
            }
            .badge-success {
              display: inline-block;
              background: #065f46;
              color: #34d399;
              font-weight: 600;
              padding: 6px 14px;
              border-radius: 9999px;
              font-size: 13px;
              margin-bottom: 16px;
            }
            h1 {
              font-size: 24px;
              margin: 0 0 8px 0;
              color: #f8fafc;
            }
            .subtitle {
              color: #94a3b8;
              font-size: 14px;
              margin-bottom: 24px;
            }
            .info-box {
              background: #0f172a;
              border: 1px solid #334155;
              border-radius: 10px;
              padding: 16px;
              text-align: left;
              margin-bottom: 24px;
              font-size: 13px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #1e293b;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              color: #64748b;
            }
            .info-val {
              color: #f1f5f9;
              font-weight: 500;
              font-family: monospace;
              word-break: break-all;
            }
            .btn {
              background: #ee4d2d;
              color: white;
              font-weight: 600;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              transition: background 0.2s;
              display: inline-block;
              text-decoration: none;
              margin: 4px;
            }
            .btn:hover {
              background: #d73211;
            }
            .btn-outline {
              background: transparent;
              border: 1px solid #475569;
              color: #cbd5e1;
            }
            .btn-outline:hover {
              background: #334155;
            }
            .toast {
              display: none;
              margin-top: 12px;
              color: #34d399;
              font-size: 13px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge-success">✓ Terhubung ke Shopee Open API</span>
            <h1>Otorisasi Toko Berhasil</h1>
            <p class="subtitle">Toko <strong>b e g o o d . b d g</strong> telah berhasil diotorisasi untuk ERP Begood.</p>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Shop ID:</span>
                <span class="info-val">${token.shop_id || shopId}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Kadaluarsa (Access):</span>
                <span class="info-val">${expiredDate}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Refresh Token:</span>
                <span class="info-val">Berlaku ~30 hari</span>
              </div>
            </div>

            <div>
              <button class="btn" id="copyBtn" onclick="copyToken()">Salin Data Token untuk DB_Token</button>
              <button class="btn btn-outline" onclick="window.close()">Tutup Jendela Ini</button>
            </div>
            <div id="toast" class="toast">✓ Data token berhasil disalin ke clipboard! Masukkan ke sheet DB_Token jika belum tersinkron otomatis.</div>
          </div>

          <script>
            const tokenData = ${JSON.stringify(tokenJsonString)};
            function copyToken() {
              navigator.clipboard.writeText(tokenData).then(() => {
                document.getElementById('toast').style.display = 'block';
                setTimeout(() => {
                  document.getElementById('toast').style.display = 'none';
                }, 4000);
              });
            }
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Error exchanging token:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ERP Begood - Kesalahan Otorisasi</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
            .card { background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #ef4444; max-width: 520px; text-align: center; }
            h1 { color: #f87171; }
            pre { background: #0f172a; padding: 12px; border-radius: 8px; color: #fda4af; text-align: left; overflow-x: auto; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Gagal Menukar Token Shopee</h1>
            <p>Terjadi kendala saat menukar authorization code dengan Shopee Open API.</p>
            <pre>${error.message || String(error)}</pre>
          </div>
        </body>
      </html>
    `);
  }
}
