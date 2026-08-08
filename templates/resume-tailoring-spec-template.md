# Resume Tailoring Spec — template

Fill this in with your own information, then save it as `resume-tailoring-spec.md` in your
workspace directory (see README). It's the rulebook JF-assistant follows every time it tailors
your resume, this file is what makes tailoring specific to *you* instead of generic.

**If you don't fill this in at all**, JF-assistant falls back to a built-in generic ruleset (see
`JF-assistant.md`'s "Fallback tailoring rules" section) — one page, no fabrication, no em dashes,
reword only the summary/bullets. That works, but it's not going to be as sharp as a filled-in spec
tuned to your actual resume and how you write.

## Part 0 — Prime directives (edit the specifics, keep the shape)

1. You are tailoring an existing resume to a specific job description. You are NOT writing a new one.
2. Edit ONLY: [list which sections are fair game — e.g. "Professional Summary, Work Experience
   bullets, Project bullets, and the ordering of items inside Skills rows"]. Never touch: [list
   what's off-limits — e.g. "header, Education, dates, employer names, job titles"].
3. NEVER invent experience, tools, metrics, employers, or outcomes. Every claim must trace to the
   Fact Bank (Part 6) below. If a JD requires something in neither the resume nor the Fact Bank,
   leave it out and report it as a gap.
4. Preserve all formatting: fonts, sizes, spacing, bold runs, bullet indents, tab stops.
5. Output MUST remain exactly [however many pages your resume is — most people: 1]. Verify by
   rendering to PDF and counting pages.
6. Finish with a change report: keyword coverage before/after, every edit made, every JD
   requirement you refused to fabricate.

## Part 1 — Hard constraints (fill in numbers that match YOUR resume's actual current stats)

| Constraint | Rule |
|---|---|
| Page count | Exactly [N]. Verify by render, not estimate. |
| Bullet word count | Mean [X-Y] words. Hard max [N]. Never below [N]. |
| Hard metric density | At least [N]% of bullets carry a hard metric (a number). |
| Em dashes | Zero, if that's your preference. Otherwise state your own rule. |
| Voice | [e.g. "No 'I'/'my'. Start each bullet with a verb. Past tense except current role."] |
| Banned words | [list words/phrases you personally find generic-sounding or don't use] |
| Sections | [list your exact section names, in order — never add/reorder without asking] |

## Part 2 — Typography (do not change; describe what your resume already looks like)

Page size / margins / body font / body size / line spacing / section header spacing / bullet
indent style / date alignment — describe your actual resume's current formatting here so the
tailoring never accidentally drifts from it.

## Part 3 — Document structure

List your resume's actual sections and their fixed shape (how many entries, how many bullets each,
which are locked vs. which can flex).

## Part 4 — Tailoring procedure

The mechanism below works as-is for most people, edit only if your process differs:

1. Parse the JD — title, required skills, preferred skills, years required, domain, explicit
   keyword list. Mark required vs preferred.
2. Score baseline — match JD keywords against current resume text, record coverage % and every
   missing term.
3. Classify gaps — TRUE (fact bank supports it, not surfaced yet), ADJACENT (fact bank has an
   honest equivalent), ABSENT (no basis). Only TRUE/ADJACENT may be written.
4. Rewrite summary for keyword density, mirroring the JD's language where honest.
5. Surface TRUE gaps by rewording existing bullets, don't add new ones.
6. Reorder skills, JD-relevant items first.
7. Verify — render to PDF, run every check in Part 9.
8. Report — coverage before/after, edits made, ABSENT gaps refused.

## Part 5 — How to write a bullet

Formula: outcome first, mechanism second, always with a number if you have one.
Add a couple of GOOD/BAD examples from your own resume here — this is the single highest-leverage
thing to fill in, it teaches the tailoring what "sounds like you" actually means.

## Part 6 — Fact bank (the ONLY permitted source of truth — the most important part of this file)

This is the whole point of the spec. Every real accomplishment, metric, tool, and project you
want available for tailoring goes here, one row per topic. Anything not listed here must never
appear on a tailored resume, no matter how well it'd fit a JD. Mark anything true-but-currently-
unused as "(bench)" so it can be swapped in for the right JD without being on by default.

| Topic | Verified facts |
|---|---|
| [topic] | [the real, specific, factual claim — include exact numbers] |

## Part 7 — Forbidden claims

List anything you want explicitly never claimed even if a JD asks for it — technologies you don't
actually know, seniority you don't have, deployments that didn't happen, etc. For each, give the
honest alternative to say instead.

## Part 8 — Conditional swaps

If you keep interchangeable projects/emphases for different JD types, map them here: "if the JD
is X, then swap in Y, promote Z."

## Part 9 — Verification checklist

Run every check before returning the file:
- Render to PDF, assert page count matches Part 1.
- Assert bullet word counts within your stated range.
- Assert your stated metric density.
- Assert none of your banned words/forbidden claims appear.
- Assert header/education/dates are byte-identical to source.
- Diff against source — only the sections you named editable in Part 0 may differ.

## Part 10 — Output requirements

Filename convention, docx vs PDF handling, and where the file gets saved are controlled by
`JF-assistant.md` itself, not this spec — leave this section out unless you want to override that.
