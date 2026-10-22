-- GoO Ninks buyer checkout -> Leads -> Fulfillment (2026-10-22)
-- This script documents the applied schema in etahuzvozoomklsqepyt.
-- Apply only to the GoO Ninks Supabase project; never a shared business database.
-- Purchases must still be paid and verified via Midtrans before shipping.
BEGIN;
ALTER TABLE public.gn_leads ADD COLUMN IF NOT EXISTS order_id text REFERENCES public.gn_orders(order_id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS gn_leads_order_id_unique ON public.gn_leads(order_id);
ALTER TABLE public.gn_leads DROP CONSTRAINT IF EXISTS gn_leads_source_check;
ALTER TABLE public.gn_leads ADD CONSTRAINT gn_leads_source_check CHECK(source IN ('website','admin','checkout'));

CREATE TABLE IF NOT EXISTS public.gn_shipments(
 order_id text PRIMARY KEY REFERENCES public.gn_orders(order_id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'awaiting_payment'
  CHECK(status IN ('awaiting_payment','ready_to_pack','packing','ready_to_ship','shipped','delivered','cancelled','review')),
 carrier text NOT NULL DEFAULT '',
 tracking_number text NOT NULL DEFAULT '',
 fulfillment_notes text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS gn_shipments_queue_idx ON public.gn_shipments(status,updated_at DESC);
ALTER TABLE public.gn_shipments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gn_shipments FROM public,anon,authenticated;
GRANT SELECT ON public.gn_shipments TO authenticated;
DROP POLICY IF EXISTS gn_shipments_admin_view ON public.gn_shipments;
CREATE POLICY gn_shipments_admin_view ON public.gn_shipments FOR SELECT TO authenticated USING ((SELECT gn_private.is_admin()));

CREATE OR REPLACE FUNCTION gn_private.capture_order_for_fulfillment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 INSERT INTO public.gn_leads(order_id,name,email,phone,interest,notes,source,stage,consent)
 VALUES(NEW.order_id,NEW.customer_name,NEW.customer_email,NEW.customer_phone,
 'Pesanan website '||NEW.order_id,'Lead transaksional dari checkout; menunggu konfirmasi pembayaran.',
 'checkout','new',false)
 ON CONFLICT DO NOTHING;
 INSERT INTO public.gn_shipments(order_id,status)
 VALUES(NEW.order_id,CASE WHEN NEW.status='paid' THEN 'ready_to_pack' ELSE 'awaiting_payment' END)
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION gn_private.capture_order_for_fulfillment() FROM public,anon,authenticated;
DROP TRIGGER IF EXISTS gn_order_fulfillment_created ON public.gn_orders;
CREATE TRIGGER gn_order_fulfillment_created AFTER INSERT ON public.gn_orders
 FOR EACH ROW EXECUTE FUNCTION gn_private.capture_order_for_fulfillment();

CREATE OR REPLACE FUNCTION gn_private.sync_fulfillment_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF OLD.status IS DISTINCT FROM NEW.status THEN
  IF NEW.status='paid' THEN
   UPDATE public.gn_shipments SET status='ready_to_pack',updated_at=now()
    WHERE order_id=NEW.order_id AND status='awaiting_payment';
   UPDATE public.gn_leads SET stage='contacted'
    WHERE order_id=NEW.order_id AND stage='new';
  ELSIF NEW.status IN ('failed','cancelled','expired') THEN
   UPDATE public.gn_shipments SET status='cancelled',updated_at=now()
    WHERE order_id=NEW.order_id AND status='awaiting_payment';
  ELSIF NEW.status IN ('review','refunded') THEN
   UPDATE public.gn_shipments SET status='review',updated_at=now()
    WHERE order_id=NEW.order_id AND status NOT IN ('shipped','delivered');
  END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION gn_private.sync_fulfillment_payment() FROM public,anon,authenticated;
DROP TRIGGER IF EXISTS gn_order_fulfillment_payment ON public.gn_orders;
CREATE TRIGGER gn_order_fulfillment_payment AFTER UPDATE OF status ON public.gn_orders
 FOR EACH ROW EXECUTE FUNCTION gn_private.sync_fulfillment_payment();

-- Admin can advance only verified-paid orders, and only one stage at a time.
-- Couriers are entered by staff: there is no carrier/API label purchase integration.
CREATE OR REPLACE FUNCTION public.gn_set_shipping_progress_v1(
 p_order_id text,p_status text,p_carrier text DEFAULT '',p_tracking_number text DEFAULT '',p_notes text DEFAULT ''
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_order public.gn_orders%rowtype; v_ship public.gn_shipments%rowtype;
BEGIN
 IF (SELECT gn_private.is_admin()) IS NOT TRUE THEN RAISE EXCEPTION 'Akses admin diperlukan'; END IF;
 IF length(coalesce(p_order_id,''))>70 OR p_status NOT IN ('packing','ready_to_ship','shipped','delivered') THEN
  RAISE EXCEPTION 'Status pengiriman tidak diizinkan';
 END IF;
 SELECT * INTO v_order FROM public.gn_orders WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
 IF v_order.status<>'paid' THEN RAISE EXCEPTION 'Hanya pesanan lunas yang dapat diproses'; END IF;
 SELECT * INTO v_ship FROM public.gn_shipments WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Antrian pengiriman belum tersedia'; END IF;
 IF NOT (
   (v_ship.status='ready_to_pack' AND p_status='packing') OR
   (v_ship.status='packing' AND p_status='ready_to_ship') OR
   (v_ship.status='ready_to_ship' AND p_status='shipped') OR
   (v_ship.status='shipped' AND p_status='delivered') OR
   (v_ship.status=p_status)
 ) THEN RAISE EXCEPTION 'Tahapan pengiriman harus berurutan'; END IF;
 IF length(trim(coalesce(p_carrier,'')))>100 OR length(trim(coalesce(p_tracking_number,'')))>120 OR length(coalesce(p_notes,''))>500
 THEN RAISE EXCEPTION 'Informasi pengiriman terlalu panjang'; END IF;
 IF p_status IN ('shipped','delivered') AND
    (length(trim(coalesce(p_carrier,'')))<2 OR length(trim(coalesce(p_tracking_number,'')))<5)
 THEN RAISE EXCEPTION 'Kurir dan nomor resi harus diisi'; END IF;
 UPDATE public.gn_shipments SET status=p_status,carrier=trim(coalesce(p_carrier,'')),
  tracking_number=trim(coalesce(p_tracking_number,'')),fulfillment_notes=trim(coalesce(p_notes,'')),
  updated_at=now(),updated_by=(SELECT auth.uid())
 WHERE order_id=p_order_id;
 RETURN p_status;
END;$$;
REVOKE ALL ON FUNCTION public.gn_set_shipping_progress_v1(text,text,text,text,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gn_set_shipping_progress_v1(text,text,text,text,text) TO authenticated;

-- Idempotent backfill for any orders created before this migration.
INSERT INTO public.gn_shipments(order_id,status)
 SELECT order_id,CASE WHEN status='paid' THEN 'ready_to_pack'
  WHEN status IN ('failed','expired','cancelled') THEN 'cancelled'
  WHEN status IN ('review','refunded') THEN 'review'
  ELSE 'awaiting_payment' END
 FROM public.gn_orders ON CONFLICT DO NOTHING;
INSERT INTO public.gn_leads(order_id,name,email,phone,interest,notes,source,stage,consent)
 SELECT order_id,customer_name,customer_email,customer_phone,
 'Pesanan website '||order_id,'Lead transaksional dari checkout; status mengikuti pesanan.',
 'checkout',CASE WHEN status='paid' THEN 'contacted' ELSE 'new' END,false
 FROM public.gn_orders ON CONFLICT DO NOTHING;
COMMIT;
