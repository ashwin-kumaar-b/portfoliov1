// ============================================================
// moon3d.js — Scene 6: 3D Lunar Surface (Three.js WebGL)
//             STRICTLY grayscale, no colored lights or materials
//             - FBM terrain + 14 seeded craters + flattened path
//             - 120 instanced dodecahedron rocks with shadows
//             - Directional light (low angle from left) + AmbientLight
//             - 2500 white stars (sphere R=500, follows camera)
//             - Monochrome Earth at (60, 55, -220)
//             - PerspectiveCamera FOV 55, height 2.4, moves along Z
//             - Strict lifecycle (resize, onToggle pause, disposal)
// ============================================================
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from '../config.js';
import projectsData from '../../data/projects.json';
import { createStars } from '../stars.js';

gsap.registerPlugin(ScrollTrigger);

// ── Tuning Constants (Exposed at top) ──
export const CAMERA_HEIGHT = 2.6;             // Side-on camera height (Y)
export const CAMERA_DISTANCE = 18.0;          // Side-on camera distance (Z)
export const CAMERA_LOOKAT_Y = 3.6;           // Camera target lookAt Y (moves train lower, giving cards headroom)
export const CAMERA_FOV = 48;                 // Side-on PerspectiveCamera FOV
export const PATH_START_X = -20;              // Starting camera X position at p = 0
export const PATH_LENGTH = 240;               // Path length along X: camX = -20 + 240 * p
export const LIGHT_DIR_INTENSITY = 2.6;       // Directional light intensity
export const LIGHT_AMBIENT_INTENSITY = 0.14;  // Ambient light intensity
export const LIGHT_DIR_POS = { x: -50, y: 28, z: 45 }; // Directional light position offset

// ── Moon Lander Tuning Constants ──
export const LANDER_SIZE = { height: 4.2, width: 7.0 };
export const CARRIER_0_START_X = -10.0 - 7.0 - (projectsData.length - 1) * 8.5; // -59.5
export const LANDER_X_OFFSET = -11.0;         // X offset from carrier 0 at pT = 0
export const LANDER_X = CARRIER_0_START_X + LANDER_X_OFFSET; // -70.5
export const LANDER_Z = -14.0;                // Lander Z position
export const LANDER_MAX_FLAME_LEN = 3.5;      // Base flame length

// ── Landing & Project Train Configuration Constants ──
export const LAND_END = 0.14;                 // Rocket landing intro completes at p = 0.14
export const ROVER_START_X = -10.0;           // Starting rover base X
export const TRAIN_END = 0.7;                 // Train phase completes at p = 0.7
export const CARRIER_START_OFFSET = 7.0;      // Distance behind rover along -X to first carrier
export const CARRIER_SPACING = 8.5;           // Spacing between consecutive carriers
export const CARD_WORLD_Y = 3.5;              // World Y anchor: Top center of carrier pole frame
export const CARD_SCALE_MIN = 0.6;            // Minimum scale for unfocused cards
export const CARD_SCALE_MAX = 1.0;            // Maximum scale for focused cards

// ── Lunar Base & Pull-Back Configuration Constants ──
export const ROVER_FINAL_X = 210.0;           // Final rover X at end of train phase (pT = 1.0)
export const BASE_X_OFFSET = 45.0;            // Base X offset from final rover X
export const BASE_X = ROVER_FINAL_X + BASE_X_OFFSET; // Lunar base center X = 255.0
export const BASE_CAM_HEIGHT = 2.2;           // Before pull-back camera height (pB < 0.4)
export const BASE_CAM_DISTANCE = 26.0;        // Before pull-back camera distance (pB < 0.4)
export const BASE_CAM_LOOKAT_Y = 5.0;         // Before pull-back camera lookAt Y (pB < 0.4)
export const PULLBACK_CAM_DIST = 75.0;        // Establishing shot camera distance
export const PULLBACK_CAM_HEIGHT = 16.0;      // Establishing shot camera height
export const PULLBACK_FOV = 55.0;             // Establishing shot camera FOV
export const PULLBACK_LOOKAT = { x: BASE_X + 6.0, y: 8.0, z: -18.0 };

// ── Crater Configuration Constants ──
export const CRATER_BIG_COUNT = 7;
export const CRATER_BIG_R_MIN = 18;
export const CRATER_BIG_R_MAX = 34;

export const CRATER_MED_COUNT = 45;
export const CRATER_MED_R_MIN = 5;
export const CRATER_MED_R_MAX = 12;

export const CRATER_SML_COUNT = 160;
export const CRATER_SML_R_MIN = 0.8;
export const CRATER_SML_R_MAX = 3.0;

// ── Inline Deterministic Seeded PRNG & Noise Helpers (No dependencies) ──
function createSeededRNG(seed = 12345) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function hash2D(x, z, seed = 1337) {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise2D(x, z, seed = 1337) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uz = fz * fz * (3.0 - 2.0 * fz);

  const a = hash2D(ix, iz, seed);
  const b = hash2D(ix + 1, iz, seed);
  const c = hash2D(ix, iz + 1, seed);
  const d = hash2D(ix + 1, iz + 1, seed);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbmNoise(x, z) {
  let total = 0;
  let freq = 0.02; // Base frequency 0.02
  let amp = 1.2;   // Reduced amplitude to 1.2 so craters dominate

  for (let oct = 0; oct < 4; oct++) {
    total += (smoothNoise2D(x * freq, z * freq, 5432 + oct * 101) * 2.0 - 1.0) * amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return total;
}

// ── Crater Profile Function ──
function craterHeight(d, R, depth, rimH) {
  const t = d / R;
  if (t < 1.0) {
    const t2 = t * t;
    const t6 = t2 * t2 * t2;
    return -depth * (1.0 - t2) + rimH * t6;
  } else if (t < 2.2) {
    const term = (t - 1.0) / 0.35;
    return rimH * Math.exp(-(term * term));
  }
  return 0.0;
}

// ── Crater Set Generation (Seeded RNG, kept out of rover path strip |z| < 4 and base pad) ──
const craterRng = createSeededRNG(7771);
const CRATERS = [];

function isInsideBasePad(cx, cz) {
  return Math.abs(cx - BASE_X) < 26.0 && cz > -36.0 && cz < 12.0;
}

// 1. 7 BIG: R between 18 and 34, z between -35 and -90, x spread evenly across -100 to 300 with +/-15 jitter
for (let i = 0; i < CRATER_BIG_COUNT; i++) {
  const R = CRATER_BIG_R_MIN + craterRng() * (CRATER_BIG_R_MAX - CRATER_BIG_R_MIN);
  const baseX = -100.0 + (i / (CRATER_BIG_COUNT - 1)) * 400.0;
  const x = baseX + (craterRng() * 2.0 - 1.0) * 15.0;
  const z = -35.0 - craterRng() * 55.0; // [-90, -35]
  if (isInsideBasePad(x, z)) continue;
  CRATERS.push({
    x,
    z,
    R,
    depth: 0.24 * R,
    rimH: 0.07 * R,
  });
}

// 2. 45 MEDIUM: R between 5 and 12, z between -60 and -5 or between 6 and 30, x between -120 and 320
for (let i = 0; i < CRATER_MED_COUNT; i++) {
  const R = CRATER_MED_R_MIN + craterRng() * (CRATER_MED_R_MAX - CRATER_MED_R_MIN);
  const x = -120.0 + craterRng() * 440.0;
  let z;
  if (craterRng() < 0.7) {
    z = -60.0 + craterRng() * 55.0; // [-60, -5]
  } else {
    z = 6.0 + craterRng() * 24.0;   // [6, 30]
  }
  if (isInsideBasePad(x, z)) continue;
  CRATERS.push({
    x,
    z,
    R,
    depth: 0.24 * R,
    rimH: 0.07 * R,
  });
}

// 3. 160 SMALL: R between 0.8 and 3, z between -45 and 35 (excluding |z| < 4), x between -130 and 330
for (let i = 0; i < CRATER_SML_COUNT; i++) {
  const R = CRATER_SML_R_MIN + craterRng() * (CRATER_SML_R_MAX - CRATER_SML_R_MIN);
  const x = -130.0 + craterRng() * 460.0;
  let z;
  if (craterRng() < 0.57) {
    z = -45.0 + craterRng() * 41.0; // [-45, -4]
  } else {
    z = 4.0 + craterRng() * 31.0;   // [4, 35]
  }
  if (isInsideBasePad(x, z)) continue;
  CRATERS.push({
    x,
    z,
    R,
    depth: 0.24 * R,
    rimH: 0.07 * R,
  });
}

// Sum contributions of all craters into the height (overlaps blend)
function getCratersHeight(x, z) {
  let h = 0;
  for (let i = 0; i < CRATERS.length; i++) {
    const c = CRATERS[i];
    const dx = x - c.x;
    const dz = z - c.z;
    const d2 = dx * dx + dz * dz;
    const maxDist = c.R * 2.2;
    if (d2 < maxDist * maxDist) {
      const d = Math.sqrt(d2);
      h += craterHeight(d, c.R, c.depth, c.rimH);
    }
  }
  return h;
}

function smoothstep(min, max, value) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

// Expose getHeight(x, z) function in WORLD coordinates (rocks and rover use it)
export function getHeight(x, z) {
  // 1. Base fbm noise (amplitude 1.2) + sum of crater contributions
  let h = fbmNoise(x, z) + getCratersHeight(x, z);

  // 2. Base Pad: flatten a pad around the base
  // Blend heights to 0 where |x - BASE_X| < 24 and z between -34 and 10, with smooth 12-unit blend zone
  // Applied after craters, before computeVertexNormals
  const padDx = Math.max(0, Math.abs(x - BASE_X) - 24.0);
  const padDz = z < -34.0 ? -34.0 - z : (z > 10.0 ? z - 10.0 : 0.0);
  const padDist = Math.sqrt(padDx * padDx + padDz * padDz);
  if (padDist < 12.0) {
    const padBlend = smoothstep(0.0, 12.0, padDist);
    h *= padBlend;
  }

  // 3. Path: flat drivable strip along X axis at |z| < 3 with smooth blend to |z| = 17
  // Applied AFTER adding craters so path stays smooth
  const absZ = Math.abs(z);
  let lateralFactor = 1.0;
  if (absZ <= 3.0) {
    lateralFactor = 0.0;
  } else if (absZ < 17.0) {
    lateralFactor = smoothstep(3.0, 17.0, absZ);
  }

  let xFactor = 1.0;
  if (x < -60.0) {
    xFactor = smoothstep(-85.0, -60.0, x);
  } else if (x > 260.0) {
    xFactor = 1.0 - smoothstep(260.0, 285.0, x);
  }

  const pathBlend = 1.0 - xFactor * (1.0 - lateralFactor);
  h *= pathBlend;

  // 4. Far Ridge: smooth ridge near far edge (z toward -98) to hide terrain end
  h += 9.0 * smoothstep(-70.0, -98.0, z);

  // 5. Smaller ridges at left and right edges (rising to 9 units over 25 units of distance)
  if (x < -110.0) {
    h += 9.0 * smoothstep(-110.0, -135.0, x);
  } else if (x > 310.0) {
    h += 9.0 * smoothstep(310.0, 335.0, x);
  }

  // 6. Clamp final height to [-10, 12]
  h = Math.max(-10.0, Math.min(12.0, h));

  return h;
}

// ── Main Scene Initialization ──
export function initMoon3D() {
  const section = document.getElementById('scene-moon');
  if (!section) return;

  // Kill existing trigger if re-initialized
  ScrollTrigger.getById('moon3d-trigger')?.kill();

  // Accessibility: prefers-reduced-motion fallback
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    section.innerHTML = '';
    section.style.background = '#0A0A0A';
    section.style.height = 'auto';
    section.style.minHeight = '100vh';
    section.style.padding = '4rem 1.5rem';
    section.style.position = 'relative';
    section.style.overflow = 'visible';

    const listContainer = document.createElement('div');
    listContainer.className = 'moon-reduced-list';
    listContainer.setAttribute('role', 'region');
    listContainer.setAttribute('aria-label', 'Project List');

    projectsData.forEach((proj, i) => {
      const card = document.createElement('article');
      card.className = 'moon-card is-focused';
      card.setAttribute('aria-label', proj.title);
      card.setAttribute('aria-hidden', 'false');

      const cornerTR = document.createElement('div');
      cornerTR.className = 'hud-corner-tr';
      cornerTR.setAttribute('aria-hidden', 'true');
      const cornerBL = document.createElement('div');
      cornerBL.className = 'hud-corner-bl';
      cornerBL.setAttribute('aria-hidden', 'true');

      const header = document.createElement('header');
      header.className = 'moon-card-header';
      const indexSpan = document.createElement('span');
      indexSpan.className = 'moon-card-index';
      indexSpan.textContent = `// PROJECT 0${i + 1}`;
      const titleEl = document.createElement('h3');
      titleEl.className = 'moon-card-title';
      titleEl.textContent = proj.title;
      header.appendChild(indexSpan);
      header.appendChild(titleEl);

      const descEl = document.createElement('p');
      descEl.className = 'moon-card-desc';
      descEl.textContent = proj.description;

      const tagsEl = document.createElement('div');
      tagsEl.className = 'moon-card-tags';
      proj.tags.forEach((tag) => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'moon-tag';
        tagSpan.textContent = tag;
        tagsEl.appendChild(tagSpan);
      });

      const footer = document.createElement('div');
      footer.className = 'moon-card-footer';
      const linkBtn = document.createElement('a');
      const targetUrl = (proj.link && proj.link.trim() !== '' && proj.link.trim() !== '#') ? proj.link : 'https://github.com/ashwin-kumaar-b';
      linkBtn.href = targetUrl;
      linkBtn.target = '_blank';
      linkBtn.rel = 'noopener noreferrer';
      linkBtn.className = 'moon-card-btn';
      linkBtn.textContent = 'EXPLORE →';
      linkBtn.setAttribute('aria-label', `Explore ${proj.title}`);
      footer.appendChild(linkBtn);

      card.appendChild(cornerTR);
      card.appendChild(cornerBL);
      card.appendChild(header);
      card.appendChild(descEl);
      card.appendChild(tagsEl);
      card.appendChild(footer);

      listContainer.appendChild(card);
    });

    section.appendChild(listContainer);
    return function disposeMoon3D() {
      section.innerHTML = '';
    };
  }

  section.innerHTML = '';
  section.style.background = '#000000';
  section.style.position = 'relative';
  section.style.overflow = 'hidden';
  section.style.width = '100%';
  section.style.height = '100svh';
  section.style.minHeight = '100svh';
  section.style.margin = '0';
  section.style.padding = '0';

  const width = window.innerWidth;
  const height = window.innerHeight;

  // ── 1. WebGL Renderer Setup (PCFSoftShadowMap, black background, no fog) ──
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  section.appendChild(renderer.domElement);

  // ── Blur & Tint Layer (Full-area div above canvas, below overlays) ──
  const blurLayer = document.createElement('div');
  blurLayer.className = 'moon-blur-layer';
  blurLayer.setAttribute('aria-hidden', 'true');
  section.appendChild(blurLayer);

  // Feature detection for CSS backdrop-filter
  const supportsBackdropFilter = typeof CSS !== 'undefined' &&
    (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));

  // ── Overlay Container for Real HTML Project Cards ──
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'moon-cards-overlay';
  cardsContainer.setAttribute('role', 'region');
  cardsContainer.setAttribute('aria-label', 'Project Train Interactive Cards');
  section.appendChild(cardsContainer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // Strictly no fog: a lunar horizon is razor sharp

  // ── 2. Camera Setup (Side-on FOV 48, height 2.6, distance 18, lookAt Y 3.6) ──
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 900);
  camera.position.set(PATH_START_X, CAMERA_HEIGHT, CAMERA_DISTANCE);
  camera.lookAt(PATH_START_X, CAMERA_LOOKAT_Y, 0);

  // ── 3. Lighting (Strictly Grayscale) ──
  // Ambient light: 0xffffff, intensity 0.14
  const ambientLight = new THREE.AmbientLight(0xffffff, LIGHT_AMBIENT_INTENSITY);
  scene.add(ambientLight);

  // Directional light: 0xffffff, intensity 2.6 at (-50, 28, 45)
  const dirLight = new THREE.DirectionalLight(0xffffff, LIGHT_DIR_INTENSITY);
  dirLight.position.set(PATH_START_X + LIGHT_DIR_POS.x, LIGHT_DIR_POS.y, LIGHT_DIR_POS.z);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.bias = -0.0004;

  dirLight.shadow.camera.left = -60;
  dirLight.shadow.camera.right = 60;
  dirLight.shadow.camera.top = 60;
  dirLight.shadow.camera.bottom = -60;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 300;

  scene.add(dirLight);
  scene.add(dirLight.target);

  // ── 4. Lunar Terrain ──
  // PlaneGeometry(480, 140, 480, 140) rotated flat and translated by (100, 0, -30)
  // Geometry translation covers x from -140 to 340 and z from -100 to 40
  const terrainGeo = new THREE.PlaneGeometry(480, 140, 480, 140);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(100, 0, -30);

  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    posAttr.setY(i, getHeight(vx, vz));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x8c8c8c,
    roughness: 1.0,
    metalness: 0.0,
    flatShading: false, // Smooth shading on terrain
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.position.set(0, 0, 0); // Mesh kept at origin
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // ── 5. Rocks (120 Instanced Dodecahedron instances) ──
  const rockGeo = new THREE.DodecahedronGeometry(1.0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x6e6e6e,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true, // Rocks remain flat-shaded
  });
  const rockInstances = new THREE.InstancedMesh(rockGeo, rockMat, 120);
  rockInstances.castShadow = true;
  rockInstances.receiveShadow = true;

  const rockRNG = createSeededRNG(9876);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < 120; i++) {
    // Keep rocks out of |z| < 5
    let rz = -75.0 + rockRNG() * 110.0;
    if (Math.abs(rz) < 5.0) {
      rz = rz >= 0 ? rz + 5.2 : rz - 5.2;
    }
    // Spread rocks across the terrain range (-100 to 310)
    const rx = -100.0 + rockRNG() * 410.0;
    const rScale = 0.2 + rockRNG() * 1.4; // Scale 0.2 to 1.6

    // Exclude rocks inside the base pad (|x - BASE_X| < 26 and z between -36 and 12)
    if (Math.abs(rx - BASE_X) < 26.0 && rz > -36.0 && rz < 12.0) {
      dummy.position.set(0, -9999, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      rockInstances.setMatrixAt(i, dummy.matrix);
      continue;
    }

    const ry = getHeight(rx, rz) + rScale * 0.65;

    dummy.position.set(rx, ry, rz);
    dummy.scale.set(rScale, rScale * (0.8 + rockRNG() * 0.4), rScale);
    dummy.rotation.set(
      rockRNG() * Math.PI * 2,
      rockRNG() * Math.PI * 2,
      rockRNG() * Math.PI * 2
    );
    dummy.updateMatrix();
    rockInstances.setMatrixAt(i, dummy.matrix);
  }
  rockInstances.instanceMatrix.needsUpdate = true;
  scene.add(rockInstances);

  // ── 6. Stars (1500 white points on sphere radius 300 via createStars) ──
  const starPoints = createStars();
  const starGroup = new THREE.Group();
  starGroup.add(starPoints);
  scene.add(starGroup);

  // ── 7. Earth in Lunar Sky: SphereGeometry radius 7, 48 segments (upper right of frame) ──
  const earthGeo = new THREE.SphereGeometry(7, 48, 36);
  const earthMat = new THREE.MeshStandardMaterial({
    color: 0x8cb8e6, // Soft lunar-sky Earth tint (slightly blue)
    roughness: 1.0,
    metalness: 0.0,
  });
  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.position.set(PATH_START_X + 70, 55, -220);
  scene.add(earthMesh);

  // ── 8. Lunar Rover (Faces +X, drives along path with rotating wheels) ──
  const roverGroup = new THREE.Group();

  // Ink outline material for cel-shaded borders (side: THREE.BackSide)
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.BackSide,
  });

  // 1. Chassis: BoxGeometry(3.2, 0.5, 1.8), lunar dark gray
  const chassisGeo = new THREE.BoxGeometry(3.2, 0.5, 1.8);
  const chassisMat = new THREE.MeshToonMaterial({
    color: 0x363842,
  });
  const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
  chassisMesh.position.set(0, 0.65, 0);
  chassisMesh.castShadow = true;
  chassisMesh.receiveShadow = true;
  roverGroup.add(chassisMesh);

  // Chassis ink outline (geometry scaled 1.06)
  const chassisOutlineGeo = chassisGeo.clone();
  chassisOutlineGeo.scale(1.06, 1.06, 1.06);
  const chassisOutline = new THREE.Mesh(chassisOutlineGeo, outlineMat);
  chassisOutline.position.copy(chassisMesh.position);
  roverGroup.add(chassisOutline);

  // 2. Cab: dark tinted cab, positioned forward toward +X (color 0x3a3a44)
  const cabGeo = new THREE.BoxGeometry(1.6, 0.75, 1.4);
  const cabMat = new THREE.MeshToonMaterial({
    color: 0x3a3a44,
  });
  const cabMesh = new THREE.Mesh(cabGeo, cabMat);
  cabMesh.position.set(0.5, 1.15, 0);
  cabMesh.castShadow = true;
  roverGroup.add(cabMesh);

  // Cab ink outline (geometry scaled 1.06)
  const cabOutlineGeo = cabGeo.clone();
  cabOutlineGeo.scale(1.06, 1.06, 1.06);
  const cabOutline = new THREE.Mesh(cabOutlineGeo, outlineMat);
  cabOutline.position.copy(cabMesh.position);
  roverGroup.add(cabOutline);

  // 3. Small Yellow Cube: the ONLY colored object on the lunar surface
  const cubeGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const cubeMat = new THREE.MeshBasicMaterial({ color: 0xFFD400 });
  const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
  cubeMesh.position.set(0.65, 1.22, 0);
  roverGroup.add(cubeMesh);

  // Small yellow point light (0xFFD400, intensity 0.6, distance 6) inside cab so cube glows
  const cubeLight = new THREE.PointLight(0xFFD400, 0.6, 6.0);
  cubeLight.position.set(0.65, 1.22, 0);
  roverGroup.add(cubeLight);

  // 4. 6 Toon Wheels: radius 0.45, cylinder aligned with Z axis
  const wheelRadius = 0.45;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.32, 20);
  wheelGeo.rotateX(Math.PI / 2); // Align axle with Z axis

  const wheelMat = new THREE.MeshToonMaterial({
    color: 0x22222a,
  });
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.34, 16);
  hubGeo.rotateX(Math.PI / 2);
  const hubMat = new THREE.MeshBasicMaterial({ color: 0x08080c });

  // Cross spokes for clearly visible wheel rotation as rover drives
  const spokeGeo = new THREE.BoxGeometry(wheelRadius * 1.5, 0.05, 0.345);
  spokeGeo.rotateX(Math.PI / 2);
  const spokeMat = new THREE.MeshBasicMaterial({ color: 0x484854 });

  const wheelOffsets = [
    { x: -1.1, z: -1.05 },
    { x:  0.0, z: -1.05 },
    { x:  1.1, z: -1.05 },
    { x: -1.1, z:  1.05 },
    { x:  0.0, z:  1.05 },
    { x:  1.1, z:  1.05 },
  ];

  const wheels = [];
  wheelOffsets.forEach((off) => {
    const wheelAnchor = new THREE.Group();
    wheelAnchor.position.set(off.x, wheelRadius, off.z);

    const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
    wMesh.castShadow = true;

    const hMesh = new THREE.Mesh(hubGeo, hubMat);
    wMesh.add(hMesh);

    const sMesh1 = new THREE.Mesh(spokeGeo, spokeMat);
    const sMesh2 = new THREE.Mesh(spokeGeo, spokeMat);
    sMesh2.rotation.z = Math.PI / 2;
    wMesh.add(sMesh1);
    wMesh.add(sMesh2);

    wheelAnchor.add(wMesh);
    roverGroup.add(wheelAnchor);
    wheels.push(wMesh);
  });

  // 5. Mast with Radar/Comms Dish
  const mastGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.8, 12);
  const mastMat = new THREE.MeshToonMaterial({ color: 0x484852 });
  const mastMesh = new THREE.Mesh(mastGeo, mastMat);
  mastMesh.position.set(-0.4, 1.3, -0.45);
  mastMesh.castShadow = true;
  roverGroup.add(mastMesh);

  const dishGeo = new THREE.ConeGeometry(0.3, 0.14, 16, 1, true);
  const dishMat = new THREE.MeshToonMaterial({ color: 0x72727e });
  const dishMesh = new THREE.Mesh(dishGeo, dishMat);
  dishMesh.position.set(-0.4, 1.72, -0.45);
  dishMesh.rotation.set(0.35, 0, -0.5); // Angled upward and forward
  dishMesh.castShadow = true;
  roverGroup.add(dishMesh);

  // 6. Solar Panel mounted on rear deck
  const solarGeo = new THREE.BoxGeometry(1.15, 0.04, 1.35);
  const solarMat = new THREE.MeshStandardMaterial({
    color: 0x181a26,
    roughness: 0.4,
    metalness: 0.8,
  });
  const solarMesh = new THREE.Mesh(solarGeo, solarMat);
  solarMesh.position.set(-0.75, 0.96, 0);
  solarMesh.rotation.z = 0.08;
  solarMesh.castShadow = true;
  roverGroup.add(solarMesh);

  scene.add(roverGroup);

  // ── 8b. Moon Lander Model Generator ──
  function createLander() {
    const landerGroup = new THREE.Group();
    const bodyGroup = new THREE.Group();
    landerGroup.add(bodyGroup);

    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
    });

    // 1. Descent Stage: CylinderGeometry(1.9, 2.1, 1.3, 8), color 0xb8b8b8, at y = 2.6
    const descentGeo = new THREE.CylinderGeometry(1.9, 2.1, 1.3, 8);
    const descentMat = new THREE.MeshToonMaterial({ color: 0xb8b8b8 });
    const descentMesh = new THREE.Mesh(descentGeo, descentMat);
    descentMesh.position.set(0, 2.6, 0);
    descentMesh.castShadow = true;
    bodyGroup.add(descentMesh);

    const descentOutlineGeo = descentGeo.clone();
    descentOutlineGeo.scale(1.05, 1.05, 1.05);
    const descentOutline = new THREE.Mesh(descentOutlineGeo, outlineMat);
    descentOutline.position.copy(descentMesh.position);
    bodyGroup.add(descentOutline);

    // 2. Cabin: CylinderGeometry(1.35, 1.5, 1.6, 8), color 0xf0f0f0, at y = 4.05
    const cabinGeo = new THREE.CylinderGeometry(1.35, 1.5, 1.6, 8);
    const cabinMat = new THREE.MeshToonMaterial({ color: 0xf0f0f0 });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 4.05, 0);
    cabinMesh.castShadow = true;
    bodyGroup.add(cabinMesh);

    const cabinOutlineGeo = cabinGeo.clone();
    cabinOutlineGeo.scale(1.05, 1.05, 1.05);
    const cabinOutline = new THREE.Mesh(cabinOutlineGeo, outlineMat);
    cabinOutline.position.copy(cabinMesh.position);
    bodyGroup.add(cabinOutline);

    // 3 small dark gray (0x333333) rectangular panels around cabin (left, back, right)
    const panelGeo = new THREE.BoxGeometry(0.5, 0.6, 0.06);
    const panelMat = new THREE.MeshToonMaterial({ color: 0x333333 });
    const panelAngles = [Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    panelAngles.forEach((angle) => {
      const pMesh = new THREE.Mesh(panelGeo, panelMat);
      pMesh.position.set(Math.sin(angle) * 1.42, 4.05, Math.cos(angle) * 1.42);
      pMesh.rotation.y = angle;
      pMesh.castShadow = true;
      bodyGroup.add(pMesh);
    });

    // 3. Window on cabin +Z face with small yellow cube inside (ONLY colored object)
    const windowGroup = new THREE.Group();
    windowGroup.position.set(0, 4.05, 1.42);

    const windowFrameGeo = new THREE.BoxGeometry(0.65, 0.55, 0.06);
    const windowFrameMat = new THREE.MeshBasicMaterial({ color: 0x0a1a2a });
    const windowFrameMesh = new THREE.Mesh(windowFrameGeo, windowFrameMat);
    windowFrameMesh.position.set(0, 0, 0.01);
    windowGroup.add(windowFrameMesh);

    const cubeGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const cubeMat = new THREE.MeshBasicMaterial({ color: 0xFFD400 });
    const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
    cubeMesh.position.set(0, 0, 0.12);
    windowGroup.add(cubeMesh);
    bodyGroup.add(windowGroup);

    // 4. Engine Bell: ConeGeometry(0.9, 1.2, 16, 1, true), color 0x333333, at y = 1.55, pointing down
    const bellGeo = new THREE.ConeGeometry(0.9, 1.2, 16, 1, true);
    const bellMat = new THREE.MeshToonMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
    });
    const bellMesh = new THREE.Mesh(bellGeo, bellMat);
    bellMesh.position.set(0, 1.55, 0);
    bellMesh.castShadow = true;
    bodyGroup.add(bellMesh);

    // Engine Flame under the bell (bell rim at y = 0.95)
    const flameGroup = new THREE.Group();
    flameGroup.position.set(0, 0.95, 0);

    const innerFlameGeo = new THREE.ConeGeometry(0.48, 1.0, 16);
    innerFlameGeo.rotateX(Math.PI);
    innerFlameGeo.translate(0, -0.5, 0);
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    flameGroup.add(innerFlame);

    const outerFlameGeo = new THREE.ConeGeometry(0.75, 1.0, 16);
    outerFlameGeo.rotateX(Math.PI);
    outerFlameGeo.translate(0, -0.5, 0);
    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outerFlame = new THREE.Mesh(outerFlameGeo, outerFlameMat);
    flameGroup.add(outerFlame);
    flameGroup.visible = false;
    bodyGroup.add(flameGroup);

    // 4 RCS point puffs at cabin corners (visible between pL 0.05 and 0.85)
    const rcsPuffs = [];
    const rcsMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const rcsGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const rcsAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
    rcsAngles.forEach((angle) => {
      const rcs = new THREE.Mesh(rcsGeo, rcsMat);
      rcs.position.set(Math.sin(angle) * 1.48, 4.75, Math.cos(angle) * 1.48);
      rcs.visible = false;
      bodyGroup.add(rcs);
      rcsPuffs.push(rcs);
    });

    // 5. Antenna on top of the cabin (y = 4.85)
    const mastGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.4, 12);
    const mastMat = new THREE.MeshToonMaterial({ color: 0x888888 });
    const mastMesh = new THREE.Mesh(mastGeo, mastMat);
    mastMesh.position.set(0.3, 5.55, -0.2);
    mastMesh.castShadow = true;
    bodyGroup.add(mastMesh);

    const dishGeo = new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.4);
    const dishMat = new THREE.MeshToonMaterial({
      color: 0xcccccc,
      side: THREE.DoubleSide,
    });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.position.set(0.3, 6.25, -0.2);
    dishMesh.rotation.set(-0.4, 0, 0.3);
    dishMesh.castShadow = true;
    bodyGroup.add(dishMesh);

    // 6. Four legs at 45, 135, 225, 315 degrees around Y
    const legPivots = [];
    const legAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];

    const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 3.6, 12);
    legGeo.translate(0, -1.8, 0); // Origin at top pivot, runs down to y = -3.6
    const legMat = new THREE.MeshToonMaterial({ color: 0x888888 });

    const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8);
    strutGeo.translate(0, -0.7, 0);
    const strutMat = new THREE.MeshToonMaterial({ color: 0x666666 });

    const padGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16);
    const padMat = new THREE.MeshToonMaterial({ color: 0xcccccc });

    const padOutlineGeo = padGeo.clone();
    padOutlineGeo.scale(1.05, 1.05, 1.05);

    legAngles.forEach((angle) => {
      const legAnchor = new THREE.Group();
      legAnchor.rotation.y = angle;

      const pivot = new THREE.Group();
      pivot.position.set(1.6, 3.11, 0);

      const legMesh = new THREE.Mesh(legGeo, legMat);
      legMesh.castShadow = true;
      pivot.add(legMesh);

      const strutMesh = new THREE.Mesh(strutGeo, strutMat);
      strutMesh.position.set(0.25, -1.0, 0);
      strutMesh.rotation.z = 0.45;
      strutMesh.castShadow = true;
      pivot.add(strutMesh);

      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set(0, -3.6, 0);
      padMesh.castShadow = true;
      pivot.add(padMesh);

      const padOutline = new THREE.Mesh(padOutlineGeo, outlineMat);
      padOutline.position.copy(padMesh.position);
      pivot.add(padOutline);

      legAnchor.add(pivot);
      landerGroup.add(legAnchor);
      legPivots.push(pivot);
    });

    landerGroup.userData = {
      bodyGroup,
      legs: legPivots,
      flameGroup,
      innerFlame,
      outerFlame,
      rcsPuffs,
      geometries: [
        descentGeo, descentOutlineGeo, cabinGeo, cabinOutlineGeo,
        panelGeo, windowFrameGeo, cubeGeo, bellGeo,
        innerFlameGeo, outerFlameGeo, rcsGeo, mastGeo, dishGeo,
        legGeo, strutGeo, padGeo, padOutlineGeo,
      ],
      materials: [
        outlineMat, descentMat, cabinMat, panelMat, windowFrameMat, cubeMat,
        bellMat, innerFlameMat, outerFlameMat, rcsMat, mastMat, dishMat,
        legMat, strutMat, padMat,
      ],
    };

    return landerGroup;
  }

  // ── 8c. Landing Lander Instance (Standing on ground at LANDER_X, LANDER_Z) ──
  const lander = createLander();
  const {
    bodyGroup: landerBodyGroup,
    legs: landerLegs,
    flameGroup: landerFlameGroup,
    innerFlame: landerInnerFlame,
    outerFlame: landerOuterFlame,
    rcsPuffs: landerRcsPuffs,
  } = lander.userData;
  const landerGroundY = getHeight(LANDER_X, LANDER_Z);
  lander.position.set(LANDER_X, landerGroundY + 60.0, LANDER_Z);
  scene.add(lander);

  // ── 8d. Landing Dust Burst & Shock Ring (Active during pL 0.9 to 1.0, haze to pT 0.05) ──
  const LANDING_DUST_COUNT = 60;
  const landingDustPositions = new Float32Array(LANDING_DUST_COUNT * 3);
  const landingDustColors = new Float32Array(LANDING_DUST_COUNT * 3);
  const landingDustRNG = createSeededRNG(4411);
  const landingDustData = [];

  for (let i = 0; i < LANDING_DUST_COUNT; i++) {
    const angle = (i / LANDING_DUST_COUNT) * Math.PI * 2 + (landingDustRNG() - 0.5) * 0.25;
    const speed = 0.5 + landingDustRNG() * 0.5;
    const loft = 0.2 + landingDustRNG() * 0.6; // flatter horizontal burst
    landingDustData.push({
      dirX: Math.cos(angle),
      dirZ: Math.sin(angle),
      speed,
      loft,
    });
  }

  const landingDustGeo = new THREE.BufferGeometry();
  landingDustGeo.setAttribute('position', new THREE.BufferAttribute(landingDustPositions, 3));
  landingDustGeo.setAttribute('color', new THREE.BufferAttribute(landingDustColors, 3));

  const landingDustMat = new THREE.PointsMaterial({
    size: 0.28,
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  const landingDustPoints = new THREE.Points(landingDustGeo, landingDustMat);
  landingDustPoints.visible = false;
  scene.add(landingDustPoints);

  // Flat gray RingGeometry under engine (scaling 1 to 14, opacity 0.5 to 0)
  const landingRingGeo = new THREE.RingGeometry(0.8, 1.1, 48);
  landingRingGeo.rotateX(-Math.PI / 2);
  const landingRingMat = new THREE.MeshBasicMaterial({
    color: 0xaaaaaa,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const landingRingMesh = new THREE.Mesh(landingRingGeo, landingRingMat);
  landingRingMesh.position.set(LANDER_X, landerGroundY + 0.03, LANDER_Z);
  landingRingMesh.visible = false;
  scene.add(landingRingMesh);

  // ── 9. Lunar Dust (Pool of 80 gray THREE.Points, size 0.15) ──
  const DUST_COUNT = 80;
  const DUST_LIFETIME = 0.04;
  const dustRng = createSeededRNG(5521);
  const dustData = [];

  for (let i = 0; i < DUST_COUNT; i++) {
    const birth = dustRng(); // birth progress in [0, 1]
    const birthRoverX = -10.0 + 220.0 * birth;
    const wheelSide = dustRng() < 0.5 ? 1.05 : -1.05;
    const birthWheelX = birthRoverX - 1.1;
    const birthWheelZ = wheelSide;
    const birthWheelY = getHeight(birthWheelX, birthWheelZ) + 0.05;

    // Fixed drift vector: puffs backward and upward
    const driftX = -0.5 - dustRng() * 0.7;
    const driftY = 0.35 + dustRng() * 0.75;
    const driftZ = (dustRng() - 0.5) * 0.5;

    dustData.push({
      birth,
      originX: birthWheelX,
      originY: birthWheelY,
      originZ: birthWheelZ,
      driftX,
      driftY,
      driftZ,
    });
  }

  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  const dustColors = new Float32Array(DUST_COUNT * 3);

  for (let i = 0; i < DUST_COUNT; i++) {
    dustPositions[i * 3 + 1] = -9999;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));

  const dustMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.15,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  scene.add(dustPoints);

  // ── 10. Project Train Carriers & HTML Cards ──
  const carrierFlatbedGeo = new THREE.BoxGeometry(5.5, 0.35, 3.0);
  const carrierFlatbedMat = new THREE.MeshToonMaterial({ color: 0xdcdcdc });

  const carrierFlatbedOutlineGeo = carrierFlatbedGeo.clone();
  carrierFlatbedOutlineGeo.scale(1.04, 1.18, 1.04);

  const hitchGeo = new THREE.BoxGeometry(3.0, 0.12, 0.12);
  const hitchMat = new THREE.MeshToonMaterial({ color: 0x333333 });

  const poleGeo = new THREE.BoxGeometry(0.08, 2.6, 0.08);
  const topBarGeo = new THREE.BoxGeometry(0.12, 0.08, 1.8);
  const frameMat = new THREE.MeshToonMaterial({ color: 0x484852 });

  const cWheelRadius = 0.35;
  const cWheelGeo = new THREE.CylinderGeometry(cWheelRadius, cWheelRadius, 0.28, 16);
  cWheelGeo.rotateX(Math.PI / 2);
  const cWheelMat = new THREE.MeshToonMaterial({ color: 0x22222a });

  const cSpokeGeo = new THREE.BoxGeometry(cWheelRadius * 1.5, 0.05, 0.3);
  cSpokeGeo.rotateX(Math.PI / 2);
  const cSpokeMat = new THREE.MeshBasicMaterial({ color: 0x55555f });

  const cWheelOffsets = [
    { x: -1.8, z: -1.65 },
    { x:  1.8, z: -1.65 },
    { x: -1.8, z:  1.65 },
    { x:  1.8, z:  1.65 },
  ];

  const carrierGroups = [];
  const carrierWheels = [];
  const carrierTopBarMats = [];
  const cardsData = [];
  const trainObjects = []; // collect all carrier groups and hitch bars for visibility toggling

  for (let i = 0; i < projectsData.length; i++) {
    const proj = projectsData[i];
    const cGroup = new THREE.Group();

    // 1. Flatbed (BoxGeometry 5.5 x 0.35 x 3, color 0xdcdcdc, y = 0.9)
    const flatbedMesh = new THREE.Mesh(carrierFlatbedGeo, carrierFlatbedMat);
    flatbedMesh.position.set(0, 0.9, 0);
    flatbedMesh.castShadow = true;
    flatbedMesh.receiveShadow = true;
    cGroup.add(flatbedMesh);

    // Flatbed ink outline
    const flatbedOutline = new THREE.Mesh(carrierFlatbedOutlineGeo, outlineMat);
    flatbedOutline.position.copy(flatbedMesh.position);
    cGroup.add(flatbedOutline);

    // 2. Upright Frame (Two poles and emissive glowing top bar) at center of flatbed as card mount
    const pole1 = new THREE.Mesh(poleGeo, frameMat);
    pole1.position.set(0, 2.2, -0.9);
    pole1.castShadow = true;
    cGroup.add(pole1);

    const pole2 = new THREE.Mesh(poleGeo, frameMat);
    pole2.position.set(0, 2.2, 0.9);
    pole2.castShadow = true;
    cGroup.add(pole2);

    // Emissive yellow top bar (#FFD400) between the two poles
    const topBarMat = new THREE.MeshStandardMaterial({
      color: 0x33333a,
      emissive: new THREE.Color(0xFFD400),
      emissiveIntensity: 0.1,
      roughness: 0.4,
      metalness: 0.2,
    });
    const topBarMesh = new THREE.Mesh(topBarGeo, topBarMat);
    topBarMesh.position.set(0, 3.5, 0);
    topBarMesh.castShadow = true;
    cGroup.add(topBarMesh);
    carrierTopBarMats.push(topBarMat);

    // 3. Hitch Bar connecting to unit in front (rover or previous carrier)
    const hitchMesh = new THREE.Mesh(hitchGeo, hitchMat);
    hitchMesh.position.set(4.25, 0.65, 0);
    hitchMesh.castShadow = true;
    cGroup.add(hitchMesh);
    trainObjects.push(hitchMesh);

    // 4. Four small wheels that rotate with distance
    cWheelOffsets.forEach((off) => {
      const wAnchor = new THREE.Group();
      wAnchor.position.set(off.x, cWheelRadius, off.z);

      const wMesh = new THREE.Mesh(cWheelGeo, cWheelMat);
      wMesh.castShadow = true;

      const sp1 = new THREE.Mesh(cSpokeGeo, cSpokeMat);
      const sp2 = new THREE.Mesh(cSpokeGeo, cSpokeMat);
      sp2.rotation.z = Math.PI / 2;
      wMesh.add(sp1);
      wMesh.add(sp2);

      wAnchor.add(wMesh);
      cGroup.add(wAnchor);
      carrierWheels.push(wMesh);
    });

    scene.add(cGroup);
    carrierGroups.push(cGroup);
    trainObjects.push(cGroup);

    // 5. Real HTML Card Element
    const card = document.createElement('article');
    card.className = 'moon-card';
    card.setAttribute('aria-label', proj.title);
    card.setAttribute('aria-hidden', 'true');

    const cornerTR = document.createElement('div');
    cornerTR.className = 'hud-corner-tr';
    cornerTR.setAttribute('aria-hidden', 'true');
    const cornerBL = document.createElement('div');
    cornerBL.className = 'hud-corner-bl';
    cornerBL.setAttribute('aria-hidden', 'true');

    const header = document.createElement('header');
    header.className = 'moon-card-header';
    const indexSpan = document.createElement('span');
    indexSpan.className = 'moon-card-index';
    indexSpan.textContent = `// PROJECT 0${i + 1}`;
    const titleEl = document.createElement('h3');
    titleEl.className = 'moon-card-title';
    titleEl.textContent = proj.title;
    header.appendChild(indexSpan);
    header.appendChild(titleEl);

    const descEl = document.createElement('p');
    descEl.className = 'moon-card-desc';
    descEl.textContent = proj.description;

    const tagsEl = document.createElement('div');
    tagsEl.className = 'moon-card-tags';
    proj.tags.forEach((tag) => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'moon-tag';
      tagSpan.textContent = tag;
      tagsEl.appendChild(tagSpan);
    });

    const footer = document.createElement('div');
    footer.className = 'moon-card-footer';
    const linkBtn = document.createElement('a');
    const targetUrl = (proj.link && proj.link.trim() !== '' && proj.link.trim() !== '#') ? proj.link : 'https://github.com/ashwin-kumaar-b';
    linkBtn.href = targetUrl;
    linkBtn.target = '_blank';
    linkBtn.rel = 'noopener noreferrer';
    linkBtn.className = 'moon-card-btn';
    linkBtn.textContent = 'EXPLORE →';
    linkBtn.setAttribute('aria-label', `Explore ${proj.title}`);
    linkBtn.tabIndex = -1;
    footer.appendChild(linkBtn);

    card.appendChild(cornerTR);
    card.appendChild(cornerBL);
    card.appendChild(header);
    card.appendChild(descEl);
    card.appendChild(tagsEl);
    card.appendChild(footer);

    // Connector line from card bottom edge down to frame top with 6px dot
    const connector = document.createElement('div');
    connector.className = 'moon-card-connector';
    connector.setAttribute('aria-hidden', 'true');
    const dot = document.createElement('div');
    dot.className = 'moon-card-dot';
    connector.appendChild(dot);
    card.appendChild(connector);

    cardsContainer.appendChild(card);

    cardsData.push({
      card,
      link: linkBtn,
    });
  }

  // ── 10B. Lunar Base 3D Model ──
  const baseGroup = new THREE.Group();

  // MeshToonMaterial 0xe0e0e0 with ink outlines like the rover
  const baseMat = new THREE.MeshToonMaterial({
    color: 0xe0e0e0,
  });

  // 1. Main Dome: half SphereGeometry radius 9 centered at (BASE_X, 0, -18)
  const mainDomeGeo = new THREE.SphereGeometry(9, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const mainDomeMesh = new THREE.Mesh(mainDomeGeo, baseMat);
  mainDomeMesh.position.set(BASE_X, 0, -18);
  mainDomeMesh.castShadow = true;
  mainDomeMesh.receiveShadow = true;
  baseGroup.add(mainDomeMesh);

  // Main dome ink outline (scaled 1.03)
  const mainDomeOutlineGeo = mainDomeGeo.clone();
  mainDomeOutlineGeo.scale(1.03, 1.03, 1.03);
  const mainDomeOutline = new THREE.Mesh(mainDomeOutlineGeo, outlineMat);
  mainDomeOutline.position.copy(mainDomeMesh.position);
  baseGroup.add(mainDomeOutline);

  // 2. Smaller Dome: radius 5 at (BASE_X + 16, 0, -20)
  const smallDomeGeo = new THREE.SphereGeometry(5, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const smallDomeMesh = new THREE.Mesh(smallDomeGeo, baseMat);
  smallDomeMesh.position.set(BASE_X + 16, 0, -20);
  smallDomeMesh.castShadow = true;
  smallDomeMesh.receiveShadow = true;
  baseGroup.add(smallDomeMesh);

  // Smaller dome ink outline (scaled 1.04)
  const smallDomeOutlineGeo = smallDomeGeo.clone();
  smallDomeOutlineGeo.scale(1.04, 1.04, 1.04);
  const smallDomeOutline = new THREE.Mesh(smallDomeOutlineGeo, outlineMat);
  smallDomeOutline.position.copy(smallDomeMesh.position);
  baseGroup.add(smallDomeOutline);

  // 3. Connecting Tube: cylinder radius 1.6 on its side between them
  const tubeGeo = new THREE.CylinderGeometry(1.6, 1.6, 16.2, 20);
  tubeGeo.rotateZ(Math.PI / 2); // Align along X axis
  const tubeMesh = new THREE.Mesh(tubeGeo, baseMat);
  tubeMesh.position.set(BASE_X + 8, 1.2, -19);
  tubeMesh.rotation.y = Math.atan2(-2, 16);
  tubeMesh.castShadow = true;
  tubeMesh.receiveShadow = true;
  baseGroup.add(tubeMesh);

  // Tube ink outline (scaled 1.05)
  const tubeOutlineGeo = tubeGeo.clone();
  tubeOutlineGeo.scale(1.05, 1.01, 1.05);
  const tubeOutline = new THREE.Mesh(tubeOutlineGeo, outlineMat);
  tubeOutline.position.copy(tubeMesh.position);
  tubeOutline.rotation.copy(tubeMesh.rotation);
  baseGroup.add(tubeOutline);

  // 4. Antenna Mast (height 10) on main dome with small white sphere on top
  const mastBaseGeo = new THREE.CylinderGeometry(0.12, 0.12, 10, 12);
  const mastBaseMat = new THREE.MeshToonMaterial({ color: 0x33333a });
  const mastBaseMesh = new THREE.Mesh(mastBaseGeo, mastBaseMat);
  mastBaseMesh.position.set(BASE_X, 9 + 5, -18);
  baseGroup.add(mastBaseMesh);

  const antennaSphereGeo = new THREE.SphereGeometry(0.5, 16, 12);
  const antennaLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.0,
  });
  const antennaSphereMesh = new THREE.Mesh(antennaSphereGeo, antennaLightMat);
  antennaSphereMesh.position.set(BASE_X, 19 + 0.35, -18);
  baseGroup.add(antennaSphereMesh);

  // 5. Airlock: Recessed doorway with 3 dark inner walls forming a 3-unit-deep tunnel into dome
  const tunnelWallMat = new THREE.MeshToonMaterial({ color: 0x111111 });
  const tunnelWallSideGeo = new THREE.BoxGeometry(0.2, 3.8, 3.0);
  const tunnelWallTopGeo = new THREE.BoxGeometry(3.6, 0.2, 3.0);

  // Left inner wall
  const tunnelLeftWall = new THREE.Mesh(tunnelWallSideGeo, tunnelWallMat);
  tunnelLeftWall.position.set(BASE_X - 1.7, 1.9, -10.5);
  tunnelLeftWall.receiveShadow = true;
  baseGroup.add(tunnelLeftWall);

  // Right inner wall
  const tunnelRightWall = new THREE.Mesh(tunnelWallSideGeo, tunnelWallMat);
  tunnelRightWall.position.set(BASE_X + 1.7, 1.9, -10.5);
  tunnelRightWall.receiveShadow = true;
  baseGroup.add(tunnelRightWall);

  // Ceiling inner wall
  const tunnelTopWall = new THREE.Mesh(tunnelWallTopGeo, tunnelWallMat);
  tunnelTopWall.position.set(BASE_X, 3.9, -10.5);
  tunnelTopWall.receiveShadow = true;
  baseGroup.add(tunnelTopWall);

  // Glowing yellow plane (MeshBasicMaterial 0xFFD400) at back of tunnel
  const gatePlaneGeo = new THREE.PlaneGeometry(3.2, 3.8);
  const gateMat = new THREE.MeshBasicMaterial({
    color: 0xFFD400,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  gateMat.emissiveIntensity = 0.2;
  const gatePlaneMesh = new THREE.Mesh(gatePlaneGeo, gateMat);
  gatePlaneMesh.position.set(BASE_X, 1.9, -11.95); // Back of 3-unit tunnel
  baseGroup.add(gatePlaneMesh);

  // Thick frame (0.6 wide) around opening made of alternating yellow and black blocks (hazard stripes) with ink outline
  const stripeYellowMat = new THREE.MeshToonMaterial({ color: 0xFFD400 });
  const stripeBlackMat = new THREE.MeshToonMaterial({ color: 0x111111 });

  // Left jamb: 8 alternating blocks from y = 0 to 4.4, width 0.6, depth 0.5
  const jambBlockGeo = new THREE.BoxGeometry(0.6, 0.55, 0.5);
  for (let k = 0; k < 8; k++) {
    const isYellow = k % 2 === 0;
    const blockMesh = new THREE.Mesh(jambBlockGeo, isYellow ? stripeYellowMat : stripeBlackMat);
    blockMesh.position.set(BASE_X - 1.9, 0.275 + k * 0.55, -8.75);
    baseGroup.add(blockMesh);
  }

  // Right jamb: 8 alternating blocks from y = 0 to 4.4, width 0.6, depth 0.5
  for (let k = 0; k < 8; k++) {
    const isYellow = k % 2 === 1;
    const blockMesh = new THREE.Mesh(jambBlockGeo, isYellow ? stripeYellowMat : stripeBlackMat);
    blockMesh.position.set(BASE_X + 1.9, 0.275 + k * 0.55, -8.75);
    baseGroup.add(blockMesh);
  }

  // Header: 8 alternating blocks from x = BASE_X - 2.2 to BASE_X + 2.2, height 0.6, depth 0.5
  const headerBlockGeo = new THREE.BoxGeometry(0.55, 0.6, 0.5);
  for (let k = 0; k < 8; k++) {
    const isYellow = k % 2 === 0;
    const blockMesh = new THREE.Mesh(headerBlockGeo, isYellow ? stripeYellowMat : stripeBlackMat);
    blockMesh.position.set(BASE_X - 1.925 + k * 0.55, 4.1, -8.75);
    baseGroup.add(blockMesh);
  }

  // Ink outlines for hazard frame
  const jambOutlineGeo = new THREE.BoxGeometry(0.66, 4.46, 0.54);
  const leftJambOutline = new THREE.Mesh(jambOutlineGeo, outlineMat);
  leftJambOutline.position.set(BASE_X - 1.9, 2.2, -8.75);
  baseGroup.add(leftJambOutline);

  const rightJambOutline = new THREE.Mesh(jambOutlineGeo, outlineMat);
  rightJambOutline.position.set(BASE_X + 1.9, 2.2, -8.75);
  baseGroup.add(rightJambOutline);

  const headerOutlineGeo = new THREE.BoxGeometry(4.46, 0.66, 0.54);
  const headerOutline = new THREE.Mesh(headerOutlineGeo, outlineMat);
  headerOutline.position.set(BASE_X, 4.1, -8.75);
  baseGroup.add(headerOutline);

  // 6. Light Spill: PointLight just outside doorway + ground-light quad
  const doorLight = new THREE.PointLight(0xFFD400, 2.5, 22, 2);
  doorLight.position.set(BASE_X, 1.8, -8.2);
  baseGroup.add(doorLight);

  // Canvas-gradient alphaMap (opaque at door z = -9, transparent at far end z = +3)
  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = 128;
  alphaCanvas.height = 256;
  const alphaCtx = alphaCanvas.getContext('2d');
  const alphaGrad = alphaCtx.createLinearGradient(0, 0, 0, 256);
  alphaGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  alphaGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.8)');
  alphaGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.25)');
  alphaGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  alphaCtx.fillStyle = alphaGrad;
  alphaCtx.fillRect(0, 0, 128, 256);

  const groundAlphaMap = new THREE.CanvasTexture(alphaCanvas);

  const groundLightGeo = new THREE.PlaneGeometry(7, 12);
  groundLightGeo.rotateX(-Math.PI / 2);
  const groundLightMat = new THREE.MeshBasicMaterial({
    color: 0xFFD400,
    alphaMap: groundAlphaMap,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const groundLightMesh = new THREE.Mesh(groundLightGeo, groundLightMat);
  groundLightMesh.position.set(BASE_X, 0.05, -3.0); // Starts at door z = -9, extends 12 units to z = +3
  baseGroup.add(groundLightMesh);

  // 7. Dome Detail: 3 thin black ring lines around main dome at different heights
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x050508 });
  const ringGeo1 = new THREE.TorusGeometry(8.616, 0.06, 8, 54);
  ringGeo1.rotateX(Math.PI / 2);
  const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat);
  ringMesh1.position.set(BASE_X, 2.6, -18);
  baseGroup.add(ringMesh1);

  const ringGeo2 = new THREE.TorusGeometry(7.346, 0.06, 8, 54);
  ringGeo2.rotateX(Math.PI / 2);
  const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat);
  ringMesh2.position.set(BASE_X, 5.2, -18);
  baseGroup.add(ringMesh2);

  const ringGeo3 = new THREE.TorusGeometry(5.122, 0.06, 8, 54);
  ringGeo3.rotateX(Math.PI / 2);
  const ringMesh3 = new THREE.Mesh(ringGeo3, ringMat);
  ringMesh3.position.set(BASE_X, 7.4, -18);
  baseGroup.add(ringMesh3);

  // 8. 8 Larger Windows (1.2 x 0.6) arranged in a row around the main dome
  const windowGeo = new THREE.BoxGeometry(1.2, 0.6, 0.15);
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: 0xFFD400,
    emissiveIntensity: 0.2,
    roughness: 0.3,
  });

  const WINDOW_COUNT = 8;
  const winArcSpan = 2.26; // Radians span across front of dome
  const winRadius = 7.2;   // Horizontal radius of dome at height y = 5.4 (sqrt(9^2 - 5.4^2) = 7.2)
  const winHeight = 5.4;

  for (let k = 0; k < WINDOW_COUNT; k++) {
    const theta = -winArcSpan * 0.5 + (k / (WINDOW_COUNT - 1)) * winArcSpan;
    const winMesh = new THREE.Mesh(windowGeo, windowMat);
    winMesh.position.set(
      BASE_X + winRadius * Math.sin(theta),
      winHeight,
      -18.0 + winRadius * Math.cos(theta)
    );
    winMesh.rotation.y = theta;
    baseGroup.add(winMesh);
  }

  // 7. Flat pad disc under entrance with white landing stripes
  const padDiscGeo = new THREE.CylinderGeometry(7.0, 7.0, 0.08, 36);
  const padDiscMat = new THREE.MeshToonMaterial({ color: 0x2e2e34 });
  const padDiscMesh = new THREE.Mesh(padDiscGeo, padDiscMat);
  padDiscMesh.position.set(BASE_X, 0.04, -7.0);
  padDiscMesh.receiveShadow = true;
  baseGroup.add(padDiscMesh);

  const stripeGeo = new THREE.PlaneGeometry(0.35, 3.2);
  stripeGeo.rotateX(-Math.PI / 2);
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
  [-1.3, 0.0, 1.3].forEach((off) => {
    const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
    stripeMesh.position.set(BASE_X + off, 0.09, -7.0);
    baseGroup.add(stripeMesh);
  });

  scene.add(baseGroup);

  // ── 11. Render Function (All motion derived from scroll progress p only) ──
  const projVec = new THREE.Vector3();

  function renderScene(p = 0) {
    // Phase splits: pL in [0, 1] during landing intro (p <= LAND_END),
    // pT in [0, 1] during train phase (LAND_END <= p <= TRAIN_END),
    // pB in [0, 1] during base entrance and pull-back (p >= TRAIN_END)
    const pL = Math.max(0, Math.min(1, p / LAND_END));
    const pT = Math.max(0, Math.min(1, (p - LAND_END) / (TRAIN_END - LAND_END)));
    const pB = Math.max(0, Math.min(1, (p - TRAIN_END) / (1.0 - TRAIN_END)));

    // 0. Moon Lander & Dust Animation
    let landerY = landerGroundY;
    let swayX = 0;
    if (pL < 1.0) {
      landerY = landerGroundY + 60.0 * Math.pow(1.0 - pL, 2.4);
      swayX = Math.sin(pL * 120.0) * 0.15;
    }
    lander.position.set(LANDER_X + swayX, landerY, LANDER_Z);
    lander.visible = true;

    // Leg deploy: 6 deg at pL = 0 to 32 deg at pL = 0.45 (ease-out)
    const tDeploy = Math.min(1.0, pL / 0.45);
    const easeDeploy = 1.0 - Math.pow(1.0 - tDeploy, 2);
    let legAngleDeg = 6.0 + 26.0 * easeDeploy;

    // Touchdown spring compression and leg flex at pL 0.96 to 1.0
    let bodySpringY = 0;
    if (pL >= 0.96 && pL <= 1.0) {
      const tSpring = (pL - 0.96) / 0.04;
      const sinSpring = Math.sin(Math.PI * tSpring);
      bodySpringY = -0.25 * sinSpring;
      legAngleDeg += 2.5 * sinSpring;
    }
    landerBodyGroup.position.y = bodySpringY;

    const legAngleRad = THREE.MathUtils.degToRad(legAngleDeg);
    for (let i = 0; i < landerLegs.length; i++) {
      landerLegs[i].rotation.z = -legAngleRad;
    }

    // Engine flame: length 3.5 * (1 - pL) + 0.5 with sin(pL * 400), cut off at pL >= 0.96
    if (pL < 0.96) {
      landerFlameGroup.visible = true;
      const flameLen = (LANDER_MAX_FLAME_LEN * (1.0 - pL) + 0.5) * (1.0 + 0.08 * Math.sin(pL * 400.0));
      landerInnerFlame.scale.set(1.0, Math.max(0.01, flameLen), 1.0);
      landerOuterFlame.scale.set(1.2, Math.max(0.01, flameLen * 1.15), 1.2);
    } else {
      landerFlameGroup.visible = false;
    }

    // RCS puffs: visible when sin(pL * 90 + i) > 0.7 between pL 0.05 and 0.85
    if (pL >= 0.05 && pL <= 0.85) {
      for (let i = 0; i < 4; i++) {
        landerRcsPuffs[i].visible = Math.sin(pL * 90.0 + i) > 0.7;
      }
    } else {
      for (let i = 0; i < 4; i++) {
        landerRcsPuffs[i].visible = false;
      }
    }

    // Landing dust burst from pL 0.90 to 1.0, centered under engine
    if (pL >= 0.90 && pL < 1.0) {
      const tL = (pL - 0.90) / 0.10;
      const burstRadius = 14.0 * tL;
      const fade = 1.0 - tL * 0.75; // reaches 0.25 at pL = 1.0

      for (let i = 0; i < LANDING_DUST_COUNT; i++) {
        const pD = landingDustData[i];
        const r = burstRadius * pD.speed;
        const px = LANDER_X + pD.dirX * r;
        const pz = LANDER_Z + pD.dirZ * r;
        const py = getHeight(px, pz) + 0.04 + pD.loft * Math.sin(tL * Math.PI) * 0.35;

        landingDustPositions[i * 3]     = px;
        landingDustPositions[i * 3 + 1] = py;
        landingDustPositions[i * 3 + 2] = pz;

        const c = 0.667 * fade;
        landingDustColors[i * 3]     = c;
        landingDustColors[i * 3 + 1] = c;
        landingDustColors[i * 3 + 2] = c;
      }
      landingDustGeo.attributes.position.needsUpdate = true;
      landingDustGeo.attributes.color.needsUpdate = true;
      landingDustPoints.visible = true;

      const ringScale = 1.0 + 13.0 * tL;
      landingRingMesh.scale.set(ringScale, 1.0, ringScale);
      landingRingMat.opacity = 0.5 * (1.0 - tL);
      landingRingMesh.visible = true;
    } else if (pL >= 1.0 && pT <= 0.05) {
      // Faint low haze (opacity 0.25 fading to 0 by pT = 0.05)
      const hazeT = pT / 0.05;
      const hazeOpacity = 0.25 * (1.0 - hazeT);

      for (let i = 0; i < LANDING_DUST_COUNT; i++) {
        const pD = landingDustData[i];
        const r = 14.0 * pD.speed;
        const px = LANDER_X + pD.dirX * r;
        const pz = LANDER_Z + pD.dirZ * r;
        const py = getHeight(px, pz) + 0.04 + pD.loft * 0.08 * (1.0 - hazeT);

        landingDustPositions[i * 3]     = px;
        landingDustPositions[i * 3 + 1] = py;
        landingDustPositions[i * 3 + 2] = pz;

        const c = 0.667 * hazeOpacity;
        landingDustColors[i * 3]     = c;
        landingDustColors[i * 3 + 1] = c;
        landingDustColors[i * 3 + 2] = c;
      }
      landingDustGeo.attributes.position.needsUpdate = true;
      landingDustGeo.attributes.color.needsUpdate = true;
      landingDustPoints.visible = hazeOpacity > 0.001;
      landingRingMesh.visible = false;
    } else {
      landingDustPoints.visible = false;
      landingRingMesh.visible = false;
    }

    // 1. Rover motion along straight path or Bezier curve entrance
    const roverBaseX = -10.0 + 220.0 * pT;
    let roverX, roverY, roverZ;
    let distanceTravelled = 220.0 * pT;

    if (pL < 1.0) {
      roverX = roverBaseX;
      roverZ = 0.0;
      roverY = getHeight(roverX, roverZ);
      roverGroup.position.set(roverX, roverY, roverZ);
      roverGroup.visible = false;
      roverGroup.scale.set(0.01, 0.01, 0.01);
      roverGroup.rotation.y = 0.0;
    } else if (pB <= 0.0) {
      roverX = roverBaseX;
      roverZ = 0.0;
      const groundY = getHeight(roverX, roverZ);
      const bob = Math.sin(pT * 500.0) * 0.03;
      roverY = groundY + bob;
      roverGroup.position.set(roverX, roverY, roverZ);
      roverGroup.visible = true;
      roverGroup.rotation.y = 0.0;

      // Deploy beside rocket: scale from 0.01 to 1 over first 5% of pT
      const roverDeployT = Math.min(1.0, pT / 0.05);
      const roverScale = 0.01 + 0.99 * roverDeployT;
      roverGroup.scale.set(roverScale, roverScale, roverScale);
    } else if (pB < 0.4) {
      // 3. Rover Entrance: follows quadratic Bezier curve from (BASE_X - 16, y, 0) via (BASE_X, y, 0) to (BASE_X, y, -10)
      const t = pB / 0.4;
      const p0x = BASE_X - 16.0;
      const p0z = 0.0;
      const p1x = BASE_X;
      const p1z = 0.0;
      const p2x = BASE_X;
      const p2z = -10.0;

      const omt = 1.0 - t;
      roverX = omt * omt * p0x + 2.0 * omt * t * p1x + t * t * p2x;
      roverZ = omt * omt * p0z + 2.0 * omt * t * p1z + t * t * p2z;
      const groundY = getHeight(roverX, roverZ);
      const bob = Math.sin(pT * 500.0 + t * 40.0) * 0.03;
      roverY = groundY + bob;

      // Heading aligned with curve tangent: B'(t) = 2(1-t)(P1 - P0) + 2t(P2 - P1)
      const tanX = 2.0 * omt * (p1x - p0x) + 2.0 * t * (p2x - p1x);
      const tanZ = 2.0 * omt * (p1z - p0z) + 2.0 * t * (p2z - p1z);
      const roverHeading = Math.atan2(-tanZ, tanX);
      roverGroup.rotation.y = roverHeading;

      // Wheels still rotating with distance (curve arc length ~22.4 units)
      distanceTravelled += 22.4 * t;
      roverGroup.position.set(roverX, roverY, roverZ);
      roverGroup.scale.set(1.0, 1.0, 1.0);
      roverGroup.visible = true;
    } else {
      // At pB >= 0.4 the rover enters the gate and is made invisible
      roverX = BASE_X;
      roverZ = -10.0;
      roverY = 0.0;
      distanceTravelled += 22.4;
      roverGroup.position.set(roverX, roverY, roverZ);
      roverGroup.visible = false;
    }

    // 2. Wheels rotate by (distance travelled / wheel radius)
    const wheelAngle = distanceTravelled / 0.45;
    for (let i = 0; i < wheels.length; i++) {
      wheels[i].rotation.z = -wheelAngle;
    }
    // Carrier wheels rotate only during train phase
    const cWheelAngle = (220.0 * pT) / cWheelRadius;
    for (let i = 0; i < carrierWheels.length; i++) {
      carrierWheels[i].rotation.z = -cWheelAngle;
    }

    // 1. CARRIERS: collect all carrier groups and hitch bars into one array.
    // Set them all to visible = false when pB >= 0.42 (right after gate glow bump) and visible = true otherwise
    const trainVisible = pB < 0.42;
    for (let i = 0; i < trainObjects.length; i++) {
      trainObjects[i].visible = trainVisible;
    }

    // Antenna mast beacon blinking as sin(pB * 60)
    antennaLightMat.emissiveIntensity = Math.max(0.0, Math.sin(pB * 60.0));

    // Gate entrance pulse around pB = 0.4
    const pulseDist = Math.abs(pB - 0.4) / 0.08;
    const gatePulse = pulseDist < 1.0 ? Math.cos(pulseDist * Math.PI * 0.5) : 0.0;

    // Lights on: for pB between 0.4 and 0.6, ramp emissive intensity from 0.2 to 1.0
    let lightsRamp = 0.0;
    if (pB >= 0.6) {
      lightsRamp = 1.0;
    } else if (pB > 0.4) {
      lightsRamp = (pB - 0.4) / 0.2;
    }
    const baseEmissive = 0.2 + 0.8 * lightsRamp;

    windowMat.emissiveIntensity = baseEmissive;

    const gateIntensity = Math.min(1.0, baseEmissive + gatePulse * 0.8);
    gateMat.emissiveIntensity = gateIntensity;
    gateMat.opacity = 0.35 + 0.65 * gateIntensity;
    gateMat.color.setRGB(1.0 * gateIntensity, 0.831 * gateIntensity, 0.0);

    // Light spill follows the same pB-driven ramp as gate glow
    doorLight.intensity = 2.5 * gateIntensity;
    groundLightMat.opacity = 0.35 * gateIntensity;

    // 3. BLUR LAYER: max blur 6px at pB = 0.85 (ease-in-out, starting at pB = 0.4).
    // From pB = 0.85 to 1.0, raise --tint from current value up to 1 with tint colour #050507.
    let blurProgress = 0.0;
    if (pB >= 0.85) {
      blurProgress = 1.0;
    } else if (pB > 0.4) {
      blurProgress = (pB - 0.4) / 0.45; // 0.85 - 0.4 = 0.45
    }
    const blurEase = blurProgress < 0.5
      ? 2.0 * blurProgress * blurProgress
      : 1.0 - Math.pow(-2.0 * blurProgress + 2.0, 2) / 2.0;

    const currentBlur = supportsBackdropFilter ? blurEase * 6.0 : 0.0;
    const maxBaseTint = supportsBackdropFilter ? 0.45 : 0.6;
    const baseTint = blurEase * maxBaseTint;

    let finalTint = baseTint;
    if (pB >= 0.85) {
      const fadeProgress = Math.min(1.0, (pB - 0.85) / 0.15); // 0.85 to 1.0
      finalTint = baseTint + (1.0 - baseTint) * fadeProgress;
    }

    blurLayer.style.setProperty('--blur', `${currentBlur.toFixed(2)}px`);
    blurLayer.style.setProperty('--tint', finalTint.toFixed(3));

    // 3. Dust simulation: visible only while alive, fading with age
    for (let i = 0; i < DUST_COUNT; i++) {
      const d = dustData[i];
      const age = pT - d.birth;
      if (age >= 0 && age < DUST_LIFETIME) {
        const driftT = age * 30.0;
        dustPositions[i * 3]     = d.originX + d.driftX * driftT;
        dustPositions[i * 3 + 1] = d.originY + d.driftY * driftT;
        dustPositions[i * 3 + 2] = d.originZ + d.driftZ * driftT;

        const fade = 1.0 - (age / DUST_LIFETIME);
        const c = 0.667 * fade; // 0xaaaaaa base gray fading with age
        dustColors[i * 3]     = c;
        dustColors[i * 3 + 1] = c;
        dustColors[i * 3 + 2] = c;
      } else {
        dustPositions[i * 3]     = 0;
        dustPositions[i * 3 + 1] = -9999;
        dustPositions[i * 3 + 2] = 0;

        dustColors[i * 3]     = 0;
        dustColors[i * 3 + 1] = 0;
        dustColors[i * 3 + 2] = 0;
      }
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustGeo.attributes.color.needsUpdate = true;

    // 4. Project Train Focus & Camera Tracking
    const N = projectsData.length;
    const focusIndex = pT * N; // 0 to N (0..N-1 are carriers, N is the rover)

    // Build entry positions: carriers (rear to front, i=0..N-1) then rover (i=N)
    const entryPositions = [];
    for (let i = 0; i < N; i++) {
      entryPositions.push(roverBaseX - CARRIER_START_OFFSET - (N - 1 - i) * CARRIER_SPACING);
    }
    entryPositions.push(roverBaseX); // index N is the frozen rover position at train end

    // camX during train phase = lerp between neighbouring entries' current x
    const idxFloor = Math.floor(focusIndex);
    const idxCeil = Math.min(N, Math.ceil(focusIndex));
    const alpha = focusIndex - idxFloor;
    const trainCamX = entryPositions[idxFloor] + (entryPositions[idxCeil] - entryPositions[idxFloor]) * alpha;

    // Camera setup & pull-back sequence
    let camX, camY, camZ;
    let lookX, lookY, lookZ;
    let fov;

    if (pL < 1.0) {
      // Landing camera: side-on framing aiming at lander body center (landerY + 2.2), keeps whole lander in frame at touchdown
      // Smooth handover to train camera at LAND_END (pL = 1.0)
      const uHandover = smoothstep(0.85, 1.0, pL);

      const targetLanderX = LANDER_X + swayX;
      const targetLanderY = landerY + 2.2;
      const targetLanderZ = LANDER_Z;

      camX = LANDER_X + (trainCamX - LANDER_X) * uHandover;
      camY = CAMERA_HEIGHT;
      camZ = CAMERA_DISTANCE;

      lookX = targetLanderX + (trainCamX - targetLanderX) * uHandover;
      lookY = targetLanderY + (CAMERA_LOOKAT_Y - targetLanderY) * uHandover;
      lookZ = targetLanderZ + (0.0 - targetLanderZ) * uHandover;
      fov = 52.0 + (CAMERA_FOV - 52.0) * uHandover;
    } else if (pB <= 0.0) {
      camX = trainCamX;
      camY = CAMERA_HEIGHT;
      camZ = CAMERA_DISTANCE;
      lookX = trainCamX;
      lookY = CAMERA_LOOKAT_Y;
      lookZ = 0.0;
      fov = CAMERA_FOV;
    } else if (pB < 0.4) {
      // 1. Before the pull-back (pB < 0.4): camera height 2.2, distance 26, lookAt y 5
      camX = roverX;
      camY = BASE_CAM_HEIGHT;
      camZ = BASE_CAM_DISTANCE;
      lookX = roverX;
      lookY = BASE_CAM_LOOKAT_Y;
      lookZ = 0.0;
      fov = CAMERA_FOV;
    } else {
      // 5. Camera Pull-Back: for pB between 0.4 and 1.0, smoothly pulls back and up
      // to establishing shot: distance 75, height 16, FOV 55, camX eases to BASE_X + 6, lookAt eases to (BASE_X + 6, 8, -18)
      const u = (pB - 0.4) / 0.6; // 0 to 1
      const ease = u < 0.5 ? 2.0 * u * u : 1.0 - Math.pow(-2.0 * u + 2.0, 2) / 2.0;

      const startCamX = BASE_X;
      const startCamY = BASE_CAM_HEIGHT;
      const startCamZ = BASE_CAM_DISTANCE;
      const startLookX = BASE_X;
      const startLookY = BASE_CAM_LOOKAT_Y;
      const startLookZ = 0.0;
      const startFOV = CAMERA_FOV;

      const targetCamX = BASE_X + 6.0;
      const targetCamY = PULLBACK_CAM_HEIGHT;
      const targetCamZ = PULLBACK_CAM_DIST;
      const targetLookX = PULLBACK_LOOKAT.x;
      const targetLookY = PULLBACK_LOOKAT.y; // 8.0
      const targetLookZ = PULLBACK_LOOKAT.z;
      const targetFOV = PULLBACK_FOV;

      camX = startCamX + (targetCamX - startCamX) * ease;
      camY = startCamY + (targetCamY - startCamY) * ease;
      camZ = startCamZ + (targetCamZ - startCamZ) * ease;
      lookX = startLookX + (targetLookX - startLookX) * ease;
      lookY = startLookY + (targetLookY - startLookY) * ease;
      lookZ = startLookZ + (targetLookZ - startLookZ) * ease;
      fov = startFOV + (targetFOV - startFOV) * ease;
    }

    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.position.set(camX, camY, camZ);
    camera.lookAt(lookX, lookY, lookZ);

    // 5. Update each carrier position & project HTML card
    const halfW = window.innerWidth * 0.5;
    const halfH = window.innerHeight * 0.5;

    for (let i = 0; i < N; i++) {
      const carrierX = entryPositions[i];
      carrierGroups[i].position.set(carrierX, 0, 0);

      // World position for card: (carrier x, CARD_WORLD_Y, 0)
      projVec.set(carrierX, CARD_WORLD_Y, 0.0);
      projVec.project(camera);

      // Convert NDC to screen coordinates
      const screenX = projVec.x * halfW + halfW;
      const screenY = -projVec.y * halfH + halfH;

      const item = cardsData[i];
      const isOffscreen = projVec.z > 1.0 || screenX < -340 || screenX > window.innerWidth + 340 || screenY < -200 || screenY > window.innerHeight + 300;

      // Focus & Distance calculations
      const d = Math.abs(i - focusIndex);
      const clampedD = Math.min(d, 1.5);
      const scale = Math.max(CARD_SCALE_MIN, Math.min(CARD_SCALE_MAX, 1.0 - 0.28 * clampedD));
      const baseOpacity = 1.0 - 0.5 * clampedD;
      const isFocused = d < 0.5;

      // 2. CARDS: between pB 0 and 0.3, fade every project card's opacity down to 0
      const cardFade = pB <= 0.0 ? 1.0 : (pB >= 0.3 ? 0.0 : 1.0 - pB / 0.3);
      const opacity = baseOpacity * cardFade;

      // Frame glow: emissive intensity 1.0 for focused carrier, 0.1 for others
      const focusT = Math.max(0, 1.0 - d);
      carrierTopBarMats[i].emissiveIntensity = 0.1 + 0.9 * focusT;

      if (isOffscreen || opacity <= 0.001) {
        item.card.style.display = 'none';
        item.card.style.opacity = '0';
        item.card.style.pointerEvents = 'none';
        item.card.setAttribute('aria-hidden', 'true');
        item.link.tabIndex = -1;
        item.link.style.pointerEvents = 'none';
      } else {
        item.card.style.display = 'block';

        item.card.style.left = `${screenX}px`;
        item.card.style.top = `${screenY}px`;
        item.card.style.transform = `translate(-50%, -100%) scale(${scale})`;
        item.card.style.opacity = opacity.toFixed(3);

        const zIndex = Math.round((N - clampedD) * 10);
        item.card.style.zIndex = zIndex;

        if (isFocused && opacity > 0.05) {
          item.card.classList.add('is-focused');
          item.card.setAttribute('aria-hidden', 'false');
          item.link.tabIndex = 0;
          item.link.style.pointerEvents = 'auto';
          item.card.style.pointerEvents = 'auto';
        } else {
          item.card.classList.remove('is-focused');
          item.card.setAttribute('aria-hidden', 'true');
          item.link.tabIndex = -1;
          item.link.style.pointerEvents = 'none';
          item.card.style.pointerEvents = 'none';
        }
      }
    }

    // Earth in upper right of frame (shift x to camX + 70 each frame so it stays fixed in the sky)
    earthMesh.position.set(camX + 70, 55, -220);

    // Star group follows camera position so stars never get closer
    starGroup.position.copy(camera.position);

    // Directional light shadow camera target tracks camera lookAt
    dirLight.target.position.set(lookX, lookY, lookZ);
    dirLight.position.set(camX + LIGHT_DIR_POS.x, LIGHT_DIR_POS.y, LIGHT_DIR_POS.z);
    dirLight.target.updateMatrixWorld();

    renderer.render(scene, camera);
  }

  // ── 12. Window Resize Handler ──
  let lastProgress = 0;
  function onWindowResize() {
    const newW = window.innerWidth;
    const newH = window.innerHeight;
    camera.aspect = newW / newH;
    camera.updateProjectionMatrix();
    renderer.setSize(newW, newH);
    renderScene(lastProgress);
  }
  window.addEventListener('resize', onWindowResize);

  // ── 13. ScrollTrigger Setup (Follows exact city3d/rocket3d pattern) ──
  let isSceneActive = true;

  ScrollTrigger.create({
    id: 'moon3d-trigger',
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * (CONFIG.scrollLengths?.moon || 200) / 100}`,
    pin: true,
    scrub: 0.5,
    invalidateOnRefresh: true,
    onToggle: (self) => {
      isSceneActive = self.isActive;
      if (isSceneActive) {
        renderScene(self.progress);
      }
    },
    onUpdate: (self) => {
      lastProgress = self.progress;
      if (isSceneActive) {
        renderScene(self.progress);
      }
    },
    onRefresh: () => {
      renderScene(lastProgress);
    },
  });

  // Initial draw
  renderScene(0);

  // ── 14. Disposal Helper ──
  return function disposeMoon3D() {
    window.removeEventListener('resize', onWindowResize);
    ScrollTrigger.getById('moon3d-trigger')?.kill();

    cardsContainer?.remove();
    blurLayer?.remove();
    cubeLight?.dispose();
    doorLight?.dispose();
    groundAlphaMap?.dispose();

    // Dispose geometries
    [
      terrainGeo, rockGeo, starPoints?.geometry, earthGeo,
      landingDustGeo, landingRingGeo,
      ...(lander?.userData?.geometries || []),
      chassisGeo, chassisOutlineGeo, cabGeo, cabOutlineGeo,
      cubeGeo, wheelGeo, hubGeo, spokeGeo, mastGeo, dishGeo, solarGeo, dustGeo,
      carrierFlatbedGeo, carrierFlatbedOutlineGeo, hitchGeo, poleGeo, topBarGeo, cWheelGeo, cSpokeGeo,
      mainDomeGeo, mainDomeOutlineGeo, smallDomeGeo, smallDomeOutlineGeo,
      tubeGeo, tubeOutlineGeo, mastBaseGeo, antennaSphereGeo,
      tunnelWallSideGeo, tunnelWallTopGeo, gatePlaneGeo, jambBlockGeo, headerBlockGeo,
      jambOutlineGeo, headerOutlineGeo, groundLightGeo, ringGeo1, ringGeo2, ringGeo3,
      windowGeo, padDiscGeo, stripeGeo,
    ].forEach((g) => g?.dispose());

    // Dispose materials
    [
      terrainMat, rockMat, starPoints?.material, earthMat,
      landingDustMat, landingRingMat,
      ...(lander?.userData?.materials || []),
      outlineMat, chassisMat, cabMat, cubeMat,
      wheelMat, hubMat, spokeMat, mastMat, dishMat, solarMat, dustMat,
      carrierFlatbedMat, hitchMat, frameMat, cWheelMat, cSpokeMat,
      ...carrierTopBarMats,
      baseMat, mastBaseMat, antennaLightMat, tunnelWallMat, stripeYellowMat, stripeBlackMat,
      gateMat, groundLightMat, ringMat, windowMat, padDiscMat, stripeMat,
    ].forEach((m) => m?.dispose());

    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}
