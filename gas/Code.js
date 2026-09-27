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
  ui.createMenu('ERP Begood')
    .addItem('Buka Web Dashboard (Tab Baru)', 'openDashboardNewTab')
    .addItem('Buka Web Dashboard (Layar Penuh)', 'openDashboardModal')
    .addItem('Buka Web Dashboard (Sidebar)', 'openDashboardSidebar')
    .addSeparator()
    .addItem('Tarik Pesanan Masuk (Hari Ini / 3 Hari)', 'syncOrdersDefault')
    .addItem('Tarik Pesanan Masuk (Pilih Rentang Hari)', 'syncOrdersCustomDays')
    .addItem('Tarik Pesanan Satu Toko Tertentu', 'tarikTokoTertentuPrompt')
    .addItem('Tarik Pesanan Berdasarkan Nomor SN', 'syncOrderBySnPrompt')
    .addSeparator()
    .addItem('Cek Status Token Shopee', 'checkTokenStatus')
    .addItem('Tempel Token Hasil Otorisasi (Paste)', 'pasteTokenPrompt')
    .addItem('Refresh Token Shopee Sekarang', 'refreshShopeeToken')
    .addItem('Buka Tautan Otorisasi Shopee Baru (Dialog Web)', 'generateAuthLink')
    .addItem('Salin Tautan Otorisasi (Teks Langsung)', 'copyAuthLink')
    .addSeparator()
    .addItem('Isi Kolom Toko untuk Baris Lama (Migrasi)', 'backfillKodeTokoPrompt')
    .addItem('Periksa Isi DB_Token', 'cekIsiDbTokenPrompt')
    .addItem('Periksa Identitas Pemanggil', 'cekIdentitasPenggunaPrompt')
    .addSeparator()
    .addItem('Buat Akun Superadmin Pertama', 'buatSuperadminPertamaPrompt')
    .addItem('Tambah / Ubah Pengguna', 'kelolaPenggunaPrompt')
    .addItem('Aktifkan / Nonaktifkan Pengguna', 'ubahAktifPenggunaPrompt')
    .addItem('Lihat Daftar Pengguna', 'lihatPenggunaPrompt')
    .addSeparator()
    .addItem('Siapkan Aturan & Penjahit Produksi', 'siapkanSettingProduksiPrompt')
    .addItem('Bagi Pekerjaan Jahit Sekarang', 'bagiPembagianJahitPrompt')
    .addItem('Tutup Sesi Jahit (Bagi + Simpan Hasil)', 'tutupSesiJahitPrompt')
    .addSeparator()
    .addItem('Cek Koneksi ke Middleware Vercel (Tes Ping)', 'checkMiddlewareHealth')
    .addItem('Pasang Trigger Otomatis (Tiap 1 Jam)', 'setupHourlyTrigger')
    .addItem('Matikan Semua Trigger Otomatis', 'removeTriggers')
    .addItem('Inisialisasi / Reset Tabel Sheet', 'setupWorkspace')
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
      'Struktur tabel untuk "Pesanan Masuk", "DB_Token", "Konfigurasi", "Log_Aktivitas", "Pengguna", ' +
      '"DATA PROSES", "DATA JAHIT", "SETTING PENJAHIT", "SKU RULES", dan "PEMBAGIAN JAHIT" telah siap digunakan.\n\n' +
      'Empat sheet terakhir dipakai modul produksi: pesanan berstatus "[2] Menunggu Pickup" menjadi ' +
      'daftar kerja di layar, harga dan waktu proses per SKU diisi pada "DATA PROSES", hasil jahitnya ' +
      'disimpan bersama sesi dan nama penjahit, lalu pekerjaannya ' +
      'dibagi ke penjahit menurut grup dan bobot kapasitasnya. ' +
      'Buka tab "Produksi & antrian" dan "Pembagian jahit" di Web Dashboard untuk memakainya.',
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
 * Menu: menarik pesanan satu toko saja, dipilih lewat kode tokonya.
 *
 * Dipakai saat satu toko bermasalah, karena penarikan satu toko menampilkan
 * dialog rinci beserta catatan API dari Shopee, sedangkan penarikan banyak
 * toko hanya menampilkan ringkasan.
 */
function tarikTokoTertentuPrompt() {
  var ui = SpreadsheetApp.getUi();

  var daftar;
  try {
    daftar = SheetManager.getTokoUntukSync();
  } catch (err) {
    ui.alert('Gagal Membaca Daftar Toko', err.message || String(err), ui.ButtonSet.OK);
    return;
  }

  if (daftar.length === 0) {
    ui.alert('Belum Ada Toko', 'Belum ada toko aktif bertoken di sheet "DB_Token".', ui.ButtonSet.OK);
    return;
  }

  var nama = [];
  for (var i = 0; i < daftar.length; i++) {
    nama.push('  ' + (daftar[i].kode_toko || '(belum ada kode, Shop ID ' + daftar[i].shop_id + ')'));
  }

  var jawab = ui.prompt(
    'Tarik Pesanan Satu Toko',
    'Toko yang tersedia:\n' + nama.join('\n') +
      '\n\nTulis kode toko dan jumlah hari, dipisah spasi.\nContoh: BEGOOD.BDG 10',
    ui.ButtonSet.OK_CANCEL
  );

  if (jawab.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  var isian = String(jawab.getResponseText() || '').trim().split(/\s+/);
  var kode = isian[0] || '';
  var bawaan = Number(SheetManager.getConfig().DEFAULT_SYNC_DAYS || 3);
  var hari = isian[1] ? parseInt(isian[1], 10) : bawaan;

  if (!kode) {
    ui.alert('Kode Toko Kosong', 'Tulis kode tokonya, misalnya BEGOOD.BDG 10', ui.ButtonSet.OK);
    return;
  }

  if (isNaN(hari) || hari < 1 || hari > 365) {
    ui.alert('Jumlah Hari Tidak Valid', 'Tulis angka 1 sampai 365 untuk jumlah hari.', ui.ButtonSet.OK);
    return;
  }

  try {
    syncOrdersCore(hari, false, kode);
  } catch (e) {
    // Galatnya sudah ditampilkan lewat dialog di dalam syncOrdersCore
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
 * Core sinkronisasi pesanan berdasarkan Order SN.
 *
 * Nomor SN hanya dimiliki satu toko, jadi bila kode toko tidak disebutkan,
 * seluruh toko aktif dicari sampai pesanannya ketemu.
 *
 * @param {string} orderSn nomor pesanan Shopee
 * @param {boolean} isBackground true bila dipanggil trigger, tanpa UI
 * @param {string} [kodeToko] kode toko yang dicari
 */
function syncOrdersBySnCore(orderSn, isBackground, kodeToko) {
  var ui = null;
  if (!isBackground) {
    try {
      ui = SpreadsheetApp.getUi();
    } catch (e) {}
  }

  var daftarToko;
  try {
    daftarToko = SheetManager.getTokoUntukSync(kodeToko);
  } catch (errToko) {
    var pesanToko = errToko.message || String(errToko);
    SheetManager.logActivity('SYNC_PESANAN_SN', 0, 'GAGAL', pesanToko, kodeToko || '');
    if (ui) ui.alert('Toko Tidak Ditemukan', pesanToko, ui.ButtonSet.OK);
    throw new Error(pesanToko);
  }

  if (daftarToko.length === 0) {
    var pesanToken = 'Token otorisasi Shopee belum ditemukan di sheet "DB_Token". Silakan lakukan otorisasi akun terlebih dahulu.';
    SheetManager.logActivity('SYNC_PESANAN_SN', 0, 'GAGAL', pesanToken, '');
    if (ui) ui.alert('Token Belum Ada', pesanToken, ui.ButtonSet.OK);
    throw new Error(pesanToken);
  }

  var daftarGagal = [];

  for (var t = 0; t < daftarToko.length; t++) {
    var rekaman = daftarToko[t];
    var kode = rekaman.kode_toko || '';
    var label = kode || rekaman.shop_id;

    if (ui) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        'Mencari pesanan ' + orderSn + ' di toko ' + label + ' (' + (t + 1) + ' dari ' + daftarToko.length + ')...',
        'ERP Begood', 10
      );
    }

    try {
      var apiRes = ShopeeApi.fetchDailyOrders({
        order_sn_list: [orderSn],
        access_token: rekaman.access_token,
        refresh_token: rekaman.refresh_token,
        expired_at: rekaman.expired_at,
        shop_id: rekaman.shop_id
      });

      if (!apiRes || !apiRes.data) {
        throw new Error(apiRes.message || 'Respons middleware tidak memiliki data pesanan.');
      }

      var orders = apiRes.data.orders || [];

      /* Daftar kosong bisa berarti pesanannya memang tidak ada, atau Shopee
         menolak permintaannya. Yang kedua tidak boleh ditelan diam-diam. */
      if (orders.length === 0) {
        var galatCari = (apiRes.data.diagnostics && apiRes.data.diagnostics.errors) || [];
        if (galatCari.length > 0) {
          daftarGagal.push(label + ' (galat API): ' + galatCari[0]);
        }
        continue;
      }

      if (apiRes.data.new_token) {
        var newToken = apiRes.data.new_token;
        SheetManager.saveTokenRecord({
          shop_id: newToken.shop_id || rekaman.shop_id,
          partner_id: rekaman.partner_id,
          access_token: newToken.access_token,
          refresh_token: newToken.refresh_token,
          expired_at: newToken.expired_at
        });
      }

      var upsertResult = SheetManager.upsertOrders(orders, kode);
      var logMsg = 'Berhasil menarik pesanan ' + orderSn + ' (' + upsertResult.added +
        ' baru, ' + upsertResult.updated + ' diperbarui).';

      SheetManager.logActivity('SYNC_PESANAN_SN', orders.length, 'SUKSES', logMsg, label);
      invalidateDashboardCache();

      if (ui) {
        ui.alert('Pesanan Ditemukan & Tersimpan', logMsg + '\nToko: ' + label, ui.ButtonSet.OK);
      }

      return {
        success: true,
        toko: label,
        count: orders.length,
        added: upsertResult.added,
        updated: upsertResult.updated,
        message: logMsg
      };
    } catch (err) {
      /* Satu toko yang gagal ditanyai tidak menutup kemungkinan pesanan itu ada
         di toko berikutnya, jadi galatnya disimpan lalu pencarian diteruskan. */
      daftarGagal.push(label + ': ' + (err.message || String(err)));
    }
  }

  var pesan;
  if (daftarGagal.length === daftarToko.length) {
    pesan = 'Gagal mencari pesanan ' + orderSn + ': ' + daftarGagal.join(' | ');
  } else if (daftarGagal.length > 0) {
    pesan = 'Pesanan ' + orderSn + ' tidak ditemukan di toko yang berhasil ditanyai. ' +
      'Sebagian toko gagal ditanyai: ' + daftarGagal.join(' | ');
  } else {
    pesan = 'Pesanan dengan SN "' + orderSn + '" tidak ditemukan di ' + daftarToko.length + ' toko yang ditarik.';
  }

  SheetManager.logActivity('SYNC_PESANAN_SN', 0, daftarGagal.length > 0 ? 'ERROR' : 'GAGAL', pesan, kodeToko || 'SEMUA');
  if (ui) ui.alert('Pesanan Tidak Ditemukan', pesan, ui.ButtonSet.OK);
  throw new Error(pesan);
}

/** Jeda antar toko pada penarikan gabungan, supaya middleware tidak dibombardir. */
var JEDA_ANTAR_TOKO_MS = 1000;

/**
 * Menarik pesanan satu toko lalu menyimpannya ke sheet.
 *
 * Dipisahkan dari syncOrdersCore() agar kegagalan satu toko dapat ditangkap
 * tanpa menghentikan toko berikutnya.
 *
 * @param {Object} rekaman rekaman token toko, dari SheetManager.getTokoUntukSync()
 * @param {number} days jumlah hari ke belakang
 * @param {Object} ui UI spreadsheet, atau null bila dipanggil trigger
 * @param {number} urutan nomor urut toko, untuk pesan kemajuan
 * @param {number} total jumlah toko yang ditarik
 * @return {Object} ringkasan toko ini, dengan success bernilai false bila gagal
 */
function syncSatuToko_(rekaman, days, ui, urutan, total) {
  var kodeToko = rekaman.kode_toko || '';

  try {
    if (ui) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        'Menarik toko ' + (kodeToko || rekaman.shop_id) + ' (' + urutan + ' dari ' + total + ')...',
        'ERP Begood', 10
      );
    }

    var nowSec = Math.floor(Date.now() / 1000);
    var timeFrom = nowSec - (days * 86400);
    var timeTo = nowSec;

    var payload = {
      time_from: timeFrom,
      time_to: timeTo,
      access_token: rekaman.access_token,
      refresh_token: rekaman.refresh_token,
      expired_at: rekaman.expired_at,
      shop_id: rekaman.shop_id
    };

    var apiRes = ShopeeApi.fetchDailyOrders(payload);

    if (!apiRes || !apiRes.data) {
      throw new Error(apiRes.message || 'Respons middleware tidak memiliki data pesanan.');
    }

    // Middleware dapat memperbarui token sendiri, jadi hasilnya ikut disimpan.
    if (apiRes.data.new_token) {
      var newToken = apiRes.data.new_token;
      SheetManager.saveTokenRecord({
        shop_id: newToken.shop_id || rekaman.shop_id,
        partner_id: rekaman.partner_id,
        access_token: newToken.access_token,
        refresh_token: newToken.refresh_token,
        expired_at: newToken.expired_at
      });
      SheetManager.logActivity('AUTO_REFRESH_TOKEN', 0, 'SUKSES',
        'Token otomatis diperbarui oleh middleware saat sinkronisasi pesanan.',
        kodeToko || rekaman.shop_id);
    }

    var orders = apiRes.data.orders || [];
    var upsertResult = SheetManager.upsertOrders(orders, kodeToko);

    var logMsg = 'Berhasil menarik ' + orders.length + ' pesanan (' + upsertResult.added + ' baru, ' + upsertResult.updated + ' diperbarui) untuk rentang ' + days + ' hari.';

    // Kolom Q dibiarkan kosong bila kode toko belum diisi, jadi ikut dicatat
    if (!kodeToko) {
      logMsg += ' Kolom Kode Toko (kolom J) di DB_Token belum diisi, sehingga baris pesanan tidak ditandai.';
    }

    /* Pesan galat dari Shopee ikut dicatat dan ditandai ERROR. Tanpa ini, toko
       yang ditolak Shopee tampak sama dengan toko yang memang tidak punya
       pesanan, yaitu dua-duanya "0 pesanan". */
    var galatApi = (apiRes.data.diagnostics && apiRes.data.diagnostics.errors) || [];
    if (galatApi.length > 0) {
      logMsg += ' Catatan API: ' + galatApi.slice(0, 2).join('; ');
    }

    SheetManager.logActivity('SYNC_PESANAN', orders.length, galatApi.length > 0 ? 'ERROR' : 'SUKSES',
      logMsg, kodeToko || rekaman.shop_id);

    return {
      success: true,
      kode_toko: kodeToko,
      shop_id: rekaman.shop_id,
      count: orders.length,
      added: upsertResult.added,
      updated: upsertResult.updated,
      diagnostics: apiRes.data.diagnostics || {},
      message: logMsg
    };
  } catch (err) {
    var errMsg = err.message || String(err);
    SheetManager.logActivity('SYNC_PESANAN', 0, 'ERROR', errMsg, kodeToko || rekaman.shop_id);
    if (!ui) console.error('Background sync failed:', errMsg);

    return {
      success: false,
      kode_toko: kodeToko,
      shop_id: rekaman.shop_id,
      count: 0,
      added: 0,
      updated: 0,
      message: errMsg
    };
  }
}

/**
 * Menyusun rincian diagnostik satu toko untuk kotak dialog.
 * Rincian sepanjang ini hanya muncul saat menarik satu toko, karena penarikan
 * banyak toko menampilkan satu ringkasan saja.
 */
function rincianToko_(hasil, days) {
  var teks = '[SUKSES] ' + hasil.message;
  var diag = hasil.diagnostics || {};

  if (diag.time_from_wib && diag.time_to_wib) {
    teks += '\n\nRentang: ' + diag.time_from_wib + ' -> ' + diag.time_to_wib;
    teks += '\nPeriode Chunk: ' + (diag.chunks_total || 0) + ' periode (masing-masing <=14 hari)';
    teks += '\nTotal SN ditemukan: ' + (diag.order_sns_found || hasil.count);
  }

  if (diag.chunk_results && diag.chunk_results.length > 0) {
    var nonZeroChunks = diag.chunk_results.filter(function(c) { return c.found > 0; });
    teks += '\n\nChunk dengan data (' + nonZeroChunks.length + ' dari ' + diag.chunk_results.length + '):';
    nonZeroChunks.slice(0, 5).forEach(function(c) {
      teks += '\n  • [' + c.field + '] ' + c.from_wib.substring(0, 10) + ': ' + c.found + ' pesanan';
    });
    if (nonZeroChunks.length === 0) {
      teks += '\n  (Tidak ada chunk yang menghasilkan pesanan, kemungkinan pesanan berada di luar rentang tanggal ini)';
    }
  }

  if (diag.errors && diag.errors.length > 0) {
    teks += '\n\nCatatan API:\n' + diag.errors.slice(0, 3).join('\n');
  }

  if (hasil.count <= 5 && days <= 90) {
    teks += '\n\nPetunjuk: Jika pesanan toko Anda berada di luar 90 hari, Anda dapat:\n1. Memasukkan rentang 180 atau 365 hari di menu "Pilih Rentang Hari".\n2. Menarik langsung via menu "Tarik Pesanan Berdasarkan Nomor SN".';
  }

  return teks;
}

/**
 * Menyusun ringkasan penarikan gabungan, satu baris per toko.
 */
function ringkasanSemuaToko_(hasil, days) {
  var teks = 'Menarik ' + hasil.length + ' toko untuk rentang ' + days + ' hari.';
  var totalPesanan = 0;

  for (var i = 0; i < hasil.length; i++) {
    var satu = hasil[i];
    var label = satu.kode_toko || satu.shop_id;

    if (satu.success) {
      totalPesanan += satu.count;
      teks += '\n\n• ' + label + ': ' + satu.count + ' pesanan (' + satu.added +
        ' baru, ' + satu.updated + ' diperbarui)';
      teks += catatanApi_(satu);
    } else {
      teks += '\n\n• ' + label + ': GAGAL - ' + satu.message;
    }
  }

  teks += '\n\nTotal ' + totalPesanan + ' pesanan.';
  teks += '\nRincian teknis tiap toko tercatat di sheet Log_Aktivitas.';

  return teks;
}

/**
 * Menyusun catatan galat API satu toko untuk ditampilkan pada kotak dialog.
 *
 * Perlu ada karena Shopee membalas galat lewat daftar pesanan yang kosong,
 * bukan lewat kode HTTP, sehingga tanpa ini penyebabnya tidak terlihat.
 */
function catatanApi_(hasil) {
  var galat = (hasil.diagnostics && hasil.diagnostics.errors) || [];
  if (galat.length === 0) return '';

  var teks = '\n    Catatan API (' + galat.length + ' galat):';
  var tampil = Math.min(galat.length, 3);
  for (var i = 0; i < tampil; i++) {
    teks += '\n      - ' + galat[i];
  }
  if (galat.length > tampil) {
    teks += '\n      - dan ' + (galat.length - tampil) + ' galat lain, lihat Log_Aktivitas';
  }

  return teks;
}

/**
 * Fungsi core sinkronisasi pesanan.
 *
 * @param {number} days jumlah hari ke belakang yang ditarik
 * @param {boolean} isBackground true bila dipanggil trigger, tanpa UI
 * @param {string} [kodeToko] kode toko yang ditarik. Bila kosong, seluruh toko
 *   aktif ditarik berurutan.
 */
function syncOrdersCore(days, isBackground, kodeToko) {
  var ui = null;
  if (!isBackground) {
    try {
      ui = SpreadsheetApp.getUi();
    } catch (e) {}
  }

  var daftarToko;
  try {
    daftarToko = SheetManager.getTokoUntukSync(kodeToko);
  } catch (errToko) {
    var pesanToko = errToko.message || String(errToko);
    SheetManager.logActivity('SYNC_PESANAN', 0, 'GAGAL', pesanToko, kodeToko || '');
    if (ui) ui.alert('Toko Tidak Ditemukan', pesanToko, ui.ButtonSet.OK);
    throw new Error(pesanToko);
  }

  if (daftarToko.length === 0) {
    var pesanToken = 'Token otorisasi Shopee belum ditemukan di sheet "DB_Token". Silakan lakukan otorisasi akun terlebih dahulu melalui tombol Otorisasi Shopee.';
    SheetManager.logActivity('SYNC_PESANAN', 0, 'GAGAL', pesanToken, '');
    if (ui) ui.alert('Token Belum Ada', pesanToken, ui.ButtonSet.OK);
    throw new Error(pesanToken);
  }

  var hasil = [];
  for (var t = 0; t < daftarToko.length; t++) {
    if (t > 0) Utilities.sleep(JEDA_ANTAR_TOKO_MS);
    hasil.push(syncSatuToko_(daftarToko[t], days, ui, t + 1, daftarToko.length));
  }

  invalidateDashboardCache();

  var jumlahSukses = 0;
  var totalPesanan = 0;
  var totalBaru = 0;
  var totalDiperbarui = 0;
  var daftarGagal = [];

  for (var h = 0; h < hasil.length; h++) {
    if (hasil[h].success) {
      jumlahSukses++;
      totalPesanan += hasil[h].count;
      totalBaru += hasil[h].added;
      totalDiperbarui += hasil[h].updated;
    } else {
      daftarGagal.push((hasil[h].kode_toko || hasil[h].shop_id) + ': ' + hasil[h].message);
    }
  }

  /* Ditampilkan di dialog, bukan hanya dicatat di log, karena kode toko yang
     kosong membuat kolom Q tidak terisi tanpa memunculkan galat apa pun. */
  var tanpaKode = 0;
  for (var k = 0; k < daftarToko.length; k++) {
    if (!daftarToko[k].kode_toko) tanpaKode++;
  }

  var petunjukKode = '';
  if (tanpaKode > 0) {
    petunjukKode = '\n\nCatatan: ' + tanpaKode + ' dari ' + daftarToko.length +
      ' toko belum diisi Kode Toko (kolom J) di sheet DB_Token, jadi baris pesanannya tidak diberi tanda toko ' +
      'dan nama tokonya ditampilkan sebagai Shop ID. Jalankan menu "Periksa Isi DB_Token" untuk melihat isi kolomnya.';
  }

  if (ui) {
    if (hasil.length === 1) {
      if (hasil[0].success) {
        ui.alert('Sinkronisasi Selesai', rincianToko_(hasil[0], days) + petunjukKode, ui.ButtonSet.OK);
      } else {
        ui.alert('Gagal Sinkronisasi Pesanan', 'Terjadi kesalahan:\n' + hasil[0].message, ui.ButtonSet.OK);
      }
    } else {
      ui.alert(
        jumlahSukses > 0 ? 'Sinkronisasi Selesai' : 'Sinkronisasi Gagal',
        ringkasanSemuaToko_(hasil, days) + petunjukKode,
        ui.ButtonSet.OK
      );
    }
  }

  var ringkas = totalPesanan + ' pesanan dari ' + jumlahSukses + ' dari ' + hasil.length +
    ' toko (' + totalBaru + ' baru, ' + totalDiperbarui + ' diperbarui).';

  /* Hanya dilempar bila seluruh toko gagal, supaya kegagalan satu toko tidak
     membuat trigger dianggap gagal padahal toko lain berhasil menarik data. */
  if (jumlahSukses === 0) {
    throw new Error(daftarGagal.join(' | ') || 'Sinkronisasi gagal untuk seluruh toko.');
  }

  return {
    success: true,
    toko: hasil,
    count: totalPesanan,
    added: totalBaru,
    updated: totalDiperbarui,
    message: ringkas
  };
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
      'Belum ada token tersimpan di sheet DB_Token.\nSilakan jalankan menu "Buka Tautan Otorisasi Shopee Baru".',
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
    statusText = '[PERINGATAN] ACCESS TOKEN KADALUARSA (Expired sejak ' + Math.abs(diffMinutes) + ' menit yang lalu).\nSistem akan otomatis memperbarui menggunakan Refresh Token saat penarikan pesanan, atau Anda bisa klik "Refresh Token Shopee Sekarang".';
  } else {
    var hours = Math.floor(diffMinutes / 60);
    var mins = diffMinutes % 60;
    statusText = '[AKTIF] TOKEN BERLAKU (Sisa waktu: ' + hours + ' jam ' + mins + ' menit).\nExpired At: ' + tokenRec.expired_at_wib;
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
        'Token Shopee berhasil disimpan ke sheet DB_Token!\nStatus: AKTIF\n\nSekarang Anda dapat menjalankan menu "Tarik Pesanan Masuk (Hari Ini / 3 Hari)".',
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
        'Token Shopee berhasil diperbarui!\nBerlaku hingga: ' + res.data.expired_at_formatted,
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
        '<a href="' + authUrl + '" class="btn" target="_blank">Buka Halaman Login Shopee</a>' +
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

    PropertiesService.getScriptProperties().setProperty('IS_TRIGGER_ACTIVE', 'true');
    SheetManager.logActivity('TRIGGER_SETUP', 0, 'SUKSES', 'Trigger otomatis sinkronisasi 1 jam berhasil diaktifkan.');
    ui.alert(
      'Trigger Aktif',
      'Otomatisasi berjalan: Pesanan baru akan disinkronisasikan secara otomatis setiap 1 jam di latar belakang (background).',
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
  PropertiesService.getScriptProperties().setProperty('IS_TRIGGER_ACTIVE', 'false');
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
      '• Partner ID: ' + (cfg.partner_id_configured ? '[OK] Terpasang' : '[BELUM DIISI] di Vercel Env') + '\n' +
      '• Partner Key: ' + (cfg.partner_key_configured ? '[OK] Terpasang' : '[BELUM DIISI] di Vercel Env') + '\n' +
      '• Shop ID: ' + (cfg.shop_id_configured ? '[OK] Terpasang' : '[BELUM DIISI] di Vercel Env') + '\n' +
      '• API Secret: ' + (cfg.api_secret_configured ? '[OK] Terpasang' : '[BELUM DIISI] di Vercel Env') + '\n' +
      '• Redirect URI: ' + (cfg.redirect_uri_configured ? '[OK] Terpasang' : '[INFO] Menggunakan Fallback Otomatis') + '\n\n' +
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
 * Buka Dashboard di Tab Baru Peramban (Full Standalone Website)
 */
function openDashboardNewTab() {
  var ui = SpreadsheetApp.getUi();
  var webAppUrl = '';
  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (e) {}

  if (!webAppUrl) {
    ui.alert(
      'Web App Belum Di-Deploy',
      'Untuk membuka dashboard di tab baru secara mandiri:\n\n' +
      '1. Buka editor Apps Script (Ekstensi > Apps Script).\n' +
      '2. Klik tombol "Deploy" di kanan atas > "New deployment".\n' +
      '3. Pilih type "Web app".\n' +
      '4. Set "Execute as: Me" dan "Who has access: Anyone with Google account".\n' +
      '5. Klik "Deploy", lalu buka URL Web App di tab baru!\n\n' +
      'Sementara itu, Anda tetap dapat menggunakan menu "Buka Web Dashboard (Layar Penuh)".',
      ui.ButtonSet.OK
    );
    return;
  }

  var html = '<!DOCTYPE html><html><head><base target="_blank">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<script>' +
    'window.onload = function() {' +
    '  window.open("' + webAppUrl + '", "_blank");' +
    '  setTimeout(function() { google.script.host.close(); }, 1500);' +
    '};' +
    '</script>' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; text-align: center; background: #0f172a; color: #f8fafc; }' +
    '.btn { display: inline-block; padding: 12px 24px; background: #ea580c; color: white !important; font-weight: 600; text-decoration: none; border-radius: 8px; margin-top: 16px; box-shadow: 0 4px 12px rgba(234,88,12,0.3); }' +
    '.note { font-size: 11px; color: #94a3b8; margin-top: 14px; word-break: break-all; }' +
    '</style></head><body>' +
    '<h3>Membuka Web Dashboard ERP Begood...</h3>' +
    '<p style="font-size: 13px; color: #cbd5e1;">Tab baru sedang dibuka. Jika jendela pop-up diblokir oleh browser, klik tombol di bawah:</p>' +
    '<a href="' + webAppUrl + '" target="_blank" class="btn">Buka Dashboard di Tab Baru</a>' +
    '<div class="note">URL: ' + webAppUrl + '</div>' +
    '</body></html>';

  var output = HtmlService.createHtmlOutput(html)
    .setWidth(480)
    .setHeight(240)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  ui.showModalDialog(output, 'ERP Begood Web Dashboard');
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
 * Terlindungi dengan CacheService berkecepatan milidetik
 */
function getDashboardData(token, forceRefresh, kodeToko) {
  var sesi = wajibSesi_(token, 'PACKING');

  var cakupan = String(kodeToko || '').trim().toUpperCase();
  var cache = CacheService.getScriptCache();
  var cacheKey = kunciCacheDashboard_(cakupan);

  if (!forceRefresh) {
    var cached = cache.get(cacheKey);
    if (cached) {
      try {
        var dariCache = JSON.parse(cached);
        return bolehLihatUang_(sesi) ? dariCache : tanpaUangDashboard_(dariCache);
      } catch (e) {}
    }
  }

  var data = SheetManager.getDashboardSummary(cakupan);
  if (data) {
    try {
      var jsonStr = JSON.stringify(data);
      if (jsonStr.length < 95000) {
        cache.put(cacheKey, jsonStr, 180); // Cache 3 menit
      }
    } catch (e) {}
  }

  /* Cache menyimpan payload utuh, dan pemotongan nominal dilakukan pada saat
     jawabannya keluar. Kalau yang disimpan justru versi yang sudah dipotong,
     superadmin yang membaca sesudahnya akan ikut kehilangan angkanya. */
  return bolehLihatUang_(sesi) ? data : tanpaUangDashboard_(data);
}

/**
 * Kunci cache untuk satu cakupan toko.
 *
 * CacheService tidak bisa menghapus beberapa kunci sekaligus, sedangkan
 * dashboard kini menyimpan satu cache per cakupan toko. Karena itu kuncinya
 * diberi nomor generasi: membersihkan seluruh cache cukup dengan menaikkan
 * nomor itu, tanpa perlu tahu cakupan mana saja yang pernah dimuat.
 */
function kunciCacheDashboard_(cakupan) {
  var cache = CacheService.getScriptCache();
  var generasi = cache.get('ERP_DASHBOARD_GENERASI') || '1';
  return 'ERP_DASHBOARD_' + generasi + '_' + (cakupan || 'SEMUA');
}

/**
 * Membersihkan cache dashboard agar panggilan berikutnya mendapatkan data terbaru
 */
function invalidateDashboardCache() {
  try {
    CacheService.getScriptCache().put('ERP_DASHBOARD_GENERASI', String(Date.now()), 21600);
  } catch (e) {}
}

/* ======================= SESI & PERAN ======================= */

/* Batas maksimum CacheService adalah 6 jam, dan itu juga batas sesi di sini. */
var SESI_TTL_DETIK = 21600;

/* PIN pendek, jadi menebaknya harus dibuat mahal: lima kali gagal, lalu dikunci. */
var BATAS_GAGAL_MASUK = 5;
var MENIT_KUNCI_GAGAL = 15;

var PERAN_PERINGKAT = { PACKING: 1, ADMIN: 2, SUPERADMIN: 3 };

/**
 * Membuat sesi baru untuk seorang pengguna.
 *
 * Token disimpan di cache server, bukan di sheet, karena sesi bersifat sementara
 * dan tidak perlu meninggalkan riwayat. Bila cache dibersihkan, pengguna cukup
 * masuk lagi. Yang tersimpan di peramban hanya tokennya, bukan perannya, karena
 * peran selalu dibaca ulang dari server pada tiap permintaan.
 */
function buatSesi_(pengguna) {
  var token = Utilities.getUuid() + Utilities.getUuid().substring(0, 8);
  var data = {
    kode: String(pengguna.kode || '').toUpperCase(),
    nama: String(pengguna.nama || ''),
    peran: String(pengguna.peran || 'PACKING').toUpperCase(),
    masuk: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss')
  };

  CacheService.getScriptCache().put('SESI_' + token, JSON.stringify(data), SESI_TTL_DETIK);
  catatTokenPengguna_(data.kode, token);
  return { token: token, pengguna: data };
}

/* Sesi disimpan per token, sehingga satu-satunya cara menemukan sesi milik
   seseorang adalah dengan mendaftar tokennya. Daftarnya ikut disimpan di cache,
   bukan di sheet, karena isinya hanya berguna selama sesinya hidup. */
function kunciSesiPengguna_(kode) {
  var bersih = String(kode || '').trim().toUpperCase();
  return bersih ? 'SESI_KODE_' + bersih : '';
}

function bacaDaftarToken_(kunci) {
  if (!kunci) return [];
  try {
    var teks = CacheService.getScriptCache().get(kunci);
    var daftar = teks ? JSON.parse(teks) : [];
    return Object.prototype.toString.call(daftar) === '[object Array]' ? daftar : [];
  } catch (e) {
    return [];
  }
}

function catatTokenPengguna_(kode, token) {
  var kunci = kunciSesiPengguna_(kode);
  if (!kunci || !token) return;

  var daftar = bacaDaftarToken_(kunci);
  if (daftar.indexOf(token) === -1) daftar.push(token);

  /* Batasnya dijaga karena daftar tumbuh satu baris tiap kali masuk. Dua puluh
     sesi jauh melebihi pemakaian nyata, dan yang tertua memang sudah tidak
     berguna. */
  if (daftar.length > 20) daftar = daftar.slice(daftar.length - 20);

  try {
    CacheService.getScriptCache().put(kunci, JSON.stringify(daftar), SESI_TTL_DETIK);
  } catch (e) {}
}

function lupakanTokenPengguna_(kode, token) {
  var kunci = kunciSesiPengguna_(kode);
  if (!kunci || !token) return;

  var sisa = bacaDaftarToken_(kunci).filter(function(t) { return t !== token; });
  try {
    CacheService.getScriptCache().put(kunci, JSON.stringify(sisa), SESI_TTL_DETIK);
  } catch (e) {}
}

/**
 * Mengakhiri seluruh sesi milik seorang pengguna.
 *
 * Dipanggil saat perannya berubah, akunnya dinonaktifkan, atau sandinya diganti.
 * Tanpa ini, perubahan itu baru berlaku setelah sesinya berakhir sendiri, yaitu
 * sampai enam jam kemudian, dan tombol nonaktifkan hanya menipu.
 *
 * @return {number} jumlah sesi yang diakhiri
 */
function akhiriSesiPengguna_(kode) {
  var kunci = kunciSesiPengguna_(kode);
  if (!kunci) return 0;

  var daftar = bacaDaftarToken_(kunci);
  var cache = CacheService.getScriptCache();

  for (var i = 0; i < daftar.length; i++) {
    try {
      cache.remove('SESI_' + daftar[i]);
    } catch (e) {}
  }

  try {
    cache.remove(kunci);
  } catch (e) {}

  return daftar.length;
}

/**
 * Membaca sesi dari token.
 * Mengembalikan null bila tokennya kosong, tidak dikenal, atau sudah berakhir.
 */
function sesiDariToken_(token) {
  var kunci = String(token || '').trim();
  if (!kunci) return null;

  var teks = CacheService.getScriptCache().get('SESI_' + kunci);
  if (!teks) return null;

  try {
    return JSON.parse(teks);
  } catch (e) {
    return null;
  }
}

/**
 * Penjaga yang dipanggil di awal setiap RPC yang menyentuh data pesanan.
 *
 * Menolak berarti tidak ada data yang terkirim sama sekali, bukan sekadar
 * menyembunyikan tampilannya. Inilah bedanya penjaga di server dengan
 * menyembunyikan tombol di peramban.
 *
 * @param {string} token token sesi dari peramban
 * @param {string} peranMinimal peran terendah yang boleh menjalankannya
 * @return {Object} data sesi bila berhak
 */
function wajibSesi_(token, peranMinimal) {
  /* Selama WAJIB_LOGIN belum dinyatakan YA, penjaga ini meloloskan semua
     permintaan. Gunanya agar laman masuk dan sesi dapat diuji tanpa risiko
     mengunci siapa pun. Memberlakukan penolakan sekaligus sulit dibatalkan bila
     ada yang salah, karena yang terkunci termasuk pemiliknya. */
  if (!modeWajibLogin_()) {
    return { kode: 'UJI', nama: 'Mode uji, login belum diwajibkan', peran: 'SUPERADMIN', modeUji: true };
  }

  var sesi = sesiDariToken_(token);
  if (!sesi) {
    throw new Error('Sesi tidak berlaku atau sudah berakhir. Masuk ulang untuk melanjutkan.');
  }

  var minimal = String(peranMinimal || 'PACKING').toUpperCase();
  var punya = PERAN_PERINGKAT[sesi.peran] || 0;
  var perlu = PERAN_PERINGKAT[minimal] || 0;

  if (punya < perlu) {
    throw new Error('Peran ' + sesi.peran + ' tidak berhak menjalankan aksi ini. Diperlukan peran ' + minimal + '.');
  }

  return sesi;
}

/**
 * Membaca penanda WAJIB_LOGIN dari sheet Konfigurasi.
 *
 * Bila pembacaannya gagal, hasilnya dianggap TIDAK, supaya kesalahan membaca
 * konfigurasi tidak mengunci seluruh dashboard.
 */
function modeWajibLogin_() {
  try {
    return String(SheetManager.getConfig().WAJIB_LOGIN || '').trim().toUpperCase() === 'YA';
  } catch (e) {
    return false;
  }
}

/**
 * RPC: masuk memakai email akun Google, tanpa sandi.
 *
 * Hanya berhasil bila Apps Script mengenali pemanggilnya dan emailnya terdaftar
 * sebagai pengguna aktif. Bila tidak, dashboard menampilkan formulir kode dan
 * sandi. Pengenalan email hanya tersedia pada sebagian pengaturan deployment,
 * sehingga jalur ini diperlakukan sebagai jalan pintas, bukan satu-satunya jalan.
 */
function masukDenganEmail() {
  var email = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    email = '';
  }

  if (!email) {
    return {
      berhasil: false,
      alasan: 'EMAIL_TIDAK_TERBACA',
      pesan: 'Server tidak mengenali akun Google pemanggil, jadi masuk dengan kode dan sandi.'
    };
  }

  var pengguna = SheetManager.getPenggunaByEmail(email);
  if (!pengguna) {
    return {
      berhasil: false,
      alasan: 'EMAIL_TIDAK_TERDAFTAR',
      email: email,
      pesan: 'Email ' + email + ' belum terdaftar di sheet "Pengguna", jadi masuk dengan kode dan sandi.'
    };
  }

  if (pengguna.aktif !== 'YA') {
    return {
      berhasil: false,
      alasan: 'AKUN_TIDAK_AKTIF',
      email: email,
      pesan: 'Akun ' + pengguna.kode + ' ditandai tidak aktif.'
    };
  }

  var sesi = buatSesi_(pengguna);
  SheetManager.catatMasuk(pengguna.kode);
  SheetManager.logActivity('MASUK', 0, 'SUKSES', 'Masuk lewat akun Google.', '', pengguna.kode);

  return { berhasil: true, token: sesi.token, pengguna: sesi.pengguna };
}

/**
 * RPC: masuk memakai kode dan sandi.
 *
 * Jalur ini yang dipakai di perangkat gudang, karena tidak menuntut akun Google
 * dan tidak menyentuh spreadsheet sama sekali.
 */
function masukDenganKode(kode, sandi) {
  var cache = CacheService.getScriptCache();
  var kodeBersih = String(kode || '').trim().toUpperCase();

  if (!kodeBersih || !String(sandi || '')) {
    throw new Error('Kode dan sandi harus diisi.');
  }

  var kunciGagal = 'GAGAL_MASUK_' + kodeBersih;
  var jumlahGagal = Number(cache.get(kunciGagal) || 0);

  if (jumlahGagal >= BATAS_GAGAL_MASUK) {
    throw new Error('Terlalu banyak percobaan gagal untuk kode ' + kodeBersih + '. Tunggu ' +
      MENIT_KUNCI_GAGAL + ' menit sebelum mencoba lagi.');
  }

  var pengguna = SheetManager.periksaSandi(kodeBersih, sandi);

  if (!pengguna) {
    cache.put(kunciGagal, String(jumlahGagal + 1), MENIT_KUNCI_GAGAL * 60);
    SheetManager.logActivity('MASUK_GAGAL', 0, 'GAGAL',
      'Percobaan masuk gagal untuk kode ' + kodeBersih + ' (percobaan ke-' + (jumlahGagal + 1) + ').');
    throw new Error('Kode atau sandi salah.');
  }

  cache.remove(kunciGagal);

  var sesi = buatSesi_(pengguna);
  SheetManager.catatMasuk(pengguna.kode);
  SheetManager.logActivity('MASUK', 0, 'SUKSES', 'Masuk memakai kode dan sandi.', '', pengguna.kode);

  return { berhasil: true, token: sesi.token, pengguna: sesi.pengguna };
}

/**
 * RPC: menutup sesi yang sedang dipakai.
 *
 * Tokennya dihapus di server, sehingga salinan yang masih tertinggal di peramban
 * tidak dapat dipakai lagi.
 */
function keluarSesi(token) {
  var kunci = String(token || '').trim();
  if (!kunci) return { berhasil: true };

  var sesi = sesiDariToken_(kunci);
  if (sesi) {
    SheetManager.logActivity('KELUAR', 0, 'SUKSES', 'Sesi ditutup.', '', sesi.kode);
    lupakanTokenPengguna_(sesi.kode, kunci);
  }

  CacheService.getScriptCache().remove('SESI_' + kunci);
  return { berhasil: true };
}

/**
 * RPC: memberi tahu peramban siapa yang sedang masuk.
 *
 * Peran selalu dibaca dari sesi di server, bukan dari peramban, sehingga peran
 * tidak dapat dinaikkan dengan mengubah data di peramban.
 */
function siapaSaya(token) {
  var sesi = sesiDariToken_(token);
  if (!sesi) return { masuk: false };

  return { masuk: true, pengguna: sesi, hak: PERAN_PERINGKAT[sesi.peran] || 0 };
}

/* ================== KELOLA PENGGUNA ================== */

/* Diambil dari tabel peringkat supaya tidak ada dua daftar peran yang bisa
   berbeda isi. */
var PERAN_SAH = Object.keys(PERAN_PERINGKAT);
var PANJANG_SANDI_MIN = 6;

/**
 * Memeriksa isian pengguna.
 *
 * Dipisah dari pemanggilnya supaya menu spreadsheet dan layar dashboard memakai
 * pemeriksaan yang sama. Dua pemeriksaan berbeda untuk hal yang sama adalah cara
 * paling mudah membuat aturan bocor lewat jalan yang lebih longgar.
 *
 * @param {Object} data isian dari pemanggil
 * @param {Object|null} lama pengguna yang sedang disunting, bila ada
 * @return {Object} isian yang sudah dibersihkan dan dipastikan sah
 */
function bersihkanIsianPengguna_(data, lama) {
  var isian = data || {};

  var kode = String(isian.kode || '').trim().toUpperCase();
  if (!kode) throw new Error('Kode pengguna harus diisi.');

  /* Batas ini bukan soal selera. Kode dipakai sebagai kunci baris, dan kode yang
     memuat tanda kutip akan merusak tombol yang dibangun dari kode itu. */
  if (!/^[A-Z0-9._-]+$/.test(kode)) {
    throw new Error('Kode hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung, tanpa spasi.');
  }

  var nama = String(isian.nama || '').trim() || (lama ? lama.nama : '');
  if (!nama) throw new Error('Nama pengguna harus diisi.');

  var peran = String(isian.peran || '').trim().toUpperCase() || (lama ? lama.peran : '');
  if (PERAN_SAH.indexOf(peran) === -1) {
    throw new Error('Peran harus salah satu dari: ' + PERAN_SAH.join(', ') + '.');
  }

  var email = String(isian.email || '').trim().toLowerCase();
  if (email && email.indexOf('@') === -1) {
    throw new Error('Email harus memuat tanda @, atau dikosongkan.');
  }

  var sandi = String(isian.sandi || '');

  if (!sandi && !lama) {
    throw new Error('Pengguna baru harus diberi sandi minimal ' + PANJANG_SANDI_MIN + ' karakter.');
  }
  if (sandi && sandi.length < PANJANG_SANDI_MIN) {
    throw new Error('Sandi minimal ' + PANJANG_SANDI_MIN + ' karakter.');
  }
  if (sandi && sandi.toUpperCase() === kode) {
    throw new Error('Sandi tidak boleh sama dengan kode pengguna.');
  }

  return { kode: kode, nama: nama, peran: peran, email: email, sandi: sandi };
}

/**
 * Menolak perubahan yang akan menghabiskan superadmin aktif terakhir.
 *
 * Tanpa pemeriksaan ini, satu kali salah isi dapat mengunci semua orang dari
 * dashboard, dan satu-satunya jalan keluar adalah editor Apps Script.
 */
function tolakBilaSuperadminTerakhir_(lama, peranBaru, aktifBaru) {
  if (!lama || lama.peran !== 'SUPERADMIN' || lama.aktif !== 'YA') return;

  var turunPeran = peranBaru !== 'SUPERADMIN';
  var dinonaktifkan = aktifBaru === 'TIDAK';
  if (!turunPeran && !dinonaktifkan) return;

  if (SheetManager.hitungPenggunaAktif('SUPERADMIN') <= 1) {
    throw new Error('Ini superadmin aktif terakhir. Perannya tidak boleh diturunkan dan akunnya ' +
      'tidak boleh dinonaktifkan, karena tidak akan ada lagi yang dapat mengelola sistem. ' +
      'Buat superadmin lain lebih dulu.');
  }
}

/**
 * RPC: daftar pengguna untuk layar kelola pengguna.
 *
 * Hash dan salt tidak ikut dikirim, karena layar tidak membutuhkannya dan yang
 * tidak dikirim tidak dapat bocor. Dua angka ikut dikirim supaya layar dapat
 * mematikan tombol yang akan ditolak server, sehingga alasannya terlihat sebelum
 * ditekan, bukan sesudahnya.
 */
function ambilDaftarPengguna(token) {
  var sesi = wajibSesi_(token, 'SUPERADMIN');

  return {
    pengguna: SheetManager.getPenggunaRecords(),
    superadminAktif: SheetManager.hitungPenggunaAktif('SUPERADMIN'),
    peranSah: PERAN_SAH,
    panjangSandiMin: PANJANG_SANDI_MIN,
    dimintaOleh: sesi.kode
  };
}

/**
 * RPC: menambah atau mengubah pengguna dari layar kelola pengguna.
 *
 * Sesi orang itu diakhiri bila perannya berubah atau sandinya diganti, supaya
 * perubahan haknya berlaku saat itu juga. Peran disimpan di dalam sesi, jadi
 * tanpa langkah ini orang yang perannya sudah diturunkan masih memegang
 * perannya yang lama sampai sesinya berakhir sendiri.
 */
function simpanPenggunaDariDashboard(token, data) {
  var sesi = wajibSesi_(token, 'SUPERADMIN');

  var kodeAwal = String((data && data.kode) || '').trim().toUpperCase();
  var lama = kodeAwal ? SheetManager.getPenggunaByKode(kodeAwal) : null;
  var isian = bersihkanIsianPengguna_(data, lama);
  var aktifBaru = (lama && lama.aktif === 'TIDAK') ? 'TIDAK' : 'YA';

  tolakBilaSuperadminTerakhir_(lama, isian.peran, aktifBaru);

  var hasil = SheetManager.simpanPengguna({
    kode: isian.kode,
    nama: isian.nama,
    peran: isian.peran,
    email: isian.email,
    sandi: isian.sandi,
    aktif: aktifBaru
  });

  var terbaca = SheetManager.getPenggunaByKode(isian.kode);
  if (!terbaca) {
    throw new Error('Pengguna ' + isian.kode + ' ditulis pada baris ' + hasil.baris +
      ' tetapi tidak terbaca kembali dari sheet. ' + SheetManager.diagnosaPengguna().ringkas);
  }

  var peranBerubah = Boolean(lama && lama.peran !== terbaca.peran);
  var sandiDiganti = Boolean(isian.sandi);
  var jumlahSesi = (peranBerubah || sandiDiganti) ? akhiriSesiPengguna_(terbaca.kode) : 0;

  SheetManager.logActivity('KELOLA_PENGGUNA', 0, 'SUKSES',
    'Pengguna ' + terbaca.kode + ' ' + hasil.aksi + ' dengan peran ' + terbaca.peran +
    (sandiDiganti ? ', sandi diganti' : ', sandi tetap') +
    (jumlahSesi > 0 ? ', ' + jumlahSesi + ' sesi diakhiri' : '') + '.',
    '', sesi.kode);

  return {
    berhasil: true,
    aksi: hasil.aksi,
    baris: hasil.baris,
    sesiDiakhiri: jumlahSesi,
    pengguna: {
      kode: terbaca.kode,
      nama: terbaca.nama,
      peran: terbaca.peran,
      email: terbaca.email,
      aktif: terbaca.aktif
    }
  };
}

/**
 * RPC: menandai pengguna aktif atau tidak aktif dari layar kelola pengguna.
 *
 * Dipisah dari penyimpanan isian supaya perubahan status tidak ikut membawa
 * nama, peran, atau sandi. Yang tidak dikirim tidak akan tertimpa.
 */
function ubahStatusPenggunaDariDashboard(token, kode, aktif) {
  var sesi = wajibSesi_(token, 'SUPERADMIN');

  var cari = String(kode || '').trim().toUpperCase();
  var lama = SheetManager.getPenggunaByKode(cari);
  if (!lama) {
    throw new Error('Pengguna dengan kode ' + cari + ' tidak ada di sheet "Pengguna".');
  }

  var aktifBaru = String(aktif || '').trim().toUpperCase() === 'TIDAK' ? 'TIDAK' : 'YA';
  if (aktifBaru === lama.aktif) {
    return {
      berhasil: true,
      sesiDiakhiri: 0,
      pesan: 'Status ' + lama.kode + ' memang sudah ' + (aktifBaru === 'YA' ? 'aktif' : 'tidak aktif') + '.'
    };
  }

  tolakBilaSuperadminTerakhir_(lama, lama.peran, aktifBaru);

  SheetManager.simpanPengguna({
    kode: lama.kode,
    nama: lama.nama,
    /* Peran wajib ikut dikirim karena simpanPengguna menolak baris tanpa peran.
       Nilainya dibaca dari baris yang sama, jadi tidak ada yang berubah. */
    peran: lama.peran,
    email: lama.email,
    aktif: aktifBaru
  });

  var jumlahSesi = aktifBaru === 'TIDAK' ? akhiriSesiPengguna_(lama.kode) : 0;

  SheetManager.logActivity('UBAH_AKTIF_PENGGUNA', 0, 'SUKSES',
    'Pengguna ' + lama.kode + ' ditandai ' + (aktifBaru === 'YA' ? 'AKTIF' : 'TIDAK AKTIF') +
    (jumlahSesi > 0 ? ', ' + jumlahSesi + ' sesi diakhiri' : '') + '.',
    '', sesi.kode);

  return {
    berhasil: true,
    sesiDiakhiri: jumlahSesi,
    pengguna: { kode: lama.kode, nama: lama.nama, peran: lama.peran, email: lama.email, aktif: aktifBaru },
    pesan: 'Pengguna ' + lama.kode + ' kini ' + (aktifBaru === 'YA' ? 'aktif' : 'tidak aktif') +
      (jumlahSesi > 0 ? ', dan ' + jumlahSesi + ' sesinya diakhiri.' : '.')
  };
}

/**
 * Menu: membuat akun superadmin pertama.
 *
 * Perlu ada karena sheet "Pengguna" awalnya kosong, dan tanpa satu akun pun tidak
 * ada yang dapat masuk. Menu ini menolak berjalan bila superadmin aktif sudah
 * ada, supaya tidak menambah jalan masuk yang tidak diperlukan.
 */
function buatSuperadminPertamaPrompt() {
  var ui = SpreadsheetApp.getUi();

  var sudahAda = SheetManager.hitungPenggunaAktif('SUPERADMIN');
  if (sudahAda > 0) {
    ui.alert('Superadmin Sudah Ada',
      'Sudah ada ' + sudahAda + ' superadmin aktif. Tambah atau ubah pengguna lain langsung dari sheet "Pengguna".',
      ui.ButtonSet.OK);
    return;
  }

  /* Tiga kotak terpisah, bukan satu baris berpemisah. Satu baris menuntut
     pengguna mengingat pemisahnya, dan bila salah, kegagalannya tidak jelas. */
  var jawabKode = ui.prompt('Buat Superadmin Pertama (1 dari 3)',
    'Kode untuk masuk. Huruf atau angka tanpa spasi, misalnya pemilik.',
    ui.ButtonSet.OK_CANCEL);
  if (jawabKode.getSelectedButton() !== ui.Button.OK) return;
  var kode = String(jawabKode.getResponseText() || '').trim();

  var jawabNama = ui.prompt('Buat Superadmin Pertama (2 dari 3)',
    'Nama yang tampil di dashboard.',
    ui.ButtonSet.OK_CANCEL);
  if (jawabNama.getSelectedButton() !== ui.Button.OK) return;
  var nama = String(jawabNama.getResponseText() || '').trim();

  var jawabSandi = ui.prompt('Buat Superadmin Pertama (3 dari 3)',
    'Sandi, minimal 6 karakter. Sandi tidak dapat dilihat kembali, jadi catat di tempat aman.',
    ui.ButtonSet.OK_CANCEL);
  if (jawabSandi.getSelectedButton() !== ui.Button.OK) return;
  var sandi = String(jawabSandi.getResponseText() || '').trim();

  // Disebutkan satu per satu supaya jelas bagian mana yang masih kosong
  var kosong = [];
  if (!kode) kosong.push('kode');
  if (!nama) kosong.push('nama');
  if (!sandi) kosong.push('sandi');

  if (kosong.length > 0) {
    ui.alert('Isian Kosong',
      'Bagian yang masih kosong: ' + kosong.join(', ') + '.\n\nJalankan menu ini lagi dari awal.',
      ui.ButtonSet.OK);
    return;
  }

  if (kode.indexOf(' ') !== -1) {
    ui.alert('Kode Mengandung Spasi',
      'Kode tidak boleh mengandung spasi. Pakai huruf atau angka saja, misalnya pemilik.',
      ui.ButtonSet.OK);
    return;
  }

  if (sandi.toLowerCase() === kode.toLowerCase()) {
    ui.alert('Sandi Terlalu Mudah',
      'Sandi tidak boleh sama dengan kode pengguna.',
      ui.ButtonSet.OK);
    return;
  }

  try {
    var hasil = SheetManager.simpanPengguna({ kode: kode, nama: nama, peran: 'SUPERADMIN', sandi: sandi });

    /* Dibaca ulang dari sheet, bukan dipercaya dari hasil penyimpanan. Bila
       penulisan berhasil tetapi pembacaan tidak menemukannya, itu harus terlihat
       sekarang, bukan nanti saat pengguna mencoba masuk. */
    var terbaca = SheetManager.getPenggunaByKode(kode);

    if (!terbaca) {
      ui.alert('Tersimpan Tetapi Tidak Terbaca',
        'Akun ditulis pada baris ' + hasil.baris + ', tetapi pembacaan ulang tidak menemukannya.\n\n' +
        SheetManager.diagnosaPengguna().ringkas,
        ui.ButtonSet.OK);
      return;
    }

    SheetManager.logActivity('BUAT_PENGGUNA', 0, 'SUKSES', 'Superadmin pertama dibuat: ' + hasil.kode, '', hasil.kode);

    ui.alert('Superadmin Dibuat',
      'Akun tersimpan pada baris ' + hasil.baris + ' dan sudah dibaca ulang dari sheet.\n\n' +
      'Kode: ' + hasil.kode + '\nPeran: ' + terbaca.peran + '\nNama: ' + terbaca.nama + '\n\n' +
      'Sandi tidak dapat dilihat kembali, hanya dapat diganti. Catat di tempat aman sebelum menutup pesan ini.',
      ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Gagal Membuat Akun', err.message || String(err), ui.ButtonSet.OK);
  }
}

/**
 * Menu: menampilkan daftar pengguna, tanpa kolom sandi.
 */
function lihatPenggunaPrompt() {
  var ui = SpreadsheetApp.getUi();
  var daftar = SheetManager.getPenggunaRecords();
  var info = SheetManager.diagnosaPengguna();

  if (daftar.length === 0) {
    ui.alert('Belum Ada Pengguna Terbaca',
      'Tidak ada pengguna yang terbaca oleh sistem.\n\n' +
      info.ringkas +
      '\n\nBila barisnya sebenarnya ada di sheet, bandingkan bagian header di atas dengan kolom yang terlihat di sheet. Bila kodenya ada tetapi tidak di kolom A, itu penyebabnya.',
      ui.ButtonSet.OK);
    return;
  }

  var baris = [];
  for (var i = 0; i < daftar.length; i++) {
    baris.push(daftar[i].kode + ' | ' + daftar[i].peran + ' | ' + daftar[i].nama +
      ' | ' + (daftar[i].email || 'tanpa email') +
      ' | ' + (daftar[i].aktif === 'YA' ? 'aktif' : 'TIDAK AKTIF') +
      ' | masuk terakhir: ' + (daftar[i].terakhir_masuk || 'belum pernah'));
  }

  ui.alert('Daftar Pengguna (' + daftar.length + ')',
    baris.join('\n') + '\n\n' + info.ringkas,
    ui.ButtonSet.OK);
}

/**
 * Menu: menambah atau mengubah pengguna.
 *
 * Perlu ada karena menu pembuatan superadmin pertama hanya membuat satu akun
 * dengan peran SUPERADMIN. Akun admin dan packing dibuat lewat menu ini. Bila
 * kodenya sudah ada, datanya diperbarui; sandi hanya diganti bila diisi.
 */
function kelolaPenggunaPrompt() {
  var ui = SpreadsheetApp.getUi();
  var daftar = SheetManager.getPenggunaRecords();

  var ringkas = daftar.length > 0
    ? daftar.map(function(p) {
        return '  ' + p.kode + ' (' + p.peran + ', ' + (p.aktif === 'YA' ? 'aktif' : 'tidak aktif') + ')';
      }).join('\n')
    : '  (belum ada pengguna)';

  var jawabKode = ui.prompt('Tambah / Ubah Pengguna (1 dari 4)',
    'Kode pengguna. Bila kodenya sudah ada, datanya diperbarui.\n\nPengguna saat ini:\n' + ringkas,
    ui.ButtonSet.OK_CANCEL);
  if (jawabKode.getSelectedButton() !== ui.Button.OK) return;

  var kode = String(jawabKode.getResponseText() || '').trim();
  if (!kode || kode.indexOf(' ') !== -1) {
    ui.alert('Kode Tidak Valid',
      'Kode tidak boleh kosong atau mengandung spasi. Contoh: packing1',
      ui.ButtonSet.OK);
    return;
  }

  var lama = SheetManager.getPenggunaByKode(kode);

  var jawabNama = ui.prompt('Tambah / Ubah Pengguna (2 dari 4)',
    'Nama yang tampil di dashboard.' + (lama ? '\n\nSaat ini: ' + (lama.nama || '(kosong)') : ''),
    ui.ButtonSet.OK_CANCEL);
  if (jawabNama.getSelectedButton() !== ui.Button.OK) return;

  var nama = String(jawabNama.getResponseText() || '').trim() || (lama ? lama.nama : '');
  if (!nama) {
    ui.alert('Nama Kosong', 'Nama pengguna harus diisi.', ui.ButtonSet.OK);
    return;
  }

  var jawabPeran = ui.prompt('Tambah / Ubah Pengguna (3 dari 4)',
    'Peran: PACKING, ADMIN, atau SUPERADMIN.' + (lama ? '\n\nSaat ini: ' + lama.peran : ''),
    ui.ButtonSet.OK_CANCEL);
  if (jawabPeran.getSelectedButton() !== ui.Button.OK) return;

  var peran = String(jawabPeran.getResponseText() || '').trim().toUpperCase();
  if (['PACKING', 'ADMIN', 'SUPERADMIN'].indexOf(peran) === -1) {
    ui.alert('Peran Tidak Dikenal', 'Isi salah satu dari: PACKING, ADMIN, SUPERADMIN.', ui.ButtonSet.OK);
    return;
  }

  /* Superadmin aktif terakhir tidak boleh diturunkan perannya, karena setelah
     itu tidak ada lagi yang dapat mengelola sistem. */
  if (lama && lama.peran === 'SUPERADMIN' && peran !== 'SUPERADMIN' &&
      SheetManager.hitungPenggunaAktif('SUPERADMIN') <= 1) {
    ui.alert('Superadmin Terakhir',
      'Tidak boleh menurunkan peran superadmin aktif terakhir.\n\nBuat superadmin lain lebih dulu.',
      ui.ButtonSet.OK);
    return;
  }

  var jawabSandi = ui.prompt('Tambah / Ubah Pengguna (4 dari 4)',
    lama
      ? 'Sandi baru, minimal 6 karakter. Kosongkan bila tidak ingin menggantinya.'
      : 'Sandi, minimal 6 karakter. Tidak dapat dilihat kembali, jadi catat di tempat aman.',
    ui.ButtonSet.OK_CANCEL);
  if (jawabSandi.getSelectedButton() !== ui.Button.OK) return;

  var sandi = String(jawabSandi.getResponseText() || '').trim();

  if (!sandi && !lama) {
    ui.alert('Sandi Kosong', 'Pengguna baru harus diberi sandi minimal 6 karakter.', ui.ButtonSet.OK);
    return;
  }

  if (sandi && sandi.toLowerCase() === kode.toLowerCase()) {
    ui.alert('Sandi Terlalu Mudah', 'Sandi tidak boleh sama dengan kode pengguna.', ui.ButtonSet.OK);
    return;
  }

  try {
    var hasil = SheetManager.simpanPengguna({ kode: kode, nama: nama, peran: peran, sandi: sandi });
    var terbaca = SheetManager.getPenggunaByKode(kode);

    if (!terbaca) {
      ui.alert('Tersimpan Tetapi Tidak Terbaca',
        'Pengguna ditulis pada baris ' + hasil.baris + ', tetapi pembacaan ulang tidak menemukannya.\n\n' +
        SheetManager.diagnosaPengguna().ringkas,
        ui.ButtonSet.OK);
      return;
    }

    SheetManager.logActivity('BUAT_PENGGUNA', 0, 'SUKSES',
      'Pengguna ' + hasil.kode + ' disimpan dengan peran ' + terbaca.peran + '.', '', hasil.kode);

    /* Peran dibaca dari sesi, jadi peran yang lama masih berlaku sampai sesinya
       berakhir sendiri. Bila perannya berubah atau sandinya diganti, sesinya
       diakhiri supaya perubahannya berlaku sekarang juga. */
    var jumlahSesi = (Boolean(lama && lama.peran !== terbaca.peran) || Boolean(sandi))
      ? akhiriSesiPengguna_(terbaca.kode)
      : 0;

    ui.alert('Pengguna Disimpan',
      hasil.aksi.toUpperCase() + ' pada baris ' + hasil.baris + ' dan sudah dibaca ulang dari sheet.\n\n' +
      'Kode: ' + terbaca.kode + '\nPeran: ' + terbaca.peran + '\nNama: ' + terbaca.nama + '\n' +
      (sandi ? 'Sandi baru sudah berlaku.' : 'Sandi lama tetap berlaku.') +
      (jumlahSesi > 0 ? '\n\n' + jumlahSesi + ' sesi yang sedang berjalan untuk akun ini diakhiri, ' +
        'sehingga perubahannya berlaku sekarang.' : ''),
      ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Gagal Menyimpan Pengguna', err.message || String(err), ui.ButtonSet.OK);
  }
}

/**
 * Menu: mengaktifkan atau menonaktifkan pengguna.
 *
 * Menonaktifkan lebih baik daripada menghapus barisnya, karena nama pelakunya
 * pada Log_Aktivitas tetap dapat ditelusuri setelah akunnya tidak dipakai lagi.
 */
function ubahAktifPenggunaPrompt() {
  var ui = SpreadsheetApp.getUi();
  var daftar = SheetManager.getPenggunaRecords();

  if (daftar.length === 0) {
    ui.alert('Belum Ada Pengguna', 'Sheet "Pengguna" masih kosong.', ui.ButtonSet.OK);
    return;
  }

  var ringkas = daftar.map(function(p) {
    return '  ' + p.kode + ' (' + p.peran + ', ' + (p.aktif === 'YA' ? 'aktif' : 'tidak aktif') + ')';
  }).join('\n');

  var jawab = ui.prompt('Aktifkan / Nonaktifkan Pengguna',
    'Kode pengguna yang ingin diubah.\n\nPengguna saat ini:\n' + ringkas,
    ui.ButtonSet.OK_CANCEL);
  if (jawab.getSelectedButton() !== ui.Button.OK) return;

  var pengguna = SheetManager.getPenggunaByKode(String(jawab.getResponseText() || '').trim());

  if (!pengguna) {
    ui.alert('Kode Tidak Ditemukan', 'Kode itu tidak ada di sheet "Pengguna".', ui.ButtonSet.OK);
    return;
  }

  var akanNonaktif = pengguna.aktif === 'YA';

  /* Superadmin aktif terakhir tidak boleh dinonaktifkan, karena itu mengunci
     semua orang dari dashboard. */
  if (akanNonaktif && pengguna.peran === 'SUPERADMIN' &&
      SheetManager.hitungPenggunaAktif('SUPERADMIN') <= 1) {
    ui.alert('Superadmin Terakhir',
      'Tidak boleh menonaktifkan superadmin aktif terakhir, karena tidak akan ada lagi yang dapat mengelola sistem.\n\nBuat atau aktifkan superadmin lain lebih dulu.',
      ui.ButtonSet.OK);
    return;
  }

  var konfirmasi = ui.alert('Konfirmasi',
    'Pengguna ' + pengguna.kode + ' (' + pengguna.nama + ') akan ditandai ' +
    (akanNonaktif ? 'TIDAK AKTIF' : 'AKTIF') + '.',
    ui.ButtonSet.YES_NO);

  if (konfirmasi !== ui.Button.YES) return;

  try {
    SheetManager.simpanPengguna({
      kode: pengguna.kode,
      nama: pengguna.nama,
      peran: pengguna.peran,
      email: pengguna.email,
      aktif: akanNonaktif ? 'TIDAK' : 'YA'
    });

    SheetManager.logActivity('UBAH_AKTIF_PENGGUNA', 0, 'SUKSES',
      'Pengguna ' + pengguna.kode + ' ditandai ' + (akanNonaktif ? 'TIDAK AKTIF' : 'AKTIF') + '.');

    /* Menonaktifkan akun harus mencabut aksesnya sekarang, bukan setelah sesinya
       berakhir sendiri. Sesinya hanya ada di cache, jadi hanya di sini tempat
       menemukannya. */
    var jumlahSesi = akanNonaktif ? akhiriSesiPengguna_(pengguna.kode) : 0;

    ui.alert('Selesai',
      'Pengguna ' + pengguna.kode + ' kini ' + (akanNonaktif ? 'TIDAK AKTIF' : 'AKTIF') +
      '.\n\nSandi dan perannya tidak berubah.' +
      (jumlahSesi > 0 ? '\n\n' + jumlahSesi + ' sesi yang sedang berjalan diakhiri, sehingga aksesnya ' +
        'benar-benar berhenti sekarang.' : ''),
      ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Gagal Mengubah Status', err.message || String(err), ui.ButtonSet.OK);
  }
}

/**
 * RPC: Memperbarui Status Internal Begood langsung dari tabel Web Dashboard
 */
function updateOrderStatusInternal(token, orderSn, newStatus) {
  var sesi = wajibSesi_(token, 'PACKING');

  if (!orderSn || !newStatus) {
    throw new Error('No Pesanan atau status baru tidak valid.');
  }

  var ok = SheetManager.updateInternalStatus(orderSn, newStatus);
  if (!ok) {
    throw new Error('Pesanan dengan No ' + orderSn + ' tidak ditemukan di sheet.');
  }

  SheetManager.logActivity('UPDATE_STATUS', 1, 'SUKSES',
    'Status pesanan ' + orderSn + ' diubah menjadi "' + newStatus + '" via Dashboard.',
    '', sesi.kode);
  invalidateDashboardCache();
  return { success: true };
}

/**
 * RPC: Memperbarui Status Internal Begood untuk banyak pesanan sekaligus (Batch)
 */
function updateBatchOrderStatusInternal(token, orderSnList, newStatus) {
  var sesi = wajibSesi_(token, 'PACKING');

  if (!orderSnList || !orderSnList.length || !newStatus) {
    throw new Error('Daftar nomor pesanan atau status baru tidak valid.');
  }

  var ok = SheetManager.updateBatchInternalStatus(orderSnList, newStatus);
  if (!ok) {
    throw new Error('Gagal memperbarui status pesanan terpilih.');
  }

  /* Pelakunya dicatat. Inilah nilai utama pembatasan peran bagi operasi gudang:
     perubahan status dapat ditelusuri ke orangnya, bukan hanya ke waktunya. */
  SheetManager.logActivity('UPDATE_STATUS_BATCH', orderSnList.length, 'SUKSES',
    'Status ' + orderSnList.length + ' pesanan diubah menjadi "' + newStatus + '" via Dashboard.',
    '', sesi.kode);
  invalidateDashboardCache();
  return { success: true, count: orderSnList.length };
}

/**
 * RPC: Menjalankan sinkronisasi pesanan dari tombol Web Dashboard
 */
function triggerSyncOrders(token, days, kodeToko) {
  wajibSesi_(token, 'ADMIN');

  var syncDays = Number(days) || 3;
  var cakupan = String(kodeToko || '').trim().toUpperCase();
  var res = syncOrdersCore(syncDays, true, cakupan);
  invalidateDashboardCache();
  return {
    success: true,
    message: res.message || ('Sinkronisasi pesanan (' + syncDays + ' hari) berhasil!')
  };
}

/**
 * RPC: Menjalankan sinkronisasi pesanan berdasarkan Order SN dari Web Dashboard
 */
function triggerSyncBySn(token, orderSn) {
  wajibSesi_(token, 'ADMIN');

  if (!orderSn || !orderSn.trim()) {
    throw new Error('Nomor Pesanan (Order SN) tidak boleh kosong.');
  }
  var res = syncOrdersBySnCore(orderSn.trim(), true);
  invalidateDashboardCache();
  return {
    success: true,
    message: res.message
  };
}

/**
 * RPC: Refresh Token Shopee dari tombol Web Dashboard
 */
function refreshTokenFromDashboard(token, kodeToko) {
  wajibSesi_(token, 'SUPERADMIN');

  var kode = String(kodeToko || '').trim().toUpperCase();

  /* Refresh token hanya berlaku untuk satu toko. Bila tokonya tidak disebutkan,
     menebak rekaman pertama berisiko memperbarui token toko yang salah. */
  if (!kode) {
    throw new Error('Pilih satu toko pada pemilih cakupan lebih dulu, karena refresh token berlaku per toko.');
  }

  var daftar;
  try {
    daftar = SheetManager.getTokoUntukSync(kode);
  } catch (err) {
    throw new Error(err.message || String(err));
  }

  if (daftar.length === 0) {
    throw new Error('Tidak ada toko aktif dengan kode "' + kode + '" di sheet DB_Token.');
  }

  var tokenRec = daftar[0];
  if (!tokenRec.refresh_token) {
    throw new Error('Refresh token untuk toko ' + kode +
      ' belum ada di DB_Token. Jalankan otorisasi Shopee untuk toko itu.');
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

    invalidateDashboardCache();
    SheetManager.logActivity('MANUAL_REFRESH_TOKEN', 0, 'SUKSES',
      'Token toko ' + kode + ' diperbarui melalui Web Dashboard.', kode);
    return {
      success: true,
      message: 'Token toko ' + kode + ' berhasil diperbarui! Berlaku hingga: ' +
        (res.data.expired_at_formatted || '4 jam ke depan')
    };
  } else {
    throw new Error(res.message || 'Gagal memperbarui token Shopee.');
  }
}

/**
 * RPC: Menyimpan JSON token hasil otorisasi dari Web Dashboard
 */
function saveTokenFromDashboard(token, jsonString) {
  wajibSesi_(token, 'SUPERADMIN');

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

  invalidateDashboardCache();
  SheetManager.logActivity('MANUAL_PASTE_TOKEN', 0, 'SUKSES', 'Token berhasil disimpan via Web Dashboard.');
  return {
    success: true,
    message: 'Token Shopee berhasil disimpan dan status saat ini AKTIF!'
  };
}

/**
 * Menu: mengisi kolom Toko pada baris pesanan lama.
 *
 * Hanya dipakai sekali saat migrasi ke multi-toko, karena seluruh data lama
 * berasal dari satu toko. Fungsi ini idempoten: baris yang kolom Tokonya sudah
 * terisi tidak diubah, jadi aman dijalankan berulang.
 */
function backfillKodeTokoPrompt() {
  var ui = SpreadsheetApp.getUi();

  var saran = '';
  try {
    var records = SheetManager.getTokenRecords();
    for (var i = 0; i < records.length; i++) {
      if (records[i].kode_toko) {
        saran = records[i].kode_toko;
        break;
      }
    }
  } catch (e) {}

  if (!saran) {
    ui.alert(
      'Kode Toko Belum Diisi',
      'Isi dulu kolom "Kode Toko" (kolom J) pada sheet DB_Token, misalnya BGD.\n\n' +
      'Kode toko itu dipakai sebagai penanda pada kolom Toko di sheet Pesanan Masuk.',
      ui.ButtonSet.OK
    );
    return;
  }

  var response = ui.prompt(
    'Isi Kolom Toko untuk Baris Lama',
    'Kode toko yang akan diisi: ' + saran + '\n\n' +
    'Hanya baris yang kolom Tokonya masih kosong yang akan diisi. ' +
    'Baris yang sudah terisi tidak diubah.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  var kode = String(response.getResponseText() || '').trim().toUpperCase() || saran;

  try {
    var hasil = SheetManager.backfillKodeToko(kode);

    SheetManager.logActivity(
      'BACKFILL_TOKO',
      hasil.diisi,
      'SUKSES',
      'Mengisi kode toko ' + kode + ' pada ' + hasil.diisi + ' baris lama di Pesanan Masuk.'
    );
    invalidateDashboardCache();

    ui.alert(
      'Selesai',
      'Kode toko ' + kode + ' diisi pada ' + hasil.diisi + ' baris.\n' +
      hasil.dilewati + ' baris dilewati karena kolom Tokonya sudah terisi.\n' +
      hasil.kosong + ' baris dilewati karena tidak punya nomor pesanan.',
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Kesalahan', 'Gagal mengisi kolom Toko: ' + err.message, ui.ButtonSet.OK);
  }
}

/**
 * Menu: menampilkan identitas pemanggil seperti yang dilihat server.
 *
 * Dipakai sebelum merancang pembatasan peran, karena Apps Script hanya
 * memberikan email pemanggil pada kondisi deployment tertentu. Bila email
 * kosong, pembatasan peran tidak dapat bersandar pada akun Google dan harus
 * memakai kode serta sandi sendiri.
 */
function cekIdentitasPenggunaPrompt() {
  var ui = SpreadsheetApp.getUi();

  var aktif = '';
  var efektif = '';
  var kunci = '';
  var galat = [];

  try {
    aktif = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    galat.push('getActiveUser: ' + e.message);
  }

  try {
    efektif = Session.getEffectiveUser().getEmail() || '';
  } catch (e) {
    galat.push('getEffectiveUser: ' + e.message);
  }

  try {
    kunci = Session.getTemporaryActiveUserKey() || '';
  } catch (e) {
    galat.push('getTemporaryActiveUserKey: ' + e.message);
  }

  var baris = [];
  baris.push('Email pemanggil (getActiveUser): ' + (aktif || '(KOSONG)'));
  baris.push('Email pemilik skrip (getEffectiveUser): ' + (efektif || '(KOSONG)'));
  baris.push('Kunci sementara pemanggil: ' + (kunci || '(KOSONG)'));
  baris.push('');
  baris.push('Cara membaca hasil ini:');
  baris.push('  Email KOSONG berarti server tidak mengenali pemanggilnya. Itu terjadi bila Web App dijalankan sebagai pemilik skrip, atau pemanggilnya tidak masuk dengan akun Google. Pada keadaan itu, pembatasan peran harus memakai kode dan sandi sendiri.');
  baris.push('  Email terisi dan sama dengan email Anda berarti deployment dijalankan atas nama pemilik skrip, sehingga email pemanggil tidak dapat dipakai untuk membedakan orang.');
  baris.push('  Kunci sementara selalu ada tanpa izin tambahan, tetapi berganti sekitar sebulan sekali sehingga tidak cocok menjadi identitas tetap.');

  if (galat.length > 0) {
    baris.push('');
    baris.push('Galat: ' + galat.join(' | '));
  }

  SheetManager.logActivity('CEK_IDENTITAS', 0, 'SUKSES',
    'Pemeriksaan identitas pemanggil. Email: ' + (aktif || '(kosong)'));

  ui.alert('Identitas Pemanggil', baris.join('\n'), ui.ButtonSet.OK);
}

/**
 * Menu: menampilkan isi DB_Token seperti yang dibaca sistem.
 *
 * Dipakai saat kode atau nama toko tidak muncul di dashboard, karena penyebab
 * yang paling sering adalah kolom yang bergeser atau baris header yang tidak
 * sesuai dugaan.
 */
function cekIsiDbTokenPrompt() {
  var ui = SpreadsheetApp.getUi();

  var d;
  try {
    d = SheetManager.diagnosaToken();
  } catch (err) {
    ui.alert('Gagal Membaca DB_Token', err.message || String(err), ui.ButtonSet.OK);
    return;
  }

  var header = [];
  for (var h = 0; h < d.headerAktual.length; h++) {
    header.push((h + 1) + ' (' + kolomKeHuruf_(h + 1) + ') ' + (d.headerAktual[h] || '(kosong)'));
  }

  var isi = [];
  isi.push('HEADER baris 1 yang dibaca sistem:');
  isi.push(header.length > 0 ? '  ' + header.join('\n  ') : '  (kosong)');
  isi.push('');
  isi.push('Kolom "Kode Toko": ' + letakKolom_(d.posisiKodeToko));
  isi.push('Kolom "Nama Toko": ' + letakKolom_(d.posisiNamaToko));
  isi.push('');
  isi.push('Isi mentah kolom J: ' + kutip_(d.isiKolomJ));
  isi.push('Isi mentah kolom I: ' + kutip_(d.isiKolomI));
  isi.push('');
  isi.push('Rekaman token yang terbaca sistem: ' + d.jumlahRekaman);

  for (var r = 0; r < d.rekaman.length; r++) {
    var t = d.rekaman[r];
    isi.push('  ' + (r + 1) + '. shop_id=' + (t.shop_id || '(kosong)') +
      '  nama_toko=' + (t.nama_toko || '(KOSONG)') +
      '  kode_toko=' + (t.kode_toko || '(KOSONG)') +
      '  aktif=' + t.aktif +
      '  token=' + (t.ada_token ? 'ada' : 'TIDAK ADA'));
  }

  ui.alert('Isi DB_Token', isi.join('\n'), ui.ButtonSet.OK);
}

/**
 * Menyebutkan letak kolom dari hasil pencarian nama kolom pada baris header.
 */
function letakKolom_(posisi) {
  if (posisi < 0) return 'TIDAK DITEMUKAN di baris header';
  return 'kolom ke-' + (posisi + 1) + ' (' + kolomKeHuruf_(posisi + 1) + ')';
}

function kutip_(daftar) {
  if (!daftar || daftar.length === 0) return '(tidak ada baris)';
  var bagian = [];
  for (var i = 0; i < daftar.length; i++) {
    bagian.push('"' + (daftar[i] || '') + '"');
  }
  return bagian.join(', ');
}

function kolomKeHuruf_(nomor) {
  var teks = '';
  while (nomor > 0) {
    teks = String.fromCharCode(65 + ((nomor - 1) % 26)) + teks;
    nomor = Math.floor((nomor - 1) / 26);
  }
  return teks;
}

/**
 * RPC: Mengaktifkan atau mematikan trigger otomatis sinkronisasi 1 jam
 */
function toggleTrigger(token, enable) {
  wajibSesi_(token, 'SUPERADMIN');

  removeTriggers();
  var props = PropertiesService.getScriptProperties();
  if (enable) {
    ScriptApp.newTrigger('automatedSyncTrigger')
      .timeBased()
      .everyHours(1)
      .create();

    props.setProperty('IS_TRIGGER_ACTIVE', 'true');
    invalidateDashboardCache();
    SheetManager.logActivity('TRIGGER_TOGGLE', 0, 'SUKSES', 'Trigger otomatis diaktifkan via Web Dashboard.');
    return {
      success: true,
      isActive: true,
      message: 'Trigger otomatis (setiap 1 jam) berhasil diaktifkan!'
    };
  } else {
    props.setProperty('IS_TRIGGER_ACTIVE', 'false');
    invalidateDashboardCache();
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
function pingMiddleware(token) {
  wajibSesi_(token, 'PACKING');

  var res = ShopeeApi.checkHealth();
  return {
    status: res.status || 'READY',
    message: res.message || 'Koneksi ke middleware Vercel lancar.'
  };
}

/**
 * RPC: Menghasilkan URL otorisasi Shopee untuk modal otorisasi di Web Dashboard
 */
function getAuthUrlFromDashboard(token) {
  wajibSesi_(token, 'SUPERADMIN');

  var res = ShopeeApi.getAuthUrl();
  if (res.success && res.data && res.data.auth_url) {
    return {
      url: res.data.auth_url
    };
  } else {
    throw new Error(res.message || 'Gagal menghasilkan URL otorisasi.');
  }
}

/* ================== PEMBATASAN DATA KEUANGAN ================== */

/* Hanya peran ini yang menerima nominal uang.
 *
 * Peran lain tidak menerimanya sama sekali, bukan hanya disembunyikan di
 * peramban, karena jawaban sebuah RPC dapat dibaca siapa saja yang membuka
 * konsol peramban. Menyembunyikan kolomnya tanpa memotong isi jawabannya hanya
 * memindahkan tempat membacanya. */
var PERAN_LIHAT_UANG = 'SUPERADMIN';

function bolehLihatUang_(sesi) {
  return String((sesi && sesi.peran) || '').toUpperCase() === PERAN_LIHAT_UANG;
}

/**
 * Membuang kolom nominal dari satu daftar baris pesanan.
 *
 * Yang dibuang hanya nominalnya. Jumlah barang, ekspedisi, dan nomor resi tetap
 * ada, karena itu yang dipakai bekerja dan bukan keterangan keuangan.
 */
function tanpaUangBaris_(baris) {
  var daftar = baris || [];
  var hasil = [];

  for (var i = 0; i < daftar.length; i++) {
    var r = daftar[i];
    if (!r || typeof r !== 'object') { hasil.push(r); continue; }

    delete r.totalAmount;
    delete r.shippingFee;
    hasil.push(r);
  }

  return hasil;
}

/**
 * Membuang seluruh angka keuangan dari payload dashboard, lalu menandainya.
 *
 * Penandanya dipakai layar untuk menyembunyikan tempatnya. Angka yang tidak ada
 * tidak boleh ditulis sebagai Rp 0, karena itu angka yang tidak benar.
 */
function tanpaUangDashboard_(data) {
  if (!data) return data;

  if (data.stats) {
    delete data.stats.totalRevenue;
  }

  data.orders = tanpaUangBaris_(data.orders);

  var seri = data.seriHarian || [];
  for (var i = 0; i < seri.length; i++) {
    delete seri[i].omzet;
  }

  data.uangDisembunyikan = true;
  return data;
}

/**
 * RPC: Membaca baris pesanan untuk ekspor PDF dengan jumlah baris penuh.
 * Dipakai tombol "Ekspor PDF" di Web Dashboard. Fungsi ini sengaja tidak
 * memakai CacheService, karena tujuannya membaca data saat itu juga.
 *
 * @param {number} limit jumlah baris terakhir yang dibaca, bawaan 2000
 */
function getOrderRowsForExport(token, limit, kodeToko) {
  var sesi = wajibSesi_(token, 'ADMIN');

  var cakupan = String(kodeToko || '').trim().toUpperCase();
  var rows = SheetManager.getOrderRowsForExport(limit, cakupan);
  SheetManager.logActivity(
    'EXPORT_ORDER_ROWS',
    rows.length,
    'SUKSES',
    'Membaca ' + rows.length + ' baris pesanan untuk ekspor PDF via Dashboard' +
      (cakupan ? ' untuk toko ' + cakupan : ' untuk semua toko') + '.',
    cakupan || 'SEMUA'
  );
  return bolehLihatUang_(sesi) ? rows : tanpaUangBaris_(rows);
}

/**
 * RPC: Membaca baris pesanan berdasarkan kata kunci status internal.
 *
 * Dipakai filter status di Web Dashboard. Payload dashboard hanya membawa 80
 * baris terbaru demi kecepatan, sedangkan statistik seperti stats.siapPacking
 * dihitung dari seluruh baris sheet. Tanpa RPC ini, memilih "[1] Siap Packing"
 * bisa menampilkan tabel kosong padahal sheet masih memuat antriannya.
 *
 * Tidak ditulis ke Log_Aktivitas, karena ini pembacaan untuk tampilan, bukan
 * aksi ekspor, dan akan membanjiri log bila dicatat tiap kali filter diubah.
 *
 * @param {string} statusKeyword kata kunci status, misalnya 'Siap Packing'
 * @param {number} limit jumlah baris maksimum, bawaan 500
 * @param {string} [kodeToko] cakupan toko. Kosong berarti seluruh toko.
 */
function getOrderRowsByStatus(token, statusKeyword, limit, kodeToko) {
  var sesi = wajibSesi_(token, 'PACKING');

  var keyword = String(statusKeyword || '').trim();
  if (!keyword) {
    throw new Error('Kata kunci status tidak boleh kosong.');
  }

  var rows = SheetManager.getOrderRowsByStatus(keyword, limit, kodeToko);
  return bolehLihatUang_(sesi) ? rows : tanpaUangBaris_(rows);
}

/**
 * RPC: Menghitung jumlah pesanan untuk setiap nilai di kolom Status Internal
 * Begood (kolom D).
 *
 * Dipakai dashboard untuk menyusun pilihan filter status dari data yang
 * benar-benar ada di sheet, bukan dari daftar tetap di kode. Bila kolom D
 * berisi nilai di luar daftar resmi, atau bahkan kosong, pengguna melihatnya
 * langsung pada pilihan filter.
 */
function getStatusInventory(token, kodeToko) {
  wajibSesi_(token, 'PACKING');

  return SheetManager.getStatusInventory(kodeToko);
}

/* ============================================================================
   PRODUKSI & ESTIMASI
   ============================================================================

   Dua sheet yang dipakai modul ini:

     DATA PROSES  daftar harga dan waktu proses per SKU. Satu baris mewakili
                  satu SKU, jadi harganya berlaku untuk seluruh variasi dan
                  seluruh pesanannya. Isinya diisi manusia lewat panel "Harga
                  dan waktu proses"; SKU yang belum pernah dihargai langsung
                  mendapat baris baru saat disimpan.
     DATA JAHIT   hasil jahit per baris pesanan, lengkap dengan nomor pesanannya.

   Daftar kerjanya tidak disimpan di sheet mana pun. Isinya dibaca langsung dari
   pesanan berstatus "[2] Menunggu Pickup" pada sheet Pesanan Masuk, karena
   daftar itu memang berubah setiap kali status pesanannya berubah. Yang perlu
   diisi manusia karena tidak ada di pesanan hanya dua: harga per SKU, serta sesi
   dan nama penjahit pada baris hasil jahitnya.
   ============================================================================ */

/* Batas baris antrian yang dibaca dalam satu kali buka.
   Pembaca status bawaan hanya menjangkau 5.000 baris terakhir Pesanan Masuk
   (lihat jendelaBaca pada SheetManager.getOrderRowsByStatus), dan angka ini
   sengaja dibuat lebih kecil supaya pembacaannya tidak pernah meminta lebih jauh
   daripada yang benar-benar dapat dibaca. */
var BATAS_ANTRIAN_PRODUKSI = 2000;

var SESI_PRODUKSI = ['PAGI', 'SIANG'];

/* Kata kunci status internal. Pencocokannya memakai indexOf, bukan kesamaan
   penuh, supaya nilai "[2] Menunggu Pickup" tetap cocok walaupun nomor
   kurungnya berubah. */
var STATUS_ANTRIAN_PRODUKSI = 'Menunggu Pickup';

/** Stempel waktu WIB untuk kolom Ditarik dan catatan log. */
function stempelWib_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
}

/** Tanggal kerja hari ini menurut WIB, dalam bentuk yyyy-MM-dd. */
function tanggalWibHariIni_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
}

/**
 * Angka dari masukan pengguna, yang selalu datang sebagai teks dari halaman.
 *
 * Nilai yang tidak dapat dibaca dianggap 0, bukan dibiarkan NaN. NaN yang lolos
 * ke dalam penjumlahan akan membuat seluruh total pada satu halaman menjadi NaN,
 * dan satu baris salah isi tidak boleh merusak satu laporan.
 */
function angkaProduksi_(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return 0;
  if (typeof nilai === 'number') return isFinite(nilai) ? nilai : 0;
  var teks = String(nilai).trim().replace(/^Rp\s?/i, '');
  if (!teks) return 0;
  if (teks.indexOf(',') >= 0 && teks.indexOf('.') < 0) teks = teks.replace(',', '.');
  else teks = teks.replace(/\./g, '');
  var num = parseFloat(teks);
  return isNaN(num) ? 0 : num;
}

/** Sesi kerja yang sah. Nilai lain dikembalikan kosong supaya bisa ditolak. */
function sesiProduksi_(nilai) {
  var teks = String(nilai === null || nilai === undefined ? '' : nilai).trim().toUpperCase();
  return SESI_PRODUKSI.indexOf(teks) >= 0 ? teks : '';
}

/**
 * Bentuk baku sebuah teks untuk kunci kamus harga.
 *
 * Spasi berlebih dan besar-kecil huruf tidak boleh membuat dua penulisan SKU
 * yang sama dianggap berbeda barang.
 */
function kunciSkuProduksi_(nilai) {
  return String(nilai === null || nilai === undefined ? '' : nilai)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Nilai dari satu baris DATA PROSES disalin ke entri kamus.
 *
 * Penyalinan dilakukan per kolom, bukan per baris. Inilah yang membedakannya
 * dari pembaca pada dashboard produksi lama, yang menimpa seluruh entri dengan
 * baris terakhir: di sana satu baris baru tanpa harga sudah cukup untuk membuat
 * upah sebuah SKU menjadi nol. Di sini nilai nol atau kosong tidak pernah
 * menimpa nilai yang sudah terisi.
 */
function terapkanNilaiKamus_(kamus, kunci, sku, harga, jahit, potong) {
  if (!kunci) return;

  var entri = kamus[kunci];
  if (!entri) {
    entri = { sku: sku, harga: 0, waktuJahit: 0, waktuPotong: 0 };
    kamus[kunci] = entri;
  }

  if (harga > 0) entri.harga = harga;
  if (jahit > 0) entri.waktuJahit = jahit;
  if (potong > 0) entri.waktuPotong = potong;
}

/**
 * Kunci pencarian kamus harga untuk satu baris pekerjaan, dari yang paling khusus.
 *
 * Dua bentuk dicoba berurutan: gabungan SKU dan variasinya lebih dulu, lalu nama
 * SKU apa adanya. Bentuk pertama yang membuat satu variasi dapat punya harga
 * tersendiri walaupun DATA PROSES hanya menyimpan satu kolom SKU, karena baris
 * khusus itu memang ditulis dengan nama gabungan, misalnya "SARKUR 120/5 COFFEE".
 * Nama variasi yang hanya berisi tanda "-" tidak ikut digabungkan, sebab tanda
 * itu dipakai pesanan untuk mengatakan "tidak ada variasi".
 *
 * @return {Array<string>} kandidat kunci, yang paling khusus lebih dahulu
 */
function kandidatKunciProses_(sku, variasi) {
  var hasil = [];
  var kunciSku = kunciSkuProduksi_(sku);
  if (!kunciSku) return hasil;

  var teksVariasi = SheetManager.bersihkanVariasi(variasi);
  if (teksVariasi && teksVariasi !== '-') {
    hasil.push(kunciSkuProduksi_(String(sku).trim() + ' ' + teksVariasi));
  }
  hasil.push(kunciSku);

  return hasil;
}

/**
 * Kamus harga proses, berkunci nama SKU.
 *
 * Hanya ada satu lapis karena DATA PROSES memang hanya menyimpan satu baris per
 * SKU. Harga yang khusus berlaku untuk satu variasi tetap dapat ditulis, yaitu
 * sebagai baris dengan nama gabungan SKU dan variasinya.
 *
 * @param {Array<Object>} daftar baris dari SheetManager.bacaProses()
 * @return {Object} kamus berisi bySku
 */
function bangunKamusProses_(daftar) {
  var kamus = { bySku: {} };
  var baris = daftar || [];

  for (var i = 0; i < baris.length; i++) {
    var it = baris[i];
    var sku = it.sku ? String(it.sku).trim() : '';
    if (!sku) continue;

    var harga = Number(it.harga) || 0;
    var jahit = Number(it.waktuJahit) || 0;
    var potong = Number(it.waktuPotong) || 0;

    /* Baris yang belum dihargai tidak berguna bagi kamus, dan baris lama tidak
       boleh kehilangan entrinya hanya karena ada baris baru yang masih kosong. */
    if (harga <= 0 && jahit <= 0 && potong <= 0) continue;

    /* Nama baris DATA PROSES dipangkas dengan aturan yang sama, sebab sebagian
       ditulis sebagai gabungan SKU dan variasinya. Tanpa itu, baris harga lama
       "SARKUR 100/10 LILAC,BC 90X220" tidak lagi cocok dengan variasi "Lilac". */
    terapkanNilaiKamus_(kamus.bySku, kunciSkuProduksi_(SheetManager.bersihkanVariasi(sku)),
      sku, harga, jahit, potong);
  }

  return kamus;
}

/**
 * Harga dan waktu untuk satu baris pekerjaan.
 *
 * @return {Object|null} entri berisi sku, harga, waktuJahit, waktuPotong
 */
function cariProsesSku_(kamus, sku, variasi) {
  if (!kamus || !sku) return null;

  var kandidat = kandidatKunciProses_(sku, variasi);
  for (var i = 0; i < kandidat.length; i++) {
    var entri = kamus.bySku[kandidat[i]];
    if (entri) return entri;
  }

  return null;
}

/**
 * Kunci cache kamus harga, memakai pola nomor generasi seperti cache dashboard.
 *
 * CacheService tidak bisa menghapus kunci satu per satu. Dengan nomor generasi,
 * seluruh isi cache cukup dibuang dengan menaikkan nomornya, dan tidak perlu ada
 * daftar kunci yang harus dirawat.
 */
function kunciCacheProses_() {
  var cache = CacheService.getScriptCache();
  var generasi = cache.get('ERP_PROSES_GENERASI') || '1';
  return 'ERP_PROSES_' + generasi;
}

/**
 * Membaca baris DATA PROSES untuk keperluan penghitungan.
 *
 * Dibaca lengkap setiap kali isinya berubah: penyimpanan harga memanggil
 * hapusCacheProses_(), sehingga pembacaan setelahnya selalu mendapat isi
 * terbaru. Masa simpan 120 detik hanya berlaku sebagai pengaman bila ada
 * perubahan yang dilakukan langsung di sheet.
 */
function bacaProsesCached_() {
  var cache = CacheService.getScriptCache();
  var kunci = kunciCacheProses_();
  var tersimpan = cache.get(kunci);

  if (tersimpan) {
    try {
      return JSON.parse(tersimpan);
    } catch (e) {}
  }

  var daftar = SheetManager.bacaProses();
  try {
    var json = JSON.stringify(daftar);
    if (json.length < 90000) cache.put(kunci, json, 120);
  } catch (e) {}

  return daftar;
}

/**
 * Membuang cache kamus harga setelah isi sheet DATA PROSES berubah.
 *
 * Nomor generasinya harus benar-benar berbeda setiap kali dipanggil. Milidetik
 * saja tidak cukup: dua penyimpanan yang dikirim beruntun dapat jatuh pada
 * milidetik yang sama, dan seluruh pembacaan sesudahnya akan memakai kamus lama
 * tanpa gejala apa pun di layar.
 */
function hapusCacheProses_() {
  try {
    CacheService.getScriptCache().put('ERP_PROSES_GENERASI', nomorGenerasiCache_(), 21600);
  } catch (e) {}
}

/** Nomor generasi cache: penanda waktu yang tidak pernah kembar. */
function nomorGenerasiCache_() {
  return String(Date.now()) + '-' + String(Math.random()).slice(2, 8);
}

/**
 * Mengubah baris pesanan menjadi baris pekerjaan.
 *
 * SKU yang kosong atau berisi tanda "-" dilewati, karena baris tanpa SKU tidak
 * dapat dicarikan harganya dan tidak akan pernah menambah upah siapa pun.
 */
function jadikanBarisAntrian_(rows) {
  var hasil = [];
  var daftar = rows || [];

  for (var i = 0; i < daftar.length; i++) {
    var r = daftar[i];
    var sku = (r && r.sku) ? String(r.sku).trim() : '';
    if (!sku || sku === '-') continue;

    var variasi = SheetManager.bersihkanVariasi(r.variation);
    if (variasi === '-') variasi = '';
    var qty = Number(r.qty) || 0;
    if (qty <= 0) continue;

    hasil.push({
      sku: sku,
      variasi: variasi,
      qty: qty,
      noPesanan: r.orderSn ? String(r.orderSn).trim() : '',
      toko: r.toko ? String(r.toko).trim().toUpperCase() : '',
      tanggalPesanan: r.date ? String(r.date).trim() : '',
      status: r.internalStatus ? String(r.internalStatus).trim() : ''
    });
  }

  return hasil;
}

/** Daftar nama penjahit yang pernah tercatat, untuk pilihan di halaman. */
function daftarPenjahit_(produksi) {
  var peta = {};
  var hasil = [];
  var daftar = produksi || [];

  for (var i = 0; i < daftar.length; i++) {
    var nama = daftar[i].penjahit ? String(daftar[i].penjahit).trim() : '';
    if (!nama) continue;

    var kunci = kunciSkuProduksi_(nama);
    if (peta[kunci]) continue;
    peta[kunci] = true;
    hasil.push(nama);
  }

  hasil.sort(function(a, b) { return a.localeCompare(b, 'id'); });
  return hasil;
}

var BULAN_PRODUKSI_ = [
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
];

/** Menulis satu angka menjadi dua digit. */
function isiDuaDigit_(nilai) {
  var teks = String(parseInt(nilai, 10));
  return teks.length < 2 ? '0' + teks : teks;
}

/**
 * Menyeragamkan tanggal menjadi yyyy-MM-dd.
 *
 * Tanggal pada DATA JAHIT dapat ditulis dalam empat bentuk yang berbeda: objek
 * Date dari sel, teks ISO dari formulir halaman, teks "27/09/2026" dari kebiasaan
 * lama, dan "27 September 2026" dari penulisan tangan. Semuanya harus menunjuk
 * hari yang sama, karena pemilihan hari pada halaman estimasi membandingkan teks
 * tanggal: satu bentuk yang tidak dikenali berarti barisnya hilang dari laporan
 * tanpa pesan apa pun.
 *
 * @return {string} tanggal yyyy-MM-dd, atau string kosong bila tidak terbaca
 */
function normalisasiTanggalProduksi_(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return '';
  if (nilai instanceof Date) {
    return isNaN(nilai.getTime()) ? '' : Utilities.formatDate(nilai, 'Asia/Jakarta', 'yyyy-MM-dd');
  }

  var teks = String(nilai).trim();
  if (!teks) return '';

  var iso = teks.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return iso[1] + '-' + isiDuaDigit_(iso[2]) + '-' + isiDuaDigit_(iso[3]);

  var miring = teks.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (miring) return miring[3] + '-' + isiDuaDigit_(miring[2]) + '-' + isiDuaDigit_(miring[1]);

  var panjang = teks.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (panjang) {
    var bulan = BULAN_PRODUKSI_.indexOf(panjang[2].toLowerCase());
    if (bulan >= 0) {
      return panjang[3] + '-' + isiDuaDigit_(bulan + 1) + '-' + isiDuaDigit_(panjang[1]);
    }
  }

  var longgar = new Date(teks);
  if (!isNaN(longgar.getTime())) {
    return Utilities.formatDate(longgar, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  return '';
}

/** Satu keranjang angka untuk satu sesi kerja. */
function kosongSesiProduksi_() {
  return { baris: 0, pcs: 0, waktuJahit: 0, waktuPotong: 0, waktu: 0, upah: 0 };
}

/**
 * Menghitung estimasi kerja untuk satu hari.
 *
 * Hanya baris pada tanggal itu yang dijumlahkan. Baris yang SKU-nya belum punya
 * harga tetap dihitung jumlah dan menitnya, lalu dicatat pada barisTanpaHarga,
 * karena baris seperti itu bukan kekeliruan perhitungan melainkan harga yang
 * memang belum diisi.
 *
 * @param {Array<Object>} produksi baris dari SheetManager.bacaProduksi()
 * @param {Object} kamus hasil bangunKamusProses_()
 * @param {string} tanggal yyyy-MM-dd
 * @return {Object} payload estimasi
 */
function kumpulkanEstimasiProduksi_(produksi, kamus, tanggal) {
  var hari = normalisasiTanggalProduksi_(tanggal);
  var total = { baris: 0, pcs: 0, waktuJahit: 0, waktuPotong: 0, waktu: 0, upah: 0 };
  var perSesi = { PAGI: kosongSesiProduksi_(), SIANG: kosongSesiProduksi_() };
  var byPenjahit = {};
  var tanpaHarga = {};
  var barisTanpaHarga = 0;
  var daftar = produksi || [];

  for (var i = 0; i < daftar.length; i++) {
    var b = daftar[i];
    if (normalisasiTanggalProduksi_(b.tanggal) !== hari) continue;

    var jumlah = Number(b.jumlah) || 0;
    if (jumlah <= 0) continue;

    var sesiBaris = sesiProduksi_(b.sesi);
    var entri = cariProsesSku_(kamus, b.sku, b.variasi);
    var hargaSatuan = entri ? (Number(entri.harga) || 0) : 0;
    var jahitUnit = entri ? (Number(entri.waktuJahit) || 0) : 0;
    var potongUnit = entri ? (Number(entri.waktuPotong) || 0) : 0;

    var waktuJahit = jahitUnit * jumlah;
    var waktuPotong = potongUnit * jumlah;
    var upah = hargaSatuan * jumlah;

    if (hargaSatuan <= 0) {
      barisTanpaHarga++;
      tanpaHarga[kunciSkuProduksi_(b.sku) + '|' + kunciSkuProduksi_(b.variasi)] = {
        sku: b.sku,
        variasi: b.variasi || ''
      };
    }

    total.baris++;
    total.pcs += jumlah;
    total.waktuJahit += waktuJahit;
    total.waktuPotong += waktuPotong;
    total.upah += upah;

    if (sesiBaris && perSesi[sesiBaris]) {
      perSesi[sesiBaris].baris++;
      perSesi[sesiBaris].pcs += jumlah;
      perSesi[sesiBaris].waktuJahit += waktuJahit;
      perSesi[sesiBaris].waktuPotong += waktuPotong;
      perSesi[sesiBaris].upah += upah;
    }

    var nama = b.penjahit ? String(b.penjahit).trim() : '';
    var kunciNama = kunciSkuProduksi_(nama) || '(tanpa nama)';
    if (!byPenjahit[kunciNama]) {
      byPenjahit[kunciNama] = {
        nama: nama || '(tanpa nama)',
        pcs: 0, waktuJahit: 0, waktuPotong: 0, waktu: 0, upah: 0,
        sesi: { PAGI: kosongSesiProduksi_(), SIANG: kosongSesiProduksi_() },
        items: {}
      };
    }

    var orang = byPenjahit[kunciNama];
    orang.pcs += jumlah;
    orang.waktuJahit += waktuJahit;
    orang.waktuPotong += waktuPotong;
    orang.upah += upah;

    if (sesiBaris && orang.sesi[sesiBaris]) {
      orang.sesi[sesiBaris].baris++;
      orang.sesi[sesiBaris].pcs += jumlah;
      orang.sesi[sesiBaris].waktuJahit += waktuJahit;
      orang.sesi[sesiBaris].waktuPotong += waktuPotong;
      orang.sesi[sesiBaris].upah += upah;
    }

    /* Baris yang sama pada hari yang sama dijadikan satu rincian, supaya satu SKU
       yang dijahit dua kali dalam sehari tidak muncul sebagai dua baris laporan
       yang harus dibaca terpisah. */
    var kunciItem = (sesiBaris || 'TANPA SESI') + '|' +
      kunciSkuProduksi_(b.sku) + '|' + kunciSkuProduksi_(b.variasi);
    if (!orang.items[kunciItem]) {
      orang.items[kunciItem] = {
        sesi: sesiBaris,
        sku: b.sku,
        variasi: b.variasi || '',
        jumlah: 0, waktuJahit: 0, waktuPotong: 0, waktu: 0, upah: 0,
        hargaSatuan: hargaSatuan
      };
    }
    orang.items[kunciItem].jumlah += jumlah;
    orang.items[kunciItem].waktuJahit += waktuJahit;
    orang.items[kunciItem].waktuPotong += waktuPotong;
    orang.items[kunciItem].upah += upah;
  }

  total.waktu = total.waktuJahit + total.waktuPotong;
  perSesi.PAGI.waktu = perSesi.PAGI.waktuJahit + perSesi.PAGI.waktuPotong;
  perSesi.SIANG.waktu = perSesi.SIANG.waktuJahit + perSesi.SIANG.waktuPotong;

  var penjahit = [];
  var kunciPenjahit = Object.keys(byPenjahit).sort(function(a, b) {
    return byPenjahit[a].nama.localeCompare(byPenjahit[b].nama, 'id');
  });

  for (var p = 0; p < kunciPenjahit.length; p++) {
    var data = byPenjahit[kunciPenjahit[p]];
    data.waktu = data.waktuJahit + data.waktuPotong;
    data.sesi.PAGI.waktu = data.sesi.PAGI.waktuJahit + data.sesi.PAGI.waktuPotong;
    data.sesi.SIANG.waktu = data.sesi.SIANG.waktuJahit + data.sesi.SIANG.waktuPotong;

    var items = [];
    var kunciItem = Object.keys(data.items);
    for (var it = 0; it < kunciItem.length; it++) {
      var baris = data.items[kunciItem[it]];
      baris.waktu = baris.waktuJahit + baris.waktuPotong;
      items.push(baris);
    }
    items.sort(function(a, b) {
      if ((a.sesi || '') !== (b.sesi || '')) return (a.sesi || '').localeCompare(b.sesi || '');
      return a.sku.localeCompare(b.sku, 'id');
    });
    data.items = items;
    penjahit.push(data);
  }

  var skuTanpaHarga = [];
  var kunciTanpaHarga = Object.keys(tanpaHarga);
  for (var t = 0; t < kunciTanpaHarga.length; t++) {
    skuTanpaHarga.push(tanpaHarga[kunciTanpaHarga[t]]);
  }

  return {
    tanggal: hari,
    total: total,
    sesi: perSesi,
    penjahit: penjahit,
    jumlahPenjahit: penjahit.length,
    barisTanpaHarga: barisTanpaHarga,
    skuTanpaHarga: skuTanpaHarga,
    uangDisembunyikan: false
  };
}

/**
 * Membuang seluruh nominal dari payload estimasi.
 *
 * Yang dibuang hanya nominalnya; jumlah pcs dan menit kerja tetap ada, karena
 * keduanya yang dipakai mengatur beban kerja. Nominal yang tidak berhak dilihat
 * tidak boleh ditulis sebagai Rp 0, sebab angka nol adalah keterangan yang keliru.
 */
function tanpaUangEstimasi_(payload) {
  if (!payload) return payload;

  delete payload.total.upah;
  delete payload.sesi.PAGI.upah;
  delete payload.sesi.SIANG.upah;

  for (var i = 0; i < payload.penjahit.length; i++) {
    delete payload.penjahit[i].upah;
    delete payload.penjahit[i].sesi.PAGI.upah;
    delete payload.penjahit[i].sesi.SIANG.upah;

    var items = payload.penjahit[i].items || [];
    for (var it = 0; it < items.length; it++) {
      delete items[it].upah;
      delete items[it].hargaSatuan;
    }
  }

  payload.uangDisembunyikan = true;
  return payload;
}

/**
 * RPC: Daftar pesanan menunggu pickup, lengkap dengan tandanya.
 *
 * Panel Produksi memakai ini untuk menampilkan pekerjaan yang menunggu: mana yang
 * sudah dijahit, mana yang belum, dan mana yang SKU-nya belum punya harga. Tidak
 * ada lagi tanda "sudah masuk daftar kerja", sebab daftar kerjanya adalah daftar
 * ini sendiri. Daftar nama penjahit ikut dikirim supaya kolom Penjahit dapat
 * dipilih, bukan diketik ulang setiap kali.
 *
 * @param {string} token token sesi
 * @param {string} [kodeToko] cakupan toko. Kosong berarti seluruh toko.
 */
function getAntrianProduksi(token, kodeToko) {
  var sesi = wajibSesi_(token, 'PACKING');
  var cakupan = String(kodeToko || '').trim().toUpperCase();

  var rows = SheetManager.getOrderRowsByStatus(STATUS_ANTRIAN_PRODUKSI, BATAS_ANTRIAN_PRODUKSI, cakupan);
  var barisPesanan = jadikanBarisAntrian_(rows);

  var daftarProses = bacaProsesCached_();
  var kamus = bangunKamusProses_(daftarProses);

  var produksi = SheetManager.bacaProduksi();
  var sudahDijahit = {};
  for (var j = 0; j < produksi.length; j++) {
    sudahDijahit[SheetManager.kunciAntrian(
      produksi[j].sku, produksi[j].variasi, produksi[j].noPesanan)] = true;
  }

  var bolehUang = bolehLihatUang_(sesi);
  var pesanan = [];
  var ringkasan = { baris: 0, pesanan: 0, qty: 0, belumDijahit: 0, tanpaHarga: 0 };
  var nomorUnik = {};

  for (var k = 0; k < barisPesanan.length; k++) {
    var b = barisPesanan[k];
    var kunci = SheetManager.kunciAntrian(b.sku, b.variasi, b.noPesanan);
    var entri = cariProsesSku_(kamus, b.sku, b.variasi);
    var harga = entri ? (Number(entri.harga) || 0) : 0;

    var item = {
      noPesanan: b.noPesanan,
      toko: b.toko,
      sku: b.sku,
      variasi: b.variasi,
      qty: b.qty,
      status: b.status,
      sudahDijahit: Boolean(sudahDijahit[kunci]),
      tanpaHarga: harga <= 0
    };
    if (bolehUang) item.hargaSatuan = harga;
    pesanan.push(item);

    ringkasan.baris++;
    ringkasan.qty += b.qty;
    if (b.noPesanan && !nomorUnik[b.noPesanan]) {
      nomorUnik[b.noPesanan] = true;
      ringkasan.pesanan++;
    }
    if (!item.sudahDijahit) ringkasan.belumDijahit++;
    if (item.tanpaHarga) ringkasan.tanpaHarga++;
  }

  return {
    cakupan: cakupan,
    pesanan: pesanan,
    ringkasan: ringkasan,
    penjahitTersimpan: daftarPenjahit_(produksi),
    sesi: SESI_PRODUKSI,
    uangDisembunyikan: !bolehUang
  };
}

/**
 * RPC: Menyimpan baris hasil jahit ke sheet DATA JAHIT.
 *
 * Baris yang nomor pesanan, SKU, dan variasinya sudah pernah disimpan akan
 * dilewati, sehingga tabel input boleh dikirim ulang tanpa menggandakan upah.
 * Sesi dan nama penjahit wajib terisi, karena keduanya yang menentukan hasil kerja
 * itu dihitung untuk siapa. Baris yang belum lengkap ditolak dengan menyebut nomor
 * barisnya, bukan diterima diam-diam lalu hilang dari laporan.
 *
 * @param {string} token token sesi
 * @param {Array<Object>} baris baris berisi tanggal, sesi, sku, variasi, jumlah,
 *   penjahit, noPesanan, dan toko
 */
function simpanProduksiBatch(token, baris) {
  var sesi = wajibSesi_(token, 'ADMIN');
  var masukan = baris || [];

  if (masukan.length === 0) {
    throw new Error('Tidak ada baris yang dikirim untuk disimpan.');
  }

  var produksi = SheetManager.bacaProduksi();
  var kunciAda = {};
  for (var i = 0; i < produksi.length; i++) {
    kunciAda[SheetManager.kunciProduksi(
      produksi[i].sku, produksi[i].variasi, produksi[i].noPesanan, produksi[i].penjahit)] = true;
  }

  var hariIni = tanggalWibHariIni_();
  var daftar = [];
  var bermasalah = [];
  var dilewati = 0;

  for (var k = 0; k < masukan.length; k++) {
    var b = masukan[k] || {};
    var nomorBaris = k + 1;
    var sku = b.sku ? String(b.sku).trim() : '';
    var variasi = b.variasi ? String(b.variasi).trim() : '';
    var noPesanan = b.noPesanan ? String(b.noPesanan).trim() : '';
    var jumlah = angkaProduksi_(b.jumlah);
    var sesiKerja = sesiProduksi_(b.sesi);
    var penjahit = b.penjahit ? String(b.penjahit).trim() : '';
    var tanggal = normalisasiTanggalProduksi_(b.tanggal) || hariIni;

    if (!sku) {
      bermasalah.push('Baris ' + nomorBaris + ': SKU kosong.');
      continue;
    }
    if (jumlah <= 0) {
      bermasalah.push('Baris ' + nomorBaris + ': jumlah harus lebih dari nol.');
      continue;
    }
    if (!sesiKerja) {
      bermasalah.push('Baris ' + nomorBaris + ': sesi harus PAGI atau SIANG.');
      continue;
    }
    if (!penjahit) {
      bermasalah.push('Baris ' + nomorBaris + ': nama penjahit belum diisi.');
      continue;
    }

    var kunci = SheetManager.kunciProduksi(sku, variasi, noPesanan, penjahit);
    if (kunciAda[kunci]) {
      dilewati++;
      continue;
    }
    kunciAda[kunci] = true;

    daftar.push({
      tanggal: tanggal,
      sesi: sesiKerja,
      sku: sku,
      variasi: variasi,
      jumlah: jumlah,
      penjahit: penjahit,
      noPesanan: noPesanan,
      toko: b.toko ? String(b.toko).trim().toUpperCase() : ''
    });
  }

  if (bermasalah.length > 0) {
    throw new Error('Baris berikut belum lengkap. ' + bermasalah.join(' '));
  }

  var ditambah = SheetManager.tambahProduksiBatch(daftar);

  var pesan = ditambah + ' baris hasil jahit disimpan.';
  if (dilewati > 0) pesan += ' ' + dilewati + ' baris dilewati karena sudah pernah disimpan.';

  SheetManager.logActivity(
    'PRODUKSI_SIMPAN_HASIL',
    ditambah,
    'SUKSES',
    'Menyimpan hasil jahit: ' + ditambah + ' baris tersimpan, ' + dilewati + ' baris dilewati.',
    '',
    sesi.kode
  );

  return { ditambah: ditambah, dilewati: dilewati, pesan: pesan };
}

/**
 * RPC: Menyimpan harga dan waktu proses per SKU.
 *
 * Datanya adalah daftar harga, jadi satu SKU cukup punya satu baris. Baris SKU
 * yang sudah ada diperbarui di tempat, dan SKU yang belum pernah dihargai
 * mendapat baris baru — pemanggil tidak perlu tahu yang mana yang terjadi. Isian
 * yang dikosongkan tidak menimpa nilai lama, sehingga membetulkan satu kolom
 * tidak pernah menghapus kolom lain yang sudah benar.
 *
 * @param {string} token token sesi
 * @param {Array<Object>} daftar berisi sku, harga, jahit, dan potong
 */
function saveHargaProses(token, daftar) {
  var sesi = wajibSesi_(token, 'ADMIN');
  var masukan = daftar || [];

  if (masukan.length === 0) {
    throw new Error('Tidak ada harga yang dikirim untuk disimpan.');
  }

  var bersih = [];
  var bermasalah = [];

  for (var i = 0; i < masukan.length; i++) {
    var it = masukan[i] || {};
    var nomorBaris = i + 1;
    var sku = it.sku ? String(it.sku).trim() : '';

    if (!sku) {
      bermasalah.push('Baris ' + nomorBaris + ': SKU kosong.');
      continue;
    }

    var harga = angkaProduksi_(it.harga);
    var jahit = angkaProduksi_(it.jahit);
    var potong = angkaProduksi_(it.potong);

    if (harga < 0 || jahit < 0 || potong < 0) {
      bermasalah.push('Baris ' + nomorBaris + ': nilai tidak boleh negatif.');
      continue;
    }
    if (harga <= 0 && jahit <= 0 && potong <= 0) {
      bermasalah.push('Baris ' + nomorBaris +
        ': isi minimal salah satu dari harga, waktu jahit, atau waktu potong.');
      continue;
    }

    bersih.push({
      sku: sku,
      harga: harga,
      jahit: jahit,
      potong: potong
    });
  }

  if (bermasalah.length > 0) {
    throw new Error('Harga berikut tidak dapat disimpan. ' + bermasalah.join(' '));
  }

  var diubah = SheetManager.simpanHargaProses(bersih);
  hapusCacheProses_();

  var pesan = 'Harga ' + bersih.length + ' SKU disimpan, ' + diubah.selDiperbarui +
    ' sel diperbarui';
  pesan += diubah.barisDitambah > 0
    ? ', ' + diubah.barisDitambah + ' SKU baru ditambahkan ke daftar.'
    : '.';

  SheetManager.logActivity(
    'PRODUKSI_HARGA_PROSES',
    bersih.length,
    'SUKSES',
    'Menyimpan harga proses untuk ' + bersih.length + ' SKU, ' + diubah.selDiperbarui +
      ' sel diperbarui, ' + diubah.barisDitambah + ' baris baru.',
    '',
    sesi.kode
  );

  return {
    sku: bersih.length,
    selDiperbarui: diubah.selDiperbarui,
    barisDitambah: diubah.barisDitambah,
    pesan: pesan
  };
}

/**
 * RPC: Estimasi kerja satu hari.
 *
 * Nominal upah hanya dikirim kepada peran yang berhak melihat uang. Peran lain
 * tetap menerima jumlah pcs dan menit kerjanya, karena itu yang dipakai mengatur
 * beban kerja.
 *
 * @param {string} token token sesi
 * @param {string} tanggal yyyy-MM-dd
 */
function getProduksiRingkasan(token, tanggal) {
  var sesi = wajibSesi_(token, 'PACKING');
  var hari = normalisasiTanggalProduksi_(tanggal) || tanggalWibHariIni_();

  var kamus = bangunKamusProses_(bacaProsesCached_());
  var payload = kumpulkanEstimasiProduksi_(SheetManager.bacaProduksi(), kamus, hari);

  return bolehLihatUang_(sesi) ? payload : tanpaUangEstimasi_(payload);
}



/* Pembagian jahit, diadaptasi dari berkas "PEMBAGIAN DATA JAHIT" tim jahit.
   Daftar kerjanya diambil dari pesanan "[2] Menunggu Pickup", harganya dari
   kamus DATA PROSES, dan pembagiannya berkunci supaya aman diulang. */

/* Jumlah baris pesanan menunggu pickup yang dibaca satu kali pembagian. */
var BATAS_BAGI_PEMBAGIAN = 2000;

/* Grup IGNORE berarti bukan pekerjaan jahit, jadi tidak ikut dibagi. Grup BELUM
   DISET menampung pekerjaan yang aturannya belum ada supaya tetap terlihat. */
var GRUP_ABAIKAN = 'IGNORE';
var GRUP_BELUM_DISET = 'BELUM DISET';

/* Nilai kolom Penjahit untuk pcs yang belum dapat ditetapkan kepada siapa pun. */
var PENJAHIT_BELUM_DISET = 'BELUM DISET';

/**
 * CacheService tidak bisa menghapus kunci satu per satu, jadi cache aturan
 * dibuang dengan menaikkan nomor generasinya.
 */
function kunciCacheAturan_() {
  var cache = CacheService.getScriptCache();
  var generasi = cache.get('ERP_ATURAN_GENERASI') || '1';
  return 'ERP_ATURAN_' + generasi;
}

/** Membuang cache aturan setelah isi sheet SKU RULES berubah. */
function hapusCacheAturan_() {
  try {
    CacheService.getScriptCache().put('ERP_ATURAN_GENERASI', nomorGenerasiCache_(), SESI_TTL_DETIK);
  } catch (e) {}
}

/** Membaca aturan grup dari sheet SKU RULES, dengan cache 120 detik. */
function bacaAturanCached_() {
  var kunci = kunciCacheAturan_();
  var cache = CacheService.getScriptCache();
  var teks = cache.get(kunci);

  if (teks) {
    try {
      return JSON.parse(teks);
    } catch (e) {}
  }

  var daftar = SheetManager.bacaAturanSku();
  try {
    var json = JSON.stringify(daftar);
    if (json.length < 90000) cache.put(kunci, json, 120);
  } catch (e) {}

  return daftar;
}

/**
 * Menentukan grup pekerjaan sebuah SKU. Aturan dibaca dari atas dan yang lebih
 * dulu cocok menang, jadi pola khusus harus diletakkan di atas pola umum.
 *
 * @return {string} nama grup, atau kosong bila tidak ada aturan yang cocok
 */
function tentukanGrupSku_(sku, aturan) {
  var kunci = kunciSkuProduksi_(sku);
  if (!kunci) return '';

  var daftar = aturan || [];
  for (var i = 0; i < daftar.length; i++) {
    var pola = kunciSkuProduksi_(daftar[i].pola);
    if (pola && kunci.indexOf(pola) !== -1) {
      return String(daftar[i].grup || '').trim().toUpperCase();
    }
  }

  return '';
}

/** Menyaring penjahit yang benar-benar boleh menerima pekerjaan. */
function penjahitAktif_(daftar) {
  var hasil = [];
  var baris = daftar || [];

  for (var i = 0; i < baris.length; i++) {
    var p = baris[i];
    if (!p || !p.nama) continue;
    if (String(p.aktif || 'YA').trim().toUpperCase() === 'TIDAK') continue;

    hasil.push({
      nama: String(p.nama).trim().toUpperCase(),
      grup: String(p.grup || '').trim().toUpperCase(),
      bobot: Number(p.bobot) > 0 ? Number(p.bobot) : 1
    });
  }

  return hasil;
}

/**
 * Nilai keadilan seorang penjahit: makin kecil, makin layak menerima pekerjaan.
 * Yang dibandingkan adalah upah dibagi bobot, bukan jumlah pcs, karena satu
 * bedcover dan satu sarung bantal tidak sama beratnya.
 */
function skorPenjahit_(beban, nama, bobot) {
  var data = beban[nama] || { upah: 0, pcs: 0 };
  var berat = Number(bobot) > 0 ? Number(bobot) : 1;
  return (Number(data.upah) || 0) / berat + (Number(data.pcs) || 0) * 0.0001;
}

/** Memilih penjahit paling longgar di antara kandidat satu grup. */
function pilihPenjahit_(kandidat, beban) {
  var terpilih = null;
  var skorTerbaik = 0;

  for (var i = 0; i < kandidat.length; i++) {
    var skor = skorPenjahit_(beban, kandidat[i].nama, kandidat[i].bobot);
    if (terpilih === null || skor < skorTerbaik) {
      terpilih = kandidat[i];
      skorTerbaik = skor;
    }
  }

  return terpilih;
}

/** Satu baris peringatan pembagian, dikumpulkan untuk dilaporkan sekaligus. */
function peringatanBagi_(tipe, noPesanan, sku, variasi, pesan) {
  return {
    tipe: tipe,
    noPesanan: noPesanan || '',
    sku: sku || '',
    variasi: variasi || '',
    pesan: pesan
  };
}

/**
 * Menyusun daftar pcs dari pesanan menunggu pickup. Satu pcs menjadi satu baris,
 * karena tiap pcs dapat jatuh ke penjahit yang berbeda.
 *
 * @return {Object} berisi units dan jumlah baris yang diabaikan
 */
function kumpulkanUnitPembagian_(rows, aturan, kamus, peringatan) {
  var units = [];
  var diabaikan = 0;
  var baris = rows || [];

  for (var i = 0; i < baris.length; i++) {
    var row = baris[i];
    var sku = String(row.sku || '').trim();
    if (!sku || sku === '-') continue;

    /* Dipangkas di sini juga, bukan hanya saat baris pesanan dipetakan, supaya
       pemanggil mana pun mendapat perlakuan yang sama. */
    var variasi = SheetManager.bersihkanVariasi(row.variation);
    var noPesanan = String(row.orderSn || '').trim();
    var toko = String(row.toko || '').trim();
    var qty = Math.floor(Number(row.qty) || 0);

    var grup = tentukanGrupSku_(sku, aturan);
    if (grup === GRUP_ABAIKAN) {
      diabaikan++;
      continue;
    }

    /* SKU tanpa aturan tetap dibagi dengan grup BELUM DISET supaya pekerjaannya
       tidak hilang, dan barisnya muncul di daftar peringatan. */
    if (!grup) {
      grup = GRUP_BELUM_DISET;
      peringatan.push(peringatanBagi_('GRUP_TIDAK_DITEMUKAN', noPesanan, sku, variasi,
        'SKU belum punya aturan di sheet SKU RULES. Tambahkan polanya, lalu bagi ulang.'));
    }

    if (qty <= 0) {
      peringatan.push(peringatanBagi_('QTY_INVALID', noPesanan, sku, variasi,
        'Jumlah pada baris pesanan ini nol atau tidak terbaca, sehingga pcs-nya tidak dapat dibagi.'));
      continue;
    }

    var entri = cariProsesSku_(kamus, sku, variasi);
    var harga = entri ? (Number(entri.harga) || 0) : 0;

    if (harga <= 0) {
      peringatan.push(peringatanBagi_('SKU_TANPA_HARGA', noPesanan, sku, variasi,
        'SKU belum dihargai di DATA PROSES, jadi upah pcs ini nol. Isi harganya supaya pembagiannya adil.'));
    }

    for (var pcs = 1; pcs <= qty; pcs++) {
      units.push({
        toko: toko,
        noPesanan: noPesanan,
        sku: sku,
        variasi: variasi,
        part: qty > 1 ? (pcs + '/' + qty) : '',
        grup: grup,
        harga: harga,
        penjahit: ''
      });
    }
  }

  return { units: units, diabaikan: diabaikan };
}

/**
 * Pcs pekerjaan yang masih menunggu pickup pada satu cakupan toko.
 *
 * Dipakai bersama oleh pembagian, rekap, dan penutupan sesi supaya ketiganya
 * memandang daftar kerja yang sama. Satu pcs menjadi satu baris, dan kuncinya
 * memuat bagian pcs sehingga dua pcs dari satu baris pesanan tidak saling
 * menimpa.
 *
 * @param {string} cakupan kode toko, kosong berarti seluruh toko
 * @param {Array<Object>} peringatan larik yang ikut diisi peringatan pembacaan
 * @return {Object} units, kunci (peta kunci pcs menjadi true), dan diabaikan
 */
function kumpulkanPcsAntrian_(cakupan, peringatan) {
  var rows = SheetManager.getOrderRowsByStatus(STATUS_ANTRIAN_PRODUKSI, BATAS_BAGI_PEMBAGIAN, cakupan);
  var dikumpulkan = kumpulkanUnitPembagian_(rows, bacaAturanCached_(),
    bangunKamusProses_(bacaProsesCached_()), peringatan);

  /* Diringkas per baris pesanan: berapa pcs-nya, grupnya apa, dan harga satuannya
     berapa. Baris inilah yang dipakai memutuskan berapa pcs yang belum dibagi,
     sedangkan daftar pcs di bawahnya dipakai satu per satu saat menetapkan orang. */
  var baris = {};
  var urutanBaris = [];

  for (var i = 0; i < dikumpulkan.units.length; i++) {
    var u = dikumpulkan.units[i];
    var kunciBaris = SheetManager.kunciAntrian(u.sku, u.variasi, u.noPesanan);

    if (!baris[kunciBaris]) {
      baris[kunciBaris] = {
        kunci: kunciBaris,
        toko: u.toko,
        noPesanan: u.noPesanan,
        sku: u.sku,
        variasi: u.variasi,
        qty: 0,
        grup: u.grup,
        harga: Number(u.harga) || 0
      };
      urutanBaris.push(kunciBaris);
    }

    baris[kunciBaris].qty += 1;
  }

  return {
    units: dikumpulkan.units,
    baris: baris,
    urutanBaris: urutanBaris,
    qtyAntrian: dikumpulkan.units.length,
    diabaikan: dikumpulkan.diabaikan
  };
}

/** Upah satu baris pembagian: Harga Total, atau Qty × Harga Satuan bila kosong. */
function upahBarisBagi_(baris) {
  var total = Number(baris.hargaTotal) || 0;
  if (total > 0) return total;

  var qty = Number(baris.qty) > 0 ? Number(baris.qty) : 1;
  return (Number(baris.harga) || 0) * qty;
}

/**
 * Harga terbaru setiap baris pesanan antrian, berkunci kunci baris pesanan.
 *
 * Dipakai saat pcs sudah dibagi lebih dulu daripada harganya diisi: harga baris
 * pembagian yang masih kosong diisi dari peta ini, sedangkan yang sudah terisi
 * dibiarkan.
 */
function hargaTerbaruPcs_(antrian) {
  var harga = {};
  var urutan = (antrian && antrian.urutanBaris) || [];

  for (var i = 0; i < urutan.length; i++) {
    harga[urutan[i]] = Number(antrian.baris[urutan[i]].harga) || 0;
  }

  return harga;
}

/** Sesi kerja menurut jam WIB saat ini, untuk aksi yang tidak memilih sesi. */
function sesiMenurutJamWib_() {
  var jam = Number(Utilities.formatDate(new Date(), 'Asia/Jakarta', 'H'));
  return jam < 13 ? 'PAGI' : 'SIANG';
}

/** Menyusun beban setiap penjahit menjadi daftar siap kirim ke halaman. */
function hitungBebanKeDaftar_(beban, penjahit) {
  var daftar = [];
  var orang = penjahit || [];

  for (var i = 0; i < orang.length; i++) {
    var data = beban[orang[i].nama] || { upah: 0, pcs: 0 };
    daftar.push({
      nama: orang[i].nama,
      grup: orang[i].grup,
      bobot: orang[i].bobot,
      pcs: Number(data.pcs) || 0,
      upah: Number(data.upah) || 0
    });
  }

  daftar.sort(function (a, b) {
    if (b.upah !== a.upah) return b.upah - a.upah;
    return String(a.nama).localeCompare(String(b.nama));
  });

  return daftar;
}

/**
 * Membagi pekerjaan jahit kepada penjahit. Aman dijalankan berkali-kali: pcs
 * yang sudah pernah dibagi dilewati, dan penjahit pada baris lama tidak diubah
 * supaya penyesuaian manusia tidak hilang. Bebannya dibaca dari sheet supaya
 * pembagian ini menyambung pembagian sebelumnya.
 *
 * @param {string} kodeToko cakupan toko, kosong berarti seluruh toko
 * @return {Object} ringkasan pembagian beserta daftar peringatannya
 */
function bagiPembagianJahit_(kodeToko) {
  var cakupan = String(kodeToko || '').trim().toUpperCase();
  var peringatan = [];

  var aturan = bacaAturanCached_();
  if (!aturan.length) {
    peringatan.push(peringatanBagi_('ATURAN_KOSONG', '', '', '',
      'Sheet SKU RULES masih kosong, sehingga grup pekerjaan tidak dapat ditentukan.'));
  }

  var penjahit = penjahitAktif_(SheetManager.bacaPenjahit());
  if (!penjahit.length) {
    throw new Error('Belum ada penjahit aktif di sheet SETTING PENJAHIT. Isi minimal satu penjahit sebelum membagi pekerjaan.');
  }

  /* Diringkas per baris pesanan dan per baris pembagian. Harga terbaru disimpan
     sekalian: baris lama yang harganya masih kosong perlu diisi dengan harga yang
     berlaku sekarang, bukan dibiarkan nol. */
  var antrian = kumpulkanPcsAntrian_(cakupan, peringatan);
  var hargaTerbaru = hargaTerbaruPcs_(antrian);

  var sudahAda = SheetManager.bacaPembagian();
  var beban = {};
  var perluHarga = [];
  var qtySudah = {};
  var penjahitDikenal = {};
  for (var d = 0; d < penjahit.length; d++) penjahitDikenal[penjahit[d].nama] = true;

  for (var j = 0; j < sudahAda.length; j++) {
    var lama = sudahAda[j];
    var kunciBarisLama = SheetManager.kunciAntrian(lama.sku, lama.variasi, lama.noPesanan);

    /* Pekerjaan yang pesanannya sudah dikirim tidak lagi menjadi beban, tetapi
       barisnya tetap tersimpan sebagai riwayat. */
    if (!antrian.baris[kunciBarisLama]) continue;

    var qtyLama = Number(lama.qty) > 0 ? Number(lama.qty) : 1;
    qtySudah[kunciBarisLama] = (qtySudah[kunciBarisLama] || 0) + qtyLama;

    /* Baris ini sudah berpemilik, jadi tidak dibagi ulang. Harganya saja yang
       mungkin masih kosong, karena saat dibagi dulu SKU-nya belum masuk daftar
       harga. Upahnya dihitung dengan harga terbaru, dan selnya ikut diisi.
       Harga yang sudah terisi tidak pernah ditimpa. */
    var upahLama = upahBarisBagi_(lama);
    if (upahLama <= 0 && hargaTerbaru[kunciBarisLama] > 0) {
      upahLama = hargaTerbaru[kunciBarisLama] * qtyLama;
      perluHarga.push({
        sku: lama.sku,
        variasi: lama.variasi,
        noPesanan: lama.noPesanan,
        penjahit: lama.penjahit,
        harga: hargaTerbaru[kunciBarisLama]
      });
    }

    var namaLama = String(lama.penjahit || '').trim().toUpperCase();
    if (!namaLama || namaLama === PENJAHIT_BELUM_DISET) continue;

    if (!beban[namaLama]) beban[namaLama] = { upah: 0, pcs: 0 };
    beban[namaLama].upah += upahLama;
    beban[namaLama].pcs += qtyLama;

    if (!penjahitDikenal[namaLama]) {
      peringatan.push(peringatanBagi_('PENJAHIT_TIDAK_AKTIF', lama.noPesanan, lama.sku, lama.variasi,
        'Pcs ini sudah ditetapkan kepada ' + namaLama + ', tetapi namanya tidak ada di daftar penjahit aktif.'));
    }
  }

  /* Pcs yang belum pernah dibagi: sisanya setelah jumlah yang sudah tercatat pada
     baris pembagian mana pun untuk baris pesanan itu. Yang dihitung adalah
     jumlahnya, bukan pcs yang mana, karena itu yang disimpan sheetnya. */
  var baru = [];
  for (var b = 0; b < antrian.urutanBaris.length; b++) {
    var kb = antrian.urutanBaris[b];
    var info = antrian.baris[kb];
    var mulai = qtySudah[kb] || 0;

    for (var p = mulai + 1; p <= info.qty; p++) {
      baru.push({
        toko: info.toko,
        noPesanan: info.noPesanan,
        sku: info.sku,
        variasi: info.variasi,
        part: info.qty > 1 ? (p + '/' + info.qty) : '',
        grup: info.grup,
        harga: info.harga,
        penjahit: ''
      });
    }
  }

  /* Yang paling mahal dibagi lebih dahulu, supaya selisih upah tidak melebar
     hanya karena urutan kedatangan pesanan. */
  baru.sort(function (a, b2) {
    if (b2.harga !== a.harga) return b2.harga - a.harga;
    if (a.grup !== b2.grup) return String(a.grup).localeCompare(String(b2.grup));
    if (a.noPesanan !== b2.noPesanan) return String(a.noPesanan).localeCompare(String(b2.noPesanan));
    return String(a.part).localeCompare(String(b2.part));
  });

  /* Hasil penetapan dikumpulkan per penjahit, karena satu baris sheet mewakili
     satu penjahit pada satu baris pesanan: dua pcs yang jatuh ke orang yang sama
     cukup satu baris berisi Qty 2. */
  var kelompok = {};
  var urutanKelompok = [];
  var grupKosong = {};

  for (var n = 0; n < baru.length; n++) {
    var unit = baru[n];
    var grupKey = String(unit.grup || '').trim().toUpperCase();
    var kandidat = [];

    for (var c = 0; c < penjahit.length; c++) {
      if (penjahit[c].grup === grupKey) kandidat.push(penjahit[c]);
    }

    if (!kandidat.length) {
      unit.penjahit = PENJAHIT_BELUM_DISET;
      if (!grupKosong[grupKey]) {
        grupKosong[grupKey] = true;
        peringatan.push(peringatanBagi_('PENJAHIT_GRUP_KOSONG', unit.noPesanan, unit.sku, unit.variasi,
          'Tidak ada penjahit aktif untuk grup ' + (grupKey || '(kosong)') +
          '. Tambahkan penjahitnya di sheet SETTING PENJAHIT.'));
      }
    } else {
      var dipilih = pilihPenjahit_(kandidat, beban);
      unit.penjahit = dipilih.nama;

      if (!beban[dipilih.nama]) beban[dipilih.nama] = { upah: 0, pcs: 0 };
      beban[dipilih.nama].upah += Number(unit.harga) || 0;
      beban[dipilih.nama].pcs += 1;
    }

    var kunciKelompok = SheetManager.kunciPembagian(unit.sku, unit.variasi, unit.noPesanan, unit.penjahit);
    if (!kelompok[kunciKelompok]) {
      kelompok[kunciKelompok] = {
        toko: unit.toko,
        noPesanan: unit.noPesanan,
        sku: unit.sku,
        variasi: unit.variasi,
        penjahit: unit.penjahit,
        grup: unit.grup,
        harga: unit.harga,
        qty: 0
      };
      urutanKelompok.push(kunciKelompok);
    }
    kelompok[kunciKelompok].qty += 1;
  }

  var ditulis = { barisDitambah: 0, barisDiperbarui: 0, qtyDitambah: 0 };
  if (urutanKelompok.length) {
    var daftarSimpan = [];
    for (var t = 0; t < urutanKelompok.length; t++) {
      daftarSimpan.push(kelompok[urutanKelompok[t]]);
    }

    /* Satu stempel waktu untuk seluruh baris, supaya satu kali pembagian dapat
       dikenali sebagai satu peristiwa. */
    ditulis = SheetManager.simpanQtyPembagian(daftarSimpan, stempelWib_());
  }

  /* Penyelarasan dijalankan walau tidak ada pcs baru: kasus yang paling sering
     justru pekerjaan yang sudah dibagi sebelum harganya diisi. */
  var hargaDiselaraskan = SheetManager.perbaruiHargaPembagian(perluHarga);

  return {
    ditambah: ditulis.barisDitambah,
    diperbarui: ditulis.barisDiperbarui,
    qtyDitambah: ditulis.qtyDitambah,
    dilewati: antrian.qtyAntrian - baru.length,
    diabaikan: antrian.diabaikan,
    unitAntrian: antrian.qtyAntrian,
    hargaDiselaraskan: hargaDiselaraskan,
    peringatan: peringatan,
    perPenjahit: hitungBebanKeDaftar_(beban, penjahit)
  };
}

/**
 * Menutup satu sesi kerja dalam satu kali jalan: membagi pekerjaan yang belum
 * terbagi, lalu menyimpan hasilnya ke DATA JAHIT.
 *
 * Inilah satu tindakan yang menggantikan dua pekerjaan harian: bagi pekerjaan,
 * lalu ketik ulang hasilnya ke tabel input. Sumber hasilnya adalah sheet
 * PEMBAGIAN JAHIT — di sanalah tercatat siapa mengerjakan pcs mana — jadi yang
 * perlu dilakukan operator hanya memastikan, bukan mengetik ulang.
 *
 * Satu baris DATA JAHIT mewakili satu penjahit pada satu baris pesanan. Bila dua
 * pcs dari satu baris pesanan jatuh ke orang yang sama, keduanya menjadi satu
 * baris berjumlah dua; bila jatuh ke dua orang, menjadi dua baris — dan itulah
 * sebabnya nama penjahit ikut masuk kunci anti-duplikatnya.
 *
 * Pcs yang penjahitnya belum dapat ditentukan (grupnya belum ada aturannya, atau
 * tidak ada penjahit aktif di grup itu) tidak ditulis dan dilaporkan terpisah,
 * karena baris seperti itu belum punya pemilik upah.
 *
 * Aman dijalankan berulang: baris hasil jahit dikunci nomor pesanan + SKU +
 * variasi + penjahit, sehingga menutup sesi dua kali tidak menggandakan upah.
 *
 * @param {string} tanggal yyyy-MM-dd, kosong berarti hari ini menurut WIB
 * @param {string} sesi PAGI atau SIANG, kosong berarti mengikuti jam WIB sekarang
 * @param {string} kodeToko cakupan toko, kosong berarti seluruh toko
 * @param {string} kodePengguna kode pengguna pelaku, untuk jejak audit
 * @return {Object} ringkasan pembagian dan penyimpanan hasilnya
 */
function tutupSesiJahit_(tanggal, sesi, kodeToko, kodePengguna) {
  var cakupan = String(kodeToko || '').trim().toUpperCase();
  var hari = normalisasiTanggalProduksi_(tanggal) || tanggalWibHariIni_();
  var sesiKerja = sesiProduksi_(sesi) || sesiMenurutJamWib_();

  SheetManager.pastikanSettingProduksi();

  /* Pembagian dijalankan lebih dulu: pesanan yang baru masuk ikut terbagi, dan
     harga pcs lama yang masih kosong ikut diselaraskan. */
  var bagi = bagiPembagianJahit_(cakupan);

  /* Rekap dipakai sebagai sumber barisnya: di sana baris pembagian yang pesanannya
     masih menunggu sudah dibersihkan (qty-nya dipotong bila pesanannya menyusut,
     dan harga yang kosong sudah diisi dari daftar harga terbaru). Karena itu satu
     baris DATA JAHIT ditulis untuk setiap baris pembagian yang sudah berpemilik. */
  var rekap = rekapPembagian_(cakupan);

  var produksi = SheetManager.bacaProduksi();
  var kunciSudah = {};
  for (var i = 0; i < produksi.length; i++) {
    kunciSudah[SheetManager.kunciProduksi(
      produksi[i].sku, produksi[i].variasi, produksi[i].noPesanan, produksi[i].penjahit)] = true;
  }

  var baris = [];
  var dilewati = 0;
  var belumBerpemilik = 0;

  for (var j = 0; j < rekap.unit.length; j++) {
    var pcs = rekap.unit[j];
    var nama = String(pcs.penjahit || '').trim().toUpperCase();
    var jumlah = Number(pcs.qty) > 0 ? Number(pcs.qty) : 0;

    if (!nama || nama === PENJAHIT_BELUM_DISET || jumlah <= 0) {
      belumBerpemilik += jumlah;
      continue;
    }

    var kunci = SheetManager.kunciProduksi(pcs.sku, pcs.variasi, pcs.noPesanan, nama);
    if (kunciSudah[kunci]) {
      dilewati++;
      continue;
    }
    kunciSudah[kunci] = true;

    baris.push({
      tanggal: hari,
      sesi: sesiKerja,
      sku: pcs.sku,
      variasi: pcs.variasi,
      jumlah: jumlah,
      penjahit: nama,
      noPesanan: pcs.noPesanan,
      toko: pcs.toko
    });
  }

  var ditambah = SheetManager.tambahProduksiBatch(baris);

  var pesan = ditambah + ' baris hasil jahit disimpan untuk sesi ' + sesiKerja +
    ' tanggal ' + hari + '.';
  if (dilewati > 0) pesan += ' ' + dilewati + ' baris sudah pernah tersimpan.';
  if (belumBerpemilik > 0) {
    pesan += ' ' + belumBerpemilik + ' pcs belum punya penjahit, jadi belum ikut disimpan.';
  }

  SheetManager.logActivity(
    'PRODUKSI_TUTUP_SESI',
    ditambah,
    'SUKSES',
    'Menutup sesi ' + sesiKerja + ' ' + hari + ': ' + bagi.qtyDitambah + ' pcs baru dibagi, ' +
      bagi.hargaDiselaraskan + ' sel harga baris lama diisi, ' + ditambah +
      ' baris hasil jahit disimpan, ' + dilewati + ' baris sudah ada, ' +
      belumBerpemilik + ' pcs tanpa penjahit, ' + bagi.peringatan.length + ' peringatan.',
    cakupan || 'SEMUA',
    kodePengguna
  );

  return {
    tanggal: hari,
    sesi: sesiKerja,
    ditambah: ditambah,
    dilewati: dilewati,
    pcsBaruDibagi: bagi.qtyDitambah,
    hargaDiselaraskan: bagi.hargaDiselaraskan,
    belumBerpemilik: belumBerpemilik,
    pcsAntrian: rekap.unitAntrian,
    peringatan: bagi.peringatan,
    pesan: pesan
  };
}

/**
 * Menghitung rekap pembagian. Hanya pcs yang pesanannya masih menunggu pickup
 * yang dihitung; pekerjaan yang sudah dikirim tetap tersimpan sebagai riwayat.
 *
 * @return {Object} rekap per penjahit, per grup, per toko, beserta peringatannya
 */
function rekapPembagian_(kodeToko) {
  var cakupan = String(kodeToko || '').trim().toUpperCase();
  var peringatan = [];

  var penjahit = penjahitAktif_(SheetManager.bacaPenjahit());
  var antrian = kumpulkanPcsAntrian_(cakupan, peringatan);
  var hargaTerbaru = hargaTerbaruPcs_(antrian);

  var semua = SheetManager.bacaPembagian();
  var terkini = [];
  var qtyTerpakai = {};

  for (var j = 0; j < semua.length; j++) {
    var b = semua[j];
    var kunciBaris = SheetManager.kunciAntrian(b.sku, b.variasi, b.noPesanan);
    if (!antrian.baris[kunciBaris]) continue;

    /* Jumlah pcs pada pesanan dapat berkurang setelah dibagi. Sisa yang melebihi
       jumlah pesanan tidak lagi dihitung, sama seperti baris pcs berlebih yang
       dulu tidak cocok dengan antrian. */
    var sisaBaris = antrian.baris[kunciBaris].qty - (qtyTerpakai[kunciBaris] || 0);
    if (sisaBaris <= 0) continue;

    var qtyBaris = Number(b.qty) > 0 ? Number(b.qty) : 1;
    if (qtyBaris > sisaBaris) qtyBaris = sisaBaris;
    qtyTerpakai[kunciBaris] = (qtyTerpakai[kunciBaris] || 0) + qtyBaris;

    /* Baris lama yang harganya masih kosong ditampilkan memakai harga yang berlaku
       sekarang. Pekerjaan yang pesanannya masih menunggu memang belum menjadi
       riwayat, jadi upahnya tidak boleh tertinggal di angka nol hanya karena dulu
       SKU-nya belum dihargai. Barisnya sendiri tidak diubah di sini; selnya
       diselaraskan saat pembagian dijalankan lagi. */
    var harga = Number(b.harga) || 0;
    if (harga <= 0 && hargaTerbaru[kunciBaris] > 0) harga = hargaTerbaru[kunciBaris];

    var hargaTotal = Number(b.hargaTotal) || 0;
    if (hargaTotal <= 0 && harga > 0) hargaTotal = harga * qtyBaris;

    b.qty = qtyBaris;
    b.harga = harga;
    b.hargaTotal = hargaTotal;
    terkini.push(b);
  }

  var belumDibagi = 0;
  for (var m = 0; m < antrian.urutanBaris.length; m++) {
    var kb = antrian.urutanBaris[m];
    var sisa = antrian.baris[kb].qty - (qtyTerpakai[kb] || 0);
    if (sisa > 0) belumDibagi += sisa;
  }

  /* Baris yang penjahitnya belum dapat ditentukan, dipisahkan dari pcsTerbagi
     supaya tidak terhitung sebagai sudah dibagi. */
  var belumDitetapkan = 0;
  for (var q = 0; q < terkini.length; q++) {
    var namaPenjahit = String(terkini[q].penjahit || '').trim().toUpperCase();
    if (!namaPenjahit || namaPenjahit === PENJAHIT_BELUM_DISET) belumDitetapkan += terkini[q].qty;
  }

  var perPenjahit = rekapPerPenjahit_(terkini, penjahit);
  var totalUpah = 0;
  var pcsTerbagi = 0;
  var tertinggi = 0;
  var terendah = 0;
  var adaUpah = false;

  for (var p = 0; p < perPenjahit.length; p++) {
    var orang = perPenjahit[p];
    if (orang.pcs <= 0) continue;

    /* Pcs tanpa pemilik bukan penjahit yang bekerja. Kalau ikut dihitung, upah
       nolnya akan melebarkan selisih terendah-tertinggi. */
    if (String(orang.nama || '').toUpperCase() === PENJAHIT_BELUM_DISET) continue;

    pcsTerbagi += orang.pcs;
    totalUpah += orang.upah;
    if (!adaUpah || orang.upah > tertinggi) tertinggi = orang.upah;
    if (!adaUpah || orang.upah < terendah) terendah = orang.upah;
    adaUpah = true;
  }

  var bekerja = 0;
  for (var b = 0; b < perPenjahit.length; b++) {
    if (perPenjahit[b].pcs > 0 && String(perPenjahit[b].nama || '').toUpperCase() !== PENJAHIT_BELUM_DISET) bekerja++;
  }

  return {
    cakupan: cakupan,
    unitAntrian: antrian.qtyAntrian,
    pcsTerbagi: pcsTerbagi,
    belumDitetapkan: belumDitetapkan,
    belumDibagi: belumDibagi,
    diabaikan: antrian.diabaikan,
    penjahitAktif: penjahit.length,
    penjahitBekerja: bekerja,
    perPenjahit: perPenjahit,
    perGrup: rekapPerGrup_(terkini, penjahit),
    perToko: rekapPerToko_(terkini),
    /* Daftar pembagian yang pesanannya masih menunggu, satu baris per penjahit.
       Dipakai halaman untuk menampilkan siapa mengerjakan apa, dan dipakai
       penutupan sesi sebagai sumber baris hasil jahit. */
    unit: terkini,
    total: {
      upah: totalUpah,
      selisih: adaUpah ? tertinggi - terendah : 0,
      rataUpah: bekerja > 0 ? Math.round(totalUpah / bekerja) : 0
    },
    peringatan: peringatan
  };
}

/**
 * Rekap per penjahit, lengkap dengan target dan selisihnya. Targetnya adalah
 * rata-rata berbobot grup, bukan angka yang ditetapkan manusia. Selisih positif
 * berarti orang itu memegang lebih banyak daripada rata-rata kelompoknya.
 */
function rekapPerPenjahit_(terkini, penjahit) {
  var peta = {};
  var daftar = penjahit || [];

  for (var i = 0; i < daftar.length; i++) {
    peta[daftar[i].nama] = {
      nama: daftar[i].nama,
      grup: daftar[i].grup,
      bobot: daftar[i].bobot,
      pcs: 0,
      upah: 0,
      order: {},
      sku: {}
    };
  }

  for (var j = 0; j < (terkini || []).length; j++) {
    var b = terkini[j];
    var nama = String(b.penjahit || '').trim().toUpperCase();
    if (!nama) continue;

    if (!peta[nama]) {
      peta[nama] = { nama: nama, grup: b.grup || '', bobot: 1, pcs: 0, upah: 0, order: {}, sku: {} };
    }

    var qtyBaris = Number(b.qty) > 0 ? Number(b.qty) : 1;
    peta[nama].pcs += qtyBaris;
    peta[nama].upah += upahBarisBagi_(b);
    if (b.noPesanan) peta[nama].order[b.noPesanan] = true;
    if (b.sku) peta[nama].sku[b.sku] = true;
  }

  var hasil = [];
  var totalGrup = {};
  var bobotGrup = {};

  for (var k in peta) {
    if (!Object.prototype.hasOwnProperty.call(peta, k)) continue;
    var grup = String(peta[k].grup || '').toUpperCase();
    totalGrup[grup] = (totalGrup[grup] || 0) + peta[k].upah;
    bobotGrup[grup] = (bobotGrup[grup] || 0) + peta[k].bobot;
  }

  for (var m in peta) {
    if (!Object.prototype.hasOwnProperty.call(peta, m)) continue;
    var orang = peta[m];
    var grupOrang = String(orang.grup || '').toUpperCase();
    var berat = Number(orang.bobot) > 0 ? Number(orang.bobot) : 1;
    var totalBerat = bobotGrup[grupOrang] || 1;
    var target = Math.round((totalGrup[grupOrang] || 0) * berat / totalBerat);

    hasil.push({
      nama: orang.nama,
      grup: orang.grup,
      bobot: berat,
      pcs: orang.pcs,
      upah: orang.upah,
      jumlahOrder: Object.keys(orang.order).length,
      jumlahSku: Object.keys(orang.sku).length,
      target: target,
      selisih: orang.upah - target
    });
  }

  hasil.sort(function (a, b) {
    if (b.upah !== a.upah) return b.upah - a.upah;
    return String(a.nama).localeCompare(String(b.nama));
  });

  return hasil;
}

/** Rekap per grup pekerjaan. */
function rekapPerGrup_(terkini, penjahit) {
  var peta = {};

  for (var i = 0; i < (terkini || []).length; i++) {
    var b = terkini[i];
    var grup = String(b.grup || '').toUpperCase() || GRUP_BELUM_DISET;
    if (!peta[grup]) peta[grup] = { grup: grup, pcs: 0, upah: 0, penjahit: {}, order: {} };

    peta[grup].pcs += Number(b.qty) > 0 ? Number(b.qty) : 1;
    peta[grup].upah += upahBarisBagi_(b);
    if (b.penjahit) peta[grup].penjahit[String(b.penjahit).toUpperCase()] = true;
    if (b.noPesanan) peta[grup].order[b.noPesanan] = true;
  }

  var hasil = [];
  for (var k in peta) {
    if (!Object.prototype.hasOwnProperty.call(peta, k)) continue;
    hasil.push({
      grup: peta[k].grup,
      pcs: peta[k].pcs,
      upah: peta[k].upah,
      jumlahPenjahit: Object.keys(peta[k].penjahit).length,
      jumlahOrder: Object.keys(peta[k].order).length
    });
  }

  hasil.sort(function (a, b) { return b.upah - a.upah; });
  return hasil;
}

/** Rekap per toko. */
function rekapPerToko_(terkini) {
  var peta = {};

  for (var i = 0; i < (terkini || []).length; i++) {
    var b = terkini[i];
    var toko = String(b.toko || '').toUpperCase() || '(tanpa kode toko)';
    if (!peta[toko]) peta[toko] = { toko: toko, pcs: 0, upah: 0, order: {}, sku: {} };

    peta[toko].pcs += Number(b.qty) > 0 ? Number(b.qty) : 1;
    peta[toko].upah += upahBarisBagi_(b);
    if (b.noPesanan) peta[toko].order[b.noPesanan] = true;
    if (b.sku) peta[toko].sku[b.sku] = true;
  }

  var hasil = [];
  for (var k in peta) {
    if (!Object.prototype.hasOwnProperty.call(peta, k)) continue;
    hasil.push({
      toko: peta[k].toko,
      pcs: peta[k].pcs,
      upah: peta[k].upah,
      jumlahOrder: Object.keys(peta[k].order).length,
      jumlahSku: Object.keys(peta[k].sku).length
    });
  }

  hasil.sort(function (a, b) { return b.upah - a.upah; });
  return hasil;
}

/**
 * Membuang nominal upah dari rekap dan daftar pcs. Dipotong di server, karena
 * jawaban RPC dapat dibaca siapa saja yang membuka konsol peramban. Jumlah pcs
 * tetap ikut, sebab itulah yang dipakai mengatur pekerjaan.
 */
function tanpaUangBagi_(payload) {
  var hasil = payload || {};

  /* RPC membungkus rekapnya di dalam "rekap", pemanggil lain mengirimnya
     langsung. Keduanya diterima supaya tidak ada bentuk yang lolos. */
  var rekap = hasil.rekap || hasil;

  var penjahit = rekap.perPenjahit || [];
  for (var i = 0; i < penjahit.length; i++) {
    delete penjahit[i].upah;
    delete penjahit[i].target;
    delete penjahit[i].selisih;
  }

  var grup = rekap.perGrup || [];
  for (var j = 0; j < grup.length; j++) delete grup[j].upah;

  var toko = rekap.perToko || [];
  for (var k = 0; k < toko.length; k++) delete toko[k].upah;

  if (rekap.total) {
    delete rekap.total.upah;
    delete rekap.total.selisih;
    delete rekap.total.rataUpah;
  }

  var unit = rekap.unit || hasil.unit || [];
  for (var m = 0; m < unit.length; m++) {
    delete unit[m].harga;
    delete unit[m].hargaTotal;
  }

  hasil.uangDisembunyikan = true;
  return hasil;
}

/** RPC: pembagian jahit beserta setelan dan rekapnya. Hanya membaca, jadi peran
 * PACKING boleh membukanya, dengan nominal upah dipotong. */
function getPembagianJahit(token, kodeToko) {
  var sesi = wajibSesi_(token, 'PACKING');
  var cakupan = String(kodeToko || '').trim().toUpperCase();

  SheetManager.pastikanSettingProduksi();

  var payload = {
    cakupan: cakupan,
    setelan: {
      penjahit: SheetManager.bacaPenjahit(),
      aturan: SheetManager.bacaAturanSku()
    },
    rekap: rekapPembagian_(cakupan)
  };

  return bolehLihatUang_(sesi) ? payload : tanpaUangBagi_(payload);
}

/** RPC: membagi pekerjaan jahit. Ditulis ke Log_Aktivitas beserta pelakunya,
 * karena pembagian menentukan siapa dibayar berapa. */
function bagiPembagianDashboard(token, kodeToko) {
  var sesi = wajibSesi_(token, 'ADMIN');
  var cakupan = String(kodeToko || '').trim().toUpperCase();

  SheetManager.pastikanSettingProduksi();
  var hasil = bagiPembagianJahit_(cakupan);

  SheetManager.logActivity('PRODUKSI_BAGI_JAHIT', hasil.qtyDitambah, 'SUKSES',
    'Membagi ' + hasil.qtyDitambah + ' pcs kepada penjahit' +
    (cakupan ? ' untuk toko ' + cakupan : ' untuk semua toko') +
    ' dalam ' + hasil.ditambah + ' baris baru dan ' + hasil.diperbarui +
    ' baris yang ditambahi. Dilewati ' + hasil.dilewati + ' pcs yang sudah pernah dibagi, diabaikan ' +
    hasil.diabaikan + ' baris non-jahit, ' + hasil.hargaDiselaraskan +
    ' harga baris lama diisi dari daftar harga terbaru, ' + hasil.peringatan.length + ' peringatan.',
    cakupan || 'SEMUA', sesi.kode);

  var pesan = hasil.qtyDitambah > 0
    ? hasil.qtyDitambah + ' pcs dibagi dalam ' + hasil.ditambah + ' baris baru' +
      (hasil.diperbarui > 0 ? ' dan ' + hasil.diperbarui + ' baris yang Qty-nya ditambahi' : '') + '. '
    : 'Tidak ada pcs baru untuk dibagi. ';
  if (hasil.hargaDiselaraskan > 0) {
    pesan += hasil.hargaDiselaraskan +
      ' baris yang harganya masih kosong diisi dari daftar harga terbaru. ';
  }

  return {
    berhasil: true,
    ditambah: hasil.ditambah,
    diperbarui: hasil.diperbarui,
    qtyDitambah: hasil.qtyDitambah,
    dilewati: hasil.dilewati,
    diabaikan: hasil.diabaikan,
    unitAntrian: hasil.unitAntrian,
    hargaDiselaraskan: hasil.hargaDiselaraskan,
    peringatan: hasil.peringatan,
    perPenjahit: bolehLihatUang_(sesi) ? hasil.perPenjahit : tanpaUangBagi_({ perPenjahit: hasil.perPenjahit }).perPenjahit,
    pesan: pesan
  };
}

/**
 * RPC: menutup satu sesi kerja dalam satu kali tekan.
 *
 * Membagi pekerjaan yang belum terbagi, mengisi harga pcs lama yang masih
 * kosong, lalu menyimpan seluruh hasilnya ke DATA JAHIT. Halaman memanggil ini
 * dari tombol **Tutup sesi & simpan hasil** pada tab Pembagian jahit.
 *
 * @param {string} token token sesi
 * @param {string} [tanggal] yyyy-MM-dd, kosong berarti hari ini menurut WIB
 * @param {string} [sesi] PAGI atau SIANG, kosong berarti mengikuti jam WIB
 * @param {string} [kodeToko] cakupan toko, kosong berarti seluruh toko
 */
function tutupSesiJahit(token, tanggal, sesi, kodeToko) {
  var sesiSaya = wajibSesi_(token, 'ADMIN');
  var hasil = tutupSesiJahit_(tanggal, sesi, kodeToko, sesiSaya.kode);

  return {
    berhasil: true,
    tanggal: hasil.tanggal,
    sesi: hasil.sesi,
    ditambah: hasil.ditambah,
    dilewati: hasil.dilewati,
    pcsBaruDibagi: hasil.pcsBaruDibagi,
    hargaDiselaraskan: hasil.hargaDiselaraskan,
    belumBerpemilik: hasil.belumBerpemilik,
    pcsAntrian: hasil.pcsAntrian,
    peringatan: hasil.peringatan,
    pesan: hasil.pesan
  };
}

/** RPC: menyimpan daftar penjahit dari halaman. Nama tidak boleh kembar, karena
 * beban dihitung per nama dan dua baris bernama sama akan saling menimpa. */
function simpanPenjahitDashboard(token, daftar) {
  var sesi = wajibSesi_(token, 'ADMIN');

  var dilihat = {};
  var baris = daftar || [];
  for (var i = 0; i < baris.length; i++) {
    var nama = String((baris[i] && baris[i].nama) || '').trim().toUpperCase();
    if (!nama) continue;

    if (dilihat[nama]) {
      throw new Error('Nama penjahit ' + nama + ' muncul lebih dari sekali. Setiap penjahit hanya boleh punya satu baris.');
    }
    dilihat[nama] = true;

    if (!String((baris[i] && baris[i].grup) || '').trim()) {
      throw new Error('Penjahit ' + nama + ' belum punya grup. Grup menentukan pekerjaan mana yang boleh diterimanya.');
    }
  }

  var jumlah = SheetManager.simpanPenjahit(baris);

  SheetManager.logActivity('PRODUKSI_SIMPAN_PENJAHIT', jumlah, 'SUKSES',
    'Daftar penjahit diperbarui: ' + jumlah + ' baris.', '', sesi.kode);

  return { berhasil: true, jumlah: jumlah, pesan: jumlah + ' baris penjahit disimpan.' };
}

/** RPC: menyimpan aturan SKU dari halaman. Urutannya dipertahankan, karena
 * urutan itulah yang menentukan aturan mana yang menang. */
function simpanAturanDashboard(token, daftar) {
  var sesi = wajibSesi_(token, 'ADMIN');

  var jumlah = SheetManager.simpanAturanSku(daftar);
  hapusCacheAturan_();

  SheetManager.logActivity('PRODUKSI_SIMPAN_ATURAN', jumlah, 'SUKSES',
    'Aturan SKU diperbarui: ' + jumlah + ' baris.', '', sesi.kode);

  return { berhasil: true, jumlah: jumlah, pesan: jumlah + ' aturan SKU disimpan.' };
}

/** Menu: menyiapkan sheet setelan produksi beserta isi bawaannya. Tanpa aturan,
 * grup tidak dapat ditentukan, dan tanpa penjahit tidak ada yang dapat ditugasi. */
function siapkanSettingProduksiPrompt() {
  var ui = SpreadsheetApp.getUi();

  try {
    var hasil = SheetManager.pastikanSettingProduksi();
    hapusCacheAturan_();

    ui.alert('Setelan Produksi Siap',
      'Sheet "SETTING PENJAHIT" dan "SKU RULES" sudah siap, begitu juga "PEMBAGIAN JAHIT".\n\n' +
      'Baris bawaan yang ditulis: ' + hasil.penjahit + ' penjahit dan ' + hasil.aturan + ' aturan SKU.\n' +
      'Nilai 0 berarti sheet itu sudah berisi, sehingga isinya tidak disentuh.\n\n' +
      'Silakan sesuaikan nama penjahit, grup, dan bobotnya langsung di sheet.',
      ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Gagal Menyiapkan Setelan', err.message || String(err), ui.ButtonSet.OK);
  }
}

/**
 * Menu: menutup sesi jahit sekarang — membagi pekerjaan yang belum terbagi,
 * mengisi harga pcs lama yang masih kosong, lalu menyimpan seluruh hasilnya ke
 * DATA JAHIT.
 *
 * Sesi ditanyakan karena menu tidak tahu shift mana yang sedang berjalan, dan
 * salah sesi membuat laporan menit kerja per sesi menjadi keliru. Isian kosong
 * diartikan "ikuti jam sekarang".
 */
function tutupSesiJahitPrompt() {
  var ui = SpreadsheetApp.getUi();

  try {
    SheetManager.initAllSheets();

    var jawab = ui.prompt('Tutup Sesi Jahit',
      'Sesi yang ditutup: ketik PAGI atau SIANG.\n\n' +
      'Kosongkan isian ini untuk mengikuti jam sekarang (' + sesiMenurutJamWib_() + ').\n' +
      'Tanggalnya memakai hari ini menurut WIB.',
      ui.ButtonSet.OK_CANCEL);

    if (jawab.getSelectedButton() !== ui.Button.OK) return;

    var hasil = tutupSesiJahit_('', sesiProduksi_(jawab.getResponseText()), '', 'MENU');

    var isi = 'Tanggal            : ' + hasil.tanggal + '\n' +
      'Sesi               : ' + hasil.sesi + '\n' +
      'pcs baru dibagi    : ' + hasil.pcsBaruDibagi + '\n' +
      'harga pcs lama diisi: ' + hasil.hargaDiselaraskan + '\n' +
      'baris hasil jahit  : ' + hasil.ditambah + ' tersimpan, ' + hasil.dilewati + ' sudah ada\n' +
      'pcs tanpa penjahit : ' + hasil.belumBerpemilik + '\n' +
      'peringatan         : ' + hasil.peringatan.length;

    var maks = Math.min(hasil.peringatan.length, 6);
    for (var i = 0; i < maks; i++) {
      var w = hasil.peringatan[i];
      isi += '\n  - ' + w.tipe + (w.sku ? ' [' + w.sku + ']' : '') + ': ' + w.pesan;
    }
    if (hasil.peringatan.length > maks) {
      isi += '\n  - dan ' + (hasil.peringatan.length - maks) + ' peringatan lain.';
    }

    ui.alert('Sesi Jahit Ditutup', isi, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Gagal Menutup Sesi', err.message || String(err), ui.ButtonSet.OK);
  }
}

/**
 * Menu: membagi pekerjaan jahit sekarang, untuk seluruh toko.
 */
function bagiPembagianJahitPrompt() {
  var ui = SpreadsheetApp.getUi();

  try {
    SheetManager.initAllSheets();
    var hasil = bagiPembagianJahit_('');

    var isi = 'Hasil pembagian:\n' +
      '  pcs dibagi        : ' + hasil.qtyDitambah + '\n' +
      '  baris baru        : ' + hasil.ditambah + '\n' +
      '  baris ditambahi   : ' + hasil.diperbarui + '\n' +
      '  sudah pernah dibagi: ' + hasil.dilewati + '\n' +
      '  bukan pekerjaan jahit: ' + hasil.diabaikan + '\n' +
      '  pcs di antrian    : ' + hasil.unitAntrian + '\n' +
      '  peringatan        : ' + hasil.peringatan.length;

    var maks = Math.min(hasil.peringatan.length, 8);
    for (var i = 0; i < maks; i++) {
      var w = hasil.peringatan[i];
      isi += '\n  - ' + w.tipe + (w.sku ? ' [' + w.sku + ']' : '') + ': ' + w.pesan;
    }
    if (hasil.peringatan.length > maks) {
      isi += '\n  - dan ' + (hasil.peringatan.length - maks) + ' peringatan lain.';
    }

    ui.alert('Pembagian Jahit Selesai', isi, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Gagal Membagi Pekerjaan', err.message || String(err), ui.ButtonSet.OK);
  }
}
