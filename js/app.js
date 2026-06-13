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
    document.getElementById('vault-import').addEventListener('change', e => {
      if (e.target.files[0]) Data.importFromFile(e.target.files[0]);
      e.target.value = '';
    });
    act('help-btn', () => Onboard.start());
  }

  async function boot() {
    await Data.init();
    Exo.init();
    Ops.init();
    Net.init();
    Air.init();
    Sensory.bind();
    bindHeader();
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
