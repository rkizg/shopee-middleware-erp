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
        'Accept': 'application/json'
      }
    };

    if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.payload = JSON.stringify(payload);
    }

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    var jsonResult;
    try {
      jsonResult = JSON.parse(responseText);
    } catch (e) {
      throw new Error('Gagal mem-parse respons server (HTTP ' + statusCode + '): ' + responseText);
    }

    if (statusCode >= 400 || (jsonResult.success === false && !jsonResult.data)) {
      var errMsg = jsonResult.message || jsonResult.error || ('HTTP Error ' + statusCode);
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
