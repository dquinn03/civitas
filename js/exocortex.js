'use strict';
/* CIVITAS exocortex.js — Module A: Strategy & Knowledge.
   Markdown notes, [[wiki-links]], context panel (backlinks + keyword-similar),
   manuscript compiler (filter by #tag -> single chronological HTML document). */

const Exo = (() => {

  let activeId = null;
  let previewMode = false;

  const $ = id => document.getElementById(id);

  /* ---------- note CRUD ---------- */

  function notes() { return Data.state.notes; }

  function newNote(title = 'Untitled') {
    const n = {
      id: U.id('note'), title, content: '', tags: [],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    notes().push(n);
    Data.logActivity('HQ', 'NOTE_CREATED', title);
    openNote(n.id);
    refreshList();
    return n;
  }

  function active() { return notes().find(n => n.id === activeId) || null; }

  function openNote(id) {
    activeId = id;
    const n = active();
    if (!n) return;
    $('exo-title').value = n.title;
    $('exo-tags').value = n.tags.join(', ');
    $('exo-content').value = n.content;
    setPreview(previewMode);
    renderContext();
    refreshList();
  }

  const persistEdit = U.debounce(() => {
    const n = active();
    if (!n) return;
    n.title = $('exo-title').value.trim() || 'Untitled';
    n.tags = $('exo-tags').value.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    n.content = $('exo-content').value;
    n.updatedAt = Date.now();
    Data.touch();
    refreshList();
    renderContext();
  }, 600);

  async function deleteActive() {
    const n = active();
    if (!n) return;
    if (!await U.confirm('DELETE NOTE', `Permanently delete <strong>${U.esc(n.title)}</strong>?`)) return;
    Data.state.notes = notes().filter(x => x.id !== n.id);
    activeId = Data.state.notes[0]?.id || null;
    Data.touch();
    if (activeId) openNote(activeId); else clearEditor();
    refreshList();
  }

  function clearEditor() {
    $('exo-title').value = ''; $('exo-tags').value = ''; $('exo-content').value = '';
    $('exo-preview').innerHTML = '<p class="dim">No note selected.</p>';
    $('exo-context').innerHTML = '';
  }

  /* ---------- list & search ---------- */

  function refreshList() {
    const q = $('exo-search').value.trim().toLowerCase();
    const list = $('exo-list');
    const items = notes()
      .filter(n => !q || n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    list.innerHTML = items.map(n => `
      <div class="note-item ${n.id === activeId ? 'active' : ''}" data-id="${n.id}">
        <div class="note-item-title">${U.esc(n.title)}</div>
        <div class="note-item-meta">${U.fmtDateTime(n.updatedAt)}
          ${n.tags.map(t => `<span class="chip">#${U.esc(t)}</span>`).join('')}</div>
      </div>`).join('') || '<p class="dim pad">No notes yet — create one.</p>';
    list.querySelectorAll('.note-item').forEach(el =>
      el.addEventListener('click', () => openNote(el.dataset.id)));
  }

  /* ---------- preview & wiki-links ---------- */

  function setPreview(on) {
    previewMode = on;
    $('exo-content').classList.toggle('hidden', on);
    $('exo-preview').classList.toggle('hidden', !on);
    $('exo-toggle').textContent = on ? 'EDIT' : 'PREVIEW';
    if (on) {
      const n = active();
      $('exo-preview').innerHTML = n ? (MD.render(n.content) || '<p class="dim">Empty note.</p>') : '';
    }
  }

  function followWiki(title) {
    const target = notes().find(n => n.title.toLowerCase() === title.toLowerCase());
    if (target) openNote(target.id);
    else {
      const n = newNote(title);
      n.content = `# ${title}\n\n`;
      openNote(n.id);
      U.toast(`Created new note: ${title}`, 'ok');
    }
  }

  /* ---------- context panel: backlinks + similar ---------- */

  function backlinksFor(note) {
    const needle = note.title.toLowerCase();
    return notes().filter(n => n.id !== note.id &&
      [...n.content.matchAll(/\[\[([^\]]+)\]\]/g)].some(m => m[1].trim().toLowerCase() === needle));
  }

  function similarTo(note) {
    const mine = U.tokens(note.title + ' ' + note.content);
    if (!mine.size) return [];
    return notes()
      .filter(n => n.id !== note.id)
      .map(n => {
        const theirs = U.tokens(n.title + ' ' + n.content);
        let overlap = 0;
        for (const t of mine) if (theirs.has(t)) overlap++;
        const score = overlap / Math.sqrt(mine.size * Math.max(1, theirs.size));
        return { n, score, overlap };
      })
      .filter(x => x.overlap >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  function renderContext() {
    const n = active();
    const ctx = $('exo-context');
    if (!n) { ctx.innerHTML = ''; return; }
    const back = backlinksFor(n);
    const sim = similarTo(n);
    ctx.innerHTML = `
      <div class="ctx-section">
        <div class="ctx-head"><i class="fa-solid fa-link"></i> BACKLINKS (${back.length})</div>
        ${back.map(b => `<a href="#" class="ctx-link" data-open="${b.id}">${U.esc(b.title)}</a>`).join('')
          || '<p class="dim">Nothing links here yet.</p>'}
      </div>
      <div class="ctx-section">
        <div class="ctx-head"><i class="fa-solid fa-diagram-project"></i> SIMILAR</div>
        ${sim.map(s => `<a href="#" class="ctx-link" data-open="${s.n.id}">
            ${U.esc(s.n.title)} <span class="dim">${(s.score * 100).toFixed(0)}%</span></a>`).join('')
          || '<p class="dim">No keyword overlap found.</p>'}
      </div>
      <div class="ctx-section">
        <div class="ctx-head"><i class="fa-solid fa-tags"></i> ALL TAGS</div>
        <div>${allTags().map(([t, c]) =>
          `<span class="chip chip-click" data-tag="${U.esc(t)}">#${U.esc(t)} ${c}</span>`).join('') || '<p class="dim">No tags.</p>'}</div>
      </div>`;
    ctx.querySelectorAll('[data-open]').forEach(a =>
      a.addEventListener('click', e => { e.preventDefault(); openNote(a.dataset.open); }));
    ctx.querySelectorAll('[data-tag]').forEach(c =>
      c.addEventListener('click', () => { $('exo-search').value = c.dataset.tag; refreshList(); }));
  }

  function allTags() {
    const counts = {};
    for (const n of notes()) for (const t of n.tags) counts[t] = (counts[t] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  /* ---------- editor toolbar: wrap/insert at the cursor ---------- */

  function insertText(before, after = '') {
    const ta = $('exo-content');
    if (previewMode) setPreview(false);
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e);
    ta.value = value.slice(0, s) + before + sel + after + value.slice(e);
    ta.focus();
    const pos = sel ? s + before.length + sel.length + after.length : s + before.length;
    ta.setSelectionRange(sel ? pos : pos, pos);
    persistEdit();
  }

  /* ---------- concept graph: notes as nodes, [[wikilinks]] as edges ---------- */

  let graphNodes = [];

  function conceptGraph() {
    const ns = notes();
    if (!ns.length) { U.toast('No notes to graph yet', 'warn'); return;}
    const body = U.el('div');
    body.innerHTML = `<canvas id="exo-graph" width="820" height="520" style="width:100%;background:#0f1119;border-radius:8px;cursor:pointer"></canvas>
      <p class="dim" style="margin:6px 0 0">Edges are [[wiki links]]. Click a node to open the note.</p>`;
    const modal = U.modal({
      title: 'CONCEPT GRAPH — ' + ns.length + ' NOTES', body, wide: true,
      actions: [{ label: 'CLOSE', kind: 'ghost' }],
    });

    const canvas = body.querySelector('#exo-graph');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const byTitle = new Map(ns.map(n => [n.title.toLowerCase(), n]));

    // edges from wikilinks (unresolved links are ignored — they're future notes)
    const edges = [];
    for (const n of ns) {
      for (const m of n.content.matchAll(/\[\[([^\]]+)\]\]/g)) {
        const t = byTitle.get(m[1].trim().toLowerCase());
        if (t && t.id !== n.id) edges.push([n.id, t.id]);
      }
    }
    const degree = {};
    edges.flat().forEach(id => degree[id] = (degree[id] || 0) + 1);

    // circle layout, hubs pulled toward the centre
    graphNodes = ns.map((n, i) => {
      const angle = (i / ns.length) * Math.PI * 2 - Math.PI / 2;
      const pull = 1 - Math.min(0.55, (degree[n.id] || 0) * 0.12);
      return {
        n, x: W / 2 + Math.cos(angle) * (W / 2 - 90) * pull,
        y: H / 2 + Math.sin(angle) * (H / 2 - 60) * pull,
        r: 7 + Math.min(10, (degree[n.id] || 0) * 2),
      };
    });
    const pos = Object.fromEntries(graphNodes.map(g => [g.n.id, g]));

    ctx.strokeStyle = 'rgba(232,184,75,.45)';
    ctx.lineWidth = 1.4;
    for (const [a, b] of edges) {
      ctx.beginPath(); ctx.moveTo(pos[a].x, pos[a].y); ctx.lineTo(pos[b].x, pos[b].y); ctx.stroke();
    }
    for (const g of graphNodes) {
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fillStyle = degree[g.n.id] ? '#e8b84b' : '#566074';
      ctx.fill();
      ctx.fillStyle = '#d8dbe2'; ctx.font = '11px Consolas, monospace'; ctx.textAlign = 'center';
      ctx.fillText(g.n.title.slice(0, 26), g.x, g.y + g.r + 13);
    }

    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * sx, y = (e.clientY - rect.top) * sy;
      const hit = graphNodes.find(g => (g.x - x) ** 2 + (g.y - y) ** 2 <= (g.r + 8) ** 2);
      if (hit) { modal.close(); openNote(hit.n.id); }
    });
  }

  /* ---------- manuscript compiler ---------- */

  function compileDialog() {
    const tags = allTags();
    const body = U.el('div');
    body.innerHTML = `
      <p>Compile every note carrying a tag into one chronological HTML document, ready for Substack or the blog.</p>
      <label class="lbl">TAG</label>
      <input id="compile-tag" class="inp" list="compile-tags" placeholder="e.g. manuscript">
      <datalist id="compile-tags">${tags.map(([t]) => `<option value="${U.esc(t)}">`).join('')}</datalist>
      <label class="lbl"><input type="checkbox" id="compile-newest"> Newest first (default oldest → newest)</label>`;
    U.modal({
      title: 'MANUSCRIPT COMPILER', body,
      actions: [
        { label: 'CANCEL', kind: 'ghost' },
        {
          label: 'COMPILE', kind: 'amber', onClick: close => {
            const tag = document.getElementById('compile-tag').value.trim().replace(/^#/, '');
            const newest = document.getElementById('compile-newest').checked;
            if (!tag) { U.toast('Enter a tag', 'warn'); return; }
            close();
            compile(tag, newest);
          }
        },
      ]
    });
  }

  function compile(tag, newestFirst) {
    const picked = notes()
      .filter(n => n.tags.some(t => t.toLowerCase() === tag.toLowerCase()))
      .sort((a, b) => newestFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);
    if (!picked.length) { U.toast(`No notes tagged #${tag}`, 'warn'); return; }
    const articles = picked.map(n => `
      <article>
        <h2>${U.esc(n.title)}</h2>
        <p class="meta">${U.fmtDateTime(n.createdAt)} · tags: ${n.tags.map(t => '#' + U.esc(t)).join(' ')}</p>
        ${MD.render(n.content)}
      </article>`).join('\n<hr>\n');
    const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Manuscript — #${U.esc(tag)}</title>
<style>
 body{max-width:720px;margin:2rem auto;padding:0 1rem;font:17px/1.65 Georgia,serif;color:#1c1c1c;background:#fbf9f4}
 h1,h2,h3{font-family:Georgia,serif;line-height:1.25} h1{border-bottom:3px double #888;padding-bottom:.4rem}
 .meta{color:#777;font-size:.85rem} blockquote{border-left:3px solid #b88d2c;margin-left:0;padding-left:1rem;color:#444}
 code{background:#eee;padding:.1em .35em;border-radius:3px} pre{background:#222;color:#eee;padding:1rem;overflow:auto;border-radius:6px}
 pre code{background:none} hr{border:none;border-top:1px solid #ddd;margin:2.5rem 0} a{color:#8a6210}
</style></head><body>
<h1>Manuscript — #${U.esc(tag)}</h1>
<p class="meta">Compiled ${U.fmtDateTime(Date.now())} · ${picked.length} notes · CIVITAS Exocortex</p>
${articles}
</body></html>`;
    U.download(`manuscript-${tag}-${U.todayISO()}.html`, doc, 'text/html');
    const win = window.open('', '_blank');
    if (win) { win.document.write(doc); win.document.close(); }
    Data.logActivity('HQ', 'MANUSCRIPT_COMPILED', `#${tag} (${picked.length} notes)`);
    U.toast(`Compiled ${picked.length} notes tagged #${tag}`, 'ok');
  }

  /* ---------- init ---------- */

  function init() {
    $('exo-new').addEventListener('click', () => newNote());
    $('exo-delete').addEventListener('click', deleteActive);
    $('exo-toggle').addEventListener('click', () => setPreview(!previewMode));
    $('exo-compile').addEventListener('click', compileDialog);
    $('exo-graph-btn').addEventListener('click', conceptGraph);
    $('exo-bold').addEventListener('click', () => insertText('**', '**'));
    $('exo-h1').addEventListener('click', () => insertText('# '));
    $('exo-wikibtn').addEventListener('click', () => insertText('[[', ']]'));
    $('exo-search').addEventListener('input', refreshList);
    ['exo-title', 'exo-tags', 'exo-content'].forEach(id =>
      $(id).addEventListener('input', persistEdit));
    $('exo-preview').addEventListener('click', e => {
      const a = e.target.closest('.wikilink');
      if (a) { e.preventDefault(); followWiki(a.dataset.wiki); }
    });
    show();
  }

  function show() {
    refreshList();
    if (!activeId && notes().length) openNote(notes()[0].id);
    else if (!notes().length) clearEditor();
  }

  return { init, show, openNote, newNote };
})();
