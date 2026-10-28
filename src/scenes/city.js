// ============================================================
// city.js — Scene 4: Top-Down City Chase
//           Strict Rules:
//           1. Grid layout (blocks with 40px alleys, 1-3 non-overlapping buildings)
//           2. Perspective tilt on whole city plane (1000px, rotX 50deg, rotZ -6deg)
//           3. Buildings: solid dark top, 1px neon outline (70%), extruded wall down-left (10-18px), 1-2 roof details
//           4. Color code: Magenta (#FF2A6D) north, Cyan (#05D9E8) south. Yellow ONLY on runner/trail/callout
//           5. Road: #101012 asphalt, 50% yellow dashed center, 1px magenta & cyan curbs with 10px glow, neon reflections
//           6. Reduced noise: 3 crisp car streaks (2px high, 60-120px), rain (22 streaks @ 8%), scanlines (0.02), speed lines (8, behind buildings, velocity-driven)
//           7. Depth: exactly two layers (far layer: smaller, 35% darker, slower; near layer)
//           8. Preserved cube runner, chromatic trail, and untilted HUD callouts
// ============================================================
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from '../config.js';

gsap.registerPlugin(ScrollTrigger);

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── Tuning Constants ──
export const CITY_CLONE_COUNT = 14;         // Number of static afterimage clones
export const CAMERA_PUNCH_SPAN = 0.04;      // ~250ms equivalent scroll distance
export const CAMERA_PUNCH_MAX = 1.06;       // Peak scale on callout punch

// Sandevistan Chromatic Palette (Neon Cyan -> Violet -> Neon Magenta, matching Edgerunners reference)
export const CITY_CLONE_PALETTE = [
  '#05D9E8', // 0: Neon Cyan (start / farthest back)
  '#00C8F8', // 1: Sky Cyan
  '#00A3FF', // 2: Electric Blue
  '#2563EB', // 3: Cobalt Blue
  '#4F46E5', // 4: Indigo
  '#6366F1', // 5: Iris Blue
  '#7C3AED', // 6: Deep Violet
  '#9333EA', // 7: Purple
  '#A855F7', // 8: Bright Purple
  '#C026D3', // 9: Fuchsia
  '#DB2777', // 10: Deep Pink
  '#E11D48', // 11: Ruby Rose
  '#F43F5E', // 12: Bright Rose
  '#FF2A6D', // 13: Neon Magenta (closest to runner)
];

/**
 * Deterministic pseudo-random generator based on index and seed.
 */
function seededRand(index, seed = 1) {
  const val = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123;
  return val - Math.floor(val);
}

/**
 * Helper to calculate callout opacity, translateY, and visibility.
 */
function getCalloutState(progress, appearProgress, customDuration = null) {
  const fadeInSpan = 0.05;
  const totalDuration = customDuration || 0.22;
  const fadeOutSpan = 0.05;

  const start = appearProgress;
  const fadeInEnd = start + fadeInSpan;
  const fadeOutStart = start + totalDuration - fadeOutSpan;
  const end = start + totalDuration;

  if (progress < start) {
    return { opacity: 0, translateY: 14, visible: false };
  }
  if (progress > end) {
    return { opacity: 0, translateY: -14, visible: false };
  }

  let opacity = 1;
  let translateY = 0;

  if (progress < fadeInEnd) {
    const t = (progress - start) / fadeInSpan;
    opacity = t;
    translateY = 14 * (1 - t);
  } else if (progress > fadeOutStart) {
    const t = (progress - fadeOutStart) / fadeOutSpan;
    opacity = 1 - t;
    translateY = -14 * t;
  }

  return { opacity, translateY, visible: true };
}

/**
 * Helper to construct solid cubes (runner and afterimage clones).
 */
function createSquareRunnerShape(isClone = false, color = '#FFD400') {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', isClone ? 'city-clone-shape' : 'city-runner-shape');

  const cube = document.createElementNS(SVG_NS, 'rect');
  cube.setAttribute('x', '-13');
  cube.setAttribute('y', '-13');
  cube.setAttribute('width', '26');
  cube.setAttribute('height', '26');
  cube.setAttribute('rx', '0');
  cube.setAttribute('fill', color);
  g.appendChild(cube);

  return { root: g };
}

export function initCity() {
  const section = document.getElementById('scene-city');
  if (!section) return;

  // Kill existing trigger if re-initialized
  ScrollTrigger.getById('city-trigger')?.kill();

  // Reset section
  section.innerHTML = '';
  section.style.background = '#060606';
  section.style.position = 'relative';
  section.style.overflow = 'hidden';

  const w = window.innerWidth;
  const h = window.innerHeight;
  const totalWidth = Math.max(w * 2.4, 3400);

  // Central street corridor parameters
  const baseY = h * 0.5;
  const roadHalfH = 48;
  const streetTop = baseY - roadHalfH;
  const streetBottom = baseY + roadHalfH;

  // ── 1. Create Tilted City Plane (perspective 1000px, rotX 50deg, rotZ -6deg) ──
  const cityPlane = document.createElement('div');
  cityPlane.className = 'city-plane';
  cityPlane.style.position = 'absolute';
  cityPlane.style.left = '-20%';
  cityPlane.style.top = '-20%';
  cityPlane.style.width = '140%';
  cityPlane.style.height = '140%';
  cityPlane.style.transformStyle = 'preserve-3d';
  cityPlane.style.transform = 'perspective(1000px) rotateX(50deg) rotateZ(-6deg)';
  cityPlane.style.transformOrigin = '50% 50%';
  cityPlane.style.willChange = 'transform';
  cityPlane.style.pointerEvents = 'none';

  // SVG inside the tilted plane
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.position = 'absolute';
  svg.style.inset = '0';
  svg.style.overflow = 'visible';
  svg.style.pointerEvents = 'none';
  cityPlane.appendChild(svg);
  section.appendChild(cityPlane);

  // ── 2. SVG Defs (Strict filter specs: 8px neon signs, 10px curbs, scanlines 0.02) ──
  const defs = document.createElementNS(SVG_NS, 'defs');

  // Sign glow filters: soft 8px glow (stdDeviation 4)
  const signGlows = [
    { id: 'neon-cyan-glow-8px', color: '#05D9E8' },
    { id: 'neon-magenta-glow-8px', color: '#FF2A6D' },
  ];
  signGlows.forEach(({ id, color }) => {
    const f = document.createElementNS(SVG_NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('x', '-50%');
    f.setAttribute('y', '-50%');
    f.setAttribute('width', '200%');
    f.setAttribute('height', '200%');
    const drop = document.createElementNS(SVG_NS, 'feDropShadow');
    drop.setAttribute('dx', '0');
    drop.setAttribute('dy', '0');
    drop.setAttribute('stdDeviation', '4'); // 8px total spread
    drop.setAttribute('flood-color', color);
    drop.setAttribute('flood-opacity', '0.75');
    f.appendChild(drop);
    defs.appendChild(f);
  });

  // Curb glow filters: 10px glow (stdDeviation 5)
  const curbGlows = [
    { id: 'curb-cyan-glow-10px', color: '#05D9E8' },
    { id: 'curb-magenta-glow-10px', color: '#FF2A6D' },
  ];
  curbGlows.forEach(({ id, color }) => {
    const f = document.createElementNS(SVG_NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('x', '-20%');
    f.setAttribute('y', '-100%');
    f.setAttribute('width', '140%');
    f.setAttribute('height', '300%');
    const drop = document.createElementNS(SVG_NS, 'feDropShadow');
    drop.setAttribute('dx', '0');
    drop.setAttribute('dy', '0');
    drop.setAttribute('stdDeviation', '5'); // 10px total glow
    drop.setAttribute('flood-color', color);
    drop.setAttribute('flood-opacity', '0.85');
    f.appendChild(drop);
    defs.appendChild(f);
  });

  // Road reflection soft blur filter
  const spillBlurFilter = document.createElementNS(SVG_NS, 'filter');
  spillBlurFilter.setAttribute('id', 'spill-blur');
  spillBlurFilter.setAttribute('x', '-30%');
  spillBlurFilter.setAttribute('y', '-60%');
  spillBlurFilter.setAttribute('width', '160%');
  spillBlurFilter.setAttribute('height', '220%');
  const sb = document.createElementNS(SVG_NS, 'feGaussianBlur');
  sb.setAttribute('stdDeviation', '4.5');
  spillBlurFilter.appendChild(sb);
  defs.appendChild(spillBlurFilter);

  // Scanlines pattern: strictly 0.02 opacity
  const scanlinePattern = document.createElementNS(SVG_NS, 'pattern');
  scanlinePattern.setAttribute('id', 'city-scanlines');
  scanlinePattern.setAttribute('width', '100%');
  scanlinePattern.setAttribute('height', '4');
  scanlinePattern.setAttribute('patternUnits', 'userSpaceOnUse');
  const scanline = document.createElementNS(SVG_NS, 'line');
  scanline.setAttribute('x1', '0');
  scanline.setAttribute('y1', '0');
  scanline.setAttribute('x2', '100%');
  scanline.setAttribute('y2', '0');
  scanline.setAttribute('stroke', '#FFFFFF');
  scanline.setAttribute('stroke-width', '1');
  scanline.setAttribute('opacity', '0.02');
  scanlinePattern.appendChild(scanline);
  defs.appendChild(scanlinePattern);

  svg.appendChild(defs);

  // ── 3. Speed Lines (Max 10, drawn BEHIND buildings, velocity-controlled) ──
  const speedLinesGroup = document.createElementNS(SVG_NS, 'g');
  speedLinesGroup.setAttribute('class', 'city-speed-lines');
  speedLinesGroup.style.opacity = '0';
  speedLinesGroup.style.transition = 'opacity 0.15s ease-out';

  const speedLineYs = [
    baseY - 140, baseY - 90, baseY - 40, baseY - 12,
    baseY + 12, baseY + 40, baseY + 90, baseY + 140
  ];
  speedLineYs.forEach((ly, idx) => {
    const sl = document.createElementNS(SVG_NS, 'line');
    sl.setAttribute('x1', '-400');
    sl.setAttribute('y1', String(ly));
    sl.setAttribute('x2', String(totalWidth + 400));
    sl.setAttribute('y2', String(ly));
    sl.setAttribute('stroke', 'rgba(255, 255, 255, 0.18)');
    sl.setAttribute('stroke-width', '1.5');
    sl.setAttribute('stroke-dasharray', `${80 + idx * 25}, ${160 + idx * 30}`);
    speedLinesGroup.appendChild(sl);
  });
  svg.appendChild(speedLinesGroup);

  // ── 4. Far Layer (Smaller, 35% darker, slower parallax travel) ──
  const farLayer = document.createElementNS(SVG_NS, 'g');
  farLayer.setAttribute('class', 'city-layer-far');
  svg.appendChild(farLayer);

  // ── 5. Near Layer (Full size, standard contrast, faster parallax travel) ──
  const nearLayer = document.createElementNS(SVG_NS, 'g');
  nearLayer.setAttribute('class', 'city-layer-near');
  svg.appendChild(nearLayer);

  // ── 6. Street / Road Layer (clean #101012 asphalt, curbs, center line) ──
  const roadGroup = document.createElementNS(SVG_NS, 'g');
  roadGroup.setAttribute('class', 'city-road');

  // Road asphalt (#101012)
  const asphalt = document.createElementNS(SVG_NS, 'rect');
  asphalt.setAttribute('x', '-500');
  asphalt.setAttribute('y', String(streetTop));
  asphalt.setAttribute('width', String(totalWidth + 1000));
  asphalt.setAttribute('height', String(streetBottom - streetTop));
  asphalt.setAttribute('fill', '#101012');
  roadGroup.appendChild(asphalt);

  // Road reflections container (one faint reflection under each neon sign)
  const roadReflectionsGroup = document.createElementNS(SVG_NS, 'g');
  roadReflectionsGroup.setAttribute('class', 'road-reflections');
  roadGroup.appendChild(roadReflectionsGroup);

  // Top curb line: 1px Magenta line with 10px glow
  const northCurb = document.createElementNS(SVG_NS, 'line');
  northCurb.setAttribute('x1', '-500');
  northCurb.setAttribute('y1', String(streetTop));
  northCurb.setAttribute('x2', String(totalWidth + 500));
  northCurb.setAttribute('y2', String(streetTop));
  northCurb.setAttribute('stroke', '#FF2A6D');
  northCurb.setAttribute('stroke-width', '1');
  northCurb.setAttribute('filter', 'url(#curb-magenta-glow-10px)');
  roadGroup.appendChild(northCurb);

  // Bottom curb line: 1px Cyan line with 10px glow
  const southCurb = document.createElementNS(SVG_NS, 'line');
  southCurb.setAttribute('x1', '-500');
  southCurb.setAttribute('y1', String(streetBottom));
  southCurb.setAttribute('x2', String(totalWidth + 500));
  southCurb.setAttribute('y2', String(streetBottom));
  southCurb.setAttribute('stroke', '#05D9E8');
  southCurb.setAttribute('stroke-width', '1');
  southCurb.setAttribute('filter', 'url(#curb-cyan-glow-10px)');
  roadGroup.appendChild(southCurb);

  // Crisp dashed yellow center line at 50% opacity
  const centerLine = document.createElementNS(SVG_NS, 'line');
  centerLine.setAttribute('x1', '-500');
  centerLine.setAttribute('y1', String(baseY));
  centerLine.setAttribute('x2', String(totalWidth + 500));
  centerLine.setAttribute('y2', String(baseY));
  centerLine.setAttribute('stroke', '#FFD400');
  centerLine.setAttribute('stroke-opacity', '0.5');
  centerLine.setAttribute('stroke-width', '2');
  centerLine.setAttribute('stroke-dasharray', '24, 24');
  roadGroup.appendChild(centerLine);

  // Exactly 3 crisp streaks (2px high, 60-120px long, white and red)
  const carStreaksData = [
    { baseX: 800, laneY: baseY - 18, length: 90, color: '#FFFFFF', speed: 1.7, dir: -1, el: null },
    { baseX: 320, laneY: baseY + 18, length: 115, color: '#FF2A6D', speed: 1.2, dir: 1, el: null },
    { baseX: 1650, laneY: baseY - 26, length: 68, color: '#FFFFFF', speed: 2.1, dir: -1, el: null },
  ];
  carStreaksData.forEach((c) => {
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('y', String(c.laneY - 1));
    r.setAttribute('height', '2');
    r.setAttribute('width', String(c.length));
    r.setAttribute('fill', c.color);
    roadGroup.appendChild(r);
    c.el = r;
  });

  svg.appendChild(roadGroup);

  // ── Helper to build grid blocks for Far and Near layers ──
  // Rule 1: Grid layout. Blocks with consistent 40px alley gap. 1-3 non-overlapping buildings per cell.
  // Rule 3: Solid dark top, 1px neon outline (70%), dark side wall extruded down-left (10-18px), 1-2 rooftop details.
  // Rule 4: Magenta above road, Cyan below road. One neon sign with 8px glow & road reflection.
  // Rule 7: Far layer is smaller, 35% darker (#09090B vs #0E0E10), slower parallax.
  const anchorElements = []; // Store rooftop sign elements for HUD connector lines

  function buildGridBuildings(parentGroup, isFar) {
    const blockCellW = isFar ? 220 : 280;
    const alleyGap = 40; // Strictly consistent 40px alley gap between blocks
    const blockPitch = blockCellW + alleyGap;
    const numBlocks = Math.ceil(totalWidth / blockPitch) + 3;

    let bGlobalIdx = isFar ? 200 : 0;

    for (let k = 0; k < numBlocks; k++) {
      const cellX = k * blockPitch;

      // Two rows: row above road (isNorth = true) and row below road (isNorth = false)
      for (const isNorth of [true, false]) {
        bGlobalIdx++;
        const seedBase = k * 19 + (isNorth ? 5 : 9) + (isFar ? 71 : 0);
        const bCount = 1 + Math.floor(seededRand(seedBase, 1) * 3); // 1, 2, or 3 buildings

        // Subdivide cell horizontally so buildings inside NEVER overlap
        const slots = [];
        if (bCount === 1) {
          slots.push({ x: cellX + 10, w: blockCellW - 20 });
        } else if (bCount === 2) {
          const gap = 8;
          const available = blockCellW - 20 - gap;
          const split = 0.44 + seededRand(seedBase, 2) * 0.12;
          const w1 = Math.floor(available * split);
          const w2 = available - w1;
          slots.push({ x: cellX + 10, w: w1 });
          slots.push({ x: cellX + 10 + w1 + gap, w: w2 });
        } else {
          const gap = 6;
          const available = blockCellW - 20 - 2 * gap;
          const wSlot = Math.floor(available / 3);
          slots.push({ x: cellX + 10, w: wSlot });
          slots.push({ x: cellX + 10 + wSlot + gap, w: wSlot });
          slots.push({ x: cellX + 10 + 2 * (wSlot + gap), w: wSlot });
        }

        slots.forEach((slot, sIdx) => {
          const bSeed = seedBase * 23 + sIdx;
          const heightMin = isFar ? 48 : 68;
          const heightMax = isFar ? 88 : 138;
          const bh = Math.round(heightMin + seededRand(bSeed, 3) * (heightMax - heightMin));
          const bw = slot.w;
          const bx = slot.x;

          // Height position relative to street
          let by;
          if (isNorth) {
            const offsetFromCurb = isFar ? (120 + seededRand(bSeed, 4) * 30) : 16;
            by = streetTop - bh - offsetFromCurb;
          } else {
            const offsetFromCurb = isFar ? (120 + seededRand(bSeed, 4) * 30) : 16;
            by = streetBottom + offsetFromCurb;
          }

          // Rule 3: Dark side wall (#050506 or #030304) extruded 10-18px down and left
          const wallExtrude = isFar
            ? Math.round(7 + Math.min(1, (bh - 48) / 40) * 5)
            : Math.round(10 + Math.min(1, (bh - 68) / 70) * 8);

          const wallPoly = document.createElementNS(SVG_NS, 'polygon');
          const pts = [
            `${bx},${by}`,
            `${bx - wallExtrude},${by + wallExtrude}`,
            `${bx - wallExtrude},${by + bh + wallExtrude}`,
            `${bx + bw - wallExtrude},${by + bh + wallExtrude}`,
            `${bx + bw},${by + bh}`,
            `${bx},${by + bh}`,
          ].join(' ');
          wallPoly.setAttribute('points', pts);
          wallPoly.setAttribute('fill', isFar ? '#030304' : '#050506');
          parentGroup.appendChild(wallPoly);

          // Rule 3 & 4: Solid dark top (#0E0E10 or #09090B), 1px neon outline at ~70% opacity
          // Rule 4: Magenta above road, Cyan below road
          const accentColor = isNorth ? '#FF2A6D' : '#05D9E8';
          const roof = document.createElementNS(SVG_NS, 'rect');
          roof.setAttribute('x', String(bx));
          roof.setAttribute('y', String(by));
          roof.setAttribute('width', String(bw));
          roof.setAttribute('height', String(bh));
          roof.setAttribute('rx', '1');
          roof.setAttribute('fill', isFar ? '#09090B' : '#0E0E10');
          roof.setAttribute('stroke', accentColor);
          roof.setAttribute('stroke-width', '1');
          roof.setAttribute('stroke-opacity', isFar ? '0.45' : '0.70');
          parentGroup.appendChild(roof);

          // Rule 3: 1-2 rooftop details (vent, AC unit, water tank, antenna), flat and low-contrast
          const detailCount = 1 + (seededRand(bSeed, 5) > 0.4 ? 1 : 0);
          for (let d = 0; d < detailCount; d++) {
            const dType = Math.floor(seededRand(bSeed + d * 7, 6) * 4);
            const dX = bx + 8 + d * 28;
            const dY = by + 6 + seededRand(bSeed + d * 5, 7) * Math.max(4, bh - 24);

            if (dType === 0) {
              // Vent
              const vent = document.createElementNS(SVG_NS, 'rect');
              vent.setAttribute('x', String(dX));
              vent.setAttribute('y', String(dY));
              vent.setAttribute('width', '18');
              vent.setAttribute('height', '10');
              vent.setAttribute('fill', isFar ? '#121215' : '#161619');
              vent.setAttribute('stroke', isFar ? '#17171a' : '#1e1e22');
              vent.setAttribute('stroke-width', '1');
              parentGroup.appendChild(vent);
            } else if (dType === 1) {
              // AC Unit
              const ac = document.createElementNS(SVG_NS, 'rect');
              ac.setAttribute('x', String(dX));
              ac.setAttribute('y', String(dY));
              ac.setAttribute('width', '14');
              ac.setAttribute('height', '14');
              ac.setAttribute('fill', isFar ? '#141417' : '#18181c');
              const fan = document.createElementNS(SVG_NS, 'circle');
              fan.setAttribute('cx', String(dX + 7));
              fan.setAttribute('cy', String(dY + 7));
              fan.setAttribute('r', '4');
              fan.setAttribute('fill', isFar ? '#09090b' : '#0e0e10');
              parentGroup.appendChild(ac);
              parentGroup.appendChild(fan);
            } else if (dType === 2) {
              // Water tank
              const tank = document.createElementNS(SVG_NS, 'circle');
              tank.setAttribute('cx', String(dX + 7));
              tank.setAttribute('cy', String(dY + 7));
              tank.setAttribute('r', '7');
              tank.setAttribute('fill', isFar ? '#111114' : '#151518');
              parentGroup.appendChild(tank);
            } else {
              // Antenna
              const ant = document.createElementNS(SVG_NS, 'line');
              ant.setAttribute('x1', String(dX + 4));
              ant.setAttribute('y1', String(dY + 12));
              ant.setAttribute('x2', String(dX + 4));
              ant.setAttribute('y2', String(dY - 4));
              ant.setAttribute('stroke', isFar ? '#1c1c22' : '#26262e');
              ant.setAttribute('stroke-width', '1.5');
              parentGroup.appendChild(ant);
            }
          }

          // Rule 4: Exactly one neon sign strip per building, soft 8px glow
          const signW = Math.min(46, Math.max(26, bw * 0.36));
          const signH = 4;
          const signX = bx + 8 + seededRand(bSeed, 8) * Math.max(4, bw - signW - 16);
          const signY = isNorth ? (by + bh - 6) : (by + 2);

          const sign = document.createElementNS(SVG_NS, 'rect');
          sign.setAttribute('x', String(signX));
          sign.setAttribute('y', String(signY));
          sign.setAttribute('width', String(signW));
          sign.setAttribute('height', String(signH));
          sign.setAttribute('rx', '1');
          sign.setAttribute('fill', accentColor);
          sign.setAttribute('filter', isNorth ? 'url(#neon-magenta-glow-8px)' : 'url(#neon-cyan-glow-8px)');
          parentGroup.appendChild(sign);

          // Save anchors for callouts (near layer only)
          if (!isFar) {
            anchorElements.push({
              x: signX + signW * 0.5,
              y: signY,
              isNorth,
              el: sign,
            });
          }

          // Rule 4 & 5: Faint matching reflection under each neon sign on the road
          const reflY = isNorth ? (streetTop + 8) : (streetBottom - 8);
          const refl = document.createElementNS(SVG_NS, 'ellipse');
          refl.setAttribute('cx', String(signX + signW * 0.5));
          refl.setAttribute('cy', String(reflY));
          refl.setAttribute('rx', String(signW * 0.75));
          refl.setAttribute('ry', '5');
          refl.setAttribute('fill', accentColor);
          refl.setAttribute('opacity', '0.18');
          refl.setAttribute('filter', 'url(#spill-blur)');
          roadReflectionsGroup.appendChild(refl);
        });
      }
    }
  }

  // Populate two layers strictly
  buildGridBuildings(farLayer, true);
  buildGridBuildings(nearLayer, false);

  // ── 7. Afterimages Pool (14 solid cubes, Cyan-to-Magenta palette, strictly non-intersecting) ──
  const cloneGroup = document.createElementNS(SVG_NS, 'g');
  cloneGroup.setAttribute('class', 'city-clones');
  svg.appendChild(cloneGroup);

  const clones = [];
  for (let i = 0; i < CITY_CLONE_COUNT; i++) {
    const cloneColor = CITY_CLONE_PALETTE[i % CITY_CLONE_PALETTE.length];
    const cloneShape = createSquareRunnerShape(true, cloneColor);
    cloneShape.root.style.display = 'none';
    cloneGroup.appendChild(cloneShape.root);
    clones.push({
      index: i,
      el: cloneShape.root,
      visible: false,
    });
  }

  // ── 8. Main Runner Shape (Solid Cube #FFD400, strictly preserved) ──
  const runnerGroup = document.createElementNS(SVG_NS, 'g');
  runnerGroup.setAttribute('class', 'city-runner-main');
  const runnerFigure = createSquareRunnerShape(false, '#FFD400');
  runnerGroup.appendChild(runnerFigure.root);
  svg.appendChild(runnerGroup);

  // ── 9. Rain Streaks (Max 25 streaks at 8% opacity) ──
  const rainGroup = document.createElementNS(SVG_NS, 'g');
  rainGroup.setAttribute('class', 'city-rain');
  const rainCount = 22; // strictly max 25
  for (let r = 0; r < rainCount; r++) {
    const rx = (r / rainCount) * (w * 1.2);
    const ry = seededRand(r, 88) * (h * 1.2);
    const rainLine = document.createElementNS(SVG_NS, 'line');
    rainLine.setAttribute('x1', String(rx));
    rainLine.setAttribute('y1', String(ry));
    rainLine.setAttribute('x2', String(rx - 7));
    rainLine.setAttribute('y2', String(ry + 22));
    rainLine.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
    rainLine.setAttribute('stroke-width', '1');
    rainGroup.appendChild(rainLine);
  }
  svg.appendChild(rainGroup);

  // ── 10. Scanlines Overlay (Opacity strictly 0.02) ──
  const scanlinesRect = document.createElementNS(SVG_NS, 'rect');
  scanlinesRect.setAttribute('x', '0');
  scanlinesRect.setAttribute('y', '0');
  scanlinesRect.setAttribute('width', '100%');
  scanlinesRect.setAttribute('height', '100%');
  scanlinesRect.setAttribute('fill', 'url(#city-scanlines)');
  scanlinesRect.style.pointerEvents = 'none';
  svg.appendChild(scanlinesRect);

  // ── 11. Untilted HUD Callouts Overlay (Rule 2: Callouts stay in a separate untilted overlay) ──
  const calloutsOverlay = document.createElement('div');
  calloutsOverlay.className = 'city-callouts-overlay';
  section.appendChild(calloutsOverlay);

  // Connector lines SVG inside untilted overlay
  const connectorSvg = document.createElementNS(SVG_NS, 'svg');
  connectorSvg.setAttribute('width', '100%');
  connectorSvg.setAttribute('height', '100%');
  connectorSvg.style.position = 'absolute';
  connectorSvg.style.inset = '0';
  connectorSvg.style.pointerEvents = 'none';
  calloutsOverlay.appendChild(connectorSvg);

  const calloutsData = [
    {
      progress: 0.14,
      className: 'city-callout-1',
      title: 'Skills',
      text: 'Python, Java, C · React.js, Node.js · PostgreSQL, NoSQL · HTML/CSS',
      color: '#05D9E8',
      preferredAnchorIdx: 2,
      duration: 0.22,
    },
    {
      progress: 0.36,
      className: 'city-callout-2',
      title: 'Hackathons',
      text: '▸ Winner · RobochipX 2026 (RIT AI Track)\n▸ Finalist · CSI ORIGIN 2026 (VIT Chennai)\n▸ Participant · CODEATHON 4.0 (Prathyusha)\n▸ Participant · Nanohack 2026 (SIMATS)',
      color: '#FF2A6D',
      preferredAnchorIdx: 5,
      duration: 0.24,
    },
    {
      progress: 0.58,
      className: 'city-callout-3',
      title: 'Domains',
      text: 'Clinical AI, medication & dietary intelligence, zero-cloud mesh comms, predictive maintenance',
      color: '#FFD400',
      preferredAnchorIdx: 9,
      duration: 0.28,
    },
  ];

  // Create connector SVG elements
  const connectorElements = calloutsData.map((data) => {
    const cg = document.createElementNS(SVG_NS, 'g');
    cg.style.opacity = '0';

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('stroke', data.color);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('opacity', '0.9');

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '3.5');
    dot.setAttribute('fill', data.color);

    cg.appendChild(line);
    cg.appendChild(dot);
    connectorSvg.appendChild(cg);
    return { group: cg, line, dot, data };
  });

  // Create untilted HUD callouts
  const calloutEls = calloutsData.map((data, idx) => {
    const div = document.createElement('div');
    div.className = `city-callout ${data.className}`;
    div.style.setProperty('--accent-color', data.color);

    // Corner brackets
    const cornerTR = document.createElement('div');
    cornerTR.className = 'hud-corner-tr';
    const cornerBL = document.createElement('div');
    cornerBL.className = 'hud-corner-bl';
    div.appendChild(cornerTR);
    div.appendChild(cornerBL);

    const titleEl = document.createElement('strong');
    titleEl.textContent = `[ ${data.title} ]`;
    div.appendChild(titleEl);

    const pEl = document.createElement('p');
    const textSpan = document.createElement('span');
    textSpan.className = 'hud-text';
    const cursor = document.createElement('span');
    cursor.className = 'hud-cursor';
    cursor.textContent = '▋';
    pEl.appendChild(textSpan);
    pEl.appendChild(cursor);
    div.appendChild(pEl);

    calloutsOverlay.appendChild(div);
    return {
      el: div,
      textSpan,
      cursor,
      fullText: data.text,
      appearProgress: data.progress,
      duration: data.duration,
      connector: connectorElements[idx],
      wasGlitching: false,
    };
  });

  // Runner path: completely straight horizontal slide from start to end
  const runnerStartX = -40;
  const runnerEndX = w + 60;
  const runnerTotalDist = runnerEndX - runnerStartX;

  function getRunnerStateAt(p) {
    const curW = window.innerWidth;
    const curH = window.innerHeight;
    const curBaseY = curH * 0.5;

    const startX = -40;
    const endX = curW + 60;
    const rx = startX + p * (endX - startX);
    const ry = curBaseY;

    return { x: rx, y: ry };
  }

  // ── 12. Frame Update Handler (100% Scroll-Driven, Reversible) ──
  let lastProgress = 0;
  let lastTime = performance.now();
  let smoothVelocity = 0;

  function updateScene(progress, selfTrigger = null) {
    // Velocity calculation for speed lines (drawn behind buildings)
    const now = performance.now();
    const dt = Math.max(16, now - lastTime);
    const dp = Math.abs(progress - lastProgress);
    const instantVelocity = (dp / dt) * 10000;
    smoothVelocity = smoothVelocity * 0.7 + instantVelocity * 0.3;
    lastProgress = progress;
    lastTime = now;

    // Rule 6: Speed lines max 10, only visible when velocity is above threshold
    const isFast = smoothVelocity > 35;
    speedLinesGroup.style.opacity = isFast ? Math.min(0.25, (smoothVelocity - 35) / 120).toFixed(3) : '0';

    // Rule 7: Two layers ONLY. Far layer slower parallax, near layer faster parallax
    const travelFar = -progress * 110;
    const travelNear = -progress * 280;
    const travelRoad = -progress * 180;

    farLayer.setAttribute('transform', `translate(${travelFar.toFixed(2)}, 0)`);
    nearLayer.setAttribute('transform', `translate(${travelNear.toFixed(2)}, 0)`);
    roadGroup.setAttribute('transform', `translate(${travelRoad.toFixed(2)}, 0)`);

    // Rule 6: Exactly 3 crisp car streaks tied to scroll position
    carStreaksData.forEach((c) => {
      const dist = progress * c.speed * 920 * c.dir;
      const curX = ((c.baseX + dist) % (totalWidth + 500));
      c.el.setAttribute('x', (curX - (c.dir < 0 ? c.length : 0)).toFixed(1));
    });

    // ── 1. Runner Position (Solid yellow cube sliding straight) ──
    const runnerState = getRunnerStateAt(progress);
    runnerGroup.setAttribute(
      'transform',
      `translate(${runnerState.x.toFixed(2)}, ${runnerState.y.toFixed(2)})`
    );

    // ── 2. Afterimages Pool (14 solid cubes, non-intersecting, Cyan-to-Magenta) ──
    const cloneSpacing = Math.max(52, runnerTotalDist / (CITY_CLONE_COUNT + 1));
    const currentDist = progress * runnerTotalDist;

    for (let i = 0; i < CITY_CLONE_COUNT; i++) {
      const c = clones[i];
      const triggerDist = (i + 1) * cloneSpacing;

      if (currentDist >= triggerDist) {
        if (!c.visible) {
          c.visible = true;
          c.el.style.display = '';
          const progAtTrigger = Math.min(1, triggerDist / runnerTotalDist);
          const stateAtTrigger = getRunnerStateAt(progAtTrigger);
          c.el.setAttribute(
            'transform',
            `translate(${stateAtTrigger.x.toFixed(2)}, ${stateAtTrigger.y.toFixed(2)})`
          );
        }
      } else {
        if (c.visible) {
          c.visible = false;
          c.el.style.display = 'none';
        }
      }
    }

    // ── 3. Camera Punch on Callout Entry (Scale 1.00 -> 1.06 -> 1.00 on tilted plane) ──
    let punchScale = 1.00;
    calloutsData.forEach((data) => {
      const delta = progress - data.progress;
      if (delta >= 0 && delta <= CAMERA_PUNCH_SPAN) {
        const punchT = delta / CAMERA_PUNCH_SPAN;
        const currentPunch = 1.00 + (CAMERA_PUNCH_MAX - 1.00) * Math.sin(punchT * Math.PI);
        if (currentPunch > punchScale) {
          punchScale = currentPunch;
        }
      }
    });
    // Apply camera punch with perspective tilt to the entire city plane
    cityPlane.style.transform = `perspective(1000px) rotateX(50deg) rotateZ(-6deg) scale(${punchScale.toFixed(4)})`;

    // ── 4. Untilted HUD Callouts & Connectors ──
    calloutEls.forEach((item, idx) => {
      const { el, textSpan, cursor, fullText, appearProgress, duration, connector } = item;
      const state = getCalloutState(progress, appearProgress, duration);

      el.style.opacity = state.opacity.toFixed(3);
      el.style.transform = `translateY(${state.translateY.toFixed(1)}px)`;
      el.style.visibility = state.visible ? 'visible' : 'hidden';

      if (state.visible) {
        // Monospace typewriter text
        const typeProgress = Math.min(1, Math.max(0, (progress - appearProgress) / 0.045));
        const charsCount = Math.floor(typeProgress * fullText.length);
        textSpan.textContent = fullText.slice(0, charsCount);
        cursor.style.display = typeProgress >= 1 ? 'none' : 'inline-block';

        // 150ms RGB glitch flicker on entry
        const isGlitchWindow = (progress >= appearProgress && progress <= appearProgress + 0.025);
        if (isGlitchWindow && !item.wasGlitching) {
          el.classList.add('hud-glitching');
          item.wasGlitching = true;
        } else if (!isGlitchWindow && item.wasGlitching) {
          el.classList.remove('hud-glitching');
          item.wasGlitching = false;
        }

        // Connector line drawn from callout to its rooftop in true perspective
        if (connector) {
          connector.group.style.opacity = state.opacity.toFixed(3);
          const cRect = el.getBoundingClientRect();
          const secRect = section.getBoundingClientRect();
          const calloutMidX = cRect.left - secRect.left + cRect.width * 0.5;
          const calloutEdgeY = (appearProgress === 0.40)
            ? (cRect.top - secRect.top)
            : (cRect.bottom - secRect.top);

          // Get rooftop anchor in 3D perspective
          const anchorData = anchorElements[calloutsData[idx].preferredAnchorIdx % anchorElements.length];
          let roofX = calloutMidX;
          let roofY = calloutEdgeY + 60;

          if (anchorData && anchorData.el) {
            const rRect = anchorData.el.getBoundingClientRect();
            roofX = rRect.left - secRect.left + rRect.width * 0.5;
            roofY = rRect.top - secRect.top + rRect.height * 0.5;
          }

          connector.line.setAttribute('x1', calloutMidX.toFixed(1));
          connector.line.setAttribute('y1', calloutEdgeY.toFixed(1));
          connector.line.setAttribute('x2', roofX.toFixed(1));
          connector.line.setAttribute('y2', roofY.toFixed(1));

          const drawSpan = 0.035;
          const drawT = Math.min(1, Math.max(0, (progress - appearProgress) / drawSpan));
          const lineLen = Math.hypot(roofX - calloutMidX, roofY - calloutEdgeY);
          connector.line.setAttribute('stroke-dasharray', `${lineLen.toFixed(1)} ${lineLen.toFixed(1)}`);
          connector.line.setAttribute('stroke-dashoffset', `${(lineLen * (1 - drawT)).toFixed(1)}`);

          connector.dot.setAttribute('cx', roofX.toFixed(1));
          connector.dot.setAttribute('cy', roofY.toFixed(1));
          connector.dot.style.opacity = drawT >= 0.8 ? '1' : '0';
        }
      } else {
        if (connector) {
          connector.group.style.opacity = '0';
        }
        item.wasGlitching = false;
        el.classList.remove('hud-glitching');
      }
    });
  }

  // Initial draw
  updateScene(0);

  // ── 13. ScrollTrigger Setup (scrub: 0.5, completely reversible) ──
  ScrollTrigger.create({
    id: 'city-trigger',
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * (CONFIG.scrollLengths?.city || 350) / 100}`,
    pin: true,
    scrub: 0.5,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      updateScene(self.progress, self);
    },
    onRefresh: () => {
      updateScene(0);
    },
  });
}
