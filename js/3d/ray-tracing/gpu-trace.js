// WebGPU compute shader ray tracing
// Falls back to CPU trace when WebGPU is unavailable

import { TraceResult } from './ray3d.js';
import { numberOfRays, maxBounces, rayDirections } from '../config.js';
import { walls } from '../room.js';
import { getAbsorption } from './materials.js';

let device = null;
let pipeline = null;
let bindGroup = null;
let resultBuffer = null;
let readBuffer = null;
let sceneBuffer = null;
let rayBuffer = null;
let configBuffer = null;
let gpuReady = false;

// Each TraceResult output from GPU: totalDistance, absorption, occlusion, firstHitDist,
// hitCount, + segments (start.xyz, end.xyz) * (maxBounces+1)
const RESULT_FLOATS = 5 + (maxBounces + 1) * 6;
const RESULT_BYTES = RESULT_FLOATS * 4;

const MAX_PLANES = 6;
const MAX_BOXES = 32;
const MAX_SPHERES = 16;

// Scene data layout (padded to 16-byte alignment):
// [numPlanes, numBoxes, numSpheres, pad]
// planes[6]: each = [point.xyz, pad, normal.xyz, absorption, axisA, axisB, boundsMin.xyz(2 axes), boundsMax.xyz(2 axes)]
//   simplified: point.xyz+pad, normal.xyz+absorption, min.x,min.y,min.z,pad, max.x,max.y,max.z,pad = 16 floats
// boxes[32]: min.xyz+pad, max.xyz+absorption = 8 floats
// spheres[16]: center.xyz+radius, absorption+pad*3 = 8 floats

const WGSL_SOURCE = /* wgsl */ `
struct Config {
  origin: vec3f,
  numRays: u32,
  maxBounces: u32,
  numPlanes: u32,
  numBoxes: u32,
  numSpheres: u32,
}

struct Plane {
  point: vec3f,
  _pad0: f32,
  normal: vec3f,
  absorption: f32,
  boundsMin: vec3f,
  _pad1: f32,
  boundsMax: vec3f,
  _pad2: f32,
  // axes encoded in bounds: we check all 3 axes against bounds
}

struct Box {
  bmin: vec3f,
  _pad0: f32,
  bmax: vec3f,
  absorption: f32,
}

struct Sphere {
  center: vec3f,
  radius: f32,
  absorption: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var<uniform> config: Config;
@group(0) @binding(1) var<storage, read> rays: array<vec4f>; // direction.xyz per ray
@group(0) @binding(2) var<storage, read> planes: array<Plane>;
@group(0) @binding(3) var<storage, read> boxes: array<Box>;
@group(0) @binding(4) var<storage, read> spheres: array<Sphere>;
@group(0) @binding(5) var<storage, read_write> results: array<f32>;

const EPSILON: f32 = 0.0001;
const FAR: f32 = 100.0;

fn rayPlaneIntersect(origin: vec3f, dir: vec3f, p: Plane) -> f32 {
  let denom = dot(dir, p.normal);
  if (abs(denom) < EPSILON) { return -1.0; }
  let t = dot(p.point - origin, p.normal) / denom;
  if (t < EPSILON) { return -1.0; }
  let hit = origin + dir * t;
  if (hit.x < p.boundsMin.x - EPSILON || hit.x > p.boundsMax.x + EPSILON) { return -1.0; }
  if (hit.y < p.boundsMin.y - EPSILON || hit.y > p.boundsMax.y + EPSILON) { return -1.0; }
  if (hit.z < p.boundsMin.z - EPSILON || hit.z > p.boundsMax.z + EPSILON) { return -1.0; }
  return t;
}

fn rayBoxIntersect(origin: vec3f, dir: vec3f, b: Box) -> vec4f {
  // Returns vec4(t, normal.xyz) or vec4(-1, 0, 0, 0)
  var tmin: f32 = -1e20;
  var tmax: f32 = 1e20;
  var hitNormal = vec3f(0.0);

  // X slab
  var invD = 1.0 / dir.x;
  var t0 = (b.bmin.x - origin.x) * invD;
  var t1 = (b.bmax.x - origin.x) * invD;
  var n0 = vec3f(-sign(dir.x), 0.0, 0.0);
  if (invD < 0.0) { let tmp = t0; t0 = t1; t1 = tmp; n0 = -n0; }
  if (t0 > tmin) { tmin = t0; hitNormal = n0; }
  tmax = min(tmax, t1);
  if (tmax < tmin) { return vec4f(-1.0, 0.0, 0.0, 0.0); }

  // Y slab
  invD = 1.0 / dir.y;
  t0 = (b.bmin.y - origin.y) * invD;
  t1 = (b.bmax.y - origin.y) * invD;
  n0 = vec3f(0.0, -sign(dir.y), 0.0);
  if (invD < 0.0) { let tmp = t0; t0 = t1; t1 = tmp; n0 = -n0; }
  if (t0 > tmin) { tmin = t0; hitNormal = n0; }
  tmax = min(tmax, t1);
  if (tmax < tmin) { return vec4f(-1.0, 0.0, 0.0, 0.0); }

  // Z slab
  invD = 1.0 / dir.z;
  t0 = (b.bmin.z - origin.z) * invD;
  t1 = (b.bmax.z - origin.z) * invD;
  n0 = vec3f(0.0, 0.0, -sign(dir.z));
  if (invD < 0.0) { let tmp = t0; t0 = t1; t1 = tmp; n0 = -n0; }
  if (t0 > tmin) { tmin = t0; hitNormal = n0; }
  tmax = min(tmax, t1);
  if (tmax < tmin) { return vec4f(-1.0, 0.0, 0.0, 0.0); }

  if (tmin < EPSILON) { return vec4f(-1.0, 0.0, 0.0, 0.0); }
  return vec4f(tmin, hitNormal);
}

fn raySphereIntersect(origin: vec3f, dir: vec3f, s: Sphere) -> vec4f {
  let oc = origin - s.center;
  let a = dot(dir, dir);
  let b = 2.0 * dot(oc, dir);
  let c = dot(oc, oc) - s.radius * s.radius;
  let disc = b * b - 4.0 * a * c;
  if (disc < 0.0) { return vec4f(-1.0, 0.0, 0.0, 0.0); }
  var t = (-b - sqrt(disc)) / (2.0 * a);
  if (t < EPSILON) {
    t = (-b + sqrt(disc)) / (2.0 * a);
    if (t < EPSILON) { return vec4f(-1.0, 0.0, 0.0, 0.0); }
  }
  let hit = origin + dir * t;
  let normal = normalize(hit - s.center);
  return vec4f(t, normal);
}

fn reflect(v: vec3f, n: vec3f) -> vec3f {
  return v - 2.0 * dot(v, n) * n;
}

// Check if point can see origin (LOS check)
fn checkLOS(point: vec3f, target: vec3f) -> f32 {
  let toTarget = target - point;
  let dist = length(toTarget);
  if (dist < 0.01) { return 1.0; }
  let dir = toTarget / dist;
  let o = point + dir * 0.01;

  var nearestT: f32 = dist;
  var blocked: bool = false;

  for (var i = 0u; i < config.numPlanes; i++) {
    let t = rayPlaneIntersect(o, dir, planes[i]);
    if (t > 0.0 && t < nearestT - 0.02) { blocked = true; break; }
  }
  if (!blocked) {
    for (var i = 0u; i < config.numBoxes; i++) {
      let r = rayBoxIntersect(o, dir, boxes[i]);
      if (r.x > 0.0 && r.x < nearestT - 0.02) { blocked = true; break; }
    }
  }
  if (!blocked) {
    for (var i = 0u; i < config.numSpheres; i++) {
      let r = raySphereIntersect(o, dir, spheres[i]);
      if (r.x > 0.0 && r.x < nearestT - 0.02) { blocked = true; break; }
    }
  }

  if (blocked) { return 0.0; }
  return 1.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= config.numRays) { return; }

  let baseOffset = idx * ${RESULT_FLOATS}u;
  let rayDir = vec3f(rays[idx].x, rays[idx].y, rays[idx].z);

  var origin = config.origin;
  var dir = rayDir;
  var totalDist: f32 = 0.0;
  var absorption: f32 = 1.0;
  var bestLOS: f32 = 0.0;
  var firstHitDist: f32 = FAR;
  var hitCount: u32 = 0u;
  var segIdx: u32 = 0u;

  for (var bounce = 0u; bounce <= config.maxBounces; bounce++) {
    var nearestT: f32 = FAR;
    var nearestNormal = vec3f(0.0, 1.0, 0.0);
    var nearestAbsorption: f32 = 0.05;
    var hitType: u32 = 0u; // 0=none, 1=plane, 2=box, 3=sphere
    var hitIdx: u32 = 0u;

    // Test planes (walls)
    for (var i = 0u; i < config.numPlanes; i++) {
      let t = rayPlaneIntersect(origin, dir, planes[i]);
      if (t > 0.0 && t < nearestT) {
        nearestT = t;
        nearestNormal = planes[i].normal;
        nearestAbsorption = planes[i].absorption;
        hitType = 1u;
        hitIdx = i;
      }
    }

    // Test boxes
    for (var i = 0u; i < config.numBoxes; i++) {
      let r = rayBoxIntersect(origin, dir, boxes[i]);
      if (r.x > 0.0 && r.x < nearestT) {
        nearestT = r.x;
        nearestNormal = vec3f(r.y, r.z, r.w);
        nearestAbsorption = boxes[i].absorption;
        hitType = 2u;
        hitIdx = i;
      }
    }

    // Test spheres
    for (var i = 0u; i < config.numSpheres; i++) {
      let r = raySphereIntersect(origin, dir, spheres[i]);
      if (r.x > 0.0 && r.x < nearestT) {
        nearestT = r.x;
        nearestNormal = vec3f(r.y, r.z, r.w);
        nearestAbsorption = spheres[i].absorption;
        hitType = 3u;
        hitIdx = i;
      }
    }

    let hitPoint = origin + dir * nearestT;

    // Write segment
    if (segIdx < ${maxBounces + 1}u) {
      let segOff = baseOffset + 5u + segIdx * 6u;
      results[segOff + 0u] = origin.x;
      results[segOff + 1u] = origin.y;
      results[segOff + 2u] = origin.z;
      results[segOff + 3u] = hitPoint.x;
      results[segOff + 4u] = hitPoint.y;
      results[segOff + 5u] = hitPoint.z;
      segIdx++;
    }

    totalDist += nearestT;
    if (bounce == 0u) { firstHitDist = nearestT; }

    if (hitType == 0u) { break; }

    hitCount++;
    absorption *= (1.0 - nearestAbsorption);

    // LOS check from bounce point back to player
    let los = checkLOS(hitPoint, config.origin);
    bestLOS = max(bestLOS, los);

    if (bounce == config.maxBounces) { break; }

    // Reflect
    dir = reflect(dir, nearestNormal);
    origin = hitPoint + nearestNormal * 0.0001;
  }

  // Write summary
  results[baseOffset + 0u] = totalDist;
  results[baseOffset + 1u] = absorption;
  results[baseOffset + 2u] = bestLOS;
  results[baseOffset + 3u] = firstHitDist;
  results[baseOffset + 4u] = f32(hitCount);
}
`;

export async function initGPUTrace() {
  if (!navigator.gpu) {
    console.log('WebGPU not available, using CPU ray tracing');
    return false;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();

    const shaderModule = device.createShaderModule({ code: WGSL_SOURCE });

    // Check for compilation errors
    const info = await shaderModule.getCompilationInfo();
    for (const msg of info.messages) {
      if (msg.type === 'error') {
        console.error('WGSL compile error:', msg.message);
        return false;
      }
    }

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    pipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      compute: { module: shaderModule, entryPoint: 'main' },
    });

    // Config buffer: origin.xyz, numRays, maxBounces, numPlanes, numBoxes, numSpheres (8 u32/f32)
    configBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Ray directions buffer
    const rayData = new Float32Array(numberOfRays * 4);
    for (let i = 0; i < numberOfRays; i++) {
      rayData[i * 4] = rayDirections[i].x;
      rayData[i * 4 + 1] = rayDirections[i].y;
      rayData[i * 4 + 2] = rayDirections[i].z;
      rayData[i * 4 + 3] = 0;
    }
    rayBuffer = device.createBuffer({
      size: rayData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(rayBuffer, 0, rayData);

    // Scene geometry buffers (max sizes, updated each frame)
    const planeBytes = MAX_PLANES * 64; // 16 floats * 4 bytes
    const boxBytes = MAX_BOXES * 32; // 8 floats * 4 bytes
    const sphereBytes = MAX_SPHERES * 32; // 8 floats * 4 bytes

    const planeBuffer = device.createBuffer({
      size: planeBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const boxBuffer = device.createBuffer({
      size: boxBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const sphereBuffer = device.createBuffer({
      size: sphereBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Result buffer
    const resultBytes = numberOfRays * RESULT_BYTES;
    resultBuffer = device.createBuffer({
      size: resultBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    readBuffer = device.createBuffer({
      size: resultBytes,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    sceneBuffer = { planes: planeBuffer, boxes: boxBuffer, spheres: sphereBuffer };

    bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: configBuffer } },
        { binding: 1, resource: { buffer: rayBuffer } },
        { binding: 2, resource: { buffer: planeBuffer } },
        { binding: 3, resource: { buffer: boxBuffer } },
        { binding: 4, resource: { buffer: sphereBuffer } },
        { binding: 5, resource: { buffer: resultBuffer } },
      ],
    });

    gpuReady = true;
    console.log('GPU ray tracing initialized');
    return true;
  } catch (e) {
    console.warn('GPU ray tracing init failed:', e);
    return false;
  }
}

export function isGPUReady() {
  return gpuReady;
}

function uploadSceneData(position, sceneObjects) {
  // Config
  const config = new Float32Array([
    position.x,
    position.y,
    position.z,
    0, // origin + pad
  ]);
  const configU32 = new Uint32Array(config.buffer);
  configU32[3] = numberOfRays;
  // Second vec4: maxBounces, numPlanes, numBoxes, numSpheres
  const config2 = new Uint32Array([maxBounces, walls.length, 0, 0]);

  let numBoxes = 0;
  let numSpheres = 0;
  for (const obj of sceneObjects) {
    if (obj.type === 'box') numBoxes++;
    else if (obj.type === 'sphere') numSpheres++;
  }
  config2[2] = numBoxes;
  config2[3] = numSpheres;

  const fullConfig = new ArrayBuffer(32);
  new Float32Array(fullConfig, 0, 4).set(config);
  new Uint32Array(fullConfig, 16, 4).set(config2);
  device.queue.writeBuffer(configBuffer, 0, fullConfig);

  // Planes (walls)
  const planeData = new Float32Array(MAX_PLANES * 16);
  for (let i = 0; i < walls.length && i < MAX_PLANES; i++) {
    const w = walls[i];
    const off = i * 16;
    planeData[off] = w.point.x;
    planeData[off + 1] = w.point.y;
    planeData[off + 2] = w.point.z;
    planeData[off + 3] = 0;
    planeData[off + 4] = w.normal.x;
    planeData[off + 5] = w.normal.y;
    planeData[off + 6] = w.normal.z;
    planeData[off + 7] = w.material === 'concrete' ? 0.02 : 0.05;
    planeData[off + 8] = w.bounds.min.x;
    planeData[off + 9] = w.bounds.min.y;
    planeData[off + 10] = w.bounds.min.z;
    planeData[off + 11] = 0;
    planeData[off + 12] = w.bounds.max.x;
    planeData[off + 13] = w.bounds.max.y;
    planeData[off + 14] = w.bounds.max.z;
    planeData[off + 15] = 0;
  }
  device.queue.writeBuffer(sceneBuffer.planes, 0, planeData);

  // Boxes
  const boxData = new Float32Array(MAX_BOXES * 8);
  let bi = 0;
  for (const obj of sceneObjects) {
    if (obj.type !== 'box' || bi >= MAX_BOXES) continue;
    const off = bi * 8;
    boxData[off] = obj.min.x;
    boxData[off + 1] = obj.min.y;
    boxData[off + 2] = obj.min.z;
    boxData[off + 3] = 0;
    boxData[off + 4] = obj.max.x;
    boxData[off + 5] = obj.max.y;
    boxData[off + 6] = obj.max.z;
    boxData[off + 7] = getAbsorption(obj.material);
    bi++;
  }
  device.queue.writeBuffer(sceneBuffer.boxes, 0, boxData);

  // Spheres
  const sphereData = new Float32Array(MAX_SPHERES * 8);
  let si = 0;
  for (const obj of sceneObjects) {
    if (obj.type !== 'sphere' || si >= MAX_SPHERES) continue;
    const off = si * 8;
    sphereData[off] = obj.center.x;
    sphereData[off + 1] = obj.center.y;
    sphereData[off + 2] = obj.center.z;
    sphereData[off + 3] = obj.radius;
    sphereData[off + 4] = getAbsorption(obj.material);
    sphereData[off + 5] = 0;
    sphereData[off + 6] = 0;
    sphereData[off + 7] = 0;
    si++;
  }
  device.queue.writeBuffer(sceneBuffer.spheres, 0, sphereData);
}

export async function gpuTraceAllRays(position, sceneObjects) {
  if (!gpuReady) return null;

  uploadSceneData(position, sceneObjects);

  const commandEncoder = device.createCommandEncoder();
  const pass = commandEncoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(numberOfRays / 64));
  pass.end();

  commandEncoder.copyBufferToBuffer(resultBuffer, 0, readBuffer, 0, numberOfRays * RESULT_BYTES);
  device.queue.submit([commandEncoder.finish()]);

  await readBuffer.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(readBuffer.getMappedRange().slice(0));
  readBuffer.unmap();

  // Parse results into TraceResult objects
  const results = new Array(numberOfRays);
  for (let i = 0; i < numberOfRays; i++) {
    const r = new TraceResult(i);
    const off = i * RESULT_FLOATS;
    r.totalDistance = data[off];
    r.accumulatedAbsorption = data[off + 1];
    r.occlusionFactor = data[off + 2];
    r.firstHitDistance = data[off + 3];
    r.hitCount = data[off + 4];

    // Parse segments
    for (let j = 0; j < r.hitCount + 1 && j < maxBounces + 1; j++) {
      const segOff = off + 5 + j * 6;
      r.segments.push({
        start: { x: data[segOff], y: data[segOff + 1], z: data[segOff + 2] },
        end: { x: data[segOff + 3], y: data[segOff + 4], z: data[segOff + 5] },
      });
    }

    r.finalDirection = rayDirections[i]; // approximation
    results[i] = r;
  }

  return results;
}
