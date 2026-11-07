// Verify in the backend before any order reservation or payment request.
export const turnstileStatus = () => ({required:true,configured:!!Deno.env.get('TURNSTILE_SECRET_KEY')});
export async function verifyCheckoutTurnstile(token: unknown) {
  const secret=Deno.env.get('TURNSTILE_SECRET_KEY');
  if(!secret) return {ok:false,status:503,error:'Verifikasi keamanan belum dikonfigurasi. Hubungi admin.'};
  if(typeof token!=='string' || token.length<1 || token.length>2048)
    return {ok:false,status:400,error:'Selesaikan verifikasi keamanan sebelum membayar.'};
  try {
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({secret,response:token}),signal:AbortSignal.timeout(10000),
    });
    if(!response.ok) throw Error('Verification unavailable');
    const result=await response.json();
    if(result.success!==true || !['gooninks.co.id','www.gooninks.co.id'].includes(result.hostname) || result.action!=='checkout')
      return {ok:false,status:403,error:'Verifikasi keamanan gagal atau kedaluwarsa. Silakan verifikasi ulang.'};
    return {ok:true,status:200,error:''};
  } catch {
    return {ok:false,status:503,error:'Layanan verifikasi sedang tidak tersedia. Silakan coba kembali.'};
  }
}
