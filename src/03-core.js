<script>
'use strict';
/* =====================================================================
   DUOMIND v2 — CONFIG (edit freely)
   ===================================================================== */
const APP = { name: 'DuoMind', store: 'duomind.v2' };

const SECTORS = ['Technology','Healthcare','Finance & Banking','Education','Student','Startup / Founder','Creative & Media','Retail & E-commerce','Manufacturing','Legal','Government & Public','Hospitality','Real Estate','Agriculture','Research & Science','Freelance','Other'];

const GOAL_SUGGESTIONS = {
  'Technology':['Ship a side project people use','Move into a senior role','Learn system design deeply'],
  'Healthcare':['Reduce burnout on night shifts','Get a specialty certification','Move to a better hospital'],
  'Finance & Banking':['Clear the CFA level','Build an emergency fund','Move from ops to front office'],
  'Education':['Improve student outcomes','Publish a paper','Get a leadership role'],
  'Student':['Graduate with a strong GPA','Land a good internship','Build a portfolio'],
  'Startup / Founder':['Reach product-market fit','Raise a seed round','Hire the first 3 people'],
  'Creative & Media':['Grow my audience','Land bigger clients','Finish my own project'],
  'Retail & E-commerce':['Grow monthly revenue','Cut returns','Launch a new product line'],
  'Manufacturing':['Improve line efficiency','Cut downtime','Move into plant management'],
  'Legal':['Make partner','Specialise in a practice area','Win a key case'],
  'Government & Public':['Lead a flagship program','Pass the next promotion exam','Improve service delivery'],
  'Hospitality':['Open my own venue','Improve guest ratings','Reduce staff turnover'],
  'Real Estate':['Close more deals per quarter','Buy a first investment property','Build referral pipeline'],
  'Agriculture':['Improve crop yield','Adopt better irrigation','Find direct buyers'],
  'Research & Science':['Publish in a top venue','Win a grant','Finish my thesis'],
  'Freelance':['Raise my rates','Find steady retainer clients','Work fewer weekends'],
  'Other':['Get healthier','Save more each month','Learn a new skill']
};

const TRAITS = [
  { k:'risk',      n:'Risk Appetite',          d:'How much uncertainty you accept for upside', lo:'Cautious', hi:'Bold',       reg:'Limbic system',     col:'#fb7185' },
  { k:'speed',     n:'Decision Speed',         d:'Decide fast vs. deliberate first',           lo:'Deliberate', hi:'Fast',     reg:'Cerebellum',        col:'#fbbf24' },
  { k:'horizon',   n:'Long-term Orientation',  d:'Weighs future payoff over near-term wins',   lo:'Near-term', hi:'Long-term', reg:'Prefrontal cortex', col:'#e879f9' },
  { k:'social',    n:'People Weighting',       d:'How much others’ needs shape your choices',  lo:'Self-led', hi:'People-led', reg:'Temporal lobe',     col:'#c084fc' },
  { k:'structure', n:'Routine & Structure',    d:'Keeps plans and habits under pressure',      lo:'Flexible', hi:'Structured', reg:'Parietal lobe',     col:'#34d399' },
  { k:'evidence',  n:'Evidence Reliance',      d:'Leans on data over gut feel',                lo:'Gut', hi:'Data',            reg:'Occipital lobe',    col:'#a3e635' }
];

const QUIZ = [
  { q:'A promising opportunity appears, but it is uncertain. You…', a:[
    ['Take it — the upside matters', {risk:18, speed:8}], ['Test it small first', {risk:4, evidence:10}], ['Wait for more certainty', {risk:-14, speed:-10}] ] },
  { q:'A big decision is due Friday. Your process…', a:[
    ['Decide on day one, adjust later', {speed:16}], ['Research, then decide Thursday', {evidence:12, speed:-6}], ['Talk it through with people I trust', {social:14}] ] },
  { q:'A raise now, or a skill that pays off in two years?', a:[
    ['The raise', {horizon:-14}], ['The skill', {horizon:16}], ['Depends on my finances', {evidence:8}] ] },
  { q:'Deadline week. Your routines (sleep, exercise, family time)…', a:[
    ['Stay protected', {structure:16}], ['Bend a little', {structure:0}], ['Are the first to go', {structure:-16, speed:4}] ] },
  { q:'Your gut and the numbers disagree. You…', a:[
    ['Go with the numbers', {evidence:16}], ['Go with my gut', {evidence:-14, speed:6}], ['Look for a third option', {horizon:4, social:4}] ] }
];

const SOURCES = [
  { k:'profile', n:'Profile & role',     d:'Your sector, role and constraints' },
  { k:'goals',   n:'Goals',              d:'What you told your Twin you are working toward' },
  { k:'memory',  n:'Things you said',    d:'Preferences and facts learned from conversations' },
  { k:'history', n:'Past decisions',     d:'Decisions you logged and how they turned out' },
  { k:'dna',     n:'Behavioral inference', d:'Your Decision DNA traits' }
];

const HORIZONS = { '1w':{label:'1 week',steps:8,days:7,hf:.5}, '1m':{label:'1 month',steps:10,days:30,hf:1}, '6m':{label:'6 months',steps:13,days:180,hf:1.7} };

const DIMS = [
  { k:'impact',     n:'Impact' },
  { k:'alignment',  n:'Goal fit' },
  { k:'risk',       n:'Downside risk', inv:true },
  { k:'effort',     n:'Effort',        inv:true },
  { k:'reversible', n:'Reversibility' },
  { k:'speed',      n:'Speed to value' },
  { k:'fit',        n:'Behavioral fit' }
];

const ICON = {
  folder:'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  shield:'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z M8.5 12l2.5 2.5 4.5-5',
  bolt:'M13 2L4 14h7l-1 8 9-12h-7z',
  spark:'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  arrow:'M5 12h14M13 6l6 6-6 6',
  chat:'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  flag:'M4 21V4h12l-2 4 2 4H4',
  lock:'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4'
};
const ic = k => `<svg viewBox="0 0 24 24"><path d="${ICON[k]}"/></svg>`;

/* =====================================================================
   UTILITIES
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const short = (s, n = 42) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const uid = (p = 'x') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const now = () => Date.now();
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function pctl(arr, p) { const s = [...arr].sort((a, b) => a - b); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
function ago(t) { const s = (now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; if (s < 604800) return Math.floor(s / 86400) + 'd ago'; return new Date(t).toLocaleDateString('en-US', { month:'short', day:'numeric' }); }
function fmtDate(t) { return new Date(t).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
function words(s) { return String(s || '').toLowerCase().match(/[a-z0-9₹$€£%]+/g) || []; }
const STOP = new Set('a an the to of and or for in on at with my me i is it be am are was do does should would could can will this that these those than then from as by into about your you we our us get got have has had not no yes but so if just more most less very really also out up down over'.split(' '));
function keyTerms(s) { return words(s).filter(w => w.length > 2 && !STOP.has(w)); }
function overlap(a, b) { const A = new Set(keyTerms(a)); if (!A.size) return 0; let n = 0; for (const w of keyTerms(b)) if (A.has(w) || [...A].some(x => x.length > 4 && (w.startsWith(x.slice(0, 5)) || x.startsWith(w.slice(0, 5))))) n++; return n; }

/* GSAP safety shim so the app still works if the CDN is blocked */
if (!window.gsap) {
  const list = t => t == null ? [] : typeof t === 'string' ? $$(t) : (t.length !== undefined && !(t instanceof Element)) ? [...t] : [t];
  const apply = (t, v) => list(t).forEach(el => { if (el instanceof Element) { if ('opacity' in v) el.style.opacity = v.opacity; if (v.clearProps) { el.style.transform = ''; el.style.opacity = ''; } } else Object.keys(v).forEach(k => { if (!['duration','ease','onUpdate','onComplete','stagger','delay','clearProps'].includes(k)) el[k] = v[k]; }); });
  window.gsap = { set: apply, to(t, v) { apply(t, v); v.onUpdate && v.onUpdate(); v.onComplete && setTimeout(v.onComplete, 0); return { kill() {} }; }, fromTo(t, a, b) { return this.to(t, b); }, killTweensOf() {}, isTweening() { return false; }, timeline() { const tl = { to(t, v) { gsap.to(t, v); return tl; }, fromTo(t, a, b) { gsap.to(t, b); return tl; }, add() { return tl; } }; return tl; } };
}

/* =====================================================================
   STORAGE (device-local, per account)
   ===================================================================== */
const Store = {
  get(k, d = null) { try { const v = localStorage.getItem(APP.store + '.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(APP.store + '.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(APP.store + '.' + k); } catch (e) {} }
};
const MEMSESSION = {}; // fallback when storage is blocked

async function sha256(text) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h1 = hash(text), h2 = hash(text + '#'); return (h1.toString(16) + h2.toString(16)).padStart(16, '0'); }
}

/* =====================================================================
   AUTH
   ===================================================================== */
const Auth = {
  accounts() { return Store.get('accounts', MEMSESSION.accounts || {}); },
  save(a) { MEMSESSION.accounts = a; Store.set('accounts', a); },
  async signUp(name, email, pass) {
    email = email.trim().toLowerCase();
    const acc = this.accounts();
    if (acc[email]) throw { field: 'email', msg: 'An account with this email already exists on this device. Sign in instead.' };
    const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
    acc[email] = { id: 'u_' + (await sha256(email)).slice(0, 16), name: name.trim(), email, salt, hash: await sha256(salt + ':' + pass), createdAt: now() };
    this.save(acc);
    return acc[email];
  },
  async signIn(email, pass) {
    email = email.trim().toLowerCase();
    const a = this.accounts()[email];
    if (!a) throw { field: 'email', msg: 'No account for this email on this device. Create one instead.' };
    if (a.hash !== await sha256(a.salt + ':' + pass)) throw { field: 'pass', msg: 'That password doesn’t match. Try again or reset it.' };
    return a;
  },
  claude(me) {
    const email = 'claude:' + me.id;
    const acc = this.accounts();
    if (!acc[email]) { acc[email] = { id: 'c_' + hash(me.id).toString(36), name: me.name || 'Claude user', email, sso: true, createdAt: now() }; this.save(acc); }
    return acc[email];
  },
  remove(email) { const acc = this.accounts(); delete acc[email]; this.save(acc); },
  session() { return Store.get('session', MEMSESSION.session || null); },
  setSession(email, remember) { MEMSESSION.session = email; if (remember) Store.set('session', email); else Store.del('session'); },
  clear() { MEMSESSION.session = null; Store.del('session'); }
};
function strength(p) { let s = 0; if (p.length >= 8) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++; return p ? Math.max(1, s) : 0; }

/* =====================================================================
   STATE — one Twin per account
   ===================================================================== */
let ACC = null;   // signed-in account
let T = null;     // the Twin (all per-user data)

function blankTwin(acc) {
  const dna = {}; TRAITS.forEach(t => dna[t.k] = { v: 50, c: 20, seed: 50, h: [{ v: 50, at: now(), why: 'Starting point' }] });
  return {
    v: 2, createdAt: now(), onboarded: false,
    version: { major: 1, minor: 0 },
    profile: { name: acc.name || '', role: '', sector: '', goals: [], hours: 10, risk: 50, budget: '', tone: 'concise' },
    dna, memory: [], decisions: [], threads: [], activeThread: null,
    perms: { profile: true, goals: true, memory: true, history: true, dna: true },
    log: [{ at: now(), v: 'v1.0', msg: 'Twin created' }],
    predictions: []
  };
}
function loadTwin(acc) { const t = Store.get('twin.' + acc.id, MEMSESSION['twin.' + acc.id] || null); return t && t.v === 2 ? t : blankTwin(acc); }
let saveTimer = 0;
function saveTwin() { if (!ACC || !T) return; MEMSESSION['twin.' + ACC.id] = T; clearTimeout(saveTimer); saveTimer = setTimeout(() => Store.set('twin.' + ACC.id, T), 250); }
const vstr = () => `v${T.version.major}.${T.version.minor}`;
function bump(msg) { T.version.minor++; T.log.unshift({ at: now(), v: vstr(), msg }); if (T.log.length > 120) T.log.length = 120; saveTwin(); return vstr(); }
function dnaVal(k) { return T.dna[k].v; }
function dnaObj() { const o = {}; TRAITS.forEach(t => o[t.k] = T.dna[t.k].v); return o; }
function adjustTrait(k, dv, dc, why) {
  const t = T.dna[k]; if (!t || (!dv && !dc)) return null;
  const ov = t.v, oc = t.c;
  t.v = Math.round(clamp(t.v + dv, 2, 98)); t.c = Math.round(clamp(t.c + dc, 5, 97));
  t.h.push({ v: t.v, at: now(), why }); if (t.h.length > 40) t.h.splice(1, 1);
  return { k, n: TRAITS.find(x => x.k === k).n, ov, nv: t.v, oc, nc: t.c, why };
}
function addMemory(type, text, src = 'chat') {
  text = String(text || '').trim().replace(/\s+/g, ' ');
  if (text.length < 4) return null;
  const dup = T.memory.find(m => m.text.toLowerCase() === text.toLowerCase() || overlap(m.text, text) >= Math.max(3, keyTerms(text).length - 1));
  if (dup) { dup.at = now(); return null; }
  const m = { id: uid('m'), type, text: short(text, 180), at: now(), src };
  T.memory.unshift(m); if (T.memory.length > 150) T.memory.length = 150;
  return m;
}
function fidelity() {
  const conf = mean(TRAITS.map(t => T.dna[t.k].c));
  const pr = T.predictions; const acc = (pr.filter(p => p.hit).length + 1) / (pr.length + 2);
  const on = SOURCES.filter(s => T.perms[s.k]).length / SOURCES.length;
  const know = clamp((T.memory.length * 3 + T.profile.goals.length * 6 + T.decisions.length * 5), 0, 100);
  return { conf, acc: acc * 100, cov: on * 100, know, total: Math.round(conf * .35 + acc * 100 * .25 + on * 100 * .15 + know * .25) };
}
/* ---------- demo account: a realistic, pre-filled Twin ---------- */
const DEMO = { email: 'demo@duomind.app', name: 'Riya Sharma' };
function demoAccount() { const acc = Auth.accounts(); acc[DEMO.email] = { id: 'u_demo', name: DEMO.name, email: DEMO.email, demo: true, createdAt: now() }; Auth.save(acc); return acc[DEMO.email]; }
function seedDemo(acc) {
  const D = 86400000, t = now(), ago_ = d => t - d * D;
  T = blankTwin(acc); T.onboarded = true; T.createdAt = ago_(30);
  Object.assign(T.profile, { name: 'Riya Sharma', role: '3rd-year CS student & product intern', sector: 'Student',
    goals: ['Land a PPO from my product internship', 'Keep my CGPA above 8.5', 'Win a national hackathon this year', 'Hit the gym 4 times a week'],
    hours: 12, risk: 55, budget: '₹15,000 for courses this semester', tone: 'concise' });
  const plan = {
    risk:      [52, 68, [[19, 56, 'Joined a hackathon during exam season'], [11, 61, 'Took a paid gig on top of the internship']]],
    speed:     [58, 61, [[26, 62, 'Decided in minutes the night before a deadline'], [3, 66, 'Answered a recruiter within the hour']]],
    horizon:   [64, 64, [[19, 59, 'Chose a hackathon over exam prep'], [11, 55, 'Took quick cash over internship impact']]],
    social:    [48, 47, [[19, 52, 'Joined because teammates asked']]],
    structure: [70, 72, [[26, 62, 'Skipped the gym for an assignment'], [11, 54, 'Overloaded her evenings']]],
    evidence:  [60, 55, [[11, 58, 'Went against the Twin’s pick'], [3, 63, 'Asked for a simulation before replying to a recruiter']]]
  };
  Object.entries(plan).forEach(([k, [seed, c, steps]]) => { T.dna[k] = { v: steps[steps.length - 1][1], c, seed, h: [{ v: seed, at: ago_(30), why: 'From onboarding answers' }, ...steps.map(([d, v, why]) => ({ v, at: ago_(d), why }))] }; });
  T.memory = [];
  [['Budget constraint: ₹15,000 for courses this semester', 30, 'onboarding'], ['Works as 3rd-year CS student & product intern in Student', 30, 'onboarding'],
   ['Never skips gym, even in exam weeks', 27, 'chat'], ['Studies best early in the morning', 24, 'chat'], ['Dislikes group projects with unclear roles', 20, 'chat'],
   ['Prefers product roles over pure engineering', 15, 'chat']].forEach(([text, d, src]) => T.memory.unshift({ id: uid('m'), type: 'SAID', text, at: ago_(d), src }));
  const mk = (d, q, labels, closed) => {
    const dec = { id: uid('d'), at: ago_(d), q, title: short(labels.join(' vs '), 70), options: labels.map((label, i) => { const scores = scoreOption(label, q, i); return { label, scores, ...prosCons(label, scores) }; }), questions: [], horizon: '1m', source: 'local', chosen: null };
    if (closed) { const [ch, out, note] = closed; Object.assign(dec, { chosen: ch, outcome: out, note, decidedAt: ago_(d - 2) });
      T.memory.unshift({ id: uid('m'), type: 'DID', text: `Chose “${labels[ch]}” over “${labels[1 - ch]}” — ${({ good:'went well', mixed:'mixed result', bad:'went badly' })[out]} (${note})`, at: ago_(d - 2), src: 'outcome' }); }
    return dec;
  };
  const d1 = mk(26, 'DBMS assignment is due tomorrow morning and it is half done. Should I go to the gym as planned or finish the assignment tonight?', ['Go to the gym as planned', 'Finish the DBMS assignment tonight'], [1, 'good', 'submitted on time']);
  const d2 = mk(19, 'Should I join the Razorpay hackathon this weekend or prepare for mid-sems?', ['Join the Razorpay hackathon', 'Prepare for mid-sems'], [0, 'mixed', 'top 20 finish, mid-sem score dipped']);
  const d3 = mk(11, 'Should I take a paid freelance dashboard gig or keep my evenings for internship work?', ['Take the paid freelance dashboard gig', 'Keep evenings for internship work'], [0, 'bad', 'internship deliverable slipped two days']);
  const d4 = mk(3, 'The recruiter offered a PPO interview slot on Friday, the day after my DBMS exam. Should I accept Friday or ask to move it after exams?', ['Accept the Friday PPO interview slot', 'Ask to move the interview after exams']);
  const d5 = mk(1, 'For the GATEWAYS hackathon, should I build the prototype in React or use a no-code tool? The demo is in 10 days and I have about 12 hours a week.', ['Build the prototype in React', 'Use a no-code tool for the prototype']);
  T.decisions = [d5, d4, d3, d2, d1];
  T.predictions = [{ at: ago_(24), hit: true, dec: d1.id }, { at: ago_(17), hit: true, dec: d2.id }, { at: ago_(9), hit: false, dec: d3.id }];
  const convo = (d, title, pairs) => ({ id: uid('t'), title, at: ago_(d), messages: pairs.flatMap(([u, a, extra]) => [{ id: uid('m'), role: 'u', content: u, at: ago_(d) }, Object.assign({ id: uid('m'), role: 'a', content: a, at: ago_(d) + 4000, engine: 'local' }, extra || {})]) });
  const reply = dec => localReply(dec.q, { intent: 'decision', questions: [] }, dec, []);
  T.threads = [
    convo(1, 'Hackathon prototype: React or no-code?', [[d5.q, '', { decId: d5.id }]]),
    convo(3, 'PPO interview timing', [[d4.q, '', { decId: d4.id }]]),
    convo(27, 'Gym habit', [['I never skip gym, even in exam weeks.', 'Got it — I’ll remember that you never skip the gym, even in exam weeks. That matters whenever a decision squeezes your evenings, so I’ll weigh it in.', { learned: ['Never skips gym, even in exam weeks'] }]])
  ];
  T.threads[0].messages[1].content = reply(d5); T.threads[1].messages[1].content = reply(d4);
  T.activeThread = T.threads[0].id;
  T.version = { major: 1, minor: 6 };
  T.log = [
    { at: ago_(3), v: 'v1.6', msg: 'Learned from chat: Decision Speed 62→66; Evidence Reliance 58→63' },
    { at: ago_(9), v: 'v1.5', msg: 'Learned from “Freelance gig vs internship”: Risk Appetite 56→61, Routine & Structure 62→54' },
    { at: ago_(17), v: 'v1.4', msg: 'Learned from “Hackathon vs mid-sems”: Risk Appetite 52→56, Long-term Orientation 64→59' },
    { at: ago_(24), v: 'v1.3', msg: 'Learned from “Gym vs DBMS assignment”: Routine & Structure 70→62' },
    { at: ago_(27), v: 'v1.2', msg: 'Learned from chat: Never skips gym, even in exam weeks' },
    { at: ago_(30), v: 'v1.1', msg: 'Twin built from onboarding — 4 goals, DNA seeded' },
    { at: ago_(30), v: 'v1.0', msg: 'Twin created' }];
  saveTwin();
  return T;
}
function topTrait() { return TRAITS.map(t => ({ t, d: Math.abs(T.dna[t.k].v - 50), v: T.dna[t.k].v })).sort((a, b) => b.d - a.d)[0]; }
function traitWord(k) { const t = TRAITS.find(x => x.k === k), v = T.dna[k].v; return v >= 60 ? t.hi : v <= 40 ? t.lo : 'Balanced'; }
</script>
