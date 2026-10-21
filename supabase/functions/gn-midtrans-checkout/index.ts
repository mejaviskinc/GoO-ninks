import { createClient } from "npm:@supabase/supabase-js@2.57.0";
// GoO Ninks / Midtrans Snap Redirect, server-side only. No Midtrans Server Key in the browser.
const PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const env = () => ({
  serverKey: Deno.env.get("MIDTRANS_SERVER_KEY") ?? "",
  isProduction: Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true",
  enabled: Deno.env.get("MIDTRANS_PAYMENTS_ENABLED") === "true",
});
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
const basicAuth = (key: string) => "Basic " + btoa(key + ":");
function midtransOrigin(production: boolean, kind: "snap" | "api") {
  return kind === "snap"
    ? (production ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com")
    : (production ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com");
}
async function reconcile(orderId: string, client: ReturnType<typeof db>, key: string, production: boolean) {
  const upstream = await fetch(midtransOrigin(production, "api") + "/v2/" + encodeURIComponent(orderId) + "/status", {
    headers: { Authorization: basicAuth(key), Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!upstream.ok) return;
  const trx = await upstream.json();
  const { data: order, error } = await client.from("gn_orders").select("amount").eq("order_id", orderId).maybeSingle();
  if (error || !order || trx.order_id !== orderId || Number(trx.gross_amount) !== order.amount) return;
  const status = trx.transaction_status;
  const paid = status === "settlement" || (status === "capture" && trx.fraud_status !== "challenge" && trx.fraud_status !== "deny");
  const mapped = paid ? "paid" :
    status === "expire" ? "expired" :
    status === "cancel" ? "cancelled" :
    (status === "deny" || status === "failure") ? "failed" :
    (status === "refund" || status === "partial_refund") ? "refunded" : "pending";
  await client.rpc("gn_payment_update_v1", {
    p_order_id: orderId, p_status: mapped, p_payment_type: trx.payment_type ?? null,
    p_transaction_id: trx.transaction_id ?? null, p_midtrans_status: status ?? null,
  });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(req) });
  const config = env();
  const active = config.enabled && !!config.serverKey && !!SERVICE_KEY && !!PROJECT_URL;
  if (req.method === "GET") return respond(req, { enabled: active, mode: config.isProduction ? "production" : "sandbox" });
  if (req.method !== "POST") return respond(req, { error: "Metode tidak tersedia" }, 405);
  if (!validOrigins.has(req.headers.get("origin") ?? "")) return respond(req, { error: "Origin tidak diizinkan" }, 403);
  if (!active) return respond(req, { error: "Midtrans belum diaktifkan oleh pengelola toko." }, 503);
  if (Number(req.headers.get("content-length") ?? "0") > 12000) return respond(req, { error: "Data terlalu besar" }, 413);
  let input: Record<string, any>;
  try { input = await req.json(); } catch { return respond(req, { error: "Format permintaan salah" }, 400); }
  if (!input || typeof input !== "object") return respond(req, { error: "Permintaan tidak valid" }, 400);
  const client = db();
  if (input.action === "status") {
    const id = String(input.order_id ?? "");
    const token = String(input.access_token ?? "");
    if (!/^GN-[A-Z0-9-]{8,45}$/.test(id) || token.length < 30 || token.length > 150)
      return respond(req, { error: "Akses pesanan tidak valid" }, 400);
    const access_hash = await fingerprint(token);
    const { data: row, error } = await client.from("gn_orders").select("order_id,status,amount,created_at,payment_type")
      .eq("order_id", id).eq("access_hash", access_hash).maybeSingle();
    if (error || !row) return respond(req, { error: "Pesanan tidak ditemukan" }, 404);
    if (row.status === "pending") {
      try { await reconcile(id, client, config.serverKey, config.isProduction); }
      catch (e) { console.warn("Midtrans status check pending", e instanceof Error ? e.name : "Error"); }
    }
    const { data: fresh } = await client.from("gn_orders")
      .select("order_id,status,amount,created_at,payment_type")
      .eq("order_id", id).eq("access_hash", access_hash).maybeSingle();
    return respond(req, { order: fresh ?? row });
  }
  if (input.action !== "checkout") return respond(req, { error: "Aksi tidak tersedia" }, 400);
  const rawItems = input.items;
  const customer = input.customer;
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 15 || !customer || typeof customer !== "object")
    return respond(req, { error: "Data keranjang tidak lengkap" }, 400);
  const name = String(customer.name ?? "").trim().slice(0, 101);
  const email = String(customer.email ?? "").trim().toLowerCase().slice(0, 181);
  const phone = String(customer.phone ?? "").trim().slice(0, 26);
  const address = String(customer.address ?? "").trim().slice(0, 451);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !/^[+0-9\-\s()]{9,25}$/.test(phone) || address.length < 10)
    return respond(req, { error: "Nama, email, WhatsApp, atau alamat pengiriman belum lengkap" }, 400);
  const items = rawItems.map((p: any) => ({
    sku: String(p?.sku ?? "").slice(0, 101),
    qty: p?.qty, note: String(p?.note ?? "").slice(0, 120),
  }));
  const orderId = "GN-" + crypto.randomUUID().toUpperCase();
  const accessToken = crypto.randomUUID() + crypto.randomUUID();
  const accessHash = await fingerprint(accessToken);
  const ip = (req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").slice(0, 100);
  const fp = await fingerprint(ip + "|" + config.serverKey);
  let reserved = false;
  try {
    const { data: reservation, error: orderError } = await client.rpc("gn_payment_reserve_v1", {
      p_order_id: orderId, p_access_hash: accessHash, p_customer: { name, email, phone, address },
      p_items: items, p_fingerprint: fp,
    });
    if (orderError || !reservation) return respond(req, {
      error: orderError?.message ?? "Tidak dapat memesan produk. Periksa stok dan coba kembali.",
    }, 409);
    reserved = true;
    const snapUrl = midtransOrigin(config.isProduction, "snap") + "/snap/v1/transactions";
    const response = await fetch(snapUrl, {
      method: "POST",
      headers: {
        Authorization: basicAuth(config.serverKey), "Content-Type": "application/json", Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: reservation.gross_amount },
        item_details: reservation.items.map((item: any) => ({
          id: item.sku, name: String(item.name).slice(0, 50),
          price: item.price, quantity: item.qty,
        })),
        customer_details: { first_name: name, email, phone },
        callbacks: { finish: "https://gooninks.co.id/payment-status.html?order_id=" + encodeURIComponent(orderId) },
        expiry: { unit: "hour", duration: 1 },
        credit_card: { secure: true },
      }),
    });
    const snap = await response.json().catch(() => ({}));
    if (!response.ok || typeof snap.redirect_url !== "string")
      throw new Error("Transaksi Midtrans belum dapat dibuat (" + response.status + ")");
    const redirect = new URL(snap.redirect_url);
    if (redirect.protocol !== "https:" || redirect.hostname !== new URL(midtransOrigin(config.isProduction, "snap")).hostname)
      throw new Error("Midtrans mengembalikan URL tidak dikenal");
    const { error: saveError } = await client.from("gn_orders").update({ payment_url: redirect.href })
      .eq("order_id", orderId);
    if (saveError) throw new Error("Gagal menyimpan transaksi");
    return respond(req, { order_id: orderId, access_token: accessToken,
      redirect_url: redirect.href, amount: reservation.gross_amount,
      mode: config.isProduction ? "production" : "sandbox" });
  } catch (e) {
    if (reserved) {
      try {
        const { error: releaseError } = await client.rpc("gn_payment_update_v1", {
          p_order_id: orderId, p_status: "failed", p_midtrans_status: "checkout_error"
        });
        if (releaseError) console.error("Reservation release failed:", releaseError.message);
      } catch (releaseFailure) {
        console.error("Reservation release failed unexpectedly", releaseFailure instanceof Error ? releaseFailure.message : "Unknown");
      }
    }
    console.error("Midtrans checkout:", e instanceof Error ? e.message : "Unknown");
    return respond(req, { error: "Gagal memulai pembayaran. Silakan coba kembali atau hubungi admin." }, 502);
  }
});