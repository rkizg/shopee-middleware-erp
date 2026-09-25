import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OrderService } from '../../src/services/order.service.js';
import { validateAuth } from '../../src/lib/auth-guard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate security secret
  if (!validateAuth(req, res)) {
    return;
  }

  try {
    const payload = req.method === 'POST' ? req.body : req.query;

    const timeFrom = payload?.time_from ? Number(payload.time_from) : undefined;
    const timeTo = payload?.time_to ? Number(payload.time_to) : undefined;
    const orderStatus = payload?.order_status ? String(payload.order_status) : undefined;
    const shopId = payload?.shop_id ? Number(payload.shop_id) : undefined;

    const accessToken = payload?.access_token as string | undefined;
    const refreshToken = payload?.refresh_token as string | undefined;
    const expiredAt = payload?.expired_at ? Number(payload.expired_at) : undefined;

    const result = await OrderService.getOrders({
      time_from: timeFrom,
      time_to: timeTo,
      order_status: orderStatus,
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
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders from Shopee',
      error: error.message || String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
