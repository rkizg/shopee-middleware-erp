// api/auth/url.js

import { createShopeeClient } from '../../lib/shopee-client.js';

export default async function handler(req, res) {
  const { shop_id } = req.query;

  if (!shop_id) {
    return res.status(400).json({ error: 'shop_id diperlukan' });
  }

  const sdk = createShopeeClient(shop_id);
  const authUrl = sdk.getAuthorizationUrl(process.env.SHOPEE_REDIRECT_URI);

  return res.status(200).json({ auth_url: authUrl });
}