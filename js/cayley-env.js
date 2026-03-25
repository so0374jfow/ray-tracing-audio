import { viewport } from './util/browser-util';
import Line from './geometry/Line';
import Circle from './geometry/Circle';
import Point from './geometry/Point';
import Scene from './scene';
import { ctx } from './canvas';
import player from './player';
import { updatePrimaryRays } from './shoot-rays';

// --- Q8 Cayley graph ---
// 8 elements: 1, -1, i, -i, j, -j, k, -k
// 3 multiplication families: xi (red), xj (green), xk (blue)

// Node layout (proportional to canvas), matching the classic diagram:
//         j          k
//    i         1          -i
//              -1
//        -k         -j
const NODE_LAYOUT = {
  '1': [0.5, 0.4],
  '-1': [0.5, 0.6],
  i: [0.2, 0.47],
  '-i': [0.8, 0.47],
  j: [0.33, 0.18],
  '-j': [0.67, 0.82],
  k: [0.67, 0.18],
  '-k': [0.33, 0.82],
};

// Node colors matching the standard Q8 diagram
const NODE_COLORS = {
  '1': '#b0b0b0',
  '-1': '#b0b0b0',
  i: '#d4868a',
  '-i': '#d4868a',
  j: '#a8d5a0',
  '-j': '#a8d5a0',
  k: '#8cb8d8',
  '-k': '#8cb8d8',
};

// Right multiplication edges: x -> x*g
// xi: 1->i->-1->-i->1, j->-k->-j->k->j
// xj: 1->j->-1->-j->1, i->k->-i->-k->i
// xk: 1->k->-1->-k->1, i->-j->-i->j->i
const EDGE_FAMILIES = [
  {
    color: '#8B2252', // dark red (xi)
    width: 4,
    edges: [
      ['1', 'i'],
      ['i', '-1'],
      ['-1', '-i'],
      ['-i', '1'],
      ['j', '-k'],
      ['-k', '-j'],
      ['-j', 'k'],
      ['k', 'j'],
    ],
  },
  {
    color: '#2E7D32', // green (xj)
    width: 3,
    edges: [
      ['1', 'j'],
      ['j', '-1'],
      ['-1', '-j'],
      ['-j', '1'],
      ['i', 'k'],
      ['k', '-i'],
      ['-i', '-k'],
      ['-k', 'i'],
    ],
  },
  {
    color: '#1565C0', // blue (xk)
    width: 3,
    edges: [
      ['1', 'k'],
      ['k', '-1'],
      ['-1', '-k'],
      ['-k', '1'],
      ['i', '-j'],
      ['-j', '-i'],
      ['-i', 'j'],
      ['j', 'i'],
    ],
  },
];

const NODE_RADIUS = 22;

// Resolved positions (computed on first call)
let nodePositions = null;
let labels = null;

function resolvePositions() {
  const { width, height } = viewport();
  nodePositions = {};
  labels = [];
  for (const [name, [px, py]] of Object.entries(NODE_LAYOUT)) {
    const x = px * width;
    const y = py * height;
    nodePositions[name] = { x, y };
    labels.push({ name, x, y, color: NODE_COLORS[name] });
  }
}

export function generateCayleyGraph() {
  Scene.finishedLines.length = 0;
  Scene.circles.length = 0;

  resolvePositions();

  // Add node circles
  for (const [name, { x, y }] of Object.entries(nodePositions)) {
    const circle = new Circle(new Point(x, y), NODE_RADIUS);
    circle.color = NODE_COLORS[name];
    Scene.circles.push(circle);
  }

  // Add edge walls
  for (const family of EDGE_FAMILIES) {
    for (const [from, to] of family.edges) {
      const a = nodePositions[from];
      const b = nodePositions[to];

      // Shorten line to not overlap with node circles
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len;
      const uy = dy / len;
      const gap = NODE_RADIUS + 4;

      const line = new Line(
        a.x + ux * gap,
        a.y + uy * gap,
        b.x - ux * gap,
        b.y - uy * gap,
        family.color
      );
      line.width = family.width;
      Scene.finishedLines.push(line);
    }
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
    // Circle fill behind label
    ctx.beginPath();
    ctx.arc(x, y, NODE_RADIUS - 2, 0, 2 * Math.PI);
    ctx.fillStyle = NODE_COLORS[name];
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.closePath();

    // Label text
    ctx.fillStyle = '#000';
    ctx.fillText(name, x, y);
  }

  // Draw legend
  ctx.font = '14px monospace';
  ctx.textAlign = 'left';
  const legendX = 20;
  let legendY = 30;
  const legendItems = [
    { label: 'xi', color: '#8B2252' },
    { label: 'xj', color: '#2E7D32' },
    { label: 'xk', color: '#1565C0' },
  ];
  for (const { label, color } of legendItems) {
    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY - 6, 24, 3);
    ctx.fillText(label, legendX + 30, legendY);
    legendY += 22;
  }
  // Draw current cycle indicator
  if (activeCycleLabel) {
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = activeCycleColor;
    ctx.fillText(activeCycleLabel, legendX, legendY + 10);
  }

  ctx.restore();
}

// --- Cyclic Q8 movement ---
// Player traces the multiplication cycles of the quaternion group:
//   xi: 1->i->-1->-i->1,  j->-k->-j->k->j
//   xj: 1->j->-1->-j->1,  i->k->-i->-k->i
//   xk: 1->k->-1->-k->1,  i->-j->-i->j->i
// This encodes 4D quaternion rotations as 2D paths through the Cayley graph.

const CYCLES = [
  // xi cycles (red)
  { nodes: ['1', 'i', '-1', '-i'], label: 'xi: 1->i->-1->-i', color: '#8B2252' },
  { nodes: ['j', '-k', '-j', 'k'], label: 'xi: j->-k->-j->k', color: '#8B2252' },
  // xj cycles (green)
  { nodes: ['1', 'j', '-1', '-j'], label: 'xj: 1->j->-1->-j', color: '#2E7D32' },
  { nodes: ['i', 'k', '-i', '-k'], label: 'xj: i->k->-i->-k', color: '#2E7D32' },
  // xk cycles (blue)
  { nodes: ['1', 'k', '-1', '-k'], label: 'xk: 1->k->-1->-k', color: '#1565C0' },
  { nodes: ['i', '-j', '-i', 'j'], label: 'xk: i->-j->-i->j', color: '#1565C0' },
];

const EDGE_SPEED = 0.008; // interpolation progress per frame (~125 frames per edge ≈ 2s at 60fps)

let cycleIdx = 0;
let stepIdx = 0; // which edge within the current cycle (0..3)
let t = 0; // interpolation 0..1 along current edge
let activeCycleLabel = '';
let activeCycleColor = '#fff';

// Smooth easing for natural movement
function ease(x) {
  // Smooth step: accelerate then decelerate
  return x * x * (3 - 2 * x);
}

export function updateCayleyMovement() {
  if (!nodePositions) return;

  const cycle = CYCLES[cycleIdx];
  activeCycleLabel = cycle.label;
  activeCycleColor = cycle.color;

  const fromName = cycle.nodes[stepIdx];
  const toName = cycle.nodes[(stepIdx + 1) % cycle.nodes.length];
  const from = nodePositions[fromName];
  const to = nodePositions[toName];

  // Interpolate with easing
  const et = ease(t);
  const x = from.x + (to.x - from.x) * et;
  const y = from.y + (to.y - from.y) * et;

  player.set(x, y);
  updatePrimaryRays();

  // Advance
  t += EDGE_SPEED;
  if (t >= 1) {
    t = 0;
    stepIdx++;
    if (stepIdx >= cycle.nodes.length) {
      // Completed full 4-cycle, move to next cycle
      stepIdx = 0;
      cycleIdx = (cycleIdx + 1) % CYCLES.length;
    }
  }
}
