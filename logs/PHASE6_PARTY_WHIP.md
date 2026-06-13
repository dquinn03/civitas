# Phase 6 — Party Whip Merge (ELI5 decision log)

*Build date: 13 June 2026 · v1.1.0*

## What happened
Darren supplied an earlier single-file prototype ("Civitas: Party Whip Operations"). We went through it like a parts bin: kept the good ideas, left the weak engines, and wired the keepers into the real modular system.

## What got wired in, explained like you're five

**1. Archetypes (Organizer / Academic / Journalist / General).**
Before, an agent's role was just a word. Now four special words carry strategy: Organizers DO things, Academics PROVIDE theory, Journalists AMPLIFY, Generals are high-command allies. Their cards get an icon and a coloured stripe so the roster reads at a glance. Any other word still works — the taxonomy is a magnet, not a cage.

**2. The War Room.**
A button that flips the roster from "phone book" to "targeting computer": tick the cohorts you want (just Generals, or Generals + Journalists), the roster narrows, and COPY EMAILS puts every visible address on the clipboard for a BCC blast. Mobilisation in three clicks.

**3. Tactical templates (mission packs you can replay).**
Campaigns repeat. Three packs are built in — Social Blast, MP Pressure, Sticker Run — and SAVE PACK turns your current active missions into a named pack you can redeploy forever. One safety rule: challenge missions are saved as trust missions inside templates, because the secret pass-answer must never live inside a reusable file.

**4. Live date preview.**
As you type "Call MP next Friday", a little 📅 line shows the date the parser understood — BEFORE you hit deploy. No more guessing what the machine heard.

**5. Exocortex toolbar + concept graph.**
Three buttons (bold, heading, [[link]]) that wrap whatever you've selected, and a GRAPH button that draws your notes as a constellation: each note is a star, each [[wiki link]] is a line between stars, hub notes glow bigger and pull to the centre. Click a star to fly to it.

**6. System Status panel.**
Vault menu → System status: how big the state is, how many of everything you have, a FULL BACKUP button, and a Factory Reset behind a double confirmation.

**7. Cowra clock + Substack button.**
The header now tells the time and carries a one-click door to the publishing front.

## What we deliberately did NOT take, and why

- **Its markdown "engine"** — it just swapped newlines for `<br>`. Ours parses headings, lists, quotes, code and wiki-links properly.
- **Its CSV importer** — split on commas, so any quoted field with a comma exploded. Ours is quote-aware.
- **Its intake form** — our RECRUIT dossier modal already does this with more fields and validation.
- **Its localStorage-only storage** — the whole point of Civitas is the vault file. localStorage stays a mirror, never the truth.
- **Its missions** — no constraints, no proof, no auditing. Would have reopened the exact Principal-Agent hole the Airlock closes.

## One thing we learned while testing
Running Commander and Frontline in the SAME browser means they share the same localStorage pocket — so testing the Burn Protocol wiped the Commander's mirror copy. The vault file didn't lose a byte, which is exactly the design working: the pocket is disposable, the file is the truth. (Recorded as SPEC amendment 12.)
