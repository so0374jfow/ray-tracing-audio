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
const ROT_Y_SPEED = 0.012;
const ROT_X_SPEED = 0.005;
const ROT_Z_SPEED = 0.007;
const ORBIT_SPEED = 0.004; // solid orbits around player for asymmetry

// --- State ---
let currentIndex = 0;
let morphT = 0;
let rotY = 0;
let rotX = 0;
let rotZ = 0;
let orbitAngle = 0;
let paddedSolids = [];
let innerEdges = []; // visual-only edges (not walls)

// Player bouncing movement state
let playerAngle = Math.random() * Math.PI * 2;
let burstTimer = 0;
const BASE_SPEED = 1.5;
const BURST_SPEED = 4.5;
const BURST_INTERVAL = 120; // frames between bursts
const BURST_DURATION = 20; // frames per burst
const TURN_RATE = 0.02;

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

function rotateZAxis(v, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
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

// --- Convex hull (Andrew's monotone chain) ---

function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function convexHull(points) {
  // Deduplicate near-identical points
  const unique = [];
  for (const p of points) {
    let dup = false;
    for (const u of unique) {
      if (Math.abs(p[0] - u[0]) < 0.5 && Math.abs(p[1] - u[1]) < 0.5) {
        dup = true;
        break;
      }
    }
    if (!dup) unique.push(p);
  }
  const pts = unique.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// --- Point-in-convex-hull test ---

function isInsideHull(px, py, hull) {
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i],
      b = hull[(i + 1) % hull.length];
    if ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]) < 0) return false;
  }
  return true;
}

// Find nearest hull edge to point and reflect angle off it
function reflectOffHull(px, py, hull, angle) {
  let minDist = Infinity;
  let bestEdge = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i],
      b = hull[(i + 1) % hull.length];
    // Distance from point to line segment
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (len2 < 1) continue;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
    const cx = a[0] + t * dx - px,
      cy = a[1] + t * dy - py;
    const d = cx * cx + cy * cy;
    if (d < minDist) {
      minDist = d;
      bestEdge = i;
    }
  }
  // Reflect angle off the nearest edge
  const a = hull[bestEdge],
    b = hull[(bestEdge + 1) % hull.length];
  const edgeAngle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return 2 * edgeAngle - angle;
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
  rotZ += ROT_Z_SPEED;
  orbitAngle += ORBIT_SPEED;

  const { width, height } = viewport();
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) * 0.35;

  // Offset the solid's center from the player — breaks symmetry for audio variation
  const orbitRadius = Math.min(width, height) * 0.12;
  const solidCx = cx + Math.cos(orbitAngle) * orbitRadius;
  const solidCy = cy + Math.sin(orbitAngle * 0.7) * orbitRadius;

  const solidA = paddedSolids[currentIndex];
  const solidB = paddedSolids[(currentIndex + 1) % paddedSolids.length];
  const t = easeInOut(morphT);

  // Lerp, rotate, project all vertices
  const projected = [];
  for (let i = 0; i < MAX_VERTS; i++) {
    let v = lerp3(solidA.vertices[i], solidB.vertices[i], t);
    v = rotateYAxis(v, rotY);
    v = rotateXAxis(v, rotX);
    v = rotateZAxis(v, rotZ);
    projected.push(project(v, solidCx, solidCy, scale));
  }

  // Compute convex hull — only hull edges become walls
  const hull = convexHull(projected);

  // Build visual-only inner edges
  const edges = solidB.edges;
  innerEdges.length = 0;
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const p1 = projected[a];
    const p2 = projected[b];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    if (dx * dx + dy * dy < 1) continue;
    innerEdges.push([p1[0], p1[1], p2[0], p2[1]]);
  }

  // Hull edges become walls
  Scene.finishedLines.length = 0;
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];
    const line = new Line(p1[0], p1[1], p2[0], p2[1], colors.line);
    line.width = 3;
    Scene.finishedLines.push(line);
  }

  // --- Player bouncing movement inside hull ---
  burstTimer++;
  if (burstTimer > BURST_INTERVAL + BURST_DURATION) burstTimer = 0;
  const speed = burstTimer > BURST_INTERVAL ? BURST_SPEED : BASE_SPEED;

  // Gently curve the path
  playerAngle += (Math.random() - 0.5) * TURN_RATE * 2;

  let nx = player.x + Math.cos(playerAngle) * speed;
  let ny = player.y + Math.sin(playerAngle) * speed;

  // Bounce off hull walls
  if (hull.length >= 3 && !isInsideHull(nx, ny, hull)) {
    playerAngle = reflectOffHull(nx, ny, hull, playerAngle);
    nx = player.x + Math.cos(playerAngle) * speed;
    ny = player.y + Math.sin(playerAngle) * speed;
    // If still outside (corner case), snap toward hull center
    if (!isInsideHull(nx, ny, hull)) {
      nx = solidCx;
      ny = solidCy;
    }
  }

  // Fallback: keep inside canvas
  nx = Math.max(20, Math.min(width - 20, nx));
  ny = Math.max(20, Math.min(height - 20, ny));

  player.set(nx, ny);
  updatePrimaryRays();
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

// Draw inner edges (visual only, not walls) — called from patched Scene.render
function drawInnerEdges(canvasCtx) {
  canvasCtx.save();
  canvasCtx.strokeStyle = 'rgba(100, 100, 100, 0.25)';
  canvasCtx.lineWidth = 1;
  for (const [x1, y1, x2, y2] of innerEdges) {
    canvasCtx.beginPath();
    canvasCtx.moveTo(x1, y1);
    canvasCtx.lineTo(x2, y2);
    canvasCtx.stroke();
  }
  canvasCtx.restore();
}

export { generatePlatonicEnvironment, updatePlatonicGeometry, getCurrentSolidName, drawInnerEdges };
