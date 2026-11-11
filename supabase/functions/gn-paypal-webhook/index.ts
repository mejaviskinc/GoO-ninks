
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
// PayPal webhook: verify event signature with PayPal, verify exact captured currency/amount
// against server-stored original order and only then mark order paid.
const project=Deno.env.get("SUPABASE_URL")??"";
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const cid=Deno.env.get("PAYPAL_CLIENT_ID")??"";
const csecret=Deno.env.get("PAYPAL_CLIENT_SECRET")??"";
const wid=Deno.env.get("PAYPAL_WEBHOOK_ID")??"";
const base=Deno.env.get("PAYPAL_MODE")==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com";
const response=(code:number)=>new Response(JSON.stringify({ok:code===200}),{status:code,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const parseCents=(s:unknown)=>typeof s==="string"&&/^\d{1,10}\.\d{2}$/.test(s)?Number(s.replace(".","")):NaN;
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return response(405);
 if(!cid||!csecret||!wid||!project||!service)return response(503);
 if(Number(req.headers.get("content-length")??"0")>30000)return response(413);
 const raw=await req.text();if(new TextEncoder().encode(raw).length>30000)return response(413);
 let evt:any;try{evt=JSON.parse(raw)}catch{return response(400)}
 const tid=req.headers.get("paypal-transmission-id")??"";
 const ttime=req.headers.get("paypal-transmission-time")??"";
 const cert=req.headers.get("paypal-cert-url")??"";
 const algo=req.headers.get("paypal-auth-algo")??"";
 const sig=req.headers.get("paypal-transmission-sig")??"";
 if(!tid||tid.length>100||!ttime||!sig||sig.length>800||algo!=="SHA256withRSA"||
   !Number.isFinite(Date.parse(ttime))||Math.abs(Date.now()-Date.parse(ttime))>10*60000)return response(401);
 let certURL:URL;try{certURL=new URL(cert)}catch{return response(401)}
 if(certURL.protocol!=="https:"||certURL.username||certURL.password||certURL.port||
   !["api-m.paypal.com","api-m.sandbox.paypal.com","api.paypal.com","api.sandbox.paypal.com"].includes(certURL.hostname))return response(401);
 try{
   const auth=await fetch(base+"/v1/oauth2/token",{method:"POST",headers:{
     Authorization:"Basic "+btoa(cid+":"+csecret),"Content-Type":"application/x-www-form-urlencoded"
   },body:"grant_type=client_credentials",signal:AbortSignal.timeout(12000)});
   if(!auth.ok)return response(503);
   const a=await auth.json(),token=a.access_token;
   if(typeof token!=="string")return response(503);
   const verify=await fetch(base+"/v1/notifications/verify-webhook-signature",{
     method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
     body:JSON.stringify({
       auth_algo:algo,cert_url:cert,transmission_id:tid,transmission_sig:sig,
       transmission_time:ttime,webhook_id:wid,webhook_event:evt
     }),signal:AbortSignal.timeout(14000)
   });
   if(!verify.ok)return response(503);
   const verdict=await verify.json();
   if(verdict.verification_status!=="SUCCESS")return response(401);
   if(evt.event_type!=="PAYMENT.CAPTURE.COMPLETED")return response(200);
   const ppId=String(evt?.resource?.supplementary_data?.related_ids?.order_id??"");
   const captureId=String(evt?.resource?.id??"");
   if(!/^[A-Z0-9]{10,25}$/.test(ppId)||!captureId||captureId.length>100)return response(422);
   const db=createClient(project,service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   const {data:payment,error}=await db.from("gn_paypal_payments").select("*").eq("paypal_order_id",ppId).maybeSingle();
   if(error||!payment)return response(422);
   const orderResponse=await fetch(base+"/v2/checkout/orders/"+encodeURIComponent(ppId),{
      headers:{Authorization:"Bearer "+token,Accept:"application/json"},signal:AbortSignal.timeout(14000)});
   if(!orderResponse.ok)return response(503);
   const pp=await orderResponse.json(),unit=pp?.purchase_units?.[0];
   const capture=unit?.payments?.captures?.find((c:any)=>c.id===captureId&&c.status==="COMPLETED");
   if(pp.status!=="COMPLETED"||pp.id!==ppId||!unit||!capture||
      unit.custom_id!==payment.order_id||unit.invoice_id!==payment.order_id||
      unit.amount?.currency_code!=="USD"||parseCents(unit.amount.value)!==payment.usd_cents||
      capture.amount?.currency_code!=="USD"||parseCents(capture.amount.value)!==payment.usd_cents||
      String(evt.resource.status)!=="COMPLETED")return response(422);
   const {data:order,error:orderErr}=await db.from("gn_orders").select("amount,status").eq("order_id",payment.order_id).maybeSingle();
   if(orderErr||!order||order.amount!==payment.amount_idr)return response(422);
   if(order.status!=="paid"){
     const {error:e}=await db.rpc("gn_payment_update_v1",{
       p_order_id:payment.order_id,p_status:"paid",p_payment_type:"PayPal:USD",
       p_transaction_id:captureId,p_midtrans_status:"PAYPAL_COMPLETED"
     });
     if(e)return response(503);
   }
   const {error:update}=await db.from("gn_paypal_payments").update({status:"completed",capture_id:captureId,
     updated_at:new Date().toISOString()}).eq("order_id",payment.order_id);
   if(update)return response(503);
   return response(200);
 }catch(e){console.error("PayPal webhook processing unavailable",e instanceof Error?e.name:"error");return response(503)}
});
