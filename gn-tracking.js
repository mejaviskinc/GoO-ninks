(()=>{'use strict';
const byId=id=>document.getElementById(id);
const form=byId('trackingForm'),message=byId('trackMessage'),result=byId('trackResult'),submit=byId('trackSubmit');
const orderInput=byId('trackOrderId'),codeInput=byId('trackCode');
const config=window.GN_CONFIG;
const orderPattern=/^GN-[A-Z0-9-]{8,45}$/;
const dt=value=>{if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})+' WIB'};
const labels={awaiting_payment:'Menunggu pembayaran',ready_to_pack:'Menunggu pengemasan',packing:'Sedang dikemas',ready_to_ship:'Siap dikirim',shipped:'Dalam pengiriman',delivered:'Diterima',cancelled:'Dibatalkan',review:'Perlu pemeriksaan'};
const paymentLabels={pending:'Menunggu pembayaran',paid:'Sudah dibayar',expired:'Kedaluwarsa',cancelled:'Dibatalkan',failed:'Pembayaran gagal',refunded:'Dana dikembalikan',review:'Perlu pemeriksaan'};
const steps=[['awaiting_payment','Dibuat'],['ready_to_pack','Lunas'],['packing','Dikemas'],['shipped','Dikirim'],['delivered','Diterima']];
let busy=false;
function notify(text,error=false){message.textContent=text;message.classList.toggle('error',error)}
function readSession(key){try{return sessionStorage.getItem(key)||''}catch{return ''}}
function saveSession(key,value){try{sessionStorage.setItem(key,value)}catch{}}
function checkoutSecret(id){try{return JSON.parse(readSession('gn_payment_'+id)||'{}')?.token||''}catch{return ''}}
function construct(tag,className,text){const x=document.createElement(tag);if(className)x.className=className;if(text!==undefined)x.textContent=text;return x}
function draw(data){
 const order=data.order||{},shipment=data.shipment||{},hist=Array.isArray(data.history)?data.history:[];
 const status=order.payment_status==='paid'?(shipment.status||'ready_to_pack'):(shipment.status==='review'?'review':'awaiting_payment');
 const payment=paymentLabels[order.payment_status]||'Perlu pemeriksaan';
 byId('resultOrderId').textContent=order.order_id||'—';
 byId('resultBadge').textContent=labels[status]||'Diproses';
 byId('resultBadge').classList.toggle('warn',status==='awaiting_payment'||status==='review'||status==='cancelled');
 byId('paymentState').textContent=payment;
 byId('orderCreated').textContent=dt(order.created_at);
 byId('carrierName').textContent=shipment.carrier||'Belum ditentukan oleh admin';
 byId('trackingNumber').textContent=shipment.tracking_number||'Belum diterbitkan';
 const stage=status==='ready_to_ship'?2:steps.findIndex(s=>s[0]===status);
 const stageIndex=stage<0?(order.payment_status==='paid'?1:0):stage;
 const progress=byId('shippingSteps');progress.replaceChildren();
 for(let i=0;i<steps.length;i++){const li=construct('li',i<stageIndex?'complete':i===stageIndex?'current':'',steps[i][1]);progress.append(li)}
 const timeline=byId('trackingHistory');timeline.replaceChildren();
 for(const event of hist){
  if(!event||!event.message)continue;
  const li=construct('li');
  li.append(construct('h3','',event.kind==='admin_update'?'Pembaruan dari tim GoO ninks':labels[event.status]||'Status diperbarui'));
  li.append(construct('p','',event.message));
  const time=construct('time','',dt(event.created_at));if(event.created_at)time.dateTime=event.created_at;
  li.append(time);timeline.append(li);
 }
 if(!timeline.children.length){
  const li=construct('li');li.append(construct('h3','','Pesanan tercatat'));
  li.append(construct('p','','Informasi pelacakan akan muncul setelah admin memperbarui proses pengiriman.'));
  li.append(construct('time','',dt(order.created_at)));timeline.append(li);
 }
 result.classList.remove('hidden');
}
async function track(id,code,checkoutToken){
 if(busy)return;
 if(!orderPattern.test(id))return notify('Nomor pesanan tidak valid. Periksa kembali nomor dari konfirmasi checkout.',true);
 if(!code&&!checkoutToken)return notify('Masukkan kode pelacakan dari admin. Jika checkout di perangkat lain, mintalah tautan pelacakan kepada tim GoO ninks.',true);
 if(code&&!/^[a-f0-9]{64}$/i.test(code))return notify('Format kode pelacakan tidak valid.',true);
 if(!config?.url||!config?.publishableKey)return notify('Koneksi pelacakan belum siap. Coba lagi nanti.',true);
 busy=true;submit.disabled=true;result.classList.add('hidden');notify('Mengambil informasi terbaru dari admin GoO ninks…');
 try{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
  let response;
  try{
   response=await fetch(config.url+'/functions/v1/gn-order-tracking',{
    method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey},
    body:JSON.stringify({action:'track',order_id:id,...(code?{code}:{access_token:checkoutToken})}),
    signal:controller.signal,cache:'no-store',
   });
  }finally{clearTimeout(timeout)}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Status belum dapat diambil.');
  if(code)saveSession('gn_tracking_'+id,code);
  orderInput.value=id;draw(data);notify('Informasi terakhir berhasil diambil. Anda dapat memeriksa kembali kapan saja.');
 }catch(e){notify(e.name==='AbortError'?'Koneksi terlalu lama. Silakan coba kembali.':(e.message||'Pelacakan gagal.'),true)}
 finally{busy=false;submit.disabled=false}
}
form.addEventListener('submit',e=>{
 e.preventDefault();
 const id=orderInput.value.trim().toUpperCase(),code=codeInput.value.trim().toLowerCase()||readSession('gn_tracking_'+id);
 void track(id,code,code?'':checkoutSecret(id));
});
const url=new URL(location.href),fragment=new URLSearchParams(url.hash.slice(1));
const orderId=String(fragment.get('order_id')||url.searchParams.get('order_id')||'').trim().toUpperCase();
const code=String(fragment.get('code')||'').trim().toLowerCase();
if(url.hash){history.replaceState(history.state,'',url.pathname+url.search)}
if(orderId){orderInput.value=orderId}
if(orderId&&orderPattern.test(orderId)&&/^[a-f0-9]{64}$/.test(code)){
 saveSession('gn_tracking_'+orderId,code);
 codeInput.value=code;
 void track(orderId,code,'');
}else if(orderId&&orderPattern.test(orderId)){
 const cachedCode=readSession('gn_tracking_'+orderId);
 const cachedCheckout=checkoutSecret(orderId);
 if(cachedCode||cachedCheckout)void track(orderId,cachedCode,cachedCheckout);
 else notify('Nomor pesanan terisi. Masukkan kode pelacakan dari admin untuk melihat perjalanan paket.');
}
})();