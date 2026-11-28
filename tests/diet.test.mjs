import test from 'node:test';
import assert from 'node:assert/strict';
import '../backend/domain.js';
import '../backend/diet.js';
const D=globalThis.TWYDomain,M=globalThis.TWYDiet,before=Date.parse('2026-11-28T06:00:00Z');
function fixture() {
  const state=D.initial([{id:'s1',name:'GRADUAN UJIAN',className:'6H',active:true},{id:'s2',name:'GRADUAN KEDUA',className:'6J',active:true}]);
  state.settings.registrationOpen=true;state.settings.paymentDeadline='2099-11-20';
  let n=0;const ctx={id:()=> 'id-'+(++n),now:()=>new Date(before).toISOString(),actor:'test'};
  const one=D.register(state,{studentId:'s1',contactPhone:'0123456789',guardians:[{name:'WARIS UJIAN'}],idempotencyKey:'diet-registration-one'},ctx).registration;
  const two=D.register(state,{studentId:'s2',contactPhone:'0198765432',guardians:[],idempotencyKey:'diet-registration-two'},ctx).registration;
  return {state,one,two};
}
test('meal answers preserve all canonical registration, payment, seat, session and QR state',()=>{
  const {state,one}=fixture(),snapshot=structuredClone(state),ids=M.people(state,one.id).map(p=>p.id);
  const saved=M.save(state,one.id,{choice:'VEGETARIAN',personIds:ids},before);
  assert.equal(M.view(state,one.id,saved,before).vegetarianCount,2);
  assert.deepEqual(state,snapshot);
  assert.deepEqual(Object.keys(state),Object.keys(snapshot));
});
test('only people registered to this family can receive a meal selection',()=>{
  const {state,one,two}=fixture(),valid=M.people(state,one.id)[0].id,foreign=M.people(state,two.id)[0].id;
  for(const input of [{choice:'VEGETARIAN',personIds:[]},{choice:'NONE',personIds:[valid]},{choice:'VEGETARIAN',personIds:[foreign]},{choice:'VEGETARIAN',personIds:[valid,valid]},{choice:'OTHER',personIds:[]}])
    assert.throws(()=>M.save(state,one.id,input,before),{code:'INVALID_DIET'});
});
test('no answer remains unanswered until explicitly saved; deadline is noon in Malaysia',()=>{
  const {state,one}=fixture();assert.equal(M.view(state,one.id,null,before).answered,false);
  const saved=M.save(state,one.id,{choice:'NONE',personIds:[]},before);
  assert.equal(M.view(state,one.id,saved,before).answered,true);
  assert.equal(M.view(state,one.id,saved,Date.parse('2026-11-29T03:59:59Z')).closed,false);
  assert.equal(M.view(state,one.id,saved,Date.parse('2026-11-29T04:00:00Z')).closed,true);
  assert.throws(()=>M.save(state,one.id,{choice:'NONE',personIds:[]},Date.parse(M.deadline)),{code:'DIET_CLOSED'});
});
test('resubmission replaces preference without double counting and removed guests need review',()=>{
  const {state,one}=fixture(),members=M.people(state,one.id);
  const yes=M.save(state,one.id,{choice:'VEGETARIAN',personIds:members.map(p=>p.id)},before);
  let summary=M.summary(state,{[one.id]:yes},before);
  assert.equal(summary.vegetarianCount,2);assert.equal(summary.unansweredFamilies,1);
  const no=M.save(state,one.id,{choice:'NONE',personIds:[]},before);
  assert.equal(M.summary(state,{[one.id]:no},before).vegetarianCount,0);
  state.guardians[0].active=false;
  summary=M.summary(state,{[one.id]:yes},before);
  assert.equal(summary.vegetarianCount,1);assert.equal(summary.needsReviewFamilies,1);
});
