/* Midtrans Snap Redirect. The Midtrans Server Key is never present on the website. */
(()=>{'use strict';
const form=document.getElementById('midtransForm');
if(!form)return;
const info=document.getElementById('midtransInfo');
const mode=document.getElementById('midtransMode');
const pay=document.getElementById('midtransBtn');
const cfg=window.GN_CONFIG;
if(!cfg?.url||!cfg?.publishableKey){info.textContent='Koneksi belum siap.';return;}
const endpoint=cfg.url+'/functions/v1/gn-midtrans-checkout';
const h={'Content-Type':'application/json','apikey':cfg.publishableKey};
let available=false,processing=false;
const count=()=>window.GN_CART_SNAPSHOT?.().reduce((n,x)=>n+x.qty,0)||0;
const sync=()=>{pay.disabled=!available||processing||count()===0};
const message=(str,bad=false)=>{info.textContent=str;info.classList.toggle('gn-midtrans-error',bad)};
document.addEventListener('gn-cart-changed',sync);
fetch(endpoint,{headers:{apikey:cfg.publishableKey},cache:'no-store'}).then(async res=>{
 if(!res.ok)throw Error('Tidak dapat tersambung');
 const data=await res.json();available=data.enabled===true;
 form.hidden=!available;
 mode.textContent=available?(data.mode==='production'?'Aktif':'SANDBOX'):'Belum aktif';
 message(available?(data.mode==='production'?'Pembayaran diproses oleh Midtrans.':'SANDBOX: gunakan hanya untuk tes, tidak ada pembayaran sungguhan.'):'Midtrans belum aktif. Sementara gunakan WhatsApp untuk pemesanan.');
 sync();
}).catch(()=>{form.hidden=true;message('Midtrans sedang tidak tersedia. Gunakan WhatsApp sementara.',true)});
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!available||processing)return;
 const items=window.GN_CART_SNAPSHOT?.()||[];if(!items.length)return message('Keranjang kosong.',true);
 if(!form.reportValidity())return;
 processing=true;sync();message('Memeriksa harga dan stok...');
 try{
  const fd=new FormData(form);
  const customer={name:String(fd.get('name')||''),email:String(fd.get('email')||''),phone:String(fd.get('phone')||''),address:String(fd.get('address')||'')};
  const res=await fetch(endpoint,{method:'POST',headers:h,body:JSON.stringify({action:'checkout',customer,items})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Checkout gagal');
  if(!/^GN-[A-Z0-9-]{8,45}$/.test(data.order_id)||typeof data.access_token!=='string')throw Error('Nomor transaksi tidak valid');
  const url=new URL(data.redirect_url);
  if(url.protocol!=='https:'||!['app.sandbox.midtrans.com','app.midtrans.com'].includes(url.hostname))throw Error('URL pembayaran tidak dikenal');
  sessionStorage.setItem('gn_payment_'+data.order_id,JSON.stringify({token:data.access_token,created:Date.now()}));
  message('Mengalihkan ke pembayaran Midtrans...');
  window.location.assign(url.href);
 }catch(error){message(error instanceof Error?error.message:'Gagal membuka Midtrans.',true);processing=false;sync();}
});
})();