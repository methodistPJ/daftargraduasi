const dayMs = 86400000;
const malaysiaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'
});

export function eventPresentation(settings, now = Date.now()) {
  const parts = Object.fromEntries(malaysiaDate.formatToParts(new Date(now)).map(p => [p.type,p.value]));
  const today = Date.parse(parts.year + '-' + parts.month + '-' + parts.day + 'T00:00:00+08:00');
  const eventStart = Date.parse(settings.eventDate + 'T00:00:00+08:00');
  const deadlineEnd = Date.parse(settings.paymentDeadline + 'T00:00:00+08:00') + dayMs;
  const days = Math.round((eventStart - today) / dayMs);
  const qrMode = now >= eventStart - dayMs;
  const closed = now >= deadlineEnd || settings.registrationOpen === false;
  let countdown = 'Jumpa di hari graduasi.';
  if (days > 1) countdown = days + ' hari lagi untuk kita raikan bersama.';
  if (days === 1) countdown = 'Esok hari graduasi kita!';
  if (days === 0) countdown = 'Hari ini hari graduasi kita!';
  return {
    closed, qrMode, countdown,
    label:qrMode ? 'Dapatkan QR Kehadiran' : 'Semak / Kemaskini',
    description:qrMode
      ? 'Cari nama anak dan sahkan nombor telefon untuk mendapatkan QR kehadiran keluarga.'
      : 'Semak maklumat keluarga, status bayaran dan resit sebelum majlis.'
  };
}
