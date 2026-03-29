// Fibonacci sphere sampling for uniform ray distribution
// Precomputed in config.js -- this module provides runtime generation if needed

const goldenRatio = (1 + Math.sqrt(5)) / 2;

export function generateDirections(count) {
  const directions = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / count);
    const phi = 2 * Math.PI * i * goldenRatio;
    directions.push({
      x: Math.sin(theta) * Math.cos(phi),
      y: Math.cos(theta),
      z: Math.sin(theta) * Math.sin(phi),
    });
  }
  return directions;
}
