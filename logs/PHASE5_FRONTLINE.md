# Phase 5 — Frontline PWA (ELI5 decision log)

*Build date: 13 June 2026*

## What got built
The field terminal: an installable phone app that works with zero internet, takes evidence photos, squashes them, queues everything in IndexedDB, seals dispatches with real encryption, and can burn itself.

## Decisions, explained like you're five

**1. Why does Frontline use NO external libraries at all?**
The Commander sits in an office with internet. The agent stands in a paddock outside Cowra with zero bars. Every CDN library is a promise that the internet will be there — Frontline refuses to make that promise. Plain CSS, plain JS, service worker caches the lot on first visit, and from then on the app opens forever, offline, instantly.

**2. How does the photo squashing work?**
Phone cameras make 5MB photos; a dispatch must stay under 2MB with several photos inside. So: draw the photo onto an invisible canvas no wider than 1280px (that alone kills most of the weight), then save as JPEG at 80% quality, and if it's still too big, step the quality down (70%, 60%… floor 35%) until it fits ~400KB encoded. Bonus: re-drawing through a canvas strips the EXIF block — GPS and serial numbers in the photo file don't ride along by accident. (The *shift* geotag is separate and consensual.)

**3. How does the encryption actually protect anyone?**
The dispatch file sits in a Dropbox/SyncThing folder that other people might see. Web Crypto turns the passphrase into a key by folding it 250,000 times (PBKDF2 — slow on purpose, so guessing is expensive), then AES-GCM seals the payload. GCM also *authenticates*: if anyone flips a single bit in transit, decryption fails loudly instead of producing subtly-wrong data. Names, locations, photos — unreadable without the HQ passphrase.

**4. What is the black box telemetry, honestly?**
A list of timestamps: "tap at 14:02:11, tap at 14:02:43…". It does NOT record what was typed, where you were (beyond the shift geotag), or anything content-like. Its only job is to let the auditor answer one question: *was a human present and working across the shift, or did everything get punched in during 90 seconds at the pub?* That's the Principal-Agent fix: standardised proof of work that's cheap for honest agents and expensive for fakers.

**5. Why is the Burn Protocol so prominent?**
Field reality: phones get lost, borrowed, taken. The agent must be able to clear the device in less time than it takes someone to say "hand it over". Type BURN, tap once: IndexedDB deleted, localStorage cleared, caches purged, screen says TERMINAL CLEAN. It's deliberately dramatic — a safety control you have to *find* is not a safety control.

**6. Why must the shift start before missions can complete?**
Because unbounded claims are unauditable claims. The shift clock is what the density check divides by. No shift = the auditor literally cannot tell "3 tasks in 6 hours" from "3 tasks in 3 seconds" — so the app refuses to log work outside one, and HQ flags any dispatch that tries (`NO_SHIFT`).

**7. Why does the queue survive forever offline?**
IndexedDB is the phone's own filing cabinet — surviving reboots, airplane mode, weeks in a drawer. Completions queue locally and only leave the device inside a sealed dispatch the agent explicitly exports. Store-and-forward, like packet radio: black spots delay the mail, they never lose it.
