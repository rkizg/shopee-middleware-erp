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
        'No. Pesanan',              // 1 (A)
        'Tanggal Pesanan (WIB)',    // 2 (B)
        'Status Shopee',            // 3 (C)
        'Status Internal Begood',   // 4 (D)
        'Nama Pembeli',             // 5 (E)
        'Ringkasan Produk',         // 6 (F)
        'Nomor Referensi SKU',      // 7 (G)
        'Nama Variasi',             // 8 (H)
        'Total Qty',                // 9 (I)
        'Total Belanja (Rp)',       // 10 (J)
        'Ongkir (Rp)',              // 11 (K)
        'Ekspedisi / Kurir',        // 12 (L)
        'No. Resi',                 // 13 (M)
        'Catatan Pembeli',          // 14 (N)
        'Kota Tujuan',              // 15 (O)
        'Waktu Sinkronisasi'        // 16 (P)
      ];

      if (orderSheet.getLastRow() === 0) {
        orderSheet.appendRow(orderHeaders);
      } else {
        // Auto-migrasi jika sheet sudah ada tapi belum ada kolom 'Nomor Referensi SKU'
        var currentCols = orderSheet.getLastColumn();
        if (currentCols > 0) {
          var existingHeaders = orderSheet.getRange(1, 1, 1, currentCols).getValues()[0];
          if (existingHeaders.indexOf('Nomor Referensi SKU') === -1) {
            var prodIdx = existingHeaders.indexOf('Ringkasan Produk');
            if (prodIdx !== -1) {
              orderSheet.insertColumnsAfter(prodIdx + 1, 2);
            }
          }
        }
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
      orderSheet.getRange('D2:D5000').setDataValidation(rule);

      // Format format mata uang Total Belanja (J) & Ongkir (K)
      orderSheet.getRange('J2:K5000').setNumberFormat('Rp #,##0');
      // Format Nomor Pesanan, SKU & Resi sebagai Plain Text (agar angka tidak berubah format eksponensial)
      orderSheet.getRange('A2:A5000').setNumberFormat('@');
      orderSheet.getRange('G2:H5000').setNumberFormat('@');
      orderSheet.getRange('M2:M5000').setNumberFormat('@');

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
     * - Apabila pada pesanan terdapat lebih dari satu produk, ditulis di baris yang berbeda
     * - Cepat dengan update 2D Array in-memory
     * - Memperbarui status Shopee, resi, kurir, SKU, dan variasi
     * - Mempertahankan Status Internal Begood yang diubah manual oleh staf
     */
    upsertOrders: function(ordersList) {
      if (!ordersList || ordersList.length === 0) {
        return { added: 0, updated: 0 };
      }

      var sheet = getOrCreateSheet(SHEETS.ORDERS);
      var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');

      var orderHeaders = [
        'No. Pesanan',              // 1 (A)
        'Tanggal Pesanan (WIB)',    // 2 (B)
        'Status Shopee',            // 3 (C)
        'Status Internal Begood',   // 4 (D)
        'Nama Pembeli',             // 5 (E)
        'Nama Produk',              // 6 (F)
        'Nomor Referensi SKU',      // 7 (G)
        'Nama Variasi',             // 8 (H)
        'Qty',                      // 9 (I)
        'Total Belanja (Rp)',       // 10 (J)
        'Ongkir (Rp)',              // 11 (K)
        'Ekspedisi / Kurir',        // 12 (L)
        'No. Resi',                 // 13 (M)
        'Catatan Pembeli',          // 14 (N)
        'Kota Tujuan',              // 15 (O)
        'Waktu Sinkronisasi'        // 16 (P)
      ];

      // Auto-migrasi kolom jika sheet masih 14 kolom
      var currentCols = sheet.getLastColumn();
      if (currentCols > 0) {
        var existingHeaders = sheet.getRange(1, 1, 1, currentCols).getValues()[0];
        if (existingHeaders.indexOf('Nomor Referensi SKU') === -1) {
          var prodIdx = existingHeaders.indexOf('Ringkasan Produk') !== -1
            ? existingHeaders.indexOf('Ringkasan Produk')
            : existingHeaders.indexOf('Nama Produk');
          if (prodIdx !== -1) {
            sheet.insertColumnsAfter(prodIdx + 1, 2);
          }
        }
        sheet.getRange(1, 1, 1, orderHeaders.length).setValues([orderHeaders]);
      }

      var lastRow = sheet.getLastRow();
      var numCols = 16;
      var allData = [];
      if (lastRow > 1) {
        allData = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
      }

      // Map: order_sn -> { indices: [0, 1], internalStatus: '...' }
      var existingRowsMap = {};
      for (var r = 0; r < allData.length; r++) {
        var sn = String(allData[r][0] || '').trim();
        if (sn) {
          if (!existingRowsMap[sn]) {
            existingRowsMap[sn] = {
              indices: [],
              internalStatus: allData[r][3] || ''
            };
          }
          existingRowsMap[sn].indices.push(r);
        }
      }

      var addedCount = 0;
      var updatedCount = 0;
      var newRows = [];

      for (var i = 0; i < ordersList.length; i++) {
        var ord = ordersList[i];
        var sn = String(ord.order_sn || '').trim();
        if (!sn) continue;

        var items = (ord.items && ord.items.length > 0) ? ord.items : null;
        var ex = existingRowsMap[sn];

        if (ex) {
          // Pesanan sudah ada di sheet
          var savedStatus = ex.internalStatus || ord.internal_status || '[1] Siap Packing';

          if (items) {
            for (var j = 0; j < items.length; j++) {
              var it = items[j];
              var itName = it.item_name || ord.items_summary || '';
              var itSku = String(it.model_sku || '').trim() || '-';
              var itVar = String(it.model_name || '').trim() || '-';
              var itQty = Number(it.model_quantity_purchased || 1);

              if (j < ex.indices.length) {
                // Update baris yang sudah ada di memory
                var rowIdx = ex.indices[j];
                allData[rowIdx][2] = ord.order_status || allData[rowIdx][2] || '';
                allData[rowIdx][3] = savedStatus;
                allData[rowIdx][4] = ord.buyer_username || ord.recipient_name || allData[rowIdx][4] || '';
                allData[rowIdx][5] = itName;
                allData[rowIdx][6] = itSku;
                allData[rowIdx][7] = itVar;
                allData[rowIdx][8] = itQty;
                allData[rowIdx][9] = ord.total_amount || allData[rowIdx][9] || 0;
                allData[rowIdx][10] = ord.actual_shipping_fee || ord.estimated_shipping_fee || allData[rowIdx][10] || 0;
                allData[rowIdx][11] = ord.shipping_carrier || allData[rowIdx][11] || '';
                if (ord.tracking_number) {
                  allData[rowIdx][12] = ord.tracking_number;
                }
                allData[rowIdx][13] = ord.note || allData[rowIdx][13] || '';
                allData[rowIdx][14] = ord.recipient_city || allData[rowIdx][14] || '';
                allData[rowIdx][15] = nowWIB;
              } else {
                // Item tambahan (misal sebelumnya hanya 1 baris, sekarang pecah jadi beberapa baris)
                newRows.push([
                  sn,
                  ord.create_time_formatted || '',
                  ord.order_status || '',
                  savedStatus,
                  ord.buyer_username || ord.recipient_name || '',
                  itName,
                  itSku,
                  itVar,
                  itQty,
                  ord.total_amount || 0,
                  ord.actual_shipping_fee || ord.estimated_shipping_fee || 0,
                  ord.shipping_carrier || '',
                  ord.tracking_number || '',
                  ord.note || '',
                  ord.recipient_city || '',
                  nowWIB
                ]);
              }
            }
          } else {
            // Fallback jika tidak ada data item_list
            var rowIdx = ex.indices[0];
            allData[rowIdx][2] = ord.order_status || allData[rowIdx][2] || '';
            allData[rowIdx][3] = savedStatus;
            allData[rowIdx][6] = ord.sku_summary || '-';
            allData[rowIdx][7] = ord.variation_summary || '-';
            allData[rowIdx][8] = ord.total_items_count || 1;
            allData[rowIdx][11] = ord.shipping_carrier || allData[rowIdx][11] || '';
            if (ord.tracking_number) allData[rowIdx][12] = ord.tracking_number;
            allData[rowIdx][15] = nowWIB;
          }

          updatedCount++;
        } else {
          // Pesanan baru
          var internalStatus = ord.internal_status || '[1] Siap Packing';

          if (items) {
            for (var j = 0; j < items.length; j++) {
              var it = items[j];
              newRows.push([
                sn,
                ord.create_time_formatted || '',
                ord.order_status || '',
                internalStatus,
                ord.buyer_username || ord.recipient_name || '',
                it.item_name || ord.items_summary || '',
                String(it.model_sku || '').trim() || '-',
                String(it.model_name || '').trim() || '-',
                Number(it.model_quantity_purchased || 1),
                ord.total_amount || 0,
                ord.actual_shipping_fee || ord.estimated_shipping_fee || 0,
                ord.shipping_carrier || '',
                ord.tracking_number || '',
                ord.note || '',
                ord.recipient_city || '',
                nowWIB
              ]);
            }
          } else {
            newRows.push([
              sn,
              ord.create_time_formatted || '',
              ord.order_status || '',
              internalStatus,
              ord.buyer_username || ord.recipient_name || '',
              ord.items_summary || '',
              ord.sku_summary || '-',
              ord.variation_summary || '-',
              ord.total_items_count || 1,
              ord.total_amount || 0,
              ord.actual_shipping_fee || ord.estimated_shipping_fee || 0,
              ord.shipping_carrier || '',
              ord.tracking_number || '',
              ord.note || '',
              ord.recipient_city || '',
              nowWIB
            ]);
          }

          addedCount++;
        }
      }

      // Tulis kembali data yang di-update (dalam 1 batch cepat)
      if (allData.length > 0) {
        sheet.getRange(2, 1, allData.length, numCols).setValues(allData);
      }

      // Tulis baris-baris baru (dalam 1 batch cepat)
      if (newRows.length > 0) {
        var startAppendRow = sheet.getLastRow() + 1;
        sheet.getRange(startAppendRow, 1, newRows.length, numCols).setValues(newRows);
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
     * (Memperbarui seluruh baris produk jika pesanan multi-item)
     */
    updateInternalStatus: function(orderSn, newStatus) {
      return this.updateBatchInternalStatus([orderSn], newStatus);
    },

    /**
     * Memperbarui Status Internal Begood untuk banyak pesanan sekaligus (Batch)
     */
    updateBatchInternalStatus: function(orderSnList, newStatus) {
      if (!orderSnList || orderSnList.length === 0 || !newStatus) return false;
      var sheet = getOrCreateSheet(SHEETS.ORDERS);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return false;

      var numCols = Math.max(sheet.getLastColumn(), 16);
      var snSet = {};
      for (var s = 0; s < orderSnList.length; s++) {
        snSet[String(orderSnList[s]).trim()] = true;
      }

      var dataRange = sheet.getRange(2, 1, lastRow - 1, numCols);
      var values = dataRange.getValues();
      var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      var updated = false;

      for (var i = 0; i < values.length; i++) {
        var currentSn = String(values[i][0]).trim();
        if (snSet[currentSn]) {
          values[i][3] = newStatus;
          values[i][numCols - 1] = nowWIB;
          updated = true;
        }
      }

      if (updated) {
        dataRange.setValues(values);
        return true;
      }
      return false;
    },

    /**
     * Mengambil ringkasan metrik & data untuk Web Dashboard (Super Cepat & Teroptimasi)
     */
    getDashboardSummary: function() {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var orderSheet = ss.getSheetByName(SHEETS.ORDERS);
      if (!orderSheet) return null;

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
      var courierCounts = {};
      var skuCounts = {};

      if (orderLastRow >= 2) {
        var numRows = orderLastRow - 1;
        // Baca data tabel pesanan sekaligus dalam 1 API call
        var values = orderSheet.getRange(2, 1, numRows, 16).getValues();
        var uniqueOrdersSeen = {};
        var uniqueOrdersCount = 0;

        // Loop dari bawah ke atas (data terbaru terlebih dahulu)
        for (var i = values.length - 1; i >= 0; i--) {
          var row = values[i];
          var sn = String(row[0] || '').trim();
          if (!sn) continue;

          var dateStr = String(row[1] || '');
          var shopeeStatus = String(row[2] || '');
          var internalStatus = String(row[3] || '');
          var totalAmount = Number(row[9]) || 0;
          var courier = String(row[11] || '').trim() || 'Lainnya';
          var sku = String(row[6] || '').trim();
          var qty = Number(row[8]) || 1;

          // Hitung statistik pesanan unik
          if (!uniqueOrdersSeen[sn]) {
            uniqueOrdersSeen[sn] = true;
            uniqueOrdersCount++;
            stats.totalRevenue += totalAmount;

            if (dateStr && dateStr.indexOf(todayStr) !== -1) {
              stats.ordersToday++;
            }

            if (internalStatus.indexOf('Siap Packing') !== -1) stats.siapPacking++;
            else if (internalStatus.indexOf('Pickup') !== -1) stats.menungguPickup++;
            else if (internalStatus.indexOf('Dikirim') !== -1) stats.sedangDikirim++;
            else if (internalStatus.indexOf('Selesai') !== -1) stats.selesai++;
            else if (internalStatus.indexOf('Batal') !== -1) stats.batal++;

            courierCounts[courier] = (courierCounts[courier] || 0) + 1;
          }

          // Hitung SKU terlaris
          if (sku && sku !== '-') {
            skuCounts[sku] = (skuCounts[sku] || 0) + qty;
          }

          // Simpan hingga 80 baris pesanan terbaru (optimal untuk kecepatan transfer payload RPC)
          if (ordersList.length < 80) {
            ordersList.push({
              orderSn: sn,
              date: dateStr,
              shopeeStatus: shopeeStatus,
              internalStatus: internalStatus,
              buyer: String(row[4] || ''),
              items: String(row[5] || ''),
              sku: sku || '-',
              variation: String(row[7] || '-') || '-',
              qty: qty,
              totalAmount: totalAmount,
              shippingFee: Number(row[10]) || 0,
              courier: courier,
              resi: String(row[12] || '-'),
              note: String(row[13] || ''),
              city: String(row[14] || ''),
              syncTime: String(row[15] || '')
            });
          }
        }
        stats.totalOrders = uniqueOrdersCount;
      }

      // Format Top 5 SKU
      var topSkusList = [];
      for (var k in skuCounts) {
        topSkusList.push({ sku: k, qty: skuCounts[k] });
      }
      topSkusList.sort(function(a, b) { return b.qty - a.qty; });
      var topSkus = topSkusList.slice(0, 5);

      // Baca Token Record langsung dari ss dalam 1 API call
      var tokenSheet = ss.getSheetByName(SHEETS.TOKEN);
      var tokenRec = null;
      if (tokenSheet && tokenSheet.getLastRow() >= 2) {
        var tRow = tokenSheet.getRange(2, 1, 1, 8).getValues()[0];
        tokenRec = {
          shop_id: String(tRow[0] || '').trim(),
          partner_id: String(tRow[1] || '').trim(),
          access_token: String(tRow[2] || '').trim(),
          refresh_token: String(tRow[3] || '').trim(),
          expired_at: Number(tRow[4]) || 0,
          expired_at_wib: String(tRow[5] || ''),
          status: String(tRow[7] || '')
        };
      }

      var tokenStatus = {
        hasToken: Boolean(tokenRec && tokenRec.access_token),
        shopId: tokenRec ? tokenRec.shop_id : '-',
        expiredAtWIB: tokenRec ? tokenRec.expired_at_wib : '-',
        statusText: 'BELUM ADA TOKEN',
        isExpired: true,
        remainingMinutes: 0
      };

      if (tokenRec && tokenRec.expired_at) {
        var nowMs = Date.now();
        var expMs = tokenRec.expired_at;
        if (expMs < 10000000000) expMs = expMs * 1000;
        var diffMin = Math.floor((expMs - nowMs) / 60000);
        tokenStatus.remainingMinutes = diffMin;
        if (diffMin > 0) {
          tokenStatus.isExpired = false;
          var h = Math.floor(diffMin / 60);
          var m = diffMin % 60;
          tokenStatus.statusText = 'AKTIF (' + h + 'j ' + m + 'm)';
        } else {
          tokenStatus.statusText = 'KADALUARSA';
        }
      }

      // Baca Log Aktivitas (7 Terakhir) langsung dari ss
      var logSheet = ss.getSheetByName(SHEETS.LOG);
      var logs = [];
      if (logSheet && logSheet.getLastRow() >= 2) {
        var lLast = logSheet.getLastRow();
        var sRow = Math.max(2, lLast - 6);
        var lRows = lLast - sRow + 1;
        var lVals = logSheet.getRange(sRow, 1, lRows, 5).getValues();
        for (var j = lVals.length - 1; j >= 0; j--) {
          logs.push({
            time: String(lVals[j][0] || ''),
            action: String(lVals[j][1] || ''),
            count: Number(lVals[j][2]) || 0,
            status: String(lVals[j][3] || ''),
            detail: String(lVals[j][4] || '')
          });
        }
      }

      // Cek Trigger Otomatis via PropertiesService (0 ms!)
      var props = PropertiesService.getScriptProperties();
      var isTriggerActive = props.getProperty('IS_TRIGGER_ACTIVE') === 'true';

      // Baca Konfigurasi
      var configSheet = ss.getSheetByName(SHEETS.CONFIG);
      var config = {};
      if (configSheet && configSheet.getLastRow() >= 2) {
        var cVals = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getValues();
        for (var c = 0; c < cVals.length; c++) {
          var key = String(cVals[c][0] || '').trim();
          if (key) config[key] = String(cVals[c][1] || '').trim();
        }
      }

      var webAppUrl = props.getProperty('WEB_APP_URL') || '';
      if (!webAppUrl) {
        try {
          webAppUrl = ScriptApp.getService().getUrl() || '';
          if (webAppUrl) props.setProperty('WEB_APP_URL', webAppUrl);
        } catch (e) {}
      }

      return {
        stats: stats,
        orders: ordersList,
        courierStats: courierCounts,
        topSkus: topSkus,
        token: tokenStatus,
        logs: logs,
        config: config,
        isTriggerActive: isTriggerActive,
        statusOptions: STATUS_OPTIONS,
        webAppUrl: webAppUrl,
        nowWIB: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss')
      };
    }
  };
})();

