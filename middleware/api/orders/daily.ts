import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OrderService } from '../../src/services/order.service.js';
import { validateAuth } from '../../src/lib/auth-guard.js';

async function parseRequestBody(req: VercelRequest): Promise<any> {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return req.query || {};
  }

  // 1. Plain JS Object
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  // 2. Buffer
  if (req.body && Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf-8'));
    } catch (e) {
      return {};
    }
  }

  // 3. String
  if (req.body && typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }

  // 4. Raw stream fallback
  if (req.readable) {
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        let buffer = '';
        req.on('data', (chunk) => { buffer += chunk; });
        req.on('end', () => resolve(buffer));
        req.on('error', (err) => reject(err));
      });
      if (raw && raw.trim()) {
        return JSON.parse(raw);
      }
    } catch (e) {}
  }

  return req.query || {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate security secret
  if (!validateAuth(req, res)) {
    return;
  }

  try {
    let payload = await parseRequestBody(req);
    if (!payload || typeof payload !== 'object') {
      payload = req.query || {};
    }

    const rawTimeFrom = payload?.time_from || req.headers['x-shopee-time-from'] || req.query?.time_from;
    const timeFrom = (rawTimeFrom !== undefined && rawTimeFrom !== null && !isNaN(Number(rawTimeFrom))) ? Number(rawTimeFrom) : undefined;

    const rawTimeTo = payload?.time_to || req.headers['x-shopee-time-to'] || req.query?.time_to;
    const timeTo = (rawTimeTo !== undefined && rawTimeTo !== null && !isNaN(Number(rawTimeTo))) ? Number(rawTimeTo) : undefined;

    const orderStatus = (payload?.order_status || req.query?.order_status) ? String(payload?.order_status || req.query?.order_status) : undefined;
    
    // Support direct Order SN list lookup
    const rawOrderSnList = payload?.order_sn_list || req.query?.order_sn_list;
    let orderSnList: string[] | undefined = undefined;
    if (rawOrderSnList) {
      if (Array.isArray(rawOrderSnList)) {
        orderSnList = rawOrderSnList.map(String).map((s) => s.trim()).filter(Boolean);
      } else if (typeof rawOrderSnList === 'string') {
        orderSnList = rawOrderSnList.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    const rawShopId = payload?.shop_id || req.headers['x-shopee-shop-id'] || req.query?.shop_id;
    const shopId = (rawShopId && !isNaN(Number(rawShopId))) ? Number(rawShopId) : undefined;

    const rawAccessToken = (
      payload?.access_token ||
      req.headers['x-shopee-access-token'] ||
      req.query?.access_token
    ) as string | undefined;

    const rawRefreshToken = (
      payload?.refresh_token ||
      req.headers['x-shopee-refresh-token'] ||
      req.query?.refresh_token
    ) as string | undefined;

    const accessToken = typeof rawAccessToken === 'string' ? rawAccessToken.trim().replace(/^"+|"+$/g, '') : undefined;
    const refreshToken = typeof rawRefreshToken === 'string' ? rawRefreshToken.trim().replace(/^"+|"+$/g, '') : undefined;

    let expiredAt: number | undefined = undefined;
    const rawExpired = payload?.expired_at || req.query?.expired_at;
    if (rawExpired) {
      const parsedExp = Number(rawExpired);
      if (!isNaN(parsedExp) && parsedExp > 0) {
        expiredAt = parsedExp < 10000000000 ? parsedExp * 1000 : parsedExp;
      }
    }

    if (!accessToken) {
      console.error('NO_ACCESS_TOKEN_PROVIDED. Headers:', Object.keys(req.headers), 'Payload keys:', Object.keys(payload || {}));
      return res.status(400).json({
        success: false,
        message: 'access_token tidak ditemukan dalam request. Periksa sheet DB_Token di Google Sheets.',
        error: 'NO_ACCESS_TOKEN_PROVIDED',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await OrderService.getOrders({
      time_from: timeFrom,
      time_to: timeTo,
      order_status: orderStatus,
      order_sn_list: orderSnList,
      shop_id: shopId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expired_at: expiredAt,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully retrieved ${result.total} orders from Shopee`,
      data: {
        count: result.total,
        time_from: result.time_from,
        time_to: result.time_to,
        orders: result.orders,
        new_token: result.new_token || null,
        diagnostics: result.diagnostics,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders from Shopee: ' + (error.message || String(error)),
      error: error.message || String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
