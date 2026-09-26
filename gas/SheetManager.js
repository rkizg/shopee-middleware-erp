/**
 * ============================================================================
 * ERP Begood - SheetManager.js
 * Manajemen tabel Google Sheets: Pesanan Masuk, DB_Token, Konfigurasi, Log
 * ============================================================================
 */

var SheetManager = (function() {
  var SHEETS = {
    ORDERS: 'Pesanan Masuk',
    TOKEN: 'DB_Token',
    CONFIG: 'Konfigurasi',
    LOG: 'Log_Aktivitas'
  };

  var STATUS_OPTIONS = [
    '[0] Menunggu Pembayaran',
    '[1] Siap Packing',
    '[2] Menunggu Pickup',
    '[3] Sedang Dikirim',
    '[4] Selesai',
    '[5] Pengajuan Batal',
    '[6] Dibatalkan'
  ];

  function getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  function getOrCreateSheet(sheetName) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    return sheet;
  }

  return {
    SHEETS: SHEETS,
    STATUS_OPTIONS: STATUS_OPTIONS,

    /**
     * Inisialisasi struktur sheet dan format tampilan
     */
    initAllSheets: function() {
      var ss = getSpreadsheet();

      // 1. Sheet Pesanan Masuk
      var orderSheet = getOrCreateSheet(SHEETS.ORDERS);
      var orderHeaders = [
        'No. Pesanan',
        'Tanggal Pesanan (WIB)',
        'Status Shopee',
        'Status Internal Begood',
        'Nama Pembeli',
        'Ringkasan Produk',
        'Total Qty',
        'Total Belanja (Rp)',
        'Ongkir (Rp)',
        'Ekspedisi / Kurir',
        'No. Resi',
        'Catatan Pembeli',
        'Kota Tujuan',
        'Waktu Sinkronisasi'
      ];

      if (orderSheet.getLastRow() === 0) {
        orderSheet.appendRow(orderHeaders);
      } else {
        orderSheet.getRange(1, 1, 1, orderHeaders.length).setValues([orderHeaders]);
      }

      // Format Header Pesanan Masuk
      var orderHeaderRange = orderSheet.getRange(1, 1, 1, orderHeaders.length);
      orderHeaderRange
        .setBackground('#1e293b')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10)
        .setHorizontalAlignment('center');
      orderSheet.setFrozenRows(1);

      // Pasang validasi dropdown Status Internal Begood (Kolom D)
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(STATUS_OPTIONS, true)
        .setAllowInvalid(true)
        .build();
      orderSheet.getRange('D2:D1000').setDataValidation(rule);

      // Format format mata uang Total Belanja (H) & Ongkir (I)
      orderSheet.getRange('H2:I1000').setNumberFormat('Rp #,##0');
      // Format Nomor Pesanan & Resi sebagai Plain Text (agar angka tidak berubah format eksponensial)
      orderSheet.getRange('A2:A1000').setNumberFormat('@');
      orderSheet.getRange('K2:K1000').setNumberFormat('@');

      // 2. Sheet DB_Token
      var tokenSheet = getOrCreateSheet(SHEETS.TOKEN);
      var tokenHeaders = [
        'Shop ID',
        'Partner ID',
        'Access Token',
        'Refresh Token',
        'Expired At (Unix)',
        'Expired At (WIB)',
        'Terakhir Diperbarui (WIB)',
        'Status Token'
      ];

      if (tokenSheet.getLastRow() === 0) {
        tokenSheet.appendRow(tokenHeaders);
      } else {
        tokenSheet.getRange(1, 1, 1, tokenHeaders.length).setValues([tokenHeaders]);
      }

      var tokenHeaderRange = tokenSheet.getRange(1, 1, 1, tokenHeaders.length);
      tokenHeaderRange
        .setBackground('#0f766e')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10)
        .setHorizontalAlignment('center');
      tokenSheet.setFrozenRows(1);
      tokenSheet.getRange('A2:A10').setNumberFormat('@');
      tokenSheet.getRange('C2:D10').setNumberFormat('@');

      // 3. Sheet Konfigurasi
      var configSheet = getOrCreateSheet(SHEETS.CONFIG);
      var configHeaders = ['Parameter', 'Nilai', 'Keterangan'];
      var defaultConfigs = [
        ['VERCEL_MIDDLEWARE_URL', 'https://your-vercel-middleware.vercel.app', 'URL dasar deployment Vercel Anda'],
        ['BEGOOD_API_SECRET', 'your_super_secret_begood_token_2026', 'Kunci rahasia API penjaga middleware (harus sama dengan Vercel env)'],
        ['SHOP_ID', '0', 'ID Toko Shopee Begood (otomatis diisi saat otorisasi)'],
        ['DEFAULT_SYNC_DAYS', '3', 'Rentang hari pesanan yang ditarik secara default']
      ];

      if (configSheet.getLastRow() === 0) {
        configSheet.appendRow(configHeaders);
        for (var i = 0; i < defaultConfigs.length; i++) {
          configSheet.appendRow(defaultConfigs[i]);
        }
      }

      var configHeaderRange = configSheet.getRange(1, 1, 1, configHeaders.length);
      configHeaderRange
        .setBackground('#334155')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10);
      configSheet.setFrozenRows(1);
      configSheet.autoResizeColumns(1, 3);

      // 4. Sheet Log_Aktivitas
      var logSheet = getOrCreateSheet(SHEETS.LOG);
      var logHeaders = ['Waktu (WIB)', 'Tipe Aksi', 'Jumlah Pesanan', 'Status', 'Keterangan Detail'];
      if (logSheet.getLastRow() === 0) {
        logSheet.appendRow(logHeaders);
      }

      var logHeaderRange = logSheet.getRange(1, 1, 1, logHeaders.length);
      logHeaderRange
        .setBackground('#475569')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10);
      logSheet.setFrozenRows(1);

      return true;
    },

    /**
     * Membaca pengaturan dari sheet Konfigurasi
     */
    getConfig: function() {
      var sheet = getOrCreateSheet(SHEETS.CONFIG);
      var data = sheet.getDataRange().getValues();
      var config = {};
      for (var i = 1; i < data.length; i++) {
        var key = String(data[i][0]).trim();
        var val = String(data[i][1]).trim();
        if (key) {
          config[key] = val;
        }
      }
      return config;
    },

    /**
     * Membaca rekaman token aktif dari sheet DB_Token
     */
    getTokenRecord: function() {
      var sheet = getOrCreateSheet(SHEETS.TOKEN);
      if (sheet.getLastRow() < 2) {
        return null;
      }
      var row = sheet.getRange(2, 1, 1, 8).getValues()[0];

      // Deteksi jika pengguna menempelkan teks JSON mentah langsung ke cell A2
      var firstCell = String(row[0] || '').trim();
      if (firstCell.indexOf('{') === 0 && firstCell.indexOf('access_token') !== -1) {
        try {
          var parsed = JSON.parse(firstCell);
          if (parsed.access_token) {
            this.saveTokenRecord({
              shop_id: parsed.shop_id || '',
              partner_id: parsed.partner_id || '',
              access_token: parsed.access_token || '',
              refresh_token: parsed.refresh_token || '',
              expired_at: parsed.expired_at || (Date.now() + 14400 * 1000)
            });
            row = sheet.getRange(2, 1, 1, 8).getValues()[0];
          }
        } catch (e) {}
      }

      var expiredAt = row[4];
      if (expiredAt instanceof Date) {
        expiredAt = expiredAt.getTime();
      } else if (typeof expiredAt === 'string') {
        var num = Number(expiredAt);
        if (!isNaN(num) && num > 0) expiredAt = num;
      }

      return {
        shop_id: String(row[0] || '').trim(),
        partner_id: String(row[1] || '').trim(),
        access_token: String(row[2] || '').trim(),
        refresh_token: String(row[3] || '').trim(),
        expired_at: expiredAt,
        expired_at_wib: row[5],
        updated_at: row[6],
        status: row[7]
      };
    },

    /**
     * Menyimpan/memperbarui token ke sheet DB_Token
     */
    saveTokenRecord: function(tokenData) {
      var sheet = getOrCreateSheet(SHEETS.TOKEN);
      var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      
      var expiredDateWIB = '';
      if (tokenData.expired_at) {
        var expDate = new Date(typeof tokenData.expired_at === 'number' && tokenData.expired_at < 10000000000 
          ? tokenData.expired_at * 1000 
          : tokenData.expired_at);
        expiredDateWIB = Utilities.formatDate(expDate, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      }

      var rowData = [
        tokenData.shop_id || '',
        tokenData.partner_id || '',
        tokenData.access_token || '',
        tokenData.refresh_token || '',
        tokenData.expired_at || '',
        expiredDateWIB,
        nowWIB,
        'AKTIF'
      ];

      if (sheet.getLastRow() >= 2) {
        sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }

      // Update SHOP_ID di sheet Konfigurasi jika ada
      if (tokenData.shop_id) {
        var configSheet = getOrCreateSheet(SHEETS.CONFIG);
        var configData = configSheet.getDataRange().getValues();
        for (var i = 1; i < configData.length; i++) {
          if (configData[i][0] === 'SHOP_ID') {
            configSheet.getRange(i + 1, 2).setValue(String(tokenData.shop_id));
            break;
          }
        }
      }
    },

    /**
     * Upsert pesanan ke sheet Pesanan Masuk secara cerdas:
     * - Tidak menduplikasi baris
     * - Memperbarui status Shopee, resi, kurir
     * - Mempertahankan Status Internal Begood yang diubah manual oleh staf
     */
    upsertOrders: function(ordersList) {
      if (!ordersList || ordersList.length === 0) {
        return { added: 0, updated: 0 };
      }

      var sheet = getOrCreateSheet(SHEETS.ORDERS);
      var lastRow = sheet.getLastRow();
      var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');

      // Peta index pesanan yang sudah ada di sheet (Key: Order SN -> Row Index)
      var existingMap = {};
      if (lastRow > 1) {
        var orderSnValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var r = 0; r < orderSnValues.length; r++) {
          var sn = String(orderSnValues[r][0]).trim();
          if (sn) {
            existingMap[sn] = r + 2; // Baris riil di sheet
          }
        }
      }

      var addedCount = 0;
      var updatedCount = 0;
      var newRows = [];

      for (var i = 0; i < ordersList.length; i++) {
        var ord = ordersList[i];
        var sn = String(ord.order_sn).trim();

        if (existingMap[sn]) {
          // Baris sudah ada -> Update kolom status Shopee, ongkir, ekspedisi, resi, waktu sync
          var targetRow = existingMap[sn];
          
          sheet.getRange(targetRow, 3).setValue(ord.order_status || ''); // Status Shopee
          sheet.getRange(targetRow, 9).setValue(ord.actual_shipping_fee || ord.estimated_shipping_fee || 0); // Ongkir
          sheet.getRange(targetRow, 10).setValue(ord.shipping_carrier || ''); // Ekspedisi
          sheet.getRange(targetRow, 11).setValue(ord.tracking_number || ''); // Resi
          sheet.getRange(targetRow, 14).setValue(nowWIB); // Waktu Sinkronisasi
          
          updatedCount++;
        } else {
          // Baris baru -> Buat row baru
          var row = [
            sn,
            ord.create_time_formatted || '',
            ord.order_status || '',
            ord.internal_status || '[1] Siap Packing',
            ord.buyer_username || ord.recipient_name || '',
            ord.items_summary || '',
            ord.total_items_count || 1,
            ord.total_amount || 0,
            ord.actual_shipping_fee || ord.estimated_shipping_fee || 0,
            ord.shipping_carrier || '',
            ord.tracking_number || '',
            ord.note || '',
            ord.recipient_city || '',
            nowWIB
          ];
          newRows.push(row);
          addedCount++;
        }
      }

      if (newRows.length > 0) {
        var startAppendRow = sheet.getLastRow() + 1;
        sheet.getRange(startAppendRow, 1, newRows.length, newRows[0].length).setValues(newRows);
      }

      return { added: addedCount, updated: updatedCount };
    },

    /**
     * Mencatat riwayat ke sheet Log_Aktivitas
     */
    logActivity: function(actionType, orderCount, status, message) {
      try {
        var sheet = getOrCreateSheet(SHEETS.LOG);
        var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
        sheet.appendRow([nowWIB, actionType, orderCount || 0, status, message || '']);
      } catch (err) {
        console.error('Gagal mencatat log:', err);
      }
    },

    /**
     * Memperbarui Status Internal Begood per pesanan dari Web Dashboard
     */
    updateInternalStatus: function(orderSn, newStatus) {
      var sheet = getOrCreateSheet(SHEETS.ORDERS);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return false;

      var orderSnList = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < orderSnList.length; i++) {
        if (String(orderSnList[i][0]).trim() === String(orderSn).trim()) {
          var targetRow = i + 2;
          sheet.getRange(targetRow, 4).setValue(newStatus);
          var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
          sheet.getRange(targetRow, 14).setValue(nowWIB);
          return true;
        }
      }
      return false;
    },

    /**
     * Mengambil ringkasan metrik & data untuk Web Dashboard
     */
    getDashboardSummary: function() {
      var orderSheet = getOrCreateSheet(SHEETS.ORDERS);
      var orderLastRow = orderSheet.getLastRow();
      var todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

      var stats = {
        totalOrders: 0,
        ordersToday: 0,
        siapPacking: 0,
        menungguPickup: 0,
        sedangDikirim: 0,
        selesai: 0,
        batal: 0,
        totalRevenue: 0
      };

      var ordersList = [];
      if (orderLastRow >= 2) {
        var values = orderSheet.getRange(2, 1, orderLastRow - 1, 14).getValues();
        stats.totalOrders = values.length;

        for (var i = 0; i < values.length; i++) {
          var row = values[i];
          var sn = String(row[0]);
          var dateStr = String(row[1]);
          var shopeeStatus = String(row[2]);
          var internalStatus = String(row[3]);
          var buyer = String(row[4]);
          var items = String(row[5]);
          var qty = Number(row[6]) || 0;
          var totalAmount = Number(row[7]) || 0;
          var courier = String(row[9]);
          var resi = String(row[10]);

          stats.totalRevenue += totalAmount;

          if (dateStr && dateStr.indexOf(todayStr) !== -1) {
            stats.ordersToday++;
          }

          if (internalStatus.indexOf('Siap Packing') !== -1) stats.siapPacking++;
          else if (internalStatus.indexOf('Pickup') !== -1) stats.menungguPickup++;
          else if (internalStatus.indexOf('Dikirim') !== -1) stats.sedangDikirim++;
          else if (internalStatus.indexOf('Selesai') !== -1) stats.selesai++;
          else if (internalStatus.indexOf('Batal') !== -1) stats.batal++;

          // Simpan maksimal 60 pesanan terbaru untuk tabel dashboard (urutan terbalik)
          if (ordersList.length < 60) {
            ordersList.unshift({
              orderSn: sn,
              date: dateStr,
              shopeeStatus: shopeeStatus,
              internalStatus: internalStatus,
              buyer: buyer,
              items: items,
              qty: qty,
              totalAmount: totalAmount,
              courier: courier,
              resi: resi
            });
          }
        }
      }

      // Token Record
      var tokenRec = this.getTokenRecord();
      var tokenStatus = {
        hasToken: Boolean(tokenRec && tokenRec.access_token),
        shopId: tokenRec ? tokenRec.shop_id : '-',
        expiredAtWIB: tokenRec ? tokenRec.expired_at_wib : '-',
        statusText: 'BELUM ADA TOKEN',
        isExpired: true
      };

      if (tokenRec && tokenRec.expired_at) {
        var nowMs = Date.now();
        var expMs = Number(tokenRec.expired_at);
        if (expMs < 10000000000) expMs = expMs * 1000;
        var diffMin = Math.floor((expMs - nowMs) / 60000);
        if (diffMin > 0) {
          tokenStatus.isExpired = false;
          var h = Math.floor(diffMin / 60);
          var m = diffMin % 60;
          tokenStatus.statusText = 'AKTIF (' + h + 'j ' + m + 'm)';
        } else {
          tokenStatus.statusText = 'KADALUARSA';
        }
      }

      // Log Aktivitas (10 Terakhir)
      var logSheet = getOrCreateSheet(SHEETS.LOG);
      var logLastRow = logSheet.getLastRow();
      var logs = [];
      if (logLastRow >= 2) {
        var startRow = Math.max(2, logLastRow - 9);
        var numRows = logLastRow - startRow + 1;
        var logValues = logSheet.getRange(startRow, 1, numRows, 5).getValues();
        for (var j = logValues.length - 1; j >= 0; j--) {
          logs.push({
            time: logValues[j][0],
            action: logValues[j][1],
            count: logValues[j][2],
            status: logValues[j][3],
            detail: logValues[j][4]
          });
        }
      }

      // Cek Trigger Otomatis
      var triggers = ScriptApp.getProjectTriggers();
      var isTriggerActive = false;
      for (var t = 0; t < triggers.length; t++) {
        if (triggers[t].getHandlerFunction() === 'automatedSyncTrigger') {
          isTriggerActive = true;
          break;
        }
      }

      var config = this.getConfig();

      return {
        stats: stats,
        orders: ordersList,
        token: tokenStatus,
        logs: logs,
        config: config,
        isTriggerActive: isTriggerActive,
        statusOptions: STATUS_OPTIONS,
        nowWIB: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss')
      };
    }
  };
})();

