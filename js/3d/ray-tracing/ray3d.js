// Ray3D data structure and TraceResult

export class Ray3D {
  constructor(origin, direction, maxBounces = 8) {
    this.origin = origin;
    this.direction = direction; // unit vector
    this.maxBounces = maxBounces;
  }
}

// Result of tracing a single ray through the scene
export class TraceResult {
  constructor(rayIndex) {
    this.rayIndex = rayIndex;
    this.segments = []; // [{start, end}, ...]
    this.totalDistance = 0;
    this.accumulatedAbsorption = 1.0; // 1.0 = full energy, decreases with each bounce
    this.hitCount = 0;
    this.finalDirection = { x: 0, y: 0, z: 0 };
    this.occlusionFactor = 1.0; // 1.0 = fully visible, 0.0 = fully occluded
    this.firstHitDistance = Infinity; // distance to first surface hit
  }
}
