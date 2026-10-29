/* Loopback-only preview using isolated dummy students and in-memory receipts. Never imports the real roster. */
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import crypto from 'node:crypto';
import '../backend/domain.js';
const D=globalThis.TWYDomain,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../frontend');
const secret=crypto.randomBytes(32).toString('hex'),adminToken=crypto.randomBytes(32).toString('hex'),port=Number(process.env.PORT||4173);
const hash=v=>crypto.createHmac('sha256',secret).update(v).digest('hex');
const students=['ADAM HAKIM — DATA UJIAN','AISYAH NUR — DATA UJIAN','AMELIA TAN — DATA UJIAN','ARJUN KUMAR — DATA UJIAN','DANISH HAZIQ — DATA UJIAN','NUR HANA — DATA UJIAN','SARAH LIM — DATA UJIAN','RAVI NAIR — DATA UJIAN'].map((name,i)=>({id:'demo-student-'+i,name,className:i<4?'6H':'6J',active:true}));
let state=D.initial(students),chain=Promise.resolve(),files=new Map();
Object.assign(state.settings,{registrationOpen:true,bankName:'PRATONTON — TIADA BAYARAN SEBENAR',accountHolder:'DATA UJIAN SAHAJA',accountNumber:'BUKAN-AKAUN-BANK'});
const context=(actor='parent')=>({id:()=>crypto.randomUUID(),now:()=>new Date().toISOString(),actor});
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
function newSession(s,id){const token=crypto.randomBytes(32).toString('hex');s.sessions.push({registrationId:id,tokenHash:hash(token),authVersion:2,expiresAt:Date.now()+28800000});return token;}
function parent(s,token){const v=s.sessions.find(x=>x.authVersion===2&&x.expiresAt>Date.now()&&x.tokenHash===hash(token));if(!v)D.fail('UNAUTHORIZED','Sila log masuk semula.');return v.registrationId;}
export function validatePreviewFile(input){const bytes=Buffer.from(input.base64||'','base64');if(bytes.length<8||bytes.length>5242880)D.fail('INVALID_RECEIPT','Fail tidak sah atau melebihi 5 MB.');let mime='';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';else if(bytes.subarray(0,5).toString()==='%PDF-')mime='application/pdf';if(!mime||mime!==input.mimeType)D.fail('INVALID_RECEIPT','Gunakan PNG, JPG atau PDF yang sah.');return {bytes,mimeType:mime,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
async function action(name,input,token){const s=structuredClone(state),ctx=context(name.startsWith('admin.')?'admin@preview.test':'parent');let result,changed=false;
  if(name.startsWith('admin.')&&token!==adminToken)D.fail('UNAUTHORIZED','Akses urus setia diperlukan.');
  if(name==='public.state')result={settings:D.publicSettings(s),quota:D.quota(s)};
  else if(name==='public.search')result={students:D.search(s,input.query)};
  else if(name==='public.register'){result=D.register(s,input,ctx);result.sessionToken=newSession(s,result.registration.id);changed=true;}
  else if(name==='public.lookup'){const student=s.students.find(x=>x.active&&x.id===input.studentId);if(!student)D.fail('NOT_FOUND','Sila pilih nama murid daripada hasil carian.');result={registered:s.registrations.some(r=>r.studentId===student.id)};}
  else if(name==='auth.login'){const r=s.registrations.find(x=>x.studentId===input.studentId);let phone='',stored='';try{phone=D.phone(input.contactPhone);if(r)stored=D.phone(r.contactPhone);}catch{}if(!r||!phone||phone!==stored)D.fail('UNAUTHORIZED','Nama atau nombor telefon tidak sepadan. Gunakan nombor telefon utama semasa mendaftar.');result={registered:true,registration:D.view(s,r),sessionToken:newSession(s,r.id)};D.audit(s,context('parent:'+r.id),'PARENT_PHONE_VERIFIED',r.id);changed=true;}
  else if(name.startsWith('parent.')){const id=parent(s,token);if(name==='parent.get')result={registration:D.view(s,D.registration(s,id))};else if(name==='parent.update'){result={registration:D.update(s,id,input,ctx)};changed=true;}else if(name==='parent.receipt'){const f=validatePreviewFile(input),fileId='preview-private-'+f.sha256;result=D.submitReceipt(s,id,{...input,...f,sizeBytes:f.bytes.length,driveFileId:fileId},ctx);files.set(fileId,{mimeType:f.mimeType,base64:input.base64,fileName:'resit-ujian'+(f.mimeType==='application/pdf'?'.pdf':f.mimeType==='image/png'?'.png':'.jpg')});changed=true;}else D.fail('NOT_FOUND','Tindakan tidak dijumpai.');}
  else if(name==='admin.dashboard')result=D.dashboard(s);
  else if(name==='admin.reviewPayment'){result={registration:D.reviewPayment(s,input,ctx)};changed=true;}
  else if(name==='admin.release'){result={registration:D.release(s,input.registrationId,input.reason,ctx)};changed=true;}
  else if(name==='admin.updateRegistration'){ctx.role='admin';result={registration:D.update(s,input.registrationId,input,ctx)};changed=true;}
  else if(name==='admin.settings'){result={settings:D.setSettings(s,input,ctx)};changed=true;}
  else if(name==='admin.receipt'){const receipt=s.receipts.find(r=>r.id===input.receiptId);if(!receipt)D.fail('NOT_FOUND','Resit tidak dijumpai.');result=files.get(receipt.driveFileId);}
  else if(name==='admin.export')result={rows:D.dashboard(s).registrations};
  else if(name==='admin.syncRoster')result={students:students.length};
  else if(name==='admin.backup')result={fileId:'dummy-backup-memory-only',createdAt:ctx.now()};
  else D.fail('NOT_FOUND','Tindakan tidak dijumpai.');
  if(changed){D.assertIntegrity(s);s.revision++;state=s;}return {ok:true,data:result,revision:state.revision};
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{
  if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))return json(res,{ok:false},403);
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/config.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end('window.TWY_CONFIG='+JSON.stringify({apiBase:'/api',googleClientId:'',preview:true})+';');}
  if(url.pathname==='/api/dev/admin-token'&&req.method==='POST')return json(res,{token:adminToken});
  if(url.pathname.startsWith('/api/')){if(req.method!=='POST')return json(res,{ok:false},405);let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>7600000)return json(res,{ok:false,error:{message:'Fail terlalu besar.'}},413);chunks.push(chunk);}const input=JSON.parse(Buffer.concat(chunks).toString()||'{}'),name=url.pathname.slice(5).replaceAll('/','.'),token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const operation=chain.then(()=>action(name,input,token));chain=operation.catch(()=>{});try{return json(res,await operation);}catch(e){return json(res,{ok:false,error:{code:e.code||'INTERNAL_ERROR',message:e.message,status:e.code==='QUOTA_FULL'?409:e.code==='UNAUTHORIZED'?401:400}},e.code==='QUOTA_FULL'?409:e.code==='UNAUTHORIZED'?401:400);}}
  const decoded=decodeURIComponent(url.pathname),f=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));if(!f.startsWith(root+path.sep))return json(res,{ok:false},403);const data=await fs.readFile(f);res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);
}catch(e){json(res,{ok:false,error:{message:'Tidak dijumpai.'}},404);}});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port} — isolated dummy-data preview only`));
