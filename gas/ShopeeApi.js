/**
 * ============================================================================
 * ERP Begood - ShopeeApi.js
 * Klien komunikasi HTTP dari Google Apps Script ke Vercel Serverless Middleware
 * ============================================================================
 */

var ShopeeApi = (function() {
  /**
   * Helper private untuk melakukan HTTP call ke Vercel Middleware
   */
  function request(endpoint, method, payload) {
    var config = SheetManager.getConfig();
    var baseUrl = config.VERCEL_MIDDLEWARE_URL;
    var secret = config.BEGOOD_API_SECRET;

    if (!baseUrl) {
      throw new Error('VERCEL_MIDDLEWARE_URL belum dikonfigurasi di sheet "Konfigurasi".');
    }

    // Bersihkan trailing slash
    baseUrl = baseUrl.replace(/\/+$/, '');
    var url = baseUrl + endpoint;

    var options = {
      method: method || 'GET',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        'x-begood-secret': secret || '',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.payload = JSON.stringify(payload);

      // Salurkan token via header kustom sebagai saluran cadangan (fail-safe)
      if (typeof payload === 'object') {
        if (payload.access_token) {
          options.headers['x-shopee-access-token'] = String(payload.access_token);
        }
        if (payload.refresh_token) {
          options.headers['x-shopee-refresh-token'] = String(payload.refresh_token);
        }
        if (payload.shop_id) {
          options.headers['x-shopee-shop-id'] = String(payload.shop_id);
        }
      }
    }

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    var jsonResult = null;
    try {
      jsonResult = JSON.parse(responseText);
    } catch (e) {
      throw new Error('HTTP ' + statusCode + ' (Bukan JSON): ' + responseText.substring(0, 300));
    }

    if (statusCode >= 400 || (jsonResult && jsonResult.success === false && !jsonResult.data)) {
      var errMsg = '';
      if (jsonResult.error) {
        if (typeof jsonResult.error === 'string') {
          errMsg = jsonResult.error;
        } else if (typeof jsonResult.error === 'object') {
          errMsg = jsonResult.error.message || jsonResult.error.code || JSON.stringify(jsonResult.error);
          if (jsonResult.error.code && jsonResult.error.message) {
            errMsg = jsonResult.error.code + ': ' + jsonResult.error.message;
          }
        }
      }

      if (!errMsg && jsonResult.message) {
        if (typeof jsonResult.message === 'string') {
          errMsg = jsonResult.message;
        } else {
          errMsg = JSON.stringify(jsonResult.message);
        }
      }

      if (!errMsg) {
        errMsg = 'HTTP ' + statusCode + ': ' + responseText.substring(0, 200);
      }

      throw new Error(errMsg);
    }

    return jsonResult;
  }

  return {
    /**
     * Mengambil URL Otorisasi Shopee OAuth
     */
    getAuthUrl: function(redirectUri) {
      var endpoint = '/api/auth/url';
      if (redirectUri) {
        endpoint += '?redirect_uri=' + encodeURIComponent(redirectUri);
      }
      return request(endpoint, 'GET');
    },

    /**
     * Memperbarui Access Token menggunakan Refresh Token
     */
    refreshToken: function(refreshToken, shopId) {
      return request('/api/auth/refresh', 'POST', {
        refresh_token: refreshToken,
        shop_id: shopId
      });
    },

    /**
     * Mengambil daftar pesanan dari Shopee melalui middleware
     */
    fetchDailyOrders: function(params) {
      return request('/api/orders/daily', 'POST', params);
    },

    /**
     * Cek status koneksi ke serverless middleware
     */
    checkHealth: function() {
      return request('/api/health', 'GET');
    }
  };
})();
