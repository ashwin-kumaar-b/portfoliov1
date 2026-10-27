// ============================================================
// flip.js — Scene 2: Grid of tiles that flip right-to-left
//           to reveal the yellow background of Scene 3
// ============================================================
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from '../config.js';

export function initFlip() {
  const section = document.getElementById('scene-flip');
  const grid    = document.getElementById('flip-grid');
  if (!section || !grid) return;

  // ── Grid dimensions (responsive) ──
  const isMobile = window.innerWidth < CONFIG.flip.breakpoint;
  const cols = isMobile ? CONFIG.flip.colsMobile : CONFIG.flip.colsDesktop;
  const rows = isMobile ? CONFIG.flip.rowsMobile : CONFIG.flip.rowsDesktop;

  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;

  // ── Create tiles ──
  const inners = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile  = document.createElement('div');
      tile.className = 'flip-tile';

      const inner = document.createElement('div');
      inner.className = 'flip-tile-inner';
      inner.dataset.col = c;
      inner.dataset.row = r;

      const front = document.createElement('div');
      front.className = 'flip-tile-front';

      const back = document.createElement('div');
      back.className = 'flip-tile-back';

      inner.appendChild(front);
      inner.appendChild(back);
      tile.appendChild(inner);
      grid.appendChild(tile);

      inners.push(inner);
    }
  }

  // ── ScrollTrigger timeline ──
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${window.innerHeight * CONFIG.scrollLengths.flip / 100}`,
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });

  // Flip tiles with right-to-left stagger.
  // Custom stagger: rightmost column flips first, small row offset for organic feel.
  tl.to(inners, {
    rotateY: 180,
    duration: 1,
    ease: 'power1.inOut',
    stagger: {
      each: 0.015,
      grid: [rows, cols],
      axis: 'x',
      from: 'end',    // rightmost → leftmost
    },
  });
}
