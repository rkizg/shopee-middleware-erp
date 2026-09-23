// api/orders/sync.js

import { createShopeeClient } from '../../lib/shopee-client.js';

const GAS_URL = process.env.GAS_WEBAPP_URL;
const GAS_SECRET = process.env.GAS_SECRET;

export default async function handler(req, res) {
  const { shop_id } = req.query;

  if (!shop_id) {
    return res.status(400).json({ error: 'shop_id diperlukan' });
  }

  try {
    const sdk = createShopeeClient(shop_id);

    // Tentukan rentang waktu: 24 jam terakhir
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;

    // Panggil API untuk mendapatkan daftar pesanan
    const response = await sdk.order.getOrderList({
      time_range_field: 'create_time',
      time_from: oneDayAgo,
      time_to: now,
      page_size: 50,
      order_status: 'READY_TO_SHIP', // Sesuaikan dengan kebutuhan
    });

    const orders = response.response?.order_list || [];

    if (orders.length === 0) {
      return res.status(200).json({ success: true, message: 'Tidak ada pesanan baru', count: 0 });
    }

    // Untuk setiap pesanan, ambil detailnya
    const detailedOrders = [];
    for (const order of orders) {
      const detail = await sdk.order.getOrderDetail({
        order_sn: order.order_sn,
      });

      if (detail.response?.order_list?.length > 0) {
        const orderDetail = detail.response.order_list[0];
        detailedOrders.push({
          order_sn: orderDetail.order_sn,
          create_time: new Date(orderDetail.create_time * 1000).toISOString(),
          buyer_username: orderDetail.buyer_username,
          total_amount: orderDetail.total_amount,
          order_status: orderDetail.order_status,
          item_list: orderDetail.item_list,
        });
      }
    }

    // Kirim ke GAS untuk disimpan di sheet Pesanan Masuk
    await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveOrders',
        secret: GAS_SECRET,
        data: detailedOrders,
      }),
    });

    return res.status(200).json({
      success: true,
      message: `${detailedOrders.length} pesanan berhasil disinkronkan`,
      count: detailedOrders.length,
    });
  } catch (error) {
    console.error('Sync error:', error);

    // Catat error ke GAS
    await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log',
        secret: GAS_SECRET,
        data: {
          event: 'SYNC_ERROR',
          detail: error.message,
        },
      }),
    });

    return res.status(500).json({ success: false, error: error.message });
  }
}