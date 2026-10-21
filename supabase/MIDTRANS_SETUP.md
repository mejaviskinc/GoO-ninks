# GoO Ninks Midtrans Snap (server-side)

Database is deployed to Supabase project etahuzvozoomklsqepyt (tables gn_orders and gn_inventory). Edge Functions are deployed with verify_jwt=false for anonymous shoppers and Midtrans webhook; each endpoint performs its own validation.

## Turn on sandbox only after testing

Supabase Dashboard > Edge Functions > Secrets (project etahuzvozoomklsqepyt):
- MIDTRANS_SERVER_KEY: your **Sandbox Server Key**; NEVER store it in GitHub or browser files.
- MIDTRANS_IS_PRODUCTION: false
- MIDTRANS_PAYMENTS_ENABLED: true (leave unset until stock and shipping policies are reviewed).

Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into Edge Functions. No Midtrans Client Key is needed: checkout redirects to Midtrans Snap hosted payment page. See https://docs.midtrans.com/docs/snap-snap-integration-guide.

Midtrans sandbox dashboard > Settings > Configuration > Payment Notification URL:
https://etahuzvozoomklsqepyt.supabase.co/functions/v1/gn-midtrans-webhook

Finish redirect is set per transaction to https://gooninks.co.id/payment-status.html?order_id=...
Do not trust return parameters. Only a verified Midtrans callback or authenticated Midtrans Status API response marks an order paid.

Important: each product MUST have a confirmed stock number in gn_inventory; NULL stock prohibits payment. Stock is reserved atomically at checkout and released for verified expired/failed/cancelled transactions. Expired checkout without a webhook can leave a reservation: reconcile using Midtrans status in order tracking/admin. Shipping fee is not included; customer must acknowledge a separate shipping charge. Go live only after full sandbox tests and merchant verification.
