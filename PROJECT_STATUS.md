# Shortlist — Project Status

This document captures the current status of the Shortlist project, version tracking, and operational notes.

## Current Status: HOSTED & READY
All core loops and requested features are fully implemented, tested, and functioning. The application runs locally using a FastAPI backend and preserves all user data, applications history, and resume uploads inside local files under the `data/` directory (no database required).

## Versioning
- **Current Version:** `v1.0.4-local`
- **Release Date:** June 29, 2026

## Features Implemented
1. **Dynamic Landing Page**: Features high-fidelity video background, scroll-driven word-by-word reveal, and fade-up layout animations. Preserves JD input before redirection.
2. **Email Verified Auth**: Swaps Sign In, Sign Up, and Code Verification views on the client. Verification code is logged on the backend console and written to `data/last_verification_code.txt` for simple verification.
3. **Multi-Resume Management**: Upload files (.md, .txt, .pdf) via drag-and-drop or browsing local files. Upload button greys out and displays "Uploading..." with a spinner. Lists resumes side-by-side, allowing active selection or deletion.
4. **Agent Matcher & Citations**: Evaluates Company, Role, and Job Description. Performs citation searches, highlights proof next to JD requirements, lists gaps, and generates a draft message.
5. **Applications Tracking**: Logs application status and histories to server files. Allows users to Approve & Apply or Discard stretch roles from the Review Queue.
6. **User Preferences**: Saves Display Name, Email, notifications checkbox, and cover letter tone choices.

## Version History
- **v1.0.4-local** (June 29, 2026): Fixed a bug where PDF uploads were corrupted on localhost (now extracting text on the fly), preventing indexing and write errors when syncing to Lemma pod.
- **v1.0.3-local** (June 29, 2026): Deployed and hosted the static frontend board application on Lemma's server at https://shortlist-board.apps.lemma.work.
- **v1.0.2-local** (June 29, 2026): Wired the FastAPI backend to the Lemma pod and its `matcher` agent, enabling automatic active resume syncing to `/resume/cv.md` and invoking the cloud matching agent.
- **v1.0.1-local** (June 29, 2026): Fixed a bug where `login.html` was blank because the `js/main.js` script tag was missing.
- **v1.0.0-local** (June 29, 2026): Initial release with FastAPI backend and local file databases.

## Known Issues
- *No critical issues.*

## Operational Checklist
- **Start Local Server:** `python3 main.py`
- **Access Site:** Open `http://127.0.0.1:8000` in your web browser.
- **Verification Codes:** Check the terminal stdout or open `data/last_verification_code.txt`.
- **User Files:** View `data/resumes/`, `data/applications/`, and `data/settings/`.
