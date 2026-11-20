'use strict';
(()=>{
 const $=s=>document.querySelector(s);
 const data={groups:[],group:0,index:0};
 const image=$('#lbImage'),status=$('#lbStatus'),shell=$('#lbImageShell');
 const path=(g,i)=>g.images[i].src;
 const fmt=(n,p=2)=>String(n).padStart(p,'0');
 const onlyValidImage=url=>typeof url==='string'&&/^\/assets\/gooninks-lookbook\/\d{2}\/[a-z0-9-]+\.webp$/.test(url);
 const safeTitle=s=>typeof s==='string'?s:'GoO Ninks studio photography';
 function setImage(url){
   image.onload=()=>{$('#lbImageError').hidden=true;shell.classList.remove('lb-image-pending')};
   image.onerror=()=>{$('#lbImageError').hidden=false;shell.classList.remove('lb-image-pending')};
   shell.classList.add('lb-image-pending');image.src=url;
 }
 function renderThumbs(){
   const g=data.groups[data.group];
   const track=$('#lbThumbnails');track.replaceChildren();
   if(!g||g.images.length<2)return;
   // Only render nearby thumbnails, so even sessions with 70 photos stay lightweight.
   const indexes=[];
   for(let k=-3;k<=3;k++){const ix=data.index+k;if(ix>=0&&ix<g.images.length)indexes.push(ix)}
   const makeButton=(idx,more)=>{
     const b=document.createElement('button');b.type='button';
     b.className='lb-thumb'+(idx===data.index?' is-active':'');
     b.setAttribute('aria-pressed',idx===data.index?'true':'false');
     b.setAttribute('aria-label','Lihat foto '+(idx+1)+' dari '+g.images.length);
     if(more){b.classList.add('lb-thumb-more');b.textContent='…';}
     else{
       const im=document.createElement('img');im.src=path(g,idx);im.alt='';
       im.loading='lazy';im.decoding='async';b.append(im);
     }
     b.addEventListener('click',()=>go(idx));track.append(b);
   };
   if(indexes[0]>0)makeButton(0,true);
   indexes.forEach(i=>makeButton(i,false));
   if(indexes.at(-1)<g.images.length-1)makeButton(g.images.length-1,true);
 }
 function render(){
   const g=data.groups[data.group];if(!g)return;
   const item=g.images[data.index];
   $('#lbSessionBadge').textContent='GOO NINKS / '+g.id;
   $('#lbSessionTitle').textContent=g.title;
   $('#lbOriginalFile').textContent=item.original||'GoO Ninks product photography';
   $('#lbCounter').textContent=fmt(data.index+1)+' / '+fmt(g.images.length);
   $('#lbAccessibleCounter').textContent='Foto '+(data.index+1)+' dari '+g.images.length;
   $('#lbPrev').disabled=g.images.length<2;
   $('#lbNext').disabled=g.images.length<2;
   document.querySelectorAll('.lb-series-button').forEach((b,i)=>{
     b.classList.toggle('is-active',i===data.group);
     b.setAttribute('aria-pressed',i===data.group?'true':'false');
   });
   setImage(path(g,data.index));
   renderThumbs();
   try{
     const u=new URL(location.href);u.searchParams.set('set',g.id);u.searchParams.set('photo',String(data.index+1));history.replaceState(null,'',u.pathname+u.search);
   }catch{}
   const next=g.images[(data.index+1)%g.images.length];
   if(next&&onlyValidImage(next.src)){const pre=new Image();pre.src=next.src}
 }
 function go(index){
   const g=data.groups[data.group];if(!g)return;
   data.index=(index+g.images.length)%g.images.length;render();
 }
 function groupAt(i){
   if(i<0||i>=data.groups.length)return;
   data.group=i;data.index=0;render();
 }
 function series(){
   const list=$('#lbSessions');list.replaceChildren();
   data.groups.forEach((g,i)=>{
     const b=document.createElement('button');b.type='button';b.className='lb-series-button';
     const thumb=document.createElement('span');thumb.className='lb-series-cover';
     const img=document.createElement('img');img.alt='';img.src=g.cover;img.loading=i<2?'eager':'lazy';img.decoding='async';thumb.append(img);
     const copy=document.createElement('span');copy.className='lb-series-copy';
     const kicker=document.createElement('small');kicker.textContent='STUDIO EDIT / '+g.id;
     const title=document.createElement('strong');title.textContent=g.title;
     const number=document.createElement('em');number.textContent=g.count+' photographs';
     copy.append(kicker,title,number);
     const arrow=document.createElement('span');arrow.className='lb-series-arrow';arrow.textContent='↗';
     b.append(thumb,copy,arrow);b.addEventListener('click',()=>groupAt(i));list.append(b);
   });
 }
 function enableInputs(){
   $('#lbPrev').addEventListener('click',()=>go(data.index-1));
   $('#lbNext').addEventListener('click',()=>go(data.index+1));
   document.addEventListener('keydown',e=>{
     if(!data.groups.length||e.altKey||e.ctrlKey||e.metaKey||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
     if(e.key==='ArrowRight'){e.preventDefault();go(data.index+1)}
     if(e.key==='ArrowLeft'){e.preventDefault();go(data.index-1)}
   });
   let start=null;
   shell.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;start={x:e.touches[0].clientX,y:e.touches[0].clientY}}, {passive:true});
   shell.addEventListener('touchend',e=>{
     if(!start)return;
     const dx=e.changedTouches[0].clientX-start.x;
     const dy=e.changedTouches[0].clientY-start.y;start=null;
     if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.3)go(data.index+(dx<0?1:-1));
   },{passive:true});
 }
 async function init(){
   enableInputs();
   try{
     const resp=await fetch('/assets/gooninks-lookbook/manifest.json',{cache:'no-store'});
     if(!resp.ok)throw Error('Galeri belum dipublikasikan ('+resp.status+')');
     const result=await resp.json();
     if(result.total_photos!==322||!Array.isArray(result.groups)||result.groups.length!==6)throw Error('Data foto belum lengkap');
     if(result.groups.some(g=>!Array.isArray(g.images)||g.images.some(im=>!onlyValidImage(im.src))))throw Error('Alamat foto tidak valid');
     data.groups=result.groups;
     $('#lbGroupCount').textContent=fmt(data.groups.length);
     $('#lbTotalLabel').textContent=result.total_photos+' ORIGINAL PHOTOGRAPHS';
     series();
     const q=new URL(location.href).searchParams;
     const byId=data.groups.findIndex(g=>g.id===q.get('set'));
     if(byId>=0)data.group=byId;
     const requested=Number(q.get('photo'));
     if(Number.isInteger(requested)&&requested>=1&&requested<=data.groups[data.group].images.length)data.index=requested-1;
     render();
     status.textContent=result.total_photos+' foto tersedia dalam '+data.groups.length+' sesi studio.';
   }catch(e){
     status.textContent='Galeri foto sedang disiapkan. Silakan buka halaman ini kembali setelah foto berhasil diunggah.';
     $('#lbImageError').textContent='Galeri foto belum siap. Foto katalog utama tetap tersedia.';
     $('#lbImageError').hidden=false;
     console.warn('GoO Ninks studio gallery:',e.message);
   }
 }
 init();
})();
