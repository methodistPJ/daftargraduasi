import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptStatus,prioritizePendingReceipts} from '../frontend/js/receipt-status.js';
const p=status=>({status});
test('receipt status distinguishes no upload, pending, reviewed and correction',()=>{
 assert.equal(receiptStatus().kind,'none');
 assert.equal(receiptStatus([p('VERIFIED')]).kind,'reviewed');
 assert.equal(receiptStatus([p('REJECTED')]).kind,'correction');
 assert.equal(receiptStatus([p('REJECTED'),p('VERIFIED')]).kind,'reviewed');
 assert.equal(receiptStatus([p('VERIFIED'),p('REJECTED')]).kind,'correction');
 const status=receiptStatus([p('VERIFIED'),p('REJECTED'),p('PENDING'),p('PENDING')]);
 assert.equal(status.kind,'pending');assert.equal(status.pending,2);assert.equal(status.uploaded,4);
});
test('pending uploads come first without mutating records or treating unpaid balances as receipts',()=>{
 const rows=[{id:'none',payments:[],outstandingCents:12000},{id:'pending',payments:[p('PENDING')],outstandingCents:12000},{id:'verified',payments:[p('VERIFIED')],outstandingCents:0},{id:'second-pending',payments:[p('PENDING')],outstandingCents:3000}];
 const before=structuredClone(rows);assert.deepEqual(prioritizePendingReceipts(rows).map(r=>r.id),['pending','second-pending','none','verified']);assert.deepEqual(rows,before);
});
