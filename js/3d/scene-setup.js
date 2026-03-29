import * as THREE from 'three';

let renderer;
let useWebGPU = false;

export async function createRenderer(canvas) {
  // Try WebGPU first
  if (navigator.gpu) {
    try {
      const { default: WebGPURenderer } = await import(
        'three/src/renderers/webgpu/WebGPURenderer.js'
      );
      renderer = new WebGPURenderer({ canvas, antialias: true });
      await renderer.init();
      useWebGPU = true;
      console.log('Using WebGPU renderer');
    } catch (e) {
      console.warn('WebGPU init failed, falling back to WebGL:', e);
    }
  }

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    console.log('Using WebGL renderer');
  }

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a24);

  // Ambient light -- bright enough to see walls in a big room
  const ambient = new THREE.AmbientLight(0x9999bb, 1.8);
  scene.add(ambient);

  // Point light at center-top of room
  const pointLight = new THREE.PointLight(0xffeedd, 3, 80);
  pointLight.position.set(0, 18, 0);
  pointLight.castShadow = true;
  scene.add(pointLight);

  // Four fill lights in corners for even coverage
  const fillPositions = [
    [-12, 8, -12],
    [12, 8, -12],
    [-12, 8, 12],
    [12, 8, 12],
  ];
  for (const pos of fillPositions) {
    const fill = new THREE.PointLight(0xccccff, 1.2, 50);
    fill.position.set(pos[0], pos[1], pos[2]);
    scene.add(fill);
  }

  // Hemisphere light for natural feel
  const hemiLight = new THREE.HemisphereLight(0xbbbbee, 0x888866, 1.0);
  scene.add(hemiLight);

  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.7, 0); // eye height ~1.7m
  return camera;
}

export function handleResize(camera, renderer) {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

export { useWebGPU };
