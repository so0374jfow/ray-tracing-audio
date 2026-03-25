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

// --- Quaternion environment generation ---
// Four environment types that produce structured phase relationships
// across ray quadrants, encoding quaternion rotation geometry.

let envTypeIndex = 0;

function clearScene() {
  Scene.finishedLines.length = 0;
  Scene.circles.length = 0;
}

function addWall(x1, y1, x2, y2) {
  const line = new Line(x1, y1, x2, y2, colors.line);
  line.width = 4;
  Scene.finishedLines.push(line);
}

// Type A — "Orbit": Single offset circle.
// Player orbiting produces sinusoidal distance modulation = single quaternion rotation e^(μωt)
function genOrbit() {
  const { width, height } = viewport();
  const cx = width / 2;
  const cy = height / 2;
  const offsetX = rand(-160, 160);
  const offsetY = rand(-100, 100);
  Scene.circles.push(new Circle(new Point(cx + offsetX, cy + offsetY), rand(80, 130)));
}

// Type B — "Double Rotation": Two circles at opposing positions.
// Two independent sinusoidal modulations = double rotation e^(μ₁ω₁t)·q₀·e^(μ₂ω₂t)
function genDoubleRotation() {
  const { width, height } = viewport();
  const cx = width / 2;
  const cy = height / 2;
  const spread = rand(120, 180);
  const a = rand(0, Math.PI * 2);
  Scene.circles.push(
    new Circle(new Point(cx + Math.cos(a) * spread, cy + Math.sin(a) * spread), rand(50, 80))
  );
  Scene.circles.push(
    new Circle(
      new Point(cx - Math.cos(a) * spread * 0.8, cy - Math.sin(a) * spread * 0.8),
      rand(40, 65)
    )
  );
}

// Type C — "Wedge": Two angled walls forming a V + circle.
// Asymmetric reflections encode non-commutativity: reflection order matters (ij ≠ ji)
function genWedge() {
  const { width, height } = viewport();
  const cx = width / 2;
  const cy = height / 2;
  const spread = rand(150, 220);
  const depth = rand(140, 200);
  const rot = rand(0, Math.PI * 2);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  // Two walls meeting at a point, rotated randomly
  addWall(
    cx + (-spread) * cos,
    cy + (-spread) * sin,
    cx + depth * -sin,
    cy + depth * cos
  );
  addWall(
    cx + spread * cos,
    cy + spread * sin,
    cx + depth * -sin,
    cy + depth * cos
  );
  // Circle on the opposite side of the wedge opening
  Scene.circles.push(
    new Circle(new Point(cx - depth * 0.7 * -sin, cy - depth * 0.7 * cos), rand(45, 70))
  );
}

// Type D — "Concentric": Two concentric circles.
// Inner/outer reflections create coupled phase shifts — a resonant cavity
function genConcentric() {
  const { width, height } = viewport();
  const cx = width / 2;
  const cy = height / 2;
  const outerR = Math.min(width, height) * rand(0.3, 0.4);
  const innerR = outerR * rand(0.25, 0.4);
  Scene.circles.push(new Circle(new Point(cx, cy), outerR));
  Scene.circles.push(new Circle(new Point(cx, cy), innerR));
}

const envGenerators = [genOrbit, genDoubleRotation, genWedge, genConcentric];

function generateEnvironment() {
  clearScene();
  envGenerators[envTypeIndex]();
  envTypeIndex = (envTypeIndex + 1) % envGenerators.length;
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
