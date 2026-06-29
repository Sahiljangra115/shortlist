# Shortlist — Final Build Plan

> Renamed from "Gappy" (the hackathon HOST is Gappy AI, gappy.ai). Working name:
> **Shortlist**. Alternates: Landed, FitCheck, Rolefit. Lock at submission.

## 0. The pin (no longer hypothetical)

- **Hackathon:** Gappy AI Hackathon ("Ship to Get Hired"), powered by **Lemma SDK**.
- **Deadline:** build window June 24-30, submit **June 30**. Today is June 28. ~2 days, solo.
- **Stack locked:** lemma.work **cloud** + **Claude Code login** as the model runtime.
- **Submission:** a form with (1) problem, (2) approach, (3) a 2-3 min screen recording of
  the working product, (4) team details. No deck. Core loop must work end to end.
- **Judging weights (optimize to these):**
  - 35% Problem clarity and real-world fit (biggest lever, won on framing)
  - 25% Product judgment ("any wasted complexity?" = ponytail is graded)
  - 25% Execution quality (core loop actually works in the recording)
  - 15% SDK utilisation (handled, the product IS a pod)

## 1. The product (one sentence)

**Shortlist is a job-application command centre for a final-year student applying to many
roles: you upload your resume and paste a job description, and an agent returns a verdict
(STRONG FIT / STRETCH / SKIP) with the exact JD requirements quoted and your matching resume
lines as proof, the gaps you are missing, and a tailored intro draft. STRETCH roles wait in a
review queue for your approval before you apply.**

User: one specific person, a final-year student / recent grad. Meta-aligned: the hackathon
is literally a hiring fast-track, so we build the thing that solves the event's own problem.

The wedge (what makes it win, not just exist): not "track applications" (Notion does that).
Shortlist **decides and proves**. Cite-or-abstain: it never claims a match without quoting
both the JD line and the resume line. That is the answer to the judge's "did it hallucinate?"

## 2. Reuse decision — lift from career-ops, do NOT rebuild

`/home/ladliju/career-ops/` already does resume-to-JD evaluation. Its matching brain lives in
PROMPTS (740+ real evaluations behind it), not code. We port the prompts and schemas.

LIFT (the day we would have spent building the matcher is already done):

| Asset | Source in career-ops | Used as |
|---|---|---|
| Scoring rubric (1-5, 5 dimensions) | `modes/_shared.md` (~L28-44) | maps to verdict bands below |
| CV-match-with-proof-and-gaps logic | `modes/oferta.md` Block B | the agent's core prompt |
| Ghost-job / legitimacy signals (bonus badge) | `modes/oferta.md` Block G | optional secondary flag |
| Machine-readable output shape (YAML) | `batch/batch-prompt.md` (~L188-204) | the agent's structured output |
| Application status enum | `templates/states.yml` | table `status` field |
| Tracker columns | `build-tracker.mjs` | table schema seed |
| Cover-letter payload shape | `generate-cover-letter.mjs` (~L106-148) | draft-message agent output |
| The actual resume (markdown) | `cv.md` | uploaded to pod files (RAG) |

IGNORE (Lemma replaces it natively, dragging it in = wasted complexity = lost points):
job-board scanning (`providers/*`, `scan*.mjs`), markdown tracking, Playwright liveness,
PDF generation, batch runner, all CLI orchestration. None of it ships in v1.

Verdict bands (lift the 1-5 score, relabel for the demo):
- **STRONG FIT** = score >= 4.0
- **STRETCH** = 3.0 to 3.9
- **SKIP** = below 3.0

## 3. Architecture — Shortlist IS a Lemma pod

| Piece | Lemma primitive |
|---|---|
| Resume (cv.md), indexed | **Files** built-in RAG (`pod.files.search`, returns `content`+`path`+`page`) |
| Applications pipeline | **Table** `applications` |
| The matcher (verdict + proof + gaps + draft) | **Agent** `matcher` (Claude) writing rows |
| Cite-or-abstain check (anti-hallucination) | **Function** `verify_citation` (deterministic) |
| Review-before-apply | **Workflow** `review` with a human **approval** step |
| The board UI | **App** single-file HTML, `lemma apps deploy` |

### Table `applications` (lean)

```
company        text
role           text
jd_text        text          # pasted JD
verdict        text          # STRONG FIT | STRETCH | SKIP
score          number        # 1-5
status         text          # Evaluated | Applied | Responded | Interview | Offer | Rejected | Discarded | SKIP
proof          json          # [ {requirement, resume_evidence, source_path} ]
gaps           json          # ["missing X", "no Y"]
draft_message  text          # tailored intro
needs_review   bool          # true when STRETCH
```

### Agent `matcher` (the product, spend best hours here)

```
input:  jd_text, company, role
steps:
  1. for each requirement in jd_text:
       hits = pod.files.search(requirement, method="HYBRID")   # search resume
       if a hit's content supports it -> proof += {requirement, resume_evidence=hit.content, source=hit.path}
       else -> gaps += requirement
  2. score 1-5 using lifted rubric (modes/_shared.md)
  3. verdict = band(score)
  4. draft_message = tailored intro (lift cover-letter payload shape)
  5. write one row to applications; needs_review = (verdict == STRETCH)
rule (cite-or-abstain): NEVER assert a match without a real resume substring in proof.
                        No evidence => it is a gap, not a fit.
```

### Function `verify_citation` (the demo defense)

```
for each item in row.proof:
    assert item.resume_evidence is a real substring of cv.md   # fabricated => flag row
```
This is the self-check that survives the judge clicking the citation.

### Workflow `review`
`STRETCH` (needs_review) pauses at a human approval step; status cannot move to `Applied`
until you approve. Confidence-gated escalation (the proven DocSync pattern).

### App `board`
Single HTML page: pipeline columns by status + a JD paste box (fires the agent) + the verdict
card (verdict badge, score stars, proof list showing JD-line next to resume-line, gaps,
editable draft, Approve / Apply buttons). Built with the ui-ux-pro skill.

## 4. Build blocks (gated, 2 days)

- **Block 0 (you, now):** create the lemma.work space, register for the hackathon, auth the
  CLI, provide the resume (cv.md exists), grab 3-5 real JDs to demo with.
- **Block 1 (Claude):** author pod skeleton, `applications` table + upload cv.md to files.
  Prove `files.search` returns sane resume chunks.
- **Block 2 (Claude):** the `matcher` agent prompt (lift Block B + scoring rubric + verdict
  bands + structured output) and `verify_citation`. This is the product.
- **Block 3 (Claude):** the `board` app (paste box, verdict card, pipeline) + `review`
  approval workflow. ui-ux-pro skill.
- **Block 4 (both):** end-to-end test on the 3-5 JDs. Find the one "aha" case (a STRETCH the
  student would have wrongly skipped, or a SKIP that looked tempting), proof shown.
- **Block 5 (you):** record 2-3 min demo, write the form answers, submit by June 30.

## 5. Demo script (the winning beat)

1. (15s) Problem: "A student applies to 40 roles and cannot tell which 5 are actually worth it."
2. (20s) Upload resume once. Paste a real JD.
3. (30s) Shortlist returns a verdict card: **STRETCH**, score 3.6, "you match 6 of 8
   requirements" with each match showing the JD line next to your resume line as proof, and
   the 2 gaps named, plus a tailored intro draft.
4. (20s) Punchline: "It does not just track. It decides, and it proves the decision."
5. The judge asks "did it hallucinate?" -> click a proof row, the resume line is verbatim.
   `verify_citation` guarantees it.

## 6. Task split

CLAUDE writes ALL code (you delegated this):
- pod table schema, `matcher` agent prompt, `verify_citation` function, `review` workflow,
  the `board` app HTML/CSS/JS.
- lifts and adapts the career-ops prompts and schemas.
- runs non-interactive `lemma` CLI commands (pod import, apps deploy) and tests the logic.

YOU do the things Claude cannot (browser / accounts / manual):
- [ ] Create the lemma.work space (paste the description from the last message). BROWSER.
- [ ] Register for the Gappy AI Hackathon before June 30. BROWSER.
- [ ] `lemma auth login` (browser OAuth) and, if needed, `lemma daemon start` to lend your
      Claude Code login to the cloud pod. Run these via `! <command>` so I see the output.
- [ ] Confirm the resume: cv.md exists; tell me if you want a different one.
- [ ] Grab 3-5 real job descriptions (copy the JD text). BROWSER.
- [ ] Click through the deployed app to sanity-check (or I drive it with Playwright).
- [ ] Record the 2-3 min demo and submit the form on June 30. BROWSER.

## 7. Open uncertainty (flagged honestly)

- Exact wiring for a **cloud pod agent powered by your Claude Code subscription** needs
  confirming at setup. Fallback if the subscription bridge is fiddly: set an Anthropic API
  key in the pod runtime profile. Confirm in Block 0.

## 8. Risks

- **Scope creep from career-ops.** It does 10x what we need. Lift prompts + schemas ONLY.
- **Hallucinated match = instant death.** Defense is structural: cite-or-abstain +
  `verify_citation` proves every quoted resume line is real.
- **Anti-pattern UI.** Not a public no-login query box. It is a logged-in pod app over a
  managed caseload, exactly Lemma's sweet spot.
- **2 days, solo.** Ship the core loop only. Polish is explicitly optional per the rubric.
