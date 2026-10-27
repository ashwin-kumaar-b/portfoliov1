// ============================================================
// rocket3d.js — Scene 5: 3D Rocket Launch Pad (Three.js WebGL)
//               Static rocket on launch pad (standing upright)
//               - All primitives, no external models (height ~14 units)
//               - Body (Cylinder, #d8d8e0), Nose (Cone, #FF2A6D)
//               - 4 fins (#FF2A6D), black stripe ring (#0A0A0A)
//               - Round front window (#FFD400) with pilot cube inside
//               - Pad platform (#0c0c12) with emissive cyan (#05D9E8) edges
//               - Rooftop dark plane, HemisphereLight, DirectionalLight, PointLight
//               - Transparent canvas with CSS gradient background
//               - PerspectiveCamera FOV 50, 25 units out, 6 units above pad
//               - Strict lifecycle (resize, onToggle offscreen pause, disposal)
// ============================================================
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from '../config.js';
import { createStars } from '../stars.js';
import { ROCKET_VIEW, ROCKET_SKY } from '../seams.js';

gsap.registerPlugin(ScrollTrigger);

// ── Tuning Constants (Exposed at top) ──
export const CAMERA_DISTANCE = ROCKET_VIEW.distance;            // Distance from rocket along Z axis
export const CAMERA_HEIGHT_ABOVE_PAD = ROCKET_VIEW.height;     // Height above the pad surface (units)
export const CAMERA_FOV = ROCKET_VIEW.fov;                 // PerspectiveCamera FOV
export const ROCKET_MIDPOINT_Y = ROCKET_VIEW.lookAtY;        // Midpoint of the rocket to look at

// Launch Sequence Tuning Constants
export const ROCKET_RISE_HEIGHT = 140;        // Max rocket vertical rise at p = 1.0 (units)
export const ROCKET_MAX_FLAME_LEN = 6.0;      // Max flame length at p = 0.5 (units)
export const ROCKET_FLASH_PEAK_OPACITY = 0.9; // Peak white flash opacity at p = 0.22
export const ROCKET_MAX_SHAKE_AMP = 0.03;     // Peak launch shake offset in X/Z (units)

/**
 * Builds and returns the standalone rocket model hierarchy.
 * Rocket base sits at local y = 0 (height ~13.5 units: body 9 + nose 4.5).
 * Flame cones are included as children under flameGroup at local y = 0.
 *
 * @returns {THREE.Group} The assembled rocket group with flame cones as children.
 */
export function createRocket() {
  const rocketGroup = new THREE.Group();

  // Ink outline material for cel-shaded borders (side: THREE.BackSide)
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.BackSide,
  });

  // 1. Body: CylinderGeometry radius 0.9, height 9, MeshToonMaterial #f2f2f8
  // Base at y = 0 -> center at y = 4.5 (spans y = 0 to 9)
  const bodyGeo = new THREE.CylinderGeometry(0.9, 0.9, 9, 36);
  const bodyMat = new THREE.MeshToonMaterial({ color: 0xf2f2f8 });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.set(0, 4.5, 0);
  rocketGroup.add(bodyMesh);

  // Body ink outline mesh (geometry scaled 1.05)
  const bodyOutlineGeo = bodyGeo.clone();
  bodyOutlineGeo.scale(1.05, 1.05, 1.05);
  const bodyOutlineMesh = new THREE.Mesh(bodyOutlineGeo, outlineMat);
  bodyOutlineMesh.position.copy(bodyMesh.position);
  rocketGroup.add(bodyOutlineMesh);

  // 2. Nose: ConeGeometry radius 0.9, height 4.5, MeshToonMaterial #FF2A6D with emissive 0.35
  // Base at y = 9 -> center at y = 9 + 2.25 = 11.25 (spans y = 9 to 13.5)
  const noseGeo = new THREE.ConeGeometry(0.9, 4.5, 36);
  const noseMat = new THREE.MeshToonMaterial({
    color: 0xFF2A6D,
    emissive: 0xFF2A6D,
    emissiveIntensity: 0.35,
  });
  const noseMesh = new THREE.Mesh(noseGeo, noseMat);
  noseMesh.position.set(0, 11.25, 0);
  rocketGroup.add(noseMesh);

  // Nose ink outline mesh (geometry scaled 1.05)
  const noseOutlineGeo = noseGeo.clone();
  noseOutlineGeo.scale(1.05, 1.05, 1.05);
  const noseOutlineMesh = new THREE.Mesh(noseOutlineGeo, outlineMat);
  noseOutlineMesh.position.copy(noseMesh.position);
  rocketGroup.add(noseOutlineMesh);

  // 3. 3 Tapered Fins at 120-degree spacing: THREE.Shape (0,0), (0,3), (1.8,0), extruded depth 0.15
  // Attached at base of body (y = 0), slanting outward. Base angles [90°, 210°, 330°]
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0, 3);
  finShape.lineTo(1.8, 0);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.15,
    bevelEnabled: false,
  });
  finGeo.translate(0, 0, -0.075);

  const finMat = new THREE.MeshToonMaterial({
    color: 0xFF2A6D,
    emissive: 0xFF2A6D,
    emissiveIntensity: 0.35,
  });

  const finOutlineGeo = finGeo.clone();
  finOutlineGeo.scale(1.05, 1.05, 1.05);

  const finBaseAngles = [
    Math.PI / 2,
    Math.PI / 2 + (2 * Math.PI) / 3,
    Math.PI / 2 + (4 * Math.PI) / 3,
  ];

  finBaseAngles.forEach((angle) => {
    const finPivot = new THREE.Group();
    finPivot.rotation.y = angle;

    const finMesh = new THREE.Mesh(finGeo, finMat);
    finMesh.position.set(0.88, 0, 0);
    finPivot.add(finMesh);

    const finOutline = new THREE.Mesh(finOutlineGeo, outlineMat);
    finOutline.position.copy(finMesh.position);
    finPivot.add(finOutline);

    rocketGroup.add(finPivot);
  });

  // Rotate the whole rocket 30 degrees around Y so no fin is edge-on to the camera
  rocketGroup.rotation.y = THREE.MathUtils.degToRad(30);

  // 4. Black stripe ring: height 0.5, radius 0.93, color #0A0A0A around middle
  const ringGeo = new THREE.CylinderGeometry(0.93, 0.93, 0.5, 36);
  const ringMat = new THREE.MeshToonMaterial({ color: 0x0A0A0A });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.set(0, 4.5, 0);
  rocketGroup.add(ringMesh);

  // 5. Window: circular window with black ring, dark glass inside, and small yellow cube
  const windowGroup = new THREE.Group();
  windowGroup.position.set(0, 6.2, 0.9);

  const ringTorusGeo = new THREE.TorusGeometry(0.5, 0.08, 16, 36);
  const ringTorusMat = new THREE.MeshBasicMaterial({ color: 0x0A0A0A });
  const ringTorusMesh = new THREE.Mesh(ringTorusGeo, ringTorusMat);
  ringTorusMesh.position.set(0, 0, 0.02);
  windowGroup.add(ringTorusMesh);

  const glassGeo = new THREE.CircleGeometry(0.48, 32);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x0a1a2a });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.set(0, 0, 0.01);
  windowGroup.add(glassMesh);

  const cubeGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const cubeMat = new THREE.MeshBasicMaterial({ color: 0xFFD400 });
  const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
  cubeMesh.position.set(0, 0, 0.18);
  windowGroup.add(cubeMesh);

  rocketGroup.add(windowGroup);

  // 6. Flame: two downward-pointing cones as children of rocketGroup, at base (y = 0)
  const flameGroup = new THREE.Group();
  flameGroup.position.set(0, 0, 0);

  // Inner flame: yellow #FFD400, MeshBasicMaterial
  const innerFlameGeo = new THREE.ConeGeometry(0.65, 1.0, 24);
  innerFlameGeo.rotateX(Math.PI);
  innerFlameGeo.translate(0, -0.5, 0); // Base at y = 0, tip pointing down to y = -1
  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xFFD400,
    side: THREE.DoubleSide,
  });
  const innerFlameMesh = new THREE.Mesh(innerFlameGeo, innerFlameMat);
  flameGroup.add(innerFlameMesh);

  // Outer flame: larger, magenta #FF2A6D, additive blending, 60% opacity
  const outerFlameGeo = new THREE.ConeGeometry(0.95, 1.0, 24);
  outerFlameGeo.rotateX(Math.PI);
  outerFlameGeo.translate(0, -0.5, 0);
  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xFF2A6D,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const outerFlameMesh = new THREE.Mesh(outerFlameGeo, outerFlameMat);
  flameGroup.add(outerFlameMesh);

  // RCS Orbital Thruster Glow (Active after MECO in zero-G orbit)
  const rcsGlowGeo = new THREE.SphereGeometry(0.35, 16, 16);
  const rcsGlowMat = new THREE.MeshBasicMaterial({
    color: 0x05D9E8,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });
  const rcsGlowMesh = new THREE.Mesh(rcsGlowGeo, rcsGlowMat);
  rcsGlowMesh.position.set(0, -0.15, 0);
  rcsGlowMesh.visible = false;
  flameGroup.add(rcsGlowMesh);

  flameGroup.visible = false;
  rocketGroup.add(flameGroup);

  // Expose child handles for scene control & disposal
  rocketGroup.flameGroup = flameGroup;
  rocketGroup.innerFlameMesh = innerFlameMesh;
  rocketGroup.outerFlameMesh = outerFlameMesh;
  rocketGroup.rcsGlowMesh = rcsGlowMesh;
  rocketGroup.rcsGlowMat = rcsGlowMat;

  rocketGroup.userData = {
    windowCube: cubeMesh,
    flameGroup,
    innerFlameMesh,
    outerFlameMesh,
    rcsGlowMesh,
    rcsGlowMat,
    geometries: [
      bodyGeo, bodyOutlineGeo, noseGeo, noseOutlineGeo,
      finGeo, finOutlineGeo, ringGeo, ringTorusGeo,
      glassGeo, cubeGeo, innerFlameGeo, outerFlameGeo, rcsGlowGeo,
    ],
    materials: [
      bodyMat, noseMat, finMat, outlineMat,
      ringMat, ringTorusMat, glassMat, cubeMat,
      innerFlameMat, outerFlameMat, rcsGlowMat,
    ],
  };

  return rocketGroup;
}

/**
 * Builds and returns the launch pad platform with emissive edge strips.
 * Its top surface is at local y = 0.
 *
 * @returns {THREE.Group} The assembled pad group with top surface at y = 0.
 */
export function createPad() {
  const padGroup = new THREE.Group();

  // Launch Pad: visibly thick platform (BoxGeometry 10 x 0.8 x 10, top color #14141c)
  // Top surface at y = 0 -> center at y = -0.4 (spans y = -0.8 to 0)
  const padGeo = new THREE.BoxGeometry(10, 0.8, 10);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x14141c,
    roughness: 0.85,
    metalness: 0.1,
  });
  const padMesh = new THREE.Mesh(padGeo, padMat);
  padMesh.position.set(0, -0.4, 0);
  padGroup.add(padMesh);

  // Emissive cyan (#05D9E8) edge strips at 2x thickness (height 0.08, width 0.28) and emissive intensity 2
  // Relative to top surface at y = 0, edge strips sit at y = +0.02
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x05D9E8,
    emissive: 0x05D9E8,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });
  const edgeGeoNS = new THREE.BoxGeometry(10, 0.08, 0.28);
  const edgeGeoEW = new THREE.BoxGeometry(0.28, 0.08, 10);

  const edgeNorth = new THREE.Mesh(edgeGeoNS, edgeMat);
  edgeNorth.position.set(0, 0.02, -4.86);
  padGroup.add(edgeNorth);

  const edgeSouth = new THREE.Mesh(edgeGeoNS, edgeMat);
  edgeSouth.position.set(0, 0.02, 4.86);
  padGroup.add(edgeSouth);

  const edgeEast = new THREE.Mesh(edgeGeoEW, edgeMat);
  edgeEast.position.set(4.86, 0.02, 0);
  padGroup.add(edgeEast);

  const edgeWest = new THREE.Mesh(edgeGeoEW, edgeMat);
  edgeWest.position.set(-4.86, 0.02, 0);
  padGroup.add(edgeWest);

  padGroup.userData = {
    padMesh,
    edgeNorth,
    edgeSouth,
    edgeEast,
    edgeWest,
    padMat,
    edgeMat,
    geometries: [padGeo, edgeGeoNS, edgeGeoEW],
    materials: [padMat, edgeMat],
  };

  return padGroup;
}

export function initRocket3D() {
  const section = document.getElementById('scene-rocket');
  if (!section) return;

  // Kill existing trigger if re-initialized
  ScrollTrigger.getById('rocket3d-trigger')?.kill();

  // Reset section and apply gradient background
  section.innerHTML = '';
  section.style.setProperty('--horizon', ROCKET_SKY.defaultHorizon || '58%');
  section.style.background = ROCKET_SKY.gradient;
  section.style.position = 'relative';
  section.style.overflow = 'hidden';

  // Configure portal-under container margin-top if present
  const irisLen = CONFIG.scrollLengths?.irisLen ?? 80;
  const portalParent = section.closest('.portal-under') || (section.parentElement?.classList?.contains('portal-under') ? section.parentElement : null);
  if (portalParent) {
    portalParent.style.position = 'relative';
    portalParent.style.zIndex = '0';
    portalParent.style.marginTop = `calc(-100vh - ${irisLen} * 1vh)`;
  }

  // Fixed full-screen sky-to-black div: layered above CSS gradient background, below canvas
  const skyBlackOverlay = document.createElement('div');
  skyBlackOverlay.style.position = 'absolute';
  skyBlackOverlay.style.inset = '0';
  skyBlackOverlay.style.width = '100%';
  skyBlackOverlay.style.height = '100%';
  skyBlackOverlay.style.backgroundColor = '#000000';
  skyBlackOverlay.style.opacity = '0';
  skyBlackOverlay.style.pointerEvents = 'none';
  skyBlackOverlay.style.zIndex = '1';
  skyBlackOverlay.style.display = 'none';
  section.appendChild(skyBlackOverlay);

  // Full-screen white flash overlay (fades in and out during ignition)
  const flashOverlay = document.createElement('div');
  flashOverlay.style.position = 'absolute';
  flashOverlay.style.inset = '0';
  flashOverlay.style.width = '100%';
  flashOverlay.style.height = '100%';
  flashOverlay.style.backgroundColor = '#ffffff';
  flashOverlay.style.opacity = '0';
  flashOverlay.style.pointerEvents = 'none';
  flashOverlay.style.zIndex = '30';
  flashOverlay.style.display = 'none';
  section.appendChild(flashOverlay);

  const width = window.innerWidth;
  const height = window.innerHeight;

  // ── 1. Three.js Scene Setup (Transparent canvas & Fog) ──
  const scene = new THREE.Scene();
  scene.background = null; // Transparent: container background shows through
  scene.fog = new THREE.FogExp2(ROCKET_SKY.fogColor, ROCKET_SKY.fogDensity);

  // ── 2. Camera Setup (FOV 50, ~25 units out, 6 units above pad) ──
  const padTopY = 0.6;
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 800);
  camera.position.set(0, padTopY + CAMERA_HEIGHT_ABOVE_PAD, CAMERA_DISTANCE);
  camera.lookAt(0, ROCKET_MIDPOINT_Y, 0);

  // ── 3. WebGL Renderer Setup (alpha: true) ──
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  // ── 4. Lighting Setup ──
  // HemisphereLight (sky 0x2a3355, ground 0x08080c, intensity 0.8)
  const hemiLight = new THREE.HemisphereLight(0x2a3355, 0x08080c, 0.8);
  scene.add(hemiLight);

  // DirectionalLight from upper-left (0x7f8cff, intensity 1.2)
  const dirLight = new THREE.DirectionalLight(0x7f8cff, 1.2);
  dirLight.position.set(-16, 26, 16);
  scene.add(dirLight);

  // Magenta PointLight (#FF2A6D, low intensity) near the pad
  const padPointLight = new THREE.PointLight(0xFF2A6D, 0.85, 16, 2.0);
  padPointLight.position.set(-4.5, 1.8, 4.5);
  scene.add(padPointLight);

  // ── 5. Ground Surface, GridHelper & Launch Pad ──
  // Ground plane (size 6000x6000, color #0a0a12) at Y = 0
  const roofGeo = new THREE.PlaneGeometry(6000, 6000);
  roofGeo.rotateX(-Math.PI / 2);
  const roofMat = new THREE.MeshStandardMaterial({
    color: ROCKET_SKY.groundColor,
    roughness: 0.95,
  });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  scene.add(roofMesh);

  // GridHelper (size 1200, divisions 240, 5-unit cells, center line #FF2A6D, grid #05D9E8)
  const gridHelper = new THREE.GridHelper(1200, 240, 0xFF2A6D, 0x05D9E8);
  gridHelper.material.opacity = 0.12;
  gridHelper.material.transparent = true;
  gridHelper.position.set(0, 0.01, 0); // Sitting just above the ground plane
  scene.add(gridHelper);

  // Launch Pad (built via createPad, top surface at local y = 0, placed at y = 0.8)
  const padGroup = createPad();
  padGroup.position.set(0, 0.8, 0);
  scene.add(padGroup);
  const { padMesh, edgeNorth, edgeSouth, edgeEast, edgeWest, padMat, edgeMat } = padGroup.userData;

  // ── 6. Rocket Hierarchy (built via createRocket(), with base at local y = 0) ──
  const rocketGroup = createRocket();
  const { flameGroup, innerFlameMesh, outerFlameMesh, rcsGlowMesh, rcsGlowMat } = rocketGroup.userData;
  scene.add(rocketGroup);

  // Shockwave: flat RingGeometry lying on the pad (Y = 0.82), cyan #05D9E8
  const shockwaveGeo = new THREE.RingGeometry(1.2, 1.5, 48);
  shockwaveGeo.rotateX(-Math.PI / 2);
  const shockwaveMat = new THREE.MeshBasicMaterial({
    color: 0x05D9E8,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
  shockwaveMesh.position.set(0, 0.82, 0);
  shockwaveMesh.visible = false;
  scene.add(shockwaveMesh);

  // Exhaust Particles: pool of 150 particles (THREE.Points, small round sprites, orange-white)
  const PARTICLE_COUNT = 150;
  const PARTICLE_LIFETIME = 0.12;

  function seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function getRocketRiseY(p) {
    if (p < 0.30) return 0;
    return ROCKET_RISE_HEIGHT * Math.pow((p - 0.30) / 0.70, 2.2);
  }

  const rng = seededRandom(2026);
  const particlesData = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const birth = 0.20 + rng() * 0.60; // Fixed birth progress in [0.20, 0.80]
    const angle = rng() * Math.PI * 2;
    const spread = 0.4 + rng() * 1.4;
    const driftX = Math.cos(angle) * spread;
    const driftY = -0.6 - rng() * 1.6; // Downward drift vector
    const driftZ = Math.sin(angle) * spread;

    // Orange-white color mix
    const colorMix = rng();
    const baseR = 1.0;
    const baseG = 0.45 + 0.55 * colorMix;
    const baseB = 0.1 + 0.9 * colorMix;

    particlesData.push({
      birth,
      lifetime: PARTICLE_LIFETIME,
      driftX,
      driftY,
      driftZ,
      birthRocketY: 0.6 + getRocketRiseY(birth),
      baseR,
      baseG,
      baseB,
    });
  }

  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particleColors = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePositions[i * 3 + 1] = -9999;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

  // Small round sprite texture generator
  function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(255, 210, 140, 0.85)');
    grad.addColorStop(0.65, 'rgba(255, 120, 30, 0.4)');
    grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  const particleTexture = createParticleTexture();
  const particleMat = new THREE.PointsMaterial({
    size: 2.2,
    map: particleTexture,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particlePoints = new THREE.Points(particleGeo, particleMat);
  scene.add(particlePoints);

  // ── Atmospheric Ascent Speed Streaks (Mach lines during atmospheric climb) ──
  const STREAK_COUNT = 60;
  const streakPositions = new Float32Array(STREAK_COUNT * 2 * 3);
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const streakMat = new THREE.LineBasicMaterial({
    color: 0x05D9E8,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const streakLines = new THREE.LineSegments(streakGeo, streakMat);
  streakLines.visible = false;
  scene.add(streakLines);

  const streakData = [];
  const streakRng = seededRandom(999);
  for (let i = 0; i < STREAK_COUNT; i++) {
    const sAngle = streakRng() * Math.PI * 2;
    const sRad = 4.0 + streakRng() * 12.0;
    streakData.push({
      relX: Math.cos(sAngle) * sRad,
      relZ: Math.sin(sAngle) * sRad,
      offsetY: streakRng() * 60,
      len: 4.0 + streakRng() * 8.0,
      speed: 160 + streakRng() * 120,
    });
  }

  // ── Stars (1500 white points on a sphere of radius 300 via createStars) ──
  const starPoints = createStars();
  starPoints.material.opacity = 0.0;
  const starGroup = new THREE.Group();
  starGroup.add(starPoints);
  starGroup.visible = false;
  scene.add(starGroup);

  // ── Orbital Ice Crystals / Space Dust (Floating near rocket in zero-g) ──
  const DUST_COUNT = 45;
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  const dustRng = seededRandom(555);
  const dustData = [];
  for (let i = 0; i < DUST_COUNT; i++) {
    const dAngle = dustRng() * Math.PI * 2;
    const dRad = 1.5 + dustRng() * 5.5;
    dustData.push({
      baseX: Math.cos(dAngle) * dRad,
      baseY: (dustRng() - 0.5) * 14.0,
      baseZ: Math.sin(dAngle) * dRad,
      driftSpd: 0.6 + dustRng() * 1.4,
    });
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xaae5ff,
    size: 1.8,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.visible = false;
  scene.add(dustPoints);

  // Horizon projection vector helpers
  const camDir = new THREE.Vector3();
  const horizonPoint = new THREE.Vector3();

  // ── 8. Render Function (Launch Sequence derived purely from progress p) ──
  function renderScene(p = 0) {
    // 1. Rocket Shake & Vertical Rise
    let shakeAmp = 0;
    if (p <= 0.15) {
      // Idle: shake amplitude ramps from 0 to full across p = 0 to 0.15
      shakeAmp = ROCKET_MAX_SHAKE_AMP * (p / 0.15);
    } else if (p < 0.30) {
      // Ignition: full shake
      shakeAmp = ROCKET_MAX_SHAKE_AMP;
    } else if (p < 0.88) {
      // Liftoff & Atmospheric climb: shake continues at reduced amplitude
      shakeAmp = ROCKET_MAX_SHAKE_AMP * 0.4;
    } else {
      // MECO (Main Engine Cutoff) in orbit: zero vibration in weightless vacuum
      shakeAmp = 0;
    }

    const shakeX = Math.sin(p * 400) * shakeAmp;
    const shakeZ = Math.cos(p * 400) * shakeAmp;
    let riseY = getRocketRiseY(p);
    if (p > 0.88) {
      const pTail = (p - 0.88) / 0.12;
      riseY += 60.0 * (pTail * pTail);
    }

    rocketGroup.position.set(shakeX, 0.6 + riseY, shakeZ);
    rocketGroup.visible = p < 1.0;

    // Rocket Gravity Turn (Orbital Pitch Angle):
    // Up to p = 0.35: vertical climb
    // From p = 0.35 to 0.85: tilts gracefully down-range into orbital trajectory
    // From p = 0.85 to 1.00: settles into orbital insertion coasting attitude
    let pitchRad = 0;
    if (p > 0.35) {
      const tPitch = Math.min(1.0, (p - 0.35) / 0.48);
      pitchRad = Math.sin(tPitch * Math.PI * 0.5) * THREE.MathUtils.degToRad(24);
    }
    rocketGroup.rotation.z = -pitchRad;
    rocketGroup.rotation.y = THREE.MathUtils.degToRad(30);

    // 2. Camera Follow & Shake
    // from p = 0.30 on, camera follows rocket upward with lag:
    // Camera Y = rocket Y - 4 + (the current camera height offset), always looking at a point 3 units above the rocket.
    // At p = 0.88 to 1.0: camera stops following (holds position and lookAt at p = 0.88 values).
    // FOV widens from 50 at p = 0.30 to ~73.2 at p = 0.88, then eases down to 60 over p = 0.88 to 1.0.
    // Add small camera shake (sin(p * 600), max 0.05 units) between p = 0.3 and p = 0.7.
    const baseCamY = padTopY + CAMERA_HEIGHT_ABOVE_PAD; // 6.6
    let camY = baseCamY;
    let targetY = ROCKET_MIDPOINT_Y;

    if (p >= 0.30) {
      const pFollow = Math.min(0.88, p);
      const lagBlend = Math.min(1.0, (pFollow - 0.30) / 0.08);
      const followRiseY = getRocketRiseY(pFollow);
      camY = baseCamY + followRiseY - (lagBlend * 4.0);
      targetY = ROCKET_MIDPOINT_Y + followRiseY + (lagBlend * 3.0);

      const fovAt088 = 50 + (78 - 50) * ((0.88 - 0.30) / 0.70); // 73.2
      if (p <= 0.88) {
        const fovT = (p - 0.30) / 0.70;
        camera.fov = 50 + (78 - 50) * fovT;
      } else {
        const tTail = Math.min(1.0, (p - 0.88) / 0.12);
        const easeTail = tTail * tTail * (3 - 2 * tTail);
        camera.fov = fovAt088 + (60 - fovAt088) * easeTail;
      }
      camera.updateProjectionMatrix();
    } else {
      if (camera.fov !== 50) {
        camera.fov = 50;
        camera.updateProjectionMatrix();
      }
    }

    // Small camera shake between p = 0.3 and p = 0.7 (max 0.05 units)
    let camShakeX = 0;
    let camShakeY = 0;
    if (p >= 0.30 && p <= 0.70) {
      const shakeEnv = Math.sin(((p - 0.30) / 0.40) * Math.PI);
      camShakeX = Math.sin(p * 600) * 0.05 * shakeEnv;
      camShakeY = Math.cos(p * 600) * 0.03 * shakeEnv;
    }

    camera.position.set(camShakeX, camY + camShakeY, CAMERA_DISTANCE);
    camera.lookAt(0, targetY, 0);

    // 1. Horizon Follows the Camera:
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();

    horizonPoint.copy(camera.position).addScaledVector(camDir, 10000);
    horizonPoint.y = 0;
    horizonPoint.project(camera);

    let horizonPct = ((1 - horizonPoint.y) / 2) * 100;
    horizonPct = Math.max(-20, Math.min(120, horizonPct));
    section.style.setProperty('--horizon', horizonPct.toFixed(2) + '%');

    // 2. Ground and Grid endless camera tracking:
    roofMesh.position.x = camera.position.x;
    roofMesh.position.z = camera.position.z;
    roofMesh.position.y = 0;

    gridHelper.position.x = Math.round(camera.position.x / 5) * 5;
    gridHelper.position.z = Math.round(camera.position.z / 5) * 5;
    gridHelper.position.y = 0.01;

    // The star group must follow the camera position so stars never get closer
    starGroup.position.copy(camera.position);

    // 3. Atmospheric Speed Streaks (Mach lines during atmospheric climb)
    if (p >= 0.32 && p <= 0.72) {
      let streakFade = 0;
      if (p < 0.42) {
        streakFade = (p - 0.32) / 0.10;
      } else if (p < 0.58) {
        streakFade = 1.0;
      } else {
        streakFade = (0.72 - p) / 0.14;
      }
      streakMat.opacity = streakFade * 0.75;
      streakLines.visible = true;

      const sArr = streakGeo.attributes.position.array;
      for (let i = 0; i < STREAK_COUNT; i++) {
        const sd = streakData[i];
        const yMid = ((sd.offsetY - p * sd.speed) % 70) + riseY;
        sArr[i * 6]     = sd.relX;
        sArr[i * 6 + 1] = yMid + sd.len * 0.5;
        sArr[i * 6 + 2] = sd.relZ;

        sArr[i * 6 + 3] = sd.relX;
        sArr[i * 6 + 4] = yMid - sd.len * 0.5;
        sArr[i * 6 + 5] = sd.relZ;
      }
      streakGeo.attributes.position.needsUpdate = true;
    } else {
      streakLines.visible = false;
    }

    // 5. Sky to Black: opacity going from 0 at p = 0.45 to 1 at p = 0.90
    let skyOpacity = 0;
    if (p >= 0.45) {
      skyOpacity = Math.min(1.0, (p - 0.45) / (0.90 - 0.45));
    }
    skyBlackOverlay.style.opacity = skyOpacity.toFixed(3);
    skyBlackOverlay.style.display = skyOpacity > 0 ? 'block' : 'none';

    // 6. Stars: material opacity from 0 at p = 0.60 to 1 at p = 0.90
    if (p >= 0.60) {
      const starOpacity = Math.min(1.0, (p - 0.60) / (0.90 - 0.60));
      starPoints.material.opacity = starOpacity;
      starGroup.visible = true;
    } else {
      starPoints.material.opacity = 0;
      starGroup.visible = false;
    }

    // 7. Horizon and Grid Fade: fade ground grid and fog opacity out between p = 0.35 and p = 0.7
    // From p = 0.90, set pad, ground, and grid visible = false
    let groundFade = 1.0;
    if (p >= 0.35) {
      groundFade = Math.max(0, 1.0 - (p - 0.35) / (0.70 - 0.35));
    }
    const showGroundElements = p < 0.90;
    gridHelper.material.opacity = 0.12 * groundFade;
    gridHelper.visible = groundFade > 0.001 && showGroundElements;
    scene.fog.density = 0.006 * groundFade;
    roofMat.opacity = groundFade;
    roofMat.transparent = true;
    roofMesh.visible = showGroundElements;
    padGroup.visible = showGroundElements;
    padMat.opacity = groundFade;
    padMat.transparent = true;
    padMesh.visible = showGroundElements;
    edgeMat.opacity = groundFade;
    edgeMat.transparent = true;
    edgeNorth.visible = showGroundElements;
    edgeSouth.visible = showGroundElements;
    edgeEast.visible = showGroundElements;
    edgeWest.visible = showGroundElements;

    // 8. White Flash Overlay: fades in and out between p = 0.15 and 0.30 (peak 0.9 at p = 0.22)
    let flashOpacity = 0;
    if (p >= 0.15 && p <= 0.30) {
      if (p <= 0.22) {
        flashOpacity = ROCKET_FLASH_PEAK_OPACITY * ((p - 0.15) / (0.22 - 0.15));
      } else {
        flashOpacity = ROCKET_FLASH_PEAK_OPACITY * ((0.30 - p) / (0.30 - 0.22));
      }
    }
    flashOverlay.style.opacity = flashOpacity.toFixed(3);
    flashOverlay.style.display = flashOpacity > 0.001 ? 'block' : 'none';

    // 9. Flame & MECO
    if (p < 0.15) {
      flameGroup.visible = false;
    } else if (p >= 0.88) {
      // MECO (Main Engine Cutoff): main flame cuts off in orbit, gentle cyan RCS thruster glow fades with tail
      const flameFade = Math.max(0, 1.0 - (p - 0.88) / 0.12);
      innerFlameMesh.scale.set(0.001, 0.001, 0.001);
      outerFlameMesh.scale.set(0.001, 0.001, 0.001);
      if (flameFade > 0.001) {
        rcsGlowMesh.visible = true;
        rcsGlowMat.opacity = (0.85 + 0.15 * Math.sin(p * 80)) * flameFade;
        flameGroup.visible = true;
      } else {
        rcsGlowMesh.visible = false;
        flameGroup.visible = false;
      }
    } else {
      rcsGlowMesh.visible = false;
      flameGroup.visible = true;
      const tFlame = Math.min(1.0, (p - 0.15) / (0.50 - 0.15));
      const baseLen = ROCKET_MAX_FLAME_LEN * tFlame;
      const flicker = 1.0 + 0.10 * Math.sin(p * 900);
      const currentLen = Math.max(0.01, baseLen * flicker);

      innerFlameMesh.scale.set(1.0, currentLen, 1.0);
      outerFlameMesh.scale.set(1.2, currentLen * 1.15, 1.2);
    }

    // 10. Shockwave Ring: scale 1 to 9, opacity 0.9 to 0 between p = 0.20 and 0.40
    if (p >= 0.20 && p <= 0.40) {
      shockwaveMesh.visible = true;
      const tShock = (p - 0.20) / (0.40 - 0.20);
      const shockScale = 1.0 + 8.0 * tShock;
      const shockOpacity = 0.9 * (1.0 - tShock);
      shockwaveMesh.scale.set(shockScale, 1.0, shockScale);
      shockwaveMat.opacity = shockOpacity;
    } else {
      shockwaveMesh.visible = false;
    }

    // 11. Exhaust Particles
    const posArr = particleGeo.attributes.position.array;
    const colArr = particleGeo.attributes.color.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const pData = particlesData[i];
      const age = p - pData.birth;
      if (age >= 0 && age <= pData.lifetime && p < 0.88) {
        const tLife = age / pData.lifetime;
        const fade = 1.0 - tLife;

        posArr[i * 3]     = pData.driftX * age * 40;
        posArr[i * 3 + 1] = pData.birthRocketY + pData.driftY * age * 40;
        posArr[i * 3 + 2] = pData.driftZ * age * 40;

        colArr[i * 3]     = pData.baseR * fade;
        colArr[i * 3 + 1] = pData.baseG * fade;
        colArr[i * 3 + 2] = pData.baseB * fade;
      } else {
        posArr[i * 3 + 1] = -9999;
        colArr[i * 3]     = 0;
        colArr[i * 3 + 1] = 0;
        colArr[i * 3 + 2] = 0;
      }
    }
    particleGeo.attributes.position.needsUpdate = true;
    particleGeo.attributes.color.needsUpdate = true;

    // 12. Space Dust / Orbital Ice Crystals (Zero-G space float, fades out before p = 1.0)
    if (p >= 0.65 && p < 1.0) {
      let dustFade = Math.min(1.0, (p - 0.65) / 0.15);
      if (p >= 0.88) {
        dustFade *= Math.max(0, 1.0 - (p - 0.88) / 0.10);
      }
      if (dustFade > 0.001) {
        dustMat.opacity = dustFade * 0.85;
        dustPoints.visible = true;
        const dArr = dustGeo.attributes.position.array;
        for (let i = 0; i < DUST_COUNT; i++) {
          const dd = dustData[i];
          dArr[i * 3]     = dd.baseX + Math.sin(p * 20 * dd.driftSpd) * 0.8;
          dArr[i * 3 + 1] = riseY + dd.baseY + Math.cos(p * 15 * dd.driftSpd) * 0.8;
          dArr[i * 3 + 2] = dd.baseZ + Math.sin(p * 18 * dd.driftSpd) * 0.8;
        }
        dustGeo.attributes.position.needsUpdate = true;
      } else {
        dustPoints.visible = false;
      }
    } else {
      dustPoints.visible = false;
    }

    // Render frame
    renderer.render(scene, camera);
  }

  // ── 9. Window Resize Handler ──
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

  // ── 10. ScrollTrigger Setup (Tracking scroll progress p) ──
  let isSceneActive = true;

  const rocketLen = CONFIG.scrollLengths?.rocket || 300;
  const total = rocketLen + irisLen;

  function clamp(val, min = 0, max = 1) {
    return Math.min(max, Math.max(min, val));
  }

  ScrollTrigger.create({
    id: 'rocket3d-trigger',
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * total / 100}`,
    pin: true,
    scrub: 0.5,
    invalidateOnRefresh: true,
    onToggle: (self) => {
      isSceneActive = self.isActive;
      if (isSceneActive) {
        const pRocket = clamp((self.progress * total - irisLen) / rocketLen, 0, 1);
        lastProgress = pRocket;
        renderScene(pRocket);
      }
    },
    onUpdate: (self) => {
      const pRocket = clamp((self.progress * total - irisLen) / rocketLen, 0, 1);
      lastProgress = pRocket;
      if (isSceneActive) {
        renderScene(pRocket);
      }
    },
    onRefresh: () => {
      renderScene(lastProgress);
    },
  });

  // Initial draw
  renderScene(0);

  // ── 11. Disposal Helper ──
  return function disposeRocket3D() {
    window.removeEventListener('resize', onWindowResize);
    ScrollTrigger.getById('rocket3d-trigger')?.kill();

    if (skyBlackOverlay && skyBlackOverlay.parentNode) {
      skyBlackOverlay.parentNode.removeChild(skyBlackOverlay);
    }
    if (flashOverlay && flashOverlay.parentNode) {
      flashOverlay.parentNode.removeChild(flashOverlay);
    }

    // Dispose all geometries
    [
      roofGeo, gridHelper?.geometry,
      shockwaveGeo, particleGeo, streakGeo, starPoints?.geometry, dustGeo,
      ...(padGroup?.userData?.geometries || []),
      ...(rocketGroup?.userData?.geometries || []),
    ].forEach((g) => g?.dispose());

    // Dispose all materials
    [
      roofMat, gridHelper?.material,
      shockwaveMat, particleMat, streakMat, starPoints?.material, dustMat,
      ...(padGroup?.userData?.materials || []),
      ...(rocketGroup?.userData?.materials || []),
    ].forEach((m) => m?.dispose());

    particleTexture?.dispose();

    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}
