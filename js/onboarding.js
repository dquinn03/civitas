'use strict';
/* CIVITAS onboarding.js — Spotlight Onboarding.
   Dark mask with a cut-out (giant box-shadow trick) + tooltip steps guiding
   new Commanders through the interface. Runs once on first launch; HELP reruns it. */

const Onboard = (() => {

  const STEPS = [
    { tab: null, sel: null, title: 'WELCOME TO CIVITAS', body: 'A local-first operating system for intellectual insurgency. Everything you see lives in one JSON file on YOUR hard drive — no server, no cloud, no landlord.' },
    { tab: null, sel: '#vault-menu-btn', title: 'THE VAULT', body: 'First move every session: connect your master file here (New Vault / Open Vault), set a backup folder, and reconnect after a browser restart. No vault = browser-mirror only.' },
    { tab: null, sel: 'nav.tabs', title: 'FOUR MODULES', body: 'EXOCORTEX for thinking, OPS for doing, NETWORK for people, AIRLOCK for verifying field reports. Switch any time — state is shared.' },
    { tab: 'exocortex', sel: '#exo-content', title: 'THE EXOCORTEX', body: 'Markdown notes with [[Wiki Links]] — type double brackets around any concept and click it in preview to jump or spawn the note. Backlinks and similar notes surface automatically on the right.' },
    { tab: 'exocortex', sel: '#exo-compile', title: 'MANUSCRIPT COMPILER', body: 'Tag notes (e.g. #manuscript) and compile them into a single chronological HTML document ready for Substack.' },
    { tab: 'ops', sel: '#ops-composer', title: 'UNIFIED COMMAND', body: 'Type missions in plain language — "Call MP next Friday" parses the date automatically. Choose how completion is proven: Trust, Evidence (photo/text receipt), or Challenge (pass-answer).' },
    { tab: 'ops', sel: '#ops-dash', title: 'CAMPAIGN HEALTH', body: 'Activity, focus time and time-of-day patterns chart themselves from the activity feed. Bank deep-work minutes with the focus timer; standing orders reset at midnight and build streaks.' },
    { tab: 'network', sel: '#net-topo', title: 'AGENT NETWORK', body: 'The topology canvas links agents (left) through HQ to completed operational sectors (right). Click any node for the dossier; bulk-recruit via CSV import.' },
    { tab: 'airlock', sel: '#air-panel', title: 'THE AIRLOCK', body: 'Field dispatches NEVER write straight to your database. They decrypt into escrow, get auto-audited — batch-entry, duplicate photos, impossible task density — and merge only when you approve. This is how the network scales without trust.' },
    { tab: null, sel: '#noise-controls', title: 'PROTECT THE BANDWIDTH', body: 'Brown noise, pink noise or rain — generated locally by Tone.js, runs forever. You are operational, Commander.' },
  ];

  let idx = 0;
  let mask, tip;

  function start() {
    idx = 0;
    if (!mask) build();
    mask.classList.remove('hidden');
    tip.classList.remove('hidden');
    showStep();
  }

  function maybeStart() {
    if (!localStorage.getItem('civitas-onboarded')) start();
  }

  function build() {
    mask = U.el('div', { class: 'spot-mask hidden', id: 'spot-mask' });
    tip = U.el('div', { class: 'spot-tip hidden', id: 'spot-tip' });
    const root = document.getElementById('spotlight-root');
    root.appendChild(mask);
    root.appendChild(tip);
  }

  function end() {
    mask.classList.add('hidden');
    tip.classList.add('hidden');
    localStorage.setItem('civitas-onboarded', '1');
  }

  function showStep() {
    const s = STEPS[idx];
    if (!s) return end();
    if (s.tab && window.App) App.showTab(s.tab);

    // setTimeout, not requestAnimationFrame: rAF never fires in hidden/throttled
    // tabs, which would freeze the tour. Layout reads below force reflow anyway.
    setTimeout(() => {
      const target = s.sel ? document.querySelector(s.sel) : null;
      if (target) {
        const r = target.getBoundingClientRect();
        const pad = 8;
        Object.assign(mask.style, {
          left: (r.left - pad) + 'px', top: (r.top - pad) + 'px',
          width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px',
          borderRadius: '8px',
        });
      } else {
        // centre stage, nothing highlighted
        Object.assign(mask.style, {
          left: '50%', top: '38%', width: '0px', height: '0px', borderRadius: '50%',
        });
      }

      tip.innerHTML = `
        <div class="spot-title">${U.esc(s.title)}</div>
        <div class="spot-body">${s.body}</div>
        <div class="spot-nav">
          <span class="dim">${idx + 1} / ${STEPS.length}</span>
          <span>
            <button class="btn btn-ghost btn-sm" id="spot-skip">SKIP</button>
            ${idx > 0 ? '<button class="btn btn-ghost btn-sm" id="spot-back">BACK</button>' : ''}
            <button class="btn btn-amber btn-sm" id="spot-next">${idx === STEPS.length - 1 ? 'BEGIN' : 'NEXT'}</button>
          </span>
        </div>`;

      // place the tooltip near the highlight, clamped to the viewport
      const mr = mask.getBoundingClientRect();
      const below = mr.bottom + 220 < window.innerHeight;
      const tw = tip.offsetWidth || 360;
      let left = mr.left + mr.width / 2 - tw / 2;
      left = Math.min(window.innerWidth - tw - 12, Math.max(12, left));
      tip.style.left = left + 'px';
      const th = tip.offsetHeight;
      tip.style.top = (below ? mr.bottom + 14 : Math.max(12, mr.top - th - 14)) + 'px';

      tip.querySelector('#spot-next').addEventListener('click', () => { idx++; showStep(); });
      tip.querySelector('#spot-skip').addEventListener('click', end);
      const back = tip.querySelector('#spot-back');
      if (back) back.addEventListener('click', () => { idx--; showStep(); });
    });
  }

  return { start, maybeStart };
})();
