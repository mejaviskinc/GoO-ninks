const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const {webcrypto,createHash,createHmac}=require('node:crypto');
const read=f=>stripTypeScriptTypes(fs.readFileSync('supabase/functions/'+f,'utf8')).replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const secrets={SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service',DOKU_CLIENT_ID:'test-client',DOKU_SECRET_KEY:'test-secret',DOKU_PAYMENTS_ENABLED:'true',DOKU_IS_PRODUCTION:'true'};
const orderId='GN-DK-'+ 'A'.repeat(24);
function runtime(slug,options={}){
 const updates=[],calls=[],writes=[];let handler;
 const order={order_id:orderId,amount:90000,status:'pending',created_at:new Date().toISOString(),...options.order};
 const client={from:table=>{
   const filters={}; const q={select:()=>q,eq:(key,value)=>{filters[key]=value;return q},
     update:value=>{writes.push(value);return q},
     maybeSingle:async()=>({data:table==='gn_orders' && (!filters.access_hash || filters.access_hash===createHash('sha256').update('t'.repeat(64)).digest('hex'))?order:null,error:null}),
     then:resolve=>resolve({error:null})};return q;
 },rpc:async(name,params)=>{
   calls.push({name,params});
   if(name==='gn_payment_reserve_v2')return {data:{gross_amount:90000,items:[{sku:'SHIRT',qty:1,price:100000},{sku:'GN-DISCOUNT',price:-10000,qty:1}]},error:null};
   updates.push(params);return {data:params.p_status,error:null};
 }};
 const context=vm.createContext({console,crypto:webcrypto,TextEncoder,URL,Request,Response,AbortSignal,btoa,Date,JSON,Uint8Array,
   Deno:{env:{get:key=>({...secrets,...options.secrets})[key]},serve:fn=>{handler=fn}},
   createClient:()=>client,fetch:async(url,init)=>{
    const body=JSON.parse(init.body);options.inspect?.(url,init,body);
    if(options.timeout)throw Error('timeout');
    return new Response(JSON.stringify({response:{order:{invoice_number:body.order.invoice_number,amount:body.order.amount},payment:{url:'https://checkout.doku.com/v2/test'}}}),{status:options.httpStatus??200});
   }});
 vm.runInContext(read('_shared/doku.ts')+'\n'+read(slug+'/index.ts'),context);
 return {handler,updates,calls,writes,context};
}
function checkoutRequest(body){return new Request('https://project.supabase.co/functions/v1/gn-doku-checkout',{method:'POST',headers:{origin:'https://gooninks.co.id','Content-Type':'application/json'},body:JSON.stringify(body)})}
const purchase={action:'checkout',customer:{name:'Test Buyer',email:'buyer@example.com',phone:'081234567890',address:'Jalan Pengujian Nomor 10',province:'Jawa Tengah',city:'Semarang',district:'Semarang Tengah',postal_code:'50111'},items:[{sku:'SHIRT',qty:1,price:1}],promo_code:'PROMO'};
async function notify(runtime,event,mutate=false){
 const raw=JSON.stringify(event),timestamp='2026-11-07T03:00:00Z',requestId='notification-test';
 const sig=await vm.runInContext(`signature('test-secret','test-client','${requestId}','${timestamp}','/functions/v1/gn-doku-webhook',${JSON.stringify(raw)})`,runtime.context);
 return runtime.handler(new Request('https://project.supabase.co/functions/v1/gn-doku-webhook',{method:'POST',headers:{'Client-Id':'test-client','Request-Id':requestId,'Request-Timestamp':timestamp,Signature:mutate?'tampered':sig},body:raw}));
}
const event={order:{invoice_number:orderId,amount:90000},transaction:{status:'SUCCESS',original_request_id:'test-request'},channel:{id:'QRIS'}};
test('HMAC matches independently calculated SHA256 digest and changes for body/path tampering',async()=>{
 const {context}=runtime('gn-doku-webhook');
 const body='{"test":true}',target='/functions/v1/gn-doku-webhook';
 const canonical='Client-Id:client\nRequest-Id:request\nRequest-Timestamp:2026-11-07T03:00:00Z\nRequest-Target:'+target+'\nDigest:'+createHash('sha256').update(body).digest('base64');
 const actual=await vm.runInContext(`signature('secret','client','request','2026-11-07T03:00:00Z','${target}',${JSON.stringify(body)})`,context);
 assert.equal(actual,'HMACSHA256='+createHmac('sha256','secret').update(canonical).digest('base64'));
 assert.notEqual(actual,await vm.runInContext(`signature('secret','client','request','2026-11-07T03:00:00Z','/other',${JSON.stringify(body)})`,context));
});
test('signed success updates paid, failed attempt does not release stock',async()=>{
 const r=runtime('gn-doku-webhook');assert.equal((await notify(r,event)).status,200);
 assert.equal(r.updates[0].p_status,'paid');assert.equal(r.updates[0].p_payment_type,'DOKU:QRIS');
 const failed=runtime('gn-doku-webhook');assert.equal((await notify(failed,{...event,transaction:{status:'FAILED'}})).status,200);assert.equal(failed.updates.length,0);
});
test('bad signature and wrong amount never update orders',async()=>{
 const r=runtime('gn-doku-webhook');assert.equal((await notify(r,event,true)).status,401);
 assert.equal((await notify(r,{...event,order:{...event.order,amount:1}})).status,422);assert.equal(r.updates.length,0);
});
test('old Midtrans invoices cannot be paid by DOKU webhook',async()=>{
 const r=runtime('gn-doku-webhook');assert.equal((await notify(r,{...event,order:{...event.order,invoice_number:'GN-OLD-12345678'}})).status,422);assert.equal(r.updates.length,0);
});
test('webhook continues for existing orders after new checkout is disabled',async()=>{
 const r=runtime('gn-doku-webhook',{secrets:{DOKU_PAYMENTS_ENABLED:'false'}});assert.equal((await notify(r,event)).status,200);
});
test('checkout uses database discounted total and a short distinct invoice',async()=>{
 const r=runtime('gn-doku-checkout',{inspect:(url,init,body)=>{
  assert.equal(url,'https://api.doku.com/checkout/v1/payment');assert.equal(body.order.amount,90000);assert.equal(body.order.invoice_number.length,30);
  assert.match(body.order.invoice_number,/^GN-DK-/);assert.match(init.headers.Signature,/^HMACSHA256=/);
 }});
 const res=await r.handler(checkoutRequest(purchase));assert.equal(res.status,200);const data=await res.json();assert.equal(data.amount,90000);assert.equal(r.updates.length,0);
});
test('ambiguous timeout retains stock; explicit rejection releases it',async()=>{
 const timeout=runtime('gn-doku-checkout',{timeout:true});assert.equal((await timeout.handler(checkoutRequest(purchase))).status,502);assert.equal(timeout.updates.length,0);
 const rejected=runtime('gn-doku-checkout',{httpStatus:401});assert.equal((await rejected.handler(checkoutRequest(purchase))).status,502);assert.equal(rejected.updates[0].p_status,'failed');
});
test('missing credentials disable checkout without reservations',async()=>{
 const r=runtime('gn-doku-checkout',{secrets:{DOKU_SECRET_KEY:''}});const get=await r.handler(new Request('https://example.com'));assert.equal((await get.json()).enabled,false);
 assert.equal((await r.handler(checkoutRequest(purchase))).status,503);assert.equal(r.calls.length,0);
});
test('private order token required and status remains readable with payments disabled',async()=>{
 const r=runtime('gn-doku-checkout',{secrets:{DOKU_PAYMENTS_ENABLED:'false'}});
 assert.equal((await r.handler(checkoutRequest({action:'status',order_id:orderId,access_token:'x'.repeat(64)}))).status,404);
 assert.equal((await r.handler(checkoutRequest({action:'status',order_id:orderId,access_token:'t'.repeat(64)}))).status,200);
});
async function storefront(doku){
 const elements=new Map();const element=id=>{
  if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',innerHTML:'Midtrans',setAttribute(){},classList:{toggle(){}},addEventListener(){},querySelector(){return {focus(){}}},scrollIntoView(){}});
  return elements.get(id);
 };
 const fetched=[];
 const context=vm.createContext({console,URL,AbortSignal,localStorage:{getItem:()=>JSON.stringify('id')},
   window:{GN_CONFIG:{url:'https://project.supabase.co',publishableKey:'public'},GN_CART_SNAPSHOT:()=>[{qty:1}],addEventListener(){}},
   document:{getElementById:element,querySelectorAll:()=>[element('label')],addEventListener(){}},
   fetch:async url=>{fetched.push(url);return new Response(JSON.stringify(url.endsWith('gn-doku-checkout')?doku:{enabled:true,mode:'production'}));}
 });
 vm.runInContext(fs.readFileSync('gn-midtrans.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
 return {elements,fetched};
}
test('storefront switches to configured live DOKU and displays matching labels',async()=>{
 const r=await storefront({enabled:true,mode:'production'});assert.equal(r.fetched.length,1);assert.match(r.elements.get('midtransBtn').textContent,/DOKU/);assert.match(r.elements.get('label').innerHTML,/DOKU/);
});
test('sandbox or unconfigured DOKU preserves existing live Midtrans checkout',async()=>{
 for(const doku of [{enabled:true,mode:'sandbox'},{enabled:false,mode:'production'}]){
  const r=await storefront(doku);assert.equal(r.fetched.length,2);assert.match(r.elements.get('midtransBtn').textContent,/Midtrans/);
 }
});
