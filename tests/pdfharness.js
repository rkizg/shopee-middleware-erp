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
const EXPORT='globalThis.__api={loadDashboard,groupOrdersBySn,buildSlipPdf,buildBatchSlipPdf,buildLabelPdf,exportTable:null,pdfKit,rekapPesananRows,rekapRowsFrom,exportSlipPdf,cetakSlipPdfTerpilih,exportRekapPesananPdf,cetakLabelPdfTerpilih,setData:d=>{globalData=d;},setFiltered:f=>{currentFilteredOrders=f;},setSel:s=>{selectedOrderSns=s;},toggles:()=>0};';
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

console.log('\n=== KONTEN ===');
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
