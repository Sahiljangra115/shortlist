# Building this Lemma pod

This directory is a **pod bundle**: plain files imported with `lemma pods import`. The bundle is
the source of truth. Edit files, then re-import.

## Layout (folder name MUST equal each resource's `name`)

```
shortlist/
  pod.json
  tables/applications/applications.json
  agents/matcher/matcher.json + instruction.md
  functions/verify_citation/verify_citation.json + code.py
  workflows/review/review.json
  apps/board/board.json + html.html
  files/resume/.folder.json          # cv.md uploaded after import, not bundled
```

## Rules that bite
- **Zero access by default.** Every table/folder/function an agent or function touches is granted
  by name in its JSON `permissions.grants`.
- JSONC: `//` comments and trailing commas are allowed. Long text/code lives in `{"$file": "..."}`
  sidecars (`instruction.md`, `code.py`, `html.html`).
- Import order: tables -> files (folders only) -> functions -> agents -> workflows -> apps.
- File bytes are not bundled: `lemma files upload ./cv.md /resume/cv.md` after import.
- Validate before writing anything: `lemma pods import ./shortlist --dry-run`.

## The one rule the product depends on
The `matcher` agent must only ever quote resume evidence it copied verbatim from a resume search
hit. `verify_citation` enforces it. If you change the matcher prompt, keep cite-or-abstain intact.
