import * as THREE from 'three';
import { createRenderer, createScene, createCamera, handleResize } from './scene-setup.js';
import { createRoomMeshes } from './room.js';
import {
  initControls,
  updateControls,
  isControlsActive,
  isMobileDevice,
  getPlayerPosition,
} from './controls.js';
import { traceAllRays } from './ray-tracing/trace.js';
import {
  createRayVisualization,
  updateRayVisualization,
  toggleRayVisibility,
} from './rendering/ray-visualization.js';
import { initAudio, toggleAudio, updateAudio, isAudioPlaying } from './audio/audio-bridge.js';
import {
  addBox,
  addWall,
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

// Set overlay content
const overlay = document.getElementById('overlay');
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (overlay) {
  overlay.innerHTML = isMobile
    ? `<div class="instructions">
    Tap to start<br>
    Drag to orbit &middot; Pinch to zoom<br>
    Two-finger drag to pan
  </div>`
    : `<div class="instructions">
    Click to start<br>
    Drag to orbit &middot; Scroll to zoom &middot; Right-drag to pan<br>
    <kbd>V</kbd> toggle audio &nbsp; <kbd>R</kbd> toggle rays<br>
    <kbd>1</kbd> place box &nbsp; <kbd>2</kbd> place sphere
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

  // Add interior walls to divide the space
  addWall(scene, -6, 0, 12, 10, 0, 'concrete'); // wall along X axis
  addWall(scene, 8, -5, 10, 10, Math.PI / 2, 'concrete'); // wall along Z axis
  addWall(scene, 4, 10, 14, 10, Math.PI / 4, 'wood'); // angled wall
  addWall(scene, -10, 10, 8, 10, -Math.PI / 6, 'concrete'); // another angled wall
  addBox(scene, 12, 2.5, -10, 5, 5, 5, 'metal'); // a pillar-like box

  // Auto-start audio on first interaction
  let audioStarted = false;
  const startAudioOnce = () => {
    if (audioStarted) return;
    audioStarted = true;
    toggleAudio();
  };
  document.addEventListener('pointerdown', startAudioOnce, { once: true });
  document.addEventListener('touchstart', startAudioOnce, { once: true });

  // Mobile audio toggle button
  const audioBtn = document.createElement('div');
  audioBtn.textContent = '\u266B';
  audioBtn.style.cssText =
    'position:fixed;bottom:20px;right:20px;width:50px;height:50px;border-radius:50%;' +
    'background:rgba(255,255,255,0.2);border:2px solid rgba(255,255,255,0.4);color:#fff;' +
    'font-size:22px;display:flex;align-items:center;justify-content:center;z-index:20;cursor:pointer;';
  audioBtn.addEventListener('click', () => toggleAudio());
  audioBtn.addEventListener(
    'touchstart',
    e => {
      e.preventDefault();
      toggleAudio();
    },
    { passive: false }
  );
  document.body.appendChild(audioBtn);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
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

  // Rays trace from the orbit target (player position), not camera
  const position = getPlayerPosition();

  // Camera direction for audio listener
  camera.getWorldDirection(cameraForward);
  cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const forward = { x: cameraForward.x, y: cameraForward.y, z: cameraForward.z };

  const traceResults = traceAllRays(position, forward);

  // Update visualization
  updateRayVisualization(traceResults);

  // Update audio (listener at camera position for correct HRTF)
  const camPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  const up = { x: cameraUp.x, y: cameraUp.y, z: cameraUp.z };
  updateAudio(traceResults, camPos, forward, up);

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
