// ============================================================
// transitions.js — Reusable Scene Transition Helpers & Boundaries
// Provides Scrub-driven GSAP transition effects:
// 1. addFlash: Fullscreen brightness/color flash overlay
// 2. addCollapseToLine: Geometric line-collapse morph
// 3. addColorDrain: Proxy-driven grayscale CSS filter drain
// 4. addBarWipe: Horizontal staggered bar wipe
// 5. getSceneTrigger: Lookup pinned ScrollTrigger by selector
// 6. createBoundary: Standalone boundary ScrollTrigger with overlap
// 7. getOverlay: Reusable fixed overlay manager with data-overlay
// 8. initBoundaries: Lifecycle helper running on window load
// All helpers are reversible for ScrollTrigger scrubbing.
// ============================================================
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Singleton DOM overlay references
let barWipeContainer = null;

/**
 * Creates or reuses a fixed full-screen div with data-overlay=id.
 * Configured with pointer-events: none, opacity: 0, and background color.
 *
 * @param {string} id - Identifier stored in data-overlay attribute.
 * @param {Object} [options={}] - Overlay options.
 * @param {string} [options.color] - Background color.
 * @param {number} [options.zIndex=9000] - CSS z-index stack position.
 * @returns {HTMLDivElement|null} The overlay element.
 */
export function getOverlay(id, { color, zIndex = 9000 } = {}) {
  if (typeof document === 'undefined') return null;

  let overlay = document.querySelector(`[data-overlay="${id}"]`);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.setAttribute('data-overlay', id);
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0';
    overlay.style.zIndex = String(zIndex);
    if (color) overlay.style.backgroundColor = color;
    document.body.appendChild(overlay);
  } else {
    if (zIndex !== undefined) overlay.style.zIndex = String(zIndex);
    if (color) overlay.style.backgroundColor = color;
  }

  return overlay;
}

/**
 * Creates or reuses a single full-screen fixed overlay div for flash transitions.
 * @returns {HTMLDivElement|null}
 */
function getOrCreateFlashOverlay() {
  return getOverlay('flash', { zIndex: 9000 });
}

/**
 * Creates or reuses a fixed container with horizontal bars for bar wipe transitions.
 * @param {number} barCount - Number of horizontal bars.
 * @param {string} barColor - Color of the bars.
 * @returns {{ container: HTMLDivElement, bars: HTMLDivElement[] } | null}
 */
function getOrCreateBarWipe(barCount, barColor) {
  if (typeof document === 'undefined') return null;
  if (!barWipeContainer) {
    barWipeContainer = document.getElementById('transition-bar-wipe-container');
  }
  if (!barWipeContainer) {
    barWipeContainer = document.createElement('div');
    barWipeContainer.id = 'transition-bar-wipe-container';
    barWipeContainer.setAttribute('data-overlay', 'bar-wipe');
    barWipeContainer.style.position = 'fixed';
    barWipeContainer.style.inset = '0';
    barWipeContainer.style.width = '100vw';
    barWipeContainer.style.height = '100vh';
    barWipeContainer.style.pointerEvents = 'none';
    barWipeContainer.style.zIndex = '9000';
    barWipeContainer.style.display = 'flex';
    barWipeContainer.style.flexDirection = 'column';
    barWipeContainer.style.overflow = 'hidden';
    document.body.appendChild(barWipeContainer);
  }

  let bars = Array.from(barWipeContainer.querySelectorAll('.transition-bar-wipe-bar'));
  if (bars.length !== barCount) {
    barWipeContainer.innerHTML = '';
    bars = [];
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'transition-bar-wipe-bar';
      bar.style.flex = '1';
      bar.style.width = '100%';
      bar.style.backgroundColor = barColor;
      bar.style.transform = 'scaleX(0)';
      bar.style.transformOrigin = 'left center';
      bar.style.willChange = 'transform';
      barWipeContainer.appendChild(bar);
      bars.push(bar);
    }
  } else {
    for (let i = 0; i < bars.length; i++) {
      bars[i].style.backgroundColor = barColor;
    }
  }

  return { container: barWipeContainer, bars };
}

/**
 * Adds a full-screen flash transition to a GSAP timeline.
 * Creates or reuses one fixed overlay div (pointer-events none, z-index 9000)
 * and tweens its opacity from 0 to peak to 0, reaching the peak exactly at half duration.
 *
 * @param {gsap.core.Timeline} tl - The GSAP timeline to append tweens to.
 * @param {number|string} at - Timeline insertion position (time or label).
 * @param {Object} [options={}] - Transition configuration options.
 * @param {string} [options.color='#ffffff'] - Flash overlay background color.
 * @param {number} [options.peak=1] - Maximum opacity value at peak (0 to 1).
 * @param {number} [options.duration=0.2] - Total duration of the flash effect.
 * @returns {gsap.core.Timeline} The timeline instance for chaining.
 */
export function addFlash(tl, at, { color = '#ffffff', peak = 1, duration = 0.2 } = {}) {
  const overlay = getOrCreateFlashOverlay();
  if (!overlay) return tl;

  const half = duration / 2;

  // Ramp from 0 up to peak opacity at the midpoint
  tl.fromTo(
    overlay,
    { opacity: 0, backgroundColor: color },
    { opacity: peak, duration: half, ease: 'power1.in' },
    at
  );

  // Ramp down from peak opacity back to 0
  tl.to(
    overlay,
    { opacity: 0, duration: half, ease: 'power1.out' },
    '>'
  );

  return tl;
}

/**
 * Collapses an element down to a thin line along an axis (X or Y).
 * For axis 'x', tweens scaleX down to thickness / element's width from 'center'.
 * For axis 'y', tweens scaleY down to thickness / element's height from 'center'.
 * At the end, retains the element as a thin line unless fadeOut is true.
 *
 * @param {gsap.core.Timeline} tl - The GSAP timeline to append tweens to.
 * @param {number|string} at - Timeline insertion position (time or label).
 * @param {Element|string} el - Target DOM element or query selector string.
 * @param {Object} [options={}] - Configuration options.
 * @param {'x'|'y'} [options.axis='x'] - Axis along which to collapse ('x' or 'y').
 * @param {number} [options.duration=0.6] - Total duration of the collapse tween.
 * @param {number} [options.thickness=4] - Final line thickness in pixels.
 * @param {boolean} [options.fadeOut=false] - Whether to fade out the line at completion.
 * @returns {gsap.core.Timeline} The timeline instance for chaining.
 */
export function addCollapseToLine(tl, at, el, { axis = 'x', duration = 0.6, thickness = 4, fadeOut = false } = {}) {
  const target = typeof el === 'string' ? document.querySelector(el) : el;
  if (!target) return tl;

  const isY = axis === 'y';
  const prop = isY ? 'scaleY' : 'scaleX';

  const computeScale = () => {
    const size = isY
      ? (target.offsetHeight || target.getBoundingClientRect().height || 100)
      : (target.offsetWidth || target.getBoundingClientRect().width || 100);
    return Math.min(1, thickness / Math.max(1, size));
  };

  tl.fromTo(
    target,
    {
      [prop]: 1,
      transformOrigin: 'center center',
    },
    {
      [prop]: computeScale,
      duration,
      ease: 'power2.inOut',
      transformOrigin: 'center center',
    },
    at
  );

  if (fadeOut) {
    tl.to(
      target,
      {
        opacity: 0,
        duration: duration * 0.25,
        ease: 'power1.out',
      },
      '>'
    );
  }

  return tl;
}

/**
 * Tweens a CSS filter on an element from grayscale(from) to grayscale(to).
 * Uses a proxy object and onUpdate callback so scrubbing in reverse restores color.
 * When the grayscale value is 0, sets the filter to 'none' to eliminate GPU filter overhead.
 *
 * @param {gsap.core.Timeline} tl - The GSAP timeline to append tweens to.
 * @param {number|string} at - Timeline insertion position (time or label).
 * @param {Element|string} el - Target DOM element or query selector string.
 * @param {Object} [options={}] - Configuration options.
 * @param {number} [options.duration=1] - Duration of the color drain tween.
 * @param {number} [options.from=0] - Starting grayscale value (0 = full color, 1 = full gray).
 * @param {number} [options.to=1] - Target grayscale value (0 = full color, 1 = full gray).
 * @returns {gsap.core.Timeline} The timeline instance for chaining.
 */
export function addColorDrain(tl, at, el, { duration = 1, from = 0, to = 1 } = {}) {
  const target = typeof el === 'string' ? document.querySelector(el) : el;
  if (!target) return tl;

  const proxy = { val: from };

  const updateFilter = () => {
    if (Math.abs(proxy.val) <= 0.0001) {
      target.style.filter = 'none';
    } else {
      target.style.filter = `grayscale(${proxy.val.toFixed(4)})`;
    }
  };

  tl.fromTo(
    proxy,
    { val: from },
    {
      val: to,
      duration,
      ease: 'power1.inOut',
      onUpdate: updateFilter,
    },
    at
  );

  return tl;
}

/**
 * Creates or reuses a container of horizontal bars that wipe across the screen.
 * The bars scale from 0 to 1 in X with a stagger from the left, then back to 0 from the right.
 * Reversible during reverse scrubbing via paired symmetric GSAP fromTo tweens.
 *
 * @param {gsap.core.Timeline} tl - The GSAP timeline to append tweens to.
 * @param {number|string} at - Timeline insertion position (time or label).
 * @param {Object} [options={}] - Configuration options.
 * @param {number} [options.bars=8] - Number of horizontal stripes.
 * @param {string} [options.color='#FFD400'] - Background color of the wipe bars.
 * @param {number} [options.duration=0.6] - Total duration of the wipe in and out.
 * @returns {gsap.core.Timeline} The timeline instance for chaining.
 */
export function addBarWipe(tl, at, { bars = 8, color = '#FFD400', duration = 0.6 } = {}) {
  const wipeData = getOrCreateBarWipe(bars, color);
  if (!wipeData) return tl;

  const { bars: barElements } = wipeData;
  const count = barElements.length;
  const half = duration / 2;

  // Stagger distribution: allocate 40% of each half to stagger, 60% to individual bar motion
  const staggerTime = count > 1 ? (half * 0.4) / (count - 1) : 0;
  const singleBarDur = half - (count - 1) * staggerTime;

  // Phase 1: Wipe in from left (scaleX 0 -> 1)
  tl.fromTo(
    barElements,
    {
      scaleX: 0,
      transformOrigin: 'left center',
      backgroundColor: color,
    },
    {
      scaleX: 1,
      duration: singleBarDur,
      ease: 'power2.inOut',
      stagger: staggerTime,
      transformOrigin: 'left center',
    },
    at
  );

  // Phase 2: Wipe out to right (scaleX 1 -> 0 from opposite side)
  tl.fromTo(
    barElements,
    {
      scaleX: 1,
      transformOrigin: 'right center',
      backgroundColor: color,
    },
    {
      scaleX: 0,
      duration: singleBarDur,
      ease: 'power2.inOut',
      stagger: staggerTime,
      transformOrigin: 'right center',
    },
    '>'
  );

  return tl;
}

/**
 * Returns the pinned ScrollTrigger instance associated with a selector.
 * Logs a console warning and returns null if not found.
 *
 * @param {string} selector - CSS selector matching the pinned element.
 * @returns {ScrollTrigger|null} The matching pinned ScrollTrigger instance.
 */
export function getSceneTrigger(selector) {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  const st = ScrollTrigger.getAll().find((trigger) => trigger.pin && trigger.trigger === el);
  if (!st) {
    console.warn(`[transitions] getSceneTrigger: pinned ScrollTrigger not found for selector "${selector}"`);
    return null;
  }
  return st;
}

/**
 * Creates a standalone boundary ScrollTrigger between two scenes.
 * Overlaps the transition window and scrubs a paused GSAP timeline of duration 1.
 *
 * @param {Object} options - Boundary configuration options.
 * @param {string} [options.id] - Identifier for the ScrollTrigger.
 * @param {string} options.from - Selector for the outgoing scene.
 * @param {string|null} [options.to=null] - Selector for the incoming scene.
 * @param {number} [options.before=0.1] - Overlap fraction of the outgoing scene's scroll distance.
 * @param {Function} options.build - Function (tl, { fromEl, toEl, id }) populating the timeline.
 * @returns {ScrollTrigger|null} The created ScrollTrigger instance.
 */
export function createBoundary({ id, from, to = null, before = 0.1, build }) {
  const fromST = getSceneTrigger(from);
  const toST = to ? getSceneTrigger(to) : null;

  if (!fromST) {
    console.warn(`[transitions] createBoundary: cannot create boundary, fromST missing for "${from}"`);
    return null;
  }

  const fromEl = typeof document !== 'undefined' ? document.querySelector(from) : null;
  const toEl = to && typeof document !== 'undefined' ? document.querySelector(to) : null;

  const tl = gsap.timeline({ paused: true });

  if (typeof build === 'function') {
    build(tl, { fromEl, toEl, id });
  }

  // Ensure timeline duration is at least 1.0 so fractions of 1 map across the full boundary
  if (tl.duration() < 1) {
    tl.set({}, {}, 1);
  }

  const st = ScrollTrigger.create({
    id,
    trigger: typeof document !== 'undefined' ? document.body : undefined,
    animation: tl,
    scrub: true,
    invalidateOnRefresh: true,
    start: () => fromST.end - before * (fromST.end - fromST.start),
    end: () => (toST ? toST.start : fromST.end),
  });

  return st;
}

/**
 * Lifecycle helper that invokes fn() once on window load, after ScrollTrigger.refresh().
 *
 * @param {Function} fn - Boundary setup callback.
 */
export function initBoundaries(fn) {
  if (typeof window === 'undefined') return;

  const onWindowLoad = () => {
    ScrollTrigger.refresh();
    if (typeof fn === 'function') {
      fn();
    }
  };

  if (document.readyState === 'complete') {
    onWindowLoad();
  } else {
    window.addEventListener('load', onWindowLoad, { once: true });
  }
}
