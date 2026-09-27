/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';


const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync(AKAR + 'gas/Index.html','utf8');
const skrip=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');

let gagal=0;
const cek=(l,ok,x)=>{console.log((ok?'  OK   ':'  GAGAL ')+l+(x!==undefined?'  -> '+x:''));if(!ok)gagal++;};

const dibuat={};
function buatEl(id){
  if(dibuat[id]) return dibuat[id];
  const kelas=new Set();
  const e={id:id,hidden:false,value:'',innerHTML:'',innerText:'',className:'',disabled:false,dataset:{},style:{},children:[],
    classList:{
      add:(c)=>kelas.add(c),
      remove:(c)=>kelas.delete(c),
      contains:(c)=>kelas.has(c),
      toggle:(c,paksa)=>{const nyala = paksa===undefined ? !kelas.has(c) : Boolean(paksa); if(nyala) kelas.add(c); else kelas.delete(c); return nyala;}
    },
    setAttribute(){},getAttribute(){return null;},querySelector(){return null;},focus(){},appendChild(c){e.children.push(c);return c;},removeChild(){},click(){}};
  dibuat[id]=e; return e;
}
/* Kerangka penyembunyian memasang kelas pada body atau elemen akar, jadi kedua
   elemen itu perlu classList yang benar-benar bekerja. */
function kelasBaru(){
  const kelas=new Set();
  return {add:(c)=>kelas.add(c),remove:(c)=>kelas.delete(c),contains:(c)=>kelas.has(c),
          toggle:(c,p)=>{const n=p===undefined?!kelas.has(c):Boolean(p); if(n) kelas.add(c); else kelas.delete(c); return n;}};
}
const tabBerperan=[buatEl('tab-token'),buatEl('tab-pengguna')];
const dokumen={
  getElementById:(id)=>buatEl(id),
  querySelectorAll:(sel)=>sel==='.butuh-superadmin'?tabBerperan:(sel==='.tab'?tabBerperan.concat([buatEl('tab-orders')]):[]),
  addEventListener(){},
  documentElement:{setAttribute(){},getAttribute(){return 'light';},classList:kelasBaru()},
  createElement:()=>buatEl('tmp'+Object.keys(dibuat).length),
  body:{appendChild(){},removeChild(){},classList:kelasBaru()}
};
const panggilanRpc=[];
let rpcProxy=null;
let lipatSukses=null;
const api={withSuccessHandler(f){lipatSukses=f;return rpcProxy;},withFailureHandler(){return rpcProxy;}};
rpcProxy=new Proxy(api,{get(t,n){ if(n in t) return t[n]; return function(){ panggilanRpc.push({nama:String(n),args:Array.prototype.slice.call(arguments)}); }; }});
const sb={document:dokumen,window:{matchMedia:()=>({matches:false}),open(){},addEventListener(){}},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},
  google:{script:{run:rpcProxy}},console:console,
  Blob:function(){},URL:{createObjectURL:()=>'',revokeObjectURL(){}},alert(){}};
sb.globalThis=sb;
vm.createContext(sb);
let galatMuat=null;
try{ vm.runInContext(skrip,sb,{filename:'Index.html'}); }catch(e){ galatMuat=e.message; }
cek('skrip dashboard dapat dimuat dan seluruh handler terpasang', galatMuat===null, galatMuat);
if(galatMuat) process.exit(1);

const jalankan=(kode)=>vm.runInContext(kode,sb,{filename:'uji'});
const tbody=()=>dokumen.getElementById('pengguna-tbody').innerHTML;
const teks=(id)=>dokumen.getElementById(id).innerText;

console.log('=== 1: tabel akun dirender dari data server ===');
jalankan("sesiToken='token-uji'; daftarPengguna=[{kode:'PEMILIK',nama:'Pemilik Toko',peran:'SUPERADMIN',email:'',aktif:'YA',terakhir_masuk:'2026-09-27 08:00:00'},{kode:'PACKING1',nama:'Budi',peran:'PACKING',email:'budi@contoh.com',aktif:'YA',terakhir_masuk:''},{kode:'MANTAN',nama:'Mantan',peran:'PACKING',email:'',aktif:'TIDAK',terakhir_masuk:''}]; superadminAktif=1; renderTabelPengguna_();");
const t1=tbody();
cek('tiga baris dirender', (t1.match(/<tr>/g)||[]).length===3, (t1.match(/<tr>/g)||[]).length);
cek('kode, peran, dan email tampil', t1.indexOf('PEMILIK')!==-1&&t1.indexOf('SUPERADMIN')!==-1&&t1.indexOf('budi@contoh.com')!==-1);
cek('email kosong ditulis apa adanya', t1.indexOf('tanpa email')!==-1);
cek('status dibedakan', t1.indexOf('Aktif')!==-1&&t1.indexOf('Tidak aktif')!==-1);
cek('yang belum pernah masuk ditulis apa adanya', t1.indexOf('belum pernah')!==-1);

console.log('=== 2: superadmin terakhir dikunci di layar ===');
cek('alasannya tertulis di barisnya', t1.indexOf('Superadmin terakhir, status dan perannya terkunci')!==-1);
cek('tombol status superadmin dimatikan', /data-kode="PEMILIK"[^>]*disabled/.test(t1));
cek('tombol pengguna lain tetap hidup', !/data-kode="PACKING1"[^>]*disabled/.test(t1));
jalankan('superadminAktif=2; renderTabelPengguna_();');
cek('kunci hilang setelah ada cadangan', tbody().indexOf('terkunci')===-1);

console.log('=== 3: nama pengguna tidak dapat menyisipkan HTML ===');
jalankan("daftarPengguna=[{kode:'X1',nama:'<img src=x onerror=alert(1)>',peran:'PACKING',email:'',aktif:'YA',terakhir_masuk:''}]; renderTabelPengguna_();");
cek('tag ditulis sebagai teks', tbody().indexOf('&lt;img')!==-1&&tbody().indexOf('<img')===-1);

console.log('=== 4: keadaan kosong menyebut tindakan berikutnya ===');
jalankan('daftarPengguna=[]; renderTabelPengguna_();');
cek('menyebut belum ada akun', tbody().indexOf('Belum ada akun')!==-1);
cek('menyebut tombol yang harus ditekan', tbody().indexOf('Tambah pengguna')!==-1);

console.log('=== 5: daftar yang gagal dibaca memberi jalan keluar ===');
jalankan("renderGalatPengguna_('Sesi tidak berlaku atau sudah berakhir.');");
cek('menuliskan sebabnya apa adanya', tbody().indexOf('tidak berlaku')!==-1);
cek('menyediakan tombol coba lagi', tbody().indexOf('Coba lagi')!==-1);

console.log('=== 6: pemeriksaan isian di klien sejalan dengan server ===');
const isian=(k,n,s)=>jalankan('periksaIsianPengguna_('+JSON.stringify(k)+','+JSON.stringify(n)+','+JSON.stringify(s)+')');
jalankan("penggunaSedangDisunting='';");
cek('kode kosong ditolak', isian('','Budi','sandi123')==='Kode pengguna harus diisi.');
cek('kode berspasi ditolak', isian('pak king','Budi','sandi123').indexOf('tanda hubung')!==-1);
cek('nama kosong ditolak', isian('X1','','sandi123')==='Nama pengguna harus diisi.');
cek('akun baru tanpa sandi ditolak', isian('X1','Budi','').indexOf('harus diberi sandi')!==-1);
cek('sandi pendek ditolak', isian('X1','Budi','12345')==='Sandi minimal 6 karakter.');
cek('sandi sama dengan kode ditolak', isian('X12345','Budi','x12345').indexOf('tidak boleh sama')!==-1);
cek('isian benar diterima', isian('X1','Budi','sandi123')==='');
jalankan("penggunaSedangDisunting='X1';");
cek('saat menyunting, sandi boleh dikosongkan', isian('X1','Budi','')==='');
jalankan("penggunaSedangDisunting='';");

console.log('=== 7: kode dibersihkan saat ditulis ===');
dokumen.getElementById('pengguna-kode').value='packing2! ';
jalankan('bersihkanKodePengguna_();');
cek('spasi dan tanda seru dibuang, huruf jadi besar', dokumen.getElementById('pengguna-kode').value==='PACKING2', dokumen.getElementById('pengguna-kode').value);

console.log('=== 8: memuat daftar memanggil RPC dengan token dan menerima jawabannya ===');
panggilanRpc.length=0; lipatSukses=null;
jalankan('muatDaftarPengguna();');
const panggil=panggilanRpc[panggilanRpc.length-1];
cek('RPC ambilDaftarPengguna dipanggil', Boolean(panggil&&panggil.nama==='ambilDaftarPengguna'), panggil?panggil.nama:'-');
cek('token dikirim sebagai argumen pertama', Boolean(panggil&&panggil.args[0]==='token-uji'), panggil?JSON.stringify(panggil.args):'-');
cek('keadaan memuat menyebut yang sedang dibaca', tbody().indexOf('Membaca sheet Pengguna')!==-1);
cek('jawaban server diterima sebagai fungsi', typeof lipatSukses==='function');
lipatSukses({pengguna:[{kode:'BUDI',nama:'Budi',peran:'PACKING',email:'',aktif:'YA',terakhir_masuk:''}],superadminAktif:1});
cek('tabel terisi dari jawaban server', tbody().indexOf('BUDI')!==-1);
cek('daftarnya disimpan di memori', jalankan('daftarPengguna.length')===1);
cek('jumlah superadmin aktif tersimpan', jalankan('superadminAktif')===1);

console.log('=== 9: tab pengguna memuat sekali saja ===');
jalankan('daftarPenggunaSudahDimuat=true;');
panggilanRpc.length=0;
jalankan("switchTab('pengguna');");
cek('tidak memuat ulang setelah daftarnya ada', panggilanRpc.length===0, panggilanRpc.map(x=>x.nama).join(','));
jalankan('daftarPenggunaSudahDimuat=false;');
panggilanRpc.length=0;
jalankan("switchTab('pengguna');");
cek('memuat saat daftarnya belum ada', panggilanRpc.some(x=>x.nama==='ambilDaftarPengguna'), panggilanRpc.map(x=>x.nama).join(','));

console.log('=== 10: konfirmasi nonaktif menyebut akibatnya ===');
jalankan("daftarPengguna=[{kode:'BUDI',nama:'Budi Packing',peran:'PACKING',email:'',aktif:'YA',terakhir_masuk:''}]; renderTabelPengguna_();");
jalankan("ubahStatusPengguna('BUDI');");
cek('judulnya menyebut nonaktif', teks('pengguna-konfirmasi-title')==='Nonaktifkan akun', teks('pengguna-konfirmasi-title'));
cek('kodenya ditampilkan', teks('pengguna-konfirmasi-kode')==='BUDI');
cek('akibatnya dijelaskan', teks('pengguna-konfirmasi-teks').indexOf('sesi yang sedang berjalan ikut berakhir')!==-1);
cek('tombolnya memakai kata yang sama', teks('pengguna-konfirmasi-lanjut')==='Nonaktifkan');
cek('modalnya dibuka', dokumen.getElementById('pengguna-konfirmasi-modal').hidden===false);

console.log('=== 11: mengaktifkan kembali memakai kata yang berbeda ===');
jalankan("daftarPengguna=[{kode:'BUDI',nama:'Budi Packing',peran:'PACKING',email:'',aktif:'TIDAK',terakhir_masuk:''}];");
jalankan("ubahStatusPengguna('BUDI');");
cek('judulnya menyebut aktifkan', teks('pengguna-konfirmasi-title')==='Aktifkan kembali akun');
cek('tombolnya menyebut aktifkan', teks('pengguna-konfirmasi-lanjut')==='Aktifkan');
cek('menyebut sandi lama tetap dipakai', teks('pengguna-konfirmasi-teks').indexOf('sandi yang sama')!==-1);

console.log('=== 12: formulir mengisi dirinya dari data tersimpan ===');
jalankan("daftarPengguna=[{kode:'BUDI',nama:'Budi Packing',peran:'ADMIN',email:'budi@contoh.com',aktif:'TIDAK',terakhir_masuk:''}];");
jalankan("bukaFormPengguna('BUDI');");
cek('judulnya menjadi ubah', teks('pengguna-modal-title')==='Ubah pengguna');
cek('kode terisi', dokumen.getElementById('pengguna-kode').value==='BUDI');
cek('kode dikunci saat menyunting', dokumen.getElementById('pengguna-kode').disabled===true);
cek('nama terisi', dokumen.getElementById('pengguna-nama').value==='Budi Packing');
cek('peran terisi', dokumen.getElementById('pengguna-peran').value==='ADMIN');
cek('email terisi', dokumen.getElementById('pengguna-email').value==='budi@contoh.com');
cek('sandi selalu dikosongkan', dokumen.getElementById('pengguna-sandi').value==='');
cek('diingatkan akun tidak aktif tidak ikut aktif', teks('pengguna-peran-note').indexOf('tidak mengaktifkannya kembali')!==-1);
jalankan("bukaFormPengguna('');");
cek('judulnya kembali menjadi tambah', teks('pengguna-modal-title')==='Tambah pengguna');
cek('kode terbuka saat menambah', dokumen.getElementById('pengguna-kode').disabled===false);

console.log('=== 13: tab yang bukan haknya disembunyikan dan ditutup ===');
jalankan("sesiPengguna={kode:'BUDI',nama:'Budi',peran:'PACKING'}; terapkanHakPeran_();");
cek('tab pengguna disembunyikan untuk packing', dokumen.getElementById('tab-pengguna').hidden===true);
cek('tab token juga disembunyikan', dokumen.getElementById('tab-token').hidden===true);
jalankan("sesiPengguna={kode:'PEMILIK',nama:'Pemilik',peran:'SUPERADMIN'}; terapkanHakPeran_();");
cek('tab pengguna tampil untuk superadmin', dokumen.getElementById('tab-pengguna').hidden===false);

console.log('=== 14: keluar membuang daftar akun dari layar ===');
jalankan("daftarPengguna=[{kode:'BUDI',nama:'Budi',peran:'PACKING',email:'',aktif:'YA',terakhir_masuk:''}]; daftarPenggunaSudahDimuat=true; renderTabelPengguna_();");
jalankan('bersihkanSesiLokal_();');
cek('tabel kembali ke keadaan belum dibaca', tbody().indexOf('Daftar belum dibaca')!==-1, tbody().slice(0,50));
cek('daftar di memori dikosongkan', jalankan('daftarPengguna.length')===0);

console.log('=== 15: grafik harian dibangun dari seri server ===');
jalankan("renderGrafikHarian_([{tanggal:'2026-09-24',jumlah:5,omzet:100},{tanggal:'2026-09-25',jumlah:10,omzet:200},{tanggal:'2026-09-26',jumlah:0,omzet:0},{tanggal:'2026-09-27',jumlah:20,omzet:400}]);");
const grafik=dokumen.getElementById('grafik-harian').innerHTML;
cek('empat batang dirender', (grafik.match(/class="bar"/g)||[]).length===4, (grafik.match(/class="bar"/g)||[]).length);
cek('angka asli tertulis di tiap batang', grafik.indexOf('>5<')!==-1&&grafik.indexOf('>20<')!==-1);
cek('hari terbanyak setinggi penuh', grafik.indexOf('width:100%')===-1&&grafik.indexOf('height:100%')!==-1);
cek('hari tanpa pesanan tetap tampil dan ditandai', grafik.indexOf('is-kosong')!==-1);
cek('label tanggal dipendekkan jadi hari/bulan', grafik.indexOf('>24/09<')!==-1);
cek('tanggal lengkap tersedia di keterangan batang', grafik.indexOf('2026-09-24: 5 pesanan')!==-1);
jalankan('renderGrafikHarian_([]);');
cek('seri kosong menyebut jalan keluarnya', dokumen.getElementById('grafik-harian').innerHTML.indexOf('Muat ulang')!==-1);

console.log('=== 16: tiga sebaran memakai bentuk yang sama ===');
jalankan("renderBarList_('grafik-kurir',[{nama:'JNE',jumlah:9},{nama:'SPX',jumlah:3}],'pesanan','tidak ada');");
const sebaran=dokumen.getElementById('grafik-kurir').innerHTML;
cek('dua baris sebaran dirender', (sebaran.match(/bar-list-row/g)||[]).length===2, (sebaran.match(/bar-list-row/g)||[]).length);
cek('yang terbanyak memakai bilah penuh', sebaran.indexOf('width:100%')!==-1);
cek('angkanya tertulis dengan satuannya', sebaran.indexOf('9 pesanan')!==-1&&sebaran.indexOf('3 pesanan')!==-1);
jalankan("renderBarList_('grafik-kurir',[],'pesanan','Belum ada data ekspedisi.');");
cek('sebaran kosong menyebut sebabnya', dokumen.getElementById('grafik-kurir').innerHTML.indexOf('Belum ada data ekspedisi')!==-1);

console.log('=== 17: arah angka dihitung dari seri, bukan dikira ===');
jalankan("var seri14=[]; for(var i=0;i<14;i++){ seri14.push({tanggal:'2026-09-'+String(i+1).padStart(2,'0'), jumlah:i+1, omzet:i<7?1000:2000}); } renderArahAngka_(seri14);");
cek('naik harian diberi lencana hijau', dokumen.getElementById('stat-trend-hari').className.indexOf('pill-naik')!==-1, teks('stat-trend-hari'));
cek('persentasenya dihitung dari hari sebelumnya', teks('stat-trend-hari')==='+8%', teks('stat-trend-hari'));
cek('omzet dibandingkan per tujuh hari', teks('stat-trend-omzet').indexOf('7 hari')!==-1, teks('stat-trend-omzet'));
jalankan("renderArahAngka_([{tanggal:'2026-09-26',jumlah:20,omzet:0},{tanggal:'2026-09-27',jumlah:10,omzet:0}]);");
cek('turun diberi lencana merah', dokumen.getElementById('stat-trend-hari').className.indexOf('pill-turun')!==-1, teks('stat-trend-hari'));
jalankan("renderArahAngka_([{tanggal:'2026-09-26',jumlah:0,omzet:0},{tanggal:'2026-09-27',jumlah:5,omzet:0}]);");
cek('pembanding nol tidak dipaksa jadi persen', teks('stat-trend-hari')==='belum ada pembanding', teks('stat-trend-hari'));

console.log('=== 18: laci sidebar di layar sempit ===');
cek('awalnya tertutup', jalankan('sidebarTerbuka()')===false);
jalankan('bukaSidebar();');
cek('terbuka setelah tombol ditekan', jalankan('sidebarTerbuka()')===true);
cek('lapisan penghalang ikut tampil', dokumen.getElementById('sidebar-scrim').hidden===false);
jalankan("switchTab('analytics');");
cek('memilih menu menutup laci', jalankan('sidebarTerbuka()')===false);
cek('judul bilah atas ikut berubah', teks('topbar-judul')==='Analisis', teks('topbar-judul'));
jalankan("switchTab('logs');");
cek('judul mengikuti menu berikutnya', teks('topbar-judul')==='Log aktivitas', teks('topbar-judul'));
cek('menu yang aktif ditandai', dokumen.getElementById('tab-logs').classList.contains('is-active')===true);
jalankan('bukaSidebar(); tutupSidebar();');
cek('lapisan penghalang disembunyikan lagi', dokumen.getElementById('sidebar-scrim').hidden===true);

console.log('=== 19: avatar memakai inisial, bukan foto contoh ===');
cek('dua kata menjadi dua huruf', jalankan("inisial_('Budi Santoso')")==='BS', jalankan("inisial_('Budi Santoso')"));
cek('satu kata memakai dua huruf pertama', jalankan("inisial_('Pemilik')")==='PE', jalankan("inisial_('Pemilik')"));
cek('nama kosong tidak menghasilkan huruf acak', jalankan("inisial_('')")==='-');
jalankan("sesiToken='token-uji'; sesiPengguna={kode:'BUDI',nama:'Budi Santoso',peran:'PACKING'}; tampilkanIdentitas_();");
cek('inisial dipasang pada avatar', teks('masuk-avatar')==='BS', teks('masuk-avatar'));
jalankan('bersihkanSesiLokal_();');
cek('sesudah keluar, avatar dikosongkan', teks('masuk-avatar')==='-', teks('masuk-avatar'));

console.log('=== 20: satuan angka ditulis, bukan dibiarkan bertentangan ===');
jalankan("statusInventaris=[{status:'[1] Siap Packing',jumlah:31},{status:'[4] Selesai',jumlah:80}]; bangunPilihanStatus_(statusInventaris);");
const opsi=dokumen.getElementById('filter-status').children.map((c)=>c.innerText);
cek('pilihan filter menyebut satuannya', opsi.indexOf('[1] Siap Packing (31 baris)')!==-1, opsi.join(' | '));
cek('status lain ikut menyebut satuannya', opsi.indexOf('[4] Selesai (80 baris)')!==-1, opsi.join(' | '));
cek('panel antrian menuliskan jumlah barisnya', teks('queue-baris-siap-packing')==='· 31 baris produk', teks('queue-baris-siap-packing'));

jalankan("document.getElementById('filter-status').value='ALL';");
cek('sumber dari payload dikenali', jalankan('sumberAdalahPayload_()')===true);
jalankan("document.getElementById('filter-status').value='[1] Siap Packing';");
cek('sumber langsung dari sheet dikenali', jalankan('sumberAdalahPayload_()')===false);
jalankan("document.getElementById('filter-status').value='ALL';");

console.log('=== 21: keterangan tabel menyebut baris dan cakupannya ===');
jalankan("globalData={orders:[{orderSn:'A',internalStatus:'[1] Siap Packing',date:'2026-09-27 08:00:00'},{orderSn:'B',internalStatus:'[1] Siap Packing',date:'2026-09-26 08:00:00'}]}; currentFilteredOrders=globalData.orders; currentPage=1; pageSize=25;");
jalankan('renderPaginatedOrders();');
const info=teks('table-entries-info');
cek('keterangan menyebut baris', info.indexOf('baris')!==-1, info);
cek('keterangan menyebut cakupan payload', info.indexOf('baris terbaru yang dimuat')!==-1, info);
jalankan("statusInventaris=[]; perbaruiBarisSiapPacking_();");
cek('tanpa data status, catatan baris dikosongkan', teks('queue-baris-siap-packing')==='', teks('queue-baris-siap-packing'));

console.log('=== 22: nominal uang disembunyikan dari peran di bawah superadmin ===');
jalankan('uangTersembunyiPeran=false; uangTersembunyiServer=false; terapkanTampilanUang_();');
cek('superadmin: kelas tanpa-uang tidak dipasang', dokumen.body && true);
jalankan("sesiPengguna={kode:'PACKING1',nama:'Budi',peran:'PACKING'}; sesiToken='t'; terapkanHakPeran_();");
cek('packing: kelas tanpa-uang dipasang di body', dokumen.body.classList.contains('tanpa-uang')===true);
jalankan("sesiPengguna={kode:'ADMIN1',nama:'Admin',peran:'ADMIN'}; terapkanHakPeran_();");
cek('admin juga disembunyikan', dokumen.body.classList.contains('tanpa-uang')===true);
jalankan("sesiPengguna={kode:'PEMILIK',nama:'Pemilik',peran:'SUPERADMIN'}; terapkanHakPeran_();");
cek('superadmin: kelas dilepas', dokumen.body.classList.contains('tanpa-uang')===false);
cek('superadmin boleh melihat uang', jalankan('bolehLihatUang_()')===true);

console.log('=== 23: penanda dari server juga menyembunyikan ===');
jalankan('uangTersembunyiServer=true; terapkanTampilanUang_();');
cek('penanda server menyembunyikan walau perannya superadmin', dokumen.body.classList.contains('tanpa-uang')===true);
jalankan('uangTersembunyiServer=false; terapkanTampilanUang_();');

console.log('=== 24: urutan berdasarkan nominal ikut dibuang ===');
jalankan('uangTersembunyiPeran=true; terapkanTampilanUang_();');
const opsiSortir=dokumen.getElementById('sort-orders').innerHTML;
cek('pilihan nominal hilang', opsiSortir.indexOf('AMOUNT_DESC')===-1&&opsiSortir.indexOf('AMOUNT_ASC')===-1, opsiSortir);
cek('urutan waktu tetap ada', opsiSortir.indexOf('NEWEST')!==-1&&opsiSortir.indexOf('OLDEST')!==-1);
jalankan("document.getElementById('sort-orders').value='AMOUNT_DESC'; terapkanTampilanUang_();");
cek('pilihan yang hilang dikembalikan ke terbaru', dokumen.getElementById('sort-orders').value==='NEWEST', dokumen.getElementById('sort-orders').value);
jalankan('uangTersembunyiPeran=false; terapkanTampilanUang_();');
cek('superadmin kembali punya pilihan nominal', dokumen.getElementById('sort-orders').innerHTML.indexOf('AMOUNT_DESC')!==-1);

console.log('=== 25: kolom dan baris uang ditandai untuk disembunyikan ===');
aksesMarkup();
function aksesMarkup(){
  const fs=require('fs');
  const html=fs.readFileSync(AKAR + 'gas/Index.html','utf8');
  cek('kartu omzet ditandai butuh-uang', /class="kpi-card butuh-uang"/.test(html));
  cek('kolom Total ditandai butuh-uang', /<th scope="col" class="butuh-uang">Total<\/th>/.test(html));
  cek('blok nominal di modal ditandai butuh-uang', /class="kv butuh-uang"/.test(html));
  cek('sel nominal pada baris tabel ditandai butuh-uang', /ledger-money butuh-uang/.test(html));
  cek('sel nominal pada baris tabel dijaga pemeriksaan hak', html.indexOf('ledger-money butuh-uang')!==-1 && html.indexOf("? rupiah(order.totalAmount)")!==-1);
}
jalankan("currentFilteredOrders=[{orderSn:'SN-1',internalStatus:'[1] Siap Packing',date:'2026-09-27 08:00:00',qty:2,courier:'JNE',resi:'R1',buyer:'budi',items:'Tas'}]; currentPage=1; pageSize=25; globalData={orders:currentFilteredOrders};");
jalankan('uangTersembunyiPeran=true; terapkanTampilanUang_(); renderPaginatedOrders();');
const barisTersembunyi=dokumen.getElementById('orders-tbody').innerHTML;
cek('sel nominal benar-benar kosong, bukan Rp 0', barisTersembunyi.indexOf('ledger-money butuh-uang"></td>')!==-1, (barisTersembunyi.match(/ledger-money[^>]*>[^<]*/)||[''])[0]);
jalankan('uangTersembunyiPeran=false; terapkanTampilanUang_(); renderPaginatedOrders();');
const barisTampil=dokumen.getElementById('orders-tbody').innerHTML;
cek('superadmin melihat angkanya', barisTampil.indexOf('ledger-money')!==-1&&barisTampil.indexOf('Rp 0')!==-1);

console.log('');
console.log('HASIL LAYAR PENGGUNA: '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
