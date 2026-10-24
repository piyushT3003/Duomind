<script>
/* =====================================================================
   STARFIELD (2D, parallax on mouse + scroll)
   ===================================================================== */
const MOUSE = { x: 0, y: 0, px: -9999, py: -9999, inside: false };
const Stars = (() => {
  const cv = $('#stars'), ctx = cv.getContext('2d'); let W, H, dpr, stars = [], running = false, raf = 0, t = 0;
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function init() { resize(); const n = Math.round(Math.min(420, W * H / 4200)); stars = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H * 1.4, z: Math.random(), r: Math.random() * 1.2 + .3, p: Math.random() * 6.28 })); addEventListener('resize', resize); }
  function frame() {
    if (!running) return; raf = requestAnimationFrame(frame); t += .016;
    ctx.clearRect(0, 0, W, H);
    const sy = scrollY;
    for (const s of stars) {
      const d = .25 + s.z * .9;
      let x = s.x + MOUSE.x * 22 * d + (REDUCE ? 0 : t * 3 * d), y = s.y - sy * .12 * d + MOUSE.y * 14 * d;
      x = ((x % W) + W) % W; y = ((y % (H * 1.4)) + H * 1.4) % (H * 1.4);
      const a = (.25 + .55 * s.z) * (REDUCE ? 1 : .65 + .35 * Math.sin(t * 1.4 + s.p));
      ctx.fillStyle = `rgba(${170 + s.z * 60},${200 + s.z * 40},255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, s.r * d, 0, 6.283); ctx.fill();
    }
  }
  return { init, start() { if (running) return; running = true; raf = requestAnimationFrame(frame); }, stop() { running = false; cancelAnimationFrame(raf); } };
})();

/* =====================================================================
   PARTICLE BRAIN (Three.js)
   ===================================================================== */
const Brain = (() => {
  let ok = false, sigMat, renderer, scene, camera, root, brain, ped, mat, lmat, sigGeo, sig = [], sigPos, links = [], motePos, moteGeo, scanRing, pedRings = [];
  let running = false, raf = 0, last = 0, time = 0, think = 0, thinkT = 0, burst = 0, pulse = 0;
  const cur = { x: 0, y: 0, s: .01, op: 0, ped: 0 }, tgt = { x: 0, y: 0, s: 1, op: 1, ped: 1 };
  let rotY = -.75, rotX = .12, velY = .0, drag = null, anchorFn = () => null;
  let pickPts = [], pickDirty = false, hoverIdx = -1, extHover = -1, flash = { set: [], until: 0 }, onHover = () => {}, linesObj = null, sigObj = null;
  const hiCur = [0, 0, 0, 0, 0, 0];
  let quality = 2, mode = (() => { try { return localStorage.getItem('duomind.v2.perf') || 'auto'; } catch (e) { return 'auto'; } })(), fpsT = 0, fpsN = 0, warm = 0;
  const prog = { p: 0 };
  const ray = new (window.THREE ? THREE.Raycaster : Object)(), plane = window.THREE ? new THREE.Plane(new THREE.Vector3(0, 0, 1), 0) : null, mW = window.THREE ? new THREE.Vector3(99, 99, 99) : null;

  // --- procedural noise for the cortex folds
  const fr = x => x - Math.floor(x);
  const h3 = (i, j, k) => fr(Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453);
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), L = (a, b, t) => a + (b - a) * t;
    return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
             L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
  }
  function ridged(x, y, z) { let a = 0, f = 1, amp = .62; for (let o = 0; o < 3; o++) { const n = 1 - Math.abs(vnoise(x * f, y * f, z * f) * 2 - 1); a += n * n * amp; f *= 2.07; amp *= .5; } return Math.min(1, a); }

  function build(scale) {
    const P = [], F = [], R = [], S = [], G = [], surf = [], pk = [];
    const push = (x, y, z, fold, size, isSurf, reg, canPick) => { P.push(x, y, z); F.push(fold); R.push(Math.random()); S.push(size); G.push(reg); if (isSurf) surf.push([x, y, z]); if (canPick && Math.random() < .16) pk.push([x, y, z, reg]); };
    const N = Math.round(13000 * scale), rx = .66, ry = .54, rz = .84;
    let guard = 0;
    while (surf.length < N && guard++ < N * 8) {
      const u = Math.random() * 2 - 1, th = Math.random() * 6.2832, s = Math.sqrt(1 - u * u);
      let x = s * Math.cos(th) * rx, y = u * ry, z = s * Math.sin(th) * rz;
      if (y < -.16) y = -.16 + (y + .16) * .55;                       // flat underside
      if (z < 0) y *= 1 - .14 * (-z / rz);                              // occipital taper
      if (y > 0) y -= .13 * Math.exp(-(x * x) / .0045);                 // longitudinal fissure
      x += Math.sign(x || 1) * .035;
      if (y < -.05 && Math.abs(x) > .38 && z > -.2) y -= .05;           // temporal lobes
      const fold = ridged(x * 4.3 + 11, y * 4.3 + 3, z * 4.3 + 7);
      if (Math.random() > .22 + .78 * Math.pow(fold, 1.7)) continue;
      const k = 1 + (fold - .5) * .09, reg = z > .3 ? 2 : z <= -.3 ? 5 : y > .12 ? 4 : 3;
      push(x * k, y * k, z * k, fold, 1 + fold * .8, true, reg, true);
    }
    const cN = Math.round(2400 * scale);
    for (let i = 0, g = 0; i < cN && g < cN * 6; g++) {
      const u = Math.random() * 2 - 1, th = Math.random() * 6.2832, s = Math.sqrt(1 - u * u);
      const x = s * Math.cos(th) * .47, y = u * .21 - .37, z = s * Math.sin(th) * .3 - .56;
      const f = .5 + .5 * Math.sin(y * 95 + z * 18); if (Math.random() > .3 + .7 * f) continue;
      push(x, y, z, .35 + f * .5, .9 + f * .5, true, 1, true); i++;
    }
    const sN = Math.round(700 * scale);
    for (let i = 0; i < sN; i++) { const t = Math.random(), th = Math.random() * 6.2832, r = .1 - t * .03; push(Math.cos(th) * r, -.36 - t * .62, -.27 + t * .1 + Math.sin(th) * r * .8, .5, 1, false, 0, true); }
    const iN = Math.round(1300 * scale);
    for (let i = 0; i < iN; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.2832, s = Math.sqrt(1 - u * u), r = Math.cbrt(Math.random()) * .82; push(s * Math.cos(th) * rx * r, u * ry * r * .8, s * Math.sin(th) * rz * r, .12, .7, false, 0, false); }
    const n = P.length / 3, start = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.2832, s = Math.sqrt(1 - u * u), r = 2.2 + Math.random() * 2.2; start[i * 3] = s * Math.cos(th) * r; start[i * 3 + 1] = u * r; start[i * 3 + 2] = s * Math.sin(th) * r; }
    return { P: new Float32Array(P), F: new Float32Array(F), R: new Float32Array(R), S: new Float32Array(S), G: new Float32Array(G), start, surf, pk };
  }
  const VS = `attribute vec3 aStart;attribute float aFold;attribute float aRand;attribute float aSize;attribute float aReg;
    uniform float uTime,uProg,uThink,uBurst,uPR,uScale,uOp,uDensity,uDim;uniform vec3 uMouse,uHiA,uHiB;varying vec3 vCol;varying float vA;
    void main(){if(aRand>uDensity){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vCol=vec3(0.);vA=0.;return;}
      float r=aReg;vec3 sa=vec3(1.-step(.5,abs(r)),1.-step(.5,abs(r-1.)),1.-step(.5,abs(r-2.)));vec3 sb=vec3(1.-step(.5,abs(r-3.)),1.-step(.5,abs(r-4.)),1.-step(.5,abs(r-5.)));
      float hi=dot(sa,uHiA)+dot(sb,uHiB);
      vec3 rc=sa.x*vec3(.98,.44,.52)+sa.y*vec3(.98,.75,.14)+sa.z*vec3(.91,.47,.98)+sb.x*vec3(.75,.52,.99)+sb.y*vec3(.2,.83,.6)+sb.z*vec3(.64,.9,.21);
      float p=smoothstep(0.,1.,clamp(uProg*1.5-aRand*.5,0.,1.));vec3 pos=mix(aStart,position,p);
      pos*=1.+sin(uTime*1.3+aRand*6.283)*.006+uBurst*(.25+aRand*.5);
      vec4 wp=modelMatrix*vec4(pos,1.);vec3 d=wp.xyz-uMouse;float dist=length(d);float f=smoothstep(.55*uScale,0.,dist);
      wp.xyz+=normalize(d+1e-4)*f*.16*uScale;
      float wave=pow(.5+.5*sin(pos.z*7.-uTime*5.+pos.y*3.),6.)*uThink;
      vec4 mv=viewMatrix*wp;gl_Position=projectionMatrix*mv;
      float tw=.62+.38*sin(uTime*2.2+aRand*50.);
      gl_PointSize=aSize*uPR*sqrt(uScale)*(1.+f*1.8+wave*1.4+hi*.9)*(16./-mv.z)/sqrt(max(uDensity,.3));
      vCol=mix(vec3(.12,.40,1.),vec3(.62,.88,1.),aFold)+f*vec3(.35,.3,.1)+wave*vec3(.35,.45,.5);
      vCol=mix(vCol,rc*1.25,clamp(hi*.85,0.,.9));
      vA=((.25+.75*aFold)*tw*p+f*.6+wave*.5+hi*(.45+.4*aFold)*p)*uOp*mix(1.,.28+.72*clamp(hi,0.,1.),uDim);}`;
  const FS = `varying vec3 vCol;varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=smoothstep(.5,.05,d);gl_FragColor=vec4(vCol,a*vA);}`;
  const LVS = `attribute float aPh;uniform float uTime,uProg,uThink,uOp;varying float vA;void main(){vA=(.08+.22*pow(.5+.5*sin(uTime*1.6+aPh*9.),3.)+uThink*.25)*smoothstep(.6,1.,uProg)*uOp;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const LFS = `varying float vA;void main(){gl_FragColor=vec4(.45,.75,1.,vA);}`;
  function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(160,210,255,.95)'); gr.addColorStop(.3, 'rgba(70,140,255,.5)'); gr.addColorStop(1, 'rgba(20,60,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); }
  function dotTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(.3, 'rgba(170,215,255,.9)'); gr.addColorStop(1, 'rgba(90,150,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
  const add = m => { m.material.transparent = true; m.material.depthWrite = false; m.material.blending = THREE.AdditiveBlending; return m; };

  function init() {
    try {
      if (!window.THREE) return false;
      renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(35, 1, .1, 80); camera.position.set(0, 0, 6); camera.lookAt(0, 0, 0);
      root = new THREE.Group(); scene.add(root);
      brain = new THREE.Group(); brain.position.y = .12; root.add(brain);
      const G = build(innerWidth < 760 ? .55 : 1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(G.P, 3)); geo.setAttribute('aStart', new THREE.BufferAttribute(G.start, 3));
      geo.setAttribute('aFold', new THREE.BufferAttribute(G.F, 1)); geo.setAttribute('aRand', new THREE.BufferAttribute(G.R, 1)); geo.setAttribute('aSize', new THREE.BufferAttribute(G.S, 1)); geo.setAttribute('aReg', new THREE.BufferAttribute(G.G, 1)); pickPts = G.pk;
      mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uProg: { value: 0 }, uThink: { value: 0 }, uBurst: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uScale: { value: 1 }, uOp: { value: 1 }, uDensity: { value: 1 }, uDim: { value: 0 }, uHiA: { value: new THREE.Vector3() }, uHiB: { value: new THREE.Vector3() }, uMouse: { value: new THREE.Vector3(99, 99, 99) } } });
      brain.add(new THREE.Points(geo, mat));
      // synapse links via a spatial grid
      const cell = .09, grid = new Map(), pick = G.surf.filter(() => Math.random() < .12).slice(0, 1600);
      const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
      pick.forEach((p, i) => { const k = key(...p); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
      const seg = [], ph = [], deg = new Uint8Array(pick.length);
      pick.forEach((p, i) => {
        if (deg[i] > 2) return; const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) (grid.get(`${cx + a},${cy + b},${cz + c}`) || []).forEach(j => {
          if (j <= i || deg[i] > 2 || deg[j] > 2) return; const q = pick[j], d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
          if (d < .095 && d > .02) { seg.push(...p, ...q); const r = Math.random(); ph.push(r, r); links.push([p, q]); deg[i]++; deg[j]++; }
        });
      });
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); lg.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
      lmat = new THREE.ShaderMaterial({ vertexShader: LVS, fragmentShader: LFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: mat.uniforms.uTime, uProg: mat.uniforms.uProg, uThink: mat.uniforms.uThink, uOp: mat.uniforms.uOp } });
      linesObj = new THREE.LineSegments(lg, lmat); brain.add(linesObj);
      // travelling signals
      const nS = Math.min(110, links.length); sigPos = new Float32Array(nS * 3);
      for (let i = 0; i < nS; i++) sig.push({ l: Math.floor(Math.random() * links.length), t: Math.random(), sp: .6 + Math.random() * 1.4 });
      sigGeo = new THREE.BufferGeometry(); sigGeo.setAttribute('position', new THREE.BufferAttribute(sigPos, 3));
      const dt = dotTex();
      sigMat = new THREE.PointsMaterial({ size: .05, map: dt, color: 0xcfeaff, opacity: .95 }); sigObj = add(new THREE.Points(sigGeo, sigMat)); brain.add(sigObj);
      // pedestal
      ped = new THREE.Group(); ped.position.y = -1.2; root.add(ped);
      const disc = add(new THREE.Mesh(new THREE.CircleGeometry(1.15, 64), new THREE.MeshBasicMaterial({ map: glowTex(), opacity: .9 }))); disc.rotation.x = -Math.PI / 2; ped.add(disc);
      [[.44, .455, 1.6, .9], [.68, .695, 1.2, -.5], [.93, .95, 1.9, .3], [1.08, 1.09, 2 * Math.PI, 0]].forEach(([a, b, len, sp]) => {
        const m = add(new THREE.Mesh(new THREE.RingGeometry(a, b, 160, 1, 0, len), new THREE.MeshBasicMaterial({ color: 0x8cc8ff, side: THREE.DoubleSide, opacity: .85 })));
        m.rotation.x = -Math.PI / 2; m.userData.sp = sp; pedRings.push(m); ped.add(m);
      });
      const bc = document.createElement('canvas'); bc.width = 4; bc.height = 256; const bg = bc.getContext('2d'); const gr = bg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(90,150,255,0)'); gr.addColorStop(1, 'rgba(110,170,255,.7)'); bg.fillStyle = gr; bg.fillRect(0, 0, 4, 256);
      const beam = add(new THREE.Mesh(new THREE.CylinderGeometry(.34, .82, 1.1, 48, 1, true), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), side: THREE.DoubleSide, opacity: .32 }))); beam.position.y = .55; ped.add(beam);
      motePos = new Float32Array(160 * 3); for (let i = 0; i < 160; i++) { const a = Math.random() * 6.283, r = Math.random() * .8; motePos[i * 3] = Math.cos(a) * r; motePos[i * 3 + 1] = Math.random() * 1.2; motePos[i * 3 + 2] = Math.sin(a) * r; }
      moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
      ped.add(add(new THREE.Points(moteGeo, new THREE.PointsMaterial({ size: .03, map: dt, color: 0x9fd0ff, opacity: .7 }))));
      scanRing = add(new THREE.Mesh(new THREE.RingGeometry(.62, .64, 128), new THREE.MeshBasicMaterial({ color: 0xbfe3ff, side: THREE.DoubleSide, opacity: 0 }))); scanRing.rotation.x = -Math.PI / 2; root.add(scanRing);
      ok = true; resize(); addEventListener('resize', resize);
      if (mode === 'low') applyQuality(0);
      gsap.to(prog, { p: 1, duration: REDUCE ? .01 : 2.6, ease: 'power2.inOut' });
      return true;
    } catch (e) { console.warn('WebGL unavailable', e); ok = false; return false; }
  }
  function applyQuality(q) {
    quality = q; if (!ok) return;
    mat.uniforms.uDensity.value = [.36, .62, 1][q];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1, 1.25, 2][q])); mat.uniforms.uPR.value = renderer.getPixelRatio();
    linesObj.visible = q > 0; sigObj.visible = q > 0; resize(); fpsT = 0; fpsN = 0;
    if (typeof perfNote === 'function') perfNote();
  }
  function resize() { if (!ok) return; renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  function target() {
    const a = anchorFn(); if (!a) { tgt.op = 0; return; }
    const r = a.el ? a.el.getBoundingClientRect() : a.rect; if (!r || !r.width) { tgt.op = 0; return; }
    const hv = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), k = hv / innerHeight;
    const withPed = a.ped !== false, H = withPed ? 2.5 : 1.8, Wd = withPed ? 2.35 : 1.62;
    tgt.s = Math.min(r.height * k / H, r.width * k / Wd);
    tgt.x = (r.left + r.width / 2 - innerWidth / 2) * k;
    tgt.y = -(r.top + r.height / 2 - innerHeight / 2) * k + (withPed ? .08 : .1) * tgt.s;
    const vis = r.bottom > -40 && r.top < innerHeight + 40;
    tgt.op = vis ? 1 : 0; tgt.ped = withPed ? 1 : 0; tgt.pick = !!a.pick && vis; tgt.rect = r;
  }
  const pv = new THREE.Vector3();
  function doPick() {
    pickDirty = false;
    let idx = -1;
    if (tgt.pick && MOUSE.inside && cur.op > .6 && prog.p > .95) {
      const r = tgt.rect;
      if (MOUSE.px >= r.left && MOUSE.px <= r.right && MOUSE.py >= r.top && MOUSE.py <= r.bottom) {
        root.updateMatrixWorld(true); const m = brain.matrixWorld; let best = 1e9;
        const lim = quality === 0 ? .4 : 1;
        for (let i = 0; i < pickPts.length; i++) { if (lim < 1 && i % 3) continue; const q = pickPts[i]; pv.set(q[0], q[1], q[2]).applyMatrix4(m).project(camera);
          const sx = (pv.x + 1) / 2 * innerWidth, sy = (1 - pv.y) / 2 * innerHeight, d = (sx - MOUSE.px) ** 2 + (sy - MOUSE.py) ** 2; if (d < best) { best = d; idx = q[3]; } }
        if (best > 26 * 26) idx = -1;
      }
    }
    if (idx !== hoverIdx) { hoverIdx = idx; onHover(idx); }
  }
  function frame(ts) {
    if (!running) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, ((ts - (last || ts)) / 1000)); last = ts; time += dt * (REDUCE ? .3 : 1);
    target();
    if (pickDirty) doPick();
    if (mode === 'auto' && cur.op > .6 && prog.p > .98 && !document.hidden) {
      warm += dt; if (warm > 1.5) { fpsT += dt; fpsN++; if (fpsT > 2.5) { const fps = fpsN / fpsT; if (fps < 40 && quality > 0) applyQuality(quality - 1); fpsT = 0; fpsN = 0; } }
    }
    const act = hoverIdx >= 0 ? hoverIdx : extHover, fl = time < flash.until ? flash.set : [];
    for (let i = 0; i < 6; i++) { const tg = i === act ? 1 : fl.includes(i) ? .6 + .4 * Math.sin(time * 5) : 0; hiCur[i] += (tg - hiCur[i]) * .12; }
    mat.uniforms.uHiA.value.set(hiCur[0], hiCur[1], hiCur[2]); mat.uniforms.uHiB.value.set(hiCur[3], hiCur[4], hiCur[5]); mat.uniforms.uDim.value = Math.min(1, Math.max(...hiCur) * 1.1);
    const L = cur.op < .05 && tgt.op > .5 ? 1 : 1 - Math.exp(-dt * 5.5);
    ['x','y','s'].forEach(k => cur[k] += (tgt[k] - cur[k]) * L);
    const E = 1 - Math.exp(-dt * 5); cur.op += (tgt.op - cur.op) * E; cur.ped += (tgt.ped - cur.ped) * E;
    think += (thinkT - think) * .05; burst *= .92; pulse = Math.max(0, pulse - dt);
    root.position.set(cur.x, cur.y, 0); root.scale.setScalar(Math.max(.001, cur.s));
    if (!drag) { velY *= .95; rotY += velY + (REDUCE ? 0 : dt * (.12 + think * .6)); }
    brain.rotation.y = rotY + MOUSE.x * .25; brain.rotation.x = rotX + MOUSE.y * .12;
    brain.position.y = .12 + (REDUCE ? 0 : Math.sin(time * 1.1) * .035);
    const u = mat.uniforms; u.uTime.value = time; u.uProg.value = prog.p; u.uThink.value = think; u.uBurst.value = burst; u.uScale.value = cur.s; u.uOp.value = cur.op;
    if (MOUSE.inside) { ray.setFromCamera({ x: MOUSE.px / innerWidth * 2 - 1, y: -(MOUSE.py / innerHeight) * 2 + 1 }, camera); if (ray.ray.intersectPlane(plane, mW)) u.uMouse.value.copy(mW); } else u.uMouse.value.set(99, 99, 99);
    for (let i = 0; i < sig.length; i++) { const s = sig[i]; s.t += dt * s.sp * (1 + think * 3.5); if (s.t > 1) { s.t = 0; s.l = Math.floor(Math.random() * links.length); } const [a, b] = links[s.l]; sigPos[i * 3] = a[0] + (b[0] - a[0]) * s.t; sigPos[i * 3 + 1] = a[1] + (b[1] - a[1]) * s.t; sigPos[i * 3 + 2] = a[2] + (b[2] - a[2]) * s.t; }
    sigGeo.attributes.position.needsUpdate = true; sigMat.opacity = .95 * cur.op;
    ped.children.forEach(c => { if (c.material && c.material.userData) { c.material.opacity = (c.material.userData.base ?? (c.material.userData.base = c.material.opacity)) * cur.ped * cur.op; } });
    pedRings.forEach(r => r.rotation.z += dt * r.userData.sp * (1 + think * 3));
    for (let i = 0; i < 160; i++) { motePos[i * 3 + 1] += dt * (.18 + (i % 5) * .05) * (1 + think * 2); if (motePos[i * 3 + 1] > 1.2) motePos[i * 3 + 1] = 0; }
    moteGeo.attributes.position.needsUpdate = true;
    const scanP = think > .05 ? (time * .6 % 1) : 0; scanRing.position.y = -1.2 + scanP * 2.2; scanRing.material.opacity = think * .7 * Math.sin(scanP * Math.PI) * cur.op; scanRing.scale.setScalar(.6 + Math.sin(scanP * Math.PI) * .6);
    renderer.render(scene, camera);
  }
  return {
    init, get ok() { return ok; }, progress: () => prog.p,
    setAnchor(fn) { anchorFn = fn; },
    think(on) { thinkT = on ? 1 : 0; },
    get quality() { return quality; }, get mode() { return mode; },
    setMode(m) { mode = m; try { localStorage.setItem('duomind.v2.perf', m); } catch (e) {} warm = 0; applyQuality(m === 'low' ? 0 : 2); },
    highlight(keys, ms = 4000) { const idx = (keys || []).map(k => TRAITS.findIndex(t => t.k === k)).filter(i => i >= 0); if (!idx.length) return; flash = { set: idx, until: time + ms / 1000 }; },
    hover(k) { extHover = k == null ? -1 : TRAITS.findIndex(t => t.k === k); },
    onHover(fn) { onHover = fn; },
    markPick() { pickDirty = true; },
    burst() { burst = .55; pulse = 1; },
    dragStart(x) { drag = { x, r: rotY }; velY = 0; },
    dragMove(x) { if (!drag) return; const nr = drag.r + (x - drag.x) * .008; velY = nr - rotY; rotY = nr; },
    dragEnd() { drag = null; },
    start() { if (!ok || running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); }
  };
})();

/* =====================================================================
   ROUTER + PAGE TRANSITIONS
   ===================================================================== */
const ROUTES = ['auth','onboarding','home','chat','lab','insights','settings'];
const NAV = ['home','chat','lab','insights','settings'];
let route = null, routeTok = 0;
const ENTER = { home:{ rotateX:-30, y:50 }, chat:{ rotateY:-18, x:-60, y:0, rotateX:0 }, lab:{ rotateX:25, y:-40, transformOrigin:'50% 0%' }, insights:{ scale:.9, y:30, rotateX:-12 }, settings:{ rotateY:18, x:60, y:0, rotateX:0 }, auth:{ y:30 }, onboarding:{ y:40 } };
function anchorFor(r) {
  if (!loaderDone) return { rect: { left: innerWidth / 2 - 190, top: innerHeight / 2 - 250, width: 380, height: 340, bottom: innerHeight / 2 + 90 }, ped: true };
  if (modalOpen) return null;
  const el = { auth: $('#anchor-auth'), home: $('#anchor-home'), chat: $('#anchor-chat'), lab: $('#anchor-lab'), insights: $('#anchor-ins') }[r];
  return el ? { el, ped: r === 'auth' || r === 'home', pick: r === 'auth' || r === 'home' || r === 'insights' } : null;
}
function go(r, opts = {}) {
  if (!ROUTES.includes(r)) r = 'home';
  if (!ACC) r = 'auth'; else if (!T.onboarded && r !== 'onboarding') r = 'onboarding'; else if (T.onboarded && (r === 'auth' || r === 'onboarding') && !opts.force) r = 'home';
  try { if (location.hash !== '#' + r) history.replaceState(null, '', '#' + r); } catch (e) {}
  if (r === route) { renderPage(r, false); return; }
  const from = route, tok = ++routeTok, fromEl = from ? $('#p-' + from) : null, toEl = $('#p-' + r);
  const dir = NAV.indexOf(r) >= NAV.indexOf(from) ? 1 : -1;
  route = r; $('#menu').classList.remove('open');
  $('#topbar').classList.toggle('hide', r === 'auth' || r === 'onboarding');
  moveInd(r);
  const enter = () => {
    if (tok !== routeTok) return;
    $$('.page').forEach(p => p.classList.toggle('on', p === toEl)); gsap.set(toEl, { clearProps: 'all' });
    scrollTo(0, 0); renderPage(r, true);
    if (REDUCE) gsap.fromTo(toEl, { opacity: 0 }, { opacity: 1, duration: .3, clearProps: 'opacity' });
  };
  if (!fromEl) return enter();
  gsap.killTweensOf(fromEl);
  if (REDUCE) gsap.to(fromEl, { opacity: 0, duration: .15, onComplete: enter });
  else gsap.to(fromEl, { opacity: 0, rotateY: -14 * dir, x: -70 * dir, z: -160, scale: .97, transformPerspective: 1400, duration: .38, ease: 'power2.in', onComplete: enter });
}
function renderPage(r, anim) {
  if (r === 'auth') { if (anim) reveal($$('#p-auth .reveal'), ENTER.auth); }
  if (r === 'onboarding') { renderOnboarding(); if (anim) reveal($$('#p-onboarding .ob'), ENTER.onboarding); }
  if (r === 'home') renderHome(anim);
  if (r === 'chat') { engineBadge(); renderThreads(); renderMsgs(); renderChatSugs(); setBusy(!!busy); if (anim) reveal($$('#p-chat .card'), ENTER.chat); setTimeout(() => $('#chatIn').focus({ preventScroll: true }), 300); }
  if (r === 'lab') renderLab(anim);
  if (r === 'insights') renderInsights(anim);
  if (r === 'settings') renderSettings(anim);
}
function moveInd(r) {
  const it = $(`.nav a[data-go="${r}"]`), nav = $('#nav'); $$('.nav a').forEach(a => a.classList.toggle('on', a === it));
  if (!it) return; const nr = nav.getBoundingClientRect(), ir = it.getBoundingClientRect();
  gsap.to('#navInd', { x: ir.left - nr.left - 5, width: ir.width, duration: REDUCE ? 0 : .55, ease: 'power3.out' });
}
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== route && ROUTES.includes(h)) go(h); });

/* =====================================================================
   SESSION
   ===================================================================== */
function enterApp(acc, isNew) {
  if (!(acc.demo && T && ACC === acc)) T = loadTwin(acc);
  ACC = acc;
  if (!T.profile.name) T.profile.name = acc.name || '';
  saveTwin(); refreshAll();
  if (!T.onboarded) { toast(isNew ? `Welcome, ${esc((acc.name || '').split(' ')[0] || 'there')}. Let’s build your Twin.` : 'Let’s finish setting up your Twin.', 'good'); go('onboarding'); }
  else if (acc.demo) { toast('You’re exploring a demo Twin: Riya, a CS student. It resets each time you open the demo.', 'good'); go('home'); }
  else { toast(`Welcome back, ${esc(firstName())}.`, 'good'); go('home'); }
}
function signOut() { busy && busy.ctl.abort(); Auth.clear(); ACC = null; T = null; computeCache.clear(); go('auth'); setAuthMode('in'); $('#fPass').value = ''; toast('Signed out.'); }

/* =====================================================================
   INTERACTIONS
   ===================================================================== */
let tiltEl = null, tiltRaf = 0, lastEv = null, magnet = null;
function doTilt() {
  tiltRaf = 0; const e = lastEv; if (!e || !e.target || !e.target.closest) return;
  const b = e.target.closest('.btn-primary,.send');
  if (magnet && magnet !== b) { magnet.style.setProperty('--mx', '0px'); magnet.style.setProperty('--my', '0px'); magnet.style.translate = ''; }
  magnet = b;
  if (b && !REDUCE && !b.disabled) { const r = b.getBoundingClientRect(), mx = (e.clientX - r.left - r.width / 2) * .22, my = (e.clientY - r.top - r.height / 2) * .32; if (b.classList.contains('btn')) { b.style.setProperty('--mx', mx.toFixed(1) + 'px'); b.style.setProperty('--my', my.toFixed(1) + 'px'); } else b.style.translate = `${mx.toFixed(1)}px ${my.toFixed(1)}px`; }
  if (REDUCE) return;
  let el = e.target.closest('.card'); if (el && (el.closest('.chat') || el.offsetWidth > 900)) el = null;
  if (tiltEl && tiltEl !== el) { tiltEl.classList.remove('hov'); tiltEl.style.transform = ''; }
  tiltEl = el; if (!el || gsap.isTweening(el)) return;
  if (!el.querySelector(':scope > .glare')) { const g = document.createElement('div'); g.className = 'glare'; el.appendChild(g); }
  const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, k = r.width > 560 ? .45 : 1;
  el.classList.add('hov'); el.style.transform = `perspective(1000px) rotateX(${((.5 - y) * 10 * k).toFixed(2)}deg) rotateY(${((x - .5) * 12 * k).toFixed(2)}deg)`;
  el.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
}
addEventListener('pointermove', e => {
  MOUSE.x = e.clientX / innerWidth * 2 - 1; MOUSE.y = e.clientY / innerHeight * 2 - 1; MOUSE.px = e.clientX; MOUSE.py = e.clientY; MOUSE.inside = true;
  Brain.dragMove(e.clientX); Brain.markPick(); lastEv = e; if (!tiltRaf) tiltRaf = requestAnimationFrame(doTilt);
}, { passive: true });
document.addEventListener('pointerleave', () => { MOUSE.inside = false; if (tiltEl) { tiltEl.classList.remove('hov'); tiltEl.style.transform = ''; tiltEl = null; } });
addEventListener('pointerup', () => Brain.dragEnd());
document.addEventListener('pointerdown', e => {
  const d = e.target.closest('[data-drag]'); if (d) Brain.dragStart(e.clientX);
  const el = e.target.closest('.btn,.chip,.thread,.qopt,.sug button,.seg button,.nav a,.send,.tabs button');
  if (!el || REDUCE) return;
  const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height), sp = document.createElement('span');
  sp.className = 'ripple'; sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.appendChild(sp); setTimeout(() => sp.remove(), 700);
  if (el.matches('.btn,.chip,.send')) { el.classList.remove('burst'); void el.offsetWidth; el.classList.add('burst'); }
});

document.addEventListener('click', async e => {
  const t = e.target;
  const q = s => t.closest(s);
  let el;
  if ((el = q('[data-go]'))) { e.preventDefault(); closeModal(); go(el.dataset.go); return; }
  if ((el = q('[data-tab]'))) return setAuthMode(el.dataset.tab);
  if ((el = q('[data-sector]'))) { e.preventDefault(); ob.sector = el.dataset.sector; $$('[data-sector]').forEach(c => c.classList.toggle('on', c === el)); $('#otherSectorWrap').hidden = ob.sector !== 'Other'; renderGoalTags(); return; }
  if ((el = q('[data-q]'))) { e.preventDefault(); ob.answers[el.dataset.q] = +el.dataset.a; $$(`[data-q="${el.dataset.q}"]`).forEach(b => b.classList.toggle('on', b === el)); return; }
  if ((el = q('[data-addgoal]'))) { e.preventDefault(); addGoal(el.dataset.addgoal); return; }
  if ((el = q('[data-rmgoal]'))) { e.preventDefault(); T.profile.goals.splice(+el.dataset.rmgoal, 1); renderGoalTags(); return; }
  if ((el = q('[data-suggest]'))) { e.preventDefault(); const s = el.dataset.suggest; if (route !== 'chat') go('chat'); setTimeout(() => { const i = $('#chatIn'); if (/…$/.test(s)) { i.value = s.replace(/…$/, ''); i.focus(); autosize(); } else send(s); }, route === 'chat' ? 0 : 480); return; }
  if ((el = q('[data-thread]'))) { if (busy) return toast('Wait for the current answer, or press Stop.', 'warn'); T.activeThread = el.dataset.thread; saveTwin(); renderThreads(); renderMsgs(); return; }
  if ((el = q('[data-openlab]'))) { labSel = el.dataset.openlab; go('lab'); return; }
  if ((el = q('[data-outcome]'))) return openOutcome(el.dataset.outcome, el);
  if ((el = q('[data-labsel]'))) { labSel = el.dataset.labsel; renderLab(true); return; }
  if ((el = q('[data-labh]'))) { labH = el.dataset.labh; renderLab(false); return; }
  if ((el = q('[data-hl]'))) { Brain.highlight([el.dataset.hl], 4000); return; }
  if ((el = q('[data-trait]'))) return openTrait(el.dataset.trait, el);
  if ((el = q('[data-forget]'))) { const m = T.memory.find(x => x.id === el.dataset.forget); T.memory = T.memory.filter(x => x.id !== el.dataset.forget); bump('Forgot: ' + short(m ? m.text : '', 60)); computeCache.clear(); renderInsights(false); toast('Forgotten. Your Twin won’t use that again.'); return; }
  if (t.closest('#avatarBtn')) { $('#menu').classList.toggle('open'); return; }
  if (!t.closest('#menu')) $('#menu').classList.remove('open');
  if (t.id === 'mwrap') return closeModal();
  if ((el = q('[data-act]'))) {
    const a = el.dataset.act;
    if (a === 'closeModal') return closeModal();
    if (a === 'signout') return signOut();
    if (a === 'export') { const txt = JSON.stringify({ account: { name: ACC.name, email: ACC.email }, twin: T }, null, 2); try { await navigator.clipboard.writeText(txt); toast('Twin data copied to your clipboard.', 'good'); } catch (err) { openModal(`<div class="h3" style="margin-bottom:10px">Your Twin data</div><label class="field"><textarea id="exp" placeholder=" " rows="12" readonly></textarea><span>Select all and copy</span></label>`, el); $('#exp').value = txt; $('#exp').select(); } $('#menu').classList.remove('open'); return; }
    if (a === 'reset') return confirmBox('Reset your Twin?', 'This clears your goals, memories, decisions and Decision DNA. Your account stays.', 'Reset Twin', () => { T = blankTwin(ACC); saveTwin(); computeCache.clear(); ob.answers = {}; go('onboarding'); toast('Twin reset. Let’s rebuild it.'); }, el);
    if (a === 'delete') return confirmBox('Delete your account?', 'This permanently removes your account and all Twin data from this browser.', 'Delete account', () => { Store.del('twin.' + ACC.id); Auth.remove(ACC.email); signOut(); toast('Account deleted.'); }, el);
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'sPerf') { Brain.setMode(t.value); perfNote(); toast(`3D quality: ${t.options[t.selectedIndex].text}.`); }
  if (t.dataset.perm) { T.perms[t.dataset.perm] = t.checked; const s = SOURCES.find(x => x.k === t.dataset.perm); bump(`${s.n} ${t.checked ? 'enabled' : 'turned off'}`); computeCache.clear(); saveTwin(); refreshAll(); toast(`${s.n} ${t.checked ? 'is back on' : 'is now excluded from every recommendation'}.`, t.checked ? 'good' : 'warn'); }
});
function autosize() { const i = $('#chatIn'); i.style.height = 'auto'; i.style.height = Math.min(160, i.scrollHeight) + 'px'; }
document.addEventListener('input', e => {
  const t = e.target;
  if (t.type === 'range') setRange(t, +t.value);
  if (t.id === 'fPass' && authMode === 'up') { const s = strength(t.value); $('#meter').className = 'meter s' + s; }
  if (t.id === 'chatIn') autosize();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); $('#menu').classList.remove('open'); }
  if (e.key === 'Enter' && e.target.id === 'chatIn' && !e.shiftKey) { e.preventDefault(); if (busy) { toast('Your Twin is still answering. Press the stop button to interrupt.', 'warn'); return; } $('#chatForm').requestSubmit(); }
  if (e.key === 'Enter' && e.target.id === 'goalIn') { e.preventDefault(); addGoal(e.target.value); e.target.value = ''; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.trait) { e.preventDefault(); openTrait(e.target.dataset.trait, e.target); }
});
$('#authForm').addEventListener('submit', submitAuth);
$('#ssoBtn').addEventListener('click', ssoClick);
$('#demoBtn').addEventListener('click', async () => {
  const b = $('#demoBtn'); b.disabled = true;
  const acc = demoAccount(); ACC = acc; seedDemo(acc); Auth.setSession(acc.email, true);
  await new Promise(r => setTimeout(r, 350)); b.disabled = false;
  enterApp(acc, false);
});
document.addEventListener('mouseover', e => {
  const tr = e.target.closest && e.target.closest('#insDna [data-trait], #hcDna');
  if (tr) Brain.hover(tr.dataset.trait || (T && topTrait().t.k)); else if (e.target.closest && !e.target.closest('#anchor-ins,#anchor-home,#anchor-auth')) Brain.hover(null);
});
Brain.onHover(idx => {
  const tip = $('#brainTip');
  $$('#insDna .trait').forEach(r => r.classList.toggle('hl', idx >= 0 && r.dataset.trait === TRAITS[idx].k));
  if (idx < 0) { tip.hidden = true; return; }
  const t = TRAITS[idx];
  tip.innerHTML = `<b style="color:${t.col}">${t.reg}</b><div>${t.n}${T ? ` · <b style="display:inline;color:var(--ink)">${T.dna[t.k].v}</b>/100` : ''}</div><small>${T ? traitWord(t.k) + ' · ' : ''}${t.d}</small>`;
  tip.hidden = false;
});
addEventListener('pointermove', e => { const tip = $('#brainTip'); if (!tip.hidden) { tip.style.left = Math.min(e.clientX, innerWidth - 240) + 'px'; tip.style.top = Math.min(e.clientY, innerHeight - 110) + 'px'; } }, { passive: true });
$('#eyeBtn').addEventListener('click', () => { const p = $('#fPass'), show = p.type === 'password'; p.type = show ? 'text' : 'password'; $('#eyeBtn').setAttribute('aria-label', show ? 'Hide password' : 'Show password'); });
$('#forgotBtn').addEventListener('click', () => {
  const email = $('#fEmail').value.trim().toLowerCase(), acc = Auth.accounts()[email];
  if (!email) return fieldErr('Email', 'Enter your email first.');
  if (!acc) return fieldErr('Email', 'No account for this email on this device.');
  confirmBox('Reset password on this device?', 'Passwords are never sent anywhere, so the only way to reset is to set a new one here. Your Twin data is kept.', 'Set a new password', () => {
    openModal(`<div class="h3" style="margin-bottom:12px">New password for ${esc(email)}</div><label class="field"><input id="np" type="password" placeholder=" " autocomplete="new-password"><span>New password</span></label><div class="ferr" id="npE"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-primary" id="npBtn">Save password</button></div>`);
    $('#npBtn').onclick = async () => { const v = $('#np').value; if (strength(v) < 2) { $('#npE').textContent = 'Use at least 8 characters with letters and numbers.'; return; } const all = Auth.accounts(); all[email].hash = await sha256(all[email].salt + ':' + v); Auth.save(all); closeModal(); note('Password updated. Sign in with your new password.', 'good'); };
  });
});
$('#obNext').addEventListener('click', obNext);
$('#obBack').addEventListener('click', () => obGo(Math.max(1, obStep - 1)));
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); if (busy) { busy.ctl.abort(); return; } const i = $('#chatIn'), v = i.value; i.value = ''; autosize(); send(v); });
$('#newChat').addEventListener('click', () => { if (busy) return; T.activeThread = null; const th = thread(); saveTwin(); renderThreads(); renderMsgs(); $('#chatIn').focus(); });
$('#profForm').addEventListener('submit', saveProfile);
$('#gemEye').addEventListener('click', () => { const i = $('#gemKey'), s = i.type === 'password'; i.type = s ? 'text' : 'password'; $('#gemEye').setAttribute('aria-label', s ? 'Hide key' : 'Show key'); });
$('#aiForm').addEventListener('submit', async e => {
  e.preventDefault();
  const key = $('#gemKey').value.trim(), model = $('#gemModel').value.trim() || 'gemini-3.8-flash', fast = $('#gemFast').value.trim() || 'gemini-3.5-flash-lite';
  if (key && !/^[A-Za-z0-9_\-]{20,}$/.test(key)) return toast('That doesn’t look like a Gemini API key. Copy it again from AI Studio.', 'warn');
  Store.set('gemini', { key, model, fast }); AI.state = AI.provider === 'claude' ? 'on' : 'off'; AI.refresh();
  if (!Gemini.key()) return toast('Saved. Add a key to turn on Gemini.');
  if (Gemini.viaProxy() && !key) { const b0 = $('#gemSave'); b0.disabled = true; try { await Gemini.test(); AI.state = 'on'; AI.err = ''; engineBadge(); toast('Connected to Gemini through this site’s server.', 'good'); } catch (err) { AI.fail(err); if (!['bad_key','bad_model'].includes(err.code)) toast(err.message || 'Couldn’t reach the server.', 'warn'); } b0.disabled = false; return; }
  if (AI.provider === 'claude') return toast('Saved. Inside Claude, chat keeps using Claude; the key is used in the downloaded version.');
  const b = $('#gemSave'); b.disabled = true; b.textContent = 'Testing…';
  try { await Gemini.test(); AI.state = 'on'; AI.err = ''; engineBadge(); toast('Gemini is connected. Chat now uses full AI answers.', 'good'); }
  catch (err) { AI.fail(err); if (!['bad_key','bad_model'].includes(err.code)) toast(err.message || 'Couldn’t reach Gemini.', 'warn'); }
  b.disabled = false; b.textContent = 'Save & test';
});
$('#gemClear').addEventListener('click', () => { Store.del('gemini'); $('#gemKey').value = ''; AI.state = 'off'; AI.refresh(); renderSettings(false); toast(Gemini.key() ? 'Browser key removed. A key in config.js is still active.' : 'Gemini key removed. Chat uses the offline engine.'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { Brain.stop(); Stars.stop(); } else { Brain.start(); Stars.start(); } });
let rsz = 0; addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { if (route) moveInd(route); if (route === 'home') drawWires(false); }, 120); });

/* =====================================================================
   BOOT — smooth loader tied to real work
   ===================================================================== */
let loaderDone = false;
(async function boot() {
  const setP = (p, msg) => { $('#ldp').style.strokeDashoffset = 377 * (1 - p); $('#ldn').textContent = Math.round(p * 100) + '%'; if (msg) $('#lds').textContent = msg; };
  setP(.08, 'Waking up your Twin…');
  setRange($('#obHours'), 10); setRange($('#obRisk'), 50);
  try { Stars.init(); Stars.start(); } catch (e) {}
  await new Promise(r => setTimeout(r, 120));
  setP(.2, 'Loading fonts…');
  try { if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  setP(.38, 'Wiring the neural network…');
  await new Promise(r => setTimeout(r, 30));
  Brain.setAnchor(() => anchorFor(route));
  Brain.init(); Brain.start();
  setP(.62, 'Restoring your session…');
  initSSO();
  const sess = Auth.session(), acc = sess ? Auth.accounts()[sess] : null;
  const t0 = performance.now();
  await new Promise(res => { const tick = () => { const p = Brain.ok ? Brain.progress() : 1, el = performance.now() - t0; setP(.62 + .38 * Math.min(p, el / 1800), p > .6 ? 'Almost there…' : null); if ((p >= .98 || !Brain.ok) && el > (REDUCE ? 200 : 1600)) res(); else requestAnimationFrame(tick); }; tick(); });
  setP(1, 'Ready');
  await new Promise(r => setTimeout(r, 250));
  loaderDone = true;
  $('#loader').classList.add('done');
  if (acc) enterApp(acc, false); else { const h = location.hash.slice(1); go('auth'); setAuthMode(h === 'signup' ? 'up' : 'in'); }
})();
</script>
