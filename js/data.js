'use strict';
/* CIVITAS data.js — Absolute Data Sovereignty layer.
   Master state lives in ONE local .json file via the File System Access API.
   File/directory handles persist across sessions in IndexedDB (structured clone).
   Automated redundancy: timestamped snapshots to a local backup directory.
   localStorage holds a best-effort mirror only — the file on disk is canonical. */

const Data = (() => {

  const DEFAULTS = () => ({
    meta: {
      app: 'civitas', schema: 1,
      created: Date.now(), updated: Date.now(),
      hqHandle: 'HQ',
    },
    volunteers: [],     // {id,email,handle,location,role,xp,skills[],notes,joined,reliabilityScore}
    missions: [],       // {id,text,priority,constraints:{type,challengeHash?},sector,due,completed,completedAt,completedBy,evidence,isStandingOrder,lastCompletedDate,streak,timestamp,broadcastAt}
    notes: [],          // {id,title,content,tags[],createdAt,updatedAt}
    activityFeed: [],   // {id,agentId,actionType,detail,timestamp}  — append-only analytical record, never trimmed
    campaignStats: [],  // {date,totalActions,totalFocusSeconds}
    evidenceHashes: {}, // sha256 -> {agentId,missionId,date}
    processedDispatchIds: [],
    settings: {
      backupEveryMin: 30,
      densityMaxPerHour: 12,
      batchWindowMs: 5000,
    },
  });

  let state = DEFAULTS();
  let masterHandle = null;   // FileSystemFileHandle
  let backupDirHandle = null;
  let dropzoneHandle = null; // shared with airlock.js via getDropzone()
  let dirty = false;
  let lastBackupDate = null;
  let listeners = [];
  const FS_OK = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  /* ---------- tiny IndexedDB key-value store (for handles) ---------- */

  function kvOpen() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('civitas-kv', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function kvSet(key, val) {
    const db = await kvOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    });
  }
  async function kvGet(key) {
    const db = await kvOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readonly');
      const rq = tx.objectStore('kv').get(key);
      rq.onsuccess = () => { db.close(); res(rq.result); };
      rq.onerror = () => { db.close(); rej(rq.error); };
    });
  }

  /* ---------- permissions ---------- */

  async function hasPermission(handle, mode = 'readwrite') {
    if (!handle) return false;
    try { return (await handle.queryPermission({ mode })) === 'granted'; }
    catch { return false; }
  }
  async function askPermission(handle, mode = 'readwrite') {
    if (!handle) return false;
    try { return (await handle.requestPermission({ mode })) === 'granted'; }
    catch { return false; }
  }

  /* ---------- load / save ---------- */

  function migrate(parsed) {
    const base = DEFAULTS();
    const s = Object.assign(base, parsed);
    s.settings = Object.assign(base.settings, parsed.settings || {});
    s.meta = Object.assign(base.meta, parsed.meta || {});
    return s;
  }

  async function loadFromHandle() {
    const file = await masterHandle.getFile();
    const text = await file.text();
    if (text.trim()) state = migrate(JSON.parse(text));
  }

  async function writeMaster() {
    if (!masterHandle) return false;
    const w = await masterHandle.createWritable();
    state.meta.updated = Date.now();
    await w.write(JSON.stringify(state, null, 2));
    await w.close();
    return true;
  }

  function mirrorToLocalStorage() {
    try { localStorage.setItem('civitas-state-mirror', JSON.stringify(state)); }
    catch { /* mirror is best-effort only; evidence images can exceed the quota */ }
  }

  async function saveNow() {
    dirty = false;
    mirrorToLocalStorage();
    let wroteFile = false;
    try { wroteFile = await writeMaster(); }
    catch (e) { console.error('vault write failed', e); U.toast('Vault write failed: ' + e.message, 'error'); }
    if (wroteFile) await maybeDailyBackup();
    setSaveDot(wroteFile ? 'saved' : 'mirror');
    return wroteFile;
  }

  const debouncedSave = U.debounce(() => saveNow(), 1500);

  function touch() {
    dirty = true;
    setSaveDot('dirty');
    debouncedSave();
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  }

  function setSaveDot(mode) {
    const dot = document.getElementById('save-dot');
    if (!dot) return;
    dot.className = 'save-dot save-' + mode;
    dot.title = { dirty: 'Unsaved changes…', saved: 'Saved to vault file', mirror: 'Saved to browser mirror only — connect a vault file!' }[mode] || '';
  }

  /* ---------- backups ---------- */

  async function maybeDailyBackup() {
    if (!backupDirHandle) return;
    try {
      const today = U.todayISO();
      const name = `civitas-backup-${today}.json`;
      const fh = await backupDirHandle.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(state, null, 2));
      await w.close();
      lastBackupDate = today;
      updatePills();
    } catch (e) { console.warn('backup failed', e); }
  }

  async function snapshot() {
    if (!backupDirHandle) { U.toast('Choose a backup folder first', 'warn'); return; }
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const name = `civitas-snapshot-${U.todayISO()}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
    try {
      const fh = await backupDirHandle.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(state, null, 2));
      await w.close();
      U.toast('Snapshot written: ' + name, 'ok');
    } catch (e) { U.toast('Snapshot failed: ' + e.message, 'error'); }
  }

  /* ---------- vault connect flows (all require a user gesture) ---------- */

  const VAULT_TYPES = [{ description: 'Civitas master JSON', accept: { 'application/json': ['.json'] } }];

  async function connectVault(create) {
    if (!FS_OK) { U.toast('File System Access API unavailable — use Chrome/Edge. Falling back to export/import.', 'warn'); return; }
    try {
      if (create) {
        masterHandle = await window.showSaveFilePicker({ suggestedName: 'civitas-master.json', types: VAULT_TYPES });
        await writeMaster();
      } else {
        [masterHandle] = await window.showOpenFilePicker({ types: VAULT_TYPES, multiple: false });
        await askPermission(masterHandle);
        await loadFromHandle();
      }
      await kvSet('masterHandle', masterHandle);
      U.toast(create ? 'New vault created' : 'Vault opened: ' + masterHandle.name, 'ok');
      updatePills();
      listeners.forEach(fn => fn());
      if (window.App) App.refreshAll();
    } catch (e) {
      if (e.name !== 'AbortError') U.toast('Vault error: ' + e.message, 'error');
    }
  }

  async function chooseBackupDir() {
    if (!FS_OK) { U.toast('Not supported in this browser', 'warn'); return; }
    try {
      backupDirHandle = await window.showDirectoryPicker({ id: 'civitas-backups', mode: 'readwrite' });
      await kvSet('backupDirHandle', backupDirHandle);
      await maybeDailyBackup();
      U.toast('Backup folder set: ' + backupDirHandle.name, 'ok');
      updatePills();
    } catch (e) { if (e.name !== 'AbortError') U.toast(e.message, 'error'); }
  }

  async function chooseDropzone() {
    if (!FS_OK) { U.toast('Not supported in this browser', 'warn'); return null; }
    try {
      dropzoneHandle = await window.showDirectoryPicker({ id: 'civitas-dropzone', mode: 'readwrite' });
      await kvSet('dropzoneHandle', dropzoneHandle);
      U.toast('Dropzone connected: ' + dropzoneHandle.name, 'ok');
      updatePills();
      return dropzoneHandle;
    } catch (e) { if (e.name !== 'AbortError') U.toast(e.message, 'error'); return null; }
  }

  /** Re-grant permissions on handles restored from IndexedDB (needs one click per session). */
  async function reconnect() {
    let any = false;
    if (masterHandle && await askPermission(masterHandle)) {
      try { await loadFromHandle(); any = true; } catch (e) { U.toast('Could not read vault: ' + e.message, 'error'); }
    }
    if (backupDirHandle) any = (await askPermission(backupDirHandle)) || any;
    if (dropzoneHandle) any = (await askPermission(dropzoneHandle, 'readwrite')) || any;
    updatePills();
    if (any) {
      U.toast('Vault reconnected', 'ok');
      listeners.forEach(fn => fn());
      if (window.App) App.refreshAll();
    }
    return any;
  }

  /* ---------- export / import fallback (works in any browser) ---------- */

  function exportDownload() {
    U.download(`civitas-export-${U.todayISO()}.json`, JSON.stringify(state, null, 2));
    U.toast('Export downloaded', 'ok');
  }

  async function importFromFile(file) {
    const text = await U.readFileText(file);
    state = migrate(JSON.parse(text));
    touch();
    if (window.App) App.refreshAll();
    U.toast('State imported — connect a vault file to persist it', 'ok');
  }

  /* ---------- domain helpers ---------- */

  function statsFor(dateISO) {
    let row = state.campaignStats.find(r => r.date === dateISO);
    if (!row) { row = { date: dateISO, totalActions: 0, totalFocusSeconds: 0 }; state.campaignStats.push(row); }
    return row;
  }

  function logActivity(agentId, actionType, detail = '', ts = Date.now()) {
    state.activityFeed.push({ id: U.id('act'), agentId, actionType, detail, timestamp: ts });
    statsFor(U.dateISO(ts)).totalActions += 1;
    touch();
  }

  function addFocusSeconds(sec) {
    statsFor(U.todayISO()).totalFocusSeconds += Math.round(sec);
    touch();
  }

  function getVolunteer(ref) {
    return state.volunteers.find(v => v.id === ref || v.handle === ref || v.email === ref) || null;
  }

  /* ---------- status pills ---------- */

  function vaultStatus() {
    if (!FS_OK) return 'unsupported';
    if (!masterHandle) return 'none';
    return 'connected'; // permission re-checks happen on write
  }

  function updatePills() {
    const vp = document.getElementById('vault-pill');
    if (vp) {
      const st = vaultStatus();
      const map = {
        connected: ['pill-ok', 'VAULT: ' + (masterHandle ? masterHandle.name : '')],
        none: ['pill-warn', 'VAULT: NOT CONNECTED'],
        unsupported: ['pill-err', 'VAULT: BROWSER UNSUPPORTED'],
      };
      vp.className = 'pill ' + map[st][0];
      vp.textContent = map[st][1];
    }
    const bp = document.getElementById('backup-pill');
    if (bp) {
      bp.className = 'pill ' + (backupDirHandle ? 'pill-ok' : 'pill-warn');
      bp.textContent = backupDirHandle
        ? ('BACKUP: ' + backupDirHandle.name + (lastBackupDate ? ' ✓' + lastBackupDate.slice(5) : ''))
        : 'BACKUP: NO FOLDER';
    }
    const dp = document.getElementById('dropzone-pill');
    if (dp) {
      dp.className = 'pill ' + (dropzoneHandle ? 'pill-ok' : 'pill-warn');
      dp.textContent = dropzoneHandle ? 'DROPZONE: ' + dropzoneHandle.name : 'DROPZONE: NOT SET';
    }
  }

  /* ---------- init ---------- */

  async function init() {
    // 1. best-effort mirror so a fresh tab is never empty
    try {
      const mirror = localStorage.getItem('civitas-state-mirror');
      if (mirror) state = migrate(JSON.parse(mirror));
    } catch { /* corrupt mirror — start clean */ }

    // 2. restore persisted handles
    if (FS_OK) {
      try {
        masterHandle = (await kvGet('masterHandle')) || null;
        backupDirHandle = (await kvGet('backupDirHandle')) || null;
        dropzoneHandle = (await kvGet('dropzoneHandle')) || null;
      } catch (e) { console.warn('handle restore failed', e); }

      // 3. if the master file is still permitted, load it silently
      if (masterHandle && await hasPermission(masterHandle)) {
        try { await loadFromHandle(); } catch (e) { console.warn('vault read failed', e); }
      } else if (masterHandle) {
        U.toast('Vault locked — click RECONNECT in the vault menu', 'warn');
      }
    }

    // 4. automated backup loop
    setInterval(() => { if (masterHandle) maybeDailyBackup(); },
      Math.max(5, state.settings.backupEveryMin) * 60 * 1000);

    window.addEventListener('beforeunload', e => {
      if (dirty) { saveNow(); e.preventDefault(); e.returnValue = ''; }
    });

    updatePills();
  }

  return {
    init, touch, saveNow, snapshot,
    connectVault, reconnect, chooseBackupDir, chooseDropzone,
    exportDownload, importFromFile,
    logActivity, addFocusSeconds, statsFor, getVolunteer,
    vaultStatus, updatePills,
    onChange: fn => listeners.push(fn),
    getDropzone: () => dropzoneHandle,
    get state() { return state; },
    get fsSupported() { return FS_OK; },
  };
})();
