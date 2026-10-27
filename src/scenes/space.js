// ============================================================
// space.js — Deep Space Achievements & Constellations
// ============================================================

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from '../config.js';
import achievementsData from '../../data/achievements.json';

/**
 * Seeded PRNG for stable, deterministic generation across renders.
 * @param {number} seed
 */
function createPRNG(seed) {
  let s = (seed || 123456789) >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp(val, min = 0, max = 1) {
  return Math.min(max, Math.max(min, val));
}

function easeInOut(t) {
  const c = clamp(t, 0, 1);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/**
 * Draw 5-pointed star helper.
 */
function drawStar(ctx, cx, cy, spikes = 5, outerRadius = 5, innerRadius = 2.5) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

export function initSpace() {
  const section = document.getElementById('scene-space');
  if (!section) return;

  const achievements = Array.isArray(achievementsData) ? achievementsData : [];
  const N = achievements.length || 1;

  // Clear existing content and set basic styles
  section.innerHTML = '';
  section.style.background = '#000000';
  section.style.position = 'relative';
  section.style.height = '100svh';
  section.style.overflow = 'hidden';

  // 1. Header: // MISSION LOG
  const headerLabel = document.createElement('div');
  headerLabel.className = 'space-mission-log';
  headerLabel.textContent = '// MISSION LOG';
  headerLabel.setAttribute('aria-hidden', 'true');
  section.appendChild(headerLabel);

  // 2. Canvas for Starfield & Constellations
  const canvas = document.createElement('canvas');
  canvas.className = 'space-canvas';
  section.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // 3. Real DOM Cards
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'space-cards-container';
  section.appendChild(cardsContainer);

  const cardEls = achievements.map((item, i) => {
    const card = document.createElement('div');
    card.className = 'space-card';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = `
      <div class="space-card-corner corner-tl" aria-hidden="true"></div>
      <div class="space-card-corner corner-tr" aria-hidden="true"></div>
      <div class="space-card-corner corner-bl" aria-hidden="true"></div>
      <div class="space-card-corner corner-br" aria-hidden="true"></div>
      <div class="space-card-num">// ACHIEVEMENT 0${i + 1}</div>
      <h3 class="space-card-title">${item.title || 'Achievement title'}</h3>
      <p class="space-card-detail">${item.detail || 'One line of context'}</p>
      <div class="space-card-tag-wrapper">
        <span class="space-card-tag">${item.tag || 'Hackathon'}</span>
      </div>
    `;
    cardsContainer.appendChild(card);
    return card;
  });

  // 4. Generate Starfield data (360 stars max, seeded)
  const starRNG = createPRNG(424242);
  const depthOptions = [0.3, 0.6, 1.0];
  const allStars = [];
  for (let i = 0; i < 360; i++) {
    allStars.push({
      x: starRNG(),
      y: starRNG(),
      depth: depthOptions[Math.floor(starRNG() * 3)],
      radius: 0.6 + starRNG() * (1.3 - 0.6),
      alpha: 0.4 + starRNG() * (1.0 - 0.4),
    });
  }

  // 5. Precompute Constellation Geometries relative to viewport
  let constellations = [];
  let width = 0;
  let height = 0;
  let dpr = 1;

  function updateDimensions() {
    width = section.clientWidth || window.innerWidth;
    height = section.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const R = 0.12 * width;
    const isNarrow = width < 768;

    constellations = achievements.map((_, i) => {
      const rng = createPRNG(1001 + i * 555);
      const anchorX = (i % 2 === 0 ? 0.28 : 0.72) * width;
      const anchorY = 0.5 * height;

      // 6 points around anchor
      const points = [];
      for (let k = 0; k < 6; k++) {
        const baseAngle = (k / 6) * Math.PI * 2;
        const angle = baseAngle + (rng() - 0.5) * 0.4;
        const r = R * (0.35 + rng() * 0.65);
        points.push({
          x: anchorX + Math.cos(angle) * r,
          y: anchorY + Math.sin(angle) * r,
        });
      }

      // Precalculate segment lengths & cumulative distances
      const segLengths = [];
      const cumDist = [0];
      let totalLen = 0;
      for (let k = 0; k < points.length - 1; k++) {
        const d = Math.hypot(points[k + 1].x - points[k].x, points[k + 1].y - points[k].y);
        segLengths.push(d);
        totalLen += d;
        cumDist.push(totalLen);
      }

      return {
        anchorX,
        anchorY,
        points,
        segLengths,
        cumDist,
        totalLen,
      };
    });

    // Position DOM cards beside anchors facing center
    cardEls.forEach((card, i) => {
      if (isNarrow) {
        card.style.left = '50%';
        card.style.right = 'auto';
      } else {
        if (i % 2 === 0) {
          card.style.left = `${Math.round(0.28 * width + 48)}px`;
          card.style.right = 'auto';
        } else {
          card.style.right = `${Math.round(width - 0.72 * width + 48)}px`;
          card.style.left = 'auto';
        }
      }
    });
  }

  // Tracking progress for streak calculation
  let lastProgress = 0;

  /**
   * Draw the entire scene on-demand.
   * @param {number} progress
   */
  function drawScene(progress) {
    if (!ctx || width === 0 || height === 0) return;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // ── Header (MISSION LOG) visibility (0.04 to 0.96) ──
    const isHeaderVisible = progress >= 0.04 && progress <= 0.96;
    headerLabel.style.opacity = isHeaderVisible ? '1' : '0';
    headerLabel.setAttribute('aria-hidden', isHeaderVisible ? 'false' : 'true');

    // ── 1. Starfield ──
    const dProgress = progress - lastProgress;
    lastProgress = progress;

    const numStars = width < 768 ? 200 : 360;
    const speedStreak = clamp(Math.abs(dProgress) * 120, 0, 1);

    for (let i = 0; i < numStars; i++) {
      const star = allStars[i];
      const sy = (((star.y - progress * 1.2 * star.depth) % 1 + 1) % 1) * height;
      const sx = star.x * width;
      const streakLength = 1 + 14 * speedStreak * star.depth;

      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.strokeStyle = `rgba(255, 255, 255, ${star.alpha})`;

      if (streakLength <= 1.2) {
        ctx.beginPath();
        ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.lineWidth = star.radius * 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + streakLength);
        ctx.stroke();
      }
    }

    // ── 2. Constellations & Cards ──
    const isNarrow = width < 768;

    for (let i = 0; i < N; i++) {
      const constel = constellations[i];
      const card = cardEls[i];
      if (!constel || !card) continue;

      const w0 = (i + 0.05) / N;
      const w1 = (i + 0.95) / N;
      const local = clamp((progress - w0) / (w1 - w0), 0, 1);

      // Card opacity and slide animation:
      // 0 below 0.35, 1 at 0.5, stays 1 until 0.8, 0 at 0.9, with a 20px slide
      let cardOpacity = 0;
      let slideY = 0;

      if (local < 0.35) {
        cardOpacity = 0;
        slideY = 20;
      } else if (local < 0.5) {
        const t = (local - 0.35) / 0.15;
        cardOpacity = t;
        slideY = 20 * (1 - t);
      } else if (local <= 0.8) {
        cardOpacity = 1;
        slideY = 0;
      } else if (local < 0.9) {
        const t = (local - 0.8) / 0.1;
        cardOpacity = 1 - t;
        slideY = -20 * t;
      } else {
        cardOpacity = 0;
        slideY = -20;
      }

      // Update Card DOM
      if (cardOpacity <= 0) {
        card.style.opacity = '0';
        card.style.visibility = 'hidden';
        card.setAttribute('aria-hidden', 'true');
      } else {
        card.style.opacity = cardOpacity.toFixed(3);
        card.style.visibility = 'visible';
        card.setAttribute('aria-hidden', 'false');
        if (isNarrow) {
          card.style.transform = `translate(-50%, calc(-50% + ${slideY.toFixed(1)}px))`;
        } else {
          card.style.transform = `translateY(calc(-50% + ${slideY.toFixed(1)}px))`;
        }
      }

      // Constellation Canvas Rendering
      // Fade out for local > 0.85
      const fadeAlpha = local > 0.85 ? clamp(1 - (local - 0.85) / 0.15, 0, 1) : 1;

      if (fadeAlpha > 0 && local > 0 && local < 1) {
        const { anchorX, anchorY, points, cumDist, totalLen } = constel;

        // Progressive line drawing: easeInOut(local / 0.5)
        const lineFrac = easeInOut(local / 0.5);
        let targetDist = lineFrac * totalLen;

        // Draw lines
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.5 * fadeAlpha).toFixed(3)})`;
        ctx.lineWidth = 1;

        let distRem = targetDist;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let j = 0; j < points.length - 1; j++) {
          const p1 = points[j];
          const p2 = points[j + 1];
          const segD = Math.hypot(p2.x - p1.x, p2.y - p1.y);

          if (distRem >= segD) {
            ctx.lineTo(p2.x, p2.y);
            distRem -= segD;
          } else if (distRem > 0) {
            const f = distRem / segD;
            ctx.lineTo(p1.x + (p2.x - p1.x) * f, p1.y + (p2.y - p1.y) * f);
            distRem = 0;
            break;
          } else {
            break;
          }
        }
        ctx.stroke();

        // Draw points: 3px dots that light up as line reaches them
        for (let k = 0; k < points.length; k++) {
          const pt = points[k];
          const isLit = targetDist >= cumDist[k];
          ctx.beginPath();
          if (isLit) {
            ctx.fillStyle = `rgba(255, 255, 255, ${(1.0 * fadeAlpha).toFixed(3)})`;
            ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${(0.25 * fadeAlpha).toFixed(3)})`;
            ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
          }
          ctx.fill();
        }

        // Draw Anchor: 5px yellow (#FFD400) star with soft 10px glow
        ctx.shadowColor = '#FFD400';
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(255, 212, 0, ${fadeAlpha.toFixed(3)})`;
        drawStar(ctx, anchorX, anchorY, 5, 5, 2.5);
        ctx.fill();
        ctx.restore();

        // Draw thin connector line from anchor to card
        if (cardOpacity > 0) {
          ctx.save();
          ctx.strokeStyle = `rgba(255, 212, 0, ${(0.4 * cardOpacity * fadeAlpha).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(anchorX, anchorY);
          const connTargetX = isNarrow
            ? (i % 2 === 0 ? anchorX + 32 : anchorX - 32)
            : (i % 2 === 0 ? anchorX + 48 : anchorX - 48);
          ctx.lineTo(connTargetX, anchorY);
          ctx.stroke();

          // Terminal dot
          ctx.fillStyle = `rgba(255, 212, 0, ${(0.7 * cardOpacity * fadeAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(connTargetX, anchorY, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  // Initialize dimensions & render initial frame
  updateDimensions();
  drawScene(0);

  // Resize handler
  function onResize() {
    updateDimensions();
    drawScene(lastProgress);
  }
  window.addEventListener('resize', onResize);

  // 6. ScrollTrigger Setup (Pinned, 260vh)
  const spaceLen = CONFIG.scrollLengths?.space || 260;

  const st = ScrollTrigger.create({
    id: 'space-trigger',
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * spaceLen / 100}`,
    pin: true,
    scrub: true,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      drawScene(self.progress);
    },
    onRefresh: () => {
      updateDimensions();
      drawScene(lastProgress);
    },
  });

  return function disposeSpace() {
    window.removeEventListener('resize', onResize);
    st?.kill();
    section.innerHTML = '';
  };
}
