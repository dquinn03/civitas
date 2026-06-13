# Phase 7 — Frontline Field Merge (ELI5 decision log)

*Build date: 13 June 2026 · v1.1.1*

## What happened
Second parts-bin pass: Darren supplied a "Civitas Frontline v1.0" prototype. Same drill as Phase 6 — keep the field-craft ideas, refuse the fake machinery.

## What got wired in, explained like you're five

**1. The live shift ticker.**
Before: "since 10:43". Now: **ON DUTY 00:14:32**, counting every second, with the ON SHIFT label pulsing like a recording light. Why it matters: an agent who can SEE the clock running treats the shift as real. The clock is the contract.

**2. Paste-import briefings.**
File pickers on phones are misery. Mission packs often arrive as a blob of text in Signal anyway — so now there's a box: paste, tap LOAD, done. Same validation as the file path; just a second door into the same room.

**3. Copy the sealed dispatch.**
The dispatch file was download-only. But the sealed packet is AES-GCM ciphertext — gibberish without the HQ passphrase — so it's safe to shove through ANY channel: paste it into Signal, an email, whatever's working out there. After sealing, a COPY SEALED JSON button offers exactly that. The sync folder is the highway; the clipboard is the goat track.

**4. Copy-rebuttal buttons on Pocket MMT.**
The cards were built for the doorstep, but half the arguments happen online. Every card now has ⧉ COPY REBUTTAL — one tap puts the New Way text on the clipboard, ready to paste into the comment war.

**5. Card 09: "How Do We Pay For It?"**
The prototype reminded us we'd skipped THE question — the one every proposal dies on. The answer stays on-doctrine: the issuer spends money into existence (we "found" billions overnight for wars and banks); the honest audit is of workers, materials and energy, never the accounting.

**6. Field Simulation (the clever one).**
A dev button that fakes a shirker: 3 completions injected 250 milliseconds apart on a seconds-long shift. Why build a cheat? Because it's a VACCINE, not a cheat — dispatch the burst to HQ and watch the Airlock light up with BATCH, DENSITY and UNKNOWN_MISSION flags. It proves the auditor works, end to end, and it trains new commanders to read the flags before the first real dispute happens. Verified live: all four flags fired.

## What we deliberately did NOT take

- **Its "camera"** — generated a random string and called it an image hash. Ours captures a real photo, compresses it on a canvas, and HQ hashes the actual pixels. A random string can't be caught recycling.
- **Its plaintext dispatches** — JSON in the clear with agent emails inside. Ours never leaves the device unsealed.
- **Its localStorage state** — wiped by any browser cleanup. Our queue lives in IndexedDB and survives weeks offline.
- **Its merge-skip on re-import** — skipping known mission ids means a corrected pack can't fix a typo'd mission. Ours overwrites by id: HQ's latest word wins.

## Bookkeeping
Service worker cache key bumped to `civitas-frontline-v2` so installed PWAs pull the new shell on next visit. Recorded as SPEC amendment 12.
