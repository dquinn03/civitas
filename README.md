# CIVITAS

A **local-first, modular operating system for intellectual insurgency.** Based in Cowra, Regional NSW. It bridges deep heterodox economic research (MMT, Buffer Stock theory) and strategic political action — and it solves the Principal-Agent problem with an automated auditor, so the network can scale to remote volunteers without scaling trust.

No server. No cloud. No build pipeline. One JSON file on your hard drive is the entire database.

## Quick start (Commander)

1. Double-click **`start_civitas.bat`** — it serves the terminal at `http://localhost:8765/` and opens your browser. (The File System Access API needs a secure context; localhost qualifies, double-clicking `index.html` does not reliably.)
2. Use **Chrome or Edge** (the vault APIs are Chromium-only; Firefox falls back to manual export/import).
3. Click **VAULT → New Vault file…** and save `civitas-master.json` somewhere you control.
4. Click **VAULT → Choose backup folder…** — daily snapshots (`civitas-backup-YYYY-MM-DD.json`) write themselves.
5. The spotlight tour walks you through the rest. Rerun it any time with the **?** button.

Want a populated demo? **VAULT → Import JSON…** → `samples/civitas-sample-master.json`.

## Quick start (Field agent / Frontline)

1. On the agent's phone, open `http://<host>/frontline/` (serve the folder from any static host, or the same `start_civitas.bat` on a shared LAN). Add to home screen — it installs as an offline-first PWA.
2. Set a handle once. **START SHIFT** before working — hours are bounded by the shift clock and geotag.
3. Import a mission pack JSON from the shared sync folder, work the missions, then **ENCRYPT & DISPATCH**. The sealed file goes back into the sync folder.

The sample pack (`samples/missionpack-sample.json`) includes one mission of each constraint type. The challenge answer for mission 3 is `CARD04`.

## The sync loop (no server, ever)

```
HQ (Commander)                       Field (Frontline PWA)
   |                                       |
   |-- missionpack-*.json --> [Dropzone folder] --> import pack
   |                          (SyncThing /            |
   |                           Dropbox /          work missions
   |                           USB stick)             |
   |<-- dispatch-*.json <---- [Dropzone folder] <-- ENCRYPT & DISPATCH
   |
 AIRLOCK: decrypt -> auto-audit -> escrow -> APPROVE or REJECT
```

Dispatches are AES-GCM encrypted with a shared HQ passphrase (PBKDF2, 250k iterations) to protect activist identities in transit. Nothing merges into the master state until the Commander approves it in the **Airlock**.

## The automated auditor

Every incoming dispatch is checked before you even read it:

| Flag | What it catches |
|------|-----------------|
| `BATCH` | Multiple missions logged within impossibly short milliseconds — bulk back-fill, not live work |
| `DUPLICATE` | Evidence photo's SHA-256 hash matches one already accepted (recycled receipts) |
| `DENSITY` | Task count vs shift duration exceeds the plausible ceiling (default 12/hr) |
| `NO_SHIFT` | Claims without a bounding Start/End shift log |
| `UNENCRYPTED` | Dispatch arrived in cleartext |
| `UNKNOWN_AGENT` / `UNKNOWN_MISSION` | Identity or pack mismatch |

Approving clean work raises an agent's reliability score; flags and rejections erode it.

## Modules

- **EXOCORTEX** — markdown notes, `[[wiki links]]`, automatic backlinks + similar-note surfacing, a **concept graph** (notes as nodes, wiki-links as edges — click to jump), editor toolbar (bold / heading / wiki-link), manuscript compiler (tag → single chronological HTML for Substack), Tone.js brown/pink/rain noise.
- **OPS** — missions with validation constraints (Trust / Evidence / Challenge), natural-language due dates with a live parse preview ("call MP next Friday" → 📅 19/06), standing orders with midnight resets and streaks, Chart.js campaign-health dashboards, focus timer, mission pack broadcast, and **tactical templates** — three built-in campaign packs (Social Blast / MP Pressure / Sticker Run) plus save-your-own reusable packs.
- **NETWORK** — decentralised CRM: roster with XP and reliability, **archetype taxonomy** (Organizer / Academic / Journalist / General with colour-coded cards), the **War Room** (filter the roster to a target cohort and copy their emails for a BCC blast), bulk CSV import, interactive canvas topology graph (agents → HQ → completed sectors).
- **AIRLOCK** — dropzone scanner, decryption, automated audits, escrow approve/reject.
- **FRONTLINE** (`/frontline/`) — the agent PWA: offline-first service worker, IndexedDB queue, shift protocol with a live ON-DUTY ticker, evidence cam with canvas compression, briefings by file or paste (Signal-friendly), dispatches by sync-folder file or copy-paste of the sealed ciphertext, 9 Pocket MMT rebuttal cards with one-tap copy for online arguments, black-box telemetry, a Field Simulation trainer that demonstrates HQ's audit flags, and the Burn Protocol. Zero external dependencies — black spots can't touch it.

## Tech constraints (deliberate, permanent)

- Raw HTML5 + native ES6+ + CSS. **No Node, npm, webpack, React — ever.**
- External libraries via CDN only: Tailwind, FontAwesome, Chart.js, Tone.js, Canvas Confetti. The Commander degrades gracefully if CDNs are unreachable; **Frontline uses zero external libraries** so black spots can't hurt it.
- All state I/O through the native File System Access API + IndexedDB.

## Repo map

| Path | What |
|------|------|
| `index.html` + `js/` + `css/` | Commander Terminal |
| `frontline/` | Agent PWA (standalone) |
| `docs/SPEC.md` | Full blueprint incl. amendments made during the build |
| `logs/PHASE*.md` | ELI5 decision logs, one per build phase |
| `samples/` | Demo master state, mission pack, dispatch |
| `tools/md2html.py` | Regenerates the HTML twin of every markdown file |

Every `.md` in this repo has a generated `.html` sibling — run `python tools/md2html.py` after editing docs.
