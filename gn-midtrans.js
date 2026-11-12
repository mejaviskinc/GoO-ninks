/* Payment routing: switch new orders to DOKU only when production is configured. */
(()=>{'use strict';
const form=document.getElementById('midtransForm');
if(!form)return;
/* Checkout choice styles are installed here as well because the public stylesheet returned 404. */
if(document.getElementById('gnPaymentChoice')&&!document.getElementById('gnPaymentChoiceRuntimeStyles')){
 const style=document.createElement('style');
 style.id='gnPaymentChoiceRuntimeStyles';
 style.textContent="\n/* Scoped payment-choice fallback: the public CSS asset may be missing (404). */\n#gnPaymentChoice[hidden],#midtransArea[hidden],#gnPaymentChoiceNotice[hidden]{display:none!important}\n#gnPaymentChoice,#gnPaymentChoice *{box-sizing:border-box}\n#gnPaymentChoice{\n  display:block!important;position:relative;width:100%;max-width:100%;min-width:0;\n  margin:18px 0 20px;padding:20px 0 3px;\n  border-top:1px solid #ddd6c9;color:#2f2c28;\n  font-family:'DM Sans',Arial,sans-serif;\n}\n#gnPaymentChoice .gn-payment-choice-header{\n  display:flex!important;flex-flow:row nowrap!important;align-items:flex-start!important;\n  justify-content:space-between!important;gap:14px!important;width:100%;margin-bottom:17px;\n}\n#gnPaymentChoice .gn-payment-choice-heading{flex:1 1 auto;min-width:0}\n#gnPaymentChoice .gn-payment-choice-title{\n  display:block;margin:0;padding:0;color:#25231f;font-family:'DM Sans',Arial,sans-serif;\n  font-size:17px;font-weight:700;line-height:1.4;letter-spacing:0;\n}\n#gnPaymentChoice .gn-payment-choice-subtitle{\n  display:block;margin:7px 0 0;padding:0;color:#817a6d;font-size:12px;line-height:1.5;letter-spacing:0;\n}\n#gnPaymentChoice .gn-payment-choice-close{\n  appearance:none!important;display:grid!important;place-items:center!important;\n  flex:0 0 34px!important;position:static!important;float:none!important;\n  min-width:34px!important;width:34px!important;height:34px!important;\n  margin:0!important;padding:0!important;line-height:1!important;\n  background:#fff!important;border:1px solid #d4ccbd!important;border-radius:5px!important;\n  color:#4e463d!important;font-size:22px!important;font-weight:400!important;\n  cursor:pointer;\n}\n#gnPaymentChoice .gn-payment-choice-close:hover{background:#f6f2eb!important}\n#gnPaymentChoice .gn-payment-choice-buttons{\n  display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:10px!important;\n  width:100%!important;max-width:100%;margin:0!important;padding:0!important;\n}\n#gnPaymentChoice .gn-payment-choice-button{\n  appearance:none!important;display:grid!important;\n  grid-template-columns:38px minmax(0,1fr) auto!important;\n  align-items:center!important;justify-items:start!important;column-gap:13px!important;\n  position:relative!important;float:none!important;flex:none!important;\n  width:100%!important;min-width:0!important;max-width:100%!important;min-height:76px!important;\n  margin:0!important;padding:14px 15px!important;\n  background:#fff!important;border:1px solid #d7cec0!important;border-radius:6px!important;\n  color:#282621!important;box-shadow:0 1px 3px #241a130d!important;\n  text-align:left!important;text-transform:none!important;text-decoration:none!important;\n  line-height:normal!important;letter-spacing:0!important;font-family:'DM Sans',Arial,sans-serif!important;\n  cursor:pointer;\n}\n#gnPaymentChoice .gn-payment-choice-button:hover,\n#gnPaymentChoice .gn-payment-choice-button:focus-visible{\n  border-color:#927d61!important;background:#faf8f5!important;\n  box-shadow:0 3px 12px #65503712!important;\n}\n#gnPaymentChoice .gn-payment-choice-button:focus-visible,\n#gnPaymentChoice .gn-payment-choice-close:focus-visible{outline:2px solid #907653!important;outline-offset:3px!important}\n#gnPaymentChoice .gn-choice-icon{\n  display:flex!important;align-items:center!important;justify-content:center!important;\n  grid-column:1!important;width:38px!important;min-width:38px!important;height:38px!important;\n  margin:0!important;padding:0!important;border-radius:50%!important;\n  background:#f1ede5!important;color:#6b5944!important;\n  font:700 15px 'DM Sans',Arial,sans-serif!important;\n}\n#gnPaymentChoice .gn-choice-copy{\n  grid-column:2!important;display:flex!important;flex-direction:column!important;\n  justify-content:center!important;align-items:flex-start!important;gap:4px!important;\n  min-width:0!important;max-width:100%!important;width:100%!important;margin:0!important;padding:0!important;\n}\n#gnPaymentChoice .gn-choice-name{\n  display:block!important;width:100%!important;white-space:normal!important;\n  color:#292723!important;font-size:14px!important;font-weight:700!important;\n  line-height:1.45!important;letter-spacing:0!important;margin:0!important;padding:0!important;\n}\n#gnPaymentChoice .gn-choice-description{\n  display:block!important;width:100%!important;min-width:0!important;\n  white-space:normal!important;overflow-wrap:break-word!important;\n  margin:0!important;padding:0!important;\n  color:#817b72!important;font-size:11px!important;font-weight:400!important;line-height:1.45!important;\n}\n#gnPaymentChoice .gn-choice-arrow{\n  grid-column:3!important;justify-self:end!important;align-self:center!important;\n  display:block!important;color:#75644f!important;font-size:22px!important;line-height:1!important;\n}\n#gnPaymentChoice .gn-choice-coming{\n  grid-column:3!important;justify-self:end!important;align-self:center!important;\n  display:inline-flex!important;justify-content:center!important;align-items:center!important;\n  margin:0!important;padding:6px 9px!important;\n  border:1px solid #ddcfb6!important;border-radius:40px!important;\n  background:#f8f3e9!important;color:#816b4c!important;\n  font-size:10px!important;font-weight:700!important;line-height:1.2!important;\n  white-space:nowrap!important;letter-spacing:0!important;\n}\n#gnPaymentChoice .gn-payment-choice-notice{\n  display:block;margin:12px 0 0;padding:12px 14px;border:1px solid #d8cab2;\n  border-radius:5px;background:#f9f6ee;color:#6c5a43;font-size:12px;line-height:1.65;\n}\n@media(max-width:380px){\n  #gnPaymentChoice .gn-payment-choice-button{\n    grid-template-columns:32px minmax(0,1fr) auto!important;column-gap:9px!important;padding:12px 10px!important;\n  }\n  #gnPaymentChoice .gn-choice-icon{width:32px!important;min-width:32px!important;height:32px!important;font-size:13px!important}\n  #gnPaymentChoice .gn-choice-name{font-size:13px!important}\n  #gnPaymentChoice .gn-choice-description{font-size:10px!important}\n  #gnPaymentChoice .gn-choice-coming{font-size:9px!important;padding:5px 7px!important}\n}";
 document.head.appendChild(style);
}

const info=document.getElementById('midtransInfo');
const mode=document.getElementById('midtransMode');
const pay=document.getElementById('midtransBtn');
const primary=document.getElementById('checkoutBtn');
const backup=document.getElementById('gnCheckoutWhatsAppBackup');
const paymentChoice=document.getElementById('gnPaymentChoice');
const paymentArea=document.getElementById('midtransArea');
const paymentChoiceNotice=document.getElementById('gnPaymentChoiceNotice');
const PAYMENT_MESSAGES={"id":{"noConnect":"Koneksi belum siap.","activeMode":"Aktif","sandboxMode":"SANDBOX","offMode":"Belum aktif","active":"Pembayaran diproses oleh Midtrans.","sandbox":"SANDBOX: hanya untuk pengujian, tidak ada pembayaran sungguhan.","disabled":"Midtrans belum aktif. Sementara gunakan WhatsApp untuk pemesanan.","offline":"Midtrans sedang tidak tersedia. Gunakan WhatsApp sementara.","empty":"Keranjang kosong.","checking":"Memeriksa harga dan stok...","checkoutFail":"Checkout gagal","badId":"Nomor transaksi tidak valid","badUrl":"URL pembayaran tidak dikenal","redirect":"Mengalihkan ke pembayaran Midtrans...","unknown":"Gagal membuka Midtrans."},"en":{"noConnect":"Connection is not ready.","activeMode":"Active","sandboxMode":"SANDBOX","offMode":"Not active","active":"Your payment is processed securely by Midtrans.","sandbox":"SANDBOX: testing only, no real payments are made.","disabled":"Midtrans is not active yet. Please order via WhatsApp.","offline":"Midtrans is currently unavailable. Please use WhatsApp.","empty":"Your bag is empty.","checking":"Checking price and stock...","checkoutFail":"Checkout failed","badId":"Invalid transaction ID","badUrl":"Unrecognized payment URL","redirect":"Redirecting you to Midtrans...","unknown":"Unable to open Midtrans."},"nl":{"noConnect":"Verbinding is nog niet klaar.","activeMode":"Actief","sandboxMode":"SANDBOX","offMode":"Niet actief","active":"Uw betaling wordt veilig verwerkt door Midtrans.","sandbox":"SANDBOX: alleen om te testen, geen echte betalingen.","disabled":"Midtrans is nog niet actief. Bestel via WhatsApp.","offline":"Midtrans is tijdelijk niet beschikbaar. Gebruik WhatsApp.","empty":"Uw winkelmand is leeg.","checking":"Prijs en voorraad controleren...","checkoutFail":"Betalen is mislukt","badId":"Ongeldig transactienummer","badUrl":"Onbekende betaal-URL","redirect":"Doorsturen naar Midtrans...","unknown":"Midtrans kon niet worden geopend."},"ko":{"noConnect":"연결 준비 중입니다.","activeMode":"활성화","sandboxMode":"테스트 모드","offMode":"비활성화","active":"결제가 Midtrans에서 안전하게 처리됩니다.","sandbox":"테스트 모드: 실제 결제는 진행되지 않습니다.","disabled":"Midtrans가 아직 활성화되지 않았습니다. WhatsApp으로 주문해 주세요.","offline":"Midtrans를 일시적으로 사용할 수 없습니다. WhatsApp을 이용해 주세요.","empty":"장바구니가 비어 있습니다.","checking":"가격과 재고를 확인 중입니다...","checkoutFail":"결제 진행에 실패했습니다","badId":"유효하지 않은 거래 번호","badUrl":"확인할 수 없는 결제 URL","redirect":"Midtrans 결제 페이지로 이동 중입니다...","unknown":"Midtrans를 열 수 없습니다."}};
const CHECKOUT_LABELS={
  id:{continue:'Lanjutkan ke Pembayaran ↗',manual:'Isi Data Pesanan ↗',help:'Butuh bantuan? Pesan via WhatsApp ↗'},
  en:{continue:'Continue to Payment ↗',manual:'Enter Order Details ↗',help:'Need help? Order via WhatsApp ↗'},
  nl:{continue:'Verder naar betalen ↗',manual:'Vul bestelgegevens in ↗',help:'Hulp nodig? Bestel via WhatsApp ↗'},
  ko:{continue:'결제 계속하기 ↗',manual:'주문 정보 입력 ↗',help:'도움이 필요하신가요? WhatsApp으로 주문 ↗'}
};
const local=()=>{try{return JSON.parse(localStorage.getItem('goo-ninks-lang')||'"id"')}catch{return 'id'}};
const providerName=()=>provider==='doku'?'DOKU':'Midtrans';
const tr=key=>(PAYMENT_MESSAGES[local()]||PAYMENT_MESSAGES.id)[key]||(ORDER_LABELS[local()]||ORDER_LABELS.id)[key]||key;
const ORDER_LABELS={"id":{"payMidtransButton":"Bayar melalui Midtrans ↗","manualButton":"Ajukan Pesanan ke Admin ↗","postalInvalid":"Kode pos harus 5 angka.","manualSaved":"Data permintaan tercatat di Manajemen Pelanggan. Mengarahkan ke WhatsApp untuk konfirmasi; pesanan belum dibayar.","manualFailed":"Gagal menyimpan data pesanan. Jangan lanjutkan sebelum data tercatat."},"en":{"payMidtransButton":"Pay securely with Midtrans ↗","manualButton":"Send Order Request ↗","postalInvalid":"Postal code must be 5 digits.","manualSaved":"Order details saved. Redirecting to WhatsApp for confirmation; this is not a paid order.","manualFailed":"Could not save your order. Please try again before continuing."},"nl":{"payMidtransButton":"Veilig betalen via Midtrans ↗","manualButton":"Bestelaanvraag versturen ↗","postalInvalid":"De postcode moet 5 cijfers bevatten.","manualSaved":"Bestelgegevens opgeslagen. Doorsturen naar WhatsApp voor bevestiging; nog niet betaald.","manualFailed":"Bestelling opslaan is mislukt. Probeer het opnieuw."},"ko":{"payMidtransButton":"Midtrans 결제하기 ↗","manualButton":"주문 요청 제출 ↗","postalInvalid":"우편번호는 숫자 5자리여야 합니다.","manualSaved":"주문 정보가 저장되었습니다. WhatsApp으로 이동하여 확인하며, 아직 결제되지 않았습니다.","manualFailed":"주문 정보를 저장하지 못했습니다. 다시 시도해 주세요."}};
const cfg=window.GN_CONFIG;
if(!cfg?.url||!cfg?.publishableKey){info.textContent=tr('noConnect');return;}
let provider='midtrans',endpoint=cfg.url+'/functions/v1/gn-midtrans-checkout';
const CHOICE_LABELS={
 id:{title:'Pilih Metode Pembayaran',subtitle:'Pilih wilayah pembayaran untuk melanjutkan pesanan.',local:'Pembayaran Lokal',localDesc:'Indonesia · melalui {provider}',international:'Pembayaran Internasional',internationalDesc:'PayPal · untuk pembeli luar negeri',soon:'Belum aktif',notice:'PayPal untuk pembayaran internasional sedang disiapkan dan belum dapat menerima transaksi. Tidak ada pesanan yang dibayar. Untuk saat ini, pilih pembayaran lokal untuk melanjutkan.',close:'Tutup pilihan pembayaran'},
 en:{title:'Choose Payment Method',subtitle:'Select a payment region to continue your order.',local:'Local Payment',localDesc:'Indonesia · via {provider}',international:'International Payment',internationalDesc:'PayPal · for overseas customers',soon:'Coming soon',notice:'International PayPal checkout is being set up and cannot accept payments yet. No payment has been made. Please choose Local Payment to continue for now.',close:'Close payment options'},
 nl:{title:'Kies een betaalmethode',subtitle:'Kies de betaalregio om verder te gaan.',local:'Lokale betaling',localDesc:'Indonesië · via {provider}',international:'Internationale betaling',internationalDesc:'PayPal · voor buitenlandse klanten',soon:'Nog niet actief',notice:'PayPal voor internationale betalingen wordt voorbereid en accepteert nog geen betalingen. Er is niets betaald. Kies voorlopig lokale betaling.',close:'Betaalopties sluiten'},
 ko:{title:'결제 방법 선택',subtitle:'주문을 진행할 결제 지역을 선택하세요.',local:'국내 결제',localDesc:'인도네시아 · {provider} 이용',international:'해외 결제',internationalDesc:'PayPal · 해외 고객용',soon:'준비 중',notice:'해외 결제를 위한 PayPal 연결을 준비 중이며 아직 결제할 수 없습니다. 결제는 이루어지지 않았습니다. 현재는 국내 결제를 선택해 주세요.',close:'결제 옵션 닫기'}
};
const updatePaymentChoice=()=>{
 const t=CHOICE_LABELS[local()]||CHOICE_LABELS.id;
 const values={gnPaymentChoiceTitle:t.title,gnPaymentChoiceSubtitle:t.subtitle,gnPaymentLocalTitle:t.local,gnPaymentLocalDesc:t.localDesc.replace('{provider}',providerName()),gnPaymentIntlTitle:t.international,gnPaymentIntlDesc:t.internationalDesc,gnPaymentIntlSoon:paypalReady?(paypalMode==='live'?'Available':'Sandbox'):(paypalAuthIssue?'API Error':t.soon)};
 for(const [id,val] of Object.entries(values)){const el=document.getElementById(id);if(el)el.textContent=val;}
 document.getElementById('gnPaymentChoiceClose')?.setAttribute('aria-label',t.close);
 if(paymentChoiceNotice&&!paymentChoiceNotice.hidden)paymentChoiceNotice.textContent=t.notice;
};
const h={'Content-Type':'application/json','apikey':cfg.publishableKey};
const turnstileSiteKey='0x4AAAAAAF3Q3TmIn0l4k_PE';
let turnstileToken='',turnstileWidget=null,turnstileLoad=null;
let available=false,processing=false,modeKey='offMode',lastMessage='disabled',lastError=false;
let paypalReady=false,paypalMode='sandbox',paypalAuthIssue=false,selectedMethod='local';
window.GN_MIDTRANS_READY=false;
const updateCheckoutAction=()=>{
  if(primary){
    const words=CHECKOUT_LABELS[local()]||CHECKOUT_LABELS.id;
    const label=(available||paypalReady)?words.continue:words.manual;
    primary.textContent=label;
    primary.setAttribute('aria-label',label);
  }
  pay.textContent=selectedMethod==='paypal' ? (local()==='id'?'Bayar dengan PayPal ↗':local()==='nl'?'Betalen met PayPal ↗':local()==='ko'?'PayPal로 결제 ↗':'Continue with PayPal ↗') : (available?tr('payMidtransButton'):tr('manualButton')).replaceAll('Midtrans',providerName());
  document.querySelectorAll('[data-i18n="payOnline"],[data-i18n="payExplain"]').forEach(el=>{
    el.innerHTML=el.innerHTML.replace(/Midtrans|DOKU/g,providerName());
  });
  if(backup){
    backup.hidden=true;
  }
};
const updatePaymentForm=()=>{
 const intl=selectedMethod==='paypal';
 const head=document.querySelector('#midtransArea .gn-midtrans-head strong');
 const explain=document.querySelector('#midtransArea .gn-midtrans-explain');
 if(head)head.textContent=intl?'Online payment · PayPal (USD)':(local()==='id'?'Pembayaran online · ':local()==='nl'?'Online betalen · ':'Online payment · ')+providerName();
 if(explain)explain.textContent=intl
   ? (local()==='id'?'Harga final dikonversi dari IDR ke USD oleh server. Ongkos kirim belum termasuk.':local()==='nl'?'Het bedrag wordt op de server naar USD omgerekend. Verzendkosten zijn apart.':local()==='ko'?'최종 금액은 서버에서 USD로 환산됩니다. 배송비는 별도입니다.':'Final prices are converted to USD by the server. Shipping is separate.')
   : (local()==='id'?'Pembayaran aman melalui '+providerName()+'. Ongkos kirim dikonfirmasi terpisah.':local()==='nl'?'Veilig betalen via '+providerName()+'. Verzendkosten worden apart bevestigd.':local()==='ko'?providerName()+'을 통해 안전하게 결제하세요. 배송비는 별도입니다.':'Secure payment through '+providerName()+'. Shipping is confirmed separately.');
 mode.textContent=intl?(paypalReady?(paypalMode==='live'?'Active':'Sandbox'):'Not active'):tr(modeKey);
 let credit=document.getElementById('gnPaypalFxCredit');
 if(!credit&&paymentArea){
   credit=document.createElement('p');credit.id='gnPaypalFxCredit';credit.className='gn-midtrans-info';
   const a=document.createElement('a');a.href='https://www.exchangerate-api.com';a.rel='noopener noreferrer';a.target='_blank';
   a.textContent='Rates By Exchange Rate API';credit.append('USD/IDR · ',a);
   form.before(credit);
 }
 if(credit)credit.hidden=!intl;
 updateCheckoutAction();
};
const showLocalForm=()=>{
 updatePaymentForm();
  if(!paymentArea)return false;
  if(paymentChoice)paymentChoice.hidden=true;
  primary?.setAttribute('aria-expanded','false');
  paymentArea.hidden=false;
  form.hidden=false;
  void mountTurnstile();
  paymentArea.scrollIntoView({behavior:'smooth',block:'nearest'});
  form.querySelector('input[name="name"]')?.focus({preventScroll:true});
  return true;
};
window.GN_MIDTRANS_OPEN=()=>{
  if(!paymentArea)return false;
  if(!paymentChoice)return showLocalForm();
  paymentChoice.hidden=false;
  paymentArea.hidden=true;
  form.hidden=true;
  if(paymentChoiceNotice)paymentChoiceNotice.hidden=true;
  primary?.setAttribute('aria-expanded','true');
  paymentChoice.scrollIntoView({behavior:'smooth',block:'nearest'});
  document.getElementById('gnPaymentLocal')?.focus({preventScroll:true});
  return true;
};
const count=()=>window.GN_CART_SNAPSHOT?.().reduce((n,x)=>n+x.qty,0)||0;
const sync=()=>{pay.disabled=processing||count()===0};
const message=(key,bad=false)=>{lastMessage=key;lastError=bad;info.textContent=tr(key).replaceAll('Midtrans',providerName());info.classList.toggle('gn-midtrans-error',bad)};
const securityMessages={
 id:{wait:'Selesaikan verifikasi keamanan sebelum membayar.',failed:'Verifikasi keamanan gagal dimuat. Muat ulang halaman atau coba jaringan lain.'},
 en:{wait:'Complete the security check before paying.',failed:'Security verification could not load. Reload the page or try another network.'},
 nl:{wait:'Voltooi de beveiligingscontrole voordat u betaalt.',failed:'Beveiligingscontrole kon niet laden. Vernieuw de pagina of probeer een ander netwerk.'},
 ko:{wait:'결제 전 보안 확인을 완료해 주세요.',failed:'보안 확인을 불러오지 못했습니다. 페이지를 새로고침하거나 다른 네트워크를 이용해 주세요.'}
};
const securityText=key=>(securityMessages[local()]||securityMessages.id)[key];
function loadTurnstile(){
 if(window.turnstile)return Promise.resolve();
 if(turnstileLoad)return turnstileLoad;
 turnstileLoad=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const timeout=setTimeout(()=>reject(Error(securityText('failed'))),15000);
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async=true;script.defer=true;
  script.onload=()=>{clearTimeout(timeout);window.turnstile?resolve():reject(Error(securityText('failed')))};
  script.onerror=()=>{clearTimeout(timeout);reject(Error(securityText('failed')))};
  document.head.appendChild(script);
 });
 return turnstileLoad;
}
async function mountTurnstile(){
 try{
  await loadTurnstile();
  if(turnstileWidget!==null)return;
  let holder=document.getElementById('gnCheckoutTurnstile');
  if(!holder){holder=document.createElement('div');holder.id='gnCheckoutTurnstile';holder.style.margin='12px 0';pay.before(holder);}
  turnstileWidget=window.turnstile.render(holder,{
   sitekey:turnstileSiteKey,action:'checkout',size:'flexible',theme:'light',
   callback:token=>{turnstileToken=token;sync()},
   'expired-callback':()=>{turnstileToken='';sync()},
   'error-callback':()=>{turnstileToken='';message(securityText('failed'),true);sync()}
  });
 }catch{message(securityText('failed'),true)}
}
function resetTurnstile(){
 turnstileToken='';
 if(window.turnstile && turnstileWidget!==null)window.turnstile.reset(turnstileWidget);
}

updateCheckoutAction();
updatePaymentChoice();
sync();
document.getElementById('gnPaymentLocal')?.addEventListener('click',()=>{selectedMethod='local';showLocalForm()});
document.getElementById('gnPaymentIntl')?.addEventListener('click',()=>{
  if(paypalReady){selectedMethod='paypal';return showLocalForm();}
  if(!paymentChoiceNotice)return;
  const t=CHOICE_LABELS[local()]||CHOICE_LABELS.id;
  paymentChoiceNotice.textContent=paypalAuthIssue ? (
    local()==='id'?'PayPal Live belum tersambung: Client ID atau Secret salah/tidak cocok. Admin perlu memperbarui API PayPal Live di Supabase. Belum ada pembayaran yang dibuat.':
    local()==='nl'?'PayPal Live is niet verbonden: controleer Client ID en Secret in Supabase. Er is geen betaling aangemaakt.':
    local()==='ko'?'PayPal Live API 인증에 실패했습니다. Supabase의 Client ID와 Secret을 확인하세요. 결제는 생성되지 않았습니다.':
    'PayPal Live is not connected: the Client ID or Secret is invalid or mismatched. The store admin must update the Live API credentials in Supabase. No payment was created.'
  ) : t.notice;
  paymentChoiceNotice.hidden=false;
  paymentChoiceNotice.scrollIntoView({behavior:'smooth',block:'nearest'});
});
document.getElementById('gnPaymentChoiceClose')?.addEventListener('click',()=>{
  if(paymentChoice)paymentChoice.hidden=true;
  primary?.setAttribute('aria-expanded','false');
  if(paymentArea)paymentArea.hidden=false;
  primary?.focus({preventScroll:true});
});
window.addEventListener('gn-language-changed',()=>{mode.textContent=tr(modeKey);message(lastMessage,lastError);updateCheckoutAction();updatePaymentChoice();updatePaymentForm()});
document.addEventListener('gn-cart-changed',sync);
async function chooseGateway(){
  const ready=async path=>{
    const res=await fetch(cfg.url+'/functions/v1/'+path,{headers:{apikey:cfg.publishableKey},cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!res.ok)throw Error('Payment unavailable');
    return res.json();
  };
  let data;
  try{
    const doku=await ready('gn-doku-checkout');
    if(doku.enabled===true && doku.mode==='production'){provider='doku';endpoint=cfg.url+'/functions/v1/gn-doku-checkout';data=doku;}
  }catch{}
  try{
    if(!data)data=await ready('gn-midtrans-checkout');
    available=data.enabled===true;
    window.GN_MIDTRANS_READY=available;
    modeKey=available?(data.mode==='production'?'activeMode':'sandboxMode'):'offMode';
    mode.textContent=tr(modeKey);message(available?(data.mode==='production'?'active':'sandbox'):'disabled');
  }catch{available=false;window.GN_MIDTRANS_READY=false;message('offline',true);}
  try{
    const p=await ready('gn-paypal-checkout');
    paypalReady=p.enabled===true && ['sandbox','live'].includes(p.mode);
    paypalMode=p.mode==='live'?'live':'sandbox';
    paypalAuthIssue=p.configured===true && p.credentials_valid===false;
  }catch{paypalReady=false;paypalAuthIssue=false;}
  // Do not hide an order form already opened while gateway availability was loading.
  updateCheckoutAction();updatePaymentChoice();updatePaymentForm();sync();
}
void chooseGateway();

async function requestManualOrder(customer,items){
  // Manual fallback is an inquiry only: never mark an order paid or create shipping.
  if(!window.supabase?.createClient)throw Error(tr('manualFailed'));
  const address=[customer.address,customer.district,customer.city,customer.province,customer.postal_code].join(', ');
  const itemList=items.map(p=>p.sku+' x'+p.qty+(p.note?' ('+p.note+')':'')).join('; ');
  const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const payload={name:customer.name,email:customer.email,phone:customer.phone,interest:'Permintaan pembelian GoO Ninks',notes:('Status: BELUM DIBAYAR. Alamat: '+address+'. Keranjang: '+itemList).slice(0,1700),source:'website',consent:true};
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
  if(selectedMethod==='paypal'){
    if(!paypalReady)throw Error('PayPal belum aktif. Masukkan API PayPal di Supabase terlebih dahulu.');
    if(!turnstileToken){void mountTurnstile();throw Error(securityText('wait'));}
    const res=await fetch(cfg.url+'/functions/v1/gn-paypal-checkout',{
      method:'POST',headers:h,cache:'no-store',signal:AbortSignal.timeout(35000),
      body:JSON.stringify({action:'checkout',customer,items,turnstile_token:turnstileToken,promo_code:String(fd.get('promo_code')||'').trim().toUpperCase()})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(data.error||'Gagal membuat pembayaran PayPal.');
    if(!/^GN-PP-[A-F0-9]{24}$/.test(data.order_id)||typeof data.access_token!=='string'||data.access_token.length<50)throw Error(tr('badId'));
    const approval=new URL(data.approval_url);
    if(approval.protocol!=='https:'||approval.username||approval.password||approval.port||
       !['www.paypal.com','www.sandbox.paypal.com'].includes(approval.hostname))throw Error(tr('badUrl'));
    sessionStorage.setItem('gn_payment_'+data.order_id,JSON.stringify({token:data.access_token,created:Date.now(),provider:'paypal'}));
    info.textContent='Redirecting to PayPal...';
    window.location.assign(approval.href);return;
  }
  if(!available){await requestManualOrder(customer,items);processing=false;sync();return;}
  if(!turnstileToken){void mountTurnstile();throw Error(securityText('wait'));}
  const res=await fetch(endpoint,{method:'POST',headers:h,body:JSON.stringify({action:'checkout',customer,items,turnstile_token:turnstileToken,promo_code:String(fd.get('promo_code')||'').trim().toUpperCase()})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||tr('checkoutFail'));
  if(!/^GN-[A-Z0-9-]{8,45}$/.test(data.order_id)||typeof data.access_token!=='string')throw Error(tr('badId'));
  const url=new URL(data.redirect_url);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!(provider==='doku'?['checkout.doku.com']:['app.sandbox.midtrans.com','app.midtrans.com']).includes(url.hostname))throw Error(tr('badUrl'));
  sessionStorage.setItem('gn_payment_'+data.order_id,JSON.stringify({token:data.access_token,created:Date.now()}));
  message('redirect');
  window.location.assign(url.href);
 }catch(error){resetTurnstile();message(error instanceof Error?error.message:'unknown',true);processing=false;sync();}
});
})();