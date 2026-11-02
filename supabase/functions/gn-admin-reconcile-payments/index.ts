import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PAYMENT_KEY = Deno.env.get("MIDTRANS_SERVER_KEY") ?? "";
const PROD = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
const ORIGIN = "https://admin.gooninks.co.id";
const headers = {"Content-Type":"application/json","Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Cache-Control":"no-store","Vary":"Origin"};
const reply = (data,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 if(req.headers.get("origin")!==ORIGIN)return reply({error:"Origin not allowed"},403);
 if(!URL||!KEY||!PAYMENT_KEY)return reply({error:"Konfigurasi Midtrans belum lengkap"},503);
 const token=(req.headers.get("authorization")??"").match(/^Bearer\s+(\S+)$/i)?.[1];
 if(!token)return reply({error:"Sesi admin diperlukan"},401);
 const db=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authErr}=await db.auth.getUser(token);
 if(authErr||!auth?.user)return reply({error:"Sesi admin tidak valid"},401);
 const {data:staff,error:staffErr}=await db.from("gn_admins").select("role").eq("user_id",auth.user.id).maybeSingle();
 if(staffErr||!staff||!["admin","owner"].includes(staff.role))return reply({error:"Akses admin diperlukan"},403);
 let input;try{input=await req.json()}catch{return reply({error:"JSON tidak valid"},400)}
 if(input?.action!=="reconcile")return reply({error:"Aksi tidak dikenal"},400);
 const {data:orders,error:loadErr}=await db.from("gn_orders").select("order_id,amount").eq("status","pending").order("created_at",{ascending:true}).limit(20);
 if(loadErr)return reply({error:"Gagal memuat transaksi"},500);
 const result={scanned:orders.length,updated:0,pending:0,unresolved:0,errors:0,items:[]};
 for(const order of orders){
  try{
   const base=PROD?"https://api.midtrans.com":"https://api.sandbox.midtrans.com";
   const res=await fetch(base+"/v2/"+encodeURIComponent(order.order_id)+"/status",{headers:{Authorization:"Basic "+btoa(PAYMENT_KEY+":"),Accept:"application/json"},signal:AbortSignal.timeout(8000)});
   if(res.status===401||res.status===403)return reply({error:"Kunci Midtrans tidak sesuai dengan mode pembayaran"},502);
   if(res.status===404){result.unresolved++;result.items.push({order_id:order.order_id,result:"not_found"});continue}
   if(!res.ok)throw Error("Midtrans HTTP "+res.status);
   const tx=await res.json();
   if(tx.order_id!==order.order_id||Number(tx.gross_amount)!==Number(order.amount)){
    result.unresolved++;result.items.push({order_id:order.order_id,result:"amount_mismatch"});continue;
   }
   const state=tx.transaction_status;
   const paid=state==="settlement"||(state==="capture"&&tx.fraud_status==="accept");
   const next=paid?"paid":state==="expire"?"expired":state==="cancel"?"cancelled":(state==="deny"||state==="failure")?"failed":(state==="refund"||state==="partial_refund")?"refunded":null;
   if(!next){result.pending++;result.items.push({order_id:order.order_id,result:"pending",provider_status:String(state??"unknown").slice(0,50)});continue}
   const {data:updated,error:rpcErr}=await db.rpc("gn_payment_update_v1",{p_order_id:order.order_id,p_status:next,p_payment_type:String(tx.payment_type??"").slice(0,65),p_transaction_id:String(tx.transaction_id??"").slice(0,100),p_midtrans_status:String(state??"").slice(0,50)});
   if(rpcErr)throw rpcErr;
   result.updated++;result.items.push({order_id:order.order_id,result:String(updated)});
  }catch(err){result.errors++;result.items.push({order_id:order.order_id,result:"check_failed"});console.warn("Payment reconciliation",order.order_id,err instanceof Error?err.message:"unknown")}
 }
 return reply(result);
});
