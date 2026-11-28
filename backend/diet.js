/* Meal preferences are separate from registration, payment, quota and attendance state. */
(function(root) {
  const deadline = '2026-11-29T04:00:00.000Z'; // 12 noon, Asia/Kuala_Lumpur.
  function fail(code, message) { const e = new Error(message); e.code = code; e.status = 400; throw e; }
  function people(state, id) {
    const r = state.registrations.find(r => r.id === id);
    if (!r) fail('NOT_FOUND', 'Pendaftaran tidak dijumpai.');
    const student = state.students.find(s => s.id === r.studentId);
    return [{id:'student:' + student.id, name:student.name, role:'Graduan'},
      ...state.guardians.filter(g => g.registrationId === id && g.active).map(g => ({id:'guardian:' + g.id, name:g.name, role:'Tetamu'}))];
  }
  function view(state, id, saved, now = Date.now()) {
    const members = people(state, id), ids = members.map(p => p.id);
    const selected = saved ? saved.personIds.filter(id => ids.includes(id)) : [];
    const needsReview = !!saved && (saved.memberIds.length !== ids.length || saved.memberIds.some(id => !ids.includes(id)));
    return {deadline, closed:now >= Date.parse(deadline), answered:!!saved, needsReview,
      choice:saved ? saved.choice : null, personIds:selected, vegetarianCount:selected.length,
      updatedAt:saved ? saved.updatedAt : null, people:members};
  }
  function save(state, id, input, now = Date.now()) {
    if (now >= Date.parse(deadline)) fail('DIET_CLOSED', 'Tempoh maklum balas hidangan telah tamat. Sila hubungi urus setia untuk bantuan.');
    const members = people(state, id), ids = members.map(p => p.id);
    if (!['NONE','VEGETARIAN'].includes(input.choice)) fail('INVALID_DIET', 'Pilih Tiada atau Ya untuk hidangan vegetarian.');
    if (!Array.isArray(input.personIds) || new Set(input.personIds).size !== input.personIds.length || input.personIds.some(id => !ids.includes(id)))
      fail('INVALID_DIET', 'Pilih nama daripada ahli keluarga yang berdaftar sahaja.');
    if (input.choice === 'VEGETARIAN' ? !input.personIds.length : input.personIds.length !== 0)
      fail('INVALID_DIET', 'Jika Ya, tandakan sekurang-kurangnya seorang. Jika Tiada, kosongkan pilihan nama.');
    return {choice:input.choice, personIds:[...input.personIds], memberIds:ids, updatedAt:new Date(now).toISOString()};
  }
  function summary(state, responses, now = Date.now()) {
    const rows = state.registrations.map(r => {
      const student = state.students.find(s => s.id === r.studentId);
      return {registrationId:r.id, student:{id:student.id,name:student.name,className:student.className}, ...view(state, r.id, responses[r.id], now)};
    }).sort((a,b) => a.student.className.localeCompare(b.student.className) || a.student.name.localeCompare(b.student.name));
    return {deadline, closed:now >= Date.parse(deadline), registeredFamilies:rows.length,
      answeredFamilies:rows.filter(r => r.answered).length, unansweredFamilies:rows.filter(r => !r.answered).length,
      needsReviewFamilies:rows.filter(r => r.needsReview).length,
      vegetarianCount:rows.reduce((n,r) => n + r.vegetarianCount, 0), rows};
  }
  root.TWYDiet = {deadline, people, view, save, summary};
})(globalThis);
