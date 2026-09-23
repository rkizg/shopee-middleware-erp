// lib/shopee-client.js

import { ShopeeSDK } from '@congminh1254/shopee-sdk';
import { SheetTokenStorage } from './sheet-token-storage.js';

export function createShopeeClient(shopId) {
  const tokenStorage = new SheetTokenStorage(shopId);

  const sdk = new ShopeeSDK({
    partner_id: parseInt(process.env.SHOPEE_PARTNER_ID),
    partner_key: process.env.SHOPEE_PARTNER_KEY,
    shop_id: shopId,
    tokenStorage: tokenStorage, // Gunakan storage kustom
  });

  return sdk;
}