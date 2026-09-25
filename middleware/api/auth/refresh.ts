import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TokenService } from '../../src/services/token.service.js';
import { validateAuth } from '../../src/lib/auth-guard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate security secret
  if (!validateAuth(req, res)) {
    return;
  }

  const refreshToken = (req.body?.refresh_token || req.query?.refresh_token) as string;
  const shopIdParam = req.body?.shop_id || req.query?.shop_id;
  const shopId = shopIdParam ? Number(shopIdParam) : Number(process.env.SHOPEE_SHOP_ID || 0);

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'refresh_token parameter is required',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const newToken = await TokenService.refreshToken(refreshToken, shopId);
    const expiredAt = newToken.expired_at || (Date.now() + (newToken.expire_in || 14400) * 1000);
    const expiredDate = new Date(expiredAt).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    return res.status(200).json({
      success: true,
      message: 'Token successfully refreshed',
      data: {
        shop_id: newToken.shop_id || shopId,
        access_token: newToken.access_token,
        refresh_token: newToken.refresh_token,
        expire_in: newToken.expire_in,
        expired_at: expiredAt,
        expired_at_formatted: expiredDate,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error refreshing token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh token with Shopee Open API',
      error: error.message || String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
