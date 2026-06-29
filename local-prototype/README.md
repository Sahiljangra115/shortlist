# Shortlist local prototype

The original FastAPI version of Shortlist, kept for local development. This predates the move to
the Lemma platform; the production system now lives in `../shortlist/`.

Self-contained, no Lemma account needed. Paths in `main.py` are relative to the working directory,
so run it from inside this folder:

```bash
pip install fastapi uvicorn pydantic python-multipart
python3 main.py
# open http://127.0.0.1:8000
```

- Sample job descriptions: `jd_1.txt`, `jd_2.txt`, `jd_3.txt`
- User data is written to a local `data/` directory (gitignored: holds credentials, resumes, PII)
- Email verification codes print to the terminal and to `data/last_verification_code.txt`

See `../docs/ARCHITECTURE.md` for the full backend design.
