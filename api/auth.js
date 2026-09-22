import { ShopeeSDK } from "@congminh1254/shopee-sdk";

export default async function handler(req, res) {
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRCqpdLRrHa90lRa2Ib9fSnqT0oe3EkeH7XHTiNLm6TF9Y-SNqFru4wYawmwMDJmGb/exec";

  const googleSheetsStorage = {
    async getToken(shopId) {
      try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=get`);
        const data = await response.json();
        return typeof data === 'string' ? JSON.parse(data) : data;
      } catch (e) {
        return null;
      }
    },
    async saveToken(shopId, tokenData) {
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
      host: "https://partner.shopeemobile.com",
      shop_id: Number(process.env.SHOPEE_SHOP_ID),
      storage: googleSheetsStorage 
    });

    // Jika ini adalah callback redirect dari Shopee setelah login
    if (req.query && req.query.code) {
      await sdk.auth.getTokenWithAuthCode({
        code: req.query.code,
        shop_id: Number(req.query.shop_id || process.env.SHOPEE_SHOP_ID)
      });
      return res.status(200).send("Otorisasi Berhasil! Token sudah tersimpan otomatis ke Google Sheets. Anda bisa menutup halaman ini.");
    }

    // Jika diakses biasa, arahkan ke halaman login Partner Shopee
    const authUrl = sdk.auth.getAuthorizationUrl({
      redirect_uri: "https://shopee-middleware-erp.vercel.app/api/auth"
    });

    return res.redirect(authUrl);

  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
