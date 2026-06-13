# Phase 4 — Network CRM (ELI5 decision log)

*Build date: 13 June 2026*

## What got built
The people room: agent roster with XP and reliability scores, bulk CSV import, and the canvas topology graph.

## Decisions, explained like you're five

**1. What is the reliability score really?**
A slow-moving trust thermometer, 0–100, everyone starts at 70. Clean approved dispatches warm it (+2 per claim, capped +6). Every audit flag cools it (−5). A rejected dispatch cools it hard (−10). It never moves on opinion — only on audited events. So when you're deciding who gets the sensitive mission, the number summarises the *history*, and the Commander can still override it by hand in the dossier.

**2. Why XP as well as reliability?**
They answer different questions. XP = "how much have they done?" (volume, never goes down). Reliability = "can I believe what they report?" (quality, moves both ways). A high-XP low-reliability agent is a specific, dangerous animal — the two numbers side by side make that visible at a glance.

**3. Why does the topology graph route everything through HQ?**
Because that IS the real shape of the network — a hub-and-spoke cell structure where agents report to HQ and HQ assigns sectors. Drawing agent→sector lines directly would suggest agents coordinate with each other laterally; drawing the truth (agent → HQ → sector, line thickness = completions) makes the picture an honest map of how work actually flows.

**4. Why plain canvas instead of a graph library?**
The blueprint bans build pipelines, and a radial layout needs about 60 lines: agents on the left arc, sectors on the right, HQ in the middle, curves between. Hover = distance check to each node. Click an agent = open the dossier. A physics library would add 200KB to draw the same picture with more wobble.

**5. Why is the CSV importer so forgiving?**
Volunteer lists come from wherever — a spreadsheet export, a sign-up sheet typed in a hurry. So: headers matched loosely ("name" works for "handle"), any column order, quoted fields handled, skills split on `;` or `|`, duplicates (same email or handle) skipped not crashed, and a report at the end telling you exactly how many came in and how many were skipped.

**6. Why does approving a dispatch from an unknown agent auto-recruit them?**
Because the alternative is losing real work. The auditor still flags `UNKNOWN_AGENT` so you SEE it before approving — but if you approve, the system creates the dossier rather than dropping the dispatch on the floor. Trust the Commander's click, record everything.
