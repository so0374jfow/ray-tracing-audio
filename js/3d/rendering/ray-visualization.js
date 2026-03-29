import * as THREE from 'three';
import { numberOfRays, maxBounces } from '../config.js';

let lineSegments = null;
let positionAttr = null;
let colorAttr = null;
let visible = true;

// Max segments = numberOfRays * (maxBounces + 1)
const maxSegments = numberOfRays * (maxBounces + 1);
const maxVertices = maxSegments * 2; // 2 vertices per line segment

export function createRayVisualization(scene) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(maxVertices * 3);
  const colors = new Float32Array(maxVertices * 3);

  positionAttr = new THREE.BufferAttribute(positions, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttr);

  colorAttr = new THREE.BufferAttribute(colors, 3);
  colorAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('color', colorAttr);

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });

  lineSegments = new THREE.LineSegments(geometry, material);
  lineSegments.frustumCulled = false;
  scene.add(lineSegments);

  return lineSegments;
}

export function updateRayVisualization(traceResults) {
  if (!lineSegments || !traceResults) return;
  lineSegments.visible = visible;
  if (!visible) return;

  const positions = positionAttr.array;
  const colors = colorAttr.array;
  let vertexIndex = 0;

  for (let i = 0; i < traceResults.length; i++) {
    const result = traceResults[i];
    const segments = result.segments;

    for (let j = 0; j < segments.length; j++) {
      if (vertexIndex >= maxVertices * 3) break;

      const seg = segments[j];

      // Start vertex
      positions[vertexIndex] = seg.start.x;
      positions[vertexIndex + 1] = seg.start.y;
      positions[vertexIndex + 2] = seg.start.z;

      // End vertex
      positions[vertexIndex + 3] = seg.end.x;
      positions[vertexIndex + 4] = seg.end.y;
      positions[vertexIndex + 5] = seg.end.z;

      // Color: brighter for earlier bounces, fade with depth
      const brightness = 1 - j / (maxBounces + 1);
      // Hue shifts from cyan (first bounce) to blue (deep bounces)
      const r = 0.2 * brightness;
      const g = 0.8 * brightness;
      const b = 1.0 * brightness;

      colors[vertexIndex] = r;
      colors[vertexIndex + 1] = g;
      colors[vertexIndex + 2] = b;
      colors[vertexIndex + 3] = r * 0.7;
      colors[vertexIndex + 4] = g * 0.7;
      colors[vertexIndex + 5] = b * 0.7;

      vertexIndex += 6;
    }
  }

  // Zero out remaining vertices
  for (let i = vertexIndex; i < maxVertices * 3; i++) {
    positions[i] = 0;
    colors[i] = 0;
  }

  positionAttr.needsUpdate = true;
  colorAttr.needsUpdate = true;
  lineSegments.geometry.setDrawRange(0, vertexIndex / 3);
}

export function toggleRayVisibility() {
  visible = !visible;
  return visible;
}
