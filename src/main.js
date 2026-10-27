// ============================================================
// main.js — App entry: Lenis smooth-scroll, GSAP ScrollTrigger,
//           loader, reduced-motion check, scene init
// ============================================================
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { CONFIG, CITY_MODE } from './config.js';
// Scene initialisers
import { initIntro } from './scenes/intro.js';
import { initFlip }  from './scenes/flip.js';
// Future phases
import { initRun }    from './scenes/run.js';
import { initCity }   from './scenes/city.js';
import { initCity3D } from './scenes/city3d.js';
import { initRocket } from './scenes/rocket.js';
import { initRocket3D } from './scenes/rocket3d.js';
import { initMoon }   from './scenes/moon.js';
import { initMoon3D } from './scenes/moon3d.js';
import { initTrain }  from './scenes/train.js';
import { initBase }   from './scenes/base.js';
import { initSpace }  from './scenes/space.js';
import { initNav }    from './nav.js';
import achievements from '../data/achievements.json';
import projects     from '../data/projects.json';

// Register GSAP plugin
gsap.registerPlugin(ScrollTrigger);

// ── Reduced motion check ──
const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function renderStaticContent(staticEl) {
  if (!staticEl) return;
  staticEl.removeAttribute('hidden');

  const achievementsList = (achievements || []).map((item, idx) => `
    <div class="classic-hack-item selected">
      <div class="classic-hack-badge">${item.tag || `// ACHIEVEMENT 0${idx + 1}`}</div>
      <div class="classic-hack-main">
        <h3>${item.title}</h3>
        <p class="classic-hack-desc">${item.detail}</p>
      </div>
    </div>
  `).join('');

  const projectsList = (projects || []).map((proj) => `
    <div class="classic-project-card">
      <div>
        <div class="classic-project-top">
          <h3 class="classic-project-title">${proj.title}</h3>
          <a href="${proj.link && proj.link !== '#' ? proj.link : 'https://github.com/ashwin-kumaar-b'}" target="_blank" rel="noopener noreferrer" class="classic-project-link">
            EXPLORE ↗
          </a>
        </div>
        <p class="classic-project-desc">${proj.description}</p>
      </div>
      <div class="classic-project-tags">
        ${(proj.tags || []).map(t => `<span>${t}</span>`).join('')}
      </div>
    </div>
  `).join('');

  staticEl.innerHTML = `
    <!-- Top Return Banner -->
    <div class="classic-mode-banner">
      <div class="classic-banner-info">
        <span class="classic-pulse-dot" aria-hidden="true"></span>
        <span>Classic Static View</span>
        <span class="classic-banner-sep">·</span>
        <span class="classic-banner-sub">Reading &amp; Quick Navigation Layout</span>
      </div>
      <button type="button" class="classic-switch-btn" onclick="window.setViewMode('cinematic')">
        <span>✨ Return to 3D Experience</span>
        <span>🚀</span>
      </button>
    </div>

    <!-- Hero Profile Section -->
    <section id="static-hero" class="classic-hero">
      <div class="classic-hero-top">
        <div class="classic-profile-avatar">
          <span>A</span>
        </div>
        <div class="classic-hero-badge">
          <span class="classic-pulse-green"></span>
          <span>Open to AI / Web / Flutter Opportunities</span>
        </div>
      </div>
      <h1 class="classic-hero-name">Ashwin Kumaar B</h1>
      <p class="classic-hero-title">B.Tech AI &amp; Data Science · Rajalakshmi Institute of Technology</p>
      <p class="classic-hero-location">📍 Chennai, India</p>
      <p class="classic-hero-tagline">
        Building tech that helps people make better decisions — specialized in intelligent telemetry, machine learning, predictive maintenance, and resilient distributed systems.
      </p>
      <div class="classic-hero-actions">
        <a href="mailto:ashwinkumaar.bk@gmail.com" class="classic-action-btn primary">Email Me ✉</a>
        <a href="https://www.linkedin.com/in/ashwin-kumaar-b-16271932b/" target="_blank" rel="noopener noreferrer" class="classic-action-btn">LinkedIn ↗</a>
        <a href="https://github.com/ashwin-kumaar-b" target="_blank" rel="noopener noreferrer" class="classic-action-btn">GitHub ↗</a>
        <button type="button" class="classic-action-btn highlight" onclick="window.setViewMode('cinematic')">
          Launch 3D Cinematic Mode 🚀
        </button>
      </div>
    </section>

    <!-- Domains Section -->
    <section id="static-domains" class="classic-section">
      <div class="classic-section-header">
        <span class="classic-section-sub">// 01. SPECIALIZATIONS</span>
        <h2 class="classic-section-title">Core Domains &amp; Focus</h2>
      </div>
      <div class="classic-grid-2">
        <div class="classic-domain-card">
          <div class="classic-card-icon">🩺</div>
          <h3>Clinical AI &amp; Medical Screening</h3>
          <p>End-to-end medical screening pipelines grading retinal fundus images for Diabetic Retinopathy in &lt;2s with Grad-CAM explainability, ONNX-optimized FastAPI inference, and dynamic medical-grade PDF reporting.</p>
          <div class="classic-card-tags">
            <span>EfficientNet</span><span>ONNX Runtime</span><span>Grad-CAM</span><span>React 19</span>
          </div>
        </div>
        <div class="classic-domain-card">
          <div class="classic-card-icon">🤖</div>
          <h3>Predictive Maintenance &amp; Telemetry</h3>
          <p>PHM telemetry and Remaining Useful Life (RUL) estimation using XGBoost algorithms and real-time edge telemetry analysis to preempt device hardware failures.</p>
          <div class="classic-card-tags">
            <span>XGBoost</span><span>PHM Telemetry</span><span>Hardware Analytics</span>
          </div>
        </div>
        <div class="classic-domain-card">
          <div class="classic-card-icon">📡</div>
          <h3>Disaster Response &amp; Mesh Comms</h3>
          <p>Off-grid peer-to-peer mobile communications built for disaster zones utilizing Wi-Fi Direct and Bluetooth mesh networking without cellular dependencies.</p>
          <div class="classic-card-tags">
            <span>Wi-Fi Direct</span><span>Bluetooth Mesh</span><span>P2P Networking</span>
          </div>
        </div>
        <div class="classic-domain-card">
          <div class="classic-card-icon">🏙️</div>
          <h3>Smart Cities &amp; Urban Governance</h3>
          <p>Intelligent grievance routing and urban signal analytics leveraging NLP and distributed reporting systems built for national-level hackathons.</p>
          <div class="classic-card-tags">
            <span>NLP</span><span>Smart Cities</span><span>Urban Telemetry</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Skills Section -->
    <section id="static-skills" class="classic-section">
      <div class="classic-section-header">
        <span class="classic-section-sub">// 02. TECHNICAL PROFICIENCY</span>
        <h2 class="classic-section-title">Skills &amp; Technologies</h2>
      </div>
      <div class="classic-skills-grid">
        <div class="classic-skill-category">
          <h4>Programming Languages</h4>
          <div class="classic-tag-group">
            <span class="classic-tag yellow">Python</span>
            <span class="classic-tag yellow">Java</span>
            <span class="classic-tag yellow">C</span>
            <span class="classic-tag yellow">JavaScript (ES6+)</span>
            <span class="classic-tag yellow">Dart</span>
            <span class="classic-tag yellow">SQL</span>
            <span class="classic-tag yellow">HTML5</span>
            <span class="classic-tag yellow">CSS3</span>
          </div>
        </div>
        <div class="classic-skill-category">
          <h4>Web &amp; Mobile Development</h4>
          <div class="classic-tag-group">
            <span class="classic-tag cyan">React.js</span>
            <span class="classic-tag cyan">Flutter</span>
            <span class="classic-tag cyan">Node.js</span>
            <span class="classic-tag cyan">Express.js</span>
            <span class="classic-tag cyan">RESTful APIs</span>
          </div>
        </div>
        <div class="classic-skill-category">
          <h4>Databases &amp; Systems</h4>
          <div class="classic-tag-group">
            <span class="classic-tag magenta">PostgreSQL</span>
            <span class="classic-tag magenta">NoSQL (MongoDB)</span>
            <span class="classic-tag magenta">Firebase</span>
            <span class="classic-tag magenta">Edge Storage</span>
          </div>
        </div>
        <div class="classic-skill-category">
          <h4>AI / ML &amp; Core Strengths</h4>
          <div class="classic-tag-group">
            <span class="classic-tag white">XGBoost</span>
            <span class="classic-tag white">Machine Learning</span>
            <span class="classic-tag white">Predictive Maintenance</span>
            <span class="classic-tag white">Creative Thinking</span>
            <span class="classic-tag white">Problem Solver</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Hackathons Section -->
    <section id="static-hackathons" class="classic-section">
      <div class="classic-section-header">
        <span class="classic-section-sub">// 03. COMPETITIVE ARENA</span>
        <h2 class="classic-section-title">Hackathons &amp; Recognition</h2>
      </div>
      <div class="classic-hackathons-list">
        <div class="classic-hack-item winner">
          <div class="classic-hack-badge">🏆 1st Place Winner</div>
          <div class="classic-hack-main">
            <h3>RobochipX 2026 — AI Track</h3>
            <p class="classic-hack-org">Department of VLSI · Rajalakshmi Institute of Technology (RIT Chennai)</p>
            <p class="classic-hack-desc">Won 1st place in the flagship AI Track, developing an end-to-end intelligent automation telemetry model recognized for real-time model accuracy and production viability.</p>
          </div>
        </div>
        <div class="classic-hack-item finalist">
          <div class="classic-hack-badge">🎖️ Shortlisted Finalist (Top 1% of 3,000+)</div>
          <div class="classic-hack-main">
            <h3>CSI ORIGIN 2026 — Offline Hackathon</h3>
            <p class="classic-hack-org">Computer Society of India · VIT Chennai</p>
            <p class="classic-hack-desc">Shortlisted in competitive online prelims out of 3,000+ national participants and qualified for the on-campus finale hackathon at VIT Chennai.</p>
          </div>
        </div>
        <div class="classic-hack-item selected">
          <div class="classic-hack-badge">🏛️ Selected College Representative</div>
          <div class="classic-hack-main">
            <h3>Smart India Hackathon (SIH 2026)</h3>
            <p class="classic-hack-org">Internal Hackathon Round · Rajalakshmi Institute of Technology</p>
            <p class="classic-hack-desc">Selected in the highly competitive institutional internal hackathon round at RIT to represent the college at the national Smart India Hackathon (SIH 2026).</p>
          </div>
        </div>
        <div class="classic-hack-item participant">
          <div class="classic-hack-badge">⚡ 24h Sprint Participant</div>
          <div class="classic-hack-main">
            <h3>CODEATHON 4.0</h3>
            <p class="classic-hack-org">Department of CSE &amp; CSBS · Prathyusha Engineering College (10th &amp; 11th March 2026)</p>
            <p class="classic-hack-desc">Competed in rapid 24-hour sprint developing and presenting algorithmic prototypes under strict criteria.</p>
          </div>
        </div>
        <div class="classic-hack-item participant">
          <div class="classic-hack-badge">🔬 Engineering Hackathon Participant</div>
          <div class="classic-hack-main">
            <h3>Nanohack 2026</h3>
            <p class="classic-hack-org">SIMATS Engineering, Chennai</p>
            <p class="classic-hack-desc">Engineered smart-technology solutions addressing real-world engineering constraints in high-pressure team setting.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Projects Section -->
    <section id="static-projects" class="classic-section">
      <div class="classic-section-header">
        <span class="classic-section-sub">// 04. FEATURED PROJECTS</span>
        <h2 class="classic-section-title">Selected Works</h2>
      </div>
      <div class="classic-projects-grid">
        ${projectsList}
      </div>
    </section>

    <!-- Achievements Section -->
    <section id="static-achievements" class="classic-section">
      <div class="classic-section-header">
        <span class="classic-section-sub">// 05. HIGHLIGHTED ACHIEVEMENTS</span>
        <h2 class="classic-section-title">Mission Highlights</h2>
      </div>
      <div class="classic-hackathons-list">
        ${achievementsList}
      </div>
    </section>

    <!-- Bottom Return Banner -->
    <div class="classic-bottom-cta">
      <h3>Ready for the Full Experience?</h3>
      <p>Explore the animated 3D cyberpunk scroll journey with interactive runner, rooftop city chase, and lunar rover.</p>
      <button type="button" class="classic-switch-btn" onclick="window.setViewMode('cinematic')">
        <span>Launch 3D Cinematic Mode</span>
        <span>🚀</span>
      </button>
    </div>
  `;
}

let lenisInstance = null;

window.setViewMode = (mode) => {
  if (mode === 'classic') {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'classic');
    window.history.replaceState({}, '', url.toString());

    if (lenisInstance) {
      lenisInstance.destroy();
      lenisInstance = null;
      if (typeof window !== 'undefined' && window.__lenis) {
        delete window.__lenis;
      }
    }
    document.getElementById('main-content')?.setAttribute('hidden', '');
    const staticEl = document.getElementById('static-content');
    if (staticEl) {
      renderStaticContent(staticEl);
      window.scrollTo(0, 0);
    }
    if (typeof window.__syncNavModeLabels === 'function') {
      window.__syncNavModeLabels('classic');
    }
  } else if (mode === 'cinematic' || mode === 'original') {
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    url.searchParams.delete('classic');
    // Fresh reload to clean URL guarantees pristine 3D WebGL context, GSAP, and Lenis setup
    window.location.href = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
  }
};

function boot() {
  const isClassic = typeof window !== 'undefined' && (
    window.location.search.includes('classic') ||
    window.location.search.includes('view=classic')
  );
  const isStaticVisible = document.getElementById('static-content')?.hasAttribute('hidden') === false;
  const isReduced = prefersReducedMotion || isClassic || isStaticVisible;

  if (isReduced) {
    // Phase 4: swap to a static layout (Do NOT create Lenis)
    document.getElementById('main-content')?.setAttribute('hidden', '');
    const staticEl = document.getElementById('static-content');
    renderStaticContent(staticEl);
    initNav();
    if (typeof window.__syncNavModeLabels === 'function') {
      window.__syncNavModeLabels('classic');
    }
    hideLoader();
    return;
  }

  // Intercept ScrollTrigger.create so any scrub > 0.5 is changed to 0.4 (forward all args)
  const origSTCreate = ScrollTrigger.create;
  ScrollTrigger.create = function (...args) {
    const vars = args[0];
    if (vars && typeof vars.scrub === 'number' && vars.scrub > 0.5) {
      vars.scrub = 0.4;
    }
    return origSTCreate.apply(this, args);
  };

  // ── Lenis smooth scroll (Single Driver) ──
  // Silkier base lerp (0.055) and controlled wheelMultiplier (0.6) to prevent skipping
  const BASE_LERP = 0.055;
  const BASE_WHEEL_MULTIPLIER = 0.6;
  const MIN_LERP = 0.035;
  const MIN_WHEEL_MULTIPLIER = 0.10;

  const lenis = new Lenis({
    lerp: BASE_LERP,
    smoothWheel: true,
    wheelMultiplier: BASE_WHEEL_MULTIPLIER,
    syncTouch: false,
    autoRaf: false,
  });
  lenisInstance = lenis;

  // Expose window.__lenis only when location.search includes 'debug'
  if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
    window.__lenis = lenis;
  }

  // ── Premium Dynamic Scroll Resistance (Text Reading Slowdown) ──
  // Slows scrolling smoothly and exponentially when readable content is on screen,
  // preventing the user from accidentally skipping past information.
  // Fast blend rate (0.60) engages braking instantly before user can skip past content.
  let currentMultiplier = BASE_WHEEL_MULTIPLIER;
  let currentLerp = BASE_LERP;
  let cachedTextElements = null;

  function getTextElements() {
    if (!cachedTextElements || cachedTextElements.length === 0) {
      cachedTextElements = Array.from(document.querySelectorAll(
        '.space-card, .city-callout, .moon-card, .run-skill-tag, .run-text-block'
      ));
    }
    return cachedTextElements;
  }

  function getActiveTextIntensity() {
    const elements = getTextElements();
    let maxIntensity = 0;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.style.display === 'none' || el.style.visibility === 'hidden') continue;
      let op = parseFloat(el.style.opacity);
      if (isNaN(op)) {
        if (el.classList.contains('is-focused')) {
          op = 1;
        } else {
          continue;
        }
      }
      if (op <= 0.02) continue;

      // Unfocused moon cards have a lower weighting
      if (el.classList.contains('moon-card') && !el.classList.contains('is-focused')) {
        op *= 0.35;
      }

      // Runner scene text tags shouldn't heavily brake scroll so the run feels dynamic and fast
      if (el.classList.contains('run-text-block') || el.classList.contains('run-skill-tag')) {
        op *= 0.15;
      }

      if (op > maxIntensity) {
        maxIntensity = op;
      }
    }
    return Math.min(1, Math.max(0, maxIntensity));
  }

  function updateScrollDamping() {
    const intensity = getActiveTextIntensity();

    // Aggressive exponential decay (exp(-2.8 * intensity)):
    // At intensity = 0.0 -> multiplier = 0.60, lerp = 0.055 (silky cruise)
    // At intensity = 0.5 -> multiplier ≈ 0.15 (heavy resistance)
    // At intensity = 1.0 -> multiplier = 0.10, lerp = 0.035 (magnetic reading mode, cannot skip)
    const targetMultiplier = Math.max(
      MIN_WHEEL_MULTIPLIER,
      BASE_WHEEL_MULTIPLIER * Math.exp(-2.8 * intensity)
    );
    const targetLerp = Math.max(
      MIN_LERP,
      BASE_LERP * Math.exp(-0.8 * intensity)
    );

    // Fast engagement (0.60) so braking clamps down immediately when text appears;
    // gentle recovery (0.12) when scrolling away.
    const blendRate = targetMultiplier < currentMultiplier ? 0.60 : 0.12;
    currentMultiplier += (targetMultiplier - currentMultiplier) * blendRate;
    currentLerp += (targetLerp - currentLerp) * blendRate;

    lenis.options.wheelMultiplier = currentMultiplier;
    lenis.options.lerp = currentLerp;
    if (lenis.virtualScroll && lenis.virtualScroll.options) {
      lenis.virtualScroll.options.wheelMultiplier = currentMultiplier;
      lenis.virtualScroll.options.touchMultiplier = currentMultiplier;
    }
  }

  // Clear cached text elements on ScrollTrigger refresh
  ScrollTrigger.addEventListener('refresh', () => {
    cachedTextElements = null;
  });

  // Sync Lenis → ScrollTrigger and drive ONLY via gsap.ticker with dynamic text slowdown
  lenis.on('scroll', (e) => {
    updateScrollDamping();
    ScrollTrigger.update(e);
  });

  gsap.ticker.add((time) => {
    updateScrollDamping();
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // ── Init scenes ──
  initIntro();
  initFlip();

  initRun();

  // Stacking: portal-under margin-top and scene-city z-index
  const portalUnder = document.querySelector('.portal-under');
  if (portalUnder) {
    const irisLen = CONFIG.scrollLengths?.irisLen ?? 80;
    portalUnder.style.position = 'relative';
    portalUnder.style.zIndex = '0';
    portalUnder.style.marginTop = `calc(-100vh - ${irisLen} * 1vh)`;
  }
  const sceneCity = document.getElementById('scene-city');
  if (sceneCity) {
    sceneCity.style.position = 'relative';
    sceneCity.style.zIndex = '2';
  }

  // City scene: use 3D if CITY_MODE is '3d' and WebGL is available; fallback to 2D
  const hasWebGL = (() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch {
      return false;
    }
  })();

  const use3DCity = (CONFIG.cityMode || CITY_MODE) === '3d' && hasWebGL && !prefersReducedMotion;
  if (use3DCity) {
    initCity3D();
  } else {
    initCity();
  }
  // Rocket scene: use 3D if WebGL is available and not reduced motion; else fallback
  const use3DRocket = hasWebGL && !prefersReducedMotion;
  if (use3DRocket) {
    initRocket3D();
  } else {
    initRocket();
  }

  // Space scene: skipped in classic and reduced-motion mode
  if (!prefersReducedMotion) {
    initSpace();
  }

  // Moon scene: use 3D if WebGL is available and not reduced motion; else fallback
  const use3DMoon = hasWebGL && !prefersReducedMotion;
  if (use3DMoon) {
    initMoon3D();
  } else {
    initMoon();
  }

  initTrain();
  initBase();

  initNav(lenis);

  // Double smoothing: ensure all ScrollTriggers with scrub > 0.5 are set to 0.4
  ScrollTrigger.getAll().forEach((st) => {
    if (st.vars && typeof st.vars.scrub === 'number' && st.vars.scrub > 0.5) {
      st.vars.scrub = 0.4;
    }
    if (typeof st.scrub === 'number' && st.scrub > 0.5) {
      st.scrub = 0.4;
    }
  });

  // After window load and after document.fonts.ready, call ScrollTrigger.refresh()
  const refreshOnReady = () => {
    ScrollTrigger.refresh();
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refreshOnReady);
  }

  if (document.readyState === 'complete') {
    refreshOnReady();
  } else {
    window.addEventListener('load', refreshOnReady, { once: true });
  }

  // On resize, debounce 150ms and then refresh
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
  });

  // ── Hide loader after a short settle ──
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
    hideLoader();
  });
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('hide');
    setTimeout(() => { loader.style.display = 'none'; }, 500);
  }
  document.querySelector('.site-nav')?.classList.add('is-visible');
}

// Boot on DOMContentLoaded (fonts already loading via <link>)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
