import { viewport } from './util/browser-util';
import player from './player';
import { updatePrimaryRays } from './shoot-rays';
import Line from './geometry/Line';
import Circle from './geometry/Circle';
import Point from './geometry/Point';
import Scene from './scene';
import colors from './misc/colors';
import { toggleContinuous } from './webaudio/test-sound';
import { audioCtx } from './webaudio/webaudio';

// --- Movement state ---
const MOVE_SPEED = 0.8; // pixels per frame — gentle drift
let vx = MOVE_SPEED;
let vy = MOVE_SPEED * 0.6;
const TURN_RATE = 0.01; // radians per frame — slow curved paths
let angle = Math.random() * Math.PI * 2;
const MARGIN = 40; // bounce margin from edges

// --- Environment interval ---
const ENV_INTERVAL = 10000; // ms between new environments

// --- Helpers ---
function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

// --- Auto movement ---
// Smooth wandering: slowly rotate a velocity vector, bounce off canvas edges.
function updateAutoMovement() {
  const { width, height } = viewport();

  // Gently rotate direction
  angle += (Math.random() - 0.5) * TURN_RATE * 2;
  vx = Math.cos(angle) * MOVE_SPEED;
  vy = Math.sin(angle) * MOVE_SPEED;

  let nx = player.x + vx;
  let ny = player.y + vy;

  // Bounce off edges
  if (nx < MARGIN || nx > width - MARGIN) {
    angle = Math.PI - angle;
    nx = Math.max(MARGIN, Math.min(width - MARGIN, nx));
  }
  if (ny < MARGIN || ny > height - MARGIN) {
    angle = -angle;
    ny = Math.max(MARGIN, Math.min(height - MARGIN, ny));
  }

  player.set(nx, ny);
  updatePrimaryRays();
}

// --- Environment generation ---
function generateEnvironment() {
  const { width, height } = viewport();
  const pad = 60;

  // Clear existing scene objects
  Scene.finishedLines.length = 0;
  Scene.circles.length = 0;

  // Generate 3-6 random walls
  const numLines = randInt(3, 6);
  for (let i = 0; i < numLines; i++) {
    const x = rand(pad, width - pad);
    const y = rand(pad, height - pad);
    const len = rand(60, 250);
    const a = Math.random() * Math.PI * 2;
    const line = new Line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, colors.line);
    line.width = 4;
    Scene.finishedLines.push(line);
  }

  // Generate 1-2 circles
  const numCircles = randInt(1, 2);
  for (let i = 0; i < numCircles; i++) {
    const cx = rand(pad + 40, width - pad - 40);
    const cy = rand(pad + 40, height - pad - 40);
    const r = rand(20, 80);
    Scene.circles.push(new Circle(new Point(cx, cy), r));
  }
}

// --- Init ---
let soundStarted = false;

function init() {
  // Generate first environment
  generateEnvironment();

  // Regenerate on interval
  setInterval(generateEnvironment, ENV_INTERVAL);

  // Start continuous sound on first user click (AudioContext policy)
  document.addEventListener(
    'click',
    () => {
      if (!soundStarted) {
        soundStarted = true;
        // Resume suspended AudioContext before starting oscillators
        const resume = audioCtx.state === 'suspended' ? audioCtx.resume() : Promise.resolve();
        resume.then(() => {
          toggleContinuous();
        });
      }
    },
    { once: true }
  );
}

export { init, updateAutoMovement };
