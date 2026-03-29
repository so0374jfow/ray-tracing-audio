// 3D Ray-Traced Audio configuration

export const numberOfRays = 64;
export const maxBounces = 8;

// Room dimensions in meters
export const roomWidth = 40;
export const roomHeight = 20;
export const roomDepth = 40;

// Audio
export const pixelMeterRatio = 1; // 3D units are meters directly
export const distClamp = 100; // max distance for audio calculations (meters)
export const smoothTime = 0.02; // audio parameter ramp time (seconds)

// Movement
export const moveSpeed = 5; // meters per second
export const mouseSensitivity = 0.002;

// Trail caching thresholds (Vercidium-inspired)
export const cachePositionThreshold = 0.1; // meters
export const cacheRotationThreshold = 0.035; // ~2 degrees in radians

// Fibonacci sphere: precompute ray directions
const goldenRatio = (1 + Math.sqrt(5)) / 2;
export const rayDirections = [];
for (let i = 0; i < numberOfRays; i++) {
  const theta = Math.acos(1 - (2 * (i + 0.5)) / numberOfRays);
  const phi = 2 * Math.PI * i * goldenRatio;
  rayDirections.push({
    x: Math.sin(theta) * Math.cos(phi),
    y: Math.cos(theta),
    z: Math.sin(theta) * Math.sin(phi),
  });
}
