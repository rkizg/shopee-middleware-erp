import { createShopeeClient } from '../lib/shopee.js';
import { TokenService } from './token.service.js';
import type { AccessToken } from '@congminh1254/shopee-sdk/schemas';

export interface ShippingAuthParams {
  shop_id?: number;
  access_token: string;
  refresh_token?: string;
  expired_at?: number;
}

export interface GetShippingParameterParams extends ShippingAuthParams {
  order_sn: string;
}

export interface ShipOrderParams extends ShippingAuthParams {
  order_sn: string;
  pickup?: {
    address_id: number;
    pickup_time_id?: string;
    tracking_number?: string;
  };
  dropoff?: {
    branch_id?: number;
    sender_real_name?: string;
    tracking_number?: string;
  };
  non_integrated?: {
    tracking_number?: string;
  };
}

export interface GetShippingDocumentParams extends ShippingAuthParams {
  order_sn_list: string[];
  shipping_document_type?: 'THERMAL_AIR_WAYBILL' | 'NORMAL_AIR_WAYBILL' | string;
}

export interface ShippingServiceResult<T> {
  data: T;
  new_token?: AccessToken | null;
}

export class ShippingService {
  /**
   * Helper private untuk menginisialisasi Shopee SDK dengan auto-refresh token
   */
  private static async initClient(auth: ShippingAuthParams) {
    let activeAccessToken = auth.access_token;
    let activeRefreshToken = auth.refresh_token || '';
    let tokenExpiredAt = Date.now() + 14400 * 1000;
    let proactivelyRefreshedToken: AccessToken | null = null;

    if (auth.expired_at) {
      const exp = Number(auth.expired_at);
      if (!isNaN(exp) && exp > 0) {
        const expMs = exp < 10000000000 ? exp * 1000 : exp;
        if (expMs > Date.now() + 60 * 1000) {
          tokenExpiredAt = expMs;
        } else if (activeRefreshToken) {
          try {
            const refreshed = await TokenService.refreshToken(activeRefreshToken, auth.shop_id);
            if (refreshed && refreshed.access_token) {
              activeAccessToken = refreshed.access_token;
              activeRefreshToken = refreshed.refresh_token || activeRefreshToken;
              tokenExpiredAt = refreshed.expired_at || (Date.now() + (refreshed.expire_in || 14400) * 1000);
              proactivelyRefreshedToken = refreshed;
            }
          } catch (refreshErr: any) {
            console.warn('[ShippingService] Auto-refresh gagal, lanjut dengan token aktif:', refreshErr?.message || refreshErr);
          }
        }
      }
    }

    const initialToken: Partial<AccessToken> = {
      access_token: activeAccessToken,
      refresh_token: activeRefreshToken,
      expired_at: tokenExpiredAt,
      shop_id: auth.shop_id,
    };

    const { sdk, storage } = createShopeeClient({
      shopId: auth.shop_id,
      initialToken,
    });

    if (proactivelyRefreshedToken) {
      await storage.store(proactivelyRefreshedToken);
    }

    return { sdk, storage };
  }

  /**
   * Mengambil parameter pengiriman (opsi pickup, slot waktu, atau opsi dropoff)
   * API: v2.logistics.get_shipping_parameter
   */
  static async getShippingParameter(params: GetShippingParameterParams): Promise<ShippingServiceResult<any>> {
    const { sdk, storage } = await this.initClient(params);

    const res: any = await sdk.logistics.getShippingParameter({
      order_sn: params.order_sn,
    });

    if (res?.error) {
      throw new Error(`Shopee getShippingParameter error [${res.error}]: ${res.message || 'Gagal mengambil parameter pengiriman'}`);
    }

    const data = res?.response || res?.result || res;
    return {
      data,
      new_token: storage.tokenWasUpdated ? storage.getToken() : null,
    };
  }

  /**
   * Mengatur pengiriman pesanan (Drop-off ke gerai atau Request Pickup kurir)
   * API: v2.logistics.ship_order
   */
  static async shipOrder(params: ShipOrderParams): Promise<ShippingServiceResult<any>> {
    const { sdk, storage } = await this.initClient(params);

    const reqPayload: any = {
      order_sn: params.order_sn,
    };

    if (params.pickup) {
      reqPayload.pickup = params.pickup;
    } else if (params.dropoff) {
      reqPayload.dropoff = params.dropoff;
    } else if (params.non_integrated) {
      reqPayload.non_integrated = params.non_integrated;
    } else {
      // Default fallback jika tidak ada detail: coba cek info_needed atau gunakan dropoff kosong
      reqPayload.dropoff = {};
    }

    const res: any = await sdk.logistics.shipOrder(reqPayload);

    if (res?.error) {
      throw new Error(`Shopee shipOrder error [${res.error}]: ${res.message || 'Gagal memproses pengiriman pesanan'}`);
    }

    const data = res?.response || res?.result || res;
    return {
      data: data || { success: true },
      new_token: storage.tokenWasUpdated ? storage.getToken() : null,
    };
  }

  /**
   * Membuat dan mengunduh Dokumen Pengiriman / Resi Thermal A6
   * API: v2.logistics.create_shipping_document, get_shipping_document_result, download_shipping_document
   */
  static async getShippingDocument(params: GetShippingDocumentParams): Promise<ShippingServiceResult<{ pdf_buffer: Buffer; order_count: number }>> {
    const { sdk, storage } = await this.initClient(params);
    const docType = params.shipping_document_type || 'THERMAL_AIR_WAYBILL';

    if (!params.order_sn_list || params.order_sn_list.length === 0) {
      throw new Error('Daftar order_sn_list tidak boleh kosong.');
    }

    const orderListPayload = params.order_sn_list.map((sn) => ({
      order_sn: sn,
      shipping_document_type: docType,
    }));

    // 1. Buat tugas dokumen pengiriman (Create Shipping Document Task)
    try {
      const createRes: any = await sdk.logistics.createShippingDocument({
        order_list: orderListPayload,
      });

      if (createRes?.error && !String(createRes.error).toLowerCase().includes('repeat')) {
        console.warn('[ShippingService] createShippingDocument returned warning/error:', createRes.error, createRes.message);
      }
    } catch (createErr: any) {
      console.warn('[ShippingService] createShippingDocument error (melanjutkan ke cek status):', createErr.message || createErr);
    }

    // 2. Polling status dokumen hingga READY (maksimal 6 kali per 1.2 detik)
    let isReady = false;
    let pollCount = 0;
    const maxPolls = 6;

    while (!isReady && pollCount < maxPolls) {
      pollCount++;
      await new Promise((resolve) => setTimeout(resolve, 1200));

      try {
        const resultRes: any = await sdk.logistics.getShippingDocumentResult({
          order_list: orderListPayload,
        });

        const resData = resultRes?.response || resultRes?.result || resultRes;
        const resultList = resData?.result_list || [];

        if (resultList.length > 0) {
          const allReady = resultList.every((item: any) => item.status === 'READY');
          if (allReady) {
            isReady = true;
            break;
          }
          const hasFailed = resultList.some((item: any) => item.status === 'FAILED');
          if (hasFailed) {
            const failItem = resultList.find((item: any) => item.status === 'FAILED');
            throw new Error(`Pembuatan resi gagal: ${failItem?.fail_message || failItem?.fail_error || 'Dokumen gagal diproses'}`);
          }
        }
      } catch (pollErr: any) {
        if (pollErr.message && pollErr.message.includes('Pembuatan resi gagal')) {
          throw pollErr;
        }
        console.warn(`[ShippingService] Polling ${pollCount} getShippingDocumentResult error:`, pollErr.message || pollErr);
      }
    }

    // 3. Unduh berkas dokumen pengiriman biner (PDF Thermal)
    const downloadPayload = {
      shipping_document_type: docType,
      order_list: params.order_sn_list.map((sn) => ({ order_sn: sn })),
    };

    const downloadRes: any = await sdk.logistics.downloadShippingDocument(downloadPayload);

    let pdfBuffer: Buffer;
    if (Buffer.isBuffer(downloadRes)) {
      pdfBuffer = downloadRes;
    } else if (downloadRes?.response?.waybill) {
      pdfBuffer = Buffer.from(downloadRes.response.waybill);
    } else if (typeof downloadRes === 'string') {
      pdfBuffer = Buffer.from(downloadRes, 'binary');
    } else {
      throw new Error('Gagal mengunduh dokumen resi: Respons Shopee bukan berkas PDF.');
    }

    return {
      data: {
        pdf_buffer: pdfBuffer,
        order_count: params.order_sn_list.length,
      },
      new_token: storage.tokenWasUpdated ? storage.getToken() : null,
    };
  }
}
