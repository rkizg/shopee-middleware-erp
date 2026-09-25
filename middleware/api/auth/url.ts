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
    const customRedirect = (req.query?.redirect_uri || req.body?.redirect_uri) as string | undefined;
    const authUrl = TokenService.getAuthorizationUrl(customRedirect);

    return res.status(200).json({
      success: true,
      message: 'Authorization URL generated successfully',
      data: {
        auth_url: authUrl,
        redirect_uri: customRedirect || process.env.SHOPEE_REDIRECT_URI,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error generating auth url:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate authorization URL',
      error: error.message || String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
