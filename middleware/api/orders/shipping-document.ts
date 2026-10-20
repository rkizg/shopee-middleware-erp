import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ShippingService } from '../../src/services/shipping.service.js';
import { validateAuth } from '../../src/lib/auth-guard.js';

async function parseBody(req: VercelRequest): Promise<any> {
  if (req.method !== 'POST' && req.method !== 'PUT') return req.query || {};
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (req.body && Buffer.isBuffer(req.body)) {
    try { return JSON.parse(req.body.toString('utf-8')); } catch (e) { return {}; }
  }
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.query || {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!validateAuth(req, res)) {
    return;
  }

  try {
    const payload = await parseBody(req);

    // Dapatkan list order_sn
    let orderSnList: string[] = [];
    if (payload?.order_sn_list) {
      if (Array.isArray(payload.order_sn_list)) {
        orderSnList = payload.order_sn_list.map(String).map((s: string) => s.trim()).filter(Boolean);
      } else if (typeof payload.order_sn_list === 'string') {
        orderSnList = payload.order_sn_list.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    } else if (payload?.order_sn || req.query?.order_sn) {
      const single = String(payload?.order_sn || req.query?.order_sn).trim();
      if (single) orderSnList.push(single);
    }

    if (orderSnList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Parameter order_sn atau order_sn_list wajib disertakan.',
      });
    }

    const rawShopId = payload?.shop_id || req.headers['x-shopee-shop-id'] || req.query?.shop_id;
    const shopId = (rawShopId && !isNaN(Number(rawShopId))) ? Number(rawShopId) : undefined;

    const accessToken = (
      payload?.access_token ||
      req.headers['x-shopee-access-token'] ||
      req.query?.access_token
    ) as string | undefined;

    const refreshToken = (
      payload?.refresh_token ||
      req.headers['x-shopee-refresh-token'] ||
      req.query?.refresh_token
    ) as string | undefined;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'access_token tidak ditemukan.',
      });
    }

    const docType = (payload?.document_type || req.query?.document_type || 'THERMAL_AIR_WAYBILL') as string;

    const result = await ShippingService.getShippingDocument({
      order_sn_list: orderSnList,
      shipping_document_type: docType,
      shop_id: shopId,
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const isDirectPdf = req.query?.format === 'pdf' ||
      (req.headers['accept'] && req.headers['accept'].includes('application/pdf')) ||
      (req.method === 'GET' && req.query?.format !== 'json');

    if (isDirectPdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="resi-thermal-${orderSnList[0] || 'shopee'}.pdf"`);
      return res.status(200).send(result.data.pdf_buffer);
    }

    return res.status(200).json({
      success: true,
      message: `Berhasil mengunduh dokumen resi untuk ${orderSnList.length} pesanan`,
      data: {
        pdf_base64: result.data.pdf_buffer.toString('base64'),
        order_count: result.data.order_count,
        document_type: docType,
      },
      new_token: result.new_token || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in shipping-document handler:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Gagal membuat/mengunduh dokumen resi',
      error: err.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
}
