'use strict';
/* CIVITAS app.js — orchestration: tab routing, vault menu, header wiring, boot. */

const App = (() => {

  /* NOTE: top-level const modules (Exo, Ops…) are script-scope globals, NOT
     window properties — so resolve them lazily by reference, never via window[]. */
  const TABS = {
    exocortex: () => Exo, ops: () => Ops, network: () => Net, airlock: () => Air,
  };
  let currentTab = 'exocortex';

  function showTab(name) {
    currentTab = name;
    for (const t of Object.keys(TABS)) {
      document.getElementById('tab-' + t).classList.toggle('hidden', t !== name);
      document.querySelector(`[data-tab="${t}"]`).classList.toggle('tab-active', t === name);
    }
    const mod = TABS[name]();
    if (mod && mod.show) mod.show();
  }

  function refreshAll() {
    Data.updatePills();
    const mod = TABS[currentTab]();
    if (mod && mod.show) mod.show();
  }

  function bindHeader() {
    document.querySelectorAll('[data-tab]').forEach(btn =>
      btn.addEventListener('click', () => showTab(btn.dataset.tab)));

    // vault dropdown
    const menuBtn = document.getElementById('vault-menu-btn');
    const menu = document.getElementById('vault-menu');
    menuBtn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); });
    document.addEventListener('click', () => menu.classList.add('hidden'));
    menu.addEventListener('click', e => e.stopPropagation());

    const act = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    act('vault-new', () => Data.connectVault(true));
    act('vault-open', () => Data.connectVault(false));
    act('vault-reconnect', () => Data.reconnect());
    act('vault-backupdir', () => Data.chooseBackupDir());
    act('vault-snapshot', () => Data.snapshot());
    act('vault-export', () => Data.exportDownload());
    act('vault-system', systemStatus);
    document.getElementById('vault-import').addEventListener('change', e => {
      if (e.target.files[0]) Data.importFromFile(e.target.files[0]);
      e.target.value = '';
    });
    act('help-btn', () => Onboard.start());
  }

  /* ---------- system status (Party Whip prototype) ---------- */

  function systemStatus() {
    const s = Data.state;
    const bytes = JSON.stringify(s).length;
    const mirrorCap = 5 * 1024 * 1024;   // localStorage mirror budget only — the vault file has no such limit
    const rows = [
      ['Notes', s.notes.length], ['Missions', s.missions.length],
      ['Agents', s.volunteers.length], ['Activity entries', s.activityFeed.length],
      ['Evidence hashes', Object.keys(s.evidenceHashes).length],
      ['Processed dispatches', s.processedDispatchIds.length],
      ['Saved packs', (s.templates || []).length],
    ];
    const body = U.el('div');
    body.innerHTML = `
      <label class="lbl">STATE FOOTPRINT (BROWSER MIRROR BUDGET ~5 MB; VAULT FILE IS UNLIMITED)</label>
      <div style="background:#0f1119;border:1px solid var(--border);border-radius:6px;height:14px;overflow:hidden">
        <div style="height:100%;background:var(--amber);width:${Math.min(100, bytes / mirrorCap * 100).toFixed(1)}%"></div>
      </div>
      <p class="dim" style="margin:4px 0 12px">${(bytes / 1024).toFixed(1)} KB serialised</p>
      ${rows.map(([k, v]) => `<div style="display:flex;justify-content:space-between;border-bottom:1px dashed #20253a;padding:4px 0"><span class="dim">${k}</span><strong>${v}</strong></div>`).join('')}`;
    U.modal({
      title: 'SYSTEM STATUS', body,
      actions: [
        {
          label: 'FACTORY RESET', kind: 'danger', onClick: async close => {
            close();
            if (await U.confirm('FACTORY RESET',
              'Wipe ALL state (notes, missions, agents, history)? The vault file is rewritten empty on the next save. <strong>Export a backup first.</strong>')) {
              Data.factoryReset();
            }
          }
        },
        { label: 'FULL BACKUP', kind: 'amber', onClick: close => { Data.exportDownload(); close(); } },
        { label: 'CLOSE', kind: 'ghost' },
      ]
    });
  }

  function startClock() {
    const el = document.getElementById('hq-clock');
    if (!el) return;
    const tick = () => { el.textContent = new Date().toLocaleTimeString('en-AU', { hour12: false }); };
    tick();
    setInterval(tick, 1000);
  }

  async function boot() {
    await Data.init();
    Exo.init();
    Ops.init();
    Net.init();
    Air.init();
    Sensory.bind();
    bindHeader();
    startClock();
    showTab('exocortex');
    Onboard.maybeStart();

    window.addEventListener('error', e =>
      U.toast('Error: ' + (e.message || 'unknown'), 'error'));
  }

  window.addEventListener('DOMContentLoaded', boot);

  return { showTab, refreshAll };
})();

// expose for the `if (window.App)` guards in data.js / airlock.js
window.App = App;
