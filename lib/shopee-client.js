import { ShopeeSDK } from '@congminh1254/shopee-sdk';
import { SheetTokenStorage } from './sheet-token-storage.js';

export function createShopeeClient(shopId) {
  const tokenStorage = new SheetTokenStorage(shopId);

  return new ShopeeSDK({
    partner_id: parseInt(process.env.SHOPEE_PARTNER_ID),
    partner_key: process.env.SHOPEE_PARTNER_KEY,
    shop_id: parseInt(shopId),
    tokenStorage,
  });
}
