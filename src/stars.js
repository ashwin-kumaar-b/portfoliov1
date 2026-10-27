// ============================================================
// stars.js — Seeded Starfield Generator
// Generates 1500 white points on a sphere of radius 300
// ============================================================
import * as THREE from 'three';

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Creates and returns a THREE.Points object with 1500 white points
 * uniformly distributed on a sphere of radius 300 using a fixed-seed RNG.
 *
 * @param {number} [seed=1337] - Seed for deterministic random generation.
 * @returns {THREE.Points} The starfield points object.
 */
export function createStars(seed = 1337) {
  const STAR_COUNT = 1500;
  const R = 300;
  const rng = seededRandom(seed);
  const positions = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    const u = rng();
    const v = rng();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);

    positions[i * 3]     = R * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = R * Math.cos(phi);
    positions[i * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.3,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}
