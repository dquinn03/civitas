# Phase 1 — Foundation (ELI5 decision log)

*Build date: 13 June 2026*

## What got built
The skeleton: one big JSON "toy box" that holds everything, the machinery to save it to a real file on the hard drive, automatic backup copies, and the dark terminal layout with four tabs.

## Decisions, explained like you're five

**1. Why is everything in ONE json file?**
Imagine all your toys in one box. If you want to move house, you carry one box. If you want a copy, you photocopy one box. If someone wants to spy on your toys, they have to come to YOUR house — there is no toy warehouse in the cloud to raid. That's data sovereignty.

**2. Why do you need to click "Reconnect" after restarting the browser?**
The browser is like a careful babysitter. Even if you said "Civitas can touch my file" yesterday, the babysitter asks again today: "still okay?" Browsers literally do not allow a website to silently regain file access after a restart — one click per session is the minimum the platform permits. So the button exists and the status pill turns yellow to remind you.

**3. Why a .bat launcher instead of double-clicking index.html?**
The special file-access powers only work when the page is served like a real website. `localhost` (your own computer talking to itself) counts as "real". Double-clicked files sometimes don't. The .bat file uses Python's built-in server — Python comes with the machine and is NOT a build pipeline; nothing gets compiled, it just hands files over.

**4. Why keep a copy in localStorage too?**
Belt AND braces. If you open the terminal before connecting the vault file, you still see your stuff (from the browser's pocket). But the pocket is small — photos can overflow it — so the file on disk is always the real truth and the pocket is just a comfort blanket. The save-dot turns RED when only the pocket copy worked, so you can't be fooled.

**5. Why daily backup files instead of one backup?**
If today's file gets corrupted and you only had one backup, the corruption might already be IN the backup. Date-stamped files (`civitas-backup-2026-06-13.json`) mean you can step back in time day by day. Snapshots add a "save before I do something scary" button.

**6. Why never trim the activity feed?**
It's the campaign's flight recorder. The dashboards, the audits, and the reliability scores are all calculated FROM it. Deleting old entries to "save space" would be eating the evidence. JSON text is tiny; disk space is not the scarce resource here — trust is.

## What I deliberately did NOT do
- No auto-connect to a default file path (browsers forbid it — and it would hide where your data lives).
- No cloud anything.
