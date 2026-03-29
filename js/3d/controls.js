import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { roomWidth, roomHeight, roomDepth } from './config.js';

const keys = {};
let controls = null;
let isActive = false;

const halfW = roomWidth / 2 - 0.5;
const halfD = roomDepth / 2 - 0.5;

// Player position (separate from camera -- camera orbits around this point)
const playerPos = new THREE.Vector3(0, 1.7, 0);

export function initControls(camera, domElement) {
  const overlay = document.getElementById('overlay');

  // OrbitControls: drag to orbit, pinch/scroll to zoom, two-finger pan
  controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 0.5;
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI * 0.95;
  controls.minPolarAngle = Math.PI * 0.05;
  controls.target.copy(playerPos);

  // Start camera looking at center from a reasonable angle
  camera.position.set(15, 15, 15);
  controls.update();

  // Activate on first interaction
  const activate = e => {
    if (isActive) return;
    e.preventDefault?.();
    isActive = true;
    if (overlay) overlay.style.display = 'none';
  };

  domElement.addEventListener('pointerdown', activate);
  domElement.addEventListener('touchstart', activate, { passive: false });
  overlay?.addEventListener('click', activate);
  overlay?.addEventListener('touchstart', activate, { passive: false });

  // Keyboard (desktop)
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
  });
  document.addEventListener('keyup', e => {
    keys[e.code] = false;
  });

  // Clamp orbit target to room bounds
  controls.addEventListener('change', () => {
    clampTarget();
  });
}

function clampTarget() {
  if (!controls) return;
  const t = controls.target;
  t.x = Math.max(-halfW, Math.min(halfW, t.x));
  t.y = Math.max(0.5, Math.min(roomHeight - 0.5, t.y));
  t.z = Math.max(-halfD, Math.min(halfD, t.z));
  playerPos.copy(t);
}

export function updateControls(camera, delta) {
  if (!controls) return;
  controls.update();
  playerPos.copy(controls.target);
}

export function isControlsActive() {
  return isActive;
}

export function isMobileDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Get the orbit target position (where rays are traced from)
export function getPlayerPosition() {
  return { x: playerPos.x, y: playerPos.y, z: playerPos.z };
}
