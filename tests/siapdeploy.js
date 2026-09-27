/* Memeriksa kesiapan berkas untuk ditempel ke Google Apps Script.

   Rangkaian uji lain menjalankan kodenya dengan tiruan, jadi ia tidak menangkap
   hal yang hanya muncul di tempat sebenarnya: nama RPC yang salah ketik, fungsi
   bantu yang hilang pada jalur galat, benturan nama antar berkas, atau nama
   sheet yang terlalu panjang. Berkas ini memeriksanya secara statis. */

const fs = require('node:fs');
const path = require('node:path');

const AKAR = path.join(__dirname, '..') + '/';
const code = fs.readFileSync(AKAR + 'gas/Code.js', 'utf8');
const sm = fs.readFileSync(AKAR + 'gas/SheetManager.js', 'utf8');
const ix = fs.readFileSync(AKAR + 'gas/Index.html', 'utf8');

let gagal = 0;
const cek = (label, ok, nilai) => {
  console.log((ok ? '  OK   ' : '  GAGAL ') + label + (nilai !== undefined ? '  -> ' + nilai : ''));
  if (!ok) gagal++;
};

/* Nama RPC adalah panggilan berantai terakhir pada satu pernyataan
   google.script.run. Panggilan bawaan di dalam badan handler, seperti join()
   atau replace(), sengaja dibuang lewat daftar BAWAAN. */
const BAWAAN = ['withSuccessHandler', 'withFailureHandler', 'withUserObject', 'then', 'catch', 'finally',
  'map', 'filter', 'forEach', 'join', 'split', 'replace', 'replaceAll', 'substring', 'slice', 'push',
  'some', 'every', 'indexOf', 'lastIndexOf', 'test', 'match', 'concat', 'trim', 'toUpperCase',
  'toLowerCase', 'toString', 'apply', 'call', 'bind', 'hasOwnProperty', 'includes', 'padEnd', 'padStart',
  'sort', 'reduce', 'find', 'findIndex', 'reverse', 'pop', 'shift', 'unshift', 'splice', 'keys', 'values',
  'entries', 'stringify', 'parse', 'round', 'min', 'max', 'abs', 'floor', 'ceil', 'now', 'isFinite',
  'getElementById', 'querySelector', 'querySelectorAll', 'addEventListener', 'setAttribute', 'getAttribute',
  'classList', 'toggle', 'contains', 'add', 'remove', 'focus', 'blur', 'click', 'preventDefault',
  'Number', 'String', 'Boolean', 'Object', 'Array', 'JSON', 'Math', 'Date', 'Error', 'Promise',
  'parseInt', 'parseFloat', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'alert', 'confirm',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'require', 'Boolean'];

/* Akhir satu pernyataan dicari dengan menghitung tanda kurung, bukan dengan
   titik koma pertama: titik koma di dalam badan handler muncul sebelum nama
   RPC-nya, sehingga pemotongan sederhana akan berhenti terlalu awal. */
const akhirPernyataan = (teks) => {
  let dalam = 0;
  let kutip = '';
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (kutip) {
      if (c.charCodeAt(0) === 92) { i++; continue; }   /* backslash */      if (c === kutip) kutip = '';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { kutip = c; continue; }
    if (c === '(' || c === '{' || c === '[') dalam++;
    else if (c === ')' || c === '}' || c === ']') dalam--;
    else if (c === ';' && dalam <= 0) return i + 1;
  }
  return teks.length;
};

const rpcHalaman = () => {
  const nama = new Set();
  const pola = /google\.script\.run/g;
  let m;
  while ((m = pola.exec(ix)) !== null) {
    const sisa = ix.slice(m.index + 17);
    const potong = sisa.slice(0, akhirPernyataan(sisa));
    const panggilan = [...potong.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_]*)\(/g)]
      .map((x) => x[1])
      .filter((n) => BAWAAN.indexOf(n) === -1 && n !== 'run');
    if (panggilan.length) nama.add(panggilan[panggilan.length - 1]);
  }
  return [...nama].sort();
};

console.log('=== setiap RPC yang dipanggil halaman ada di sisi server ===');
const rpc = rpcHalaman();
cek('halaman memanggil sekurangnya sepuluh RPC', rpc.length >= 10, rpc.length);
const rpcHilang = rpc.filter((n) => code.indexOf('function ' + n) === -1);
cek('seluruh ' + rpc.length + ' nama RPC ada sebagai fungsi di Code.js', rpcHilang.length === 0, rpcHilang.join(', '));
['getPembagianJahit', 'bagiPembagianDashboard', 'simpanPenjahitDashboard', 'simpanAturanDashboard']
  .forEach((n) => cek('RPC modul pembagian ' + n + ' ikut dipanggil halaman', rpc.indexOf(n) !== -1));

/* Fungsi bantu halaman: nama yang dipanggil tanpa titik di depannya harus punya
   definisi. Anggota objek seperti k.ambil(b) sengaja dilewati. */
console.log('=== fungsi bantu halaman punya definisinya ===');
const awalan = ix.indexOf('function muatPembagianJahit');
const bagianBaru = ix.slice(awalan, ix.indexOf('/* ---- tabs ---- */', awalan));
const dipanggil = new Set();
[...bagianBaru.matchAll(/([^.\w])([a-zA-Z_][a-zA-Z0-9_]*)\(/g)].forEach((x) => dipanggil.add(x[2]));
const definisi = new Set([...ix.matchAll(/function ([a-zA-Z_][a-zA-Z0-9_]*)\(/g)].map((x) => x[1]));
const KATA_KUNCI = ['if','for','while','switch','catch','return','typeof','function','in','new','do','else','delete','void','instanceof'];
KATA_KUNCI.forEach((n) => definisi.add(n));
BAWAAN.forEach((n) => definisi.add(n));
rpc.forEach((n) => definisi.add(n));
const bantuHilang = [...dipanggil].filter((n) => definisi.has(n) === false).sort();
cek('seluruh fungsi bantu pada bagian baru punya definisi', bantuHilang.length === 0, bantuHilang.join(', '));

/* Id yang dibaca JavaScript harus ada di markup: id yang salah ketik bernilai
   null, dan barisnya berhenti tanpa pesan. */
console.log('=== id yang dibaca bagian baru ada di markup ===');
const idDibaca = new Set([...bagianBaru.matchAll(/getElementById\('([^']+)'\)/g)].map((x) => x[1]));
[...bagianBaru.matchAll(/setText\('([^']+)'/g)].forEach((x) => idDibaca.add(x[1]));
const idHilang = [...idDibaca].filter((id) => ix.indexOf('id="' + id + '"') === -1).sort();
cek('seluruh ' + idDibaca.size + ' id yang dibaca bagian baru ada di markup', idHilang.length === 0, idHilang.join(', '));

console.log('=== tidak ada benturan nama antar berkas GAS ===');
const namaAtas = (isi) => [...isi.matchAll(/^function ([a-zA-Z_][a-zA-Z0-9_]*)\(/gm)].map((x) => x[1]);
const semua = namaAtas(code).concat(namaAtas(sm));
const kembar = [...new Set(semua.filter((n, i) => semua.indexOf(n) !== i))];
cek('tidak ada nama fungsi tingkat atas yang didefinisikan dua kali', kembar.length === 0, kembar.join(', '));

console.log('=== panggilan ke API SheetManager tersedia ===');
const apiSm = new Set([...sm.matchAll(/^\s{4}([a-zA-Z][a-zA-Z0-9_]*): function/gm)].map((x) => x[1]));
const dipanggilSm = new Set([...code.matchAll(/SheetManager\.([a-zA-Z][a-zA-Z0-9_]*)/g)].map((x) => x[1]));
const smHilang = [...dipanggilSm].filter((n) => apiSm.has(n) === false).sort();
cek('seluruh ' + dipanggilSm.size + ' anggota SheetManager yang dipanggil Code.js tersedia', smHilang.length === 0, smHilang.join(', '));

console.log('=== batas teknis Google Sheets dan Apps Script ===');
const namaSheet = [...sm.matchAll(/^\s{4}[A-Z]+: '([^']+)'/gm)].map((x) => x[1]);
const sheetPanjang = namaSheet.filter((n) => n.length > 31);
cek('nama sheet terpanjang ' + Math.max(...namaSheet.map((n) => n.length)) + ' karakter, batasnya 31', sheetPanjang.length === 0, sheetPanjang.join(', '));
['BAGI_HEADERS', 'PENJAHIT_HEADERS', 'RULES_HEADERS'].forEach((nama) => {
  const mulai = sm.indexOf('var ' + nama + ' = [');
  const isi = sm.slice(mulai, sm.indexOf('];', mulai));
  const kolom = (isi.match(/'/g) || []).length / 2;
  cek('jumlah kolom ' + nama + ' tidak melewati 26', kolom <= 26, kolom);
});
const ttl = [].concat(
  [...sm.matchAll(/put\([^,]+,[^,]+, *([0-9]+)\)/g)].map((x) => Number(x[2])),
  [...code.matchAll(/put\([^,]+,[^,]+, *([0-9]+)\)/g)].map((x) => Number(x[2])));
const ttlTerlalu = ttl.filter((n) => n > 21600);
cek('seluruh ' + ttl.length + ' masa simpan cache tidak melewati enam jam (21600 detik)', ttlTerlalu.length === 0, ttlTerlalu.join(', '));

console.log('=== gaya berkas GAS tetap seperti berkas aslinya ===');
[['gas/Code.js', code], ['gas/SheetManager.js', sm]].forEach(([nama, isi]) => {
  const modern = isi.split('\n').filter((l) => /^\s*(let|const)\s+[a-zA-Z_$]/.test(l) || /=>/.test(l));
  cek(nama + ' tetap memakai var dan function', modern.length === 0, modern.length + ' baris bergaya baru');
});

console.log('=== kendali peran dan nominal punya mekanismenya ===');
['butuh-admin', 'butuh-superadmin'].forEach((kelas) => {
  cek('kelas ' + kelas + ' dipakai markup', ix.indexOf(kelas) !== -1);
  cek('kelas ' + kelas + ' punya perintah penyembunyian', ix.indexOf("setel('." + kelas + "'") !== -1);
});
cek('nominal uang disembunyikan lewat kelas butuh-uang', ix.indexOf('body.tanpa-uang .butuh-uang') !== -1);
cek('kelas butuh-uang dipakai pada bagian baru', bagianBaru.indexOf('butuh-uang') !== -1);

console.log('=== pustaka pihak ketiga tidak bertambah ===');
const tautan = [...ix.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((x) => x[1]);
const domain = [...new Set(tautan.map((u) => u.split('/')[2]))].sort();
console.log('       domain yang dimuat: ' + (domain.join(', ') || 'tidak ada'));
const sah = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
cek('tidak ada domain baru di luar empat yang sudah dipakai', domain.every((d) => sah.indexOf(d) !== -1), domain.join(', '));

console.log('');
console.log('HASIL KESIAPAN PAKAI: ' + (gagal === 0 ? 'SEMUA LULUS' : gagal + ' KEGAGALAN'));
process.exit(gagal === 0 ? 0 : 1);
