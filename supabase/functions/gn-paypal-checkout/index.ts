
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
// GoO Ninks PayPal Orders v2: server-side inventory, USD conversion and capture verification.
// PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET in Edge Function secrets. Sandbox by default.
const originList=new Set(["https://gooninks.co.id","https://www.gooninks.co.id"]);
const dbUrl=Deno.env.get("SUPABASE_URL")??"";
const dbKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const conf=()=>({
  clientId:Deno.env.get("PAYPAL_CLIENT_ID")??"",
  clientSecret:Deno.env.get("PAYPAL_CLIENT_SECRET")??"",
  mode:Deno.env.get("PAYPAL_MODE")==="live"?"live":"sandbox",
  enabled:Deno.env.get("PAYPAL_PAYMENTS_ENABLED")!=="false",
});
const baseUrl=(c:ReturnType<typeof conf>)=>c.mode==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com";
const db=()=>createClient(dbUrl,dbKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const headers=(req:Request)=>({
 "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
 "Access-Control-Allow-Origin":originList.has(req.headers.get("origin")??"")?req.headers.get("origin")!:"https://gooninks.co.id",
 "Access-Control-Allow-Headers":"content-type, apikey, authorization, x-client-info",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin"
});
const respond=(r:Request,data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:headers(r)});
const hash=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))].map(n=>n.toString(16).padStart(2,"0")).join("");
const valid=(s:string,min:number,max:number)=>s.length>=min&&s.length<=max&&!/[<>\u0000-\u001f]/.test(s);
const money=(cents:number)=>(cents/100).toFixed(2);
const parseMoney=(s:unknown)=>typeof s==="string" && /^\d{1,10}\.\d{2}$/.test(s)?Number(s.replace(".","")):NaN;
const orderPattern=/^GN-PP-[A-F0-9]{24}$/;
let fxCache:{rate:number,checked:number,date:string}|null=null;
async function fxRate(){
  const configured=Number(Deno.env.get("PAYPAL_IDR_PER_USD")??"");
  if(Number.isFinite(configured)&&configured>=8000&&configured<=35000){
    return {rate:configured,date:new Date().toISOString().slice(0,10),source:"merchant_rate"};
  }
  if(fxCache&&Date.now()-fxCache.checked<3600000)return {...fxCache,source:"exchange_rate_api"};
  const res=await fetch("https://open.er-api.com/v6/latest/USD",{signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw Error("Nilai tukar sementara tidak tersedia. Coba beberapa saat lagi.");
  const fx=await res.json();
  const rate=Number(fx?.rates?.IDR),time=Number(fx?.time_last_update_unix);
  if(fx.result!=="success" || !Number.isFinite(rate)||rate<8000||rate>35000 ||
      !Number.isFinite(time)||Date.now()-time*1000>3*86400000){
    throw Error("Kurs USD/IDR tidak valid atau kedaluwarsa.");
  }
  fxCache={rate,checked:Date.now(),date:new Date(time*1000).toISOString().slice(0,10)};
  return {...fxCache,source:"exchange_rate_api"};
}
async function accessToken(c:ReturnType<typeof conf>){
  const credentials=btoa(c.clientId+":"+c.clientSecret);
  const r=await fetch(baseUrl(c)+"/v1/oauth2/token",{method:"POST",
    headers:{"Authorization":"Basic "+credentials,"Content-Type":"application/x-www-form-urlencoded"},
    body:"grant_type=client_credentials",signal:AbortSignal.timeout(14000)});
  if(!r.ok)throw Error("Kredensial PayPal belum valid untuk mode "+c.mode+".");
  const data=await r.json();if(typeof data.access_token!=="string")throw Error("Autentikasi PayPal gagal");
  return data.access_token as string;
}
async function api(c:ReturnType<typeof conf>,token:string,path:string,method="GET",payload?:unknown,requestId?:string){
  const r=await fetch(baseUrl(c)+path,{method,headers:{
    Authorization:"Bearer "+token,Accept:"application/json",
    "Content-Type":"application/json",
    ...(requestId?{"PayPal-Request-Id":requestId}:{})
  },body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(16000)});
  const data=await r.json().catch(()=>({}));
  return {ok:r.ok,status:r.status,data};
}
async function verifyTurnstile(token:unknown){
  const secret=Deno.env.get("TURNSTILE_SECRET_KEY");
  if(!secret)return false;
  if(typeof token!=="string"||token.length<10||token.length>2048)return false;
  try {
    const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret,response:token}),signal:AbortSignal.timeout(10000)});
    const result=await r.json();
    return r.ok && result.success===true && ["gooninks.co.id","www.gooninks.co.id"].includes(result.hostname) && result.action==="checkout";
  }catch{return false}
}
async function applyCapture(client:any,c:ReturnType<typeof conf>,payment:any,raw:any){
  const purchase=raw?.purchase_units?.[0];
  const capture=purchase?.payments?.captures?.find((x:any)=>x.status==="COMPLETED");
  if(!purchase||!capture || raw.status!=="COMPLETED" || raw.id!==payment.paypal_order_id ||
    purchase.custom_id!==payment.order_id || purchase.invoice_id!==payment.order_id ||
    purchase.amount?.currency_code!=="USD" || parseMoney(purchase.amount.value)!==payment.usd_cents ||
    capture.amount?.currency_code!=="USD" || parseMoney(capture.amount.value)!==payment.usd_cents ||
    typeof capture.id!=="string" || capture.id.length>100)throw Error("PayPal capture verification mismatch");
  const {data:order,error:orderError}=await client.from("gn_orders").select("order_id,status,amount").eq("order_id",payment.order_id).maybeSingle();
  if(orderError||!order||order.amount!==payment.amount_idr)throw Error("Server order amount mismatch");
  if(!["pending","paid","review"].includes(order.status))throw Error("Order is no longer payable");
  if(order.status!=="paid"){
    const {error}=await client.rpc("gn_payment_update_v1",{
      p_order_id:payment.order_id,p_status:"paid",p_payment_type:"PayPal:USD",
      p_transaction_id:capture.id,p_midtrans_status:"PAYPAL_COMPLETED"
    });
    if(error)throw error;
  }
  const {error:updateError}=await client.from("gn_paypal_payments").update({
    capture_id:capture.id,status:"completed",updated_at:new Date().toISOString()
  }).eq("order_id",payment.order_id);
  if(updateError)throw updateError;
}
async function reconcile(client:any,c:ReturnType<typeof conf>,payment:any){
  if(!payment.paypal_order_id||!["creating","created","approved","completed"].includes(payment.status))return;
  const token=await accessToken(c);
  let response=await api(c,token,"/v2/checkout/orders/"+encodeURIComponent(payment.paypal_order_id));
  if(!response.ok)return;
  if(response.data.status==="APPROVED"){
    const result=await api(c,token,"/v2/checkout/orders/"+encodeURIComponent(payment.paypal_order_id)+"/capture","POST",{},payment.order_id+"-capture");
    if(!result.ok && result.status!==422)throw Error("PayPal belum dapat mengonfirmasi pembayaran");
    response=await api(c,token,"/v2/checkout/orders/"+encodeURIComponent(payment.paypal_order_id));
    if(!response.ok)return;
  }
  if(response.data.status==="COMPLETED")await applyCapture(client,c,payment,response.data);
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
  const c=conf(),active=!!(c.clientId&&c.clientSecret&&dbUrl&&dbKey&&c.enabled&&Deno.env.get("TURNSTILE_SECRET_KEY"));
  if(req.method==="GET")return respond(req,{provider:"paypal",enabled:active,mode:c.mode,currency:"USD",fx_source:"ExchangeRate-API",webhook_configured:!!Deno.env.get("PAYPAL_WEBHOOK_ID")});
  if(req.method!=="POST")return respond(req,{error:"Metode tidak diizinkan"},405);
  if(!originList.has(req.headers.get("origin")??""))return respond(req,{error:"Origin tidak diizinkan"},403);
  if(Number(req.headers.get("content-length")??"0")>12000)return respond(req,{error:"Data terlalu besar"},413);
  let input:any;try{input=await req.json()}catch{return respond(req,{error:"Permintaan tidak valid"},400)}
  if(!input||typeof input!=="object"||Array.isArray(input))return respond(req,{error:"Data tidak valid"},400);
  if(!active)return respond(req,{error:"PayPal belum aktif. Tambahkan Client ID dan Client Secret di Supabase Secrets."},503);
  const client=db();
  if(input.action==="status"){
    const id=String(input.order_id??""),access=String(input.access_token??"");
    if(!orderPattern.test(id)||access.length<50||access.length>150)return respond(req,{error:"Akses pesanan tidak valid"},400);
    const accessHash=await hash(access);
    const {data:row,error}=await client.from("gn_orders").select("order_id,status,amount,created_at,payment_type")
      .eq("order_id",id).eq("access_hash",accessHash).maybeSingle();
    if(error||!row)return respond(req,{error:"Pesanan tidak ditemukan"},404);
    const {data:payment}=await client.from("gn_paypal_payments").select("*").eq("order_id",id).maybeSingle();
    if(row.status==="pending" && payment?.paypal_order_id){
      try{await reconcile(client,c,payment)}catch{console.warn("PayPal status reconciliation unavailable",id)}
    }
    const {data:fresh}=await client.from("gn_orders").select("order_id,status,amount,created_at,payment_type").eq("order_id",id).eq("access_hash",accessHash).maybeSingle();
    const {data:ship}=await client.from("gn_shipments").select("status,carrier,tracking_number").eq("order_id",id).maybeSingle();
    const result=fresh??row;
    return respond(req,{order:result,shipping:ship?{
      status:ship.status,carrier:result.status==="paid"?ship.carrier:"",
      tracking_number:result.status==="paid"?ship.tracking_number:""}:null});
  }
  if(input.action!=="checkout")return respond(req,{error:"Aksi tidak dikenali"},400);
  if(!await verifyTurnstile(input.turnstile_token))return respond(req,{error:"Selesaikan verifikasi keamanan checkout terlebih dahulu."},403);
  const rawItems=input.items,customer=input.customer;
  if(!Array.isArray(rawItems)||rawItems.length<1||rawItems.length>15||!customer||typeof customer!=="object")
    return respond(req,{error:"Keranjang tidak valid"},400);
  const name=String(customer.name??"").trim().slice(0,101);
  const email=String(customer.email??"").trim().toLowerCase().slice(0,181);
  const phone=String(customer.phone??"").trim().slice(0,26);
  const street=String(customer.address??"").trim();
  const province=String(customer.province??"").trim(),city=String(customer.city??"").trim(),district=String(customer.district??"").trim(),postal=String(customer.postal_code??"").trim();
  const address=[street,district,city,province,postal].join(", ");
  if(!valid(name,2,100)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[+0-9\-\s()]{9,25}$/.test(phone)
    ||!valid(street,10,260)||!valid(province,3,80)||!valid(city,3,80)||!valid(district,3,100)||!/^[0-9]{5}$/.test(postal)||address.length>450)
    return respond(req,{error:"Lengkapi nama, email, nomor telepon, dan alamat Indonesia beserta kode pos."},400);
  const items=rawItems.map((x:any)=>({sku:String(x?.sku??"").slice(0,101),qty:x?.qty,note:String(x?.note??"").slice(0,120)}));
  const id="GN-PP-"+crypto.randomUUID().replaceAll("-","").slice(0,24).toUpperCase();
  const privateToken=crypto.randomUUID()+crypto.randomUUID();
  const privateHash=await hash(privateToken);
  const ip=(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown").slice(0,100);
  const fp=await hash(ip+"|"+c.clientSecret);
  let reserved=false,mayExist=false;
  try{
    // FX is confirmed before reserving stock. No hard-coded USD conversion in the browser.
    const fx=await fxRate();
    const {data:reservation,error:reservationError}=await client.rpc("gn_payment_reserve_v2",{
      p_order_id:id,p_access_hash:privateHash,p_customer:{name,email,phone,address},
      p_items:items,p_fingerprint:fp,p_promo_code:String(input.promo_code??"").trim().toUpperCase().slice(0,33)
    });
    if(reservationError||!reservation)return respond(req,{error:reservationError?.message??"Stok tidak tersedia"},409);
    reserved=true;
    const amountIdr=Number(reservation.gross_amount);
    const cents=Math.round(amountIdr/fx.rate*100);
    if(!Number.isSafeInteger(cents)||cents<100||cents>10000000)throw Error("Harga dalam USD berada di luar batas checkout.");
    const {error:saveError}=await client.from("gn_paypal_payments").insert({
      order_id:id,amount_idr:amountIdr,usd_cents:cents,idr_per_usd:fx.rate,
      fx_date:fx.date,mode:c.mode,status:"creating"
    });
    if(saveError)throw Error("Unable to save PayPal checkout");
    const token=await accessToken(c);
    const link="https://gooninks.co.id/payment-status.html?order_id="+encodeURIComponent(id);
    const body={
      intent:"CAPTURE",
      purchase_units:[{reference_id:id,custom_id:id,invoice_id:id,
        description:"GoO Ninks fashion purchase",amount:{currency_code:"USD",value:money(cents)}}],
      payment_source:{paypal:{experience_context:{
        return_url:link,cancel_url:link+"&cancelled=1",
        user_action:"PAY_NOW",shipping_preference:"NO_SHIPPING"
      }}}
    };
    mayExist=true;
    const pp=await api(c,token,"/v2/checkout/orders","POST",body,id);
    if(!pp.ok){
      if([400,401,403,422].includes(pp.status))mayExist=false;
      throw Error("PayPal create order failed");
    }
    const ppId=pp.data.id,linkObj=(pp.data.links??[]).find((x:any)=>["payer-action","approve"].includes(x.rel));
    if(typeof ppId!=="string"||!/^[A-Z0-9]{10,25}$/.test(ppId) || pp.data.status!=="PAYER_ACTION_REQUIRED" && pp.data.status!=="CREATED" ||
      typeof linkObj?.href!=="string")throw Error("Invalid PayPal approval response");
    const approval=new URL(linkObj.href);
    if(approval.protocol!=="https:"||approval.username||approval.password||approval.port||
      !["www.paypal.com","www.sandbox.paypal.com"].includes(approval.hostname))throw Error("Unexpected PayPal approval URL");
    const {error:paidError}=await client.from("gn_paypal_payments").update({paypal_order_id:ppId,status:"created",updated_at:new Date().toISOString()}).eq("order_id",id);
    if(paidError)throw paidError;
    await client.from("gn_orders").update({payment_url:approval.href,payment_type:"PayPal:USD"}).eq("order_id",id);
    return respond(req,{order_id:id,access_token:privateToken,approval_url:approval.href,
      amount_idr:amountIdr,amount_usd:money(cents),rate:fx.rate,rate_date:fx.date,mode:c.mode});
  }catch(e){
    if(reserved&&!mayExist){
      try{await client.rpc("gn_payment_update_v1",{p_order_id:id,p_status:"failed",p_midtrans_status:"paypal_checkout_error"})}catch{}
    }
    console.error("PayPal checkout setup failed",id,e instanceof Error?e.message:"unknown");
    return respond(req,{error:mayExist?"Sesi PayPal mungkin sudah dibuat. Hubungi admin menggunakan nomor pesanan "+id+" sebelum mencoba lagi.":"Gagal membuat pembayaran PayPal. Silakan coba lagi."},502);
  }
});
