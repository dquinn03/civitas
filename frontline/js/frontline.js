'use strict';
/* CIVITAS FRONTLINE — field agent terminal.
   Offline-first PWA: IndexedDB queue, Shift Protocol (timestamp + geotag),
   Evidence Cam with Canvas downscale/compression, black-box telemetry,
   AES-GCM encrypted dispatches, Burn Protocol. Zero external dependencies. */

/* ================= tiny IndexedDB layer ================= */

const FDB = (() => {
  const NAME = 'civitas-frontline', VER = 1;
  const STORES = ['missions', 'queue', 'shifts', 'telemetry', 'kv'];
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = () => {
        for (const s of STORES) if (!r.result.objectStoreNames.contains(s))
          r.result.createObjectStore(s, { keyPath: 'k' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function put(store, obj) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(obj);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }
  async function all(store) {
    const db = await open();
    return new Promise((res, rej) => {
      const rq = db.transaction(store, 'readonly').objectStore(store).getAll();
      rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error);
    });
  }
  async function del(store, key) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }
  return { put, all, del, NAME };
})();

/* ================= helpers ================= */

const id = (p = 'id') => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtT = ts => ts ? new Date(ts).toLocaleString('en-AU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDur = s => { s = Math.max(0, Math.round(s)); const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0; return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; };

function toast(msg, kind = 'info') {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = `toast toast-${kind}`; t.textContent = msg;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3200);
}

function modal(title, bodyHTML, actions) {
  const root = document.getElementById('modal-root');
  const ov = document.createElement('div'); ov.className = 'modal-overlay';
  const box = document.createElement('div'); box.className = 'modal-box';
  box.innerHTML = `<div class="modal-title">${esc(title)}</div><div class="modal-body">${bodyHTML}</div><div class="modal-actions"></div>`;
  const close = () => ov.remove();
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.cls || '');
    b.textContent = a.label;
    b.addEventListener('click', () => a.fn ? a.fn(close, box) : close());
    box.querySelector('.modal-actions').appendChild(b);
  }
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.appendChild(box); root.appendChild(ov);
  return { box, close };
}

/* ================= black box telemetry =================
   Silent UI-interaction timestamps proving agent presence across the shift.
   Persisted in batches; summarised (capped) into each dispatch. */

const Tel = (() => {
  let buf = [];
  function log(action) {
    buf.push({ k: id('t'), t: Date.now(), a: action });
    if (buf.length >= 10) flush();
  }
  async function flush() {
    const items = buf; buf = [];
    for (const e of items) await FDB.put('telemetry', e).catch(() => {});
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  // passive global tap capture — presence proof, not content surveillance
  document.addEventListener('click', e => {
    const t = e.target.closest('button');
    log(t ? ('tap:' + (t.textContent || '').trim().slice(0, 18)) : 'tap');
  }, true);
  return { log, flush, all: () => FDB.all('telemetry') };
})();

/* ================= agent identity ================= */

function agent() {
  try { return JSON.parse(localStorage.getItem('fl-agent')) || null; } catch { return null; }
}
function saveAgent(a) { localStorage.setItem('fl-agent', JSON.stringify(a)); }

function setupFlow() {
  modal('AGENT SETUP', `
    <p class="dim">One-time setup. Your handle is what HQ sees — keep it consistent.</p>
    <input class="inp" id="su-handle" placeholder="Field handle (e.g. lachlan-01)">`,
    [{
      label: 'ACTIVATE', cls: 'btn-amber', fn: (close, box) => {
        const h = box.querySelector('#su-handle').value.trim();
        if (!h) { toast('Handle required', 'warn'); return; }
        saveAgent({ id: id('agt'), handle: h, activated: Date.now() });
        close(); boot();
      }
    }]);
}

/* ================= shift protocol ================= */

function currentShift() {
  try { return JSON.parse(localStorage.getItem('fl-shift')) || null; } catch { return null; }
}

async function toggleShift() {
  const cur = currentShift();
  if (!cur) {
    const shift = { k: id('shf'), start: Date.now(), end: null, geo: null, synced: false };
    // geotag where permitted — never block the shift on it
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          shift.geo = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy };
          localStorage.setItem('fl-shift', JSON.stringify(shift));
          FDB.put('shifts', shift);
        },
        () => {}, { timeout: 6000, maximumAge: 600000 });
    }
    localStorage.setItem('fl-shift', JSON.stringify(shift));
    await FDB.put('shifts', shift);
    Tel.log('shift:start');
    toast('Shift started — clock is running', 'ok');
  } else {
    cur.end = Date.now();
    await FDB.put('shifts', cur);
    localStorage.removeItem('fl-shift');
    Tel.log('shift:end');
    toast('Shift ended: ' + fmtDur((cur.end - cur.start) / 1000), 'ok');
  }
  renderShift();
}

function renderShift() {
  const bar = document.getElementById('shift-bar');
  const cur = currentShift();
  bar.classList.toggle('shift-on', !!cur);
  document.getElementById('shift-label').textContent = cur ? '● ON SHIFT' : 'OFF SHIFT';
  document.getElementById('shift-btn').textContent = cur ? 'END SHIFT' : 'START SHIFT';
  document.getElementById('shift-time').textContent = cur
    ? 'since ' + fmtT(cur.start) + (cur.geo ? ' · 📍 locked' : '') : 'hours are bounded by Start/End';
}

/* ================= evidence cam: canvas compression =================
   Forcefully downscale + re-encode so a dispatch with photos stays << 2MB.
   Steps quality down until the Base64 fits the budget. */

async function compressImage(file, maxDim = 1280, targetB64 = 400_000) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    let q = 0.8, out = canvas.toDataURL('image/jpeg', q);
    while (out.length > targetB64 && q > 0.35) {
      q -= 0.1;
      out = canvas.toDataURL('image/jpeg', q);
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

/* ================= mission pack import & queue ================= */

async function importPackFile(file) {
  try {
    const pack = JSON.parse(await file.text());
    if (pack.kind !== 'civitas-missionpack' || !Array.isArray(pack.missions)) {
      toast('Not a Civitas mission pack', 'error'); return;
    }
    for (const m of pack.missions) {
      await FDB.put('missions', { k: m.id, ...m, packId: pack.packId, receivedAt: Date.now() });
    }
    Tel.log('pack:import');
    toast(`Briefing received: ${pack.missions.length} missions from ${pack.hq || 'HQ'}`, 'ok');
    renderView();
  } catch (e) { toast('Pack import failed: ' + e.message, 'error'); }
}

async function completedSet() {
  return new Set((await FDB.all('queue')).map(q => q.missionId));
}

async function completeMission(m) {
  if (!currentShift()) { toast('Start your shift first — hours must be bounded', 'warn'); return; }
  const t = (m.constraints && m.constraints.type) || 'trust';
  if (t === 'evidence') return evidenceFlow(m);
  if (t === 'challenge') return challengeFlow(m);
  modal('CONFIRM — TRUST BASED', `<p><strong>${esc(m.text)}</strong></p><p class="dim">Completion is on your word. HQ audits patterns, not people.</p>`, [
    { label: 'BACK', fn: c => c() },
    { label: 'MARK DONE', cls: 'btn-amber', fn: c => { c(); queueCompletion(m, null); } },
  ]);
}

function evidenceFlow(m) {
  /* capture="environment" forces the live camera (where the platform honours it),
     blocking camera-roll uploads of recycled photos */
  const { box } = modal('EVIDENCE REQUIRED', `
    <p><strong>${esc(m.text)}</strong></p>
    <input type="file" id="ev-cam" accept="image/*" capture="environment" class="inp">
    <div id="ev-prev"></div>
    <input class="inp" id="ev-note" placeholder="Text receipt (optional)">`,
    [
      { label: 'BACK', fn: c => c() },
      {
        label: 'SUBMIT', cls: 'btn-amber', fn: (close, bx) => {
          const img = bx.querySelector('#ev-prev img');
          const note = bx.querySelector('#ev-note').value.trim();
          if (!img && !note) { toast('Capture a photo or write a receipt', 'warn'); return; }
          close();
          queueCompletion(m, { img: img ? img.src : null, note: note || null });
        }
      },
    ]);
  box.querySelector('#ev-cam').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    toast('Compressing photo…');
    const data = await compressImage(f);
    box.querySelector('#ev-prev').innerHTML =
      `<img src="${data}" class="ev-thumb"><div class="dim">${(data.length / 1024).toFixed(0)} KB encoded</div>`;
  });
}

function challengeFlow(m) {
  modal('CHALLENGE GATE', `
    <p><strong>${esc(m.text)}</strong></p>
    <p class="dim">Enter the verification input issued with this mission.</p>
    <input class="inp" id="ch-in" placeholder="Challenge answer">`,
    [
      { label: 'BACK', fn: c => c() },
      {
        label: 'VERIFY', cls: 'btn-amber', fn: async (close, bx) => {
          const v = bx.querySelector('#ch-in').value.trim().toLowerCase();
          const hash = await CivCrypto.sha256hex(v);
          if (hash !== (m.constraints && m.constraints.challengeHash)) {
            Tel.log('challenge:fail');
            toast('Verification failed', 'error'); return;
          }
          close();
          queueCompletion(m, { note: 'challenge passed', img: null });
        }
      },
    ]);
}

async function queueCompletion(m, evidence) {
  await FDB.put('queue', {
    k: id('cmp'), missionId: m.id, text: m.text, constraintType: (m.constraints && m.constraints.type) || 'trust',
    ts: Date.now(), evidence, synced: false,
  });
  Tel.log('mission:done');
  toast('Logged. Queued for next dispatch.', 'ok');
  renderView();
}

/* ================= POCKET MMT — analog/digital bridge =================
   Digital rebuttals matching the printed "Old Way vs New Way" campaign cards. */

const MMT_CARDS = [
  { n: '01', t: 'The Taxpayer Dollar', old: 'Federal spending is funded by taxpayer money — every dollar spent is a dollar taken from you first.',
    neu: 'A currency-issuing government spends its currency into existence first; taxes then delete money and anchor its value. Taxes make room for spending — they don\'t fund it.' },
  { n: '02', t: 'The Credit Card', old: 'The government has maxed out the national credit card and is borrowing against your future.',
    neu: 'The issuer of the Australian dollar cannot run out of Australian dollars. The real limits are inflation and real resources — workers, materials, energy — never the account balance.' },
  { n: '03', t: 'Debt on the Grandkids', old: 'Government debt is a burden our grandchildren will have to pay back.',
    neu: 'Government "debt" is the non-government sector\'s savings — the grandkids inherit the bonds too. The real burden we can leave them is run-down hospitals, schools and a degraded environment.' },
  { n: '04', t: 'Basic Income', old: '"We simply can\'t afford decent income support — where would the money come from?"',
    neu: 'Affordability is about real capacity, not money. The strongest income floor is a Job Guarantee: a buffer stock of employed people that anchors prices while guaranteeing a living income — pure income support can then top up where work isn\'t the answer.' },
  { n: '05', t: 'Printing Money', old: 'Creating money always ends in Zimbabwe-style hyperinflation.',
    neu: 'ALL government spending is money creation; all taxation is money deletion. Inflation arrives when spending outruns real capacity — Zimbabwe and Weimar were capacity collapses first, monetary events second.' },
  { n: '06', t: 'The Household Budget', old: 'The government must live within its means, just like a household.',
    neu: 'A household USES the currency; Australia ISSUES it. The household analogy is a category error — the issuer\'s "means" are the nation\'s real resources, not a bank balance.' },
  { n: '07', t: 'Bond Vigilantes', old: 'If deficits grow, the markets will punish us with unpayable interest rates.',
    neu: 'For a floating, own-currency issuer like Australia the central bank sets the rate structure. Sovereign yields reflect policy stance, not credit risk — the "vigilantes" ride on terms the RBA writes.' },
  { n: '08', t: 'Unemployment is Natural', old: 'A pool of unemployment is the natural, necessary cost of keeping inflation low.',
    neu: 'Keeping people jobless is a policy choice that uses human lives as the price anchor. A buffer stock of EMPLOYED people — a Job Guarantee — anchors prices better and keeps communities like ours working.' },
];

/* ================= dispatch (field -> HQ) ================= */

async function buildDispatch() {
  const a = agent();
  const queue = (await FDB.all('queue')).filter(q => !q.synced);
  if (!queue.length) { toast('Nothing in the queue to dispatch', 'warn'); return; }
  const shifts = (await FDB.all('shifts')).sort((x, y) => y.start - x.start);
  const shift = shifts[0] || null;
  await Tel.flush();
  const tel = (await FDB.all('telemetry')).sort((x, y) => x.t - y.t);

  const payload = {
    v: 1, kind: 'civitas-dispatch',
    dispatchId: id('dsp'), agentId: a.id, handle: a.handle, created: Date.now(),
    shift: shift ? { start: shift.start, end: shift.end || Date.now(), geo: shift.geo } : null,
    completions: queue.map(q => ({ missionId: q.missionId, text: q.text, constraintType: q.constraintType, ts: q.ts, evidence: q.evidence })),
    telemetry: {
      count: tel.length,
      first: tel[0] ? tel[0].t : null,
      last: tel.length ? tel[tel.length - 1].t : null,
      events: tel.slice(-500).map(e => ({ t: e.t, a: e.a })),
    },
  };

  modal('ENCRYPT & DISPATCH', `
    <div class="stat-row"><span>Completions</span><b>${queue.length}</b></div>
    <div class="stat-row"><span>Telemetry events</span><b>${tel.length}</b></div>
    <div class="stat-row"><span>Shift</span><b>${shift ? fmtDur(((shift.end || Date.now()) - shift.start) / 1000) : 'none ⚠'}</b></div>
    <p class="dim">The dispatch is sealed with AES-GCM before it leaves this device. Drop the file into the shared sync folder.</p>
    <input type="password" class="inp" id="dsp-pass" placeholder="HQ passphrase" autocomplete="off">`,
    [
      { label: 'BACK', fn: c => c() },
      {
        label: 'SEAL & EXPORT', cls: 'btn-amber', fn: async (close, bx) => {
          const pass = bx.querySelector('#dsp-pass').value;
          if (pass.length < 4) { toast('Passphrase required (4+ chars)', 'warn'); return; }
          close();
          toast('Encrypting…');
          try {
            const sealed = await CivCrypto.encrypt(payload, pass);
            const json = JSON.stringify(sealed);
            const name = `dispatch-${a.handle}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`;
            const blob = new Blob([json], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob); link.download = name;
            document.body.appendChild(link); link.click(); link.remove();
            for (const q of queue) { q.synced = true; await FDB.put('queue', q); }
            Tel.log('dispatch:sealed');
            toast(`Sealed ${(json.length / 1024).toFixed(0)} KB → ${name}`, 'ok');
            renderView();
          } catch (e) { toast('Encryption failed: ' + e.message, 'error'); }
        }
      },
    ]);
}

/* ================= burn protocol ================= */

function burnFlow() {
  modal('⚠ BURN PROTOCOL', `
    <p><b>This erases everything on this device instantly:</b> missions, queue, shifts, telemetry, identity. There is no undo.</p>
    <p class="dim">Type <b>BURN</b> to arm.</p>
    <input class="inp" id="burn-in" autocomplete="off" autocapitalize="characters">`,
    [
      { label: 'STAND DOWN', fn: c => c() },
      {
        label: 'EXECUTE', cls: 'btn-danger', fn: async (close, bx) => {
          if (bx.querySelector('#burn-in').value.trim().toUpperCase() !== 'BURN') { toast('Not armed — type BURN', 'warn'); return; }
          close();
          try {
            indexedDB.deleteDatabase(FDB.NAME);
            localStorage.clear();
            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
            }
          } finally {
            document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font-family:monospace;color:#6fc28a;background:#0d0f14">TERMINAL CLEAN.</div>';
            setTimeout(() => location.reload(), 1500);
          }
        }
      },
    ]);
}

/* ================= views ================= */

let view = 'missions';

async function renderView() {
  const host = document.getElementById('view');
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('nav-active', b.dataset.view === view));

  if (view === 'missions') {
    const missions = await FDB.all('missions');
    const done = await completedSet();
    host.innerHTML = `
      <div class="card">
        <h3>Receive briefing</h3>
        <p class="dim">Load a mission pack JSON from the shared sync folder.</p>
        <input type="file" id="pack-in" accept=".json" class="inp">
      </div>
      ${missions.map(m => `
        <div class="card msn-card ${done.has(m.id) ? 'done' : ''}">
          <h3>${esc(m.text)}</h3>
          <div>
            <span class="chip chip-${m.priority}">${(m.priority || 'medium').toUpperCase()}</span>
            <span class="chip">${esc((m.constraints && m.constraints.type || 'trust').toUpperCase())}</span>
            <span class="chip">${esc(m.sector || 'GENERAL')}</span>
            ${m.due ? `<span class="chip">DUE ${esc(m.due)}</span>` : ''}
            ${done.has(m.id) ? '<span class="chip chip-done">✓ QUEUED</span>' : ''}
          </div>
          ${done.has(m.id) ? '' : `<div class="msn-actions"><button class="btn btn-amber btn-block" data-do="${m.k}">COMPLETE</button></div>`}
        </div>`).join('') || '<div class="card"><p class="dim">No missions on device. Import a pack above.</p></div>'}`;
    host.querySelector('#pack-in').addEventListener('change', e => {
      if (e.target.files[0]) importPackFile(e.target.files[0]);
      e.target.value = '';
    });
    host.querySelectorAll('[data-do]').forEach(b => b.addEventListener('click', async () => {
      const m = (await FDB.all('missions')).find(x => x.k === b.dataset.do);
      if (m) completeMission(m);
    }));

  } else if (view === 'mmt') {
    host.innerHTML = `
      <div class="card"><h3>Pocket MMT</h3>
      <p class="dim">Digital rebuttals matching the printed campaign cards. Old Way is what they'll say at the door — New Way is your answer.</p></div>
      ${MMT_CARDS.map(c => `
        <div class="acc">
          <button class="acc-head"><span><span class="num">${c.n}</span>${esc(c.t)}</span><span>▾</span></button>
          <div class="acc-body">
            <div class="oldway"><b>OLD WAY:</b> ${esc(c.old)}</div>
            <div class="newway"><b>NEW WAY:</b> ${esc(c.neu)}</div>
          </div>
        </div>`).join('')}`;
    host.querySelectorAll('.acc-head').forEach(h =>
      h.addEventListener('click', () => h.parentElement.classList.toggle('acc-open')));

  } else if (view === 'dispatch') {
    const queue = await FDB.all('queue');
    const unsynced = queue.filter(q => !q.synced);
    host.innerHTML = `
      <div class="card">
        <h3>Dispatch queue</h3>
        <div class="stat-row"><span>Queued (unsent)</span><b>${unsynced.length}</b></div>
        <div class="stat-row"><span>Already dispatched</span><b>${queue.length - unsynced.length}</b></div>
      </div>
      ${unsynced.map(q => `
        <div class="card">
          <h3>${esc(q.text)}</h3>
          <div class="dim">${fmtT(q.ts)} · ${esc(q.constraintType)}</div>
          ${q.evidence && q.evidence.img ? `<img class="ev-thumb" src="${q.evidence.img}">` : ''}
          ${q.evidence && q.evidence.note ? `<div class="dim">“${esc(q.evidence.note)}”</div>` : ''}
        </div>`).join('')}
      <button class="btn btn-amber btn-big btn-block" id="dsp-go">⇪ ENCRYPT & DISPATCH</button>`;
    host.querySelector('#dsp-go').addEventListener('click', buildDispatch);

  } else if (view === 'sys') {
    const a = agent();
    const tel = await FDB.all('telemetry');
    host.innerHTML = `
      <div class="card">
        <h3>Agent</h3>
        <div class="stat-row"><span>Handle</span><b>${esc(a.handle)}</b></div>
        <div class="stat-row"><span>ID</span><b>${esc(a.id)}</b></div>
        <div class="stat-row"><span>Telemetry events held</span><b>${tel.length}</b></div>
        <div class="stat-row"><span>Mode</span><b id="sys-mode">${navigator.onLine ? 'ONLINE' : 'OFFLINE (black spot)'}</b></div>
      </div>
      <div class="card">
        <h3>Field doctrine</h3>
        <p class="dim">1. Start the shift before you start the work.<br>
        2. Evidence beats memory — capture as you go.<br>
        3. Dispatch from a connected location; the queue holds offline forever.<br>
        4. If the device is at risk: burn first, explain later.</p>
      </div>
      <button class="btn-burn" id="burn-btn">🔥 BURN PROTOCOL</button>`;
    host.querySelector('#burn-btn').addEventListener('click', burnFlow);
  }
}

/* ================= boot ================= */

function bindChrome() {
  document.getElementById('shift-btn').addEventListener('click', toggleShift);
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.addEventListener('click', () => { view = b.dataset.view; renderView(); }));
  const dot = document.getElementById('net-dot');
  const net = () => dot.classList.toggle('net-off', !navigator.onLine);
  window.addEventListener('online', net); window.addEventListener('offline', net); net();
}

function boot() {
  const a = agent();
  if (!a) return setupFlow();
  document.getElementById('hdr-agent').textContent = a.handle.toUpperCase();
  renderShift();
  renderView();
}

window.addEventListener('DOMContentLoaded', () => {
  bindChrome();
  boot();
  // Service worker: offline-first in regional black spots (needs http(s), not file://)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW failed', e));
  }
});
