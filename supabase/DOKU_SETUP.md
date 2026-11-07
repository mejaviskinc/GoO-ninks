# GoO Ninks — DOKU Checkout

Project: `etahuzvozoomklsqepyt`. Integration uses DOKU Checkout Non-SNAP (Client ID + Secret Key), not direct SNAP QRIS.

## Activation

1. Set secrets in https://supabase.com/dashboard/project/etahuzvozoomklsqepyt/functions/secrets:
   - `DOKU_CLIENT_ID`: credentials for the GoO Ninks merchant/brand.
   - `DOKU_SECRET_KEY`: matching merchant secret, server only.
   - `DOKU_IS_PRODUCTION`: `false` for sandbox, `true` for live.
   - `DOKU_PAYMENTS_ENABLED`: `true` after notification configuration and sandbox checks.
2. Configure the DOKU payment channels' Notification URL:
   `https://etahuzvozoomklsqepyt.supabase.co/functions/v1/gn-doku-webhook`
3. Test sandbox checkout, successful payment notification, duplicate notification, failed method then successful retry, coupon total and order shipping transition before enabling production.
4. The public storefront prefers DOKU only when enabled in production. Until then it retains Midtrans. Reload the storefront after changing secrets.

GET `gn-doku-checkout` reports readiness booleans without disclosing credentials. Configuration presence does not establish that credentials are accepted by DOKU. No credentials have been copied from other businesses.

## Behavior

- Reservations and promotional totals use existing database RPCs, not browser prices.
- DOKU IDs use `GN-DK-` plus 24 hexadecimal characters, within the 30-character credit-card invoice limit. These are isolated from older Midtrans IDs.
- The private session token authorizes status reads. Return URL parameters cannot mark orders paid.
- Webhook HMAC authenticates the exact request body and public notification path; invoice and amount must match. Existing atomic update RPC prevents duplicate stock transitions.
- `SUCCESS` marks paid. Individual method `FAILED`/`EXPIRED` events do not release stock because Checkout allows switching methods. Pending status inquiry after 60 seconds can recover a missed successful notification.
- Pending/ambiguous DOKU sessions retain reservations; automatic expiry/refund handling is not implemented. Review unresolved orders against DOKU before cancelling/releasing them. Never infer payment failure from a browser timeout.
- Historical status and Midtrans webhook remain available. The existing admin reconciliation operation remains Midtrans-only; DOKU pending orders should be checked using the customer's status page and DOKU dashboard.
- Shipping fees remain confirmed separately, as in the existing checkout.

Official references:
- https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration
- https://developers.doku.com/get-started-with-doku-api/notification/best-practice
- https://developers.doku.com/get-started-with-doku-api/check-status-api/non-snap
