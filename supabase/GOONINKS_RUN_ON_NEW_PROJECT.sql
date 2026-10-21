-- ===============================================================
-- GOO NINKS · ONE-TIME DATABASE SETUP
-- Target project: zmivxyipghujezpxjzny (NEW GoO Ninks project)
-- Do not run this in Bisabikinweb: kdlrobdzlxpjlkxbvzsd
-- This creates CMS tables, admin roles, RLS policies, media bucket,
-- and imports 20 product records. No DROP of business tables.
-- After running, confirm tables and inventory count via SQL below.
-- IMPORTANT: Set your actual verified owner email separately,
-- using privileged Supabase SQL Editor (template at the end).
-- ===============================================================

-- Standalone Supabase schema for GoO Ninks only.
-- Apply exclusively to a fresh, dedicated GoO Ninks Supabase project.
-- Then set a verified owner email in gn_private.owner_emails using privileged SQL.
-- This script does NOT read, modify or drop BisaBikinWeb tables.
create schema if not exists gn_private;
revoke all on schema gn_private from public, anon, authenticated;
grant usage on schema gn_private to authenticated;
create table if not exists gn_private.owner_emails (email text primary key);
revoke all on table gn_private.owner_emails from public, anon, authenticated;
alter table gn_private.owner_emails enable row level security;

create table if not exists public.gn_admins(
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'admin' check(role in ('owner','admin')),
 created_at timestamptz not null default now()
);
create table if not exists public.gn_admin_requests(
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null check(length(email) between 3 and 254),
 requested_at timestamptz not null default now()
);
create or replace function gn_private.is_admin()
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.gn_admins where user_id=(select auth.uid()))$$;
create or replace function gn_private.is_owner()
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.gn_admins where user_id=(select auth.uid()) and role='owner')$$;
revoke all on function gn_private.is_admin(),gn_private.is_owner() from public,anon;
grant execute on function gn_private.is_admin(),gn_private.is_owner() to authenticated;
create or replace function gn_private.register_confirmed_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.email_confirmed_at is not null and new.email is not null then
  if exists(select 1 from gn_private.owner_emails where email=lower(new.email)) then
   insert into public.gn_admins(user_id,role) values(new.id,'owner')
    on conflict(user_id) do update set role='owner';
  else
   insert into public.gn_admin_requests(user_id,email) values(new.id,lower(new.email))
    on conflict(user_id) do update set email=excluded.email;
  end if;
 end if;
 return new;
end;
$$;
revoke all on function gn_private.register_confirmed_user() from public,anon,authenticated;
drop trigger if exists gn_confirmed_user_registration on auth.users;
create trigger gn_confirmed_user_registration
 after insert or update of email_confirmed_at,email on auth.users
 for each row execute function gn_private.register_confirmed_user();

create table if not exists public.gn_articles (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 3 and 180),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 excerpt text not null default '',body text not null default '',image_url text not null default '',
 status text not null default 'draft' check(status in ('draft','published')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.gn_ads (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 2 and 160),
 image_url text not null default '',link_url text not null default '',
 placement text not null default 'home' check(placement in ('home','collection')),
 active boolean not null default false,start_at timestamptz,end_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint gn_ads_date_check check(start_at is null or end_at is null or end_at>start_at)
);
create table if not exists public.gn_promotions (
 id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 2 and 160),
 description text not null default '',code text not null default '',
 discount_percent integer not null default 0 check(discount_percent between 0 and 100),
 active boolean not null default false,start_at timestamptz,end_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint gn_promo_date_check check(start_at is null or end_at is null or end_at>start_at)
);
create table if not exists public.gn_leads (
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 2 and 120),
 email text not null default '' check(length(email)<=254),
 phone text not null default '' check(length(phone)<=32),
 interest text not null default '' check(length(interest)<=160),
 notes text not null default '' check(length(notes)<=2000),
 source text not null default 'website' check(source in ('website','admin')),
 stage text not null default 'new' check(stage in ('new','contacted','won','lost')),
 consent boolean not null default false,created_at timestamptz not null default now()
);
create table if not exists public.gn_inventory (
 sku text primary key check(length(sku) between 2 and 80),
 product_name text not null check(length(product_name) between 2 and 160),
 price integer not null default 0 check(price>=0),
 stock integer check(stock is null or stock>=0),
 low_stock_threshold integer not null default 3 check(low_stock_threshold>=0),
 image_url text not null default '',visible boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.gn_admins enable row level security;
alter table public.gn_admin_requests enable row level security;
alter table public.gn_articles enable row level security;
alter table public.gn_ads enable row level security;
alter table public.gn_promotions enable row level security;
alter table public.gn_leads enable row level security;
alter table public.gn_inventory enable row level security;
revoke all on public.gn_admins,public.gn_admin_requests,public.gn_articles,
 public.gn_ads,public.gn_promotions,public.gn_leads,public.gn_inventory from anon,authenticated;
grant select,insert,delete on public.gn_admins to authenticated;
grant select on public.gn_admin_requests to authenticated;
grant select,insert,update,delete on public.gn_articles,public.gn_ads,public.gn_promotions,
 public.gn_inventory to authenticated;
grant select on public.gn_articles,public.gn_ads,public.gn_promotions,public.gn_inventory to anon;
grant select,insert,update,delete on public.gn_leads to authenticated;
grant insert(name,email,phone,interest,consent,source) on public.gn_leads to anon;

create policy "gn_admin_self_or_owner" on public.gn_admins for select to authenticated
 using(user_id=(select auth.uid()) or (select gn_private.is_owner()));
create policy "gn_admin_approve_owner" on public.gn_admins for insert to authenticated
 with check(role='admin' and (select gn_private.is_owner()));
create policy "gn_admin_revoke_owner" on public.gn_admins for delete to authenticated
 using(role='admin' and (select gn_private.is_owner()));
create policy "gn_requests_self_or_owner" on public.gn_admin_requests for select to authenticated
 using(user_id=(select auth.uid()) or (select gn_private.is_owner()));
create policy "gn_articles_public" on public.gn_articles for select to anon,authenticated
 using(status='published');
create policy "gn_articles_admin" on public.gn_articles for all to authenticated
 using((select gn_private.is_admin())) with check((select gn_private.is_admin()));
create policy "gn_ads_public" on public.gn_ads for select to anon,authenticated
 using(active=true and (start_at is null or start_at<=now()) and (end_at is null or end_at>=now()));
create policy "gn_ads_admin" on public.gn_ads for all to authenticated
 using((select gn_private.is_admin())) with check((select gn_private.is_admin()));
create policy "gn_promotions_public" on public.gn_promotions for select to anon,authenticated
 using(active=true and (start_at is null or start_at<=now()) and (end_at is null or end_at>=now()));
create policy "gn_promotions_admin" on public.gn_promotions for all to authenticated
 using((select gn_private.is_admin())) with check((select gn_private.is_admin()));
create policy "gn_inventory_public" on public.gn_inventory for select to anon,authenticated using(visible=true);
create policy "gn_inventory_admin" on public.gn_inventory for all to authenticated
 using((select gn_private.is_admin())) with check((select gn_private.is_admin()));
create policy "gn_leads_public_insert" on public.gn_leads for insert to anon
 with check(consent=true and stage='new' and source='website' and (length(email)>0 or length(phone)>0));
create policy "gn_leads_admin" on public.gn_leads for all to authenticated
 using((select gn_private.is_admin())) with check((select gn_private.is_admin()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('gooninks-media','gooninks-media',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy "gn_media_insert" on storage.objects for insert to authenticated
 with check(bucket_id='gooninks-media' and (select gn_private.is_admin()));
create policy "gn_media_update" on storage.objects for update to authenticated
 using(bucket_id='gooninks-media' and (select gn_private.is_admin()))
 with check(bucket_id='gooninks-media' and (select gn_private.is_admin()));
create policy "gn_media_delete" on storage.objects for delete to authenticated
 using(bucket_id='gooninks-media' and (select gn_private.is_admin()));
create policy "gn_media_select" on storage.objects for select to anon,authenticated
 using(bucket_id='gooninks-media');


-- GoO Ninks inventory snapshot, for NEW dedicated Supabase project only.
-- Run after creating public.gn_inventory in the target project.
insert into public.gn_inventory (sku,product_name,price,stock,low_stock_threshold,image_url,visible) values
 ('adhiratna-01','Adhiratna',500000,NULL,3,'',true),
 ('adiguna-wira-01','Adiguna Wira',550000,NULL,3,'',true),
 ('adiningrat-01','Adiningrat',500000,NULL,3,'',true),
 ('cakra-buana-01','Cakra Buana',550000,NULL,3,'',true),
 ('candrakirana-01','Candrakirana',450000,NULL,3,'',true),
 ('dewi-laksmi-01','Dewi Laksmi',450000,NULL,3,'',true),
 ('jayaprana-01','Jayaprana',500000,NULL,3,'',true),
 ('jayawisesa-01','Jayawisesa',550000,NULL,3,'',true),
 ('kenanga-laras-01','Kenanga Laras',500000,NULL,3,'',true),
 ('mahardika-01','Mahardika',500000,NULL,3,'',true),
 ('mahardika-02','Mahardika',500000,NULL,3,'',true),
 ('mahardika-03','Mahardika',500000,NULL,3,'',true),
 ('manik-wulan-01','Manik Wulan',550000,NULL,3,'',true),
 ('ranggawisesa-01','Ranggawisesa',450000,NULL,3,'',true),
 ('ranggawisesa-02','Ranggawisesa',550000,NULL,3,'',true),
 ('ratri-sari-01','Ratri Sari',600000,NULL,3,'',true),
 ('satyanigrat-01','Satyanigrat',450000,NULL,3,'',true),
 ('sekar-pradipta-01','Sekar Pradipta',450000,NULL,3,'',true),
 ('turangga-niskala-01','Turangga Niskala',500000,NULL,3,'',true),
 ('yogananta-01','Yogananta',450000,NULL,3,'',true)
on conflict (sku) do nothing;


-- After setup, confirm expected number of products and table policies:
select (select count(*) from public.gn_inventory) as products_expected_20,
       (select count(*) from pg_policies where schemaname='public' and tablename like 'gn_%') as rls_policy_count;

-- OWNER ACTIVATION: Run this separately in the new project's SQL Editor,
-- replacing the email with YOUR verified owner email:
-- insert into gn_private.owner_emails(email)
-- values ('YOUR_VERIFIED_OWNER_EMAIL@EXAMPLE.COM')
-- on conflict do nothing;
-- If you already verified that email before inserting into owner_emails,
-- register its owner access with the following query, also replacing email:
-- insert into public.gn_admins(user_id,role)
-- select id,'owner' from auth.users
-- where lower(email)='YOUR_VERIFIED_OWNER_EMAIL@EXAMPLE.COM'
--   and email_confirmed_at is not null
-- on conflict(user_id) do update set role='owner';
