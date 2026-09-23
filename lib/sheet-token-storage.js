const GAS_URL = process.env.GAS_WEBAPP_URL;
const GAS_SECRET = process.env.GAS_SECRET;

export class SheetTokenStorage {
  constructor(shopId) {
    this.shopId = shopId;
  }

  async store(token) {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveToken',
        secret: GAS_SECRET,
        data: {
          shop_id: token.shop_id || this.shopId,
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expire_in: token.expire_in,
          expired_at: token.expired_at,
        },
      }),
    });
    const result = await response.json();
    if (!result.success) throw new Error(`Gagal menyimpan token: ${result.error}`);
  }

  async get() {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getToken',
        secret: GAS_SECRET,
        shop_id: this.shopId,
      }),
    });
    const result = await response.json();
    if (!result.success || !result.data) return null;
    return {
      shop_id: result.data.shop_id,
      access_token: result.data.access_token,
      refresh_token: result.data.refresh_token,
      expire_in: result.data.expire_in,
      expired_at: result.data.expired_at,
    };
  }

  async clear() {
    // Opsional
  }
}
