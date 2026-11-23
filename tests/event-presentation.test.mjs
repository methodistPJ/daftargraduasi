import test from 'node:test';
import assert from 'node:assert/strict';
import {eventPresentation} from '../frontend/js/event-presentation.js';
const settings={eventDate:'2026-12-02',paymentDeadline:'2026-11-22',registrationOpen:true};
const at=date=>eventPresentation(settings,Date.parse(date));
test('closed landing observes Malaysia midnight after the extended deadline',()=>{
  assert.equal(at('2026-11-22T23:59:59+08:00').closed,false);
  assert.equal(at('2026-11-23T00:00:00+08:00').closed,true);
  assert.equal(at('2026-11-23T09:00:00+08:00').countdown,'9 hari lagi untuk kita raikan bersama.');
});
test('QR CTA starts exactly on 1 December in Malaysia',()=>{
  const before=at('2026-11-30T23:59:59+08:00');
  assert.equal(before.qrMode,false);
  assert.equal(before.label,'Semak / Kemaskini');
  const next=at('2026-11-30T16:00:00Z');
  assert.equal(next.qrMode,true);
  assert.equal(next.label,'Dapatkan QR Kehadiran');
  assert.equal(next.countdown,'Esok hari graduasi kita!');
  assert.equal(at('2026-12-02T14:30:00+08:00').countdown,'Hari ini hari graduasi kita!');
});
test('manual closure is respected and presentation never mutates settings',()=>{
  const original=structuredClone(settings);
  assert.equal(eventPresentation({...settings,registrationOpen:false},Date.parse('2026-11-20T00:00:00+08:00')).closed,true);
  at('2026-12-01T00:00:00+08:00');
  assert.deepEqual(settings,original);
});
