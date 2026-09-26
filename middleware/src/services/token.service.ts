import crypto from 'node:crypto';
import { createShopeeClient } from '../lib/shopee.js';
import type { AccessToken } from '@congminh1254/shopee-sdk/schemas';

export class TokenService {
  /**
   * Generates the official Shopee Open API v2 Shop Authorization URL with HMAC-SHA256 signature
   * Endpoint: /api/v2/shop/auth_partner
   */
  static getAuthorizationUrl(redirectUri?: string): string {
    const partnerId = Number(process.env.SHOPEE_PARTNER_ID || 0);
    const partnerKey = process.env.SHOPEE_PARTNER_KEY || '';

    if (!partnerId) {
      throw new Error('SHOPEE_PARTNER_ID belum dikonfigurasi di Environment Variables Vercel.');
    }
    if (!partnerKey) {
      throw new Error('SHOPEE_PARTNER_KEY belum dikonfigurasi di Environment Variables Vercel.');
    }

    const defaultRedirect = process.env.SHOPEE_REDIRECT_URI || '';
    const targetRedirect = redirectUri || defaultRedirect;

    if (!targetRedirect) {
      throw new Error('Redirect URI belum tersedia. Setel SHOPEE_REDIRECT_URI di Vercel atau masukkan parameter redirect_uri.');
    }

    const isSandbox = process.env.SHOPEE_REGION?.toUpperCase() === 'TEST_GLOBAL';
    const host = isSandbox
      ? 'https://partner.test-stable.shopeemobile.com'
      : 'https://partner.shopeemobile.com';
    const path = '/api/v2/shop/auth_partner';
    const timestamp = Math.floor(Date.now() / 1000);

    // Rumus Signature Resmi Shopee v2:
    // HMAC-SHA256(partner_key, partner_id + path + timestamp)
    const baseString = `${partnerId}${path}${timestamp}`;
    const sign = crypto
      .createHmac('sha256', partnerKey)
      .update(baseString)
      .digest('hex');

    const url = new URL(`${host}${path}`);
    url.searchParams.append('partner_id', partnerId.toString());
    url.searchParams.append('timestamp', timestamp.toString());
    url.searchParams.append('sign', sign);
    url.searchParams.append('redirect', targetRedirect);

    return url.toString();
  }

  /**
   * Exchanges an authorization code received from Shopee callback for an AccessToken pair
   * Automatically attempts Sandbox if Live fails (and vice-versa)
   */
  static async exchangeCodeForToken(code: string, shopId?: number): Promise<AccessToken> {
    const targetShopId = shopId || Number(process.env.SHOPEE_SHOP_ID || 0);

    if (!code) {
      throw new Error('Authorization code is missing.');
    }

    const currentRegion = (process.env.SHOPEE_REGION || 'GLOBAL').toUpperCase();
    const fallbackRegion = currentRegion === 'TEST_GLOBAL' ? 'GLOBAL' : 'TEST_GLOBAL';

    try {
      const { sdk } = createShopeeClient({ shopId: targetShopId, region: currentRegion });
      const token = await sdk.auth.getAccessToken(code, targetShopId);
      
      if (!token.shop_id && targetShopId) {
        token.shop_id = targetShopId;
      }
      if (!token.expired_at && token.expire_in) {
        token.expired_at = Date.now() + token.expire_in * 1000;
      }

      return token;
    } catch (primaryErr: any) {
      console.warn(`Primary exchange token failed on ${currentRegion}:`, primaryErr.message);

      // Otomatis coba fallback ke lingkungan alternatif (Sandbox / Live)
      try {
        const { sdk: fallbackSdk } = createShopeeClient({ shopId: targetShopId, region: fallbackRegion });
        const token = await fallbackSdk.auth.getAccessToken(code, targetShopId);

        if (!token.shop_id && targetShopId) {
          token.shop_id = targetShopId;
        }
        if (!token.expired_at && token.expire_in) {
          token.expired_at = Date.now() + token.expire_in * 1000;
        }

        console.log(`Fallback exchange token SUCCEEDED on ${fallbackRegion}!`);
        return token;
      } catch (fallbackErr: any) {
        // Jika keduanya gagal, lemparkan error asli yang lebih relevan
        throw primaryErr;
      }
    }
  }

  /**
   * Refreshes an expired or expiring access token using a refresh token
   * Automatically attempts Sandbox if Live fails (and vice-versa)
   */
  static async refreshToken(refreshToken: string, shopId?: number): Promise<AccessToken> {
    const targetShopId = shopId || Number(process.env.SHOPEE_SHOP_ID || 0);

    if (!refreshToken) {
      throw new Error('Refresh token is missing.');
    }

    const currentRegion = (process.env.SHOPEE_REGION || 'GLOBAL').toUpperCase();
    const fallbackRegion = currentRegion === 'TEST_GLOBAL' ? 'GLOBAL' : 'TEST_GLOBAL';

    try {
      const { sdk } = createShopeeClient({ shopId: targetShopId, region: currentRegion });
      const token = await sdk.auth.getRefreshToken(refreshToken, targetShopId);

      if (!token.shop_id && targetShopId) {
        token.shop_id = targetShopId;
      }
      if (!token.expired_at && token.expire_in) {
        token.expired_at = Date.now() + token.expire_in * 1000;
      }

      return token;
    } catch (primaryErr: any) {
      try {
        const { sdk: fallbackSdk } = createShopeeClient({ shopId: targetShopId, region: fallbackRegion });
        const token = await fallbackSdk.auth.getRefreshToken(refreshToken, targetShopId);

        if (!token.shop_id && targetShopId) {
          token.shop_id = targetShopId;
        }
        if (!token.expired_at && token.expire_in) {
          token.expired_at = Date.now() + token.expire_in * 1000;
        }

        return token;
      } catch (fallbackErr: any) {
        throw primaryErr;
      }
    }
  }
}
