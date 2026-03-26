import { viewport } from './util/browser-util';
import player from './player';
import { updatePrimaryRays } from './shoot-rays';
import Line from './geometry/Line';
import Scene from './scene';
import colors from './misc/colors';
import solids from './platonic-solids';

// --- Constants ---
const MAX_VERTS = 20; // dodecahedron vertex count
const MAX_EDGES = 30; // dodecahedron/icosahedron edge count
const MORPH_SPEED = 0.003; // ~5.5 seconds per transition at 60fps
const FOCAL_LENGTH = 3.0;
const ROT_Y_SPEED = 0.008;
const ROT_X_SPEED = 0.003;

// --- State ---
let currentIndex = 0;
let morphT = 0;
let rotY = 0;
let rotX = 0;
let paddedSolids = [];

// --- Padding: make all solids have the same vertex/edge count ---

function padVertices(verts, target) {
  const padded = [];
  for (let i = 0; i < target; i++) {
    padded.push(verts[i % verts.length].slice());
  }
  return padded;
}

function padEdges(edges, origVertCount, target) {
  const padded = [];
  for (let i = 0; i < target; i++) {
    const orig = edges[i % edges.length];
    // Offset duplicated edges to use corresponding padded vertex slots
    const cycle = Math.floor(i / edges.length);
    const offset = (cycle * origVertCount) % MAX_VERTS;
    padded.push([(orig[0] + offset) % MAX_VERTS, (orig[1] + offset) % MAX_VERTS]);
  }
  return padded;
}

function precomputePadded() {
  paddedSolids = solids.map(s => ({
    name: s.name,
    vertices: padVertices(s.vertices, MAX_VERTS),
    edges: padEdges(s.edges, s.vertices.length, MAX_EDGES),
  }));
}

// --- 3D Math ---

function rotateYAxis(v, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
}

function rotateXAxis(v, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
}

function project(v, cx, cy, scale) {
  const z = v[2] + FOCAL_LENGTH;
  const f = FOCAL_LENGTH / z;
  return [cx + v[0] * scale * f, cy + v[1] * scale * f];
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

// --- Scene update (called every frame via setCustomMovement) ---

function updatePlatonicGeometry() {
  // Advance morph
  morphT += MORPH_SPEED;
  if (morphT >= 1) {
    morphT = 0;
    currentIndex = (currentIndex + 1) % paddedSolids.length;
  }

  // Advance rotation
  rotY += ROT_Y_SPEED;
  rotX += ROT_X_SPEED;

  const { width, height } = viewport();
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) * 0.3;

  const solidA = paddedSolids[currentIndex];
  const solidB = paddedSolids[(currentIndex + 1) % paddedSolids.length];
  const t = easeInOut(morphT);

  // Lerp, rotate, project all vertices
  const projected = [];
  for (let i = 0; i < MAX_VERTS; i++) {
    let v = lerp3(solidA.vertices[i], solidB.vertices[i], t);
    v = rotateYAxis(v, rotY);
    v = rotateXAxis(v, rotX);
    projected.push(project(v, cx, cy, scale));
  }

  // Build edges — use target solid's edge list for emergence effect
  const edges = solidB.edges;
  Scene.finishedLines.length = 0;

  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const p1 = projected[a];
    const p2 = projected[b];

    // Skip degenerate edges (collapsed duplicate vertices)
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    if (dx * dx + dy * dy < 1) continue;

    const line = new Line(p1[0], p1[1], p2[0], p2[1], colors.line);
    line.width = 3;
    Scene.finishedLines.push(line);
  }
}

// --- Initial setup ---

function generatePlatonicEnvironment() {
  precomputePadded();

  Scene.finishedLines.length = 0;
  Scene.circles.length = 0;

  // Center the player
  const { width, height } = viewport();
  player.set(width / 2, height / 2);
  updatePrimaryRays();
}

// Current solid name for overlay
function getCurrentSolidName() {
  const solidA = paddedSolids[currentIndex];
  const solidB = paddedSolids[(currentIndex + 1) % paddedSolids.length];
  if (morphT < 0.1) return solidA.name;
  if (morphT > 0.9) return solidB.name;
  return `${solidA.name} → ${solidB.name}`;
}

export { generatePlatonicEnvironment, updatePlatonicGeometry, getCurrentSolidName };
