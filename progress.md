# Shortlist — Project Progress

This file tracks the implementation milestones, completed tasks, and upcoming goals for Shortlist.

## Milestones

### 1. Backend Server & APIs
- [x] Set up FastAPI framework and Uvicorn runner in `main.py`.
- [x] Configure CORS middleware for local testing.
- [x] Serve frontend files (`index.html`, `login.html`, `dashboard.html`, `/css`, `/js`) statically.
- [x] Implement local file storage database in `data/` folder.

### 2. Authentication & Email Verification
- [x] Implement `/api/auth/signup` to register new users and generate a 6-digit verification code.
- [x] Write generated code to `data/last_verification_code.txt` for easy reference.
- [x] Implement `/api/auth/verify` to confirm user status.
- [x] Implement `/api/auth/login` to authenticate only verified users.
- [x] Modify `login.html` to toggle between Login, Signup, and Verification tabs dynamically.
- [x] Connect frontend forms to backend authentication endpoints.

### 3. Resume Management
- [x] Implement `/api/resumes/upload` to store files in user directories under `data/resumes/`.
- [x] Implement `/api/resumes` to fetch user resumes and check which one is active.
- [x] Implement `/api/resumes/active` to set the active resume.
- [x] Implement `/api/resumes/{filename}` to delete resume files.
- [x] Create a side-by-side Resumes View in `dashboard.html` showing the upload zone and the active resume selection list.
- [x] Implement "Uploading..." loading spinner, disable buttons, and grey out state during file upload.
- [x] Connect drag-and-drop zone and click-to-browse events to call backend endpoints.

### 4. Matching & Applications Tracking
- [x] Connect Dashboard matching form to `/api/applications/match`.
- [x] Wire matching endpoint to upload active resume to Lemma pod (`/resume/cv.md`) and run the cloud `matcher` agent.
- [x] Parse PDF uploads on-the-fly to plain text using `pypdf` to prevent file corruption during upload and fix active resume sync commands.
- [x] Fall back gracefully to a Python-based match engine if Lemma is offline or not authenticated.
- [x] Return verdict (STRONG FIT, STRETCH, SKIP), citations list (proof), gaps list, score, and cover letter draft.
- [x] Log matching evaluations to user-specific json files under `data/applications/`.
- [x] Wire Review Queue approval and discard buttons to `/api/applications/update` (which updates local and cloud applications tables).
- [x] Populate Dashboard applications grid, review queue lists, and search input dynamically.
- [x] Preserve landing page JD input in `localStorage` and pre-populate dashboard on login.

### 5. Settings Configuration
- [x] Implement GET and POST `/api/settings` to load and save settings to local files.
- [x] Wire preferences save button and inputs in Settings view.

### 6. Hosting & Cloud Deploy
- [x] Deploy and host the static frontend board application on Lemma's server at https://shortlist-board.apps.lemma.work.

## Next Steps
- [ ] Record a 2-3 minute screen demo of the fully functioning local application.
- [ ] Package and submit the hackathon entry form.
