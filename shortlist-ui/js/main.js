/* ============================================================
   Mindloop — shared interactions
   Every block self-guards: if its target nodes are absent on the
   current page, the block quietly does nothing. So one file serves
   landing, login, and dashboard.
   ============================================================ */

/* ── 1. fadeUp reveal (IntersectionObserver, staggered siblings) ── */
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

/* ── 3. HLS: attach to any [data-hls] video (hls.js + native fallback) ── */
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

/* ── 4. Generic "navigate on submit" forms (hero subscribe, etc.) ── */
(function () {
  document.querySelectorAll('form[data-go]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      window.location.href = f.getAttribute('data-go');
    });
  });
})();

/* ── 5. Login form ── */
(function () {
  var form = document.getElementById('auth-form');
  if (!form) return;
  var err = document.getElementById('auth-err');
  var emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function fail(msg) { if (err) { err.textContent = msg; err.style.display = 'block'; } }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.email.value.trim();
    var pw = form.password.value;
    if (!emailRe.test(email)) return fail('Enter a valid email address.');
    if (pw.length < 6) return fail('Password must be at least 6 characters.');
    try { localStorage.setItem('mindloop_user', email); } catch (_) {}
    window.location.href = 'dashboard.html';
  });
})();

/* ── 6. Dashboard ── */
(function () {
  var app = document.getElementById('app');
  if (!app) return;

  var V = {
    hero: 'https://plugin-assets.open-design.ai/plugins/mindloop-landing/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f-9b476a.mp4',
    mission: 'https://plugin-assets.open-design.ai/plugins/mindloop-landing/hf_20260325_132944_a0d124bb-eaa1-4082-aa30-2310efb42b4b-d0e30d.mp4',
    solution: 'https://plugin-assets.open-design.ai/plugins/mindloop-landing/hf_20260325_125119_8e5ae31c-0021-4396-bc08-f7aebeb877a2-1f0a78.mp4'
  };

  var VIDEOS = [
    { id: 'v1', title: 'Software Engineer, Google', author: 'STRONG FIT (4.8)', dur: 'Applied', src: V.mission,
      desc: 'You match 9 of 10 requirements. JD says "TypeScript experience", resume says "Built full-stack TypeScript apps". Gap: Go experience.' },
    { id: 'v2', title: 'Frontend Developer, Vercel', author: 'STRETCH (3.6)', dur: 'Review', src: V.hero,
      desc: 'You match 5 of 8 requirements. Perfect fit on Next.js and React. Gap: Missing 3+ years of enterprise experience. Awaiting your approval.' },
    { id: 'v3', title: 'Full Stack Engineer, Stripe', author: 'STRONG FIT (4.3)', dur: 'Interview', src: V.solution,
      desc: 'You match 7 of 8 requirements. JD says "API Design", resume says "Architected RESTful APIs". Strong matching signals on Stripe integration.' },
    { id: 'v4', title: 'Data Scientist, OpenAI', author: 'SKIP (2.4)', dur: 'Discarded', src: V.mission,
      desc: 'You match 3 of 10 requirements. Heavy gaps in Python ML frameworks and large scale distributed systems.' },
    { id: 'v5', title: 'Product Engineer, Linear', author: 'STRETCH (3.9)', dur: 'Review', src: V.solution,
      desc: 'You match 6 of 8 requirements. Very strong product sense and frontend skills. Gap: Missing complex state management (MobX/Redux) at scale.' },
    { id: 'v6', title: 'Backend Engineer, Supabase', author: 'SKIP (2.8)', dur: 'Discarded', src: V.hero,
      desc: 'You match 4 of 9 requirements. Missing Postgres internals and Rust experience.' }
  ];

  var NEWS = [
    { id: 'n1', title: 'Frontend Developer, Vercel', author: 'Vercel', date: 'Jun 28, 2026', read: 'Score: 3.6',
      kicker: 'STRETCH',
      excerpt: 'Missing 3+ years of enterprise experience. But strong fit on Next.js and React.',
      body: [
        'Verdict: STRETCH',
        'Requirements Matched:',
        '- "Deep knowledge of React and Next.js" -> "Built 5 apps using React and Next.js 14"',
        '- "Experience with modern CSS (Tailwind)" -> "Styled responsive layouts with TailwindCSS"',
        '',
        'Gaps Identified:',
        '- "3+ years of enterprise experience" (No evidence in resume)',
        '- "Experience with CI/CD pipelines" (No evidence in resume)',
        '',
        'Draft Intro:',
        'Hi Vercel team. I noticed the Frontend Developer role. While I am a recent grad, I have extensive experience building with Next.js and React, including a recent open-source project. I would love to bring my modern frontend skills to the team.'
      ] },
    { id: 'n2', title: 'Product Engineer, Linear', author: 'Linear', date: 'Jun 27, 2026', read: 'Score: 3.9',
      kicker: 'STRETCH',
      excerpt: 'Very strong product sense and frontend skills. Gap: Missing complex state management at scale.',
      body: [
        'Verdict: STRETCH',
        'Requirements Matched:',
        '- "Product-minded engineer" -> "Led product decisions on student hackathon project"',
        '- "TypeScript proficiency" -> "Wrote 10k+ lines of strict TypeScript"',
        '',
        'Gaps Identified:',
        '- "Experience with MobX or complex state management at scale" (No evidence in resume)',
        '',
        'Draft Intro:',
        'Hello Linear team! I have always admired the craft behind Linear. I have strong product sense and TypeScript experience, and I am a fast learner when it comes to state management. I would love to contribute to the engine.'
      ] }
  ];

  function initials(email) {
    if (!email) return 'SL';
    var name = email.split('@')[0].replace(/[^a-zA-Z]/g, '');
    return (name.slice(0, 2) || 'SL').toUpperCase();
  }

  var user = null;
  try { user = localStorage.getItem('mindloop_user'); } catch (_) {}
  var ini = document.getElementById('user-ini');
  var uname = document.getElementById('user-name');
  if (ini) ini.textContent = initials(user);
  if (uname) uname.textContent = user ? user.split('@')[0] : 'Applicant';

  /* ----- builders ----- */
  var PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>';

  function videoCard(v) {
    var el = document.createElement('div');
    el.className = 'vid-card';
    // Using video as abstract animated card background
    el.innerHTML =
      '<div class="vid-thumb-wrap">' +
        '<video muted playsinline preload="metadata" src="' + v.src + '#t=0.5"></video>' +
        '<div class="vid-play">' + PLAY_SVG + '</div>' +
        '<span class="vid-dur">' + v.dur + '</span>' +
      '</div>' +
      '<div class="vid-meta"><h3>' + v.title + '</h3><span>' + v.author + '</span></div>';
    el.addEventListener('click', function () { openPlayer(v); });
    return el;
  }

  function newsletterItem(v, n) {
    var el = document.createElement('div');
    el.className = 'nl-item';
    el.innerHTML =
      '<div class="nl-num">' + String(n).padStart(2, '0') + '</div>' +
      '<div class="nl-body">' +
        '<h3>' + v.title + '</h3>' +
        '<p class="excerpt">' + v.excerpt + '</p>' +
        '<div class="meta"><span>' + v.author + '</span><span>' + v.date + '</span><span>' + v.read + '</span></div>' +
      '</div>';
    el.addEventListener('click', function () { openReader(v); });
    return el;
  }

  /* ----- view switching ----- */
  var views = document.querySelectorAll('.view');
  function showView(name) {
    views.forEach(function (vw) { vw.classList.toggle('hidden', vw.dataset.view !== name); });
    document.querySelectorAll('.side-link').forEach(function (l) {
      l.classList.toggle('active', l.dataset.tab === name);
    });
    if (['home', 'watch', 'newsletters', 'bookmarks', 'settings'].indexOf(name) !== -1) {
      try { localStorage.setItem('mindloop_tab', name); } catch (_) {}
    }
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.side-link').forEach(function (l) {
    if (!l.dataset.tab) return; // skip logout (no tab)
    l.addEventListener('click', function () { showView(l.dataset.tab); });
  });

  function openPlayer(v) {
    var pv = document.getElementById('player-video');
    if (pv) {
      pv.src = v.src;
      pv.load();
      pv.play().catch(function () {});
    }
    var pt = document.getElementById('player-title');
    if (pt) pt.textContent = v.title;
    var pa = document.getElementById('player-author');
    if (pa) pa.textContent = v.author + " — Status: " + v.dur;
    var pd = document.getElementById('player-desc');
    if (pd) pd.textContent = v.desc;
    showView('player');
  }

  function openReader(v) {
    document.getElementById('reader-kicker').textContent = v.kicker;
    document.getElementById('reader-title').textContent = v.title;
    document.getElementById('reader-meta').innerHTML =
      '<span>' + v.author + '</span><span>' + v.date + '</span><span>' + v.read + '</span>';
    var body = document.getElementById('reader-body');
    body.innerHTML = '';
    v.body.forEach(function (p) {
      var el = document.createElement('p');
      el.textContent = p;
      body.appendChild(el);
    });
    
    // Add Approve / Apply buttons to mimic Review Queue workflow
    var btnWrap = document.createElement('div');
    btnWrap.style.marginTop = '2rem';
    btnWrap.style.display = 'flex';
    btnWrap.style.gap = '1rem';
    
    var btnApprove = document.createElement('button');
    btnApprove.className = 'btn-primary';
    btnApprove.textContent = 'Approve & Apply';
    
    var btnReject = document.createElement('button');
    btnReject.className = 'btn-glass liquid-glass';
    btnReject.textContent = 'Discard';
    
    btnWrap.appendChild(btnApprove);
    btnWrap.appendChild(btnReject);
    body.appendChild(btnWrap);
    
    showView('reader');
  }

  /* back buttons + logout */
  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () {
      var pv = document.getElementById('player-video');
      if (pv) pv.pause();
      showView(b.getAttribute('data-back'));
    });
  });
  var logout = document.getElementById('logout');
  if (logout) logout.addEventListener('click', function () {
    try { localStorage.removeItem('mindloop_user'); } catch (_) {}
    window.location.href = 'login.html';
  });

  var greet = document.getElementById('greeting');
  if (greet) greet.textContent = 'Welcome back, ' + (user ? user.split('@')[0] : 'Applicant');

  // restore last tab
  var saved = 'home';
  try { saved = localStorage.getItem('mindloop_tab') || 'home'; } catch (_) {}
  showView(saved);
})();