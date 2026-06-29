#input_type_name: VerifyInput
#output_type_name: VerifyResult
#function_name: verify_citation

try:
    from pydantic import BaseModel  # provided by the Lemma runtime
except ImportError:  # let the __main__ self-check run anywhere
    BaseModel = object


class VerifyInput(BaseModel):
    record_id: str


class VerifyResult(BaseModel):
    verified: bool
    bad_claims: list[str]


def _normalize(text: str) -> str:
    # ponytail: whitespace collapse + case fold only. Good enough because the matcher copies
    # evidence verbatim from search hits; upgrade to fuzzy match if PDF extraction mangles spacing.
    return " ".join(text.split()).lower()


def _unverified_claims(proof, resume_text: str) -> list[str]:
    """Requirement labels whose resume_evidence is NOT found verbatim in the resume."""
    resume = _normalize(resume_text)
    bad = []
    for item in proof or []:
        evidence = _normalize(str(item.get("resume_evidence", "")))
        if evidence and evidence not in resume:
            bad.append(str(item.get("requirement", evidence[:60])))
    return bad


async def verify_citation(ctx, data: VerifyInput) -> VerifyResult:
    from lemma_sdk import Pod

    pod = Pod.from_env()
    row = pod.table("applications").get(data.record_id)

    # Pull the resume text. cv.md lives under /resume; download its converted markdown.
    resume_text = ""
    try:
        resume_text = pod.files.download_markdown("/resume/cv.md").decode("utf-8", "ignore")
    except Exception:
        # Fallback: stitch together whatever the resume search returns.
        try:
            hits = pod.files.search("experience skills projects", scope_path="/resume").to_dict()
            items = hits.get("items", []) if isinstance(hits, dict) else hits
            resume_text = " ".join(h.get("content", "") for h in items)
        except Exception:
            resume_text = ""

    bad = _unverified_claims(row.get("proof") or [], resume_text)
    verified = len(bad) == 0

    note = row.get("notes") or ""
    if not verified:
        note = (note + f" [unverified claims: {', '.join(bad)}]").strip()
    pod.table("applications").update(data.record_id, {"verified": verified, "notes": note})

    return VerifyResult(verified=verified, bad_claims=bad)


if __name__ == "__main__":
    # ponytail: one runnable check for the only non-trivial logic (verbatim substring match).
    resume = "Built a multi-agent pipeline with HITL approval.\nCut p95 latency from 2.1s to 380ms."
    good = [{"requirement": "multi-agent", "resume_evidence": "Built a multi-agent pipeline with HITL approval."}]
    bad = [{"requirement": "Kubernetes", "resume_evidence": "Operated a 200-node Kubernetes cluster."}]
    assert _unverified_claims(good, resume) == []
    assert _unverified_claims(bad, resume) == ["Kubernetes"]
    # whitespace and case differences must still match
    assert _unverified_claims(
        [{"requirement": "latency", "resume_evidence": "cut P95   latency from 2.1S to 380MS"}], resume
    ) == []
    print("verify_citation self-check passed")
