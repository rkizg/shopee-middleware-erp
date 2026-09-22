import { ShopeeSDK } from "@congminh1254/shopee-sdk";
import crypto from "crypto";

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
    const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;
    const host = "https://partner.shopeemobile.com";
    const redirectUri = "https://shopee-middleware-erp.vercel.app/api/auth";

    const sdk = new ShopeeSDK({
      partner_id: partnerId,
      partner_key: partnerKey,
      host: host,
      shop_id: Number(process.env.SHOPEE_SHOP_ID),
      storage: googleSheetsStorage 
    });

    // Jika Shopee mengembalikan parameter code setelah login
    if (req.query && req.query.code) {
      await sdk.auth.getTokenWithAuthCode({
        code: req.query.code,
        shop_id: Number(req.query.shop_id || process.env.SHOPEE_SHOP_ID)
      });
      return res.status(200).send("Otorisasi Berhasil! Token sudah tersimpan otomatis ke Google Sheets. Silakan kembali ke Apps Script.");
    }

    // Pembuatan tanda tangan (signature) manual untuk URL Otorisasi Shopee V2
    const path = "/api/v2/shop/auth_partner";
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');

    const authUrl = `${host}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirectUri)}`;

    return res.redirect(authUrl);

  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
