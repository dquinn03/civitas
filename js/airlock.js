'use strict';
/* CIVITAS airlock.js — Dropzone ingestion + escrow staging ("The Airlock").
   Dispatches from field agents NEVER write directly to the database: they are
   decrypted, automatically audited (batch / duplicate / density flags), and
   held in escrow until the Commander approves or rejects each one.
   This is the Principal-Agent enforcement layer. */

const Air = (() => {

  const $ = id => document.getElementById(id);
  let staged = [];   // {key, dispatch, flags[], fileName}

  /* ---------- scanning the dropzone ---------- */

  async function scan() {
    const dz = Data.getDropzone();
    if (!dz) { U.toast('Connect the dropzone folder first', 'warn'); return; }
    const pass = $('air-pass').value;
    staged = [];
    let found = 0, skippedProcessed = 0, failed = 0;
    try {
      for await (const entry of dz.values()) {
        if (entry.kind !== 'file' || !/^dispatch.*\.json$/i.test(entry.name)) continue;
        found++;
        try {
          const file = await entry.getFile();
          const raw = JSON.parse(await file.text());
          let dispatch, encrypted = false;
          if (raw.alg === 'AES-GCM') {
            if (!pass) { U.toast('Encrypted dispatch found — enter the HQ passphrase and rescan', 'warn'); failed++; continue; }
            try { dispatch = await CivCrypto.decrypt(raw, pass); encrypted = true; }
            catch { U.toast(`${entry.name}: wrong passphrase or corrupted`, 'error'); failed++; continue; }
          } else if (raw.kind === 'civitas-dispatch') {
            dispatch = raw;   // accepted but flagged below
          } else continue;     // not a dispatch (e.g. a mission pack)
          const key = dispatch.dispatchId || entry.name;
          if (Data.state.processedDispatchIds.includes(key)) { skippedProcessed++; continue; }
          const flags = await audit(dispatch, encrypted);
          staged.push({ key, dispatch, flags, fileName: entry.name });
        } catch (e) { console.warn('dispatch parse failed', entry.name, e); failed++; }
      }
    } catch (e) {
      U.toast('Dropzone read failed — click RECONNECT in the vault menu: ' + e.message, 'error');
    }
    render();
    U.toast(`Scan: ${staged.length} staged, ${skippedProcessed} already processed, ${failed} unreadable (${found} dispatch files seen)`, 'info');
  }

  /* ---------- automated auditing logic ---------- */

  async function audit(d, encrypted) {
    const flags = [];
    const S = Data.state.settings;
    const comps = d.completions || [];

    if (!encrypted) flags.push({
      code: 'UNENCRYPTED',
      detail: 'Dispatch arrived in cleartext — field terminal skipped the Web Crypto layer.'
    });

    // BATCH FLAG: completions logged impossibly close together
    const times = comps.map(c => c.ts).filter(Boolean).sort((a, b) => a - b);
    let batchHits = 0;
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] < S.batchWindowMs) batchHits++;
    }
    if (batchHits) flags.push({
      code: 'BATCH',
      detail: `${batchHits} completion pair(s) logged < ${(S.batchWindowMs / 1000).toFixed(1)}s apart — telemetry suggests bulk back-fill, not live work.`
    });

    // DUPLICATE FLAG: evidence image hash seen before (historically or within this dispatch)
    const seenHere = new Set();
    for (const c of comps) {
      const img = c.evidence && c.evidence.img;
      if (!img) continue;
      const hash = await CivCrypto.sha256hex(img);
      c._imgHash = hash;
      const prior = Data.state.evidenceHashes[hash];
      if (prior) flags.push({
        code: 'DUPLICATE',
        detail: `Evidence photo matches one already accepted (agent ${prior.agentId}, ${prior.date}).`
      });
      else if (seenHere.has(hash)) flags.push({
        code: 'DUPLICATE',
        detail: 'The same photo was attached to two missions inside this one dispatch.'
      });
      seenHere.add(hash);
    }

    // DENSITY CHECK: shift duration vs task count
    if (d.shift && d.shift.start && d.shift.end) {
      const hours = (d.shift.end - d.shift.start) / 3.6e6;
      const rate = hours > 0 ? comps.length / hours : Infinity;
      if (comps.length && rate > S.densityMaxPerHour) flags.push({
        code: 'DENSITY',
        detail: `${comps.length} tasks across ${U.fmtDur((d.shift.end - d.shift.start) / 1000)} = ${rate === Infinity ? '∞' : rate.toFixed(1)}/hr (ceiling ${S.densityMaxPerHour}/hr).`
      });
    } else if (comps.length) {
      flags.push({ code: 'NO_SHIFT', detail: 'Tasks claimed without a bounding Start/End shift log.' });
    }

    // identity checks
    if (!Data.getVolunteerSafe(d)) flags.push({
      code: 'UNKNOWN_AGENT',
      detail: `No roster match for "${d.handle || d.agentId}" — approving will recruit them automatically.`
    });
    const unknownMissions = comps.filter(c => !Data.state.missions.some(m => m.id === c.missionId));
    if (unknownMissions.length) flags.push({
      code: 'UNKNOWN_MISSION',
      detail: `${unknownMissions.length} claimed mission id(s) not found at HQ (pack may have been pruned).`
    });

    return flags;
  }

  /* ---------- escrow render ---------- */

  function render() {
    const host = $('air-staged');
    $('air-count').textContent = staged.length;
    if (!staged.length) {
      host.innerHTML = '<p class="dim pad">Airlock empty. Broadcast packs from OPS; dispatches appear here after a scan.</p>';
      return;
    }
    host.innerHTML = staged.map((s, i) => {
      const d = s.dispatch;
      const comps = d.completions || [];
      const shift = d.shift && d.shift.start
        ? `${U.fmtDateTime(d.shift.start)} → ${d.shift.end ? U.fmtDateTime(d.shift.end) : 'open'} (${d.shift.end ? U.fmtDur((d.shift.end - d.shift.start) / 1000) : '…'})`
        : 'no shift logged';
      const geo = d.shift && d.shift.geo ? ` · 📍 ${d.shift.geo.lat.toFixed(3)},${d.shift.geo.lon.toFixed(3)}` : '';
      return `
      <div class="dispatch-card ${s.flags.length ? 'dispatch-flagged' : ''}">
        <div class="dispatch-head">
          <span class="agent-handle"><i class="fa-solid fa-satellite-dish"></i> ${U.esc(d.handle || d.agentId || 'unknown')}</span>
          <span class="dim">${U.esc(s.fileName)}</span>
        </div>
        <div class="dim">Shift: ${shift}${geo} · taps recorded: ${d.telemetry ? d.telemetry.count : 0}</div>
        <div class="dispatch-flags">
          ${s.flags.map(f => `<div class="flag flag-${f.code.toLowerCase()}"><strong>⚑ ${f.code}</strong> ${U.esc(f.detail)}</div>`).join('')
            || '<div class="flag flag-clean">✓ CLEAN — no audit flags raised</div>'}
        </div>
        <div class="dispatch-claims">
          ${comps.map(c => `
            <div class="claim">
              <span>${U.esc(c.text || c.missionId)}</span>
              <span class="dim">${U.fmtDateTime(c.ts)}</span>
              ${c.evidence && c.evidence.img ? `<img src="${c.evidence.img}" class="ev-thumb ev-click">` : ''}
              ${c.evidence && c.evidence.note ? `<span class="dim">“${U.esc(c.evidence.note)}”</span>` : ''}
            </div>`).join('') || '<p class="dim">No completions claimed.</p>'}
        </div>
        <div class="dispatch-actions">
          <button class="btn btn-amber btn-sm" data-approve="${i}"><i class="fa-solid fa-check"></i> APPROVE & MERGE</button>
          <button class="btn btn-danger btn-sm" data-reject="${i}"><i class="fa-solid fa-ban"></i> REJECT</button>
        </div>
      </div>`;
    }).join('');
    host.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => approve(+b.dataset.approve)));
    host.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => reject(+b.dataset.reject)));
    host.querySelectorAll('.ev-click').forEach(img => img.addEventListener('click', () =>
      U.modal({ title: 'EVIDENCE', body: `<img src="${img.src}" style="max-width:100%">`, actions: [{ label: 'CLOSE', kind: 'ghost' }] })));
  }

  /* ---------- approve / reject ---------- */

  function findOrRecruit(d) {
    let v = Data.getVolunteerSafe(d);
    if (!v) {
      v = {
        id: d.agentId || U.id('agt'), email: d.email || '', handle: d.handle || d.agentId || 'agent',
        location: '', role: 'field', xp: 0, skills: [], notes: 'Auto-recruited from first dispatch.',
        joined: Date.now(), reliabilityScore: 70,
      };
      Data.state.volunteers.push(v);
    }
    return v;
  }

  function approve(i) {
    const s = staged[i];
    if (!s) return;
    const d = s.dispatch;
    const v = findOrRecruit(d);
    const PRIORITY_XP = { high: 30, medium: 20, low: 10 };
    let merged = 0;

    for (const c of (d.completions || [])) {
      const m = Data.state.missions.find(x => x.id === c.missionId);
      const when = c.ts || Date.now();
      if (m) {
        if (m.isStandingOrder) {
          m.lastCompletedDate = U.dateISO(when);
          m.streak = (m.streak || 0) + 1;
        } else {
          m.completed = true;
          m.completedAt = when;
        }
        m.completedBy = v.id;
        if (c.evidence) m.evidence = c.evidence;
        v.xp = (v.xp || 0) + (PRIORITY_XP[m.priority] || 10);
      } else {
        v.xp = (v.xp || 0) + 5;   // unknown mission: token credit, already flagged
      }
      if (c._imgHash) Data.state.evidenceHashes[c._imgHash] = { agentId: v.id, missionId: c.missionId, date: U.dateISO(when) };
      Data.logActivity(v.id, 'MISSION_COMPLETE', (c.text || c.missionId || '').slice(0, 80), when);
      merged++;
    }

    // reliability: clean approvals build trust, flags erode it
    const delta = s.flags.length ? -5 * s.flags.length : Math.min(6, 2 * Math.max(1, merged));
    v.reliabilityScore = Math.min(100, Math.max(0, (v.reliabilityScore ?? 70) + delta));

    Data.state.processedDispatchIds.push(s.key);
    Data.logActivity('HQ', 'DISPATCH_APPROVED', `${v.handle}: ${merged} claims, ${s.flags.length} flags`);
    staged.splice(i, 1);
    if (window.confetti && !s.flags.length) confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    U.toast(`Merged ${merged} completions from ${v.handle} (reliability ${delta >= 0 ? '+' : ''}${delta})`, 'ok');
    render();
    if (window.App) App.refreshAll();
  }

  async function reject(i) {
    const s = staged[i];
    if (!s) return;
    if (!await U.confirm('REJECT DISPATCH', `Discard this dispatch from <strong>${U.esc(s.dispatch.handle || '?')}</strong> and apply a reliability penalty?`)) return;
    const v = Data.getVolunteerSafe(s.dispatch);
    if (v) v.reliabilityScore = Math.max(0, (v.reliabilityScore ?? 70) - 10);
    Data.state.processedDispatchIds.push(s.key);
    Data.logActivity('HQ', 'DISPATCH_REJECTED', s.dispatch.handle || s.key);
    staged.splice(i, 1);
    Data.touch();
    U.toast('Dispatch rejected (reliability −10)', 'warn');
    render();
    if (window.App) App.refreshAll();
  }

  /* ---------- manual ingest fallback (no dropzone / unsupported browser) ---------- */

  async function ingestFile(file) {
    try {
      const raw = JSON.parse(await U.readFileText(file));
      let dispatch, encrypted = false;
      if (raw.alg === 'AES-GCM') {
        const pass = $('air-pass').value;
        if (!pass) { U.toast('Enter the HQ passphrase first', 'warn'); return; }
        dispatch = await CivCrypto.decrypt(raw, pass);
        encrypted = true;
      } else dispatch = raw;
      const key = dispatch.dispatchId || file.name;
      if (Data.state.processedDispatchIds.includes(key)) { U.toast('Already processed', 'warn'); return; }
      if (staged.some(s => s.key === key)) { U.toast('Already staged', 'warn'); return; }
      staged.push({ key, dispatch, flags: await audit(dispatch, encrypted), fileName: file.name });
      render();
    } catch (e) { U.toast('Could not ingest: ' + e.message, 'error'); }
  }

  /* ---------- init ---------- */

  function init() {
    // helper used by audit + approve (kept on Data so both sides share one matcher)
    Data.getVolunteerSafe = d =>
      Data.state.volunteers.find(v => v.id === d.agentId || (d.handle && v.handle === d.handle) || (d.email && v.email === d.email)) || null;

    $('air-connect').addEventListener('click', async () => { await Data.chooseDropzone(); });
    $('air-scan').addEventListener('click', scan);
    $('air-manual').addEventListener('change', e => {
      [...e.target.files].forEach(ingestFile);
      e.target.value = '';
    });
    render();
  }

  return { init, show: render, scan };
})();
