import { ShopeeSDK, ShopeeRegion } from "@congminh1254/shopee-sdk";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Hanya menerima POST request' });
  }

  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRCqpdLRrHa90lRa2Ib9fSnqT0oe3EkeH7XHTiNLm6TF9Y-SNqFru4wYawmwMDJmGb/exec";

  const googleSheetsStorage = {
    async getToken(shopId: number) {
      try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=get`);
        return await response.json();
      } catch (e) {
        return null;
      }
    },
    async saveToken(shopId: number, tokenData: any) {
      await fetch(`${APPS_SCRIPT_URL}?action=save`, {
        method: 'POST',
        body: JSON.stringify(tokenData),
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };

  try {
    const sdk = new ShopeeSDK({
      partner_id: Number(process.env.SHOPEE_PARTNER_ID),
      partner_key: process.env.SHOPEE_PARTNER_KEY,
      region: ShopeeRegion.GLOBAL, 
      shop_id: Number(process.env.SHOPEE_SHOP_ID),
      storage: googleSheetsStorage 
    });

    const orders = await sdk.order.getOrderList({
      time_range_field: "create_time",
      time_from: Math.floor(Date.now() / 1000) - 86400, 
      time_to: Math.floor(Date.now() / 1000),
      page_size: 50,
    });

    return res.status(200).json({ status: "sukses", data: orders });

  } catch (error: any) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
