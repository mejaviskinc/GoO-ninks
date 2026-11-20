'use strict';
(async()=>{
 const mount=document.getElementById('gnStudioPhotoCovers');
 if(!mount)return;
 try{
  const response=await fetch('/assets/gooninks-lookbook/manifest.json');
  if(!response.ok)throw Error('Gallery manifest unavailable');
  const data=await response.json();
  if(data.total_photos!==322||!Array.isArray(data.groups)||data.groups.length!==6)return;
  const fragment=document.createDocumentFragment();
  for(const group of data.groups){
   if(!/^\d{2}$/.test(group.id)||!/^\/assets\/gooninks-lookbook\/\d{2}\/[a-z0-9-]+\.webp$/.test(group.cover))continue;
   const link=document.createElement('a');link.className='gn-studio-cover';link.href='/lookbook.html?set='+encodeURIComponent(group.id);
   link.setAttribute('aria-label','Jelajahi sesi foto '+group.id+', '+group.count+' foto');
   const frame=document.createElement('span');frame.className='gn-studio-cover-frame';
   const photo=document.createElement('img');photo.src=group.cover;photo.alt='GoO Ninks Studio Session '+group.id;photo.loading='lazy';photo.decoding='async';photo.width=320;photo.height=430;
   const marker=document.createElement('span');marker.className='gn-studio-cover-index';marker.textContent='EDIT '+group.id;frame.append(photo,marker);
   const name=document.createElement('strong');name.className='gn-studio-cover-name';name.textContent='Studio '+group.id;
   const caption=document.createElement('small');caption.className='gn-studio-cover-count';caption.textContent=group.count+' fotografi';
   link.append(frame,name,caption);fragment.append(link);
  }
  mount.replaceChildren(fragment);
 }catch(error){console.warn('GoO Ninks editorial photography:',error.message)}
})();
