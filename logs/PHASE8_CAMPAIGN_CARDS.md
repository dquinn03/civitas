# Phase 8 — Campaign Cards Integration (ELI5 decision log)

*Build date: 13 June 2026 · v1.1.2*

## What happened
Third parts-bin pass: Darren supplied "Fightback 2.0 — Campaign Cards (Print Ready)", a standalone HTML page of 17 fold-and-cut policy cards in "Old Way vs New Way" format. Same drill as Phases 6 and 7 — extract what's genuinely useful, wire it in properly, refuse the weak machinery.

## What got wired in, explained like you're five

**1. The print-ready card gallery (`campaign/cards.html`).**
A standalone page served from the same localhost as the Commander. Screen view: dark terminal theme, 17 cards in a 2-column grid. Print view (`Ctrl+P` or the ⎙ PRINT button): the dark theme strips away to white, each card gets a dashed fold-and-cut border, two cards side by side on A4 landscape. You print, cut, fold — done. The CARDS button in the Commander header opens it in a new tab.

Why a separate page? Because print is a different medium entirely. A modal inside the Commander would be the wrong tool — you'd have to scroll through all of it to find what you want, and the print layout would fight the app chrome. A dedicated page is a one-purpose tool that can be handed off: bookmark it, save it, email the URL to a volunteer and they can print their own pack.

**2. The Platform tab in Frontline.**
Frontline already had Pocket MMT (9 rebuttal cards: when someone says "printing money causes inflation" or "the grandkids will pay for it", you have the MMT response). Platform is different — it's the affirmative pitch. "What will you do about unemployment?" gets a Platform card; "but how do you pay for it?" gets an MMT card.

The 17 platform cards live in a fifth nav tab (⚑ PLATFORM) between POCKET MMT and DISPATCH. Same accordion pattern as the MMT tab: tap the topic to expand it, Old Way on the left, New Way on the right, one-tap copy button puts the New Way text on the clipboard for online arguments.

Why a fifth tab? Four was already tight. But the Platform is a distinct layer of the argument — one answers the epistemological/monetary questions, the other answers the substantive policy questions. Merging them into a single 26-card accordion would make both harder to find and blur the distinction between "why the money exists" and "what we'll do with it". Separate tabs, separate purposes.

**3. Telemetry hooks.**
Platform card copies are logged to the black-box telemetry array as `platform:copy:01` etc., exactly like MMT card copies. This lets Darren see which platform cards get the most field use — a real-world signal for where the arguments land and where more training is needed.

## What we deliberately did NOT take

- **Its Google Fonts CDN import** — Frontline has zero external dependencies (no CDN ever; must work in black spots). The campaign/cards.html Commander page could use it, but system fonts work equally well and are lighter.
- **Its print-specific JavaScript** — the prototype used JS to clone and rearrange DOM for printing. CSS `@media print` handles everything we need without the complexity, and it degrades cleanly if JS is disabled.

## The two-card-type system, explained

| | Pocket MMT | Platform Cards |
|---|---|---|
| Question answered | "Why does the money even exist?" | "What will you do with it?" |
| Argument type | Epistemological / monetary theory | Substantive policy |
| Example trigger | "Won't that cause inflation?" | "What about housing?" |
| Count | 9 | 17 |
| Location | Frontline MMT tab | Frontline PLATFORM tab + campaign/cards.html |

They're complementary, not redundant. A volunteer needs both: the Platform card to explain what we're proposing, the MMT card when the standard objection ("but where does the money come from?") lands.

## Bookkeeping
Service worker bumped to `civitas-frontline-v3` so installed PWAs pull the new shell with the 5th tab. Commander CSS version bumped to `?v=1.1.2`. Recorded as SPEC amendment 14.
