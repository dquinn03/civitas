'use strict';
/* CIVITAS network.js — Module C: Agent Network (decentralised CRM).
   Volunteer roster with XP/reliability, bulk CSV import, and an interactive
   HTML5 Canvas topology graph linking agents to completed operational sectors. */

const Net = (() => {

  const $ = id => document.getElementById(id);
  let nodePositions = [];   // {x,y,r,kind:'hq'|'agent'|'sector',ref}

  function vols() { return Data.state.volunteers; }

  /* ---------- roster ---------- */

  function level(xp) { return Math.floor(Math.sqrt((xp || 0) / 25)); }

  function relBadge(score) {
    const s = score ?? 70;
    if (s >= 80) return '<span class="chip chip-ok">SOLID ' + s + '</span>';
    if (s >= 60) return '<span class="chip chip-warn">WATCH ' + s + '</span>';
    return '<span class="chip chip-err">REVIEW ' + s + '</span>';
  }

  function renderRoster() {
    const q = $('net-search').value.trim().toLowerCase();
    const list = vols().filter(v => !q ||
      (v.handle + ' ' + v.email + ' ' + v.location + ' ' + v.role + ' ' + (v.skills || []).join(' '))
        .toLowerCase().includes(q));
    $('net-roster').innerHTML = list.map(v => `
      <div class="agent-card" data-id="${v.id}">
        <div class="agent-head">
          <span class="agent-handle"><i class="fa-solid fa-user-secret"></i> ${U.esc(v.handle)}</span>
          ${relBadge(v.reliabilityScore)}
        </div>
        <div class="agent-meta">
          <span class="chip">${U.esc(v.role || 'volunteer')}</span>
          <span class="chip"><i class="fa-solid fa-location-dot"></i> ${U.esc(v.location || '—')}</span>
          <span class="chip chip-xp">LVL ${level(v.xp)} · ${v.xp || 0} XP</span>
        </div>
        <div class="agent-skills">${(v.skills || []).map(s => `<span class="chip">${U.esc(s)}</span>`).join('') || '<span class="dim">no skills logged</span>'}</div>
        ${v.notes ? `<div class="agent-notes dim">${U.esc(v.notes)}</div>` : ''}
      </div>`).join('') || '<p class="dim pad">No agents yet. Add one or import a CSV.</p>';
    $('net-roster').querySelectorAll('.agent-card').forEach(c =>
      c.addEventListener('click', () => editDialog(vols().find(v => v.id === c.dataset.id))));
    $('net-count').textContent = vols().length;
  }

  /* ---------- add / edit ---------- */

  function editDialog(v) {
    const isNew = !v;
    v = v || { id: U.id('agt'), email: '', handle: '', location: '', role: 'volunteer', xp: 0, skills: [], notes: '', joined: Date.now(), reliabilityScore: 70 };
    const body = U.el('div');
    body.innerHTML = `
      <label class="lbl">HANDLE</label><input class="inp" id="ag-handle" value="${U.esc(v.handle)}">
      <label class="lbl">EMAIL</label><input class="inp" id="ag-email" value="${U.esc(v.email)}">
      <div class="grid2">
        <div><label class="lbl">LOCATION</label><input class="inp" id="ag-loc" value="${U.esc(v.location)}"></div>
        <div><label class="lbl">ROLE</label><input class="inp" id="ag-role" value="${U.esc(v.role)}"></div>
      </div>
      <label class="lbl">SKILLS (comma separated)</label><input class="inp" id="ag-skills" value="${U.esc((v.skills || []).join(', '))}">
      <label class="lbl">NOTES</label><textarea class="inp" id="ag-notes" rows="2">${U.esc(v.notes)}</textarea>
      <div class="grid2">
        <div><label class="lbl">XP</label><input class="inp" id="ag-xp" type="number" value="${v.xp || 0}"></div>
        <div><label class="lbl">RELIABILITY (0–100)</label><input class="inp" id="ag-rel" type="number" value="${v.reliabilityScore ?? 70}"></div>
      </div>`;
    const actions = [
      { label: 'CANCEL', kind: 'ghost' },
      {
        label: isNew ? 'RECRUIT' : 'SAVE', kind: 'amber', onClick: close => {
          v.handle = body.querySelector('#ag-handle').value.trim() || 'agent';
          v.email = body.querySelector('#ag-email').value.trim();
          v.location = body.querySelector('#ag-loc').value.trim();
          v.role = body.querySelector('#ag-role').value.trim() || 'volunteer';
          v.skills = body.querySelector('#ag-skills').value.split(',').map(s => s.trim()).filter(Boolean);
          v.notes = body.querySelector('#ag-notes').value.trim();
          v.xp = Math.max(0, +body.querySelector('#ag-xp').value || 0);
          v.reliabilityScore = Math.min(100, Math.max(0, +body.querySelector('#ag-rel').value || 70));
          if (isNew) { vols().push(v); Data.logActivity('HQ', 'VOLUNTEER_ADDED', v.handle); }
          else Data.touch();
          close(); refresh();
        }
      },
    ];
    if (!isNew) actions.splice(1, 0, {
      label: 'REMOVE', kind: 'danger', onClick: async close => {
        close();
        if (await U.confirm('REMOVE AGENT', `Remove <strong>${U.esc(v.handle)}</strong> from the network?`)) {
          Data.state.volunteers = vols().filter(x => x.id !== v.id);
          Data.touch(); refresh();
        }
      }
    });
    U.modal({ title: isNew ? 'RECRUIT AGENT' : 'AGENT DOSSIER — ' + v.handle.toUpperCase(), body, actions });
  }

  /* ---------- bulk CSV import ---------- */

  function importDialog() {
    const body = U.el('div');
    body.innerHTML = `
      <p class="dim">Header row required. Recognised columns (any order, case-insensitive):
      <code>email, handle (or name), location, role, skills</code>. Skills split on <code>;</code> or <code>|</code>.</p>
      <input type="file" id="csv-file" accept=".csv,text/csv" class="inp">
      <label class="lbl">…or paste CSV</label>
      <textarea id="csv-paste" class="inp" rows="6" placeholder="email,handle,location,role,skills"></textarea>`;
    U.modal({
      title: 'BULK CSV IMPORT', body, wide: true,
      actions: [
        { label: 'CANCEL', kind: 'ghost' },
        {
          label: 'IMPORT', kind: 'amber', onClick: async close => {
            let text = body.querySelector('#csv-paste').value;
            const f = body.querySelector('#csv-file').files[0];
            if (f) text = await U.readFileText(f);
            if (!text.trim()) { U.toast('No CSV provided', 'warn'); return; }
            close();
            runImport(text);
          }
        },
      ]
    });
  }

  function runImport(text) {
    const rows = U.csvParse(text);
    if (rows.length < 2) { U.toast('CSV needs a header row plus data', 'warn'); return; }
    const header = rows[0].map(h => h.trim().toLowerCase());
    const col = name => header.findIndex(h => h === name || h.includes(name));
    const ix = {
      email: col('email'),
      handle: header.findIndex(h => h === 'handle' || h === 'name' || h.includes('handle') || h.includes('name')),
      location: col('location'), role: col('role'), skills: col('skill'),
    };
    if (ix.email < 0 && ix.handle < 0) { U.toast('Need at least an email or handle column', 'error'); return; }
    let added = 0, skipped = 0;
    for (const r of rows.slice(1)) {
      const get = i => (i >= 0 && r[i]) ? r[i].trim() : '';
      const email = get(ix.email), handle = get(ix.handle) || email.split('@')[0];
      if (!handle) { skipped++; continue; }
      if (vols().some(v => (email && v.email === email) || v.handle === handle)) { skipped++; continue; }
      vols().push({
        id: U.id('agt'), email, handle,
        location: get(ix.location), role: get(ix.role) || 'volunteer',
        xp: 0, skills: get(ix.skills).split(/[;|]/).map(s => s.trim()).filter(Boolean),
        notes: '', joined: Date.now(), reliabilityScore: 70,
      });
      added++;
    }
    Data.logActivity('HQ', 'IMPORT_CSV', `${added} added, ${skipped} skipped`);
    U.toast(`Imported ${added} agents (${skipped} skipped as duplicates/blank)`, added ? 'ok' : 'warn');
    refresh();
  }

  /* ---------- topology graph (HTML5 Canvas) ----------
     HQ centre, agents on the left arc, completed operational sectors on the
     right arc; edge weight = completed missions by that agent in that sector. */

  function topoData() {
    const links = {};   // 'agentRef|sector' -> count
    for (const m of Data.state.missions) {
      const credited = m.completedBy && (m.completed || m.isStandingOrder && m.lastCompletedDate);
      if (!credited) continue;
      const key = m.completedBy + '|' + (m.sector || 'GENERAL');
      links[key] = (links[key] || 0) + 1;
    }
    const sectors = [...new Set(Object.keys(links).map(k => k.split('|')[1]))];
    return { links, sectors };
  }

  function drawTopology() {
    const canvas = $('net-topo');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (!wrap.clientWidth) {
      // not laid out yet (tab hidden / first paint pending) — retry once visible
      if (!drawTopology._retry) drawTopology._retry = setTimeout(() => {
        drawTopology._retry = null;
        drawTopology();
      }, 250);
      return;
    }
    canvas.width = wrap.clientWidth - 4;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    nodePositions = [];

    const { links, sectors } = topoData();
    const agents = vols();
    const hq = { x: W / 2, y: H / 2 };

    const place = (count, cx, spreadY) => i =>
      ({ x: cx, y: count <= 1 ? H / 2 : (H * 0.12) + i * ((H * 0.76) / (count - 1)) });

    const agentPos = agents.map((v, i) => ({ ...place(agents.length, W * 0.14, 1)(i), ref: v }));
    const sectorPos = sectors.map((s, i) => ({ ...place(sectors.length, W * 0.86, 1)(i), ref: s }));

    // edges: agent -> HQ -> sector (HQ is the routing node of the cell structure)
    ctx.lineCap = 'round';
    for (const [key, count] of Object.entries(links)) {
      const [agentRef, sector] = key.split('|');
      const a = agentRef === 'HQ' ? hq
        : agentPos.find(p => p.ref.id === agentRef || p.ref.handle === agentRef);
      const s = sectorPos.find(p => p.ref === sector);
      if (!s) continue;
      ctx.strokeStyle = 'rgba(232,184,75,' + Math.min(0.85, 0.25 + count * 0.15) + ')';
      ctx.lineWidth = Math.min(6, 1 + count);
      ctx.beginPath();
      if (a && a !== hq) { ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(hq.x, hq.y, s.x, s.y); }
      else { ctx.moveTo(hq.x, hq.y); ctx.lineTo(s.x, s.y); }
      ctx.stroke();
    }
    // faint membership edges agent->HQ
    ctx.strokeStyle = 'rgba(122,166,216,.25)';
    ctx.lineWidth = 1;
    for (const p of agentPos) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(hq.x, hq.y); ctx.stroke(); }

    const node = (x, y, r, fill, label, kind, ref) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = '#0d0f14'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#d8dbe2'; ctx.font = '11px Consolas, monospace';
      ctx.textAlign = kind === 'sector' ? 'right' : (kind === 'agent' ? 'left' : 'center');
      const lx = kind === 'sector' ? x - r - 6 : (kind === 'agent' ? x + r + 6 : x);
      const ly = kind === 'hq' ? y - r - 8 : y + 4;
      ctx.fillText(label, lx, ly);
      nodePositions.push({ x, y, r, kind, ref });
    };

    node(hq.x, hq.y, 16, '#e8b84b', 'HQ · ' + (Data.state.meta.hqHandle || 'COWRA'), 'hq', null);
    agentPos.forEach(p => node(p.x, p.y, 9, p.ref.reliabilityScore >= 80 ? '#6fc28a' : p.ref.reliabilityScore >= 60 ? '#d8b15a' : '#d87a7a', p.ref.handle, 'agent', p.ref));
    sectorPos.forEach(p => node(p.x, p.y, 11, '#7aa6d8', p.ref, 'sector', p.ref));

    if (!agents.length && !sectors.length) {
      ctx.fillStyle = '#566074'; ctx.textAlign = 'center'; ctx.font = '13px Consolas, monospace';
      ctx.fillText('Network forms as agents join and missions complete.', W / 2, H / 2 + 40);
    }
  }

  function hitTest(e) {
    const canvas = $('net-topo');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    return nodePositions.find(n => (n.x - x) ** 2 + (n.y - y) ** 2 <= (n.r + 4) ** 2);
  }

  function bindTopology() {
    const canvas = $('net-topo');
    const tip = $('net-tooltip');
    canvas.addEventListener('mousemove', e => {
      const n = hitTest(e);
      canvas.style.cursor = n ? 'pointer' : 'default';
      if (n) {
        tip.classList.remove('hidden');
        tip.style.left = (e.pageX + 14) + 'px';
        tip.style.top = (e.pageY + 14) + 'px';
        tip.textContent = n.kind === 'hq' ? 'Command node — Cowra HQ'
          : n.kind === 'sector' ? `Operational sector: ${n.ref}`
          : `${n.ref.handle} — ${n.ref.role || 'volunteer'} · ${n.ref.xp || 0} XP · reliability ${n.ref.reliabilityScore}`;
      } else tip.classList.add('hidden');
    });
    canvas.addEventListener('mouseleave', () => tip.classList.add('hidden'));
    canvas.addEventListener('click', e => {
      const n = hitTest(e);
      if (n && n.kind === 'agent') editDialog(n.ref);
    });
  }

  /* ---------- init ---------- */

  function refresh() { renderRoster(); drawTopology(); }

  function init() {
    $('net-add').addEventListener('click', () => editDialog(null));
    $('net-import').addEventListener('click', importDialog);
    $('net-search').addEventListener('input', renderRoster);
    bindTopology();
    window.addEventListener('resize', U.debounce(drawTopology, 200));
    refresh();
  }

  return { init, show: refresh, refresh };
})();
