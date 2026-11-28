import {api,escapeHTML as E,downloadText} from './api.js';

export async function renderMeals(target, token, dashboard) {
  const summary = await api('admin.dashboard', {section:'mealPreferences'}, token);
  if (!target.isConnected || !target.querySelector('[role="status"]')) return;
  const countRole = role => summary.rows.reduce((n,r) => n + r.people.filter(p => p.role === role && r.personIds.includes(p.id)).length, 0);
  const stateLabel = r => !r.answered ? (summary.closed ? 'Tiada jawapan — dianggap tiada vegetarian' : 'Belum menjawab')
    : r.needsReview ? 'Perlu semak perubahan ahli keluarga' : r.vegetarianCount ? 'Memerlukan vegetarian' : 'Tiada vegetarian';
  const phone = r => dashboard.registrations.find(reg => reg.id === r.registrationId)?.contactPhone || '';
  const stat = (label,n) => `<article class="admin-stat"><span>${label}</span><strong>${n}</strong></article>`;
  target.innerHTML = `<h2 class="admin-section-title">Persediaan hidangan vegetarian</h2>
    <p>Maklum balas sehingga <strong>29 November 2026, jam 12.00 tengah hari</strong>. Keluarga yang tidak menjawab dianggap tiada keperluan vegetarian selepas tarikh tutup.</p>
    <div class="admin-stats">${stat('Hidangan vegetarian',summary.vegetarianCount)}${stat('Vegetarian · graduan',countRole('Graduan'))}${stat('Vegetarian · tetamu',countRole('Tetamu'))}${stat('Keluarga sudah menjawab',summary.answeredFamilies)}${stat('Keluarga belum menjawab',summary.unansweredFamilies)}${stat('Perlu semak semula',summary.needsReviewFamilies)}</div>
    <div class="admin-toolbar"><button id="diet-export">Eksport semua maklum balas CSV</button><button id="diet-kitchen-export">Eksport senarai vegetarian CSV</button></div>
    <div class="admin-filters"><input id="diet-search" type="search" placeholder="Cari nama graduan atau tetamu…" aria-label="Cari maklum balas hidangan"><select id="diet-class" aria-label="Tapis kelas hidangan"><option value="">Semua kelas</option><option>6H</option><option>6J</option></select><select id="diet-filter" aria-label="Tapis jawapan hidangan"><option value="">Semua keluarga</option><option value="vegetarian">Memerlukan vegetarian</option><option value="unanswered">Belum menjawab</option><option value="none">Tiada vegetarian</option><option value="review">Perlu semak semula</option></select></div>
    <p class="quiet-note" id="diet-result-count" role="status"></p><div class="table-scroll"><table class="admin-table"><thead><tr><th>Graduan</th><th>Kelas</th><th>Status maklum balas</th><th>Bilangan vegetarian</th><th>Nama / peranan</th><th>Telefon utama</th><th>Dikemas kini</th></tr></thead><tbody>
    ${summary.rows.map(r => `<tr><td class="student-name">${E(r.student.name)}</td><td>${E(r.student.className)}</td><td>${E(stateLabel(r))}</td><td><strong>${r.vegetarianCount}</strong></td><td>${r.people.filter(p => r.personIds.includes(p.id)).map(p => `${E(p.name)} (${E(p.role)})`).join('<br>') || '—'}</td><td>${E(phone(r))}</td><td>${r.updatedAt ? E(new Date(r.updatedAt).toLocaleString('ms-MY',{timeZone:'Asia/Kuala_Lumpur'})) : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
  const rows = [...target.querySelectorAll('tbody tr')];
  function filter() {
    const query = target.querySelector('#diet-search').value.trim().toLowerCase(), cls = target.querySelector('#diet-class').value, kind = target.querySelector('#diet-filter').value;
    let count = 0;
    summary.rows.forEach((r,i) => {
      const match = (!cls || cls === r.student.className) && (r.student.name + ' ' + r.people.map(p => p.name).join(' ')).toLowerCase().includes(query)
        && (!kind || kind === 'vegetarian' && r.vegetarianCount > 0 || kind === 'unanswered' && !r.answered || kind === 'none' && r.answered && !r.vegetarianCount || kind === 'review' && r.needsReview);
      rows[i].hidden = !match;
      if (match) count++;
    });
    target.querySelector('#diet-result-count').textContent = `${count} daripada ${summary.rows.length} keluarga`;
  }
  let timer;
  target.querySelector('#diet-search').oninput = () => {clearTimeout(timer);timer=setTimeout(filter,120);};
  target.querySelector('#diet-class').onchange = target.querySelector('#diet-filter').onchange = filter;
  const csv = rows => '\uFEFF' + rows.map(row => row.map(value => '"' + String(value ?? '').replace(/^[=+@\-]/,"'$&").replaceAll('"','""') + '"').join(',')).join('\r\n');
  target.querySelector('#diet-export').onclick = () => downloadText('TWY2026-Maklum-Balas-Hidangan.csv',csv([
    ['Graduan','Kelas','Status','Bilangan vegetarian','Nama vegetarian','Telefon utama','Dikemas kini'],
    ...summary.rows.map(r => [r.student.name,r.student.className,stateLabel(r),r.vegetarianCount,r.people.filter(p=>r.personIds.includes(p.id)).map(p=>p.name+' ('+p.role+')').join('; '),phone(r),r.updatedAt])
  ]),'text/csv;charset=utf-8');
  target.querySelector('#diet-kitchen-export').onclick = () => downloadText('TWY2026-Senarai-Hidangan-Vegetarian.csv',csv([
    ['Nama','Peranan','Graduan','Kelas'],
    ...summary.rows.flatMap(r => r.people.filter(p=>r.personIds.includes(p.id)).map(p=>[p.name,p.role,r.student.name,r.student.className])),
    ['JUMLAH HIDANGAN VEGETARIAN',summary.vegetarianCount,'','']
  ]),'text/csv;charset=utf-8');
  filter();
}
