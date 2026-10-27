// ============================================================
// intro.js — Scene 1: Full-screen hero with fade-out on scroll
// ============================================================
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from '../config.js';

export function initIntro() {
  const section = document.getElementById('scene-intro');
  if (!section) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${window.innerHeight * CONFIG.scrollLengths.intro / 100}`,
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });

  // Fade & slide up the main content
  tl.to('.intro-content', {
    y: -100,
    opacity: 0,
    duration: 1,
    ease: 'power2.in',
  });

  // Fade out the scroll hint immediately
  tl.to('.scroll-hint', {
    opacity: 0,
    duration: 0.25,
  }, 0);
}
