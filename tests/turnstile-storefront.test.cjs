const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function setup({rejectCheckout=false}={}){
 const elements=new Map(),handlers={},requests=[];let widgetOptions,resets=0;
 const make=id=>({id,hidden:false,textContent:'',innerHTML:'Midtrans',style:{},disabled:false,
  classList:{toggle(){}},setAttribute(){},before(el){elements.set(el.id,el)},
  addEventListener(event,fn){handlers[id+':'+event]=fn},querySelector(){return {focus(){}}},scrollIntoView(){},reportValidity(){return true}});
 for(const id of ['midtransForm','midtransInfo','midtransMode','midtransBtn','checkoutBtn','gnCheckoutWhatsAppBackup','midtransArea'])elements.set(id,make(id));
 const turnstile={render(holder,options){widgetOptions=options;return 'widget-test'},reset(){resets++}};
 const values={name:'Buyer',email:'buyer@example.com',phone:'081234567890',address:'Jalan Pengujian 10',province:'Jawa Tengah',city:'Semarang',district:'Semarang Tengah',postal_code:'50111',promo_code:''};
 const window={GN_CONFIG:{url:'https://project.supabase.co',publishableKey:'public'},GN_CART_SNAPSHOT:()=>[{sku:'SHIRT',qty:1}],addEventListener(){},location:{assign(url){requests.push({redirect:url})}}};
 const context=vm.createContext({console,URL,AbortSignal,setTimeout,clearTimeout,Promise,
  localStorage:{getItem:()=>JSON.stringify('id')},sessionStorage:{setItem(){}},FormData:class{get(key){return values[key]}},window,
  document:{getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[],addEventListener(){},createElement:tag=>make(tag),head:{appendChild(script){assert.match(script.src,/^https:\/\/challenges.cloudflare.com\/turnstile\/v0\/api.js\?render=explicit$/);window.turnstile=turnstile;script.onload()}}},
  fetch:async(url,init)=>{
   if(init?.method==='POST'){
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify(rejectCheckout?{error:'Verification rejected'}:{order_id:'GN-DK-'+'A'.repeat(24),access_token:'test-access',redirect_url:'https://checkout.doku.com/v2/test'}),{status:rejectCheckout?403:200});
   }
   return new Response(JSON.stringify({enabled:true,mode:'production',turnstile:{required:true,configured:true}}));
  }
 });
 vm.runInContext(fs.readFileSync('gn-midtrans.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 window.GN_MIDTRANS_OPEN();await new Promise(resolve=>setImmediate(resolve));
 return {elements,requests,submit:()=>handlers['midtransForm:submit']({preventDefault(){}}),widget:()=>widgetOptions,resets:()=>resets};
}
test('checkout renders supplied key with checkout action and blocks missing tokens',async()=>{
 const r=await setup();assert.equal(r.widget().sitekey,'0x4AAAAAAF3Q3TmIn0l4k_PE');assert.equal(r.widget().action,'checkout');
 await r.submit();assert.equal(r.requests.length,0);assert.match(r.elements.get('midtransInfo').textContent,/verifikasi keamanan/);
});
test('verified token is sent to the server before the DOKU redirect',async()=>{
 const r=await setup();r.widget().callback('one-use-token');await r.submit();
 assert.equal(r.requests[0].turnstile_token,'one-use-token');assert.equal(r.requests[1].redirect,'https://checkout.doku.com/v2/test');
});
test('expired token is not submitted and rejected submission resets the widget',async()=>{
 const expired=await setup();expired.widget().callback('expired');expired.widget()['expired-callback']();await expired.submit();assert.equal(expired.requests.length,0);
 const rejected=await setup({rejectCheckout:true});rejected.widget().callback('used-token');await rejected.submit();assert.equal(rejected.resets(),1);
 await rejected.submit();assert.equal(rejected.requests.length,1);
});
