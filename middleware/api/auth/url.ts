import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TokenService } from '../../src/services/token.service.js';
import { validateAuth } from '../../src/lib/auth-guard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate security secret
  if (!validateAuth(req, res)) {
    return;
  }

  try {
    const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
    const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
    const autoRedirect = host ? `${proto}://${host}/api/auth/callback` : undefined;

    const customRedirect = (req.query?.redirect_uri || req.body?.redirect_uri || process.env.SHOPEE_REDIRECT_URI || autoRedirect) as string | undefined;

    const partnerId = process.env.SHOPEE_PARTNER_ID;
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;
    if (!partnerId || !partnerKey) {
      return res.status(400).json({
        success: false,
        message: 'Variabel lingkungan SHOPEE_PARTNER_ID atau SHOPEE_PARTNER_KEY belum disetel di Vercel Settings > Environment Variables.',
        error: 'CREDENTIALS_MISSING',
        timestamp: new Date().toISOString(),
      });
    }

    const authUrl = TokenService.getAuthorizationUrl(customRedirect);

    return res.status(200).json({
      success: true,
      message: 'Authorization URL generated successfully',
      data: {
        auth_url: authUrl,
        redirect_uri: customRedirect,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error generating auth url:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat URL otorisasi: ' + (error.message || String(error)),
      error: error.message || String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
