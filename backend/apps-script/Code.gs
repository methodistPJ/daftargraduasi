/* Production Apps Script adapter. Configure Script Properties; never store secrets in source. */
var TWY_TABLES = {
  STUDENTS: ['id','name','className','active'],
  REGISTRATIONS: ['id','reference','studentId','contactPhone','status','seatsHeld','accessHash','createdAt','updatedAt'],
  GUARDIANS: ['id','registrationId','name','phone','active'],
  PAYMENTS: ['id','registrationId','receiptId','amountCents','status','createdAt','reviewedAt','reviewedBy','reviewNote'],
  RECEIPTS: ['id','registrationId','driveFileId','sha256','mimeType','sizeBytes','createdAt'],
  SETTINGS: ['key','value'], AUDIT_LOG: ['id','at','actor','action','entityId','summary'], STATE_STORE: ['chunk','json']
};
function doGet() { return output_({ ok: true, service: 'TWY2026', message: 'Signed gateway requests only.' }); }
function output_(v) { return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON); }
function properties_() { return PropertiesService.getScriptProperties(); }
function required_(key) { var v = properties_().getProperty(key); if (!v) throw error_('SETUP_REQUIRED', 'Sistem sedang disediakan.', 503); return v; }
function error_(code, message, status) { var e = new Error(message); e.code = code; e.status = status || 400; return e; }
function hex_(bytes) { return bytes.map(function(b){ return ('0'+((b+256)%256).toString(16)).slice(-2); }).join(''); }
function digest_(value) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)); }
function mac_(value) { return hex_(Utilities.computeHmacSha256Signature(value, required_('GATEWAY_SECRET'), Utilities.Charset.UTF_8)); }
function equal_(a,b) { a=String(a||'');b=String(b||''); var x=a.length^b.length; for(var i=0;i<Math.max(a.length,b.length);i++) x|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0); return x===0; }
function random_() { return (Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,''); }
function context_(actor) { return { id: function(){return Utilities.getUuid();}, now: function(){return new Date().toISOString();}, actor: actor || 'parent' }; }
function allowedAdmins_() { return required_('ADMIN_EMAILS').toLowerCase().split(',').map(function(x){return x.trim();}).filter(Boolean); }
function requireAdmin_(envelope) {
  if (!envelope.identity || envelope.identity.role!=='admin' || !envelope.identity.email || allowedAdmins_().indexOf(envelope.identity.email.toLowerCase())<0) throw error_('UNAUTHORIZED','Akses urus setia diperlukan.',403);
  return envelope.identity.email.toLowerCase();
}
function limit_(bucket, maximum, seconds) {
  var cache=CacheService.getScriptCache(), key='rate:'+bucket, n=Number(cache.get(key)||0);
  if(n>=maximum) throw error_('RATE_LIMITED','Terlalu banyak cubaan. Sila cuba lagi sebentar nanti.',429);
  // Sliding-window limit intentionally retains the window while requests continue.
  cache.put(key,String(n+1),seconds);
}
function verifyEnvelope_(e) {
  var contents=e && e.postData && e.postData.contents;
  if(!contents || contents.length>7600000) throw error_('INVALID_REQUEST','Permintaan tidak sah.',413);
  var v; try{v=JSON.parse(contents);}catch(_){throw error_('INVALID_REQUEST','Permintaan tidak sah.');}
  if(!Number.isSafeInteger(v.timestamp)||Math.abs(Date.now()-v.timestamp)>300000||typeof v.nonce!=='string'||!/^[a-f0-9]{32}$/.test(v.nonce)||typeof v.body!=='string') throw error_('UNAUTHORIZED','Permintaan tidak dapat disahkan.',401);
  var expected=mac_(String(v.timestamp)+'\n'+v.nonce+'\n'+v.body);
  if(!equal_(expected,v.signature)) throw error_('UNAUTHORIZED','Permintaan tidak dapat disahkan.',401);
  var key='nonce:'+v.nonce,cache=CacheService.getScriptCache();
  if(cache.get(key)) throw error_('REPLAY','Permintaan tamat. Sila cuba semula.',409);
  cache.put(key,'1',360);
  var envelope=JSON.parse(v.body);
  if(!envelope || typeof envelope.action!=='string'||!envelope.clientKey||!/^[a-f0-9]{20,64}$/.test(envelope.clientKey)) throw error_('INVALID_REQUEST','Permintaan tidak sah.');
  return envelope;
}
function doPost(e) {
  var lock=LockService.getScriptLock();
  try {
    if(!lock.tryLock(25000)) throw error_('BUSY','Sistem sedang mengemas kini tempat. Sila cuba semula.',503);
    var request=verifyEnvelope_(e), action=request.action, input=request.data||{};
    limit_(request.clientKey+':'+action, action==='public.search'?20:action==='auth.login'?5:40, action==='auth.login'?600:60);
    if(action==='public.search') limit_('search-hour:'+request.clientKey,100,3600);
    var loaded=loadState_(), state=JSON.parse(JSON.stringify(loaded)), ctx=context_(), result, changed=false, createdFile=null;
    if(action.indexOf('admin.')===0) {ctx=context_(requireAdmin_(request));ctx.role='admin';}
    if(action==='public.state') {var publicConfig=TWYDomain.publicSettings(state);publicConfig.registrationOpen=TWYDomain.canRegister(state);result={settings:publicConfig,quota:TWYDomain.quota(state)};}
    else if(action==='public.search') {
      if(!TWYDomain.canRegister(state)) throw error_('REGISTRATION_CLOSED','Pendaftaran belum dibuka.',503);
      result={students:TWYDomain.search(state,input.query)};
    }
    else if(action==='public.register') {
      var recovery=mac_('recovery:'+input.studentId+':'+input.idempotencyKey).slice(0,32).toUpperCase();
      ctx.accessHash=mac_('access:'+recovery);
      result=TWYDomain.register(state,input,ctx);
      result.accessCode=recovery.match(/.{1,8}/g).join('-');
      result.sessionToken=createSession_(state,result.registration.id);
      changed=true;
    }
    else if(action==='auth.login') {
      var ref=String(input.reference||'').trim().toUpperCase(), r=state.registrations.find(function(r){return r.reference===ref;});
      var normalizedPhone;try{normalizedPhone=TWYDomain.phone(input.contactPhone);}catch(_){normalizedPhone='invalid';}
      var code=String(input.accessCode||'').replace(/[\s-]/g,'').toUpperCase();
      var correctCode=equal_(mac_('access:'+code),r?r.accessHash:'0'.repeat(64));
      if(!r||!equal_(normalizedPhone,r.contactPhone)||!correctCode) throw error_('UNAUTHORIZED','Rujukan, nombor telefon atau kod akses tidak sepadan.',401);
      result={registration:TWYDomain.view(state,r),sessionToken:createSession_(state,r.id)};
      TWYDomain.audit(state,context_('parent:'+r.id),'PARENT_LOGIN',r.id);changed=true;
    }
    else if(action.indexOf('parent.')===0) {
      var parentId=authorizeParent_(state,request.sessionToken), parentCtx=context_('parent:'+parentId);
      if(action==='parent.get') result={registration:TWYDomain.view(state,TWYDomain.registration(state,parentId))};
      else if(action==='parent.update') {result={registration:TWYDomain.update(state,parentId,input,parentCtx)};changed=true;}
      else if(action==='parent.receipt') {
        var file=validateReceipt_(input), receiptKey='receipt:'+parentId+':'+input.idempotencyKey;
        var previous=state.idempotency[receiptKey];
        if(previous) {
          result=TWYDomain.submitReceipt(state,parentId,{idempotencyKey:input.idempotencyKey,sha256:file.sha256,amountCents:input.amountCents},parentCtx);
        } else {
          TWYDomain.amount(input.amountCents);
          if(state.receipts.some(function(r){return r.sha256===file.sha256;})) throw error_('DUPLICATE_RECEIPT','Resit yang sama telah diterima.');
          assertPrivateFolder_(required_('RECEIPT_FOLDER_ID'));
          var reg=TWYDomain.registration(state,parentId);
          var extension=file.mimeType==='application/pdf'?'.pdf':file.mimeType==='image/png'?'.png':'.jpg';
          createdFile=DriveApp.getFolderById(required_('RECEIPT_FOLDER_ID')).createFile(Utilities.newBlob(file.bytes,file.mimeType,reg.reference+'-'+random_().slice(0,12)+extension));
          result=TWYDomain.submitReceipt(state,parentId,{idempotencyKey:input.idempotencyKey,sha256:file.sha256,amountCents:input.amountCents,driveFileId:createdFile.getId(),mimeType:file.mimeType,sizeBytes:file.bytes.length},parentCtx);
          changed=true;
        }
      } else throw error_('NOT_FOUND','Tindakan tidak dijumpai.',404);
    }
    else if(action==='admin.dashboard') result=TWYDomain.dashboard(state);
    else if(action==='admin.reviewPayment') {result={registration:TWYDomain.reviewPayment(state,input,ctx)};changed=true;}
    else if(action==='admin.release') {result={registration:TWYDomain.release(state,input.registrationId,input.reason,ctx)};changed=true;}
    else if(action==='admin.updateRegistration') {result={registration:TWYDomain.update(state,input.registrationId,input,ctx)};changed=true;}
    else if(action==='admin.settings') {
      if(input.registrationOpen) { assertPrivateFolder_(required_('RECEIPT_FOLDER_ID'));assertAppDatabase_(); }
      result={settings:TWYDomain.setSettings(state,input,ctx)};changed=true;
    }
    else if(action==='admin.resetAccess') {
      if(input.identityVerified!==true)throw error_('IDENTITY_REQUIRED','Sahkan identiti penjaga sebelum menetapkan semula akses.');
      var resetReason=TWYDomain.text(input.reason,'Sebab penetapan semula',5,300),target=TWYDomain.registration(state,input.registrationId),newCode=random_().slice(0,32).toUpperCase();
      target.accessHash=mac_('access:'+newCode);state.sessions=state.sessions.filter(function(s){return s.registrationId!==target.id;});
      TWYDomain.audit(state,ctx,'PARENT_ACCESS_RESET',target.id,resetReason);
      result={reference:target.reference,accessCode:newCode.match(/.{1,8}/g).join('-')};changed=true;
    }
    else if(action==='admin.syncRoster') {result=syncRoster_(state);TWYDomain.audit(state,ctx,'ROSTER_SYNCED','STUDENTS',String(result.students)+' active students');changed=true;}
    else if(action==='admin.receipt') {
      var receipt=state.receipts.find(function(r){return r.id===input.receiptId;});
      if(!receipt) throw error_('NOT_FOUND','Resit tidak dijumpai.',404);
      var blob=DriveApp.getFileById(receipt.driveFileId).getBlob();
      result={mimeType:receipt.mimeType,base64:Utilities.base64Encode(blob.getBytes()),fileName:'resit'+(receipt.mimeType==='application/pdf'?'.pdf':receipt.mimeType==='image/png'?'.png':'.jpg')};
      TWYDomain.audit(state,ctx,'RECEIPT_VIEWED',receipt.id);changed=true;
    }
    else if(action==='admin.backup') {result=backup_(state);TWYDomain.audit(state,ctx,'BACKUP_CREATED','BACKUPS');changed=true;}
    else if(action==='admin.export') {result={rows:TWYDomain.dashboard(state).registrations};TWYDomain.audit(state,ctx,'EXPORT_CREATED','REGISTRATIONS');changed=true;}
    else throw error_('NOT_FOUND','Tindakan tidak dijumpai.',404);
    if(changed) { TWYDomain.assertIntegrity(state);state.revision++;commitState_(state); }
    return output_({ok:true,data:result,revision:state.revision});
  } catch(err) {
    // Delete an uncommitted receipt, but do not destroy it if an ambiguous network failure committed it.
    if(createdFile) {try{var persisted=loadStateFresh_();if(!persisted.receipts.some(function(r){return r.driveFileId===createdFile.getId();}))createdFile.setTrashed(true);}catch(_){/* retain for reconciliation rather than risk deleting a committed receipt */}}
    return output_({ok:false,error:{code:err.code||'INTERNAL_ERROR',message:err.code?err.message:'Sistem tidak dapat melengkapkan permintaan. Sila cuba semula.',status:err.status||(err.code==='QUOTA_FULL'?409:400),details:err.details||null}});
  } finally { if(lock.hasLock())lock.releaseLock(); }
}
function createSession_(state,id) {
  var token=random_(),now=Date.now();
  state.sessions=state.sessions.filter(function(s){return s.expiresAt>now;});
  state.sessions.push({registrationId:id,tokenHash:mac_('session:'+token),expiresAt:now+8*3600000});
  return token;
}
function authorizeParent_(state,token) {
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw error_('UNAUTHORIZED','Sila log masuk semula.',401);
  var hash=mac_('session:'+token),s=state.sessions.find(function(s){return s.expiresAt>Date.now()&&equal_(s.tokenHash,hash);});
  if(!s)throw error_('UNAUTHORIZED','Sesi telah tamat. Sila log masuk semula.',401);
  return s.registrationId;
}
function validateReceipt_(input) {
  if(typeof input.base64!=='string'||input.base64.length>7000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64))throw error_('INVALID_RECEIPT','Fail resit tidak sah.');
  var bytes;try{bytes=Utilities.base64Decode(input.base64);}catch(_){throw error_('INVALID_RECEIPT','Fail resit tidak sah.');}
  if(bytes.length<8||bytes.length>5*1024*1024)throw error_('INVALID_RECEIPT','Saiz fail mestilah tidak melebihi 5 MB.');
  var b=bytes.map(function(x){return (x+256)%256;}), mime;
  if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10) {
    mime='image/png';if(b.length<24)throw error_('INVALID_RECEIPT','Imej rosak.');
    var w=b[16]*16777216+b[17]*65536+b[18]*256+b[19],h=b[20]*16777216+b[21]*65536+b[22]*256+b[23];
    if(!w||!h||w*h>40000000)throw error_('INVALID_RECEIPT','Dimensi imej terlalu besar.');
  } else if(b[0]===255&&b[1]===216&&b[2]===255) mime='image/jpeg';
  else if(b.slice(0,5).map(function(x){return String.fromCharCode(x);}).join('')==='%PDF-') {
    mime='application/pdf';var pdf=Utilities.newBlob(bytes).getDataAsString('ISO-8859-1');
    if(/\/(JavaScript|JS|Launch|EmbeddedFile)\b/i.test(pdf))throw error_('INVALID_RECEIPT','PDF ini mengandungi kandungan aktif yang tidak dibenarkan.');
  } else throw error_('INVALID_RECEIPT','Gunakan imej PNG/JPG atau PDF.');
  if(input.mimeType!==mime)throw error_('INVALID_RECEIPT','Jenis fail tidak sepadan.');
  return {bytes:bytes,mimeType:mime,sha256:hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes))};
}
function api_(url,method,payload) {
  var options={method:method||'get',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true};
  if(payload!==undefined){options.contentType='application/json';options.payload=JSON.stringify(payload);}
  var response=UrlFetchApp.fetch(url,options),code=response.getResponseCode(),body=response.getContentText();
  if(code<200||code>=300)throw error_('STORAGE_ERROR','Penyimpanan tidak tersedia. Sila cuba semula.',503);
  return body?JSON.parse(body):{};
}
function secureFolder_(id) {
  api_('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,inheritedPermissionsDisabled','patch',{inheritedPermissionsDisabled:true});
  assertPrivateFolder_(id);
}
function assertPrivateFolder_(id) {
  var admins=allowedAdmins_(),next='';
  do {
    var p=api_('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'/permissions?fields=nextPageToken,permissions(id,type,emailAddress,role,view)&pageSize=100'+(next?'&pageToken='+encodeURIComponent(next):''));
    var unsafe=(p.permissions||[]).some(function(x){return x.view!=='metadata'&&x.role!=='owner'&&(x.type!=='user'||admins.indexOf(String(x.emailAddress||'').toLowerCase())<0);});
    if(unsafe)throw error_('UNSAFE_STORAGE','Akses data perlu dihadkan kepada urus setia sebelum sistem dibuka.',503);
    next=p.nextPageToken||'';
  } while(next);
}
function assertAppDatabase_() {
  var id=required_('APP_SPREADSHEET_ID');
  if(id===required_('SOURCE_SPREADSHEET_ID'))throw error_('UNSAFE_STORAGE','Database aplikasi mesti berasingan daripada senarai rasmi.',503);
  var cache=CacheService.getScriptCache(),key='private-database:'+id+':'+required_('DATABASE_FOLDER_ID');
  if(cache.get(key))return;
  var meta=api_('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,mimeType,parents');
  if(meta.mimeType!=='application/vnd.google-apps.spreadsheet'||!meta.parents||meta.parents.indexOf(required_('DATABASE_FOLDER_ID'))<0)throw error_('UNSAFE_STORAGE','Database mesti berada dalam folder DATABASE yang terhad.',503);
  assertPrivateFolder_(required_('DATABASE_FOLDER_ID'));assertPrivateFolder_(id);
  cache.put(key,'1',60);
}
function loadStateFresh_() {
  var r=api_('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(required_('APP_SPREADSHEET_ID'))+'/values/'+encodeURIComponent("'STATE_STORE'!B2:B")+'?valueRenderOption=UNFORMATTED_VALUE');
  return JSON.parse((r.values||[]).map(function(row){return row[0]||'';}).join(''));
}
function database_() { return SpreadsheetApp.openById(required_('APP_SPREADSHEET_ID')); }
function loadState_() {
  assertAppDatabase_();
  var sheet=database_().getSheetByName('STATE_STORE');if(!sheet||sheet.getLastRow()<2)throw error_('SETUP_REQUIRED','Sistem belum diaktifkan.',503);
  var chunks=sheet.getRange(2,2,sheet.getLastRow()-1,1).getValues().map(function(r){return r[0];}).join('');
  return JSON.parse(chunks);
}
function rows_(state,name) {
  if(name==='SETTINGS')return Object.keys(state.settings).sort().map(function(k){return [k,typeof state.settings[k]==='string'?state.settings[k]:JSON.stringify(state.settings[k])];});
  if(name==='STATE_STORE'){var json=JSON.stringify(state),result=[],i=0;while(i<json.length){var end=Math.min(i+38000,json.length),last=json.charCodeAt(end-1);if(end<json.length&&last>=0xD800&&last<=0xDBFF)end--;result.push([result.length,json.slice(i,end)]);i=end;}return result;}
  var keys={STUDENTS:'students',REGISTRATIONS:'registrations',GUARDIANS:'guardians',PAYMENTS:'payments',RECEIPTS:'receipts',AUDIT_LOG:'audit'};
  return state[keys[name]].map(function(row){return TWY_TABLES[name].map(function(k){return row[k]===undefined?'':row[k];});});
}
function commitState_(state) {
  var ss=database_(),requests=[];
  Object.keys(TWY_TABLES).forEach(function(name){
    var sheet=ss.getSheetByName(name),values=[TWY_TABLES[name]].concat(rows_(state,name));
    if(!sheet)throw error_('SETUP_REQUIRED','Jadual belum tersedia.',503);
    var requiredRows=Math.max(values.length,2),cols=TWY_TABLES[name].length;
    if(requiredRows>sheet.getMaxRows())requests.push({appendDimension:{sheetId:sheet.getSheetId(),dimension:'ROWS',length:requiredRows-sheet.getMaxRows()}});
    var endRows=Math.max(requiredRows,sheet.getLastRow());
    requests.push({updateCells:{range:{sheetId:sheet.getSheetId(),startRowIndex:0,endRowIndex:endRows,startColumnIndex:0,endColumnIndex:cols},fields:'userEnteredValue',rows:values.map(function(row){return {values:row.map(function(v){return {userEnteredValue:typeof v==='boolean'?{boolValue:v}:typeof v==='number'?{numberValue:v}:{stringValue:String(v)}};})};})}});
  });
  // Google applies this single Sheets batch atomically; mirrors and canonical state cannot partially commit.
  api_('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(ss.getId())+':batchUpdate','post',{requests:requests});
}
function syncRoster_(state) {
  var source=SpreadsheetApp.openById(required_('SOURCE_SPREADSHEET_ID'));
  var tab=source.getSheetByName(properties_().getProperty('SOURCE_SHEET_NAME')||'Sheet1');
  if(!tab)throw error_('ROSTER_ERROR','Tab senarai murid tidak dijumpai.',503);
  var values=tab.getRange(1,1,Math.max(1,tab.getLastRow()),2).getDisplayValues(),seen={},incoming=[],blank=0;
  values.forEach(function(row,index){
    var name=String(row[0]||'').normalize('NFKC').trim().replace(/\s+/g,' '),cl=String(row[1]||'').trim().toUpperCase();
    if(!name&&!cl){blank++;return;}
    if(index===0&&/^(NAMA|NAMA MURID|NAME|STUDENT NAME)$/i.test(name))return;
    if(!name||!cl)throw error_('ROSTER_ERROR','Senarai murid mempunyai baris tidak lengkap. Rujuk laporan urus setia.',503);
    var key=cl+'|'+name.toUpperCase();if(seen[key])throw error_('ROSTER_AMBIGUOUS','Nama dan kelas pendua memerlukan semakan urus setia.',503);seen[key]=true;
    incoming.push({id:'STU-'+digest_(required_('SOURCE_SPREADSHEET_ID')+'|'+key).slice(0,16),name:name,className:cl,active:true});
  });
  var oldByName={},oldByExact={},incomingNames={},used={};
  state.students.forEach(function(p){var k=p.name.toUpperCase();(oldByName[k]||(oldByName[k]=[])).push(p);oldByExact[p.className+'|'+k]=p;});
  incoming.forEach(function(p){var k=p.name.toUpperCase();incomingNames[k]=(incomingNames[k]||0)+1;});
  incoming.forEach(function(p){
    var k=p.name.toUpperCase(),exact=oldByExact[p.className+'|'+k],matches=oldByName[k]||[];
    if(exact)p.id=exact.id;else if(matches.length===1&&incomingNames[k]===1)p.id=matches[0].id;
    if(used[p.id])throw error_('ROSTER_AMBIGUOUS','ID murid bertindih dan memerlukan semakan urus setia.',503);used[p.id]=true;
  });
  var currentIds=incoming.map(function(p){return p.id;});
  state.students.forEach(function(p){if(currentIds.indexOf(p.id)<0)incoming.push(Object.assign({},p,{active:false}));});
  state.students=incoming;return {students:incoming.filter(function(p){return p.active;}).length,blankRows:blank};
}
function initializePortal() {
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    required_('GATEWAY_SECRET');required_('ADMIN_EMAILS');
    if(required_('APP_SPREADSHEET_ID')===required_('SOURCE_SPREADSHEET_ID'))throw error_('UNSAFE_STORAGE','Senarai rasmi tidak boleh digunakan sebagai database aplikasi.',503);
    var root=DriveApp.getFolderById(required_('PARENT_FOLDER_ID'));
    ['DATABASE','PAYMENT_RECEIPTS','BRAND_ASSETS','REPORTS_EXPORTS','DOCUMENTATION','BACKUPS'].forEach(function(name){
      var property=name==='PAYMENT_RECEIPTS'?'RECEIPT_FOLDER_ID':name+'_FOLDER_ID';
      var id=properties_().getProperty(property);
      if(!id){var matches=root.getFoldersByName(name),folder=matches.hasNext()?matches.next():root.createFolder(name);id=folder.getId();properties_().setProperty(property,id);}
      if(['DATABASE','PAYMENT_RECEIPTS','BACKUPS','REPORTS_EXPORTS'].indexOf(name)>=0)secureFolder_(id);
    });
    assertAppDatabase_();
    var ss=database_();
    var existing=ss.getSheetByName('STATE_STORE');if(existing&&existing.getLastRow()>1)return {alreadyInitialized:true,spreadsheetId:ss.getId()};
    Object.keys(TWY_TABLES).forEach(function(name){
      var tab=ss.getSheetByName(name)||ss.insertSheet(name);tab.setFrozenRows(1);
      tab.getRange(1,1,1,TWY_TABLES[name].length).setValues([TWY_TABLES[name]]).setBackground('#1E2A5A').setFontColor('#FFF7E6').setFontWeight('bold');
      tab.setColumnWidths(1,TWY_TABLES[name].length,180);
      if(name==='STATE_STORE')tab.hideSheet();
    });
    var state=TWYDomain.initial(),report=syncRoster_(state);
    TWYDomain.audit(state,context_('setup'),'DATABASE_INITIALIZED','SETTINGS',String(report.students)+' students imported; original roster untouched');
    commitState_(state);
    return {spreadsheetId:ss.getId(),students:report.students,registrationOpen:false};
  } finally {lock.releaseLock();}
}
function backup_(state) {
  var id=required_('BACKUPS_FOLDER_ID');assertPrivateFolder_(id);
  var stamp=Utilities.formatDate(new Date(),'Asia/Kuala_Lumpur','yyyyMMdd-HHmmss');
  var file=DriveApp.getFolderById(id).createFile('TWY2026-backup-'+stamp+'.json',JSON.stringify(state),MimeType.PLAIN_TEXT);
  return {fileId:file.getId(),createdAt:new Date().toISOString()};
}
function backupPortal() { var lock=LockService.getScriptLock();lock.waitLock(30000);try{return backup_(loadState_());}finally{lock.releaseLock();} }
