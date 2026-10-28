const encoder = new TextEncoder();
const ACTIONS = new Set(['public.state','public.search','public.register','auth.login','parent.get','parent.update','parent.receipt',
  'admin.dashboard','admin.reviewPayment','admin.release','admin.updateRegistration','admin.settings','admin.receipt','admin.backup','admin.export','admin.syncRoster','admin.resetAccess']);
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,'0')).join('');
export async function hmac(secret, value) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
}
function base64url(value) {
  const s=value.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
}

export async function readBoundedBody(request,maximum=7600000) {
  const declared=request.headers.get('Content-Length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maximum))throw new Error('BODY_TOO_LARGE');
  if(!request.body)return '';
  const reader=request.body.getReader(),chunks=[];let total=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maximum){await reader.cancel();throw new Error('BODY_TOO_LARGE');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const combined=new Uint8Array(total);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(combined);
}

let jwksCache={keys:[],expires:0};
export async function verifyAdminToken(token, env, fetcher=fetch) {
  if(!env.ADMIN_GOOGLE_CLIENT_ID || !env.ADMIN_EMAILS) throw new Error('ADMIN_SETUP_REQUIRED');
  if(typeof token!=='string'||token.length>12000) throw new Error('UNAUTHORIZED');
  const parts=token.split('.');if(parts.length!==3)throw new Error('UNAUTHORIZED');
  let header,payload;
  try{header=JSON.parse(new TextDecoder().decode(base64url(parts[0])));payload=JSON.parse(new TextDecoder().decode(base64url(parts[1])));}catch{throw new Error('UNAUTHORIZED');}
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw new Error('UNAUTHORIZED');
  const now=Math.floor(Date.now()/1000);
  if(payload.aud!==env.ADMIN_GOOGLE_CLIENT_ID||!['accounts.google.com','https://accounts.google.com'].includes(payload.iss)||
    !Number.isFinite(payload.exp)||payload.exp<=now||!Number.isFinite(payload.iat)||payload.iat>now+60||payload.email_verified!==true||typeof payload.sub!=='string')throw new Error('UNAUTHORIZED');
  const email=String(payload.email||'').toLowerCase();
  if(!env.ADMIN_EMAILS.toLowerCase().split(',').map(x=>x.trim()).includes(email))throw new Error('FORBIDDEN');
  if(jwksCache.expires<Date.now()||!jwksCache.keys.some(k=>k.kid===header.kid)) {
    const response=await fetcher('https://www.googleapis.com/oauth2/v3/certs');if(!response.ok)throw new Error('AUTH_UNAVAILABLE');
    const keys=await response.json();jwksCache={keys:keys.keys||[],expires:Date.now()+3600000};
  }
  const jwk=jwksCache.keys.find(k=>k.kid===header.kid);if(!jwk)throw new Error('UNAUTHORIZED');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64url(parts[2]),encoder.encode(parts[0]+'.'+parts[1])))throw new Error('UNAUTHORIZED');
  return {role:'admin',email,sub:payload.sub};
}
function headers(origin) {
  return {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer','Vary':'Origin',...(origin?{'Access-Control-Allow-Origin':origin}:{}),
    'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};
}
function json(value,status,origin) {return new Response(JSON.stringify(value),{status,headers:headers(origin)});}
function error(code,message,status,origin){return json({ok:false,error:{code,message,status}},status,origin);}
export function createGateway(fetcher=fetch) {
  return async function handle(request,env) {
    const origin=request.headers.get('Origin')||'';
    const allow=String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
    if(origin&&!allow.includes(origin))return error('FORBIDDEN','Sumber permintaan tidak dibenarkan.',403,'');
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
    if(request.method!=='POST')return error('METHOD_NOT_ALLOWED','Gunakan permintaan POST.',405,origin);
    const path=new URL(request.url).pathname;
    const action=path.startsWith('/api/')?path.slice(5).replaceAll('/','.'):'';
    if(!ACTIONS.has(action))return error('NOT_FOUND','Tindakan tidak dijumpai.',404,origin);
    if(!env.APPS_SCRIPT_URL||!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(env.APPS_SCRIPT_URL)||!env.GATEWAY_SECRET||env.GATEWAY_SECRET.length<32)
      return error('SETUP_REQUIRED','Portal sedang disediakan. Pendaftaran belum dibuka.',503,origin);
    try {
      const contentType=request.headers.get('Content-Type')||'';
      if(!contentType.startsWith('application/json'))return error('INVALID_REQUEST','Format permintaan tidak sah.',415,origin);
      const raw=await readBoundedBody(request);
      let data;try{data=JSON.parse(raw);}catch{return error('INVALID_REQUEST','Permintaan tidak sah.',400,origin);}
      if(!data||typeof data!=='object'||Array.isArray(data))return error('INVALID_REQUEST','Permintaan tidak sah.',400,origin);
      if(data.website)return error('INVALID_REQUEST','Permintaan tidak sah.',400,origin);
      const ip=request.headers.get('CF-Connecting-IP')||'unknown';
      const clientKey=(await hmac(env.GATEWAY_SECRET,'client:'+ip)).slice(0,32);
      if(env.API_RATE_LIMITER){const r=await env.API_RATE_LIMITER.limit({key:clientKey+':'+action});if(!r.success)return error('RATE_LIMITED','Terlalu banyak cubaan. Sila cuba sebentar lagi.',429,origin);}
      let identity={role:'public'},sessionToken='';
      const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
      if(action.startsWith('admin.'))identity=await verifyAdminToken(token,env,fetcher);
      else if(action.startsWith('parent.')){
        if(!/^[a-f0-9]{64}$/.test(token))return error('UNAUTHORIZED','Sila log masuk semula.',401,origin);
        sessionToken=token;
      }
      // Never accept actor, role, IP or session identity from the user-supplied body.
      const body=JSON.stringify({action,data,identity,sessionToken,clientKey});
      const timestamp=Date.now(),nonce=crypto.randomUUID().replaceAll('-','');
      const signature=await hmac(env.GATEWAY_SECRET,timestamp+'\n'+nonce+'\n'+body);
      const upstream=await fetcher(env.APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timestamp,nonce,body,signature}),redirect:'follow',signal:AbortSignal.timeout(45000)});
      if(!upstream.ok)return error('UPSTREAM_UNAVAILABLE','Sistem sedang sibuk. Sila cuba semula.',503,origin);
      let response;try{response=await upstream.json();}catch{return error('UPSTREAM_UNAVAILABLE','Sistem sedang disediakan. Sila cuba semula.',503,origin);}
      if(typeof response.ok!=='boolean')return error('UPSTREAM_UNAVAILABLE','Respons sistem tidak sah.',503,origin);
      return json(response,response.ok?200:Math.min(599,Math.max(400,Number(response.error?.status)||400)),origin);
    }catch(e){
      if(e.message==='BODY_TOO_LARGE')return error('TOO_LARGE','Fail terlalu besar. Had resit ialah 5 MB.',413,origin);
      if(['UNAUTHORIZED','FORBIDDEN'].includes(e.message))return error(e.message,'Akses urus setia tidak dapat disahkan.',e.message==='FORBIDDEN'?403:401,origin);
      if(e.message==='ADMIN_SETUP_REQUIRED')return error('SETUP_REQUIRED','Log masuk urus setia belum dikonfigurasi.',503,origin);
      return error('NETWORK_ERROR','Sambungan terganggu. Rekod tidak perlu dihantar semula dengan rujukan baharu; cuba sekali lagi.',503,origin);
    }
  };
}
export default {fetch:createGateway()};
