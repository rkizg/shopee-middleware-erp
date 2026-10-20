import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ShippingService } from '../../src/services/shipping.service.js';
import { validateAuth } from '../../src/lib/auth-guard.js';

async function parseBody(req: VercelRequest): Promise<any> {
  if (req.method !== 'POST' && req.method !== 'PUT') return req.query || {};
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (req.body && Buffer.isBuffer(req.body)) {
    try { return JSON.parse(req.body.toString('utf-8')); } catch (e) { return {}; }
  }
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.query || {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!validateAuth(req, res)) {
    return;
  }

  try {
    const payload = await parseBody(req);
    const orderSn = String(payload?.order_sn || req.query?.order_sn || '').trim();

    if (!orderSn) {
      return res.status(400).json({
        success: false,
        message: 'Parameter order_sn wajib diisi.',
      });
    }

    const rawShopId = payload?.shop_id || req.headers['x-shopee-shop-id'] || req.query?.shop_id;
    const shopId = (rawShopId && !isNaN(Number(rawShopId))) ? Number(rawShopId) : undefined;

    const accessToken = (
      payload?.access_token ||
      req.headers['x-shopee-access-token'] ||
      req.query?.access_token
    ) as string | undefined;

    const refreshToken = (
      payload?.refresh_token ||
      req.headers['x-shopee-refresh-token'] ||
      req.query?.refresh_token
    ) as string | undefined;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'access_token tidak ditemukan.',
      });
    }

    const pickup = payload?.pickup;
    const dropoff = payload?.dropoff;
    const nonIntegrated = payload?.non_integrated;

    const result = await ShippingService.shipOrder({
      order_sn: orderSn,
      pickup,
      dropoff,
      non_integrated: nonIntegrated,
      shop_id: shopId,
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return res.status(200).json({
      success: true,
      message: `Pesanan ${orderSn} berhasil diatur pengirimannya`,
      data: result.data,
      new_token: result.new_token || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in ship order handler:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Gagal memproses atur pengiriman pesanan',
      error: err.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
}
