# CLAUDE.md

## Project Overview

Ray Tracing Audio is a web-based sound propagation engine that simulates realistic audio using ray tracing techniques. It renders 2D rays bouncing off surfaces (lines and circles) on a canvas while producing binaural 3D audio through the Web Audio API. Live demo: https://justgoscha.github.io/ray-tracing-audio/

## Commands

- `npm run dev` — Start Vite dev server with hot reload
- `npm run build` — Production build (output: `dist/`)
- `npm run preview` — Preview production build
- `npm run format` — Format code with Prettier
- `npm run format:check` — Check formatting without modifying files

No test runner is configured. Performance benchmarks exist in `performance-tests/`.

## Architecture

```
js/
├── main.js              # Entry point — inits interaction, starts animation loop
├── animation.js         # requestAnimationFrame loop
├── frame.js             # Per-frame render pipeline
├── scene.js             # Scene singleton — manages all drawable objects
├── shoot-rays.js        # Ray generation from player position
├── intersections.js     # Ray-geometry intersection & reflection logic
├── interaction.js       # User input (WASD, mouse drawing, keyboard shortcuts)
├── canvas.js            # Canvas element setup and clearing
├── player.js            # Player object singleton
├── config.js            # Constants (180 rays, 10px/m ratio, max 8 reflections)
├── geometry/            # Primitives: Point, Line, Circle, Ray
├── math/                # Vector math (dot product, reflection, normalization)
├── misc/                # Color constants
├── util/                # Browser utilities, FPS counter
└── webaudio/            # Audio engine
    ├── webaudio.js      # AudioContext initialization
    ├── master.js        # Compressor + master gain
    ├── endpoints.js     # Panner nodes (one per ray) for binaural audio
    ├── test-sound.js    # Oscillator/buffer playback control
    └── sound-util.js    # Sine wave and noise generation
```

**Data flow:** `main.js` → `animation.js` loop → `frame.js` calls `checkSceneIntersections()` → `clearCanvas()` → `Scene.render()` → `updatePlay()` (audio)

**Audio pipeline:** `audioCtx` → `compressor + gain` → `panners[]` → oscillators/buffers. Frequency and amplitude are inversely proportional to ray travel distance.

## Code Conventions

- **Module system:** ES6 imports/exports (`"type": "module"` in package.json)
- **Naming:** PascalCase for classes (`Ray`, `Circle`), camelCase for functions/variables
- **Constructors:** Mix of ES6 classes (Ray, Circle) and function constructors (Point, Line)
- **Singletons:** Scene, player, canvas, audioCtx are module-level singletons
- **Formatting:** Prettier — single quotes, semicolons, 2-space indent, 100 char width, trailing commas (es5)
- **No linter configured** — rely on Prettier for style consistency

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) deploys to GitHub Pages on push to `main`:
1. `npm ci` → `npm run build` → upload `dist/` → deploy to Pages

## Key Details

- Entry HTML: `index.html` loads `js/main.js` as ES module
- External lib: `public/lib/mousetrap.min.js` for keyboard shortcuts
- Styling: Tailwind CSS v4 via PostCSS
- Vite base path: `/ray-tracing-audio/`
- Config constants in `js/config.js`: 180 rays, 10 pixels per meter, max 8 reflection depth
