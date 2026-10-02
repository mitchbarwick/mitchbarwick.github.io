/* Cloud admin panel — loaded by main.js when the URL contains ?admin (e.g. /?admin) */
(() => {
  const C = window.__cloud;
  if (!C) return;
  const css = `
#cadmin{position:fixed;top:64px;right:16px;z-index:100;width:300px;max-height:calc(100vh - 88px);overflow:auto;
  background:rgba(248,246,240,.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid rgba(38,38,38,.22);border-radius:14px;padding:14px 16px 16px;color:#262626;
  font:400 11px/1.4 "JetBrains Mono",ui-monospace,Menlo,monospace;letter-spacing:.04em;box-shadow:0 12px 40px rgba(38,38,38,.12)}
#cadmin.min{width:auto;padding:10px 14px;overflow:visible}
#cadmin.min .body{display:none}
#cadmin header{display:flex;justify-content:space-between;align-items:center;text-transform:uppercase;letter-spacing:.08em;font-weight:500}
#cadmin button{font:inherit;text-transform:uppercase;letter-spacing:.06em;color:inherit;background:transparent;
  border:1px solid rgba(38,38,38,.35);border-radius:999px;padding:5px 10px;cursor:pointer}
#cadmin button:hover{background:#262626;color:#f1ede4}
#cadmin h4{font:inherit;text-transform:uppercase;letter-spacing:.08em;color:#5d5b57;margin:16px 0 6px;font-weight:400}
#cadmin label{display:grid;grid-template-columns:1fr auto;gap:2px 8px;margin:7px 0}
#cadmin output{color:#5d5b57;font-variant-numeric:tabular-nums}
#cadmin input[type=range]{grid-column:1/-1;width:100%;accent-color:#262626;height:16px}
#cadmin .row{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
#cadmin .msg{margin-top:8px;color:#5d5b57;min-height:1.4em}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const el = document.createElement('aside'); el.id = 'cadmin';
  el.innerHTML = '<header><span>Cloud settings</span><button data-act="min" aria-label="Collapse panel">–</button></header><div class="body"></div>';
  document.body.appendChild(el);
  const body = el.querySelector('.body');
  const inputs = {};
  let group = '';
  const fmt = (v, step) => (+v).toFixed(step < .01 ? 3 : step < 1 ? 2 : 0);
  for (const [key, label, min, max, step, , g] of C.params) {
    if (g !== group) { group = g; const h = document.createElement('h4'); h.textContent = g; body.appendChild(h); }
    const l = document.createElement('label');
    l.innerHTML = `<span>${label}</span><output></output><input type="range" min="${min}" max="${max}" step="${step}">`;
    const inp = l.querySelector('input'), out = l.querySelector('output');
    inp.value = C.values[key]; out.textContent = fmt(C.values[key], step);
    inp.addEventListener('input', () => {
      C.values[key] = +inp.value; out.textContent = fmt(inp.value, step);
      if (key === 'grain') C.applyGrain();
      C.save();
    });
    inputs[key] = [inp, out, step];
    body.appendChild(l);
  }
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = '<button data-act="pause">Pause</button><button data-act="reset">Reset</button><button data-act="copy">Copy JSON</button><button data-act="paste">Paste JSON</button>';
  const msg = document.createElement('div'); msg.className = 'msg';
  body.append(row, msg);
  const say = t => { msg.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => msg.textContent = '', 3000); };
  const sync = () => { for (const k in inputs) { const [i, o, s] = inputs[k]; i.value = C.values[k]; o.textContent = fmt(C.values[k], s); } C.applyGrain(); C.save(); };
  el.addEventListener('click', async e => {
    const act = e.target.dataset.act; if (!act) return;
    if (act === 'min') { el.classList.toggle('min'); e.target.textContent = el.classList.contains('min') ? '+' : '–'; }
    if (act === 'pause') { C.paused = !C.paused; e.target.textContent = C.paused ? 'Play' : 'Pause'; }
    if (act === 'reset') { Object.assign(C.values, C.defaults); sync(); say('Reset to defaults'); }
    if (act === 'copy') {
      const json = JSON.stringify(C.values, null, 2);
      try { await navigator.clipboard.writeText(json); say('Copied — paste it to Claude to bake in'); } catch (_) { prompt('Copy settings:', json); }
    }
    if (act === 'paste') {
      const t = prompt('Paste settings JSON:'); if (!t) return;
      try { const o = JSON.parse(t); for (const k in C.defaults) if (typeof o[k] === 'number') C.values[k] = o[k]; sync(); say('Applied'); } catch (_) { say('Invalid JSON'); }
    }
  });
})();
