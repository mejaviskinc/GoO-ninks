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
let busy=false,tries=0;
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
 if(busy)return;
 busy=true;button.disabled=true;
 try{
  const res=await fetch(cfg.url+'/functions/v1/gn-midtrans-checkout',{method:'POST',
    headers:{'Content-Type':'application/json',apikey:cfg.publishableKey},
    body:JSON.stringify({action:'status',order_id:id,access_token:token})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Gagal memeriksa status pembayaran.');
  const row=data.order;
  if(!row||!labels[row.status])throw Error('Status tidak tersedia.');
  message.textContent=labels[row.status];
  el('paymentAmount').textContent='Total produk: Rp'+new Intl.NumberFormat('id-ID').format(row.amount);
  if(row.status==='pending'&&tries++<24)setTimeout(check,15000);
 }catch(error){message.textContent=error instanceof Error?error.message:'Gagal memeriksa status.';}
 finally{busy=false;button.disabled=false}
}
button.addEventListener('click',check);check();
})();