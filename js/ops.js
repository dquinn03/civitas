'use strict';
/* CIVITAS ops.js — Module B: Unified Command.
   Mission validation constraints (trust / evidence / challenge), natural-language
   due dates, standing orders with streaks that reset at midnight, Chart.js
   campaign health dashboards, focus timer, mission pack broadcast to the Dropzone. */

const Ops = (() => {

  const $ = id => document.getElementById(id);
  let charts = {};
  let focus = { running: false, startTs: 0, accum: 0, tick: null };

  const PRIORITY_XP = { high: 30, medium: 20, low: 10 };

  function missions() { return Data.state.missions; }

  /* ---------- create ---------- */

  async function createMission() {
    const raw = $('ops-text').value.trim();
    if (!raw) { U.toast('Describe the mission first', 'warn'); return; }
    const { date, cleaned } = U.parseNaturalDate(raw);
    const ctype = $('ops-constraint').value;
    const m = {
      id: U.id('msn'),
      text: cleaned,
      priority: $('ops-priority').value,
      constraints: { type: ctype },
      sector: ($('ops-sector').value.trim() || 'GENERAL').toUpperCase(),
      due: date,
      completed: false, completedAt: null, completedBy: null, evidence: null,
      isStandingOrder: $('ops-standing').checked,
      lastCompletedDate: null, streak: 0,
      timestamp: Date.now(), broadcastAt: null,
    };
    if (ctype === 'challenge') {
      const answer = $('ops-challenge').value.trim();
      if (!answer) { U.toast('Challenge missions need a pass-answer', 'warn'); return; }
      m.constraints.challengeHash = await CivCrypto.sha256hex(answer.toLowerCase());
    }
    missions().push(m);
    Data.logActivity('HQ', 'MISSION_CREATED', m.text.slice(0, 80));
    $('ops-text').value = ''; $('ops-challenge').value = ''; $('ops-standing').checked = false;
    if (date) U.toast('Due date parsed: ' + U.fmtDate(date), 'ok');
    render();
  }

  /* ---------- completion flows (constraint-gated) ---------- */

  function completeFlow(m) {
    const t = m.constraints.type;
    if (t === 'evidence') return evidenceFlow(m);
    if (t === 'challenge') return challengeFlow(m);
    // trust-based: binary confirm
    U.confirm('TRUST-BASED COMPLETION', `Mark complete on your word:<br><strong>${U.esc(m.text)}</strong>`)
      .then(ok => { if (ok) finalise(m, null); });
  }

  function evidenceFlow(m) {
    const body = U.el('div');
    body.innerHTML = `
      <p><strong>${U.esc(m.text)}</strong></p>
      <p class="dim">Evidence-based mission — attach a receipt (photo and/or text) to complete.</p>
      <label class="lbl">TEXT RECEIPT</label>
      <textarea id="ev-note" class="inp" rows="3" placeholder="What happened, who, where…"></textarea>
      <label class="lbl">PHOTO</label>
      <input type="file" id="ev-photo" accept="image/*" class="inp">
      <div id="ev-preview"></div>`;
    body.querySelector('#ev-photo').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      const url = await U.readFileDataURL(f);
      body.querySelector('#ev-preview').innerHTML = `<img src="${url}" class="ev-thumb">`;
    });
    U.modal({
      title: 'EVIDENCE REQUIRED', body,
      actions: [
        { label: 'CANCEL', kind: 'ghost' },
        {
          label: 'SUBMIT EVIDENCE', kind: 'amber', onClick: close => {
            const note = body.querySelector('#ev-note').value.trim();
            const img = body.querySelector('#ev-preview img');
            if (!note && !img) { U.toast('Attach a photo or text receipt', 'warn'); return; }
            close();
            finalise(m, { note: note || null, img: img ? img.src : null });
          }
        },
      ]
    });
  }

  function challengeFlow(m) {
    const body = U.el('div');
    body.innerHTML = `
      <p><strong>${U.esc(m.text)}</strong></p>
      <p class="dim">Challenge-based mission — enter the required input to verify completion.</p>
      <input id="ch-input" class="inp" placeholder="Challenge answer…">`;
    U.modal({
      title: 'CHALLENGE GATE', body,
      actions: [
        { label: 'CANCEL', kind: 'ghost' },
        {
          label: 'VERIFY', kind: 'amber', onClick: async close => {
            const v = body.querySelector('#ch-input').value.trim().toLowerCase();
            const hash = await CivCrypto.sha256hex(v);
            if (hash !== m.constraints.challengeHash) { U.toast('Challenge failed — wrong input', 'error'); return; }
            close();
            finalise(m, { note: 'challenge passed', img: null });
          }
        },
      ]
    });
  }

  function finalise(m, evidence) {
    const today = U.todayISO();
    if (m.isStandingOrder) {
      // streak: consecutive days
      const y = new Date(); y.setDate(y.getDate() - 1);
      m.streak = (m.lastCompletedDate === U.todayISO(y)) ? (m.streak || 0) + 1 : 1;
      m.lastCompletedDate = today;
    } else {
      m.completed = true;
      m.completedAt = Date.now();
    }
    m.completedBy = 'HQ';
    if (evidence) m.evidence = evidence;
    Data.logActivity('HQ', 'MISSION_COMPLETE', m.text.slice(0, 80));
    if (window.confetti) confetti({ particleCount: 110, spread: 75, origin: { y: 0.7 } });
    render();
  }

  async function deleteMission(m) {
    if (!await U.confirm('DELETE MISSION', U.esc(m.text))) return;
    Data.state.missions = missions().filter(x => x.id !== m.id);
    Data.touch();
    render();
  }

  /* ---------- standing orders: autonomous midnight reset ----------
     "Done today" is derived from lastCompletedDate === today, so the reset is
     automatic when the date changes; we just re-render at midnight. */

  function scheduleMidnightReset() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
    setTimeout(() => { render(); scheduleMidnightReset(); }, next - now);
  }

  /* ---------- render ---------- */

  function badge(m) {
    const t = m.constraints.type;
    const icon = { trust: 'fa-handshake', evidence: 'fa-camera', challenge: 'fa-lock' }[t];
    return `<span class="chip chip-${t}"><i class="fa-solid ${icon}"></i> ${t.toUpperCase()}</span>`;
  }

  function missionRow(m, doneToday) {
    const overdue = m.due && !m.completed && m.due < U.todayISO();
    return `
      <div class="msn ${m.completed || doneToday ? 'msn-done' : ''} prio-${m.priority}">
        <div class="msn-main">
          <div class="msn-text">${U.esc(m.text)}</div>
          <div class="msn-meta">
            ${badge(m)}
            <span class="chip">${U.esc(m.sector)}</span>
            <span class="chip chip-${m.priority}">${m.priority.toUpperCase()}</span>
            ${m.due ? `<span class="chip ${overdue ? 'chip-overdue' : ''}"><i class="fa-regular fa-calendar"></i> ${U.fmtDate(m.due)}</span>` : ''}
            ${m.isStandingOrder ? `<span class="chip chip-streak"><i class="fa-solid fa-fire"></i> ${m.streak || 0}</span>` : ''}
            ${m.broadcastAt ? '<span class="chip"><i class="fa-solid fa-tower-broadcast"></i> SENT</span>' : ''}
            ${m.evidence ? '<span class="chip"><i class="fa-solid fa-receipt"></i> RECEIPT</span>' : ''}
          </div>
        </div>
        <div class="msn-actions">
          <input type="checkbox" class="msn-pick" data-pick="${m.id}" title="Select for mission pack">
          ${(!m.completed && !doneToday) ? `<button class="btn btn-amber btn-sm" data-done="${m.id}">DONE</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-del="${m.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }

  function render() {
    const today = U.todayISO();
    const standing = missions().filter(m => m.isStandingOrder);
    const active = missions().filter(m => !m.isStandingOrder && !m.completed)
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const done = missions().filter(m => !m.isStandingOrder && m.completed)
      .sort((a, b) => b.completedAt - a.completedAt);

    $('ops-standing-list').innerHTML = standing.map(m =>
      missionRow(m, m.lastCompletedDate === today)).join('') ||
      '<p class="dim pad">No standing orders. Tick the box in the composer to create daily routines.</p>';
    $('ops-active-list').innerHTML = active.map(m => missionRow(m, false)).join('') ||
      '<p class="dim pad">No active missions.</p>';
    $('ops-done-list').innerHTML = done.slice(0, 25).map(m => missionRow(m, false)).join('') ||
      '<p class="dim pad">Nothing completed yet.</p>';
    $('ops-done-count').textContent = done.length;

    const host = $('tab-ops');
    host.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', () => {
      const m = missions().find(x => x.id === b.dataset.done);
      if (m) completeFlow(m);
    }));
    host.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const m = missions().find(x => x.id === b.dataset.del);
      if (m) deleteMission(m);
    }));

    renderCharts();
    renderFocus();
  }

  /* ---------- campaign health dashboards (Chart.js) ---------- */

  function lastNDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      out.push(U.todayISO(d));
    }
    return out;
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') return;   // CDN absent: degrade silently
    const days = lastNDays(14);
    const stats = Object.fromEntries(Data.state.campaignStats.map(r => [r.date, r]));
    const labels = days.map(d => d.slice(5));
    const ink = '#8d96a8', grid = 'rgba(141,150,168,.12)';
    Chart.defaults.color = ink;
    Chart.defaults.font.family = "Consolas, 'Courier New', monospace";

    const mk = (id, cfg) => {
      if (charts[id]) charts[id].destroy();
      const ctx = $(id);
      if (ctx) charts[id] = new Chart(ctx, cfg);
    };

    mk('chart-activity', {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Actions', data: days.map(d => stats[d]?.totalActions || 0), backgroundColor: '#e8b84b' }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { color: grid } }, y: { grid: { color: grid }, ticks: { precision: 0 } } } }
    });

    mk('chart-focus', {
      type: 'line',
      data: { labels, datasets: [{ label: 'Focus min', data: days.map(d => Math.round((stats[d]?.totalFocusSeconds || 0) / 60)), borderColor: '#6fc28a', backgroundColor: 'rgba(111,194,138,.15)', fill: true, tension: .3 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { color: grid } }, y: { grid: { color: grid } } } }
    });

    const hours = new Array(24).fill(0);
    for (const a of Data.state.activityFeed) hours[new Date(a.timestamp).getHours()]++;
    mk('chart-pattern', {
      type: 'bar',
      data: { labels: hours.map((_, h) => String(h).padStart(2, '0')), datasets: [{ label: 'Actions by hour', data: hours, backgroundColor: '#7aa6d8' }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: grid }, ticks: { precision: 0 } } } }
    });
  }

  /* ---------- focus timer (feeds totalFocusSeconds) ---------- */

  function focusElapsed() {
    return focus.accum + (focus.running ? (Date.now() - focus.startTs) / 1000 : 0);
  }

  function renderFocus() {
    const el = $('focus-display');
    if (!el) return;
    const s = Math.floor(focusElapsed());
    el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    $('focus-toggle').textContent = focus.running ? 'PAUSE' : (focus.accum ? 'RESUME' : 'START');
    const today = Data.state.campaignStats.find(r => r.date === U.todayISO());
    $('focus-today').textContent = U.fmtDur(today?.totalFocusSeconds || 0);
  }

  function toggleFocus() {
    if (focus.running) {
      focus.accum += (Date.now() - focus.startTs) / 1000;
      focus.running = false;
      clearInterval(focus.tick);
    } else {
      focus.running = true;
      focus.startTs = Date.now();
      focus.tick = setInterval(renderFocus, 1000);
    }
    renderFocus();
  }

  function bankFocus() {
    if (focus.running) toggleFocus();
    const sec = Math.floor(focus.accum);
    if (sec < 10) { U.toast('Nothing meaningful to bank yet', 'warn'); return; }
    Data.addFocusSeconds(sec);
    Data.logActivity('HQ', 'FOCUS_SESSION', U.fmtDur(sec));
    focus.accum = 0;
    if (window.confetti && sec >= 25 * 60) confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 } });
    U.toast(`Banked ${U.fmtDur(sec)} of focus`, 'ok');
    render();
  }

  /* ---------- mission pack broadcast (HQ -> Dropzone) ---------- */

  async function broadcastPack() {
    const picked = [...document.querySelectorAll('.msn-pick:checked')].map(c => c.dataset.pick);
    const ms = missions().filter(m => picked.includes(m.id));
    if (!ms.length) { U.toast('Tick the checkboxes on missions to include first', 'warn'); return; }
    const pack = {
      v: 1, kind: 'civitas-missionpack',
      packId: U.id('pack'), created: Date.now(), hq: Data.state.meta.hqHandle,
      missions: ms.map(m => ({
        id: m.id, text: m.text, priority: m.priority,
        constraints: m.constraints, sector: m.sector, due: m.due,
        isStandingOrder: m.isStandingOrder,
      })),
    };
    const name = `missionpack-${U.todayISO()}-${String(Date.now() % 100000)}.json`;
    const dz = Data.getDropzone();
    let where = 'download';
    if (dz) {
      try {
        const fh = await dz.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(JSON.stringify(pack, null, 2));
        await w.close();
        where = 'dropzone';
      } catch (e) { console.warn('dropzone write failed, downloading instead', e); }
    }
    if (where === 'download') U.download(name, JSON.stringify(pack, null, 2));
    ms.forEach(m => m.broadcastAt = Date.now());
    Data.logActivity('HQ', 'PACK_BROADCAST', `${ms.length} missions -> ${where}`);
    if (window.confetti) confetti({ particleCount: 90, spread: 60, origin: { y: 0.8 } });
    U.toast(`Mission pack ${where === 'dropzone' ? 'broadcast to dropzone' : 'downloaded'} (${ms.length} missions)`, 'ok');
    render();
  }

  /* ---------- init ---------- */

  function init() {
    $('ops-add').addEventListener('click', createMission);
    $('ops-text').addEventListener('keydown', e => { if (e.key === 'Enter') createMission(); });
    $('ops-constraint').addEventListener('change', () =>
      $('ops-challenge-wrap').classList.toggle('hidden', $('ops-constraint').value !== 'challenge'));
    $('ops-broadcast').addEventListener('click', broadcastPack);
    $('focus-toggle').addEventListener('click', toggleFocus);
    $('focus-bank').addEventListener('click', bankFocus);
    scheduleMidnightReset();
    render();
  }

  return { init, show: render, render };
})();
