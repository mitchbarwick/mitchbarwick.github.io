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
  avatar.style.transform = `translate(${av.x}px,${av.y}px) rotate(${av.x * .03}deg)`;
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

/* ---------- double diamond: discover -> define -> develop -> deliver ---------- */
const ddUpdate = (() => {
  const el = $('#dd'); if (!el) return () => {};
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mk = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; };
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = x => (x = cl(x), x * x * (3 - 2 * x));
  const out = x => 1 - Math.pow(1 - cl(x), 3);
  const mix = (a, b, k) => a + (b - a) * k;
  const INK = '#262626', T = 26;

  // soft-cornered double diamond
  const D1 = [[14, 150], [215, 30], [417, 150], [215, 270]], D2 = [[383, 150], [585, 30], [786, 150], [585, 270]];
  const rounded = (pts, c) => pts.map((P, i) => {
    const A = pts[(i + pts.length - 1) % pts.length], B = pts[(i + 1) % pts.length];
    const u = Q => { const dx = Q[0] - P[0], dy = Q[1] - P[1], l = Math.hypot(dx, dy); return [dx / l, dy / l, l]; };
    const ua = u(A), ub = u(B), ca = Math.min(c, ua[2] / 2.2), cb = Math.min(c, ub[2] / 2.2);
    return `${i ? 'L' : 'M'}${(P[0] + ua[0] * ca).toFixed(1)} ${(P[1] + ua[1] * ca).toFixed(1)}Q${P[0]} ${P[1]} ${(P[0] + ub[0] * cb).toFixed(1)} ${(P[1] + ub[1] * cb).toFixed(1)}`;
  }).join('') + 'Z';
  const outline = $('#ddOutline');
  outline.setAttribute('d', rounded(D1, 38) + rounded(D2, 38));
  $('#ddClipPath').setAttribute('d', rounded(D1, 38));
  const olen = outline.getTotalLength(); outline.style.strokeDasharray = olen;
  // half-height of the diamonds at x (keeps bubbles inside the outline)
  const d1 = x => x < 14 || x > 417 ? 0 : x <= 215 ? 120 * (x - 14) / 201 : 120 * (417 - x) / 202;
  const d2 = x => x < 383 || x > 786 ? 0 : x <= 585 ? 120 * (x - 383) / 202 : 120 * (786 - x) / 201;
  const half = x => Math.max(d1(x), d2(x));
  const Y = (x, v) => 150 + v * half(x) * .72;

  const pick = $('#ddPick'), ripple = $('#ddRipple'), cube = $('#ddCube'), thread = $('#ddThread');
  const scanG = $('#ddScanG'), scan = $('#ddScan'), trail = $('#ddTrailRect');
  const phs = $$('.ph', el);

  // ---- diamond 1: problems are scanned, grouped, ranked; the top three merge into one ----
  const G0 = [[110, 113], [150, 192], [225, 150], [285, 108], [285, 196]];      // where each group first gathers
  const RANK = [2, 4, 0, 3, 1];                                                    // group -> priority rank (0 = best)
  const SLOT = [352, 298, 244, 190, 136], SR = [13, 17, 20, 22, 22];               // sorted slot x and cluster radius per rank
  const VAL = [1.35, 1.2, 1.05, .85, .7], VOP = [.95, .85, .75, .5, .4];
  const probs = [];
  for (let k = 0; k < 45; k++) {
    const g = k % 5, ang = rnd() * 6.283, rad = Math.sqrt(rnd());
    const hx = 80 + rnd() * 260;
    probs.push({ g, rank: RANK[g], tb: .9 + rnd() * 1.7, hx, hv: rnd() * 2 - 1, gd: rnd() * .3, r: 2.6 + rnd() * 3, ph: rnd() * 6.28, ox: Math.cos(ang) * rad, oy: Math.sin(ang) * rad,
      node: mk('circle', { class: 'pb', r: 3, fill: INK, 'fill-opacity': 0 }, $('#ddProblems')) });
  }
  // ---- diamond 2: ideas are created, each is held up against the problem, one fits ----
  const shapes = r => [`M${-r} ${-r}H${r}V${r}H${-r}Z`, `M0 ${-r * 1.2}L${r * 1.1} ${r * .9}H${-r * 1.1}Z`, `M${-r} 0L0 ${-r}L${r} 0L0 ${r}Z`, `M${-r * .35} ${-r}H${r * .35}V${-r * .35}H${r}V${r * .35}H${r * .35}V${r}H${-r * .35}V${r * .35}H${-r}V${-r * .35}H${-r * .35}Z`];
  const SLOT2 = [455, 150], WIN = 5, CW = .62, C0 = 15;
  const ideas = [];
  for (let j = 0; j < 28; j++) {
    const cand = j < 6 ? (j === 0 ? WIN : j - 1) : -1;     // j=0 is the winner, j=1..5 are the rejected candidates tested before it
    const r = j === 0 ? 5 : 3 + rnd() * 3;
    ideas.push({ cand, tc: 12 + rnd() * 1.6, hx: cand >= 0 ? 485 + rnd() * 190 : 450 + rnd() * 250, hv: rnd() * 2 - 1, ph: rnd() * 6.28, rot: (rnd() - .5) * 1.4, tf: 15.2 + rnd() * 2.4,
      node: mk('path', { class: 'id', d: shapes(r)[j === 0 ? 0 : j % 4] }, $('#ddIdeas')) });
  }
  const label = (i, on) => phs[i] && phs[i].classList.toggle('on', on);
  let t = 0, last = null;
  return (now, active) => {
    if (!active) { last = null; return; }
    if (last === null) last = now;
    t += Math.min(now - last, .25); last = now;
    const tt = reduce ? 22 : t % T;
    const g = 1 - ease((tt - 24.2) / 1.4);                  // loop fade-out
    outline.style.strokeDashoffset = olen * (1 - ease(tt / 2.4));
    label(0, tt >= .9 && tt < 6.8); label(1, tt >= 6.8 && tt < 12); label(2, tt >= 12 && tt < 15); label(3, tt >= 15 && tt < 24.2);

    // scanning band sweeps across the problems
    const sx = 30 + 400 * cl((tt - 4.8) / 2);
    scanG.setAttribute('opacity', (tt > 4.7 && tt < 7.3 ? Math.min(1, (tt - 4.7) * 4, (7.3 - tt) * 3) : 0).toFixed(2));
    scan.setAttribute('x1', sx.toFixed(1)); scan.setAttribute('x2', sx.toFixed(1)); trail.setAttribute('x', (sx - 80).toFixed(1));

    // problems: jettison -> scan -> group -> sort by priority -> cull -> merge
    const oe = ease((tt - 8.2) / 1.4);
    for (const p of probs) {
      const a = out((tt - p.tb) / 2.4);
      const wob = 1 - ease((tt - 6.8) / 1);
      const hx = p.hx + Math.sin(tt * .8 + p.ph) * 7 * a * wob, hy = Y(p.hx, p.hv) + Math.sin(tt * .6 + p.ph * 2) * 5 * a * wob;
      let x = mix(40, hx, a), y = mix(150, hy, a);
      // group
      const ge = ease((tt - 6.8 - p.gd) / 1.3);
      const sl = SLOT[p.rank], cr = mix(18, SR[p.rank], oe);
      const me = ease((tt - 10.5 - p.rank * .1) / 1.4);
      const ax = mix(mix(G0[p.g][0], sl, oe), 400, me), ay = mix(mix(G0[p.g][1], 150, oe), 150, me);
      const sc = 1 - me;
      x = mix(x, ax + p.ox * cr * sc, ge); y = mix(y, ay + p.oy * cr * sc, ge);
      // scan: ping as the band passes, then carry its measured value (size + weight)
      const k = tt - (4.8 + (p.hx - 30) / 400 * 2);
      const ping = k > 0 ? Math.exp(-k * 4) : 0, val = k > 0 ? ease(k / .5) : 0;
      const r = p.r * mix(1, VAL[p.rank], val) * (1 + .8 * ping);
      let op = mix(.7, VOP[p.rank], val) * Math.min(a * 3, 1) * g;
      if (p.rank > 2) op *= 1 - ease((tt - 9.7) / .8);
      op *= 1 - ease((me - .55) / .45);                  // dissolves into the merged bubble
      p.node.setAttribute('cx', x.toFixed(1)); p.node.setAttribute('cy', y.toFixed(1)); p.node.setAttribute('r', r.toFixed(2));
      p.node.setAttribute('opacity', op.toFixed(2)); p.node.setAttribute('fill-opacity', (ping * .6).toFixed(2));
    }
    // the merged problem
    const pa = ease((tt - 11.7) / .6);
    pick.setAttribute('r', (4 + 5 * pa + (tt > 15 && tt < 18.6 ? Math.sin(tt * 9) * .8 : 0)).toFixed(2));
    pick.setAttribute('opacity', (pa * g).toFixed(2));
    const r1 = cl((tt - 11.7) / 1.5), r2 = cl((tt - 18.4) / 1.5), rp = r1 > 0 && r1 < 1 ? r1 : r2 > 0 && r2 < 1 ? r2 : 0;
    ripple.setAttribute('r', (9 + rp * 44).toFixed(1)); ripple.setAttribute('opacity', (rp ? (1 - rp) * .6 * g : 0).toFixed(2));

    // ideas: created -> held against the problem one by one -> the one that fits goes on
    let tx = 409, top = 0;
    const win = ideas[0], wu = (tt - (C0 + WIN * CW)) / CW;
    const wTravel = ease((tt - 18.8) / 1.5), wx = mix(SLOT2[0], 700, wTravel);
    for (const i of ideas) {
      const a = out((tt - i.tc) / 2.4);
      const wob = i.cand >= 0 ? 1 : 1;
      let x = mix(400, i.hx + Math.sin(tt * .8 + i.ph) * 7 * a, a), y = mix(150, Y(i.hx, i.hv) + Math.sin(tt * .6 + i.ph * 2) * 5 * a, a);
      let op = Math.min(a * 3, 1) * g * .8, rot = tt * 18 * i.rot, sc = 1;
      if (i.cand < 0) op *= 1 - ease((tt - i.tf) / .8);
      else {
        const c = i.cand, u = (tt - (C0 + c * CW)) / CW, ap = ease(u / .35);
        x = mix(x, SLOT2[0], ap); y = mix(y, SLOT2[1], ap); rot *= 1 - ap; op = mix(op, g, ap * .5);
        if (c < WIN) {
          const rj = ease((u - .7) / .3);
          x += rj * 14; y += rj * 18; op *= 1 - rj; if (u > 1) op = 0;
          if (u > .35 && u < .95 && top === 0) { tx = x - 8; top = .25 + .25 * Math.abs(Math.sin(tt * 40)); }
        } else {
          x = mix(x, wx, wTravel); sc = 1 + 1.1 * wTravel; op *= 1 - ease((tt - 19.8) / .8);
          if (u > .35) { tx = x - 8; top = .55; }
        }
      }
      i.node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(rot % 360).toFixed(0)}) scale(${sc.toFixed(2)})`);
      i.node.setAttribute('opacity', op.toFixed(2));
    }
    // the connecting thread follows whichever idea is being tested, then the winner
    const m = ease((tt - 19.8) / .9);
    thread.setAttribute('x2', Math.min(tx, 676).toFixed(1)); thread.setAttribute('opacity', (top * g * (pa > .5 ? 1 : 0)).toFixed(2));
    // the right fit becomes a solid cube
    cube.setAttribute('opacity', (m * g).toFixed(2));
    cube.setAttribute('transform', `translate(700 ${(150 + (m > .99 ? Math.sin(tt * 1.5) * 2 : 0)).toFixed(1)}) scale(${(.55 + .45 * m).toFixed(3)})`);
  };
})();
const ddEl = $('#dd'); let ddVis = false;
if (ddEl) new IntersectionObserver(es => es.forEach(e => ddVis = e.isIntersecting)).observe(ddEl);

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
const rio = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); if (en.target.classList.contains('split') && !reduce) setTimeout(() => en.target.classList.add('live'), 3200); rio.unobserve(en.target); } }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
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
  ddUpdate(now / 1000, ddVis && ddEl.classList.contains('in'));
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
