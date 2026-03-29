import * as Vec3 from '../math/vec3.js';

const EPSILON = 1e-6;

// Ray-Plane intersection
// Returns { t, point, normal } or null
// plane: { point, normal, bounds, axes, material }
export function rayPlane(origin, direction, plane) {
  const denom = Vec3.dot(direction, plane.normal);
  if (Math.abs(denom) < EPSILON) return null; // parallel

  const diff = Vec3.subtract(plane.point, origin);
  const t = Vec3.dot(diff, plane.normal) / denom;
  if (t < EPSILON) return null; // behind ray

  const point = Vec3.add(origin, Vec3.scale(direction, t));

  // Check bounds (rectangular wall)
  const [a0, a1] = plane.axes;
  const min = plane.bounds.min;
  const max = plane.bounds.max;
  if (point[a0] < min[a0] - EPSILON || point[a0] > max[a0] + EPSILON) return null;
  if (point[a1] < min[a1] - EPSILON || point[a1] > max[a1] + EPSILON) return null;

  return { t, point, normal: plane.normal, material: plane.material };
}

// Ray-Sphere intersection (quadratic formula -- same as 2D rayCircleIntersection)
// sphere: { center: {x,y,z}, radius: number, material: string }
export function raySphere(origin, direction, sphere) {
  const oc = Vec3.subtract(origin, sphere.center);
  const a = Vec3.dot(direction, direction);
  const b = 2 * Vec3.dot(oc, direction);
  const c = Vec3.dot(oc, oc) - sphere.radius * sphere.radius;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) return null;

  const sqrtD = Math.sqrt(discriminant);
  let t = (-b - sqrtD) / (2 * a);
  if (t < EPSILON) {
    t = (-b + sqrtD) / (2 * a);
    if (t < EPSILON) return null;
  }

  const point = Vec3.add(origin, Vec3.scale(direction, t));
  const normal = Vec3.normalize(Vec3.subtract(point, sphere.center));
  return { t, point, normal, material: sphere.material || 'default' };
}

// Ray-AABB intersection (slab method)
// box: { min: {x,y,z}, max: {x,y,z}, material: string }
export function rayAABB(origin, direction, box) {
  let tmin = -Infinity;
  let tmax = Infinity;
  let hitNormal = { x: 0, y: 0, z: 0 };

  const axes = ['x', 'y', 'z'];
  for (const axis of axes) {
    const invD = 1 / direction[axis];
    let t0 = (box.min[axis] - origin[axis]) * invD;
    let t1 = (box.max[axis] - origin[axis]) * invD;

    let normal0 = { x: 0, y: 0, z: 0 };
    normal0[axis] = -Math.sign(direction[axis]);

    if (invD < 0) {
      [t0, t1] = [t1, t0];
      normal0[axis] = -normal0[axis];
    }

    if (t0 > tmin) {
      tmin = t0;
      hitNormal = { ...normal0 };
    }
    tmax = Math.min(tmax, t1);

    if (tmax < tmin) return null;
  }

  if (tmin < EPSILON) return null;

  const point = Vec3.add(origin, Vec3.scale(direction, tmin));
  return { t: tmin, point, normal: hitNormal, material: box.material || 'default' };
}
