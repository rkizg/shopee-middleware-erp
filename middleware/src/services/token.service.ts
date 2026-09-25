import { createShopeeClient } from '../lib/shopee.js';
import type { AccessToken } from '@congminh1254/shopee-sdk/schemas';

export class TokenService {
  /**
   * Generates the Shopee OAuth 2.0 authorization URL
   */
  static getAuthorizationUrl(redirectUri?: string): string {
    const defaultRedirect = process.env.SHOPEE_REDIRECT_URI || '';
    const targetRedirect = redirectUri || defaultRedirect;

    if (!targetRedirect) {
      throw new Error('Redirect URI is required. Set SHOPEE_REDIRECT_URI in env or pass redirect_uri parameter.');
    }

    const { sdk } = createShopeeClient();
    return sdk.getAuthorizationUrl(targetRedirect, {
      auth_type: 'seller',
    });
  }

  /**
   * Exchanges an authorization code received from Shopee callback for an AccessToken pair
   */
  static async exchangeCodeForToken(code: string, shopId?: number): Promise<AccessToken> {
    const { sdk, shopId: defaultShopId } = createShopeeClient({ shopId });
    const targetShopId = shopId || defaultShopId;

    if (!code) {
      throw new Error('Authorization code is missing.');
    }

    const token = await sdk.auth.getAccessToken(code, targetShopId);
    
    // Ensure shop_id and expired_at are properly populated
    if (!token.shop_id && targetShopId) {
      token.shop_id = targetShopId;
    }
    if (!token.expired_at && token.expire_in) {
      token.expired_at = Date.now() + token.expire_in * 1000;
    }

    return token;
  }

  /**
   * Refreshes an expired or expiring access token using a refresh token
   */
  static async refreshToken(refreshToken: string, shopId?: number): Promise<AccessToken> {
    const { sdk, shopId: defaultShopId } = createShopeeClient({ shopId });
    const targetShopId = shopId || defaultShopId;

    if (!refreshToken) {
      throw new Error('Refresh token is missing.');
    }

    const token = await sdk.auth.getRefreshToken(refreshToken, targetShopId);

    if (!token.shop_id && targetShopId) {
      token.shop_id = targetShopId;
    }
    if (!token.expired_at && token.expire_in) {
      token.expired_at = Date.now() + token.expire_in * 1000;
    }

    return token;
  }
}
