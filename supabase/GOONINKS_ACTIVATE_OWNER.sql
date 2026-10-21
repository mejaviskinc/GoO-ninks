-- GoO Ninks: ONE-TIME ADMIN OWNER ACTIVATION
-- Run ONLY in Supabase project zmivxyipghujezpxjzny, never BisaBikinWeb.
-- In this SQL, replace GANTI_EMAIL_PEMILIK@CONTOH.COM with the actual owner email.
-- The owner must verify their email. This script never sets a password.
do $$
declare v_email text := lower(trim('GANTI_EMAIL_PEMILIK@CONTOH.COM'));
begin
  if v_email = 'ganti_email_pemilik@contoh.com' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Ganti alamat email pemilik sebelum menjalankan skrip ini.';
  end if;
  insert into gn_private.owner_emails(email) values (v_email)
  on conflict(email) do nothing;

  -- Backfill an already-verified account (if they signed up before this script).
  insert into public.gn_admins(user_id,role)
  select id,'owner' from auth.users
  where lower(email) = v_email and email_confirmed_at is not null
  on conflict(user_id) do update set role=excluded.role;

  raise notice 'Email owner telah didaftarkan. Jika akun belum ada/terverifikasi, buat akun via gooninks.co.id/admin.html lalu verifikasi email.';
end $$;

-- Check project setup and whether a verified owner has appeared.
select
 (select count(*) from public.gn_inventory) as inventory_count_expected_20,
 (select count(*) from public.gn_articles) as articles,
 (select count(*) from public.gn_ads) as ads,
 (select count(*) from public.gn_promotions) as promotions,
 (select count(*) from public.gn_leads) as leads,
 (select count(*) from public.gn_admins where role='owner') as verified_owner_count,
 (select count(*) from pg_policies where schemaname='public' and tablename like 'gn_%') as rls_policy_count,
 (select count(*) from storage.buckets where id='gooninks-media') as media_bucket_count;
