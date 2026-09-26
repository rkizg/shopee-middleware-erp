/**
 * DEBUG ONLY endpoint — returns raw Shopee getOrderList response for one 14-day chunk.
 * Used to diagnose why only a few orders are returned.
 *
 * POST /api/orders/debug
 * Body: { access_token, refresh_token?, expired_at?, shop_id?, time_from?, time_to? }
 *
 * Remove or protect this endpoint before going to production!
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createShopeeClient } from '../../src/lib/shopee.js';
import { validateAuth } from '../../src/lib/auth-guard.js';
import type { AccessToken } from '@congminh1254/shopee-sdk/schemas';

async function parseBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (req.body && Buffer.isBuffer(req.body)) {
    try { return JSON.parse(req.body.toString('utf-8')); } catch { return {}; }
  }
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.query || {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!validateAuth(req, res)) return;

  try {
    const payload = await parseBody(req);

    const accessToken = String(payload.access_token || req.headers['x-shopee-access-token'] || '').trim();
    const refreshToken = String(payload.refresh_token || req.headers['x-shopee-refresh-token'] || '').trim();
    const shopId = payload.shop_id ? Number(payload.shop_id) : undefined;

    let expiredAt: number = Date.now() + 14400 * 1000;
    if (payload.expired_at) {
      const exp = Number(payload.expired_at);
      if (!isNaN(exp) && exp > 0) {
        expiredAt = exp < 10000000000 ? exp * 1000 : exp;
      }
    }

    if (!accessToken) {
      return res.status(400).json({ success: false, error: 'access_token is required' });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    // Default: last 14 days
    const timeTo = payload.time_to ? Number(payload.time_to) : nowSec;
    const timeFrom = payload.time_from ? Number(payload.time_from) : (nowSec - 14 * 86400);

    const initialToken: Partial<AccessToken> = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expired_at: expiredAt,
      shop_id: shopId,
    };

    const { sdk } = createShopeeClient({ shopId, initialToken });

    // Test 3 scenarios in parallel to get maximum diagnostic data
    const scenarios = [
      { label: 'create_time_no_status', time_range_field: 'create_time' as const, order_status: undefined },
      { label: 'update_time_no_status', time_range_field: 'update_time' as const, order_status: undefined },
      { label: 'create_time_UNPAID', time_range_field: 'create_time' as const, order_status: 'UNPAID' },
    ];

    const results = await Promise.all(scenarios.map(async (sc) => {
      try {
        const req: any = {
          time_range_field: sc.time_range_field,
          time_from: timeFrom,
          time_to: timeTo,
          page_size: 100,
          request_order_status_pending: true,
          response_optional_fields: 'order_status',
        };
        if (sc.order_status) req.order_status = sc.order_status;

        const raw: any = await sdk.order.getOrderList(req);
        const data = raw?.response || raw?.result || raw;
        return {
          scenario: sc.label,
          error: raw?.error || null,
          message: raw?.message || null,
          total_count: data?.total_count ?? null,
          order_list_length: (data?.order_list || []).length,
          more: data?.more ?? null,
          next_cursor: data?.next_cursor ?? null,
          order_sns: (data?.order_list || []).map((o: any) => o.order_sn),
          raw_response_keys: Object.keys(raw || {}),
        };
      } catch (err: any) {
        return { scenario: sc.label, error: err.message || String(err), order_list_length: 0, order_sns: [] };
      }
    }));

    // Test getOrderDetail with array vs comma string on sample SNs
    const sampleSns = (results[0]?.order_sns || []).slice(0, 5);
    let detailTestResult: any = null;
    if (sampleSns.length > 0) {
      try {
        const [resArray, resString] = await Promise.all([
          sdk.order.getOrderDetail({
            order_sn_list: sampleSns as any,
            response_optional_fields: 'buyer_username,item_list',
          }).catch((e: any) => ({ error: e.message })),
          sdk.order.getOrderDetail({
            order_sn_list: sampleSns.join(',') as any,
            response_optional_fields: 'buyer_username,item_list',
          }).catch((e: any) => ({ error: e.message })),
        ]);

        // Also test tracking_number on shipped order
        let trackingTest: any = null;
        try {
          const testShippedSn = '2609250U2XMU1C';
          const rawDetail: any = await sdk.order.getOrderDetail({
            order_sn_list: testShippedSn as any,
            response_optional_fields: 'package_list,shipping_carrier,item_list',
          });
          const rawOrder = (rawDetail?.response?.order_list || [])[0] || {};
          let trackingApiRes: any = null;
          try {
            trackingApiRes = await sdk.logistics.getTrackingNumber({ order_sn: testShippedSn });
          } catch (e: any) {
            trackingApiRes = { error: e.message };
          }

          let massTrackingRes: any = null;
          try {
            massTrackingRes = await sdk.logistics.getMassTrackingNumber({
              package_list: [{ package_number: 'OFG244029092242209' }]
            });
          } catch (e: any) {
            massTrackingRes = { error: e.message };
          }

          trackingTest = {
            order_sn: testShippedSn,
            raw_tracking_number: rawOrder.tracking_number ?? null,
            raw_package_list: rawOrder.package_list ?? null,
            logistics_api_result: trackingApiRes,
            mass_tracking_result: massTrackingRes,
          };
        } catch (e: any) {
          trackingTest = { error: e.message };
        }

        detailTestResult = {
          sample_sns_count: sampleSns.length,
          sample_sns: sampleSns,
          array_test: {
            returned_count: (resArray as any)?.response?.order_list?.length ?? null,
            error: (resArray as any)?.error ?? null,
          },
          string_test: {
            returned_count: (resString as any)?.response?.order_list?.length ?? null,
            error: (resString as any)?.error ?? null,
          },
          tracking_test: trackingTest,
        };
      } catch (err: any) {
        detailTestResult = { error: err.message };
      }
    }

    return res.status(200).json({
      success: true,
      debug: {
        time_from_sec: timeFrom,
        time_to_sec: timeTo,
        time_from_iso: new Date(timeFrom * 1000).toISOString(),
        time_to_iso: new Date(timeTo * 1000).toISOString(),
        shop_id: shopId,
        scenarios: results,
        detail_test: detailTestResult,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || String(error) });
  }
}
