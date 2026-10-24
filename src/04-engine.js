<script>
/* =====================================================================
   LOCAL LANGUAGE ENGINE — facts, decisions, option features
   (used offline, and as a safety net around the AI engine)
   ===================================================================== */
const LEX = {
  riskUp:['quit','resign','leave','invest','investing','loan','borrow','crypto','stock','stocks','launch','startup','all-in','all in','relocate','move abroad','abroad','bet','gamble','mortgage','drop out','switch career','career switch','fundraise','raise money','full-time on','full time on','bootstrap','new city','buy a house','buy a flat','leverage','margin','options trading','risky'],
  riskDown:['stay','keep','save','safe','stable','wait','part-time','part time','trial','pilot','test','small','rent','continue','stick','current','status quo','insurance','emergency fund','steady','secure','guaranteed','fixed deposit'],
  effortUp:['build','learn','study','master','degree','mba','phd','masters','course','certification','certificate','train','training','rewrite','write','create','launch','hire','renovate','move','marathon','exam','prepare','thesis','side project','start','startup','bootcamp','overtime','second job','all-nighter'],
  effortDown:['rest','sleep','skip','pause','delegate','outsource','buy','use existing','keep','stay','break','vacation','holiday','relax','decline','say no'],
  impactUp:['promotion','career','raise','salary','launch','degree','health','family','relationship','growth','revenue','clients','skill','invest','grant','publish','win','offer','job','business','startup','funding','mba','masters','certification','partner','customers','users','income'],
  fast:['now','today','tonight','immediately','quick','quickly','this week','freelance','sell','offer','bonus','cash','sprint','deadline','short-term','this month','tomorrow'],
  slow:['degree','phd','mba','masters','invest','investing','save','saving','learn','certification','long-term','long term','build','years','year','career','thesis','compound','habit','health'],
  irreversible:['quit','resign','sign','buy','marry','move','relocate','drop out','sell','commit','mortgage','contract','accept','tattoo','divorce','close','shut down','fire'],
  reversible:['try','trial','pilot','test','rent','part-time','part time','freelance','temporary','experiment','side','weekend','evening','pause','sample','prototype'],
  social:['team','family','friends','friend','partner','wife','husband','kids','children','parents','mom','dad','cofounder','co-founder','client','clients','colleagues','manager','boss','mentor','community','students','patients','customers','wedding'],
  statusQuo:['keep','stay','stick','current','continue','status quo','don’t','don\'t','do nothing','not','no change','as they are','as is','wait']
};
function lexCount(text, list) { const t = ' ' + text.toLowerCase() + ' '; let n = 0; for (const w of list) if (t.includes(w.includes(' ') ? w : ' ' + w) || t.includes(w + ' ') ) n++; return n; }
function moneyIn(text) { return /[₹$€£]\s?\d|\b\d+(\.\d+)?\s?(k|lakh|lakhs|lac|cr|crore|m|million|bn|billion)\b/i.test(text); }
function yearsIn(text) { const m = text.match(/(\d+)\s*(years?|yrs?)/i); return m ? +m[1] : 0; }

/* Facts the user states about themselves */
function extractFacts(text) {
  const out = { memory: [], goals: [], hours: null, budget: null, role: null, dna: [] };
  const s = ' ' + text.replace(/\s+/g, ' ') + ' ';
  const grab = (re, fn) => { let m; const r = new RegExp(re.source, 'gi'); while ((m = r.exec(s))) fn(m); };
  const clean = x => x.trim().replace(/^(to |that )/i, '').replace(/[,;:]+$/, '');
  grab(/\bi(?:'m| am) (?:a|an) ([a-z][^.,!?;]{2,50}?)(?= and | but | who | with | so |[.,!?;]| ?$)/, m => { const v = clean(m[1]); if (!/\b(bit|little|lot|kind)\b/i.test(v)) { out.memory.push({ kind:'fact', text:`Is ${/^[aeiou]/i.test(v) ? 'an' : 'a'} ${v}` }); if (!out.role && v.split(' ').length <= 5) out.role = v; } });
  grab(/\bi work (as|at|in|for) ([^.,!?;]{3,60})/, m => out.memory.push({ kind:'fact', text:`Works ${m[1].toLowerCase()} ${clean(m[2])}` }));
  grab(/\b(?:my (?:main |big |top )?goal is|i want to|i(?:'m| am) trying to|i hope to|i plan to|i need to) ([^.!?;]{4,90})/, m => { const g = clean(m[1].split(/\s+(?:and|but|because|so|while)\s+(?:i|my|we|it|i'm)\b|,/i)[0]); if (g.split(' ').length >= 2) out.goals.push(g.charAt(0).toUpperCase() + g.slice(1)); });
  grab(/\bi (?:really )?(?:prefer|like|love|enjoy|value) ([^.!?;]{3,80})/, m => out.memory.push({ kind:'preference', text:`Likes ${clean(m[1])}` }));
  grab(/\bi (?:hate|dislike|don't like|do not like|can't stand|avoid) ([^.!?;]{3,80})/, m => out.memory.push({ kind:'preference', text:`Dislikes ${clean(m[1])}` }));
  grab(/\bi (always|never|usually|rarely|often) ([^.!?;]{3,80})/, m => {
    const v = clean(m[2]); out.memory.push({ kind:'habit', text:`${m[1].charAt(0).toUpperCase() + m[1].slice(1)} ${v}` });
    const l = v.toLowerCase();
    if (/(gym|workout|sleep|routine|schedule|plan)/.test(l)) out.dna.push({ trait:'structure', delta: /never|rarely/i.test(m[1]) && /skip|miss/.test(l) ? 3 : /never|rarely/i.test(m[1]) ? -2 : 2, why:`Said they ${m[1]} ${v}` });
    if (/(decide|jump|rush)/.test(l)) out.dna.push({ trait:'speed', delta: /always|usually|often/i.test(m[1]) ? 3 : -2, why:`Said they ${m[1]} ${v}` });
    if (/(research|data|numbers|analy)/.test(l)) out.dna.push({ trait:'evidence', delta: /always|usually|often/i.test(m[1]) ? 3 : -2, why:`Said they ${m[1]} ${v}` });
  });
  let m = s.match(/(\d{1,2})\s*(?:hours|hrs|h)\s*(?:a|per|\/)\s*week/i); if (m) out.hours = clamp(+m[1], 1, 80);
  m = s.match(/budget (?:is |of |around |about )?([₹$€£]?\s?[\d,.]+\s*(?:k|lakh|lakhs|cr|crore|m|million)?)/i); if (m) out.budget = m[1].trim();
  m = s.match(/\bi have (\d+|a|two|three) (kids?|children|daughters?|sons?)/i); if (m) out.memory.push({ kind:'fact', text:`Has ${m[1]} ${m[2]}` });
  if (/\b(all in|bold|risky|high risk|take the leap)\b/i.test(s)) out.dna.push({ trait:'risk', delta: 2, why:'Uses bold, risk-seeking language' });
  if (/\b(play it safe|cautious|careful|risk-averse|risk averse|scared)\b/i.test(s)) out.dna.push({ trait:'risk', delta: -2, why:'Uses cautious language' });
  return out;
}

/* Decision detection + option parsing */
function tidyOpt(s) {
  s = s.trim().replace(/^(and |or |either |whether to |whether |to |i should |should i |do i |i'm thinking (of|about) |i am thinking (of|about) |thinking (of|about) )/i, '').replace(/[?.!]+$/, '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function parseDecision(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  let m = t.match(/(?:torn|choose|choosing|deciding|decide|pick|picking)\s+between\s+(.+?)\s+and\s+(.+?)(?:[?.!]|$)/i);
  if (m) return [tidyOpt(m[1]), tidyOpt(m[2])];
  const listed = t.match(/(?:^|\s)(?:\(?[1-4a-d][).:]\s*)([^()]+?)(?=\s+\(?[1-4a-d][).:]\s|$)/gi);
  if (listed && listed.length >= 2) return listed.slice(0, 4).map(x => tidyOpt(x.replace(/^\s*\(?[1-4a-d][).:]\s*/i, '')));
  const sent = (t.match(/[^.!?]*(?:\bor\b|\bvs\.?\b|\bversus\b|\binstead of\b)[^.!?]*[?.!]?/i) || [])[0];
  if (sent) {
    const core = sent.replace(/^.*?\b(should i|shall i|do i|would it be better to|is it better to|whether to|should we)\b/i, '');
    const parts = core.split(/\s+(?:or|vs\.?|versus|instead of)\s+/i).map(tidyOpt).filter(p => p && p.split(' ').length <= 18);
    if (parts.length >= 2) return parts.slice(0, 4);
  }
  m = t.match(/\b(?:should i|shall i|is it worth|would it be smart to|do i)\s+([^?.!]{3,90})/i);
  if (m) { const a = tidyOpt(m[1]); return [a, 'Hold off and keep things as they are']; }
  return null;
}
function looksLikeDecision(text) { return /\b(should i|shall i|should we|or|vs\.?|versus|whether|which (one|option|should)|choose|choosing|decide|deciding|torn between|worth it|pick between)\b/i.test(text) && !!parseDecision(text); }

/* Score an option 0-100 on six raw dimensions from its words + the user's profile */
function scoreOption(label, question, idx) {
  const t = (label + ' ').toLowerCase(), full = question.toLowerCase();
  const j = k => ((hash(label + '|' + k) % 1000) / 1000 - .5) * 10;
  const sq = lexCount(t, LEX.statusQuo) > 0 && lexCount(t, LEX.riskUp) === 0;
  let risk = 42 + lexCount(t, LEX.riskUp) * 14 - lexCount(t, LEX.riskDown) * 10 + (moneyIn(t) ? 8 : 0) + lexCount(t, LEX.irreversible) * 6;
  let effort = 45 + lexCount(t, LEX.effortUp) * 11 - lexCount(t, LEX.effortDown) * 12 + Math.min(20, yearsIn(t) * 6);
  let impact = 48 + lexCount(t, LEX.impactUp) * 9 + (moneyIn(t) ? 6 : 0) + Math.min(10, yearsIn(t) * 3);
  let speed = 50 + lexCount(t, LEX.fast) * 12 - lexCount(t, LEX.slow) * 9 - yearsIn(t) * 5;
  let reversible = 55 + lexCount(t, LEX.reversible) * 12 - lexCount(t, LEX.irreversible) * 14;
  if (sq) { risk = 22; effort = 22; impact = 34; speed = 62; reversible = 88; }
  // Goal alignment from the user's own goals, role and sector
  let alignment = 38;
  const goals = T.perms.goals ? T.profile.goals : [];
  const PROTECT = /\b(reduce|less|fewer|avoid|stop|cut|quit|lower|minimi[sz]e|protect|never|limit|burnout|burn out|dislikes?|hate)\b/i;
  const MORE = /\b(extra|more|additional|take on|overtime|another|increase|add|double)\b/i, LESS = /\b(fewer|less|drop|stop|skip|reduce|cut|decline|say no|rest|protect)\b/i;
  const polarity = (src, o) => PROTECT.test(src) ? (MORE.test(label) ? -1 : LESS.test(label) ? 1 : .35) : 1;
  goals.forEach((g, gi) => { const o = overlap(g, label); if (o) alignment += Math.min(26, o * 13) * (gi === 0 ? 1.15 : 1) * polarity(g, o); });
  if (goals.some(g => /\bburn ?out|stress|rest|sleep|balance|health/i.test(g)) && effort > 60) alignment -= 8;
  if (T.perms.profile) alignment += Math.min(10, overlap(T.profile.role + ' ' + T.profile.sector, label) * 5);
  if (T.perms.memory) T.memory.slice(0, 40).forEach(mm => { const o = overlap(mm.text, label); if (o) alignment += 5 * o * polarity(mm.text, o); });
  if (sq) alignment = Math.min(alignment, 46);
  const pf = T.perms.profile ? T.profile : { hours: 12, risk: 50 };
  if (effort > 60 && pf.hours < 8) alignment -= 6;
  return { impact: Math.round(clamp(impact + j('i'), 5, 97)), alignment: Math.round(clamp(alignment + j('a'), 5, 97)), risk: Math.round(clamp(risk + j('r'), 3, 97)),
    effort: Math.round(clamp(effort + j('e'), 3, 97)), reversible: Math.round(clamp(reversible + j('v'), 3, 97)), speed: Math.round(clamp(speed + j('s'), 3, 97)) };
}
function prosCons(label, sc) {
  const g = (T.perms.goals && T.profile.goals.length) ? T.profile.goals.map(x => ({ x, o: overlap(x, label) })).sort((a, b) => b.o - a.o)[0] : null;
  const pros = [], cons = [];
  if (sc.impact >= 62) pros.push('Big upside if it works');
  if (sc.alignment >= 60) pros.push(g && g.o ? `Moves “${short(g.x, 38)}” forward` : 'Fits what you said you want');
  if (sc.speed >= 62) pros.push('Pays off quickly');
  if (sc.reversible >= 65) pros.push('Easy to undo if it’s wrong');
  if (sc.risk <= 30) pros.push('Low downside');
  if (sc.effort <= 32) pros.push('Light lift on your time');
  if (sc.risk >= 62) cons.push('Real downside if it goes wrong');
  if (sc.effort >= 62) cons.push(T.perms.profile ? `Needs more than your ${T.profile.hours} h/week` : 'Heavy time commitment');
  if (sc.reversible <= 35) cons.push('Hard to undo');
  if (sc.speed <= 38) cons.push('Slow payoff');
  if (sc.alignment <= 40) cons.push('Weak link to your goals');
  if (sc.impact <= 38) cons.push('Limited upside');
  return { pros: pros.slice(0, 3), cons: cons.slice(0, 3) };
}
function localAnalyze(text) {
  const facts = extractFacts(text);
  const opts = looksLikeDecision(text) ? parseDecision(text) : null;
  if (!opts) return { intent:'chat', facts };
  const options = opts.map((label, i) => { const scores = scoreOption(label, text, i); return { label, scores, ...prosCons(label, scores) }; });
  const title = short(opts.length === 2 ? `${opts[0]} vs ${opts[1]}` : opts.join(' / '), 70);
  const q = [];
  if (!T.profile.goals.length) q.push('What goal matters most in this decision?');
  if (!moneyIn(text) && /(invest|buy|loan|quit|resign)/i.test(text)) q.push('How many months of expenses could you cover if this went badly?');
  if (!/(week|month|year|deadline|by )/i.test(text)) q.push('When do you need to decide by?');
  return { intent:'decision', title, options, questions: q.slice(0, 2), facts };
}

/* =====================================================================
   DECISION MATH — behavioral fit, weights, Monte Carlo, robustness, levers
   ===================================================================== */
function traitsFor(ctx) { const o = {}; TRAITS.forEach(t => o[t.k] = ctx.perms.dna ? ctx.dna[t.k] : 50); return o; }
function fitOf(sc, label, tr) {
  let f = 50;
  f += ((tr.risk - 50) / 50) * ((sc.risk - 50) / 50) * 26;
  f += ((tr.speed - 50) / 50) * ((sc.speed - 50) / 50) * 16;
  f += ((tr.horizon - 50) / 50) * ((sc.impact - sc.speed) / 60) * 18;
  f += ((tr.structure - 50) / 50) * ((sc.reversible - sc.effort) / 60) * 14;
  f += ((tr.social - 50) / 50) * (lexCount(label, LEX.social) ? 12 : -3);
  return Math.round(clamp(f, 3, 97));
}
function weightsFor(ctx, tr) {
  const riskComfort = ctx.perms.profile ? (ctx.profile.risk * .5 + tr.risk * .5) : tr.risk;
  const w = { impact:.18, alignment:.22, risk:.15, effort:.10, reversible:.10, speed:.10, fit:.15 };
  w.risk += (50 - riskComfort) / 260; w.impact += (tr.horizon - 50) / 420; w.speed += (50 - tr.horizon) / 420;
  w.reversible += (tr.structure - 50) / 500;
  if (ctx.perms.profile) w.effort += clamp((12 - ctx.profile.hours) / 160, -.05, .08);
  if (!ctx.perms.goals) w.alignment *= .4;
  Object.keys(w).forEach(k => w[k] = Math.max(.02, w[k]));
  const s = Object.values(w).reduce((a, b) => a + b, 0); Object.keys(w).forEach(k => w[k] /= s);
  return w;
}
const totalOf = (v, w) => DIMS.reduce((t, d) => t + w[d.k] * (d.inv ? 100 - v[d.k] : v[d.k]), 0);
function simulateOpt(v, horizon, tr, ctx, seed, runs = 500) {
  const H = HORIZONS[horizon], r = rng(seed), riskComfort = ctx.perms.profile ? ctx.profile.risk * .5 + tr.risk * .5 : tr.risk;
  const tau = 5 + (100 - v.speed) * 1.6, steps = H.steps, per = Array.from({ length: steps }, () => []), O = [];
  let succ = 0;
  for (let i = 0; i < runs; i++) {
    const p = clamp(.22 + .42 * v.alignment / 100 + .22 * (100 - v.effort) / 100 + (tr.structure - 50) / 500 + gauss(r) * .08, .03, .97);
    const ok = r() < p; if (ok) succ++;
    const V = v.impact * (.45 + .55 * v.alignment / 100) * (ok ? 1 : .3);
    const shock = r() < v.risk / 200 ? v.risk * .55 * (1 - v.reversible / 190) : 0;
    const pen = .5 + (100 - riskComfort) / 100;
    const noise = gauss(r) * (5 + v.risk * .1);
    for (let s = 0; s < steps; s++) {
      const day = (s / (steps - 1)) * H.days, real = 1 - Math.exp(-day / tau);
      per[s].push(clamp(30 + V * .62 * real - shock * pen * Math.min(1, day / 10 + .2) + noise * real));
    }
    O.push(per[steps - 1][i]);
  }
  return { mean: mean(O), p10: pctl(O, .1), p90: pctl(O, .9), success: succ / runs * 100,
    series: { mean: per.map(a => mean(a)), p10: per.map(a => pctl(a, .1)), p90: per.map(a => pctl(a, .9)) } };
}
function currentCtx(extra = {}) { return Object.assign({ perms: { ...T.perms }, profile: { ...T.profile }, dna: dnaObj(), horizon: '1m' }, extra); }
function evaluate(dec, ctx) {
  const tr = traitsFor(ctx), w = weightsFor(ctx, tr);
  const rows = dec.options.map((o, i) => {
    const v = { ...o.scores, fit: fitOf(o.scores, o.label, tr) };
    const sim = simulateOpt(v, ctx.horizon, tr, ctx, hash(dec.id + '|' + i + '|' + ctx.horizon));
    v.outcome = Math.round(sim.mean);
    const total = totalOf(v, w) * .8 + sim.mean * .2;
    return { v, sim, total };
  });
  return { rows, w, tr };
}
function recommend(dec, ctx) {
  const ev = evaluate(dec, ctx);
  const order = ev.rows.map((r, i) => i).sort((a, b) => ev.rows[b].total - ev.rows[a].total);
  const win = order[0], second = order[1], margin = ev.rows[win].total - ev.rows[second].total;
  const spread = mean(ev.rows.map(r => r.sim.p90 - r.sim.p10));
  const r = rng(hash(dec.id + 'robust')); let flips = 0; const N = 300;
  for (let n = 0; n < N; n++) {
    const jw = {}; Object.keys(ev.w).forEach(k => jw[k] = ev.w[k] * (1 + (r() * 2 - 1) * .15));
    let best = -1, bi = 0;
    ev.rows.forEach((row, i) => { const jv = {}; Object.keys(row.v).forEach(k => jv[k] = clamp(row.v[k] * (1 + (r() * 2 - 1) * .15))); const t = totalOf(jv, jw) * .8 + row.sim.mean * .2; if (t > best) { best = t; bi = i; } });
    if (bi !== win) flips++;
  }
  const flip = flips / N;
  const conf = Math.round(clamp(52 + margin * 2.6 - (spread - 25) * .3 - flip * 30, 51, 96));
  const predicted = ev.rows.map((x, i) => i).sort((a, b) => ev.rows[b].v.fit - ev.rows[a].v.fit)[0];
  return { ev, win, conf, flip, robust: flip <= .3, margin, predicted };
}
function levers(dec, ctx, base) {
  const W = base.win, L = base.ev.rows.map((r, i) => i).filter(i => i !== W).sort((a, b) => base.ev.rows[b].total - base.ev.rows[a].total)[0];
  const lo = dec.options[L], wo = dec.options[W], gap0 = base.ev.rows[W].total - base.ev.rows[L].total;
  const cands = [
    { label:`If “${short(lo.label, 30)}” carried less downside (risk −20)`, mod: d => { d.options[L].scores.risk = clamp(d.options[L].scores.risk - 20); } },
    { label:`If “${short(lo.label, 30)}” clearly served your top goal (+20 fit)`, mod: d => { d.options[L].scores.alignment = clamp(d.options[L].scores.alignment + 20); } },
    { label:`If “${short(wo.label, 30)}” took twice the effort`, mod: d => { d.options[W].scores.effort = clamp(d.options[W].scores.effort + 25); } },
    { label:'If you were 20 points more comfortable with risk', ctx: c => { c.profile.risk = clamp(c.profile.risk + 20); c.dna.risk = clamp(c.dna.risk + 20); } },
    { label:'If you had double the hours each week', ctx: c => { c.profile.hours = Math.min(80, c.profile.hours * 2); } }
  ];
  Object.keys(HORIZONS).filter(h => h !== ctx.horizon).forEach(h => cands.push({ label:`Judged over ${HORIZONS[h].label} instead`, ctx: c => { c.horizon = h; } }));
  const res = cands.map(cd => {
    const d2 = JSON.parse(JSON.stringify(dec)), c2 = JSON.parse(JSON.stringify(ctx));
    if (cd.mod) cd.mod(d2); if (cd.ctx) cd.ctx(c2);
    const ev = evaluate(d2, c2), best = ev.rows.map((r, i) => i).sort((a, b) => ev.rows[b].total - ev.rows[a].total)[0];
    return { label: cd.label, flips: best !== W, to: best, gap: ev.rows[W].total - ev.rows[L].total, gap0 };
  });
  res.sort((a, b) => (b.flips - a.flips) || (a.gap - b.gap));
  return res.slice(0, 3);
}

/* Evidence — tagged SAID / DID / INFERRED / PREDICTED, honouring permissions */
function evidenceFor(q, ctx, rec, dec) {
  const items = [], off = k => ctx.perms[k] ? null : 'excluded by you';
  if (T.profile.role || T.profile.sector) items.push({ tag:'SAID', src:'profile', text:`Works as ${T.profile.role || 'a professional'}${T.profile.sector ? ' in ' + T.profile.sector : ''}`, conf:90, x: off('profile') });
  items.push({ tag:'SAID', src:'profile', text:`Has about ${T.profile.hours} h/week and ${riskLabel(T.profile.risk).toLowerCase()} risk comfort`, conf:85, x: off('profile') });
  T.profile.goals.map(g => ({ g, o: overlap(g, q) })).sort((a, b) => b.o - a.o).slice(0, 3).forEach(({ g }) => items.push({ tag:'SAID', src:'goals', text:`Goal: ${g}`, conf:92, x: off('goals') }));
  T.memory.filter(m => m.type === 'SAID').map(m => ({ m, o: overlap(m.text, q) })).filter(x => x.o > 0).sort((a, b) => b.o - a.o).slice(0, 4)
    .forEach(({ m }) => items.push({ tag:'SAID', src:'memory', text: m.text, conf:80, at: m.at, x: off('memory') }));
  T.decisions.filter(d => d.chosen != null && d.id !== (dec && dec.id)).map(d => ({ d, o: overlap(d.q, q) + 1 })).sort((a, b) => b.o - a.o || b.d.at - a.d.at).slice(0, 3)
    .forEach(({ d }) => items.push({ tag:'DID', src:'history', text:`Chose “${short(d.options[d.chosen].label, 40)}” → ${({ good:'went well', mixed:'mixed', bad:'went badly' })[d.outcome]}`, conf:95, at: d.at, x: off('history') }));
  TRAITS.map(t => ({ t, d: Math.abs(T.dna[t.k].v - 50) })).sort((a, b) => b.d - a.d).slice(0, 3)
    .forEach(({ t }) => items.push({ tag:'INFERRED', src:'dna', text:`${t.n}: ${T.dna[t.k].v}/100 (${traitWord(t.k).toLowerCase()})`, conf: T.dna[t.k].c, x: off('dna') }));
  const active = items.filter(i => !i.x).length;
  if (rec && dec) rec.ev.rows.forEach((r, i) => items.push({ tag:'PREDICTED', src:'simulation', text:`“${short(dec.options[i].label, 40)}” succeeds in ${Math.round(r.sim.success)}% of 500 runs; ${HORIZONS[ctx.horizon].label} outcome ${Math.round(r.sim.mean)} (${Math.round(r.sim.p10)}–${Math.round(r.sim.p90)})`, conf: Math.round(100 - (r.sim.p90 - r.sim.p10)) }));
  return { items, active };
}
function riskLabel(v) { return v < 25 ? 'Very cautious' : v < 45 ? 'Cautious' : v <= 55 ? 'Balanced' : v <= 75 ? 'Bold' : 'Very bold'; }

const computeCache = new Map();
function compute(dec, horizon) {
  const ctx = currentCtx({ horizon: horizon || dec.horizon || '1m' });
  const key = dec.id + '|' + ctx.horizon + '|' + JSON.stringify(ctx.perms) + '|' + JSON.stringify(ctx.dna) + '|' + ctx.profile.risk + '|' + ctx.profile.hours + '|' + ctx.profile.goals.join('~') + '|' + T.decisions.length + '|' + T.memory.length;
  if (computeCache.has(key)) return computeCache.get(key);
  const pre = evidenceFor(dec.q, ctx, null, dec);
  let out;
  if (pre.active < 3) out = { insufficient: true, evidence: pre.items, active: pre.active, ctx };
  else { const rec = recommend(dec, ctx); out = { rec, levers: levers(dec, ctx, rec), evidence: evidenceFor(dec.q, ctx, rec, dec).items, active: pre.active, ctx }; }
  if (computeCache.size > 60) computeCache.clear();
  computeCache.set(key, out); return out;
}

/* Which Decision DNA traits most shaped this recommendation (drives the brain highlight) */
const TRAIT_DIMS = { risk:['risk'], speed:['speed'], horizon:['impact','speed'], social:[], structure:['reversible','effort'], evidence:[] };
function drivers(dec, res) {
  if (!res || res.insufficient || !res.ctx.perms.dna) return [];
  const rows = res.rec.ev.rows, W = res.rec.win, tr = res.rec.ev.tr;
  const L = rows.map((r, i) => i).filter(i => i !== W).sort((a, b) => rows[b].total - rows[a].total)[0];
  return TRAITS.map(t => {
    let diff = TRAIT_DIMS[t.k].reduce((s, d) => s + Math.abs(rows[W].v[d] - rows[L].v[d]), 0) / 100;
    if (t.k === 'social') diff = (lexCount(dec.options[W].label, LEX.social) > 0) !== (lexCount(dec.options[L].label, LEX.social) > 0) ? .3 : 0;
    return { k: t.k, inf: Math.abs(tr[t.k] - 50) / 50 * diff };
  }).filter(x => x.inf > .012).sort((a, b) => b.inf - a.inf).slice(0, 2).map(x => x.k);
}

/* learn(): the real outcome updates DNA, confidence, version and memory */
function learn(dec, chosen, outcome, note) {
  const c = dec.options[chosen], others = dec.options.filter((o, i) => i !== chosen);
  const avg = k => mean(others.map(o => o.scores[k]));
  const res = compute(dec), predicted = res.rec ? res.rec.predicted : null, twinPick = res.rec ? res.rec.win : null;
  const good = outcome === 'good', bad = outcome === 'bad', lines = [];
  const push = l => l && lines.push(l);
  const dR = c.scores.risk - avg('risk'), dS = c.scores.speed - avg('speed'), dI = c.scores.impact - avg('impact'), dE = c.scores.effort - avg('effort');
  if (Math.abs(dR) > 6) push(adjustTrait('risk', Math.sign(dR) * (good ? 4 : bad ? 1 : 2) - (bad && dR > 0 ? 3 : 0), 3, `Chose the ${dR > 0 ? 'riskier' : 'safer'} option; it ${outcome === 'mixed' ? 'was mixed' : 'went ' + (good ? 'well' : 'badly')}`));
  if (Math.abs(dS) > 6) push(adjustTrait('speed', Math.sign(dS) * 3, 2, `Picked the ${dS > 0 ? 'faster' : 'slower'} payoff`));
  if (dI > 6 && dS < 0) push(adjustTrait('horizon', 3, 3, 'Traded speed for long-term upside'));
  else if (dS > 6 && dI < 0) push(adjustTrait('horizon', -3, 3, 'Took the quicker, smaller win'));
  if (lexCount(c.label + ' ' + (note || ''), LEX.social)) push(adjustTrait('social', 3, 3, 'Other people shaped the choice'));
  if (Math.abs(dE) > 6) push(adjustTrait('structure', dE > 0 ? -2 : 2, 2, dE > 0 ? 'Took on more load than the alternative' : 'Protected capacity'));
  if (twinPick != null) push(adjustTrait('evidence', twinPick === chosen ? 2 : -2, 2, twinPick === chosen ? 'Followed the evidence-based pick' : 'Went against the Twin’s pick'));
  if (!lines.length) push(adjustTrait('evidence', 0, 3, 'New outcome observed'));
  dec.chosen = chosen; dec.outcome = outcome; dec.note = note || ''; dec.decidedAt = now();
  if (predicted != null) T.predictions.push({ at: now(), hit: predicted === chosen, dec: dec.id }); if (T.predictions.length > 100) T.predictions.shift();
  addMemory('DID', `Chose “${short(c.label, 50)}” over ${others.map(o => '“' + short(o.label, 30) + '”').join(', ')} — ${({ good:'went well', mixed:'mixed result', bad:'went badly' })[outcome]}${note ? ' (' + short(note, 60) + ')' : ''}`, 'outcome');
  const v = bump(`Learned from “${short(dec.title, 50)}”: ${lines.map(l => `${l.n} ${l.ov}→${l.nv}`).join(', ')}`);
  computeCache.clear(); saveTwin();
  return { lines, v, hit: predicted === chosen };
}

/* =====================================================================
   LOCAL REPLY WRITER (offline engine)
   ===================================================================== */
function firstName() { return (T.profile.name || ACC.name || '').split(' ')[0]; }
function localReply(text, an, dec, learned) {
  const tone = T.profile.tone, name = firstName();
  if (an.intent === 'decision' && dec) {
    const r = compute(dec);
    if (r.insufficient) return `I can't make a responsible call on this yet — I only have **${r.active}** usable piece${r.active === 1 ? '' : 's'} of evidence about you (I need at least 3). ${T.perms.goals && T.perms.profile ? 'Tell me which goal this decision serves and what you can afford to lose.' : 'Some of your data sources are switched off in Settings, which is why.'}`;
    const W = r.rec.win, wo = dec.options[W], rows = r.rec.ev.rows;
    const others = dec.options.map((o, i) => i).filter(i => i !== W);
    const L = others.sort((a, b) => rows[b].total - rows[a].total)[0];
    const g = T.profile.goals.map(x => ({ x, o: overlap(x, wo.label) })).sort((a, b) => b.o - a.o)[0];
    const lines = [];
    lines.push(`**My read:** go with **${wo.label}** — ${r.rec.conf}% confident${r.rec.robust ? ', and it holds up when I jiggle the assumptions.' : ', but it’s a close call that flips under small changes.'}`);
    const bl = [];
    bl.push(`Goal fit ${rows[W].v.alignment} vs ${rows[L].v.alignment}${g && g.o ? ` — it links to “${short(g.x, 50)}”` : ''}.`);
    bl.push(`Downside risk ${rows[W].v.risk} vs ${rows[L].v.risk}, weighed against your ${riskLabel(T.profile.risk).toLowerCase()} risk comfort.`);
    if (tone !== 'concise') bl.push(`Effort ${rows[W].v.effort} vs ${rows[L].v.effort} with about ${T.profile.hours} h/week to spare.`);
    bl.push(`${HORIZONS[r.ctx.horizon].label} outcome ${Math.round(rows[W].sim.mean)} (range ${Math.round(rows[W].sim.p10)}–${Math.round(rows[W].sim.p90)}) vs ${Math.round(rows[L].sim.mean)}.`);
    lines.push(bl.map(b => '- ' + b).join('\n'));
    if (wo.cons && wo.cons[0]) lines.push(`**Watch out:** ${wo.cons[0].toLowerCase()}.`);
    if (r.levers[0]) lines.push(`**What would change my mind:** ${r.levers[0].label.charAt(0).toLowerCase() + r.levers[0].label.slice(1)}${r.levers[0].flips ? ' — that flips it.' : '.'}`);
    if (r.rec.predicted !== W) lines.push(`Honest note: your pattern suggests you’ll lean toward **${dec.options[r.rec.predicted].label}**. If you do, tell me how it goes and I’ll learn from it.`);
    if (tone === 'coach') lines.push(`Either way, ${name ? name + ', ' : ''}you’re thinking this through carefully — that’s most of the work.`);
    if (an.questions && an.questions[0]) lines.push(`_${an.questions[0]}_`);
    return lines.join('\n\n');
  }
  const t = text.toLowerCase().trim();
  if (/^(hi|hey|hello|yo|good (morning|evening|afternoon))\b/.test(t)) return `Hi${name ? ' ' + name : ''}! I’m your Decision Twin. Tell me about a choice you’re weighing — “Should I … or …?” — and I’ll simulate both paths against your goals. You can also just tell me about yourself and I’ll remember it.`;
  if (/(what do you know|about me|my (dna|profile|traits)|who am i|describe me)/.test(t)) {
    const tt = topTrait();
    return `Here’s what I’m working with:\n\n- **Role:** ${T.profile.role || 'not set'}${T.profile.sector ? ' · ' + T.profile.sector : ''}\n- **Goals:** ${T.profile.goals.length ? T.profile.goals.map(g => short(g, 50)).join('; ') : 'none yet'}\n- **Strongest trait:** ${tt.t.n} ${tt.v}/100 (${traitWord(tt.t.k).toLowerCase()})\n- **Memories:** ${T.memory.length} · **Decisions logged:** ${T.decisions.length}\n\nAnything wrong? Correct me and I’ll update.`;
  }
  if (/(what can you do|help|how does this work|how do you work)/.test(t)) return `I can:\n\n- **Simulate a decision** — describe two or more options and I’ll score them on impact, goal fit, risk, effort, reversibility and speed, then run 1,000 futures.\n- **Explain myself** — every call shows what you said, what you did, and what I inferred.\n- **Learn** — tell me what you chose and how it went, and your Decision DNA updates.`;
  if (learned.length) return `Got it — I’ll remember that ${learned.map(l => l.charAt(0).toLowerCase() + l.slice(1)).join(', and ')}. ${T.profile.goals.length ? `Does that change how you’re approaching “${short(T.profile.goals[0], 50)}”?` : 'What are you working toward right now?'}`;
  const g = T.profile.goals.map(x => ({ x, o: overlap(x, text) })).sort((a, b) => b.o - a.o)[0];
  const mem = T.memory.map(m => ({ m, o: overlap(m.text, text) })).filter(x => x.o).sort((a, b) => b.o - a.o)[0];
  const parts = [];
  if (g && g.o) parts.push(`This connects to your goal **“${short(g.x, 60)}”**.`);
  if (mem) parts.push(`You told me earlier: “${short(mem.m.text, 80)}”.`);
  parts.push(g && g.o ? 'If there’s a choice hiding in here, phrase it as “Should I A or B?” and I’ll simulate both.' : 'I work best on concrete choices. What are the options you’re weighing?');
  return parts.join(' ') + offlineNote();
}
</script>
