import * as Vec3 from '../math/vec3.js';
import { rayPlane, raySphere, rayAABB } from './intersections3d.js';
import { getAbsorption } from './materials.js';
import { TraceResult } from './ray3d.js';
import {
  numberOfRays,
  maxBounces,
  rayDirections,
  cachePositionThreshold,
  cacheRotationThreshold,
} from '../config.js';
import { walls } from '../room.js';

// Scene objects registered for intersection
let sceneObjects = [];

export function setSceneObjects(objects) {
  sceneObjects = objects;
}

// Trail cache (Vercidium-inspired)
let cachedResults = null;
let cachedPosition = null;
let cachedForward = null;

function shouldRetrace(position, forward) {
  if (!cachedResults || !cachedPosition) return true;
  if (Vec3.distance(position, cachedPosition) > cachePositionThreshold) return true;
  if (cachedForward && Vec3.distance(forward, cachedForward) > cacheRotationThreshold) return true;
  return false;
}

export function invalidateCache() {
  cachedResults = null;
}

// Find nearest intersection across all geometry
function findNearest(origin, direction, skipObject) {
  let nearest = null;

  // Test walls
  for (let i = 0; i < walls.length; i++) {
    const hit = rayPlane(origin, direction, walls[i]);
    if (hit && (!nearest || hit.t < nearest.t)) {
      nearest = hit;
      nearest.object = walls[i];
    }
  }

  // Test scene objects
  for (let i = 0; i < sceneObjects.length; i++) {
    const obj = sceneObjects[i];
    if (obj === skipObject) continue;

    let hit = null;
    if (obj.type === 'sphere') {
      hit = raySphere(origin, direction, obj);
    } else if (obj.type === 'box') {
      hit = rayAABB(origin, direction, obj);
    }

    if (hit && (!nearest || hit.t < nearest.t)) {
      nearest = hit;
      nearest.object = obj;
    }
  }

  return nearest;
}

// Trace a single ray iteratively
function traceSingleRay(index, origin, direction) {
  const result = new TraceResult(index);
  let currentOrigin = origin;
  let currentDir = direction;
  let skipObj = null;

  for (let bounce = 0; bounce <= maxBounces; bounce++) {
    const hit = findNearest(currentOrigin, currentDir, skipObj);

    if (!hit) {
      // Ray escapes (shouldn't happen in a closed room, but handle gracefully)
      const farPoint = Vec3.add(currentOrigin, Vec3.scale(currentDir, 100));
      result.segments.push({ start: Vec3.copy(currentOrigin), end: farPoint });
      result.totalDistance += 100;
      break;
    }

    result.segments.push({ start: Vec3.copy(currentOrigin), end: Vec3.copy(hit.point) });
    result.totalDistance += hit.t;
    result.hitCount++;

    // Apply material absorption
    const absorption = getAbsorption(hit.material);
    result.accumulatedAbsorption *= 1 - absorption;

    if (bounce === maxBounces) break;

    // Reflect: R = V - 2(V.N)N
    currentDir = Vec3.reflect(currentDir, hit.normal);
    currentOrigin = Vec3.add(hit.point, Vec3.scale(hit.normal, 1e-4)); // offset to avoid self-intersection
    skipObj = hit.object;
  }

  result.finalDirection = currentDir;
  return result;
}

// Trace all rays from player position
export function traceAllRays(position, forward) {
  if (!shouldRetrace(position, forward)) {
    return cachedResults;
  }

  const results = new Array(numberOfRays);
  for (let i = 0; i < numberOfRays; i++) {
    results[i] = traceSingleRay(i, position, rayDirections[i]);
  }

  cachedResults = results;
  cachedPosition = Vec3.copy(position);
  cachedForward = Vec3.copy(forward);

  return results;
}

export function getTraceResults() {
  return cachedResults;
}
