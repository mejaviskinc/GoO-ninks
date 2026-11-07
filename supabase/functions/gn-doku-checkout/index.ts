import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { dokuConfig, dokuRequest, validDokuUrl, applyDokuPayment } from "../_shared/doku.ts";
// GoO Ninks DOKU Checkout, server-side prices and stock reservation.
const PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const env = dokuConfig;
const validOrigins = new Set(["https://gooninks.co.id", "https://www.gooninks.co.id"]);
const headersFor = (req: Request) => ({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": validOrigins.has(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : "https://gooninks.co.id",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Vary": "Origin",
});
const respond = (req: Request, obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: headersFor(req) });
const fingerprint = async (input: string): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
};
const db = () => createClient(PROJECT_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(req) });
  const config = env();
  const active = config.enabled && !!config.clientId && !!config.secret && !!SERVICE_KEY && !!PROJECT_URL;
  if (req.method === "GET") return respond(req, { provider: "doku", enabled: active, mode: config.production ? "production" : "sandbox", configuration: { payments_enabled: config.enabled, client_id_configured: !!config.clientId, secret_key_configured: !!config.secret } });
  if (req.method !== "POST") return respond(req, { error: "Metode tidak tersedia" }, 405);
  if (!validOrigins.has(req.headers.get("origin") ?? "")) return respond(req, { error: "Origin tidak diizinkan" }, 403);
  if (Number(req.headers.get("content-length") ?? "0") > 12000) return respond(req, { error: "Data terlalu besar" }, 413);
  let input: Record<string, any>;
  try { input = await req.json(); } catch { return respond(req, { error: "Format permintaan salah" }, 400); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return respond(req, { error: "Permintaan tidak valid" }, 400);
  const client = db();
  if (input.action === "status") {
    const id = String(input.order_id ?? "");
    const token = String(input.access_token ?? "");
    if (!/^GN-DK-[A-F0-9]{24}$/.test(id) || token.length < 30 || token.length > 150)
      return respond(req, { error: "Akses pesanan tidak valid" }, 400);
    const access_hash = await fingerprint(token);
    const { data: row, error } = await client.from("gn_orders").select("order_id,status,amount,created_at,payment_type")
      .eq("order_id", id).eq("access_hash", access_hash).maybeSingle();
    if (error || !row) return respond(req, { error: "Pesanan tidak ditemukan" }, 404);
    // The webhook is authoritative; inquiry recovers a missed notification after 60s.
    if (row.status === "pending" && config.clientId && config.secret && Date.now()-Date.parse(row.created_at)>60000) {
      try {
        const response=await dokuRequest(config,"/orders/v1/status/"+id);
        if(response.ok) await applyDokuPayment(client,await response.json());
      } catch { console.warn("DOKU status inquiry unavailable"); }
    }
    const { data: fresh } = await client.from("gn_orders")
      .select("order_id,status,amount,created_at,payment_type")
      .eq("order_id", id).eq("access_hash", access_hash).maybeSingle();
    const verified = fresh ?? row;
    // This endpoint already verified the private order access token.
    // Return shipping progress, not the buyer's private address.
    const { data: shipment } = await client.from("gn_shipments")
      .select("status,carrier,tracking_number").eq("order_id",id).maybeSingle();
    const shipping = shipment ? {
      status: shipment.status,
      carrier: verified.status === "paid" ? shipment.carrier : "",
      tracking_number: verified.status === "paid" ? shipment.tracking_number : "",
    } : null;
    return respond(req, { order: verified, shipping });
  }
  if (input.action !== "checkout") return respond(req, { error: "Aksi tidak tersedia" }, 400);
  if (!active) return respond(req, { error: "DOKU belum diaktifkan oleh pengelola toko." }, 503);
  const rawItems = input.items;
  const customer = input.customer;
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 15 || !customer || typeof customer !== "object")
    return respond(req, { error: "Data keranjang tidak lengkap" }, 400);
  const name = String(customer.name ?? "").trim().slice(0, 101);
  const email = String(customer.email ?? "").trim().toLowerCase().slice(0, 181);
  const phone = String(customer.phone ?? "").trim().slice(0, 26);
  const street = String(customer.address ?? "").trim();
  const province = String(customer.province ?? "").trim();
  const city = String(customer.city ?? "").trim();
  const district = String(customer.district ?? "").trim();
  const postal = String(customer.postal_code ?? "").trim();
  const address = [street,district,city,province,postal].join(", ");
  const validPart = (v: string, low: number, high: number) =>
    v.length >= low && v.length <= high && !/[<>\u0000-\u001f]/.test(v);
  if (!validPart(name,2,100) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !/^[+0-9\-\s()]{9,25}$/.test(phone)
      || !validPart(street,10,260) || !validPart(province,3,80)
      || !validPart(city,3,80) || !validPart(district,3,100)
      || !/^[0-9]{5}$/.test(postal) || address.length>450)
    return respond(req, { error: "Lengkapi nama, email, WhatsApp, alamat, kecamatan, kota, provinsi, dan kode pos (5 digit)." }, 400);
  const items = rawItems.map((p: any) => ({
    sku: String(p?.sku ?? "").slice(0, 101),
    qty: p?.qty, note: String(p?.note ?? "").slice(0, 120),
  }));
  const orderId = "GN-DK-" + crypto.randomUUID().replaceAll("-", "").slice(0,24).toUpperCase();
  const accessToken = crypto.randomUUID() + crypto.randomUUID();
  const accessHash = await fingerprint(accessToken);
  const ip = (req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").slice(0, 100);
  const fp = await fingerprint(ip + "|" + config.secret);
  let reserved = false;
  let paymentMayExist = false;
  try {
    const { data: reservation, error: orderError } = await client.rpc("gn_payment_reserve_v2", {
      p_order_id: orderId, p_access_hash: accessHash, p_customer: { name, email, phone, address },
      p_items: items, p_fingerprint: fp,
      p_promo_code: String(input.promo_code ?? "").trim().toUpperCase().slice(0,33),
    });
    if (orderError || !reservation) return respond(req, {
      error: orderError?.message ?? "Tidak dapat memesan produk. Periksa stok dan coba kembali.",
    }, 409);
    reserved = true;
    const callback="https://gooninks.co.id/payment-status.html?order_id="+encodeURIComponent(orderId);
    const body=JSON.stringify({
      order:{amount:reservation.gross_amount,invoice_number:orderId,currency:"IDR",
        callback_url:callback,callback_url_result:callback,auto_redirect:true},
      payment:{payment_due_date:60},
      customer:{name,email,phone,address,city,state:province,postcode:postal,country:"ID"},
    });
    // A timeout can occur after DOKU accepts payment. Retain stock on ambiguous errors.
    paymentMayExist=true;
    const response=await dokuRequest(config,"/checkout/v1/payment",body);
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) {
      if([400,401,403,422].includes(response.status)) paymentMayExist=false;
      throw Error("DOKU checkout rejected");
    }
    const result=payload.response;
    if(result?.order?.invoice_number!==orderId || Number(result?.order?.amount)!==Number(reservation.gross_amount)
      || typeof result?.payment?.url!=="string" || !validDokuUrl(result.payment.url,config.production))
      throw Error("Invalid DOKU checkout response");
    const redirect=new URL(result.payment.url);
    const { error: saveError } = await client.from("gn_orders").update({ payment_url: redirect.href })
      .eq("order_id", orderId);
    if (saveError) console.warn("DOKU link storage failed; order remains pending", orderId);
    return respond(req, { order_id: orderId, access_token: accessToken,
      redirect_url: redirect.href, amount: reservation.gross_amount,
      mode: config.production ? "production" : "sandbox" });
  } catch (e) {
    // Release stock only for a definite rejection before a payment can exist.
    if (reserved && !paymentMayExist) {
      try {
        const { error: releaseError } = await client.rpc("gn_payment_update_v1", {
          p_order_id: orderId, p_status: "failed", p_midtrans_status: "doku_checkout_error"
        });
        if (releaseError) console.error("Reservation release failed:", releaseError.message);
      } catch (releaseFailure) {
        console.error("Reservation release failed unexpectedly", releaseFailure instanceof Error ? releaseFailure.message : "Unknown");
      }
    }
    console.error("DOKU checkout failed", orderId);
    return respond(req, { error: paymentMayExist
      ? "Status pembuatan pembayaran belum dapat dipastikan. Hubungi admin dengan nomor pesanan " + orderId + " sebelum mencoba ulang."
      : "Gagal memulai pembayaran. Silakan coba kembali atau hubungi admin." }, 502);
  }
});