import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { dokuConfig, signature, safeEquals, applyDokuPayment } from '../_shared/doku.ts';
const reply=(status: number)=>new Response(JSON.stringify({ok:status===200}),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
  if(req.method!=='POST') return reply(405);
  const config=dokuConfig(),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // Continue processing existing payments even when new checkouts are disabled.
  if(!config.secret || !config.clientId || !url || !key) return reply(503);
  if(Number(req.headers.get('content-length')??0)>30000) return reply(413);
  const raw=await req.text(); if(new TextEncoder().encode(raw).length>30000) return reply(413);
  const clientId=req.headers.get('Client-Id')??'',requestId=req.headers.get('Request-Id')??'',timestamp=req.headers.get('Request-Timestamp')??'';
  if(clientId!==config.clientId || !requestId || requestId.length>128 || !Number.isFinite(Date.parse(timestamp))) return reply(401);
  const expected=await signature(config.secret,clientId,requestId,timestamp,'/functions/v1/gn-doku-webhook',raw);
  if(!safeEquals(expected,req.headers.get('Signature')??'')) return reply(401);
  let event; try{event=JSON.parse(raw)}catch{return reply(400)}
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  try{await applyDokuPayment(client,event)}catch{console.warn('DOKU notification could not be applied');return reply(422)}
  return reply(200);
});
