// api/auth/callback.js

import { createShopeeClient } from '../../lib/shopee-client.js';

const GAS_URL = process.env.GAS_WEBAPP_URL;
const GAS_SECRET = process.env.GAS_SECRET;

export default async function handler(req, res) {
  const { code, shop_id } = req.query;

  if (!code || !shop_id) {
    return res.status(400).json({ error: 'code dan shop_id diperlukan' });
  }

  try {
    const sdk = createShopeeClient(shop_id);

    // SDK akan otomatis menyimpan token melalui SheetTokenStorage
    await sdk.authenticateWithCode(code, parseInt(shop_id));

    // Catat log ke GAS
    await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log',
        secret: GAS_SECRET,
        data: {
          event: 'AUTH_SUCCESS',
          detail: `Shop ${shop_id} berhasil terautentikasi.`,
        },
      }),
    });

    return res.status(200).json({ success: true, message: 'Autentikasi berhasil' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}