/**
 * ============================================================================
 * ERP Begood - ShippingService.js
 * Modul Meja Pengiriman & Resi Thermal Shopee (A6 / 100x150 mm)
 * Menyimpan & membaca data dari Spreadsheet Distribusi Operasional:
 * ID: 1DxvKSTHjXH8jWOg5-AVpmhgJ-ELKhfpfSMtnn0Xemgc
 * ============================================================================
 */

var ID_SPREADSHEET_DISTRIBUSI_BARU = '1DxvKSTHjXH8jWOg5-AVpmhgJ-ELKhfpfSMtnn0Xemgc';

/**
 * Membuka spreadsheet operasional distribusi (sheet yang sama dengan Distribusi.html)
 */
function getSpreadsheetPengiriman_() {
  try {
    if (ID_SPREADSHEET_DISTRIBUSI_BARU) {
      return SpreadsheetApp.openById(ID_SPREADSHEET_DISTRIBUSI_BARU);
    }
  } catch (err) {
    console.warn('[ShippingService] Gagal membuka spreadsheet via ID, menggunakan active spreadsheet:', err);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Render halaman mandiri Meja Pengiriman Web App
 */
function renderPengirimanPage_() {
  try {
    return HtmlService.createHtmlOutputFromFile('Pengiriman')
      .setTitle('Meja Pengiriman & Resi Shopee - ERP Begood')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Setup Pengiriman.html - ERP Begood</title>' +
      '<style>body{font-family:sans-serif;padding:20px;background:#f6f8fa;color:#0f172a;text-align:center;}' +
      '.box{max-width:480px;margin:30px auto;background:#ffffff;padding:24px;border-radius:12px;border:1px solid #e2e8f0;text-align:left;box-shadow:0 1px 3px rgba(0,0,0,0.05);}' +
      'h2{color:#0f172a;font-size:18px;margin-bottom:8px;text-align:center;}p{color:#64748b;font-size:13px;line-height:1.5;margin-bottom:12px;}' +
      'ol{color:#334155;font-size:13px;line-height:1.8;padding-left:20px;margin-bottom:16px;}code{background:#f1f5f9;color:#0f172a;padding:2px 6px;border-radius:4px;font-family:monospace;}' +
      '.btn{display:block;text-align:center;background:#0f172a;color:#fff;padding:12px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:14px;}' +
      '</style></head><body><div class="box">' +
      '<h2>Berkas Pengiriman.html Belum Dibuat di Apps Script</h2>' +
      '<p>Google Apps Script belum menemukan berkas <code>Pengiriman.html</code> di editor proyek Anda:</p>' +
      '<ol>' +
      '<li>Buka editor Apps Script (<strong>Ekstensi &gt; Apps Script</strong>).</li>' +
      '<li>Klik tombol <strong>+</strong> di samping Berkas &gt; pilih <strong>HTML</strong>.</li>' +
      '<li>Beri nama: <code>Pengiriman</code> (huruf besar P).</li>' +
      '<li>Salin isi berkas <code>gas/Pengiriman.html</code> ke dalamnya, lalu Simpan.</li>' +
      '<li>Klik <strong>Deploy &gt; Kelola deployment &gt; Edit &gt; Versi baru &gt; Deploy</strong>.</li>' +
      '</ol>' +
      '<a class="btn" href="' + (ScriptApp.getService().getUrl() || '#') + '">Buka Dashboard Utama</a>' +
      '</div></body></html>'
    ).setTitle('Setup Pengiriman.html - ERP Begood');
  }
}

/**
 * Menu pembuka Meja Pengiriman di tab baru dari Spreadsheet
 */
function bukaMejaPengirimanPrompt() {
  var ui = SpreadsheetApp.getUi();
  var webAppUrl = '';
  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (e) {}

  if (!webAppUrl) {
    ui.alert(
      'Web App Belum Di-deploy',
      'Untuk membuka Meja Pengiriman & Resi di tab baru:\n\n' +
      '1. Buka editor Apps Script (Ekstensi > Apps Script).\n' +
      '2. Deploy > New deployment > Web app.\n' +
      '3. Salin URL deployment dan buka dengan parameter "?page=pengiriman"',
      ui.ButtonSet.OK
    );
    return;
  }

  var targetUrl = webAppUrl + (webAppUrl.indexOf('?') !== -1 ? '&' : '?') + 'page=pengiriman';
  var html = HtmlService.createHtmlOutput(
    '<p style="font-family:sans-serif;font-size:13px;">Klik tombol di bawah untuk membuka Meja Pengiriman & Resi Shopee:</p>' +
    '<p><a href="' + targetUrl + '" target="_blank" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Buka Meja Pengiriman &rarr;</a></p>'
  ).setWidth(380).setHeight(140);
  ui.showModalDialog(html, 'Meja Pengiriman & Resi Shopee');
}

/**
 * Mencari indeks kolom dari array headers secara fleksibel
 * (case-insensitive, membuang spasi/tanda baca, dan substring match)
 */
function cariIndeksKolom_(headers, possibleNames) {
  if (!headers || !headers.length || !possibleNames || !possibleNames.length) return -1;
  // 1. Exact match case-insensitive
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim().toLowerCase();
    if (!h) continue;
    for (var k = 0; k < possibleNames.length; k++) {
      if (h === String(possibleNames[k] || '').trim().toLowerCase()) {
        return i;
      }
    }
  }
  // 2. Normalized match (buang tanda baca, spasi, titik, underscore, kurung)
  for (var i = 0; i < headers.length; i++) {
    var hClean = String(headers[i] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!hClean) continue;
    for (var k = 0; k < possibleNames.length; k++) {
      var pClean = String(possibleNames[k] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (hClean === pClean) {
        return i;
      }
    }
  }
  // 3. Substring match bila kata kunci cukup spesifik (panjang >= 4)
  for (var i = 0; i < headers.length; i++) {
    var hClean = String(headers[i] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!hClean) continue;
    for (var k = 0; k < possibleNames.length; k++) {
      var pClean = String(possibleNames[k] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (pClean.length >= 4 && (hClean.indexOf(pClean) !== -1 || pClean.indexOf(hClean) !== -1)) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Membersihkan nama variasi lokal (menghilangkan keterangan ukuran sesudah koma)
 */
function bersihkanVariasiLocal_(nilai) {
  if (typeof SheetManager !== 'undefined' && SheetManager.bersihkanVariasi) {
    try {
      return SheetManager.bersihkanVariasi(nilai);
    } catch (e) {}
  }
  var teks = String(nilai === null || nilai === undefined ? '' : nilai).trim();
  var pisah = teks.indexOf(',');
  if (pisah >= 0) {
    var depan = teks.slice(0, pisah).trim();
    var belakang = teks.slice(pisah + 1).trim();
    var komaKedua = belakang.indexOf(',');
    if (komaKedua >= 0) belakang = belakang.slice(0, komaKedua).trim();
    if (/\d+\s*[xX*]\s*\d+/.test(belakang)) {
      return depan;
    }
    if (/\d+\s*[xX*]\s*\d+/.test(depan)) {
      return belakang;
    }
    return depan;
  }
  return teks;
}

/**
 * Mengisi petaPenjahit dan petaPacking dari sebuah sheet secara aman
 */
function isiPetaPenjahitDanPackingDariSheet_(sheet, petaPenjahit, petaPenjahitSku, petaPenjahitBySn, petaPacking) {
  if (!sheet || sheet.getLastRow() < 2) return;
  try {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    if (!values || values.length < 2) return;
    var headers = values[0];

    var colSn = cariIndeksKolom_(headers, ['No. Pesanan', 'No Pesanan', 'Nomor Pesanan', 'Order SN', 'order_sn', 'Order ID']);
    var colSku = cariIndeksKolom_(headers, ['SKU', 'Nomor Referensi SKU', 'Model SKU', 'Kode SKU']);
    var colVar = cariIndeksKolom_(headers, ['Variasi', 'Nama Variasi', 'Model Name']);
    var colPenjahit = cariIndeksKolom_(headers, ['Penjahit', 'Nama Penjahit', 'Tukang Jahit', 'Operator Jahit']);
    var colPacking = cariIndeksKolom_(headers, ['Petugas Packing', 'Packing', 'Petugas', 'Nama Packing']);

    if (colSn === -1) return;

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var sn = String(row[colSn] || '').trim();
      if (!sn) continue;

      var sku = (colSku !== -1 && row[colSku]) ? String(row[colSku]).trim().toUpperCase() : '';
      var rawVar = (colVar !== -1 && row[colVar]) ? String(row[colVar]).trim().toUpperCase() : '';
      var cleanVar = bersihkanVariasiLocal_(rawVar).toUpperCase();
      var penjahit = (colPenjahit !== -1 && row[colPenjahit]) ? String(row[colPenjahit]).trim().toUpperCase() : '';
      var packing = (colPacking !== -1 && row[colPacking]) ? String(row[colPacking]).trim().toUpperCase() : '';

      if (penjahit && penjahit !== '-' && penjahit !== 'BELUM DISET') {
        if (sku && rawVar) petaPenjahit[sn + '|' + sku + '|' + rawVar] = penjahit;
        if (sku && cleanVar) petaPenjahit[sn + '|' + sku + '|' + cleanVar] = penjahit;
        if (rawVar) petaPenjahit[sn + '||' + rawVar] = penjahit;
        if (cleanVar) petaPenjahit[sn + '||' + cleanVar] = penjahit;
        if (sku && !petaPenjahitSku[sn + '|' + sku]) petaPenjahitSku[sn + '|' + sku] = penjahit;
        if (!petaPenjahitBySn[sn]) petaPenjahitBySn[sn] = [];
        if (petaPenjahitBySn[sn].indexOf(penjahit) === -1) {
          petaPenjahitBySn[sn].push(penjahit);
        }
      }

      if (packing && packing !== '-' && packing !== 'MENUNGGU' && !petaPacking[sn]) {
        petaPacking[sn] = packing;
      }
    }
  } catch (err) {
    console.warn('[ShippingService] Gagal membaca data dari sheet ' + (sheet ? sheet.getName() : ''), err);
  }
}

/**
 * Menyelesaikan teks kelengkapan SKU berdasarkan aturan bawaan & konfigurasi
 */
function resolveKelengkapanForItem_(sku, variasi, kelengkapanList) {
  var s = String(sku || '').trim().toUpperCase();
  var v = String(variasi || '').trim().toUpperCase();
  var combined = (s + ' ' + v).replace(/\s+/g, ' ');

  // 1. Cek kecocokan di daftar kelengkapan dari SheetManager
  if (kelengkapanList && kelengkapanList.length > 0) {
    for (var i = 0; i < kelengkapanList.length; i++) {
      var pola = String(kelengkapanList[i].sku || '').trim().toUpperCase();
      if (!pola) continue;
      // Exact match
      if (pola === s || pola === combined) {
        return kelengkapanList[i].kelengkapan;
      }
      // Wildcard match (e.g. SPREI*120*SET)
      if (pola.indexOf('*') !== -1) {
        var regexStr = '^' + pola.split('*').map(function(part) {
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('.*') + '$';
        try {
          var re = new RegExp(regexStr, 'i');
          if (re.test(s) || re.test(combined)) {
            return kelengkapanList[i].kelengkapan;
          }
        } catch (e) {}
      }
    }
  }

  // 2. Fallback ke deteksi otomatis SPREI SET
  if (combined.indexOf('SPREI') !== -1 && combined.indexOf('SET') !== -1) {
    var mUkuran = combined.match(/\b(70|80|90|100|120|140|150|160|180|200)(?:\s*[\/xX*]|\b)/);
    if (mUkuran) {
      var lebar = parseInt(mUkuran[1], 10);
      if (lebar >= 140) return '2 Bantal + 2 Guling + 2 Tali';
      return '1 Bantal + 1 Guling + 2 Tali';
    }
    if (/\b(KING|QUEEN|DOUBLE)\b/.test(combined)) {
      return '2 Bantal + 2 Guling + 2 Tali';
    }
    return '1 Bantal + 1 Guling + 2 Tali';
  }

  return '';
}

/**
 * Mendapatkan daftar pesanan aktif untuk Meja Pengiriman
 * dari Spreadsheet Distribusi Baru (Sheet "Pesanan Masuk")
 */
function getShippingOrdersSummary(kodeToko) {
  var ss = getSpreadsheetPengiriman_();
  var orderSheet = ss.getSheetByName('Pesanan Masuk');

  if (!orderSheet) {
    return {
      success: false,
      message: 'Sheet "Pesanan Masuk" tidak ditemukan di Spreadsheet Distribusi (' + (ss.getName ? ss.getName() : 'ID: ' + ID_SPREADSHEET_DISTRIBUSI_BARU) + ')'
    };
  }

  var lastRow = orderSheet.getLastRow();
  var lastCol = orderSheet.getLastColumn();
  var kode = String(kodeToko || '').trim().toUpperCase();

  var stats = {
    needArrange: 0,
    readyToPrint: 0,
    alreadyPrinted: 0,
    totalPackages: 0
  };

  var ordersMap = {};
  var orderOrder = [];
  var courierStats = {};

  // Baca status cetak dari ScriptProperties (cache tanda cetak)
  var props = PropertiesService.getScriptProperties();
  var printedRaw = props.getProperty('PRINTED_RESI_SNS') || '[]';
  var printedSet = {};
  try {
    var printedList = JSON.parse(printedRaw);
    for (var p = 0; p < printedList.length; p++) {
      printedSet[String(printedList[p])] = true;
    }
  } catch (errP) {}

  // 1. Peta penjahit & petugas packing dari sheet PEMBAGIAN KERJA, PEMBAGIAN PACKING, & PEMBAGIAN JAHIT
  var petaPenjahit = {};      // key: orderSn + '|' + sku + '|' + variasi -> penjahit
  var petaPenjahitSku = {};   // key: orderSn + '|' + sku -> penjahit
  var petaPenjahitBySn = {};  // key: orderSn -> [penjahit1, penjahit2]
  var petaPacking = {};       // key: orderSn -> petugasPacking

  // Baca dari Spreadsheet Distribusi Baru (ss)
  isiPetaPenjahitDanPackingDariSheet_(ss.getSheetByName('PEMBAGIAN KERJA'), petaPenjahit, petaPenjahitSku, petaPenjahitBySn, petaPacking);
  isiPetaPenjahitDanPackingDariSheet_(ss.getSheetByName('PEMBAGIAN PACKING'), petaPenjahit, petaPenjahitSku, petaPenjahitBySn, petaPacking);
  isiPetaPenjahitDanPackingDariSheet_(ss.getSheetByName('PEMBAGIAN JAHIT'), petaPenjahit, petaPenjahitSku, petaPenjahitBySn, petaPacking);

  // 2. Baca dari Master Spreadsheet melalui SheetManager (jika tersedia)
  try {
    if (typeof SheetManager !== 'undefined') {
      if (typeof SheetManager.bacaPembagian === 'function') {
        var mBagi = SheetManager.bacaPembagian();
        for (var mb = 0; mb < mBagi.length; mb++) {
          var mSn = String(mBagi[mb].noPesanan || '').trim();
          var mSku = String(mBagi[mb].sku || '').trim().toUpperCase();
          var mVar = String(mBagi[mb].variasi || '').trim().toUpperCase();
          var mVarClean = bersihkanVariasiLocal_(mVar).toUpperCase();
          var mPj = String(mBagi[mb].penjahit || '').trim().toUpperCase();
          if (mSn && mPj && mPj !== '-' && mPj !== 'BELUM DISET') {
            if (mSku && mVar) petaPenjahit[mSn + '|' + mSku + '|' + mVar] = mPj;
            if (mSku && mVarClean) petaPenjahit[mSn + '|' + mSku + '|' + mVarClean] = mPj;
            if (mVar) petaPenjahit[mSn + '||' + mVar] = mPj;
            if (mVarClean) petaPenjahit[mSn + '||' + mVarClean] = mPj;
            if (mSku && !petaPenjahitSku[mSn + '|' + mSku]) petaPenjahitSku[mSn + '|' + mSku] = mPj;
            if (!petaPenjahitBySn[mSn]) petaPenjahitBySn[mSn] = [];
            if (petaPenjahitBySn[mSn].indexOf(mPj) === -1) petaPenjahitBySn[mSn].push(mPj);
          }
        }
      }
      if (typeof SheetManager.bacaPembagianPacking === 'function') {
        var mPack = SheetManager.bacaPembagianPacking();
        for (var mp = 0; mp < mPack.length; mp++) {
          var pSn = String(mPack[mp].noPesanan || '').trim();
          var pPet = String(mPack[mp].petugasPacking || '').trim().toUpperCase();
          if (pSn && pPet && pPet !== '-' && pPet !== 'MENUNGGU' && !petaPacking[pSn]) {
            petaPacking[pSn] = pPet;
          }
        }
      }
    }
  } catch (eMasterSm) {
    console.warn('[ShippingService] Gagal membaca via SheetManager:', eMasterSm);
  }

  // 3. Fallback baca langsung dari Active Spreadsheet jika berbeda dari ss
  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs && (!ss || activeSs.getId() !== ss.getId())) {
      isiPetaPenjahitDanPackingDariSheet_(activeSs.getSheetByName('PEMBAGIAN KERJA'), petaPenjahit, petaPenjahitSku, petaPenjahitBySn, petaPacking);
      isiPetaPenjahitDanPackingDariSheet_(activeSs.getSheetByName('PEMBAGIAN PACKING'), petaPenjahit, petaPenjahitSku, petaPenjahitBySn, petaPacking);
      isiPetaPenjahitDanPackingDariSheet_(activeSs.getSheetByName('PEMBAGIAN JAHIT'), petaPenjahit, petaPenjahitSku, petaPenjahitBySn, petaPacking);
    }
  } catch (eActiveSs) {}

  // 4. Baca kamus kelengkapan SKU
  var kelengkapanList = [];
  try {
    if (typeof SheetManager !== 'undefined' && SheetManager.bacaKelengkapanSku) {
      kelengkapanList = SheetManager.bacaKelengkapanSku();
    }
  } catch (eKel) {}

  if (lastRow >= 2 && lastCol >= 1) {
    var rangeValues = orderSheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = rangeValues[0];

    // Pemetaan indeks kolom secara dinamis, fleksibel, dan aman
    var colSn = cariIndeksKolom_(headers, ['No. Pesanan', 'No Pesanan', 'Nomor Pesanan', 'Order SN', 'order_sn', 'Order ID']);
    var colDate = cariIndeksKolom_(headers, ['Tanggal Pesanan (WIB)', 'Tanggal Pesanan', 'Tanggal', 'Order Date']);
    var colShopeeStatus = cariIndeksKolom_(headers, ['Status Shopee', 'Status Order', 'Shopee Status']);
    var colInternalStatus = cariIndeksKolom_(headers, ['Status Internal Begood', 'Status Internal', 'Status']);
    var colToko = cariIndeksKolom_(headers, ['Toko', 'Nama Toko', 'Store']);
    var colBuyer = cariIndeksKolom_(headers, ['Nama Pembeli', 'Pembeli', 'Buyer', 'Username']);
    var colProduct = cariIndeksKolom_(headers, ['Ringkasan Produk', 'Nama Produk', 'Produk', 'Item Name']);
    var colSku = cariIndeksKolom_(headers, ['Nomor Referensi SKU', 'SKU Induk', 'SKU', 'Model SKU']);
    var colVariation = cariIndeksKolom_(headers, ['Nama Variasi', 'Variasi', 'Variation', 'Model Name']);
    var colQty = cariIndeksKolom_(headers, ['Total Qty', 'Qty', 'Jumlah', 'Quantity']);
    var colCourier = cariIndeksKolom_(headers, ['Ekspedisi / Kurir', 'Ekspedisi', 'Kurir', 'Shipping Carrier', 'Carrier']);
    var colResi = cariIndeksKolom_(headers, ['No. Resi', 'No Resi', 'Nomor Resi', 'Resi', 'Tracking Number']);
    var colCity = cariIndeksKolom_(headers, ['Kota Tujuan', 'Kota', 'City', 'Recipient City']);
    var colNotes = cariIndeksKolom_(headers, ['Catatan Pembeli', 'Catatan', 'Notes', 'Buyer Note']);

    // Loop dari baris paling baru ke lama
    for (var i = rangeValues.length - 1; i >= 1; i--) {
      var row = rangeValues[i];
      var orderSn = (colSn !== -1 && row[colSn]) ? String(row[colSn]).trim() : '';
      if (!orderSn) continue;

      var rowToko = (colToko !== -1 && row[colToko]) ? String(row[colToko]).trim().toUpperCase() : '';
      if (kode && rowToko && rowToko !== kode) continue;

      var shopeeStatus = (colShopeeStatus !== -1 && row[colShopeeStatus]) ? String(row[colShopeeStatus]).trim().toUpperCase() : '';
      var internalStatus = (colInternalStatus !== -1 && row[colInternalStatus]) ? String(row[colInternalStatus]).trim() : '';
      var trackingNumber = (colResi !== -1 && row[colResi]) ? String(row[colResi]).trim() : '';
      var courier = (colCourier !== -1 && row[colCourier]) ? String(row[colCourier]).trim() : 'Lainnya';
      if (!courier) courier = 'Lainnya';

      // Saring pesanan batal
      var isCancelled = shopeeStatus === 'CANCELLED' || internalStatus === '[6] Dibatalkan';
      if (isCancelled) continue;

      if (!ordersMap[orderSn]) {
        var isPrinted = Boolean(printedSet[orderSn]);

        // Tentukan tahap dokumen:
        // 1 = need_arrange: belum ada resi asli & status masih READY_TO_SHIP / Siap Packing
        // 2 = ready_to_print: sudah ada resi atau PROCESSED tapi belum dicetak
        // 3 = already_printed: sudah pernah dicetak resinya
        var shippingStage = 'ready_to_print';
        var belumAdaResi = !trackingNumber || trackingNumber === '-' || trackingNumber === 'BELUM ADA RESI';

        if (belumAdaResi && (shopeeStatus === 'READY_TO_SHIP' || internalStatus === '[1] Siap Packing')) {
          shippingStage = 'need_arrange';
          stats.needArrange++;
        } else if (isPrinted) {
          shippingStage = 'already_printed';
          stats.alreadyPrinted++;
        } else {
          shippingStage = 'ready_to_print';
          stats.readyToPrint++;
        }

        stats.totalPackages++;
        courierStats[courier] = (courierStats[courier] || 0) + 1;

        ordersMap[orderSn] = {
          order_sn: orderSn,
          order_date: (colDate !== -1 && row[colDate]) ? String(row[colDate]) : '',
          shopee_status: shopeeStatus,
          internal_status: internalStatus,
          buyer_name: (colBuyer !== -1 && row[colBuyer]) ? String(row[colBuyer]) : '-',
          courier: courier,
          tracking_number: belumAdaResi ? '' : trackingNumber,
          notes: (colNotes !== -1 && row[colNotes]) ? String(row[colNotes]) : '',
          city: (colCity !== -1 && row[colCity]) ? String(row[colCity]) : '-',
          toko: rowToko || 'BEGOOD',
          stage: shippingStage,
          is_printed: isPrinted,
          petugas_packing: petaPacking[orderSn] || '-',
          penjahit_summary: (petaPenjahitBySn[orderSn] && petaPenjahitBySn[orderSn].length > 0)
            ? petaPenjahitBySn[orderSn].join(', ')
            : '-',
          total_qty: 0,
          total_amount: 0,
          items: []
        };
        orderOrder.push(orderSn);
      }

      // Kumpulkan item variasi/SKU produk
      var itemSku = (colSku !== -1 && row[colSku]) ? String(row[colSku]).trim() : '-';
      var itemName = (colProduct !== -1 && row[colProduct]) ? String(row[colProduct]).trim() : 'Produk';
      var itemVariation = (colVariation !== -1 && row[colVariation]) ? String(row[colVariation]).trim() : '';
      var itemQty = (colQty !== -1 && Number(row[colQty])) ? Number(row[colQty]) : 1;

      var kSkuClean = itemSku.toUpperCase();
      var kVarRaw = itemVariation.toUpperCase();
      var kVarClean = bersihkanVariasiLocal_(itemVariation).toUpperCase();

      var itemPenjahit = petaPenjahit[orderSn + '|' + kSkuClean + '|' + kVarRaw] ||
                         petaPenjahit[orderSn + '|' + kSkuClean + '|' + kVarClean] ||
                         petaPenjahit[orderSn + '||' + kVarRaw] ||
                         petaPenjahit[orderSn + '||' + kVarClean] ||
                         petaPenjahitSku[orderSn + '|' + kSkuClean] ||
                         (petaPenjahitBySn[orderSn] && petaPenjahitBySn[orderSn].length === 1 ? petaPenjahitBySn[orderSn][0] : '') ||
                         (petaPenjahitBySn[orderSn] && petaPenjahitBySn[orderSn].length > 1 ? petaPenjahitBySn[orderSn].join(', ') : '') ||
                         '-';

      var itemKelengkapan = resolveKelengkapanForItem_(itemSku, itemVariation, kelengkapanList);

      ordersMap[orderSn].total_qty += itemQty;
      ordersMap[orderSn].items.push({
        sku: itemSku,
        name: itemName,
        variation: itemVariation,
        qty: itemQty,
        penjahit: itemPenjahit,
        kelengkapan: itemKelengkapan
      });
    }
  }

  var ordersList = [];
  for (var k = 0; k < orderOrder.length; k++) {
    ordersList.push(ordersMap[orderOrder[k]]);
  }

  return {
    success: true,
    stats: stats,
    orders: ordersList,
    courier_stats: courierStats,
    spreadsheet_id: ss.getId(),
    spreadsheet_name: ss.getName ? ss.getName() : 'Spreadsheet Operasional',
    timestamp: new Date().toISOString()
  };
}

/**
 * RPC: Sinkronisasi / Tarik Pesanan Siap Kirim Terbaru dari Shopee langsung ke Spreadsheet Baru
 */
function syncOrdersPengirimanRpc(kodeToko) {
  try {
    // Manfaatkan fungsi penarikan data yang sudah ada di DistribusiService
    if (typeof ambilPesananSiapKirimKeSpreadsheetBaru === 'function') {
      var res = ambilPesananSiapKirimKeSpreadsheetBaru('', kodeToko);
      return {
        success: true,
        message: res.message || ('Berhasil menarik ' + res.countOrders + ' pesanan ke Spreadsheet.'),
        count: res.countOrders
      };
    } else {
      throw new Error('Fungsi ambilPesananSiapKirimKeSpreadsheetBaru belum tersedia di Apps Script.');
    }
  } catch (err) {
    return {
      success: false,
      message: err.message || String(err)
    };
  }
}

/**
 * Memperbarui Nomor Resi dan Status Shopee di Spreadsheet Operasional Baru
 * (dan Master Spreadsheet jika terpasang)
 */
function updateOrderInSpreadsheetDistribusi_(orderSn, trackingNumber, newStatusShopee, confirmedToko) {
  var ss = getSpreadsheetPengiriman_();
  if (!ss) return false;

  var sheet = ss.getSheetByName('Pesanan Masuk');
  if (!sheet || sheet.getLastRow() < 2) return false;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var range = sheet.getRange(1, 1, lastRow, lastCol);
  var values = range.getValues();
  var headers = values[0];

  var colSn = cariIndeksKolom_(headers, ['No. Pesanan', 'No Pesanan', 'Nomor Pesanan', 'Order SN', 'order_sn', 'Order ID']);
  var colResi = cariIndeksKolom_(headers, ['No. Resi', 'No Resi', 'Nomor Resi', 'Resi', 'Tracking Number']);
  var colStatus = cariIndeksKolom_(headers, ['Status Shopee', 'Status Order', 'Shopee Status']);
  var colInternal = cariIndeksKolom_(headers, ['Status Internal Begood', 'Status Internal', 'Status']);
  var colSync = cariIndeksKolom_(headers, ['Waktu Sinkronisasi', 'Sync Time', 'Waktu']);
  var colToko = cariIndeksKolom_(headers, ['Toko', 'Nama Toko', 'Store']);

  if (colSn === -1) return false;

  var targetSn = String(orderSn).trim();
  var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  var updated = false;

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][colSn]).trim() === targetSn) {
      if (trackingNumber && colResi !== -1) values[i][colResi] = trackingNumber;
      if (newStatusShopee && colStatus !== -1) values[i][colStatus] = newStatusShopee;
      if (colInternal !== -1 && (!values[i][colInternal] || values[i][colInternal] === '[1] Siap Packing')) {
        values[i][colInternal] = '[2] Menunggu Diambil Kurir';
      }
      if (confirmedToko && colToko !== -1 && (!values[i][colToko] || values[i][colToko] === 'BEGOOD')) {
        values[i][colToko] = confirmedToko;
      }
      if (colSync !== -1) values[i][colSync] = nowWIB;
      updated = true;
    }
  }

  if (updated) {
    range.setValues(values);
  }

  // Update juga No. Resi di PEMBAGIAN PACKING jika barisnya sudah ada
  try {
    var sheetPacking = ss.getSheetByName('PEMBAGIAN PACKING');
    if (sheetPacking && sheetPacking.getLastRow() > 1 && trackingNumber) {
      var pRange = sheetPacking.getRange(1, 1, sheetPacking.getLastRow(), sheetPacking.getLastColumn());
      var pVals = pRange.getValues();
      var pHdrs = pVals[0];
      var pSnCol = cariIndeksKolom_(pHdrs, ['No. Pesanan', 'No Pesanan', 'Nomor Pesanan', 'Order SN', 'order_sn']);
      var pResiCol = cariIndeksKolom_(pHdrs, ['No. Resi', 'No Resi', 'Nomor Resi', 'Resi', 'Tracking Number']);
      if (pSnCol !== -1 && pResiCol !== -1) {
        var pUpdated = false;
        for (var p = 1; p < pVals.length; p++) {
          if (String(pVals[p][pSnCol]).trim() === targetSn) {
            pVals[p][pResiCol] = trackingNumber;
            pUpdated = true;
          }
        }
        if (pUpdated) pRange.setValues(pVals);
      }
    }
  } catch (ePack) {
    console.warn('[ShippingService] Gagal update resi di PEMBAGIAN PACKING:', ePack);
  }

  return updated;
}

/**
 * Mencari informasi toko pemilik pesanan dari sheet Pesanan Masuk
 */
function findOrderStoreInfo_(orderSn) {
  try {
    var ss = getSpreadsheetPengiriman_();
    if (!ss) return { toko: '' };
    var sheet = ss.getSheetByName('Pesanan Masuk');
    if (!sheet || sheet.getLastRow() < 2) return { toko: '' };

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0];
    var colSn = cariIndeksKolom_(headers, ['No. Pesanan', 'No Pesanan', 'Nomor Pesanan', 'Order SN', 'order_sn', 'Order ID']);
    var colToko = cariIndeksKolom_(headers, ['Toko', 'Nama Toko', 'Store']);
    var targetSn = String(orderSn || '').trim();

    if (colSn !== -1) {
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][colSn]).trim() === targetSn) {
          var t = (colToko !== -1 && values[i][colToko]) ? String(values[i][colToko]).trim().toUpperCase() : '';
          return { toko: t };
        }
      }
    }
  } catch (e) {
    console.warn('[ShippingService] findOrderStoreInfo_ error:', e);
  }
  return { toko: '' };
}

/**
 * Helper untuk mengambil seluruh token Shopee aktif dari Spreadsheet Master (DB_Token)
 * dengan memprioritaskan toko target bila ditentukan.
 */
function getActiveShopeeTokensList_(preferredKodeToko) {
  var tokens = [];
  var target = String(preferredKodeToko || '').trim().toUpperCase();

  // 1. Coba kumpulkan dari getTokenRecords
  try {
    if (typeof SheetManager !== 'undefined' && SheetManager.getTokenRecords) {
      var semua = SheetManager.getTokenRecords();
      for (var i = 0; i < semua.length; i++) {
        if (semua[i].access_token && semua[i].aktif !== 'TIDAK') {
          tokens.push(semua[i]);
        }
      }
    }
  } catch (e1) {}

  // 2. Coba melalui getTokoUntukSync bila masih kosong
  if (tokens.length === 0) {
    try {
      if (typeof SheetManager !== 'undefined' && SheetManager.getTokoUntukSync) {
        var dariSync = SheetManager.getTokoUntukSync();
        for (var s = 0; s < dariSync.length; s++) {
          if (dariSync[s].access_token) tokens.push(dariSync[s]);
        }
      }
    } catch (e2) {}
  }

  // 3. Fallback ke token tunggal
  if (tokens.length === 0) {
    try {
      if (typeof SheetManager !== 'undefined' && SheetManager.getTokenRecord) {
        var rec = SheetManager.getTokenRecord();
        if (rec && rec.access_token) tokens.push(rec);
      }
    } catch (e3) {}
  }

  if (tokens.length === 0) {
    throw new Error('Tidak ditemukan Access Token aktif di sheet DB_Token. Pastikan toko Shopee sudah terhubung di ERP Begood.');
  }

  // Jika ada preferred store, urutkan toko yang cocok di baris paling depan
  if (target && tokens.length > 1) {
    tokens.sort(function(a, b) {
      var kA = String(a.kode_toko || '').toUpperCase();
      var nA = String(a.nama_toko || '').toUpperCase();
      var sA = String(a.shop_id || '');
      var kB = String(b.kode_toko || '').toUpperCase();
      var nB = String(b.nama_toko || '').toUpperCase();
      var sB = String(b.shop_id || '');

      var matchA = (kA === target || nA === target || sA === target);
      var matchB = (kB === target || nB === target || sB === target);

      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;
      return 0;
    });
  }

  return tokens;
}

/**
 * Helper untuk mengambil token Shopee aktif pertama (kompatibilitas mundur)
 */
function getActiveShopeeToken_(kodeToko) {
  var list = getActiveShopeeTokensList_(kodeToko);
  return list[0];
}

/**
 * RPC: Ambil parameter pengiriman (dropoff / pickup options)
 */
function getShippingParameterRpc(orderSn, kodeToko) {
  try {
    var cleanSn = String(orderSn || '').trim();
    if (!cleanSn) throw new Error('Nomor pesanan (order_sn) kosong.');

    var storeInfo = findOrderStoreInfo_(cleanSn);
    var preferredStore = kodeToko || storeInfo.toko;
    var tokens = getActiveShopeeTokensList_(preferredStore);

    var lastErr = null;
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      try {
        var res = ShopeeApi.getShippingParameter({
          order_sn: cleanSn,
          shop_id: tok.shop_id,
          access_token: tok.access_token,
          refresh_token: tok.refresh_token,
          expired_at: tok.expired_at
        });
        return {
          success: true,
          data: res.data || res,
          toko: tok.kode_toko || tok.nama_toko || ''
        };
      } catch (err) {
        lastErr = err;
        var errStr = String(err.message || err);
        if (errStr.indexOf('order_not_exist') !== -1 || errStr.indexOf('not exist') !== -1) {
          continue;
        }
        if (tokens.length === 1) throw err;
      }
    }

    throw (lastErr || new Error('Parameter pengiriman tidak ditemukan di toko mana pun di DB_Token.'));
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

/**
 * RPC: Eksekusi Atur Pengiriman (Dropoff / Pickup)
 */
function processShipOrderRpc(orderSn, method, extraParams, kodeToko) {
  try {
    var cleanSn = String(orderSn || '').trim();
    if (!cleanSn) throw new Error('Nomor pesanan (order_sn) kosong.');

    var storeInfo = findOrderStoreInfo_(cleanSn);
    var preferredStore = kodeToko || storeInfo.toko;
    var tokens = getActiveShopeeTokensList_(preferredStore);

    var winningToken = null;
    var trackingNumber = '';
    var lastError = null;
    var testedNames = [];

    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      var storeLabel = tok.kode_toko || tok.nama_toko || ('Shop ' + tok.shop_id);
      testedNames.push(storeLabel);

      try {
        var payload = {
          order_sn: cleanSn,
          shop_id: tok.shop_id,
          access_token: tok.access_token,
          refresh_token: tok.refresh_token,
          expired_at: tok.expired_at
        };

        if (method === 'pickup') {
          payload.pickup = extraParams || {};
        } else {
          payload.dropoff = extraParams || {};
        }

        var shipRes = ShopeeApi.shipOrder(payload);
        winningToken = tok;
        break; // Berhasil atur pengiriman di toko ini!
      } catch (err) {
        lastError = err;
        var errStr = String(err.message || err);

        // Jika galatnya order_not_exist, periksa toko lain yang terhubung
        if (errStr.indexOf('order_not_exist') !== -1 || errStr.indexOf('not exist') !== -1) {
          console.warn('[ShippingService] Order ' + cleanSn + ' tidak ada di toko ' + storeLabel + '. Menguji toko berikutnya...');
          continue;
        }

        // Cek apakah pesanan sebenarnya SUDAH diproses sebelumnya di Seller Centre
        // (contoh: error order_status_invalid atau sudah punya resi)
        try {
          var checkOrder = ShopeeApi.fetchDailyOrders({
            order_sn_list: [cleanSn],
            shop_id: tok.shop_id,
            access_token: tok.access_token,
            refresh_token: tok.refresh_token
          });
          if (checkOrder && checkOrder.data && checkOrder.data.orders && checkOrder.data.orders.length > 0) {
            var ord = checkOrder.data.orders[0];
            if (ord.tracking_number) {
              winningToken = tok;
              trackingNumber = ord.tracking_number;
              break;
            }
          }
        } catch (eCheck) {}

        // Bila bukan order_not_exist dan toko tunggal, lemparkan galat
        if (tokens.length === 1) {
          throw err;
        }
      }
    }

    if (!winningToken) {
      var msg = lastError ? (lastError.message || String(lastError)) : 'Pesanan tidak ditemukan.';
      if (msg.indexOf('order_not_exist') !== -1 || msg.indexOf('not exist') !== -1) {
        throw new Error('Pesanan ' + cleanSn + ' tidak ditemukan di toko Shopee yang terhubung di DB_Token (' +
          testedNames.join(', ') + '). Pastikan pesanan ini berasal dari akun toko yang sudah diotorisasi dan belum dibatalkan.');
      }
      throw lastError;
    }

    // Ambil nomor resi terbaru setelah diatur jika belum didapatkan
    if (!trackingNumber) {
      try {
        var fetchRes = ShopeeApi.fetchDailyOrders({
          order_sn_list: [cleanSn],
          shop_id: winningToken.shop_id,
          access_token: winningToken.access_token,
          refresh_token: winningToken.refresh_token
        });
        if (fetchRes && fetchRes.data && fetchRes.data.orders && fetchRes.data.orders.length > 0) {
          trackingNumber = fetchRes.data.orders[0].tracking_number || '';
        }
      } catch (eTrack) {
        console.warn('Gagal menarik nomor resi otomatis setelah ship:', eTrack);
      }
    }

    // Perbarui sheet Pesanan Masuk di Spreadsheet Distribusi Baru
    updateOrderInSpreadsheetDistribusi_(cleanSn, trackingNumber, 'PROCESSED', winningToken.kode_toko);

    return {
      success: true,
      order_sn: cleanSn,
      tracking_number: trackingNumber,
      toko: winningToken.kode_toko || winningToken.nama_toko || '',
      message: 'Pesanan ' + cleanSn + ' berhasil diatur pengirimannya (Toko: ' + (winningToken.kode_toko || winningToken.nama_toko || winningToken.shop_id) + ').'
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

/**
 * RPC: Atur Pengiriman Massal (Batch)
 */
function processBatchShipOrdersRpc(orderSnList, method, extraParams, kodeToko) {
  if (!orderSnList || orderSnList.length === 0) {
    return { success: false, message: 'Daftar pesanan kosong.' };
  }

  var successCount = 0;
  var errors = [];
  var updatedSns = [];

  for (var i = 0; i < orderSnList.length; i++) {
    var sn = orderSnList[i];
    var res = processShipOrderRpc(sn, method, extraParams, kodeToko);
    if (res.success) {
      successCount++;
      updatedSns.push(sn);
    } else {
      errors.push(sn + ': ' + res.message);
    }
  }

  return {
    success: true,
    total: orderSnList.length,
    success_count: successCount,
    fail_count: errors.length,
    errors: errors,
    updated_sns: updatedSns
  };
}

/**
 * RPC: Ambil Berkas PDF Dokumen Resi Thermal A6 Resmi Shopee (Base64)
 */
function fetchShippingDocumentPdfRpc(orderSnList, kodeToko) {
  try {
    if (!orderSnList || orderSnList.length === 0) {
      throw new Error('Daftar order_sn tidak boleh kosong.');
    }

    var cleanList = orderSnList.map(function(s) { return String(s || '').trim(); }).filter(Boolean);
    if (cleanList.length === 0) throw new Error('Daftar order_sn valid kosong.');

    // Cari toko dari order pertama atau parameter
    var firstStore = kodeToko || (cleanList.length > 0 ? findOrderStoreInfo_(cleanList[0]).toko : '');
    var tokens = getActiveShopeeTokensList_(firstStore);

    var lastErr = null;
    var testedStores = [];
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      var storeLabel = tok.kode_toko || tok.nama_toko || ('Shop ' + tok.shop_id);
      testedStores.push(storeLabel);
      try {
        var res = ShopeeApi.getShippingDocument({
          order_sn_list: cleanList,
          document_type: 'THERMAL_AIR_WAYBILL',
          shop_id: tok.shop_id,
          access_token: tok.access_token,
          refresh_token: tok.refresh_token,
          expired_at: tok.expired_at
        });

        if (res && res.data && res.data.pdf_base64) {
          return {
            success: true,
            pdf_base64: res.data.pdf_base64,
            order_count: res.data.order_count || cleanList.length,
            toko: storeLabel
          };
        }
      } catch (err) {
        lastErr = err;
        var errStr = String(err.message || err);
        if (errStr.indexOf('order_not_exist') !== -1 || errStr.indexOf('not exist') !== -1) {
          continue;
        }
        if (tokens.length === 1) throw err;
      }
    }

    if (lastErr) {
      var lastErrStr = String(lastErr.message || lastErr);
      if (lastErrStr.indexOf('order_not_exist') !== -1 || lastErrStr.indexOf('not exist') !== -1) {
        throw new Error('Dokumen PDF resmi tidak ditemukan di server Shopee untuk pesanan ' + cleanList.join(', ') +
          '. Kemungkinan pesanan belum diatur pengirimannya (Dropoff/Pickup), resi kurir belum terbit, atau akun toko di DB_Token (' +
          testedStores.join(', ') + ') berbeda dengan toko asal pesanan ini. Silakan gunakan tombol "Cetak Sekarang (A6 Thermal)" untuk mencetak label workshop ERP Begood.');
      }
    }

    throw (lastErr || new Error('Gagal mengunduh dokumen resi dari toko Shopee.'));
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

/**
 * RPC: Tandai pesanan sudah dicetak resinya
 */
function markOrdersAsPrintedRpc(orderSnList) {
  if (!orderSnList || orderSnList.length === 0) return { success: true };

  var props = PropertiesService.getScriptProperties();
  var printedRaw = props.getProperty('PRINTED_RESI_SNS') || '[]';
  var printedList = [];
  try {
    printedList = JSON.parse(printedRaw);
  } catch (e) {}

  var set = {};
  for (var i = 0; i < printedList.length; i++) set[printedList[i]] = true;
  for (var j = 0; j < orderSnList.length; j++) set[orderSnList[j]] = true;

  var updatedList = Object.keys(set);
  if (updatedList.length > 500) {
    updatedList = updatedList.slice(updatedList.length - 500);
  }

  props.setProperty('PRINTED_RESI_SNS', JSON.stringify(updatedList));
  return { success: true, count: orderSnList.length };
}

/**
 * RPC: Cek dan tarik nomor resi terbaru langsung dari Shopee untuk satu pesanan spesifik
 * Sangat berguna ketika pesanan sudah diatur pengirimannya di Shopee Seller Centre,
 * atau ketika nomor resi baru saja terbit oleh pihak kurir.
 */
/**
 * RPC: Cek dan tarik nomor resi terbaru langsung dari Shopee untuk satu pesanan spesifik (Super Cepat)
 */
function fetchSingleOrderTrackingNumberRpc(orderSn, kodeToko) {
  try {
    var cleanSn = String(orderSn || '').trim();
    if (!cleanSn) throw new Error('Nomor pesanan kosong.');

    var res = fetchBatchTrackingNumbersRpc([cleanSn], kodeToko);
    if (!res.success) throw new Error(res.message);

    var info = (res.tracking_map && res.tracking_map[cleanSn]) ? res.tracking_map[cleanSn] : null;
    if (info && info.tracking_number) {
      return {
        success: true,
        tracking_number: info.tracking_number,
        shopee_status: info.order_status || 'PROCESSED',
        courier: info.shipping_carrier || '',
        message: 'Berhasil menarik No. Resi: ' + info.tracking_number
      };
    } else if (info) {
      return {
        success: false,
        has_order: true,
        shopee_status: info.order_status,
        message: 'Pesanan ditemukan di Shopee dengan status "' + info.order_status + '", namun pihak kurir belum menerbitkan No. Resi. Silakan pastikan pengiriman sudah selesai dikonfirmasi di Seller Centre (Dropoff/Pickup).'
      };
    } else {
      throw new Error('Pesanan tidak ditemukan di akun toko Shopee.');
    }
  } catch (err) {
    return {
      success: false,
      message: err.message || String(err)
    };
  }
}

/**
 * RPC: Cek dan tarik nomor resi massal (hingga 50 pesanan) dalam satu panggilan super cepat
 */
function fetchBatchTrackingNumbersRpc(orderSnList, kodeToko) {
  try {
    if (!orderSnList || orderSnList.length === 0) {
      return { success: false, message: 'Daftar nomor pesanan kosong.' };
    }

    var cleanList = orderSnList.map(function(s) { return String(s || '').trim(); }).filter(Boolean);
    if (cleanList.length === 0) throw new Error('Daftar order_sn valid kosong.');

    var firstStore = kodeToko || (cleanList.length > 0 ? findOrderStoreInfo_(cleanList[0]).toko : '');
    var tokens = getActiveShopeeTokensList_(firstStore);

    var updatedCount = 0;
    var allMap = {};
    var lastErr = null;

    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      try {
        var res = ShopeeApi.fetchTrackingNumbers({
          order_sn_list: cleanList,
          shop_id: tok.shop_id,
          access_token: tok.access_token,
          refresh_token: tok.refresh_token,
          expired_at: tok.expired_at
        });

        if (res && res.success && res.data) {
          var dataMap = res.data;
          var ss = getSpreadsheetPengiriman_();
          if (ss) {
            var sheet = ss.getSheetByName('Pesanan Masuk');
            if (sheet && sheet.getLastRow() >= 2) {
              var lastRow = sheet.getLastRow();
              var lastCol = sheet.getLastColumn();
              var range = sheet.getRange(1, 1, lastRow, lastCol);
              var values = range.getValues();
              var headers = values[0];
              var colSn = cariIndeksKolom_(headers, ['No. Pesanan', 'No Pesanan', 'Nomor Pesanan', 'Order SN', 'order_sn', 'Order ID']);
              var colResi = cariIndeksKolom_(headers, ['No. Resi', 'No Resi', 'Nomor Resi', 'Resi', 'Tracking Number']);
              var colStatus = cariIndeksKolom_(headers, ['Status Shopee', 'Status Order', 'Shopee Status']);
              var colInternal = cariIndeksKolom_(headers, ['Status Internal Begood', 'Status Internal', 'Status']);
              var colSync = cariIndeksKolom_(headers, ['Waktu Sinkronisasi', 'Sync Time', 'Waktu']);
              var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
              var hasChanges = false;

              for (var r = 1; r < values.length; r++) {
                var rowSn = String(values[r][colSn] || '').trim();
                if (dataMap[rowSn]) {
                  var itemInfo = dataMap[rowSn];
                  allMap[rowSn] = itemInfo;
                  if (itemInfo.tracking_number && colResi !== -1) {
                    values[r][colResi] = itemInfo.tracking_number;
                    hasChanges = true;
                    updatedCount++;
                  }
                  if (itemInfo.order_status && colStatus !== -1) {
                    values[r][colStatus] = itemInfo.order_status;
                    hasChanges = true;
                  }
                  if (itemInfo.tracking_number && colInternal !== -1 && values[r][colInternal] === '[1] Siap Packing') {
                    values[r][colInternal] = '[2] Menunggu Diambil Kurir';
                    hasChanges = true;
                  }
                  if (colSync !== -1) values[r][colSync] = nowWIB;
                }
              }

              if (hasChanges) {
                range.setValues(values);
              }
            }
          }
          break; // Berhasil
        }
      } catch (err) {
        lastErr = err;
        var errStr = String(err.message || err);
        if (errStr.indexOf('order_not_exist') !== -1 || errStr.indexOf('not exist') !== -1) {
          continue;
        }
        if (tokens.length === 1) throw err;
      }
    }

    return {
      success: true,
      updated_count: updatedCount,
      total_requested: cleanList.length,
      tracking_map: allMap,
      message: 'Berhasil menyinkronkan ' + updatedCount + ' nomor resi dari Shopee.'
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || String(err)
    };
  }
}
