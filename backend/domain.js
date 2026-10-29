/* Shared, deterministic business rules. No network, storage, credentials or roster data. */
globalThis.TWYDomain = (() => {
  'use strict';
  const fail = (code, message, details) => { const e = new Error(message); e.code = code; e.details = details; throw e; };
  const defaults = () => ({
    title: 'The Wonder Years 2026', tagline: 'Six Years of Memories, A Lifetime of Wonder.',
    eventName: 'Majlis Graduasi Tahun 6 SK Methodist Petaling Jaya 2026',
    eventDate: '2026-12-02', eventTime: '14:30', timeZone: 'Asia/Kuala_Lumpur',
    venue: "D’Buana Hall, Petaling Jaya", paymentDeadline: '2026-11-25',
    studentFeeCents: 10000, guardianFeeCents: 3000, capacity: 100, maxGuardians: 4,
    registrationOpen: false, reservationPolicy: 'MANUAL_RELEASE_ONLY',
    bankName: 'CIMB BANK', accountHolder: 'PIBG SK METHODIST PJ', accountNumber: '8003392687', bankReference: '123 GRADUASI', bankQrAsset: '',
  });
  const initial = (students = []) => ({ schemaVersion: 1, revision: 0, settings: defaults(), students,
    registrations: [], guardians: [], payments: [], receipts: [], audit: [], idempotency: {}, sessions: [], nextReference: 1 });
  function text(value, field, min = 2, max = 120) {
    if (typeof value !== 'string') fail('INVALID_INPUT', `${field} tidak sah.`);
    const result = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (result.length < min || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) fail('INVALID_INPUT', `${field} tidak sah.`);
    return result;
  }
  function phone(value) {
    let p = String(value || '').normalize('NFKC').replace(/\D/g, '');
    if (p.startsWith('0060')) p = p.slice(2);
    if (p.startsWith('60')) p = '0' + p.slice(2).replace(/^0/, '');
    if (!/^0[1-9]\d{7,9}$/.test(p)) fail('INVALID_PHONE', 'Masukkan nombor telefon Malaysia yang sah, contohnya 0189044630.');
    return p;
  }
  function amount(value) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 10000000) fail('INVALID_AMOUNT', 'Amaun pembayaran tidak sah.');
    return value;
  }
  const activeGuardians = (s, r) => s.guardians.filter(g => g.registrationId === r.id && g.active);
  const paid = (s, id) => s.payments.filter(p => p.registrationId === id && p.status === 'VERIFIED').reduce((n, p) => n + p.amountCents, 0);
  const total = (s, r) => s.settings.studentFeeCents + activeGuardians(s, r).length * s.settings.guardianFeeCents;
  function seatsFor(s, r) {
    if (r.status !== 'ACTIVE' || !r.seatsHeld) return { reserved: 0, confirmed: 0 };
    const count = activeGuardians(s, r).length;
    const confirmed = Math.min(count, Math.floor(Math.max(0, paid(s, r.id) - s.settings.studentFeeCents) / s.settings.guardianFeeCents));
    return { confirmed, reserved: count - confirmed };
  }
  function quota(s) {
    const q = s.registrations.reduce((a, r) => { const b = seatsFor(s, r); return { reserved: a.reserved + b.reserved, confirmed: a.confirmed + b.confirmed }; }, { reserved: 0, confirmed: 0 });
    return { capacity: s.settings.capacity, ...q, available: s.settings.capacity - q.reserved - q.confirmed };
  }
  function audit(s, ctx, action, entityId, summary = '') {
    s.audit.push({ id: ctx.id(), at: ctx.now(), actor: ctx.actor || 'parent', action, entityId, summary });
  }
  function enforceSeats(s, newCount, previousHeldCount = 0) {
    const available = quota(s).available + previousHeldCount;
    if (newCount > available) fail('QUOTA_FULL', `Hanya ${available} tempat ibu bapa masih tersedia.`, { available });
  }
  function validateGuardians(s, list, contact) {
    if (!Array.isArray(list) || list.length > s.settings.maxGuardians) fail('INVALID_GUARDIANS', `Maksimum ${s.settings.maxGuardians} waris untuk satu pendaftaran.`);
    return list.map(g => ({ id: typeof g.id === 'string' ? g.id : null, name: text(g.name, 'Nama waris', 2, 100), phone: g.phone ? phone(g.phone) : contact }));
  }
  function publicSettings(s) {
    const { title, tagline, eventName, eventDate, eventTime, timeZone, venue, paymentDeadline, studentFeeCents, guardianFeeCents, maxGuardians, registrationOpen, bankName, accountHolder, accountNumber, bankReference, bankQrAsset } = s.settings;
    return { title, tagline, eventName, eventDate, eventTime, timeZone, venue, paymentDeadline, studentFeeCents, guardianFeeCents, maxGuardians, registrationOpen, bankName, accountHolder, accountNumber, bankReference, bankQrAsset, reservationPolicy: 'MANUAL_RELEASE_ONLY' };
  }
  function search(s, value) {
    const q = text(value, 'Nama murid', 3, 80).toLocaleUpperCase('ms');
    const bits = q.split(' ');
    return s.students.filter(p => p.active !== false && bits.every(v => p.name.toLocaleUpperCase('ms').includes(v)))
      .slice(0, 6).map(({ id, name, className }) => ({ id, name, className }));
  }
  function view(s, r) {
    const student = s.students.find(p => p.id === r.studentId);
    const verifiedCents = paid(s, r.id), totalCents = total(s, r);
    return { id: r.id, reference: r.reference, student: student ? { id: student.id, name: student.name, className: student.className } : null,
      contactPhone: phone(r.contactPhone), guardians: activeGuardians(s, r).map(g => ({ id: g.id, name: g.name, phone: phone(g.phone) })),
      totalCents, verifiedCents, outstandingCents: Math.max(0, totalCents - verifiedCents), overpaymentCents: Math.max(0, verifiedCents - totalCents),
      attendance: r.attendance || null, passEligible: passEligible(s,r), seatsHeld: r.seatsHeld, seats: seatsFor(s, r), status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt,
      payments: s.payments.filter(p => p.registrationId === r.id).map(({ id, amountCents, status, createdAt, reviewedAt, reviewNote, receiptId }) => ({ id, amountCents, status, createdAt, reviewedAt, reviewNote, receiptId })) };
  }
  function passEligible(s,r) { return r.status==='ACTIVE' && paid(s,r.id)>=total(s,r) && (r.seatsHeld || activeGuardians(s,r).length===0); }
  function attendancePeople(s,r) {
    const student=s.students.find(p=>p.id===r.studentId),people=[{id:'student:'+student.id,name:student.name,role:'Murid'},...activeGuardians(s,r).map(g=>({id:'guardian:'+g.id,name:g.name,role:'Waris'}))];
    // Honor previously recorded whole-family admissions when reading older records.
    const entries=r.attendance?(r.attendance.entries||people.map(p=>({personId:p.id,checkedInAt:r.attendance.checkedInAt,checkedInBy:r.attendance.checkedInBy}))):[];
    return people.map(p=>({...p,checkedInAt:entries.find(e=>e.personId===p.id)?.checkedInAt||null}));
  }
  function attendancePass(s,id) {
    const r=registration(s,id),student=s.students.find(p=>p.id===r.studentId),people=attendancePeople(s,r),checkedInCount=people.filter(p=>p.checkedInAt).length;
    return {available:passEligible(s,r),student:{id:student.id,name:student.name,className:student.className},guardianCount:activeGuardians(s,r).length,partySize:people.length,people,checkedInCount,remainingCount:people.length-checkedInCount,eventDate:s.settings.eventDate,venue:s.settings.venue,attendance:r.attendance||null,outstandingCents:Math.max(0,total(s,r)-paid(s,r.id))};
  }
  function checkIn(s,id,ctx,personIds) {
    const r=registration(s,id),people=attendancePeople(s,r);
    if(!Array.isArray(personIds)||!personIds.length||personIds.length>people.length||new Set(personIds).size!==personIds.length||personIds.some(id=>!people.some(p=>p.id===id)))fail('SELECT_PEOPLE','Pilih ahli keluarga yang hadir daripada senarai QR ini.');
    const fresh=people.filter(p=>personIds.includes(p.id)&&!p.checkedInAt);
    if(!fresh.length)return {pass:attendancePass(s,id),alreadyUsed:true,addedCount:0};
    if(!passEligible(s,r))fail('PASS_NOT_READY','Bayaran penuh belum disahkan. QR ini belum boleh digunakan.');
    const day=new Date(Date.parse(ctx.now())+8*3600000).toISOString().slice(0,10);
    if(day!==s.settings.eventDate)fail('EVENT_NOT_TODAY','Daftar masuk hanya dibuka pada tarikh majlis.');
    const previous=r.attendance?.entries||[];
    const entries=[...previous,...fresh.map(p=>({personId:p.id,checkedInAt:ctx.now(),checkedInBy:ctx.actor}))];
    r.attendance={checkedInAt:r.attendance?.checkedInAt||ctx.now(),checkedInBy:r.attendance?.checkedInBy||ctx.actor,entries,partySize:entries.length,guardianCount:entries.filter(e=>e.personId.startsWith('guardian:')).length};
    audit(s,ctx,'ATTENDANCE_CHECKED_IN',id,`${fresh.length} selected people; ${entries.length}/${people.length} arrived`);
    return {pass:attendancePass(s,id),alreadyUsed:false,addedCount:fresh.length};
  }
  function registration(s, id) { const r = s.registrations.find(x => x.id === id); if (!r) fail('NOT_FOUND', 'Rekod tidak dijumpai.'); return r; }
  function canRegister(s, at = new Date().toISOString()) { return s.settings.registrationOpen && new Date(Date.parse(at) + 8 * 3600000).toISOString().slice(0,10) <= s.settings.paymentDeadline; }
  function open(s, ctx) {
    if (!s.settings.registrationOpen) fail('REGISTRATION_CLOSED', 'Pendaftaran belum dibuka. Sila hubungi urus setia.');
    const today = new Date(Date.parse(ctx.now()) + 8 * 3600000).toISOString().slice(0, 10);
    if (today > s.settings.paymentDeadline) fail('REGISTRATION_CLOSED', 'Tempoh pendaftaran telah tamat. Sila hubungi urus setia.');
  }
  function register(s, input, ctx) {
    const key = text(input.idempotencyKey, 'Kunci permintaan', 16, 100);
    const scope = `register:${key}`;
    const canonical = JSON.stringify({ studentId: input.studentId, contactPhone: input.contactPhone, guardians: input.guardians });
    if (s.idempotency[scope]) {
      if (s.idempotency[scope].canonical !== canonical) fail('IDEMPOTENCY_CONFLICT', 'Permintaan berubah. Sila semak dan cuba semula.');
      return { registration: view(s, registration(s, s.idempotency[scope].registrationId)), replayed: true };
    }
    open(s, ctx);
    const student = s.students.find(p => p.id === input.studentId && p.active !== false);
    if (!student) fail('INVALID_STUDENT', 'Sila pilih murid daripada senarai rasmi.');
    if (s.registrations.some(r => r.studentId === student.id && r.status === 'ACTIVE')) fail('DUPLICATE_REGISTRATION', 'Murid ini sudah didaftarkan. Gunakan Kemaskini / Muat Naik Resit.');
    const contact = phone(input.contactPhone), guardians = validateGuardians(s, input.guardians || [], contact);
    enforceSeats(s, guardians.length);
    const id = ctx.id(), reference = `TWY26-${String(s.nextReference++).padStart(4, '0')}`;
    const r = { id, reference, studentId: student.id, contactPhone: contact, status: 'ACTIVE', seatsHeld: true,
      accessHash: ctx.accessHash || '', createdAt: ctx.now(), updatedAt: ctx.now() };
    s.registrations.push(r);
    for (const g of guardians) s.guardians.push({ ...g, id: ctx.id(), registrationId: id, active: true });
    s.idempotency[scope] = { registrationId: id, canonical };
    audit(s, ctx, 'REGISTRATION_CREATED', id, `${guardians.length} guardian seat(s) reserved`);
    return { registration: view(s, r), replayed: false };
  }
  function update(s, id, input, ctx) {
    const key = text(input.idempotencyKey, 'Kunci permintaan', 16, 100), scope = `update:${id}:${key}`;
    const canonical = JSON.stringify({ contactPhone: input.contactPhone, guardians: input.guardians, reserveSeats: !!input.reserveSeats });
    if (s.idempotency[scope]) {
      if (s.idempotency[scope].canonical !== canonical) fail('IDEMPOTENCY_CONFLICT', 'Permintaan berubah. Sila semak dan cuba semula.');
      return view(s, registration(s, id));
    }
    const r = registration(s, id);
    if (r.status !== 'ACTIVE') fail('INACTIVE_REGISTRATION', 'Sila hubungi urus setia untuk rekod ini.');
    const contact = phone(input.contactPhone), next = validateGuardians(s, input.guardians || [], contact), old = activeGuardians(s, r);
    const ids = next.filter(g => g.id).map(g => g.id);
    if (new Set(ids).size !== ids.length || ids.some(g => !old.some(o => o.id === g))) fail('INVALID_GUARDIANS', 'Rekod waris tidak sepadan.');
    if(r.attendance&&(old.length!==next.length||old.some((g,i)=>g.name!==next[i].name||phone(g.phone)!==next[i].phone)))fail('ALREADY_CHECKED_IN','Kumpulan ini telah hadir. Perubahan waris memerlukan semakan urus setia.');
    const willHold = r.seatsHeld || input.reserveSeats === true;
    if (next.length > old.length || (!r.seatsHeld && willHold)) { if (ctx.role !== 'admin') open(s, ctx); }
    if (!willHold && next.length > old.length) fail('RESERVATION_RELEASED', 'Pilih tempahan semula untuk menambah waris.');
    if (willHold) enforceSeats(s, next.length, r.seatsHeld ? old.length : 0);
    s.guardians.filter(g => g.registrationId === id).forEach(g => { g.active = false; });
    for (const g of next) {
      const previous = g.id && s.guardians.find(o => o.id === g.id);
      if (previous) Object.assign(previous, g, { active: true });
      else s.guardians.push({ ...g, id: ctx.id(), registrationId: id, active: true });
    }
    r.contactPhone = contact; r.seatsHeld = willHold; r.updatedAt = ctx.now();
    s.idempotency[scope] = { canonical, registrationId: id };
    audit(s, ctx, 'REGISTRATION_UPDATED', id, `Guardian count ${old.length} → ${next.length}; no automatic refund`);
    return view(s, r);
  }
  function submitReceipt(s, id, input, ctx) {
    const r = registration(s, id);
    if (r.status !== 'ACTIVE') fail('INACTIVE_REGISTRATION', 'Rekod ini tidak aktif.');
    const key = text(input.idempotencyKey, 'Kunci permintaan', 16, 100), scope = `receipt:${id}:${key}`;
    if (s.idempotency[scope]) {
      if (s.idempotency[scope].sha256 !== input.sha256 || s.idempotency[scope].amountCents !== input.amountCents) fail('IDEMPOTENCY_CONFLICT', 'Kandungan resit telah berubah.');
      return { registration: view(s, r), replayed: true, receiptId: s.idempotency[scope].receiptId };
    }
    amount(input.amountCents);
    if (typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.sha256)) fail('INVALID_RECEIPT', 'Fail resit tidak sah.');
    if (s.receipts.some(x => x.sha256 === input.sha256)) fail('DUPLICATE_RECEIPT', 'Resit yang sama telah diterima. Sila semak sejarah bayaran atau hubungi urus setia.');
    if (!input.driveFileId) fail('INVALID_RECEIPT', 'Resit belum disimpan.');
    const receipt = { id: ctx.id(), registrationId: id, driveFileId: input.driveFileId, sha256: input.sha256,
      mimeType: input.mimeType, sizeBytes: input.sizeBytes, createdAt: ctx.now() };
    const payment = { id: ctx.id(), registrationId: id, receiptId: receipt.id, amountCents: input.amountCents, status: 'PENDING', createdAt: ctx.now() };
    s.receipts.push(receipt); s.payments.push(payment);
    s.idempotency[scope] = { receiptId: receipt.id, sha256: input.sha256, amountCents: input.amountCents };
    audit(s, ctx, 'RECEIPT_SUBMITTED', receipt.id, 'Awaiting organizer verification; quota unchanged');
    return { registration: view(s, r), receiptId: receipt.id, replayed: false };
  }
  function reviewPayment(s, input, ctx) {
    const p = s.payments.find(p => p.id === input.paymentId);
    if (!p) fail('NOT_FOUND', 'Bayaran tidak dijumpai.');
    if (!['VERIFIED', 'REJECTED'].includes(input.status)) fail('INVALID_STATUS', 'Status bayaran tidak sah.');
    if (p.status === input.status) {
      if (input.status === 'VERIFIED' && p.amountCents !== input.verifiedAmountCents) fail('ALREADY_REVIEWED', 'Amaun ini berbeza daripada bayaran yang telah disahkan.');
      return view(s, registration(s, p.registrationId));
    }
    if (p.status !== 'PENDING') fail('ALREADY_REVIEWED', 'Bayaran ini telah disemak. Pembetulan memerlukan semakan berasingan.');
    const r = registration(s, p.registrationId);
    if (input.status === 'VERIFIED') {
      amount(input.verifiedAmountCents);
      if (!r.seatsHeld && activeGuardians(s, r).length) { enforceSeats(s, activeGuardians(s, r).length); r.seatsHeld = true; }
      p.amountCents = input.verifiedAmountCents;
    }
    p.status = input.status; p.reviewedAt = ctx.now(); p.reviewedBy = ctx.actor;
    p.reviewNote = input.note ? text(input.note, 'Catatan', 1, 400) : '';
    audit(s, ctx, 'PAYMENT_' + input.status, p.id, `Amount ${p.amountCents} cents`);
    return view(s, r);
  }
  function release(s, id, reason, ctx) {
    const r = registration(s, id);
    if (seatsFor(s, r).confirmed > 0) fail('PAID_SEATS', 'Tempat berbayar tidak boleh dilepaskan sebagai tempahan belum bayar.');
    const note = text(reason, 'Sebab pelepasan', 5, 300);
    r.seatsHeld = false; r.updatedAt = ctx.now();
    audit(s, ctx, 'RESERVATION_MANUALLY_RELEASED', id, note);
    return view(s, r);
  }
  function setSettings(s, values, ctx) {
    const allowed = ['capacity', 'maxGuardians', 'registrationOpen', 'bankName', 'accountHolder', 'accountNumber', 'bankReference', 'bankQrAsset'];
    if (Object.keys(values).some(k => !allowed.includes(k))) fail('INVALID_SETTINGS', 'Tetapan tidak dibenarkan.');
    if ('capacity' in values) {
      const used = quota(s).reserved + quota(s).confirmed;
      if (!Number.isInteger(values.capacity) || values.capacity < used || values.capacity > 1000) fail('INVALID_CAPACITY', 'Kapasiti lebih kecil daripada tempat yang telah diperuntukkan.');
    }
    if ('maxGuardians' in values && (!Number.isInteger(values.maxGuardians) || values.maxGuardians < 1 || values.maxGuardians > 100)) fail('INVALID_SETTINGS', 'Had waris tidak sah.');
    for (const k of ['bankName', 'accountHolder', 'accountNumber', 'bankReference', 'bankQrAsset']) if (k in values) values[k] = values[k] ? text(values[k], k, 1, 300) : '';
    if ('registrationOpen' in values && typeof values.registrationOpen !== 'boolean') fail('INVALID_SETTINGS', 'Status pendaftaran tidak sah.');
    const nextSettings = { ...s.settings, ...values };
    if (nextSettings.registrationOpen && (!nextSettings.bankName || !nextSettings.accountHolder || !nextSettings.accountNumber || !nextSettings.bankReference)) fail('BANK_NOT_CONFIGURED', 'Lengkapkan maklumat bank rasmi sebelum membuka pendaftaran.');
    Object.assign(s.settings, values); audit(s, ctx, 'SETTINGS_UPDATED', 'SETTINGS', Object.keys(values).join(', '));
    return publicSettings(s);
  }
  function dashboard(s) {
    const active = s.registrations.filter(r => r.status === 'ACTIVE');
    return { totalStudents: s.students.filter(p => p.active !== false).length, registeredStudents: active.length,
      unregisteredStudents: s.students.filter(p => p.active !== false && !active.some(r => r.studentId === p.id)).map(({ id, name, className }) => ({ id, name, className })),
      quota: quota(s), verifiedCents: s.payments.filter(p => p.status === 'VERIFIED').reduce((n,p) => n+p.amountCents,0),
      outstandingCents: active.reduce((n,r) => n+Math.max(0,total(s,r)-paid(s,r.id)),0),
      receiptsAwaitingVerification: s.payments.filter(p => p.status === 'PENDING').length,
      registrations: active.map(r => view(s,r)), settings: publicSettings(s), audit: s.audit.slice(-300).reverse() };
  }
  function assertIntegrity(s) {
    const q = quota(s);
    if (q.available < 0 || q.reserved < 0 || q.confirmed < 0) fail('INTEGRITY', 'Quota invariant failed');
    const studentIds = new Set();
    for (const p of s.students) { if (studentIds.has(p.id)) fail('INTEGRITY', 'Duplicate student ID'); studentIds.add(p.id); }
    const ids = new Set(), students = new Set();
    for (const r of s.registrations) {
      if (ids.has(r.id)) fail('INTEGRITY', 'Duplicate registration ID'); ids.add(r.id);
      if (r.status === 'ACTIVE' && students.has(r.studentId)) fail('INTEGRITY', 'Duplicate student registration');
      if (r.status === 'ACTIVE') students.add(r.studentId);
      if (!s.students.some(p => p.id === r.studentId)) fail('INTEGRITY', 'Unknown student');
    }
    for (const g of s.guardians) if (!ids.has(g.registrationId)) fail('INTEGRITY', 'Orphan guardian');
    for (const p of s.payments) if (!ids.has(p.registrationId) || !s.receipts.some(r => r.id === p.receiptId)) fail('INTEGRITY', 'Orphan payment');
    return true;
  }
  return { defaults, initial, fail, text, phone, amount, quota, total, paid, seatsFor, activeGuardians, publicSettings, search,
    view, passEligible, attendancePeople, attendancePass, checkIn, registration, canRegister, register, update, submitReceipt, reviewPayment, release, setSettings, dashboard, assertIntegrity, audit };
})();
