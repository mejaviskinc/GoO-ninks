// DOKU Checkout Non-SNAP. Secrets stay in Edge Function environment variables.
export const dokuConfig = () => ({
  clientId: Deno.env.get('DOKU_CLIENT_ID') ?? '',
  secret: Deno.env.get('DOKU_SECRET_KEY') ?? '',
  production: Deno.env.get('DOKU_IS_PRODUCTION') === 'true',
  enabled: Deno.env.get('DOKU_PAYMENTS_ENABLED') === 'true',
});
const base64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export async function signature(secret: string, clientId: string, requestId: string, timestamp: string, target: string, body?: string) {
  let value = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${target}`;
  if (body !== undefined) value += '\nDigest:' + base64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return 'HMACSHA256=' + base64(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));
}
export function safeEquals(a: string,b: string) {
  if(a.length !== b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
export async function dokuRequest(config: ReturnType<typeof dokuConfig>, target: string, body?: string) {
  const requestId=crypto.randomUUID(), timestamp=new Date().toISOString().replace(/\.\d{3}Z$/,'Z');
  return fetch((config.production?'https://api.doku.com':'https://api-sandbox.doku.com')+target,{
    method:body===undefined?'GET':'POST',
    headers:{'Client-Id':config.clientId,'Request-Id':requestId,'Request-Timestamp':timestamp,
      Signature:await signature(config.secret,config.clientId,requestId,timestamp,target,body),
      'Content-Type':'application/json',Accept:'application/json'},
    body,signal:AbortSignal.timeout(15000),
  });
}
export function validDokuUrl(value: string,production: boolean) {
  const url=new URL(value);
  return url.protocol==='https:' && !url.username && !url.password && !url.port &&
    url.hostname===(production?'checkout.doku.com':'sandbox.doku.com');
}
// Ignore individual failed/expired payment methods: Checkout can still be retried.
export async function applyDokuPayment(client: any, event: any) {
  const id=String(event?.order?.invoice_number??'');
  if(!/^GN-DK-[A-F0-9]{24}$/.test(id)) throw Error('Invalid DOKU invoice');
  const {data:order,error}=await client.from('gn_orders').select('amount,status').eq('order_id',id).maybeSingle();
  if(error) throw error;
  if(!order || !Number.isSafeInteger(Number(event?.order?.amount)) || Number(event.order.amount)!==Number(order.amount)) throw Error('Order amount mismatch');
  const status=String(event?.transaction?.status??'');
  if(status!=='SUCCESS') return order.status;
  const {data,error:updateError}=await client.rpc('gn_payment_update_v1',{
    p_order_id:id,p_status:'paid',p_payment_type:('DOKU:'+String(event.channel?.id??'CHECKOUT')).slice(0,65),
    p_transaction_id:String(event.transaction.original_request_id??'').slice(0,100),p_midtrans_status:'DOKU_SUCCESS',
  });
  if(updateError) throw updateError;
  return data;
}
