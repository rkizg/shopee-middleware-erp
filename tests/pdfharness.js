/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';

const fs=require('fs'), vm=require('vm');

/* ---------- fake jsPDF that records every drawing operation ---------- */
class FakeDoc {
  constructor(o){
    this.o=o||{};
    this.pageW=Array.isArray(o.format)?o.format[0]:210;
    this.pageH=Array.isArray(o.format)?o.format[1]:297;
    this.pages=1; this.calls=[]; this.fontSize=10; this.font='helvetica'; this.style='normal';
  }
  addPage(){ this.pages++; return this; }
  setFontSize(n){ this.fontSize=n; return this; }
  setFont(f,s){ if(f) this.font=f; if(s) this.style=s; return this; }
  setTextColor(){ return this; } setDrawColor(){ return this; } setLineWidth(){ return this; }
  setFillColor(){ return this; }
  getNumberOfPages(){ return this.pages; }
  setPage(p){ return this; }
  text(t,x,y,op){ this.calls.push({op:'text',t:String(t),x,y,size:this.fontSize,font:this.font,style:this.style,align:(op&&op.align)||'left'}); return this; }
  line(x1,y1,x2,y2){ this.calls.push({op:'line',x1,y1,x2,y2}); return this; }
  rect(x,y,w,h){ this.calls.push({op:'rect',x,y,w,h}); return this; }
  getTextWidth(t){ return String(t).length*this.fontSize*0.5*0.3528; }
  splitTextToSize(t,w){
    const cw=Math.max(0.001,this.fontSize*0.5*0.3528);
    const per=Math.max(1,Math.floor(w/cw)); const s=String(t); const out=[];
    for(let i=0;i<s.length;i+=per) out.push(s.substr(i,per));
    return out.length?out:[''];
  }
  save(n){ this.savedAs=n; }
  output(){ return 'blob:fake'; }
}

/* ---------- minimal DOM so the script can evaluate ---------- */
class FakeEl{
  constructor(id){this.id=id;this._a={};this._h='';this._t='';this.value='';this.hidden=false;this.style={};this.dataset={};this._c=new Set();const s=this;
    this.classList={add:c=>s._c.add(c),remove:c=>s._c.delete(c),contains:c=>s._c.has(c),toggle:(c,o)=>{o?s._c.add(c):s._c.delete(c);}};}
  get className(){return Array.from(this._c).join(' ');} set className(v){this._c=new Set(String(v).split(/\s+/).filter(Boolean));}
  get innerHTML(){return this._h;} set innerHTML(v){this._h=String(v);}
  get innerText(){return this._t;} set innerText(v){this._t=String(v);}
  setAttribute(k,v){this._a[k]=String(v);} getAttribute(k){return this._a[k]===undefined?null:this._a[k];}
  appendChild(c){return c;} removeChild(){} querySelector(){return new FakeEl('x');}
  querySelectorAll(){return [];} focus(){} select(){}
}
const reg=new Map();
const el=id=>{if(!reg.has(id))reg.set(id,new FakeEl(id));return reg.get(id);};
const document={documentElement:new FakeEl('html'),body:new FakeEl('body'),head:new FakeEl('head'),
  getElementById:el,createElement:t=>new FakeEl(t),addEventListener(){}};

let SERVER={};
function makeRun(){let ok=null,fail=null;
  const base={withSuccessHandler(f){ok=f;return px;},withFailureHandler(f){fail=f;return px;}};
  const px=new Proxy(base,{get(t,p){if(p in t)return t[p];
    return (...a)=>{try{const r=SERVER[p]?SERVER[p](...a):{};if(ok)ok(r);}catch(e){if(fail)fail(e);}};}});
  return px;}

const sandbox={document,console,google:{script:{run:makeRun()}},
  setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
  navigator:{},localStorage:{getItem:()=>null,setItem:()=>{}},Blob:class{},URL:{createObjectURL:()=>'b',revokeObjectURL:()=>{}},
  alert:()=>{},prompt:()=>null};
sandbox.window=sandbox;
sandbox.window.matchMedia=()=>({matches:false});
sandbox.window.addEventListener=()=>{};sandbox.window.isSecureContext=true;
sandbox.window.jspdf={jsPDF:FakeDoc};

const html=fs.readFileSync(AKAR + 'gas/Index.html','utf8');
const code=html.split('<script>')[1].split('</script>')[0];
const EXPORT='globalThis.__api={loadDashboard,groupOrdersBySn,buildSlipPdf,buildBatchSlipPdf,buildLabelPdf,buildSpkPenjahitPdf,buildLembarKerjaPackingPdf,buildStickerKanbanPdf,buildBatchStickerKanbanPdf,fitLines,drawCuttingKanbanTicket,expandKanbanTickets_,buildKanbanTicketsFromRows_,deteksiKelengkapanSpreiSet_,formatTanggalKanban_,resolveKodeToko_,cariTokoItem_,kumpulkanDataKartu_,exportTable:null,pdfKit,rekapPesananRows,rekapRowsFrom,exportSlipPdf,cetakSlipPdfTerpilih,exportRekapPesananPdf,cetakLabelPdfTerpilih,setData:d=>{globalData=d;},setFiltered:f=>{currentFilteredOrders=f;},setSel:s=>{selectedOrderSns=s;},toggles:()=>0};';
vm.createContext(sandbox);
vm.runInContext(code+EXPORT,sandbox);
const A=sandbox.__api;
console.log('script evaluated, pdfKit public keys:', Object.keys(A.pdfKit).length);

/* ---------- bounds checker ---------- */
function audit(label, doc){
  const W=doc.pageW,H=doc.pageH; const bad=[];
  doc.calls.forEach((c,i)=>{
    if(c.op==='rect'){ if(c.x<-0.01||c.y<-0.01||c.x+c.w>W+0.01||c.y+c.h>H+0.01) bad.push(`rect@${i} (${c.x},${c.y},${c.w},${c.h})`); }
    if(c.op==='line'){ [[c.x1,c.y1],[c.x2,c.y2]].forEach(([x,y])=>{ if(x<-0.01||x>W+0.01||y<-0.01||y>H+0.01) bad.push(`line@${i} (${x},${y})`); }); }
    if(c.op==='text'){ if(c.x<-0.01||c.x>W+0.01||c.y<-0.01||c.y>H+0.01) bad.push(`text@${i} "${c.t.slice(0,18)}" (${c.x.toFixed(1)},${c.y.toFixed(1)})`); }
  });
  const tiny=doc.calls.filter(c=>c.op==='text'&&c.size<4.5).length;
  console.log(`  ${label}: pages=${doc.pages} texts=${doc.calls.filter(c=>c.op==='text').length} rects=${doc.calls.filter(c=>c.op==='rect').length} out-of-bounds=${bad.length} tiny-font(<4.5pt)=${tiny}`);
  if(bad.length) bad.slice(0,6).forEach(b=>console.log('      !!! '+b));
  return bad.length===0;
}

const order={orderSn:'260927A1B2C3',date:'27/09/2026 09:14',shopeeStatus:'READY_TO_SHIP',internalStatus:'[1] Siap Packing',buyer:'Rina Kartika Wijaya Kusuma',items:'Kaos Polos Premium Cotton Combed 30s Warna Hitam',sku:'BG-KS-001-LONG-SKU-CODE',variation:'Hitam, L',qty:2,totalAmount:175000,shippingFee:12000,courier:'SPX Express',resi:'SPXID0091827364',city:'Bandung',note:'Tolong bubble wrap tambahan dan jangan dilipat' };
const noResi=Object.assign({},order,{orderSn:'260927ZZZZZZ',resi:'-',note:'',sku:'-',variation:'-'});

console.log('\n=== BOUNDS AUDIT ===');
let allOk=true;

const d1=A.buildSlipPdf(FakeDoc,{kepala:order,barang:[order]});
allOk=A.audit1=audit('slip 1 barang',d1)&&allOk;

const banyak=Array.from({length:30},(_,i)=>Object.assign({},order,{orderSn:'SN'+i,items:'Produk nomor '+i}));
const d2=A.buildSlipPdf(FakeDoc,{kepala:order,barang:banyak});
allOk=audit('slip 30 barang (pagination)',d2)&&allOk;

const d3=A.buildSlipPdf(FakeDoc,{kepala:noResi,barang:[]});
allOk=audit('slip 0 barang + tanpa resi',d3)&&allOk;

const d4=A.buildBatchSlipPdf(FakeDoc,Array.from({length:5},(_,i)=>({kepala:Object.assign({},order,{orderSn:'B'+i}),barang:[order,order]})));
allOk=audit('batch 5 slip (2 lembar A4)',d4)&&allOk;

const d5=A.buildLabelPdf(FakeDoc,Array.from({length:3},(_,i)=>({kepala:Object.assign({},order,{orderSn:'L'+i}),barang:[order]})));
allOk=audit('label 3 paket',d5)&&allOk;

const spkInfo = {
  nama: 'ADUL',
  sesi: 'PAGI',
  tanggal: '2026-09-28',
  estimasiJahit: '2 jam 28 menit',
  estimasiPotong: '1 jam 56 menit (2 Personil Cutting)',
  kodeTokoMap: { 'begood.bdg': 'BG', 'toko tidur manis': 'TM' },
  items: [
    { sku: 'Balmut 120x150', toko: 'toko tidur manis', variasi: 'Light Gray.', jumlah: 1 },
    { sku: 'BC AJA 120x220', toko: 'begood.bdg', variasi: 'Light Blue', jumlah: 1 },
    { sku: 'BC AJA 140x220', toko: 'toko tidur manis', variasi: 'Pink', jumlah: 1 },
    { sku: 'BC AJA 160x220', toko: 'begood.bdg', variasi: 'Blue Sky', jumlah: 1 },
    { sku: 'BC AJA 200X220', toko: 'toko tidur manis', variasi: 'Blue Sky', jumlah: 1 },
    { sku: 'BC AJA 90x220', toko: 'begood.bdg', variasi: 'Lilac', jumlah: 1 },
    { sku: 'SPREI DK 180/30 SET', toko: 'toko tidur manis', variasi: 'Lilac', jumlah: 1 },
    { sku: 'SPREI DK 180/30 SET', toko: 'begood.bdg', variasi: 'Turkish', jumlah: 1 },
    { sku: 'SPREI 120/30 SET', toko: 'toko tidur manis', variasi: 'Wardah', jumlah: 1 },
    { sku: 'SARKUR 100/25', toko: 'begood.bdg', variasi: 'Light Grey', jumlah: 1 },
    { sku: 'SARKUR 120/20', toko: 'toko tidur manis', variasi: 'Black', jumlah: 1 },
    { sku: 'SARKUR 70/10', toko: 'begood.bdg', variasi: 'Light Gray', jumlah: 2 },
    { sku: 'SARKUR 90/10', toko: 'toko tidur manis', variasi: 'Latte', jumlah: 2 },
    { sku: 'SARKUR 90/25', toko: 'begood.bdg', variasi: 'Latte', jumlah: 1 }
  ]
};
const dSpk = A.buildSpkPenjahitPdf(FakeDoc, spkInfo);
allOk = audit('SPK Penjahit 14 item (2 halaman A6)', dSpk) && allOk;

const kanbanBatch = [
  {
    nama: 'ADUL', sesi: 'PAGI', tanggal: '2026-10-09',
    kodeTokoMap: { 'begood.bdg': 'BG' },
    items: [
      { noPesanan: '261009AA11BB22', toko: 'begood.bdg', sku: 'Sarung Bantal', variasi: 'Soft Denim', jumlah: 1 },
      { noPesanan: '261009CC33DD44', sku: 'Sarung Bantal', variasi: 'Dusty Pink', jumlah: 1 }
    ]
  },
  {
    nama: 'ELSI', sesi: 'PAGI', tanggal: '2026-10-09',
    items: [
      { noPesanan: '261009EE55FF66', kodeToko: 'SN', sku: 'SPREI DK 90/20 SET', variasi: 'Lilac', jumlah: 1 },
      { noPesanan: '261009GG77HH88', sku: 'SPREI DK 90/15 SET', variasi: 'Brown Cream', jumlah: 1 },
      { noPesanan: '261009II99JJ00', sku: 'SARKUR 120/15', variasi: 'Softdenim', jumlah: 1 },
      { noPesanan: '261009KK11LL22', sku: 'SARBAN SAMBUNG', variasi: 'Black', jumlah: 1 }
    ]
  }
];
const dKanban = A.buildBatchStickerKanbanPdf(FakeDoc, kanbanBatch);
allOk = audit('Sticker Kanban 6 tiket (1 halaman grid 2x3)', dKanban) && allOk;

const dKanbanMulti = A.buildStickerKanbanPdf(FakeDoc, spkInfo);
allOk = audit('Sticker Kanban 16 pcs (3 halaman grid 2x3)', dKanbanMulti) && allOk;

const tiketEkspansi = A.expandKanbanTickets_([
  { tanggal: '2026-10-09', penjahit: 'BUDI', sesi: 'PAGI', noPesanan: 'ORD-001', sku: 'KEMEJA FLANEL', variasi: 'Navy Blue', jumlah: 1 },
  { tanggal: '2026-10-09', penjahit: 'BUDI', sesi: 'PAGI', daftarPesanan: ['ORD-002A', 'ORD-002B', 'ORD-002C'], sku: 'SPREI DK 180/30 SET', variasi: 'Lilac', jumlah: 3 }
]);
const kotakPertama = dKanban.calls.find(c => c.op === 'rect');
const docUjiFit = new FakeDoc({ format: [105, 148] });
docUjiFit.setFontSize(10.2);
const hasilFitPanjang = A.fitLines(docUjiFit, '1 PCS | PRODUK DENGAN NAMA SKU YANG SANGAT PANJANG SEKALI MELEBIHI DUA BARIS PENUH', 43.5, 2);

const callHeader2 = dKanban.calls.find(c => c.op === 'text' && c.t === 'ADUL  |  PAGI');
const callNoPesanan = dKanban.calls.find(c => c.op === 'text' && c.t === '261009AA11BB22 | BG');
const callBody1 = dKanban.calls.find(c => c.op === 'text' && c.t === '1 PCS | Sarung Bantal');
const posisiNoPesananDiAntaraHeaderBody = Boolean(callHeader2 && callNoPesanan && callBody1 && callHeader2.y < callNoPesanan.y && callNoPesanan.y < callBody1.y);

console.log('\n=== KONTEN ===');
console.log('  SPK: judul Lembar Kerja Jahit ->', dSpk.calls.some(c => c.op === 'text' && c.t === 'Lembar Kerja Jahit'));
console.log('  SPK: tanggal Indonesia format ->', dSpk.calls.some(c => c.op === 'text' && c.t.indexOf('Senin, 28 September 2026') !== -1));
console.log('  SPK: kode toko BG tercetak    ->', dSpk.calls.some(c => c.op === 'text' && c.t === 'BG'));
console.log('  SPK: kode toko TM tercetak    ->', dSpk.calls.some(c => c.op === 'text' && c.t === 'TM'));
console.log('  SPK: slogan tercetak          ->', dSpk.calls.some(c => c.op === 'text' && c.t.indexOf('Semangat!') !== -1));
console.log('  SPK: 2 halaman A6             ->', dSpk.pages === 2);
console.log('  Kanban: 6 tiket = 1 halaman   ->', dKanban.pages === 1 && dKanban.calls.filter(c => c.op === 'rect').length === 6);
console.log('  Kanban: kotak 47.5 x 45.33 mm ->', kotakPertama && kotakPertama.w === 47.5 && Math.abs(kotakPertama.h - 45.3333) < 0.01);
console.log('  Kanban: font 9/10.2/9.2/8.2   ->', [9, 10.2, 9.2, 8.2].every(sz => dKanban.calls.some(c => c.op === 'text' && c.size === sz)));
console.log('  Kanban: fitLines max 2 + ...  ->', hasilFitPanjang.length === 2 && hasilFitPanjang[1].endsWith('...'));
console.log('  Kanban: kodePotong null & #1  ->', tiketEkspansi.length === 4 && tiketEkspansi[0].kodePotong === null && tiketEkspansi[1].kodePotong === '#1' && tiketEkspansi[3].kodePotong === '#3');
console.log('  Kanban: noPesanan per-unit    ->', tiketEkspansi[0].noPesanan === 'ORD-001' && tiketEkspansi[1].noPesanan === 'ORD-002A' && tiketEkspansi[2].noPesanan === 'ORD-002B' && tiketEkspansi[3].noPesanan === 'ORD-002C');
console.log('  Kanban: noPesanan header-body ->', posisiNoPesananDiAntaraHeaderBody);
console.log('  Kanban: noPesanan + toko BG   ->', dKanban.calls.some(c => c.op === 'text' && c.t === '261009AA11BB22 | BG'));
console.log('  Kanban: noPesanan + toko SN   ->', dKanban.calls.some(c => c.op === 'text' && c.t === '261009EE55FF66 | SN'));
console.log('  Kanban: fallback tanpa toko   ->', dKanban.calls.some(c => c.op === 'text' && c.t === '261009CC33DD44'));
console.log('  Kanban: tanggal Jumat, 9 Okt  ->', dKanban.calls.some(c => c.op === 'text' && c.t === 'Jumat, 9 Oktober'));
console.log('  Kanban: ADUL | PAGI & ELSI    ->', dKanban.calls.some(c => c.op === 'text' && c.t.indexOf('ADUL  |  PAGI') !== -1) && dKanban.calls.some(c => c.op === 'text' && c.t.indexOf('ELSI  |  PAGI') !== -1));
console.log('  Kanban: 1 Bantal + 1 Guling   ->', dKanban.calls.filter(c => c.op === 'text' && c.t === '1 Bantal + 1 Guling + 2 Tali').length === 2);
console.log('  Kanban: 180/30 -> 2 Bantal    ->', A.deteksiKelengkapanSpreiSet_('SPREI DK 180/30 SET') === '2 Bantal + 2 Guling + 2 Tali');
if (dKanban.pages !== 1 || dKanban.calls.filter(c => c.op === 'rect').length !== 6) allOk = false;
if (!kotakPertama || kotakPertama.w !== 47.5 || Math.abs(kotakPertama.h - 45.3333) >= 0.01) allOk = false;
if (![9, 10.2, 9.2, 8.2].every(sz => dKanban.calls.some(c => c.op === 'text' && c.size === sz))) allOk = false;
if (hasilFitPanjang.length !== 2 || !hasilFitPanjang[1].endsWith('...')) allOk = false;
if (tiketEkspansi.length !== 4 || tiketEkspansi[0].kodePotong !== null || tiketEkspansi[1].kodePotong !== '#1' || tiketEkspansi[3].kodePotong !== '#3') allOk = false;
if (tiketEkspansi[0].noPesanan !== 'ORD-001' || tiketEkspansi[1].noPesanan !== 'ORD-002A' || tiketEkspansi[2].noPesanan !== 'ORD-002B' || tiketEkspansi[3].noPesanan !== 'ORD-002C') allOk = false;
if (!posisiNoPesananDiAntaraHeaderBody) allOk = false;
if (!dKanban.calls.some(c => c.op === 'text' && c.t === '261009AA11BB22 | BG')) allOk = false;
if (!dKanban.calls.some(c => c.op === 'text' && c.t === '261009EE55FF66 | SN')) allOk = false;
if (!dKanban.calls.some(c => c.op === 'text' && c.t === '261009CC33DD44')) allOk = false;
if (!posisiNoPesananDiAntaraHeaderBody) allOk = false;
if (!dKanban.calls.some(c => c.op === 'text' && c.t === 'Jumat, 9 Oktober')) allOk = false;
if (dKanban.calls.filter(c => c.op === 'text' && c.t === '1 Bantal + 1 Guling + 2 Tali').length !== 2) allOk = false;
if (A.deteksiKelengkapanSpreiSet_('SPREI DK 180/30 SET') !== '2 Bantal + 2 Guling + 2 Tali') allOk = false;

const dSpkTanpaPeta = A.buildSpkPenjahitPdf(FakeDoc, {
  nama: 'ADUL', sesi: 'SIANG', tanggal: '2026-09-28',
  items: [
    { sku: 'BC AJA 200x220', toko: 'BEGOOD.BDG', variasi: 'Navy', jumlah: 1 },
    { sku: 'SPREI 100/25 SET', toko: 'Toko Tidur Manis', variasi: 'Coffee', jumlah: 1 }
  ]
});
console.log('  SPK: fallback kode toko BG    ->', dSpkTanpaPeta.calls.some(c => c.op === 'text' && c.t === 'BG'));
console.log('  SPK: fallback kode toko TM    ->', dSpkTanpaPeta.calls.some(c => c.op === 'text' && c.t === 'TM'));

// Uji Kanban Ticket dengan Petugas Packing (Format 3 Baris)
const dKanbanPacking = new FakeDoc({ orientation: 'portrait', unit: 'mm', format: [105, 148] });
A.drawCuttingKanbanTicket(dKanbanPacking, {
  tanggal: '2026-10-10',
  tanggalLabel: 'Sabtu, 10 Oktober',
  penjahit: 'ADUL',
  petugasPacking: 'KELVIN',
  sesi: 'PAGI',
  noPesanan: '2610097H9MF0KB',
  kodeToko: 'SN',
  sku: 'SPREI DK 180/30 SET',
  variasi: 'Mocca',
  qty: 1
}, 2.5, 2.5, 47.5, 45.3333);
const kanbanB1Ok = dKanbanPacking.calls.some(c => c.op === 'text' && c.t === 'PAGI | Sabtu, 10 Oktober');
const kanbanB2Ok = dKanbanPacking.calls.some(c => c.op === 'text' && c.t === 'ADUL | KELVIN');
const kanbanB3Ok = dKanbanPacking.calls.some(c => c.op === 'text' && c.t === '2610097H9MF0KB | SN');
console.log('  Kanban: Baris 1 PAGI | Sabtu, 10 Oktober ->', kanbanB1Ok);
console.log('  Kanban: Baris 2 ADUL | KELVIN            ->', kanbanB2Ok);
console.log('  Kanban: Baris 3 2610097H9MF0KB | SN      ->', kanbanB3Ok);
if (!kanbanB1Ok || !kanbanB2Ok || !kanbanB3Ok) allOk = false;

// Uji Lembar Kerja Packing PDF A4
const dLembarPacking = A.buildLembarKerjaPackingPdf(FakeDoc, {
  petugas: 'KELVIN',
  sesi: 'PAGI',
  tanggal: '2026-10-10',
  totalResi: 2,
  totalPcs: 3,
  rows: [
    { no: 1, noPesanan: '2610097H9MF0KB', toko: 'BG', skuVariasi: 'SPREI DK 180/30 SET - Mocca', qty: 1, penjahit: 'ADUL' },
    { no: 2, noPesanan: '2610097H9MF0KC', toko: 'SN', skuVariasi: 'BEDCOVER 180 - Navy', qty: 2, penjahit: 'OPIK' }
  ]
});
const packingJudulOk = dLembarPacking.calls.some(c => c.op === 'text' && c.t.indexOf('LEMBAR KERJA PACKING - KELVIN') !== -1);
const packingResiOk = dLembarPacking.calls.some(c => c.op === 'text' && c.t === '2610097H9MF0KB');
const packingPenjahitOk = dLembarPacking.calls.some(c => c.op === 'text' && c.t === 'ADUL') && dLembarPacking.calls.some(c => c.op === 'text' && c.t === 'OPIK');
const packingCekOk = dLembarPacking.calls.filter(c => c.op === 'rect').length >= 4;
console.log('  Packing: judul Lembar Kerja Packing      ->', packingJudulOk);
console.log('  Packing: kolom No Pesanan, Toko, Qty     ->', packingResiOk);
console.log('  Packing: kolom Penjahit ADUL & OPIK      ->', packingPenjahitOk);
console.log('  Packing: kotak checklist Cek             ->', packingCekOk);
if (!packingJudulOk || !packingResiOk || !packingPenjahitOk || !packingCekOk) allOk = false;

const dummyRekap = {
  total: { upah: 100000, waktuJahit: 60, waktuPotong: 30 },
  perPenjahit: [
    { nama: 'ADUL', grup: 'BC', upah: 50000, waktuJahit: 30, waktuPotong: 15, items: [
      { sku: 'BC AJA 200x220', variasi: 'Navy', qty: 1, toko: 'begood.bdg' },
      { sku: 'SPREI 100/25', variasi: 'Coffee', qty: 1, toko: 'toko tidur manis' }
    ]},
    { nama: 'BELUM DISET', grup: 'BELUM DISET', upah: 0, waktuJahit: 0, waktuPotong: 0, items: [
      { sku: 'SKU TANPA ATURAN', variasi: 'Putih', qty: 2, toko: 'begood.bdg' }
    ]}
  ]
};
const kartuData = A.kumpulkanDataKartu_({ rekap: dummyRekap, setelan: { penjahit: [{ nama: 'BELUM DISET', aktif: 'YA' }] } });
const adulKartu = (kartuData.penjahit || []).find(p => p.nama === 'ADUL');
const belumDisetKartu = (kartuData.penjahit || []).find(p => p.nama === 'BELUM DISET');
const shiftSekarang = (new Date().getHours() < 13) ? 'PAGI' : 'SIANG';
const adulItems = (adulKartu && adulKartu.sesi && adulKartu.sesi[shiftSekarang] && adulKartu.sesi[shiftSekarang].items) || [];
console.log('  kartu: toko dipertahankan     ->', adulItems.length === 2 && adulItems[0].toko === 'begood.bdg' && adulItems[1].toko === 'toko tidur manis');
console.log('  kartu: BELUM DISET disaring   ->', belumDisetKartu === undefined);
if (adulItems.length !== 2 || adulItems[0].toko !== 'begood.bdg' || adulItems[1].toko !== 'toko tidur manis') allOk = false;
if (belumDisetKartu !== undefined) allOk = false;

/* Uji Regresi Bug #1, #2, #7, #8:
   - Bug #1: >1 variasi pada SKU sama tidak terduplikasi 2x di sinkronkanPayloadKartuSpk_ & PDF
   - Bug #2: waktuJahit & waktuPotong pada baris Qty > 1 dikalikan jumlah pcs (termasuk di Sesi SIANG setelah PAGI tutup)
   - Bug #7: kelengkapan dari DATA PROSES diteruskan ke kartu & tiket Kanban PDF
   - Bug #8: daftarPesanan dari beberapa pesanan pada SKU+variasi sama dipertahankan per tiket Kanban */
const payloadMultiVarDanSiang = {
  setelan: { penjahit: [{ nama: 'ADUL', grup: 'BC', aktif: 'YA' }] },
  estimasiHariIni: {
    tanggal: '2026-10-09',
    total: { upah: 90000, waktuJahit: 40, waktuPotong: 16 },
    sesi: {
      PAGI: { upah: 90000, waktuJahit: 40, waktuPotong: 16 },
      SIANG: { upah: 0, waktuJahit: 0, waktuPotong: 0 }
    },
    kunciSesi: {
      'ord-p1|sprei 180|hitam|adul': 'PAGI',
      'ord-p2|sprei 180|putih|adul': 'PAGI'
    },
    penjahit: [{
      nama: 'ADUL', grup: 'BC', upah: 90000, waktuJahit: 40,
      sesi: {
        PAGI: { upah: 90000, waktuJahit: 40, waktuPotong: 16 },
        SIANG: { upah: 0, waktuJahit: 0, waktuPotong: 0 }
      },
      items: [
        { sesi: 'PAGI', sku: 'SPREI 180', variasi: 'Hitam', toko: 'BGD', noPesanan: 'ORD-P1', daftarPesanan: ['ORD-P1'], jumlah: 1, waktuJahit: 20, waktuPotong: 8, upah: 45000, hargaSatuan: 45000 },
        { sesi: 'PAGI', sku: 'SPREI 180', variasi: 'Putih', toko: 'BGD', noPesanan: 'ORD-P2', daftarPesanan: ['ORD-P2'], jumlah: 1, waktuJahit: 20, waktuPotong: 8, upah: 45000, hargaSatuan: 45000 }
      ]
    }]
  },
  rekap: {
    unit: [
      { noPesanan: 'ORD-P1', sku: 'SPREI 180', variasi: 'Hitam', penjahit: 'ADUL', qty: 1, waktuJahit: 20, waktuPotong: 8, harga: 45000, hargaTotal: 45000, toko: 'BGD' },
      { noPesanan: 'ORD-P2', sku: 'SPREI 180', variasi: 'Putih', penjahit: 'ADUL', qty: 1, waktuJahit: 20, waktuPotong: 8, harga: 45000, hargaTotal: 45000, toko: 'BGD' },
      { noPesanan: 'ORD-S1', sku: 'BEDCOVER 200', variasi: 'Navy', penjahit: 'ADUL', qty: 3, waktuJahit: 15, waktuPotong: 6, harga: 50000, hargaTotal: 150000, toko: 'BGD', kelengkapan: '1 Bedcover + 1 Tas Eksklusif' },
      { noPesanan: 'ORD-S2', sku: 'BEDCOVER 200', variasi: 'Navy', penjahit: 'ADUL', qty: 1, waktuJahit: 15, waktuPotong: 6, harga: 50000, hargaTotal: 50000, toko: 'BGD', kelengkapan: '1 Bedcover + 1 Tas Eksklusif' }
    ],
    perPenjahit: [{
      nama: 'ADUL', grup: 'BC', upah: 290000, waktuJahit: 100, waktuPotong: 40,
      items: []
    }]
  }
};
const hasilSinkron = A.kumpulkanDataKartu_(payloadMultiVarDanSiang, 'SIANG');
const adulSinkron = (hasilSinkron.penjahit || []).find(p => p.nama === 'ADUL');
const pagiSinkron = adulSinkron.sesi.PAGI;
const siangSinkron = adulSinkron.sesi.SIANG;
const totalPcsPagi = pagiSinkron.items.reduce((s, it) => s + Number(it.jumlah || 0), 0);
const itemSiangGabung = siangSinkron.items[0];
const tiketKanbanSiang = A.buildKanbanTicketsFromRows_([{
  nama: 'ADUL', penjahit: 'ADUL', sesi: 'SIANG', tanggal: '2026-10-09', items: siangSinkron.items
}]);
console.log('  regresi #1: >1 variasi SKU sama tidak duplikat (PAGI=2 pcs) ->', pagiSinkron.items.length === 2 && totalPcsPagi === 2);
console.log('  regresi #2: waktuJahit/Potong Qty>1 dikali qty (SIANG=60/24)->', siangSinkron.waktuJahit === 60 && siangSinkron.waktuPotong === 24 && itemSiangGabung.waktuJahit === 60);
console.log('  regresi #7: kelengkapan DATA PROSES tercetak di tiket Kanban->', tiketKanbanSiang.length === 4 && tiketKanbanSiang.every(t => t.kelengkapan === '1 Bedcover + 1 Tas Eksklusif'));
console.log('  regresi #8: daftarPesanan gabungan utuh per tiket Kanban    ->', tiketKanbanSiang.slice(0, 3).every(t => t.noPesanan === 'ORD-S1') && tiketKanbanSiang[3].noPesanan === 'ORD-S2');
if (pagiSinkron.items.length !== 2 || totalPcsPagi !== 2) allOk = false;
if (siangSinkron.waktuJahit !== 60 || siangSinkron.waktuPotong !== 24 || itemSiangGabung.waktuJahit !== 60) allOk = false;
if (tiketKanbanSiang.length !== 4 || !tiketKanbanSiang.every(t => t.kelengkapan === '1 Bedcover + 1 Tas Eksklusif')) allOk = false;
if (!tiketKanbanSiang.slice(0, 3).every(t => t.noPesanan === 'ORD-S1') || tiketKanbanSiang[3].noPesanan !== 'ORD-S2') allOk = false;

if (!dSpkTanpaPeta.calls.some(c => c.op === 'text' && c.t === 'BG') || !dSpkTanpaPeta.calls.some(c => c.op === 'text' && c.t === 'TM')) allOk = false;
console.log('  slip: halaman di kaki  ->', d2.calls.filter(c=>c.op==='text'&&c.t.startsWith('Halaman')).map(c=>c.t).join(' | '));
console.log('  slip: resi kosong      ->', d3.calls.some(c=>c.op==='text'&&c.t==='BELUM TERSEDIA'));
console.log('  slip: catatan tercetak ->', d1.calls.some(c=>c.op==='text'&&c.t.indexOf('Catatan pembeli')===0));
console.log('  slip: courier dipakai  ->', [...new Set(d1.calls.filter(c=>c.op==='text').map(c=>c.font))].join(','));
console.log('  slip: SKU pakai cour.  ->', d1.calls.some(c=>c.op==='text'&&c.t==='BG-KS-001-LONG-SKU-CODE'&&c.font==='courier'));
console.log('  slip: orderSn cour.    ->', d1.calls.some(c=>c.op==='text'&&c.t==='260927A1B2C3'&&c.font==='courier'));
console.log('  batch: 5 slip 4/lembar ->', d4.pages===2);
console.log('  label: resi besar      ->', Math.max(...d5.calls.filter(c=>c.op==='text'&&c.t==='SPXID0091827364').map(c=>c.size)));

console.log('\n=== EXPORTER TABEL ===');
const rows=[['No. Pesanan','Tanggal','Pembeli','Ekspedisi','No. Resi','Status Begood','Qty','Total']];
for(let i=0;i<120;i++) rows.push(['260927SN'+i,'27/09/2026 09:14','Pembeli Dengan Nama Yang Panjang '+i,'SPX Express','SPXID009182736'+i,'[1] Siap Packing',2,'Rp 175.000']);
let captured=null;
/* exportTable memakai withLib_ -> window.jspdf sudah ada, jadi jalan sinkron */
const origSave=FakeDoc.prototype.save;
FakeDoc.prototype.save=function(n){ captured={doc:this,name:n}; };
A.pdfKit.exportTable({filename:'Rekap_Uji',title:'Rekap Pesanan Masuk',subtitle:'Toko b e g o o d . b d g',rows});
FakeDoc.prototype.save=origSave;
console.log('  nama berkas            ->', captured && captured.name);
allOk=audit('rekap 120 baris',captured.doc)&&allOk;
console.log('  judul kolom diulang    ->', captured.doc.calls.filter(c=>c.op==='text'&&c.t==='No. Pesanan').length,'kali (harus = jumlah halaman)');

/* kosong */
let empty=null;
FakeDoc.prototype.save=function(n){ empty={doc:this,name:n}; };
A.pdfKit.exportTable({filename:'Kosong',title:'Kosong',rows:[['A','B']]});
FakeDoc.prototype.save=origSave;
allOk=audit('rekap 0 baris',empty.doc)&&allOk;
console.log('  pesan kosong           ->', empty.doc.calls.some(c=>c.op==='text'&&c.t==='Tidak ada data.'));


console.log('\n=== STRESS: TEKS MEMBUNGKUS ===');
const panjang = Array.from({length:30},(_,i)=>Object.assign({},order,{
  orderSn:'LONGSKU-'+i, items:'Kaos Polos Premium Cotton Combed 30s Warna Hitam Ukuran Besar Sekali '+i,
  sku:'BG-KS-001-SANGAT-PANJANG-SEKALI-'+i, variation:'Hitam Pekat, Ukuran L, Bonus'}));
allOk=audit('slip 30 barang panjang (wrap)',A.buildSlipPdf(FakeDoc,{kepala:order,barang:panjang}))&&allOk;
const docW=A.buildSlipPdf(FakeDoc,{kepala:order,barang:panjang});
console.log('  halaman               ->',docW.pages,'(menyesuaikan tinggi baris wrap)');
console.log('  footer                ->',docW.calls.filter(c=>c.op==='text'&&c.t.indexOf('Halaman')===0).map(c=>c.t).join(' | '));
const ekstrem=[['Kolom Satu','Kolom Dua']];
ekstrem.push(['x'.repeat(400),'y'.repeat(400)]);
let cap=null;
FakeDoc.prototype.save=function(n){cap={doc:this,name:n};};
A.pdfKit.exportTable({filename:'Ekstrem',title:'Uji Batas',rows:ekstrem});
FakeDoc.prototype.save=origSave;
allOk=audit('rekap 1 baris teks 400 karakter',cap.doc)&&allOk;
console.log('  tinggi baris dibatasi ->',cap.doc.calls.filter(c=>c.op==='rect').every(r=>r.h<=15));

console.log('');
console.log('HASIL TATA LETAK PDF: ' + (allOk ? 'SEMUA LULUS' : 'ADA YANG MELESET'));
process.exit(allOk ? 0 : 1);
