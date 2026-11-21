// A printable receipt for cash explicitly confirmed as received by an organizer.
export function cashReceiptFile(registration, amountCents, note, receiptKey) {
  const clean = text => String(text).normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, ' ').replace(/[\\()]/g, '\\$&');
  const lines = [
    'THE WONDER YEARS 2026',
    'REKOD PENERIMAAN TUNAI',
    registration.student.name,
    'Kelas ' + registration.student.className + ' / ' + registration.reference,
    'Amaun tunai RM ' + (amountCents / 100).toFixed(2),
    'Direkod pada ' + new Date().toISOString(),
    'Wang tunai disahkan diterima oleh Urus Setia.',
    ...note.match(/.{1,70}/gs),
    'Kunci rekod ' + receiptKey
  ];
  const content = 'BT /F1 12 Tf 40 790 Td 19 TL\n'
    + lines.map(line => '(' + clean(line) + ') Tj T*').join('\n') + '\nET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  pdf += offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return new File([pdf], 'Penerimaan-Tunai.pdf', {type:'application/pdf'});
}
