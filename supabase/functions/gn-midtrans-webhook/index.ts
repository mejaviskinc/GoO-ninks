import { createClient } from "npm:@supabase/supabase-js@2.57.0";
// Midtrans callback: verify SHA512 and re-fetch actual transaction status from Midtrans.
const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY") ?? "";
const live = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
const reject = (status: number) => new Response(JSON.stringify({ ok: false }), {
  status, headers: { "Content-Type": "application/json" },
});
const hexDigest = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
};
const safeEquals = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let diff = 0; for (let i=0;i<left.length;i++) diff |= left.charCodeAt(i)^right.charCodeAt(i);
  return diff === 0;
};
Deno.serve(async (req) => {
  if (req.method !== "POST") return reject(405);
  if (!serverKey || !serviceKey || !projectUrl || Deno.env.get("MIDTRANS_PAYMENTS_ENABLED") !== "true") return reject(503);
  if (Number(req.headers.get("content-length") ?? "0") > 30000) return reject(413);
  let notification: Record<string, unknown>;
  try { notification = await req.json(); } catch { return reject(400); }
  const orderId = String(notification?.order_id ?? "");
  const statusCode = String(notification?.status_code ?? "");
  const gross = String(notification?.gross_amount ?? "");
  const signature = String(notification?.signature_key ?? "");
  if (!/^GN-[A-Z0-9-]{8,45}$/.test(orderId) || !/^\d{3}$/.test(statusCode)
    || !/^\d+(\.\d{1,2})?$/.test(gross) || !/^[a-f0-9]{128}$/i.test(signature)) return reject(400);
  const expected = await hexDigest(orderId + statusCode + gross + serverKey);
  if (!safeEquals(expected, signature.toLowerCase())) return reject(401);
  const api = live ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
  let trx: Record<string, unknown>;
  try {
    const verification = await fetch(api + "/v2/" + encodeURIComponent(orderId) + "/status", {
      headers: { Authorization: "Basic " + btoa(serverKey + ":"), Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!verification.ok) return reject(502);
    trx = await verification.json();
  } catch { return reject(502); }
  const client = createClient(projectUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error: lookupError } = await client.from("gn_orders")
    .select("amount,status").eq("order_id",orderId).maybeSingle();
  if (lookupError) return reject(502);
  if (!order) return reject(404);
  if (String(trx.order_id) !== orderId || Number(trx.gross_amount) !== order.amount) return reject(400);
  const trxStatus = String(trx.transaction_status ?? "");
  const fraudStatus = String(trx.fraud_status ?? "");
  const mapped = trxStatus === "settlement" || (trxStatus === "capture" && fraudStatus === "accept")
    ? "paid" : trxStatus === "expire" ? "expired" : trxStatus === "cancel" ? "cancelled"
    : (trxStatus === "deny" || trxStatus === "failure") ? "failed"
    : (trxStatus === "refund" || trxStatus === "partial_refund") ? "refunded" : "pending";
  const { error } = await client.rpc("gn_payment_update_v1", {
    p_order_id: orderId, p_status: mapped,
    p_payment_type: String(trx.payment_type ?? "").slice(0,65),
    p_transaction_id: String(trx.transaction_id ?? "").slice(0,100),
    p_midtrans_status: trxStatus,
  });
  if (error) { console.error("Midtrans notification database update failed",error.message);return reject(502); }
  return new Response(JSON.stringify({ ok: true }), { status: 200,
    headers: { "Content-Type": "application/json" } });
});