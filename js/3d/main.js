import * as THREE from 'three';
import { createRenderer, createScene, createCamera, handleResize } from './scene-setup.js';
import { createRoomMeshes } from './room.js';
import { initControls, updateControls, isControlsActive, isMobileDevice } from './controls.js';
import { traceAllRays } from './ray-tracing/trace.js';
import {
  createRayVisualization,
  updateRayVisualization,
  toggleRayVisibility,
} from './rendering/ray-visualization.js';
import { initAudio, toggleAudio, updateAudio, isAudioPlaying } from './audio/audio-bridge.js';
import {
  addBox,
  addSphere,
  placeAtCameraTarget,
  removeLastObject,
} from './objects/scene-objects.js';

// Inject styles (avoids PostCSS/Tailwind pipeline on inline <style> tags)
const style = document.createElement('style');
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { overflow: hidden; background: #000; }
  canvas { display: block; }
  #overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.7); color: #fff; font-family: monospace;
    font-size: 18px; cursor: pointer; z-index: 10;
  }
  #overlay .instructions { text-align: center; line-height: 2; }
  #overlay .instructions kbd {
    background: #333; padding: 2px 8px; border-radius: 3px; border: 1px solid #555;
  }
  #fps {
    position: fixed; top: 8px; left: 8px; color: #0f0;
    font-family: monospace; font-size: 14px; z-index: 5; pointer-events: none;
  }
`;
document.head.appendChild(style);

// Set overlay content (different text for mobile vs desktop)
const overlay = document.getElementById('overlay');
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (overlay) {
  overlay.innerHTML = isMobile
    ? `<div class="instructions">
    Tap to start<br>
    Left joystick to move<br>
    Right side to look around
  </div>`
    : `<div class="instructions">
    Click to start<br>
    <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to move<br>
    Mouse to look around<br>
    <kbd>V</kbd> toggle audio &nbsp; <kbd>R</kbd> toggle rays<br>
    <kbd>1</kbd> place box &nbsp; <kbd>2</kbd> place sphere &nbsp; <kbd>Esc</kbd> release cursor
  </div>`;
}

let renderer, scene, camera;
let clock;
const fpsEl = document.getElementById('fps');
let frameCount = 0;
let lastFpsTime = 0;

// Camera direction helpers
const cameraForward = new THREE.Vector3();
const cameraUp = new THREE.Vector3();

async function init() {
  // Create canvas
  const canvas = document.createElement('canvas');
  document.body.prepend(canvas);

  // Setup Three.js
  renderer = await createRenderer(canvas);
  scene = createScene();
  camera = createCamera();
  clock = new THREE.Clock();

  // Room
  createRoomMeshes(scene);

  // Controls
  initControls(camera, canvas);

  // Ray visualization
  createRayVisualization(scene);

  // Audio
  initAudio();

  // Add some default objects to make the scene interesting
  addBox(scene, -4, 1, -4, 2, 2, 2, 'wood');
  addBox(scene, 5, 1.5, 3, 3, 3, 1, 'metal');
  addSphere(scene, 3, 1.5, -5, 1.5, 'glass');
  addSphere(scene, -6, 2, 6, 2, 'metal');

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (!isControlsActive()) return;
    switch (e.code) {
      case 'KeyV':
        toggleAudio();
        break;
      case 'KeyR':
        toggleRayVisibility();
        break;
      case 'Digit1':
        placeAtCameraTarget(scene, camera, 'box');
        break;
      case 'Digit2':
        placeAtCameraTarget(scene, camera, 'sphere');
        break;
      case 'KeyZ':
        if (e.ctrlKey || e.metaKey) removeLastObject(scene);
        break;
    }
  });

  // Handle resize
  handleResize(camera, renderer);

  // Start animation loop
  renderer.setAnimationLoop(animate);
}

function animate() {
  const delta = clock.getDelta();

  // Update movement
  updateControls(camera, delta);

  // Get camera vectors for audio and ray tracing
  camera.getWorldDirection(cameraForward);
  cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

  // Trace rays from camera position
  const position = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  };
  const forward = {
    x: cameraForward.x,
    y: cameraForward.y,
    z: cameraForward.z,
  };

  const traceResults = traceAllRays(position, forward);

  // Update visualization
  updateRayVisualization(traceResults);

  // Update audio
  const up = { x: cameraUp.x, y: cameraUp.y, z: cameraUp.z };
  updateAudio(traceResults, position, forward, up);

  // Render
  renderer.render(scene, camera);

  // FPS
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime > 500) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    if (fpsEl) fpsEl.textContent = `${fps} FPS`;
    frameCount = 0;
    lastFpsTime = now;
  }
}

init().catch(console.error);
