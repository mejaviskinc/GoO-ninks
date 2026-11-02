import { createClient } from "npm:@supabase/supabase-js@2.57.0";
// GoO ninks order tracking: read-only public lookup with a 256-bit secret or original
// private checkout token. Tracking links and customer data never appear in anonymous SQL.
const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const allowed = new Set(["https://gooninks.co.id","https://www.gooninks.co.id","https://admin.gooninks.co.id"]);
const originFor = (r: Request) => allowed.has(r.headers.get("origin") ?? "") ? r.headers.get("origin")! : "https://gooninks.co.id";
const headersFor = (r: Request) => ({
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store",
  "Access-Control-Allow-Origin":originFor(r),
  "Access-Control-Allow-Headers":"apikey,authorization,content-type,x-client-info",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Vary":"Origin",
});
const respond = (r: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {status,headers:headersFor(r)});
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
};
const orderFormat = /^GN-[A-Z0-9-]{8,45}$/;
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:headersFor(request)});
  if (request.method !== "POST") return respond(request,{error:"Metode tidak tersedia"},405);
  if (!allowed.has(request.headers.get("origin") ?? "")) return respond(request,{error:"Asal permintaan tidak diizinkan"},403);
  if (!projectUrl || !serviceKey) return respond(request,{error:"Layanan pelacakan belum siap"},503);
  if (Number(request.headers.get("content-length") ?? "0") > 4500) return respond(request,{error:"Permintaan terlalu besar"},413);
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return respond(request,{error:"Permintaan tidak valid"},400); }
  if (!input || typeof input !== "object") return respond(request,{error:"Data tidak valid"},400);
  const action = String(input.action ?? "");
  const orderId = String(input.order_id ?? "").trim();
  if (!orderFormat.test(orderId)) return respond(request,{error:"Nomor pesanan tidak valid"},400);
  const db = createClient(projectUrl, serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  if (action === "track") {
    const accessToken = String(input.access_token ?? "");
    const code = String(input.code ?? "").trim().toLowerCase();
    const byLink = /^[0-9a-f]{64}$/.test(code);
    const byCheckout = !code && accessToken.length >= 50 && accessToken.length <= 150;
    if (!byLink && !byCheckout) return respond(request,{error:"Kode akses pelacakan diperlukan"},400);
    const digest = await sha256(byLink ? code : accessToken);
    const lookup = byLink
      ? db.from("gn_tracking_links").select("order_id").eq("order_id",orderId).eq("token_hash",digest).maybeSingle()
      : db.from("gn_orders").select("order_id").eq("order_id",orderId).eq("access_hash",digest).maybeSingle();
    const {data:authorized,error:authorizationError} = await lookup;
    if (authorizationError || !authorized) return respond(request,{error:"Pesanan atau kode pelacakan tidak cocok"},404);
    const [orderResult,shipmentResult,eventsResult] = await Promise.all([
      db.from("gn_orders").select("order_id,status,created_at,paid_at").eq("order_id",orderId).maybeSingle(),
      db.from("gn_shipments").select("status,carrier,tracking_number,updated_at").eq("order_id",orderId).maybeSingle(),
      db.from("gn_tracking_events").select("id,kind,status,message,created_at").eq("order_id",orderId)
        .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(80),
    ]);
    if (orderResult.error || !orderResult.data || shipmentResult.error || eventsResult.error)
      return respond(request,{error:"Status pelacakan belum dapat dibaca"},503);
    const order = orderResult.data;
    const shipment = shipmentResult.data;
    const paid = order.status === "paid";
    return respond(request,{
      order:{order_id:order.order_id,payment_status:order.status,created_at:order.created_at,paid_at:order.paid_at},
      shipment:shipment ? {
        status:shipment.status,
        carrier:paid ? shipment.carrier : "",
        tracking_number:paid ? shipment.tracking_number : "",
        updated_at:shipment.updated_at
      }:null,
      history:eventsResult.data ?? [],
      source:"manual_admin_updates",
    });
  }
  if (action !== "issue" && action !== "note") return respond(request,{error:"Aksi tidak tersedia"},400);
  // verify_jwt is deliberately disabled on this endpoint to permit customer tracking.
  // Every admin mutation independently validates the Supabase user and approved admin row.
  const bearer=(request.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!bearer) return respond(request,{error:"Harus masuk sebagai admin"},401);
  const {data:identity,error:identityError}=await db.auth.getUser(bearer);
  if (identityError || !identity?.user) return respond(request,{error:"Sesi admin tidak valid"},401);
  const {data:admin,error:adminError}=await db.from("gn_admins").select("role")
    .eq("user_id",identity.user.id).maybeSingle();
  if (adminError || !admin || !["owner","admin"].includes(admin.role))
    return respond(request,{error:"Akses ditolak"},403);
  const {data:order,error:orderError}=await db.from("gn_orders")
    .select("order_id,status,deleted_at").eq("order_id",orderId).maybeSingle();
  if (orderError || !order || order.deleted_at) return respond(request,{error:"Pesanan tidak tersedia"},404);
  if (action === "issue") {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const code = [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
    const {error}=await db.from("gn_tracking_links").upsert({
      order_id:orderId,token_hash:await sha256(code),
      issued_at:new Date().toISOString(),issued_by:identity.user.id,
    },{onConflict:"order_id"});
    if (error) return respond(request,{error:"Tidak dapat membuat tautan pelacakan"},500);
    const url = "https://gooninks.co.id/tracking.html#order_id="+encodeURIComponent(orderId)+"&code="+code;
    return respond(request,{order_id:orderId,tracking_url:url,note:"Tautan sebelumnya tidak berlaku jika pernah diterbitkan."});
  }
  if (order.status !== "paid") return respond(request,{error:"Pembaruan perjalanan paket hanya untuk pesanan dengan pembayaran lunas"},409);
  const message = String(input.message ?? "").trim();
  if (message.length < 8 || message.length > 280 || /[<>\u0000-\u001F]/.test(message))
    return respond(request,{error:"Isi pembaruan harus 8–280 karakter teks biasa"},400);
  const {data:shipment,error:shipmentError}=await db.from("gn_shipments")
    .select("status").eq("order_id",orderId).maybeSingle();
  if (shipmentError || !shipment) return respond(request,{error:"Pengiriman tidak tersedia"},409);
  const {error}=await db.from("gn_tracking_events").insert({
    order_id:orderId,kind:"admin_update",status:shipment.status,
    message,created_by:identity.user.id,
  });
  if (error) return respond(request,{error:"Gagal menyimpan riwayat pelacakan"},500);
  return respond(request,{ok:true,order_id:orderId});
});
