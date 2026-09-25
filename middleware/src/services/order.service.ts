import { createShopeeClient } from '../lib/shopee.js';
import type { ERPOrder, ERPOrderItem } from '../lib/types.js';
import type { AccessToken } from '@congminh1254/shopee-sdk/schemas';

export interface FetchOrdersParams {
  time_from?: number; // Unix timestamp in seconds
  time_to?: number;   // Unix timestamp in seconds
  order_status?: string; // Optional: READY_TO_SHIP, PROCESSED, SHIPPED, etc.
  shop_id?: number;
  access_token?: string;
  refresh_token?: string;
  expired_at?: number;
}

export interface FetchOrdersResult {
  orders: ERPOrder[];
  total: number;
  time_from: number;
  time_to: number;
  new_token?: AccessToken | null;
}

/**
 * Format timestamp (ms or s or Date) to Indonesian WIB string (YYYY-MM-DD HH:mm:ss)
 */
function formatWIB(input?: Date | number): string {
  if (!input) return '';
  const date = (input instanceof Date)
    ? input
    : new Date(typeof input === 'number' && input < 10000000000 ? input * 1000 : input);

  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Map Shopee API status to Begood Internal ERP status
 */
function mapInternalStatus(shopeeStatus?: string): string {
  switch (shopeeStatus?.toUpperCase()) {
    case 'UNPAID':
      return '[0] Menunggu Pembayaran';
    case 'READY_TO_SHIP':
      return '[1] Siap Packing';
    case 'PROCESSED':
      return '[2] Menunggu Pickup';
    case 'SHIPPED':
      return '[3] Sedang Dikirim';
    case 'COMPLETED':
      return '[4] Selesai';
    case 'IN_CANCEL':
      return '[5] Pengajuan Batal';
    case 'CANCELLED':
      return '[6] Dibatalkan';
    default:
      return shopeeStatus || '[1] Pesanan Masuk';
  }
}

export class OrderService {
  /**
   * Fetches daily or filtered orders, resolves details, and normalizes them for Google Sheets.
   */
  static async getOrders(params: FetchOrdersParams): Promise<FetchOrdersResult> {
    const nowSec = Math.floor(Date.now() / 1000);
    // Default to last 3 days if not specified
    const timeFrom = params.time_from || (nowSec - 3 * 86400);
    const timeTo = params.time_to || nowSec;

    // Initialize SDK with passed token or env
    const initialToken: Partial<AccessToken> | null = params.access_token
      ? {
          access_token: params.access_token,
          refresh_token: params.refresh_token || '',
          expired_at: params.expired_at || (Date.now() + 14400 * 1000),
          shop_id: params.shop_id,
        }
      : null;

    const { sdk, storage, shopId } = createShopeeClient({
      shopId: params.shop_id,
      initialToken,
    });

    // 1. Fetch order list with pagination
    const orderSnList: string[] = [];
    let cursor = '';
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES = 20; // safety ceiling (1000 orders max per sync run)

    while (hasMore && pageCount < MAX_PAGES) {
      pageCount++;
      const req: any = {
        time_range_field: 'create_time',
        time_from: timeFrom,
        time_to: timeTo,
        page_size: 50,
      };

      if (cursor) {
        req.cursor = cursor;
      }
      if (params.order_status) {
        req.order_status = params.order_status;
      }

      const listRes: any = await sdk.order.getOrderList(req);
      const data = listRes?.response || listRes?.result || listRes;
      const orders = data?.order_list || [];

      for (const item of orders) {
        if (item.order_sn) {
          orderSnList.push(item.order_sn);
        }
      }

      hasMore = Boolean(data?.more);
      cursor = data?.next_cursor || '';
    }

    if (orderSnList.length === 0) {
      return {
        orders: [],
        total: 0,
        time_from: timeFrom,
        time_to: timeTo,
        new_token: storage.tokenWasUpdated ? storage.getToken() : null,
      };
    }

    // 2. Fetch order details in batches of 50
    const detailedOrders: any[] = [];
    const BATCH_SIZE = 50;

    const optionalFields = [
      'buyer_user_id',
      'buyer_username',
      'estimated_shipping_fee',
      'recipient_address',
      'actual_shipping_fee',
      'note',
      'item_list',
      'pay_time',
      'package_list',
      'shipping_carrier',
      'payment_method',
      'total_amount',
    ].join(',');

    for (let i = 0; i < orderSnList.length; i += BATCH_SIZE) {
      const batch = orderSnList.slice(i, i + BATCH_SIZE);
      const detailRes: any = await sdk.order.getOrderDetail({
        order_sn_list: batch,
        response_optional_fields: optionalFields,
      });

      const detailData = detailRes?.response || detailRes?.result || detailRes;
      const batchOrders = detailData?.order_list || [];
      detailedOrders.push(...batchOrders);
    }

    // 3. Normalize into ERPOrder structure
    const erpOrders: ERPOrder[] = detailedOrders.map((raw) => {
      const recipient = raw.recipient_address || {};
      const packageList = Array.isArray(raw.package_list) ? raw.package_list : [];
      const trackingNumber = packageList[0]?.tracking_number || raw.tracking_number || '';

      const items: ERPOrderItem[] = (raw.item_list || []).map((it: any) => ({
        item_id: it.item_id,
        item_name: it.item_name || '',
        model_id: it.model_id,
        model_name: it.model_name || '',
        model_sku: it.model_sku || '',
        model_quantity_purchased: Number(it.model_quantity_purchased || 1),
        model_discounted_price: Number(it.model_discounted_price || 0),
        model_original_price: Number(it.model_original_price || 0),
      }));

      // Summarize items into single readable line: "Kaos Polo (Hitam - L) x2; Topi Begood x1"
      const itemsSummary = items
        .map((it) => {
          const varText = it.model_name ? ` (${it.model_name})` : '';
          return `${it.item_name}${varText} x${it.model_quantity_purchased}`;
        })
        .join('; ');

      const totalItemsCount = items.reduce((acc, it) => acc + it.model_quantity_purchased, 0);

      // Create time as Unix timestamp in seconds
      const createTimeRaw = raw.create_time;
      const createTimeSec = createTimeRaw instanceof Date
        ? Math.floor(createTimeRaw.getTime() / 1000)
        : Number(createTimeRaw || 0);

      const payTimeRaw = raw.pay_time;
      const payTimeSec = payTimeRaw
        ? (payTimeRaw instanceof Date ? Math.floor(payTimeRaw.getTime() / 1000) : Number(payTimeRaw))
        : undefined;

      return {
        order_sn: String(raw.order_sn || ''),
        create_time: createTimeSec,
        create_time_formatted: formatWIB(raw.create_time),
        pay_time: payTimeSec,
        pay_time_formatted: payTimeRaw ? formatWIB(payTimeRaw) : '',
        order_status: String(raw.order_status || ''),
        internal_status: mapInternalStatus(raw.order_status),
        buyer_username: String(raw.buyer_username || ''),
        recipient_name: String(recipient.name || ''),
        recipient_phone: String(recipient.phone || ''),
        recipient_full_address: String(recipient.full_address || ''),
        recipient_city: String(recipient.city || ''),
        recipient_district: String(recipient.district || ''),
        recipient_state: String(recipient.state || ''),
        shipping_carrier: String(raw.shipping_carrier || ''),
        tracking_number: trackingNumber,
        total_amount: Number(raw.total_amount || 0),
        estimated_shipping_fee: Number(raw.estimated_shipping_fee || 0),
        actual_shipping_fee: Number(raw.actual_shipping_fee || 0),
        payment_method: String(raw.payment_method || ''),
        items_summary: itemsSummary,
        total_items_count: totalItemsCount,
        note: String(raw.note || raw.message_to_seller || ''),
        items,
      };
    });

    return {
      orders: erpOrders,
      total: erpOrders.length,
      time_from: timeFrom,
      time_to: timeTo,
      new_token: storage.tokenWasUpdated ? storage.getToken() : null,
    };
  }
}
