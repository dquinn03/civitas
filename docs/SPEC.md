# Project Blueprint: Civitas

**Mission:** A local-first, modular operating system for intellectual insurgency.

**Core Context:** Based in Cowra, Regional NSW. The system bridges deep heterodox economic research (MMT, Buffer Stock theory) and strategic political action.

**Risk Model:** Designed to solve the Principal-Agent problem. As the network scales to include remote volunteers or paid organisers, the system acts as an automated auditor to prevent shirking, standardise proof of work, and verify resource allocation.

## 1. Strict Architectural Constraints & Tech Stack

- **No Build Pipelines:** Absolutely no Node.js, Webpack, React, or npm installations.
- **Vanilla Foundations:** Raw HTML5, native JavaScript (ES6+), and CSS.
- **External Libraries (CDN only):** Tailwind CSS, FontAwesome, Chart.js (analytics), Tone.js (sensory audio), Canvas Confetti (gamification).
- **Modular Frontend:** `index.html` imports logic via distinct `<script src="js/module.js">` tags (`util.js`, `crypto.js`, `data.js`, `audio.js`, `exocortex.js`, `ops.js`, `network.js`, `airlock.js`, `onboarding.js`, `app.js`).
- **Absolute Data Sovereignty:** Core state managed via the native File System Access API, reading/writing one master `.json` file on the Commander's hard drive.
- **Automated Redundancy:** Timestamped backup snapshots (`civitas-backup-YYYY-MM-DD.json`) write automatically to a local directory.

## 2. Core Data Schema (The Master State)

```
volunteers:    [{ id, email, handle, location, role, xp, skills[], notes, joined, reliabilityScore }]
missions:      [{ id, text, priority, constraints:{type, challengeHash?}, sector, due, completed,
                  completedAt, completedBy, evidence, isStandingOrder, lastCompletedDate, streak,
                  timestamp, broadcastAt }]
notes:         [{ id, title, content (markdown), tags[], createdAt, updatedAt }]
activityFeed:  [{ id, agentId, actionType, detail, timestamp }]
campaignStats: [{ date, totalActions, totalFocusSeconds }]
evidenceHashes:{ sha256 -> {agentId, missionId, date} }      // auditor memory
processedDispatchIds: []                                      // replay protection
settings:      { backupEveryMin, densityMaxPerHour, batchWindowMs }
```

## 3. Agent Synchronisation: The "Dropzone" & "Airlock"

- **The Sync Directory:** Commander and Agents share an OS-level folder (SyncThing, Dropbox, USB).
- **Briefings (HQ → Field):** HQ broadcasts Mission Packs as JSON to the Dropzone.
- **Execution & Compression:** Frontline uses the HTML5 Canvas API to forcefully downscale/compress photos (max 1280px, JPEG quality stepping 0.8 → 0.35) before Base64 conversion, so Dispatch JSON stays well under 2MB.
- **Encrypted Dispatches (Field → HQ):** Payloads are encrypted with the native Web Crypto API — AES-GCM 256 with a PBKDF2-SHA256 passphrase-derived key (250k iterations, random salt + IV per dispatch) — protecting activist identities.
- **The Airlock:** The Commander terminal scans the Dropzone. Dispatches enter an escrow staging area rather than writing directly to the database. Approve merges; Reject penalises.

## 4. Module Specifications (Commander Terminal)

### Module A: The Exocortex (Strategy & Knowledge)
- Robust regex Markdown engine: headings, bold, italic, lists, blockquotes, code, fenced blocks, links.
- Wiki-linking: `[[Concept]]` renders clickable; clicking a link to a missing note creates it.
- Context Panel (split-view sidebar): **Backlinks** (notes linking here) + **Similar** (keyword-frequency overlap, normalised) + tag cloud.
- Manuscript Compiler: filter by #tag → single chronological HTML document for Substack/blog, downloaded and opened.
- Sensory Environment: Tone.js infinite brown noise, pink noise, and rain filter.

### Module B: Unified Command (Operations)
- Mission Validation Constraints: **Trust** (binary), **Evidence** (photo/text receipt), **Challenge** (specific input, verified against a SHA-256 hash so the answer never travels in cleartext).
- Natural Language Parsing: regex date extraction — "next Friday", "tomorrow", "in 3 days", "12/7", ISO. Day-first (AU).
- Physical Campaign Integration: missions reference physical artifacts (e.g. "Distribute Card 04: Basic Income"); Pocket MMT on Frontline carries the digital twins.
- Standing Orders & Streaks: daily routines reset autonomously at midnight (date-derived, so no timer can miss it); consecutive-day streaks.
- Campaign Health Dashboards: Chart.js — Activity (bar), Focus Time (line), Time Patterns by hour (bar). Focus timer banks deep-work seconds into `campaignStats`.

### Module C: Agent Network (Decentralised CRM)
- Automated Auditing Logic (runs in the Airlock on every dispatch):
  - **Batch Flag** — completions logged within impossibly short milliseconds (default window 5000ms).
  - **Duplicate Flag** — incoming Base64 image SHA-256 vs all historical hashes and within-dispatch repeats.
  - **Density Check** — total shift duration vs task count (default ceiling 12 tasks/hour); `NO_SHIFT` when unbounded.
- Bulk CSV Import: quote-aware parser mapping Email, Handle/Name, Location, Role, Skills.
- Network Topology Graph: interactive HTML5 Canvas — agents (left) → HQ (centre) → completed operational sectors (right); edge weight = completion count; hover tooltips; click an agent for the dossier.
- Spotlight Onboarding: dark mask with cut-out + tooltip steps; runs on first launch, rerunnable via HELP.

## 5. Module D: Civitas Frontline (The Agent Terminal)

A heavily restricted, standalone Progressive Web App for field operatives.

- **Service Worker / Offline-First:** `manifest.json` + cache-first service worker; functions flawlessly in regional black spots. Queue stored in IndexedDB.
- **The Shift Protocol:** "Start Shift" logs a Unix timestamp and geotag (where permitted), bounding billable/volunteer hours.
- **Evidence Cam:** `<input type="file" accept="image/*" capture="environment">` forces live camera usage where the platform honours it.
- **Pocket MMT (Analog/Digital Bridge):** offline accordion of digital rebuttals matching the printed "Old Way vs New Way" campaign cards (8 cards shipped, incl. Card 04: Basic Income).
- **Black Box Telemetry:** silent background array of UI interaction timestamps verifying agent presence; batched into IndexedDB; capped summary (last 500 events) rides each dispatch.
- **Burn Protocol:** dominant UI button → type `BURN` → `indexedDB.deleteDatabase()` + `localStorage.clear()` + cache purge, instantly.

## 6. Development Sequence

- **Phase 1: Foundation.** Master JSON structure, File System Access API read/write, automated backup loops, core UI layout. ✅
- **Phase 2: Exocortex.** Markdown parsing, wiki-linking, Context Panel algorithms, Manuscript Compiler, Tone.js. ✅
- **Phase 3: Operations & Airlock.** Task deployment, constraint logic, natural-language parsing, Dropzone ingestion UI. ✅
- **Phase 4: Network CRM.** Topology canvas, CSV import, automated auditing algorithms. ✅
- **Phase 5: Frontline PWA.** Mobile build, Service Workers, Canvas compression, Web Crypto encryption, shift telemetry. ✅

---

## 7. Amendments (decided during the build — 13 June 2026)

Reality-checks against browser platform constraints. None weaken the blueprint; each is logged ELI5 in `logs/`.

1. **Localhost launcher required.** The File System Access API pickers and service workers need a *secure context*. `file://` double-click is not reliably one, so `start_civitas.bat` serves everything at `http://localhost:8765` via Python's stdlib server (no Node, constraint intact). Frontline in the field must be served over HTTPS or LAN-localhost for the PWA install + service worker to engage.
2. **Chromium requirement for the vault (Commander only).** `showOpenFilePicker`/`showDirectoryPicker` exist only in Chrome/Edge. Fallback export/import buttons keep every other browser functional, with a red status pill making the degradation visible. Frontline deliberately avoids these APIs entirely.
3. **One-click reconnect per session.** Browsers may demote persisted file-handle permissions to "prompt" between sessions; regaining them requires a user gesture. Hence the explicit **VAULT → Reconnect** action instead of a silent (impossible) auto-grant.
4. **Frontline ships with zero CDN dependencies** (plain CSS, no Tailwind/FontAwesome/Chart.js). The spec's CDN list applies to the Commander Terminal; a field terminal that must work in black spots cannot gamble on a CDN being cached. The Commander itself degrades gracefully (charts/confetti/audio skip; core never breaks) if CDNs are unreachable.
5. **Dispatch replay protection by id, not file-moves.** Processed dispatches are remembered in `processedDispatchIds` rather than moving/deleting files in the Dropzone — file mutations in a SyncThing folder cause sync conflicts; ids don't.
6. **Challenge answers stored as SHA-256 hashes** in mission packs, so the pass-answer never travels or rests in cleartext on agent devices.
7. **`capture="environment"` is advisory** on some browsers (iOS Safari honours it loosely). Treated as friction-not-proof; the canvas re-encode strips EXIF either way, and the duplicate-hash audit catches recycled images at HQ.
8. **`activityFeed` is append-only and never trimmed** — it is the analytical record the dashboards and audits are built on. The localStorage *mirror* of state is best-effort only (evidence images can exceed its quota); the vault file on disk is canonical.
9. **Backup cadence:** a daily file (`civitas-backup-YYYY-MM-DD.json`, overwritten through the day on every save + every 30 minutes) plus on-demand timestamped `civitas-snapshot-*.json` for pre-surgery saves.
10. **Audio requires a user gesture** (browser autoplay policy) — noise starts from the header buttons, never automatically.
