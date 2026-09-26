import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Jika Shopee mengarahkan callback ke domain dasar (root /) dengan kode otorisasi
  if (req.query.code) {
    const query = new URLSearchParams(req.query as Record<string, string>).toString();
    return res.redirect(307, `/api/auth/callback?${query}`);
  }

  res.status(200).json({
    service: 'Begood Shopee ERP Middleware',
    version: '1.0.0',
    store: 'b e g o o d . b d g',
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
