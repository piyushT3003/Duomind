<script>
/* =====================================================================
   UI HELPERS
   ===================================================================== */
function toast(msg, kind = 'info') {
  const t = document.createElement('div'); t.className = 'toast glass ' + kind; t.innerHTML = `<span class="d"></span><div>${msg}</div>`;
  $('#toasts').appendChild(t);
  gsap.fromTo(t, { x: 140, opacity: 0, scale: .92 }, { x: 0, opacity: 1, scale: 1, duration: REDUCE ? .2 : .9, ease: 'elastic.out(1,.62)' });
  setTimeout(() => gsap.to(t, { x: 140, opacity: 0, duration: .35, ease: 'power2.in', onComplete: () => t.remove() }), 3600);
}
function countTo(el, to, { from = 0, dec = 0, suffix = '', dur = 1.2 } = {}) {
  if (!el) return; const o = { v: from };
  gsap.to(o, { v: to, duration: REDUCE ? .01 : dur, ease: 'power2.out', onUpdate: () => { el.textContent = o.v.toFixed(dec) + suffix; } });
}
function fillBars(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.bar i[data-v]', root).forEach(i => i.style.transform = `scaleX(${clamp(+i.dataset.v) / 100})`);
    $$('.ring .rf[data-v]', root).forEach(c => c.style.strokeDashoffset = 176 * (1 - (+c.dataset.v) / 100));
  }));
}
function reveal(nodes, from = {}) {
  nodes = [...nodes].filter(Boolean); if (!nodes.length) return;
  if (REDUCE) { gsap.fromTo(nodes, { opacity: 0 }, { opacity: 1, duration: .3, clearProps: 'opacity' }); return; }
  gsap.fromTo(nodes, Object.assign({ opacity: 0, y: 40, rotateX: -35, z: -40, transformPerspective: 900, transformOrigin: '50% 100%' }, from),
    { opacity: 1, y: 0, x: 0, rotateX: 0, rotateY: 0, z: 0, scale: 1, duration: .9, stagger: .07, ease: 'expo.out', clearProps: 'transform,opacity,transformOrigin' });
}
function sparkline(pts, w = 520, h = 80) {
  const vals = pts.map(p => p.v), mn = Math.min(...vals) - 5, mx = Math.max(...vals) + 5;
  const P = pts.map((p, i) => [(i / (pts.length - 1 || 1)) * (w - 24) + 12, h - 10 - ((p.v - mn) / (mx - mn || 1)) * (h - 24)]);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}"><path d="${P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')}"/>${P.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2"><title>${pts[i].v} — ${esc(pts[i].why || '')}</title></circle>`).join('')}</svg>`;
}

/* ---------- modal (zooms from the clicked element) ---------- */
let modalOpen = false, modalFrom = null;
function openModal(html, from) {
  const w = $('#mwrap'), m = $('#modal'); $('#mbody').innerHTML = html;
  if (modalOpen) { gsap.fromTo('#mbody', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .3, clearProps: 'opacity,transform' }); return; }
  modalOpen = true; modalFrom = from || null; w.classList.add('open');
  let dx = 0, dy = 0; if (from && from.getBoundingClientRect) { const r = from.getBoundingClientRect(), b = m.getBoundingClientRect(); dx = r.left + r.width / 2 - (b.left + b.width / 2); dy = r.top + r.height / 2 - (b.top + b.height / 2); }
  gsap.fromTo(w, { opacity: 0 }, { opacity: 1, duration: .3 });
  if (!REDUCE) gsap.fromTo(m, { x: dx, y: dy, scale: .15, opacity: 0 }, { x: 0, y: 0, scale: 1, opacity: 1, duration: .55, ease: 'expo.out' });
  fillBars(m); setTimeout(() => { const f = m.querySelector('input,button:not(.mx),select,textarea'); if (f) f.focus({ preventScroll: true }); }, 120);
}
function closeModal() {
  if (!modalOpen) return; modalOpen = false;
  const w = $('#mwrap'), m = $('#modal');
  let dx = 0, dy = 0; if (modalFrom && document.body.contains(modalFrom)) { const r = modalFrom.getBoundingClientRect(), b = m.getBoundingClientRect(); dx = r.left + r.width / 2 - (b.left + b.width / 2); dy = r.top + r.height / 2 - (b.top + b.height / 2); }
  const done = () => { w.classList.remove('open'); gsap.set(m, { clearProps: 'transform,opacity' }); gsap.set(w, { clearProps: 'opacity' }); $('#mbody').innerHTML = ''; };
  if (REDUCE) return done();
  gsap.to(m, { x: dx, y: dy, scale: .15, opacity: 0, duration: .32, ease: 'power3.in' });
  gsap.to(w, { opacity: 0, duration: .32, delay: .04, onComplete: done });
}
function confirmBox(title, text, okLabel, onOk, from) {
  openModal(`<div class="h3" style="margin-bottom:8px">${esc(title)}</div><p class="muted" style="margin-bottom:18px">${esc(text)}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Cancel</button><button class="btn btn-danger" id="okBtn">${esc(okLabel)}</button></div>`, from);
  $('#okBtn').onclick = () => { closeModal(); onOk(); };
}

/* =====================================================================
   AUTH PAGE
   ===================================================================== */
let authMode = 'in';
function setAuthMode(m) {
  authMode = m; const up = m === 'up';
  $('#authTabs').classList.toggle('sign-up', up);
  $$('#authTabs button').forEach(b => { const on = b.dataset.tab === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $('#nameWrap').hidden = !up; $('#meter').hidden = !up; $('#remRow').style.display = up ? 'none' : '';
  $('#authTitle').textContent = up ? 'Create your Twin' : 'Welcome back';
  $('#authSub').textContent = up ? 'Takes about two minutes. No credit card.' : 'Sign in to continue with your Twin.';
  $('#authSubmit span').textContent = up ? 'Create account' : 'Sign in';
  $('#fPass').setAttribute('autocomplete', up ? 'new-password' : 'current-password');
  ['eName','eEmail','ePass'].forEach(id => $('#' + id).textContent = ''); $$('.field.err').forEach(f => f.classList.remove('err'));
  note('');
}
function note(t, kind) { const n = $('#formNote'); n.textContent = t; n.classList.toggle('show', !!t); n.style.borderColor = kind === 'good' ? 'rgba(52,211,153,.5)' : ''; }
function fieldErr(id, msg) { const e = $('#e' + id); e.textContent = msg || ''; const f = $('#f' + id).closest('.field'); f.classList.remove('err'); if (msg) { void f.offsetWidth; f.classList.add('err'); } }
async function submitAuth(e) {
  e.preventDefault();
  const name = $('#fName').value.trim(), email = $('#fEmail').value.trim(), pass = $('#fPass').value;
  let ok = true;
  if (authMode === 'up' && name.length < 2) { fieldErr('Name', 'Enter your name so your Twin knows what to call you.'); ok = false; } else if (authMode === 'up') fieldErr('Name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { fieldErr('Email', 'Enter a valid email address, like you@company.com.'); ok = false; } else fieldErr('Email');
  if (authMode === 'up' && strength(pass) < 2) { fieldErr('Pass', 'Use at least 8 characters with a mix of letters and numbers.'); ok = false; }
  else if (!pass) { fieldErr('Pass', 'Enter your password.'); ok = false; } else fieldErr('Pass');
  if (!ok) return;
  const btn = $('#authSubmit'); btn.disabled = true; btn.querySelector('span').textContent = authMode === 'up' ? 'Creating…' : 'Signing in…';
  try {
    const acc = authMode === 'up' ? await Auth.signUp(name, email, pass) : await Auth.signIn(email, pass);
    Auth.setSession(acc.email, authMode === 'up' || $('#fRem').checked);
    await new Promise(r => setTimeout(r, 450));
    enterApp(acc, authMode === 'up');
  } catch (err) { if (err && err.field) fieldErr(err.field === 'email' ? 'Email' : 'Pass', err.msg); else note('Couldn’t sign in on this browser. Check that site storage is allowed.'); }
  btn.disabled = false; btn.querySelector('span').textContent = authMode === 'up' ? 'Create account' : 'Sign in';
}
let claudeUser = null;
async function initSSO() {
  try { if (window.claude && claude.use) { const u = await claude.use('user'); if (u) { const me = await u.me(); if (me && me.id) { claudeUser = me; $('#ssoLabel').textContent = `Continue as ${me.name || 'your Claude account'}`; $('#ssoBtn').hidden = false; return; } } } } catch (e) {}
  claudeUser = null;
}
function ssoClick() {
  if (!claudeUser) { note('Claude sign-in works when this page is opened inside Claude. Use email and password here instead.'); return; }
  const acc = Auth.claude(claudeUser); Auth.setSession(acc.email, true); enterApp(acc, !loadTwin(acc).onboarded);
}

/* =====================================================================
   ONBOARDING
   ===================================================================== */
let obStep = 1; const ob = { sector: '', answers: {} };
function renderOnboarding() {
  $('#obName').value = T.profile.name || ACC.name || ''; $('#obRole').value = T.profile.role || '';
  ob.sector = T.profile.sector || '';
  $('#sectors').innerHTML = SECTORS.map(s => `<button class="chip ${ob.sector === s ? 'on' : ''}" data-sector="${esc(s)}">${esc(s)}</button>`).join('');
  $('#quiz').innerHTML = QUIZ.map((q, i) => `<div class="qcard"><p>${i + 1}. ${esc(q.q)}</p><div class="qopts">${q.a.map((a, j) => `<button class="qopt ${ob.answers[i] === j ? 'on' : ''}" data-q="${i}" data-a="${j}">${esc(a[0])}</button>`).join('')}</div></div>`).join('');
  renderGoalTags(); obGo(1);
}
function renderGoalTags() {
  const box = $('#goalBox'), inp = $('#goalIn');
  $$('.chip', box).forEach(c => c.remove());
  T.profile.goals.forEach((g, i) => { const c = document.createElement('span'); c.className = 'chip on'; c.innerHTML = `${esc(g)} <button type="button" aria-label="Remove goal" data-rmgoal="${i}">×</button>`; box.insertBefore(c, inp); });
  const sec = ob.sector && GOAL_SUGGESTIONS[ob.sector] ? ob.sector : 'Other';
  $('#goalSugs').innerHTML = GOAL_SUGGESTIONS[sec].filter(g => !T.profile.goals.includes(g)).map(g => `<button class="chip" data-addgoal="${esc(g)}">+ ${esc(g)}</button>`).join('');
}
function addGoal(g) { g = g.trim(); if (!g || T.profile.goals.length >= 5 || T.profile.goals.some(x => x.toLowerCase() === g.toLowerCase())) return; T.profile.goals.push(g.charAt(0).toUpperCase() + g.slice(1)); renderGoalTags(); }
function obGo(n) {
  obStep = n;
  $$('.ob-step').forEach(s => s.classList.toggle('on', +s.dataset.step === n));
  $$('#obSteps i').forEach((b, i) => b.classList.toggle('on', i < n));
  $('#obEyebrow').textContent = `Step ${n} of 4`;
  $('#obBack').style.visibility = n === 1 ? 'hidden' : 'visible';
  $('#obNext span').textContent = n === 4 ? 'Build my Twin' : 'Continue';
  const cur = $(`.ob-step[data-step="${n}"]`); reveal($$('.h2, p, .grid2, .sectors, .qcard, .tagin, .slider-row', cur), { rotateX: 0, y: 18, z: 0 });
}
function obNext() {
  if (obStep === 1) {
    const name = $('#obName').value.trim(), role = $('#obRole').value.trim();
    let sector = ob.sector === 'Other' ? $('#obSectorOther').value.trim() : ob.sector;
    if (!name) return toast('Add the name your Twin should use.', 'warn');
    if (!sector) return toast('Pick your sector, or choose Other and type it.', 'warn');
    Object.assign(T.profile, { name, role, sector });
  }
  if (obStep === 2 && !T.profile.goals.length) { const v = $('#goalIn').value.trim(); if (v) { addGoal(v); $('#goalIn').value = ''; } if (!T.profile.goals.length) return toast('Add at least one goal. Your Twin scores every option against it.', 'warn'); }
  if (obStep === 3 && Object.keys(ob.answers).length < QUIZ.length) return toast(`Answer all ${QUIZ.length} questions (${Object.keys(ob.answers).length}/${QUIZ.length} done).`, 'warn');
  if (obStep < 4) return obGo(obStep + 1);
  finishOnboarding();
}
function finishOnboarding() {
  T.profile.hours = +$('#obHours').value; T.profile.risk = +$('#obRisk').value; T.profile.budget = $('#obBudget').value.trim(); T.profile.tone = $('#obTone').value;
  TRAITS.forEach(t => { T.dna[t.k] = { v: 50, c: 20, seed: 50, h: [] }; });
  Object.entries(ob.answers).forEach(([qi, ai]) => { const d = QUIZ[qi].a[ai][1]; Object.entries(d).forEach(([k, dv]) => { T.dna[k].v = clamp(T.dna[k].v + dv, 5, 95); T.dna[k].c = clamp(T.dna[k].c + 9, 5, 90); }); });
  T.dna.risk.v = Math.round(T.dna.risk.v * .6 + T.profile.risk * .4);
  TRAITS.forEach(t => { const d = T.dna[t.k]; d.v = Math.round(d.v); d.seed = d.v; d.h = [{ v: d.v, at: now(), why: 'From your onboarding answers' }]; });
  addMemory('SAID', `Works as ${T.profile.role || 'a professional'} in ${T.profile.sector}`, 'onboarding');
  if (T.profile.budget) addMemory('SAID', `Budget constraint: ${T.profile.budget}`, 'onboarding');
  T.onboarded = true; bump('Twin built from onboarding — ' + T.profile.goals.length + ' goals, DNA seeded');
  saveTwin(); Brain.burst();
  toast(`Your Twin is ready, ${esc(firstName())}.`, 'good');
  go('home');
}

/* =====================================================================
   HOME HUB
   ===================================================================== */
function greet() { const h = new Date().getHours(); return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function renderHome(anim) {
  const f = fidelity(), tt = topTrait(), open = T.decisions.filter(d => d.chosen == null).length, on = SOURCES.filter(s => T.perms[s.k]).length;
  $('#hello').textContent = `${greet()}, ${firstName()} · Twin ${vstr()} · ${f.total}% fidelity`;
  const lastQ = [...T.threads].sort((a, b) => b.at - a.at)[0];
  $('#hcMem').innerHTML = `<span class="dot"></span><div class="ic">${ic('folder')}</div><b>All you’ve shared</b><div class="v" data-count="${T.memory.length}">0</div><p>memories from ${T.threads.length} conversation${T.threads.length === 1 ? '' : 's'} and ${T.profile.goals.length} goal${T.profile.goals.length === 1 ? '' : 's'}</p>`;
  $('#hcAsk').innerHTML = `<span class="dot"></span><div class="ic round">${ic('search')}</div><b>Ask anything</b><p>${lastQ && lastQ.messages.length ? 'Last: “' + esc(short(lastQ.title, 46)) + '”' : 'Weigh a choice or tell your Twin about yourself'}</p>`;
  $('#hcPriv').innerHTML = `<span class="dot"></span><div class="ic">${ic('shield')}</div><b>Secure &amp; private</b><div class="v"><span data-count="${on}">0</span><span style="font-size:18px;color:var(--muted)">/5 sources</span></div><p>Stored in this browser only. You choose what it uses.</p>`;
  $('#hcDna').innerHTML = `<span class="dot"></span><div class="ic round">${ic('bolt')}</div><b>${esc(tt.t.n)}</b><div class="v"><span data-count="${tt.v}">0</span><span style="font-size:18px;color:var(--muted)">/100</span></div><p>Your strongest trait · ${open} open decision${open === 1 ? '' : 's'}</p>`;
  $$('#stage [data-count]').forEach(el => countTo(el, +el.dataset.count, { dur: 1.4 }));
  $('#homeSug').innerHTML = chatSuggestions().slice(0, 4).map(s => `<button data-suggest="${esc(s)}">${ic('arrow')}${esc(s)}</button>`).join('');
  $('#homeDec').innerHTML = T.decisions.length ? T.decisions.slice(0, 4).map(d => { const r = compute(d); return `<div class="list-i" style="cursor:pointer" data-openlab="${d.id}"><div class="grow"><div style="font-weight:500">${esc(short(d.title, 44))}</div><div class="small muted">${ago(d.at)} · ${d.chosen != null ? 'closed · ' + d.outcome : r.insufficient ? 'needs evidence' : 'Twin: ' + esc(short(d.options[r.rec.win].label, 26))}</div></div>${r.insufficient ? '' : `<span class="badge ${r.rec.robust ? 'robust' : 'fragile'}">${r.rec.conf}%</span>`}</div>`; }).join('') : `<div class="empty">No decisions yet. Ask “Should I … or …?” to simulate your first one.</div>`;
  $('#homeGoals').innerHTML = T.profile.goals.length ? T.profile.goals.map((g, i) => { const n = T.decisions.filter(d => d.options.some(o => overlap(o.label, g))).length + T.memory.filter(m => overlap(m.text, g)).length; return `<div class="list-i"><span class="tag SAID">${i + 1}</span><div class="grow">${esc(g)}<div class="small muted">${n} linked item${n === 1 ? '' : 's'}</div></div></div>`; }).join('') : `<div class="empty">Add goals in Settings.</div>`;
  drawWires(anim);
  if (anim) { splitHeadline(); reveal($$('#stage .hubcard'), { y: 30, rotateX: 0, rotateY: 25, z: -60 }); reveal($$('#p-home .hub-row .card'), {}); }
}
function splitHeadline() {
  const h = $('#hubTitle'); if (REDUCE || h.dataset.split) { if (!REDUCE) gsap.fromTo($$('.w', h), { opacity: 0, y: 40, rotateX: -80 }, { opacity: 1, y: 0, rotateX: 0, duration: .9, stagger: .06, ease: 'expo.out' }); return; }
  $$('span', h).forEach(sp => { sp.innerHTML = sp.textContent.split(' ').map(w => `<span class="w">${esc(w)}</span>`).join(' '); });
  h.dataset.split = 1; h.style.perspective = '600px';
  gsap.fromTo($$('.w', h), { opacity: 0, y: 40, rotateX: -80 }, { opacity: 1, y: 0, rotateX: 0, duration: .9, stagger: .06, ease: 'expo.out' });
}
function drawWires(anim) {
  const svg = $('#wires'), st = $('#stage'); if (!svg || getComputedStyle(svg).display === 'none') return;
  const sr = st.getBoundingClientRect(), ar = $('#anchor-home').getBoundingClientRect();
  const cx = ar.left + ar.width / 2 - sr.left, cy = ar.top + ar.height * .42 - sr.top;
  const paths = $$('.hubcard', st).map(c => {
    const d = c.querySelector('.dot').getBoundingClientRect(), x = d.left + 3.5 - sr.left, y = d.top + 3.5 - sr.top;
    const left = x < cx, ex = cx + (left ? -1 : 1) * ar.width * .26, ey = cy + (y < cy ? -1 : 1) * ar.height * .12, mx = (x + ex) / 2;
    return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} L${mx.toFixed(1)} ${y.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}"/><circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="2.6"/>`;
  });
  svg.innerHTML = paths.join('');
  const ps = $$('path', svg);
  if (anim && !REDUCE) gsap.fromTo(ps, { strokeDashoffset: 600 }, { strokeDashoffset: 0, duration: 1.4, stagger: .12, ease: 'power2.inOut', delay: .4 });
  else ps.forEach(p => p.style.strokeDashoffset = 0);
}

/* =====================================================================
   DECISION LAB
   ===================================================================== */
let labSel = null, labH = '1m', labChart = null;
function renderLab(anim) {
  if (!labSel || !T.decisions.find(d => d.id === labSel)) labSel = T.decisions[0] ? T.decisions[0].id : null;
  $('#decList').innerHTML = T.decisions.length ? T.decisions.map(d => `<button class="thread ${d.id === labSel ? 'on' : ''}" data-labsel="${d.id}" style="flex-direction:column;align-items:flex-start;gap:2px"><span style="font-weight:600;white-space:normal">${esc(short(d.title, 60))}</span><span class="small muted">${ago(d.at)} · ${d.chosen != null ? 'closed' : 'open'} · ${d.options.length} options</span></button>`).join('') : `<div class="empty">Decisions you ask about in chat appear here.</div>`;
  const box = $('#decDetail'), d = T.decisions.find(x => x.id === labSel);
  if (!d) { box.innerHTML = `<div class="card pad"><div class="empty" style="border:0"><div class="h3" style="color:var(--ink);margin-bottom:6px">Nothing to simulate yet</div>Ask your Twin about a real choice — it will score each option for you and run 1,000 futures.<div style="margin-top:14px"><button class="btn btn-primary" data-go="chat">Ask your Twin</button></div></div></div>`; return; }
  const r = compute(d, labH);
  box.innerHTML = `<div class="card pad">
    <div class="row" style="justify-content:space-between"><div><div class="eyebrow">${fmtDate(d.at)}</div><div class="h3" style="margin-top:4px">${esc(d.title)}</div><div class="small muted" style="margin-top:4px">“${esc(short(d.q, 140))}”</div></div>
    <div class="seg">${Object.entries(HORIZONS).map(([k, h]) => `<button class="${k === labH ? 'on' : ''}" data-labh="${k}">${h.label}</button>`).join('')}</div></div>
    ${r.insufficient ? '' : `<div class="chartbox" style="margin-top:16px"><canvas id="labChart" aria-label="Projected outcome over time for each option"></canvas></div>`}
  </div>
  <div style="margin-top:18px">${decisionCard(d, false, labH)}</div>
  ${d.chosen != null ? `<div class="card pad" style="margin-top:18px"><div class="eyebrow">Outcome</div><p style="margin-top:8px">You chose <b>${esc(d.options[d.chosen].label)}</b> — it ${({ good:'went well', mixed:'had mixed results', bad:'went badly' })[d.outcome]}.${d.note ? ' “' + esc(d.note) + '”' : ''}</p></div>` : ''}`;
  fillBars(box); if (anim) reveal($$('.card, .dcard', box), { rotateX: 25, y: -30, transformOrigin: '50% 0%' });
  if (!r.insufficient) { drawLabChart(d, r); Brain.highlight(drivers(d, r), 4500); }
}
function drawLabChart(d, r) {
  const cv = $('#labChart'); if (!cv) return; if (labChart) { labChart.destroy(); labChart = null; }
  if (!window.Chart) { cv.parentElement.innerHTML = '<p class="small muted">Chart library unavailable offline.</p>'; return; }
  const H = HORIZONS[r.ctx.horizon], cols = ['#7cc6ff','#a78bfa','#34d399','#fbbf24'];
  const labels = [...Array(H.steps)].map((_, s) => { const day = Math.round(s / (H.steps - 1) * H.days); return H.days <= 7 ? `Day ${day}` : H.days <= 30 ? `Day ${day}` : `Wk ${Math.round(day / 7)}`; });
  const ds = [];
  r.rec.ev.rows.forEach((row, i) => {
    const c = cols[i % 4], lab = short(d.options[i].label, 26);
    ds.push({ label: lab + ' · 90th', data: row.sim.series.p90.map(v => +v.toFixed(1)), borderColor: 'transparent', backgroundColor: c + '22', pointRadius: 0, fill: '+1', tension: .35 });
    ds.push({ label: lab + ' · 10th', data: row.sim.series.p10.map(v => +v.toFixed(1)), borderColor: 'transparent', pointRadius: 0, fill: false, tension: .35 });
    ds.push({ label: lab, data: row.sim.series.mean.map(v => +v.toFixed(1)), borderColor: c, backgroundColor: c, borderWidth: i === r.rec.win ? 3 : 2, pointRadius: 0, pointHoverRadius: 5, tension: .35, fill: false });
  });
  labChart = new Chart(cv, { type: 'line', data: { labels, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: REDUCE ? 0 : 1100, easing: 'easeOutQuart' }, interaction: { mode: 'index', intersect: false },
    scales: { y: { min: 0, max: 100, grid: { color: 'rgba(96,156,255,.08)' }, ticks: { color: '#8ea5cc' }, title: { display: true, text: 'Projected outcome (0–100)', color: '#8ea5cc' } }, x: { grid: { display: false }, ticks: { color: '#8ea5cc', maxTicksLimit: 8 } } },
    plugins: { legend: { labels: { color: '#cfe0ff', usePointStyle: true, boxWidth: 8, filter: it => !/· (90th|10th)$/.test(it.text) } }, tooltip: { backgroundColor: 'rgba(6,16,44,.95)', borderColor: 'rgba(124,198,255,.4)', borderWidth: 1, filter: it => !/· (90th|10th)$/.test(it.dataset.label) } } } });
}
function openOutcome(id, from) {
  const d = T.decisions.find(x => x.id === id); if (!d) return;
  openModal(`<div class="eyebrow">Close the loop</div><div class="h3" style="margin:6px 0 14px">${esc(d.title)}</div>
    <p class="small muted" style="margin-bottom:8px">What did you choose?</p>
    <div class="sug" id="ocPick">${d.options.map((o, i) => `<button type="button" data-ocpick="${i}">${ic('arrow')}${esc(o.label)}</button>`).join('')}</div>
    <p class="small muted" style="margin:16px 0 8px">How did it go?</p>
    <div class="seg" id="ocRes"><button class="on" data-ocres="good">Went well</button><button data-ocres="mixed">Mixed</button><button data-ocres="bad">Went badly</button></div>
    <label class="field" style="margin-top:16px"><textarea id="ocNote" placeholder=" " maxlength="200"></textarea><span>What happened? (optional)</span></label>
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" data-act="closeModal">Cancel</button><button class="btn btn-primary" id="ocSave" disabled>Update my Twin</button></div>`, from);
  let pick = null, res = 'good';
  $$('[data-ocpick]').forEach(b => b.onclick = () => { pick = +b.dataset.ocpick; $$('[data-ocpick]').forEach(x => { x.style.borderColor = ''; x.style.background = ''; }); b.style.borderColor = 'rgba(124,198,255,.8)'; b.style.background = 'rgba(61,139,255,.2)'; $('#ocSave').disabled = false; });
  $$('[data-ocres]').forEach(b => b.onclick = () => { res = b.dataset.ocres; $$('[data-ocres]').forEach(x => x.classList.toggle('on', x === b)); });
  $('#ocSave').onclick = () => {
    const out = learn(d, pick, res, $('#ocNote').value.trim()); closeModal(); Brain.burst(); Brain.highlight(out.lines.map(l => l.k), 6000);
    toast(`Twin evolved — ${out.v}. ${out.hit ? 'It predicted your choice.' : 'You surprised it; it adjusted.'}`, 'good');
    refreshAll();
  };
}

/* =====================================================================
   INSIGHTS
   ===================================================================== */
function renderInsights(anim) {
  const f = fidelity(), closed = T.decisions.filter(d => d.chosen != null), hits = T.predictions.filter(p => p.hit).length;
  $('#insStats').innerHTML = `
    <div class="card pad stat"><div class="k">Twin fidelity</div><div class="v"><span data-count="${f.total}">0</span>%</div><div class="small muted">Confidence ${Math.round(f.conf)}% · coverage ${Math.round(f.cov)}% · knowledge ${Math.round(f.know)}%</div></div>
    <div class="card pad stat"><div class="k">Prediction accuracy</div><div class="v"><span data-count="${T.predictions.length ? Math.round(hits / T.predictions.length * 100) : 0}">0</span>%</div><div class="small muted">${hits} of ${T.predictions.length} choices predicted from your DNA</div></div>
    <div class="card pad stat"><div class="k">Decisions</div><div class="v"><span data-count="${T.decisions.length}">0</span></div><div class="small muted">${closed.length} closed · ${closed.filter(d => d.outcome === 'good').length} went well</div></div>`;
  $$('#insStats [data-count]').forEach(el => countTo(el, +el.dataset.count));
  $('#insDna').innerHTML = TRAITS.map(t => { const d = T.dna[t.k]; return `<div class="trait" data-trait="${t.k}" style="cursor:pointer" role="button" tabindex="0"><div class="top"><span><span class="rdot" style="color:${t.col}"></span>${t.n} <span class="small muted">· ${t.reg}</span></span><b>${d.v}</b></div><div class="bar"><i data-v="${d.v}"></i></div><div class="small muted" style="margin-top:4px">confidence ${d.c}% · ${d.h.length} data point${d.h.length === 1 ? '' : 's'}</div></div>`; }).join('');
  const bs = TRAITS.map(t => ({ t, seed: T.dna[t.k].seed, v: T.dna[t.k].v, gap: T.dna[t.k].v - T.dna[t.k].seed })).filter(x => Math.abs(x.gap) >= 6).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const said = T.memory.filter(m => /^(Always|Never|Usually|Rarely|Likes|Dislikes)/.test(m.text));
  $('#insBlind').innerHTML = (bs.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Trait</th><th>You said</th><th>You did</th><th>Gap</th></tr></thead><tbody>${bs.map(x => `<tr><td>${x.t.n}</td><td>${x.seed}</td><td>${x.v}</td><td class="${Math.abs(x.gap) >= 12 ? 'flip' : ''}">${x.gap > 0 ? '+' : ''}${x.gap}</td></tr>`).join('')}</tbody></table></div><p class="small muted" style="margin-top:10px">“Said” is what your onboarding answers implied. “Did” is where your real choices have moved it.</p>`
    : `<div class="empty">No blind spots yet. Log the outcome of a few decisions and your Twin will compare what you said with what you did.</div>`)
    + (said.length ? `<div class="eyebrow" style="margin-top:16px">Stated habits &amp; preferences</div>${said.slice(0, 5).map(m => `<div class="list-i"><span class="tag SAID">SAID</span>${esc(m.text)}</div>`).join('')}` : '');
  $('#memCount').textContent = `${T.memory.length} items`;
  $('#insMem').innerHTML = T.memory.length ? T.memory.map(m => `<div class="mem"><span class="tag ${m.type}">${m.type}</span><div class="grow"><div>${esc(m.text)}</div><div class="small muted">${ago(m.at)} · from ${esc(m.src)}${T.perms.memory || m.type === 'DID' ? '' : ' · <span class="xb">excluded by you</span>'}</div></div><button class="x" data-forget="${m.id}" aria-label="Forget this">✕</button></div>`).join('') : `<div class="empty">Tell your Twin about yourself in chat and it will appear here. You can delete anything.</div>`;
  $('#insLog').innerHTML = T.log.map(l => `<div class="list-i"><span class="badge ai" style="flex:none">${l.v}</span><div class="grow">${esc(l.msg)}<div class="small muted">${ago(l.at)}</div></div></div>`).join('');
  fillBars($('#p-insights')); if (anim) reveal($$('#p-insights .card'));
}
function openTrait(k, from) {
  const t = TRAITS.find(x => x.k === k), d = T.dna[k];
  openModal(`<div class="eyebrow">Decision DNA</div><div class="h2" style="margin:6px 0 4px">${t.n}</div><p class="muted" style="margin-bottom:16px">${t.d}. ${t.lo} ← → ${t.hi}.</p>
    <div class="grid2" style="gap:12px;margin-bottom:14px"><div class="card pad stat"><div class="k">Value</div><div class="v" id="tv">0</div><div class="bar"><i data-v="${d.v}"></i></div></div><div class="card pad stat"><div class="k">Confidence</div><div class="v" id="tc">0</div><div class="bar b"><i data-v="${d.c}"></i></div></div></div>
    <div class="eyebrow">How it changed</div>${d.h.length > 1 ? sparkline(d.h) : '<p class="small muted" style="margin:8px 0">One data point so far.</p>'}
    <div style="margin-top:8px">${[...d.h].reverse().slice(0, 8).map(h => `<div class="list-i"><b class="num" style="width:32px">${h.v}</b><div class="grow">${esc(h.why || '')}<div class="small muted">${ago(h.at)}</div></div></div>`).join('')}</div>
    ${T.perms.dna ? '' : '<p class="small" style="margin-top:12px;color:#fcd98a">Behavioral inference is switched off, so this trait is not used in recommendations right now.</p>'}`, from);
  countTo($('#tv'), d.v); countTo($('#tc'), d.c, { suffix: '%' });
}

/* =====================================================================
   SETTINGS
   ===================================================================== */
function renderSettings(anim) {
  const P = T.profile;
  $('#sName').value = P.name; $('#sRole').value = P.role; $('#sSector').value = P.sector; $('#sGoals').value = P.goals.join('\n'); $('#sTone').value = P.tone;
  setRange($('#sHours'), P.hours); setRange($('#sRisk'), P.risk);
  $('#sPerf').value = Brain.mode; perfNote();
  const gc = Gemini.cfg(), saved = Store.get('gemini', {}) || {};
  $('#gemKey').value = saved.key || ''; $('#gemKey').placeholder = ' ';
  $('#gemModel').value = gc.model; $('#gemFast').value = gc.fast; engineBadge();
  $('#permList').innerHTML = SOURCES.map(s => `<div class="perm"><div class="grow"><b>${s.n}</b><small>${s.d}</small></div><label class="switch"><input type="checkbox" data-perm="${s.k}" ${T.perms[s.k] ? 'checked' : ''} aria-label="${s.n}"><span></span></label></div>`).join('');
  if (anim) reveal($$('#p-settings .card'));
}
function perfNote() { const n = $('#perfNow'); if (n) n.textContent = Brain.ok ? `Currently rendering at ${['battery-saver','balanced','full'][Brain.quality]} density.` : '3D is unavailable on this device, so the app runs without it.'; }
function setRange(el, v) { el.value = v; el.style.setProperty('--p', ((v - el.min) / (el.max - el.min) * 100) + '%'); const lab = { sHours: $('#sHrsV'), sRisk: $('#sRiskV'), obHours: $('#hrsV'), obRisk: $('#riskV') }[el.id]; if (lab) lab.textContent = /Hours/.test(el.id) ? v + ' h' : riskLabel(+v); }
function saveProfile(e) {
  e.preventDefault();
  const P = T.profile, before = JSON.stringify(P);
  P.name = $('#sName').value.trim() || P.name; P.role = $('#sRole').value.trim(); P.sector = $('#sSector').value.trim();
  P.goals = $('#sGoals').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8);
  P.hours = +$('#sHours').value; P.risk = +$('#sRisk').value; P.tone = $('#sTone').value;
  if (JSON.stringify(P) === before) return toast('Nothing changed.');
  bump('Profile updated'); computeCache.clear(); saveTwin(); refreshAll(); toast(`Profile saved — Twin ${vstr()}`, 'good');
}

/* ---------- shared refresh ---------- */
function refreshAll() {
  if (!T) return;
  $('#vchip').textContent = (ACC.demo ? 'Demo · ' : 'Twin ') + vstr(); $('#vchip').classList.toggle('demo', !!ACC.demo);
  const init = (T.profile.name || ACC.name || '?').trim().charAt(0).toUpperCase();
  $('#avatarBtn').innerHTML = claudeUser && ACC.sso && claudeUser.avatarUrl ? `<img alt="" src="${esc(claudeUser.avatarUrl)}">` : esc(init);
  $('#menuName').textContent = T.profile.name || ACC.name; $('#menuMail').textContent = ACC.sso ? 'Signed in with Claude' : ACC.email;
  $('#memHint').textContent = `${T.memory.length} memories · ${T.profile.goals.length} goals in context`;
  if (!busy) setBusy(false);
  if (route === 'home') renderHome(false);
  if (route === 'lab') renderLab(false);
  if (route === 'insights') renderInsights(false);
  if (route === 'chat') { renderChatSugs(); }
}
</script>
