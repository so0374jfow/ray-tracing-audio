import { viewport } from './util/browser-util';
import Circle from './geometry/Circle';
import Point from './geometry/Point';
import Scene from './scene';
import { ctx } from './canvas';
import player from './player';
import { updatePrimaryRays } from './shoot-rays';

// --- Q8 Cayley graph ---
// 8 elements arranged in a square-proportioned layout, centered on canvas.
// No edge lines — only node circles. The player's movement along
// multiplication cycles IS the 4D rotation made visible in 2D.

// Node layout: positions relative to a unit square [-1, 1] x [-1, 1]
// Arranged to suggest the Q8 structure with 4-fold symmetry
const NODE_LAYOUT = {
  '1': [0, -0.15],
  '-1': [0, 0.15],
  i: [-0.45, 0],
  '-i': [0.45, 0],
  j: [-0.25, -0.45],
  k: [0.25, -0.45],
  '-k': [-0.25, 0.45],
  '-j': [0.25, 0.45],
};

const NODE_RADIUS = 24;

// Resolved positions (computed on first call)
let nodePositions = null;
let labels = null;
let layoutSize = 0; // the square size used for layout

function resolvePositions() {
  const { width, height } = viewport();
  const cx = width / 2;
  const cy = height / 2;
  // Use smallest dimension to keep square proportions
  layoutSize = Math.min(width, height) * 0.42;

  nodePositions = {};
  labels = [];
  for (const [name, [px, py]] of Object.entries(NODE_LAYOUT)) {
    const x = cx + px * layoutSize;
    const y = cy + py * layoutSize;
    nodePositions[name] = { x, y };
    labels.push({ name, x, y });
  }
}

export function generateCayleyGraph() {
  Scene.finishedLines.length = 0;
  Scene.circles.length = 0;

  resolvePositions();

  // Add node circles only — no edge walls
  for (const [name, { x, y }] of Object.entries(nodePositions)) {
    const circle = new Circle(new Point(x, y), NODE_RADIUS);
    circle.color = '#888';
    Scene.circles.push(circle);
  }
}

// Draw labels on top of the scene each frame
export function drawCayleyLabels() {
  if (!labels) return;
  ctx.save();
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const { name, x, y } of labels) {
    // Filled circle behind label
    ctx.beginPath();
    ctx.arc(x, y, NODE_RADIUS - 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#d0d0d0';
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    // Label text
    ctx.fillStyle = '#000';
    ctx.fillText(name, x, y);
  }

  // Draw current cycle indicator
  if (activeCycleLabel) {
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#333';
    ctx.fillText(activeCycleLabel, 20, 30);
  }

  ctx.restore();
}

// --- Cyclic Q8 movement ---
// Player traces the six 4-cycles of Q8 via curved arcs.
// Each 4-cycle is a closed rotation — the arc paths show
// 4D quaternion rotations projected into 2D.
//
// Right multiplication cycles:
//   ×i: 1→i→−1→−i→1,  j→−k→−j→k→j
//   ×j: 1→j→−1→−j→1,  i→k→−i→−k→i
//   ×k: 1→k→−1→−k→1,  i→−j→−i→j→i

const CYCLES = [
  { nodes: ['1', 'i', '-1', '-i'], label: '×i : 1 → i → −1 → −i' },
  { nodes: ['j', '-k', '-j', 'k'], label: '×i : j → −k → −j → k' },
  { nodes: ['1', 'j', '-1', '-j'], label: '×j : 1 → j → −1 → −j' },
  { nodes: ['i', 'k', '-i', '-k'], label: '×j : i → k → −i → −k' },
  { nodes: ['1', 'k', '-1', '-k'], label: '×k : 1 → k → −1 → −k' },
  { nodes: ['i', '-j', '-i', 'j'], label: '×k : i → −j → −i → j' },
];

const EDGE_SPEED = 0.006; // ~167 frames per edge ≈ 2.8s at 60fps
const ARC_BULGE = 0.3; // how much the arc curves (0 = straight, higher = more curved)

let cycleIdx = 0;
let stepIdx = 0;
let t = 0;
let activeCycleLabel = '';

// Smooth easing: accelerate then decelerate
function ease(x) {
  return x * x * (3 - 2 * x);
}

// Compute centroid of a cycle's nodes (used as arc attractor)
function cycleCentroid(cycle) {
  let sx = 0, sy = 0;
  for (const name of cycle.nodes) {
    sx += nodePositions[name].x;
    sy += nodePositions[name].y;
  }
  return { x: sx / cycle.nodes.length, y: sy / cycle.nodes.length };
}

// Quadratic bezier interpolation: A → control → B
function bezierPoint(ax, ay, cx, cy, bx, by, t) {
  const u = 1 - t;
  return {
    x: u * u * ax + 2 * u * t * cx + t * t * bx,
    y: u * u * ay + 2 * u * t * cy + t * t * by,
  };
}

export function updateCayleyMovement() {
  if (!nodePositions) return;

  const cycle = CYCLES[cycleIdx];
  activeCycleLabel = cycle.label;

  const fromName = cycle.nodes[stepIdx];
  const toName = cycle.nodes[(stepIdx + 1) % cycle.nodes.length];
  const from = nodePositions[fromName];
  const to = nodePositions[toName];

  // Curve toward cycle centroid for arc-like paths
  const center = cycleCentroid(cycle);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const controlX = midX + (center.x - midX) * ARC_BULGE;
  const controlY = midY + (center.y - midY) * ARC_BULGE;

  // Bezier interpolation with easing
  const et = ease(t);
  const pos = bezierPoint(from.x, from.y, controlX, controlY, to.x, to.y, et);

  player.set(pos.x, pos.y);
  updatePrimaryRays();

  // Advance
  t += EDGE_SPEED;
  if (t >= 1) {
    t = 0;
    stepIdx++;
    if (stepIdx >= cycle.nodes.length) {
      stepIdx = 0;
      cycleIdx = (cycleIdx + 1) % CYCLES.length;
    }
  }
}
