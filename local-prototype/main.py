import json
import os
import random
import re
import shutil
import time
import subprocess
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
DATA_DIR = "data"
USERS_FILE = os.path.join(DATA_DIR, "users.json")
LAST_CODE_FILE = os.path.join(DATA_DIR, "last_verification_code.txt")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, "resumes"), exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, "applications"), exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, "settings"), exist_ok=True)

if not os.path.exists(USERS_FILE):
    with open(USERS_FILE, "w") as f:
        json.dump({}, f)

# ── AUTHENTICATION MODELS AND HELPERS ──

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class VerifyRequest(BaseModel):
    email: str
    code: str

class LoginRequest(BaseModel):
    email: str
    password: str

def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, "r") as f:
            return json.load(f)
    except:
        return {}

def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)

@app.post("/api/auth/signup")
async def signup(req: SignupRequest):
    users = load_users()
    email = req.email.strip().lower()
    if email in users:
        if users[email].get("verified", False):
            raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate 6-digit verification code
    code = f"{random.randint(100000, 999999)}"
    
    users[email] = {
        "name": req.name.strip(),
        "password": req.password,
        "verified": False,
        "verification_code": code
    }
    save_users(users)
    
    # Save the last code to a file so it's easily read in the demo environment
    with open(LAST_CODE_FILE, "w") as f:
        f.write(code)
        
    return {"message": "Verification code generated", "email": email}

@app.post("/api/auth/verify")
async def verify(req: VerifyRequest):
    users = load_users()
    email = req.email.strip().lower()
    if email not in users:
        raise HTTPException(status_code=404, detail="User not found")
        
    if users[email].get("verification_code") == req.code:
        users[email]["verified"] = True
        users[email]["verification_code"] = ""
        save_users(users)
        return {"message": "Email verified successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid verification code")

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    users = load_users()
    email = req.email.strip().lower()
    if email not in users:
        raise HTTPException(status_code=400, detail="Invalid email or password")
        
    user = users[email]
    if user["password"] != req.password:
        raise HTTPException(status_code=400, detail="Invalid email or password")
        
    if not user.get("verified", False):
        raise HTTPException(status_code=401, detail="Email not verified")
        
    return {"email": email, "name": user["name"]}

# ── RESUME MANAGEMENT ──

def get_user_resumes_dir(email: str):
    # Ensure safe folder name
    safe_email = re.sub(r'[^a-zA-Z0-9_-]', '_', email)
    user_dir = os.path.join(DATA_DIR, "resumes", safe_email)
    os.makedirs(user_dir, exist_ok=True)
    return user_dir

@app.post("/api/resumes/upload")
async def upload_resume(
    x_user_email: str = Header(...),
    file: UploadFile = File(...)
):
    email = x_user_email.strip().lower()
    user_dir = get_user_resumes_dir(email)
    
    # Clean filename
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', file.filename)
    file_path = os.path.join(user_dir, filename)
    
    try:
        content = await file.read()
        if filename.lower().endswith(".pdf"):
            import io
            import pypdf
            pdf_file = io.BytesIO(content)
            reader = pypdf.PdfReader(pdf_file)
            text_content = "".join([page.extract_text() or "" for page in reader.pages])
        else:
            text_content = content.decode("utf-8", errors="ignore")
            
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text_content)
            
        # check if active resume exists, if not set this one
        active_path = os.path.join(user_dir, "active_resume.txt")
        if not os.path.exists(active_path):
            with open(active_path, "w", encoding="utf-8") as f:
                f.write(filename)
            sync_active_resume_to_lemma(file_path)
                
        return {"filename": filename, "size": len(content)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/api/resumes")
async def list_resumes(x_user_email: str = Header(...)):
    email = x_user_email.strip().lower()
    user_dir = get_user_resumes_dir(email)
    
    files = []
    active_resume = ""
    
    active_path = os.path.join(user_dir, "active_resume.txt")
    if os.path.exists(active_path):
        with open(active_path, "r", encoding="utf-8") as f:
            active_resume = f.read().strip()
            
    for f in os.listdir(user_dir):
        if f == "active_resume.txt":
            continue
        full_path = os.path.join(user_dir, f)
        if os.path.isfile(full_path):
            files.append({
                "name": f,
                "size_kb": round(os.path.getsize(full_path) / 1024, 1),
                "is_active": f == active_resume
            })
            
    files.sort(key=lambda x: x["name"])
    return {"resumes": files, "active": active_resume}

@app.post("/api/resumes/active")
async def set_active_resume(
    x_user_email: str = Header(...),
    payload: dict = None
):
    if not payload or "filename" not in payload:
        raise HTTPException(status_code=400, detail="Filename required")
    filename = payload["filename"]
    email = x_user_email.strip().lower()
    user_dir = get_user_resumes_dir(email)
    
    file_path = os.path.join(user_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Resume file not found")
        
    active_path = os.path.join(user_dir, "active_resume.txt")
    with open(active_path, "w", encoding="utf-8") as f:
        f.write(filename)
    sync_active_resume_to_lemma(file_path)
        
    return {"message": f"Active resume set to {filename}"}

@app.delete("/api/resumes/{filename}")
async def delete_resume(filename: str, x_user_email: str = Header(...)):
    email = x_user_email.strip().lower()
    user_dir = get_user_resumes_dir(email)
    
    file_path = os.path.join(user_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Resume not found")
        
    os.remove(file_path)
    
    # check active
    active_path = os.path.join(user_dir, "active_resume.txt")
    if os.path.exists(active_path):
        with open(active_path, "r", encoding="utf-8") as f:
            active_resume = f.read().strip()
        if active_resume == filename:
            os.remove(active_path)
            remaining = [f for f in os.listdir(user_dir) if f != "active_resume.txt" and os.path.isfile(os.path.join(user_dir, f))]
            if remaining:
                with open(active_path, "w", encoding="utf-8") as f_act:
                    f_act.write(remaining[0])
                    
    return {"message": "Resume deleted successfully"}

# ── LOGICAL MATCHING ENGINE ──

def extract_requirements(jd_text: str) -> List[str]:
    lines = jd_text.split('\n')
    reqs = []
    for line in lines:
        line = re.sub(r'^[\s\-\*\u2022\d\.]+', '', line).strip()
        if 15 < len(line) < 200:
            lower = line.lower()
            if any(k in lower for k in [
                'experience', 'proficien', 'knowledge', 'ability', 'skill',
                'familiar', 'understand', 'year', 'degree', 'work with',
                'develop', 'design', 'build', 'manage', 'lead', 'strong',
                'excellent', 'qualification'
            ]):
                reqs.append(line)
    if len(reqs) < 3:
        for line in lines:
            line = re.sub(r'^[\s\-\*\u2022\d\.]+', '', line).strip()
            if 20 < len(line) < 200 and line not in reqs:
                reqs.append(line)
    return reqs[:12]

def find_evidence(requirement: str, resume_text: str) -> Optional[str]:
    if not resume_text:
        return None
    req_words = re.findall(r'\b\w{4,}\b', requirement.lower())
    stopwords = {
        'with', 'that', 'this', 'have', 'from', 'will', 'been', 'more',
        'than', 'also', 'such', 'they', 'their', 'about', 'would', 'could',
        'should', 'which', 'experience', 'ability', 'strong', 'excellent',
        'qualification', 'requirements'
    }
    keywords = [w for w in req_words if w not in stopwords]
    if not keywords:
        return None
    
    lines = resume_text.split('\n')
    best_line = None
    best_score = 0
    for line in lines:
        if len(line.strip()) < 10:
            continue
        lower_line = line.lower()
        score = sum(1 for kw in keywords if kw in lower_line)
        if score > best_score:
            best_score = score
            best_line = line.strip()
    return best_line if best_score >= 1 else None

def generate_intro(company: str, role: str, proof: list) -> str:
    if proof:
        evidence = proof[0]['resume_evidence']
        evidence = re.sub(r'^[\s\-\*\u2022\d\.]+', '', evidence).strip()
        if len(evidence) > 120:
            evidence = evidence[:120] + "..."
        return f"Hi {company} team, I noticed your opening for the {role} role. My experience includes {evidence}, which directly aligns with your requirements. I would love to discuss how I can contribute to your team."
    else:
        return f"Hi {company} team, I am writing to express my interest in the {role} role. I would love to discuss how my background and skills align with your needs."

def sync_active_resume_to_lemma(file_path: str):
    try:
        cmd = ["lemma", "file", "write", "/resume/cv.md", "--from", file_path]
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"Successfully synced active resume to Lemma: {file_path}")
    except Exception as e:
        print(f"Failed to sync active resume to Lemma pod: {e}")

def run_lemma_match(email: str, company: str, role: str, jd_text: str, resume_path: str):
    sync_active_resume_to_lemma(resume_path)
    
    try:
        message = f"Company: {company}\nRole: {role}\n\nJob description:\n{jd_text}"
        cmd = ["lemma", "agent", "run", "matcher", message, "--json"]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        if proc.returncode != 0:
            print(f"Lemma agent run failed (code {proc.returncode}): {proc.stderr}")
            return None
            
        output_data = None
        for line in proc.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
                if msg.get("type") == "completed" and "data" in msg:
                    output_data = msg["data"].get("output_data")
                    if output_data:
                        break
                elif msg.get("type") == "message" and "data" in msg:
                    metadata = msg["data"].get("metadata", {})
                    if metadata.get("is_final_answer"):
                        structured = metadata.get("structured_output")
                        if structured:
                            output_data = structured
                            break
            except:
                pass
                
        if output_data:
            proof = output_data.get("proof", [])
            gaps = output_data.get("gaps", [])
            verdict = output_data.get("verdict", "SKIP")
            score = output_data.get("score", 1.0)
            draft = output_data.get("draft_message", "")
            company_out = output_data.get("company", company)
            role_out = output_data.get("role", role)
            
            needs_review = (verdict == "STRETCH")
            app_id = output_data.get("record_id") or f"app_{int(time.time())}_{random.randint(1000,9999)}"
            
            return {
                "id": app_id,
                "company": company_out,
                "role": role_out,
                "jd_text": jd_text,
                "verdict": verdict,
                "score": score,
                "status": "Evaluated",
                "proof": proof,
                "gaps": gaps,
                "draft_message": draft,
                "needs_review": needs_review,
                "verified": True,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
    except Exception as e:
        print(f"Error running match via Lemma agent: {e}")
        
    return None

# ── APPLICATIONS / APPLIED TRACKING ──

def get_user_applications_file(email: str):
    safe_email = re.sub(r'[^a-zA-Z0-9_-]', '_', email)
    return os.path.join(DATA_DIR, "applications", f"{safe_email}.json")

def load_applications(email: str):
    app_file = get_user_applications_file(email)
    if not os.path.exists(app_file):
        return []
    try:
        with open(app_file, "r") as f:
            return json.load(f)
    except:
        return []

def save_applications(email: str, apps):
    app_file = get_user_applications_file(email)
    with open(app_file, "w") as f:
        json.dump(apps, f, indent=2)

class MatchRequest(BaseModel):
    company: Optional[str] = ""
    role: Optional[str] = ""
    jd: str

@app.post("/api/applications/match")
async def run_match(
    req: MatchRequest,
    x_user_email: str = Header(...)
):
    email = x_user_email.strip().lower()
    user_dir = get_user_resumes_dir(email)
    
    # Get active resume
    active_path = os.path.join(user_dir, "active_resume.txt")
    if not os.path.exists(active_path):
        raise HTTPException(status_code=400, detail="No resume uploaded. Please upload a resume first.")
        
    with open(active_path, "r", encoding="utf-8") as f:
        active_filename = f.read().strip()
        
    resume_path = os.path.join(user_dir, active_filename)
    if not os.path.exists(resume_path):
        raise HTTPException(status_code=400, detail="Active resume file not found. Please upload again.")
        
    with open(resume_path, "r", encoding="utf-8") as f:
        resume_text = f.read()
        
    # Infer fields if missing
    company = req.company.strip()
    if not company:
        comp_match = re.search(r'(?:at|@|company[:\s]*|join[:\s]*)\s*([A-Z][A-Za-z0-9\s&.]+)', req.jd)
        company = comp_match.group(1).strip()[:30] if comp_match else "Company"
        
    role = req.role.strip()
    if not role:
        role_match = re.search(r'(?:role|position|title|hiring)[:\s]*([^\n]{5,50})', req.jd, re.IGNORECASE)
        role = role_match.group(1).strip() if role_match else "Role"
        
    # Attempt Lemma matching first
    lemma_result = run_lemma_match(email, company, role, req.jd, resume_path)
    if lemma_result:
        apps = load_applications(email)
        apps.insert(0, lemma_result)
        save_applications(email, apps)
        return lemma_result

    print("Falling back to local heuristic matcher...")
    # Process Match
    requirements = extract_requirements(req.jd)
    proof = []
    gaps = []
    
    for req_item in requirements:
        evidence = find_evidence(req_item, resume_text)
        if evidence:
            proof.append({
                "requirement": req_item,
                "resume_evidence": evidence
            })
        else:
            gaps.append(f"{req_item} (No evidence in resume)")
            
    match_ratio = len(proof) / len(requirements) if requirements else 0
    score = round(1.0 + match_ratio * 4.0, 1)
    score = min(5.0, max(1.0, score))
    
    if score >= 4.0:
        verdict = "STRONG FIT"
    elif score >= 3.0:
        verdict = "STRETCH"
    else:
        verdict = "SKIP"
        
    needs_review = (verdict == "STRETCH")
    draft = generate_intro(company, role, proof)
    
    app_id = f"app_{int(time.time())}_{random.randint(1000,9999)}"
    
    new_app = {
        "id": app_id,
        "company": company,
        "role": role,
        "jd_text": req.jd,
        "verdict": verdict,
        "score": score,
        "status": "Evaluated",
        "proof": proof,
        "gaps": gaps,
        "draft_message": draft,
        "needs_review": needs_review,
        "verified": True,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    
    apps = load_applications(email)
    apps.insert(0, new_app)
    save_applications(email, apps)
    
    return new_app

@app.get("/api/applications")
async def list_applications(x_user_email: str = Header(...)):
    email = x_user_email.strip().lower()
    return load_applications(email)

class UpdateAppStatusRequest(BaseModel):
    id: str
    status: str
    needs_review: Optional[bool] = False

@app.post("/api/applications/update")
async def update_application_status(
    req: UpdateAppStatusRequest,
    x_user_email: str = Header(...)
):
    email = x_user_email.strip().lower()
    apps = load_applications(email)
    
    updated = False
    for app in apps:
        if app["id"] == req.id:
            app["status"] = req.status
            app["needs_review"] = req.needs_review
            updated = True
            break
            
    if not updated:
        raise HTTPException(status_code=404, detail="Application not found")
        
    save_applications(email, apps)
    return {"message": "Application status updated successfully"}

# ── SETTINGS MANAGEMENT ──

def get_user_settings_file(email: str):
    safe_email = re.sub(r'[^a-zA-Z0-9_-]', '_', email)
    return os.path.join(DATA_DIR, "settings", f"{safe_email}.json")

@app.get("/api/settings")
async def get_settings(x_user_email: str = Header(...)):
    email = x_user_email.strip().lower()
    settings_file = get_user_settings_file(email)
    
    if os.path.exists(settings_file):
        try:
            with open(settings_file, "r") as f:
                return json.load(f)
        except:
            pass
            
    # Default settings
    users = load_users()
    name = users.get(email, {}).get("name", email.split("@")[0])
    return {
        "name": name,
        "email": email,
        "notify_stretch": True,
        "cover_letter_tone": "Professional"
    }

class SettingsRequest(BaseModel):
    name: str
    email: str
    notify_stretch: bool
    cover_letter_tone: str

@app.post("/api/settings")
async def save_settings(
    req: SettingsRequest,
    x_user_email: str = Header(...)
):
    email = x_user_email.strip().lower()
    settings_file = get_user_settings_file(email)
    
    data = {
        "name": req.name.strip(),
        "email": req.email.strip(),
        "notify_stretch": req.notify_stretch,
        "cover_letter_tone": req.cover_letter_tone
    }
    
    with open(settings_file, "w") as f:
        json.dump(data, f, indent=2)
        
    # Also update user profile name
    users = load_users()
    if email in users:
        users[email]["name"] = req.name.strip()
        save_users(users)
        
    return {"message": "Settings saved successfully"}

# ── SERVE STATIC FILES ──

app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/index.html", response_class=HTMLResponse)
async def read_index_html():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/login.html", response_class=HTMLResponse)
async def read_login():
    with open("login.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/dashboard.html", response_class=HTMLResponse)
async def read_dashboard():
    with open("dashboard.html", "r", encoding="utf-8") as f:
        return f.read()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
