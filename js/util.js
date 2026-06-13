'use strict';
/* CIVITAS util.js — shared helpers: ids, dates, DOM, toast/modal, markdown, CSV, NLP dates.
   Vanilla ES6+, no dependencies. */

const U = {

  /* ---------- ids & time ---------- */

  id(prefix = 'id') {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  },

  todayISO(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  dateISO(ts) {
    return U.todayISO(new Date(ts));
  },

  fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  },

  fmtDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  },

  fmtDur(totalSec) {
    totalSec = Math.max(0, Math.round(totalSec));
    const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
  },

  /* ---------- strings & DOM ---------- */

  esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  el(tag, attrs = {}, html = '') {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    if (html) e.innerHTML = html;
    return e;
  },

  debounce(fn, ms) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  /* ---------- toast & modal ---------- */

  toast(msg, kind = 'info') {
    const root = document.getElementById('toast-root');
    if (!root) { console.log(`[toast:${kind}]`, msg); return; }
    const t = U.el('div', { class: `toast toast-${kind}` }, U.esc(msg));
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
  },

  /** Modal. actions: [{label, kind:'amber'|'ghost'|'danger', onClick(close)}]. Returns {el, close}. */
  modal({ title, body, actions = [], wide = false }) {
    const root = document.getElementById('modal-root');
    const overlay = U.el('div', { class: 'modal-overlay' });
    const box = U.el('div', { class: 'modal-box' + (wide ? ' modal-wide' : '') });
    box.innerHTML = `<div class="modal-title">${U.esc(title)}</div><div class="modal-body"></div><div class="modal-actions"></div>`;
    const bodyEl = box.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    const close = () => overlay.remove();
    const actEl = box.querySelector('.modal-actions');
    for (const a of actions) {
      actEl.appendChild(U.el('button', {
        class: `btn btn-${a.kind || 'ghost'}`,
        onclick: () => a.onClick ? a.onClick(close) : close()
      }, U.esc(a.label)));
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.appendChild(box);
    root.appendChild(overlay);
    return { el: box, close };
  },

  confirm(title, bodyHtml) {
    return new Promise(resolve => {
      U.modal({
        title, body: bodyHtml,
        actions: [
          { label: 'CANCEL', kind: 'ghost', onClick: c => { c(); resolve(false); } },
          { label: 'CONFIRM', kind: 'amber', onClick: c => { c(); resolve(true); } },
        ]
      });
    });
  },

  /* ---------- files ---------- */

  download(filename, text, mime = 'application/json') {
    const blob = new Blob([text], { type: mime });
    const a = U.el('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },

  readFileText(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = () => rej(r.error);
      r.readAsText(file);
    });
  },

  readFileDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  },

  /* ---------- CSV (quote-aware) ---------- */

  csvParse(text) {
    const rows = []; let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(x => x.trim() !== '')) rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.some(x => x.trim() !== '')) rows.push(row);
    return rows;
  },

  /* ---------- keyword tokens (for "Similar" panel) ---------- */

  STOPWORDS: new Set(('the a an and or but if then else for of to in on at by with from as is are was were be been being it its this that these those i you he she we they them his her our your not no yes do does did done have has had will would can could should may might must about into over under again more most other some such only own same so than too very just there here when where why how what which who whom').split(' ')),

  tokens(text) {
    const out = new Set();
    for (const m of String(text || '').toLowerCase().matchAll(/[a-z][a-z0-9']{2,}/g)) {
      if (!U.STOPWORDS.has(m[0])) out.add(m[0]);
    }
    return out;
  },

  /* ---------- natural language date extraction ----------
     Day-first (Australian) for numeric dates. Returns {date: 'YYYY-MM-DD'|null, cleaned}. */

  parseNaturalDate(text) {
    const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    let date = null, cleaned = text;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const take = (re, fn) => {
      const m = cleaned.match(re);
      if (m && !date) { date = fn(m); cleaned = cleaned.replace(re, '').replace(/\s{2,}/g, ' ').trim(); }
    };

    take(/\b(\d{4})-(\d{2})-(\d{2})\b/, m => `${m[1]}-${m[2]}-${m[3]}`);
    take(/\b(?:on\s+)?(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/, m => {
      const d = +m[1], mo = +m[2];
      let y = m[3] ? +m[3] : today.getFullYear();
      if (y < 100) y += 2000;
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      const dt = new Date(y, mo - 1, d);
      if (!m[3] && dt < today) dt.setFullYear(dt.getFullYear() + 1);
      return U.todayISO(dt);
    });
    take(/\btoday\b/i, () => U.todayISO(today));
    take(/\btomorrow\b/i, () => { const d = new Date(today); d.setDate(d.getDate() + 1); return U.todayISO(d); });
    take(/\bin\s+(\d+)\s+(day|days|week|weeks)\b/i, m => {
      const n = +m[1] * (m[2].startsWith('week') ? 7 : 1);
      const d = new Date(today); d.setDate(d.getDate() + n); return U.todayISO(d);
    });
    take(new RegExp('\\b(next\\s+)?(' + WD.join('|') + ')\\b', 'i'), m => {
      const target = WD.indexOf(m[2].toLowerCase());
      let ahead = (target - today.getDay() + 7) % 7;
      if (ahead === 0) ahead = 7;            // bare weekday = the coming one
      if (m[1]) ahead += ahead <= 3 ? 7 : 0; // "next X" pushes near days a week out
      const d = new Date(today); d.setDate(d.getDate() + ahead); return U.todayISO(d);
    });

    return { date, cleaned: cleaned || text };
  },
};

/* ---------- Markdown engine (regex/line-based, no deps) ----------
   Supports: # ## ### headings, **bold**, *italic*, `code`, ``` fences,
   - / 1. lists, > blockquotes, --- rules, [text](url) links, [[Wiki Links]]. */

const MD = {

  inline(s) {
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    s = s.replace(/\[\[([^\]]+)\]\]/g, (_, t) =>
      `<a href="#" class="wikilink" data-wiki="${t.trim()}">${t.trim()}</a>`);
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    return s;
  },

  render(src) {
    if (!src) return '';
    let text = U.esc(src);

    // fenced code blocks -> placeholders so inline rules never touch them
    const fences = [];
    text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
      fences.push(`<pre><code>${code.replace(/^\n/, '')}</code></pre>`);
      return ` F${fences.length - 1} `;
    });

    const lines = text.split('\n');
    const out = [];
    let list = null, quote = [], para = [];

    const flushPara = () => { if (para.length) { out.push(`<p>${MD.inline(para.join(' '))}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    const flushQuote = () => {
      if (quote.length) { out.push(`<blockquote>${MD.inline(quote.join(' '))}</blockquote>`); quote = []; }
    };
    const flushAll = () => { flushPara(); flushList(); flushQuote(); };

    for (const raw of lines) {
      const line = raw;
      let m;
      if (/^\s*$/.test(line)) { flushAll(); continue; }
      if ((m = line.match(/^(#{1,4})\s+(.*)/))) {
        flushAll();
        const lvl = m[1].length;
        out.push(`<h${lvl}>${MD.inline(m[2])}</h${lvl}>`);
      } else if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
        flushAll(); out.push('<hr>');
      } else if ((m = line.match(/^&gt;\s?(.*)/))) {
        flushPara(); flushList(); quote.push(m[1]);
      } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) {
        flushPara(); flushQuote();
        if (list !== 'ul') { flushList(); out.push('<ul>'); list = 'ul'; }
        out.push(`<li>${MD.inline(m[1])}</li>`);
      } else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) {
        flushPara(); flushQuote();
        if (list !== 'ol') { flushList(); out.push('<ol>'); list = 'ol'; }
        out.push(`<li>${MD.inline(m[1])}</li>`);
      } else if (/^ F\d+ $/.test(line.trim())) {
        flushAll(); out.push(line.trim());
      } else {
        flushList(); flushQuote(); para.push(line.trim());
      }
    }
    flushAll();

    return out.join('\n').replace(/ F(\d+) /g, (_, i) => fences[+i]);
  },
};
