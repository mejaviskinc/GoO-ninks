/* Midtrans Snap Redirect. The Midtrans Server Key is never present on the website. */
(()=>{'use strict';
const form=document.getElementById('midtransForm');
if(!form)return;
const info=document.getElementById('midtransInfo');
const mode=document.getElementById('midtransMode');
const pay=document.getElementById('midtransBtn');
const primary=document.getElementById('checkoutBtn');
const backup=document.getElementById('gnCheckoutWhatsAppBackup');
const PAYMENT_MESSAGES={"id":{"noConnect":"Koneksi belum siap.","activeMode":"Aktif","sandboxMode":"SANDBOX","offMode":"Belum aktif","active":"Pembayaran diproses oleh Midtrans.","sandbox":"SANDBOX: hanya untuk pengujian, tidak ada pembayaran sungguhan.","disabled":"Midtrans belum aktif. Sementara gunakan WhatsApp untuk pemesanan.","offline":"Midtrans sedang tidak tersedia. Gunakan WhatsApp sementara.","empty":"Keranjang kosong.","checking":"Memeriksa harga dan stok...","checkoutFail":"Checkout gagal","badId":"Nomor transaksi tidak valid","badUrl":"URL pembayaran tidak dikenal","redirect":"Mengalihkan ke pembayaran Midtrans...","unknown":"Gagal membuka Midtrans."},"en":{"noConnect":"Connection is not ready.","activeMode":"Active","sandboxMode":"SANDBOX","offMode":"Not active","active":"Your payment is processed securely by Midtrans.","sandbox":"SANDBOX: testing only, no real payments are made.","disabled":"Midtrans is not active yet. Please order via WhatsApp.","offline":"Midtrans is currently unavailable. Please use WhatsApp.","empty":"Your bag is empty.","checking":"Checking price and stock...","checkoutFail":"Checkout failed","badId":"Invalid transaction ID","badUrl":"Unrecognized payment URL","redirect":"Redirecting you to Midtrans...","unknown":"Unable to open Midtrans."},"nl":{"noConnect":"Verbinding is nog niet klaar.","activeMode":"Actief","sandboxMode":"SANDBOX","offMode":"Niet actief","active":"Uw betaling wordt veilig verwerkt door Midtrans.","sandbox":"SANDBOX: alleen om te testen, geen echte betalingen.","disabled":"Midtrans is nog niet actief. Bestel via WhatsApp.","offline":"Midtrans is tijdelijk niet beschikbaar. Gebruik WhatsApp.","empty":"Uw winkelmand is leeg.","checking":"Prijs en voorraad controleren...","checkoutFail":"Betalen is mislukt","badId":"Ongeldig transactienummer","badUrl":"Onbekende betaal-URL","redirect":"Doorsturen naar Midtrans...","unknown":"Midtrans kon niet worden geopend."},"ko":{"noConnect":"연결 준비 중입니다.","activeMode":"활성화","sandboxMode":"테스트 모드","offMode":"비활성화","active":"결제가 Midtrans에서 안전하게 처리됩니다.","sandbox":"테스트 모드: 실제 결제는 진행되지 않습니다.","disabled":"Midtrans가 아직 활성화되지 않았습니다. WhatsApp으로 주문해 주세요.","offline":"Midtrans를 일시적으로 사용할 수 없습니다. WhatsApp을 이용해 주세요.","empty":"장바구니가 비어 있습니다.","checking":"가격과 재고를 확인 중입니다...","checkoutFail":"결제 진행에 실패했습니다","badId":"유효하지 않은 거래 번호","badUrl":"확인할 수 없는 결제 URL","redirect":"Midtrans 결제 페이지로 이동 중입니다...","unknown":"Midtrans를 열 수 없습니다."}};
const CHECKOUT_LABELS={
  id:{continue:'Lanjutkan ke Pembayaran Midtrans ↗',manual:'Isi Data Pesanan ↗',help:'Butuh bantuan? Pesan via WhatsApp ↗'},
  en:{continue:'Continue to Midtrans Payment ↗',manual:'Enter Order Details ↗',help:'Need help? Order via WhatsApp ↗'},
  nl:{continue:'Verder naar Midtrans-betaling ↗',manual:'Vul bestelgegevens in ↗',help:'Hulp nodig? Bestel via WhatsApp ↗'},
  ko:{continue:'Midtrans 결제 계속하기 ↗',manual:'주문 정보 입력 ↗',help:'도움이 필요하신가요? WhatsApp으로 주문 ↗'}
};
const local=()=>{try{return JSON.parse(localStorage.getItem('goo-ninks-lang')||'"id"')}catch{return 'id'}};
const tr=key=>(PAYMENT_MESSAGES[local()]||PAYMENT_MESSAGES.id)[key]||(ORDER_LABELS[local()]||ORDER_LABELS.id)[key]||key;
const ORDER_LABELS={"id":{"payMidtransButton":"Bayar melalui Midtrans ↗","manualButton":"Ajukan Pesanan ke Admin ↗","postalInvalid":"Kode pos harus 5 angka.","manualSaved":"Data pesanan tercatat di Leads. Mengarahkan ke WhatsApp untuk konfirmasi; pesanan belum dibayar.","manualFailed":"Gagal menyimpan data pesanan. Jangan lanjutkan sebelum data tercatat."},"en":{"payMidtransButton":"Pay securely with Midtrans ↗","manualButton":"Send Order Request ↗","postalInvalid":"Postal code must be 5 digits.","manualSaved":"Order details saved. Redirecting to WhatsApp for confirmation; this is not a paid order.","manualFailed":"Could not save your order. Please try again before continuing."},"nl":{"payMidtransButton":"Veilig betalen via Midtrans ↗","manualButton":"Bestelaanvraag versturen ↗","postalInvalid":"De postcode moet 5 cijfers bevatten.","manualSaved":"Bestelgegevens opgeslagen. Doorsturen naar WhatsApp voor bevestiging; nog niet betaald.","manualFailed":"Bestelling opslaan is mislukt. Probeer het opnieuw."},"ko":{"payMidtransButton":"Midtrans 결제하기 ↗","manualButton":"주문 요청 제출 ↗","postalInvalid":"우편번호는 숫자 5자리여야 합니다.","manualSaved":"주문 정보가 저장되었습니다. WhatsApp으로 이동하여 확인하며, 아직 결제되지 않았습니다.","manualFailed":"주문 정보를 저장하지 못했습니다. 다시 시도해 주세요."}};
const cfg=window.GN_CONFIG;
if(!cfg?.url||!cfg?.publishableKey){info.textContent=tr('noConnect');return;}
const endpoint=cfg.url+'/functions/v1/gn-midtrans-checkout';
const h={'Content-Type':'application/json','apikey':cfg.publishableKey};
let available=false,processing=false,modeKey='offMode',lastMessage='disabled',lastError=false;
window.GN_MIDTRANS_READY=false;
const updateCheckoutAction=()=>{
  if(primary){
    const words=CHECKOUT_LABELS[local()]||CHECKOUT_LABELS.id;
    const label=available?words.continue:words.manual;
    primary.textContent=label;
    primary.setAttribute('aria-label',label);
  }
  pay.textContent=available?tr('payMidtransButton'):tr('manualButton');
  if(backup){
    backup.hidden=true;
  }
};
window.GN_MIDTRANS_OPEN=()=>{
  const area=document.getElementById('midtransArea');
  if(!area)return false;
  form.hidden=false;
  area.scrollIntoView({behavior:'smooth',block:'nearest'});
  form.querySelector('input[name="name"]')?.focus({preventScroll:true});
  return true;
};
const count=()=>window.GN_CART_SNAPSHOT?.().reduce((n,x)=>n+x.qty,0)||0;
const sync=()=>{pay.disabled=processing||count()===0};
const message=(key,bad=false)=>{lastMessage=key;lastError=bad;info.textContent=tr(key);info.classList.toggle('gn-midtrans-error',bad)};
window.addEventListener('gn-language-changed',()=>{mode.textContent=tr(modeKey);message(lastMessage,lastError);updateCheckoutAction()});
document.addEventListener('gn-cart-changed',sync);
fetch(endpoint,{headers:{apikey:cfg.publishableKey},cache:'no-store'}).then(async res=>{
 if(!res.ok)throw Error('Tidak dapat tersambung');
 const data=await res.json();available=data.enabled===true;
 window.GN_MIDTRANS_READY=available;
 form.hidden=true;
 modeKey=available?(data.mode==='production'?'activeMode':'sandboxMode'):'offMode';mode.textContent=tr(modeKey);
 message(available?(data.mode==='production'?'active':'sandbox'):'disabled');
 updateCheckoutAction();
 sync();
}).catch(()=>{available=false;window.GN_MIDTRANS_READY=false;form.hidden=true;updateCheckoutAction();message('offline',true)});

async function requestManualOrder(customer,items){
  // Manual fallback is an inquiry only: never mark an order paid or create shipping.
  if(!window.supabase?.createClient)throw Error(tr('manualFailed'));
  const address=[customer.address,customer.district,customer.city,customer.province,customer.postal_code].join(', ');
  const itemList=items.map(p=>p.sku+' x'+p.qty+(p.note?' ('+p.note+')':'')).join('; ');
  const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const payload={name:customer.name,email:customer.email,phone:customer.phone,interest:'Permintaan pembelian GoO Ninks',notes:('Status: BELUM DIBAYAR. Alamat: '+address+'. Keranjang: '+itemList).slice(0,1700),source:'website',stage:'new',consent:true};
  const {error}=await client.from('gn_leads').insert(payload);
  if(error)throw Error(tr('manualFailed'));
  message('manualSaved');
  const summary='Halo GoO Ninks, saya sudah mengisi data pesanan di website dan ingin konfirmasi ketersediaan serta pembayaran. Nama: '+customer.name+'. Pesanan: '+itemList+'. Data alamat sudah dikirim lewat website. Ongkir mohon dikonfirmasi.';
  window.location.assign('https://wa.me/6285740393953?text='+encodeURIComponent(summary));
}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(processing)return;
 const items=window.GN_CART_SNAPSHOT?.()||[];if(!items.length)return message('empty',true);
 if(!form.reportValidity())return;
 processing=true;sync();message('checking');
 try{
  const fd=new FormData(form);
  const customer={name:String(fd.get('name')||'').trim(),email:String(fd.get('email')||'').trim(),phone:String(fd.get('phone')||'').trim(),address:String(fd.get('address')||'').trim(),province:String(fd.get('province')||'').trim(),city:String(fd.get('city')||'').trim(),district:String(fd.get('district')||'').trim(),postal_code:String(fd.get('postal_code')||'').trim()};
  if(!/^[0-9]{5}$/.test(customer.postal_code))throw Error(tr('postalInvalid'));
  if(!available){await requestManualOrder(customer,items);processing=false;sync();return;}
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