-- GoO Ninks: capture unpaid manual checkout inquiries (09 Nov 2026).
-- Applied to the dedicated GoO Ninks Supabase project.
--
-- The public checkout form writes gn_leads with:
-- name, email, phone, interest, notes, source='website', consent=true.
-- stage is intentionally omitted so PostgreSQL defaults it to 'new'.
-- Existing RLS policy gn_leads_public_insert requires consent=true,
-- stage='new', source='website', and contact information.
-- Do not grant direct anon SELECT/UPDATE/DELETE or access to gn_orders.
GRANT INSERT (notes) ON TABLE public.gn_leads TO anon;

-- Verification:
-- SELECT has_column_privilege('anon','public.gn_leads','notes','INSERT');
