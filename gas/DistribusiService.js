/**
 * ============================================================================
 * ERP BEGOOD — DISTRIBUSI SERVICE (JAHIT & PACKING KE SPREADSHEET BARU)
 * ============================================================================
 * Modul operasional untuk membagikan pesanan "siap kirim" (belum diatur
 * pengiriman) ke para penjahit (satuan pcs & upah) dan meja packing (satuan
 * paket/resi).
 *
 * Penyimpanan data operasional:
 * - Spreadsheet Baru: 1DxvKSTHjXH8jWOg5-AVpmhgJ-ELKhfpfSMtnn0Xemgc
 *   • Sheet "Pesanan Masuk"  (Antrian siap kirim)
 *   • Sheet "PEMBAGIAN JAHIT" (Penugasan jahit)
 *   • Sheet "PEMBAGIAN PACKING" (Penugasan meja packing)
 *
 * Hubungan ke Spreadsheet Master ERP:
 * - Membaca "SETTING PENJAHIT" & "SETTING PACKING" dari Master
 * - Membaca "DATA PROSES" (daftar tarif jahit per SKU) dari Master
 * ============================================================================
 */

var ID_SPREADSHEET_DISTRIBUSI_BARU = '1DxvKSTHjXH8jWOg5-AVpmhgJ-ELKhfpfSMtnn0Xemgc';

var HEADERS_DISTRIBUSI_PESANAN = [
  'No. Pesanan',              // 1 (A)
  'Tanggal Pesanan (WIB)',    // 2 (B)
  'Status Shopee',            // 3 (C)
  'Status Internal Begood',   // 4 (D)
  'Toko',                     // 5 (E)
  'Nama Pembeli',             // 6 (F)
  'Ringkasan Produk',         // 7 (G)
  'Nomor Referensi SKU',      // 8 (H)
  'Nama Variasi',             // 9 (I)
  'Total Qty',                // 10 (J)
  'Ekspedisi / Kurir',        // 11 (K)
  'No. Resi',                 // 12 (L)
  'Kota Tujuan',              // 13 (M)
  'Catatan Pembeli',          // 14 (N)
  'Waktu Sinkronisasi'        // 15 (O)
];

var HEADERS_DISTRIBUSI_KERJA = [
  'Tanggal',                  // 1 (A) YYYY-MM-DD
  'Sesi',                     // 2 (B) PAGI atau SIANG
  'Toko',                     // 3 (C)
  'No. Pesanan',              // 4 (D)
  'Kurir',                    // 5 (E)
  'Kota Tujuan',              // 6 (F)
  'SKU',                      // 7 (G)
  'Variasi',                  // 8 (H)
  'Qty (Pcs)',                // 9 (I)
  'Penjahit',                 // 10 (J)
  'Grup Kerja',               // 11 (K) - Kolom tersembunyi
  'Upah Satuan (Rp)',         // 12 (L)
  'Total Upah (Rp)',          // 13 (M)
  'Petugas Packing',          // 14 (N)
  'Status Jahit',             // 15 (O)
  'Status Packing',           // 16 (P)
  'Waktu Pembagian'           // 17 (Q)
];

var HEADERS_DISTRIBUSI_JAHIT = [
  'Tanggal',                  // 1 (A) YYYY-MM-DD
  'Sesi',                     // 2 (B) PAGI atau SIANG
  'Toko',                     // 3 (C)
  'No. Pesanan',              // 4 (D)
  'SKU',                      // 5 (E)
  'Variasi',                  // 6 (F)
  'Qty (Pcs)',                // 7 (G)
  'Penjahit',                 // 8 (H)
  'Grup Kerja',               // 9 (I)
  'Upah Satuan (Rp)',         // 10 (J)
  'Total Upah (Rp)',          // 11 (K)
  'Status',                   // 12 (L) ANTRI, PROSES, SELESAI
  'Waktu Pembagian'           // 13 (M)
];

var HEADERS_DISTRIBUSI_PACKING = [
  'Tanggal',                  // 1 (A)
  'Sesi',                     // 2 (B) PAGI atau SIANG
  'Toko',                     // 3 (C)
  'No. Pesanan',              // 4 (D)
  'Kurir',                    // 5 (E)
  'Total Pcs',                // 6 (F)
  'Ringkasan Barang',         // 7 (G)
  'Petugas Packing',          // 8 (H)
  'Status',                   // 9 (I) MENUNGGU, SELESAI
  'Waktu Pembagian'           // 10 (J)
];

/**
 * Memangkas teks sesudah koma pada nama variasi produk.
 * Contoh: "Blue Sky,100x200x30" -> "Blue Sky".
 * Keterangan ukuran sesudah koma dibuang, warna/motif dipertahankan.
 */
function bersihkanVariasiDistribusi_(nilai) {
  if (typeof SheetManager !== 'undefined' && SheetManager.bersihkanVariasi) {
    return SheetManager.bersihkanVariasi(nilai);
  }
  var teks = String(nilai === null || nilai === undefined ? '' : nilai).trim();
  var pisah = teks.indexOf(',');
  if (pisah >= 0) {
    var depan = teks.slice(0, pisah).trim();
    var belakang = teks.slice(pisah + 1).trim();
    var komaKedua = belakang.indexOf(',');
    if (komaKedua >= 0) belakang = belakang.slice(0, komaKedua).trim();
    var adalahUkuran = /^(?:(?:bc|bedcover|sprei|sarkur|sarban|sargul|uk|ukuran|size|tinggi|kasur)\s*)?\d+\s*[xX×\/]\s*\d+(?:\s*[xX×\/]\s*\d+)?(?:\s*cm)?$/i;
    if (adalahUkuran.test(depan) && belakang && !adalahUkuran.test(belakang)) {
      return belakang;
    }
    return depan;
  }
  return teks;
}

/**
 * Membuka spreadsheet baru untuk operasional distribusi
 */
function getSpreadsheetDistribusiBaru_() {
  return SpreadsheetApp.openById(ID_SPREADSHEET_DISTRIBUSI_BARU);
}

/**
 * Menyiapkan sheet dan header di spreadsheet baru bila belum ada
 */
function pastikanStrukturSpreadsheetDistribusiBaru_() {
  var ss = getSpreadsheetDistribusiBaru_();
  var sheets = {
    pesanan: { nama: 'Pesanan Masuk', headers: HEADERS_DISTRIBUSI_PESANAN },
    kerja: { nama: 'PEMBAGIAN KERJA', headers: HEADERS_DISTRIBUSI_KERJA }
  };

  for (var k in sheets) {
    var def = sheets[k];
    var s = ss.getSheetByName(def.nama);
    if (!s) {
      s = ss.insertSheet(def.nama);
    }
    if (s.getLastRow() < 1) {
      s.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      s.getRange(1, 1, 1, def.headers.length)
        .setBackground('#1e293b')
        .setFontColor('#f8fafc')
        .setFontWeight('bold');
      s.setFrozenRows(1);
    }
  }

  // Sembunyikan kolom Grup Kerja (Kolom 11 / K) pada sheet PEMBAGIAN KERJA
  var sKerja = ss.getSheetByName('PEMBAGIAN KERJA');
  if (sKerja) {
    try {
      sKerja.hideColumns(11);
    } catch (eHide) {}
  }
}

/**
 * RPC: Mengambil data pesanan siap kirim (belum diatur pengiriman / resi kosong)
 * LANGSUNG dari Vercel Serverless Middleware (Shopee Open API), bukan dari sheet Pesanan Masuk lama,
 * lalu menyimpannya ke Sheet "Pesanan Masuk" di Spreadsheet Baru.
 */
function ambilPesananSiapKirimKeSpreadsheetBaru(token, filterToko) {
  pastikanStrukturSpreadsheetDistribusiBaru_();

  // 1. Ambil daftar toko aktif dari DB_Token di Spreadsheet Master
  var targetTokoClean = String(filterToko || '').trim().toUpperCase();
  var daftarToko = [];
  try {
    daftarToko = SheetManager.getTokoUntukSync(targetTokoClean && targetTokoClean !== 'SEMUA' ? targetTokoClean : undefined);
  } catch (errToko) {
    daftarToko = SheetManager.getTokenRecords ? SheetManager.getTokenRecords() : [];
  }

  if (!daftarToko || daftarToko.length === 0) {
    throw new Error('Tidak ada toko aktif di DB_Token Spreadsheet Master untuk menarik data dari Vercel.');
  }

  // Waktu penarikan: 15 hari ke belakang (mencakup seluruh antrian ready to ship yang aktif)
  var nowSec = Math.floor(Date.now() / 1000);
  var timeFrom = nowSec - (15 * 86400);
  var timeTo = nowSec;
  var sekarangWib = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');

  var barisSiapKirim = [];
  var orderSnSet = {};
  var pesanGalatToko = [];

  for (var t = 0; t < daftarToko.length; t++) {
    var tok = daftarToko[t];
    var kodeToko = String(tok.kode_toko || tok.shop_id || '').toUpperCase();

    if (targetTokoClean && targetTokoClean !== 'SEMUA' && kodeToko !== targetTokoClean) {
      continue;
    }

    try {
      // Panggil Vercel Middleware secara langsung dengan filter status READY_TO_SHIP
      var payload = {
        time_from: timeFrom,
        time_to: timeTo,
        order_status: 'READY_TO_SHIP',
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
        expired_at: tok.expired_at,
        shop_id: tok.shop_id
      };

      var apiRes = ShopeeApi.fetchDailyOrders(payload);
      if (!apiRes || !apiRes.data) {
        throw new Error(apiRes.message || 'Respons Vercel tidak memuat data.');
      }

      // Simpan pembaruan token bila Vercel melakukan auto-refresh
      if (apiRes.data.new_token && SheetManager.saveTokenRecord) {
        var nTok = apiRes.data.new_token;
        SheetManager.saveTokenRecord({
          shop_id: nTok.shop_id || tok.shop_id,
          access_token: nTok.access_token,
          refresh_token: nTok.refresh_token,
          expire_in: nTok.expire_in
        });
      }

      var orders = apiRes.data.orders || [];
      for (var o = 0; o < orders.length; o++) {
        var ord = orders[o];
        var orderSn = String(ord.order_sn || '').trim();
        if (!orderSn) continue;

        var statusShopee = String(ord.order_status || '').toUpperCase();
        var isReady = (statusShopee === 'READY_TO_SHIP' || statusShopee === 'PROCESSED');
        var resi = String(ord.tracking_number || '').trim();
        var belumAturPengiriman = (!resi || resi === '-' || resi === 'BELUM ADA RESI');

        if (isReady && belumAturPengiriman) {
          var items = (ord.items && ord.items.length > 0) ? ord.items : null;
          if (items) {
            for (var it = 0; it < items.length; it++) {
              var itm = items[it];
              barisSiapKirim.push([
                orderSn,
                ord.create_time_formatted || sekarangWib,
                statusShopee,
                ord.internal_status || '[1] Siap Packing',
                kodeToko,
                ord.buyer_username || '',
                itm.item_name || ord.items_summary || '',
                itm.model_sku || '',
                bersihkanVariasiDistribusi_(itm.model_name),
                Number(itm.model_quantity_purchased) || 1,
                ord.shipping_carrier || '',
                '', // No. Resi kosong
                ord.recipient_city || '',
                ord.note || '',
                sekarangWib
              ]);
            }
          } else {
            barisSiapKirim.push([
              orderSn,
              ord.create_time_formatted || sekarangWib,
              statusShopee,
              ord.internal_status || '[1] Siap Packing',
              kodeToko,
              ord.buyer_username || '',
              ord.items_summary || '',
              ord.sku_summary || '',
              bersihkanVariasiDistribusi_(ord.variation_summary),
              Number(ord.total_items_count) || 1,
              ord.shipping_carrier || '',
              '', // No. Resi kosong
              ord.recipient_city || '',
              ord.note || '',
              sekarangWib
            ]);
          }
          orderSnSet[orderSn] = true;
        }
      }
    } catch (errApi) {
      pesanGalatToko.push('Toko ' + kodeToko + ': ' + (errApi.message || errApi));
    }
  }

  // 2. Tulis ke Spreadsheet Baru (Sheet "Pesanan Masuk")
  var newSs = getSpreadsheetDistribusiBaru_();
  var newSheet = newSs.getSheetByName('Pesanan Masuk');

  var newLastRow = newSheet.getLastRow();
  if (newLastRow > 1) {
    newSheet.getRange(2, 1, newLastRow - 1, HEADERS_DISTRIBUSI_PESANAN.length).clearContent();
  }

  if (barisSiapKirim.length > 0) {
    newSheet.getRange(2, 1, barisSiapKirim.length, HEADERS_DISTRIBUSI_PESANAN.length).setValues(barisSiapKirim);
  }

  var msg = 'Berhasil menarik langsung dari Vercel: ' + Object.keys(orderSnSet).length + ' pesanan (' + barisSiapKirim.length + ' baris produk) siap kirim ke Spreadsheet Baru.';
  if (pesanGalatToko.length > 0) {
    msg += ' (Catatan galat: ' + pesanGalatToko.join('; ') + ')';
  }

  return {
    success: true,
    countOrders: Object.keys(orderSnSet).length,
    countRows: barisSiapKirim.length,
    message: msg
  };
}

/**
 * Membaca master data penjahit, petugas packing, aturan SKU, kode toko, dan tarif dari Master Spreadsheet Begood ERP.
 *
 * @param {Spreadsheet} masterSs Instance Spreadsheet Master Begood ERP
 * @return {Object} Objek berisi daftar penjahit, packing, aturan, kode toko, dan tarif
 */
function bacaMasterSetelanDistribusi_(masterSs) {
  if (!masterSs) {
    masterSs = SpreadsheetApp.getActiveSpreadsheet();
  }

  // 1. Baca Master Penjahit dari Master Spreadsheet
  var daftarPenjahit = [];
  var sheetPenjahit = masterSs.getSheetByName('SETTING PENJAHIT');
  if (sheetPenjahit && sheetPenjahit.getLastRow() > 1) {
    var pVals = sheetPenjahit.getRange(2, 1, sheetPenjahit.getLastRow() - 1, 5).getValues();
    for (var p = 0; p < pVals.length; p++) {
      var namaP = String(pVals[p][0] || '').trim().toUpperCase();
      if (!namaP) continue;
      daftarPenjahit.push({
        nama: namaP,
        grup: String(pVals[p][1] || 'SEMUA').trim().toUpperCase(),
        aktif: String(pVals[p][2] || 'YA').trim().toUpperCase(),
        bobot: Number(pVals[p][3]) || 1.0,
        catatan: String(pVals[p][4] || '')
      });
    }
  } else {
    daftarPenjahit = [
      { nama: 'SITI', grup: 'MUKENA', aktif: 'YA', bobot: 1.2 },
      { nama: 'AMINAH', grup: 'MUKENA', aktif: 'YA', bobot: 1.0 },
      { nama: 'RAHMAT', grup: 'GAMIS', aktif: 'YA', bobot: 1.0 },
      { nama: 'DEDI', grup: 'ATASAN', aktif: 'YA', bobot: 1.0 },
      { nama: 'UJANG', grup: 'CELANA', aktif: 'YA', bobot: 0.8 },
      { nama: 'HENDRA', grup: 'SEMUA', aktif: 'YA', bobot: 1.0 }
    ];
  }

  // 2. Baca Master Packing dari Master Spreadsheet
  var daftarPacking = [];
  var sheetPacking = masterSs.getSheetByName('SETTING PACKING') || masterSs.getSheetByName('PETUGAS PACKING');
  if (sheetPacking && sheetPacking.getLastRow() > 1) {
    var pkVals = sheetPacking.getRange(2, 1, sheetPacking.getLastRow() - 1, 4).getValues();
    for (var pk = 0; pk < pkVals.length; pk++) {
      var namaPk = String(pkVals[pk][0] || '').trim().toUpperCase();
      if (!namaPk) continue;
      daftarPacking.push({
        nama: namaPk,
        aktif: String(pkVals[pk][1] || 'YA').trim().toUpperCase(),
        bobot: Number(pkVals[pk][2]) || 1.0,
        catatan: String(pkVals[pk][3] || '')
      });
    }
  } else {
    daftarPacking = [
      { nama: 'BUDI', aktif: 'YA', bobot: 1.0 },
      { nama: 'AGUS', aktif: 'YA', bobot: 1.0 },
      { nama: 'FAJAR', aktif: 'YA', bobot: 1.0 },
      { nama: 'RIAN', aktif: 'YA', bobot: 1.0 }
    ];
  }

  // 3. Baca Tarif dari DATA PROSES di Master Spreadsheet
  var tarifMap = {};
  var sheetProses = masterSs.getSheetByName('DATA PROSES');
  if (sheetProses && sheetProses.getLastRow() > 1) {
    var prVals = sheetProses.getRange(2, 1, sheetProses.getLastRow() - 1, 4).getValues();
    for (var pr = 0; pr < prVals.length; pr++) {
      var skuPr = String(prVals[pr][0] || '').trim().toUpperCase();
      if (!skuPr) continue;
      tarifMap[skuPr] = {
        upah: Number(prVals[pr][1]) || 4000,
        grup: String(prVals[pr][3] || 'SEMUA').trim().toUpperCase()
      };
    }
  }

  // 4. Baca Aturan SKU dari Master Spreadsheet
  var daftarAturan = [];
  try {
    daftarAturan = SheetManager.bacaAturanSku() || [];
  } catch (eAturan) {
    var sheetAturan = masterSs.getSheetByName('SKU RULES');
    if (sheetAturan && sheetAturan.getLastRow() > 1) {
      var aVals = sheetAturan.getRange(2, 1, sheetAturan.getLastRow() - 1, 3).getValues();
      for (var a = 0; a < aVals.length; a++) {
        var polaA = String(aVals[a][0] || '').trim().toUpperCase();
        if (!polaA) continue;
        daftarAturan.push({
          pola: polaA,
          grup: String(aVals[a][1] || '').trim().toUpperCase(),
          catatan: String(aVals[a][2] || '')
        });
      }
    }
  }

  // 5. Baca Kode Toko Cetak dari Master Spreadsheet
  var daftarTokoCetak = {};
  try {
    daftarTokoCetak = SheetManager.bacaKodeTokoCetak ? SheetManager.bacaKodeTokoCetak() : {};
  } catch (eToko) {
    daftarTokoCetak = {};
  }

  // 6. Baca Variasi Warna dari Master Spreadsheet
  var daftarVariasiWarna = [];
  try {
    daftarVariasiWarna = (SheetManager.bacaVariasiWarna ? SheetManager.bacaVariasiWarna() : []) || [];
  } catch (eWarna) {
    daftarVariasiWarna = [];
  }

  return {
    penjahit: daftarPenjahit,
    packing: daftarPacking,
    aturan: daftarAturan,
    kodeToko: daftarTokoCetak,
    tarif: tarifMap,
    variasiWarna: daftarVariasiWarna
  };
}

/**
 * RPC: Membaca antrian pesanan siap kirim dari Spreadsheet Baru,
 * serta membaca Master Staf (Penjahit & Packing) dan Tarif dari Spreadsheet Master.
 */
function bacaAntrianDistribusi(token, filterToko) {
  pastikanStrukturSpreadsheetDistribusiBaru_();

  var newSs = getSpreadsheetDistribusiBaru_();
  var masterSs = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Baca Pesanan Masuk dari Spreadsheet Baru
  var sheetPesananBaru = newSs.getSheetByName('Pesanan Masuk');
  var lastRow = sheetPesananBaru.getLastRow();
  var daftarPesanan = [];

  if (lastRow > 1) {
    var rawValues = sheetPesananBaru.getRange(2, 1, lastRow - 1, HEADERS_DISTRIBUSI_PESANAN.length).getValues();
    for (var i = 0; i < rawValues.length; i++) {
      var r = rawValues[i];
      var orderSn = String(r[0] || '').trim();
      if (!orderSn) continue;

      daftarPesanan.push({
        orderSn: orderSn,
        date: String(r[1] || ''),
        statusShopee: String(r[2] || ''),
        statusInternal: String(r[3] || ''),
        toko: String(r[4] || ''),
        buyer: String(r[5] || ''),
        ringkasan: String(r[6] || ''),
        sku: String(r[7] || ''),
        var: bersihkanVariasiDistribusi_(r[8]),
        qty: Number(r[9]) || 1,
        courier: String(r[10] || ''),
        resi: String(r[11] || ''),
        city: String(r[12] || ''),
        note: String(r[13] || '')
      });
    }
  }

  // 2. Baca Seluruh Master Setelan dari Spreadsheet Master Begood ERP
  var masterSetelan = bacaMasterSetelanDistribusi_(masterSs);
  var daftarPenjahit = masterSetelan.penjahit;
  var daftarPacking = masterSetelan.packing;
  var tarifMap = masterSetelan.tarif;
  var daftarAturan = masterSetelan.aturan;
  var daftarTokoCetak = masterSetelan.kodeToko;
  var daftarVariasiWarna = masterSetelan.variasiWarna || [];

  // 3. Baca Riwayat Pembagian yang sudah tersimpan hari ini di Spreadsheet Baru
  var sheetKerja = newSs.getSheetByName('PEMBAGIAN KERJA');
  var riwayatJahit = [];
  var riwayatPacking = [];

  if (sheetKerja && sheetKerja.getLastRow() > 1) {
    var kVals = sheetKerja.getRange(2, 1, sheetKerja.getLastRow() - 1, HEADERS_DISTRIBUSI_KERJA.length).getValues();
    var seenPackingOrder = {};
    for (var k = 0; k < kVals.length; k++) {
      var row = kVals[k];
      var orderSn = String(row[3] || '');
      var sku = String(row[6] || '');
      var variasi = bersihkanVariasiDistribusi_(row[7]);
      var qty = Number(row[8]) || 1;
      var penjahit = String(row[9] || '');
      var grup = String(row[10] || '');
      var upahSatuan = Number(row[11]) || 0;
      var totalUpah = Number(row[12]) || 0;
      var petugasPk = String(row[13] || '');
      var statusJt = String(row[14] || 'ANTRI');
      var statusPk = String(row[15] || 'MENUNGGU');

      riwayatJahit.push({
        tanggal: String(row[0] || ''),
        sesi: String(row[1] || ''),
        toko: String(row[2] || ''),
        orderSn: orderSn,
        courier: String(row[4] || ''),
        city: String(row[5] || ''),
        sku: sku,
        var: variasi,
        qty: qty,
        penjahit: penjahit,
        grup: grup,
        upahSatuan: upahSatuan,
        totalUpah: totalUpah,
        petugas: petugasPk,
        status: statusJt
      });

      if (!seenPackingOrder[orderSn]) {
        seenPackingOrder[orderSn] = {
          tanggal: String(row[0] || ''),
          sesi: String(row[1] || ''),
          toko: String(row[2] || ''),
          orderSn: orderSn,
          courier: String(row[4] || ''),
          city: String(row[5] || ''),
          totalPcs: 0,
          ringkasan: [],
          petugas: petugasPk,
          status: statusPk
        };
        riwayatPacking.push(seenPackingOrder[orderSn]);
      }
      seenPackingOrder[orderSn].totalPcs += qty;
      seenPackingOrder[orderSn].ringkasan.push(sku + ' (' + variasi + ') x' + qty);
    }

    for (var rp = 0; rp < riwayatPacking.length; rp++) {
      if (Array.isArray(riwayatPacking[rp].ringkasan)) {
        riwayatPacking[rp].ringkasan = riwayatPacking[rp].ringkasan.join('; ');
      }
    }
  } else {
    var sheetBagiJahit = newSs.getSheetByName('PEMBAGIAN JAHIT');
    if (sheetBagiJahit && sheetBagiJahit.getLastRow() > 1) {
      var bjVals = sheetBagiJahit.getRange(2, 1, sheetBagiJahit.getLastRow() - 1, HEADERS_DISTRIBUSI_JAHIT.length).getValues();
      for (var bj = 0; bj < bjVals.length; bj++) {
        riwayatJahit.push({
          tanggal: String(bjVals[bj][0] || ''),
          sesi: String(bjVals[bj][1] || ''),
          toko: String(bjVals[bj][2] || ''),
          orderSn: String(bjVals[bj][3] || ''),
          sku: String(bjVals[bj][4] || ''),
          var: bersihkanVariasiDistribusi_(bjVals[bj][5]),
          qty: Number(bjVals[bj][6]) || 1,
          penjahit: String(bjVals[bj][7] || ''),
          grup: String(bjVals[bj][8] || ''),
          upahSatuan: Number(bjVals[bj][9]) || 0,
          totalUpah: Number(bjVals[bj][10]) || 0,
          status: String(bjVals[bj][11] || 'ANTRI')
        });
      }
    }

    var sheetBagiPacking = newSs.getSheetByName('PEMBAGIAN PACKING');
    if (sheetBagiPacking && sheetBagiPacking.getLastRow() > 1) {
      var bpVals = sheetBagiPacking.getRange(2, 1, sheetBagiPacking.getLastRow() - 1, HEADERS_DISTRIBUSI_PACKING.length).getValues();
      for (var bp = 0; bp < bpVals.length; bp++) {
        riwayatPacking.push({
          tanggal: String(bpVals[bp][0] || ''),
          sesi: String(bpVals[bp][1] || ''),
          toko: String(bpVals[bp][2] || ''),
          orderSn: String(bpVals[bp][3] || ''),
          courier: String(bpVals[bp][4] || ''),
          totalPcs: Number(bpVals[bp][5]) || 1,
          ringkasan: String(bpVals[bp][6] || ''),
          petugas: String(bpVals[bp][7] || ''),
          status: String(bpVals[bp][8] || 'MENUNGGU')
        });
      }
    }
  }

  return {
    success: true,
    pesanan: daftarPesanan,
    penjahit: daftarPenjahit,
    packing: daftarPacking,
    aturan: daftarAturan,
    kodeToko: daftarTokoCetak,
    tarif: tarifMap,
    variasiWarna: daftarVariasiWarna,
    riwayatJahit: riwayatJahit,
    riwayatPacking: riwayatPacking
  };
}

/**
 * RPC: Menyimpan hasil pembagian jahit dan packing ke Spreadsheet Baru
 */
function simpanHasilDistribusi(token, payload) {
  if (!payload) throw new Error('Data pembagian tidak boleh kosong.');
  pastikanStrukturSpreadsheetDistribusiBaru_();

  var ss = getSpreadsheetDistribusiBaru_();
  var sekarangWib = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  var tanggal = payload.tanggal || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  var sesi = String(payload.sesi || 'PAGI').toUpperCase();

  // Peta alokasi packing per No. Pesanan
  var petaPacking = {};
  if (payload.packing && Array.isArray(payload.packing)) {
    for (var p = 0; p < payload.packing.length; p++) {
      var itemP = payload.packing[p];
      if (itemP && itemP.orderSn) {
        petaPacking[itemP.orderSn] = {
          petugas: String(itemP.petugas || '').toUpperCase(),
          courier: String(itemP.courier || ''),
          city: String(itemP.city || ''),
          status: String(itemP.status || 'MENUNGGU')
        };
      }
    }
  }

  // Peta info pesanan (kurir & kota) dari sheet Pesanan Masuk sebagai pelengkap
  var petaPesanan = {};
  var sheetPesanan = ss.getSheetByName('Pesanan Masuk');
  if (sheetPesanan && sheetPesanan.getLastRow() > 1) {
    var pVals = sheetPesanan.getRange(2, 1, sheetPesanan.getLastRow() - 1, HEADERS_DISTRIBUSI_PESANAN.length).getValues();
    for (var ps = 0; ps < pVals.length; ps++) {
      var sn = String(pVals[ps][3] || '').trim();
      if (sn && !petaPesanan[sn]) {
        petaPesanan[sn] = {
          courier: String(pVals[ps][10] || ''),
          city: String(pVals[ps][12] || '')
        };
      }
    }
  }

  // Tulis ke sheet tunggal PEMBAGIAN KERJA (Opsi A)
  var sheetKerja = ss.getSheetByName('PEMBAGIAN KERJA');
  var rowsKerja = [];
  var countBaris = 0;

  if (payload.jahit && payload.jahit.length > 0) {
    for (var j = 0; j < payload.jahit.length; j++) {
      var itm = payload.jahit[j];
      var sn = String(itm.orderSn || '');
      var packInfo = petaPacking[sn] || {};
      var ordInfo = petaPesanan[sn] || {};

      var kurir = packInfo.courier || itm.courier || ordInfo.courier || '';
      var kota = packInfo.city || itm.city || ordInfo.city || '';
      var petugasPk = packInfo.petugas || itm.petugas || '-';
      var statusPk = packInfo.status || 'MENUNGGU';
      var penjahitNama = itm.isIgnore ? '-' : String(itm.penjahit || '').toUpperCase();
      var statusJt = itm.isIgnore ? 'NON-JAHIT' : String(itm.status || 'ANTRI');

      rowsKerja.push([
        tanggal,                                                    // 1 (A) Tanggal
        sesi,                                                       // 2 (B) Sesi
        String(itm.toko || ''),                                     // 3 (C) Toko
        sn,                                                         // 4 (D) No. Pesanan
        kurir,                                                      // 5 (E) Kurir
        kota,                                                       // 6 (F) Kota Tujuan
        String(itm.sku || ''),                                      // 7 (G) SKU
        bersihkanVariasiDistribusi_(itm.var),                       // 8 (H) Variasi
        Number(itm.qty) || 1,                                       // 9 (I) Qty
        penjahitNama,                                               // 10 (J) Penjahit
        String(itm.grup || ''),                                     // 11 (K) Grup Kerja (Hidden)
        Number(itm.tarifSatuan) || 0,                               // 12 (L) Upah Satuan
        Number(itm.totalUpah) || 0,                                 // 13 (M) Total Upah
        petugasPk,                                                  // 14 (N) Petugas Packing
        statusJt,                                                   // 15 (O) Status Jahit
        statusPk,                                                   // 16 (P) Status Packing
        sekarangWib                                                 // 17 (Q) Waktu Pembagian
      ]);
    }

    if (rowsKerja.length > 0) {
      sheetKerja.getRange(sheetKerja.getLastRow() + 1, 1, rowsKerja.length, HEADERS_DISTRIBUSI_KERJA.length).setValues(rowsKerja);
      countBaris = rowsKerja.length;
    }
  }

  // Sembunyikan kolom Grup Kerja (Kolom 11 / K)
  try {
    sheetKerja.hideColumns(11);
  } catch (eH) {}

  return {
    success: true,
    countBaris: countBaris,
    countJahit: countBaris,
    countPacking: Object.keys(petaPacking).length,
    message: 'Berhasil menyimpan ' + countBaris + ' baris pembagian ke sheet PEMBAGIAN KERJA di Spreadsheet Baru.'
  };
}

/**
 * Helper untuk membuka Web App Distribusi
 */
function getWebAppDistribusiUrl() {
  var baseUrl = ScriptApp.getService().getUrl();
  return baseUrl ? (baseUrl + '?page=distribusi') : '';
}

/**
 * Render halaman Distribusi.html untuk Web App GAS
 */
function renderDistribusiPage_() {
  try {
    return HtmlService.createHtmlOutputFromFile('Distribusi')
      .setTitle('Distribusi SPK Jahit & Packing - ERP Begood')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<h3>Berkas gas/Distribusi.html belum disalin ke Apps Script</h3>' +
      '<p>Pastikan berkas HTML bernama <b>Distribusi</b> sudah dibuat di Apps Script.</p>'
    );
  }
}

/**
 * Menu pembantu di spreadsheet master untuk membuka Portal Distribusi
 */
function bukaPortalDistribusiPrompt() {
  var url = getWebAppDistribusiUrl();
  var ui = SpreadsheetApp.getUi();
  if (!url) {
    ui.alert(
      'Web App Belum Di-deploy',
      'Deploy Apps Script sebagai Web App terlebih dahulu (Deploy > New Deployment > Web app),\n' +
      'lalu akses dengan parameter "?page=distribusi".',
      ui.ButtonSet.OK
    );
    return;
  }
  var html = HtmlService.createHtmlOutput(
    '<p style="font-family:sans-serif;font-size:13px;">Klik tautan di bawah untuk membuka Portal Distribusi SPK Jahit & Packing:</p>' +
    '<p><a href="' + url + '" target="_blank" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Buka Portal Distribusi &rarr;</a></p>'
  ).setWidth(380).setHeight(140);
  ui.showModalDialog(html, 'Portal Distribusi SPK & Packing');
}

/**
 * ============================================================================
 * ALGORITMA PEMBAGIAN OTOMATIS BERIMBANG (JAHIT & PACKING)
 * ============================================================================
 */

var SKU_PATTERN_DEFAULTS = [
  { regex: /MKN|MUKENA/i, grup: 'MUKENA', upah: 6000 },
  { regex: /GMS|GAMIS/i, grup: 'GAMIS', upah: 7000 },
  { regex: /KMJ|KEMEJA|TSHIRT|KAOS|POLO/i, grup: 'ATASAN', upah: 4500 },
  { regex: /CLN|CELANA|KULOT|CARGO/i, grup: 'CELANA', upah: 4000 },
  { regex: /SET|SETELAN|ONE\s*SET/i, grup: 'SETELAN', upah: 7500 }
];

function tentukanGrupDanTarifSkuDistribusi_(sku, tarifMap) {
  var raw = String(sku || '').trim().toUpperCase();
  if (tarifMap && tarifMap[raw]) {
    return {
      grup: tarifMap[raw].grup || 'SEMUA',
      upah: Number(tarifMap[raw].upah) || 4000
    };
  }
  for (var i = 0; i < SKU_PATTERN_DEFAULTS.length; i++) {
    if (SKU_PATTERN_DEFAULTS[i].regex.test(raw)) {
      return {
        grup: SKU_PATTERN_DEFAULTS[i].grup,
        upah: SKU_PATTERN_DEFAULTS[i].upah
      };
    }
  }
  return { grup: 'SEMUA', upah: 4000 };
}

function penjahitBisaGrupDistribusi_(grupPenjahit, grupTarget) {
  if (!grupPenjahit || !grupTarget) return true;
  var target = String(grupTarget).trim().toUpperCase();
  if (target === 'SEMUA') return true;
  var list = String(grupPenjahit).toUpperCase().split(/[,;/]+/);
  for (var i = 0; i < list.length; i++) {
    var g = list[i].trim();
    if (g === target || g === 'SEMUA') return true;
  }
  return false;
}

function skorKeadilanPenjahit_(beban, nama, bobot, tambahanUpah) {
  var b = beban[nama] || { upah: 0, pcs: 0 };
  var berat = Number(bobot) > 0 ? Number(bobot) : 1.0;
  var extra = Number(tambahanUpah) > 0 ? Number(tambahanUpah) * 0.5 : 0;
  return ((Number(b.upah) || 0) + extra) / berat + (((Number(b.pcs) || 0) + 0.5) / berat) * 0.0001;
}

function pilihPenjahitTerbaikDistribusi_(kandidat, beban, tambahanUpah) {
  var terpilih = null;
  var skorTerbaik = Infinity;
  for (var i = 0; i < kandidat.length; i++) {
    var p = kandidat[i];
    var skor = skorKeadilanPenjahit_(beban, p.nama, p.bobot, tambahanUpah);
    if (skor < skorTerbaik) {
      skorTerbaik = skor;
      terpilih = p;
    }
  }
  return terpilih;
}

/**
 * RPC: Menghitung pembagian otomatis berimbang di server
 */
function hitungBagiOtomatisDistribusi(token, opsi) {
  var data = bacaAntrianDistribusi(token, 'SEMUA');
  var pesanan = data.pesanan || [];
  var penjahit = data.penjahit || [];
  var packing = data.packing || [];
  var tarif = data.tarif || {};

  var penjahitAktif = [];
  for (var p = 0; p < penjahit.length; p++) {
    if (String(penjahit[p].aktif || 'YA').toUpperCase() === 'YA') {
      penjahitAktif.push({
        nama: penjahit[p].nama,
        grup: penjahit[p].grup || 'SEMUA',
        bobot: Number(penjahit[p].bobot) > 0 ? Number(penjahit[p].bobot) : 1.0
      });
    }
  }
  if (!penjahitAktif.length) penjahitAktif = penjahit.slice();

  var packingAktif = [];
  for (var pk = 0; pk < packing.length; pk++) {
    if (String(packing[pk].aktif || 'YA').toUpperCase() === 'YA') {
      packingAktif.push({
        nama: packing[pk].nama,
        bobot: Number(packing[pk].bobot) > 0 ? Number(packing[pk].bobot) : 1.0
      });
    }
  }
  if (!packingAktif.length) packingAktif = packing.slice();

  var resetManual = Boolean(opsi && opsi.resetManual === true);
  var petaManualJahit = (!resetManual && opsi && opsi.manualJahit) ? opsi.manualJahit : {};
  var petaManualPacking = (!resetManual && opsi && opsi.manualPacking) ? opsi.manualPacking : {};

  // 1. PEMBAGIAN JAHIT: LPT (Longest Processing Time) + Skor Keadilan
  var bebanPenjahit = {};
  for (var pi = 0; pi < penjahitAktif.length; pi++) {
    bebanPenjahit[penjahitAktif[pi].nama] = { upah: 0, pcs: 0, baris: 0, bobot: penjahitAktif[pi].bobot || 1.0 };
  }

  var itemSiapBagi = [];
  for (var idx = 0; idx < pesanan.length; idx++) {
    var it = pesanan[idx];
    var infoTarif = tentukanGrupDanTarifSkuDistribusi_(it.sku, tarif);
    var qty = Number(it.qty) || 1;
    var totalUpah = qty * infoTarif.upah;
    var penjahitManual = petaManualJahit[it.orderSn + '_' + it.sku] || petaManualJahit[idx] || '';
    var isManualJ = Boolean(penjahitManual);

    if (isManualJ && bebanPenjahit[penjahitManual]) {
      bebanPenjahit[penjahitManual].upah += totalUpah;
      bebanPenjahit[penjahitManual].pcs += qty;
      bebanPenjahit[penjahitManual].baris += 1;
    }

    itemSiapBagi.push({
      id: idx,
      orderSn: it.orderSn,
      toko: it.toko,
      sku: it.sku,
      var: it.var,
      qty: qty,
      grup: infoTarif.grup,
      tarifSatuan: infoTarif.upah,
      totalUpah: totalUpah,
      penjahit: penjahitManual,
      manual: isManualJ,
      status: 'ANTRI'
    });
  }

  // Filter dan urutkan item yang belum ditentukan penjahitnya (LPT Heuristic)
  var antrianBelumBagi = [];
  for (var a = 0; a < itemSiapBagi.length; a++) {
    if (!itemSiapBagi[a].penjahit) {
      antrianBelumBagi.push(itemSiapBagi[a]);
    }
  }

  antrianBelumBagi.sort(function(a, b) {
    return b.totalUpah - a.totalUpah;
  });

  for (var j = 0; j < antrianBelumBagi.length; j++) {
    var curItem = antrianBelumBagi[j];
    var kandidat = [];
    for (var k = 0; k < penjahitAktif.length; k++) {
      if (penjahitBisaGrupDistribusi_(penjahitAktif[k].grup, curItem.grup)) {
        kandidat.push(penjahitAktif[k]);
      }
    }
    if (!kandidat.length) kandidat = penjahitAktif.slice();

    var chosen = pilihPenjahitTerbaikDistribusi_(kandidat, bebanPenjahit, curItem.totalUpah);
    var namaPenjahit = chosen ? chosen.nama : penjahitAktif[0].nama;

    curItem.penjahit = namaPenjahit;
    bebanPenjahit[namaPenjahit].upah += curItem.totalUpah;
    bebanPenjahit[namaPenjahit].pcs += curItem.qty;
    bebanPenjahit[namaPenjahit].baris += 1;
  }
  var hasilJahit = itemSiapBagi;

  // 2. PEMBAGIAN PACKING: Balanced Pcs & Packages
  var hasilPacking = [];
  var paketMap = {};
  for (var m = 0; m < pesanan.length; m++) {
    var ps = pesanan[m];
    if (!paketMap[ps.orderSn]) {
      paketMap[ps.orderSn] = {
        orderSn: ps.orderSn,
        toko: ps.toko,
        courier: ps.courier,
        city: ps.city,
        totalPcs: 0,
        ringkasan: []
      };
    }
    paketMap[ps.orderSn].totalPcs += (Number(ps.qty) || 1);
    paketMap[ps.orderSn].ringkasan.push(ps.sku + ' (' + ps.var + ') x' + (Number(ps.qty) || 1));
  }

  var listPaket = [];
  for (var sn in paketMap) {
    listPaket.push(paketMap[sn]);
  }

  listPaket.sort(function(a, b) {
    return b.totalPcs - a.totalPcs;
  });

  var bebanPacking = {};
  for (var pki = 0; pki < packingAktif.length; pki++) {
    bebanPacking[packingAktif[pki].nama] = { paket: 0, pcs: 0, bobot: packingAktif[pki].bobot || 1.0 };
  }

  for (var pkj = 0; pkj < listPaket.length; pkj++) {
    var curPkt = listPaket[pkj];
    var petugasManual = petaManualPacking[curPkt.orderSn] || '';
    var isManualPk = Boolean(petugasManual);
    var namaPetugas = petugasManual;

    if (!namaPetugas) {
      var petugasTerbaik = null;
      var skorPackingTerendah = Infinity;
      for (var pkn = 0; pkn < packingAktif.length; pkn++) {
        var namaPk = packingAktif[pkn].nama;
        var bp = bebanPacking[namaPk];
        var skorPk = (bp.pcs / bp.bobot) + (bp.paket * 0.1);
        if (skorPk < skorPackingTerendah) {
          skorPackingTerendah = skorPk;
          petugasTerbaik = namaPk;
        }
      }
      namaPetugas = petugasTerbaik || packingAktif[0].nama;
    }

    bebanPacking[namaPetugas].paket += 1;
    bebanPacking[namaPetugas].pcs += curPkt.totalPcs;

    hasilPacking.push({
      orderSn: curPkt.orderSn,
      toko: curPkt.toko,
      courier: curPkt.courier,
      city: curPkt.city,
      totalPcs: curPkt.totalPcs,
      ringkasan: curPkt.ringkasan.join('; '),
      petugas: namaPetugas,
      manual: isManualPk,
      status: 'MENUNGGU'
    });
  }

  return {
    success: true,
    jahit: hasilJahit,
    packing: hasilPacking,
    bebanPenjahit: bebanPenjahit,
    bebanPacking: bebanPacking
  };
}

/**
 * RPC: Menyimpan master penjahit dari layar Distribusi
 */
function simpanPenjahitDistribusi(token, daftar) {
  var count = SheetManager.simpanPenjahit(daftar);
  return { success: true, count: count, message: 'Daftar ' + count + ' penjahit berhasil disimpan.' };
}

/**
 * RPC: Menyimpan master petugas packing dari layar Distribusi
 */
function simpanPackingDistribusi(token, daftar) {
  var count = SheetManager.simpanPetugasPacking(daftar);
  return { success: true, count: count, message: 'Daftar ' + count + ' petugas packing berhasil disimpan.' };
}

/**
 * RPC: Menyimpan master aturan SKU dari layar Distribusi
 */
function simpanAturanDistribusi(token, daftar) {
  var count = SheetManager.simpanAturanSku(daftar);
  return { success: true, count: count, message: 'Daftar ' + count + ' aturan SKU berhasil disimpan.' };
}

/**
 * RPC: Menyimpan pemetaan kode toko dari layar Distribusi
 */
function simpanKodeTokoDistribusi(token, daftar) {
  var peta = {};
  if (Array.isArray(daftar)) {
    for (var i = 0; i < daftar.length; i++) {
      var item = daftar[i] || {};
      var t = String(item.toko || '').trim();
      var k = String(item.kode || '').trim().toUpperCase();
      if (t && k) peta[t] = k;
    }
  } else if (daftar && typeof daftar === 'object') {
    for (var tk in daftar) {
      if (Object.prototype.hasOwnProperty.call(daftar, tk)) {
        var t2 = String(tk).trim();
        var k2 = String(daftar[tk]).trim().toUpperCase();
        if (t2 && k2) peta[t2] = k2;
      }
    }
  }
  var count = SheetManager.simpanKodeTokoCetak ? SheetManager.simpanKodeTokoCetak(peta) : 0;
  return { success: true, count: count, message: 'Pemetaan ' + count + ' kode toko berhasil disimpan.' };
}

/**
 * RPC: Memuat ulang data master setelan dari Spreadsheet Master Begood ERP
 * (Penjahit, Petugas Packing, Aturan SKU, Kode Toko, Tarif) tanpa membaca ulang antrian pesanan.
 *
 * @param {string} token Token sesi pengguna
 * @return {Object} Status dan data master setelan
 */
function muatUlangSetelanMasterDistribusi(token) {
  var masterSs = SpreadsheetApp.getActiveSpreadsheet();
  var masterData = bacaMasterSetelanDistribusi_(masterSs);

  return {
    success: true,
    penjahit: masterData.penjahit,
    packing: masterData.packing,
    aturan: masterData.aturan,
    kodeToko: masterData.kodeToko,
    tarif: masterData.tarif,
    variasiWarna: masterData.variasiWarna || [],
    message: 'Master setelan penjahit, packing, aturan SKU, kode toko, dan variasi warna berhasil dimuat ulang dari Master Spreadsheet Begood ERP!'
  };
}

/**
 * RPC: Memperbarui nilai variasi pesanan secara otomatis di sheet Pesanan Masuk
 * dan sheet PEMBAGIAN KERJA pada Spreadsheet Distribusi Baru.
 *
 * Catatan: Sesuai preferensi pengguna, variasi baru tidak didaftarkan ke sheet
 * master Variasi Warna di Master Spreadsheet.
 *
 * @param {string} token Token sesi pengguna
 * @param {Object} payload { orderSn, sku, variasiLama, variasiBaru }
 * @return {Object} Status keberhasilan dan jumlah baris terupdate
 */
function updateVariasiPesananDistribusi(token, payload) {
  if (!payload || !payload.orderSn) {
    throw new Error('Data pembagian atau nomor pesanan tidak valid.');
  }

  var orderSn = String(payload.orderSn).trim();
  var skuTarget = String(payload.sku || '').trim();
  var variasiLama = bersihkanVariasiDistribusi_(payload.variasiLama || '');
  var variasiBaru = bersihkanVariasiDistribusi_(payload.variasiBaru || '');

  pastikanStrukturSpreadsheetDistribusiBaru_();
  var ss = getSpreadsheetDistribusiBaru_();

  var updatedPesanan = 0;
  var updatedKerja = 0;

  // 1. Perbarui pada Sheet "Pesanan Masuk"
  var sheetPesanan = ss.getSheetByName('Pesanan Masuk');
  if (sheetPesanan && sheetPesanan.getLastRow() > 1) {
    var lastRowP = sheetPesanan.getLastRow();
    // HEADERS_DISTRIBUSI_PESANAN: Col 1: No. Pesanan, Col 8: SKU, Col 9: Variasi
    var valsP = sheetPesanan.getRange(2, 1, lastRowP - 1, 9).getValues();
    var barisCocokP = [];
    var barisOrderP = [];

    for (var i = 0; i < valsP.length; i++) {
      var rowSn = String(valsP[i][0] || '').trim();
      if (rowSn !== orderSn) continue;

      barisOrderP.push(i);

      var rowSku = String(valsP[i][7] || '').trim();
      var rowVar = bersihkanVariasiDistribusi_(valsP[i][8]);

      var skuCocok = !skuTarget || !rowSku || rowSku.toLowerCase() === skuTarget.toLowerCase();
      var varCocok = !variasiLama || !rowVar || rowVar.toLowerCase() === variasiLama.toLowerCase();

      if (skuCocok && varCocok) {
        barisCocokP.push(i);
      }
    }

    if (barisCocokP.length === 0 && barisOrderP.length === 1) {
      barisCocokP = barisOrderP;
    }

    for (var p = 0; p < barisCocokP.length; p++) {
      var rowIndexP = barisCocokP[p];
      sheetPesanan.getRange(rowIndexP + 2, 9).setValue(variasiBaru);
      updatedPesanan++;
    }
  }

  // 2. Perbarui pada Sheet "PEMBAGIAN KERJA"
  var sheetKerja = ss.getSheetByName('PEMBAGIAN KERJA');
  if (sheetKerja && sheetKerja.getLastRow() > 1) {
    var lastRowK = sheetKerja.getLastRow();
    // HEADERS_DISTRIBUSI_KERJA: Col 4: No. Pesanan, Col 7: SKU, Col 8: Variasi
    var valsK = sheetKerja.getRange(2, 1, lastRowK - 1, 8).getValues();
    var barisCocokK = [];
    var barisOrderK = [];

    for (var j = 0; j < valsK.length; j++) {
      var rowSnK = String(valsK[j][3] || '').trim();
      if (rowSnK !== orderSn) continue;

      barisOrderK.push(j);

      var rowSkuK = String(valsK[j][6] || '').trim();
      var rowVarK = bersihkanVariasiDistribusi_(valsK[j][7]);

      var skuCocokK = !skuTarget || !rowSkuK || rowSkuK.toLowerCase() === skuTarget.toLowerCase();
      var varCocokK = !variasiLama || !rowVarK || rowVarK.toLowerCase() === variasiLama.toLowerCase();

      if (skuCocokK && varCocokK) {
        barisCocokK.push(j);
      }
    }

    if (barisCocokK.length === 0 && barisOrderK.length === 1) {
      barisCocokK = barisOrderK;
    }

    for (var q = 0; q < barisCocokK.length; q++) {
      var rowIndexK = barisCocokK[q];
      sheetKerja.getRange(rowIndexK + 2, 8).setValue(variasiBaru);
      updatedKerja++;
    }
  }

  // 3. Cadangan: jika ada sheet warisan "PEMBAGIAN JAHIT"
  var sheetJahit = ss.getSheetByName('PEMBAGIAN JAHIT');
  if (sheetJahit && sheetJahit.getLastRow() > 1) {
    var lastRowJ = sheetJahit.getLastRow();
    var valsJ = sheetJahit.getRange(2, 1, lastRowJ - 1, 6).getValues();
    for (var k = 0; k < valsJ.length; k++) {
      var rowSnJ = String(valsJ[k][3] || '').trim();
      if (rowSnJ !== orderSn) continue;

      var rowSkuJ = String(valsJ[k][4] || '').trim();
      var rowVarJ = bersihkanVariasiDistribusi_(valsJ[k][5]);

      var skuCocokJ = !skuTarget || !rowSkuJ || rowSkuJ.toLowerCase() === skuTarget.toLowerCase();
      var varCocokJ = !variasiLama || !rowVarJ || rowVarJ.toLowerCase() === variasiLama.toLowerCase();

      if (skuCocokJ && varCocokJ) {
        sheetJahit.getRange(k + 2, 6).setValue(variasiBaru);
      }
    }
  }

  var msg = 'Variasi pesanan ' + orderSn + ' berhasil diperbarui menjadi "' + variasiBaru + '" di Spreadsheet (' +
            updatedPesanan + ' baris Pesanan Masuk, ' + updatedKerja + ' baris Pembagian Kerja).';

  return {
    success: true,
    orderSn: orderSn,
    variasiBaru: variasiBaru,
    updatedPesanan: updatedPesanan,
    updatedKerja: updatedKerja,
    message: msg
  };
}

