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
