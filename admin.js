'use strict';
/* GoO Ninks Admin Studio — client-only UI, all writes authorized by Supabase RLS */
const cfg=window.GN_CONFIG;
const $=s=>document.querySelector(s);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rupiah=n=>'Rp'+new Intl.NumberFormat('id-ID').format(Number(n)||0);
const dateText=s=>s?new Date(s).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';
const schemas={
 orders:{title:'Pesanan',desc:'Data pembeli, rincian belanja, dan status pembayaran Midtrans. Hanya admin yang dapat melihat data ini.',table:'gn_orders',key:'order_id',headline:'order_id',fields:[]},
 shipping:{title:'Pengiriman',desc:'Proses pesanan lunas: kemas, siap kirim, masukkan kurir dan resi, hingga selesai.',table:'gn_shipments',key:'order_id',headline:'order_id',fields:[]},
 articles:{title:'Artikel',desc:'Tulis, edit, dan publikasikan cerita wastra untuk website.',table:'gn_articles',key:'id',headline:'title',fields:[
  ['title','Judul artikel','text',true],['slug','Slug URL','slug',true],['excerpt','Ringkasan artikel','textarea',false],['body','Isi artikel','textarea',false],['image_url','URL gambar sampul','image',false],['status','Status publikasi','select:draft|published',true]]},
 ads:{title:'Iklan',desc:'Atur banner dan materi iklan yang muncul di halaman publik.',table:'gn_ads',key:'id',headline:'title',fields:[
  ['title','Judul iklan','text',true],['image_url','Foto / banner iklan','image',false],['link_url','Tautan tujuan','url',false],['placement','Penempatan','select:home|collection',true],['start_at','Mulai tayang','datetime-local',false],['end_at','Akhir tayang','datetime-local',false],['active','Tayangkan iklan','checkbox',false]]},
 promotions:{title:'Promosi',desc:'Kelola voucher, diskon, dan pengumuman promosi.',table:'gn_promotions',key:'id',headline:'title',fields:[
  ['title','Nama promosi','text',true],['description','Deskripsi promosi','textarea',false],['code','Kode promo','text',false],['discount_percent','Diskon (%)','number',true],['start_at','Mulai','datetime-local',false],['end_at','Berakhir','datetime-local',false],['active','Aktifkan promosi','checkbox',false]]},
 leads:{title:'Leads',desc:'Tindak lanjuti permintaan katalog, pesanan custom, dan kerja sama.',table:'gn_leads',key:'id',headline:'name',fields:[
  ['name','Nama calon pelanggan','text',true],['email','Email','email',false],['phone','Nomor WhatsApp','tel',false],['interest','Minat / kebutuhan','text',false],['notes','Catatan internal','textarea',false],['stage','Tahap tindak lanjut','select:new|contacted|won|lost',true]]},
 inventory:{title:'Inventori',desc:'Atur harga, stok, foto, dan visibilitas 20 look katalog 2026.',table:'gn_inventory',key:'sku',headline:'product_name',fields:[
  ['sku','Kode produk (SKU)','text',true],['product_name','Nama koleksi','text',true],['price','Harga (Rp)','number',true],['stock','Stok (kosongkan bila belum diketahui)','number',false],['low_stock_threshold','Peringatan stok minimum','number',false],['image_url','Foto produk','image',false],['visible','Tampilkan di website','checkbox',false]]}
};
let db=null,currentUser=null,currentRole=null,currentView='overview',rows=[],teamRows=[],editing=null,toastTimer=null,loading=false,recovering=false;
function notify(s,isError=false){const t=$('#toast');t.textContent=s;t.style.background=isError?'#9f4e45':'#28372b';t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500)}
function setAlert(message){const a=$('#loginError');a.hidden=!message;a.textContent=message||''}
function setInfo(message){const a=$('#authInfo');a.hidden=!message;a.textContent=message||''}
function switchAuth(mode){
 const signing=mode==='signup',logging=mode==='login';
 const other=mode==='forgot'||mode==='recovery';
 $('#authTabs').hidden=other;
 $('#signupForm').hidden=!signing;
 $('#loginForm').hidden=!logging;
 $('#forgotForm').hidden=mode!=='forgot';
 $('#recoveryForm').hidden=mode!=='recovery';
 $('#showSignup').classList.toggle('active',signing);
 $('#showLogin').classList.toggle('active',logging);
 $('#showSignup').setAttribute('aria-selected',String(signing));
 $('#showLogin').setAttribute('aria-selected',String(logging));
 setAlert('');setInfo('');
}
async function getStaff(user){if(!user)return null;const {data,error}=await db.from('gn_admins').select('role').eq('user_id',user.id).maybeSingle();if(error)throw error;return data}
async function activate(user){const staff=await getStaff(user);if(!staff){await db.auth.signOut();throw Error('Akun telah terdaftar tetapi belum disetujui sebagai admin. Pastikan email sudah diverifikasi, lalu minta persetujuan pemilik GoO Ninks.')}currentUser=user;currentRole=staff.role;$('#teamNav').hidden=currentRole!=='owner';$('#accountEmail').textContent=user.email||'';$('#authScreen').hidden=true;$('#appShell').hidden=false;setAlert('');setInfo('');await loadView('overview');startOrderRealtime()}
async function boot(){
 if(!cfg||!window.supabase?.createClient){setAlert('Koneksi aplikasi belum siap. Muat ulang halaman, atau periksa akses ke CDN Supabase.');return}
 recovering=/(?:[?#&])type=recovery(?:[&#]|$)/.test(window.location.href);
 db=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 db.auth.onAuthStateChange((event)=>{
  if(event==='PASSWORD_RECOVERY'){
   recovering=true;
   $('#authScreen').hidden=false;$('#appShell').hidden=true;
   switchAuth('recovery');
   setInfo('Silakan buat kata sandi baru. Tautan pemulihan hanya dapat digunakan sesuai masa berlakunya.');
  }
 });
 try{
  const {data,error}=await db.auth.getUser();
  if(error&&!/session missing/i.test(error.message))console.warn('Session check:',error.message);
  if(data?.user&&!recovering)await activate(data.user);
  else if(recovering&&!data?.user){
   switchAuth('login');
   setAlert('Tautan pemulihan tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru melalui Lupa kata sandi.');
  }
 }catch(e){setAlert(e.message);$('#authScreen').hidden=false;$('#appShell').hidden=true}
}
async function login(e){e.preventDefault();const b=$('#loginButton');b.disabled=true;setAlert('');try{if(!db)throw Error('Koneksi database belum siap');const form=new FormData(e.currentTarget);const {data,error}=await db.auth.signInWithPassword({email:String(form.get('email')).trim(),password:String(form.get('password'))});if(error)throw error;await activate(data.user);e.currentTarget.reset()}catch(err){const message=err?.message||'Login gagal';setAlert(/invalid login credentials/i.test(message)?'Email atau kata sandi tidak cocok. Periksa email akun Anda, atau pilih Lupa kata sandi untuk membuat yang baru.':message);notify('Login gagal',true)}finally{b.disabled=false}}


async function requestPasswordReset(e){
 e.preventDefault();
 const button=$('#forgotButton');button.disabled=true;setAlert('');setInfo('');
 try{
  if(!db)throw Error('Koneksi Supabase belum tersedia. Muat ulang halaman.');
  const email=String(new FormData(e.currentTarget).get('email')||'').trim().toLowerCase();
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:'https://gooninks.co.id/admin.html'});
  if(error)throw error;
  setInfo('Jika alamat email tersebut terdaftar, tautan pemulihan telah dikirim. Periksa kotak masuk atau spam. Buka tautan dari perangkat yang sama jika memungkinkan.');
 }catch(err){setAlert(err?.message||'Tidak dapat mengirim tautan pemulihan.')}
 finally{button.disabled=false}
}
async function saveNewPassword(e){
 e.preventDefault();
 const button=$('#recoveryButton');button.disabled=true;setAlert('');setInfo('');
 try{
  if(!db)throw Error('Koneksi Supabase belum tersedia. Muat ulang halaman.');
  const form=new FormData(e.currentTarget),password=String(form.get('password')||'');
  if(password.length<12||!/[a-zA-Z]/.test(password)||!/[0-9]/.test(password))throw Error('Gunakan minimal 12 karakter yang mengandung huruf dan angka.');
  if(password!==form.get('confirm_password'))throw Error('Konfirmasi kata sandi tidak sama.');
  const {data:{user},error:sessionError}=await db.auth.getUser();
  if(sessionError||!user)throw Error('Sesi pemulihan kedaluwarsa. Minta tautan baru melalui Lupa kata sandi.');
  const {error}=await db.auth.updateUser({password});
  if(error)throw error;
  await db.auth.signOut();
  recovering=false;
  e.currentTarget.reset();
  switchAuth('login');
  setInfo('Kata sandi berhasil diperbarui. Silakan masuk kembali dengan kata sandi baru.');
 }catch(err){setAlert(err?.message||'Gagal memperbarui kata sandi.')}
 finally{button.disabled=false}
}

async function signup(e){
 e.preventDefault();
 const submit=$('#signupButton');submit.disabled=true;setAlert('');setInfo('');
 try{
  if(!db)throw Error('Koneksi belum siap');
  const fields=new FormData(e.currentTarget);
  const name=String(fields.get('name')||'').trim();
  const email=String(fields.get('email')||'').trim().toLowerCase();
  const password=String(fields.get('password')||'');
  if(name.length<2||name.length>100)throw Error('Masukkan nama lengkap yang valid.');
  if(password.length<12||!/[a-zA-Z]/.test(password)||!/[0-9]/.test(password))throw Error('Kata sandi minimal 12 karakter serta mengandung huruf dan angka.');
  if(password!==fields.get('confirm_password'))throw Error('Konfirmasi kata sandi tidak sama.');
  const {data,error}=await db.auth.signUp({email,password,options:{emailRedirectTo:'https://gooninks.co.id/admin.html',data:{display_name:name}}});
  if(error)throw error;
  e.currentTarget.reset();
  switchAuth('login');
  setInfo('Permintaan pendaftaran diterima. Cek kotak masuk atau spam untuk verifikasi email, kemudian masuk. Akun staf membutuhkan persetujuan pemilik.');
  if(data?.session){try{await activate(data.user)}catch(err){setInfo(err.message);}}
 }catch(err){setAlert(err?.message||'Pendaftaran gagal. Coba kembali.')}finally{submit.disabled=false}
}
async function loadTeam(){
 if(currentRole!=='owner')throw Error('Hanya pemilik yang dapat mengelola akun.');
 const [req,users]=await Promise.all([
  db.from('gn_admin_requests').select('user_id,email,requested_at').order('requested_at',{ascending:false}).limit(500),
  db.from('gn_admins').select('user_id,role').limit(500)
 ]);
 if(req.error)throw req.error;if(users.error)throw users.error;
 const approved=new Map((users.data||[]).map(x=>[x.user_id,x.role]));
 teamRows=(req.data||[]).map(x=>({...x,role:approved.get(x.user_id)||'pending'}));
 $('#searchBox').value='';renderTeam();
}
function renderTeam(){
 const search=$('#searchBox').value.trim().toLowerCase(),found=teamRows.filter(x=>x.email.toLowerCase().includes(search));
 $('#rowCounter').textContent=found.length+' pendaftaran';
 if(!found.length){$('#records').innerHTML='<div class="empty"><strong>Belum ada permintaan akun</strong>Pendaftar yang sudah memverifikasi email akan muncul di sini.</div>';return}
 $('#records').innerHTML='<table class="record-table"><thead><tr><th>Email terverifikasi</th><th>Diminta</th><th>Status</th><th class="actions">Aksi pemilik</th></tr></thead><tbody>'+found.map(row=>'<tr><td><strong>'+safe(row.email)+'</strong></td><td>'+dateText(row.requested_at)+'</td><td>'+pill(row.role==='admin'?'Admin aktif':'Menunggu persetujuan',row.role==='admin')+'</td><td class="actions">'+(row.role==='admin'?'<button class="danger" data-revoke="'+safe(row.user_id)+'">Cabut akses</button>':'<button data-approve="'+safe(row.user_id)+'">Setujui</button>')+'</td></tr>').join('')+'</tbody></table>';
}
async function changeTeam(userId,approve){
 if(currentRole!=='owner')return;
 const row=teamRows.find(x=>x.user_id===userId);if(!row)return;
 if(!confirm((approve?'Setujui akses dashboard untuk ':'Cabut akses dashboard dari ')+row.email+'?'))return;
 try{
  const q=approve?db.from('gn_admins').insert({user_id:userId,role:'admin'}):db.from('gn_admins').delete().eq('user_id',userId).eq('role','admin');
  const {error}=await q;if(error)throw error;notify(approve?'Akun staf disetujui':'Akses staf dicabut');await loadTeam();
 }catch(err){notify('Gagal memperbarui akses: '+err.message,true)}
}

async function logout(){stopOrderRealtime();if(db)await db.auth.signOut();currentUser=null;currentRole=null;rows=[];teamRows=[];$('#appShell').hidden=true;$('#authScreen').hidden=false;setMobileMenu(false);switchAuth('login')}
async function fetchRows(view){
 if(view==='shipping'){
  const [ship,orders]=await Promise.all([
   db.from('gn_shipments').select('*').order('updated_at',{ascending:false}).limit(500),
   db.from('gn_orders').select('order_id,customer_name,customer_email,customer_phone,customer_address,amount,items,status,paid_at,created_at').order('created_at',{ascending:false}).limit(500)
  ]);
  if(ship.error)throw ship.error;if(orders.error)throw orders.error;
  const mapping=new Map((orders.data||[]).map(x=>[x.order_id,x]));
  return (ship.data||[]).map(row=>({...row,_order:mapping.get(row.order_id)||null}));
 }
 const schema=schemas[view];const {data,error}=await db.from(schema.table).select('*').order('created_at',{ascending:false}).limit(500);if(error)throw error;return data||[]
}
async function loadView(view){if(loading)return;loading=true;currentView=view;setMobileMenu(false);document.querySelectorAll('.nav-link').forEach(el=>el.classList.toggle('selected',el.dataset.view===view));const meta=schemas[view]||(view==='team'&&currentRole==='owner'?{title:'Akun Tim',desc:'Setujui atau cabut akses staf yang sudah memverifikasi email.'}:null);if(view==='team'&&currentRole!=='owner')return notify('Menu khusus pemilik',true);const title=meta?.title||'Overview';$('#pageTitle').textContent=title;$('#breadcrumb').textContent=title;$('#pageDesc').textContent=meta?.desc||'Ringkasan operasional dan konten website GoO Ninks.';$('#newButton').hidden=!schemas[view]||view==='orders'||view==='shipping';$('#overviewScreen').hidden=view!=='overview';$('#moduleScreen').hidden=view==='overview';$('#systemNotice').hidden=true;
 try{if(view==='team'){await loadTeam()}else if(!schemas[view])await overview();else {rows=await fetchRows(view);$('#searchBox').value='';renderTable()}}catch(e){$('#systemNotice').hidden=false;$('#systemNotice').textContent='Gagal memuat data: '+e.message;notify('Gagal memuat data',true)}finally{loading=false}}
async function overview(){const result=await Promise.all(Object.keys(schemas).map(async name=>{const data=await fetchRows(name);return [name,data]}));const x=Object.fromEntries(result);const totalArticles=x.articles.filter(a=>a.status==='published').length,liveAds=x.ads.filter(a=>a.active).length,pending=x.leads.filter(a=>a.stage==='new').length,low=x.inventory.filter(a=>a.stock!==null&&a.stock<=a.low_stock_threshold);const metrics=[['Artikel terbit',totalArticles,'dari '+x.articles.length+' artikel'],['Iklan aktif',liveAds,'dari '+x.ads.length+' iklan'],['Leads baru',pending,'perlu tindak lanjut'],['Produk katalog',x.inventory.length,low.length+' stok rendah']];$('#metrics').innerHTML=metrics.map(m=>'<div class="metric"><div class="metric-label">'+safe(m[0])+'</div><div class="metric-value">'+safe(m[1])+'</div><div class="metric-note">'+safe(m[2])+'</div></div>').join('');
 const all=[...x.articles.map(a=>({what:'Artikel · '+a.title,when:a.created_at,state:a.status})),...x.leads.map(a=>({what:'Lead · '+a.name,when:a.created_at,state:a.stage})),...x.promotions.map(a=>({what:'Promosi · '+a.title,when:a.created_at,state:a.active?'aktif':'nonaktif'}))].sort((a,b)=>new Date(b.when)-new Date(a.when)).slice(0,7);
 $('#activity').innerHTML=all.length?all.map(a=>'<div class="row-item"><div><strong>'+safe(a.what)+'</strong><span>'+dateText(a.when)+'</span></div><span class="pill">'+safe(a.state)+'</span></div>').join(''):'<div class="empty"><strong>Belum ada aktivitas</strong>Mulai dari membuat artikel atau promosi pertama.</div>';
 $('#stockAlert').innerHTML=low.length?low.slice(0,8).map(p=>'<div class="stock-item"><div><strong>'+safe(p.product_name)+'</strong><span>'+safe(p.sku)+'</span></div><span class="inventory-warning">'+Number(p.stock)+' tersisa</span></div>').join(''):'<div class="empty"><strong>Stok aman</strong>Belum ada produk dengan stok terkonfirmasi di bawah batas. Stok yang belum diketahui tidak dihitung.</div>';
 void refreshPaymentReadiness(x.inventory);
}
async function refreshPaymentReadiness(inventory){
 const target=$('#paymentReadiness');
 if(!target)return;
 const visible=inventory.filter(p=>p.visible!==false);
 const confirmed=visible.filter(p=>Number.isInteger(p.stock)&&p.stock>0);
 const unknown=visible.filter(p=>p.stock===null||p.stock===undefined);
 const soldOut=visible.filter(p=>p.stock===0);
 const adminStockUrl='https://gooninks.co.id/admin.html';
 target.replaceChildren();
 const info=document.createElement('p');
 info.className='gn-payment-readiness-summary';
 info.textContent='Stok terkonfirmasi: '+confirmed.length+' dari '+visible.length+' produk tampil. '+unknown.length+' belum memiliki angka stok, '+soldOut.length+' habis.';
 target.append(info);
 const mode=document.createElement('p');
 mode.className='gn-payment-readiness-summary';
 mode.textContent='Memeriksa status Midtrans…';
 target.append(mode);
 const controls=document.createElement('div');
 controls.className='gn-payment-readiness-links';
 const manage=document.createElement('button');
 manage.type='button';manage.textContent='Atur stok produk ↗';
 manage.addEventListener('click',()=>loadView('inventory'));
 controls.append(manage);
 const status=document.createElement('a');
 status.href='https://supabase.com/dashboard/project/etahuzvozoomklsqepyt/functions/secrets';
 status.target='_blank';status.rel='noopener noreferrer';
 status.textContent='Buka pengaturan secrets ↗';
 controls.append(status);
 target.append(controls);
 try{
  const response=await fetch(cfg.url+'/functions/v1/gn-midtrans-checkout',{method:'GET',cache:'no-store'});
  if(!response.ok)throw Error('Gateway tidak dapat dihubungi (HTTP '+response.status+')');
  const data=await response.json();
  if(typeof data.enabled!=='boolean'||!['sandbox','production'].includes(data.mode))throw Error('Respons gateway tidak valid');
  mode.textContent='Midtrans: '+(data.enabled?(data.mode==='production'?'mode LIVE aktif':'SANDBOX untuk pengujian'):'belum diaktifkan')+'.';
  if(data.configuration&&!data.enabled)mode.textContent+=' '+(!data.configuration.server_key_configured?'MIDTRANS_SERVER_KEY belum tersedia. ':'')+(!data.configuration.payments_enabled?'MIDTRANS_PAYMENTS_ENABLED belum true.':'');
  if(data.mode==='production'&&data.enabled&&unknown.length)mode.textContent+=' Periksa stok yang belum dikonfirmasi sebelum menerima pesanan.';
 }catch(error){
  mode.textContent='Status gateway belum dapat dicek dari dashboard: '+(error instanceof Error?error.message:'Koneksi tidak tersedia')+'.';
 }
}
function pill(label,on){return '<span class="pill '+(on?'on':'off')+'">'+safe(label)+'</span>'}
function rowDetails(r){switch(currentView){case 'orders':return [safe(r.customer_name),rupiah(r.amount),pill(r.status,r.status==='paid')];case 'articles':return [safe(r.slug),pill(r.status,r.status==='published'),dateText(r.created_at)];case 'ads':return [safe(r.placement),pill(r.active?'Tayang':'Nonaktif',r.active),dateText(r.created_at)];case 'promotions':return [safe(r.code||'—'),safe((r.discount_percent||0)+'%'),pill(r.active?'Aktif':'Nonaktif',r.active)];case 'leads':return [safe(r.phone||r.email||'—'),safe(r.interest||'—'),pill(r.stage,r.stage==='won')];case 'inventory':return [safe(r.sku),rupiah(r.price),r.stock===null?'Belum diketahui':pill(String(r.stock),r.stock>r.low_stock_threshold)];default:return []}}
function renderTable(){const search=$('#searchBox').value.trim().toLowerCase();const subset=rows.filter(o=>JSON.stringify(o).toLowerCase().includes(search));$('#rowCounter').textContent=subset.length+' data';const root=$('#records');if(currentView==='orders'){renderOrderQueue(subset);return}if(currentView==='shipping'){renderShippingQueue(subset);return}if(!subset.length){root.innerHTML='<div class="empty"><strong>Belum ada data</strong>Gunakan tombol Tambah baru untuk mulai mengelola '+safe(schemas[currentView].title.toLowerCase())+'.</div>';return}
 const headings={orders:['ID Pesanan','Pelanggan','Total','Status'],articles:['Artikel','Slug','Status','Dibuat'],ads:['Iklan','Posisi','Status','Dibuat'],promotions:['Promosi','Kode','Diskon','Status'],leads:['Nama','Kontak','Minat','Status'],inventory:['Produk','SKU','Harga','Stok']}[currentView];
 root.innerHTML='<table class="record-table"><thead><tr>'+headings.map(t=>'<th>'+safe(t)+'</th>').join('')+(currentView==='orders'?'':'<th class="actions">Aksi</th>')+'</tr></thead><tbody>'+subset.map(r=>{const key=String(r[schemas[currentView].key]);const details=rowDetails(r);return '<tr><td><strong>'+safe(r[schemas[currentView].headline])+'</strong><small>'+dateText(r.updated_at||r.created_at)+'</small></td>'+details.map(x=>'<td>'+x+'</td>').join('')+(currentView==='orders'?'':'<td class="actions"><button type="button" data-edit="'+safe(key)+'">Edit</button><button type="button" class="danger" data-delete="'+safe(key)+'">Hapus</button></td>')+'</tr>'}).join('')+'</tbody></table>';
}

const SHIP_LABELS={
 awaiting_payment:'Menunggu pembayaran',ready_to_pack:'Siap dikemas',packing:'Sedang dikemas',
 ready_to_ship:'Siap dikirim',shipped:'Dalam pengiriman',delivered:'Terkirim',
 cancelled:'Dibatalkan',review:'Perlu pemeriksaan'
};
const SHIP_NEXT={ready_to_pack:'packing',packing:'ready_to_ship',ready_to_ship:'shipped',shipped:'delivered'};
function checkoutItems(items){
 if(!Array.isArray(items))return '';
 return items.map(x=>safe(x.name||x.sku||'Produk')+' × '+safe(x.qty)+' · '+rupiah(x.price)).join('<div class="gn-shipping-line-gap"></div>');
}
function orderContact(o){
 if(!o)return '<span class="inventory-warning">Data pesanan belum tersedia</span>';
 return '<strong>'+safe(o.customer_name)+'</strong><div>'+safe(o.customer_email)+'</div><div>'+safe(o.customer_phone)+'</div>';
}
function renderOrderQueue(data){
 const root=$('#records');
 if(!data.length){root.innerHTML='<div class="empty"><strong>Belum ada pesanan pembayaran</strong>Pesanan online akan muncul setelah pelanggan mengirim formulir checkout.</div>';return}
 root.innerHTML='<div class="gn-orders-queue">'+data.map(o=>
  '<details class="gn-order-card"><summary><span class="gn-order-number">'+safe(o.order_id)+'</span><span>'+safe(o.customer_name)+'</span><span>'+rupiah(o.amount)+'</span>'+pill(o.status,o.status==='paid')+'<span class="gn-order-more">Detail ▾</span></summary>'+
  '<div class="gn-order-body"><div><h4>Data penerima</h4>'+orderContact(o)+'<p><b>Alamat lengkap</b><span>'+safe(o.customer_address)+'</span></p></div>'+
  '<div><h4>Rincian produk</h4><p>'+checkoutItems(o.items)+'</p><p>Dibuat: '+dateText(o.created_at)+'</p><p>Status pembayaran: '+safe(o.status)+'</p>'+
  '<button type="button" data-go-shipping="'+safe(o.order_id)+'">Buka proses pengiriman ↗</button></div></div></details>'
 ).join('')+'</div>';
}
function renderShippingQueue(data){
 const root=$('#records');
 if(!data.length){root.innerHTML='<div class="empty"><strong>Belum ada antrean pengiriman</strong>Antrean otomatis dibuat ketika pelanggan berhasil mengirim checkout Midtrans.</div>';return}
 const counts={};for(const x of data)counts[x.status]=(counts[x.status]||0)+1;
 const summary=['awaiting_payment','ready_to_pack','packing','ready_to_ship','shipped','delivered','cancelled','review']
 .filter(x=>counts[x]).map(x=>'<span class="gn-ship-summary">'+safe(SHIP_LABELS[x])+' <b>'+counts[x]+'</b></span>').join('');
 root.innerHTML='<div class="gn-ship-summary-row">'+summary+'</div><div class="gn-orders-queue">'+data.map(x=>{
  const o=x._order,next=SHIP_NEXT[x.status],canUpdate=o?.status==='paid'&&!!next;
  const stepLabel=SHIP_LABELS[x.status]||x.status;
  const btnText={packing:'Mulai pengemasan',ready_to_ship:'Selesai dikemas',shipped:'Tandai sudah dikirim',delivered:'Tandai telah diterima'}[next]||'Simpan';
  const delivery=(x.status==='shipped'||x.status==='delivered')&&x.tracking_number?
   '<p><b>Pengiriman:</b> '+safe(x.carrier)+' · Resi '+safe(x.tracking_number)+'</p>':'';
  return '<details class="gn-order-card"><summary><span class="gn-order-number">'+safe(x.order_id)+'</span><span>'+safe(o?.customer_name||'Pelanggan')+'</span>'+
    pill(stepLabel,x.status==='delivered')+'<span>'+rupiah(o?.amount||0)+'</span><span class="gn-order-more">Detail ▾</span></summary>'+
    '<div class="gn-order-body"><div><h4>Penerima & alamat kirim</h4>'+orderContact(o)+
    '<p><b>Alamat:</b><span>'+safe(o?.customer_address||'Belum tersedia')+'</span></p>'+
    '<h4>Produk yang dipesan</h4><p>'+checkoutItems(o?.items)+'</p></div>'+
    '<div><h4>Pembayaran & pengiriman</h4><p>Midtrans: '+safe(o?.status||'Belum tersedia')+'</p>'+
    '<p>Tahap: <b>'+safe(stepLabel)+'</b></p>'+delivery+
    (!canUpdate?'<p class="gn-ship-warning">'+(o?.status==='paid'?'Tahap ini tidak dapat dilanjutkan.':'Jangan dikemas atau dikirim sebelum pembayaran terverifikasi lunas.')+'</p>':
    '<form data-shipping-form="'+safe(x.order_id)+'" class="gn-shipment-editor">'+
    '<input type="hidden" name="status" value="'+safe(next)+'">'+
    '<label>Kurir / ekspedisi<input name="carrier" maxlength="100" value="'+safe(x.carrier||'')+'" placeholder="Contoh: JNE, J&T, SiCepat" '+(next==='shipped'||next==='delivered'?'required':'')+'></label>'+
    '<label>Nomor resi<input name="tracking_number" maxlength="120" value="'+safe(x.tracking_number||'')+'" placeholder="Nomor pelacakan paket" '+(next==='shipped'||next==='delivered'?'required minlength="5"':'')+'></label>'+
    '<label>Catatan admin<textarea name="notes" maxlength="500" rows="2" placeholder="Informasi paket dan ongkir">'+safe(x.fulfillment_notes||'')+'</textarea></label>'+
    '<p class="gn-shipping-notice">Konfirmasi ongkos kirim kepada pembeli secara terpisah sebelum menyerahkan paket ke ekspedisi.</p>'+
    '<button type="submit" class="primary small">'+safe(btnText)+' →</button></form>')+
    '</div></div></details>'
 }).join('')+'</div>';
}
async function updateShipping(form){
 const button=form.querySelector('button[type="submit"]');const fd=new FormData(form);
 button.disabled=true;
 try{
  const {error}=await db.rpc('gn_set_shipping_progress_v1',{
   p_order_id:form.dataset.shippingForm,p_status:String(fd.get('status')),
   p_carrier:String(fd.get('carrier')||'').trim(),
   p_tracking_number:String(fd.get('tracking_number')||'').trim(),
   p_notes:String(fd.get('notes')||'').trim()
  });
  if(error)throw error;
  notify('Status pengiriman berhasil diperbarui');
  await loadView('shipping');
 }catch(e){notify('Pengiriman: '+(e.message||'Gagal memperbarui'),true)}
 finally{button.disabled=false}
}

function inputFor(f,row){const [name,label,kind,required]=f;const value=row?.[name];const req=required?'required':'';const id='field_'+name;const v=value===null||value===undefined?'':String(value);let field;
 if(kind==='checkbox')return '<label class="toggle"><input id="'+id+'" name="'+name+'" type="checkbox" '+(value===true?'checked':'')+'><span>'+safe(label)+'</span></label>';
 if(kind==='textarea')field='<textarea id="'+id+'" name="'+name+'" '+req+' rows="'+(name==='body'?8:4)+'">'+safe(v)+'</textarea>';
 else if(kind.startsWith('select:'))field='<select id="'+id+'" name="'+name+'">'+kind.slice(7).split('|').map(opt=>'<option value="'+safe(opt)+'" '+(v===opt?'selected':'')+'>'+safe(opt)+'</option>').join('')+'</select>';
 else {const type=kind==='slug'?'text':kind;const x=type==='datetime-local'&&v?new Date(v).toISOString().slice(0,16):v;const disabled=editing&&name==='sku'?'readonly':'';const extra=kind==='number'?'min="0" step="1"':'';field='<input id="'+id+'" name="'+name+'" type="'+type+'" value="'+safe(x)+'" '+req+' '+disabled+' '+extra+'>'}
 const upload=(kind==='image')?'<label class="upload-label">Atau unggah JPG / PNG / WEBP (maksimal 5 MB)<input name="upload_'+name+'" type="file" accept="image/jpeg,image/png,image/webp"></label>':'';
 return '<label class="field" for="'+id+'">'+safe(label)+field+upload+'</label>'}
function openEditor(row=null){editing=row;$('#editorTitle').textContent=(row?'Edit ':'Tambah ')+schemas[currentView].title;$('#formFields').innerHTML=schemas[currentView].fields.map(f=>inputFor(f,row)).join('');$('#editorDialog').showModal();if(!row&&currentView==='articles'){const name=$('#field_title'),slug=$('#field_slug');let custom=false;slug.addEventListener('input',()=>custom=true);name.addEventListener('input',()=>{if(!custom)slug.value=name.value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')})}}
async function saveRow(e){e.preventDefault();const schema=schemas[currentView];const form=e.currentTarget;const fd=new FormData(form);const payload={};for(const [name,,kind,required] of schema.fields){let v;if(kind==='checkbox')v=fd.get(name)==='on';else if(kind==='number'){v=fd.get(name)===''&&name==='stock'?null:Number(fd.get(name)||0)}else if(kind==='datetime-local')v=fd.get(name)?new Date(String(fd.get(name))).toISOString():null;else v=String(fd.get(name)||'').trim();if(required&&(v===''||v===null||Number.isNaN(v)))return notify('Isi semua kolom wajib',true);payload[name]=v}
 if(currentView==='leads'&&!editing){payload.source='admin';payload.consent=true}
 if(currentView==='inventory'&&editing)delete payload.sku;
 const save=$('#saveButton');save.disabled=true;save.textContent='Menyimpan…';try{
  for(const [name,,kind] of schema.fields){if(kind!=='image')continue;const file=fd.get('upload_'+name);if(file instanceof File&&file.size>0){if(file.size>5242880||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Foto harus JPG/PNG/WEBP dan maksimal 5 MB');const ext=file.type.split('/')[1].replace('jpeg','jpg');const path=currentView+'/'+crypto.randomUUID()+'.'+ext;const {error:uploadError}=await db.storage.from('gooninks-media').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;payload[name]=db.storage.from('gooninks-media').getPublicUrl(path).data.publicUrl}}
  if(Object.prototype.hasOwnProperty.call(payload,'updated_at'))delete payload.updated_at; if(currentView!=='leads')payload.updated_at=new Date().toISOString();
  let operation=editing?db.from(schema.table).update(payload).eq(schema.key,editing[schema.key]):db.from(schema.table).insert(payload);
  const {error}=await operation.select();if(error)throw error;$('#editorDialog').close();notify('Perubahan berhasil disimpan');await loadView(currentView);
 }catch(err){notify(err.message||'Gagal menyimpan',true)}finally{save.disabled=false;save.textContent='Simpan perubahan'}
}
async function eraseRow(key){const schema=schemas[currentView];const record=rows.find(r=>String(r[schema.key])===key);if(!record)return;if(!confirm('Hapus '+record[schema.headline]+'? Tindakan ini tidak bisa dibatalkan.'))return;try{const {error}=await db.from(schema.table).delete().eq(schema.key,key);if(error)throw error;notify('Data berhasil dihapus');await loadView(currentView)}catch(e){notify(e.message,true)}}
function setMobileMenu(open){const sidebar=$('#sidebar');const trigger=$('#mobileNav');if(!sidebar||!trigger)return;sidebar.classList.toggle('open',open);trigger.setAttribute('aria-expanded',String(open));document.body.classList.toggle('gn-admin-menu-open',open)}
function events(){
 $('#loginForm').addEventListener('submit',login);
 $('#signupForm').addEventListener('submit',signup);
 $('#forgotForm').addEventListener('submit',requestPasswordReset);
 $('#recoveryForm').addEventListener('submit',saveNewPassword);
 $('#forgotPassword').addEventListener('click',()=>{switchAuth('forgot');$('#forgotForm [name="email"]').value=$('#loginForm [name="email"]').value.trim()});
 $('#backFromForgot').addEventListener('click',()=>switchAuth('login'));
 $('#showSignup').addEventListener('click',()=>switchAuth('signup'));
 $('#showLogin').addEventListener('click',()=>switchAuth('login'));
 $('#logoutButton').addEventListener('click',logout);
 $('#mobileNav').addEventListener('click',()=>setMobileMenu(!$('#sidebar').classList.contains('open')));
 document.addEventListener('click',e=>{if(window.innerWidth<=800&&$('#sidebar').classList.contains('open')&&!e.target.closest('#sidebar,#mobileNav'))setMobileMenu(false)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')setMobileMenu(false)});
 window.addEventListener('resize',()=>{if(window.innerWidth>800)setMobileMenu(false)});
 $('#sidebarNav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)loadView(b.dataset.view)});
 $('#newButton').addEventListener('click',()=>openEditor());
 $('#searchBox').addEventListener('input',()=>currentView==='team'?renderTeam():renderTable());
 $('#records').addEventListener('submit',e=>{const form=e.target.closest('[data-shipping-form]');if(form){e.preventDefault();void updateShipping(form)}});
 $('#records').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');const del=e.target.closest('[data-delete]');if(currentView==='team'){const approve=e.target.closest('[data-approve]');const revoke=e.target.closest('[data-revoke]');if(approve)changeTeam(approve.dataset.approve,true);if(revoke)changeTeam(revoke.dataset.revoke,false);return}const jump=e.target.closest('[data-go-shipping]');if(jump){void loadView('shipping');return}if(currentView==='shipping'||currentView==='orders')return;const schema=schemas[currentView];if(edit){const r=rows.find(x=>String(x[schema.key])===edit.dataset.edit);if(r)openEditor(r)}else if(del)eraseRow(del.dataset.delete)});
 $('#closeEditor').addEventListener('click',()=>$('#editorDialog').close());
 $('#cancelEditor').addEventListener('click',()=>$('#editorDialog').close());
 $('#editorForm').addEventListener('submit',saveRow);
}


// Postgres Changes is authorized by existing admin RLS; never expose orders to anon.
let orderChannel=null,orderRefreshTimer=null,orderFallbackTimer=null,orderRefreshBusy=false;
async function refreshOrderView(){
 if(!currentUser||document.hidden)return;
 if(loading||orderRefreshBusy){queueOrderRefresh();return}
 if(!['orders','shipping','leads','overview'].includes(currentView))return;
 // Avoid replacing a shipping form while an administrator is editing it.
 if($('#editorDialog')?.open||document.activeElement?.closest('[data-shipping-form]'))return;
 orderRefreshBusy=true;const view=currentView;
 try{
  if(view==='overview')await overview();
  else{
   const fresh=await fetchRows(view);
   if(currentView!==view||!currentUser)return;
   const opened=new Set([...document.querySelectorAll('.gn-order-card[open]')].map(x=>x.querySelector('.gn-order-number')?.textContent));
   rows=fresh;renderTable();
   document.querySelectorAll('.gn-order-card').forEach(x=>{x.open=opened.has(x.querySelector('.gn-order-number')?.textContent)});
  }
 }catch(error){console.warn('Automatic order refresh unavailable');}
 finally{orderRefreshBusy=false}
}
function queueOrderRefresh(){clearTimeout(orderRefreshTimer);orderRefreshTimer=setTimeout(()=>void refreshOrderView(),400)}
function stopOrderRealtime(){
 clearTimeout(orderRefreshTimer);clearInterval(orderFallbackTimer);
 if(orderChannel&&db)void db.removeChannel(orderChannel);
 orderChannel=null;
}
function startOrderRealtime(){
 stopOrderRealtime();
 orderChannel=db.channel('gn-admin-orders-'+currentUser.id);
 for(const table of ['gn_orders','gn_shipments','gn_leads']){
  orderChannel.on('postgres_changes',{event:'*',schema:'public',table},queueOrderRefresh);
 }
 orderChannel.subscribe(status=>{if(status==='SUBSCRIBED')queueOrderRefresh()});
 // Recover missed events after a connection interruption.
 orderFallbackTimer=setInterval(()=>void refreshOrderView(),30000);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueOrderRefresh()});
window.addEventListener('online',queueOrderRefresh);

events();boot();
