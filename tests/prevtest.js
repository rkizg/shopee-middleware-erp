/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';


const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync(AKAR + 'dashboard-preview.html','utf8');
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
    setAttribute(){},getAttribute(){return null;},querySelector(){return null;},focus(){},appendChild(){},removeChild(){},click(){}};
  dibuat[id]=e; return e;
}
const tabBerperan=[buatEl('tab-token'),buatEl('tab-pengguna')];
function kelasBaru(){
  const kelas=new Set();
  return {add:(c)=>kelas.add(c),remove:(c)=>kelas.delete(c),contains:(c)=>kelas.has(c),
          toggle:(c,p)=>{const n=p===undefined?!kelas.has(c):Boolean(p); if(n) kelas.add(c); else kelas.delete(c); return n;}};
}
const dokumen={
  getElementById:(id)=>buatEl(id),
  querySelectorAll:(sel)=>sel==='.butuh-superadmin'?tabBerperan:(sel==='.tab'?tabBerperan.concat([buatEl('tab-orders')]):[]),
  addEventListener(){},
  documentElement:{setAttribute(){},getAttribute(){return 'light';},classList:kelasBaru()},
  createElement:()=>buatEl('tmp'),
  body:{appendChild(){},removeChild(){},classList:kelasBaru()}
};
const panggilanRpc=[];
let rpcProxy=null;
let lipatSukses=null;
const api={withSuccessHandler(f){lipatSukses=f;return rpcProxy;},withFailureHandler(){return rpcProxy;}};
rpcProxy=new Proxy(api,{get(t,n){ if(n in t) return t[n]; return function(){ panggilanRpc.push({nama:String(n),args:Array.prototype.slice.call(arguments)}); }; }});
const sb={document:dokumen,window:{matchMedia:()=>({matches:false}),open(){},addEventListener(){},location:{search:''}},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  setInterval:()=>0,clearInterval(){},setTimeout:(fn,ms)=>setTimeout(fn,ms||0),clearTimeout:(t)=>clearTimeout(t),
  google:{script:{run:rpcProxy}},console:console,
  Blob:function(){},URL:{createObjectURL:()=>'',revokeObjectURL(){}},alert(){}};
sb.globalThis=sb;
vm.createContext(sb);
const blok=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let galatMuat=null;
try{
  vm.runInContext(blok[0],sb,{filename:'harness'});
  vm.runInContext('google = window.google;',sb,{filename:'jembatan'});
  vm.runInContext(blok[1],sb,{filename:'logika'});
}catch(e){ galatMuat=e.message; }
cek('harness dan skrip dashboard dapat dimuat', galatMuat===null, galatMuat);
if(galatMuat) process.exit(1);

const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const jalankan=(kode)=>vm.runInContext(kode,sb,{filename:'uji'});
const teks=(id)=>dokumen.getElementById(id).innerText;

/* Di peramban, boot berjalan pada DOMContentLoaded. Stub ini mengabaikan
   pendengar itu, jadi boot-nya dipanggil langsung seperti peramban. */
jalankan('restoreTheme(); startLiveClock(); mulaiAplikasi_();');

sleep(800).then(()=>{
  console.log('=== pratinjau: sesi terbuka dari harness ===');
  cek('harness meniru sesi, dashboard terbuka', teks('masuk-nama')==='Pemilik Toko', teks('masuk-nama'));
  cek('avatar memakai inisial nama', teks('masuk-avatar')==='PT', teks('masuk-avatar'));
  cek('peran tertulis di sidebar', teks('masuk-peran')==='SUPERADMIN', teks('masuk-peran'));
  cek('angka KPI terisi dari data contoh', teks('stat-total-orders')==='110', teks('stat-total-orders'));
  cek('omzet terisi', teks('stat-revenue').indexOf('98.765.432')!==-1, teks('stat-revenue'));

  console.log('=== pratinjau: arah angka ===');
  cek('arah harian dihitung dari seri', teks('stat-trend-hari')==='+27%', teks('stat-trend-hari'));
  cek('arah omzet per tujuh hari', teks('stat-trend-omzet').indexOf('7 hari')!==-1, teks('stat-trend-omzet'));

  console.log('=== pratinjau: grafiknya tergambar ===');
  const grafik=dokumen.getElementById('grafik-harian').innerHTML;
  cek('empat belas batang harian', (grafik.match(/class="bar"/g)||[]).length===14, (grafik.match(/class="bar"/g)||[]).length);
  cek('hari tanpa pesanan ditandai', grafik.indexOf('is-kosong')!==-1);
  cek('sebaran status terisi', dokumen.getElementById('grafik-status').innerHTML.indexOf('Siap Packing')!==-1);
  cek('sebaran kurir terisi', (dokumen.getElementById('grafik-kurir').innerHTML.match(/bar-list-row/g)||[]).length===4);
  cek('sebaran toko terisi', dokumen.getElementById('grafik-toko').innerHTML.indexOf('BGD1')!==-1);

  console.log('=== pratinjau: sidebar dan kelola pengguna ===');
  cek('menu superadmin tampil semua', dokumen.getElementById('tab-token').hidden===false&&dokumen.getElementById('tab-pengguna').hidden===false);
  jalankan("switchTab('pengguna');");
  return sleep(400).then(()=>{
    const tabel=dokumen.getElementById('pengguna-tbody').innerHTML;
    cek('daftar pengguna terisi dari harness', (tabel.match(/<tr>/g)||[]).length===4, (tabel.match(/<tr>/g)||[]).length);
    cek('superadmin terakhir terkunci di pratinjau', tabel.indexOf('Superadmin terakhir')!==-1);
    cek('akun nonaktif tampil apa adanya', tabel.indexOf('Tidak aktif')!==-1);
    console.log('=== pratinjau: modul produksi jahit ===');
    jalankan("switchTab('produksi');");
    return sleep(400).then(()=>{
      const antrian=dokumen.getElementById('prod-antrian-tbody').innerHTML;
      cek('tabel antrian terisi', (antrian.match(/<tr>/g)||[]).length===4, (antrian.match(/<tr>/g)||[]).length);
      cek('SKU dari pesanan menunggu pickup tampil', antrian.indexOf('BG-KS-001')!==-1);
      cek('baris belum dihargai ditandai', antrian.indexOf('Belum dihargai')!==-1||antrian.indexOf('belum dihargai')!==-1);
      cek('superadmin melihat kolom harga satuan', dokumen.getElementById('tab-produksi').hidden===false);
      jalankan("switchTab('estimasi');");
      /* Estimasi baru dihitung setelah tombolnya ditekan, sama seperti SOP. */
      jalankan('muatEstimasiProduksi();');
      return sleep(500).then(()=>{
        cek('estimasi pcs terisi dari data contoh', teks('est-pcs')==='12', teks('est-pcs'));
        cek('estimasi menit terisi', teks('est-waktu').indexOf('300')!==-1, teks('est-waktu'));
        cek('superadmin melihat upah', teks('est-upah').indexOf('Rp')!==-1, teks('est-upah'));
        cek('tabel per sesi terisi', (dokumen.getElementById('est-sesi-tbody').innerHTML.match(/<tr>/g)||[]).length===2);
        console.log('=== pratinjau: pembagian jahit ===');
        jalankan("switchTab('pembagian');");
        return sleep(500).then(()=>{
          const rekap=dokumen.getElementById('pembagian-penjahit-tbody').innerHTML;
          cek('tabel penjahit terisi dari data contoh', (rekap.match(/<tr>/g)||[]).length===5, (rekap.match(/<tr>/g)||[]).length);
          cek('nama penjahit tampil', rekap.indexOf('UGUN')!==-1);
          cek('pcs per penjahit tampil', rekap.indexOf('>4<')!==-1);
          cek('superadmin melihat upah per penjahit', rekap.indexOf('Rp')!==-1);
          cek('selisih terhadap target diberi tanda', rekap.indexOf('+Rp')!==-1);
          cek('pcs di antrian terhitung', teks('bagi-unit')==='9', teks('bagi-unit'));
          cek('pcs yang belum berpemilik terlihat', teks('bagi-belum-ditetapkan')==='1', teks('bagi-belum-ditetapkan'));
          cek('rekap per grup terisi', (dokumen.getElementById('pembagian-grup-tbody').innerHTML.match(/<tr>/g)||[]).length===3);
          cek('rekap per toko terisi', (dokumen.getElementById('pembagian-toko-tbody').innerHTML.match(/<tr>/g)||[]).length===2);
          cek('peringatan pembagian tampil', dokumen.getElementById('pembagian-peringatan').innerHTML.indexOf('SKU RULES')!==-1);
          cek('daftar pcs terisi', (dokumen.getElementById('pembagian-unit-tbody').innerHTML.match(/<tr>/g)||[]).length===5);
          cek('setelan penjahit terisi di kotak teks', dokumen.getElementById('pembagian-penjahit-setelan').value.indexOf('UGUN')!==-1);
          cek('setelan aturan terisi di kotak teks', dokumen.getElementById('pembagian-aturan-setelan').value.indexOf('IGNORE')!==-1);
          cek('tab pembagian tampil untuk superadmin', dokumen.getElementById('tab-pembagian').hidden===false);
          console.log('');
        console.log('HASIL PRATINJAU: '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
        process.exit(gagal===0?0:1);
      });
    });
  });
});
      });
