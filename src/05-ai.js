<script>
/* =====================================================================
   AI ENGINE — Claude via the page's `sample` capability, with fallback
   ===================================================================== */
/* ---------- Gemini provider (used in the downloaded version) ---------- */
const Gemini = {
  cfg() {
    const c = window.DUOMIND_CONFIG || {}, s = Store.get('gemini', {}) || {};
    const proxy = /^https?:$/.test(location.protocol) ? String(c.GEMINI_PROXY || '').trim() : '';
    return { key: String(s.key || c.GEMINI_API_KEY || '').trim(), model: String(s.model || c.GEMINI_MODEL || 'gemini-3.8-flash').trim(), fast: String(s.fast || c.GEMINI_FAST_MODEL || 'gemini-3.5-flash-lite').trim(), fromFile: !s.key && !!c.GEMINI_API_KEY, proxy };
  },
  key() { const c = this.cfg(); return c.key || (c.proxy ? 'proxy' : ''); },
  viaProxy() { const c = this.cfg(); return !c.key && !!c.proxy; },
  async call(model, body, signal, stream) {
    const c = this.cfg(), viaProxy = this.viaProxy();
    const url = viaProxy ? c.proxy : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${encodeURIComponent(c.key)}`;
    const payload = viaProxy ? { model, stream: !!stream, body } : body;
    let res;
    try { res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal }); }
    catch (e) { if (e && e.name === 'AbortError') throw { code: 'cancelled' }; throw { code: 'network', message: 'Could not reach the Gemini API. Check your internet connection.' }; }
    if (!res.ok) {
      let msg = ''; try { const j = await res.json(); msg = (j.error && j.error.message) || ''; } catch (e) {}
      const code = res.status === 401 || res.status === 403 || (res.status === 400 && /api key|API_KEY/i.test(msg)) ? 'bad_key' : res.status === 404 ? 'bad_model' : res.status === 429 ? 'rate_limited' : 'upstream_error';
      if (viaProxy && code === 'bad_key') throw { code, message: msg || 'The DuoMind server could not use its Gemini key.' };
      throw { code, message: msg || `Gemini API error ${res.status}` };
    }
    return res;
  },
  textOf(j) { const c = j && j.candidates && j.candidates[0]; return c && c.content && c.content.parts ? c.content.parts.filter(p => !p.thought).map(p => p.text || '').join('') : ''; },
  async json(prompt, signal) {
    const res = await this.call(this.cfg().fast, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: .3 } }, signal);
    const t = this.textOf(await res.json());
    try { return JSON.parse(t.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()); }
    catch (e) { const m = t.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e2) {} } throw { code: 'invalid_json', message: 'Gemini returned malformed JSON.' }; }
  },
  async stream(system, turns, signal, onText) {
    const body = { systemInstruction: { parts: [{ text: system }] }, contents: turns.map(t => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })), generationConfig: { temperature: .7 } };
    const res = await this.call(this.cfg().model, body, signal, true);
    const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '', text = '';
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue; const data = line.slice(5).trim(); if (!data || data === '[DONE]') continue;
          try { const d = this.textOf(JSON.parse(data)); if (d) { text += d; onText({ text, delta: d }); } } catch (e) {}
        }
      }
    } catch (e) { if (e && e.name === 'AbortError') throw { code: 'cancelled', text }; throw { code: 'upstream_error', message: 'The answer stream was interrupted.', text }; }
    if (!text.trim()) throw { code: 'empty_completion', message: 'Gemini returned no text.' };
    return text;
  },
  async test() { const res = await this.call(this.cfg().fast, { contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }] }); return this.textOf(await res.json()); }
};

/* ---------- engine selection: Claude (inside Claude) → Gemini (with a key) → offline ---------- */
const AI = {
  sample: null, provider: null, state: 'checking', err: '', // state: checking | on | off | declined | error
  async init() {
    let claudeOk = false;
    try { if (window.claude && typeof window.claude.use === 'function') { const s = await window.claude.use('sample'); if (s) { this.sample = s; claudeOk = true; } } } catch (e) {}
    if (claudeOk) { this.provider = 'claude'; this.state = 'on'; } else this.refresh(true);
    engineBadge();
  },
  refresh(silent) {
    if (this.provider === 'claude' && this.state === 'on') return;
    if (Gemini.key()) { this.provider = 'gemini'; this.state = 'on'; this.err = ''; } else { this.provider = null; this.state = this.state === 'declined' ? 'declined' : 'off'; }
    if (!silent) engineBadge();
  },
  fail(e) {
    const c = e && e.code;
    if (['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(c)) { this.state = 'declined'; this.provider = null; this.refresh(); }
    else if (this.provider === 'gemini' && (c === 'bad_key' || c === 'bad_model')) { this.state = 'error'; this.err = c === 'bad_key' ? (Gemini.viaProxy() ? 'The server’s Gemini key is missing or invalid.' : 'Gemini rejected the API key.') : `Gemini model not found (${Gemini.cfg().model} / ${Gemini.cfg().fast}).`; engineBadge(); toast(this.err + ' Using the offline engine — fix it in Settings.', 'warn'); }
    else if (this.provider === 'gemini' && c === 'rate_limited') toast('Gemini rate limit reached. This answer used the offline engine.', 'warn');
    else if (this.provider === 'gemini' && c === 'network') toast('Couldn’t reach Gemini. This answer used the offline engine.', 'warn');
  },
  json(prompt, signal) { return this.provider === 'claude' ? this.sample.json(prompt, { modelTier: 'quick', signal, cache: false }) : Gemini.json(prompt, signal); }
};
AI.ready = AI.init();
function offlineNote() {
  if (AI.state === 'on') return '';
  if (AI.state === 'error') return '\n\n_' + AI.err + ' I’m using the built-in offline engine until it’s fixed in Settings._';
  return AI.state === 'declined' ? '\n\n_AI access is off for this page, so I’m using the built-in offline engine._' : '\n\n_Using the built-in offline engine. Add a Gemini API key in Settings → AI engine for full AI answers._';
}
function engineBadge() {
  const b = $('#engineBadge'), st = $('#aiStatus');
  let cls = 'badge local', txt = 'OFFLINE ENGINE', line = 'Offline engine — add a Gemini API key to turn on full AI answers.';
  if (AI.state === 'on') { cls = 'badge ai'; txt = AI.provider === 'claude' ? 'AI · CLAUDE' : 'AI · GEMINI'; line = AI.provider === 'claude' ? 'Running on Claude inside the Claude app.' : `Running on Gemini (${Gemini.cfg().model}; analysis on ${Gemini.cfg().fast})${Gemini.viaProxy() ? ' · through this site’s server, so the key is never sent to your browser' : Gemini.cfg().fromFile ? ' · key from config.js' : ' · key saved in this browser'}.`; }
  else if (AI.state === 'checking') { txt = 'CONNECTING…'; line = 'Connecting…'; }
  else if (AI.state === 'error') { txt = 'AI KEY ERROR'; line = AI.err; }
  if (b) { b.className = cls; b.textContent = txt; }
  if (st) st.textContent = line;
}

function profileBrief(q) {
  const P = T.profile, L = [];
  L.push(`Name: ${P.name || ACC.name || 'unknown'}`);
  if (T.perms.profile) { L.push(`Role: ${P.role || 'not given'}; Sector: ${P.sector || 'not given'}`); L.push(`Time available for new commitments: ~${P.hours} h/week; Risk comfort: ${riskLabel(P.risk)} (${P.risk}/100)${P.budget ? '; Budget: ' + P.budget : ''}`); }
  if (T.perms.goals && P.goals.length) L.push('Goals (most important first):\n' + P.goals.map((g, i) => `${i + 1}. ${g}`).join('\n'));
  if (T.perms.dna) L.push('Decision DNA: ' + TRAITS.map(t => `${t.n} ${T.dna[t.k].v}/100 (${traitWord(t.k)})`).join('; '));
  if (T.perms.memory) {
    const mem = T.memory.map(m => ({ m, o: overlap(m.text, q || '') })).sort((a, b) => b.o - a.o || b.m.at - a.m.at).slice(0, 12);
    if (mem.length) L.push('Things they told you or did:\n' + mem.map(x => `- [${x.m.type}] ${x.m.text}`).join('\n'));
  }
  if (T.perms.history) { const d = T.decisions.filter(x => x.chosen != null).slice(0, 4); if (d.length) L.push('Past decisions:\n' + d.map(x => `- ${x.title}: chose "${x.options[x.chosen].label}", ${x.outcome}`).join('\n')); }
  return L.join('\n');
}
function recentTurns(th, n = 6) { return th.messages.filter(m => m.content && !m.pending).slice(-n).map(m => ({ role: m.role === 'u' ? 'user' : 'assistant', content: short(m.content.replace(/_Using the built-in[^_]*_/g, ''), 1200) })); }

async function aiAnalyze(text, th, signal) {
  const hist = recentTurns(th, 4).map(t => `${t.role === 'user' ? 'User' : 'Twin'}: ${t.content}`).join('\n');
  const prompt = `You are the analysis step of DuoMind, a personal decision assistant. Read the user's latest message in context and reply with ONLY one JSON object of this shape:
{"intent":"decision"|"chat","title":string,"options":[{"label":string,"scores":{"impact":int,"alignment":int,"risk":int,"effort":int,"reversible":int,"speed":int},"pros":[string],"cons":[string]}],"questions":[string],"memory":[{"kind":"fact"|"preference"|"goal"|"constraint"|"habit","text":string}],"goals":[string],"dna":[{"trait":"risk"|"speed"|"horizon"|"social"|"structure"|"evidence","delta":int,"why":string}],"profile":{"role":string|null,"sector":string|null,"hours":number|null,"budget":string|null}}
Rules:
- "decision" only when the user is weighing 2-4 concrete options, or whether to do one thing (then add "Keep things as they are" as the second option). Otherwise "chat" with options [].
- Score every option 0-100 FOR THIS USER: impact = size of the upside; alignment = fit with their goals and role; risk = how bad the downside is (higher is more dangerous); effort = time and energy relative to their available hours; reversible = how easy it is to undo; speed = how soon it pays off. Different users should get different scores for the same option.
- title: under 60 characters. pros/cons: 1-3 short phrases each, specific to this user. questions: 0-2 clarifying questions that would most change the answer.
- memory: only durable facts the USER stated about themselves in the latest message, written in third person ("Works night shifts"). Never invent. Empty if none.
- goals: only goals the user explicitly stated in the latest message. dna: only if the message clearly reveals their decision style; delta between -4 and 4.
- profile: fill a field only if the latest message states it, else null.

About the user:
${profileBrief(text)}
${hist ? '\nRecent conversation:\n' + hist : ''}

Latest user message:
"""${short(text, 2500)}"""`;
  return await AI.json(prompt, signal);
}
function cleanAnalysis(a, text) {
  const out = { intent: 'chat', title: '', options: [], questions: [], facts: { memory: [], goals: [], dna: [], hours: null, budget: null, role: null, sector: null } };
  if (!a || typeof a !== 'object') return null;
  const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? Math.round(clamp(v, 1, 99)) : d; };
  if (a.intent === 'decision' && Array.isArray(a.options) && a.options.length >= 2) {
    out.intent = 'decision'; out.title = short(String(a.title || '').trim() || text, 70);
    out.options = a.options.slice(0, 4).map((o, i) => {
      const label = short(String((o && o.label) || `Option ${i + 1}`), 90), s = (o && o.scores) || {}, loc = scoreOption(label, text, i);
      const scores = {}; ['impact','alignment','risk','effort','reversible','speed'].forEach(k => scores[k] = num(s[k], loc[k]));
      const pc = prosCons(label, scores);
      return { label, scores, pros: (Array.isArray(o.pros) ? o.pros : pc.pros).slice(0, 3).map(x => short(String(x), 70)), cons: (Array.isArray(o.cons) ? o.cons : pc.cons).slice(0, 3).map(x => short(String(x), 70)) };
    });
  }
  out.questions = (Array.isArray(a.questions) ? a.questions : []).slice(0, 2).map(x => short(String(x), 140));
  out.facts.memory = (Array.isArray(a.memory) ? a.memory : []).slice(0, 5).filter(m => m && m.text).map(m => ({ kind: String(m.kind || 'fact'), text: short(String(m.text), 160) }));
  out.facts.goals = (Array.isArray(a.goals) ? a.goals : []).slice(0, 3).map(g => short(String(g), 90)).filter(g => g.length > 3);
  out.facts.dna = (Array.isArray(a.dna) ? a.dna : []).filter(d => d && TRAITS.some(t => t.k === d.trait)).slice(0, 3).map(d => ({ trait: d.trait, delta: Math.round(clamp(Number(d.delta) || 0, -4, 4)), why: short(String(d.why || 'From conversation'), 90) }));
  const p = a.profile || {};
  if (p.role) out.facts.role = short(String(p.role), 60);
  if (p.sector) out.facts.sector = short(String(p.sector), 50);
  if (Number.isFinite(Number(p.hours)) && p.hours !== null) out.facts.hours = clamp(Math.round(Number(p.hours)), 1, 80);
  if (p.budget) out.facts.budget = short(String(p.budget), 40);
  return out;
}
function decisionBrief(dec) {
  const r = compute(dec);
  if (r.insufficient) return `DECISION RESULT: insufficient evidence — only ${r.active} usable items about the user (need 3). Some data sources may be switched off. Ask for what's missing; do not recommend.`;
  const rows = r.rec.ev.rows, W = r.rec.win;
  return `DECISION RESULT (computed by DuoMind's simulator; explain it, do not change it):
Recommended: "${dec.options[W].label}" — confidence ${r.rec.conf}%, ${r.rec.robust ? 'ROBUST' : 'FRAGILE'} (winner flipped in ${Math.round(r.rec.flip * 100)}% of 300 noisy re-runs).
${dec.options.map((o, i) => `- "${o.label}": score ${rows[i].total.toFixed(1)}; goal fit ${rows[i].v.alignment}, impact ${rows[i].v.impact}, downside risk ${rows[i].v.risk}, effort ${rows[i].v.effort}, reversibility ${rows[i].v.reversible}, speed ${rows[i].v.speed}, behavioral fit ${rows[i].v.fit}; ${HORIZONS[r.ctx.horizon].label} outcome ${Math.round(rows[i].sim.mean)} (10th-90th ${Math.round(rows[i].sim.p10)}-${Math.round(rows[i].sim.p90)}); pros: ${o.pros.join(', ') || '-'}; cons: ${o.cons.join(', ') || '-'}`).join('\n')}
Behavior forecast (what they will probably pick, from their DNA): "${dec.options[r.rec.predicted].label}".
Top lever: ${r.levers[0] ? r.levers[0].label + (r.levers[0].flips ? ' (flips the pick)' : '') : 'none'}.`;
}
async function aiReply(text, th, dec, learned, signal, onText) {
  const P = T.profile, tone = { concise:'concise and direct', detailed:'thorough, with your reasoning', coach:'warm and encouraging, like a good coach' }[P.tone] || 'concise';
  const rules = `You are DuoMind, ${firstName() || 'the user'}'s personal Decision Twin: an AI that knows their goals, constraints and decision style, and helps them think and decide. Tone: ${tone}.
Write ${P.tone === 'detailed' ? '120-260' : '60-170'} words in plain Markdown (bold, short bullet lists; no headings, tables, code or JSON). Speak directly to them. Use their goals, constraints and memories when relevant; never invent facts about them. If a DECISION RESULT is given, explain that recommendation — never change the pick or the numbers — and cover confidence, robust/fragile, the key trade-off, one lever that would change it, and, if the behavior forecast differs from the pick, say so kindly. If you learned something new about them, acknowledge it briefly. End with one short question only when it would help.

About them:
${profileBrief(text)}`;
  let last = text;
  if (dec) last += '\n\n' + decisionBrief(dec);
  if (learned.length) last += '\n\n(New things you just remembered about them: ' + learned.join('; ') + ')';
  const merge = arr => { const m = []; arr.forEach(t => { if (m.length && m[m.length - 1].role === t.role) m[m.length - 1].content += '\n\n' + t.content; else m.push({ ...t }); }); if (m[m.length - 1].role !== 'user') m.push({ role: 'user', content: text }); return m; };
  const hist = recentTurns(th, 6).slice(0, -1);
  if (AI.provider === 'gemini') { const conv = merge([...hist, { role: 'user', content: last }]); while (conv.length && conv[0].role !== 'user') conv.shift(); return await Gemini.stream(rules, conv, signal, onText); }
  return (await AI.sample(merge([{ role: 'user', content: rules }, ...hist, { role: 'user', content: last }]), { signal, cache: false, onText })).text;
}

/* =====================================================================
   CHAT CONTROLLER
   ===================================================================== */
let busy = null; // { ctl, msg }
function thread() { let th = T.threads.find(t => t.id === T.activeThread); if (!th) { th = { id: uid('t'), title: 'New conversation', at: now(), messages: [] }; T.threads.unshift(th); T.activeThread = th.id; } return th; }
function applyFacts(f, text) {
  const learned = [];
  (f.memory || []).forEach(m => { const mm = addMemory(m.kind === 'goal' ? 'SAID' : 'SAID', m.text, 'chat'); if (mm) learned.push(mm.text); });
  (f.goals || []).forEach(g => { const same = x => { const a = x.toLowerCase(), b = g.toLowerCase(); return a.includes(b) || b.includes(a) || overlap(x, g) >= Math.max(3, Math.min(keyTerms(x).length, keyTerms(g).length)); }; if (T.profile.goals.length < 8 && !T.profile.goals.some(same)) { T.profile.goals.push(g); learned.push('New goal: ' + g); } });
  if (f.hours && f.hours !== T.profile.hours) { T.profile.hours = f.hours; learned.push(`Has about ${f.hours} h/week`); }
  if (f.budget && f.budget !== T.profile.budget) { T.profile.budget = f.budget; learned.push(`Budget: ${f.budget}`); }
  if (f.role && !T.profile.role) { T.profile.role = f.role; learned.push(`Role: ${f.role}`); }
  if (f.sector && !T.profile.sector) T.profile.sector = f.sector;
  const dl = []; (f.dna || []).forEach(d => { const l = adjustTrait(d.trait, d.delta, 2, d.why); if (l && l.ov !== l.nv) dl.push(l); });
  if (learned.length || dl.length) { bump(`Learned from chat: ${[...learned, ...dl.map(l => `${l.n} ${l.ov}→${l.nv}`)].map(x => short(x, 50)).join('; ')}`); computeCache.clear(); }
  return { learned, dl };
}
function mergeFacts(a, b) { return { memory: [...(a.memory || []), ...(b.memory || []).filter(m => !(a.memory || []).some(x => overlap(x.text, m.text) >= 2))], goals: [...(a.goals || []), ...(b.goals || [])].filter((g, i, arr) => !arr.slice(0, i).some(x => x.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(x.toLowerCase()))), dna: (a.dna && a.dna.length) ? a.dna : (b.dna || []), hours: a.hours || b.hours, budget: a.budget || b.budget, role: a.role || b.role, sector: a.sector || b.sector }; }

async function send(text) {
  text = (text || '').trim(); if (!text || busy) return;
  const th = thread();
  if (!th.messages.length) th.title = short(text, 44);
  th.at = now();
  th.messages.push({ id: uid('m'), role: 'u', content: text, at: now() });
  const msg = { id: uid('m'), role: 'a', content: '', at: now(), pending: true, steps: [['Understanding your message', 'run']] };
  th.messages.push(msg);
  const ctl = new AbortController(); busy = { ctl, msg };
  renderThreads(); renderMsgs(); setBusy(true); Brain.think(true);
  if (AI.state === 'checking') await Promise.race([AI.ready, new Promise(r => setTimeout(r, 4000))]);
  let an = null, engine = 'local'; const prov = () => AI.provider || 'ai';
  try {
    if (AI.state === 'on') { try { an = cleanAnalysis(await aiAnalyze(text, th, ctl.signal), text); engine = prov(); } catch (e) { if (e && e.code === 'cancelled') throw e; AI.fail(e); an = null; } }
    const loc = localAnalyze(text);
    if (!an) an = loc; else an.facts = mergeFacts(an.facts, loc.facts);
    if (an.intent === 'chat' && loc.intent === 'decision' && engine === 'ai') { /* trust the AI's reading */ }
    const { learned, dl } = applyFacts(an.facts, text);
    msg.learned = learned.concat(dl.map(l => `${l.n} ${l.ov}→${l.nv}`));
    msg.steps[0][1] = 'ok';
    let dec = null;
    if (an.intent === 'decision' && an.options && an.options.length >= 2) {
      msg.steps.push(['Simulating 1,000 futures for your options', 'run']); renderMsg(msg);
      dec = { id: uid('d'), at: now(), q: text, title: an.title || short(text, 60), options: an.options, questions: an.questions || [], horizon: '1m', source: engine, thread: th.id, chosen: null };
      T.decisions.unshift(dec); if (T.decisions.length > 80) T.decisions.length = 80;
      await new Promise(r => setTimeout(r, REDUCE ? 50 : 650));
      compute(dec);
      msg.decId = dec.id; msg.steps[msg.steps.length - 1][1] = 'ok';
    }
    msg.steps.push(['Writing', 'run']); renderMsg(msg);
    let reply = null;
    if (AI.state === 'on') {
      try { reply = await aiReply(text, th, dec, learned, ctl.signal, ({ text: t }) => { msg.content = t; msg.pending = false; msg.streaming = true; renderMsg(msg, true); }); engine = prov(); }
      catch (e) { if (e && e.code === 'cancelled') { msg.content = e.text || msg.content; throw e; } AI.fail(e); if (e && e.text) reply = e.text + '\n\n_(Answer interrupted.)_'; }
    }
    if (!reply) { engine = 'local'; reply = localReply(text, an, dec, learned); await typeOut(msg, reply, ctl.signal); }
    msg.content = reply; msg.engine = engine;
  } catch (e) {
    if (!(e && e.code === 'cancelled')) { msg.content = msg.content || 'Something went wrong on my side. Try that again.'; }
    else msg.content = (msg.content || '') + (msg.content ? '\n\n' : '') + '_Stopped._';
  }
  msg.pending = false; msg.streaming = false; delete msg.steps; busy = null;
  saveTwin(); setBusy(false); Brain.think(false);
  renderMsg(msg); renderThreads(); refreshAll();
  if (msg.decId) { const d = T.decisions.find(x => x.id === msg.decId); if (d) Brain.highlight(drivers(d, compute(d)), 5000); }
  if (msg.learned && msg.learned.length) toast(`Twin updated — ${vstr()} · remembered ${msg.learned.length} thing${msg.learned.length > 1 ? 's' : ''}`, 'good');
}
function typeOut(msg, full, signal) {
  return new Promise(res => {
    if (REDUCE) { msg.content = full; msg.pending = false; renderMsg(msg, true); return res(); }
    let i = 0; msg.pending = false; msg.streaming = true;
    const step = () => { if (signal.aborted) return res(); i = Math.min(full.length, i + Math.max(3, Math.round(full.length / 90))); msg.content = full.slice(0, i); renderMsg(msg, true); if (i < full.length) setTimeout(step, 16); else res(); };
    step();
  });
}
function setBusy(on) {
  const b = $('#sendBtn'); b.classList.toggle('stop', on); b.setAttribute('aria-label', on ? 'Stop' : 'Send');
  $('#chatStatus').textContent = on ? 'Thinking…' : (T ? `Knows ${T.memory.length} things about you · ${T.decisions.length} decisions` : 'Ready');
}

/* ---------- rendering ---------- */
function md(s) {
  const lines = esc(s).split('\n'); let html = '', inList = false, para = [];
  const inline = x => x.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1<em>$2</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const flush = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };
  lines.forEach(l => {
    const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (li) { flush(); if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(li[1])}</li>`; }
    else if (!l.trim()) { flush(); if (inList) { html += '</ul>'; inList = false; } }
    else { if (inList) { html += '</ul>'; inList = false; } para.push(l.replace(/^#+\s*/, '')); }
  });
  flush(); if (inList) html += '</ul>';
  return html;
}
const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';
function msgHTML(m) {
  if (m.role === 'u') return `<div class="msg u" data-id="${m.id}"><div class="bubble">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`;
  let body = '';
  if (m.pending && m.steps) body = `<div class="steps-live">${m.steps.map(([t, s]) => `<div>${s === 'ok' ? `<span class="ok">${CHECK}</span>` : '<span class="sp"></span>'}${esc(t)}${s === 'run' && t === 'Writing' ? ' <span class="typing"><i></i><i></i><i></i></span>' : ''}</div>`).join('')}</div>`;
  else body = md(m.content || '');
  const dec = m.decId ? T.decisions.find(d => d.id === m.decId) : null;
  const card = dec && !m.pending ? decisionCard(dec, true) : '';
  const learned = !m.pending && m.learned && m.learned.length ? `<div class="meta">${m.learned.slice(0, 4).map(l => `<span class="tag SAID">REMEMBERED</span> ${esc(short(l, 60))}`).join(' ')}</div>` : '';
  const meta = !m.pending && !m.streaming ? `<div class="meta"><span>${ago(m.at)}</span>${m.engine ? `<span class="badge ${m.engine === 'local' ? 'local' : 'ai'}" style="padding:2px 6px;font-size:9.5px">${m.engine === 'local' ? 'OFFLINE' : m.engine === 'ai' ? 'CLAUDE' : m.engine.toUpperCase()}</span>` : ''}</div>` : '';
  return `<div class="msg a" data-id="${m.id}"><div class="av">DM</div><div class="grow"><div class="bubble">${body}${card}</div>${learned}${meta}</div></div>`;
}
function renderMsgs() {
  const box = $('#msgs'), th = T.threads.find(t => t.id === T.activeThread);
  if (!th || !th.messages.length) {
    box.innerHTML = `<div class="empty" style="margin:auto;max-width:520px;border:0"><div class="h3" style="color:var(--ink);margin-bottom:6px">Hi ${esc(firstName())} — what’s on your mind?</div>Describe a decision (“Should I … or …?”), or tell me something about yourself. I’ll remember it and use it next time.</div>`;
  } else box.innerHTML = th.messages.map(msgHTML).join('');
  $('#chatTitle').textContent = th && th.messages.length ? th.title : 'Ask your Twin';
  fillBars(box); box.scrollTop = box.scrollHeight;
}
function renderMsg(m, stream) {
  const el = $(`#msgs [data-id="${m.id}"]`);
  if (!el) return renderMsgs();
  if (stream) { const b = el.querySelector('.bubble'); const card = b.querySelector('.dcard'); b.innerHTML = md(m.content); if (card) b.appendChild(card); }
  else { el.outerHTML = msgHTML(m); fillBars($('#msgs')); }
  const box = $('#msgs'); if (box.scrollHeight - box.scrollTop - box.clientHeight < 240) box.scrollTop = box.scrollHeight;
}
function renderThreads() {
  const list = $('#threadList');
  list.innerHTML = T.threads.length ? T.threads.sort((a, b) => b.at - a.at).map(t => `<button class="thread ${t.id === T.activeThread ? 'on' : ''}" data-thread="${t.id}">${ic('chat')}<span>${esc(t.title)}</span></button>`).join('') : '<div class="small muted" style="padding:8px">No conversations yet.</div>';
}
function chatSuggestions() {
  const g = T.profile.goals, role = T.profile.role || 'my work', out = [];
  if (g[0]) out.push(`What’s the one thing I should do this week for “${short(g[0], 40)}”?`);
  if (g[1]) out.push(`Should I focus on “${short(g[0], 28)}” or “${short(g[1], 28)}” this month?`);
  out.push(`Should I take on a new side project or protect my ${T.profile.hours} free hours?`);
  out.push('What do you know about how I decide?');
  if (T.decisions.some(d => d.chosen == null)) out.push('Remind me which decisions I haven’t closed out');
  out.push(`I'm a ${role} and I always …`);
  return out.slice(0, 5);
}
function renderChatSugs() { $('#chatSugs').innerHTML = chatSuggestions().map(s => `<button class="chip" data-suggest="${esc(s)}">${ic('spark')}${esc(s)}</button>`).join(''); }

/* ---------- decision card ---------- */
function ringHTML(v) { return `<div class="ring"><svg viewBox="0 0 64 64"><circle class="rb" cx="32" cy="32" r="28"/><circle class="rf" data-v="${v}" cx="32" cy="32" r="28"/></svg><b>${v}%</b></div>`; }
function evHTML(items) { return items.map(e => `<div class="evi ${e.x ? 'x' : ''}"><span class="tag ${e.tag}">${e.tag}</span><div><div class="t">${esc(e.text)}${e.x ? `<span class="xb">${e.x}</span>` : ''}</div><div class="m">${({ profile:'Profile', goals:'Goals', memory:'Conversation memory', history:'Decision history', dna:'Decision DNA', simulation:'Monte Carlo simulation' })[e.src]}${e.at ? ' · ' + ago(e.at) : ''} · confidence ${Math.round(e.conf)}%</div></div></div>`).join(''); }
function decisionCard(dec, inChat, horizon) {
  const r = compute(dec, horizon);
  if (r.insufficient) return `<div class="dcard"><div class="insuff"><b>Insufficient evidence.</b> I only have ${r.active} usable piece${r.active === 1 ? '' : 's'} of evidence about you for this (I need 3). Add goals or switch sources back on in Settings.</div><details class="ev"><summary>What I could and couldn’t use</summary>${evHTML(r.evidence)}</details></div>`;
  const rows = r.rec.ev.rows, W = r.rec.win, H = HORIZONS[r.ctx.horizon];
  const opts = dec.options.map((o, i) => {
    const v = rows[i].v, s = rows[i].sim;
    return `<div class="opt ${i === W ? 'win' : ''}"><div class="ol"><span>${esc(o.label)}</span>${i === W ? '<em>PICK</em>' : ''}</div>
      ${DIMS.map(d => `<div class="sc"><span>${d.n}</span><div class="bar ${d.inv ? 'warn' : ''}"><i data-v="${v[d.k]}"></i></div><b>${v[d.k]}</b></div>`).join('')}
      <div class="small muted" style="margin-top:8px">${H.label} outcome <b style="color:var(--ink)">${Math.round(s.mean)}</b> · range ${Math.round(s.p10)}–${Math.round(s.p90)}</div>
      <div class="rng"><span class="band" style="left:${s.p10}%;width:${Math.max(2, s.p90 - s.p10)}%"></span><span class="mk" style="left:${s.mean}%"></span></div>
      ${o.pros.length || o.cons.length ? `<div class="small" style="margin-top:8px;line-height:1.5">${o.pros.map(p => `<div style="color:#86efc6">+ ${esc(p)}</div>`).join('')}${o.cons.map(c => `<div style="color:#fda4b4">− ${esc(c)}</div>`).join('')}</div>` : ''}</div>`;
  }).join('');
  const lv = r.levers.slice(0, inChat ? 2 : 3).map((l, i) => `<div class="lev"><span class="k">${i + 1}</span><div>${esc(l.label)} — ${l.flips ? `<span class="flip">flips to “${esc(short(dec.options[l.to].label, 32))}”</span>` : `<span class="narrow">gap ${l.gap0.toFixed(1)} → ${Math.max(0, l.gap).toFixed(1)}</span>`}</div></div>`).join('');
  const closed = dec.chosen != null;
  return `<div class="dcard">
    <div class="dhead"><div><div class="eyebrow">Decision · ${H.label}</div><div class="h3" style="margin-top:4px">${esc(dec.title)}</div></div>
      <div class="row"><span class="badge ${r.rec.robust ? 'robust' : 'fragile'}">${r.rec.robust ? 'ROBUST' : 'FRAGILE'}</span><span class="badge ${dec.source === 'local' ? 'local' : 'ai'}">${dec.source === 'local' ? 'OFFLINE' : 'AI-SCORED'}</span></div></div>
    <div class="opts">${opts}</div>
    <div class="recbox">${ringHTML(r.rec.conf)}<div class="grow"><div class="small muted">Twin recommends</div><div style="font-weight:600;font-size:15px">${esc(dec.options[W].label)}</div>
      <div class="small muted" style="margin-top:3px">Flipped in ${Math.round(r.rec.flip * 100)}% of 300 noisy re-runs · behavior forecast: ${esc(short(dec.options[r.rec.predicted].label, 40))}</div></div></div>
    <div style="margin-top:12px"><div class="eyebrow" style="font-size:10px">What would change the answer</div>${lv}</div>
    ${(() => { const dv = drivers(dec, r); return dv.length ? `<div class="drivers">Shaped most by ${dv.map(k => { const tt = TRAITS.find(x => x.k === k); return `<button class="drv" data-hl="${k}" title="Light up the ${tt.reg}"><span class="rdot" style="color:${tt.col}"></span>${tt.n} · ${T.dna[k].v}</button>`; }).join('')}</div>` : ''; })()}
    <details class="ev"><summary>Why does my Twin think this? · ${r.evidence.filter(e => !e.x).length} evidence items</summary>${evHTML(r.evidence)}</details>
    <div class="row" style="margin-top:12px">${inChat ? `<button class="btn btn-sm" data-openlab="${dec.id}">Open in Lab</button>` : ''}
      ${closed ? `<span class="small muted">You chose “${esc(short(dec.options[dec.chosen].label, 40))}” · ${({ good:'went well', mixed:'mixed', bad:'went badly' })[dec.outcome]}</span>` : `<button class="btn btn-sm btn-primary" data-outcome="${dec.id}">Log what I chose</button>`}</div>
    <p class="disclaim">${ic('shield')}<span>Guidance to help you think it through — not professional medical, legal or financial advice.</span></p>
  </div>`;
}
</script>
