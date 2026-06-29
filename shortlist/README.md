# Shortlist

A job-application command centre. Paste a job description and Shortlist returns a **verdict**
(STRONG FIT / STRETCH / SKIP) with the JD requirements quoted next to the resume lines that
**prove** them, the **gaps** you are missing, and a **tailored intro draft**. STRETCH roles wait
in a review queue for your approval before you apply.

It does not just track applications. It **decides and proves**: every claimed match cites a
verbatim line from your resume, so "did it hallucinate?" is answered with one click.

## What is in this pod

| Resource | Role |
|---|---|
| `applications` table | one row per evaluated job: verdict, score, proof, gaps, draft, status |
| `matcher` agent | the engine: searches the resume, scores 1-5, writes the verdict row |
| `verify_citation` function | asserts every quoted resume line is real; sets `verified` |
| `review` workflow | human approval for STRETCH rows before they move to Applied |
| `board` app | the operator UI: paste a JD, see the verdict card, work the pipeline |
| `/resume` folder | holds `cv.md`, auto-indexed (built-in RAG) |

## Build loop

```bash
lemma pods import ./shortlist --dry-run   # validate every resource + grant, write nothing
lemma pods import ./shortlist             # upsert by resource name
lemma files upload ./cv.md /resume/cv.md  # the resume is NOT bundled; upload after import
lemma apps deploy board
```

## Verify

```bash
lemma agents chat matcher "<paste a job description>"
# expect a structured verdict whose proof[].resume_evidence strings appear verbatim in cv.md
```

## Notes
- The matcher's brain is lifted from a job-evaluation system tuned over 700+ real evaluations
  (`/home/ladliju/career-ops/modes/`): scoring rubric, CV-match logic, archetypes, legitimacy
  signals. We ported the prompts and schemas, not the CLI.
- `files/resume/.folder.json` declares the folder so the agent's `/resume` grant resolves at
  import time; confirm the exact folder-bundle schema against the lemma-builder references if
  dry-run complains.
