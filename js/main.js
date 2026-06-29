/* ============================================================
   Shortlist — fully integrated dashboard JS
   Connects to FastAPI python backend for all state and actions.
   ============================================================ */

/* ── 1. fadeUp reveal ── */
(function () {
  var els = Array.prototype.slice.call(document.querySelectorAll('.fade-up'));
  if (!els.length) return;
  var seen = new Map();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target, parent = el.parentElement;
      var i = seen.get(parent) || 0;
      seen.set(parent, i + 1);
      el.style.transitionDelay = (i * 0.08) + 's';
      el.classList.add('in');
      io.unobserve(el);
    });
  }, { threshold: 0.08, rootMargin: '-100px 0px' });
  els.forEach(function (el) { io.observe(el); });
})();

/* ── 2. Mission: scroll-driven word-by-word reveal ── */
(function () {
  var nodes = document.querySelectorAll('[data-reveal]');
  if (!nodes.length) return;
  var P1 = "Shortlist is a job-application command centre for a final-year student applying to many roles.";
  var P2 = "Upload your resume and paste a job description, and an agent returns a verdict with the exact requirements quoted.";
  nodes.forEach(function (node, idx) {
    var text = idx === 0 ? P1 : P2;
    var hl = (node.getAttribute('data-hl') || '').split(',').filter(Boolean);
    var parts = text.split(' ');
    node.innerHTML = '';
    parts.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'mw';
      var clean = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (hl.indexOf(clean) !== -1) span.dataset.hl = '1';
      span.textContent = word + (i < parts.length - 1 ? ' ' : '');
      node.appendChild(span);
    });
  });
  var words = Array.prototype.slice.call(document.querySelectorAll('.mw'));
  function update() {
    var vh = window.innerHeight;
    words.forEach(function (w) {
      var r = w.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (vh * 0.95 - r.top) / (vh * 0.30)));
      w.style.opacity = (0.15 + p * 0.85).toFixed(3);
      if (w.dataset.hl) w.classList.toggle('hl-on', p > 0.6);
    });
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

/* ── 3. HLS ── */
(function () {
  var vids = document.querySelectorAll('video[data-hls]');
  if (!vids.length) return;
  vids.forEach(function (video) {
    var SRC = video.getAttribute('data-hls');
    if (window.Hls && window.Hls.isSupported()) {
      var hls = new window.Hls();
      hls.loadSource(SRC);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, function () { video.play().catch(function () {}); });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = SRC;
      video.addEventListener('loadedmetadata', function () { video.play().catch(function () {}); });
    }
  });
})();

/* ── 4. Generic "navigate on submit" forms ── */
(function () {
  document.querySelectorAll('form[data-go]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = f.querySelector('input');
      if (input && input.value.trim()) {
        localStorage.setItem('pending_jd', input.value.trim());
      }
      window.location.href = f.getAttribute('data-go');
    });
  });
})();

/* ── 5. Dashboard (full backend integration) ── */
(function () {
  var app = document.getElementById('app');
  if (!app) return;

  var currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem('sl_user') || 'null');
  } catch (_) {}

  function showLogin() {
    window.location.href = 'login.html';
  }

  function applyUser() {
    if (!currentUser) return;
    var greet = document.getElementById('greeting');
    var uname = document.getElementById('user-name');
    var ini = document.getElementById('user-ini');
    if (greet) greet.textContent = 'Welcome back, ' + currentUser.name;
    if (uname) uname.textContent = currentUser.name;
    if (ini) ini.textContent = (currentUser.name.slice(0,2) || 'SL').toUpperCase();
    
    // Populate settings defaults
    var sn = document.getElementById('setting-name');
    var se = document.getElementById('setting-email');
    if (sn) sn.value = currentUser.name;
    if (se) se.value = currentUser.email;
  }

  // Check login state
  if (!currentUser) {
    showLogin();
    return;
  } else {
    applyUser();
  }

  /* ================================================================
     STATE & BACKEND CONFIG
     ================================================================ */
  var VIDEOS = [];
  var NEWS = [];
  var APPLICATIONS_CACHE = [];
  var ACTIVE_RESUME_NAME = "";

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-User-Email': currentUser ? currentUser.email : ''
    };
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function asArray(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim()) {
      try {
        var p = JSON.parse(v);
        return Array.isArray(p) ? p : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function verdictClass(v) {
    if (v === 'STRONG FIT') return 'verdict-strong';
    if (v === 'STRETCH') return 'verdict-stretch';
    if (v === 'SKIP') return 'verdict-skip';
    return '';
  }

  /* ================================================================
     UI BUILDERS
     ================================================================ */
  function applicationCard(v) {
    var el = document.createElement('div');
    el.className = 'vid-card';
    var vc = verdictClass(v.verdict);
    el.innerHTML =
      '<div class="vid-thumb-wrap app-card-thumb ' + vc + '">' +
        '<div class="app-card-verdict">' +
          '<span class="verdict-badge ' + vc + '">' + escHtml(v.verdict || 'N/A') + '</span>' +
          '<span class="verdict-score">' + (Number(v.score)||0).toFixed(1) + '</span>' +
        '</div>' +
        '<div class="app-card-company">' + escHtml(v.company || '') + '</div>' +
        '<span class="vid-dur">' + escHtml(v.status || 'Evaluated') + '</span>' +
      '</div>' +
      '<div class="vid-meta"><h3>' + escHtml(v.role || '') + '</h3>' +
      '<span>' + escHtml(v.company || '') + '</span></div>';
    el.addEventListener('click', function () { openPlayerFromRow(v); });
    return el;
  }

  function newsletterItem(v, n) {
    var el = document.createElement('div');
    el.className = 'nl-item';
    var gaps = asArray(v.gaps);
    var gapText = gaps.length ? gaps[0] : 'Strong match waiting for review.';
    el.innerHTML =
      '<div class="nl-num">' + String(n).padStart(2, '0') + '</div>' +
      '<div class="nl-body">' +
        '<h3>' + escHtml(v.role + ', ' + v.company) + '</h3>' +
        '<p class="excerpt">' + escHtml(gapText) + '</p>' +
        '<div class="meta"><span>' + escHtml(v.company) + '</span><span>' + escHtml(v.dateStr || '') + '</span><span>Score: ' + (Number(v.score)||0).toFixed(1) + '</span></div>' +
      '</div>';
    el.addEventListener('click', function () { openReaderFromRow(v); });
    return el;
  }

  /* ================================================================
     VIEW SWITCHING
     ================================================================ */
  var views = document.querySelectorAll('.view');
  function showView(name) {
    views.forEach(function (vw) { vw.classList.toggle('hidden', vw.dataset.view !== name); });
    document.querySelectorAll('.side-link').forEach(function (l) {
      l.classList.toggle('active', l.dataset.tab === name);
    });
    localStorage.setItem('sl_tab', name);
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.side-link').forEach(function (l) {
    if (!l.dataset.tab) return;
    l.addEventListener('click', function () { showView(l.dataset.tab); });
  });

  /* ================================================================
     DETAIL VIEWS
     ================================================================ */
  function openPlayerFromRow(row) {
    var pt = document.getElementById('player-title');
    if (pt) pt.textContent = row.role + ', ' + row.company;
    var pa = document.getElementById('player-author');
    if (pa) pa.innerHTML = '<span class="verdict-badge ' + verdictClass(row.verdict) + '">' + escHtml(row.verdict || '') + '</span> (' + (Number(row.score)||0).toFixed(1) + ') &mdash; Status: ' + escHtml(row.status || 'Evaluated');
    var pd = document.getElementById('player-desc');
    if (pd) {
      pd.innerHTML = '';
      var proof = asArray(row.proof);
      if (proof.length) {
        var h = document.createElement('h3');
        h.textContent = 'Requirements Matched (' + proof.length + ')';
        h.style.cssText = 'margin-bottom:0.75rem; font-size:1rem; color:hsl(var(--foreground));';
        pd.appendChild(h);
        proof.forEach(function (p) {
          var item = document.createElement('div');
          item.className = 'proof-item';
          item.innerHTML = '<div class="proof-req">' + escHtml(p.requirement) + '</div><div class="proof-arrow">&rarr;</div><div class="proof-evidence">"' + escHtml(p.resume_evidence) + '"</div>';
          pd.appendChild(item);
        });
      }
      var gaps = asArray(row.gaps);
      if (gaps.length) {
        var gh = document.createElement('h3');
        gh.textContent = 'Gaps (' + gaps.length + ')';
        gh.style.cssText = 'margin-top:1.5rem; margin-bottom:0.75rem; font-size:1rem; color:hsl(var(--foreground));';
        pd.appendChild(gh);
        gaps.forEach(function (g) {
          var item = document.createElement('div');
          item.className = 'gap-item';
          item.textContent = g;
          pd.appendChild(item);
        });
      }
      if (row.draft_message) {
        var dh = document.createElement('h3');
        dh.textContent = 'Draft Intro';
        dh.style.cssText = 'margin-top:1.5rem; margin-bottom:0.75rem; font-size:1rem; color:hsl(var(--foreground));';
        pd.appendChild(dh);
        var dp = document.createElement('p');
        dp.style.cssText = 'line-height:1.7; color:hsl(var(--secondary-foreground)); font-style:italic; padding:1rem; background:hsl(var(--card)); border-radius:8px; border:1px solid hsl(var(--border)/0.4);';
        dp.textContent = row.draft_message;
        pd.appendChild(dp);
      }
      if (row.verified) {
        var badge = document.createElement('div');
        badge.className = 'verified-badge';
        badge.innerHTML = '&#10004; Citations Verified';
        pd.appendChild(badge);
      }
    }
    showView('player');
  }

  function openReaderFromRow(row) {
    document.getElementById('reader-kicker').textContent = row.verdict || 'STRETCH';
    document.getElementById('reader-kicker').className = 'kicker ' + verdictClass(row.verdict);
    document.getElementById('reader-title').textContent = row.role + ', ' + row.company;
    document.getElementById('reader-meta').innerHTML = '<span>' + escHtml(row.company) + '</span><span>' + escHtml(row.dateStr || '') + '</span><span>Score: ' + (Number(row.score)||0).toFixed(1) + '</span>';
    var body = document.getElementById('reader-body');
    body.innerHTML = '';
    var proof = asArray(row.proof);
    var gaps = asArray(row.gaps);
    if (proof.length) {
      var ph = document.createElement('h3'); ph.textContent = 'Requirements Matched'; ph.style.cssText = 'font-size:1rem; margin-bottom:0.75rem;'; body.appendChild(ph);
      proof.forEach(function (p) {
        var el = document.createElement('div'); el.className = 'proof-item';
        el.innerHTML = '<div class="proof-req">' + escHtml(p.requirement) + '</div><div class="proof-arrow">&rarr;</div><div class="proof-evidence">"' + escHtml(p.resume_evidence) + '"</div>';
        body.appendChild(el);
      });
    }
    if (gaps.length) {
      var gh = document.createElement('h3'); gh.textContent = 'Gaps Identified'; gh.style.cssText = 'font-size:1rem; margin-top:1.5rem; margin-bottom:0.75rem;'; body.appendChild(gh);
      gaps.forEach(function (g) { var el = document.createElement('div'); el.className = 'gap-item'; el.textContent = g; body.appendChild(el); });
    }
    if (row.draft_message) {
      var dh = document.createElement('h3'); dh.textContent = 'Draft Intro'; dh.style.cssText = 'font-size:1rem; margin-top:1.5rem; margin-bottom:0.75rem;'; body.appendChild(dh);
      var dp = document.createElement('p'); dp.textContent = row.draft_message; dp.style.cssText = 'font-style:italic; padding:1rem; background:hsl(var(--card)); border-radius:8px; border:1px solid hsl(var(--border)/0.4);'; body.appendChild(dp);
    }
    
    // Approve / Discard buttons
    if (row.needs_review && (row.status === 'Evaluated' || !row.status)) {
      var bw = document.createElement('div'); bw.style.cssText = 'margin-top:2rem; display:flex; gap:1rem;';
      var ba = document.createElement('button'); ba.className = 'btn-primary'; ba.textContent = 'Approve & Apply';
      var br = document.createElement('button'); br.className = 'btn-glass liquid-glass'; br.textContent = 'Discard';
      
      ba.addEventListener('click', async function () {
        ba.disabled = true; ba.textContent = 'Approving...';
        await updateApplicationOnServer(row.id, 'Applied', false);
        showToast('Application approved! Status: Applied.');
        document.querySelector('[data-back="newsletters"]').click();
        await syncApplications();
        loadApplications();
      });
      
      br.addEventListener('click', async function () {
        br.disabled = true; br.textContent = 'Discarding...';
        await updateApplicationOnServer(row.id, 'Discarded', false);
        showToast('Application discarded.');
        document.querySelector('[data-back="newsletters"]').click();
        await syncApplications();
        loadApplications();
      });
      bw.appendChild(ba); bw.appendChild(br); body.appendChild(bw);
    }
    showView('reader');
  }

  async function updateApplicationOnServer(id, status, needsReview) {
    // Update local cache first
    for (var i = 0; i < APPLICATIONS_CACHE.length; i++) {
      if (APPLICATIONS_CACHE[i].id === id) {
        APPLICATIONS_CACHE[i].status = status;
        APPLICATIONS_CACHE[i].needs_review = needsReview;
        break;
      }
    }
    try {
      await fetch('/api/applications/update', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id: id, status: status, needs_review: needsReview })
      });
    } catch (e) {
      console.error("Failed to update status on server:", e);
    }
  }

  /* back buttons */
  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () { showView(b.getAttribute('data-back')); });
  });

  /* logout */
  var logout = document.getElementById('logout');
  if (logout) logout.addEventListener('click', function () {
    localStorage.removeItem('sl_user');
    window.location.href = 'index.html';
  });

  /* ================================================================
     TOAST
     ================================================================ */
  function showToast(msg) {
    var existing = document.getElementById('sl-toast');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.id = 'sl-toast'; t.className = 'sl-toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 400); }, 3000);
  }

  /* ================================================================
     RENDER APPLICATIONS
     ================================================================ */
  async function syncApplications() {
    try {
      var res = await fetch('/api/applications', {
        headers: getHeaders()
      });
      if (res.ok) {
        APPLICATIONS_CACHE = await res.json();
      }
    } catch (e) {
      console.error("Failed to sync applications:", e);
    }
  }

  function loadApplications() {
    VIDEOS = [];
    NEWS = [];
    APPLICATIONS_CACHE.forEach(function (r) {
      var v = Object.assign({}, r, {
        dateStr: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
      });
      VIDEOS.push(v);
      if (r.needs_review && (r.status === 'Evaluated' || !r.status)) NEWS.push(v);
    });
    renderAll();
  }

  function renderAll() {
    var grid = document.getElementById('vid-grid');
    if (grid) {
      grid.innerHTML = '';
      if (VIDEOS.length > 0) VIDEOS.forEach(function (v) { grid.appendChild(applicationCard(v)); });
      else grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128209;</div><p>No applications yet. Paste a job description on the Dashboard to get started.</p></div>';
    }
    var nlList = document.getElementById('nl-list');
    if (nlList) {
      nlList.innerHTML = '';
      if (NEWS.length > 0) NEWS.forEach(function (v, i) { nlList.appendChild(newsletterItem(v, i + 1)); });
      else nlList.innerHTML = '<div class="empty-state"><p>No STRETCH applications in the review queue yet.</p></div>';
    }
    var railV = document.getElementById('home-videos');
    if (railV) {
      railV.innerHTML = '';
      if (VIDEOS.length > 0) VIDEOS.slice(0, 4).forEach(function (v) { railV.appendChild(applicationCard(v)); });
      else railV.innerHTML = '<div style="opacity:0.5; padding:1rem 0; font-size:0.95rem;">No applications yet. Use the form above to evaluate a role.</div>';
    }
    var homeNl = document.getElementById('home-news');
    if (homeNl) {
      homeNl.innerHTML = '';
      if (NEWS.length > 0) NEWS.slice(0, 3).forEach(function (v, i) { homeNl.appendChild(newsletterItem(v, i + 1)); });
      else homeNl.innerHTML = '<div style="opacity:0.5; padding:1rem 0; font-size:0.95rem;">No review queue items yet.</div>';
    }
    // Update resume status on upload page
    updateResumeStatus();
  }

  /* ================================================================
     SEARCH
     ================================================================ */
  var searchInput = document.querySelector('.search-box input');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      var q = searchInput.value.toLowerCase().trim();
      if (!q) { loadApplications(); return; }
      var filtered = APPLICATIONS_CACHE.filter(function (a) {
        return (a.company || '').toLowerCase().indexOf(q) !== -1 ||
               (a.role || '').toLowerCase().indexOf(q) !== -1 ||
               (a.verdict || '').toLowerCase().indexOf(q) !== -1 ||
               (a.status || '').toLowerCase().indexOf(q) !== -1;
      });
      VIDEOS = filtered.map(function (r) { return Object.assign({}, r, { dateStr: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' }); });
      NEWS = VIDEOS.filter(function (r) { return r.needs_review && (r.status === 'Evaluated' || !r.status); });
      renderAll();
    });
  }

  /* ================================================================
     RESUME MANAGEMENT (backend API)
     ================================================================ */
  async function loadResumeList() {
    var container = document.getElementById('resume-list');
    if (!container) return;

    try {
      var res = await fetch('/api/resumes', {
        headers: getHeaders()
      });
      if (res.ok) {
        var data = await res.json();
        var resumes = data.resumes || [];
        ACTIVE_RESUME_NAME = data.active || "";
        
        if (!resumes.length) {
          container.innerHTML = '<p style="color:rgba(255,255,255,0.3); font-size:14px; text-align:center; padding: 2rem 0;">No resumes uploaded yet. Drag a file or browse on the left to start.</p>';
          return;
        }

        container.innerHTML = resumes.map(function (r) {
          var isActive = r.name === ACTIVE_RESUME_NAME;
          return '<div style="' +
              'display:flex; align-items:center; gap:12px; padding:14px 18px;' +
              'background:' + (isActive ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)') + ';' +
              'border:1px solid ' + (isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)') + ';' +
              'border-radius:10px;" data-resume="' + r.name + '">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
              '<span style="flex:1; font-size:14px; color:rgba(255,255,255,' + (isActive ? '0.9' : '0.5') + '); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">' + r.name + ' (' + r.size_kb + ' KB)</span>' +
              (isActive ? '<span style="font-size:12px; color:#10b981; font-weight:600; padding:3px 10px; border:1px solid rgba(16,185,129,0.3); border-radius:999px;">Active</span>' :
                  '<button onclick="activateResume(\'' + r.name + '\')" style="font-size:12px; color:rgba(255,255,255,0.5); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:999px; padding:3px 10px; cursor:pointer;">Set Active</button>') +
              '<button onclick="deleteResume(\'' + r.name + '\')" style="font-size:12px; color:rgba(240,97,109,0.6); background:none; border:none; cursor:pointer; padding:3px 8px;" title="Remove">&#x2715;</button>' +
              '</div>';
        }).join('');
      }
    } catch (e) {
      console.error("Failed to load resume list:", e);
    }
  }

  function updateResumeStatus() {
    var statusEl = document.getElementById('upload-status');
    if (!statusEl) return;
    if (ACTIVE_RESUME_NAME) {
      statusEl.className = 'upload-status success';
      statusEl.innerHTML = '&#10004; Active resume: <strong>' + ACTIVE_RESUME_NAME + '</strong>. The agent will use it for all matches.';
    } else {
      statusEl.className = 'upload-status warning';
      statusEl.innerHTML = '&#9888; No active resume set. Upload one to start matching.';
    }
    updateRunHint();
  }

  function updateRunHint() {
    var hint = document.getElementById('run-hint');
    if (!hint) return;
    if (!ACTIVE_RESUME_NAME) {
      hint.innerHTML = '&#9888; Upload your resume first (Upload Resume tab).';
      hint.style.color = 'hsl(40 90% 55%)';
    } else {
      hint.textContent = 'Matches the JD against your resume and writes a verdict.';
      hint.style.color = '';
    }
  }

  window.activateResume = async function (name) {
    var statusDiv = document.getElementById('upload-status');
    if (statusDiv) {
      statusDiv.className = 'upload-status';
      statusDiv.innerHTML = '<span class="step-spinner"></span> Setting active resume...';
    }
    try {
      var res = await fetch('/api/resumes/active', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ filename: name })
      });
      if (res.ok) {
        if (statusDiv) {
          statusDiv.className = 'upload-status success';
          statusDiv.innerHTML = '&#10004; Active resume set to ' + name;
        }
        showToast('Active resume updated.');
        await loadResumeList();
        updateResumeStatus();
      } else {
        throw new Error('Failed to set active');
      }
    } catch (e) {
      if (statusDiv) {
        statusDiv.className = 'upload-status error';
        statusDiv.innerHTML = '&#10006; Error: ' + e.message;
      }
    }
  };

  window.deleteResume = async function (name) {
    if (!confirm('Remove "' + name + '"?')) return;
    try {
      var res = await fetch('/api/resumes/' + encodeURIComponent(name), {
        method: 'DELETE',
        headers: { 'X-User-Email': currentUser.email }
      });
      if (res.ok) {
        showToast('Resume deleted.');
        await loadResumeList();
        updateResumeStatus();
      }
    } catch (e) {
      showToast('Error deleting resume.');
    }
  };

  // Wire upload zone
  (function () {
    var uploadBtn = document.getElementById('upload-btn');
    var fileInput = document.getElementById('resume-file');
    var dropzone = document.getElementById('upload-dropzone');
    var selectedFileEl = document.getElementById('selected-file');
    if (!uploadBtn || !fileInput) return;

    fileInput.addEventListener('change', function () {
      if (fileInput.files[0] && selectedFileEl)
        selectedFileEl.textContent = 'Selected: ' + fileInput.files[0].name + ' (' + (fileInput.files[0].size / 1024).toFixed(1) + ' KB)';
    });

    if (dropzone) {
      // Click zone triggers file selection
      dropzone.addEventListener('click', function () { fileInput.click(); });
      
      dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.style.borderColor = 'rgba(255,255,255,0.5)'; dropzone.style.background = 'rgba(255,255,255,0.04)'; });
      dropzone.addEventListener('dragleave', function () { dropzone.style.borderColor = 'var(--border)'; dropzone.style.background = 'rgba(255,255,255,0.02)'; });
      dropzone.addEventListener('drop', function (e) {
        e.preventDefault(); dropzone.style.borderColor = 'var(--border)'; dropzone.style.background = 'rgba(255,255,255,0.02)';
        if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event('change')); }
      });
    }

    uploadBtn.addEventListener('click', async function () {
      var file = fileInput.files[0];
      if (!file) { showToast('Please select a file first.'); return; }
      
      // Grey out / loading animation
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading...';
      uploadBtn.style.opacity = '0.5';
      uploadBtn.style.cursor = 'not-allowed';
      
      var statusEl = document.getElementById('upload-status');
      if (statusEl) {
        statusEl.className = 'upload-status';
        statusEl.innerHTML = '<span class="step-spinner"></span> Uploading ' + file.name + '...';
      }
      
      try {
        var formData = new FormData();
        formData.append('file', file);

        var res = await fetch('/api/resumes/upload', {
          method: 'POST',
          headers: {
            'X-User-Email': currentUser.email
          },
          body: formData
        });

        if (res.ok) {
          if (statusEl) {
            statusEl.className = 'upload-status success';
            statusEl.innerHTML = '&#10004; ' + file.name + ' uploaded successfully!';
          }
          showToast('Resume uploaded.');
          fileInput.value = '';
          if (selectedFileEl) selectedFileEl.textContent = '';
          await loadResumeList();
          updateResumeStatus();
        } else {
          var errText = await res.text();
          throw new Error(errText || "Server error");
        }
      } catch (e) {
        if (statusEl) {
          statusEl.className = 'upload-status error';
          statusEl.innerHTML = '&#10006; Upload failed: ' + e.message;
        }
        showToast('Upload failed.');
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload File';
        uploadBtn.style.opacity = '';
        uploadBtn.style.cursor = '';
      }
    });
  })();

  /* ================================================================
     SETTINGS
     ================================================================ */
  async function loadSettings() {
    try {
      var res = await fetch('/api/settings', {
        headers: getHeaders()
      });
      if (res.ok) {
        var settings = await res.json();
        var sn = document.getElementById('setting-name');
        var se = document.getElementById('setting-email');
        var ns = document.getElementById('notif-stretch');
        var clt = document.querySelector('.settings-form select');
        
        if (sn) sn.value = settings.name;
        if (se) se.value = settings.email;
        if (ns) ns.checked = settings.notify_stretch;
        if (clt) clt.value = settings.cover_letter_tone;
        
        // update topbar display name
        var uname = document.getElementById('user-name');
        var ini = document.getElementById('user-ini');
        if (uname) uname.textContent = settings.name;
        if (ini) ini.textContent = (settings.name.slice(0,2) || 'SL').toUpperCase();
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }

  var saveBtn = document.querySelector('.settings-form .btn-primary');
  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      var name = (document.getElementById('setting-name').value || '').trim();
      var email = (document.getElementById('setting-email').value || '').trim();
      var notifyStretch = document.getElementById('notif-stretch') ? document.getElementById('notif-stretch').checked : true;
      var coverLetterTone = document.querySelector('.settings-form select') ? document.querySelector('.settings-form select').value : 'Professional';
      
      if (name && email) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
          var res = await fetch('/api/settings', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
              name: name,
              email: email,
              notify_stretch: notifyStretch,
              cover_letter_tone: coverLetterTone
            })
          });
          if (res.ok) {
            currentUser.name = name;
            localStorage.setItem('sl_user', JSON.stringify(currentUser));
            applyUser();
            showToast('Preferences saved to server.');
          } else {
            showToast('Failed to save preferences.');
          }
        } catch (e) {
          showToast('Network error saving preferences.');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Preferences';
        }
      }
    });
  }

  /* ================================================================
     THINKING INDICATOR
     ================================================================ */
  function showThinking(container) {
    var el = document.createElement('div');
    el.className = 'thinking-indicator'; el.id = 'thinking-indicator';
    el.innerHTML = '<div class="thinking-header"><div class="thinking-pulse"></div><span>Agent is working...</span></div><div class="thinking-steps" id="thinking-steps"></div>';
    container.appendChild(el);
    return el;
  }

  function addThinkingStep(text, done) {
    var steps = document.getElementById('thinking-steps');
    if (!steps) return;
    var pending = steps.querySelectorAll('.thinking-step.pending');
    if (done && pending.length > 0) {
      var last = pending[pending.length - 1];
      last.classList.remove('pending'); last.classList.add('done');
      last.querySelector('.step-icon').innerHTML = '&#10004;';
    }
    if (text) {
      var step = document.createElement('div');
      step.className = 'thinking-step' + (done ? ' done' : ' pending');
      step.innerHTML = '<span class="step-icon">' + (done ? '&#10004;' : '<span class="step-spinner"></span>') + '</span><span>' + escHtml(text) + '</span>';
      steps.appendChild(step);
    }
  }

  function removeThinking() {
    var el = document.getElementById('thinking-indicator');
    if (el) el.remove();
  }

  /* ================================================================
     RUN MATCH
     ================================================================ */
  var runBtn = document.getElementById('run');
  if (runBtn) runBtn.addEventListener('click', runMatch);

  async function runMatch() {
    var company = document.getElementById('company').value.trim();
    var role = document.getElementById('role').value.trim();
    var jd = document.getElementById('jd').value.trim();
    var btn = document.getElementById('run');
    var hint = document.getElementById('run-hint');
    var resDiv = document.getElementById('result');

    if (!jd) { hint.textContent = 'Paste a job description first.'; hint.style.color = 'hsl(0 70% 55%)'; return; }
    if (!ACTIVE_RESUME_NAME) {
      hint.innerHTML = '&#9888; Upload your resume first (Upload Resume tab).';
      hint.style.color = 'hsl(40 90% 55%)';
      showToast('Please upload your resume before running a match.');
      return;
    }

    btn.disabled = true;
    btn.querySelector('span').textContent = 'Matching...';
    btn.classList.add('btn-loading');
    resDiv.innerHTML = '';
    showThinking(resDiv);
    addThinkingStep('Sending JD to matcher agent...', false);

    try {
      addThinkingStep('Sending JD to matcher agent...', true);
      addThinkingStep('Searching resume for matching evidence...', false);
      
      var response = await fetch('/api/applications/match', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ company: company, role: role, jd: jd })
      });

      if (!response.ok) {
        var errText = await response.text();
        throw new Error(errText || "Match failed");
      }

      addThinkingStep('Searching resume for matching evidence...', true);
      addThinkingStep('Loading results from server...', false);

      var matchedApp = await response.json();
      APPLICATIONS_CACHE.unshift(matchedApp);
      
      addThinkingStep('Loading results from server...', true);

      loadApplications();
      removeThinking();
      
      // Show inline verdict card
      renderVerdictCard(resDiv, matchedApp);
      
      document.getElementById('jd').value = '';
      document.getElementById('company').value = '';
      document.getElementById('role').value = '';
      showToast('Match complete!');

    } catch (e) {
      removeThinking();
      resDiv.innerHTML = '<div class="result-error">&#10006; Match failed: ' + escHtml(e.message || String(e)) + '</div>';
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Run match';
      btn.classList.remove('btn-loading');
      hint.textContent = 'Matches the JD against your resume and writes a verdict.';
      hint.style.color = '';
    }
  }

  /* ================================================================
     VERDICT CARD (inline result)
     ================================================================ */
  function renderVerdictCard(container, row) {
    var proof = asArray(row.proof);
    var gaps = asArray(row.gaps);
    var vc = verdictClass(row.verdict);
    var html =
      '<div class="verdict-card ' + vc + '">' +
        '<div class="vc-header">' +
          '<div class="vc-verdict-wrap"><span class="verdict-badge big ' + vc + '">' + escHtml(row.verdict || '') + '</span><span class="vc-score">' + (Number(row.score)||0).toFixed(1) + ' / 5</span></div>' +
          '<div class="vc-role">' + escHtml(row.role) + ' at ' + escHtml(row.company) + '</div>' +
        '</div>';
    if (proof.length) {
      html += '<div class="vc-section"><div class="vc-section-title">Matched (' + proof.length + ')</div>';
      proof.forEach(function (p) { html += '<div class="proof-item"><div class="proof-req">' + escHtml(p.requirement) + '</div><div class="proof-arrow">&rarr;</div><div class="proof-evidence">"' + escHtml(p.resume_evidence) + '"</div></div>'; });
      html += '</div>';
    }
    if (gaps.length) {
      html += '<div class="vc-section"><div class="vc-section-title">Gaps (' + gaps.length + ')</div>';
      gaps.forEach(function (g) { html += '<div class="gap-item">' + escHtml(g) + '</div>'; });
      html += '</div>';
    }
    if (row.draft_message) html += '<div class="vc-section"><div class="vc-section-title">Draft Intro</div><p class="vc-draft">' + escHtml(row.draft_message) + '</p></div>';
    html += '</div>';
    container.innerHTML = html;
  }

  /* ================================================================
     INITIALIZATION
     ================================================================ */
  (async function init() {
    await syncApplications();
    loadApplications();
    await loadResumeList();
    await loadSettings();
    showView(localStorage.getItem('sl_tab') || 'home');
    
    // Check for pending JD from landing page
    var pending = localStorage.getItem('pending_jd');
    if (pending) {
      var jdInput = document.getElementById('jd');
      if (jdInput) {
        jdInput.value = pending;
        localStorage.removeItem('pending_jd');
      }
    }
  })();

})();