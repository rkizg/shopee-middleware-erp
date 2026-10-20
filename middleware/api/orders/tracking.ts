import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createShopeeClient } from '../../src/lib/shopee.js';
import { validateAuth } from '../../src/lib/auth-guard.js';

async function parseBody(req: VercelRequest): Promise<any> {
  if (req.method !== 'POST' && req.method !== 'PUT') return req.query || {};

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (req.body && Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf-8'));
    } catch (e) {
      return {};
    }
  }
  if (req.body && typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  if (req.readable) {
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        let buffer = '';
        req.on('data', (chunk) => { buffer += chunk; });
        req.on('end', () => resolve(buffer));
        req.on('error', (err) => reject(err));
      });
      if (raw && raw.trim()) {
        return JSON.parse(raw);
      }
    } catch (e) {}
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

    // Kumpulkan order_sn_list
    let orderSnList: string[] = [];
    const rawList = payload?.order_sn_list || req.query?.order_sn_list || req.headers['x-shopee-order-sn-list'];
    if (rawList) {
      if (Array.isArray(rawList)) {
        orderSnList = rawList.map(String).map((s: string) => s.trim()).filter(Boolean);
      } else if (typeof rawList === 'string') {
        orderSnList = rawList.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }

    const singleSn = String(
      payload?.order_sn ||
      req.query?.order_sn ||
      req.headers['x-shopee-order-sn'] ||
      ''
    ).trim();

    if (singleSn && !orderSnList.includes(singleSn)) {
      orderSnList.push(singleSn);
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

    const { sdk } = createShopeeClient({
      shopId,
      initialToken: { access_token: accessToken, refresh_token: refreshToken, shop_id: shopId },
    });

    // 1. Ambil detail pesanan ringan (order_sn_list up to 50)
    const detailRes: any = await sdk.order.getOrderDetail({
      order_sn_list: (orderSnList.slice(0, 50).join(',') as unknown as string[]),
      response_optional_fields: 'package_list,shipping_carrier',
    });

    const orders = detailRes?.response?.order_list || detailRes?.result?.order_list || [];
    const resultMap: Record<string, { tracking_number: string; order_status: string; shipping_carrier: string; package_number: string }> = {};

    const packageNumbers: string[] = [];
    const pkgToSn = new Map<string, string>();

    for (const ord of orders) {
      const sn = String(ord.order_sn);
      const pkgList = Array.isArray(ord.package_list) ? ord.package_list : [];
      const firstPkg = pkgList[0] || {};
      const pkgNum = firstPkg.package_number || '';

      resultMap[sn] = {
        tracking_number: String(ord.tracking_number || '').trim(),
        order_status: String(ord.order_status || '').trim(),
        shipping_carrier: String(ord.shipping_carrier || '').trim(),
        package_number: pkgNum,
      };

      if (!resultMap[sn].tracking_number && pkgNum) {
        packageNumbers.push(pkgNum);
        pkgToSn.set(pkgNum, sn);
      }
    }

    // 2. Jika ada paket yang nomor resinya belum ada di order level, gunakan getMassTrackingNumber
    if (packageNumbers.length > 0) {
      try {
        const massRes: any = await sdk.logistics.getMassTrackingNumber({
          package_list: packageNumbers.map((pkg) => ({ package_number: pkg })),
        });
        const successList = massRes?.response?.success_list || massRes?.result?.success_list || [];
        for (const item of successList) {
          if (item.tracking_number && item.package_number) {
            const sn = pkgToSn.get(item.package_number);
            if (sn && resultMap[sn]) {
              resultMap[sn].tracking_number = String(item.tracking_number).trim();
            }
          }
        }
      } catch (massErr: any) {
        console.warn('[TrackingHandler] getMassTrackingNumber error:', massErr?.message || massErr);
      }
    }

    // 3. Fallback satuan: jika hanya 1 pesanan dan resi masih kosong, coba getTrackingNumber langsung
    if (orderSnList.length === 1) {
      const targetSn = orderSnList[0];
      if (resultMap[targetSn] && !resultMap[targetSn].tracking_number) {
        try {
          const singleTrack: any = await sdk.logistics.getTrackingNumber({
            order_sn: targetSn,
          });
          const trNum = singleTrack?.response?.tracking_number || singleTrack?.result?.tracking_number || '';
          if (trNum) {
            resultMap[targetSn].tracking_number = String(trNum).trim();
          }
        } catch (stErr: any) {
          console.warn('[TrackingHandler] single getTrackingNumber error:', stErr?.message || stErr);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Berhasil memeriksa resi untuk ${Object.keys(resultMap).length} pesanan`,
      count: Object.keys(resultMap).length,
      data: resultMap,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in tracking handler:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Gagal memeriksa nomor resi',
      error: err.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
}
