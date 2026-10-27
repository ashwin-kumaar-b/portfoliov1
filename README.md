# Ashwin — Scroll-Driven Cinematic Portfolio

A single-page, scroll-driven portfolio that plays like a short film.  
Visual style: neon-cyberpunk anime. Hard flat shapes, high contrast, yellow/black/neon palette.

## Quick Start

```bash
npm install
npm run dev      # → http://localhost:5173
```

## How to Edit

### Profile photo
Drop your photo into `assets/profile.jpg`. Until then a yellow "A" placeholder is shown.

### Links (GitHub, LinkedIn, Email, Resume)
Edit `src/config.js` → `CONFIG.links`.

### Runner Style (Humanoid vs Cube)
Edit `src/config.js` → `RUNNER_STYLE = 'humanoid'` or `'cube'`.
- `humanoid`: Original anime silhouette with natural articulated joints, forward lean, and flowing jacket.
- `cube`: Cyberpunk flat black square with rhythmic hop bounce, squash & stretch, forward tilt, and trailing neon jacket flap.
- Afterimages feature a warm-to-cool (red → purple → cyan) gradient trail in both styles.

### Projects
Edit `data/projects.json` — each object has `title`, `description`, `tags[]`, and `link`.

### Scroll pacing
Edit `src/config.js` → `CONFIG.scrollLengths` (values are in **vh**).

### Colors
CSS variables live in `src/styles.css` under `:root`, and are mirrored in `src/config.js`.

## Project Structure

```
index.html              Main HTML shell
src/
  main.js               Entry: Lenis, ScrollTrigger, loader, scene init
  config.js             All tunable constants (scroll lengths, colors, links)
  styles.css            Global styles & CSS variables
  scenes/
    intro.js            Scene 1 — Hero fade-out
    flip.js             Scene 2 — Tile-flip transition
    run.js              Scene 3 — Silhouette runner
    city.js             Scene 4 — Top-down city chase
    rocket.js           Scene 5 — Rocket launch
    moon.js             Scene 6 — Moon surface
    train.js            Scene 7 — Rover project train
    base.js             Scene 8 — Lunar base + contact
data/
  projects.json         Project card data
assets/
  profile.jpg           Your profile photo (add manually)
```

## Stack
- **Vanilla HTML/CSS/JS** with **Vite**
- **GSAP** + **ScrollTrigger** for scroll-driven timelines (`scrub: 1`)
- **Lenis** for smooth scrolling
- All graphics are inline **SVG/CSS** — no external images except profile.jpg

## Accessibility
- `prefers-reduced-motion: reduce` → skips all animation, shows a static layout
- All text is real DOM text (never canvas/image)
- Semantic HTML, alt text, keyboard-focusable links
