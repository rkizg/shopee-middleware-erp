import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(200).json({
      code: 0,
      success: true,
      message: 'Shopee real-time webhook endpoint ready'
    });
  }

  try {
    const rawBody = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body || {});
    const payload = typeof req.body === 'object' && req.body !== null
      ? req.body
      : JSON.parse(rawBody || '{}');

    const partnerKey = process.env.SHOPEE_PARTNER_KEY || '';
    const begoodSecret = process.env.BEGOOD_API_SECRET || '';
    const headerSecret = String(req.headers['x-begood-secret'] || payload.secret || '').trim();
    const authorization = String(req.headers['authorization'] || '').trim();

    // Verify either x-begood-secret or Shopee HMAC-SHA256 webhook signature when present
    if (authorization && partnerKey && (!begoodSecret || headerSecret !== begoodSecret)) {
      const host = req.headers['x-forwarded-host'] || req.headers.host || '';
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const webhookUrl = `${proto}://${host}${req.url || '/api/orders/webhook'}`;
      const baseString = `${webhookUrl}|${rawBody}`;
      const expectedSig = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
      if (expectedSig !== authorization && begoodSecret && headerSecret && headerSecret !== begoodSecret) {
        return res.status(401).json({ code: 1, success: false, message: 'Invalid webhook signature' });
      }
    } else if (begoodSecret && headerSecret && headerSecret !== begoodSecret) {
      return res.status(401).json({ code: 1, success: false, message: 'Unauthorized secret' });
    }

    const orderSn = String(
      payload?.data?.ordersn ||
      payload?.data?.order_sn ||
      payload?.order_sn ||
      req.query?.order_sn ||
      ''
    ).trim();

    const gasWebAppUrl = String(
      payload?.gas_webapp_url ||
      process.env.GAS_WEBAPP_URL ||
      ''
    ).trim();

    let gasForwarded = false;
    let gasResult: any = null;

    if (gasWebAppUrl) {
      try {
        const forwardRes = await fetch(gasWebAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: begoodSecret,
            action: orderSn ? 'sync_sn' : (payload?.action || 'invalidate'),
            order_sn: orderSn,
            code: payload?.code,
            shop_id: payload?.shop_id,
            data: payload?.data || {}
          })
        });
        const text = await forwardRes.text();
        try {
          gasResult = JSON.parse(text);
        } catch {
          gasResult = { raw: text.slice(0, 200) };
        }
        gasForwarded = forwardRes.ok;
      } catch (err: any) {
        gasResult = { error: err?.message || String(err) };
      }
    }

    // Shopee Push Mechanism expects HTTP 200 with {"code": 0}
    return res.status(200).json({
      code: 0,
      success: true,
      order_sn: orderSn || null,
      gas_forwarded: gasForwarded,
      gas_result: gasResult,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(200).json({
      code: 0,
      success: false,
      error: error?.message || String(error)
    });
  }
}
