/* Akar proyek dihitung dari lokasi berkas ini, bukan ditulis tetap, supaya uji
   dapat dijalankan dari direktori mana pun. */
const AKAR = require('node:path').join(__dirname, '..') + '/';

const fs=require('fs'), vm=require('vm');
class MockSheet{
  constructor(n){this.name=n;this.data=[];}
  getLastRow(){let l=0;for(let r=0;r<this.data.length;r++){if((this.data[r]||[]).some(v=>v!==''&&v!=null))l=r+1;}return l;}
  getLastColumn(){let lc=0;this.data.forEach(row=>{for(let c=(row||[]).length;c>0;c--){const v=row[c-1];if(v!==''&&v!=null){if(c>lc)lc=c;break;}}});return lc;}
  _ensure(r,c){while(this.data.length<r)this.data.push([]);for(let i=0;i<r;i++){if(!this.data[i])this.data[i]=[];while(this.data[i].length<c)this.data[i].push('');}}
  getRange(r,c,nr,nc){
    if(typeof r==='string'){const a={getValues:()=>[[ '']],setValues(){return a;},setValue(){return a;},setNumberFormat(){return a;},setBackground(){return a;},setFontColor(){return a;},setFontWeight(){return a;},setFontSize(){return a;},setHorizontalAlignment(){return a;},setDataValidation(){return a;}};return a;}
    const s=this;const a={
      getValues(){s._ensure(r+nr-1,c+nc-1);const o=[];for(let i=0;i<nr;i++){const w=[];for(let j=0;j<nc;j++)w.push(s.data[r-1+i][c-1+j]);o.push(w);}return o;},
      setValues(v){for(let i=0;i<v.length;i++){s._ensure(r+i,c+v[i].length-1);for(let j=0;j<v[i].length;j++)s.data[r-1+i][c-1+j]=v[i][j];}return a;},
      setValue(v){return a.setValues([[v]]);},
      setNumberFormat(){return a;},setBackground(){return a;},setFontColor(){return a;},setFontWeight(){return a;},setFontSize(){return a;},setHorizontalAlignment(){return a;},setDataValidation(){return a;}};
    return a;}
  getDataRange(){return this.getRange(1,1,Math.max(this.data.length,1),Math.max(this.getLastColumn(),1));}
  appendRow(v){this.data.push(v.slice());}
  insertRowBefore(p){this.data.splice(p-1,0,[]);}
  insertColumnsAfter(a,how){this._ensure(Math.max(this.data.length,1),a+how);for(let i=0;i<this.data.length;i++){const row=this.data[i];for(let k=0;k<how;k++)row.splice(a,0,'');}}
  setFrozenRows(){} autoResizeColumns(){}
}
class MockSS{constructor(){this.sheets={};}getSheetByName(n){return this.sheets[n]||null;}insertSheet(n){this.sheets[n]=new MockSheet(n);return this.sheets[n];}toast(){}}
const ss=new MockSS();
const alerts=[];
const fakeUi={ButtonSet:{OK:'OK',OK_CANCEL:'OK_CANCEL'},Button:{OK:'OK'},alert(t,m){alerts.push({title:t,body:String(m)});},prompt(){throw new Error('x');}};
let dataPerToko={'111':[],'222':[]};
const ShopeeApi={fetchDailyOrders(p){return {data:{orders:(dataPerToko[p.shop_id]||[]).slice(),diagnostics:{}}};}};
const sb={console,SpreadsheetApp:{getActiveSpreadsheet:()=>ss,getUi:()=>fakeUi,newDataValidation:()=>({requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return{};}})},
  Utilities:{formatDate:()=>'2026-09-27 08:00:00',sleep(){}},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})},
  CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},ShopeeApi:ShopeeApi};
sb.globalThis=sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(AKAR + 'gas/SheetManager.js','utf8'),sb,{filename:'SheetManager.js'});
vm.runInContext(fs.readFileSync(AKAR + 'gas/Code.js','utf8'),sb,{filename:'Code.js'});
const SM=sb.SheetManager;
let gagal=0;
const cek=(l,ok,x)=>{console.log((ok?'  OK   ':'  GAGAL ')+l+(x!==undefined?'  -> '+x:''));if(!ok)gagal++;};
const tok=()=>ss.getSheetByName('DB_Token');
const ord=()=>ss.getSheetByName('Pesanan Masuk');
function pesan(sn){return {order_sn:sn,create_time_formatted:'2026-09-27 08:00:00',order_status:'READY_TO_SHIP',internal_status:'[1] Siap Packing',buyer_username:'budi',items:[{item_name:'X',model_sku:'S1',model_name:'A',model_quantity_purchased:1}],total_amount:1000,actual_shipping_fee:0,shipping_carrier:'JNE',tracking_number:'R'+sn,note:'',recipient_city:'Bandung'};}

SM.initAllSheets();
SM.saveTokenRecord({shop_id:'172040285',partner_id:'99',access_token:'A1',refresh_token:'R1',expired_at:4000000000});
SM.saveTokenRecord({shop_id:'1564950615',partner_id:'99',access_token:'A2',refresh_token:'R2',expired_at:4000000000});

console.log('=== 1: repRODUKSI laporan Anda (kolom J kosong) ===');
let d=SM.diagnosaToken();
cek('header terbaca lengkap 12 kolom', d.headerAktual.length===12, d.headerAktual.length);
cek('kolom Kode Toko terdeteksi di kolom ke-10 (J)', d.posisiKodeToko===9, d.posisiKodeToko);
cek('kolom J memang kosong di sheet', d.isiKolomJ.join(',')===',', JSON.stringify(d.isiKolomJ));
cek('karena itu kode_toko terbaca kosong', d.rekaman.every(r=>r.kode_toko===''), JSON.stringify(d.rekaman.map(r=>r.kode_toko)));
console.log('    rekaman:', JSON.stringify(d.rekaman));
alerts.length=0;
dataPerToko={'172040285':[pesan('P1')],'1564950615':[]};
sb.syncOrdersCore(3,false);
console.log('    ringkasan dialog:');
console.log(alerts[0].body.split('\n').map(x=>x?'      '+x:x).join('\n'));
cek('label memakai shop_id, bukan kode toko', alerts[0].body.includes('172040285')&&alerts[0].body.includes('1564950615'));
cek('dialog memperingatkan kolom J belum diisi', alerts[0].body.includes('belum diisi Kode Toko')&&alerts[0].body.includes('Periksa Isi DB_Token'), alerts[0].body.slice(-190));
const bP1=ord().data.find(x=>String(x[0]).trim()==='P1');
cek('kolom Q tidak terisi, persis seperti laporan Anda', String(bP1[16])==='', JSON.stringify(bP1[16]));

console.log('\n=== 2: setelah kolom J diisi, semuanya jalan ===');
tok().getRange(2,10,1,1).setValues([['BGD1']]);
tok().getRange(3,10,1,1).setValues([['BGD2']]);
tok().getRange(2,9,1,1).setValues([['Begood Satu']]);
tok().getRange(3,9,1,1).setValues([['Begood Dua']]);
d=SM.diagnosaToken();
cek('kode_toko terbaca dari kolom J', d.rekaman.map(r=>r.kode_toko).sort().join(',')==='BGD1,BGD2', JSON.stringify(d.rekaman.map(r=>r.kode_toko)));
cek('nama_toko terbaca dari kolom I', d.rekaman.map(r=>r.nama_toko).sort().join(',')==='Begood Dua,Begood Satu');
alerts.length=0;
dataPerToko={'172040285':[pesan('P2'),pesan('P1')],'1564950615':[pesan('P3')]};
sb.syncOrdersCore(3,false);
cek('label memakai kode toko', alerts[0].body.includes('BGD1')&&alerts[0].body.includes('BGD2'), alerts[0].body.split('\n').filter(x=>x.includes(':')).join(' / '));
cek('dialog bersih setelah kolom J diisi', !alerts[0].body.includes('belum diisi Kode Toko'));
cek('kolom Q terisi kode toko', ord().data.find(x=>String(x[0]).trim()==='P2')[16]==='BGD1');
cek('toko kedua juga terisi', ord().data.find(x=>String(x[0]).trim()==='P3')[16]==='BGD2');
cek('baris lama P1 diadopsi saat pesanannya ditarik ulang', ord().data.find(x=>String(x[0]).trim()==='P1')[16]==='BGD1', JSON.stringify(ord().data.find(x=>String(x[0]).trim()==='P1')[16]));

console.log('\n=== 3: header yang rusak terdeteksi ===');
tok().data[0]=['Shop ID','Partner ID','Access Token','Refresh Token','Expired At (Unix)','Expired At (WIB)','Terakhir Diperbarui (WIB)','Status Token'];
d=SM.diagnosaToken();
cek('empat header terakhir kosong, penanda header rusak', d.headerAktual.slice(8).every(x=>x===''), JSON.stringify(d.headerAktual));
cek('kolom Kode Toko dilaporkan TIDAK DITEMUKAN', d.posisiKodeToko===-1, d.posisiKodeToko);
cek('tetapi isi kolom J tetap terbaca mentah', d.isiKolomJ.join(',')==='BGD1,BGD2', JSON.stringify(d.isiKolomJ));

console.log('\nHASIL DIAGNOSA: '+(gagal===0?'SEMUA LULUS':gagal+' KEGAGALAN'));
process.exit(gagal===0?0:1);
