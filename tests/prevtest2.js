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
const sb={document:dokumen,window:{matchMedia:()=>({matches:false}),open(){},addEventListener(){},location:{search:'?peran=packing'}},
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
  console.log('=== pratinjau peran packing: uang tidak tampil ===');
  cek('sesi terbuka sebagai packing', teks('masuk-peran')==='PACKING', teks('masuk-peran'));
  cek('kerangka menandai tanpa-uang', dokumen.body.classList.contains('tanpa-uang')===true);
  cek('kartu omzet tidak ditampilkan', dokumen.getElementById('stat-revenue').innerText==='-', teks('stat-revenue'));
  cek('angka non-keuangan tetap terisi', teks('stat-total-orders')==='110', teks('stat-total-orders'));
  cek('pilihan urutan nominal dibuang', dokumen.getElementById('sort-orders').innerHTML.indexOf('AMOUNT_DESC')===-1);
  cek('grafik harian tetap tergambar', (dokumen.getElementById('grafik-harian').innerHTML.match(/class="bar"/g)||[]).length===14);

  console.log('=== pratinjau peran packing: pembagian jahit tetap terbaca ===');
  /* Pembagian jahit boleh dibaca peran packing, karena isinya mengatur
     pekerjaan. Yang tidak boleh terlihat hanya nominal upahnya. */
  jalankan("switchTab('pembagian');");
  return sleep(500).then(()=>{
    const rekap=dokumen.getElementById('pembagian-penjahit-tbody').innerHTML;
    cek('tab pembagian tetap tampil untuk packing', dokumen.getElementById('tab-pembagian').hidden===false);
    cek('tabel penjahit tetap terisi', (rekap.match(/<tr>/g)||[]).length===5, (rekap.match(/<tr>/g)||[]).length);
    cek('nama penjahit tetap terlihat', rekap.indexOf('UGUN')!==-1);
    cek('pcs tetap terlihat', rekap.indexOf('>4<')!==-1);
    cek('upah tidak ditampilkan', rekap.indexOf('Rp')===-1);
    cek('kolom nominal diisi tanda hubung', rekap.indexOf('>-<')!==-1);
    cek('target dan selisih ikut disembunyikan', rekap.indexOf('+Rp')===-1&&rekap.indexOf('50.000')===-1);
    cek('pcs di antrian tetap terhitung', teks('bagi-unit')==='9', teks('bagi-unit'));
    cek('daftar pcs tidak memuat harga', dokumen.getElementById('pembagian-unit-tbody').innerHTML.indexOf('Rp')===-1);
    console.log('');
    console.log('HASIL PRATINJAU PACKING: '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
    process.exit(gagal===0?0:1);
  });
});
