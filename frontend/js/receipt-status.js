// Summarize uploaded receipts independently of outstanding balance.
export function receiptStatus(payments = []) {
  const pending = payments.filter(p => p.status === 'PENDING').length;
  if (pending) return { kind: 'pending', label: 'Menunggu semakan', detail: `${pending} resit belum disemak`, pending, uploaded: payments.length };
  if (!payments.length) return { kind: 'none', label: 'Belum muat naik', detail: '', pending: 0, uploaded: 0 };
  if (payments.at(-1).status === 'REJECTED') return { kind: 'correction', label: 'Perlu pembetulan', detail: `${payments.length} resit dimuat naik`, pending: 0, uploaded: payments.length };
  return { kind: 'reviewed', label: 'Resit disemak', detail: `${payments.length} resit dimuat naik`, pending: 0, uploaded: payments.length };
}
export function prioritizePendingReceipts(rows) {
  return [...rows].sort((a, b) => Number(receiptStatus(b.payments).pending > 0) - Number(receiptStatus(a.payments).pending > 0));
}
