# Shortlist — TODO and Guardrails (read this first)

If you are an agent picking up this project, read this whole file before changing anything.
The deeper context is in `/home/ladliju/hackathon/gappy/plan.md` (final plan) and the bundle
build rules are in `AGENTS.md` (same folder). Do not re-plan the product. Build what is here.

## North star (do not drift from this)

Shortlist is a job-application command centre. A student pastes a job description, an agent
compares it to their resume and returns ONE verdict: **STRONG FIT / STRETCH / SKIP**, each with
the exact JD requirement quoted next to the verbatim resume line that proves it, the gaps they
are missing, and a tailored intro draft. STRETCH rows wait in a review queue for approval before
applying. The product is "decide and prove", not "track applications" and not a chatbot.

It is a **Lemma pod** (this directory, imported with `lemma pods import`). Target: Gappy AI
Hackathon, powered by Lemma SDK. Judged 35% problem clarity, 25% product judgment (no wasted
complexity), 25% execution (the core loop must actually work), 15% SDK use.

## THE ONE INVARIANT (breaking this kills the product)

**Cite-or-abstain.** The `matcher` agent may only claim a match it can prove with a resume line
copied verbatim from a `pod.files.search()` hit. No evidence in the resume means it is a GAP, not
a match. "Not enough proof" is a correct, expected answer. The `verify_citation` function exists
to enforce this (it asserts every `proof[].resume_evidence` is a real substring of `cv.md`).
If you touch the matcher instruction, keep this rule intact and keep verify_citation wired.

This is the answer to the judge's "did it hallucinate?". Do not weaken it for nicer-looking output.

## Hard rules (do not violate)

1. **No new dependencies.** The app is vanilla HTML/CSS/JS. The function uses the Python stdlib +
   pydantic (provided by Lemma) + the Lemma SDK. Do not add a framework, a build step, npm
   packages, or a vector DB. Lemma gives RAG (`pod.files.search`), tables, agents, and an app
   host already. Use them.
2. **Do not drag in career-ops.** We LIFTED prompts and schemas from `/home/ladliju/career-ops/`
   (scoring rubric, the Block B CV-match logic, archetypes, statuses, cover-letter shape). We do
   NOT want its CLI, job-board scanning (`providers/`, `scan*.mjs`), PDF generation, liveness
   checking, or batch runner. That is 10x scope creep and will cost the 25% "wasted complexity"
   score.
3. **No em dashes anywhere** (project-wide rule). Use commas, periods, or parentheses.
4. **Verdict strings are exact:** `STRONG FIT`, `STRETCH`, `SKIP`. The app maps these to colors by
   exact match and the agent `output_schema` enforces them. Do not rename or recase them.
5. **Status values are exact:** Evaluated, Applied, Responded, Interview, Offer, Rejected,
   Discarded, SKIP (lifted from career-ops `templates/states.yml`).
6. **Ship CORE first.** Core = table + matcher agent + board app + resume upload. Polish is
   explicitly optional per the rubric. Do not gold-plate before the core loop runs end to end.
7. **Keep the app's Lemma wiring intact when restyling.** The board boots by loading
   `/public/sdk/lemma-client.js` from `window.__LEMMA_CONFIG__.apiUrl`, then uses
   `client.records.list/update`, `client.agents.run("matcher", message, opts)`, and
   `client.datastore.watchChanges`. A redesign may change CSS/markup but MUST preserve this
   data wiring and the function names (`boot`, `load`, `runMatch`, `renderVerdict`,
   `renderBoard`, `renderReview`, `setStatus`).

## Lemma bundle rules (or the import fails)

- Folder name MUST equal each resource's JSON `name`.
- Bundle JSON is JSONC (`//` comments and trailing commas allowed). Long text/code lives in
  `{"$file": "..."}` sidecars (`instruction.md`, `code.py`, `html.html`).
- Every table/folder/function an agent or function touches must be granted by name in
  `permissions.grants`. Zero access by default.
- Import order: tables -> files (folders only) -> functions -> agents -> workflows -> apps.
- File bytes are NOT bundled; `cv.md` is uploaded after import.
- `verdict` and `status` are TEXT (not ENUM) on purpose: ENUM values with a space ("STRONG FIT")
  are risky at import. Do not "tidy" them back to ENUM without testing the import.
- Validate before importing: `lemma pods import ./shortlist --dry-run`.

## What is DONE (authored + statically checked, NOT yet run on a live pod)

```
shortlist/
  pod.json
  tables/applications/applications.json          # pipeline table (TEXT verdict/status)
  agents/matcher/matcher.json + instruction.md    # the product; lifted career-ops prompts
  functions/verify_citation/verify_citation.json + code.py   # self-check passes locally
  files/resume/.folder.json                        # /resume folder (cv.md uploaded later)
  apps/board/board.json + html.html                # dark operator UI; app JS parses clean
  README.md  AGENTS.md  TODO.md
```

Verified so far WITHOUT a login: app JS parses, all JSON parses, `code.py` self-check passes,
the board renders correctly with mocked data (screenshot), and the matcher prompt produces a
sane STRETCH verdict with verbatim proof when run by hand against `cv.md`.

## What is LEFT (in order)

Needs the user's lemma.work auth (cannot be done by an agent alone):
1. `lemma auth login`, select the cloud pod (`lemma pods`).
2. `lemma pods import ./shortlist --dry-run` then real import. Fix whatever the dry-run rejects
   (most likely candidates: the `.folder.json` shape, the agent `output_schema`, or a grant id).
3. `lemma files upload /home/ladliju/career-ops/cv.md /resume/cv.md` (confirm this is the right
   resume first; the user's email differs from the resume owner's).
4. `lemma apps deploy board`.
5. Run `lemma agents chat matcher "<a real JD>"`. Iterate the instruction until the verdict card
   shows real, verbatim proof and honest gaps. THIS is where the hours go.
6. Test 3 to 5 JDs. Find the "aha" case: a STRETCH the student would have wrongly skipped.

Deliberately DEFERRED (do not build unless explicitly asked; they are cut-line items):
- `review` workflow: the app's Approve/Apply buttons already do human approval. A parallel Lemma
  workflow duplicates it and risks the "wasted complexity" ding.
- `legitimacy` badge: the agent reasons it (Block G) but it is not persisted or shown in v1.
- Live `watchChanges` polish, multi-user, connectors, PDF, job-board import.

## Quality bar (the lazy-but-correct standard)

- Shortest diff that works. Delete before you add. Boring over clever.
- Every non-trivial change leaves one runnable check behind (see `code.py`'s `__main__`).
- If you simplify deliberately, say so in one line. If you cap something, name the ceiling.
- Do not claim "done" until you have RUN it. "Coded" and "works" are different. The import,
  the resume upload, the deploy, and one real matcher run are what prove it.

## Verification (how to know it actually works)

- `lemma pods import ./shortlist --dry-run` passes.
- After import + upload: `lemma agents chat matcher "<JD>"` returns structured JSON whose every
  `proof[].resume_evidence` string appears verbatim in `cv.md`.
- `verify_citation` sets `verified=true` on a clean row and flags a row with a fabricated quote.
- Deployed `board`: paste a JD -> a row appears with a verdict card; a STRETCH lands in the
  review queue; Approve moves it to Applied.
- Demo defense: click a proof row, the resume line is verbatim from `cv.md`.
