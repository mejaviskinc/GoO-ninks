/* Midtrans Snap Redirect. The Midtrans Server Key is never present on the website. */
(()=>{'use strict';
const form=document.getElementById('midtransForm');
if(!form)return;
const info=document.getElementById('midtransInfo');
const mode=document.getElementById('midtransMode');
const pay=document.getElementById('midtransBtn');
const PAYMENT_MESSAGES={"id":{"noConnect":"Koneksi belum siap.","activeMode":"Aktif","sandboxMode":"SANDBOX","offMode":"Belum aktif","active":"Pembayaran diproses oleh Midtrans.","sandbox":"SANDBOX: hanya untuk pengujian, tidak ada pembayaran sungguhan.","disabled":"Midtrans belum aktif. Sementara gunakan WhatsApp untuk pemesanan.","offline":"Midtrans sedang tidak tersedia. Gunakan WhatsApp sementara.","empty":"Keranjang kosong.","checking":"Memeriksa harga dan stok...","checkoutFail":"Checkout gagal","badId":"Nomor transaksi tidak valid","badUrl":"URL pembayaran tidak dikenal","redirect":"Mengalihkan ke pembayaran Midtrans...","unknown":"Gagal membuka Midtrans."},"en":{"noConnect":"Connection is not ready.","activeMode":"Active","sandboxMode":"SANDBOX","offMode":"Not active","active":"Your payment is processed securely by Midtrans.","sandbox":"SANDBOX: testing only, no real payments are made.","disabled":"Midtrans is not active yet. Please order via WhatsApp.","offline":"Midtrans is currently unavailable. Please use WhatsApp.","empty":"Your bag is empty.","checking":"Checking price and stock...","checkoutFail":"Checkout failed","badId":"Invalid transaction ID","badUrl":"Unrecognized payment URL","redirect":"Redirecting you to Midtrans...","unknown":"Unable to open Midtrans."},"nl":{"noConnect":"Verbinding is nog niet klaar.","activeMode":"Actief","sandboxMode":"SANDBOX","offMode":"Niet actief","active":"Uw betaling wordt veilig verwerkt door Midtrans.","sandbox":"SANDBOX: alleen om te testen, geen echte betalingen.","disabled":"Midtrans is nog niet actief. Bestel via WhatsApp.","offline":"Midtrans is tijdelijk niet beschikbaar. Gebruik WhatsApp.","empty":"Uw winkelmand is leeg.","checking":"Prijs en voorraad controleren...","checkoutFail":"Betalen is mislukt","badId":"Ongeldig transactienummer","badUrl":"Onbekende betaal-URL","redirect":"Doorsturen naar Midtrans...","unknown":"Midtrans kon niet worden geopend."},"ko":{"noConnect":"연결 준비 중입니다.","activeMode":"활성화","sandboxMode":"테스트 모드","offMode":"비활성화","active":"결제가 Midtrans에서 안전하게 처리됩니다.","sandbox":"테스트 모드: 실제 결제는 진행되지 않습니다.","disabled":"Midtrans가 아직 활성화되지 않았습니다. WhatsApp으로 주문해 주세요.","offline":"Midtrans를 일시적으로 사용할 수 없습니다. WhatsApp을 이용해 주세요.","empty":"장바구니가 비어 있습니다.","checking":"가격과 재고를 확인 중입니다...","checkoutFail":"결제 진행에 실패했습니다","badId":"유효하지 않은 거래 번호","badUrl":"확인할 수 없는 결제 URL","redirect":"Midtrans 결제 페이지로 이동 중입니다...","unknown":"Midtrans를 열 수 없습니다."}};
const local=()=>{try{return JSON.parse(localStorage.getItem('goo-ninks-lang')||'"id"')}catch{return 'id'}};
const tr=key=>(PAYMENT_MESSAGES[local()]||PAYMENT_MESSAGES.id)[key]||key;
const cfg=window.GN_CONFIG;
if(!cfg?.url||!cfg?.publishableKey){info.textContent=tr('noConnect');return;}
const endpoint=cfg.url+'/functions/v1/gn-midtrans-checkout';
const h={'Content-Type':'application/json','apikey':cfg.publishableKey};
let available=false,processing=false,modeKey='offMode',lastMessage='disabled',lastError=false;
const count=()=>window.GN_CART_SNAPSHOT?.().reduce((n,x)=>n+x.qty,0)||0;
const sync=()=>{pay.disabled=!available||processing||count()===0};
const message=(key,bad=false)=>{lastMessage=key;lastError=bad;info.textContent=tr(key);info.classList.toggle('gn-midtrans-error',bad)};
window.addEventListener('gn-language-changed',()=>{mode.textContent=tr(modeKey);message(lastMessage,lastError)});
document.addEventListener('gn-cart-changed',sync);
fetch(endpoint,{headers:{apikey:cfg.publishableKey},cache:'no-store'}).then(async res=>{
 if(!res.ok)throw Error('Tidak dapat tersambung');
 const data=await res.json();available=data.enabled===true;
 form.hidden=!available;
 modeKey=available?(data.mode==='production'?'activeMode':'sandboxMode'):'offMode';mode.textContent=tr(modeKey);
 message(available?(data.mode==='production'?'active':'sandbox'):'disabled');
 sync();
}).catch(()=>{form.hidden=true;message('offline',true)});
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!available||processing)return;
 const items=window.GN_CART_SNAPSHOT?.()||[];if(!items.length)return message('empty',true);
 if(!form.reportValidity())return;
 processing=true;sync();message('checking');
 try{
  const fd=new FormData(form);
  const customer={name:String(fd.get('name')||''),email:String(fd.get('email')||''),phone:String(fd.get('phone')||''),address:String(fd.get('address')||'')};
  const res=await fetch(endpoint,{method:'POST',headers:h,body:JSON.stringify({action:'checkout',customer,items})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||tr('checkoutFail'));
  if(!/^GN-[A-Z0-9-]{8,45}$/.test(data.order_id)||typeof data.access_token!=='string')throw Error(tr('badId'));
  const url=new URL(data.redirect_url);
  if(url.protocol!=='https:'||!['app.sandbox.midtrans.com','app.midtrans.com'].includes(url.hostname))throw Error(tr('badUrl'));
  sessionStorage.setItem('gn_payment_'+data.order_id,JSON.stringify({token:data.access_token,created:Date.now()}));
  message('redirect');
  window.location.assign(url.href);
 }catch(error){message(error instanceof Error?error.message:'unknown',true);processing=false;sync();}
});
})();