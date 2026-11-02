-- GoO ninks admin-managed shipment tracking (applied to the dedicated GoO ninks Supabase project).
-- Safe to rerun. Requires existing gn_orders, gn_shipments and gn_private schema.
-- Shared tracking secrets are stored only as hashes. Neither table is exposed to public Data API.
CREATE TABLE IF NOT EXISTS public.gn_tracking_links (
  order_id text PRIMARY KEY REFERENCES public.gn_orders(order_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid REFERENCES auth.users(id)
);
CREATE TABLE IF NOT EXISTS public.gn_tracking_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.gn_orders(order_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('status','admin_update')),
  status text NOT NULL CHECK (length(status) BETWEEN 2 AND 40),
  message text NOT NULL CHECK (length(message) BETWEEN 2 AND 320),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS gn_tracking_events_order_time_idx
  ON public.gn_tracking_events (order_id, created_at DESC, id DESC);
ALTER TABLE public.gn_tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gn_tracking_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gn_tracking_links,public.gn_tracking_events FROM public, anon, authenticated;
REVOKE ALL ON SEQUENCE public.gn_tracking_events_id_seq FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION gn_private.record_shipment_tracking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $body$
DECLARE description text;
BEGIN
  IF tg_op = 'UPDATE' AND new.status IS NOT DISTINCT FROM old.status
     AND new.carrier IS NOT DISTINCT FROM old.carrier
     AND new.tracking_number IS NOT DISTINCT FROM old.tracking_number THEN RETURN new; END IF;
  description := CASE new.status
    WHEN 'awaiting_payment' THEN 'Pesanan diterima dan sedang menunggu pembayaran.'
    WHEN 'ready_to_pack' THEN 'Pembayaran terverifikasi. Pesanan masuk antrean pengemasan.'
    WHEN 'packing' THEN 'Tim GoO ninks sedang mengemas pesanan.'
    WHEN 'ready_to_ship' THEN 'Paket sudah dikemas dan siap dikirim.'
    WHEN 'shipped' THEN 'Admin menandai paket telah diserahkan untuk pengiriman.'
    WHEN 'delivered' THEN 'Admin menandai paket telah diterima.'
    WHEN 'cancelled' THEN 'Proses pengiriman dibatalkan.'
    WHEN 'review' THEN 'Pengiriman sedang diperiksa oleh tim GoO ninks.'
    ELSE 'Status pengiriman diperbarui oleh admin.' END;
  IF length(btrim(coalesce(new.carrier,'')))>0
     AND (tg_op='INSERT' OR new.carrier IS DISTINCT FROM old.carrier) THEN
    description := description || ' Kurir: ' || left(btrim(new.carrier),70) || '.';
  END IF;
  INSERT INTO public.gn_tracking_events(order_id,kind,status,message,created_by)
    VALUES(new.order_id,'status',new.status,description,new.updated_by);
  RETURN new;
END;
$body$;
REVOKE ALL ON FUNCTION gn_private.record_shipment_tracking() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS gn_track_shipment_changes ON public.gn_shipments;
CREATE TRIGGER gn_track_shipment_changes
AFTER INSERT OR UPDATE OF status,carrier,tracking_number ON public.gn_shipments
FOR EACH ROW EXECUTE FUNCTION gn_private.record_shipment_tracking();
