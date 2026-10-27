// ============================================================
// nav.js — Fixed Site Header & Navigation
// ============================================================

import { CONFIG, NAV, CONTACT } from './config.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let navLenis = null;

export function setNavLenis(instance) {
  navLenis = instance;
}

/**
 * Scroll smoothly to an element selector, scene percentage, or pixel offset.
 * @param {string|number|{scene: string, p: number}} target
 */
export function scrollToTarget(target) {
  let y = 0;

  const navConfig = NAV || CONFIG.nav || { name: 'Ashwin', projectsScene: '#scene-moon', projectsP: 0.2 };

  const staticContent = document.getElementById('static-content');
  const isStatic = (
    !ScrollTrigger.getAll ||
    ScrollTrigger.getAll().length === 0 ||
    (staticContent && !staticContent.hasAttribute('hidden'))
  );

  const rawTarget = typeof target === 'string' ? target.toLowerCase() : '';

  // ── Static / Classic Mode Navigation ──
  if (isStatic) {
    let targetEl = null;
    if (rawTarget.includes('skill')) {
      targetEl = document.getElementById('static-skills');
    } else if (rawTarget.includes('hackathon')) {
      targetEl = document.getElementById('static-hackathons');
    } else if (rawTarget.includes('domain')) {
      targetEl = document.getElementById('static-domains');
    } else if (rawTarget.includes('achievement')) {
      targetEl = document.getElementById('static-achievements');
    } else if (rawTarget.includes('project')) {
      targetEl = document.getElementById('static-projects');
    } else if (rawTarget.includes('contact')) {
      targetEl = document.getElementById('contact');
    } else if (rawTarget === '#top' || rawTarget === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (targetEl) {
      const navHeaderHeight = 75;
      const targetY = targetEl.getBoundingClientRect().top + window.scrollY - navHeaderHeight;
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      return;
    }
  }

  // Normalize friendly aliases for 3D Cinematic Mode
  if (target === '#skills' || target === 'skills') {
    target = { scene: '#scene-city', pCity: 0.20 };
  } else if (target === '#hackathons' || target === 'hackathons') {
    target = { scene: '#scene-city', pCity: 0.44 };
  } else if (target === '#domains' || target === 'domains') {
    target = { scene: '#scene-city', pCity: 0.68 };
  } else if (target === '#achievements' || target === 'achievements') {
    target = { scene: '#scene-space', p: 0.20 };
  } else if (target === '#projects' || target === 'projects') {
    target = { scene: navConfig.projectsScene || '#scene-moon', p: navConfig.projectsP ?? 0.2 };
  } if (typeof target === 'string') {
    if (target === '#top' || target === 'top') {
      y = 0;
    } else if (target === '#contact' || target === 'contact') {
      const contactEl = document.getElementById('contact');
      if (contactEl) {
        const maxScroll = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        ) - window.innerHeight;
        const elTop = contactEl.getBoundingClientRect().top + window.scrollY;
        y = Math.min(elTop, maxScroll);
      } else {
        y = 0;
      }
    } else {
      const el = document.querySelector(target);
      if (el) {
        y = el.getBoundingClientRect().top + window.scrollY;
      } else {
        y = 0;
      }
    }
  } else if (typeof target === 'number') {
    y = target;
  } else if (target && typeof target === 'object' && target.scene) {
    const sceneEl = document.querySelector(target.scene);
    const sceneId = target.scene.replace('#', '');
    const st = ScrollTrigger.getAll
      ? ScrollTrigger.getAll().find((s) => s.pin && (
          s.trigger === sceneEl ||
          s.vars?.trigger === sceneEl ||
          (s.vars?.id && s.vars.id.includes(sceneId))
        ))
      : null;

    if (st && typeof st.start === 'number' && typeof st.end === 'number') {
      let p = 0;
      if (typeof target.pCity === 'number') {
        const is3D = st.vars?.id === 'city3d-trigger';
        const cityLen = CONFIG.scrollLengths?.city || 350;
        const irisLen = CONFIG.scrollLengths?.irisLen ?? 110;
        const total = is3D ? (cityLen + irisLen) : cityLen;
        p = Math.min(1, Math.max(0, target.pCity * (cityLen / total)));
      } else if (typeof target.p === 'number') {
        p = target.p;
      }
      y = st.start + p * (st.end - st.start);
    } else if (sceneEl) {
      y = sceneEl.getBoundingClientRect().top + window.scrollY;
    } else {
      y = 0;
    }
  }

  // Smooth scroll using Lenis when available, fallback to native smooth
  const lenis = navLenis || (typeof window !== 'undefined' && (window.__lenis || window.lenis));
  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.scrollTo(y, { duration: 1.2 });
  } else {
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  if (typeof ScrollTrigger.update === 'function') {
    ScrollTrigger.update();
  }
}

/**
 * Initializes the persistent navigation header.
 */
export function initNav(lenisInstance = null) {
  if (lenisInstance) {
    navLenis = lenisInstance;
  }
  // Prevent duplicate insertion
  if (document.querySelector('.site-nav')) {
    return;
  }

  const navConfig = NAV || CONFIG.nav || { name: 'Ashwin', projectsScene: '#scene-moon', projectsP: 0.2 };
  const contactConfig = CONTACT || CONFIG.contact || {};
  const hasResume = Boolean(
    contactConfig.resume &&
    contactConfig.resume.trim() !== '' &&
    contactConfig.resume.trim() !== '#'
  );

  // 1. Build Header Container
  const header = document.createElement('header');
  header.className = 'site-nav';

  // 2. Build Inner Nav
  const nav = document.createElement('nav');
  nav.className = 'site-nav-inner';
  nav.setAttribute('aria-label', 'Main');

  // Left: Yellow square cube + name
  const leftDiv = document.createElement('div');
  leftDiv.className = 'site-nav-left';

  const logoLink = document.createElement('a');
  logoLink.href = '#top';
  logoLink.className = 'site-nav-logo';
  logoLink.setAttribute('aria-label', `${navConfig.name} - Back to top`);

  const cubeSpan = document.createElement('span');
  cubeSpan.className = 'site-nav-cube';
  cubeSpan.setAttribute('aria-hidden', 'true');

  const nameSpan = document.createElement('span');
  nameSpan.className = 'site-nav-name';
  nameSpan.textContent = navConfig.name || 'Ashwin';

  logoLink.appendChild(cubeSpan);
  logoLink.appendChild(nameSpan);
  leftDiv.appendChild(logoLink);
  nav.appendChild(leftDiv);

  // Center Navigation Links: spread across the middle with synced bottom nav line
  const centerDiv = document.createElement('div');
  centerDiv.className = 'site-nav-center';

  const linksWrap = document.createElement('div');
  linksWrap.className = 'site-nav-links-wrap';

  const linksContainer = document.createElement('div');
  linksContainer.className = 'site-nav-links';

  // Synced Nav Line Track under the links
  const lineTrack = document.createElement('div');
  lineTrack.className = 'site-nav-line-track';

  const lineFill = document.createElement('div');
  lineFill.className = 'site-nav-line-fill';

  const lineIndicator = document.createElement('div');
  lineIndicator.className = 'site-nav-line-indicator';

  lineTrack.appendChild(lineFill);
  lineTrack.appendChild(lineIndicator);
  linksWrap.appendChild(linksContainer);
  linksWrap.appendChild(lineTrack);
  centerDiv.appendChild(linksWrap);

  // Right (Desktop): Resume (conditional), Classic view
  const rightDiv = document.createElement('div');
  rightDiv.className = 'site-nav-right';

  // Mobile Menu Button (under 960px)
  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'site-nav-menu-btn';
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-controls', 'site-nav-mobile-overlay');
  menuBtn.setAttribute('aria-label', 'Toggle navigation menu');
  menuBtn.textContent = 'MENU';

  // Mobile Fullscreen Overlay (under 960px)
  const overlay = document.createElement('div');
  overlay.id = 'site-nav-mobile-overlay';
  overlay.className = 'site-nav-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  // Overlay Header with Logo and prominent Close Button
  const overlayHeader = document.createElement('div');
  overlayHeader.className = 'site-nav-overlay-header';

  const overlayLogo = document.createElement('div');
  overlayLogo.className = 'site-nav-overlay-logo';
  overlayLogo.innerHTML = `
    <span class="site-nav-cube" aria-hidden="true"></span>
    <span>ASHWIN</span>
  `;

  const overlayCloseBtn = document.createElement('button');
  overlayCloseBtn.type = 'button';
  overlayCloseBtn.className = 'site-nav-overlay-close-btn';
  overlayCloseBtn.setAttribute('aria-label', 'Close navigation menu');
  overlayCloseBtn.innerHTML = `
    <span class="site-nav-close-symbol" aria-hidden="true">✕</span>
    <span>CLOSE</span>
  `;

  overlayHeader.appendChild(overlayLogo);
  overlayHeader.appendChild(overlayCloseBtn);
  overlay.appendChild(overlayHeader);

  const overlayContent = document.createElement('div');
  overlayContent.className = 'site-nav-overlay-content';

  // ── Build Navigation Links ──
  const navItems = [
    { id: 'skills', label: 'Skills', target: '#skills' },
    { id: 'hackathons', label: 'Hackathons', target: '#hackathons' },
    { id: 'domains', label: 'Domains', target: '#domains' },
    { id: 'achievements', label: 'Achievements', target: '#achievements' },
    { id: 'projects', label: 'Projects', target: '#projects' },
    { id: 'contact', label: 'Contact', target: '#contact' },
  ];

  const linkElements = {};

  navItems.forEach((item) => {
    // Desktop Link
    const link = document.createElement('a');
    link.href = item.target;
    link.className = 'site-nav-link';
    link.setAttribute('data-nav', item.id);
    link.textContent = item.label;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToTarget(item.target);
    });
    linksContainer.appendChild(link);

    // Mobile Link
    const mobileLink = document.createElement('a');
    mobileLink.href = item.target;
    mobileLink.className = 'site-nav-overlay-link';
    mobileLink.setAttribute('data-nav', item.id);
    mobileLink.textContent = item.label;
    mobileLink.addEventListener('click', (e) => {
      e.preventDefault();
      closeOverlay();
      scrollToTarget(item.target);
    });
    overlayContent.appendChild(mobileLink);

    linkElements[item.id] = { desktop: link, mobile: mobileLink };
  });

  let resumeLink = null;
  if (hasResume) {
    resumeLink = document.createElement('a');
    resumeLink.href = contactConfig.resume;
    resumeLink.className = 'site-nav-link';
    resumeLink.setAttribute('data-nav', 'resume');
    resumeLink.setAttribute('target', '_blank');
    resumeLink.setAttribute('rel', 'noopener noreferrer');
    resumeLink.setAttribute('download', '');
    resumeLink.textContent = 'Resume';
    rightDiv.appendChild(resumeLink);

    const mobileResumeLink = document.createElement('a');
    mobileResumeLink.href = contactConfig.resume;
    mobileResumeLink.className = 'site-nav-overlay-link';
    mobileResumeLink.setAttribute('data-nav', 'resume');
    mobileResumeLink.setAttribute('target', '_blank');
    mobileResumeLink.setAttribute('rel', 'noopener noreferrer');
    mobileResumeLink.setAttribute('download', '');
    mobileResumeLink.textContent = 'Resume';
    overlayContent.appendChild(mobileResumeLink);
  }

  // View Mode Switch Button (Toggles between Classic view and 3D View 🚀)
  const classicBtn = document.createElement('button');
  classicBtn.type = 'button';
  classicBtn.className = 'site-nav-btn site-nav-classic';
  classicBtn.textContent = 'Classic view';
  if (typeof window.setViewMode !== 'function') {
    classicBtn.style.display = 'none';
  }
  classicBtn.addEventListener('click', () => {
    const isClassic = document.getElementById('static-content')?.hasAttribute('hidden') === false;
    window.setViewMode?.(isClassic ? 'cinematic' : 'classic');
  });
  rightDiv.appendChild(classicBtn);

  const mobileClassicBtn = document.createElement('button');
  mobileClassicBtn.type = 'button';
  mobileClassicBtn.className = 'site-nav-btn site-nav-classic';
  mobileClassicBtn.textContent = 'Classic view';
  if (typeof window.setViewMode !== 'function') {
    mobileClassicBtn.style.display = 'none';
  }
  mobileClassicBtn.addEventListener('click', () => {
    closeOverlay();
    const isClassic = document.getElementById('static-content')?.hasAttribute('hidden') === false;
    window.setViewMode?.(isClassic ? 'cinematic' : 'classic');
  });
  overlayContent.appendChild(mobileClassicBtn);

  // Dedicated bottom exit button inside mobile menu
  const bottomExitBtn = document.createElement('button');
  bottomExitBtn.type = 'button';
  bottomExitBtn.className = 'site-nav-overlay-bottom-exit';
  bottomExitBtn.setAttribute('aria-label', 'Close menu');
  bottomExitBtn.innerHTML = `✕ Close Menu`;
  bottomExitBtn.addEventListener('click', closeOverlay);
  overlayContent.appendChild(bottomExitBtn);

  nav.appendChild(centerDiv);
  nav.appendChild(rightDiv);
  nav.appendChild(menuBtn);
  header.appendChild(nav);
  overlay.appendChild(overlayContent);
  header.appendChild(overlay);

  // Prepend to body as first child
  document.body.prepend(header);

  // ── Overlay Toggle Logic ──
  function openOverlay() {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.textContent = 'CLOSE';
    document.body.style.overflow = 'hidden';
    const lenis = navLenis || (typeof window !== 'undefined' && (window.__lenis || window.lenis));
    if (lenis && typeof lenis.stop === 'function') {
      lenis.stop();
    }
    overlayCloseBtn.focus();
  }

  function closeOverlay() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.textContent = 'MENU';
    document.body.style.overflow = '';
    const lenis = navLenis || (typeof window !== 'undefined' && (window.__lenis || window.lenis));
    if (lenis && typeof lenis.start === 'function') {
      lenis.start();
    }
  }

  menuBtn.addEventListener('click', () => {
    const isOpen = overlay.classList.contains('is-open');
    if (isOpen) {
      closeOverlay();
    } else {
      openOverlay();
    }
  });

  overlayCloseBtn.addEventListener('click', closeOverlay);

  // Close when clicking directly on overlay backdrop
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeOverlay();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
      closeOverlay();
    }
  });

  // Dynamic label sync for classic/3D mode in nav
  function syncNavModeLabels(mode) {
    const isClassic = mode === 'classic' || (document.getElementById('static-content')?.hasAttribute('hidden') === false);
    if (isClassic) {
      classicBtn.textContent = '3D View 🚀';
      classicBtn.setAttribute('title', 'Switch to 3D Cinematic View');
      mobileClassicBtn.textContent = '3D View 🚀';
      mobileClassicBtn.setAttribute('title', 'Switch to 3D Cinematic View');
    } else {
      classicBtn.textContent = 'Classic view';
      classicBtn.setAttribute('title', 'Switch to Static Classic View');
      mobileClassicBtn.textContent = 'Classic view';
      mobileClassicBtn.setAttribute('title', 'Switch to Static Classic View');
    }
  }
  window.__syncNavModeLabels = syncNavModeLabels;
  syncNavModeLabels();

  // ── Click Handlers for Navigation ──
  logoLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeOverlay();
    scrollToTarget(0);
  });

  // ── Active Link State Management ──
  let isContactActive = false;

  function setElementActive(el, active) {
    if (!el) return;
    if (active) {
      el.setAttribute('aria-current', 'true');
      el.classList.add('is-active');
    } else {
      el.removeAttribute('aria-current');
      el.classList.remove('is-active');
    }
  }

  function updateNavLine(activeKey) {
    if (!linksWrap) return;
    const pair = linkElements[activeKey];
    if (pair && pair.desktop) {
      const trackRect = linksWrap.getBoundingClientRect();
      const linkRect = pair.desktop.getBoundingClientRect();
      const leftOffset = Math.max(0, linkRect.left - trackRect.left);
      const width = linkRect.width;

      lineIndicator.style.left = `${Math.round(leftOffset)}px`;
      lineIndicator.style.width = `${Math.round(width)}px`;
      lineIndicator.classList.add('is-visible');

      const fillWidth = Math.min(trackRect.width, leftOffset + width);
      lineFill.style.width = `${Math.round(fillWidth)}px`;
    } else {
      lineIndicator.classList.remove('is-visible');
      if (window.scrollY < 120) {
        lineFill.style.width = '0px';
      }
    }
  }

  function setNavSectionActive(activeKey) {
    navItems.forEach((item) => {
      const isActive = item.id === activeKey;
      const pair = linkElements[item.id];
      if (pair) {
        setElementActive(pair.desktop, isActive);
        setElementActive(pair.mobile, isActive);
      }
    });
    updateNavLine(activeKey);
  }

  function updateActiveLinks() {
    const contactEl = document.getElementById('contact');
    let inContact = isContactActive;
    if (contactEl) {
      const rect = contactEl.getBoundingClientRect();
      const winH = window.innerHeight;
      if (rect.top < winH * 0.75 && rect.bottom > 50) {
        inContact = true;
      }
    }
    const docH = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    const maxScroll = docH - window.innerHeight;
    if (maxScroll > 0 && window.scrollY >= maxScroll - 60) {
      inContact = true;
    }

    if (inContact) {
      setNavSectionActive('contact');
      return;
    }

    // Check Projects (Moon scene)
    let isMoonActive = false;
    if (ScrollTrigger.getAll) {
      const moonST = ScrollTrigger.getAll().find(
        (st) => st.pin && (st.trigger === document.querySelector('#scene-moon') || st.vars?.id === 'moon3d-trigger')
      );
      if (moonST && typeof moonST.progress === 'number' && moonST.isActive) {
        const p = moonST.progress;
        if (p >= 0.12 && p <= 0.75) {
          isMoonActive = true;
        }
      }
    }

    if (isMoonActive) {
      setNavSectionActive('projects');
      return;
    }

    // Check Achievements (Space scene)
    let isSpaceActive = false;
    if (ScrollTrigger.getAll) {
      const spaceST = ScrollTrigger.getAll().find(
        (st) => st.pin && (st.trigger === document.querySelector('#scene-space') || st.vars?.id === 'space-trigger')
      );
      if (spaceST && spaceST.isActive) {
        isSpaceActive = true;
      }
    }

    if (isSpaceActive) {
      setNavSectionActive('achievements');
      return;
    }

    // Check City scene (Skills, Hackathons, Domains)
    if (ScrollTrigger.getAll) {
      const cityST = ScrollTrigger.getAll().find(
        (st) => st.pin && (
          st.trigger === document.querySelector('#scene-city') ||
          st.vars?.id === 'city3d-trigger' ||
          st.vars?.id === 'city-trigger'
        )
      );
      if (cityST && cityST.isActive && typeof cityST.progress === 'number') {
        const is3D = cityST.vars?.id === 'city3d-trigger';
        const cityLen = CONFIG.scrollLengths?.city || 350;
        const irisLen = CONFIG.scrollLengths?.irisLen ?? 110;
        const total = is3D ? (cityLen + irisLen) : cityLen;
        const pCity = (cityST.progress * total) / cityLen;

        if (pCity < 0.36) {
          setNavSectionActive('skills');
          return;
        } else if (pCity < 0.58) {
          setNavSectionActive('hackathons');
          return;
        } else if (pCity <= 0.88) {
          setNavSectionActive('domains');
          return;
        }
      }
    }

    // Static mode active tracking
    const staticContent = document.getElementById('static-content');
    if (staticContent && !staticContent.hasAttribute('hidden')) {
      const staticSecs = [
        { id: 'projects', el: document.getElementById('static-projects') },
        { id: 'achievements', el: document.getElementById('static-achievements') },
        { id: 'hackathons', el: document.getElementById('static-hackathons') },
        { id: 'skills', el: document.getElementById('static-skills') },
        { id: 'domains', el: document.getElementById('static-domains') },
      ];
      for (const item of staticSecs) {
        if (item.el) {
          const r = item.el.getBoundingClientRect();
          if (r.top <= window.innerHeight * 0.45 && r.bottom >= 60) {
            setNavSectionActive(item.id);
            return;
          }
        }
      }
    }

    setNavSectionActive(null);
  }

  // IntersectionObserver for #contact (at least 30% in view)
  const contactEl = document.getElementById('contact');
  if (contactEl && typeof IntersectionObserver !== 'undefined') {
    const contactObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isContactActive = entry.isIntersecting && entry.intersectionRatio >= 0.3;
          updateActiveLinks();
        });
      },
      { threshold: [0, 0.3, 0.5, 0.8] }
    );
    contactObserver.observe(contactEl);
  }

  // ── Scroll & Resize Listener ──
  let progressRaf = null;

  function onScrollOrResize() {
    if (!progressRaf) {
      progressRaf = requestAnimationFrame(() => {
        progressRaf = null;
        updateActiveLinks();
      });
    }
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });

  if (lenisInstance && typeof lenisInstance.on === 'function') {
    lenisInstance.on('scroll', onScrollOrResize);
  }

  ScrollTrigger.addEventListener('refresh', onScrollOrResize);
  ScrollTrigger.addEventListener('scrollEnd', onScrollOrResize);

  // Initial update
  updateActiveLinks();

  // ── Fade In After Loader Dismiss ──
  const loader = document.getElementById('loader');
  if (!loader || loader.classList.contains('hide') || loader.style.display === 'none') {
    header.classList.add('is-visible');
  } else {
    const obs = new MutationObserver(() => {
      if (loader.classList.contains('hide') || loader.style.display === 'none') {
        header.classList.add('is-visible');
        obs.disconnect();
      }
    });
    obs.observe(loader, { attributes: true, attributeFilter: ['class', 'style'] });
    setTimeout(() => {
      header.classList.add('is-visible');
      obs.disconnect();
    }, 1200);
  }

  // Check periodically if window.setViewMode becomes available later
  if (typeof window.setViewMode !== 'function') {
    const checkViewMode = setInterval(() => {
      if (typeof window.setViewMode === 'function') {
        classicBtn.style.display = '';
        mobileClassicBtn.style.display = '';
        clearInterval(checkViewMode);
      }
    }, 500);
  }
}
