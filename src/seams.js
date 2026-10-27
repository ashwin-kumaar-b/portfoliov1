// ============================================================
// seams.js — Cross-Scene Shared View & Environment Constants
// ============================================================

export const ROCKET_VIEW = {
  distance: 25,
  height: 6,
  fov: 50,
  lookAtY: 7.35,
};

export const ROCKET_SKY = {
  fogColor: 0x2a1040,
  fogDensity: 0.006,
  groundColor: 0x0a0a12,
  gradient: 'linear-gradient(to bottom, #050507 0%, #0d0a1c calc(var(--horizon) - 28%), #3a1450 calc(var(--horizon) - 8%), #ff2a6d55 var(--horizon), transparent calc(var(--horizon) + 0.5%))',
  defaultHorizon: '58%',
};
