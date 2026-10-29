// Telephone numbers stay strings so the leading zero is preserved.
export function formatPhone(value) {
  let p=String(value||'').normalize('NFKC').replace(/\D/g,'');
  if(p.startsWith('0060'))p=p.slice(2);
  if(p.startsWith('60')&&p.length>2)p='0'+p.slice(2).replace(/^0/,'');
  return p;
}
export function bindPhoneInputs(root) {
  root.querySelectorAll('input[type="tel"]').forEach(input=>{
    input.inputMode='numeric';input.maxLength=40;
    const clean=()=>{input.value=formatPhone(input.value);};
    clean();input.addEventListener('input',clean);input.addEventListener('blur',clean);
  });
}
