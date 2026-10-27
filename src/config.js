// ============================================================
// config.js — Central configuration for the entire portfolio
// Adjust scroll lengths, colors, links, and pacing here.
// ============================================================

// Central runner style switch: "humanoid" | "cube" (default "humanoid")
export const RUNNER_STYLE = 'cube';

// City scene mode: "3d" | "2d" (default "3d")
export const CITY_MODE = '3d';

// Bloom post-processing for 3D city: default true on desktop (>=768px), false on narrow screens
export const BLOOM = typeof window !== 'undefined' ? window.innerWidth >= 768 : true;

// ── Contact configuration ──
export const CONTACT = {
  email: 'ashwinkumaar.bk@gmail.com',
  linkedin: 'https://www.linkedin.com/in/ashwin-kumaar-b-16271932b/',
  github: 'https://github.com/ashwin-kumaar-b',
  resume: '',
  location: 'Chennai, India',
  headline: "Let's build something.",
};

// ── Nav configuration ──
export const NAV = {
  name: 'Ashwin',
  projectsScene: '#scene-moon',
  projectsP: 0.2,
};

export const CONFIG = {
  cityMode: CITY_MODE,
  bloom: BLOOM,
  contact: CONTACT,
  nav: NAV,
  // ── Scroll lengths per scene (in vh) ──
  // These control how much vertical scroll distance each pinned scene occupies.
  scrollLengths: {
    intro: 80,      // Fade-out duration
    flip: 150,      // Tile-flip transition
    run: 220,       // Silhouette run (fast & dynamic pace)
    city: 350,      // Top-down city chase
    irisLen: 110,   // Window iris / pane transition (in vh)
    rocket: 300,    // Rocket launch
    space: 260,     // Deep space achievements
    moon: 280,      // Lunar surface (increased by 40% from 200)
    train: 500,     // Rover project train (horizontal scroll)
    base: 150,      // Lunar base reveal
  },

  // ── Color palette ──
  colors: {
    yellow: '#FFD400',
    black: '#0A0A0A',
    magenta: '#FF2A6D',
    cyan: '#05D9E8',
    white: '#FAFAFA',
    moonLight: '#D0D0D0',
    moonMid: '#888888',
    moonDark: '#3A3A3A',
  },

  // ── Links (replace '#' with real URLs) ──
  links: {
    github: 'https://github.com/ashwin-kumaar-b',
    linkedin: 'https://www.linkedin.com/in/ashwin-kumaar-b-16271932b/',
    email: 'mailto:ashwinkumaar.bk@gmail.com',
    resume: '#',
  },

  // ── Runner config ──
  // RUNNER_STYLE: "humanoid" | "cube" (switching this one value changes the runner style)
  runner: {
    style: RUNNER_STYLE,  // 'humanoid' | 'cube'
    direction: 'right',   // 'right' or 'left'
    cloneColorMode: 'gradient', // 'gradient' | 'black'
  },

  // ── Fonts ──
  fonts: {
    display: "'Orbitron', sans-serif",
    mono: "'Space Mono', monospace",
  },

  // ── Flip grid ──
  flip: {
    colsDesktop: 10,
    rowsDesktop: 6,
    colsMobile: 6,
    rowsMobile: 10,
    breakpoint: 768,  // px — below this use mobile grid
  },
};
