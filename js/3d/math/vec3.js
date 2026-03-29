// 3D vector operations -- pure functions on {x, y, z} objects

export function create(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function lengthSq(v) {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function normalize(v) {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function distance(a, b) {
  return length(subtract(a, b));
}

export function distanceSq(a, b) {
  return lengthSq(subtract(a, b));
}

// R = V - 2(V.N)N
export function reflect(v, normal) {
  const d = 2 * dot(v, normal);
  return {
    x: v.x - d * normal.x,
    y: v.y - d * normal.y,
    z: v.z - d * normal.z,
  };
}

export function negate(v) {
  return { x: -v.x, y: -v.y, z: -v.z };
}

export function lerp(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function copy(v) {
  return { x: v.x, y: v.y, z: v.z };
}
