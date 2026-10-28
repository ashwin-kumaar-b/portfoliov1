// ============================================================
// city3d.js — Scene 4: 3D Night City Chase (Three.js WebGL)
//             - Straight road along Z axis (12 units wide)
//             - Two rows of 10x10 city blocks on each side (2-unit alleys)
//             - THREE.InstancedMesh for buildings (dark #0E0E10, roughness 0.8)
//             - Low ambient + directional lit/dark faces
//             - 4 moving point lights (2 Magenta North, 2 Cyan South)
//             - Road-facing emissive neon strips (Magenta North, Cyan South)
//             - Emissive road curbs + 60% yellow center dashes
//             - FogExp2 (0x050507, 0.018) + dark road plane (#101012)
//             - 1x1x1 emissive yellow (#FFD400) runner cube + attached yellow point light
//             - Camera follows behind and above the runner
//             - 14 static opaque emissive afterimages with Yellow -> Purple -> Blue gradient
//             - Untilted DOM HUD callouts with 3D rooftop projection via Vector3.project
//             - Camera FOV punch from 50 to 46 on callout appearance over ~250ms scroll
//             - Optional UnrealBloomPass post-processing
//             - Full lifecycle (resize, onToggle pause, resource disposal)
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG, BLOOM } from '../config.js';
import { createRocket, createPad } from './rocket3d.js';
import { ROCKET_VIEW, ROCKET_SKY } from '../seams.js';

gsap.registerPlugin(ScrollTrigger);

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── Tuning Constants ──
export const ROAD_WIDTH = 12;               // Road width along X axis
export const ROAD_LENGTH = 520;             // Total road distance along Z
export const PAD_Z = ROAD_LENGTH - 30;       // Launch pad Z position (490)
export const ROAD_SURFACE_LENGTH = PAD_Z + 6; // Dark road surface extends to PAD_Z + 6 (496)
export const BLOCK_SIZE = 10;               // 10x10 city block dimensions
export const ALLEY_WIDTH = 2;               // 2-unit alley between blocks
export const CAMERA_HEIGHT = 14;            // Height above road (Y)
export const CAMERA_DISTANCE_Z = 14;        // Distance behind runner along Z
export const CAMERA_PITCH_DEG = 40;         // Downward camera pitch (degrees)
export const CAMERA_SWAY_X_MAX = 0.6;       // Max sinusoidal sway on X (units)
export const CAMERA_ROLL_DEG_MAX = 1.0;     // Max roll (degrees)
export const CAMERA_FOV_BASE = 50;          // Base camera FOV
export const CAMERA_FOV_PUNCH = 46;         // Punch camera FOV on callout appearance
export const CAMERA_PUNCH_SPAN = 0.045;     // ~250ms equivalent scroll distance
export const FOG_DENSITY = 0.018;           // FogExp2 density
export const BUILDING_MAX_DESKTOP = 600;    // Max instances on desktop
export const BUILDING_MAX_MOBILE = 250;     // Max instances on narrow screens (<768px)
export const HEIGHT_MIN = 3;                // Minimum building height
export const HEIGHT_MAX = 40;               // Standard maximum building height
export const TOWER_HEIGHT_MAX = 62;         // Landmark skyscraper height
export const AMBIENT_INTENSITY = 0.5;       // Ambient light intensity
export const DIR_LIGHT_INTENSITY = 0.5;     // Directional light intensity
export const POINT_LIGHT_INTENSITY = 2.2;   // Road point light intensity
export const RUNNER_LIGHT_INTENSITY = 1.2;  // Yellow runner point light intensity
export const BLOOM_STRENGTH = 0.6;          // UnrealBloomPass strength
export const BLOOM_RADIUS = 0.4;            // UnrealBloomPass radius
export const BLOOM_THRESHOLD = 0.25;        // UnrealBloomPass threshold
export const AFTERIMAGE_COUNT = 14;         // Number of static afterimage clones
export const AFTERIMAGE_SPACING = 26;       // Fixed distance along path between afterimages

// Window Iris Progress (0 = closed/normal city scene, 1 = fully open iris revealing next scene)
export let pIris = 0;
export let setIris = (p) => { pIris = p; };

// Color gradient from yellow (newest, closest to runner) to purple and blue (oldest)
export const AFTERIMAGE_PALETTE = [
  '#05D9E8', // 0: Cyan (oldest)
  '#0284C7', // 1: Sky Blue
  '#2563EB', // 2: Cobalt Blue
  '#4F46E5', // 3: Indigo
  '#6366F1', // 4: Violet Blue
  '#7C3AED', // 5: Deep Violet
  '#9333EA', // 6: Deep Purple
  '#A855F7', // 7: Bright Purple
  '#C026D3', // 8: Fuchsia
  '#DB2777', // 9: Pink Magenta
  '#E11D48', // 10: Crimson
  '#F43F5E', // 11: Rose
  '#F59E0B', // 12: Golden Amber
  '#FFD400', // 13: Neon Yellow (newest, right behind runner)
];

/**
 * Deterministic pseudo-random number generator for stable layout.
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
    return { opacity: 0, translateY: 14, visible: false, drawT: 0 };
  }
  if (progress > end) {
    return { opacity: 0, translateY: -14, visible: false, drawT: 1 };
  }

  let opacity = 1;
  let translateY = 0;
  let drawT = 1;

  if (progress < fadeInEnd) {
    const t = (progress - start) / fadeInSpan;
    opacity = t;
    translateY = 14 * (1 - t);
    drawT = t;
  } else if (progress > fadeOutStart) {
    const t = (progress - fadeOutStart) / fadeOutSpan;
    opacity = 1 - t;
    translateY = -14 * t;
    drawT = 1;
  }

  return { opacity, translateY, visible: true, drawT };
}

export function initCity3D() {
  const section = document.getElementById('scene-city');
  if (!section) return;

  // Kill existing triggers
  ScrollTrigger.getById('city-trigger')?.kill();
  ScrollTrigger.getById('city3d-trigger')?.kill();

  // Reset section
  section.innerHTML = '';
  section.style.background = '#050507';
  section.style.position = 'relative';
  section.style.zIndex = '2';
  section.style.overflow = 'hidden';

  const isNarrow = window.innerWidth < 768;
  const width = window.innerWidth;
  const height = window.innerHeight;

  // ── 1. Three.js Scene & Fog Setup ──
  const cityFogColor = new THREE.Color(0x050507);
  const rocketFogColor = new THREE.Color(ROCKET_SKY.fogColor);
  const cityFogDensity = FOG_DENSITY;
  const rocketFogDensity = ROCKET_SKY.fogDensity;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050507);
  scene.fog = new THREE.FogExp2(0x050507, FOG_DENSITY);

  // ── CSS Sky Gradient Layer (Behind canvas at z-index 1) ──
  const skyGradient = document.createElement('div');
  skyGradient.className = 'city-sky-gradient';
  skyGradient.style.position = 'absolute';
  skyGradient.style.inset = '0';
  skyGradient.style.width = '100%';
  skyGradient.style.height = '100%';
  skyGradient.style.pointerEvents = 'none';
  skyGradient.style.background = ROCKET_SKY.gradient;
  skyGradient.style.setProperty('--horizon', ROCKET_SKY.defaultHorizon || '58%');
  skyGradient.style.opacity = '0';
  skyGradient.style.zIndex = '1';
  section.appendChild(skyGradient);

  // ── 2. Camera Setup (Perspective FOV 50, 14 units high) ──
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_BASE, width / height, 0.1, 1000);
  camera.position.set(0, CAMERA_HEIGHT, 0);

  // ── 3. WebGL Renderer Setup (alpha: true, clearAlpha: 0) ──
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: !isNarrow,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isNarrow ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.zIndex = '2';
  section.appendChild(renderer.domElement);

  // ── 4. Optional Post-Processing Bloom ──
  const useBloom = (CONFIG.bloom ?? BLOOM) && !isNarrow;
  let composer = null;
  if (useBloom) {
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD
    );
    composer.addPass(bloomPass);
  }

  // ── 5. Lighting Setup ──
  // Low ambient
  const ambientLight = new THREE.AmbientLight(0x101018, AMBIENT_INTENSITY);
  scene.add(ambientLight);

  // Directional light from upper-left (0x8899ff, 0.5) so every building has lit & dark faces
  const dirLight = new THREE.DirectionalLight(0x8899ff, DIR_LIGHT_INTENSITY);
  dirLight.position.set(-35, 65, -25);
  scene.add(dirLight);

  // 4 Moving Point Lights (2 Magenta North, 2 Cyan South)
  const pointLightN1 = new THREE.PointLight(0xFF2A6D, POINT_LIGHT_INTENSITY, 42, 2.0);
  const pointLightN2 = new THREE.PointLight(0xFF2A6D, POINT_LIGHT_INTENSITY, 42, 2.0);
  const pointLightS1 = new THREE.PointLight(0x05D9E8, POINT_LIGHT_INTENSITY, 42, 2.0);
  const pointLightS2 = new THREE.PointLight(0x05D9E8, POINT_LIGHT_INTENSITY, 42, 2.0);

  scene.add(pointLightN1);
  scene.add(pointLightN2);
  scene.add(pointLightS1);
  scene.add(pointLightS2);

  // ── 6. Road, Plaza & Ground Planes ──
  // Dark asphalt road (#101012) extended to PAD_Z + 6
  const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_SURFACE_LENGTH);
  roadGeo.rotateX(-Math.PI / 2);
  roadGeo.translate(0, -0.001, ROAD_SURFACE_LENGTH / 2);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x101012,
    roughness: 0.85,
    metalness: 0.1,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  scene.add(roadMesh);

  // Plaza circular ground of radius 30 around pad at (0, 0, PAD_Z) with ROCKET_SKY.groundColor
  const plazaGeo = new THREE.CircleGeometry(30, 64);
  plazaGeo.rotateX(-Math.PI / 2);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: ROCKET_SKY.groundColor,
    roughness: 0.95,
  });
  const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
  plazaMesh.position.set(0, -0.005, PAD_Z);
  scene.add(plazaMesh);

  // Dark ground bed under city blocks
  const groundGeo = new THREE.PlaneGeometry(ROAD_WIDTH + 80, ROAD_LENGTH + 60);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate(0, -0.05, ROAD_LENGTH / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x060608,
    roughness: 0.95,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  scene.add(groundMesh);

  // ── 7. Emissive Road Edges & Center Dashed Line ──
  // North edge line: Emissive Magenta (#FF2A6D)
  const edgeGeoN = new THREE.BoxGeometry(0.2, 0.04, ROAD_SURFACE_LENGTH);
  edgeGeoN.translate(-ROAD_WIDTH / 2 + 0.1, 0.02, ROAD_SURFACE_LENGTH / 2);
  const edgeMatN = new THREE.MeshBasicMaterial({ color: 0xFF2A6D });
  const edgeMeshN = new THREE.Mesh(edgeGeoN, edgeMatN);
  scene.add(edgeMeshN);

  // South edge line: Emissive Cyan (#05D9E8)
  const edgeGeoS = new THREE.BoxGeometry(0.2, 0.04, ROAD_SURFACE_LENGTH);
  edgeGeoS.translate(ROAD_WIDTH / 2 - 0.1, 0.02, ROAD_SURFACE_LENGTH / 2);
  const edgeMatS = new THREE.MeshBasicMaterial({ color: 0x05D9E8 });
  const edgeMeshS = new THREE.Mesh(edgeGeoS, edgeMatS);
  scene.add(edgeMeshS);

  // Center dashes: Emissive Yellow (#FFD400) at 60% intensity
  const dashLength = 2.4;
  const dashGap = 2.4;
  const dashPitch = dashLength + dashGap;
  const dashCount = Math.floor(ROAD_SURFACE_LENGTH / dashPitch);

  const dashGeo = new THREE.BoxGeometry(0.25, 0.02, dashLength);
  const dashColor = new THREE.Color(0xFFD400).multiplyScalar(0.6);
  const dashMat = new THREE.MeshBasicMaterial({ color: dashColor });
  const dashInstanced = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);

  const dummy = new THREE.Object3D();
  for (let d = 0; d < dashCount; d++) {
    dummy.position.set(0, 0.02, d * dashPitch + dashLength / 2);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    dashInstanced.setMatrixAt(d, dummy.matrix);
  }
  dashInstanced.instanceMatrix.needsUpdate = true;
  scene.add(dashInstanced);

  // ── 8. City Layout & Instanced Buildings ──
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);

  const buildingMat = new THREE.MeshStandardMaterial({
    color: 0x0E0E10,
    roughness: 0.8,
    metalness: 0.15,
  });

  const blockPitchZ = BLOCK_SIZE + ALLEY_WIDTH; // 12 units
  const numBlocksZ = Math.floor(ROAD_LENGTH / blockPitchZ);

  const maxInstances = isNarrow ? BUILDING_MAX_MOBILE : BUILDING_MAX_DESKTOP;
  const buildingData = [];

  const rowConfigs = [
    { name: 'NorthNear', xCenter: -12, isNorth: true, isNear: true },
    { name: 'NorthFar',  xCenter: -24, isNorth: true, isNear: false },
    { name: 'SouthNear', xCenter:  12, isNorth: false, isNear: true },
    { name: 'SouthFar',  xCenter:  24, isNorth: false, isNear: false },
  ];

  let instanceCount = 0;
  for (let bzIdx = 0; bzIdx < numBlocksZ && instanceCount < maxInstances; bzIdx++) {
    const blockZ = bzIdx * blockPitchZ + ALLEY_WIDTH;

    for (const row of rowConfigs) {
      if (instanceCount >= maxInstances) break;

      const seedBase = bzIdx * 31 + (row.isNorth ? 7 : 13) + (row.isNear ? 3 : 19);
      const countInBlock = 1 + Math.floor(seededRand(seedBase, 1) * 3);

      const slotsZ = [];
      if (countInBlock === 1) {
        slotsZ.push({ zOffset: 1, depth: 8 });
      } else if (countInBlock === 2) {
        slotsZ.push({ zOffset: 0.8, depth: 3.8 });
        slotsZ.push({ zOffset: 5.4, depth: 3.8 });
      } else {
        slotsZ.push({ zOffset: 0.6, depth: 2.4 });
        slotsZ.push({ zOffset: 3.8, depth: 2.4 });
        slotsZ.push({ zOffset: 7.0, depth: 2.4 });
      }

      for (let s = 0; s < slotsZ.length; s++) {
        if (instanceCount >= maxInstances) break;

        const bSeed = seedBase * 17 + s * 5;
        const slot = slotsZ[s];

        const isSkyscraper = seededRand(bSeed, 2) > 0.94;
        let bh = 0;
        if (isSkyscraper) {
          bh = 50 + seededRand(bSeed, 3) * (TOWER_HEIGHT_MAX - 50);
        } else {
          bh = HEIGHT_MIN + Math.pow(seededRand(bSeed, 3), 1.4) * (HEIGHT_MAX - HEIGHT_MIN);
        }

        const bw = 7.5 + seededRand(bSeed, 4) * 1.5;
        const bd = slot.depth;
        const bx = row.xCenter + (seededRand(bSeed, 5) - 0.5) * 0.8;
        const bz = blockZ + slot.zOffset + bd / 2;

        // Skip any building whose footprint intersects the rectangle x in [-26, 26], z in [PAD_Z - 30, PAD_Z + 70]
        const minX = bx - bw / 2;
        const maxX = bx + bw / 2;
        const minZ = bz - bd / 2;
        const maxZ = bz + bd / 2;
        const intersectsPlaza = minX <= 26 && maxX >= -26 && minZ <= (PAD_Z + 70) && maxZ >= (PAD_Z - 30);
        if (intersectsPlaza) {
          continue;
        }

        buildingData.push({
          x: bx,
          z: bz,
          w: bw,
          h: bh,
          d: bd,
          isNorth: row.isNorth,
          isNear: row.isNear,
          index: instanceCount,
          seed: bSeed,
        });

        instanceCount++;
      }
    }
  }

  // Create InstancedMesh for buildings
  const buildingMesh = new THREE.InstancedMesh(boxGeo, buildingMat, buildingData.length);
  buildingMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(buildingData.length * 3), 3
  );

  const baseBuildingColor = new THREE.Color(0x0E0E10);
  buildingData.forEach((b, i) => {
    dummy.position.set(b.x, 0, b.z);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    buildingMesh.setMatrixAt(i, dummy.matrix);

    const tone = 0.88 + seededRand(b.seed, 6) * 0.28;
    const instanceCol = baseBuildingColor.clone();
    instanceCol.r = Math.min(0.18, instanceCol.r * tone);
    instanceCol.g = Math.min(0.18, instanceCol.g * tone);
    instanceCol.b = Math.min(0.20, instanceCol.b * (tone * 1.05));
    buildingMesh.setColorAt(i, instanceCol);
  });

  buildingMesh.instanceMatrix.needsUpdate = true;
  buildingMesh.instanceColor.needsUpdate = true;
  scene.add(buildingMesh);

  // ── 9. Emissive Neon Strips on Buildings ──
  const northBuildings = buildingData.filter((b) => b.isNorth && b.isNear);
  const southBuildings = buildingData.filter((b) => !b.isNorth && b.isNear);

  const neonStripGeo = new THREE.BoxGeometry(0.15, 0.7, 1);
  const neonMatN = new THREE.MeshBasicMaterial({ color: 0xFF2A6D });
  const neonMatS = new THREE.MeshBasicMaterial({ color: 0x05D9E8 });

  const northNeonMesh = new THREE.InstancedMesh(neonStripGeo, neonMatN, northBuildings.length);
  northBuildings.forEach((b, i) => {
    const stripDepth = Math.min(4.5, Math.max(1.8, b.d * 0.65));
    const stripX = b.x + b.w / 2 + 0.08;
    const stripY = b.h - 1.2;
    dummy.position.set(stripX, stripY, b.z);
    dummy.scale.set(1, 1, stripDepth);
    dummy.updateMatrix();
    northNeonMesh.setMatrixAt(i, dummy.matrix);
  });
  northNeonMesh.instanceMatrix.needsUpdate = true;
  scene.add(northNeonMesh);

  const southNeonMesh = new THREE.InstancedMesh(neonStripGeo, neonMatS, southBuildings.length);
  southBuildings.forEach((b, i) => {
    const stripDepth = Math.min(4.5, Math.max(1.8, b.d * 0.65));
    const stripX = b.x - b.w / 2 - 0.08;
    const stripY = b.h - 1.2;
    dummy.position.set(stripX, stripY, b.z);
    dummy.scale.set(1, 1, stripDepth);
    dummy.updateMatrix();
    southNeonMesh.setMatrixAt(i, dummy.matrix);
  });
  southNeonMesh.instanceMatrix.needsUpdate = true;
  scene.add(southNeonMesh);

  // ── Launch Pad & Scenery Rocket (Static scenery at 0, 0, PAD_Z) ──
  const padGroup = createPad();
  padGroup.position.set(0, 0, PAD_Z);
  scene.add(padGroup);

  const rocketGroup = createRocket();
  rocketGroup.position.set(0, 0, PAD_Z);
  if (rocketGroup.userData.flameGroup) {
    rocketGroup.userData.flameGroup.visible = false;
  }
  scene.add(rocketGroup);

  // World position of rocket's window cube, computed at init and on resize
  const windowCubeWorldPos = new THREE.Vector3();
  function updateWindowCubeWorldPos() {
    rocketGroup.updateMatrixWorld(true);
    if (rocketGroup.userData.windowCube) {
      rocketGroup.userData.windowCube.getWorldPosition(windowCubeWorldPos);
    }
  }
  updateWindowCubeWorldPos();

  // ── 10. Runner: 1x1x1 Emissive Yellow Cube + Attached Yellow Point Light ──
  const runnerGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
  const runnerMat = new THREE.MeshBasicMaterial({ color: 0xFFD400 });
  const runnerCube = new THREE.Mesh(runnerGeo, runnerMat);
  runnerCube.position.set(0, 0.5, 0);

  // Attached low-intensity yellow point light
  const runnerLight = new THREE.PointLight(0xFFD400, RUNNER_LIGHT_INTENSITY, 12, 2.0);
  runnerLight.position.set(0, 0.7, 0);
  runnerCube.add(runnerLight);
  scene.add(runnerCube);

  // ── 11. Afterimages Pool (14 Static, Opaque, Emissive Clones: Yellow -> Purple -> Blue) ──
  const cloneGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
  const clonePool = [];
  const cloneMaterials = [];

  for (let c = 0; c < AFTERIMAGE_COUNT; c++) {
    const cColor = AFTERIMAGE_PALETTE[c % AFTERIMAGE_PALETTE.length];
    const cMat = new THREE.MeshBasicMaterial({ color: cColor });
    cloneMaterials.push(cMat);

    const cMesh = new THREE.Mesh(cloneGeo, cMat);
    cMesh.visible = false;
    scene.add(cMesh);

    clonePool.push({
      index: c,
      mesh: cMesh,
      visible: false,
    });
  }

  // ── 12. Rooftop Anchors for Specific Tall Buildings Near the Road ──
  // Choose 3 distinct tall buildings near the road by index
  const tallNearBuildings = buildingData
    .filter((b) => b.isNear && b.h >= 22)
    .sort((a, b) => a.z - b.z);

  const anchorIdxs = [
    Math.min(2, tallNearBuildings.length - 1),
    Math.floor(tallNearBuildings.length * 0.38),
    Math.floor(tallNearBuildings.length * 0.62),
  ];

  const anchorBuildings = anchorIdxs.map((idx) => tallNearBuildings[idx] || tallNearBuildings[0]);
  const anchor3DPositions = anchorBuildings.map((b) => new THREE.Vector3(b.x, b.h + 0.5, b.z));

  // ── 13. HUD Callouts Overlay (Untilted DOM + Drawing Connector Lines) ──
  const calloutsOverlay = document.createElement('div');
  calloutsOverlay.className = 'city-callouts-overlay';
  calloutsOverlay.style.position = 'absolute';
  calloutsOverlay.style.inset = '0';
  calloutsOverlay.style.width = '100%';
  calloutsOverlay.style.height = '100%';
  calloutsOverlay.style.pointerEvents = 'none';
  calloutsOverlay.style.zIndex = '20';
  section.appendChild(calloutsOverlay);

  // Connector lines SVG
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
      anchor3D: anchor3DPositions[0],
      duration: 0.22,
    },
    {
      progress: 0.36,
      className: 'city-callout-2',
      title: 'Hackathons',
      text: '▸ Winner · RobochipX 2026 (RIT AI Track)\n▸ Finalist · CSI ORIGIN 2026 (VIT Chennai)\n▸ Participant · CODEATHON 4.0 (Prathyusha)\n▸ Participant · Nanohack 2026 (SIMATS)',
      color: '#FF2A6D',
      anchor3D: anchor3DPositions[1],
      duration: 0.24,
    },
    {
      progress: 0.58,
      className: 'city-callout-3',
      title: 'Domains',
      text: 'Clinical AI, medication & dietary intelligence, zero-cloud mesh comms, predictive maintenance',
      color: '#FFD400',
      anchor3D: anchor3DPositions[2],
      duration: 0.28,
    },
  ];

  // SVG connector elements for each callout
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

  // Untilted DOM callout boxes
  const calloutEls = calloutsData.map((data, idx) => {
    const div = document.createElement('div');
    div.className = `city-callout ${data.className}`;
    div.style.setProperty('--accent-color', data.color);

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
      anchor3D: data.anchor3D,
      wasGlitching: false,
    };
  });

  // ── 14. Frame Rendering & Scroll Mapping (Strictly Derived from Progress) ──
  const startZ = 0;
  const cubeRoadEndPos = new THREE.Vector3(0, 0.5, PAD_Z + 7);
  const pitchRad = (CAMERA_PITCH_DEG * Math.PI) / 180;
  const targetZOffset = CAMERA_HEIGHT / Math.tan(pitchRad); // ~16.7 units

  let isSceneActive = true;

  function clamp(val, min = 0, max = 1) {
    return Math.min(max, Math.max(min, val));
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function seededRandom(c, r) {
    let h = (c * 374761393 + r * 668265263) ^ 0x27d4eb2d;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ── SVG Clip-Path (City Panes) Transition ──
  const COLS = CONFIG.flip?.colsDesktop || 10;
  const ROWS = CONFIG.flip?.rowsDesktop || 6;
  const clipPathEl = document.getElementById('cityPanes');
  const paneTiles = [];

  if (clipPathEl) {
    clipPathEl.innerHTML = '';
    const SVG_NS = 'http://www.w3.org/2000/svg';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const rect = document.createElementNS(SVG_NS, 'rect');
        const delay = ((COLS - 1 - c) / (COLS - 1)) * 0.5 + seededRandom(c, r) * 0.1;
        rect.setAttribute('y', (r / ROWS).toString());
        rect.setAttribute('height', (1 / ROWS).toString());
        rect.setAttribute('x', (c / COLS).toString());
        rect.setAttribute('width', (1 / COLS).toString());
        clipPathEl.appendChild(rect);
        paneTiles.push({ rect, c, r, delay });
      }
    }
  }

  const supportsClipPath = (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') && (
    CSS.supports('clip-path', 'url(#cityPanes)') ||
    CSS.supports('-webkit-clip-path', 'url(#cityPanes)')
  );

  function updatePanes(irisVal) {
    for (let i = 0; i < paneTiles.length; i++) {
      const { rect, c, delay } = paneTiles[i];
      const t = clamp((irisVal - delay) / 0.4, 0, 1);
      const s = 1 - easeInOutCubic(t);
      const w = s / COLS;
      const x = c / COLS + (1 - s) / (2 * COLS);
      rect.setAttribute('width', w.toString());
      rect.setAttribute('x', x.toString());
    }
  }

  function applyPanes(irisVal) {
    pIris = clamp(irisVal, 0, 1);

    // 4. When pIris >= 1 set #scene-city visibility hidden, pointer-events none,
    // and stop drawing the city renderer; restore all three when pIris < 1
    if (pIris >= 1) {
      section.style.visibility = 'hidden';
      section.style.pointerEvents = 'none';
    } else {
      section.style.visibility = 'visible';
      section.style.pointerEvents = 'auto';
    }

    // 5. FALLBACK: if CSS.supports('clip-path', 'url(#cityPanes)') is false,
    // skip the clip and fade #scene-city's opacity from 1 to 0 over pIris.
    if (!supportsClipPath) {
      section.style.clipPath = 'none';
      section.style.webkitClipPath = 'none';
      section.style.opacity = Math.max(0, 1 - pIris).toFixed(3);
      return;
    }

    section.style.opacity = '1';

    // 4. When pIris > 0 set #scene-city style clip-path (and -webkit-clip-path) to url(#cityPanes).
    // When pIris == 0 set it to 'none', so no clip cost remains.
    if (pIris === 0) {
      section.style.clipPath = 'none';
      section.style.webkitClipPath = 'none';
      updatePanes(0);
      return;
    }

    section.style.clipPath = 'url(#cityPanes)';
    section.style.webkitClipPath = 'url(#cityPanes)';
    updatePanes(pIris);
  }

  function setIrisProgress(progress) {
    pIris = clamp(progress, 0, 1);
    applyPanes(pIris);
    if (isSceneActive && pIris < 1) {
      renderScene(lastProgress);
    }
  }

  setIris = setIrisProgress;
  section.setIris = setIrisProgress;
  window.__setCityIris = setIrisProgress;

  function renderScene(pCity) {
    if (pIris >= 1) {
      return;
    }

    // 1. RUNNER POSITION:
    // Road travel up to z = PAD_Z + 7 (p in [0, 0.88]), then moves into rocket window (p in [0.88, 0.98])
    let runnerZ = 0;

    if (pCity <= 0.88) {
      const pRoad = Math.min(1, pCity / 0.88);
      runnerZ = startZ + pRoad * (cubeRoadEndPos.z - startZ);
      runnerCube.position.set(0, 0.5, runnerZ);
      runnerCube.scale.set(1, 1, 1);
      runnerCube.visible = true;
      runnerLight.intensity = RUNNER_LIGHT_INTENSITY;
    } else if (pCity < 0.98) {
      const tWindow = (pCity - 0.88) / 0.10;
      const easeWindow = tWindow * tWindow * (3 - 2 * tWindow);
      runnerCube.position.lerpVectors(cubeRoadEndPos, windowCubeWorldPos, easeWindow);
      runnerZ = runnerCube.position.z;
      const s = 1.0 + (0.35 - 1.0) * easeWindow;
      runnerCube.scale.set(s, s, s);
      runnerCube.visible = true;
      runnerLight.intensity = RUNNER_LIGHT_INTENSITY * (1 - easeWindow);
    } else {
      runnerZ = cubeRoadEndPos.z;
      runnerCube.visible = false;
      runnerLight.intensity = 0;
    }

    // 2. CAMERA POSITION & ARRIVAL:
    // Normal follow pose behind and above runner
    const followZ = pCity <= 0.88 ? runnerZ : cubeRoadEndPos.z;
    const camZ = followZ - CAMERA_DISTANCE_Z;
    const swayX = Math.sin(pCity * Math.PI * 4) * CAMERA_SWAY_X_MAX;
    const rollRad = Math.sin(pCity * Math.PI * 2) * ((CAMERA_ROLL_DEG_MAX * Math.PI) / 180);

    const normalCamPos = new THREE.Vector3(swayX, CAMERA_HEIGHT, camZ);
    const normalLookAt = new THREE.Vector3(0, 0.5, followZ + (targetZOffset - CAMERA_DISTANCE_Z));
    const normalRoll = rollRad;
    const normalFov = CAMERA_FOV_BASE;

    // Final pose at p = 1.0 identical to rocket3d scene first frame
    const finalCamPos = new THREE.Vector3(0, ROCKET_VIEW.height, PAD_Z + ROCKET_VIEW.distance);
    const finalLookAt = new THREE.Vector3(0, ROCKET_VIEW.lookAtY, PAD_Z);
    const finalFov = ROCKET_VIEW.fov;

    let targetCamPos = normalCamPos;
    let targetLookAt = normalLookAt;
    let targetRoll = normalRoll;
    let baseFov = normalFov;

    if (pCity >= 0.80) {
      const tArrival = Math.min(1, Math.max(0, (pCity - 0.80) / 0.20));
      const easeArrival = tArrival * tArrival * (3 - 2 * tArrival);
      targetCamPos = new THREE.Vector3().lerpVectors(normalCamPos, finalCamPos, easeArrival);
      targetLookAt = new THREE.Vector3().lerpVectors(normalLookAt, finalLookAt, easeArrival);
      targetRoll = normalRoll * (1 - easeArrival);
      baseFov = normalFov + (finalFov - normalFov) * easeArrival;
    }

    camera.position.copy(targetCamPos);
    camera.lookAt(targetLookAt);
    camera.rotation.z += targetRoll;

    // 3. CAMERA PUNCH: tween camera FOV from 50 to 46 and back over ~250ms of scroll distance (only for p < 0.80)
    let maxFovDrop = 0;
    if (pCity < 0.80) {
      calloutsData.forEach((data) => {
        const delta = pCity - data.progress;
        if (delta >= 0 && delta <= CAMERA_PUNCH_SPAN) {
          const punchT = delta / CAMERA_PUNCH_SPAN;
          const drop = (CAMERA_FOV_BASE - CAMERA_FOV_PUNCH) * Math.sin(punchT * Math.PI);
          if (drop > maxFovDrop) {
            maxFovDrop = drop;
          }
        }
      });
    }

    const targetFov = baseFov - maxFovDrop;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    // 4. SKY & FOG TRANSITION: lerp toward ROCKET_SKY and fade in CSS gradient layer behind canvas (p in [0.75, 0.95])
    if (pCity < 0.75) {
      scene.background = cityFogColor;
      scene.fog.color.copy(cityFogColor);
      scene.fog.density = cityFogDensity;
      skyGradient.style.opacity = '0';
    } else {
      const tSky = Math.min(1, Math.max(0, (pCity - 0.75) / 0.20));
      scene.fog.color.copy(cityFogColor).lerp(rocketFogColor, tSky);
      scene.fog.density = cityFogDensity + (rocketFogDensity - cityFogDensity) * tSky;
      scene.background = null;
      skyGradient.style.opacity = tSky.toFixed(3);
    }

    // 5. AFTERIMAGES: static copies along path, faded/hidden by p = 0.85
    for (let i = 0; i < AFTERIMAGE_COUNT; i++) {
      const clone = clonePool[i];
      const triggerZ = startZ + (i + 1) * AFTERIMAGE_SPACING;

      if (pCity < 0.85 && runnerZ >= triggerZ) {
        if (!clone.visible) {
          clone.visible = true;
          clone.mesh.visible = true;
          clone.mesh.position.set(0, 0.5, triggerZ);
        }
      } else {
        if (clone.visible) {
          clone.visible = false;
          clone.mesh.visible = false;
        }
      }
    }

    // 6. POINT LIGHTS: follow camera along road, fade out by p = 0.85
    const lightFade = pCity >= 0.85 ? 0 : (pCity >= 0.80 ? Math.max(0, 1 - (pCity - 0.80) / 0.05) : 1);
    pointLightN1.intensity = POINT_LIGHT_INTENSITY * lightFade;
    pointLightN2.intensity = POINT_LIGHT_INTENSITY * lightFade;
    pointLightS1.intensity = POINT_LIGHT_INTENSITY * lightFade;
    pointLightS2.intensity = POINT_LIGHT_INTENSITY * lightFade;
    pointLightN1.position.set(-7, 4.5, camZ + 12);
    pointLightN2.position.set(-7, 4.5, camZ + 42);
    pointLightS1.position.set(7, 4.5, camZ + 12);
    pointLightS2.position.set(7, 4.5, camZ + 42);

    // 7. RENDER PASS (with bloom if enabled, bypass for p >= 0.75 for transparent canvas)
    if (composer && useBloom && pCity < 0.75) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }

    // 8. HUD CALLOUTS: fade out by p = 0.88 so p = 1.0 is completely clean; no HUD callouts visible during pIris
    if (pCity >= 0.88) {
      calloutsOverlay.style.opacity = '0';
      calloutsOverlay.style.display = 'none';
    } else if (pCity >= 0.84) {
      calloutsOverlay.style.display = 'block';
      calloutsOverlay.style.opacity = Math.max(0, 1 - (pCity - 0.84) / 0.04).toFixed(3);
    } else {
      calloutsOverlay.style.display = 'block';
      calloutsOverlay.style.opacity = '1';
    }

    const secRect = section.getBoundingClientRect();
    const curW = window.innerWidth;
    const curH = window.innerHeight;

    calloutEls.forEach((item) => {
      const { el, textSpan, cursor, fullText, appearProgress, duration, connector, anchor3D } = item;
      const state = getCalloutState(pCity, appearProgress, duration);

      if (pCity >= 0.88) {
        state.visible = false;
        state.opacity = 0;
      }

      el.style.opacity = state.opacity.toFixed(3);
      el.style.transform = `translateY(${state.translateY.toFixed(1)}px)`;
      el.style.visibility = state.visible ? 'visible' : 'hidden';

      if (state.visible) {
        // Monospace typewriter text
        const typeProgress = Math.min(1, Math.max(0, (pCity - appearProgress) / 0.045));
        const charsCount = Math.floor(typeProgress * fullText.length);
        textSpan.textContent = fullText.slice(0, charsCount);
        cursor.style.display = typeProgress >= 1 ? 'none' : 'inline-block';

        // 150ms RGB-split glitch flicker on entry
        const isGlitchWindow = (pCity >= appearProgress && pCity <= appearProgress + 0.025);
        if (isGlitchWindow && !item.wasGlitching) {
          el.classList.add('hud-glitching');
          item.wasGlitching = true;
        } else if (!isGlitchWindow && item.wasGlitching) {
          el.classList.remove('hud-glitching');
          item.wasGlitching = false;
        }

        // Convert anchor 3D position to screen coordinates with Vector3.project
        if (connector && anchor3D) {
          connector.group.style.opacity = state.opacity.toFixed(3);

          const p3d = anchor3D.clone();
          p3d.project(camera);

          // Normalized Device Coordinates to screen pixels
          const screenX = (p3d.x * 0.5 + 0.5) * curW;
          const screenY = (-p3d.y * 0.5 + 0.5) * curH;

          const cRect = el.getBoundingClientRect();
          const calloutMidX = cRect.left - secRect.left + cRect.width * 0.5;
          const calloutEdgeY = (appearProgress === 0.45)
            ? (cRect.top - secRect.top)
            : (cRect.bottom - secRect.top);

          connector.line.setAttribute('x1', calloutMidX.toFixed(1));
          connector.line.setAttribute('y1', calloutEdgeY.toFixed(1));
          connector.line.setAttribute('x2', screenX.toFixed(1));
          connector.line.setAttribute('y2', screenY.toFixed(1));

          // Draw line from callout to anchor as callout appears
          const lineLen = Math.hypot(screenX - calloutMidX, screenY - calloutEdgeY);
          const drawProgress = Math.min(1, Math.max(0, state.drawT / 0.8));
          connector.line.setAttribute('stroke-dasharray', `${lineLen.toFixed(1)} ${lineLen.toFixed(1)}`);
          connector.line.setAttribute('stroke-dashoffset', `${(lineLen * (1 - drawProgress)).toFixed(1)}`);

          connector.dot.setAttribute('cx', screenX.toFixed(1));
          connector.dot.setAttribute('cy', screenY.toFixed(1));
          connector.dot.style.opacity = drawProgress >= 0.75 ? '1' : '0';
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

  // Initial application of panes and initial render at progress 0
  applyPanes(0);
  renderScene(0);

  // ── 15. Window Resize Handler ──
  function onWindowResize() {
    const newW = window.innerWidth;
    const newH = window.innerHeight;
    camera.aspect = newW / newH;
    camera.updateProjectionMatrix();
    renderer.setSize(newW, newH);
    if (composer && useBloom) {
      composer.setSize(newW, newH);
    }
    renderScene(lastProgress);
  }
  let lastProgress = 0;
  window.addEventListener('resize', onWindowResize);

  // ── 16. ScrollTrigger Setup (scrub: 0.5, completely reversible) ──
  const cityLen = CONFIG.scrollLengths?.city || 350;
  const irisLen = CONFIG.scrollLengths?.irisLen ?? 110;
  const total = cityLen + irisLen;

  ScrollTrigger.create({
    id: 'city3d-trigger',
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * total / 100}`,
    pin: true,
    scrub: 0.5,
    invalidateOnRefresh: true,
    onToggle: (self) => {
      isSceneActive = self.isActive;
      if (isSceneActive) {
        const pCity = clamp((self.progress * total) / cityLen, 0, 1);
        pIris = clamp((self.progress * total - cityLen) / irisLen, 0, 1);
        lastProgress = pCity;
        applyPanes(pIris);
        renderScene(pCity);
      }
    },
    onUpdate: (self) => {
      const pCity = clamp((self.progress * total) / cityLen, 0, 1);
      pIris = clamp((self.progress * total - cityLen) / irisLen, 0, 1);
      lastProgress = pCity;
      applyPanes(pIris);
      if (isSceneActive) {
        renderScene(pCity);
      }
    },
    onRefresh: () => {
      applyPanes(pIris);
      renderScene(lastProgress);
    },
  });

  // ── 17. Disposal Helper ──
  return function disposeCity3D() {
    window.removeEventListener('resize', onWindowResize);
    ScrollTrigger.getById('city3d-trigger')?.kill();

    applyPanes(0);
    section.style.clipPath = '';
    section.style.webkitClipPath = '';
    section.style.visibility = '';
    section.style.pointerEvents = '';
    section.style.opacity = '';
    section.setIris = null;
    section.__setIris = null;
    if (window.__setCityIris === setIrisProgress) {
      delete window.__setCityIris;
    }

    // Dispose geometries & materials
    [boxGeo, roadGeo, plazaGeo, groundGeo, edgeGeoN, edgeGeoS, dashGeo, neonStripGeo, runnerGeo, cloneGeo].forEach((g) => g.dispose());
    [buildingMat, roadMat, plazaMat, groundMat, edgeMatN, edgeMatS, dashMat, neonMatN, neonMatS, runnerMat, ...cloneMaterials].forEach((m) => m.dispose());
    padGroup.userData.geometries?.forEach((g) => g.dispose());
    padGroup.userData.materials?.forEach((m) => m.dispose());
    rocketGroup.userData.geometries?.forEach((g) => g.dispose());
    rocketGroup.userData.materials?.forEach((m) => m.dispose());

    if (composer) {
      composer.dispose?.();
    }
    renderer.dispose();
    if (skyGradient && skyGradient.parentNode) {
      skyGradient.parentNode.removeChild(skyGradient);
    }
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}
