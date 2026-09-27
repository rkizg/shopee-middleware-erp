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
    LOG: 'Log_Aktivitas',
    PENGGUNA: 'Pengguna',
    /* Dua sheet produksi memakai nama huruf besar dengan spasi, bukan gaya
       "Pesanan Masuk". Namanya sengaja dipertahankan sama persis dengan sheet
       pada dashboard produksi yang sudah dipakai tim, supaya baris yang disalin
       dari sana dapat ditempel langsung tanpa penyesuaian nama. */
    PROSES: 'DATA PROSES',
    PRODUKSI: 'DATA JAHIT',
    /* Tiga sheet modul pembagian jahit. Dua yang pertama adalah setelan yang
       diisi manusia, dan yang ketiga adalah hasil pembagiannya. Namanya
       dipertahankan sama dengan nama pada berkas pembagian jahit yang sudah
       dipakai tim, supaya isinya dapat disalin langsung. */
    PENJAHIT: 'SETTING PENJAHIT',
    RULES: 'SKU RULES',
    BAGI: 'PEMBAGIAN JAHIT'
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

  /**
   * Susunan kolom sheet Pesanan Masuk, satu-satunya sumber kebenaran.
   * Dipakai bersama oleh initAllSheets() dan upsertOrders(), karena yang
   * terakhir menulis ulang baris header pada setiap sinkronisasi. Sebelum
   * disatukan, keduanya menyimpan salinan sendiri dan nama kolom F serta I
   * bergantian tertimpa mengikuti operasi terakhir yang dijalankan.
   */
  var PESANAN_HEADERS = [
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
    'Waktu Sinkronisasi',       // 16 (P)
    'Toko'                      // 17 (Q) kode toko, lihat docs/arsitektur-multi-toko.md
  ];

  /* Indeks kolom Waktu Sinkronisasi. Ditulis lewat nama kolom, bukan lewat
     "kolom terakhir", karena kolom terakhir kini berisi kode toko. */
  var KOLOM_WAKTU_SYNC = PESANAN_HEADERS.indexOf('Waktu Sinkronisasi');

  /**
   * Susunan kolom sheet DATA PROSES, satu-satunya sumber kebenaran.
   *
   * Sheet ini adalah daftar harga per SKU, bukan daftar kerja. Satu baris
   * mewakili satu SKU dan dipakai dua kali: sebagai kamus harga saat menghitung
   * upah dan menit kerja, dan sebagai jawaban "SKU ini sudah dihargai atau
   * belum". Daftar kerjanya sendiri tidak disimpan di sini, melainkan dibaca
   * langsung dari pesanan berstatus "[2] Menunggu Pickup" pada Pesanan Masuk.
   *
   * Karena satu baris mewakili satu SKU, tidak ada kolom Variasi, Qty, maupun
   * nomor pesanan: baris yang sama berlaku untuk seluruh variasi dan seluruh
   * pesanan SKU itu. Harga yang khusus berlaku untuk satu variasi ditulis
   * sebagai baris tersendiri dengan nama gabungan, misalnya
   * "SARKUR 120/5 COFFEE". Pencocokannya sendiri ada di cariProsesSku_.
   *
   * Kolom A sampai D dibaca menurut nomor, bukan menurut nama, jadi urutannya
   * tidak boleh berpindah.
   */
  var PROSES_HEADERS = [
    'SKU',                  // 1 (A) kunci harga, sama penulisannya dengan kolom G Pesanan Masuk
    'Harga Jahit',          // 2 (B) upah borongan per pcs
    'Waktu Jahit (menit)',  // 3 (C) menit menjahit per pcs
    'Waktu Potong (menit)'  // 4 (D) menit memotong per pcs
  ];

  /**
   * Susunan kolom sheet DATA JAHIT, yaitu hasil jahit per baris pesanan.
   *
   * Kolom G dan H bukan hiasan: keduanya yang membuat penarikan ulang tidak
   * menggandakan baris. Tanpa nomor pesanan, satu tombol yang diklik dua kali
   * akan menambah upah yang sama untuk kedua kalinya.
   */
  var PRODUKSI_HEADERS = [
    'Tanggal',      // 1 (A)
    'Sesi',         // 2 (B) PAGI atau SIANG
    'Nama/SKU',     // 3 (C)
    'Variasi',      // 4 (D)
    'Jumlah',       // 5 (E)
    'Penjahit',     // 6 (F)
    'No. Pesanan',  // 7 (G)
    'Toko'          // 8 (H)
  ];

  var KOLOM_PROSES = { SKU: 0, HARGA: 1, JAHIT: 2, POTONG: 3 };

  var KOLOM_PRODUKSI = {
    TANGGAL: 0, SESI: 1, SKU: 2, VARIASI: 3,
    JUMLAH: 4, PENJAHIT: 5, PESANAN: 6, TOKO: 7
  };

  /**
   * Susunan kolom sheet SETTING PENJAHIT, yaitu daftar orang yang mengerjakan
   * jahitan beserta grup keahliannya.
   *
   * Bobot bukan hiasan: satu orang yang mengerjakan barang dua kali lebih mahal
   * mendapat bagian lebih sedikit pcs agar upahnya setara. Nilai 1 berarti
   * kapasitas biasa.
   */
  var PENJAHIT_HEADERS = [
    'Penjahit',   // 1 (A)
    'Grup',       // 2 (B) BC atau SPREI, disamakan dengan grup pada SKU RULES
    'Aktif',      // 3 (C) YA atau TIDAK
    'Bobot',      // 4 (D) 1 = kapasitas biasa
    'Catatan'     // 5 (E)
  ];

  /**
   * Susunan kolom sheet SKU RULES, yaitu pemetaan SKU ke grup pekerjaan.
   *
   * Urutan baris berarti: yang dibaca lebih dulu menang. Karena itu aturan yang
   * umum diletakkan di bawah yang khusus, dan SKU seperti "TAS MIKA" yang bukan
   * pekerjaan jahit dapat dimatikan lewat grup IGNORE.
   */
  var RULES_HEADERS = [
    'Pola SKU',   // 1 (A) dibandingkan sebagai bagian dari nama SKU
    'Grup',       // 2 (B) BC, SPREI, atau IGNORE
    'Catatan'     // 3 (C)
  ];

  /**
   * Susunan kolom sheet PEMBAGIAN JAHIT, yaitu hasil pembagian per penugasan.
   *
   * Satu baris mewakili satu penjahit pada satu baris pesanan, dan kolom Qty
   * berisi berapa pcs yang menjadi bagiannya. Dua penjahit yang mengerjakan satu
   * baris pesanan menjadi dua baris; satu orang yang menerima dua pcs dari baris
   * itu cukup satu baris berisi Qty 2.
   *
   * Harga Satuan adalah upah per pcs, dan Harga Total adalah Qty × Harga Satuan.
   * Keduanya disimpan, bukan dihitung ulang saat dibaca, supaya rekap lama tetap
   * mencerminkan upah yang berlaku saat pembagiannya dibuat.
   */
  var BAGI_HEADERS = [
    'Toko',          // 1 (A) kode toko pemilik pesanan
    'No. Pesanan',   // 2 (B)
    'SKU',           // 3 (C)
    'Variasi',       // 4 (D)
    'Qty',           // 5 (E) jumlah pcs untuk penjahit itu pada baris pesanan itu
    'Penjahit',      // 6 (F)
    'Grup',          // 7 (G)
    'Harga Satuan',  // 8 (H) upah per pcs, disalin saat pembagian dibuat
    'Harga Total',   // 9 (I) Qty × Harga Satuan
    'Dibagi (WIB)'   // 10 (J) stempel waktu pembagian
  ];

  var KOLOM_PENJAHIT = { NAMA: 0, GRUP: 1, AKTIF: 2, BOBOT: 3, CATATAN: 4 };
  var KOLOM_RULES = { POLA: 0, GRUP: 1, CATATAN: 2 };
  var KOLOM_BAGI = {
    TOKO: 0, PESANAN: 1, SKU: 2, VARIASI: 3, QTY: 4,
    PENJAHIT: 5, GRUP: 6, HARGA: 7, TOTAL: 8, DIBAGI: 9
  };

  /**
   * Isi bawaan SETTING PENJAHIT, disalin dari berkas pembagian jahit tim supaya
   * sheet ini langsung dapat dipakai tanpa mengetik ulang.
   */
  var PENJAHIT_DEFAULT = [
    ['Penjahit', 'Grup', 'Aktif', 'Bobot', 'Catatan'],
    ['ADUL', 'BC', 'YA', 1, 'Bedcover'],
    ['OPIK', 'BC', 'YA', 1, 'Bedcover'],
    ['UGUN', 'SPREI', 'YA', 1, 'Sprei, sarkur, sarban'],
    ['ZAE', 'SPREI', 'YA', 1, 'Sprei, sarkur, sarban']
  ];

  /**
   * Isi bawaan SKU RULES.
   *
   * Urutannya disengaja: yang khusus lebih dulu. "SARUNG BANTAL & GULING" harus
   * dibaca sebelum "SARUNG BANTAL", kalau tidak pola yang lebih pendek akan
   * menangkap lebih dulu dan paket gabungan itu terhitung sebagai satu barang.
   */
  var RULES_DEFAULT = [
    ['Pola SKU', 'Grup', 'Catatan'],
    ['TAS MIKA', 'IGNORE', 'Item packing, bukan pekerjaan jahit'],
    ['PLASTIK', 'IGNORE', 'Item packing, bukan pekerjaan jahit'],
    ['BONUS', 'IGNORE', 'Item non-jahit'],
    ['BC AJA', 'BC', 'Bedcover'],
    ['BEDCOVER', 'BC', 'Bedcover'],
    ['BALMUT', 'SPREI', 'Balmut'],
    ['SARKUR', 'SPREI', 'Sarung kasur'],
    ['SPREI', 'SPREI', 'Sprei'],
    ['SARUNG BANTAL & GULING', 'SPREI', 'Sarban dan sargul'],
    ['SARBAN+SARGUL', 'SPREI', 'Sarban dan sargul'],
    ['SARBAN SAMBUNG', 'SPREI', 'Sarban sambung'],
    ['SARBAN', 'SPREI', 'Sarung bantal'],
    ['SARUNG BANTAL', 'SPREI', 'Sarung bantal'],
    ['SARUNG GULING', 'SPREI', 'Sarung guling']
  ];

  /**
   * Susunan kolom sheet Pengguna, satu baris per orang.
   *
   * Sandi tidak pernah disimpan apa adanya. Yang tersimpan hanya hasil hitungan
   * berulang beserta salt acak per pengguna, sehingga isi sheet tidak dapat
   * dipakai untuk masuk walaupun terbaca orang lain.
   */
  var PENGGUNA_HEADERS = [
    'Kode',                  // 1 (A) kunci login, disimpan huruf besar
    'Nama',                  // 2 (B)
    'Peran',                 // 3 (C) SUPERADMIN, ADMIN, atau PACKING
    'Email',                 // 4 (D) boleh kosong; untuk masuk tanpa sandi
    'Sandi (hash)',          // 5 (E)
    'Sandi (salt)',          // 6 (F)
    'Aktif',                 // 7 (G) YA atau TIDAK
    'Dibuat (WIB)',          // 8 (H)
    'Terakhir Masuk (WIB)'   // 9 (I)
  ];

  var LOG_HEADERS = [
    'Waktu (WIB)', 'Tipe Aksi', 'Jumlah Pesanan', 'Status', 'Keterangan Detail', 'Toko', 'Pengguna'
  ];

  /* Urutan peran dipakai untuk membandingkan hak, bukan untuk ditampilkan. */
  var PERAN = { PACKING: 'PACKING', ADMIN: 'ADMIN', SUPERADMIN: 'SUPERADMIN' };
  var PERINGKAT_PERAN = { PACKING: 1, ADMIN: 2, SUPERADMIN: 3 };

  /* Jumlah putaran hashing sandi. Aplikasi Script terlalu lambat untuk PBKDF2
     sungguhan, jadi angkanya dibatasi dan panjang sandi diminimalkan. */
  var PUTARAN_HASH = 1000;

  /**
   * Susunan kolom sheet DB_Token. Satu baris per toko, dengan Shop ID pada
   * kolom A sebagai kunci pencocokan. Delapan kolom pertama sudah ada sejak
   * versi satu toko; empat kolom terakhir ditambahkan untuk multi-toko.
   */
  var TOKEN_HEADERS = [
    'Shop ID',                  // 1 (A)  kunci pencocokan
    'Partner ID',               // 2 (B)
    'Access Token',             // 3 (C)
    'Refresh Token',            // 4 (D)
    'Expired At (Unix)',        // 5 (E)
    'Expired At (WIB)',         // 6 (F)
    'Terakhir Diperbarui (WIB)',// 7 (G)
    'Status Token',             // 8 (H)
    'Nama Toko',                // 9 (I)
    'Kode Toko',                // 10 (J) dipakai di kolom Q Pesanan Masuk
    'Aktif',                    // 11 (K) YA atau TIDAK
    'Region'                    // 12 (L) bawaan GLOBAL
  ];

  /**
   * Mengubah satu baris sheet DB_Token menjadi objek rekaman token.
   * Dipakai bersama oleh getTokenRecords() dan getTokenRecord().
   */
  function tokenRowToObject_(row) {
    var expiredAt = row[4];

    if (expiredAt instanceof Date) {
      expiredAt = expiredAt.getTime();
    } else if (typeof expiredAt === 'string') {
      var angka = Number(expiredAt);
      if (!isNaN(angka) && angka > 0) expiredAt = angka;
    }

    return {
      shop_id: String(row[0] || '').trim(),
      partner_id: String(row[1] || '').trim(),
      access_token: String(row[2] || '').trim(),
      refresh_token: String(row[3] || '').trim(),
      expired_at: expiredAt,
      expired_at_wib: row[5],
      updated_at: row[6],
      status: row[7],
      nama_toko: String(row[8] || '').trim(),
      kode_toko: String(row[9] || '').trim().toUpperCase(),
      aktif: String(row[10] || '').trim().toUpperCase() || 'YA',
      region: String(row[11] || '').trim().toUpperCase() || 'GLOBAL'
    };
  }

  /**
   * Menentukan apakah sebuah baris DB_Token dianggap berisi rekaman.
   * Baris dianggap berisi bila punya Shop ID atau access token, sehingga
   * token yang tersimpan tanpa Shop ID tetap terbaca dan tidak hilang diam-diam.
   */
  function barisTokenBerisi_(rec) {
    return Boolean(rec.shop_id || rec.access_token);
  }

  function cariKodeToko_(rekaman, kode) {
    var hasil = [];
    for (var i = 0; i < rekaman.length; i++) {
      if (rekaman[i].kode_toko === kode) hasil.push(rekaman[i]);
    }
    return hasil;
  }

  function sudahTerpilih_(terpilih, shopId) {
    for (var i = 0; i < terpilih.length; i++) {
      if (terpilih[i].shop_id === shopId) return true;
    }
    return false;
  }

  /**
   * Melengkapi pesan galat dengan daftar kode toko yang benar-benar tersedia,
   * supaya salah tulis di TOKO_AKTIF atau di kolom J langsung ketahuan.
   */
  function keteranganKodeToko_(rekaman) {
    if (rekaman.length === 0) return ' Belum ada toko aktif bertoken di DB_Token.';

    var tersedia = [];
    var tanpaKode = 0;
    for (var i = 0; i < rekaman.length; i++) {
      if (rekaman[i].kode_toko) {
        tersedia.push(rekaman[i].kode_toko);
      } else {
        tanpaKode++;
      }
    }

    var pesan = ' Toko yang tersedia: ' +
      (tersedia.length > 0 ? tersedia.join(', ') : '(belum ada yang berisi Kode Toko)') + '.';

    if (tanpaKode > 0) {
      pesan += ' ' + tanpaKode + ' baris DB_Token belum diisi kolom Kode Toko (kolom J).';
    }

    return pesan;
  }

  /**
   * Menghitung kondisi satu token: aktif, kadaluarsa, atau belum ada.
   *
   * Dipakai per toko, karena setiap toko punya masa berlaku tokennya sendiri
   * dan satu status tunggal tidak dapat mewakili semuanya.
   */
  /**
   * Membuat salt acak untuk satu pengguna. Salt berbeda per orang, sehingga dua
   * orang dengan sandi sama tetap menghasilkan hash yang berbeda.
   */
  function acakSalt_() {
    return Utilities.base64Encode(Utilities.getUuid() + '|' + Utilities.getUuid())
      .replace(/[^A-Za-z0-9]/g, '')
      .substring(0, 24);
  }

  /**
   * Menghitung hash sandi dengan salt milik pengguna.
   *
   * Dijalankan berulang supaya menebak sandi menjadi jauh lebih mahal.
   *
   * Kedua argumen computeHmacSha256Signature harus bertipe sama. Kiriman
   * campuran, misalnya Byte[] dengan String, ditolak saat berjalan dengan pesan
   * "parameter tidak cocok dengan tanda tangan metode". Karena itu kunci dan
   * nilai sama-sama diubah menjadi Byte[] lebih dulu, dan hasil tiap putaran
   * tetap berupa Byte[] sehingga tidak ada pengubahan tipe di tengah jalan.
   */
  function hashSandi_(sandi, salt, putaran) {
    var jumlah = Number(putaran) || PUTARAN_HASH;
    var kunci = Utilities.newBlob(String(salt)).getBytes();
    var nilai = Utilities.newBlob(String(salt) + '|' + String(sandi)).getBytes();

    for (var i = 0; i < jumlah; i++) {
      nilai = Utilities.computeHmacSha256Signature(nilai, kunci);
    }

    return Utilities.base64Encode(nilai);
  }

  /**
   * Memeriksa sandi terhadap rekaman pengguna.
   * Sandi asli tidak pernah disimpan, sehingga pembandingannya lewat hasil hash.
   */
  function sandiCocok_(sandi, rec) {
    if (!rec || !rec.sandi_hash || !rec.sandi_salt) return false;
    return hashSandi_(sandi, rec.sandi_salt, PUTARAN_HASH) === rec.sandi_hash;
  }

  function hitungKondisiToken_(rec) {
    var hasil = {
      hasToken: Boolean(rec && rec.access_token),
      isExpired: true,
      remainingMinutes: 0,
      statusText: 'BELUM ADA TOKEN'
    };

    if (!hasil.hasToken) return hasil;

    var expMs = Number(rec.expired_at) || 0;
    if (expMs > 0 && expMs < 10000000000) expMs = expMs * 1000;

    var diffMin = Math.floor((expMs - Date.now()) / 60000);
    hasil.remainingMinutes = diffMin;

    if (diffMin > 0) {
      hasil.isExpired = false;
      hasil.statusText = 'AKTIF (' + Math.floor(diffMin / 60) + 'j ' + (diffMin % 60) + 'm)';
    } else {
      hasil.statusText = 'KADALUARSA';
    }

    return hasil;
  }

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

  /**
   * Menulis baris header tanpa pernah menimpa data.
   *
   * Pengaman ini perlu karena beberapa fungsi menulis baris pertama tanpa
   * memeriksa apakah baris itu benar-benar header. Contohnya logActivity()
   * memakai appendRow(), sehingga bila sheet log masih kosong, baris pertama
   * akan berisi data tanpa header. Tanpa pengaman ini, inisialisasi berikutnya
   * akan menimpa baris data tersebut dengan header.
   *
   * Bila baris 1 ternyata bukan header, satu baris disisipkan di atasnya
   * sehingga seluruh data lama bergeser turun dan tetap utuh.
   */
  function tulisHeader_(sheet, headers) {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      return;
    }

    var barisPertama = String(sheet.getRange(1, 1, 1, 1).getValues()[0][0] || '').trim();
    if (barisPertama !== String(headers[0]).trim()) {
      sheet.insertRowBefore(1);
    }

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  /**
   * Menyiapkan baris header DATA PROSES tanpa menyentuh label yang sudah ada.
   *
   * Sheet ini diisi manusia, dan pemiliknya boleh memilih kata sendiri untuk
   * kolomnya. Karena itu kolom yang sudah berlabel dibiarkan apa adanya, dan
   * hanya kolom yang masih kosong yang diisi. Penulisan penuh hanya terjadi pada
   * sheet yang benar-benar baru, atau pada sheet yang baris pertamanya ternyata
   * data, dan pada kasus terakhir satu baris disisipkan supaya datanya tetap
   * utuh. Tanpa penjagaan ini, satu kali inisialisasi sudah cukup untuk
   * mengembalikan label buatan kode dan menimpa label pilihan pemiliknya.
   */
  function tulisHeaderProses_(sheet) {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(PROSES_HEADERS);
      return;
    }

    var range = sheet.getRange(1, 1, 1, PROSES_HEADERS.length);
    var ada = range.getValues()[0];
    var pertama = String(ada[0] === null || ada[0] === undefined ? '' : ada[0]).trim();
    var hasil = [];
    var kurang = false;
    var i;

    for (i = 0; i < PROSES_HEADERS.length; i++) {
      var isi = String(ada[i] === null || ada[i] === undefined ? '' : ada[i]).trim();
      if (!isi) kurang = true;
      hasil.push(isi || PROSES_HEADERS[i]);
    }

    if (pertama !== PROSES_HEADERS[0]) {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, PROSES_HEADERS.length).setValues([PROSES_HEADERS]);
      return;
    }

    if (kurang) range.setValues([hasil]);
  }

  /**
   * Pemetaan satu baris sheet (16 kolom) menjadi objek pesanan.
   * Dipakai bersama oleh getOrderRowsForExport dan getOrderRowsByStatus, dan
   * sengaja ditulis sama dengan blok ordersList.push di getDashboardSummary
   * agar bentuk objeknya selalu konsisten.
   */
  /**
   * Menentukan apakah satu baris sheet termasuk dalam cakupan toko tertentu.
   * Kode kosong berarti seluruh toko, bukan berarti tidak ada toko.
   */
  function barisSesuaiToko_(row, kode) {
    if (!kode) return true;
    return String(row[16] || '').trim().toUpperCase() === kode;
  }

  function mapBarisPesanan_(row) {
    return {
      orderSn: String(row[0] || '').trim(),
      date: String(row[1] || ''),
      shopeeStatus: String(row[2] || ''),
      internalStatus: String(row[3] || ''),
      buyer: String(row[4] || ''),
      items: String(row[5] || ''),
      sku: String(row[6] || '').trim() || '-',
      variation: bersihkanVariasi_(row[7]) || '-',
      qty: Number(row[8]) || 1,
      totalAmount: Number(row[9]) || 0,
      shippingFee: Number(row[10]) || 0,
      courier: String(row[11] || '').trim() || 'Lainnya',
      resi: String(row[12] || '-'),
      note: String(row[13] || ''),
      city: String(row[14] || ''),
      toko: String(row[16] || '').trim().toUpperCase(),
      syncTime: String(row[15] || '')
    };
  }

  /* Menyaring baris yang benar-benar punya nomor pesanan. */
  function barisPesananAda_(item) {
    return item.orderSn !== '';
  }

  /* ======================= HELPER PRODUKSI & ESTIMASI ======================= */

  /**
   * Teks sel dibaca dari nilai tampilannya lebih dulu.
   *
   * Alasannya sama dengan kolom SKU pada sheet Pesanan Masuk: satu nomor SKU yang
   * seluruhnya angka akan kembali sebagai Number, dan ketika dikirim ke halaman
   * ia berubah menjadi notasi eksponensial sehingga tidak lagi cocok dengan isi
   * sheet. Nilai tampilan mengembalikannya sebagai teks apa adanya.
   */
  function teksKolom_(raw, display) {
    var teks = (display === null || display === undefined) ? '' : String(display).trim();
    if (teks) return teks;
    if (raw === null || raw === undefined) return '';
    if (raw instanceof Date) return '';
    return String(raw).trim();
  }

  /** Angka sel dibaca dari nilai mentahnya, dengan toleransi untuk "Rp 12.000". */
  function angkaKolom_(raw) {
    if (raw === null || raw === undefined || raw === '') return 0;
    if (typeof raw === 'number') return isFinite(raw) ? raw : 0;
    var teks = String(raw).trim().replace(/^Rp\s?/i, '');
    if (!teks) return 0;
    if (teks.indexOf(',') >= 0 && teks.indexOf('.') < 0) teks = teks.replace(',', '.');
    else teks = teks.replace(/\./g, '');
    var num = parseFloat(teks);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Bentuk baku sebuah teks untuk dipakai sebagai bagian kunci.
   *
   * "SARKUR 120/5" dan "sarkur  120/5" adalah barang yang sama, jadi spasi
   * berlebih dan besar-kecil huruf tidak boleh membuat keduanya dianggap
   * berbeda. Tanpa ini, satu baris pesanan yang sama akan tercatat dua kali.
   */
  function normalTeks_(nilai) {
    return String(nilai === null || nilai === undefined ? '' : nilai)
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  /**
   * Memangkas keterangan sesudah koma pada nama variasi.
   *
   * Variasi "Lilac,BC 90x220" menjadi "Lilac": keterangan sesudah koma adalah
   * ukuran yang sudah tercermin pada SKU. Dipakai saat data masuk, saat dibaca,
   * dan saat kunci disusun, supaya baris lama yang masih panjang tetap cocok
   * dengan baris baru yang sudah pendek.
   */
  function bersihkanVariasi_(nilai) {
    var teks = String(nilai === null || nilai === undefined ? '' : nilai).trim();
    var pisah = teks.indexOf(',');
    if (pisah >= 0) teks = teks.slice(0, pisah).trim();
    return teks;
  }

  /**
   * Kunci satu baris antrian produksi: nomor pesanan, SKU, dan variasi.
   *
   * Nomor pesanan ikut masuk kunci karena satu pesanan dapat berisi dua variasi
   * barang, dan keduanya memang dua baris pekerjaan yang berbeda. Variasinya sudah
   * dipangkas pada koma, sehingga "Lilac,BC 90x220" dan "Lilac" menunjuk baris yang
   * sama.
   */
  function kunciAntrian_(sku, variasi, noPesanan) {
    return normalTeks_(noPesanan) + '|' + normalTeks_(sku) + '|' + normalTeks_(bersihkanVariasi_(variasi));
  }

  /**
   * Kunci satu baris hasil jahit pada sheet DATA JAHIT.
   *
   * Beda dari kunci antrian: nama penjahit ikut masuk. Alasannya, satu baris
   * pesanan dapat dikerjakan dua orang — dua pcs dari pesanan yang sama boleh
   * jatuh ke penjahit berbeda pada pembagian — sehingga keduanya harus dapat
   * tercatat sebagai dua baris hasil jahit. Tanpa penjahit pada kunci, pcs kedua
   * dianggap duplikat dan upahnya hilang. Pengiriman tabel input yang sama dua
   * kali tetap dilewati, karena penjahitnya pun sama.
   */
  function kunciProduksi_(sku, variasi, noPesanan, penjahit) {
    return kunciAntrian_(sku, variasi, noPesanan) + '|' + normalTeks_(penjahit);
  }

  /**
   * Membaca seluruh baris DATA PROSES beserta nomor barisnya.
   *
   * Nomor baris dikembalikan supaya pemanggil dapat melaporkan baris mana yang
   * bermasalah tanpa perlu membaca ulang sheet.
   */
  function bacaBarisProses_() {
    var sheet = getOrCreateSheet(SHEETS.PROSES);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var range = sheet.getRange(2, 1, lastRow - 1, PROSES_HEADERS.length);
    var nilai = range.getValues();
    var tampil = range.getDisplayValues();

    var hasil = [];
    for (var i = 0; i < nilai.length; i++) {
      var baris = nilai[i];
      var sku = teksKolom_(baris[KOLOM_PROSES.SKU], tampil[i][KOLOM_PROSES.SKU]);
      if (!sku) continue;

      hasil.push({
        barisSheet: i + 2,
        sku: sku,
        harga: angkaKolom_(baris[KOLOM_PROSES.HARGA]),
        waktuJahit: angkaKolom_(baris[KOLOM_PROSES.JAHIT]),
        waktuPotong: angkaKolom_(baris[KOLOM_PROSES.POTONG])
      });
    }
    return hasil;
  }

  /** Membaca seluruh baris DATA JAHIT beserta nomor barisnya. */
  function bacaBarisProduksi_() {
    var sheet = getOrCreateSheet(SHEETS.PRODUKSI);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var numCols = Math.max(sheet.getLastColumn(), PRODUKSI_HEADERS.length);
    var range = sheet.getRange(2, 1, lastRow - 1, numCols);
    var nilai = range.getValues();
    var tampil = range.getDisplayValues();

    var hasil = [];
    for (var i = 0; i < nilai.length; i++) {
      var baris = nilai[i];
      var sku = teksKolom_(baris[KOLOM_PRODUKSI.SKU], tampil[i][KOLOM_PRODUKSI.SKU]);
      if (!sku) continue;

      /* Tanggal disimpan apa adanya sebagai teks ISO. Membacanya sebagai Date
         lalu memformatnya akan menggeser hari bila zona waktu skrip berbeda
         dengan zona waktu lembar kerja. */
      var tanggal = baris[KOLOM_PRODUKSI.TANGGAL];
      hasil.push({
        barisSheet: i + 2,
        tanggal: (tanggal instanceof Date)
          ? Utilities.formatDate(tanggal, 'Asia/Jakarta', 'yyyy-MM-dd')
          : String(tanggal === null || tanggal === undefined ? '' : tanggal).trim(),
        sesi: teksKolom_(baris[KOLOM_PRODUKSI.SESI], tampil[i][KOLOM_PRODUKSI.SESI]),
        sku: sku,
        variasi: bersihkanVariasi_(teksKolom_(baris[KOLOM_PRODUKSI.VARIASI], tampil[i][KOLOM_PRODUKSI.VARIASI])),
        jumlah: angkaKolom_(baris[KOLOM_PRODUKSI.JUMLAH]),
        penjahit: teksKolom_(baris[KOLOM_PRODUKSI.PENJAHIT], tampil[i][KOLOM_PRODUKSI.PENJAHIT]),
        noPesanan: teksKolom_(baris[KOLOM_PRODUKSI.PESANAN], tampil[i][KOLOM_PRODUKSI.PESANAN]),
        toko: teksKolom_(baris[KOLOM_PRODUKSI.TOKO], tampil[i][KOLOM_PRODUKSI.TOKO])
      });
    }
    return hasil;
  }

  /**
   * Menyusun satu baris siap tulis untuk sheet DATA PROSES.
   *
   * Bentuk masukannya sama dengan yang dikirim halaman: sku, harga, jahit, dan
   * potong. Harga dan waktu yang belum diisi ditulis sebagai sel kosong, bukan
   * angka 0. Sel kosong berarti "belum dihargai" dan petugas dapat melihatnya,
   * sedangkan angka 0 berarti "gratis" dan itu keterangan yang keliru.
   */
  function barisHargaProses_(item) {
    return [
      item.sku || '',
      item.harga > 0 ? item.harga : '',
      item.jahit > 0 ? item.jahit : '',
      item.potong > 0 ? item.potong : ''
    ];
  }

  /** Menyusun satu baris siap tulis untuk sheet DATA JAHIT. */
  function barisProduksiUntukSheet_(item) {
    return [
      item.tanggal || '',
      item.sesi || '',
      item.sku || '',
      bersihkanVariasi_(item.variasi) || '',
      item.jumlah || 0,
      item.penjahit || '',
      item.noPesanan || '',
      item.toko || ''
    ];
  }

  /** Membaca seluruh baris SETTING PENJAHIT beserta nomor barisnya. */
  function bacaBarisPenjahit_() {
    var sheet = getOrCreateSheet(SHEETS.PENJAHIT);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var range = sheet.getRange(2, 1, lastRow - 1, PENJAHIT_HEADERS.length);
    var nilai = range.getValues();
    var tampil = range.getDisplayValues();
    var hasil = [];

    for (var i = 0; i < nilai.length; i++) {
      var baris = nilai[i];
      var nama = teksKolom_(baris[KOLOM_PENJAHIT.NAMA], tampil[i][KOLOM_PENJAHIT.NAMA]);
      if (!nama) continue;

      hasil.push({
        barisSheet: i + 2,
        nama: nama,
        grup: teksKolom_(baris[KOLOM_PENJAHIT.GRUP], tampil[i][KOLOM_PENJAHIT.GRUP]),
        /* Aktif dibaca apa adanya, lalu dianggap aktif bila selnya kosong.
           Baris lama yang belum punya kolom Aktif tetap ikut bekerja, karena
           menganggapnya tidak aktif akan membuat pembagiannya kosong tanpa
           sebab yang terlihat. */
        aktif: String(teksKolom_(baris[KOLOM_PENJAHIT.AKTIF], tampil[i][KOLOM_PENJAHIT.AKTIF]) || 'YA'),
        bobot: angkaKolom_(baris[KOLOM_PENJAHIT.BOBOT]) || 1,
        catatan: teksKolom_(baris[KOLOM_PENJAHIT.CATATAN], tampil[i][KOLOM_PENJAHIT.CATATAN])
      });
    }
    return hasil;
  }

  /** Membaca seluruh baris SKU RULES, urut sesuai urutan di sheet. */
  function bacaBarisAturan_() {
    var sheet = getOrCreateSheet(SHEETS.RULES);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var range = sheet.getRange(2, 1, lastRow - 1, RULES_HEADERS.length);
    var nilai = range.getValues();
    var tampil = range.getDisplayValues();
    var hasil = [];

    for (var i = 0; i < nilai.length; i++) {
      var pola = teksKolom_(nilai[i][KOLOM_RULES.POLA], tampil[i][KOLOM_RULES.POLA]);
      var grup = teksKolom_(nilai[i][KOLOM_RULES.GRUP], tampil[i][KOLOM_RULES.GRUP]);
      if (!pola || !grup) continue;

      hasil.push({
        barisSheet: i + 2,
        pola: pola,
        grup: grup.toUpperCase(),
        catatan: teksKolom_(nilai[i][KOLOM_RULES.CATATAN], tampil[i][KOLOM_RULES.CATATAN])
      });
    }
    return hasil;
  }

  /** Membaca seluruh baris PEMBAGIAN JAHIT beserta nomor barisnya. */
  function bacaBarisPembagian_() {
    var sheet = getOrCreateSheet(SHEETS.BAGI);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var numCols = Math.max(sheet.getLastColumn(), BAGI_HEADERS.length);
    var range = sheet.getRange(2, 1, lastRow - 1, numCols);
    var nilai = range.getValues();
    var tampil = range.getDisplayValues();
    var hasil = [];

    for (var i = 0; i < nilai.length; i++) {
      var baris = nilai[i];
      var sku = teksKolom_(baris[KOLOM_BAGI.SKU], tampil[i][KOLOM_BAGI.SKU]);
      if (!sku) continue;

      var harga = angkaKolom_(baris[KOLOM_BAGI.HARGA]);
      var total = angkaKolom_(baris[KOLOM_BAGI.TOTAL]);

      /* Baris bentuk lama menyimpan bagian pcs ("1/2") pada kolom ini, dan satu
         baris seperti itu berarti satu pcs. Baris baru berisi jumlah pcs. */
      var teksQty = teksKolom_(baris[KOLOM_BAGI.QTY], tampil[i][KOLOM_BAGI.QTY]);
      var qty = (teksQty.indexOf('/') >= 0) ? 1 : angkaKolom_(baris[KOLOM_BAGI.QTY]);
      if (qty <= 0) qty = 1;

      /* Harga Total yang kosong dihitung dari harga satuannya supaya rekap lama
         yang belum sempat dirapikan tetap terbaca benar. */
      if (total <= 0 && harga > 0) total = harga * qty;

      hasil.push({
        barisSheet: i + 2,
        toko: teksKolom_(baris[KOLOM_BAGI.TOKO], tampil[i][KOLOM_BAGI.TOKO]),
        noPesanan: teksKolom_(baris[KOLOM_BAGI.PESANAN], tampil[i][KOLOM_BAGI.PESANAN]),
        sku: sku,
        variasi: bersihkanVariasi_(teksKolom_(baris[KOLOM_BAGI.VARIASI], tampil[i][KOLOM_BAGI.VARIASI])),
        qty: qty,
        penjahit: teksKolom_(baris[KOLOM_BAGI.PENJAHIT], tampil[i][KOLOM_BAGI.PENJAHIT]),
        grup: teksKolom_(baris[KOLOM_BAGI.GRUP], tampil[i][KOLOM_BAGI.GRUP]).toUpperCase(),
        harga: harga,
        hargaTotal: total,
        dibagi: teksKolom_(baris[KOLOM_BAGI.DIBAGI], tampil[i][KOLOM_BAGI.DIBAGI])
      });
    }
    return hasil;
  }

  /** Menyusun satu baris siap tulis untuk sheet PEMBAGIAN JAHIT. */
  function barisPembagianUntukSheet_(unit, dibagi) {
    var qty = Number(unit.qty) > 0 ? Number(unit.qty) : 0;
    var harga = Number(unit.harga) > 0 ? Number(unit.harga) : 0;

    return [
      unit.toko || '',
      unit.noPesanan || '',
      unit.sku || '',
      bersihkanVariasi_(unit.variasi) || '',
      qty > 0 ? qty : '',
      unit.penjahit || '',
      unit.grup || '',
      harga > 0 ? harga : '',
      (harga > 0 && qty > 0) ? harga * qty : '',
      dibagi || ''
    ];
  }

  /**
   * Kunci satu baris PEMBAGIAN JAHIT: nomor pesanan, SKU, variasi, dan penjahit.
   *
   * Penjahit ikut masuk kunci karena satu baris pesanan dapat dikerjakan dua
   * orang. Bagian pcs tidak ikut, sebab yang dicatat adalah jumlah pcs per orang,
   * bukan pcs yang mana.
   */
  function kunciPembagian_(sku, variasi, noPesanan, penjahit) {
    return kunciAntrian_(sku, variasi, noPesanan) + '|' + normalTeks_(penjahit);
  }

  /**
   * Mengubah isi lama PEMBAGIAN JAHIT menjadi bentuk sekarang.
   *
   * Bentuk lama menulis satu baris per pcs dengan kolom Part ("1/2"), bentuk
   * sekarang menulis satu baris per penjahit dengan kolom Qty dan Harga Total.
   * Baris yang sama pesanan, SKU, variasi, dan penjahitnya digabung, lalu jumlah
   * pcs-nya menjadi Qty. Bagian pcs tidak lagi punya arti: yang dicatat memang
   * jumlahnya, bukan pcs yang mana, sehingga tidak ada keterangan yang hilang.
   *
   * Dijalankan hanya bila sheetnya masih berbentuk lama, jadi aman dipanggil
   * berkali-kali. Dipanggil sebelum header ditulis ulang, selagi nama kolom
   * lamanya masih terbaca.
   *
   * @return {number} jumlah baris lama yang dibaca, 0 bila tidak ada yang dirapikan
   */
  function rapikanPembagianLama_(sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0;

    /* Hanya satu kolom yang dibaca lebih dulu: pemeriksaan ini berjalan setiap
       kali pembagian dijalankan, jadi tidak boleh membaca seluruh sheet hanya
       untuk menyimpulkan bahwa tidak ada yang perlu dirapikan. */
    var headerQty = String(
      sheet.getRange(1, KOLOM_BAGI.QTY + 1, 1, 1).getValues()[0][0] || '').trim().toLowerCase();

    if (headerQty === 'qty') {
      var kolomQty = sheet.getRange(2, KOLOM_BAGI.QTY + 1, lastRow - 1, 1).getDisplayValues();
      var masihPart = false;
      for (var p = 0; p < kolomQty.length && !masihPart; p++) {
        if (String(kolomQty[p][0] || '').indexOf('/') >= 0) masihPart = true;
      }
      if (!masihPart) return 0;
    }

    var numCols = Math.max(sheet.getLastColumn(), 9);
    var range = sheet.getRange(2, 1, lastRow - 1, numCols);
    var nilai = range.getValues();
    var tampil = range.getDisplayValues();

    /* Bentuk baru memakai 10 kolom, sehingga kolom Dibagi bergeser satu: tanpa
       ini, stempel waktunya terbaca dari kolom Harga Total pada sheet yang baru
       separuh terubah. */
    var kolomDibagi = headerQty === 'qty' ? 9 : 8;

    var peta = {};
    var urutan = [];

    for (var r = 0; r < nilai.length; r++) {
      var sku = teksKolom_(nilai[r][2], tampil[r][2]);
      if (!sku) continue;

      /* Baris bentuk lama menyimpan bagian pcs ("1/2") dan berarti satu pcs. Baris
         yang sudah berbentuk Qty membawa jumlahnya sendiri, jadi jumlah yang sudah
         benar tidak ikut menggelembung bila penggabungan ini terpanggil lagi. */
      var teksQty = teksKolom_(nilai[r][4], tampil[r][4]);
      var qtyBaris = (teksQty.indexOf('/') >= 0) ? 1 : angkaKolom_(nilai[r][4]);
      if (qtyBaris <= 0) qtyBaris = 1;

      var baris = {
        toko: teksKolom_(nilai[r][0], tampil[r][0]),
        noPesanan: teksKolom_(nilai[r][1], tampil[r][1]),
        sku: sku,
        variasi: bersihkanVariasi_(teksKolom_(nilai[r][3], tampil[r][3])),
        qty: 0,
        penjahit: teksKolom_(nilai[r][5], tampil[r][5]),
        grup: teksKolom_(nilai[r][6], tampil[r][6]),
        harga: angkaKolom_(nilai[r][7]),
        dibagi: teksKolom_(nilai[r][kolomDibagi], tampil[r][kolomDibagi])
      };

      var kunci = kunciPembagian_(baris.sku, baris.variasi, baris.noPesanan, baris.penjahit);
      if (!peta[kunci]) {
        peta[kunci] = baris;
        urutan.push(kunci);
      }
      peta[kunci].qty += qtyBaris;
    }

    var hasil = [];
    for (var k = 0; k < urutan.length; k++) {
      hasil.push(barisPembagianUntukSheet_(peta[urutan[k]], peta[urutan[k]].dibagi));
    }

    /* Header ditulis sekalian, dalam satu panggilan yang sama dengan datanya.
       Kalau tidak, sheet sempat berada dalam keadaan separuh terubah (kolomnya
       sudah Qty, headernya masih Part), dan pemanggilan berikutnya membacanya
       sebagai bentuk lama lalu menghitung jumlahnya dua kali. */
    var numKolom = Math.max(numCols, BAGI_HEADERS.length);
    var kosong = [];
    for (var s = 0; s < numKolom; s++) kosong.push('');

    var isi = [BAGI_HEADERS.slice()];
    var tinggiData = Math.max(nilai.length, hasil.length);
    for (var h = 0; h < tinggiData; h++) {
      isi.push(h < hasil.length ? hasil[h] : kosong.slice());
    }

    sheet.getRange(1, 1, isi.length, numKolom).setValues(isi);

    return nilai.length;
  }

  /**
   * Mengisi sheet setelan dengan isi bawaan bila belum ada satu baris data pun.
   *
   * Dipanggil dari initAllSheets supaya kedua sheet itu langsung dapat dipakai.
   * Sheet yang sudah berisi tidak pernah disentuh, karena isinya adalah
   * keputusan manusia tentang siapa mengerjakan apa. Yang diperiksa adalah baris
   * data, bukan baris pertama, sebab baris pertama memang berisi header.
   *
   * @return {number} jumlah baris data yang ditulis, 0 bila tidak menulis apa pun
   */
  function isiBawaanBilaKosong_(sheet, headers, bawaan) {
    var lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      var barisData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      for (var i = 0; i < barisData.length; i++) {
        for (var j = 0; j < barisData[i].length; j++) {
          if (String(barisData[i][j] || '').trim() !== '') return 0;
        }
      }
    }

    var adaHeader = lastRow >= 1 &&
      String(sheet.getRange(1, 1, 1, headers.length).getValues()[0][0] || '').trim() !== '';

    var isi = adaHeader ? bawaan.slice(1) : bawaan;
    if (!isi.length) return 0;

    sheet.getRange(adaHeader ? 2 : 1, 1, isi.length, headers.length).setValues(isi);
    return isi.length;
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
      var orderHeaders = PESANAN_HEADERS;

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
        tulisHeader_(orderSheet, orderHeaders);
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
      orderSheet.getRange('Q2:Q5000').setNumberFormat('@');   // Kode toko, teks biasa

      // 2. Sheet DB_Token
      var tokenSheet = getOrCreateSheet(SHEETS.TOKEN);
      // Susunan kolom dipakai bersama dengan pembacaan token, lihat TOKEN_HEADERS
      var tokenHeaders = TOKEN_HEADERS;

      tulisHeader_(tokenSheet, tokenHeaders);

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
        ['DEFAULT_SYNC_DAYS', '3', 'Rentang hari pesanan yang ditarik secara default'],
        ['TOKO_AKTIF', '', 'Kode toko yang ikut sinkron otomatis, dipisah koma (contoh: BGD,BGD2). Kosong berarti semua toko aktif. Lihat docs/arsitektur-multi-toko.md'],
        ['WAJIB_LOGIN', 'TIDAK', 'YA berarti dashboard menuntut masuk sebelum data dapat dibaca. Biarkan TIDAK selama uji coba, lalu ubah ke YA untuk memberlakukannya. Lihat docs/arsitektur-login-peran.md']
      ];

      if (configSheet.getLastRow() === 0) {
        configSheet.appendRow(configHeaders);
        for (var i = 0; i < defaultConfigs.length; i++) {
          configSheet.appendRow(defaultConfigs[i]);
        }
      } else {
        // Menambahkan parameter baru yang belum ada, tanpa mengubah nilai yang
        // sudah diisi pengguna. Dibuat idempoten agar aman dijalankan berulang.
        var kunciAda = {};
        var isiKonfig = configSheet.getDataRange().getValues();
        for (var cfgRow = 1; cfgRow < isiKonfig.length; cfgRow++) {
          var kunciCfg = String(isiKonfig[cfgRow][0] || '').trim();
          if (kunciCfg) kunciAda[kunciCfg] = true;
        }
        for (var cfgIdx = 0; cfgIdx < defaultConfigs.length; cfgIdx++) {
          if (!kunciAda[defaultConfigs[cfgIdx][0]]) {
            configSheet.appendRow(defaultConfigs[cfgIdx]);
          }
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

      // 4. Sheet Pengguna
      var penggunaSheet = getOrCreateSheet(SHEETS.PENGGUNA);
      tulisHeader_(penggunaSheet, PENGGUNA_HEADERS);

      var penggunaHeaderRange = penggunaSheet.getRange(1, 1, 1, PENGGUNA_HEADERS.length);
      penggunaHeaderRange
        .setBackground('#7c2d12')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10)
        .setHorizontalAlignment('center');
      penggunaSheet.setFrozenRows(1);
      // Kode, hash, dan salt adalah teks. Tanpa format ini, angka panjang dapat
      // berubah menjadi notasi eksponensial dan hash tidak lagi cocok.
      penggunaSheet.getRange('A2:A500').setNumberFormat('@');
      penggunaSheet.getRange('D2:F500').setNumberFormat('@');

      // 5. Sheet Log_Aktivitas
      var logSheet = getOrCreateSheet(SHEETS.LOG);
      tulisHeader_(logSheet, LOG_HEADERS);

      var logHeaderRange = logSheet.getRange(1, 1, 1, LOG_HEADERS.length);
      logHeaderRange
        .setBackground('#475569')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10);
      logSheet.setFrozenRows(1);

      // 6. Sheet DATA PROSES — daftar harga dan waktu proses per SKU
      var prosesSheet = getOrCreateSheet(SHEETS.PROSES);
      tulisHeaderProses_(prosesSheet);

      prosesSheet.getRange(1, 1, 1, PROSES_HEADERS.length)
        .setBackground('#1d4ed8')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10)
        .setHorizontalAlignment('center');
      prosesSheet.setFrozenRows(1);
      // Harga dan waktu dibiarkan bertipe angka supaya dapat dijumlahkan.
      prosesSheet.getRange('B2:B5000').setNumberFormat('Rp #,##0');
      prosesSheet.getRange('C2:D5000').setNumberFormat('0.##');
      // SKU adalah teks. Nomor referensi yang seluruhnya angka tetap harus
      // dibaca apa adanya, bukan sebagai notasi eksponensial.
      prosesSheet.getRange('A2:A5000').setNumberFormat('@');

      // 7. Sheet DATA JAHIT — hasil jahit per baris pesanan
      var produksiSheet = getOrCreateSheet(SHEETS.PRODUKSI);
      tulisHeader_(produksiSheet, PRODUKSI_HEADERS);

      produksiSheet.getRange(1, 1, 1, PRODUKSI_HEADERS.length)
        .setBackground('#047857')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10)
        .setHorizontalAlignment('center');
      produksiSheet.setFrozenRows(1);
      produksiSheet.getRange('A2:A5000').setNumberFormat('yyyy-mm-dd');
      produksiSheet.getRange('E2:E5000').setNumberFormat('0');
      produksiSheet.getRange('C2:D5000').setNumberFormat('@');
      produksiSheet.getRange('F2:F5000').setNumberFormat('@');
      produksiSheet.getRange('G2:H5000').setNumberFormat('@');

      // 8. Sheet SETTING PENJAHIT — daftar penjahit, grup, dan bobot kapasitasnya
      var penjahitSheet = getOrCreateSheet(SHEETS.PENJAHIT);
      tulisHeader_(penjahitSheet, PENJAHIT_HEADERS);

      penjahitSheet.getRange(1, 1, 1, PENJAHIT_HEADERS.length)
        .setBackground('#7c3aed')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10)
        .setHorizontalAlignment('center');
      penjahitSheet.setFrozenRows(1);
      penjahitSheet.getRange('D2:D500').setNumberFormat('0.##');
      penjahitSheet.getRange('A2:C500').setNumberFormat('@');
      // Isi bawaan ditulis hanya bila belum ada satu baris data pun.
      isiBawaanBilaKosong_(penjahitSheet, PENJAHIT_HEADERS, PENJAHIT_DEFAULT);

      // 9. Sheet SKU RULES — pemetaan SKU ke grup pekerjaan
      var rulesSheet = getOrCreateSheet(SHEETS.RULES);
      tulisHeader_(rulesSheet, RULES_HEADERS);

      rulesSheet.getRange(1, 1, 1, RULES_HEADERS.length)
        .setBackground('#b45309')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10)
        .setHorizontalAlignment('center');
      rulesSheet.setFrozenRows(1);
      rulesSheet.getRange('A2:C5000').setNumberFormat('@');
      isiBawaanBilaKosong_(rulesSheet, RULES_HEADERS, RULES_DEFAULT);

      // 10. Sheet PEMBAGIAN JAHIT — hasil pembagian, satu baris per penjahit
      var bagiSheet = getOrCreateSheet(SHEETS.BAGI);
      // Bentuk lama (satu baris per pcs dengan kolom Part) dirapikan lebih dulu,
      // selagi nama kolomnya masih terbaca.
      rapikanPembagianLama_(bagiSheet);
      tulisHeader_(bagiSheet, BAGI_HEADERS);

      bagiSheet.getRange(1, 1, 1, BAGI_HEADERS.length)
        .setBackground('#0f766e')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(10)
        .setHorizontalAlignment('center');
      bagiSheet.setFrozenRows(1);
      // Qty dan kedua kolom harga dibiarkan bertipe angka supaya dapat dijumlahkan.
      bagiSheet.getRange('E2:E5000').setNumberFormat('0');
      bagiSheet.getRange('H2:I5000').setNumberFormat('Rp #,##0');
      // Toko, nomor pesanan, SKU, variasi, penjahit, dan grup adalah teks. Nomor
      // pesanan Shopee berupa deretan angka panjang, dan tanpa format ini isinya
      // berubah menjadi notasi eksponensial lalu tidak lagi cocok saat dicocokkan.
      bagiSheet.getRange('A2:D5000').setNumberFormat('@');
      bagiSheet.getRange('F2:G5000').setNumberFormat('@');
      bagiSheet.getRange('J2:J5000').setNumberFormat('@');

      return true;
    },

    /**
     * Membaca seluruh baris antrian pada sheet DATA PROSES.
     *
     * @return {Array<Object>} baris antrian, urut sesuai urutan di sheet
     */
    bacaProses: function() {
      return bacaBarisProses_();
    },

    /**
     * Membaca seluruh baris hasil jahit pada sheet DATA JAHIT.
     * Dipakai untuk memastikan satu baris pesanan tidak dijahit dua kali.
     *
     * @return {Array<Object>} baris hasil jahit, urut sesuai urutan di sheet
     */
    bacaProduksi: function() {
      return bacaBarisProduksi_();
    },

    /**
     * Kunci satu baris pekerjaan, dipakai bersama oleh penarikan dan penyimpanan.
     *
     * Disediakan ke luar modul supaya kedua alur itu memakai satu definisi kunci
     * yang sama. Bila masing-masing menyusun kuncinya sendiri, satu perbedaan
     * spasi saja sudah cukup untuk membuat baris yang sama tercatat dua kali.
     *
     * @param {string} sku
     * @param {string} variasi
     * @param {string} noPesanan
     * @return {string} kunci berbentuk "nopesanan|sku|variasi"
     */
    kunciAntrian: function(sku, variasi, noPesanan) {
      return kunciAntrian_(sku, variasi, noPesanan);
    },

    /**
     * Kunci satu baris hasil jahit, dipakai bersama oleh penyimpanan hasil dari
     * tabel input halaman dan dari pembagian jahit.
     *
     * @param {string} sku
     * @param {string} variasi
     * @param {string} noPesanan
     * @param {string} penjahit
     * @return {string} kunci berbentuk "nopesanan|sku|variasi|penjahit"
     */
    kunciProduksi: function(sku, variasi, noPesanan, penjahit) {
      return kunciProduksi_(sku, variasi, noPesanan, penjahit);
    },

    /**
     * Nama variasi tanpa keterangan sesudah koma, untuk modul produksi dan
     * halaman. Satu definisi dipakai semua pihak supaya tidak ada tempat yang
     * memangkasnya dengan aturan sendiri lalu tidak cocok dengan yang lain.
     *
     * @param {string} nilai nama variasi apa adanya
     * @return {string} nama variasi yang dipakai ERP
     */
    bersihkanVariasi: function(nilai) {
      return bersihkanVariasi_(nilai);
    },

    /**
     * Menambahkan baris hasil jahit pada sheet DATA JAHIT.
     *
     * @param {Array<Object>} daftar baris berisi tanggal, sesi, sku, variasi,
     *   jumlah, penjahit, noPesanan, dan toko
     * @return {number} jumlah baris yang ditulis
     */
    tambahProduksiBatch: function(daftar) {
      if (!daftar || daftar.length === 0) return 0;

      var sheet = getOrCreateSheet(SHEETS.PRODUKSI);
      var baris = [];
      for (var i = 0; i < daftar.length; i++) {
        baris.push(barisProduksiUntukSheet_(daftar[i]));
      }

      sheet.getRange(sheet.getLastRow() + 1, 1, baris.length, PRODUKSI_HEADERS.length)
        .setValues(baris);
      return baris.length;
    },

    /**
     * Menyimpan harga dan waktu proses per SKU pada sheet DATA PROSES.
     *
     * Baris dicari menurut SKU-nya. SKU yang sudah punya baris diperbarui di
     * tempat, SKU yang belum pernah dihargai mendapat baris baru di bawah daftar.
     * Satu kali simpan karena itu cukup untuk SKU lama maupun SKU yang baru
     * muncul dari pesanan, tanpa perlu ada baris kosong yang disiapkan lebih dulu.
     *
     * Dua pagar yang berlaku:
     * 1. Nilai kosong atau nol tidak pernah ditulis. Tanpa pagar ini, satu isian
     *    yang lupa diisi dapat menghapus harga yang sudah benar. Untuk
     *    mengosongkan sebuah nilai, selnya dihapus langsung di sheet.
     * 2. Nilai yang sama persis tidak dihitung sebagai perubahan, supaya pesan
     *    yang dilaporkan jujur dan penulisan ulang yang tidak perlu dihindari.
     *
     * @param {Array<Object>} daftar berisi sku, harga, jahit, dan potong
     * @return {Object} jumlah sel yang berubah dan baris baru yang ditambahkan
     */
    simpanHargaProses: function(daftar) {
      var hasil = { selDiperbarui: 0, barisDitambah: 0 };
      if (!daftar || daftar.length === 0) return hasil;

      var sheet = getOrCreateSheet(SHEETS.PROSES);
      tulisHeaderProses_(sheet);

      var kolomNilai = [
        { kolom: KOLOM_PROSES.HARGA, kunci: 'harga' },
        { kolom: KOLOM_PROSES.JAHIT, kunci: 'jahit' },
        { kolom: KOLOM_PROSES.POTONG, kunci: 'potong' }
      ];

      var lastRow = sheet.getLastRow();
      var nilai = [];
      var peta = {};
      var berubah = 0;
      var r;

      if (lastRow >= 2) {
        var range = sheet.getRange(2, 1, lastRow - 1, PROSES_HEADERS.length);
        nilai = range.getValues();
        var tampil = range.getDisplayValues();

        /* SKU yang muncul lebih dari sekali diwakili baris terakhirnya, sama
           dengan aturan kamus: yang lebih baru menggantikan yang lama. */
        for (r = 0; r < nilai.length; r++) {
          var skuBaris = teksKolom_(nilai[r][KOLOM_PROSES.SKU], tampil[r][KOLOM_PROSES.SKU]);
          if (!skuBaris) continue;
          peta[normalTeks_(skuBaris)] = r;
        }

        for (var i = 0; i < daftar.length; i++) {
          var item = daftar[i] || {};
          var kunci = normalTeks_(item.sku);
          if (!kunci || !Object.prototype.hasOwnProperty.call(peta, kunci)) continue;

          var barisIdx = peta[kunci];
          for (var k = 0; k < kolomNilai.length; k++) {
            var idx = kolomNilai[k].kolom;
            var baru = angkaKolom_(item[kolomNilai[k].kunci]);
            if (baru <= 0) continue;
            if (angkaKolom_(nilai[barisIdx][idx]) === baru) continue;

            nilai[barisIdx][idx] = baru;
            berubah++;
          }
        }

        if (berubah > 0) range.setValues(nilai);
      }

      var barisBaru = [];
      var sudahBaru = {};
      for (var j = 0; j < daftar.length; j++) {
        var tambahan = daftar[j] || {};
        var kunciBaru = normalTeks_(tambahan.sku);
        if (!kunciBaru || sudahBaru[kunciBaru]) continue;
        sudahBaru[kunciBaru] = true;

        if (Object.prototype.hasOwnProperty.call(peta, kunciBaru)) continue;
        barisBaru.push(barisHargaProses_(tambahan));
      }

      if (barisBaru.length) {
        sheet.getRange(sheet.getLastRow() + 1, 1, barisBaru.length, PROSES_HEADERS.length)
          .setValues(barisBaru);
      }

      hasil.selDiperbarui = berubah;
      hasil.barisDitambah = barisBaru.length;
      return hasil;
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
     * Membaca seluruh rekaman token dari sheet DB_Token.
     * Satu baris per toko, dengan Shop ID pada kolom A sebagai kunci.
     *
     * @return {Array<Object>} daftar rekaman token
     */
    getTokenRecords: function() {
      var sheet = getOrCreateSheet(SHEETS.TOKEN);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];

      var nilai = sheet.getRange(2, 1, lastRow - 1, TOKEN_HEADERS.length).getValues();
      var hasil = [];

      for (var i = 0; i < nilai.length; i++) {
        // Lewati sisa tempelan JSON mentah yang belum dipindahkan ke kolomnya
        if (String(nilai[i][0] || '').trim().indexOf('{') === 0) continue;

        var rec = tokenRowToObject_(nilai[i]);
        if (barisTokenBerisi_(rec)) hasil.push(rec);
      }

      return hasil;
    },

    /**
     * Membaca rekaman token dari sheet DB_Token.
     *
     * @param {string} [shopId] Shop ID toko yang dicari. Bila dikosongkan,
     *   dikembalikan rekaman pertama yang aktif, supaya pemanggil lama tetap
     *   berjalan tanpa perubahan.
     * @return {Object|null} rekaman token, atau null bila tidak ada
     */
    getTokenRecord: function(shopId) {
      var sheet = getOrCreateSheet(SHEETS.TOKEN);
      if (sheet.getLastRow() < 2) {
        return null;
      }

      // Deteksi teks JSON mentah yang ditempel langsung ke cell A2, lalu
      // pindahkan ke kolom yang benar supaya baris itu terbaca sebagai token.
      var selPertama = String(sheet.getRange(2, 1, 1, 1).getValues()[0][0] || '').trim();
      if (selPertama.indexOf('{') === 0 && selPertama.indexOf('access_token') !== -1) {
        try {
          var parsed = JSON.parse(selPertama);
          if (parsed.access_token) {
            this.saveTokenRecord({
              shop_id: parsed.shop_id || '',
              partner_id: parsed.partner_id || '',
              access_token: parsed.access_token || '',
              refresh_token: parsed.refresh_token || '',
              expired_at: parsed.expired_at || (Date.now() + 14400 * 1000)
            });
            // Isinya sudah dipindahkan, jadi sel mentahnya dibersihkan agar
            // tidak terbaca sebagai baris token kedua.
            sheet.getRange(2, 1, 1, 1).setValue('');
          }
        } catch (e) {}
      }

      var records = this.getTokenRecords();
      if (records.length === 0) return null;

      var target = String(shopId || '').trim();
      if (target) {
        for (var i = 0; i < records.length; i++) {
          if (records[i].shop_id === target) return records[i];
        }
        return null;
      }

      for (var j = 0; j < records.length; j++) {
        if (records[j].aktif !== 'TIDAK') return records[j];
      }

      return records[0];
    },

    /**
     * Menentukan toko yang ikut ditarik pada satu kali sinkronisasi.
     *
     * @param {string} [kodeToko] kode toko yang diminta. Bila kosong, daftar
     *   diambil dari TOKO_AKTIF, atau seluruh toko aktif bila konfigurasi itu
     *   juga kosong.
     * @return {Array<Object>} rekaman token yang akan ditarik, berurutan
     */
    getTokoUntukSync: function(kodeToko) {
      var semua = this.getTokenRecords();
      var aktif = [];
      for (var i = 0; i < semua.length; i++) {
        if (semua[i].aktif !== 'TIDAK' && semua[i].access_token) aktif.push(semua[i]);
      }

      var diminta = String(kodeToko || '').trim().toUpperCase();
      if (diminta) {
        var satu = cariKodeToko_(aktif, diminta);
        if (satu.length === 0) {
          throw new Error('Toko dengan kode "' + diminta + '" tidak ada atau tidak aktif di sheet DB_Token.' +
            keteranganKodeToko_(aktif));
        }
        return satu;
      }

      var daftar = String(this.getConfig().TOKO_AKTIF || '').trim();
      if (!daftar) return aktif;

      /* Kode di TOKO_AKTIF yang tidak cocok baris mana pun hampir pasti salah
         tulis. Berhenti dengan pesan jelas lebih baik daripada diam-diam
         menarik toko yang tidak diminta. */
      var terpilih = [];
      var daftarKode = daftar.split(',');
      for (var k = 0; k < daftarKode.length; k++) {
        var cari = String(daftarKode[k] || '').trim().toUpperCase();
        if (!cari) continue;

        var cocok = cariKodeToko_(aktif, cari);
        for (var c = 0; c < cocok.length; c++) {
          if (!sudahTerpilih_(terpilih, cocok[c].shop_id)) terpilih.push(cocok[c]);
        }
      }

      if (terpilih.length === 0) {
        throw new Error('TOKO_AKTIF berisi "' + daftar + '" tetapi tidak ada yang cocok di sheet DB_Token.' +
          keteranganKodeToko_(aktif));
      }

      return terpilih;
    },

    /**
     * Menyimpan/memperbarui token ke sheet DB_Token
     */
    saveTokenRecord: function(tokenData) {
      var sheet = getOrCreateSheet(SHEETS.TOKEN);
      tulisHeader_(sheet, TOKEN_HEADERS);
      var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      
      var expiredDateWIB = '';
      if (tokenData.expired_at) {
        var expDate = new Date(typeof tokenData.expired_at === 'number' && tokenData.expired_at < 10000000000 
          ? tokenData.expired_at * 1000 
          : tokenData.expired_at);
        expiredDateWIB = Utilities.formatDate(expDate, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      }

      var shopId = String(tokenData.shop_id || '').trim();

      /* Cari baris tujuan.
         Bila Shop ID diisi, cocokkan dengan kolom A. Bila Shop ID kosong,
         pakai baris pertama yang sudah berisi access token, yaitu perilaku
         lama ketika sistem masih menangani satu toko. */
      var lastRow = sheet.getLastRow();
      var barisTujuan = 0;
      var dataLama = null;

      if (lastRow >= 2) {
        var nilai = sheet.getRange(2, 1, lastRow - 1, TOKEN_HEADERS.length).getValues();

        for (var r = 0; r < nilai.length; r++) {
          if (String(nilai[r][0] || '').trim().indexOf('{') === 0) continue;

          var shopIdBaris = String(nilai[r][0] || '').trim();
          var adaToken = String(nilai[r][2] || '').trim() !== '';

          if (shopId && shopIdBaris === shopId) {
            barisTujuan = r + 2;
            dataLama = nilai[r];
            break;
          }
          if (!shopId && !barisTujuan && adaToken) {
            barisTujuan = r + 2;
            dataLama = nilai[r];
          }
        }
      }

      /* Bila ada lebih dari satu baris dengan Shop ID yang sama, baris pertama
         yang dipakai dan kelebihannya dicatat di log supaya pengguna dapat
         membereskannya. Baris kembar tidak dihapus otomatis. */
      if (barisTujuan && shopId && nilai) {
        var jumlahKembar = 0;
        for (var d = 0; d < nilai.length; d++) {
          if (String(nilai[d][0] || '').trim() === shopId) jumlahKembar++;
        }
        if (jumlahKembar > 1) {
          try {
            this.logActivity('TOKEN_DUPLIKAT', jumlahKembar, 'ERROR',
              'DB_Token memuat ' + jumlahKembar + ' baris untuk Shop ID ' + shopId +
              '. Baris pertama dipakai, sisanya perlu dihapus manual.');
          } catch (e) {}
        }
      }

      /* Kolom Nama Toko, Kode Toko, Aktif, dan Region dipertahankan bila tidak
         ikut dikirim, supaya penyegaran token tidak menghapus keterangan toko
         yang sudah diisi pengguna. */
      var lama = dataLama || [];
      var ambilLama = function(kolom, bawaan) {
        var isi = String(lama[kolom] || '').trim();
        return isi || bawaan;
      };

      var rowData = [
        shopId || ambilLama(0, ''),
        tokenData.partner_id || ambilLama(1, ''),
        tokenData.access_token || ambilLama(2, ''),
        tokenData.refresh_token || ambilLama(3, ''),
        tokenData.expired_at || lama[4] || '',
        expiredDateWIB,
        nowWIB,
        'AKTIF',
        tokenData.nama_toko || ambilLama(8, ''),
        String(tokenData.kode_toko || ambilLama(9, '')).trim().toUpperCase(),
        String(tokenData.aktif || ambilLama(10, 'YA')).trim().toUpperCase(),
        String(tokenData.region || ambilLama(11, 'GLOBAL')).trim().toUpperCase()
      ];

      if (barisTujuan) {
        sheet.getRange(barisTujuan, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }

      /* SHOP_ID di Konfigurasi hanya diisi ketika sistem masih menangani satu
         toko, karena satu nilai tidak dapat mewakili beberapa toko. */
      if (shopId && this.getTokenRecords().length <= 1) {
        var configSheet = getOrCreateSheet(SHEETS.CONFIG);
        var configData = configSheet.getDataRange().getValues();
        for (var c = 1; c < configData.length; c++) {
          if (String(configData[c][0] || '').trim() === 'SHOP_ID') {
            configSheet.getRange(c + 1, 2).setValue(String(shopId));
            break;
          }
        }
      }

      return {
        aksi: barisTujuan ? 'diperbarui' : 'ditambahkan',
        baris: barisTujuan || sheet.getLastRow(),
        shop_id: shopId
      };
    },

    /**
     * Mengisi kolom Toko pada sheet Pesanan Masuk untuk baris yang masih kosong.
     *
     * Dipakai sekali saat migrasi, karena seluruh data lama berasal dari satu
     * toko. Baris yang sudah punya kode toko tidak diubah, sehingga fungsi ini
     * aman dijalankan berulang.
     *
     * @param {string} kodeToko kode toko yang akan diisi, misalnya BGD
     * @return {{diisi: number, dilewati: number, kosong: number}}
     */
    backfillKodeToko: function(kodeToko) {
      var kode = String(kodeToko || '').trim().toUpperCase();
      if (!kode) {
        throw new Error('Kode toko tidak boleh kosong.');
      }

      var sheet = getOrCreateSheet(SHEETS.ORDERS);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return { diisi: 0, dilewati: 0, kosong: 0 };

      // Kolom Toko adalah kolom ke-17. Indeks lariknya 16.
      var nilai = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
      var kolomToko = [];
      var diisi = 0;
      var dilewati = 0;
      var kosong = 0;

      for (var i = 0; i < nilai.length; i++) {
        var punyaSn = String(nilai[i][0] || '').trim() !== '';
        var tokoSekarang = String(nilai[i][16] || '').trim();

        if (!punyaSn) {
          kosong++;
        } else if (tokoSekarang) {
          dilewati++;
        } else {
          nilai[i][16] = kode;
          diisi++;
        }

        kolomToko.push([nilai[i][16]]);
      }

      if (diisi > 0) {
        // Ditulis satu kali untuk seluruh kolom, bukan per sel
        sheet.getRange(2, 17, kolomToko.length, 1).setValues(kolomToko);
      }

      return { diisi: diisi, dilewati: dilewati, kosong: kosong };
    },

    /**
     * Membaca apa yang benar-benar dilihat sistem pada sheet DB_Token.
     *
     * Dipakai ketika isian tiap toko tidak terbaca, karena penyebab yang paling
     * sering adalah kolom yang bergeser atau baris header yang tidak sesuai
     * dugaan. Mengembalikan header mentah, posisi kolom, dan tiap rekaman.
     */
    diagnosaToken: function() {
      var sheet = getOrCreateSheet(SHEETS.TOKEN);
      var lastRow = sheet.getLastRow();

      var headerAktual = [];
      if (lastRow >= 1) {
        headerAktual = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
          .getValues()[0]
          .map(function(v) { return String(v || '').trim(); });
      }

      // Dibaca langsung per sel supaya nilainya terlihat apa adanya, tanpa
      // melewati pemetaan kolom yang sedang dicurigai.
      var isiKolomJ = [];
      var isiKolomI = [];
      if (lastRow >= 2) {
        var j = sheet.getRange(2, 10, lastRow - 1, 1).getValues();
        var i = sheet.getRange(2, 9, lastRow - 1, 1).getValues();
        for (var b = 0; b < j.length; b++) {
          isiKolomJ.push(String(j[b][0] || '').trim());
          isiKolomI.push(String(i[b][0] || '').trim());
        }
      }

      var rekaman = this.getTokenRecords();
      var ringkas = [];
      for (var r = 0; r < rekaman.length; r++) {
        ringkas.push({
          shop_id: rekaman[r].shop_id,
          nama_toko: rekaman[r].nama_toko,
          kode_toko: rekaman[r].kode_toko,
          aktif: rekaman[r].aktif,
          ada_token: Boolean(rekaman[r].access_token)
        });
      }

      return {
        headerAktual: headerAktual,
        posisiKodeToko: headerAktual.indexOf('Kode Toko'),
        posisiNamaToko: headerAktual.indexOf('Nama Toko'),
        isiKolomJ: isiKolomJ,
        isiKolomI: isiKolomI,
        jumlahRekaman: rekaman.length,
        rekaman: ringkas
      };
    },

    /**
     * Upsert pesanan ke sheet Pesanan Masuk secara cerdas:
     * - Apabila pada pesanan terdapat lebih dari satu produk, ditulis di baris yang berbeda
     * - Cepat dengan update 2D Array in-memory
     * - Memperbarui status Shopee, resi, kurir, SKU, dan variasi
     * - Mempertahankan Status Internal Begood yang diubah manual oleh staf
     * - Dibatasi pada baris toko yang sedang ditarik, lihat docs/arsitektur-multi-toko.md
     */
    upsertOrders: function(ordersList, kodeToko) {
      if (!ordersList || ordersList.length === 0) {
        return { added: 0, updated: 0 };
      }

      var sheet = getOrCreateSheet(SHEETS.ORDERS);
      var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      var kode = String(kodeToko || '').trim().toUpperCase();

      var orderHeaders = PESANAN_HEADERS;

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
      var numCols = PESANAN_HEADERS.length;
      var allData = [];
      if (lastRow > 1) {
        allData = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
      }

      /* Hanya baris toko ini yang boleh dianggap sudah ada. Baris lama yang
         kolom Tokonya masih kosong ikut diterima karena menu backfill mungkin
         belum dijalankan; tanpa toleransi itu, seluruh pesanan lama akan
         tertulis ulang sebagai baris baru pada sinkronisasi pertama. */
      var existingRowsMap = {};   // order_sn -> { indices: [0, 1], internalStatus: '...' }
      for (var r = 0; r < allData.length; r++) {
        var sn = String(allData[r][0] || '').trim();
        if (!sn) continue;

        var tokoBaris = String(allData[r][16] || '').trim().toUpperCase();
        if (kode && tokoBaris && tokoBaris !== kode) continue;

        if (!existingRowsMap[sn]) {
          existingRowsMap[sn] = {
            indices: [],
            internalStatus: allData[r][3] || ''
          };
        }
        existingRowsMap[sn].indices.push(r);
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
              var itVar = bersihkanVariasi_(it.model_name) || '-';
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
                if (kode && !String(allData[rowIdx][16] || '').trim()) allData[rowIdx][16] = kode;
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
                  nowWIB,
                  kode
                ]);
              }
            }
          } else {
            // Fallback jika tidak ada data item_list
            var rowIdx = ex.indices[0];
            allData[rowIdx][2] = ord.order_status || allData[rowIdx][2] || '';
            allData[rowIdx][3] = savedStatus;
            allData[rowIdx][6] = ord.sku_summary || '-';
            allData[rowIdx][7] = bersihkanVariasi_(ord.variation_summary) || '-';
            allData[rowIdx][8] = ord.total_items_count || 1;
            allData[rowIdx][11] = ord.shipping_carrier || allData[rowIdx][11] || '';
            if (ord.tracking_number) allData[rowIdx][12] = ord.tracking_number;
            allData[rowIdx][15] = nowWIB;
            if (kode && !String(allData[rowIdx][16] || '').trim()) allData[rowIdx][16] = kode;
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
                bersihkanVariasi_(it.model_name) || '-',
                Number(it.model_quantity_purchased || 1),
                ord.total_amount || 0,
                ord.actual_shipping_fee || ord.estimated_shipping_fee || 0,
                ord.shipping_carrier || '',
                ord.tracking_number || '',
                ord.note || '',
                ord.recipient_city || '',
                nowWIB,
                kode
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
              bersihkanVariasi_(ord.variation_summary) || '-',
              ord.total_items_count || 1,
              ord.total_amount || 0,
              ord.actual_shipping_fee || ord.estimated_shipping_fee || 0,
              ord.shipping_carrier || '',
              ord.tracking_number || '',
              ord.note || '',
              ord.recipient_city || '',
              nowWIB,
              kode
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
     * Mencatat riwayat ke sheet Log_Aktivitas.
     *
     * Kolom Toko diisi kode toko, atau 'SEMUA' untuk aksi yang mencakup seluruh
     * toko. Kolom Pengguna diisi kode pengguna yang menjalankan aksi itu, supaya
     * perubahan status dapat ditelusuri ke orangnya, bukan hanya ke waktunya.
     */
    logActivity: function(actionType, orderCount, status, message, kodeToko, pengguna) {
      try {
        var sheet = getOrCreateSheet(SHEETS.LOG);
        tulisHeader_(sheet, LOG_HEADERS);
        var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
        var toko = (kodeToko === undefined || kodeToko === null) ? '' : String(kodeToko).trim().toUpperCase();
        var siapa = (pengguna === undefined || pengguna === null) ? '' : String(pengguna).trim().toUpperCase();
        sheet.appendRow([nowWIB, actionType, orderCount || 0, status, message || '', toko, siapa]);
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

      var numCols = Math.max(sheet.getLastColumn(), PESANAN_HEADERS.length);
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
          values[i][KOLOM_WAKTU_SYNC] = nowWIB;
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
    getDashboardSummary: function(kodeToko) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var orderSheet = ss.getSheetByName(SHEETS.ORDERS);
      if (!orderSheet) return null;

      var orderLastRow = orderSheet.getLastRow();
      var todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
      var kode = String(kodeToko || '').trim().toUpperCase();
      var jumlahPerToko = {};

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

      /* Sebaran untuk grafik dashboard. Dihitung di sini karena barisnya sudah
         dibaca sekaligus; menghitungnya lagi di peramban dari 80 baris yang
         dikirim akan membuat grafiknya berubah setiap kali ada pesanan masuk. */
      var harianJumlah = {};
      var harianOmzet = {};
      var statusCounts = {};
      var tokoCounts = {};

      if (orderLastRow >= 2) {
        var numRows = orderLastRow - 1;
        // Dibaca sekaligus dalam 1 API call, termasuk kolom Q Toko
        var values = orderSheet.getRange(2, 1, numRows, PESANAN_HEADERS.length).getValues();
        var uniqueOrdersSeen = {};
        var uniqueOrdersCount = 0;
        var kunciPerToko = {};

        // Loop dari bawah ke atas (data terbaru terlebih dahulu)
        for (var i = values.length - 1; i >= 0; i--) {
          var row = values[i];
          var sn = String(row[0] || '').trim();
          if (!sn) continue;

          /* Jumlah per toko dihitung dari SELURUH baris, termasuk yang di luar
             cakupan, karena angka itu yang mengisi pemilih cakupan toko. */
          var tokoBaris = String(row[16] || '').trim().toUpperCase();
          var kunciToko = sn + '|' + tokoBaris;
          if (!kunciPerToko[kunciToko]) {
            kunciPerToko[kunciToko] = true;
            jumlahPerToko[tokoBaris] = (jumlahPerToko[tokoBaris] || 0) + 1;
          }

          // Baris di luar cakupan tidak ikut dihitung pada statistik
          if (kode && tokoBaris !== kode) continue;

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

            var hariPesanan = dateStr.substring(0, 10);
            if (hariPesanan) {
              harianJumlah[hariPesanan] = (harianJumlah[hariPesanan] || 0) + 1;
              harianOmzet[hariPesanan] = (harianOmzet[hariPesanan] || 0) + totalAmount;
            }

            if (internalStatus) {
              statusCounts[internalStatus] = (statusCounts[internalStatus] || 0) + 1;
            }

            if (tokoBaris) {
              tokoCounts[tokoBaris] = (tokoCounts[tokoBaris] || 0) + 1;
            }
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
              variation: bersihkanVariasi_(row[7]) || '-',
              qty: qty,
              totalAmount: totalAmount,
              shippingFee: Number(row[10]) || 0,
              courier: courier,
              resi: String(row[12] || '-'),
              note: String(row[13] || ''),
              city: String(row[14] || ''),
              toko: tokoBaris,
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

      /* Satu entri per toko. Jumlah pesanannya menempel di sini supaya pemilih
         cakupan di dashboard dapat menampilkan angka yang nyata. */
      var tokenRecords = this.getTokenRecords();
      var tokoList = [];

      for (var t = 0; t < tokenRecords.length; t++) {
        var rec = tokenRecords[t];
        var kondisi = hitungKondisiToken_(rec);
        tokoList.push({
          kode: rec.kode_toko || '',
          nama: rec.nama_toko || '',
          shopId: rec.shop_id || '-',
          aktif: rec.aktif !== 'TIDAK',
          jumlahPesanan: jumlahPerToko[rec.kode_toko || ''] || 0,
          hasToken: kondisi.hasToken,
          isExpired: kondisi.isExpired,
          statusText: kondisi.statusText,
          expiredAtWIB: String(rec.expired_at_wib || '-')
        });
      }

      /* Kode yang menempel di baris pesanan tetapi tidak ada di DB_Token tetap
         ditampilkan, supaya baris yatim tidak menghilang dari pemilih. */
      for (var kodeBaris in jumlahPerToko) {
        if (!kodeBaris) continue;

        var sudahAda = false;
        for (var cek = 0; cek < tokoList.length; cek++) {
          if (tokoList[cek].kode === kodeBaris) { sudahAda = true; break; }
        }

        if (!sudahAda) {
          tokoList.push({
            kode: kodeBaris,
            nama: '',
            shopId: '-',
            aktif: true,
            jumlahPesanan: jumlahPerToko[kodeBaris],
            hasToken: false,
            isExpired: true,
            statusText: 'TIDAK ADA DI DB_Token',
            expiredAtWIB: '-'
          });
        }
      }

      tokoList.sort(function(a, b) { return String(a.kode).localeCompare(String(b.kode)); });

      var tokenStatus = {
        hasToken: false,
        shopId: '-',
        expiredAtWIB: '-',
        statusText: 'BELUM ADA TOKEN',
        isExpired: true,
        remainingMinutes: 0
      };

      if (kode) {
        // Cakupan satu toko: kondisi tokennya ditampilkan apa adanya
        for (var s = 0; s < tokoList.length; s++) {
          if (tokoList[s].kode !== kode) continue;
          tokenStatus = {
            hasToken: tokoList[s].hasToken,
            shopId: tokoList[s].shopId,
            expiredAtWIB: tokoList[s].expiredAtWIB,
            statusText: tokoList[s].statusText,
            isExpired: tokoList[s].isExpired,
            remainingMinutes: 0
          };
          break;
        }
      } else {
        /* Pada cakupan semua toko tidak ada satu status tunggal yang benar,
           jadi yang dilaporkan adalah berapa toko yang perlu token. */
        var tokoAktif = 0;
        var perluToken = 0;
        for (var v = 0; v < tokoList.length; v++) {
          if (!tokoList[v].aktif) continue;
          tokoAktif++;
          if (!tokoList[v].hasToken || tokoList[v].isExpired) perluToken++;
        }

        tokenStatus = {
          hasToken: tokoAktif > 0,
          shopId: '-',
          expiredAtWIB: '-',
          isExpired: perluToken > 0,
          remainingMinutes: 0,
          statusText: perluToken > 0
            ? perluToken + ' dari ' + tokoAktif + ' toko perlu token'
            : 'Aktif, ' + tokoAktif + ' toko'
        };
      }

      // Baca Log Aktivitas (7 Terakhir) langsung dari ss
      var logSheet = ss.getSheetByName(SHEETS.LOG);
      var logs = [];
      if (logSheet && logSheet.getLastRow() >= 2) {
        var lLast = logSheet.getLastRow();
        var sRow = Math.max(2, lLast - 6);
        var lRows = lLast - sRow + 1;
        var lVals = logSheet.getRange(sRow, 1, lRows, LOG_HEADERS.length).getValues();
        for (var j = lVals.length - 1; j >= 0; j--) {
          logs.push({
            time: String(lVals[j][0] || ''),
            action: String(lVals[j][1] || ''),
            count: Number(lVals[j][2]) || 0,
            status: String(lVals[j][3] || ''),
            detail: String(lVals[j][4] || ''),
            toko: String(lVals[j][5] || ''),
            pengguna: String(lVals[j][6] || '')
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

      /* Empat belas hari terakhir, termasuk hari yang tidak ada pesanannya,
         supaya sumbu grafiknya tidak bergeser hanya karena gudang libur. Hari
         tanpa pesanan adalah kenyataan, bukan data yang hilang. */
      var seriHarian = [];
      var HARI_GRAFIK = 14;
      var sekarangMs = new Date().getTime();

      for (var hariKe = HARI_GRAFIK - 1; hariKe >= 0; hariKe--) {
        var tanggalHari = Utilities.formatDate(
          new Date(sekarangMs - (hariKe * 24 * 60 * 60 * 1000)), 'Asia/Jakarta', 'yyyy-MM-dd');
        seriHarian.push({
          tanggal: tanggalHari,
          jumlah: harianJumlah[tanggalHari] || 0,
          omzet: harianOmzet[tanggalHari] || 0
        });
      }

      /* Urut dari yang terbanyak, karena yang dibaca lebih dulu adalah yang
         paling banyak. Sisanya dipotong supaya kartunya tidak menjadi daftar
         panjang. */
      var jadikanSebaran = function(sebaran, batas) {
        var daftar = [];
        for (var nama in sebaran) {
          if (!nama) continue;
          daftar.push({ nama: nama, jumlah: sebaran[nama] });
        }
        daftar.sort(function(a, b) { return b.jumlah - a.jumlah; });
        return daftar.slice(0, batas);
      };

      return {
        stats: stats,
        orders: ordersList,
        courierStats: courierCounts,
        topSkus: topSkus,
        seriHarian: seriHarian,
        statusStats: jadikanSebaran(statusCounts, 6),
        tokoStats: jadikanSebaran(tokoCounts, 6),
        token: tokenStatus,
        tokoList: tokoList,
        cakupan: kode,
        jumlahTanpaKode: jumlahPerToko[''] || 0,
        logs: logs,
        config: config,
        isTriggerActive: isTriggerActive,
        statusOptions: STATUS_OPTIONS,
        webAppUrl: webAppUrl,
        nowWIB: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss')
      };
    },

    /**
     * Membaca baris pesanan langsung dari sheet untuk kebutuhan ekspor.
     * Berbeda dari getDashboardSummary(), fungsi ini tidak memotong jumlah
     * baris menjadi 80, sehingga rekap PDF dapat memuat seluruh data.
     * Pemetaan kolomnya sengaja ditulis sama persis dengan blok
     * ordersList.push di getDashboardSummary agar objek yang dihasilkan
     * dapat dipakai oleh penyusun dokumen yang sama.
     *
     * @param {number} limit jumlah baris terakhir yang dibaca, bawaan 2000
     * @param {string} [kodeToko] cakupan toko. Kosong berarti seluruh toko.
     * @return {Array<Object>} baris pesanan dalam bentuk objek
     */
    getOrderRowsForExport: function(limit, kodeToko) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var orderSheet = ss.getSheetByName(SHEETS.ORDERS);
      if (!orderSheet) return [];

      var lastRow = orderSheet.getLastRow();
      if (lastRow < 2) return [];

      var kode = String(kodeToko || '').trim().toUpperCase();
      var maxBaris = Number(limit) || 2000;
      var mulai = Math.max(2, lastRow - maxBaris + 1);
      var nilai = orderSheet.getRange(mulai, 1, lastRow - mulai + 1, PESANAN_HEADERS.length).getValues();

      var terpilih = [];
      for (var i = 0; i < nilai.length; i++) {
        if (barisSesuaiToko_(nilai[i], kode)) terpilih.push(nilai[i]);
      }

      return terpilih.map(mapBarisPesanan_).filter(barisPesananAda_);
    },

    /**
     * Membaca baris pesanan yang status internalnya memuat kata kunci tertentu.
     *
     * Dipakai filter status di Web Dashboard. Alasannya: payload dashboard
     * hanya membawa 80 baris terbaru demi kecepatan, sedangkan statistik
     * seperti stats.siapPacking dihitung dari SELURUH baris sheet. Tanpa
     * fungsi ini, memilih "[1] Siap Packing" di dashboard bisa menampilkan
     * tabel kosong walaupun sheet masih memuat antrian tersebut, karena
     * barisnya berada di luar 80 baris terbaru.
     *
     * @param {string} statusKeyword kata kunci status, misalnya 'Siap Packing'
     * @param {number} limit jumlah baris maksimum yang dikembalikan, bawaan 500
     * @param {string} [kodeToko] cakupan toko. Kosong berarti seluruh toko.
     * @return {Array<Object>} baris pesanan, terbaru lebih dulu
     */
    getOrderRowsByStatus: function(statusKeyword, limit, kodeToko) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var orderSheet = ss.getSheetByName(SHEETS.ORDERS);
      if (!orderSheet) return [];

      var lastRow = orderSheet.getLastRow();
      if (lastRow < 2) return [];

      var kode = String(kodeToko || '').trim().toUpperCase();
      var maxBaris = Number(limit) || 500;

      // Jendela baca dibatasi agar tidak membaca puluhan ribu baris sekaligus
      var jendelaBaca = 5000;
      var mulai = Math.max(2, lastRow - jendelaBaca + 1);
      var nilai = orderSheet.getRange(mulai, 1, lastRow - mulai + 1, PESANAN_HEADERS.length).getValues();

      var kata = String(statusKeyword || '').trim().toLowerCase();
      var hasil = [];

      // Dibaca dari bawah ke atas supaya baris terbaru muncul lebih dulu
      for (var i = nilai.length - 1; i >= 0 && hasil.length < maxBaris; i--) {
        var row = nilai[i];
        if (!String(row[0] || '').trim()) continue;
        if (!barisSesuaiToko_(row, kode)) continue;
        if (kata && String(row[3] || '').toLowerCase().indexOf(kata) === -1) continue;
        hasil.push(mapBarisPesanan_(row));
      }

      return hasil;
    },

    /**
     * Menghitung jumlah pesanan untuk setiap nilai pada kolom Status Internal
     * Begood (kolom D).
     *
     * Dipakai dashboard untuk menyusun pilihan filter status dari data yang
     * benar-benar ada di sheet. Dengan begitu pilihan filter tidak pernah
     * menyimpang dari isi sheet, dan bila kolom tersebut berisi nilai di luar
     * daftar resmi STATUS_OPTIONS, pengguna langsung melihatnya di daftar.
     *
     * Hanya kolom A sampai D yang dibaca, dalam satu panggilan getRange.
     *
     * @param {string} [kodeToko] cakupan toko. Kosong berarti seluruh toko.
     * @return {Array<Object>} larik { status, jumlah }, urut dari terbanyak
     */
    getStatusInventory: function(kodeToko) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var orderSheet = ss.getSheetByName(SHEETS.ORDERS);
      if (!orderSheet) return [];

      var lastRow = orderSheet.getLastRow();
      if (lastRow < 2) return [];

      var kode = String(kodeToko || '').trim().toUpperCase();
      var nilai = orderSheet.getRange(2, 1, lastRow - 1, PESANAN_HEADERS.length).getValues();
      var hitung = {};

      for (var i = 0; i < nilai.length; i++) {
        if (!String(nilai[i][0] || '').trim()) continue;
        if (!barisSesuaiToko_(nilai[i], kode)) continue;

        var status = String(nilai[i][3] || '').trim();
        if (!status) status = '(kolom D kosong)';

        hitung[status] = (hitung[status] || 0) + 1;
      }

      var hasil = [];
      for (var k in hitung) {
        if (Object.prototype.hasOwnProperty.call(hitung, k)) {
          hasil.push({ status: k, jumlah: hitung[k] });
        }
      }

      hasil.sort(function(a, b) { return b.jumlah - a.jumlah; });
      return hasil;
    },

    /**
     * Membaca seluruh pengguna dari sheet Pengguna.
     *
     * Hash dan salt sengaja tidak ikut dikembalikan, karena pemanggilnya adalah
     * lapisan tampilan yang tidak membutuhkannya. Pemeriksaan sandi memakai
     * getPenggunaByKode() di dalam modul ini.
     *
     * @return {Array<Object>} daftar pengguna tanpa hash sandi
     */
    getPenggunaRecords: function() {
      var sheet = getOrCreateSheet(SHEETS.PENGGUNA);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];

      var nilai = sheet.getRange(2, 1, lastRow - 1, PENGGUNA_HEADERS.length).getValues();
      var hasil = [];

      for (var i = 0; i < nilai.length; i++) {
        var kode = String(nilai[i][0] || '').trim().toUpperCase();
        if (!kode) continue;

        hasil.push({
          kode: kode,
          nama: String(nilai[i][1] || '').trim(),
          peran: String(nilai[i][2] || '').trim().toUpperCase() || PERAN.PACKING,
          email: String(nilai[i][3] || '').trim().toLowerCase(),
          aktif: String(nilai[i][6] || '').trim().toUpperCase() || 'YA',
          dibuat: String(nilai[i][7] || ''),
          terakhir_masuk: String(nilai[i][8] || '')
        });
      }

      return hasil;
    },

    /**
     * Mencari satu pengguna beserta hash sandinya.
     * Dipakai di dalam modul untuk memeriksa sandi, bukan untuk ditampilkan.
     */
    getPenggunaByKode: function(kode) {
      var cari = String(kode || '').trim().toUpperCase();
      if (!cari) return null;

      var sheet = getOrCreateSheet(SHEETS.PENGGUNA);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return null;

      var nilai = sheet.getRange(2, 1, lastRow - 1, PENGGUNA_HEADERS.length).getValues();
      for (var i = 0; i < nilai.length; i++) {
        if (String(nilai[i][0] || '').trim().toUpperCase() !== cari) continue;

        return {
          kode: cari,
          nama: String(nilai[i][1] || '').trim(),
          peran: String(nilai[i][2] || '').trim().toUpperCase() || PERAN.PACKING,
          email: String(nilai[i][3] || '').trim().toLowerCase(),
          sandi_hash: String(nilai[i][4] || '').trim(),
          sandi_salt: String(nilai[i][5] || '').trim(),
          aktif: String(nilai[i][6] || '').trim().toUpperCase() || 'YA'
        };
      }

      return null;
    },

    /**
     * Mencari pengguna berdasarkan email, untuk masuk tanpa sandi.
     */
    getPenggunaByEmail: function(email) {
      var cari = String(email || '').trim().toLowerCase();
      if (!cari) return null;

      var daftar = this.getPenggunaRecords();
      for (var i = 0; i < daftar.length; i++) {
        if (daftar[i].email === cari) return daftar[i];
      }

      return null;
    },

    /**
     * Menyimpan pengguna: memperbarui baris yang kodenya cocok, atau menambah
     * baris baru.
     *
     * Sandi hanya diganti bila diisi, sehingga nama, peran, atau email dapat
     * diubah tanpa memaksa pengguna mengganti sandinya.
     */
    simpanPengguna: function(data) {
      var kode = String(data.kode || '').trim().toUpperCase();
      var nama = String(data.nama || '').trim();
      var peran = String(data.peran || '').trim().toUpperCase();
      var email = String(data.email || '').trim().toLowerCase();
      var sandi = String(data.sandi || '');

      if (!kode) throw new Error('Kode pengguna tidak boleh kosong.');
      if (!nama) throw new Error('Nama pengguna tidak boleh kosong.');
      if (!PERINGKAT_PERAN[peran]) {
        throw new Error('Peran "' + peran + '" tidak dikenal. Pakai PACKING, ADMIN, atau SUPERADMIN.');
      }
      if (sandi && sandi.length < 6) {
        throw new Error('Sandi minimal 6 karakter. PIN empat angka terlalu mudah ditebak.');
      }

      var sheet = getOrCreateSheet(SHEETS.PENGGUNA);
      tulisHeader_(sheet, PENGGUNA_HEADERS);
      var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      var barisTujuan = 0;
      var hashLama = '';
      var saltLama = '';
      var aktifLama = 'YA';
      var dibuat = nowWIB;
      var masukTerakhir = '';

      var lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        var nilai = sheet.getRange(2, 1, lastRow - 1, PENGGUNA_HEADERS.length).getValues();
        for (var i = 0; i < nilai.length; i++) {
          if (String(nilai[i][0] || '').trim().toUpperCase() !== kode) continue;
          barisTujuan = i + 2;
          hashLama = String(nilai[i][4] || '').trim();
          saltLama = String(nilai[i][5] || '').trim();
          aktifLama = String(nilai[i][6] || '').trim().toUpperCase() || 'YA';
          dibuat = String(nilai[i][7] || '') || nowWIB;
          masukTerakhir = String(nilai[i][8] || '');
          break;
        }
      }

      if (!sandi && !hashLama) {
        throw new Error('Pengguna baru harus diberi sandi minimal 6 karakter.');
      }

      /* Salt harus selalu sepasang dengan hash-nya. Karena itu keduanya dihitung
         bersama, dan salt lama hanya dipakai ulang bila sandinya tidak diganti. */
      var saltDipakai = saltLama;
      var hashDipakai = hashLama;

      if (sandi) {
        saltDipakai = acakSalt_();
        hashDipakai = hashSandi_(sandi, saltDipakai, PUTARAN_HASH);
      }

      /* Aktif juga dipertahankan bila tidak dikirim, supaya menyunting nama atau
         peran tidak diam-diam mengaktifkan kembali akun yang sudah dinonaktifkan. */
      var aktifDipakai = (data.aktif === undefined || data.aktif === null) ? aktifLama : String(data.aktif);
      var aktifFinal = aktifDipakai.trim().toUpperCase() === 'TIDAK' ? 'TIDAK' : 'YA';

      var baris = [
        kode,
        nama,
        peran,
        email,
        hashDipakai,
        saltDipakai,
        aktifFinal,
        dibuat,
        masukTerakhir
      ];

      if (barisTujuan) {
        sheet.getRange(barisTujuan, 1, 1, PENGGUNA_HEADERS.length).setValues([baris]);
      } else {
        sheet.appendRow(baris);
      }

      return { aksi: barisTujuan ? 'diperbarui' : 'ditambahkan', kode: kode, baris: barisTujuan || sheet.getLastRow() };
    },

    /**
     * Membaca apa yang dilihat sistem pada sheet Pengguna, tanpa kolom sandi.
     *
     * Dipakai saat akun yang baru dibuat tidak muncul di daftar. Penyebab yang
     * paling sering adalah baris yang tidak terpakai, header yang bergeser, atau
     * kode yang tertulis di kolom lain. Karena itu isinya dilaporkan apa adanya,
     * bukan disimpulkan.
     */
    diagnosaPengguna: function() {
      var sheet = getOrCreateSheet(SHEETS.PENGGUNA);
      var lastRow = sheet.getLastRow();

      var headerAktual = [];
      if (lastRow >= 1) {
        headerAktual = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
          .getValues()[0]
          .map(function(v) { return String(v || '').trim(); });
      }

      var kodeTerbaca = [];
      if (lastRow >= 2) {
        var kolomA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < kolomA.length; i++) {
          var kode = String(kolomA[i][0] || '').trim();
          if (kode) kodeTerbaca.push('baris ' + (i + 2) + ': ' + kode);
        }
      }

      /* Baris pertama yang bukan header berarti sheet lahir tanpa baris header,
         dan datanya masuk ke baris 1. Keadaan itu harus disebut apa adanya,
         karena dari luar tampak seperti "akun tidak tersimpan". */
      var headerSesuai = headerAktual.length > 0 &&
        String(headerAktual[0]).trim() === String(PENGGUNA_HEADERS[0]);

      var ringkas = 'Isi sheet "Pengguna" menurut sistem:' +
        '\n  jumlah baris terpakai: ' + lastRow +
        '\n  header: ' + (headerAktual.length > 0 ? headerAktual.join(', ') : '(kosong)') +
        '\n  header sesuai: ' + (headerSesuai ? 'ya' : 'TIDAK') +
        '\n  kode pada kolom A: ' + (kodeTerbaca.length > 0 ? kodeTerbaca.join(', ') : '(tidak ada)');

      if (!headerSesuai && lastRow > 0) {
        ringkas += '\n  perbaikan: jalankan menu "Inisialisasi / Reset Tabel Sheet". Header akan ditulis, dan baris data yang sudah ada digeser ke bawah tanpa dihapus.';
      }

      return {
        lastRow: lastRow,
        headerAktual: headerAktual,
        headerSesuai: headerSesuai,
        kodeTerbaca: kodeTerbaca,
        ringkas: ringkas
      };
    },

    /**
     * Mencatat waktu masuk terakhir.
     *
     * Dipisah dari simpanPengguna supaya pencatatannya tidak perlu mengirim
     * ulang data pengguna, sehingga tidak berisiko mengubah perannya.
     */
    catatMasuk: function(kode) {
      var cari = String(kode || '').trim().toUpperCase();
      if (!cari) return false;

      var sheet = getOrCreateSheet(SHEETS.PENGGUNA);
      tulisHeader_(sheet, PENGGUNA_HEADERS);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return false;

      var kolomKode = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < kolomKode.length; i++) {
        if (String(kolomKode[i][0] || '').trim().toUpperCase() !== cari) continue;

        var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
        sheet.getRange(i + 2, 9, 1, 1).setValue(nowWIB);
        return true;
      }

      return false;
    },

    /**
     * Menghitung pengguna aktif, seluruhnya atau per peran.
     *
     * Dipakai untuk memastikan minimal ada satu superadmin aktif sebelum
     * penolakan peran diberlakukan. Tanpa pemeriksaan itu, salah mengisi peran
     * dapat mengunci semua orang dari dashboard.
     */
    hitungPenggunaAktif: function(peran) {
      var cari = String(peran || '').trim().toUpperCase();
      var daftar = this.getPenggunaRecords();
      var jumlah = 0;

      for (var i = 0; i < daftar.length; i++) {
        if (daftar[i].aktif !== 'YA') continue;
        if (cari && daftar[i].peran !== cari) continue;
        jumlah++;
      }

      return jumlah;
    },

    /**
     * Memeriksa kode dan sandi, lalu mengembalikan pengguna tanpa hash bila cocok.
     *
     * Pemeriksaan sandi sengaja hanya ada di dalam modul ini, supaya hash dan
     * salt tidak pernah keluar dari sini. Pemanggil di luar hanya menerima ya
     * atau tidak.
     *
     * @return {Object|null} pengguna bila cocok dan aktif, atau null
     */
    periksaSandi: function(kode, sandi) {
      if (!String(sandi || '')) return null;

      var rec = this.getPenggunaByKode(kode);
      if (!rec) return null;
      if (rec.aktif !== 'YA') return null;
      if (!sandiCocok_(sandi, rec)) return null;

      return {
        kode: rec.kode,
        nama: rec.nama,
        peran: rec.peran,
        email: rec.email,
        aktif: rec.aktif
      };
    },

    /**
     * Memastikan kedua sheet setelan ada, lalu mengisinya dengan isi bawaan bila
     * masih kosong.
     *
     * Sekaligus merapikan PEMBAGIAN JAHIT yang masih berbentuk lama, supaya
     * pembagian yang dijalankan dari menu pun memakai bentuk kolom yang sama
     * dengan yang dipakai halaman.
     *
     * @return {Object} jumlah baris bawaan yang ditulis untuk masing-masing
     */
    pastikanSettingProduksi: function() {
      var penjahitSheet = getOrCreateSheet(SHEETS.PENJAHIT);
      tulisHeader_(penjahitSheet, PENJAHIT_HEADERS);
      var aturanSheet = getOrCreateSheet(SHEETS.RULES);
      tulisHeader_(aturanSheet, RULES_HEADERS);

      var bagiSheet = getOrCreateSheet(SHEETS.BAGI);
      rapikanPembagianLama_(bagiSheet);
      tulisHeader_(bagiSheet, BAGI_HEADERS);

      return {
        penjahit: isiBawaanBilaKosong_(penjahitSheet, PENJAHIT_HEADERS, PENJAHIT_DEFAULT),
        aturan: isiBawaanBilaKosong_(aturanSheet, RULES_HEADERS, RULES_DEFAULT)
      };
    },

    /** Membaca daftar penjahit beserta grup, status aktif, dan bobotnya. */
    bacaPenjahit: function() {
      return bacaBarisPenjahit_();
    },

    /** Membaca aturan pemetaan SKU ke grup, urut sesuai urutan di sheet. */
    bacaAturanSku: function() {
      return bacaBarisAturan_();
    },

    /** Membaca hasil pembagian jahit, satu baris per penjahit pada satu pesanan. */
    bacaPembagian: function() {
      return bacaBarisPembagian_();
    },

    /** Merapikan PEMBAGIAN JAHIT bentuk lama (kolom Part) menjadi bentuk Qty. */
    rapikanPembagian: function() {
      return rapikanPembagianLama_(getOrCreateSheet(SHEETS.BAGI));
    },

    /**
     * Kunci satu baris pembagian: nomor pesanan, SKU, variasi, dan penjahit.
     *
     * Dipakai bersama oleh pembagian, penutupan sesi, dan pemeriksaan
     * duplikatnya supaya ketiganya menunjuk baris yang sama.
     */
    kunciPembagian: function(sku, variasi, noPesanan, penjahit) {
      return kunciPembagian_(sku, variasi, noPesanan, penjahit);
    },

    /**
     * Menambah jumlah pcs pada baris pembagian, atau membuat barisnya bila belum ada.
     *
     * Inilah penulis satu-satunya PEMBAGIAN JAHIT. Baris yang kuncinya sudah ada
     * ditambahi Qty-nya, dan Harga Total dihitung ulang dari Qty baru dikali Harga
     * Satuan yang tersimpan. Penambahan, bukan penimpaan, yang dipakai karena satu
     * baris pesanan dapat dibagi bertahap: dua pcs dari baris itu boleh jatuh ke
     * orang yang sama, dan keduanya cukup satu baris berisi Qty 2.
     *
     * Ditulis satu kali untuk seluruh baris, bukan baris per baris: satu kali
     * pembagian dapat memuat ratusan pcs, dan satu panggilan tulis jauh lebih
     * cepat daripada ratusan panggilan.
     *
     * @param {Array<Object>} daftar baris berisi toko, noPesanan, sku, variasi,
     *   penjahit, grup, harga, dan qty yang ditambahkan
     * @param {string} dibagi stempel waktu pembagian, untuk baris yang baru
     * @return {Object} jumlah baris baru, baris yang ditambahi, dan pcs yang ditambahkan
     */
    simpanQtyPembagian: function(daftar, dibagi) {
      var hasil = { barisDitambah: 0, barisDiperbarui: 0, qtyDitambah: 0 };
      if (!daftar || daftar.length === 0) return hasil;

      var sheet = getOrCreateSheet(SHEETS.BAGI);
      var lastRow = sheet.getLastRow();
      var nilai = [];
      var peta = {};
      var range = null;

      if (lastRow >= 2) {
        range = sheet.getRange(2, 1, lastRow - 1, BAGI_HEADERS.length);
        nilai = range.getValues();
        var tampil = range.getDisplayValues();

        for (var r = 0; r < nilai.length; r++) {
          var skuBaris = teksKolom_(nilai[r][KOLOM_BAGI.SKU], tampil[r][KOLOM_BAGI.SKU]);
          if (!skuBaris) continue;

          peta[kunciPembagian_(
            skuBaris,
            teksKolom_(nilai[r][KOLOM_BAGI.VARIASI], tampil[r][KOLOM_BAGI.VARIASI]),
            teksKolom_(nilai[r][KOLOM_BAGI.PESANAN], tampil[r][KOLOM_BAGI.PESANAN]),
            teksKolom_(nilai[r][KOLOM_BAGI.PENJAHIT], tampil[r][KOLOM_BAGI.PENJAHIT]))] = r;
        }
      }

      var barisBaru = [];
      var berubah = false;

      for (var i = 0; i < daftar.length; i++) {
        var item = daftar[i] || {};
        var tambah = Number(item.qty) > 0 ? Number(item.qty) : 0;
        if (!item.sku || tambah <= 0) continue;

        var kunci = kunciPembagian_(item.sku, item.variasi, item.noPesanan, item.penjahit);
        hasil.qtyDitambah += tambah;

        if (Object.prototype.hasOwnProperty.call(peta, kunci)) {
          var idx = peta[kunci];
          var qtyLama = angkaKolom_(nilai[idx][KOLOM_BAGI.QTY]);
          if (qtyLama <= 0) qtyLama = 1;

          var harga = angkaKolom_(nilai[idx][KOLOM_BAGI.HARGA]);
          if (harga <= 0) harga = angkaKolom_(item.harga);

          /* Grup pada baris lama yang masih kosong diisi dari pembagian ini,
             sedangkan yang sudah terisi dibiarkan. Variasinya ditulis ulang ke
             bentuk pendek, supaya sheetnya tidak bercampur dua ejaan. */
          if (String(nilai[idx][KOLOM_BAGI.GRUP] || '').trim() === '' && item.grup) {
            nilai[idx][KOLOM_BAGI.GRUP] = String(item.grup).trim().toUpperCase();
          }
          nilai[idx][KOLOM_BAGI.VARIASI] = bersihkanVariasi_(nilai[idx][KOLOM_BAGI.VARIASI]);

          nilai[idx][KOLOM_BAGI.QTY] = qtyLama + tambah;
          nilai[idx][KOLOM_BAGI.HARGA] = harga > 0 ? harga : '';
          nilai[idx][KOLOM_BAGI.TOTAL] = harga > 0 ? harga * (qtyLama + tambah) : '';
          berubah = true;
          hasil.barisDiperbarui++;
          continue;
        }

        /* Kunci yang baru dicatat supaya satu panggilan yang memuat baris sama
           dua kali tidak menulisnya dua kali. */
        peta[kunci] = nilai.length + barisBaru.length;
        barisBaru.push(barisPembagianUntukSheet_(item, dibagi));
      }

      if (berubah && range) range.setValues(nilai);

      if (barisBaru.length) {
        sheet.getRange(sheet.getLastRow() + 1, 1, barisBaru.length, BAGI_HEADERS.length)
          .setValues(barisBaru);
      }

      hasil.barisDitambah = barisBaru.length;
      return hasil;
    },

    /**
     * Mengisi harga baris pembagian yang masih kosong.
     *
     * Dipakai saat pembagian dijalankan lagi. Baris yang penjahitnya sudah
     * ditetapkan tidak dibagi ulang, tetapi harganya bisa saja masih kosong karena
     * saat dibagi dulu SKU-nya belum ada di DATA PROSES. Tanpa penyelarasan ini,
     * upah baris tersebut selamanya nol walaupun harganya kemudian sudah diisi.
     *
     * Hanya sel yang masih kosong yang diisi, dan Harga Total ikut dihitung ulang
     * dari Qty × Harga Satuan. Harga yang sudah terisi tidak pernah ditimpa, karena
     * angka itu bisa jadi hasil koreksi manusia.
     *
     * @param {Array<Object>} daftar baris berisi sku, variasi, noPesanan, penjahit, harga
     * @return {number} jumlah sel Harga Satuan yang terisi
     */
    perbaruiHargaPembagian: function(daftar) {
      if (!daftar || daftar.length === 0) return 0;

      var sheet = getOrCreateSheet(SHEETS.BAGI);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return 0;

      var range = sheet.getRange(2, 1, lastRow - 1, BAGI_HEADERS.length);
      var nilai = range.getValues();
      var tampil = range.getDisplayValues();
      var peta = {};

      for (var r = 0; r < nilai.length; r++) {
        var skuBaris = teksKolom_(nilai[r][KOLOM_BAGI.SKU], tampil[r][KOLOM_BAGI.SKU]);
        if (!skuBaris) continue;

        peta[kunciPembagian_(
          skuBaris,
          teksKolom_(nilai[r][KOLOM_BAGI.VARIASI], tampil[r][KOLOM_BAGI.VARIASI]),
          teksKolom_(nilai[r][KOLOM_BAGI.PESANAN], tampil[r][KOLOM_BAGI.PESANAN]),
          teksKolom_(nilai[r][KOLOM_BAGI.PENJAHIT], tampil[r][KOLOM_BAGI.PENJAHIT]))] = r;
      }

      var berubah = 0;
      for (var i = 0; i < daftar.length; i++) {
        var item = daftar[i] || {};
        var harga = angkaKolom_(item.harga);
        if (harga <= 0 || !item.sku) continue;

        var kunci = kunciPembagian_(item.sku, item.variasi, item.noPesanan, item.penjahit);
        if (!Object.prototype.hasOwnProperty.call(peta, kunci)) continue;

        var idx = peta[kunci];
        if (angkaKolom_(nilai[idx][KOLOM_BAGI.HARGA]) > 0) continue;

        var qty = angkaKolom_(nilai[idx][KOLOM_BAGI.QTY]);
        if (qty <= 0) qty = 1;

        nilai[idx][KOLOM_BAGI.HARGA] = harga;
        nilai[idx][KOLOM_BAGI.TOTAL] = harga * qty;
        /* Baris lama yang variasinya masih panjang ditulis ulang ke bentuk
           pendek, karena penyelarasan ini memang sedang menyentuh baris itu. */
        nilai[idx][KOLOM_BAGI.VARIASI] = bersihkanVariasi_(nilai[idx][KOLOM_BAGI.VARIASI]);
        berubah++;
      }

      if (berubah > 0) range.setValues(nilai);
      return berubah;
    },

    /**
     * Mengganti seluruh isi SETTING PENJAHIT.
     *
     * Seluruh isinya diganti, bukan ditambahi, karena yang dikirim halaman
     * adalah tabel lengkap hasil suntingan penggunanya. Menambahkan baris ke
     * daftar yang sudah ada akan meninggalkan baris lama yang sudah dihapus di
     * halaman tetapi masih ikut bekerja.
     *
     * @param {Array<Object>} daftar baris berisi nama, grup, aktif, bobot, catatan
     * @return {number} jumlah baris yang ditulis
     */
    simpanPenjahit: function(daftar) {
      var baris = [];
      for (var i = 0; i < (daftar || []).length; i++) {
        var p = daftar[i];
        var nama = String((p && p.nama) || '').trim();
        if (!nama) continue;

        baris.push([
          nama.toUpperCase(),
          String((p && p.grup) || '').trim().toUpperCase(),
          String((p && p.aktif) || 'YA').trim().toUpperCase() === 'TIDAK' ? 'TIDAK' : 'YA',
          Number(p && p.bobot) > 0 ? Number(p.bobot) : 1,
          String((p && p.catatan) || '').trim()
        ]);
      }

      if (!baris.length) {
        throw new Error('Daftar penjahit tidak boleh kosong. Sisakan minimal satu penjahit aktif.');
      }

      var sheet = getOrCreateSheet(SHEETS.PENJAHIT);
      tulisHeader_(sheet, PENJAHIT_HEADERS);
      sheet.getRange(2, 1, sheet.getMaxRows() - 1, PENJAHIT_HEADERS.length).clearContent();
      sheet.getRange(2, 1, baris.length, PENJAHIT_HEADERS.length).setValues(baris);
      return baris.length;
    },

    /**
     * Mengganti seluruh isi SKU RULES.
     *
     * Urutan yang dikirim dipertahankan, karena urutan itulah yang menentukan
     * aturan mana yang menang saat sebuah SKU cocok dengan dua pola.
     *
     * @param {Array<Object>} daftar baris berisi pola, grup, catatan
     * @return {number} jumlah baris yang ditulis
     */
    simpanAturanSku: function(daftar) {
      var baris = [];
      for (var i = 0; i < (daftar || []).length; i++) {
        var a = daftar[i];
        var pola = String((a && a.pola) || '').trim();
        var grup = String((a && a.grup) || '').trim().toUpperCase();
        if (!pola || !grup) continue;

        baris.push([pola, grup, String((a && a.catatan) || '').trim()]);
      }

      if (!baris.length) {
        throw new Error('Aturan SKU tidak boleh kosong. Sisakan minimal satu aturan.');
      }

      var sheet = getOrCreateSheet(SHEETS.RULES);
      tulisHeader_(sheet, RULES_HEADERS);
      sheet.getRange(2, 1, sheet.getMaxRows() - 1, RULES_HEADERS.length).clearContent();
      sheet.getRange(2, 1, baris.length, RULES_HEADERS.length).setValues(baris);
      return baris.length;
    }
  };
})();

