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
    .addItem('🔄 Tarik Pesanan Masuk (Hari Ini / 3 Hari)', 'syncOrdersDefault')
    .addItem('📅 Tarik Pesanan Masuk (Pilih Rentang Hari)', 'syncOrdersCustomDays')
    .addSeparator()
    .addItem('🔑 Cek Status Token Shopee', 'checkTokenStatus')
    .addItem('🔄 Refresh Token Shopee Sekarang', 'refreshShopeeToken')
    .addItem('🔗 Buka Tautan Otorisasi Shopee Baru', 'generateAuthLink')
    .addSeparator()
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
  var ui = SpreadsheetApp.getUi();
  var config = SheetManager.getConfig();
  var days = Number(config.DEFAULT_SYNC_DAYS || 3);
  
  syncOrdersCore(days, false);
}

/**
 * Penarikan pesanan masuk dengan input jumlah hari oleh pengguna
 */
function syncOrdersCustomDays() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Tarik Pesanan Masuk',
    'Masukkan jumlah hari ke belakang yang ingin ditarik (maks 14 hari):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var inputVal = parseInt(response.getResponseText().trim(), 10);
    if (isNaN(inputVal) || inputVal < 1 || inputVal > 14) {
      ui.alert('Input Tidak Valid', 'Harap masukkan angka bulat antara 1 sampai 14 hari.', ui.ButtonSet.OK);
      return;
    }
    syncOrdersCore(inputVal, false);
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
    var msg = 'Token otorisasi Shopee belum ditemukan di sheet "DB_Token". Silakan lakukan otorisasi akun terlebih dahulu melalui menu "🔗 Buka Tautan Otorisasi Shopee Baru".';
    SheetManager.logActivity('SYNC_PESANAN', 0, 'GAGAL', msg);
    if (ui) ui.alert('Token Belum Ada', msg, ui.ButtonSet.OK);
    return;
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
      ui.alert(
        'Sinkronisasi Selesai',
        '✅ ' + logMsg,
        ui.ButtonSet.OK
      );
    }
  } catch (err) {
    var errMsg = err.message || String(err);
    SheetManager.logActivity('SYNC_PESANAN', 0, 'ERROR', errMsg);
    if (ui) {
      ui.alert('Gagal Sinkronisasi Pesanan', 'Terjadi kesalahan:\n' + errMsg, ui.ButtonSet.OK);
    } else {
      console.error('Background sync failed:', errMsg);
    }
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
function generateAuthLink() {
  var ui = SpreadsheetApp.getUi();
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Membuat URL Otorisasi Shopee...', 'ERP Begood', 5);
    var res = ShopeeApi.getAuthUrl();

    if (res.success && res.data && res.data.auth_url) {
      var authUrl = res.data.auth_url;
      var htmlOutput = HtmlService.createHtmlOutput(
        '<div style="font-family: sans-serif; padding: 12px; line-height: 1.5;">' +
        '<h3 style="color: #ee4d2d; margin-top: 0;">Otorisasi Toko Shopee (b e g o o d . b d g)</h3>' +
        '<p>Klik tombol di bawah ini untuk membuka halaman login resmi Shopee Seller dan menyetujui akses integrasi ERP Begood:</p>' +
        '<div style="text-align: center; margin: 24px 0;">' +
        '<a href="' + authUrl + '" target="_blank" style="background: #ee4d2d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">🔗 Buka Halaman Login Shopee</a>' +
        '</div>' +
        '<p style="font-size: 12px; color: #64748b;">Setelah login dan klik "Authorize", Shopee akan mengarahkan ke middleware Vercel Anda dan menghasilkan data token untuk disimpan ke sheet DB_Token.</p>' +
        '</div>'
      ).setWidth(480).setHeight(260);

      ui.showModalDialog(htmlOutput, 'Otorisasi Shopee');
    } else {
      throw new Error(res.message || 'Gagal membuat URL otorisasi.');
    }
  } catch (err) {
    ui.alert('Gagal Membuat URL Otorisasi', 'Kesalahan:\n' + err.message, ui.ButtonSet.OK);
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
