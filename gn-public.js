'use strict';
(async()=>{
 if(!window.GN_CONFIG||!window.supabase?.createClient)return;
 const api=window.supabase.createClient(GN_CONFIG.url,GN_CONFIG.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const el=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x};
 const put=(parent,tag,cls,txt)=>{const x=el(tag,cls,txt);parent.append(x);return x};
 const validUrl=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
 const loc=()=>{try{return JSON.parse(localStorage.getItem('goo-ninks-lang')||'"id"')}catch{return 'id'}};
 const langTexts={id:['Promosi spesial','Jurnal & artikel','Kirim permintaan','Saya setuju dihubungi tentang permintaan ini.','Permintaan berhasil dikirim','Nama','Email / WhatsApp','Kebutuhan atau pertanyaan'],
 en:['Special offers','Stories & journal','Send inquiry','I agree to be contacted about this inquiry.','Inquiry submitted','Name','Email / WhatsApp','Your request'],
 nl:['Speciale aanbiedingen','Verhalen & artikelen','Verstuur aanvraag','Ik stem in met contact over deze aanvraag.','Aanvraag verzonden','Naam','E-mail / WhatsApp','Uw vraag'],
 ko:['특별 프로모션','스토리 & 기사','문의 보내기','문의 관련 연락에 동의합니다.','문의가 접수되었습니다.','이름','이메일 / WhatsApp','문의 사항']};
 let t=langTexts[loc()]||langTexts.id;
 let products=[];
 function photos(){document.querySelectorAll('#productGrid [data-open]').forEach(btn=>{const row=products.find(x=>x.sku===btn.dataset.open),url=row&&validUrl(row.image_url);if(!url)return;const visual=btn.closest('.product-visual');if(visual&& !visual.querySelector('.gn-photo')){const img=el('img','gn-photo');img.src=url;img.alt=row.product_name;img.loading='lazy';visual.prepend(img)}})}
 async function inventory(){
  const {data,error}=await api.from('gn_inventory').select('sku,product_name,price,stock,visible,image_url');
  if(error){console.warn('Inventory:',error.message);return}products=data||[];
  if(typeof PRODUCTS!=='undefined'){PRODUCTS.forEach(p=>{const r=products.find(x=>x.sku===p.id);if(r){p.name=r.product_name;p.price=r.price;p.stock=r.stock;p.visible=r.visible;p.image_url=validUrl(r.image_url)}else p.visible=false});if(typeof renderProducts==='function')renderProducts();if(typeof renderCart==='function')renderCart()}
  const grid=document.querySelector('#productGrid');if(!grid)return;
  photos();new MutationObserver(photos).observe(grid,{childList:true});
  grid.addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(!b)return;const item=products.find(p=>p.sku===b.dataset.open),src=item&&validUrl(item.image_url);if(!src)return;requestAnimationFrame(()=>{const d=document.querySelector('#detailImage');if(d){const img=el('img','gn-detail-photo');img.src=src;img.alt=item.product_name;d.replaceChildren(img)}})});
 }
 const section=(title,klass)=>{const s=el('section',klass),wrap=put(s,'div','gn-inner');put(wrap,'h2','gn-title',title);return [s,wrap]};

 const specialLabels={
  id:{code:'Kode promo',confirm:'Konfirmasi penawaran ↗',message:'Halo GoO Ninks, saya ingin menanyakan promo',footer:'Mohon konfirmasi ketentuan dan harga akhirnya.'},
  en:{code:'Promo code',confirm:'Ask about this offer ↗',message:'Hello GoO Ninks, I would like to ask about the offer',footer:'Please confirm terms and the final price.'},
  nl:{code:'Promocode',confirm:'Vraag naar aanbieding ↗',message:'Hallo GoO Ninks, ik heb een vraag over aanbieding',footer:'Graag voorwaarden en de eindprijs bevestigen.'},
  ko:{code:'프로모션 코드',confirm:'혜택 문의 ↗',message:'안녕하세요 GoO Ninks, 프로모션 문의드립니다',footer:'이용 조건과 최종 가격을 확인해 주세요.'}
 };
 let liveOffers=[];
 const offerLang=()=>specialLabels[loc()]||specialLabels.id;
 function renderSpecialOffers(){
  const box=document.querySelector('#gnSpecialOffers'),empty=document.querySelector('#gnSpecialEmpty');
  if(!box||!empty)return;
  box.replaceChildren();
  const eligible=liveOffers.filter(p=>p&&typeof p.title==='string'&&p.title.trim().length>0);
  empty.hidden=eligible.length>0;box.hidden=eligible.length===0;
  const words=offerLang();
  eligible.forEach(p=>{
   const card=put(box,'article','gn-special-offer');
   const percentage=Number(p.discount_percent);
   const validDiscount=Number.isInteger(percentage)&&percentage>0&&percentage<=100;
   put(card,'div','gn-special-offer-discount'+(validDiscount?'':' gn-special-symbol'),validDiscount?'-'+percentage+'%':'✳');
   const body=put(card,'div','gn-special-offer-body');
   put(body,'h3','',p.title);
   if(p.description)put(body,'p','',p.description);
   if(p.code){const code=put(body,'span','gn-special-offer-code');code.textContent=words.code+': '+p.code;}
   const msg=words.message+' "'+p.title+'".'+(p.code?' '+words.code+': '+p.code+'.':'')+' '+words.footer;
   const link=put(body,'a','gn-special-offer-link',words.confirm);
   link.href='https://wa.me/6285740393953?text='+encodeURIComponent(msg);
   link.target='_blank';link.rel='noopener noreferrer';
  });
 }
 async function promos(){
  if(!document.querySelector('#gnSpecialOffers'))return;
  try{
   const {data,error}=await api.from('gn_promotions')
    .select('title,description,code,discount_percent,start_at,end_at')
    .eq('active',true)
    .order('created_at',{ascending:false})
    .limit(6);
   if(error)throw error;
   const now=Date.now();
   liveOffers=(data||[]).filter(p=>
     (!p.start_at||Date.parse(p.start_at)<=now)&&
     (!p.end_at||Date.parse(p.end_at)>=now)
   ).slice(0,3);
   renderSpecialOffers();
  }catch(error){console.warn('Special Price:',error.message)}
 }
 const dynamicCopy={
  id:{lead:'Custom, seragam, atau kolaborasi?',article:'Baca selengkapnya ↗',error:'Gagal mengirim. Hubungi WhatsApp GoO Ninks.'},
  en:{lead:'Custom orders, uniforms, or collaboration?',article:'Read more ↗',error:'Could not send your inquiry. Contact GoO Ninks on WhatsApp.'},
  nl:{lead:'Maatwerk, uniformen of samenwerking?',article:'Lees meer ↗',error:'Verzenden mislukt. Neem contact op via WhatsApp.'},
  ko:{lead:'맞춤 제작, 유니폼 또는 협업 문의',article:'자세히 보기 ↗',error:'전송에 실패했습니다. WhatsApp으로 문의해 주세요.'}
 };
 const dynamicWords=()=>dynamicCopy[loc()]||dynamicCopy.id;
 function syncDynamicLanguage(){
  t=langTexts[loc()]||langTexts.id;
  const head=document.querySelector('.gn-articles .gn-title');if(head)head.textContent=t[1];
  document.querySelectorAll('.gn-articles .gn-offer strong').forEach(el=>el.textContent=dynamicWords().article);
  const lead=document.querySelector('.gn-lead-box');
  if(lead){
   const title=lead.querySelector('h3');if(title)title.textContent=dynamicWords().lead;
   const inputs=lead.querySelectorAll('form input:not(.gn-honey)');
   if(inputs.length>=3){inputs[0].placeholder=t[5];inputs[1].placeholder=t[6];inputs[2].placeholder=t[7];}
   const label=lead.querySelector('.gn-consent span');if(label)label.textContent=t[3];
   const send=lead.querySelector('.gn-send');if(send)send.textContent=t[2];
  }
  renderSpecialOffers();
 }
 window.addEventListener('gn-language-changed',syncDynamicLanguage);
 async function ads(){if(document.body.dataset.page!=='collection')return;const {data,error}=await api.from('gn_ads').select('title,image_url,link_url').eq('active',true).limit(6);if(error||!data?.length)return;const [s,w]=section('GoO Ninks — Featured','gn-ads');const grid=put(w,'div','gn-grid');data.forEach(a=>{const card=put(grid,'article','gn-offer'),u=validUrl(a.link_url),img=validUrl(a.image_url);const target=u?put(card,'a'):card;if(u){target.href=u;target.rel='noopener noreferrer sponsored';target.target='_blank'}if(img){const image=put(target,'img','gn-card-img');image.src=img;image.alt=a.title;image.loading='lazy'}put(target,'h3','',a.title)});document.querySelector('#collection')?.insertAdjacentElement('beforebegin',s)}
 async function articles(){
  const page=document.body.dataset.page||'home';if(!['home','journal'].includes(page))return;
  const mount=document.querySelector('#journalMount');
  try{
   const {data,error}=await api.from('gn_articles').select('title,slug,excerpt,image_url').eq('status','published').order('created_at',{ascending:false}).limit(page==='journal'?100:3);
   if(error)throw error;
   if(!data?.length){if(mount){mount.replaceChildren();const msg=put(mount,'p','journal-status',tr('journalEmpty'));msg.dataset.i18n='journalEmpty'}return;}
   const [s,w]=section(t[1],'gn-articles');s.id='journal';
   if(page==='journal')w.querySelector('h2').remove();
   const grid=put(w,'div','gn-grid');
   data.forEach(a=>{const card=put(grid,'article','gn-offer'),link=put(card,'a'),img=validUrl(a.image_url);link.href='article.html?slug='+encodeURIComponent(a.slug);if(img){const image=put(link,'img','gn-card-img');image.src=img;image.alt=a.title;image.loading='lazy'}put(link,'h3','',a.title);put(link,'p','',a.excerpt);put(link,'strong','',dynamicWords().article)});
   if(mount)mount.replaceChildren(s);else document.querySelector('#main')?.append(s);
  }catch(error){if(mount){mount.replaceChildren();const msg=put(mount,'p','journal-status',tr('journalError'));msg.dataset.i18n='journalError';const retry=put(mount,'button','outline-btn journal-retry',tr('journalRetry'));retry.dataset.i18n='journalRetry';retry.addEventListener('click',()=>{retry.disabled=true;articles()})}console.warn('Journal:',error.message)}
 }

 function leads(){const contact=document.querySelector('#contact');if(!contact)return;const div=put(contact,'div','gn-lead-box');put(div,'h3','',dynamicWords().lead);const form=put(div,'form','gn-lead-form');const name=put(form,'input');name.placeholder=t[5];name.maxLength=120;name.required=true;name.minLength=2;const address=put(form,'input');address.placeholder=t[6];address.maxLength=254;address.required=true;const interest=put(form,'input');interest.placeholder=t[7];interest.maxLength=160;const honey=put(form,'input','gn-honey');honey.autocomplete='off';honey.tabIndex=-1;const label=put(form,'label','gn-consent');const agree=put(label,'input');agree.type='checkbox';agree.required=true;put(label,'span','',t[3]);const submit=put(form,'button','gn-send',t[2]);submit.type='submit';const note=put(form,'p','gn-message');note.setAttribute('role','status');
 form.addEventListener('submit',async e=>{e.preventDefault();if(honey.value)return;const raw=address.value.trim();const payload={name:name.value.trim(),email:raw.includes('@')?raw:'',phone:raw.includes('@')?'':raw,interest:interest.value.trim(),consent:true,source:'website'};submit.disabled=true;try{const {error}=await api.from('gn_leads').insert(payload);if(error)throw error;note.textContent=t[4];form.reset()}catch(err){console.warn('Lead submission:',err.message);note.textContent=dynamicWords().error}finally{submit.disabled=false}});
 }
 async function articlePage(){const root=document.querySelector('#articleBody');if(!root)return false;const slug=new URLSearchParams(location.search).get('slug');if(!slug||!/^[a-z0-9-]{1,180}$/.test(slug)){root.textContent='Artikel tidak ditemukan';return true}const {data,error}=await api.from('gn_articles').select('title,body,excerpt,image_url,created_at').eq('slug',slug).eq('status','published').maybeSingle();if(error||!data){root.textContent='Artikel tidak ditemukan';return true}root.replaceChildren();document.title=data.title+' | GoO Ninks';document.querySelector('meta[name="description"]')?.setAttribute('content',data.excerpt||data.title);document.querySelector('meta[property="og:title"]')?.setAttribute('content',document.title);document.querySelector('meta[property="og:description"]')?.setAttribute('content',data.excerpt||data.title);const canonical=location.origin+'/article.html?slug='+encodeURIComponent(slug);document.querySelector('link[rel="canonical"]')?.setAttribute('href',canonical);document.querySelector('meta[property="og:url"]')?.setAttribute('content',canonical);put(root,'h1','gn-story-title',data.title);put(root,'small','',new Date(data.created_at).toLocaleDateString('id-ID'));const cover=validUrl(data.image_url);if(cover){const img=put(root,'img','gn-story-image');img.src=cover;img.alt=data.title}put(root,'div','gn-story-body',data.body);return true}
 if(await articlePage()){await inventory();return;}await Promise.allSettled([inventory(),promos(),ads(),articles()]);leads();syncDynamicLanguage();
})();
