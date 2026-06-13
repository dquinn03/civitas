# Phase 2 — Exocortex (ELI5 decision log)

*Build date: 13 June 2026*

## What got built
The thinking room: markdown notes, `[[wiki links]]`, a context panel that finds backlinks and similar notes by itself, a manuscript compiler, and three flavours of focus noise.

## Decisions, explained like you're five

**1. Why write our own markdown engine instead of using a library?**
The blueprint says vanilla. A markdown engine is really just a list of "when you see THIS squiggle, draw THAT shape" rules — about 100 lines of regex. Owning it means wiki-links are first-class (libraries fight you on custom syntax) and there is one less stranger's code in the building.

**2. How do wiki links work?**
When the preview sees `[[Job Guarantee]]`, it draws a gold link. Click it: if a note with that exact title exists, you jump there. If it doesn't exist yet, the system CREATES it — because the moment you typed the brackets, you declared the idea matters. That's how a knowledge web grows: links first, notes second.

**3. How does "Similar" decide what's similar?**
Each note gets bagged into its meaningful words (tiny words like "the" are thrown out). Two notes are similar when their bags share many words, scaled so that giant notes don't win just by being giant (overlap ÷ √(size×size) — cosine-style). At least 2 shared words required, top 5 shown. Dumb, fast, no AI, works offline — exactly right for a thinking tool.

**4. Why does the manuscript compiler output HTML and not markdown?**
Because the destination is Substack/blog, which eats rich text. The compiler stitches every note wearing your chosen #tag into ONE chronological document, styled like a paper manuscript (serif, cream background — deliberately NOT terminal-dark, because it's for readers, not operators), then downloads it AND opens it for copy-paste.

**5. Why brown/pink/rain noise from Tone.js instead of mp3 files?**
Generated noise is *infinite* — no loop seams, no file size, no copyright. Brown noise = deep rumble (focus), pink = softer waterfall, rain = pink noise pushed through a slowly-wobbling filter so it shimmer like real weather. One catch: browsers refuse to make sound until you click something (autoplay rules), so noise only ever starts from the header buttons.

**6. Why does the context panel live on the right and update by itself?**
You should never have to ASK "what connects to this thought?" — the room should whisper it. Every time you open or edit a note, backlinks and similars recompute. At Cowra-scale (hundreds of notes) this costs milliseconds; no index needed.
