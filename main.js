(() => {
'use strict';
const TAU = Math.PI * 2;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- global pointer ---------- */
const ptr = { x: innerWidth / 2, y: innerHeight / 2, sx: innerWidth / 2, sy: innerHeight / 2, vx: 0, vy: 0, active: false, down: false };
addEventListener('pointermove', e => {
  ptr.x = e.clientX; ptr.y = e.clientY; ptr.active = true;
}, { passive: true });
addEventListener('pointerdown', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.active = true; ptr.down = true; }, { passive: true });
addEventListener('pointerup', () => { ptr.down = false; }, { passive: true });
document.addEventListener('pointerleave', () => { ptr.active = false; });

let scrollY = scrollY0(), scrollVel = 0, lastScroll = scrollY;
function scrollY0() { return window.scrollY || 0; }

/* ---------- organic outline engine ---------- */
function rng(seed) { let s = seed * 9301 + 49297; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
function harmonics(seed) {
  const r = rng(seed + 1);
  return [2, 3, 4, 5, 7].map((k, i) => ({ k, ph: r() * TAU, sp: (.25 + r() * .5) * (r() < .5 ? -1 : 1), am: 1 / (1 + i * .7) }));
}
const sgnPow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

/* Closed smooth path of an organic superellipse in a 0..1 box.
   o: n (squircle exponent), amp, t, h (harmonics), N, scale, hover, px, py (pointer 0..1) */
function outline(o) {
  const N = o.N || 26, pts = [], e = 2 / o.n, sc = o.scale ?? 1;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU, c = Math.cos(a), s = Math.sin(a);
    let k = 1;
    for (const h of o.h) k += o.amp * h.am * Math.sin(h.k * a + h.ph + o.t * h.sp);
    let x = .5 + .5 * sgnPow(c, e) * k * sc * o.fit;
    let y = .5 + .5 * sgnPow(s, e) * k * sc * o.fit;
    if (o.hover > .001) {            // jelly pull toward pointer
      const dx = o.px - x, dy = o.py - y, d2 = dx * dx + dy * dy;
      const g = o.hover * .06 * Math.exp(-d2 / .08);
      x += dx * g; y += dy * g;
    }
    pts.push(x, y);
  }
  let d = '';
  const P = i => { i = (i + N) % N; return [pts[i * 2], pts[i * 2 + 1]]; };
  for (let i = 0; i < N; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    if (i === 0) d += `M${p1[0].toFixed(4)} ${p1[1].toFixed(4)}`;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(4)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(4)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(4)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(4)} ${p2[0].toFixed(4)} ${p2[1].toFixed(4)}`;
  }
  return d + 'Z';
}

const NS = 'http://www.w3.org/2000/svg';
const shapes = [];   // things updated every frame while visible
const io = new IntersectionObserver(es => es.forEach(en => { en.target.__vis = en.isIntersecting; }), { rootMargin: '120px' });

/* element backgrounds */
$$('[data-blob]').forEach((el, idx) => {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'blob-bg');
  svg.setAttribute('viewBox', '0 0 1 1');
  svg.setAttribute('preserveAspectRatio', 'none');
  const f = document.createElementNS(NS, 'path'); f.setAttribute('class', 'f');
  const s = document.createElementNS(NS, 'path'); s.setAttribute('class', 's');
  svg.append(f, s);
  el.prepend(svg);
  const st = {
    el, f, s, h: harmonics(idx * 3 + 1), n: +el.dataset.n || 4, amp: +el.dataset.amp || .03,
    hover: 0, hoverT: 0, px: .5, py: .5, rect: null, wob: 1, phase: idx * 1.7,
  };
  el.__vis = true; io.observe(el);
  el.addEventListener('pointerenter', () => { st.hoverT = 1; });
  el.addEventListener('pointerleave', () => { st.hoverT = 0; });
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    st.px = (e.clientX - r.left) / r.width; st.py = (e.clientY - r.top) / r.height;
  }, { passive: true });
  st.update = (t) => {
    st.hover = lerp(st.hover, st.hoverT, .03);
    const amp = st.amp * (1 + st.hover * .35);
    const d = outline({ n: st.n, amp, t: t * (1 + st.hover * .25) + st.phase, h: st.h, N: 28, fit: .94, hover: st.hover, px: st.px, py: st.py });
    f.setAttribute('d', d); s.setAttribute('d', d);
  };
  shapes.push(st);
});

/* concentric art in cards */
$$('.art').forEach(svg => {
  const i = +svg.dataset.art, rings = 5, paths = [];
  for (let r = 0; r < rings; r++) { const p = document.createElementNS(NS, 'path'); p.style.opacity = (.55 - r * .09).toFixed(2); svg.appendChild(p); paths.push(p); }
  const st = { el: svg, hs: paths.map((_, r) => harmonics(i * 11 + r * 3)), n: [2.2, 3, 2, 4, 2.6, 3.4][i % 6], px: .5, py: .5, hover: 0, hoverT: 0 };
  svg.__vis = true; io.observe(svg);
  const card = svg.closest('.card');
  card.addEventListener('pointerenter', () => st.hoverT = 1);
  card.addEventListener('pointerleave', () => st.hoverT = 0);
  card.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect();
    st.px = (e.clientX - r.left) / r.width; st.py = (e.clientY - r.top) / r.height;
  }, { passive: true });
  st.update = t => {
    st.hover = lerp(st.hover, st.hoverT, .025);
    paths.forEach((p, r) => p.setAttribute('d', outline({
      n: st.n, amp: .05 + r * .012 + st.hover * .015, t: t * (.8 + st.hover * .2) + r * .6, h: st.hs[r],
      N: 24, fit: .96, scale: .22 + r * .19 + st.hover * r * .008, hover: st.hover * .5 * (r + 1) / rings, px: st.px, py: st.py
    })));
  };
  shapes.push(st);
});

/* ---------- hero avatar ---------- */
const avatar = $('#avatar');
const av = { x: 0, y: 0, tx: 0, ty: 0, hover: 0 };
function updateAvatar(t) {
  const r = avatar.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const dx = (ptr.x - cx) / innerWidth, dy = (ptr.y - cy) / innerHeight;
  av.tx = ptr.active ? dx * 12 : 0; av.ty = ptr.active ? dy * 12 : 0;
  av.x = lerp(av.x, av.tx, .02); av.y = lerp(av.y, av.ty, .02);
  const dist = Math.hypot(ptr.x - cx, ptr.y - cy);
  const near = ptr.active ? clamp(1 - dist / (r.width * .9), 0, 1) : 0;
  av.hover = lerp(av.hover, near, .025);
  avatar.style.transform = `translate(${av.x}px,${av.y - scrollY * .08}px) rotate(${av.x * .03}deg)`;
}

/* ---------- hero name: variable-font letters ---------- */
const letters = [];
$$('#name .w').forEach(w => {
  const txt = w.textContent; w.textContent = '';
  [...txt].forEach(ch => { const s = document.createElement('span'); s.className = 'l'; s.textContent = ch; w.appendChild(s); letters.push(s); });
});
letters.forEach((l, i) => l.style.setProperty('--i', i));
const lstate = letters.map(() => ({ w: 300, soft: 100, y: 0, rot: 0 }));
function updateName(t) {
  if (scrollY > innerHeight * 1.1) return;
  letters.forEach((l, i) => {
    const r = l.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const d = ptr.active ? Math.hypot(ptr.x - cx, (ptr.y - cy) * .7) : 9999;
    const k = Math.exp(-d * d / (2 * 230 * 230)) * .6;
    const idle = .5 + .5 * Math.sin(t * .8 + i * .7);
    const s = lstate[i];
    s.w = lerp(s.w, 240 + idle * 80 + k * 260, .035);
    s.y = 0; s.rot = 0;
    l.style.fontWeight = s.w.toFixed(0);
    l.style.fontVariationSettings = `"SOFT" ${(70 + k * 30).toFixed(0)},"WONK" 0`;
    if (document.documentElement.classList.contains('settled')) l.style.transform = `translateY(${s.y.toFixed(1)}px) rotate(${s.rot.toFixed(2)}deg)`;
  });
}

/* ---------- magnetic elements ---------- */
$$('[data-magnet]').forEach(el => {
  if (!finePointer) return;
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * .08, y = (e.clientY - (r.top + r.height / 2)) * .1;
    el.style.transform = `translate(${x}px,${y}px)`;
    el.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)';
  });
  el.addEventListener('pointerleave', () => { el.style.transition = 'transform 1s cubic-bezier(.2,.8,.2,1)'; el.style.transform = ''; });
});

/* ---------- reveal ---------- */
const rio = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); } }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
$$('.rv').forEach(el => rio.observe(el));

/* ---------- WebGL cloud field ---------- */
const canvas = $('#field');
const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
let glReady = false, uni = {}, trail = [];
const TRAIL = 8;
/* tunable cloud look: [key, label, min, max, step, default, group]. Edit live with /?admin */
const CLOUD_PARAMS = [
  ['speed', 'Drift speed', 0, .15, .001, 0.035, 'Motion'],
  ['morph', 'Morphing (warp)', 0, 3, .01, 2.74, 'Motion'],
  ['pointer', 'Pointer influence', 0, 3, .05, 0.7, 'Motion'],
  ['scale', 'Cloud size (zoom)', .4, 3, .01, 1.56, 'Shape'],
  ['detail', 'Detail / roughness', .25, .75, .01, 0.66, 'Shape'],
  ['coverage', 'Coverage', -.4, .3, .005, -0.255, 'Shape'],
  ['softness', 'Edge softness', .1, 1, .01, 0.36, 'Shape'],
  ['bankSize', 'Bank size', .1, 1, .01, 0.76, 'Shape'],
  ['bankStrength', 'Bank strength', 0, 1.2, .01, 0.67, 'Shape'],
  ['seed', 'Seed', 0, 50, .1, 19.2, 'Shape'],
  ['lightAngle', 'Light angle (°)', 0, 360, 1, 121, 'Light'],
  ['lightDist', 'Light distance', .01, .25, .005, 0.045, 'Light'],
  ['contrast', 'Light contrast', 1, 25, .1, 10.2, 'Light'],
  ['highlight', 'Highlight brightness', 0, 1, .01, 0.46, 'Light'],
  ['shadowDepth', 'Shadow depth', 0, .6, .01, 0.15, 'Light'],
  ['underside', 'Dense underside', 0, 1, .01, 0.88, 'Light'],
  ['opacity', 'Cloud opacity', 0, 1, .01, 0.98, 'Sky'],
  ['skyDark', 'Sky gradient', 0, .1, .001, 0.02, 'Sky'],
  ['grain', 'Film grain', 0, .8, .01, 0.29, 'Sky'],
];
const CLOUD_DEFAULTS = Object.fromEntries(CLOUD_PARAMS.map(r => [r[0], r[5]]));
const cloud = { ...CLOUD_DEFAULTS, ...(() => { try { return JSON.parse(localStorage.getItem('cloudSettings')) || {}; } catch (e) { return {}; } })() };
const applyGrain = () => document.querySelector('.grain').style.opacity = cloud.grain;
applyGrain();
window.__cloud = { params: CLOUD_PARAMS, defaults: CLOUD_DEFAULTS, values: cloud, applyGrain, save() { try { localStorage.setItem('cloudSettings', JSON.stringify(cloud)); } catch (e) {} }, paused: false };
if (/[?&#]admin/.test(location.search + location.hash)) { const sc = document.createElement('script'); sc.src = 'admin.js'; document.body.appendChild(sc); }
if (gl) {
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision highp float;
uniform vec2 uRes;uniform float uTime;uniform float uScroll;uniform vec3 uTrail[${TRAIL}];
${CLOUD_PARAMS.map(r => `uniform float u_${r[0]};`).join('')}

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
float fbm3(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<3;i++){v+=a*noise(p);p=m*p;a*=.5;}return v+.0625;}
// cloud density: warped fbm that drifts and morphs over time
float cloud(vec2 p,float t,vec2 w){
  vec2 q=vec2(fbm3(p*.7+vec2(t*.9,0.)+w),fbm3(p*.7+vec2(5.2,1.3)-vec2(0.,t*.7)));
  float d=fbm(p+u_morph*q+vec2(t*.6,-t*.25)+w*.5);
  float cov=fbm3(p*u_bankSize+vec2(3.1,7.7)+t*.4);   // large-scale coverage: clear gaps vs. banks
  return smoothstep(.3,.3+u_softness,d*.9+cov*u_bankStrength+u_coverage);
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes.y;
  vec2 p=uv*u_scale+vec2(0.,uScroll*.0003)+u_seed*vec2(1.7,2.3);
  float t=uTime;
  // pointer trail gently pushes the clouds
  vec2 w=vec2(0.);
  for(int i=0;i<${TRAIL};i++){
    vec3 tr=uTrail[i];
    vec2 d=uv-tr.xy;float g=exp(-dot(d,d)*9.)*tr.z;
    w+=vec2(-d.y,d.x)*g*.5+d*g*.2;
  }
  w*=u_pointer;
  float d0=cloud(p,t,w);
  // light: compare density toward the light with density here
  float la=radians(u_lightAngle);
  vec2 L=vec2(cos(la),sin(la))*u_lightDist;
  float d1=cloud(p+L,t,w);
  float lit=clamp(.5+(d0-d1)*u_contrast,0.,1.);        // >.5 facing light, <.5 in shade
  float thick=smoothstep(.15,1.,d0);                   // dense cores hold more shadow
  vec3 paper=vec3(.972,.965,.945);
  vec3 beige=vec3(.925,.906,.867);
  vec3 ink=vec3(.15);
  vec3 sky=mix(beige*(1.-u_skyDark),beige,smoothstep(0.,1.,uv.y));
  vec3 bright=mix(paper,vec3(1.),u_highlight);
  vec3 shade=mix(beige,ink,u_shadowDepth);
  vec3 cl=mix(shade,bright,lit);
  cl=mix(cl,mix(beige,shade,.5),thick*u_underside*(1.-lit));
  vec3 col=mix(sky,cl,smoothstep(.02,.55,d0)*u_opacity);
  gl_FragColor=vec4(col,1.);
}`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
  if (v && f) {
    const prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uTime', 'uScroll', 'uTrail', ...CLOUD_PARAMS.map(r => 'u_' + r[0])].forEach(n => uni[n] = gl.getUniformLocation(prog, n));
      glReady = true;
      for (let i = 0; i < TRAIL; i++) trail.push({ x: -5, y: -5, s: 0 });
    }
  }
}
let renderScale = innerWidth < 700 ? .3 : .35;       // fraction of CSS pixels; the clouds are soft, so upscaling is invisible
function resize() {
  canvas.width = Math.max(2, Math.round(innerWidth * renderScale));
  canvas.height = Math.max(2, Math.round(innerHeight * renderScale));
  if (glReady) gl.viewport(0, 0, canvas.width, canvas.height);
  needsDraw = true;
}
let needsDraw = true;
addEventListener('resize', resize); resize();

const trailBuf = new Float32Array(TRAIL * 3);
const calm = { x: .5, y: .5, e: 0, ex: 0, ey: 0 };   // heavily smoothed pointer + "energy" that rises with motion and fades slowly
let ct = 0;                                          // cloud clock: advances by dt * speed so speed changes never jump
function drawField(t, dt) {
  if (!glReady) return;
  if (!__cloud.paused && !frozen) ct += dt * cloud.speed;
  const tx = ptr.x / innerHeight, ty = 1 - ptr.y / innerHeight;
  const k = 1 - Math.pow(.12, dt);                    // slow follow
  calm.x = lerp(calm.x, tx, k); calm.y = lerp(calm.y, ty, k);
  const speed = ptr.active ? clamp(Math.hypot(ptr.vx, ptr.vy) / 40, 0, 1) : 0;
  calm.e = lerp(calm.e, speed, speed > calm.e ? 1 - Math.pow(.3, dt) : 1 - Math.pow(.35, dt));   // gentle rise, ~3s fade
  for (let i = 0; i < TRAIL; i++) {
    const f = i / TRAIL;
    trailBuf[i * 3] = lerp(calm.x, tx, f * .3) - (1 - f) * 0;
    trailBuf[i * 3 + 1] = lerp(calm.y, ty, f * .3);
    trailBuf[i * 3 + 2] = calm.e * .32 * (1 - f);
  }
  gl.uniform2f(uni.uRes, canvas.width, canvas.height);
  gl.uniform1f(uni.uTime, ct);
  for (const r of CLOUD_PARAMS) gl.uniform1f(uni['u_' + r[0]], cloud[r[0]]);
  gl.uniform1f(uni.uScroll, scrollY);
  gl.uniform3fv(uni.uTrail, trailBuf);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/* ---------- loop ---------- */
let last = performance.now(), t = 0, frozen = reduce, fieldAcc = 0, fieldScroll = -1, slow = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (!frozen) t += dt;
  ptr.vx = ptr.x - ptr.sx; ptr.vy = ptr.y - ptr.sy; ptr.sx = ptr.x; ptr.sy = ptr.y;
  scrollY = window.scrollY;
  scrollVel = lerp(scrollVel, clamp(Math.abs(scrollY - lastScroll) / Math.max(dt, .001) * .05, 0, 120), .1); lastScroll = scrollY;

  fieldAcc += dt;
  if (fieldAcc >= 1 / 30 - .002 && (!frozen || needsDraw || scrollY !== fieldScroll)) {
    drawField(t, Math.min(fieldAcc, .1));
    fieldAcc = 0; needsDraw = false; fieldScroll = scrollY;
    // adaptive: if the page can't keep up, shrink the cloud resolution a little
    slow = slow * .95 + (dt > .045 ? 1 : 0) * .05;
    if (slow > .5 && renderScale > .2) { renderScale *= .85; slow = 0; resize(); }
  }
  if (scrollY < innerHeight * 1.3) { updateAvatar(t); updateName(t); }
  for (const s of shapes) if (s.el.__vis) s.update(t);
  if (!frozen || !frame.once) { frame.once = true; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => { last = performance.now(); fieldAcc = 0; });

/* intro */
const vid = $('#avatarVideo');
vid.muted = true; vid.defaultMuted = true; vid.loop = true;
const playVid = () => { if (vid.paused) { const p = vid.play(); p && p.catch(() => {}); } };
playVid();
vid.addEventListener('canplay', playVid);
vid.addEventListener('pause', () => { if (!document.hidden) setTimeout(playVid, 200); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) playVid(); });
['pointerdown', 'touchstart', 'keydown', 'scroll'].forEach(ev => addEventListener(ev, playVid, { passive: true }));
requestAnimationFrame(() => requestAnimationFrame(() => {
  document.documentElement.classList.add('loaded');
  setTimeout(() => document.documentElement.classList.add('settled'), 2200);
}));
})();
