import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const partnerIdSet = Boolean(process.env.SHOPEE_PARTNER_ID);
  const partnerKeySet = Boolean(process.env.SHOPEE_PARTNER_KEY);
  const shopIdSet = Boolean(process.env.SHOPEE_SHOP_ID);
  const apiSecretSet = Boolean(process.env.BEGOOD_API_SECRET);
  const redirectUriSet = Boolean(process.env.SHOPEE_REDIRECT_URI);

  const ready = partnerIdSet && partnerKeySet && shopIdSet && apiSecretSet;

  res.status(200).json({
    status: ready ? 'READY' : 'CONFIGURATION_INCOMPLETE',
    timestamp: new Date().toISOString(),
    config: {
      partner_id_configured: partnerIdSet,
      partner_key_configured: partnerKeySet,
      shop_id_configured: shopIdSet,
      api_secret_configured: apiSecretSet,
      redirect_uri_configured: redirectUriSet,
      region: process.env.SHOPEE_REGION || 'GLOBAL',
      redirect_uri: process.env.SHOPEE_REDIRECT_URI || '(Not set)',
    },
    message: ready
      ? 'All environment variables configured. Middleware ready for operations.'
      : 'Some environment variables are missing. Please configure them in Vercel project settings.',
  });
}
