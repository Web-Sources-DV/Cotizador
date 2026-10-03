const roles = new Set(['ADMIN', 'SUPERVISOR', 'EXECUTIVE', 'VIEWER']);
const origin = 'https://web-sources-dv.github.io';
export function createHandler({supabaseUrl, anonKey, serviceKey, fetchImpl = fetch}) {
 return async request => {
  const headers = {'Content-Type':'application/json','Cache-Control':'no-store',
   'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
   'Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(request.headers.get('origin') && request.headers.get('origin')!==origin) return reply(403,{error:'Origen no permitido.'});
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
  if(request.method!=='POST') return reply(405,{error:'Método no permitido.'});
  if(!supabaseUrl || !anonKey || !serviceKey) return reply(503,{error:'Servicio no disponible.'});
  const authorization=request.headers.get('authorization')||'';
  if(!/^Bearer \S+$/i.test(authorization)) return reply(401,{error:'Inicia sesión.'});
  try {
   const authResponse=await fetchImpl(supabaseUrl+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:authorization}});
   if(!authResponse.ok) return reply(401,{error:'Sesión no válida.'});
   const user=await authResponse.json();
   if(!user.id || !/^[0-9a-f-]{36}$/i.test(user.id)) return reply(401,{error:'Sesión no válida.'});
   const adminHeaders={apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'};
   const profileResponse=await fetchImpl(supabaseUrl+'/rest/v1/sqp_profiles?select=role,active&id=eq.'+encodeURIComponent(user.id),{headers:adminHeaders});
   if(!profileResponse.ok) return reply(503,{error:'No se pudo validar el permiso.'});
   const profiles=await profileResponse.json();
   if(profiles.length!==1 || profiles[0].role!=='ADMIN' || profiles[0].active!==true)
    return reply(403,{error:'Solo un administrador activo puede crear usuarios.'});
   const raw=await request.text();
   if(raw.length>4096) return reply(413,{error:'Solicitud demasiado grande.'});
   let body; try{body=JSON.parse(raw)}catch{return reply(400,{error:'Datos no válidos.'})}
   const name=typeof body?.name==='string'?body.name.trim():'';
   const email=typeof body?.email==='string'?body.email.trim():'';
   const password=body?.password;
   if(!name || name.length>120 || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
     typeof password!=='string' || password.length<12 || password.length>128 || !roles.has(body.role))
    return reply(400,{error:'Revisa nombre, correo, rol y contraseña (12 a 128 caracteres).'});
   const result=await fetchImpl(supabaseUrl+'/auth/v1/admin/users',{method:'POST',headers:adminHeaders,
    body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:name},app_metadata:{role:body.role}})});
   if(!result.ok) {
    const failure=await result.json().catch(()=>({}));
    if(['email_exists','user_already_exists','email_address_not_authorized'].includes(failure.code))
     return reply(409,{error:'No se creó la cuenta. Comprueba si el correo ya está registrado.'});
    return reply(400,{error:'No se pudo crear la cuenta. Revisa el correo y los requisitos de contraseña.'});
   }
   const created=await result.json();
   return reply(201,{id:created.id,message:'Usuario creado.'});
  } catch {return reply(503,{error:'Servicio no disponible. Comprueba la lista de usuarios antes de reintentar.'});}
 };
}
