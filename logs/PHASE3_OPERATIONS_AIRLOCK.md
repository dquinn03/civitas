# Phase 3 — Operations & Airlock (ELI5 decision log)

*Build date: 13 June 2026*

## What got built
The doing room: missions with three kinds of proof, plain-English due dates, standing orders with streaks, dashboards, the focus timer — plus the Airlock that receives field dispatches into quarantine.

## Decisions, explained like you're five

**1. Why three constraint types?**
Different jobs deserve different proof. "Read the council agenda" — just say you did it (**Trust**). "Letterbox Brisbane St" — show me the photo (**Evidence**). "Attend the meeting" — tell me the code word the organiser gave out (**Challenge**). Picking the proof level AT CREATION TIME is the whole anti-shirking design: the agent always knows what counts as done.

**2. Why store challenge answers as hashes?**
A hash is a fingerprint: you can check a finger matches, but you can't rebuild the finger from the print. Mission packs travel through shared folders — if the pack carried the answer in plain text, any agent could read it out and "pass". With SHA-256, the pack carries only the fingerprint.

**3. How does "Call MP next Friday" become a date?**
A small set of patterns runs over the text: today / tomorrow / next friday / in 3 days / 12/7 / ISO dates. Day-first because Australia. The matched phrase is removed from the mission text and becomes the due date. If the parser is unsure, it simply doesn't set a date — a wrong guess is worse than no guess.

**4. Why do standing orders reset at midnight without a timer?**
The trick: we never store "done = yes". We store the *date* it was last done. The question "is it done?" is really "was it done TODAY?" — and that answer changes to "no" all by itself when the clock passes midnight. A timer just repaints the screen. Timers can be missed (laptop asleep); dates cannot.

**5. Why does the Airlock exist instead of writing dispatches straight in?**
Quarantine. A field report is a *claim*, not a fact. Claims sit in escrow where the auditor stamps them (BATCH / DUPLICATE / DENSITY flags) and the Commander reads the stamps before any of it touches the master file. Approve = merge + XP + reliability up. Reject = reliability down. The database stays clean by construction, not by cleanup.

**6. Why remember processed dispatch IDs instead of deleting the files?**
The dropzone is a *shared* folder (SyncThing/Dropbox). If HQ deletes or moves a file, the sync engine propagates that mutation to every device and conflicts bloom. Instead HQ keeps a list of "already seen" dispatch ids — files can stay, rescans skip them, replays are impossible.

**7. Why does the focus timer need a BANK button?**
Deliberate ritual. The timer measures; banking *commits* the session to the campaign record (and the charts). Auto-banking would pollute the stats with abandoned half-sessions.
