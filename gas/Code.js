/**
 * ============================================================================
 * ERP Begood - Sistem Manajemen Toko Shopee (b e g o o d . b d g)
 * Berbasis Google Sheets & Serverless Middleware Vercel
 * ============================================================================
 */

/**
 * Event onOpen untuk membuat Menu Bar khusus di Google Sheets
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📦 ERP Begood')
    .addItem('📊 Buka Web Dashboard (Sidebar)', 'openDashboardSidebar')
    .addItem('🚀 Buka Web Dashboard (Layar Penuh)', 'openDashboardModal')
    .addSeparator()
    .addItem('🔄 Tarik Pesanan Masuk (Hari Ini / 3 Hari)', 'syncOrdersDefault')
    .addItem('📅 Tarik Pesanan Masuk (Pilih Rentang Hari)', 'syncOrdersCustomDays')
    .addItem('🔍 Tarik Pesanan Berdasarkan Nomor SN', 'syncOrderBySnPrompt')
    .addSeparator()
    .addItem('🔑 Cek Status Token Shopee', 'checkTokenStatus')
    .addItem('🔑 Tempel Token Hasil Otorisasi (Paste)', 'pasteTokenPrompt')
    .addItem('🔄 Refresh Token Shopee Sekarang', 'refreshShopeeToken')
    .addItem('🔗 Buka Tautan Otorisasi Shopee Baru (Dialog Web)', 'generateAuthLink')
    .addItem('📋 Salin Tautan Otorisasi (Teks Langsung)', 'copyAuthLink')
    .addSeparator()
    .addItem('🩺 Cek Koneksi ke Middleware Vercel (Tes Ping)', 'checkMiddlewareHealth')
    .addItem('⏰ Pasang Trigger Otomatis (Tiap 1 Jam)', 'setupHourlyTrigger')
    .addItem('⏹️ Matikan Semua Trigger Otomatis', 'removeTriggers')
    .addItem('🛠️ Inisialisasi / Reset Tabel Sheet', 'setupWorkspace')
    .addToUi();
}

/**
 * Inisialisasi awal tabel dan format sheet
 */
function setupWorkspace() {
  var ui = SpreadsheetApp.getUi();
  try {
    SheetManager.initAllSheets();
    ui.alert(
      'Inisialisasi Berhasil',
      'Struktur tabel untuk "Pesanan Masuk", "DB_Token", "Konfigurasi", dan "Log_Aktivitas" telah siap digunakan.',
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Kesalahan', 'Gagal inisialisasi sheet: ' + err.message, ui.ButtonSet.OK);
  }
}

/**
 * Penarikan pesanan masuk default (berdasarkan Konfigurasi)
 */
function syncOrdersDefault() {
  var config = SheetManager.getConfig();
  var days = Number(config.DEFAULT_SYNC_DAYS || 3);
  try {
    syncOrdersCore(days, false);
  } catch (e) {
    // Error sudah ditangani dan dimunculkan di UI
  }
}

/**
 * Penarikan pesanan masuk dengan input jumlah hari oleh pengguna
 */
function syncOrdersCustomDays() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Tarik Pesanan Masuk',
    'Masukkan jumlah hari ke belakang yang ingin ditarik (1 sampai 365 hari):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var inputVal = parseInt(response.getResponseText().trim(), 10);
    if (isNaN(inputVal) || inputVal < 1 || inputVal > 365) {
      ui.alert('Input Tidak Valid', 'Harap masukkan angka bulat antara 1 sampai 365 hari.', ui.ButtonSet.OK);
      return;
    }
    try {
      syncOrdersCore(inputVal, false);
    } catch (e) {
      // Error sudah ditangani dan dimunculkan di UI
    }
  }
}

/**
 * Penarikan pesanan masuk berdasarkan Nomor Pesanan (Order SN) tertentu
 */
function syncOrderBySnPrompt() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Tarik Pesanan Berdasarkan Nomor SN',
    'Masukkan Nomor Pesanan (Order SN) dari Shopee Seller Center:\n(Contoh: 240925ABCDEF)',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var sn = response.getResponseText().trim();
    if (!sn) {
      ui.alert('Input Kosong', 'Nomor Pesanan tidak boleh kosong.', ui.ButtonSet.OK);
      return;
    }
    try {
      syncOrdersBySnCore(sn, false);
    } catch (e) {}
  }
}

/**
 * Core sinkronisasi pesanan berdasarkan Order SN
 */
function syncOrdersBySnCore(orderSn, isBackground) {
  var ui = null;
  if (!isBackground) {
    try {
      ui = SpreadsheetApp.getUi();
    } catch (e) {}
  }

  var tokenRec = SheetManager.getTokenRecord();
  if (!tokenRec || !tokenRec.access_token) {
    var msg = 'Token otorisasi Shopee belum ditemukan di sheet "DB_Token". Silakan lakukan otorisasi akun terlebih dahulu.';
    SheetManager.logActivity('SYNC_PESANAN_SN', 0, 'GAGAL', msg);
    if (ui) ui.alert('Token Belum Ada', msg, ui.ButtonSet.OK);
    throw new Error(msg);
  }

  try {
    if (ui) {
      SpreadsheetApp.getActiveSpreadsheet().toast('Mencari pesanan ' + orderSn + ' di Shopee API...', 'ERP Begood', 10);
    }

    var payload = {
      order_sn_list: [orderSn],
      access_token: tokenRec.access_token,
      refresh_token: tokenRec.refresh_token,
      expired_at: tokenRec.expired_at,
      shop_id: tokenRec.shop_id
    };

    var apiRes = ShopeeApi.fetchDailyOrders(payload);
    if (!apiRes || !apiRes.data) {
      throw new Error(apiRes.message || 'Respons middleware tidak memiliki data pesanan.');
    }

    var orders = apiRes.data.orders || [];
    if (orders.length === 0) {
      throw new Error('Pesanan dengan SN "' + orderSn + '" tidak ditemukan di toko Shopee Anda.');
    }

    var upsertResult = SheetManager.upsertOrders(orders);
    var logMsg = 'Berhasil menarik pesanan ' + orderSn + ' (' + upsertResult.added + ' baru, ' + upsertResult.updated + ' diperbarui).';
    SheetManager.logActivity('SYNC_PESANAN_SN', orders.length, 'SUKSES', logMsg);

    if (ui) {
      ui.alert('Pesanan Ditemukan & Tersimpan', '✅ ' + logMsg, ui.ButtonSet.OK);
    }

    return {
      success: true,
      count: orders.length,
      added: upsertResult.added,
      updated: upsertResult.updated,
      message: logMsg
    };
  } catch (err) {
    var errMsg = err.message || String(err);
    SheetManager.logActivity('SYNC_PESANAN_SN', 0, 'ERROR', errMsg);
    if (ui) {
      ui.alert('Gagal Menarik Pesanan', 'Terjadi kesalahan:\n' + errMsg, ui.ButtonSet.OK);
    }
    throw new Error(errMsg);
  }
}

/**
 * Fungsi core sinkronisasi pesanan
 */
function syncOrdersCore(days, isBackground) {
  var ui = null;
  if (!isBackground) {
    try {
      ui = SpreadsheetApp.getUi();
    } catch (e) {}
  }

  var tokenRec = SheetManager.getTokenRecord();
  if (!tokenRec || !tokenRec.access_token) {
    var msg = 'Token otorisasi Shopee belum ditemukan di sheet "DB_Token". Silakan lakukan otorisasi akun terlebih dahulu melalui tombol Otorisasi Shopee.';
    SheetManager.logActivity('SYNC_PESANAN', 0, 'GAGAL', msg);
    if (ui) ui.alert('Token Belum Ada', msg, ui.ButtonSet.OK);
    throw new Error(msg);
  }

  try {
    if (ui) {
      SpreadsheetApp.getActiveSpreadsheet().toast('Menghubungkan ke Shopee API via Middleware Vercel...', 'ERP Begood', 10);
    }

    var nowSec = Math.floor(Date.now() / 1000);
    var timeFrom = nowSec - (days * 86400);
    var timeTo = nowSec;

    var payload = {
      time_from: timeFrom,
      time_to: timeTo,
      access_token: tokenRec.access_token,
      refresh_token: tokenRec.refresh_token,
      expired_at: tokenRec.expired_at,
      shop_id: tokenRec.shop_id
    };

    var apiRes = ShopeeApi.fetchDailyOrders(payload);

    if (!apiRes || !apiRes.data) {
      throw new Error(apiRes.message || 'Respons middleware tidak memiliki data pesanan.');
    }

    // Jika ShopeeSDK di middleware melakukan auto-refresh token, perbarui DB_Token secara otomatis!
    if (apiRes.data.new_token) {
      var newToken = apiRes.data.new_token;
      SheetManager.saveTokenRecord({
        shop_id: newToken.shop_id || tokenRec.shop_id,
        partner_id: tokenRec.partner_id,
        access_token: newToken.access_token,
        refresh_token: newToken.refresh_token,
        expired_at: newToken.expired_at
      });
      SheetManager.logActivity('AUTO_REFRESH_TOKEN', 0, 'SUKSES', 'Token otomatis diperbarui oleh middleware saat sinkronisasi pesanan.');
    }

    var orders = apiRes.data.orders || [];
    var upsertResult = SheetManager.upsertOrders(orders);

    var logMsg = 'Berhasil menarik ' + orders.length + ' pesanan (' + upsertResult.added + ' baru, ' + upsertResult.updated + ' diperbarui) untuk rentang ' + days + ' hari.';
    SheetManager.logActivity('SYNC_PESANAN', orders.length, 'SUKSES', logMsg);

    if (ui) {
      var alertDetails = '✅ ' + logMsg;
      var diag = apiRes.data.diagnostics || {};
      if (diag.errors && diag.errors.length > 0) {
        alertDetails += '\n\n⚠️ Catatan API:\n' + diag.errors.slice(0, 3).join('\n');
      }
      if (orders.length <= 5 && days <= 90) {
        alertDetails += '\n\n💡 Tips: Jika pesanan toko Anda berada di luar 90 hari, Anda dapat:\n1. Memasukkan rentang 180 atau 365 hari di menu "Pilih Rentang Hari".\n2. Menarik langsung via menu "Tarik Pesanan Berdasarkan Nomor SN".';
      }
      ui.alert('Sinkronisasi Selesai', alertDetails, ui.ButtonSet.OK);
    }

    return {
      success: true,
      count: orders.length,
      added: upsertResult.added,
      updated: upsertResult.updated,
      message: logMsg
    };
  } catch (err) {
    var errMsg = err.message || String(err);
    SheetManager.logActivity('SYNC_PESANAN', 0, 'ERROR', errMsg);
    if (ui) {
      ui.alert('Gagal Sinkronisasi Pesanan', 'Terjadi kesalahan:\n' + errMsg, ui.ButtonSet.OK);
    } else {
      console.error('Background sync failed:', errMsg);
    }
    throw new Error(errMsg);
  }
}

/**
 * Fungsi yang dipanggil oleh Trigger otomatis berkala (setiap 1 jam)
 */
function automatedSyncTrigger() {
  console.log('Menjalankan automated sync trigger ERP Begood...');
  var config = SheetManager.getConfig();
  var days = Number(config.DEFAULT_SYNC_DAYS || 2);
  syncOrdersCore(days, true);
}

/**
 * Cek status token Shopee saat ini
 */
function checkTokenStatus() {
  var ui = SpreadsheetApp.getUi();
  var tokenRec = SheetManager.getTokenRecord();

  if (!tokenRec || !tokenRec.access_token) {
    ui.alert(
      'Status Token',
      'Belum ada token tersimpan di sheet DB_Token.\nSilakan jalankan menu "🔗 Buka Tautan Otorisasi Shopee Baru".',
      ui.ButtonSet.OK
    );
    return;
  }

  var nowMs = Date.now();
  var expMs = Number(tokenRec.expired_at);
  if (expMs < 10000000000) expMs = expMs * 1000;

  var diffMinutes = Math.floor((expMs - nowMs) / 60000);
  var statusText = '';

  if (diffMinutes <= 0) {
    statusText = '⚠️ ACCESS TOKEN KADALUARSA (Expired sejak ' + Math.abs(diffMinutes) + ' menit yang lalu).\nSistem akan otomatis memperbarui menggunakan Refresh Token saat penarikan pesanan, atau Anda bisa klik "Refresh Token Shopee Sekarang".';
  } else {
    var hours = Math.floor(diffMinutes / 60);
    var mins = diffMinutes % 60;
    statusText = '✅ TOKEN AKTIF (Sisa waktu: ' + hours + ' jam ' + mins + ' menit).\nExpired At: ' + tokenRec.expired_at_wib;
  }

  ui.alert(
    'Status Token Shopee',
    'Shop ID: ' + tokenRec.shop_id + '\n' +
    'Status: ' + tokenRec.status + '\n\n' +
    statusText,
    ui.ButtonSet.OK
  );
}

/**
 * Prompt bagi pengguna untuk menempelkan (paste) JSON token hasil otorisasi
 */
function pasteTokenPrompt() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Tempel Token Hasil Otorisasi',
    'Tempelkan (Paste) data token JSON yang Anda salin dari halaman callback Vercel ke bawah ini:\n(Contoh: {"shop_id":12345,"access_token":"...","refresh_token":"..."})',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var rawText = response.getResponseText().trim();
    if (!rawText) {
      ui.alert('Input Kosong', 'Data token tidak boleh kosong.', ui.ButtonSet.OK);
      return;
    }

    try {
      var tokenData = JSON.parse(rawText);
      if (!tokenData.access_token || !tokenData.refresh_token) {
        throw new Error('Data tidak memiliki properti access_token atau refresh_token.');
      }

      var config = SheetManager.getConfig();
      var shopId = tokenData.shop_id || config.SHOP_ID || '';
      
      SheetManager.saveTokenRecord({
        shop_id: shopId,
        partner_id: tokenData.partner_id || '',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expired_at: tokenData.expired_at || (Date.now() + (tokenData.expire_in || 14400) * 1000)
      });

      SheetManager.logActivity('MANUAL_PASTE_TOKEN', 0, 'SUKSES', 'Token berhasil diinput melalui prompt.');
      ui.alert(
        'Token Berhasil Disimpan',
        '✅ Token Shopee berhasil disimpan ke sheet DB_Token!\nStatus: AKTIF\n\nSekarang Anda dapat menjalankan menu "🔄 Tarik Pesanan Masuk (Hari Ini / 3 Hari)".',
        ui.ButtonSet.OK
      );
    } catch (err) {
      ui.alert(
        'Format Tidak Sesuai',
        'Gagal memproses data token: ' + err.message + '\n\nPastikan Anda menyalin seluruh teks dari tombol "Salin Data Token" di halaman Vercel.',
        ui.ButtonSet.OK
      );
    }
  }
}

/**
 * Manual refresh token Shopee
 */
function refreshShopeeToken() {
  var ui = SpreadsheetApp.getUi();
  var tokenRec = SheetManager.getTokenRecord();

  if (!tokenRec || !tokenRec.refresh_token) {
    ui.alert('Error', 'Refresh token tidak ditemukan di DB_Token. Silakan otorisasi ulang.', ui.ButtonSet.OK);
    return;
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Menghubungi Shopee API untuk refresh token...', 'ERP Begood', 5);
    var res = ShopeeApi.refreshToken(tokenRec.refresh_token, tokenRec.shop_id);

    if (res.success && res.data) {
      SheetManager.saveTokenRecord({
        shop_id: res.data.shop_id || tokenRec.shop_id,
        partner_id: tokenRec.partner_id,
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token,
        expired_at: res.data.expired_at
      });

      SheetManager.logActivity('MANUAL_REFRESH_TOKEN', 0, 'SUKSES', 'Token berhasil diperbarui manual.');
      ui.alert(
        'Refresh Token Sukses',
        '✅ Token Shopee berhasil diperbarui!\nBerlaku hingga: ' + res.data.expired_at_formatted,
        ui.ButtonSet.OK
      );
    } else {
      throw new Error(res.message || 'Gagal memperbarui token.');
    }
  } catch (err) {
    SheetManager.logActivity('MANUAL_REFRESH_TOKEN', 0, 'ERROR', err.message);
    ui.alert('Gagal Refresh Token', 'Kesalahan:\n' + err.message, ui.ButtonSet.OK);
  }
}

/**
 * Generate Tautan Otorisasi Shopee
 */
/**
 * Generate Tautan Otorisasi Shopee (Tampilan Modal Web)
 */
function generateAuthLink() {
  var ui = SpreadsheetApp.getUi();
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Menghubungi Shopee API...', 'ERP Begood', 5);
    var res = ShopeeApi.getAuthUrl();

    if (res.success && res.data && res.data.auth_url) {
      var authUrl = res.data.auth_url;
      
      var html = '<!DOCTYPE html><html><head><base target="_blank">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<style>' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 18px; margin: 0; background: #ffffff; color: #0f172a; line-height: 1.5; }' +
        '.title { font-size: 16px; font-weight: bold; color: #ee4d2d; margin-bottom: 8px; }' +
        '.desc { font-size: 13px; color: #475569; margin-bottom: 16px; }' +
        '.btn { background: #ee4d2d; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }' +
        '.box { margin-top: 18px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11px; word-break: break-all; color: #334155; }' +
        '</style></head><body>' +
        '<div class="title">Otorisasi Toko Shopee (b e g o o d . b d g)</div>' +
        '<div class="desc">Klik tombol di bawah ini untuk membuka halaman login resmi Shopee Seller:</div>' +
        '<div style="text-align: center; margin: 20px 0;">' +
        '<a href="' + authUrl + '" class="btn" target="_blank">🔗 Buka Halaman Login Shopee</a>' +
        '</div>' +
        '<div class="box">' +
        '<strong>Jika tombol tidak dapat diklik, salin URL ini:</strong><br>' +
        '<a href="' + authUrl + '" target="_blank">' + authUrl + '</a>' +
        '</div>' +
        '</body></html>';

      var htmlOutput = HtmlService.createHtmlOutput(html)
        .setWidth(520)
        .setHeight(320)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

      ui.showModalDialog(htmlOutput, 'Otorisasi Shopee Begood');
    } else {
      throw new Error(res.message || 'Gagal membuat URL otorisasi.');
    }
  } catch (err) {
    ui.alert('Gagal Membuat URL Otorisasi', 'Kesalahan:\n' + err.message, ui.ButtonSet.OK);
  }
}

/**
 * Alternatif: Menampilkan URL Otorisasi dalam Prompt Teks Bawaan
 * (100% Anti-Blank, tidak terpengaruh oleh pemblokir iframe atau pop-up browser)
 */
function copyAuthLink() {
  var ui = SpreadsheetApp.getUi();
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Mengambil URL Otorisasi Shopee...', 'ERP Begood', 5);
    var res = ShopeeApi.getAuthUrl();

    if (res.success && res.data && res.data.auth_url) {
      var authUrl = res.data.auth_url;
      ui.prompt(
        'Tautan Otorisasi Shopee (Salin URL)',
        'Salin seluruh teks URL di bawah ini (Ctrl+C / Cmd+C) lalu buka di tab baru peramban Anda:\n\n' + authUrl,
        ui.ButtonSet.OK
      );
    } else {
      throw new Error(res.message || 'Gagal mengambil URL otorisasi.');
    }
  } catch (err) {
    ui.alert('Gagal Mengambil URL Otorisasi', 'Kesalahan:\n' + err.message, ui.ButtonSet.OK);
  }
}

/**
 * Pasang Trigger Otomatis Setiap 1 Jam
 */
function setupHourlyTrigger() {
  var ui = SpreadsheetApp.getUi();
  try {
    removeTriggers(); // Hapus trigger lama agar tidak dobel
    ScriptApp.newTrigger('automatedSyncTrigger')
      .timeBased()
      .everyHours(1)
      .create();

    SheetManager.logActivity('TRIGGER_SETUP', 0, 'SUKSES', 'Trigger otomatis sinkronisasi 1 jam berhasil diaktifkan.');
    ui.alert(
      'Trigger Aktif',
      '✅ Otomatisasi berjalan: Pesanan baru akan disinkronisasikan secara otomatis setiap 1 jam di latar belakang (background).',
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Gagal Pasang Trigger', 'Kesalahan:\n' + err.message, ui.ButtonSet.OK);
  }
}

/**
 * Hapus Semua Trigger Otomatis
 */
function removeTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'automatedSyncTrigger') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * Cek Koneksi & Kesehatan Konfigurasi Middleware Vercel
 */
function checkMiddlewareHealth() {
  var ui = SpreadsheetApp.getUi();
  var config = SheetManager.getConfig();
  var baseUrl = config.VERCEL_MIDDLEWARE_URL;

  if (!baseUrl || baseUrl.indexOf('your-vercel-middleware') !== -1) {
    ui.alert(
      'URL Belum Diatur',
      'Nilai VERCEL_MIDDLEWARE_URL di sheet "Konfigurasi" masih berupa URL contoh default:\n\n' + baseUrl +
      '\n\nSilakan buka tab "Konfigurasi" lalu ganti nilai VERCEL_MIDDLEWARE_URL dengan domain Vercel Anda yang sesungguhnya (contoh: https://begood-shopee-erp.vercel.app).',
      ui.ButtonSet.OK
    );
    return;
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Menghubungi middleware Vercel...', 'ERP Begood', 5);
    var res = ShopeeApi.checkHealth();

    var cfg = res.config || {};
    var msg = 'Status Middleware: ' + res.status + '\n\n' +
      '• Partner ID: ' + (cfg.partner_id_configured ? '✅ Terpasang' : '❌ BELUM DIISI di Vercel Env') + '\n' +
      '• Partner Key: ' + (cfg.partner_key_configured ? '✅ Terpasang' : '❌ BELUM DIISI di Vercel Env') + '\n' +
      '• Shop ID: ' + (cfg.shop_id_configured ? '✅ Terpasang' : '❌ BELUM DIISI di Vercel Env') + '\n' +
      '• API Secret: ' + (cfg.api_secret_configured ? '✅ Terpasang' : '❌ BELUM DIISI di Vercel Env') + '\n' +
      '• Redirect URI: ' + (cfg.redirect_uri_configured ? '✅ Terpasang' : '⚠️ Menggunakan Fallback Otomatis') + '\n\n' +
      res.message;

    ui.alert('Hasil Tes Koneksi Middleware', msg, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert(
      'Koneksi Gagal',
      'Gagal terhubung ke middleware di:\n' + baseUrl + '\n\nPenyebab:\n' + err.message +
      '\n\nPeriksa kembali apakah URL di sheet "Konfigurasi" sudah sesuai dengan domain Vercel yang Anda miliki.',
      ui.ButtonSet.OK
    );
  }
}

/**
 * ============================================================================
 * WEB DASHBOARD INTERACTION & RPC ENDPOINTS
 * ============================================================================
 */

/**
 * Endpoint utama Web App Google Apps Script (Standalone Web App)
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ERP Begood - Dashboard Kontrol Shopee')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Buka Dashboard di Sidebar kanan Google Sheets
 */
function openDashboardSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ERP Begood Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Buka Dashboard di Modal Dialog Layar Penuh Google Sheets
 */
function openDashboardModal() {
  var html = HtmlService.createHtmlOutputFromFile('Index')
    .setWidth(1200)
    .setHeight(780)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showModalDialog(html, 'ERP Begood - Dashboard Kontrol Operasional');
}

/**
 * RPC: Mengambil seluruh ringkasan metrik, pesanan, token, dan log untuk dashboard
 */
function getDashboardData() {
  return SheetManager.getDashboardSummary();
}

/**
 * RPC: Memperbarui Status Internal Begood langsung dari tabel Web Dashboard
 */
function updateOrderStatusInternal(orderSn, newStatus) {
  if (!orderSn || !newStatus) {
    throw new Error('No Pesanan atau status baru tidak valid.');
  }

  var ok = SheetManager.updateInternalStatus(orderSn, newStatus);
  if (!ok) {
    throw new Error('Pesanan dengan No ' + orderSn + ' tidak ditemukan di sheet.');
  }

  SheetManager.logActivity('UPDATE_STATUS', 1, 'SUKSES', 'Status pesanan ' + orderSn + ' diubah menjadi "' + newStatus + '" via Dashboard.');
  return { success: true };
}

/**
 * RPC: Menjalankan sinkronisasi pesanan dari tombol Web Dashboard
 */
function triggerSyncOrders(days) {
  var syncDays = Number(days) || 3;
  var res = syncOrdersCore(syncDays, true);
  return {
    success: true,
    message: res.message || ('Sinkronisasi pesanan (' + syncDays + ' hari) berhasil!')
  };
}

/**
 * RPC: Menjalankan sinkronisasi pesanan berdasarkan Order SN dari Web Dashboard
 */
function triggerSyncBySn(orderSn) {
  if (!orderSn || !orderSn.trim()) {
    throw new Error('Nomor Pesanan (Order SN) tidak boleh kosong.');
  }
  var res = syncOrdersBySnCore(orderSn.trim(), true);
  return {
    success: true,
    message: res.message
  };
}

/**
 * RPC: Refresh Token Shopee dari tombol Web Dashboard
 */
function refreshTokenFromDashboard() {
  var tokenRec = SheetManager.getTokenRecord();
  if (!tokenRec || !tokenRec.refresh_token) {
    throw new Error('Refresh token tidak ditemukan di DB_Token. Silakan klik tombol "Otorisasi Shopee".');
  }

  var res = ShopeeApi.refreshToken(tokenRec.refresh_token, tokenRec.shop_id);
  if (res.success && res.data) {
    SheetManager.saveTokenRecord({
      shop_id: res.data.shop_id || tokenRec.shop_id,
      partner_id: tokenRec.partner_id,
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      expired_at: res.data.expired_at
    });

    SheetManager.logActivity('MANUAL_REFRESH_TOKEN', 0, 'SUKSES', 'Token diperbarui melalui Web Dashboard.');
    return {
      success: true,
      message: 'Token berhasil diperbarui! Berlaku hingga: ' + (res.data.expired_at_formatted || '4 jam ke depan')
    };
  } else {
    throw new Error(res.message || 'Gagal memperbarui token Shopee.');
  }
}

/**
 * RPC: Menyimpan JSON token hasil otorisasi dari Web Dashboard
 */
function saveTokenFromDashboard(jsonString) {
  if (!jsonString || !jsonString.trim()) {
    throw new Error('Teks token JSON tidak boleh kosong.');
  }

  var tokenData = JSON.parse(jsonString.trim());
  if (!tokenData.access_token || !tokenData.refresh_token) {
    throw new Error('JSON tidak valid: properti access_token atau refresh_token tidak ditemukan.');
  }

  var config = SheetManager.getConfig();
  var shopId = tokenData.shop_id || config.SHOP_ID || '';

  SheetManager.saveTokenRecord({
    shop_id: shopId,
    partner_id: tokenData.partner_id || '',
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expired_at: tokenData.expired_at || (Date.now() + (tokenData.expire_in || 14400) * 1000)
  });

  SheetManager.logActivity('MANUAL_PASTE_TOKEN', 0, 'SUKSES', 'Token berhasil disimpan via Web Dashboard.');
  return {
    success: true,
    message: 'Token Shopee berhasil disimpan dan status saat ini AKTIF!'
  };
}

/**
 * RPC: Mengaktifkan atau mematikan trigger otomatis sinkronisasi 1 jam
 */
function toggleTrigger(enable) {
  removeTriggers();
  if (enable) {
    ScriptApp.newTrigger('automatedSyncTrigger')
      .timeBased()
      .everyHours(1)
      .create();

    SheetManager.logActivity('TRIGGER_TOGGLE', 0, 'SUKSES', 'Trigger otomatis diaktifkan via Web Dashboard.');
    return {
      success: true,
      isActive: true,
      message: 'Trigger otomatis (setiap 1 jam) berhasil diaktifkan!'
    };
  } else {
    SheetManager.logActivity('TRIGGER_TOGGLE', 0, 'SUKSES', 'Trigger otomatis dinonaktifkan via Web Dashboard.');
    return {
      success: true,
      isActive: false,
      message: 'Trigger otomatis berhasil dimatikan.'
    };
  }
}

/**
 * RPC: Tes ping ke Vercel Serverless Middleware
 */
function pingMiddleware() {
  var res = ShopeeApi.checkHealth();
  return {
    status: res.status || 'READY',
    message: res.message || 'Koneksi ke middleware Vercel lancar.'
  };
}

/**
 * RPC: Menghasilkan URL otorisasi Shopee untuk modal otorisasi di Web Dashboard
 */
function getAuthUrlFromDashboard() {
  var res = ShopeeApi.getAuthUrl();
  if (res.success && res.data && res.data.auth_url) {
    return {
      url: res.data.auth_url
    };
  } else {
    throw new Error(res.message || 'Gagal menghasilkan URL otorisasi.');
  }
}


