/* Midtrans return URL is not payment proof; query the server with a private order token. */
(()=>{'use strict';
const el=x=>document.getElementById(x),id=new URL(location.href).searchParams.get('order_id')||'';
const message=el('paymentStatusText'),button=el('checkPaymentAgain');
if(!/^GN-[A-Z0-9-]{8,45}$/.test(id)){message.textContent='Nomor pesanan tidak valid.';button.disabled=true;return}
el('paymentOrderId').textContent=id;
let token='';try{token=JSON.parse(sessionStorage.getItem('gn_payment_'+id)||'{}').token||''}catch{}
if(!token){message.textContent='Kode verifikasi tidak tersedia di perangkat ini. Hubungi admin menggunakan nomor pesanan.';button.disabled=true;return}
const cfg=window.GN_CONFIG;
if(!cfg?.url||!cfg?.publishableKey){message.textContent='Koneksi status tidak tersedia.';button.disabled=true;return}
let busy=false,timer=null,nextDelay=5000;
function schedule(){clearTimeout(timer);if(!document.hidden)timer=setTimeout(check,nextDelay)}
const labels={
 pending:'Pembayaran belum terkonfirmasi. Jika sudah membayar, tunggu beberapa saat.',
 paid:'Pembayaran berhasil dikonfirmasi. Pesanan akan diproses.',
 expired:'Batas waktu pembayaran sudah berakhir. Silakan checkout ulang.',
 failed:'Pembayaran gagal. Anda bisa mencoba memesan kembali.',
 cancelled:'Pembayaran dibatalkan. Silakan checkout ulang jika diperlukan.',
 refunded:'Pembayaran tercatat sebagai pengembalian dana. Hubungi admin.',
 review:'Pembayaran memerlukan peninjauan manual. Hubungi admin dengan nomor pesanan.'
};
async function check(){
 clearTimeout(timer);
 if(busy)return;
 busy=true;button.disabled=true;
 try{
  const res=await fetch(cfg.url+'/functions/v1/gn-midtrans-checkout',{method:'POST',
    headers:{'Content-Type':'application/json',apikey:cfg.publishableKey},
    body:JSON.stringify({action:'status',order_id:id,access_token:token}),
    signal:AbortSignal.timeout(20000),cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Gagal memeriksa status pembayaran.');
  const row=data.order;
  if(!row||!labels[row.status])throw Error('Status tidak tersedia.');
  message.textContent=labels[row.status];
  el('paymentAmount').textContent='Total produk: Rp'+new Intl.NumberFormat('id-ID').format(row.amount);
  const track=el('shippingStatusText');
  const names={awaiting_payment:'Menunggu pembayaran',ready_to_pack:'Pembayaran lunas · menunggu dikemas',packing:'Pesanan sedang dikemas',ready_to_ship:'Siap diserahkan ke ekspedisi',shipped:'Paket telah dikirim',delivered:'Paket selesai dikirim',cancelled:'Pengiriman dibatalkan',review:'Pengiriman memerlukan pemeriksaan admin'};
  const ship=data.shipping;
  if(track){
    track.textContent=ship&&names[ship.status] ? names[ship.status] : 'Menunggu pembaruan dari admin.';
    if(ship?.tracking_number&&row.status==='paid')track.textContent+='\nEkspedisi: '+(ship.carrier||'Kurir')+' · Resi: '+ship.tracking_number;
    if(ship?.status==='ready_to_pack'||ship?.status==='packing')track.textContent+='\nOngkos kirim dikonfirmasi terpisah oleh admin.';
  }
  nextDelay=row.status==='pending'?5000:30000;
 }catch(error){nextDelay=15000;message.textContent=(error instanceof Error?error.message:'Gagal memeriksa status.')+' Akan dicoba kembali otomatis.';}
 finally{busy=false;button.disabled=false;schedule()}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else void check()});
window.addEventListener('online',()=>void check());
window.addEventListener('pagehide',()=>clearTimeout(timer));
button.addEventListener('click',check);check();
})();