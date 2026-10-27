// ============================================================
// run.js — Scene 3: Silhouette Run (Cyberpunk Anime)
//           Supports dual runner styles: "humanoid" | "cube"
//           Configured via CONFIG.runner.style in src/config.js
// ============================================================
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG, RUNNER_STYLE } from '../config.js';

// ── Tuning Constants: Shared / Environment ──
export const GROUND_HEIGHT_RATIO = 0.12;    // Ground strip ~12% of viewport height
export const PHASE_SPEED_SLOW = 3.0;        // ~3 full cycles in 0.0 - 0.5 progress
export const PHASE_SPEED_FAST = 10.0;       // Rapid cycles in 0.5 - 1.0 progress
export const CLONE_SPACING = 70;            // Pixels between clone triggers (70px)
export const CLONE_COUNT = 14;              // Number of pre-created clones
export const SMEAR_START = 0.48;            // Progress start of smear frame
export const SMEAR_END = 0.54;              // Progress end of smear frame
export const SMEAR_STRETCH = 1.4;           // Max horizontal stretch (scaleX factor)
export const TEXT_FADE_START = 0.85;        // Progress threshold where all text fades
export const ANIME_FRAMES_PER_CYCLE = 12;   // 12 discrete anime poses per cycle

// ── Tuning Constants: Humanoid ──
export const RUNNER_UNIT_HEIGHT = 200;      // Base humanoid rig unit height
export const RUNNER_VIEWPORT_SCALE = 0.28;  // Humanoid is ~28% of viewport height
export const STRIDE_MAX_ANGLE = 44;         // Max thigh swing angle (degrees)
export const LEAN_ANGLE_SLOW = 12;          // Torso forward lean slow motion (deg)
export const LEAN_ANGLE_FAST = 28;          // Torso forward lean speed burst (deg)
export const BOB_AMOUNT = 9;                // Vertical bobbing amplitude
export const JACKET_FLAP_SLOW = 22;         // Flap base angle slow motion (deg)
export const JACKET_FLAP_FAST = 65;         // Flap flare angle speed burst (deg)

// ── Tuning Constants: Cube ──
export const CUBE_UNIT_SIZE = 100;          // Base cube rig unit size
export const CUBE_VIEWPORT_SCALE = 0.14;    // Cube is ~12-15% of viewport height
export const CUBE_HOP_HEIGHT = 0;           // 0: slides straight without bouncing
export const CUBE_HOP_FREQUENCY = 0;        // 0: no hop oscillation
export const CUBE_TILT_SLOW = 0;            // Upright (no forward tilt)
export const CUBE_TILT_FAST = 0;            // Upright (no forward tilt)
export const CUBE_BURST_STRETCH_X = 1.0;    // Solid cube (no squash/stretch)
export const CUBE_BURST_SQUASH_Y = 1.0;     // Solid cube (no squash/stretch)
export const CUBE_FLAP_SLOW = 18;           // Flap stream angle in slow phase (deg)
export const CUBE_FLAP_FAST = 65;           // Flap stream angle in speed burst (deg)

// ── Afterimage Clone Color Palette (warm → cool gradient) ──
export const CLONE_PALETTE = [
  '#990000',   // 0: dark red (closest to runner)
  '#C00020',   // 1: crimson
  '#E11D48',   // 2: ruby / rose
  '#DB2777',   // 3: pink
  '#C026D3',   // 4: fuchsia
  '#9333EA',   // 5: purple
  '#7C3AED',   // 6: violet
  '#4F46E5',   // 7: indigo
  '#2563EB',   // 8: cobalt blue
  '#0284C7',   // 9: sky blue
  '#06B6D4',   // 10: cyan
  '#05D9E8',   // 11: neon cyan
  '#10B981',   // 12: mint / teal
  '#34D399',   // 13: neon emerald (farthest)
];

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Helper to construct SVG elements with attributes.
 */
function createSvgElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, String(val));
  }
  return el;
}

/**
 * Recolors all filled shapes in an SVG rig to the given color.
 */
function setRigColor(rigRoot, color) {
  const shapes = rigRoot.querySelectorAll('polygon, circle, path, rect, ellipse');
  for (let i = 0; i < shapes.length; i++) {
    // Keep neon accent strokes/fills distinctive if intended, but recolor solid fills
    if (shapes[i].getAttribute('data-keep-color') !== 'true') {
      shapes[i].setAttribute('fill', color);
    }
  }
}

// ============================================================
// 1. HUMANOID RIG
// ============================================================

/**
 * Creates a complete humanoid character rig with hierarchical joint nesting.
 * Pivot points for rotations are positioned at (0, 0) of each rotating <g>.
 * Natively faces RIGHT (+X).
 */
export function createHumanoidRig() {
  const root = createSvgElement('g', { class: 'runner-root runner-humanoid' });
  const pelvisBob = createSvgElement('g', { class: 'runner-pelvis-bob' });
  root.appendChild(pelvisBob);

  // ── 1. Far Leg (attached at hipX = -4, hipY = -100) ──
  const farLegRoot = createSvgElement('g', { transform: 'translate(-4, -100)' });
  const farThigh = createSvgElement('g', { class: 'thigh-rotate' });
  const farThighPoly = createSvgElement('polygon', {
    points: '-6,0 6,0 4,46 -4,46',
    fill: '#0A0A0A',
  });
  farThigh.appendChild(farThighPoly);

  const farKneeJoint = createSvgElement('g', { transform: 'translate(0, 46)' });
  const farShin = createSvgElement('g', { class: 'shin-rotate' });
  const farShinPoly = createSvgElement('polygon', {
    points: '-4,0 5,0 3,44 -3,44',
    fill: '#0A0A0A',
  });
  farShin.appendChild(farShinPoly);

  const farAnkleJoint = createSvgElement('g', { transform: 'translate(0, 44)' });
  const farFoot = createSvgElement('g', { class: 'foot-rotate' });
  const farFootPoly = createSvgElement('polygon', {
    points: '-6,0 5,0 12,0 19,3 18,9 -6,9',
    fill: '#0A0A0A',
  });
  farFoot.appendChild(farFootPoly);

  farAnkleJoint.appendChild(farFoot);
  farShin.appendChild(farAnkleJoint);
  farKneeJoint.appendChild(farShin);
  farThigh.appendChild(farKneeJoint);
  farLegRoot.appendChild(farThigh);
  pelvisBob.appendChild(farLegRoot);

  // ── 2. Torso Group (origin at hip/pelvis translate(0, -100)) ──
  const torsoGroup = createSvgElement('g', { transform: 'translate(0, -100)' });
  const torsoRotate = createSvgElement('g', { class: 'torso-rotate' });

  // Far Arm inside Torso (shoulder at (-8, -50))
  const farArmRoot = createSvgElement('g', { transform: 'translate(-8, -50)' });
  const farUpperArm = createSvgElement('g', { class: 'upperarm-rotate' });
  const farUpperPoly = createSvgElement('polygon', {
    points: '-4,0 4,0 3,32 -3,32',
    fill: '#0A0A0A',
  });
  farUpperArm.appendChild(farUpperPoly);

  const farElbowJoint = createSvgElement('g', { transform: 'translate(0, 32)' });
  const farForearm = createSvgElement('g', { class: 'forearm-rotate' });
  const farForePoly = createSvgElement('polygon', {
    points: '-3,0 4,0 2,28 -2,28',
    fill: '#0A0A0A',
  });
  const farHandPoly = createSvgElement('polygon', {
    points: '-2,28 3,28 4,37 -1,37',
    fill: '#0A0A0A',
  });
  farForearm.appendChild(farForePoly);
  farForearm.appendChild(farHandPoly);

  farElbowJoint.appendChild(farForearm);
  farUpperArm.appendChild(farElbowJoint);
  farArmRoot.appendChild(farUpperArm);
  torsoRotate.appendChild(farArmRoot);

  // Torso Body Polygon (trapezoid from hips (0,0) to shoulders (0,-55))
  const torsoPoly = createSvgElement('polygon', {
    points: '-7,0 7,0 11,-55 -11,-55',
    fill: '#0A0A0A',
  });
  torsoRotate.appendChild(torsoPoly);

  // Jacket Collar (popped anime V-collar at neck)
  const collarPoly = createSvgElement('polygon', {
    points: '-11,-53 -4,-68 3,-58 1,-50',
    fill: '#0A0A0A',
  });
  torsoRotate.appendChild(collarPoly);

  // Jacket Hem Flap (trails behind from lower back (-6, -2))
  const flapRoot = createSvgElement('g', { transform: 'translate(-6, -2)' });
  const jacketFlap = createSvgElement('g', { class: 'jacket-flap-rotate' });
  const flapPoly = createSvgElement('polygon', {
    points: '0,0 -8,5 -32,16 -36,13 -18,3 -4,-2',
    fill: '#0A0A0A',
  });
  jacketFlap.appendChild(flapPoly);
  flapRoot.appendChild(jacketFlap);
  torsoRotate.appendChild(flapRoot);

  // Head Group (attached at neck (2, -58), facing +X right)
  const headRoot = createSvgElement('g', { transform: 'translate(2, -58)' });
  const headRotate = createSvgElement('g', { class: 'head-rotate' });
  const neckPoly = createSvgElement('polygon', {
    points: '-4,3 4,3 3,-5 -3,-5',
    fill: '#0A0A0A',
  });
  // Angular anime head silhouette profile (~r=13)
  const headCircle = createSvgElement('circle', {
    cx: '0',
    cy: '-14',
    r: '12',
    fill: '#0A0A0A',
  });
  const headPath = createSvgElement('path', {
    d: 'M 0,-5 L 5,-2 L 8,-5 L 12,-12 L 6,-20 L 2,-25 L -6,-26 L -14,-22 L -20,-15 L -15,-18 L -18,-11 L -12,-12 L -8,-7 Z',
    fill: '#0A0A0A',
  });
  headRotate.appendChild(neckPoly);
  headRotate.appendChild(headCircle);
  headRotate.appendChild(headPath);
  headRoot.appendChild(headRotate);
  torsoRotate.appendChild(headRoot);

  // Near Arm inside Torso (shoulder at (8, -50))
  const nearArmRoot = createSvgElement('g', { transform: 'translate(8, -50)' });
  const nearUpperArm = createSvgElement('g', { class: 'upperarm-rotate' });
  const nearUpperPoly = createSvgElement('polygon', {
    points: '-4,0 4,0 3,32 -3,32',
    fill: '#0A0A0A',
  });
  nearUpperArm.appendChild(nearUpperPoly);

  const nearElbowJoint = createSvgElement('g', { transform: 'translate(0, 32)' });
  const nearForearm = createSvgElement('g', { class: 'forearm-rotate' });
  const nearForePoly = createSvgElement('polygon', {
    points: '-3,0 4,0 2,28 -2,28',
    fill: '#0A0A0A',
  });
  const nearHandPoly = createSvgElement('polygon', {
    points: '-2,28 3,28 4,37 -1,37',
    fill: '#0A0A0A',
  });
  nearForearm.appendChild(nearForePoly);
  nearForearm.appendChild(nearHandPoly);

  nearElbowJoint.appendChild(nearForearm);
  nearUpperArm.appendChild(nearElbowJoint);
  nearArmRoot.appendChild(nearUpperArm);
  torsoRotate.appendChild(nearArmRoot);

  torsoGroup.appendChild(torsoRotate);
  pelvisBob.appendChild(torsoGroup);

  // ── 3. Near Leg (attached at hipX = 4, hipY = -100) ──
  const nearLegRoot = createSvgElement('g', { transform: 'translate(4, -100)' });
  const nearThigh = createSvgElement('g', { class: 'thigh-rotate' });
  const nearThighPoly = createSvgElement('polygon', {
    points: '-6,0 6,0 4,46 -4,46',
    fill: '#0A0A0A',
  });
  nearThigh.appendChild(nearThighPoly);

  const nearKneeJoint = createSvgElement('g', { transform: 'translate(0, 46)' });
  const nearShin = createSvgElement('g', { class: 'shin-rotate' });
  const nearShinPoly = createSvgElement('polygon', {
    points: '-4,0 5,0 3,44 -3,44',
    fill: '#0A0A0A',
  });
  nearShin.appendChild(nearShinPoly);

  const nearAnkleJoint = createSvgElement('g', { transform: 'translate(0, 44)' });
  const nearFoot = createSvgElement('g', { class: 'foot-rotate' });
  const nearFootPoly = createSvgElement('polygon', {
    points: '-6,0 5,0 12,0 19,3 18,9 -6,9',
    fill: '#0A0A0A',
  });
  nearFoot.appendChild(nearFootPoly);

  nearAnkleJoint.appendChild(nearFoot);
  nearShin.appendChild(nearAnkleJoint);
  nearKneeJoint.appendChild(nearShin);
  nearThigh.appendChild(nearKneeJoint);
  nearLegRoot.appendChild(nearThigh);
  pelvisBob.appendChild(nearLegRoot);

  return {
    root,
    joints: {
      pelvisBob,
      torso: torsoRotate,
      head: headRotate,
      jacketFlap,
      nearThigh,
      nearShin,
      nearFoot,
      farThigh,
      farShin,
      farFoot,
      nearUpperArm,
      nearForearm,
      farUpperArm,
      farForearm,
    },
  };
}

/**
 * Sets all joint angles on a humanoid runner rig for a given phase and speed factor.
 * Snaps phase to 12 discrete positions per cycle ("animate on twos").
 * Anatomically correct: knees flex backward (positive angle in SVG), elbows flex forward (negative angle in SVG).
 */
export function setHumanoidPose(runner, phase, speedT) {
  // 1. Anime on twos: snap phase to 12 discrete positions per cycle
  const step = (2 * Math.PI) / ANIME_FRAMES_PER_CYCLE;
  const p = Math.floor(phase / step) * step;

  // 2. Dynamics based on speedT [0, 1]
  const stride = STRIDE_MAX_ANGLE * (0.85 + 0.25 * speedT);
  const lean = LEAN_ANGLE_SLOW + (LEAN_ANGLE_FAST - LEAN_ANGLE_SLOW) * speedT;
  // Positive lean tilts torso forward (+X)
  const torsoAngle = lean + Math.sin(2 * p) * (1.5 + 2 * speedT);
  // Head keeps gaze level forward
  const headAngle = -torsoAngle * 0.45;

  // Vertical pelvic bobbing (Y goes down in SVG, so negative bobY bobs up)
  const bobY = -Math.abs(Math.sin(p)) * BOB_AMOUNT;

  // Jacket flap angle: trails behind, flutters with speed (negative angle flares up & back)
  const flapAngle = -(
    JACKET_FLAP_SLOW +
    (JACKET_FLAP_FAST - JACKET_FLAP_SLOW) * speedT +
    Math.sin(p * 2 + 1) * (4 + 8 * speedT)
  );

  // 3. Leg angles (near = p, far = p + PI)
  // Positive rotation of vertical thigh in SVG = forward swing (+X)
  // Positive rotation of vertical shin in SVG = backward knee flexion (-X)
  const phiNear = p;
  const sNear = Math.sin(phiNear);
  const cNear = Math.cos(phiNear);
  const thighNear = sNear * stride;
  // Knee flexes backwards during swing and transition; extends on drive
  const kneeFlexNear = Math.max(0, sNear) * (55 + 25 * speedT) + Math.max(0, -cNear) * 25;
  const kneeNear = 8 + kneeFlexNear;
  const footNear = -sNear * 14;

  const phiFar = p + Math.PI;
  const sFar = Math.sin(phiFar);
  const cFar = Math.cos(phiFar);
  const thighFar = sFar * stride;
  const kneeFlexFar = Math.max(0, sFar) * (55 + 25 * speedT) + Math.max(0, -cFar) * 25;
  const kneeFar = 8 + kneeFlexFar;
  const footFar = -sFar * 14;

  // 4. Arm angles (opposite to legs)
  // Arm swings forward when opposite leg is forward
  const armNear = -sNear * (stride * 0.85);
  // In SVG, NEGATIVE angle bends the forearm FORWARD (+X)
  const elbowNear = -(65 + sNear * 18);

  const armFar = -sFar * (stride * 0.85);
  const elbowFar = -(65 + sFar * 18);

  // 5. Update joint transforms
  const j = runner.joints;
  j.pelvisBob.setAttribute('transform', `translate(0, ${bobY.toFixed(2)})`);
  j.torso.setAttribute('transform', `rotate(${torsoAngle.toFixed(2)})`);
  j.head.setAttribute('transform', `rotate(${headAngle.toFixed(2)})`);
  j.jacketFlap.setAttribute('transform', `rotate(${flapAngle.toFixed(2)})`);

  j.nearThigh.setAttribute('transform', `rotate(${thighNear.toFixed(2)})`);
  j.nearShin.setAttribute('transform', `rotate(${kneeNear.toFixed(2)})`);
  j.nearFoot.setAttribute('transform', `rotate(${footNear.toFixed(2)})`);

  j.farThigh.setAttribute('transform', `rotate(${thighFar.toFixed(2)})`);
  j.farShin.setAttribute('transform', `rotate(${kneeFar.toFixed(2)})`);
  j.farFoot.setAttribute('transform', `rotate(${footFar.toFixed(2)})`);

  j.nearUpperArm.setAttribute('transform', `rotate(${armNear.toFixed(2)})`);
  j.nearForearm.setAttribute('transform', `rotate(${elbowNear.toFixed(2)})`);

  j.farUpperArm.setAttribute('transform', `rotate(${armFar.toFixed(2)})`);
  j.farForearm.setAttribute('transform', `rotate(${elbowFar.toFixed(2)})`);
}

// ============================================================
// 2. CUBE RIG
// ============================================================

/**
 * Creates an original flat black square cube rig.
 * Solid #0A0A0A, hard edges, grounded on bottom line (0, 0).
 * Identity details: thin glowing yellow edge + trailing jacket-like hem flap.
 */
export function createCubeRig() {
  const root = createSvgElement('g', { class: 'runner-root runner-cube' });

  // Cube pivot group (pivot at bottom-center (0, 0))
  const cubePivot = createSvgElement('g', { class: 'cube-pivot' });
  root.appendChild(cubePivot);

  // Body: 100x100 square, bottom-centered at (0, 0)
  // x: -50 to +50, y: -100 to 0
  const body = createSvgElement('rect', {
    x: '-50',
    y: '-100',
    width: '100',
    height: '100',
    rx: '2',
    fill: '#0A0A0A',
  });
  cubePivot.appendChild(body);

  // Identity Detail 1: Glowing yellow accent along top-rear edge
  const neonEdge = createSvgElement('path', {
    d: 'M -50,-65 L -50,-100 L 25,-100',
    stroke: '#FFD400',
    'stroke-width': '3.5',
    'stroke-linecap': 'square',
    'stroke-linejoin': 'miter',
    fill: 'none',
    'data-keep-color': 'true',
  });
  cubePivot.appendChild(neonEdge);

  // Identity Detail 2: Trailing flap on top-rear corner (-50, -96)
  const flapRoot = createSvgElement('g', { transform: 'translate(-50, -96)' });
  const flapRotate = createSvgElement('g', { class: 'cube-flap-rotate' });
  const flapPoly = createSvgElement('polygon', {
    points: '0,0 -12,4 -38,18 -34,13 -16,2 0,-3',
    fill: '#0A0A0A',
  });
  const flapAccent = createSvgElement('polygon', {
    points: '0,-3 -16,2 -34,13 -32,11 -15,0 0,-4',
    fill: '#FFD400',
    'data-keep-color': 'true',
  });
  flapRotate.appendChild(flapPoly);
  flapRotate.appendChild(flapAccent);
  flapRoot.appendChild(flapRotate);
  cubePivot.appendChild(flapRoot);

  return {
    root,
    cubePivot,
    body,
    neonEdge,
    flapRotate,
    flapPoly,
    flapAccent,
  };
}

/**
 * Sets pose for the Cube runner:
 * Slides straight along the ground line with zero bounce, zero tilt, and no distortion.
 */
export function setCubePose(cube, phase, speedT, progress) {
  let flapAngle = 0;
  if (progress <= 0.5) {
    flapAngle = -CUBE_FLAP_SLOW;
  } else {
    const v = Math.min(1, Math.max(0, (progress - 0.5) / 0.5));
    flapAngle = -(CUBE_FLAP_SLOW + (CUBE_FLAP_FAST - CUBE_FLAP_SLOW) * Math.pow(v, 2));
  }

  // Apply transform with pivot at bottom-center (0, 0): slides completely flat & straight
  cube.cubePivot.setAttribute(
    'transform',
    'translate(0, 0) rotate(0, 0, 0) scale(1, 1)'
  );
  cube.flapRotate.setAttribute('transform', `rotate(${flapAngle.toFixed(2)})`);
}

// ============================================================
// 3. UNIFIED RIG FACTORY
// ============================================================

/**
 * Creates a unified rig instance (either humanoid or cube) with standard methods.
 */
function createRig(style) {
  if (style === 'cube') {
    const cube = createCubeRig();
    return {
      type: 'cube',
      root: cube.root,
      unitHeight: CUBE_UNIT_SIZE,
      viewportScale: CUBE_VIEWPORT_SCALE,
      setPose: (phase, speedT, progress) => setCubePose(cube, phase, speedT, progress),
      setColor: (color) => {
        cube.body.setAttribute('fill', color);
        cube.flapPoly.setAttribute('fill', color);
      },
    };
  } else {
    const humanoid = createHumanoidRig();
    return {
      type: 'humanoid',
      root: humanoid.root,
      unitHeight: RUNNER_UNIT_HEIGHT,
      viewportScale: RUNNER_VIEWPORT_SCALE,
      setPose: (phase, speedT, progress) => setHumanoidPose(humanoid, phase, speedT),
      setColor: (color) => setRigColor(humanoid.root, color),
    };
  }
}

// Backward-compatible exports
export const createRunnerRig = createHumanoidRig;
export const setPose = setHumanoidPose;

// ============================================================
// 4. SCROLL MAPPING & KINEMATICS
// ============================================================

/**
 * Computes run phase (in radians) as a function of scene scroll progress [0, 1].
 */
export function computePhase(progress) {
  const phaseAtHalf = PHASE_SPEED_SLOW * (2 * Math.PI);
  if (progress <= 0.5) {
    const u = Math.max(0, progress / 0.5);
    return u * phaseAtHalf;
  }
  const v = Math.min(1, Math.max(0, (progress - 0.5) / 0.5));
  const vEased = Math.pow(v, 2);
  const burstCycles = PHASE_SPEED_FAST * (2 * Math.PI);
  return phaseAtHalf + burstCycles * (0.25 * v + 0.75 * vEased);
}

/**
 * Computes speed factor [0, 1] as a function of scene scroll progress [0, 1].
 */
export function computeSpeedT(progress) {
  if (progress <= 0.5) {
    const u = Math.max(0, progress / 0.5);
    return 0.05 + 0.15 * u;
  }
  const v = Math.min(1, Math.max(0, (progress - 0.5) / 0.5));
  const vEased = Math.pow(v, 2);
  return 0.2 + 0.8 * vEased;
}

/**
 * Computes runner horizontal X position across the screen.
 */
export function computeRunnerX(progress, startX, centerX, endX) {
  if (progress <= 0.5) {
    const u = Math.max(0, progress / 0.5);
    return startX + (centerX - startX) * u;
  }
  const v = Math.min(1, Math.max(0, (progress - 0.5) / 0.5));
  const vEased = Math.pow(v, 2);
  return centerX + (endX - centerX) * vEased;
}

/**
 * Inverse position function: converts X coordinate to scroll progress during speed burst.
 */
export function computeProgressFromX(x, centerX, endX) {
  const totalDist = endX - centerX;
  if (Math.abs(totalDist) < 1e-5) return 0.5;
  const vEased = (x - centerX) / totalDist;
  const clampedVEased = Math.min(1, Math.max(0, vEased));
  const v = Math.sqrt(clampedVEased);
  return 0.5 + 0.5 * v;
}

/**
 * Computes horizontal smear stretch multiplier around transition progress 0.48 - 0.54.
 */
export function computeSmearStretch(progress) {
  if (progress < SMEAR_START || progress > SMEAR_END) return 1.0;
  const smearT = (progress - SMEAR_START) / (SMEAR_END - SMEAR_START);
  const bump = Math.sin(smearT * Math.PI);
  return 1.0 + (SMEAR_STRETCH - 1.0) * bump;
}

// ============================================================
// 5. MAIN SCENE INITIALIZER
// ============================================================

/**
 * Initializes Scene 3: Silhouette Run
 */
export function initRun() {
  const section = document.getElementById('scene-run');
  if (!section) return;

  // Determine active runner style: "humanoid" | "cube"
  const runnerStyle = CONFIG.runner?.style || RUNNER_STYLE || 'humanoid';
  const isLeft = CONFIG.runner.direction === 'left';
  const dir = isLeft ? -1 : 1; // +1 = moves & faces right, -1 = moves & faces left

  // Kill any existing ScrollTrigger associated with this section
  ScrollTrigger.getAll().forEach((st) => {
    if (st.vars.trigger === section || st.trigger === section) {
      st.kill();
    }
  });

  // Clear innerHTML to rebuild scene dynamically
  section.innerHTML = '';
  section.style.background = CONFIG.colors.yellow;

  // ── Overlay Text (upper 55% of viewport, never overlaps the runner) ──
  const textArea = document.createElement('div');
  textArea.className = 'run-text-area';
  textArea.setAttribute('aria-label', 'About Ashwin and Skills');

  const block1 = document.createElement('div');
  block1.className = 'run-text-block run-text-edu';
  block1.innerHTML = `<div>B.Tech AI &amp; Data Science</div><div style="font-size:0.65em;font-weight:400;margin-top:0.35rem;letter-spacing:0.04em;">Rajalakshmi Institute of Technology</div>`;

  const block2 = document.createElement('div');
  block2.className = 'run-text-block run-text-quote';
  block2.textContent = 'Building tech that helps people, not just systems';

  const skillsBlock = document.createElement('div');
  skillsBlock.className = 'run-skills';

  const skillNames = [
    'Web Developer',
    'Flutter Developer',
    'AI / ML',
    'Creative Thinking',
    'Problem Solver',
  ];
  const skillTags = skillNames.map((name) => {
    const tag = document.createElement('span');
    tag.className = 'run-skill-tag';
    tag.textContent = name;
    skillsBlock.appendChild(tag);
    return tag;
  });

  textArea.appendChild(block1);
  textArea.appendChild(block2);
  textArea.appendChild(skillsBlock);
  section.appendChild(textArea);

  // ── Fullscreen SVG ──
  const svg = createSvgElement('svg', {
    class: 'run-svg',
    xmlns: SVG_NS,
  });
  section.appendChild(svg);

  // Ground strip rect in SVG (~12% of viewport height)
  const groundRect = createSvgElement('rect', {
    class: 'run-ground-rect',
    fill: CONFIG.colors.black,
  });
  svg.appendChild(groundRect);

  // ── Pre-created Pool of 14 Afterimage Clones ──
  const clonesGroup = createSvgElement('g', { class: 'run-clones' });
  svg.appendChild(clonesGroup);

  const cloneColorMode = CONFIG.runner?.cloneColorMode || 'gradient';
  const clones = [];
  for (let i = 0; i < CLONE_COUNT; i++) {
    const cloneRig = createRig(runnerStyle);
    if (cloneColorMode === 'gradient') {
      const color = CLONE_PALETTE[i % CLONE_PALETTE.length];
      cloneRig.setColor(color);
    } else {
      cloneRig.setColor('#0A0A0A');
    }
    cloneRig.root.style.display = 'none'; // Initially hidden
    clonesGroup.appendChild(cloneRig.root);
    clones.push({
      index: i,
      rig: cloneRig,
      visible: false,
      isPoseSet: false,
    });
  }

  // ── Main Runner Figure ──
  const mainRunnerGroup = createSvgElement('g', { class: 'run-main-figure' });
  const mainRunner = createRig(runnerStyle);
  mainRunnerGroup.appendChild(mainRunner.root);
  svg.appendChild(mainRunnerGroup);

  // ── Viewport Geometry & Caching ──
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let groundHeight = viewportHeight * GROUND_HEIGHT_RATIO;
  let groundY = viewportHeight - groundHeight;
  let runnerScale = (viewportHeight * mainRunner.viewportScale) / mainRunner.unitHeight;

  let startX = 0;
  let centerX = 0;
  let endX = 0;

  function recalcDimensions() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    groundHeight = viewportHeight * GROUND_HEIGHT_RATIO;
    groundY = viewportHeight - groundHeight;
    runnerScale = (viewportHeight * mainRunner.viewportScale) / mainRunner.unitHeight;

    svg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
    groundRect.setAttribute('x', '0');
    groundRect.setAttribute('y', String(groundY));
    groundRect.setAttribute('width', String(viewportWidth));
    groundRect.setAttribute('height', String(groundHeight + 2)); // slight overlap

    centerX = viewportWidth * 0.5;
    if (dir > 0) {
      // Facing & running right: enters from offscreen left, exits offscreen right
      startX = -Math.max(120, runnerScale * 140);
      endX = viewportWidth + Math.max(140, runnerScale * 160);
    } else {
      // Facing & running left: enters from offscreen right, exits offscreen left
      startX = viewportWidth + Math.max(120, runnerScale * 140);
      endX = -Math.max(140, runnerScale * 160);
    }
  }

  function resetClonePoses() {
    for (let i = 0; i < CLONE_COUNT; i++) {
      clones[i].isPoseSet = false;
    }
  }

  function updateClones(progress, runnerX) {
    if (progress <= 0.5) {
      // Hide all clones before speed burst
      for (let i = 0; i < CLONE_COUNT; i++) {
        const c = clones[i];
        if (c.visible) {
          c.visible = false;
          c.rig.root.style.display = 'none';
        }
      }
      return;
    }

    const cloneStartX = centerX;
    const currentCloneSpacing = runnerStyle === 'cube'
      ? Math.max(CLONE_SPACING, runnerScale * CUBE_UNIT_SIZE * 1.35)
      : CLONE_SPACING;

    for (let i = 0; i < CLONE_COUNT; i++) {
      const c = clones[i];
      const cloneX = cloneStartX + i * currentCloneSpacing * dir;
      const passed = dir > 0 ? (runnerX >= cloneX) : (runnerX <= cloneX);

      if (passed) {
        if (!c.visible) {
          c.visible = true;
          c.rig.root.style.display = '';
          if (!c.isPoseSet) {
            const progAtClone = computeProgressFromX(cloneX, centerX, endX);
            const phaseAtClone = computePhase(progAtClone);
            const speedTAtClone = computeSpeedT(progAtClone);
            c.rig.setPose(phaseAtClone, speedTAtClone, progAtClone);
            c.rig.root.setAttribute(
              'transform',
              `translate(${cloneX.toFixed(2)}, ${groundY.toFixed(2)}) scale(${(runnerScale * dir).toFixed(3)}, ${runnerScale.toFixed(3)})`
            );
            c.isPoseSet = true;
          }
        }
      } else {
        if (c.visible) {
          c.visible = false;
          c.rig.root.style.display = 'none';
        }
      }
    }
  }

  function updateText(progress) {
    // Master exit fade near progress 0.85+
    let fadeMaster = 1.0;
    if (progress >= TEXT_FADE_START) {
      fadeMaster = Math.max(0, 1.0 - (progress - TEXT_FADE_START) / 0.10);
    }

    // Block 1 (Education): visible 0.05 - 0.30+
    const op1 = Math.min(1, Math.max(0, (progress - 0.05) / 0.08)) * fadeMaster;
    block1.style.opacity = op1.toFixed(3);
    block1.style.transform = `translateY(${((1 - op1) * 12).toFixed(1)}px)`;

    // Block 2 (Quote): visible 0.25 - 0.50+
    const op2 = Math.min(1, Math.max(0, (progress - 0.25) / 0.08)) * fadeMaster;
    block2.style.opacity = op2.toFixed(3);
    block2.style.transform = `translateY(${((1 - op2) * 12).toFixed(1)}px)`;

    // Skill Tags: appear one-by-one with stagger starting at 0.40+
    const skillStart = 0.40;
    const skillStagger = 0.055;
    skillTags.forEach((tag, idx) => {
      const tagThreshold = skillStart + idx * skillStagger;
      const opTag = Math.min(1, Math.max(0, (progress - tagThreshold) / 0.05)) * fadeMaster;
      tag.style.opacity = opTag.toFixed(3);
      tag.style.transform = `translateY(${((1 - opTag) * 10).toFixed(1)}px) scale(${(0.95 + 0.05 * opTag).toFixed(3)})`;
    });
  }

  function update(progress) {
    const phase = computePhase(progress);
    const speedT = computeSpeedT(progress);
    const runnerX = computeRunnerX(progress, startX, centerX, endX);
    const smear = runnerStyle === 'cube' ? 1.0 : computeSmearStretch(progress);

    // Update main runner pose and transform
    mainRunner.setPose(phase, speedT, progress);
    const scaleX = runnerScale * dir * smear;
    const scaleY = runnerScale / Math.sqrt(smear); // Volume preservation squash
    mainRunner.root.setAttribute(
      'transform',
      `translate(${runnerX.toFixed(2)}, ${groundY.toFixed(2)}) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`
    );

    // Update afterimage clones
    updateClones(progress, runnerX);

    // Update text overlays
    updateText(progress);
  }

  // Initial calculation & render
  recalcDimensions();
  update(0);

  // ── ScrollTrigger Setup ──
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * (CONFIG.scrollLengths.run / 100)}`,
    pin: true,
    scrub: 0.5,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      update(self.progress);
    },
    onRefresh: () => {
      recalcDimensions();
      resetClonePoses();
      update(0);
    },
  });
}
