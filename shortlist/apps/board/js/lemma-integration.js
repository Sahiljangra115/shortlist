(function () {
  // Lemma injects window.__LEMMA_CONFIG__ only into the entry page (index.html).
  // dashboard.html / login.html load WITHOUT it, so the SDK 404s. Persist the
  // config on the page that has it, then reuse it on the pages that don't.
  var KEY = "__lemma_cfg";
  // Last-resort constant: the live pod values from index.html. Safety net only.
  var FALLBACK = {
    podId: "019f0d71-88d8-74b9-8328-db12ef40d493",
    apiUrl: "https://api.lemma.work",
    authUrl: "https://lemma.work/auth"
  };

  var cfg = window.__LEMMA_CONFIG__;
  if (cfg) {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
  } else {
    try { cfg = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { cfg = null; }
    if (!cfg) cfg = FALLBACK;
    // SDK reads this global during initialize(), not our local var, so set it back.
    window.__LEMMA_CONFIG__ = cfg;
  }

  var base = (cfg.apiUrl || window.location.origin).replace(/\/$/, "");
  var s = document.createElement("script");
  s.src = base + "/public/sdk/lemma-client.js";
  s.onload = boot;
  s.onerror = function () {
    console.error("Could not load the Lemma SDK.");
  };
  document.head.appendChild(s);
})();

var client;

async function boot() {
  try {
    client = new window.LemmaClient.LemmaClient();
    client.files.write = async function (path, text) {
        var lastSlash = path.lastIndexOf('/');
        var dir = lastSlash <= 0 ? '/' : path.substring(0, lastSlash);
        var name = lastSlash === -1 ? path : path.substring(lastSlash + 1);
        var blob = new Blob([text], { type: 'text/markdown' });
        try {
            await client.files.update(path, { file: blob });
        } catch (e) {
            try { await client.files.delete(path); } catch(_) {}
            await client.files.upload(blob, { name: name, directoryPath: dir });
        }
    };
    client.files.read = async function (path) {
        var bytes = await client.files.download(path);
        return new TextDecoder().decode(bytes);
    };
    var state = await client.initialize();

    var p = window.location.pathname;
    var onLogin = p.includes("login.html");
    var onIndex = p.includes("index.html") || p === "/" || p.endsWith("/");
    var authed = state.status === "authenticated";

    // After sign-in the auth service returns to login.html. Forward them into
    // the app. NOTE: only from login.html -- an authenticated user must still be
    // able to view the landing page (index.html) when they click the logo,
    // otherwise index -> dashboard bounces forever (the "login loop").
    if (authed && onLogin) {
       window.location.href = "dashboard.html";
       return;
    }
    // Protected pages require auth.
    if (!authed && !onLogin && !onIndex) {
       window.location.href = "login.html";
       return;
    }

    if (onIndex) {
       setupIndex();
    } else if (p.includes("dashboard.html")) {
       setupDashboard();
    } else if (onLogin) {
       setupLogin();
    }

  } catch (e) {
    console.error("Failed to start:", e);
  }
}

function setupLogin() {
    // Every entry point on this page leads to the same Lemma sign-in flow.
    function signIn(e) { if (e) e.preventDefault(); client.auth.redirectToAuth(); }

    var form = document.getElementById('auth-form');
    if (form) form.addEventListener('submit', signIn);

    var oauthBtn = document.getElementById('oauth-btn');
    if (oauthBtn) oauthBtn.addEventListener('click', signIn);

    var getStarted = document.getElementById('get-started-link');
    if (getStarted) getStarted.addEventListener('click', signIn);
}

function setupIndex() {
    var form = document.querySelector('.email-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var input = form.querySelector('input').value;
            if (input) {
                localStorage.setItem('pending_jd', input);
            }
            window.location.href = "login.html";
        });
    }
}

async function setupDashboard() {
    try {
        client.datastore.watchChanges({ onChange: function () { loadApplications(); } });
    } catch (e) {}

    // ponytail: topbar JD quick-match removed per request. Matching now lives
    // only in the "Apply by Link" tab. Topbar keeps just the user chip.
    var topbar = document.querySelector('.topbar');
    if (topbar) {
        topbar.innerHTML = `
        <div class="topbar-right">
          <div class="user-chip">
            <span class="uname" id="user-name">Applicant</span>
            <div class="avatar-ini" id="user-ini">SL</div>
          </div>
        </div>
        `;
    }

    // ── Resume upload: drop zone + file picker ────────────────────────────
    var dropZone = document.getElementById('drop-zone');
    var fileInput = document.getElementById('resume-file');

    if (dropZone && fileInput) {
        // Clicking the zone opens the OS file picker
        dropZone.addEventListener('click', function () { fileInput.click(); });

        // Drag-over visual feedback
        dropZone.addEventListener('dragover', function (e) {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(255,255,255,0.5)';
            dropZone.style.background = 'rgba(255,255,255,0.04)';
        });
        dropZone.addEventListener('dragleave', function () {
            dropZone.style.borderColor = 'rgba(255,255,255,0.15)';
            dropZone.style.background = '';
        });

        // Handle drop
        dropZone.addEventListener('drop', function (e) {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(255,255,255,0.15)';
            dropZone.style.background = '';
            var file = e.dataTransfer.files[0];
            if (file) uploadResume(file);
        });

        // Handle file picker selection
        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files[0]) {
                uploadResume(fileInput.files[0]);
                fileInput.value = ''; // reset so same file can be re-picked
            }
        });
    }

    // Load existing resumes from Lemma pod files
    await loadResumeList();
    await loadApplications();

    setupApplyByLink(); // isolated feature; safe to remove with its UI
}

// ── Resumes are stored as /resume/<name>.md in the pod ─────────────────────
async function uploadResume(file) {
    var statusDiv = document.getElementById('upload-status');
    var name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = '/resume/' + name;

    setStatus(statusDiv, 'Uploading ' + name + '...', '#9fb0c3');
    try {
        var text = await file.text();
        await client.files.write(path, text);
        // Auto-set as active resume if it is the first one, else ask
        var resumes = getStoredResumes();
        if (!resumes.length) setActiveResume(name);
        addStoredResume(name);
        setStatus(statusDiv, 'Uploaded: ' + name, '#10b981');
        await loadResumeList();
    } catch (e) {
        var msg = e.message || String(e);
        // ponytail: /resume is a pod-shared folder; only pod members hold grants on it.
        // A non-member signed-in account hits "Missing permission folder.read".
        if (/permission/i.test(msg)) {
            msg = "No access to the resume folder. Sign in with a pod-member account (the one that owns this pod).";
        }
        setStatus(statusDiv, 'Upload failed: ' + msg, '#f0616d');
    }
}

// ── localStorage helpers for resume list ───────────────────────────────────
function getStoredResumes() {
    try { return JSON.parse(localStorage.getItem('sl_resumes') || '[]'); } catch (_) { return []; }
}
function addStoredResume(name) {
    var list = getStoredResumes();
    if (!list.includes(name)) { list.push(name); localStorage.setItem('sl_resumes', JSON.stringify(list)); }
}
function removeStoredResume(name) {
    var list = getStoredResumes().filter(function (n) { return n !== name; });
    localStorage.setItem('sl_resumes', JSON.stringify(list));
    if (getActiveResume() === name) localStorage.removeItem('sl_active_resume');
}
function getActiveResume() { return localStorage.getItem('sl_active_resume') || ''; }
function setActiveResume(name) { localStorage.setItem('sl_active_resume', name); }

async function loadResumeList() {
    var container = document.getElementById('resume-list');
    if (!container) return;

    var resumes = getStoredResumes();
    var active = getActiveResume();

    if (!resumes.length) {
        container.innerHTML = '<p style="color:rgba(255,255,255,0.3); font-size:14px;">No resumes uploaded yet. Drop a file above to get started.</p>';
        return;
    }

    container.innerHTML = resumes.map(function (name) {
        var isActive = name === active;
        return '<div style="' +
            'display:flex; align-items:center; gap:12px; padding:14px 18px;' +
            'background:' + (isActive ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)') + ';' +
            'border:1px solid ' + (isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)') + ';' +
            'border-radius:10px;" data-resume="' + name + '">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
            '<span style="flex:1; font-size:14px; color:rgba(255,255,255,' + (isActive ? '0.9' : '0.5') + ');">' + name + '</span>' +
            (isActive ? '<span style="font-size:12px; color:#10b981; font-weight:600; padding:3px 10px; border:1px solid rgba(16,185,129,0.3); border-radius:999px;">Active</span>' :
                '<button onclick="activateResume(\'' + name + '\')" style="font-size:12px; color:rgba(255,255,255,0.5); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:999px; padding:3px 10px; cursor:pointer;">Set Active</button>') +
            '<button onclick="deleteResume(\'' + name + '\')" style="font-size:12px; color:rgba(240,97,109,0.6); background:none; border:none; cursor:pointer; padding:3px 8px;" title="Remove">&#x2715;</button>' +
            '</div>';
    }).join('');
}

window.activateResume = async function (name) {
    setActiveResume(name);
    // Overwrite /resume/cv.md (the file the matcher always reads) with the chosen resume
    var statusDiv = document.getElementById('upload-status');
    setStatus(statusDiv, 'Setting active resume...', '#9fb0c3');
    try {
        var text = await client.files.read('/resume/' + name);
        await client.files.write('/resume/cv.md', text);
        setStatus(statusDiv, name + ' is now active.', '#10b981');
    } catch (e) {
        setStatus(statusDiv, 'Could not update active resume: ' + (e.message || e), '#f0616d');
    }
    await loadResumeList();
};

window.deleteResume = async function (name) {
    if (!confirm('Remove "' + name + '" from the list?')) return;
    removeStoredResume(name);
    try { await client.files.delete('/resume/' + name); } catch (_) {} // best-effort
    await loadResumeList();
};

function setStatus(el, msg, color) {
    if (!el) return;
    el.textContent = msg;
    el.style.color = color || 'rgba(255,255,255,0.5)';
}

// ── Apply by Link (isolated feature) ───────────────────────────────────────
// Paste a job URL + JD text -> run the matcher against the active resume ->
// record the application and keep a tracked-links list with one-click "open &
// apply". Remove this block + the dashboard.html UI to disable.
// ponytail: tracked links live in localStorage (per-device), not the pod table.
// The real verdict row is still written by the matcher into the applications table.
function getTrackedLinks() {
    try { return JSON.parse(localStorage.getItem('sl_tracked_links') || '[]'); } catch (_) { return []; }
}
function addTrackedLink(item) {
    var list = getTrackedLinks();
    list.unshift(item);
    localStorage.setItem('sl_tracked_links', JSON.stringify(list.slice(0, 50)));
}
function renderTrackedLinks() {
    var box = document.getElementById('al-tracked');
    if (!box) return;
    var list = getTrackedLinks();
    if (!list.length) {
        box.innerHTML = '<p style="color:rgba(255,255,255,0.3); font-size:14px;">No tracked links yet.</p>';
        return;
    }
    // Escape text and only allow http(s) URLs (these strings reach innerHTML/href).
    function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }

    box.innerHTML = list.map(function (it) {
        var label = esc((it.role || 'Role') + (it.company ? ' @ ' + it.company : ''));
        var badge = it.verdict ? '<span style="font-size:12px; color:#9fb0c3;">' + esc(it.verdict) + '</span>' : '';
        var url = safeUrl(it.url);
        var applyBtn = url
            ? '<a href="' + esc(url) + '" target="_blank" rel="noopener" class="btn-glass" style="font-size:12px; padding:4px 12px; text-decoration:none;">Open &amp; apply</a>'
            : '';
        return '<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px;">' +
            '<span style="flex:1; font-size:14px; color:rgba(255,255,255,0.85);">' + label + '</span>' +
            badge +
            '<span style="font-size:12px; color:rgba(255,255,255,0.4);">' + (it.status || 'Tracked') + '</span>' +
            applyBtn +
            '</div>';
    }).join('');
}
function setupApplyByLink() {
    var btn = document.getElementById('al-run');
    if (!btn) return;
    renderTrackedLinks();
    btn.addEventListener('click', async function () {
        var company = (document.getElementById('al-company').value || '').trim();
        var position = (document.getElementById('al-position').value || '').trim();
        var jd = (document.getElementById('al-jd').value || '').trim();
        var out = document.getElementById('al-result');
        if (!jd) { setStatus(out, 'Paste the job description text first.', '#f0616d'); return; }
        btn.disabled = true; btn.textContent = 'Matching...';
        setStatus(out, 'Running the matcher against your active resume...', '#9fb0c3');
        try {
            var msg = 'Company: ' + (company || '(infer from JD)') +
                '\nRole: ' + (position || '(infer from JD)') +
                '\n\nJob description:\n' + jd;
            var res = await client.agents.run('matcher', msg, { title: 'Apply by link' });
            var v = res || {};
            addTrackedLink({
                url: '', company: company || v.company || '', role: position || v.role || '',
                verdict: v.verdict || '', status: 'Tracked', when: Date.now()
            });
            renderTrackedLinks();
            loadApplications();
            setStatus(out, 'Matched and tracked. See it in Applications / Review Queue.', '#10b981');
            document.getElementById('al-company').value = '';
            document.getElementById('al-position').value = '';
            document.getElementById('al-jd').value = '';
        } catch (e) {
            setStatus(out, 'Match failed: ' + (e.message || e), '#f0616d');
        } finally {
            btn.disabled = false; btn.textContent = 'Match & Track';
        }
    });
}

// Structured verdict body shared by video cards (Recent Applications) and newsletter items (Review Queue)
function buildVerdictBody(r) {
    return [
        'Verdict: ' + r.verdict,
        'Requirements Matched:',
        ...(r.proof || []).map(p => '- "' + p.requirement + '" -> "' + p.resume_evidence + '"'),
        '',
        'Gaps Identified:',
        ...(r.gaps || []).map(g => '- ' + g),
        '',
        'Draft Intro:',
        r.draft_message || ''
    ];
}

async function loadApplications() {
    try {
        var resp = await client.records.list("applications", { limit: 100, sort: [{ field: "created_at", direction: "desc" }] });
        var rows = resp.items || resp || [];
        
        var homeVideos = document.getElementById('home-videos');
        var homeNews = document.getElementById('home-news');
        var vidGrid = document.getElementById('vid-grid');
        var nlList = document.getElementById('nl-list');

        if (rows.length === 0) {
            var emptyHtml = '<div class="empty" style="text-align:center; padding: 40px; color:rgba(255,255,255,0.5); grid-column: 1 / -1;"><h2>Let\'s start!</h2><p>Paste a job description in the top bar to get your first match.</p></div>';
            if (homeVideos) homeVideos.innerHTML = emptyHtml;
            if (homeNews) homeNews.innerHTML = emptyHtml;
            if (vidGrid) vidGrid.innerHTML = emptyHtml;
            if (nlList) nlList.innerHTML = emptyHtml;
            return;
        }

        // Populate VIDEOS format for Recent Applications
        var videosData = rows.map(r => ({
            id: r.id,
            title: r.company + " - " + r.role,
            author: r.verdict + (r.score ? " (" + r.score.toFixed(1) + ")" : ""),
            meta: r.company + " · " + new Date(r.created_at || Date.now()).toLocaleDateString() + " · Score: " + (r.score || 0).toFixed(1),
            dur: r.status,
            src: 'https://plugin-assets.open-design.ai/plugins/mindloop-landing/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f-9b476a.mp4',
            body: buildVerdictBody(r)
        }));

        // Populate NEWS format for Review Queue
        var reviewQueue = rows.filter(r => r.needs_review && r.status === "Evaluated");
        var newsData = reviewQueue.map(r => ({
            id: r.id,
            title: r.company + " - " + r.role,
            author: r.company,
            date: new Date(r.created_at || Date.now()).toLocaleDateString(),
            read: 'Score: ' + (r.score || 0).toFixed(1),
            kicker: r.verdict,
            excerpt: "Matches: " + (r.proof ? r.proof.length : 0) + ". Gaps: " + (r.gaps ? r.gaps.length : 0),
            body: buildVerdictBody(r),
            rawRecord: r // for approve logic
        }));

        // Re-render
        renderGrid('vid-grid', videosData, 'videoCard');
        renderGrid('home-videos', videosData.slice(0, 4), 'videoCard');
        renderGrid('nl-list', newsData, 'newsletterItem');
        renderGrid('home-news', newsData.slice(0, 2), 'newsletterItem');

    } catch (e) {
        console.error("Load failed:", e);
    }
}

function renderGrid(containerId, data, renderType) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    var PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>';
    
    data.forEach((v, i) => {
        var el = document.createElement('div');
        if (renderType === 'videoCard') {
            el.className = 'vid-card';
            el.innerHTML =
              '<div class="vid-thumb-wrap">' +
                '<video muted playsinline preload="metadata" src="' + v.src + '#t=0.5"></video>' +
                '<div class="vid-play">' + PLAY_SVG + '</div>' +
                '<span class="vid-dur">' + v.dur + '</span>' +
              '</div>' +
              '<div class="vid-meta"><h3>' + v.title + '</h3><span>' + v.author + '</span></div>';
            el.addEventListener('click', function () {
                var pv = document.getElementById('player-video');
                if (pv) { pv.src = v.src; pv.load(); pv.play().catch(function () {}); }
                var pt = document.getElementById('player-title');
                if (pt) pt.textContent = v.title;
                var pa = document.getElementById('player-author');
                if (pa) pa.textContent = v.meta;
                var pd = document.getElementById('player-desc');
                if (pd) {
                    pd.innerHTML = '';
                    v.body.forEach(function (line) {
                        var pEl = document.createElement('p');
                        pEl.textContent = line;
                        pd.appendChild(pEl);
                    });
                }
                showViewNode('player');
            });
        } else {
            el.className = 'nl-item';
            el.innerHTML =
              '<div class="nl-num">' + String(i+1).padStart(2, '0') + '</div>' +
              '<div class="nl-body">' +
                '<h3>' + v.title + '</h3>' +
                '<p class="excerpt">' + v.excerpt + '</p>' +
                '<div class="meta"><span>' + v.author + '</span><span>' + v.date + '</span><span>' + v.read + '</span></div>' +
              '</div>';
            el.addEventListener('click', function () {
                document.getElementById('reader-kicker').textContent = v.kicker;
                document.getElementById('reader-title').textContent = v.title;
                document.getElementById('reader-meta').innerHTML = '<span>' + v.author + '</span><span>' + v.date + '</span><span>' + v.read + '</span>';
                var body = document.getElementById('reader-body');
                body.innerHTML = '';
                v.body.forEach(function (p) {
                    var pEl = document.createElement('p');
                    pEl.textContent = p;
                    body.appendChild(pEl);
                });
                
                var btnWrap = document.createElement('div');
                btnWrap.style.marginTop = '2rem'; btnWrap.style.display = 'flex'; btnWrap.style.gap = '1rem';
                
                var btnApprove = document.createElement('button');
                btnApprove.className = 'btn-primary';
                btnApprove.textContent = 'Approve & Apply';
                btnApprove.onclick = async function() {
                    await client.records.update("applications", v.id, { status: "Applied", needs_review: false });
                    loadApplications();
                    showViewNode('newsletters');
                };
                
                var btnReject = document.createElement('button');
                btnReject.className = 'btn-glass liquid-glass';
                btnReject.textContent = 'Discard';
                btnReject.onclick = async function() {
                    await client.records.update("applications", v.id, { status: "Discarded", needs_review: false });
                    loadApplications();
                    showViewNode('newsletters');
                };
                
                btnWrap.appendChild(btnApprove);
                btnWrap.appendChild(btnReject);
                body.appendChild(btnWrap);
                
                showViewNode('reader');
            });
        }
        container.appendChild(el);
    });
}

function showViewNode(name) {
    var views = document.querySelectorAll('.view');
    views.forEach(function (vw) { vw.classList.toggle('hidden', vw.dataset.view !== name); });
    document.querySelectorAll('.side-link').forEach(function (l) {
      l.classList.toggle('active', l.dataset.tab === name);
    });
    window.scrollTo(0, 0);
}
