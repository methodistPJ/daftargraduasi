export const config = window.TWY_CONFIG || { apiBase:'', googleClientId:'', preview:false };
const currencyFormatter = new Intl.NumberFormat('ms-MY',{style:'currency',currency:'MYR',minimumFractionDigits:2});
export const money = cents => currencyFormatter.format(Number(cents||0)/100);
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const key = () => crypto.randomUUID();
export async function api(action,data={},token='',options={}) {
  if(!config.apiBase) {const e=new Error('Pendaftaran sedang disediakan. Sila kembali sebentar lagi.');e.code='SETUP_REQUIRED';throw e;}
  let response;
  try{response=await fetch(config.apiBase.replace(/\/$/,'')+'/'+action.replaceAll('.','/'),{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data),cache:'no-store',signal:options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(50000)]) : AbortSignal.timeout(50000)});}catch(e){if(e.name==='AbortError')throw e;throw new Error('Sambungan terganggu. Sila cuba semula; gunakan permintaan yang sama untuk mengelakkan rekod berulang.');}
  let result;try{result=await response.json();}catch{throw new Error('Sistem tidak dapat dihubungi. Sila cuba semula.');}
  if(!response.ok||!result.ok){const e=new Error(result.error?.message||'Permintaan tidak berjaya.');e.code=result.error?.code;e.details=result.error?.details;throw e;}
  return result.data;
}
export async function receiptPayload(file,amountCents,idempotencyKey) {
  if(!file)throw new Error('Sila pilih fail resit terlebih dahulu.');
  if(!['image/png','image/jpeg','application/pdf'].includes(file.type))throw new Error('Gunakan fail PNG, JPG atau PDF.');
  if(file.size>5*1024*1024)throw new Error('Saiz fail mestilah tidak melebihi 5 MB.');
  if(!Number.isSafeInteger(amountCents)||amountCents<=0)throw new Error('Masukkan amaun yang tertera pada resit.');
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    reader.onerror = reader.onabort = () => reject(new Error('Fail resit tidak dapat dibaca. Sila pilih semula.'));
    reader.readAsDataURL(file);
  });
  return {mimeType:file.type,base64,amountCents,idempotencyKey};
}
export function downloadText(filename,text,type='text/plain;charset=utf-8') {
  const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
